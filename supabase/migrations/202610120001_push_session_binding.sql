-- CANDIDATA NON APPLICATA. Richiede la fondazione precedente e collaudo Auth reale.
-- Nessun trigger, worker, invio o attivazione implicita.
BEGIN;
ALTER TABLE public.push_dispositivi ADD COLUMN auth_session_id uuid;
CREATE INDEX push_dispositivi_sessione_idx ON public.push_dispositivi(auth_session_id);
ALTER TABLE public.push_preferenze ADD COLUMN consegne_enabled boolean NOT NULL DEFAULT false;
-- La durata non viene inventata: NULL blocca la registrazione fino ad approvazione.
ALTER TABLE public.push_configurazione ADD COLUMN binding_ttl_seconds integer
  CHECK(binding_ttl_seconds IS NULL OR binding_ttl_seconds > 0);
ALTER TABLE public.push_configurazione ADD COLUMN consegne_ttl_seconds integer CHECK(consegne_ttl_seconds IS NULL OR consegne_ttl_seconds>0);
CREATE FUNCTION public.push_sessione_valida(p_user uuid,p_session uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT p_user IS NOT NULL AND p_session IS NOT NULL AND EXISTS(
  SELECT 1 FROM auth.sessions s WHERE s.id=p_session AND s.user_id=p_user
  AND (s.not_after IS NULL OR s.not_after>clock_timestamp())
 );
$$;
REVOKE ALL ON FUNCTION public.push_sessione_valida(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.push_sessione_valida(uuid,uuid) TO service_role;
CREATE FUNCTION public.push_gestisci_dispositivo(p_user uuid,p_session uuid,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.push_dispositivi; i uuid; token text; hash text; ttl integer; azione text; now_at timestamptz:=clock_timestamp();
BEGIN
 IF NOT public.push_sessione_valida(p_user,p_session) THEN RAISE EXCEPTION 'sessione_non_valida';END IF;
 IF jsonb_typeof(p_input) IS DISTINCT FROM 'object' OR jsonb_typeof(p_input->'credenziale') IS DISTINCT FROM 'string'
 OR (p_input->>'credenziale') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'input_non_valido';END IF;
 IF p_input->>'credenziale' IS NULL THEN RAISE EXCEPTION 'input_non_valido';END IF;
 hash:=encode(sha256(convert_to(p_input->>'credenziale','UTF8')),'hex');azione:=p_input->>'azione';
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
  SELECT binding_ttl_seconds INTO ttl FROM public.push_configurazione WHERE id=1;
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
   VALUES(p_user,i,token,'3f83a3a9-df1a-4dcc-beaf-8c390f52eca2',p_input->>'piattaforma','production',hash,
    true,now_at,now_at+make_interval(secs=>ttl),p_session) RETURNING * INTO d;
  ELSE
   UPDATE public.push_dispositivi SET user_id=p_user,expo_token=token,auth_session_id=p_session,
    binding_version=binding_version+1,attivo=true,disattivato_at=NULL,motivo_disattivazione=NULL,
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
REVOKE ALL ON FUNCTION public.push_gestisci_dispositivo(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.push_gestisci_dispositivo(uuid,uuid,jsonb) TO service_role;
-- Coda separata: niente modifica al tipo eventi del motore storico.
CREATE TABLE public.push_comunicazioni (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tipo text NOT NULL CHECK(tipo IN('messaggio_privato','consegna_servizio')),
 sorgente_id text NOT NULL CHECK(sorgente_id ~ '^[0-9]+$' OR sorgente_id ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'),
 mittente_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 destinatario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,
 UNIQUE(tipo,sorgente_id),CHECK(mittente_id<>destinatario_id),
 CHECK(isfinite(created_at) AND isfinite(expires_at) AND expires_at>created_at)
);
ALTER TABLE public.push_comunicazioni ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_comunicazioni FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,DELETE ON public.push_comunicazioni TO service_role;
CREATE FUNCTION public.push_risolvi_comunicazione(p_evento uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.push_comunicazioni; u uuid:=auth.uid();sid uuid:=(auth.jwt()->>'session_id')::uuid; valida boolean;
BEGIN
 IF NOT public.push_sessione_valida(u,sid) THEN RETURN NULL;END IF;
 SELECT * INTO e FROM public.push_comunicazioni WHERE id=p_evento AND destinatario_id=u AND expires_at>clock_timestamp();
 IF e.id IS NULL THEN RETURN NULL;END IF;
 IF EXISTS(SELECT 1 FROM public.utenti_bloccati WHERE
  (bloccante_id=e.mittente_id AND bloccato_id=u) OR (bloccante_id=u AND bloccato_id=e.mittente_id))
 OR NOT EXISTS(SELECT 1 FROM public.colleghi WHERE stato='accettato' AND
  ((user_id=e.mittente_id AND collega_id=u) OR (user_id=u AND collega_id=e.mittente_id))) THEN RETURN NULL;END IF;
 IF e.tipo='messaggio_privato' THEN
  SELECT EXISTS(SELECT 1 FROM public.messaggi WHERE id::text=e.sorgente_id AND mittente_id=e.mittente_id AND destinatario_id=u) INTO valida;
 ELSE
  SELECT EXISTS(SELECT 1 FROM public.consegne_servizio WHERE id::text=e.sorgente_id AND mittente_id=e.mittente_id AND destinatario_id=u) INTO valida;
 END IF;
 IF NOT valida THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('tipo',e.tipo,'sorgente_id',e.sorgente_id,'mittente_id',e.mittente_id);
END;$$;
REVOKE ALL ON FUNCTION public.push_risolvi_comunicazione(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.push_risolvi_comunicazione(uuid) TO authenticated;
-- Acquisizione server esplicita: nessun trigger/job viene avviato.
CREATE FUNCTION public.push_acquisisci_comunicazioni(p_cutoff timestamptz)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;cfg public.push_configurazione;
BEGIN
 SELECT * INTO cfg FROM public.push_configurazione WHERE id=1;
 IF cfg.send_enabled IS DISTINCT FROM true OR cfg.modalita='disabled' THEN RETURN 0;END IF;
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
 ON CONFLICT(tipo,sorgente_id) DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;RETURN n;
END;$$;
REVOKE ALL ON FUNCTION public.push_acquisisci_comunicazioni(timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.push_acquisisci_comunicazioni(timestamptz) TO service_role;
-- Fail-closed sui privilegi client effettivi (incluse concessioni ereditate).
DO $$
DECLARE r text;
BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF has_table_privilege(r,'public.push_comunicazioni','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
   OR has_function_privilege(r,'public.push_gestisci_dispositivo(uuid,uuid,jsonb)','EXECUTE')
   OR has_function_privilege(r,'public.push_sessione_valida(uuid,uuid)','EXECUTE')
   OR has_function_privilege(r,'public.push_acquisisci_comunicazioni(timestamptz)','EXECUTE')
  THEN RAISE EXCEPTION 'privilegi_client_non_validi';END IF;
 END LOOP;
END;$$;
COMMIT;
