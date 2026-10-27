-- BOZZA 2C NON APPLICATA. Fuori da supabase/migrations intenzionalmente.
-- Prerequisito: catalogo TEST revisionato e proposta 202610180001 verificata.
-- Il blocco incondizionato richiede revisione esplicita di una copia prima di qualsiasi prova SQL.
BEGIN;
DO $$ BEGIN RAISE EXCEPTION 'BOZZA_2C_NON_ESEGUIBILE: revisione e autorizzazione richieste'; END $$;

-- Non aggiungere questo schema alla lista degli schemi esposti dalla Data API.
-- Nessun IF NOT EXISTS/OR REPLACE: collisioni con oggetti esistenti devono fermare la prova.
CREATE SCHEMA chat_personale_read_private;
REVOKE ALL ON SCHEMA chat_personale_read_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA chat_personale_read_private TO authenticated;
CREATE VIEW chat_personale_read_private.visibili
WITH (security_invoker=true, security_barrier=true) AS
SELECT s.user_id, c.id AS conversazione_id, p.posizione,
 m.id AS messaggio_id, m.mittente_id, m.destinatario_id, m.testo, m.created_at,
 (m.destinatario_id=s.user_id AND p.posizione>s.letti_fino_a AND m.letto_at IS NULL) AS non_letto
FROM public.chat_stati_personali s
JOIN public.chat_conversazioni c ON c.id=s.conversazione_id
JOIN public.chat_posizioni_messaggi p ON p.conversazione_id=c.id
JOIN public.messaggi m ON m.id=p.messaggio_id
WHERE s.user_id=(SELECT auth.uid()) AND s.user_id IN(c.utente_a,c.utente_b)
 AND s.stato<>'deleted' AND p.posizione>s.nascosti_fino_a;
REVOKE ALL ON chat_personale_read_private.visibili FROM PUBLIC, anon, authenticated;
GRANT SELECT ON chat_personale_read_private.visibili TO authenticated;

-- Invoker + RLS sottostanti: nessuna nuova facoltà di leggere messaggi.
-- Tutti i bigint esposti sono stringhe JSON, compresi i conteggi.
CREATE FUNCTION public.chat_personale_non_letti_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE v_uid uuid := auth.uid(); v_result jsonb;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Autenticazione richiesta' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object(
  'totale',count(*)::text,
  'attive',(count(*) FILTER(WHERE s.stato='active'))::text,
  'archiviate',(count(*) FILTER(WHERE s.stato='archived'))::text)
 INTO v_result
 FROM chat_personale_read_private.visibili v
 JOIN public.chat_stati_personali s ON s.conversazione_id=v.conversazione_id AND s.user_id=v_uid
 WHERE v.user_id=v_uid AND v.non_letto;
 RETURN v_result;
END $$;

CREATE FUNCTION public.chat_personale_messaggi_v1(
 p_conversazione_id uuid, p_prima_posizione text DEFAULT NULL,
 p_limite integer DEFAULT 50, p_versione_attesa text DEFAULT NULL,
 p_ricerca text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE v_uid uuid := auth.uid(); v_prima bigint; v_attesa bigint; v_state record; v_result jsonb;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Autenticazione richiesta' USING ERRCODE='42501'; END IF;
 IF p_conversazione_id IS NULL OR p_limite IS NULL OR p_limite NOT BETWEEN 1 AND 100
    OR char_length(p_ricerca)>2000 THEN
  RAISE EXCEPTION 'Parametri non validi' USING ERRCODE='22023';
 END IF;
 BEGIN
  IF p_prima_posizione IS NOT NULL THEN
   IF p_prima_posizione !~ '^[1-9][0-9]{0,18}$' THEN RAISE EXCEPTION 'Cursore non valido' USING ERRCODE='22023'; END IF;
   v_prima := p_prima_posizione::bigint;
  END IF;
  IF p_versione_attesa IS NOT NULL THEN
   IF p_versione_attesa !~ '^[1-9][0-9]{0,18}$' THEN RAISE EXCEPTION 'Versione non valida' USING ERRCODE='22023'; END IF;
   v_attesa := p_versione_attesa::bigint;
  END IF;
 EXCEPTION WHEN numeric_value_out_of_range THEN
  RAISE EXCEPTION 'Bigint fuori intervallo' USING ERRCODE='22023';
 END;
 SELECT s.*, c.ultima_posizione INTO v_state FROM public.chat_stati_personali s
 JOIN public.chat_conversazioni c ON c.id=s.conversazione_id
 WHERE s.user_id=v_uid AND c.id=p_conversazione_id AND v_uid IN(c.utente_a,c.utente_b);
 IF NOT FOUND THEN RAISE EXCEPTION 'Conversazione non disponibile' USING ERRCODE='42501'; END IF;
 IF v_attesa IS NOT NULL AND v_attesa<>v_state.versione THEN
  RAISE EXCEPTION 'Snapshot cambiato: rileggere prima pagina' USING ERRCODE='40001';
 END IF;
 WITH candidates AS (
  SELECT * FROM chat_personale_read_private.visibili v
  WHERE v.user_id=v_uid AND v.conversazione_id=p_conversazione_id
   AND (v_prima IS NULL OR v.posizione<v_prima)
   AND (nullif(btrim(p_ricerca),'') IS NULL OR strpos(lower(v.testo),lower(btrim(p_ricerca)))>0)
  ORDER BY v.posizione DESC LIMIT p_limite+1
 ), page AS (SELECT * FROM candidates ORDER BY posizione DESC LIMIT p_limite)
 SELECT jsonb_build_object(
  'conversazione_id',p_conversazione_id,'stato',v_state.stato,
  'versione',v_state.versione::text,'nascosti_fino_a',v_state.nascosti_fino_a::text,
  'letti_fino_a',v_state.letti_fino_a::text,'ultima_posizione',v_state.ultima_posizione::text,
  'messaggi',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id',messaggio_id::text,'posizione',posizione::text,'mittente_id',mittente_id,
    'destinatario_id',destinatario_id,'testo',testo,'created_at',created_at,'non_letto',non_letto
   ) ORDER BY posizione DESC) FROM page),'[]'::jsonb),
  'has_more',(SELECT count(*)>p_limite FROM candidates),
  'next_cursor',(SELECT min(posizione)::text FROM page)) INTO v_result;
 RETURN v_result;
