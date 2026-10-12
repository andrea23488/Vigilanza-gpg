-- CANDIDATA NON APPLICATA. Nessuna attivazione implicita o job pianificato.
BEGIN;
ALTER TABLE public.push_configurazione ADD COLUMN auth_session_check_approved boolean NOT NULL DEFAULT false;
ALTER TABLE public.push_configurazione ADD COLUMN acquisition_cutoff timestamptz CHECK(acquisition_cutoff IS NULL OR isfinite(acquisition_cutoff));
ALTER TABLE public.push_configurazione ADD COLUMN receipt_delay_seconds integer CHECK(receipt_delay_seconds IS NULL OR (receipt_delay_seconds>0 AND receipt_delay_seconds<=retention_days*86400));
ALTER TABLE public.push_configurazione ADD CONSTRAINT push_runtime_retention CHECK(consegne_ttl_seconds IS NULL OR consegne_ttl_seconds<=retention_days*86400);
ALTER FUNCTION public.push_gestisci_dispositivo(uuid,uuid,jsonb) RENAME TO push_gestisci_dispositivo_v1;
CREATE OR REPLACE FUNCTION public.push_gestisci_dispositivo_v1(p_user uuid,p_session uuid,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.push_dispositivi; i uuid; token text; hash text; ttl integer; azione text; now_at timestamptz:=clock_timestamp(); cfg public.push_configurazione;
BEGIN
 IF NOT public.push_sessione_valida(p_user,p_session) THEN RAISE EXCEPTION 'sessione_non_valida';END IF;
 IF jsonb_typeof(p_input) IS DISTINCT FROM 'object' OR jsonb_typeof(p_input->'credenziale_hash') IS DISTINCT FROM 'string'
 OR (p_input->>'credenziale_hash') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'input_non_valido';END IF;
 IF p_input->>'credenziale_hash' IS NULL THEN RAISE EXCEPTION 'input_non_valido';END IF;
 hash:=p_input->>'credenziale_hash';azione:=p_input->>'azione';
 IF azione='stato' THEN
  SELECT * INTO d FROM public.push_dispositivi WHERE installation_id=(p_input->>'installation_id')::uuid;
  IF d.id IS NULL THEN RETURN jsonb_build_object('binding_version','0');END IF;
  IF d.credenziale_hash<>hash THEN RAISE EXCEPTION 'prova_non_valida';END IF;
  RETURN jsonb_build_object('binding_version',d.binding_version::text);
 END IF;
 IF azione='revoca' THEN
  SELECT * INTO d FROM public.push_dispositivi WHERE id=(p_input->>'id')::uuid FOR UPDATE;
  IF d.id IS NULL OR d.user_id<>p_user OR d.credenziale_hash<>hash
    OR d.binding_version::text IS DISTINCT FROM (p_input->>'binding_version') THEN RAISE EXCEPTION 'prova_non_valida';END IF;
  UPDATE public.push_dispositivi SET attivo=false,disattivato_at=now_at,motivo_disattivazione='logout',
   binding_version=binding_version+1 WHERE id=d.id RETURNING * INTO d;
 ELSE
  IF azione IS DISTINCT FROM 'registra' OR jsonb_typeof(p_input->'expo_token') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_input->'piattaforma') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_input->'chat') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p_input->'consegne') IS DISTINCT FROM 'boolean'
    THEN RAISE EXCEPTION 'input_non_valido';END IF;
  SELECT * INTO cfg FROM public.push_configurazione WHERE id=1;ttl:=cfg.binding_ttl_seconds;
  IF cfg.project_id IS NULL OR cfg.ambiente IS NULL THEN RAISE EXCEPTION 'progetto_non_configurato';END IF;
  IF ttl IS NULL THEN RAISE EXCEPTION 'durata_non_configurata';END IF;
  i:=(p_input->>'installation_id')::uuid;token:=p_input->>'expo_token';
  -- Serializza collisioni anche quando la riga ancora non esiste.
  PERFORM pg_advisory_xact_lock(721901);
  SELECT * INTO d FROM public.push_dispositivi WHERE installation_id=i FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.push_dispositivi WHERE expo_token=token AND id IS DISTINCT FROM d.id)
    THEN RAISE EXCEPTION 'collisione';END IF;
  IF d.id IS NOT NULL AND (d.credenziale_hash<>hash OR d.piattaforma IS DISTINCT FROM (p_input->>'piattaforma')) THEN RAISE EXCEPTION 'prova_non_valida';END IF;
  IF (p_input->>'expected_binding_version') IS DISTINCT FROM coalesce(d.binding_version::text,'0') THEN RAISE EXCEPTION 'versione_obsoleta';END IF;
  IF d.id IS NULL THEN
   INSERT INTO public.push_dispositivi(user_id,installation_id,expo_token,project_id,piattaforma,ambiente,credenziale_hash,
    attivo,ultima_verifica_autenticata_at,associazione_scade_at,auth_session_id)
   VALUES(p_user,i,token,cfg.project_id,p_input->>'piattaforma',cfg.ambiente,hash,
    true,now_at,now_at+make_interval(secs=>ttl),p_session) RETURNING * INTO d;
  ELSE
   UPDATE public.push_dispositivi SET user_id=p_user,expo_token=token,auth_session_id=p_session,
    binding_version=CASE WHEN user_id IS DISTINCT FROM p_user OR expo_token IS DISTINCT FROM token
    OR auth_session_id IS DISTINCT FROM p_session OR NOT attivo OR coalesce((p_input->>'token_rotation')::boolean,false) THEN binding_version+1 ELSE binding_version END,attivo=true,disattivato_at=NULL,motivo_disattivazione=NULL,
    ultima_verifica_autenticata_at=now_at,associazione_scade_at=now_at+make_interval(secs=>ttl)
    WHERE id=d.id RETURNING * INTO d;
  END IF;
  INSERT INTO public.push_preferenze(user_id,chat_enabled,collegamenti_enabled,consegne_enabled)
   VALUES(p_user,(p_input->>'chat')::boolean,false,(p_input->>'consegne')::boolean)
   ON CONFLICT(user_id) DO UPDATE SET chat_enabled=excluded.chat_enabled,consegne_enabled=excluded.consegne_enabled,updated_at=now_at;
 END IF;
 UPDATE public.push_consegne SET stato='annullata',claim_id=NULL,lease_until=NULL,finished_at=now_at
 WHERE dispositivo_id=d.id AND binding_version<d.binding_version AND stato IN('pendente','retry','in_elaborazione','esito_incerto');
 RETURN jsonb_build_object('id',d.id,'binding_version',d.binding_version::text);
