-- SOLO fixture sintetica del runner locale. Verifica la proposta 7bca7e0,
-- non certifica lo schema remoto e non definisce API per il client.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.verifica_2a(ok boolean, motivo text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
 IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL 2A: %', motivo; END IF;
END $$;
-- Proiezione di specifica per messaggi, ricerca e non letti.
-- Non è una nuova RPC dell'app: vale soltanto nel database sintetico.
CREATE FUNCTION pg_temp.vista_2a(c uuid, ricerca text DEFAULT NULL)
RETURNS TABLE(id bigint, testo text, non_letto boolean)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
 SELECT m.id, m.testo,
   m.destinatario_id=auth.uid() AND p.posizione>s.letti_fino_a AND m.letto_at IS NULL
 FROM public.chat_stati_personali s
 JOIN public.chat_posizioni_messaggi p ON p.conversazione_id=s.conversazione_id
 JOIN public.messaggi m ON m.id=p.messaggio_id
 WHERE s.user_id=auth.uid() AND s.conversazione_id=c AND s.stato<>'deleted'
   AND p.posizione>s.nascosti_fino_a
   AND (ricerca IS NULL OR m.testo ILIKE '%' || ricerca || '%')
$$;

DO $$
DECLARE
 a uuid := '00000000-0000-0000-0000-000000000001';
 b uuid := '00000000-0000-0000-0000-000000000002';
 c uuid;
 v bigint;
 b_prima jsonb;
 a_prima jsonb;
 snapshot jsonb;
 op uuid := gen_random_uuid();
 risultato jsonb;
BEGIN
 SELECT id INTO STRICT c FROM public.chat_conversazioni WHERE utente_a=a AND utente_b=b;
 INSERT INTO public.messaggi(mittente_id,destinatario_id,testo) VALUES(b,a,'2a storico da nascondere');
 SELECT to_jsonb(s) INTO b_prima FROM public.chat_stati_personali s WHERE conversazione_id=c AND user_id=b;
 SELECT jsonb_agg(to_jsonb(m) ORDER BY id) INTO snapshot FROM public.messaggi m;

 PERFORM set_config('request.jwt.claim.sub',a::text,true); SET LOCAL ROLE authenticated;
 SELECT versione INTO v FROM public.chat_stati_personali WHERE conversazione_id=c;
 PERFORM public.chat_personale_operazione(c,gen_random_uuid(),'archivia',v);
 PERFORM pg_temp.verifica_2a(EXISTS(SELECT 1 FROM public.chat_stati_personali WHERE conversazione_id=c AND stato='archived'), 'Archiviate contiene la conversazione');
 PERFORM pg_temp.verifica_2a(NOT EXISTS(SELECT 1 FROM public.chat_stati_personali WHERE conversazione_id=c AND stato='active'), 'archivia rimuove solo dalla lista principale');
 PERFORM pg_temp.verifica_2a(EXISTS(SELECT 1 FROM pg_temp.vista_2a(c,'2a storico') WHERE non_letto), 'archivia preserva ricerca e non letti');
 RESET ROLE;
 PERFORM pg_temp.verifica_2a(b_prima=(SELECT to_jsonb(s) FROM public.chat_stati_personali s WHERE conversazione_id=c AND user_id=b), 'archivia di A non cambia B');
 PERFORM pg_temp.verifica_2a(snapshot=(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM public.messaggi m), 'archivia non altera messaggi e ricevute');

 SET LOCAL ROLE authenticated;
 SELECT versione INTO v FROM public.chat_stati_personali WHERE conversazione_id=c;
 risultato := public.chat_personale_operazione(c,op,'svuota',v);
 PERFORM pg_temp.verifica_2a(NOT EXISTS(SELECT 1 FROM pg_temp.vista_2a(c)), 'svuota nasconde anche dai risultati di ricerca e dai non letti');
 PERFORM pg_temp.verifica_2a(EXISTS(SELECT 1 FROM public.chat_stati_personali WHERE conversazione_id=c AND stato='archived'), 'svuota conserva lo stato archivio');
 RESET ROLE;
 PERFORM pg_temp.verifica_2a(b_prima=(SELECT to_jsonb(s) FROM public.chat_stati_personali s WHERE conversazione_id=c AND user_id=b), 'svuota di A non cambia B');
 PERFORM pg_temp.verifica_2a(snapshot=(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM public.messaggi m), 'svuota non cancella alcun messaggio');
 PERFORM set_config('request.jwt.claim.sub',b::text,true); SET LOCAL ROLE authenticated;
 PERFORM pg_temp.verifica_2a(EXISTS(SELECT 1 FROM pg_temp.vista_2a(c,'2a storico')), 'B mantiene visibile lo storico nascosto da A');
 INSERT INTO public.messaggi(mittente_id,destinatario_id,testo) VALUES(b,a,'2a nuovo in archivio');
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',a::text,true); SET LOCAL ROLE authenticated;
 PERFORM pg_temp.verifica_2a(EXISTS(SELECT 1 FROM public.chat_stati_personali WHERE conversazione_id=c AND stato='archived'), 'nuovo messaggio non estrae automaticamente dall archivio');
 PERFORM pg_temp.verifica_2a((SELECT count(*)=1 FROM pg_temp.vista_2a(c) WHERE non_letto), 'nuovo non letto in archivio contato una volta');
 PERFORM pg_temp.verifica_2a(NOT EXISTS(SELECT 1 FROM pg_temp.vista_2a(c,'2a storico')), 'ricerca non riporta storico nascosto');
 PERFORM pg_temp.verifica_2a(public.chat_personale_operazione(c,op,'svuota',v)=risultato, 'retry restituisce lo snapshot originale');
 PERFORM pg_temp.verifica_2a(EXISTS(SELECT 1 FROM pg_temp.vista_2a(c,'2a nuovo')), 'retry tardivo non nasconde nuovi messaggi');
 BEGIN
  PERFORM public.chat_personale_operazione(c,gen_random_uuid(),'elimina',v);
  RAISE EXCEPTION 'Versione obsoleta accettata';
 EXCEPTION WHEN serialization_failure THEN NULL;
 END;
 SELECT versione INTO v FROM public.chat_stati_personali WHERE conversazione_id=c;
 RESET ROLE;
 SELECT to_jsonb(s) INTO b_prima FROM public.chat_stati_personali s WHERE conversazione_id=c AND user_id=b;
 SELECT jsonb_agg(to_jsonb(m) ORDER BY id) INTO snapshot FROM public.messaggi m;
 SET LOCAL ROLE authenticated;
 PERFORM public.chat_personale_operazione(c,gen_random_uuid(),'elimina',v);
 PERFORM pg_temp.verifica_2a(EXISTS(SELECT 1 FROM public.chat_stati_personali WHERE conversazione_id=c AND stato='deleted'), 'elimina rimuove la conversazione dalle liste personali');
 PERFORM pg_temp.verifica_2a(NOT EXISTS(SELECT 1 FROM pg_temp.vista_2a(c)), 'elimina esclude messaggi ricerca e non letti per A');
 RESET ROLE;
 PERFORM pg_temp.verifica_2a(b_prima=(SELECT to_jsonb(s) FROM public.chat_stati_personali s WHERE conversazione_id=c AND user_id=b), 'elimina di A non cambia B');
 PERFORM pg_temp.verifica_2a(snapshot=(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM public.messaggi m), 'elimina non cancella messaggi o ricevute condivise');
 PERFORM set_config('request.jwt.claim.sub',b::text,true); SET LOCAL ROLE authenticated;
 PERFORM pg_temp.verifica_2a(EXISTS(SELECT 1 FROM pg_temp.vista_2a(c,'2a nuovo')), 'B conserva i messaggi dopo eliminazione personale di A');
 INSERT INTO public.messaggi(mittente_id,destinatario_id,testo) VALUES(b,a,'2a riaperta');
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',a::text,true); SET LOCAL ROLE authenticated;
 PERFORM pg_temp.verifica_2a(EXISTS(SELECT 1 FROM public.chat_stati_personali WHERE conversazione_id=c AND stato='active'), 'messaggio nuovo riapre chat eliminata');
 PERFORM pg_temp.verifica_2a((SELECT count(*)=1 FROM pg_temp.vista_2a(c)), 'riapertura mostra solo il nuovo messaggio');
 PERFORM pg_temp.verifica_2a((SELECT count(*)=1 FROM pg_temp.vista_2a(c) WHERE non_letto), 'riapertura ha un solo non letto');
 -- Evidenza del blocco di integrazione: la lettura legacy ignora i confini personali.
 PERFORM pg_temp.verifica_2a(EXISTS(SELECT 1 FROM public.messaggi WHERE testo='2a storico da nascondere'), 'lettura legacy ancora bypassa il filtro personale: non usare per il nuovo client');
END $$;
ROLLBACK;
SELECT 'PASS: 2A isolamento A/B, archivio, ricerca, non letti, nuovi messaggi e retry';