END $$;

CREATE FUNCTION public.chat_personale_elenco_v1(
 p_archiviate boolean DEFAULT false, p_limite integer DEFAULT 50,
 p_prima_data timestamptz DEFAULT NULL, p_prima_id uuid DEFAULT NULL,
 p_ricerca text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE v_uid uuid := auth.uid(); v_result jsonb;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Autenticazione richiesta' USING ERRCODE='42501'; END IF;
 IF p_archiviate IS NULL OR p_limite IS NULL OR p_limite NOT BETWEEN 1 AND 100
   OR (p_prima_data IS NULL)<>(p_prima_id IS NULL) OR char_length(p_ricerca)>2000 THEN
  RAISE EXCEPTION 'Parametri non validi' USING ERRCODE='22023';
 END IF;
 WITH base AS (
  SELECT c.id, s.stato, s.versione, s.nascosti_fino_a, s.letti_fino_a,
   CASE WHEN c.utente_a=v_uid THEN c.utente_b ELSE c.utente_a END AS controparte_id,
   coalesce(ultimo.created_at,c.created_at) AS ordinamento,
   ultimo.testo AS anteprima, ultimo.messaggio_id,
   (SELECT count(*) FROM chat_personale_read_private.visibili nv
    WHERE nv.user_id=v_uid AND nv.conversazione_id=c.id AND nv.non_letto) AS non_letti
  FROM public.chat_conversazioni c
  JOIN public.chat_stati_personali s ON s.conversazione_id=c.id AND s.user_id=v_uid
  LEFT JOIN LATERAL (
   SELECT v.created_at,v.testo,v.messaggio_id FROM chat_personale_read_private.visibili v
   WHERE v.user_id=v_uid AND v.conversazione_id=c.id ORDER BY v.posizione DESC LIMIT 1
  ) ultimo ON true
  WHERE v_uid IN(c.utente_a,c.utente_b)
   AND s.stato=CASE WHEN p_archiviate THEN 'archived' ELSE 'active' END
   AND (nullif(btrim(p_ricerca),'') IS NULL OR EXISTS(
    SELECT 1 FROM chat_personale_read_private.visibili sv WHERE sv.user_id=v_uid
     AND sv.conversazione_id=c.id AND strpos(lower(sv.testo),lower(btrim(p_ricerca)))>0))
 ), candidates AS (
  SELECT * FROM base WHERE p_prima_data IS NULL OR (ordinamento,id)<(p_prima_data,p_prima_id)
  ORDER BY ordinamento DESC,id DESC LIMIT p_limite+1
 ), page AS (SELECT * FROM candidates ORDER BY ordinamento DESC,id DESC LIMIT p_limite)
 SELECT jsonb_build_object(
  'conversazioni',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id',id,'controparte_id',controparte_id,'stato',stato,'versione',versione::text,
    'nascosti_fino_a',nascosti_fino_a::text,'letti_fino_a',letti_fino_a::text,
    'anteprima',anteprima,'messaggio_id',messaggio_id::text,'non_letti',non_letti::text,
    'ordinamento',ordinamento) ORDER BY ordinamento DESC,id DESC) FROM page),'[]'::jsonb),
  'has_more',(SELECT count(*)>p_limite FROM candidates),
  'next_cursor',(SELECT jsonb_build_object('data',ordinamento,'id',id)
    FROM page ORDER BY ordinamento ASC,id ASC LIMIT 1),
  'non_letti',public.chat_personale_non_letti_v1()) INTO v_result;
 RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION public.chat_personale_non_letti_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.chat_personale_messaggi_v1(uuid,text,integer,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.chat_personale_elenco_v1(boolean,integer,timestamptz,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_personale_non_letti_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_personale_messaggi_v1(uuid,text,integer,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_personale_elenco_v1(boolean,integer,timestamptz,uuid,text) TO authenticated;
COMMIT;