END;$$;

REVOKE ALL ON FUNCTION public.push_gestisci_dispositivo_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.push_dispositivi ADD COLUMN last_registration_operation uuid;
CREATE TABLE public.push_registration_ops(
 operation_id uuid PRIMARY KEY,installation_id uuid NOT NULL,credential_hash text NOT NULL CHECK(credential_hash ~ '^[0-9a-f]{64}$'),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,session_id uuid NOT NULL,
 stato text NOT NULL CHECK(stato IN('prepared','completed','revoked')),expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),
 payload_hash text,result_id uuid,result_version bigint,
 CHECK(payload_hash IS NULL OR payload_hash ~ '^[0-9a-f]{64}$'),
 CHECK(stato<>'completed' OR (payload_hash IS NOT NULL AND result_id IS NOT NULL AND result_version IS NOT NULL AND result_version BETWEEN 1 AND 9007199254740991))
);
ALTER TABLE public.push_registration_ops ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_registration_ops FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE public.push_rate_budget(
 tipo text NOT NULL CHECK(tipo IN('sender','recipient','registration')),chiave uuid NOT NULL,minuto timestamptz NOT NULL,
 used integer NOT NULL CHECK(used>0),PRIMARY KEY(tipo,chiave,minuto)
);
CREATE FUNCTION public.push_gestisci_dispositivo(p_user uuid,p_session uuid,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.push_dispositivi; pref public.push_preferenze; r jsonb; hash text; t timestamptz:=clock_timestamp();op public.push_registration_ops;fingerprint text;ttl integer;used integer;m timestamptz:=date_trunc('minute',clock_timestamp());
BEGIN
 IF jsonb_typeof(p_input) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'input_non_valido';END IF;
 IF p_input->>'azione' IN('stato','registra','rinnova','prepara_operazione','revoca_intenzione') AND
  (jsonb_typeof(p_input->'installation_id') IS DISTINCT FROM 'string' OR (p_input->>'installation_id') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$') THEN RAISE EXCEPTION 'input_non_valido';END IF;
 IF p_input->>'azione' IN('prepara_operazione','revoca_intenzione') AND
  (jsonb_typeof(p_input->'operation_id') IS DISTINCT FROM 'string' OR (p_input->>'operation_id') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$') THEN RAISE EXCEPTION 'input_non_valido';END IF;
 IF p_input->>'azione' IN('revoca','revoca_offline') AND
  (jsonb_typeof(p_input->'id') IS DISTINCT FROM 'string' OR (p_input->>'id') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$') THEN RAISE EXCEPTION 'input_non_valido';END IF;
 IF p_input->>'azione'='revoca_intenzione' THEN
  IF jsonb_typeof(p_input->'credenziale_hash') IS DISTINCT FROM 'string' OR (p_input->>'credenziale_hash') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'input_non_valido';END IF;
  PERFORM pg_advisory_xact_lock(721901);
  SELECT * INTO op FROM public.push_registration_ops WHERE operation_id=(p_input->>'operation_id')::uuid FOR UPDATE;
  IF op.operation_id IS NULL THEN RETURN jsonb_build_object('revocata',true);END IF;
  hash:=p_input->>'credenziale_hash';
  IF op.installation_id IS DISTINCT FROM (p_input->>'installation_id')::uuid OR op.credential_hash<>hash THEN RAISE EXCEPTION 'prova_non_valida';END IF;
  UPDATE public.push_registration_ops SET stato='revoked' WHERE operation_id=op.operation_id;
  UPDATE public.push_dispositivi SET attivo=false,disattivato_at=t,motivo_disattivazione='logout',binding_version=least(binding_version+1,9007199254740991)
   WHERE installation_id=op.installation_id AND credenziale_hash=hash AND last_registration_operation=op.operation_id AND attivo;
  RETURN jsonb_build_object('revocata',true);
 END IF;
 IF p_input->>'azione'='revoca_offline' THEN
  IF jsonb_typeof(p_input->'credenziale_hash') IS DISTINCT FROM 'string' OR (p_input->>'credenziale_hash') !~ '^[0-9a-f]{64}$'
   OR jsonb_typeof(p_input->'binding_version') IS DISTINCT FROM 'string' OR (p_input->>'binding_version') !~ '^[1-9][0-9]{0,15}$'
   THEN RAISE EXCEPTION 'input_non_valido';END IF;
  SELECT * INTO d FROM public.push_dispositivi WHERE id=(p_input->>'id')::uuid FOR UPDATE;
  IF d.id IS NULL THEN RETURN jsonb_build_object('revocata',true);END IF;
  hash:=p_input->>'credenziale_hash';
  IF d.credenziale_hash<>hash THEN RAISE EXCEPTION 'prova_non_valida';END IF;
  -- Una revoca della vecchia versione non disattiva un nuovo account/binding.
  IF d.binding_version::text<>(p_input->>'binding_version') THEN RETURN jsonb_build_object('revocata',true);END IF;
  UPDATE public.push_dispositivi SET attivo=false,disattivato_at=t,motivo_disattivazione='logout',
   binding_version=least(binding_version+1,9007199254740991) WHERE id=d.id;
  UPDATE public.push_consegne SET stato='annullata',claim_id=NULL,lease_until=NULL,finished_at=t
   WHERE dispositivo_id=d.id AND stato IN('pendente','retry','in_elaborazione','esito_incerto');
  RETURN jsonb_build_object('revocata',true);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.push_configurazione WHERE id=1 AND auth_session_check_approved)
 OR NOT public.push_sessione_valida(p_user,p_session) THEN RAISE EXCEPTION 'sessione_non_verificata';END IF;
 IF p_input->>'azione'='prepara_operazione' THEN
  IF jsonb_typeof(p_input->'credenziale_hash') IS DISTINCT FROM 'string' OR (p_input->>'credenziale_hash') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'input_non_valido';END IF;
  SELECT binding_ttl_seconds INTO ttl FROM public.push_configurazione WHERE id=1;
  IF ttl IS NULL THEN RAISE EXCEPTION 'durata_non_configurata';END IF;
  PERFORM pg_advisory_xact_lock(721901);
  hash:=p_input->>'credenziale_hash';
  IF NOT EXISTS(SELECT 1 FROM public.push_registration_ops WHERE operation_id=(p_input->>'operation_id')::uuid) THEN
   INSERT INTO public.push_rate_budget VALUES('registration',p_user,m,1)
    ON CONFLICT(tipo,chiave,minuto) DO UPDATE SET used=public.push_rate_budget.used+1 RETURNING public.push_rate_budget.used INTO used;
   IF used>(SELECT max_per_mittente_minuto FROM public.push_configurazione WHERE id=1) THEN RAISE EXCEPTION 'rate_limit';END IF;
  END IF;
  INSERT INTO public.push_registration_ops(operation_id,installation_id,credential_hash,user_id,session_id,stato,expires_at)
   VALUES((p_input->>'operation_id')::uuid,(p_input->>'installation_id')::uuid,hash,p_user,p_session,'prepared',t+make_interval(secs=>ttl)) ON CONFLICT DO NOTHING;
  SELECT * INTO op FROM public.push_registration_ops WHERE operation_id=(p_input->>'operation_id')::uuid FOR UPDATE;
  IF op.stato='revoked' OR op.expires_at<=t OR op.user_id<>p_user OR op.session_id<>p_session OR op.credential_hash<>hash
   OR op.installation_id IS DISTINCT FROM (p_input->>'installation_id')::uuid THEN RAISE EXCEPTION 'operazione_non_valida';END IF;
  RETURN jsonb_build_object('preparata',true);
 END IF;
 IF p_input->>'azione' IN('registra','rinnova') THEN
  IF jsonb_typeof(p_input->'operation_id') IS DISTINCT FROM 'string' OR (p_input->>'operation_id') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   OR jsonb_typeof(p_input->'token_rotation') IS DISTINCT FROM 'boolean'
   OR jsonb_typeof(p_input->'expected_binding_version') IS DISTINCT FROM 'string' OR (p_input->>'expected_binding_version') !~ '^(0|[1-9][0-9]{0,15})$'
   THEN RAISE EXCEPTION 'input_non_valido';END IF;
  IF (p_input->>'expected_binding_version')::numeric>9007199254740991 THEN RAISE EXCEPTION 'input_non_valido';END IF;
  PERFORM pg_advisory_xact_lock(721901);
  SELECT * INTO op FROM public.push_registration_ops WHERE operation_id=(p_input->>'operation_id')::uuid FOR UPDATE;
  IF op.operation_id IS NULL OR op.stato='revoked' OR op.expires_at<=t OR op.user_id<>p_user OR op.session_id<>p_session
   OR op.installation_id IS DISTINCT FROM (p_input->>'installation_id')::uuid THEN RAISE EXCEPTION 'operazione_non_valida';END IF;
  IF jsonb_typeof(p_input->'credenziale_hash') IS DISTINCT FROM 'string' OR (p_input->>'credenziale_hash') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'input_non_valido';END IF;
  hash:=p_input->>'credenziale_hash';
  IF op.credential_hash<>hash THEN RAISE EXCEPTION 'prova_non_valida';END IF;
  fingerprint:=encode(sha256(convert_to((p_input-'credenziale_hash')::text,'UTF8')),'hex');
  IF op.stato='completed' THEN
   SELECT * INTO d FROM public.push_dispositivi WHERE id=op.result_id;
   IF op.payload_hash IS DISTINCT FROM fingerprint OR d.id IS NULL OR d.user_id<>p_user OR d.auth_session_id IS DISTINCT FROM p_session
    OR d.binding_version<>op.result_version OR NOT d.attivo THEN RAISE EXCEPTION 'operazione_obsoleta';END IF;
   RETURN jsonb_build_object('id',op.result_id,'binding_version',op.result_version::text);
  END IF;
 END IF;
 IF p_input->>'azione' IN('preferenze','salva_preferenze') THEN
  IF p_input->>'azione'='salva_preferenze' THEN
   IF jsonb_typeof(p_input->'chat') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p_input->'consegne') IS DISTINCT FROM 'boolean'
    THEN RAISE EXCEPTION 'input_non_valido';END IF;
   INSERT INTO public.push_preferenze(user_id,chat_enabled,consegne_enabled) VALUES(p_user,(p_input->>'chat')::boolean,(p_input->>'consegne')::boolean)
    ON CONFLICT(user_id) DO UPDATE SET chat_enabled=excluded.chat_enabled,consegne_enabled=excluded.consegne_enabled,updated_at=t;
  END IF;
  SELECT * INTO pref FROM public.push_preferenze WHERE user_id=p_user;
  RETURN jsonb_build_object('chat',coalesce(pref.chat_enabled,false),'consegne',coalesce(pref.consegne_enabled,false));
 END IF;
 IF p_input->>'azione'='rinnova' THEN
  SELECT * INTO d FROM public.push_dispositivi WHERE installation_id=(p_input->>'installation_id')::uuid FOR UPDATE;
  IF d.id IS NULL OR d.user_id<>p_user OR d.auth_session_id IS DISTINCT FROM p_session
   OR (NOT d.attivo AND d.motivo_disattivazione NOT IN('scadenza','token_non_valido','permesso_revocato')) THEN RAISE EXCEPTION 'binding_non_valido';END IF;
  SELECT * INTO pref FROM public.push_preferenze WHERE user_id=p_user FOR UPDATE;
  p_input:=p_input||jsonb_build_object('azione','registra','chat',coalesce(pref.chat_enabled,false),'consegne',coalesce(pref.consegne_enabled,false));
 END IF;
 r:=public.push_gestisci_dispositivo_v1(p_user,p_session,p_input);
 IF op.operation_id IS NOT NULL THEN
  UPDATE public.push_registration_ops SET stato='completed',payload_hash=fingerprint,result_id=(r->>'id')::uuid,result_version=(r->>'binding_version')::bigint WHERE operation_id=op.operation_id;
  UPDATE public.push_dispositivi SET last_registration_operation=op.operation_id WHERE id=(r->>'id')::uuid;
 END IF;
 IF p_input->>'azione'='stato' THEN
  SELECT * INTO d FROM public.push_dispositivi WHERE installation_id=(p_input->>'installation_id')::uuid AND user_id=p_user;
  IF d.id IS NOT NULL THEN r:=r||jsonb_build_object('id',d.id,'attivo',d.attivo AND d.associazione_scade_at>t,'stessa_sessione',d.auth_session_id=p_session,'rinnovo_necessario',d.associazione_scade_at<=t+make_interval(secs=>(SELECT binding_ttl_seconds/2 FROM public.push_configurazione WHERE id=1)),'rinnovo_consentito',d.auth_session_id=p_session AND (d.attivo OR d.motivo_disattivazione IN('scadenza','token_non_valido','permesso_revocato')));END IF;
 END IF;
 RETURN r;
END;$$;
REVOKE ALL ON FUNCTION public.push_gestisci_dispositivo(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.push_gestisci_dispositivo(uuid,uuid,jsonb) TO service_role;

ALTER TABLE public.push_comunicazioni ADD CONSTRAINT push_comunicazioni_destinatario UNIQUE(id,destinatario_id);
CREATE TABLE public.push_delivery_jobs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 evento_id uuid NOT NULL,destinatario_id uuid NOT NULL,
 FOREIGN KEY(evento_id,destinatario_id) REFERENCES public.push_comunicazioni(id,destinatario_id) ON DELETE CASCADE,
 dispositivo_id uuid NOT NULL REFERENCES public.push_dispositivi(id) ON DELETE CASCADE,
 binding_version bigint NOT NULL CHECK(binding_version BETWEEN 1 AND 9007199254740991),
 stato text NOT NULL DEFAULT 'pending' CHECK(stato IN('pending','retry','leased','submitted','checking','receipt_ok','failed','cancelled','uncertain')),
 tentativi integer NOT NULL DEFAULT 0 CHECK(tentativi BETWEEN 0 AND 10),
 next_at timestamptz NOT NULL DEFAULT now(),claim_id uuid,lease_until timestamptz,
 ticket_id text UNIQUE CHECK(ticket_id IS NULL OR length(ticket_id) BETWEEN 1 AND 512),
 submitted_at timestamptz,receipt_checked_at timestamptz,receipt_status text CHECK(receipt_status IN('ok','error')),
 finished_at timestamptz,code text CHECK(code IN('token_non_valido','rate_limit','permanente','incerto','non_autorizzato','scaduto')),
 UNIQUE(evento_id,dispositivo_id),
 CHECK(isfinite(next_at)),
 CHECK((stato='pending' AND tentativi=0) OR (stato IN('retry','leased','submitted','checking','receipt_ok') AND tentativi>0) OR stato IN('failed','cancelled','uncertain')),
 CHECK((stato IN('leased','checking') AND claim_id IS NOT NULL AND lease_until IS NOT NULL AND isfinite(lease_until))
  OR (stato NOT IN('leased','checking') AND claim_id IS NULL AND lease_until IS NULL)),
 CHECK((ticket_id IS NULL AND submitted_at IS NULL) OR (ticket_id IS NOT NULL AND submitted_at IS NOT NULL AND isfinite(submitted_at))),
 CHECK(stato NOT IN('submitted','checking','receipt_ok') OR ticket_id IS NOT NULL),
 CHECK(stato NOT IN('pending','retry','leased') OR ticket_id IS NULL),
 CHECK((receipt_status IS NULL AND receipt_checked_at IS NULL) OR (receipt_status IS NOT NULL AND receipt_checked_at IS NOT NULL
  AND submitted_at IS NOT NULL AND isfinite(receipt_checked_at) AND receipt_checked_at>=submitted_at)),
 CHECK((stato IN('receipt_ok','failed','cancelled','uncertain') AND finished_at IS NOT NULL AND isfinite(finished_at))
  OR (stato NOT IN('receipt_ok','failed','cancelled','uncertain') AND finished_at IS NULL)),
 CHECK(finished_at IS NULL OR submitted_at IS NULL OR finished_at>=submitted_at),
 CHECK(finished_at IS NULL OR receipt_checked_at IS NULL OR finished_at>=receipt_checked_at),
 CHECK(stato<>'receipt_ok' OR (receipt_status IS NOT DISTINCT FROM 'ok' AND receipt_checked_at IS NOT NULL)),
 CHECK(receipt_status IS DISTINCT FROM 'ok' OR stato='receipt_ok'),
 CHECK(receipt_status IS DISTINCT FROM 'error' OR stato='failed')
);
CREATE INDEX push_delivery_jobs_due ON public.push_delivery_jobs(next_at) WHERE stato IN('pending','retry','submitted');
ALTER TABLE public.push_delivery_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_rate_budget ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_delivery_jobs,public.push_rate_budget FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.push_delivery_jobs TO service_role;

CREATE FUNCTION public.push_comunicazione_valida(p_evento uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.push_comunicazioni;pref public.push_preferenze;
BEGIN
 SELECT * INTO e FROM public.push_comunicazioni WHERE id=p_evento AND expires_at>clock_timestamp();
 IF e.id IS NULL THEN RETURN false;END IF;
 SELECT * INTO pref FROM public.push_preferenze WHERE user_id=e.destinatario_id;
 IF (e.tipo='messaggio_privato' AND pref.chat_enabled IS DISTINCT FROM true)
  OR (e.tipo='consegna_servizio' AND pref.consegne_enabled IS DISTINCT FROM true) THEN RETURN false;END IF;
 IF EXISTS(SELECT 1 FROM public.utenti_bloccati WHERE (bloccante_id=e.mittente_id AND bloccato_id=e.destinatario_id)
  OR (bloccante_id=e.destinatario_id AND bloccato_id=e.mittente_id)) THEN RETURN false;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.colleghi WHERE stato='accettato' AND
  ((user_id=e.mittente_id AND collega_id=e.destinatario_id) OR (user_id=e.destinatario_id AND collega_id=e.mittente_id))) THEN RETURN false;END IF;
 IF e.tipo='messaggio_privato' THEN RETURN EXISTS(SELECT 1 FROM public.messaggi WHERE id::text=e.sorgente_id
  AND mittente_id=e.mittente_id AND destinatario_id=e.destinatario_id AND letto_at IS NULL);
 ELSE RETURN EXISTS(SELECT 1 FROM public.consegne_servizio WHERE id::text=e.sorgente_id
  AND mittente_id=e.mittente_id AND destinatario_id=e.destinatario_id AND letta=false);END IF;
END;$$;
REVOKE ALL ON FUNCTION public.push_comunicazione_valida(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.push_acquisisci_comunicazioni(p_cutoff timestamptz)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;cfg public.push_configurazione;
BEGIN
 SELECT * INTO cfg FROM public.push_configurazione WHERE id=1;
 IF cfg.send_enabled IS DISTINCT FROM true OR cfg.auth_session_check_approved IS DISTINCT FROM true OR cfg.modalita='disabled' THEN RETURN 0;END IF;
 IF p_cutoff IS NULL OR NOT isfinite(p_cutoff) OR p_cutoff>clock_timestamp() THEN RAISE EXCEPTION 'cutoff_non_valido';END IF;
 WITH fonti AS (
  SELECT 'messaggio_privato'::text tipo,id::text sorgente_id,mittente_id,destinatario_id,created_at,
   created_at+make_interval(secs=>cfg.chat_ttl_seconds) expires_at FROM public.messaggi
   WHERE letto_at IS NULL AND created_at>=p_cutoff
  UNION ALL
  SELECT 'consegna_servizio',id::text,mittente_id,destinatario_id,created_at,
   created_at+make_interval(secs=>cfg.consegne_ttl_seconds) FROM public.consegne_servizio
   WHERE letta=false AND created_at>=p_cutoff AND cfg.consegne_ttl_seconds IS NOT NULL
 )
 INSERT INTO public.push_comunicazioni(tipo,sorgente_id,mittente_id,destinatario_id,created_at,expires_at)
 SELECT f.tipo,f.sorgente_id,f.mittente_id,f.destinatario_id,f.created_at,f.expires_at FROM fonti f
 JOIN public.push_preferenze pref ON pref.user_id=f.destinatario_id
 WHERE f.mittente_id<>f.destinatario_id AND f.expires_at>clock_timestamp() AND f.created_at<=clock_timestamp()
 AND ((f.tipo='messaggio_privato' AND pref.chat_enabled) OR (f.tipo='consegna_servizio' AND pref.consegne_enabled))
 AND EXISTS(SELECT 1 FROM public.colleghi WHERE stato='accettato' AND
  ((user_id=f.mittente_id AND collega_id=f.destinatario_id) OR (user_id=f.destinatario_id AND collega_id=f.mittente_id)))
 AND NOT EXISTS(SELECT 1 FROM public.utenti_bloccati WHERE
  (bloccante_id=f.mittente_id AND bloccato_id=f.destinatario_id) OR (bloccante_id=f.destinatario_id AND bloccato_id=f.mittente_id))
 AND NOT EXISTS(SELECT 1 FROM public.push_comunicazioni done WHERE done.tipo=f.tipo AND done.sorgente_id=f.sorgente_id)
 ORDER BY f.created_at,f.tipo,f.sorgente_id LIMIT cfg.batch_size
 ON CONFLICT(tipo,sorgente_id) DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;RETURN n;
END;$$;

CREATE FUNCTION public.push_worker_claim() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cfg public.push_configurazione;j public.push_delivery_jobs;e public.push_comunicazioni;d public.push_dispositivi;
 t timestamptz:=clock_timestamp();m timestamptz:=date_trunc('minute',clock_timestamp());cid uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO cfg FROM public.push_configurazione WHERE id=1;
 IF cfg.send_enabled IS DISTINCT FROM true OR cfg.modalita='disabled' OR cfg.auth_session_check_approved IS DISTINCT FROM true
  OR cfg.project_id IS NULL OR cfg.ambiente IS NULL OR cfg.receipt_delay_seconds IS NULL OR cfg.acquisition_cutoff IS NULL THEN RETURN NULL;END IF;
 PERFORM pg_advisory_xact_lock(721902);
 PERFORM public.push_acquisisci_comunicazioni(cfg.acquisition_cutoff);
 UPDATE public.push_delivery_jobs SET stato='uncertain',claim_id=NULL,lease_until=NULL,finished_at=t,code='incerto'
  WHERE stato='leased' AND lease_until<=t;
 UPDATE public.push_delivery_jobs SET stato='submitted',claim_id=NULL,lease_until=NULL WHERE stato='checking' AND lease_until<=t;
 DELETE FROM public.push_rate_budget WHERE minuto<m-interval '2 minutes';
 INSERT INTO public.push_delivery_jobs(evento_id,destinatario_id,dispositivo_id,binding_version)
 SELECT src.id,src.destinatario_id,dev.id,dev.binding_version FROM public.push_comunicazioni src JOIN public.push_dispositivi dev ON dev.user_id=src.destinatario_id
 WHERE src.expires_at>t AND dev.attivo AND dev.associazione_scade_at>t AND dev.project_id=cfg.project_id AND dev.ambiente=cfg.ambiente
 AND public.push_sessione_valida(dev.user_id,dev.auth_session_id) AND public.push_comunicazione_valida(src.id)
 AND (cfg.modalita='production' OR EXISTS(SELECT 1 FROM public.push_dispositivi_test x WHERE x.dispositivo_id=dev.id AND x.binding_version=dev.binding_version AND x.expires_at>t))
 ON CONFLICT(evento_id,dispositivo_id) DO NOTHING;
 -- Ricevute non causano mai un reinvio; processarle anche dopo una revoca.
 SELECT * INTO j FROM public.push_delivery_jobs WHERE stato='submitted' AND next_at<=t ORDER BY next_at,id FOR UPDATE SKIP LOCKED LIMIT 1;
 IF j.id IS NOT NULL THEN
  UPDATE public.push_delivery_jobs SET stato='checking',claim_id=cid,lease_until=t+make_interval(secs=>cfg.lease_seconds) WHERE id=j.id;
  RETURN jsonb_build_object('id',j.id,'claim_id',cid,'mode','receipt','ticket_id',j.ticket_id);
 END IF;
 FOR j IN SELECT * FROM public.push_delivery_jobs WHERE stato IN('pending','retry') AND next_at<=t ORDER BY next_at,id LIMIT cfg.batch_size FOR UPDATE SKIP LOCKED LOOP
  SELECT * INTO e FROM public.push_comunicazioni WHERE id=j.evento_id;
  SELECT * INTO d FROM public.push_dispositivi WHERE id=j.dispositivo_id;
  IF j.tentativi>=cfg.max_attempts OR NOT public.push_comunicazione_valida(e.id) OR d.attivo IS DISTINCT FROM true
   OR d.binding_version<>j.binding_version OR d.user_id<>e.destinatario_id OR d.associazione_scade_at<=t
   OR NOT public.push_sessione_valida(d.user_id,d.auth_session_id) THEN
   UPDATE public.push_delivery_jobs SET stato='cancelled',finished_at=t,code='non_autorizzato' WHERE id=j.id;CONTINUE;END IF;
  IF coalesce((SELECT used FROM public.push_rate_budget WHERE tipo='sender' AND chiave=e.mittente_id AND minuto=m),0)>=cfg.max_per_mittente_minuto
   OR coalesce((SELECT used FROM public.push_rate_budget WHERE tipo='recipient' AND chiave=e.destinatario_id AND minuto=m),0)>=cfg.max_per_destinatario_minuto THEN
   UPDATE public.push_delivery_jobs SET next_at=m+interval '1 minute' WHERE id=j.id;CONTINUE;END IF;
  INSERT INTO public.push_rate_budget VALUES('sender',e.mittente_id,m,1),('recipient',e.destinatario_id,m,1)
   ON CONFLICT(tipo,chiave,minuto) DO UPDATE SET used=public.push_rate_budget.used+1;
  UPDATE public.push_delivery_jobs SET stato='leased',claim_id=cid,lease_until=t+make_interval(secs=>cfg.lease_seconds),tentativi=tentativi+1 WHERE id=j.id;
  RETURN jsonb_build_object('id',j.id,'claim_id',cid,'mode','send');
 END LOOP;
 RETURN NULL;
END;$$;
REVOKE ALL ON FUNCTION public.push_worker_claim() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.push_worker_claim() TO service_role;

CREATE FUNCTION public.push_worker_authorize(p_job uuid,p_claim uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cfg public.push_configurazione;j public.push_delivery_jobs;e public.push_comunicazioni;d public.push_dispositivi;t timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO cfg FROM public.push_configurazione WHERE id=1;
 IF cfg.send_enabled IS DISTINCT FROM true OR cfg.auth_session_check_approved IS DISTINCT FROM true OR cfg.modalita='disabled' THEN RETURN NULL;END IF;
 SELECT * INTO j FROM public.push_delivery_jobs WHERE id=p_job AND claim_id=p_claim AND stato='leased' AND lease_until>t FOR UPDATE;
 IF j.id IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO e FROM public.push_comunicazioni WHERE id=j.evento_id;
 SELECT * INTO d FROM public.push_dispositivi WHERE id=j.dispositivo_id;
 IF d.attivo IS DISTINCT FROM true OR d.binding_version<>j.binding_version OR d.user_id<>e.destinatario_id
  OR d.associazione_scade_at<=t OR d.project_id IS DISTINCT FROM cfg.project_id OR d.ambiente IS DISTINCT FROM cfg.ambiente
  OR NOT public.push_sessione_valida(d.user_id,d.auth_session_id) OR NOT public.push_comunicazione_valida(e.id)
  OR (cfg.modalita='test' AND NOT EXISTS(SELECT 1 FROM public.push_dispositivi_test x WHERE x.dispositivo_id=d.id AND x.binding_version=d.binding_version AND x.expires_at>t)) THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('token',d.expo_token,'tipo',e.tipo,'evento_id',e.id,'destinatario_id',e.destinatario_id,'expiration',floor(extract(epoch FROM least(e.expires_at,d.associazione_scade_at,coalesce((SELECT not_after FROM auth.sessions WHERE id=d.auth_session_id),d.associazione_scade_at))))::bigint);
END;$$;
REVOKE ALL ON FUNCTION public.push_worker_authorize(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.push_worker_authorize(uuid,uuid) TO service_role;

CREATE FUNCTION public.push_worker_finish(p_job uuid,p_claim uuid,p_outcome jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.push_delivery_jobs;cfg public.push_configurazione;e public.push_comunicazioni;t timestamptz:=clock_timestamp();kind text;delay integer;
BEGIN
 SELECT * INTO j FROM public.push_delivery_jobs WHERE id=p_job AND claim_id=p_claim AND stato IN('leased','checking') FOR UPDATE;
 IF j.id IS NULL THEN RAISE EXCEPTION 'claim_non_valido';END IF;
 SELECT * INTO cfg FROM public.push_configurazione WHERE id=1;SELECT * INTO e FROM public.push_comunicazioni WHERE id=j.evento_id;
 kind:=p_outcome->>'kind';
 IF j.stato='leased' THEN
  IF kind='ticket' THEN
   IF jsonb_typeof(p_outcome->'ticket') IS DISTINCT FROM 'string' OR length(p_outcome->>'ticket') NOT BETWEEN 1 AND 512 THEN RAISE EXCEPTION 'ticket_non_valido';END IF;
   UPDATE public.push_delivery_jobs SET stato='submitted',ticket_id=p_outcome->>'ticket',submitted_at=t,
    next_at=t+make_interval(secs=>cfg.receipt_delay_seconds),claim_id=NULL,lease_until=NULL WHERE id=j.id;
  ELSIF kind='retry' AND j.tentativi<cfg.max_attempts AND e.expires_at>t+make_interval(secs=>power(2,j.tentativi)::integer) THEN
   UPDATE public.push_delivery_jobs SET stato='retry',next_at=t+make_interval(secs=>power(2,j.tentativi)::integer),claim_id=NULL,lease_until=NULL,code='rate_limit' WHERE id=j.id;
  ELSIF kind IN('retry','failed','invalid_token','cancelled','uncertain') THEN
   UPDATE public.push_delivery_jobs SET stato=CASE WHEN kind='cancelled' THEN 'cancelled' WHEN kind='uncertain' THEN 'uncertain' ELSE 'failed' END,
    finished_at=t,claim_id=NULL,lease_until=NULL,code=CASE WHEN kind='invalid_token' THEN 'token_non_valido' WHEN kind='uncertain' THEN 'incerto' ELSE 'permanente' END WHERE id=j.id;
  ELSE RAISE EXCEPTION 'esito_non_valido';END IF;
 ELSE
  IF kind='receipt_ok' OR kind='receipt_error' OR kind='invalid_token' THEN
   UPDATE public.push_delivery_jobs SET stato=CASE WHEN kind='receipt_ok' THEN 'receipt_ok' ELSE 'failed' END,
    receipt_status=CASE WHEN kind='receipt_ok' THEN 'ok' ELSE 'error' END,receipt_checked_at=t,finished_at=t,claim_id=NULL,lease_until=NULL,
    code=CASE WHEN kind='receipt_ok' THEN NULL WHEN kind='invalid_token' THEN 'token_non_valido' ELSE 'permanente' END WHERE id=j.id;
  ELSIF kind='receipt_pending' THEN
   IF j.submitted_at<t-make_interval(days=>cfg.retention_days) THEN
    UPDATE public.push_delivery_jobs SET stato='uncertain',finished_at=t,code='incerto',claim_id=NULL,lease_until=NULL WHERE id=j.id;
   ELSE
    UPDATE public.push_delivery_jobs SET stato='submitted',next_at=t+make_interval(secs=>cfg.receipt_delay_seconds),claim_id=NULL,lease_until=NULL WHERE id=j.id;
   END IF;
  ELSE RAISE EXCEPTION 'esito_non_valido';END IF;
 END IF;
 IF kind='invalid_token' THEN
  UPDATE public.push_dispositivi SET attivo=false,disattivato_at=t,motivo_disattivazione='token_non_valido'
   WHERE id=j.dispositivo_id AND binding_version=j.binding_version;
 END IF;
END;$$;
REVOKE ALL ON FUNCTION public.push_worker_finish(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.push_worker_finish(uuid,uuid,jsonb),public.push_acquisisci_comunicazioni(timestamptz) TO service_role;
-- Normalizza anche ACL predefinite su nuovi oggetti, senza modificare altri schemi.
DO $$
DECLARE obj record;grantee record;role_name text;role_oid oid;owner_oid oid;
BEGIN
 FOR obj IN SELECT c.oid,c.relname,c.relowner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN('push_delivery_jobs','push_rate_budget','push_registration_ops') LOOP
  FOR grantee IN SELECT DISTINCT r.rolname FROM aclexplode((SELECT relacl FROM pg_class WHERE oid=obj.oid)) a
   JOIN pg_roles r ON r.oid=a.grantee WHERE a.grantee<>obj.relowner LOOP
   EXECUTE format('REVOKE ALL ON public.%I FROM %I',obj.relname,grantee.rolname);
  END LOOP;
 END LOOP;
 FOR obj IN SELECT p.oid,p.proowner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN('push_gestisci_dispositivo','push_gestisci_dispositivo_v1','push_comunicazione_valida','push_worker_claim','push_worker_authorize','push_worker_finish','push_acquisisci_comunicazioni') LOOP
  FOR grantee IN SELECT DISTINCT r.rolname FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid=obj.oid)) a
   JOIN pg_roles r ON r.oid=a.grantee WHERE a.grantee<>obj.proowner LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',obj.oid::regprocedure,grantee.rolname);
  END LOOP;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   SELECT oid INTO STRICT role_oid FROM pg_roles WHERE rolname=role_name;
   IF EXISTS(WITH RECURSIVE roles(oid) AS (SELECT role_oid UNION SELECT m.roleid FROM pg_auth_members m JOIN roles r ON m.member=r.oid)
    SELECT 1 FROM roles x JOIN pg_roles r ON r.oid=x.oid WHERE x.oid=obj.proowner OR r.rolsuper OR r.rolcreaterole)
   THEN RAISE EXCEPTION 'ownership_runtime_non_valida';END IF;
  END LOOP;
 END LOOP;
END;$$;
GRANT SELECT ON public.push_delivery_jobs TO service_role;
GRANT EXECUTE ON FUNCTION public.push_gestisci_dispositivo(uuid,uuid,jsonb),public.push_worker_claim(),public.push_worker_authorize(uuid,uuid),public.push_worker_finish(uuid,uuid,jsonb),public.push_acquisisci_comunicazioni(timestamptz) TO service_role;
DO $$
DECLARE r text;n text;
BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  FOREACH n IN ARRAY ARRAY['push_delivery_jobs','push_rate_budget','push_registration_ops'] LOOP
   IF has_table_privilege(r,'public.'||n,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'privilegi_client_non_validi';END IF;
  END LOOP;
 END LOOP;
 IF has_table_privilege('service_role','public.push_configurazione','INSERT,UPDATE,DELETE,TRUNCATE')
  OR has_table_privilege('service_role','public.push_dispositivi_test','INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'configurazione_runtime_modificabile';END IF;
END;$$;
COMMIT;
