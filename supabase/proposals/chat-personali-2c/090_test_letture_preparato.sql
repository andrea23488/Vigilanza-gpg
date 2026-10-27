-- TEST PREPARATO, NON ESEGUITO. Solo fixture sintetica A/B/C del blocco 2A.
-- Richiede base 202610180001 e copia revisionata della bozza 020; mai il database reale.
BEGIN;
DO $$ BEGIN RAISE EXCEPTION 'TEST_2C_NON_ESEGUIBILE: autorizzazione separata richiesta'; END $$;
CREATE FUNCTION pg_temp.assert_2c(ok boolean, motivo text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL 2C: %',motivo; END IF; END $$;
DO $$
DECLARE
 a uuid := '00000000-0000-0000-0000-000000000001';
 b uuid := '00000000-0000-0000-0000-000000000002';
 outsider uuid := '00000000-0000-0000-0000-000000000003';
 c uuid; page jsonb; state_b jsonb; original_messages jsonb; op uuid := gen_random_uuid(); reply jsonb;
BEGIN
 SELECT id INTO STRICT c FROM public.chat_conversazioni WHERE utente_a=a AND utente_b=b;
 SELECT jsonb_agg(to_jsonb(m) ORDER BY id) INTO original_messages FROM public.messaggi m;
 SELECT to_jsonb(s) INTO state_b FROM public.chat_stati_personali s WHERE conversazione_id=c AND user_id=b;
 PERFORM set_config('request.jwt.claim.sub',a::text,true); SET LOCAL ROLE authenticated;
 PERFORM pg_temp.assert_2c(public.chat_personale_non_letti_v1()->>'totale'='1','non letti personali iniziali');
 PERFORM pg_temp.assert_2c(jsonb_array_length(public.chat_personale_elenco_v1()->'conversazioni')=1,'A vede soltanto AB');
 page := public.chat_personale_messaggi_v1(c,NULL,1,'1');
 PERFORM pg_temp.assert_2c(page->'messaggi'->0->>'id'='2' AND page->>'has_more'='true','prima pagina con ID testuale');
 PERFORM pg_temp.assert_2c(page->>'next_cursor'='2','cursore posizione testuale');
 page := public.chat_personale_messaggi_v1(c,'2',1,'1');
 PERFORM pg_temp.assert_2c(page->'messaggi'->0->>'id'='1' AND page->>'has_more'='false','seconda pagina senza duplicati');
 PERFORM public.chat_personale_operazione(c,gen_random_uuid(),'archivia',1);
 PERFORM pg_temp.assert_2c(jsonb_array_length(public.chat_personale_elenco_v1()->'conversazioni')=0,'archiviata fuori dalla lista attiva');
 PERFORM pg_temp.assert_2c(jsonb_array_length(public.chat_personale_elenco_v1(true)->'conversazioni')=1,'archiviata recuperabile');
 PERFORM pg_temp.assert_2c(public.chat_personale_non_letti_v1()->>'archiviate'='1','non letti archivio inclusi nel totale');
 BEGIN PERFORM public.chat_personale_messaggi_v1(c,'2',1,'1'); RAISE EXCEPTION 'Versione obsoleta accettata';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 reply := public.chat_personale_operazione(c,op,'svuota',2);
 PERFORM pg_temp.assert_2c(public.chat_personale_non_letti_v1()->>'totale'='0','svuota aggiorna conteggio visibile');
 PERFORM pg_temp.assert_2c(jsonb_array_length(public.chat_personale_messaggi_v1(c)->'messaggi')=0,'nessuno storico nascosto restituito');
 PERFORM pg_temp.assert_2c(jsonb_array_length(public.chat_personale_elenco_v1(true,50,NULL,NULL,'due')->'conversazioni')=0,'ricerca non recupera storico');
 RESET ROLE;
 PERFORM pg_temp.assert_2c(state_b=(SELECT to_jsonb(s) FROM public.chat_stati_personali s WHERE conversazione_id=c AND user_id=b),'stato B immutato dalle azioni A');
 PERFORM pg_temp.assert_2c(original_messages=(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM public.messaggi m),'messaggi e ricevute invariati');
 PERFORM set_config('request.jwt.claim.sub',b::text,true); SET LOCAL ROLE authenticated;
 PERFORM pg_temp.assert_2c(jsonb_array_length(public.chat_personale_messaggi_v1(c)->'messaggi')=2,'B mantiene entrambi i messaggi');
 INSERT INTO public.messaggi(mittente_id,destinatario_id,testo) VALUES(b,a,'nuovo sintetico 2C');
 RESET ROLE;
 SELECT to_jsonb(s) INTO state_b FROM public.chat_stati_personali s WHERE conversazione_id=c AND user_id=b;
 PERFORM set_config('request.jwt.claim.sub',a::text,true); SET LOCAL ROLE authenticated;
 PERFORM pg_temp.assert_2c(public.chat_personale_operazione(c,op,'svuota',2)=reply,'retry mantiene risultato originario');
 PERFORM pg_temp.assert_2c(jsonb_array_length(public.chat_personale_messaggi_v1(c)->'messaggi')=1,'retry non nasconde il nuovo messaggio');
 PERFORM pg_temp.assert_2c(public.chat_personale_non_letti_v1()->>'archiviate'='1','nuovo messaggio resta archiviato e non letto');
 PERFORM public.chat_personale_operazione(c,gen_random_uuid(),'elimina',4);
 PERFORM pg_temp.assert_2c(public.chat_personale_non_letti_v1()->>'totale'='0','eliminata fuori da conteggi');
 PERFORM pg_temp.assert_2c(jsonb_array_length(public.chat_personale_elenco_v1(true)->'conversazioni')=0,'eliminata fuori anche da Archiviate');
 RESET ROLE;
 PERFORM pg_temp.assert_2c(state_b=(SELECT to_jsonb(s) FROM public.chat_stati_personali s WHERE conversazione_id=c AND user_id=b),'elimina non modifica B');
 PERFORM set_config('request.jwt.claim.sub',b::text,true); SET LOCAL ROLE authenticated;
 INSERT INTO public.messaggi(mittente_id,destinatario_id,testo) VALUES(b,a,'riaperta sintetica 2C');
 RESET ROLE; PERFORM set_config('request.jwt.claim.sub',a::text,true); SET LOCAL ROLE authenticated;
 PERFORM pg_temp.assert_2c(jsonb_array_length(public.chat_personale_elenco_v1()->'conversazioni')=1,'una sola chat riaperta');
 PERFORM pg_temp.assert_2c(jsonb_array_length(public.chat_personale_messaggi_v1(c)->'messaggi')=1,'riapertura non ripristina storico');
 PERFORM public.chat_personale_operazione(c,gen_random_uuid(),'leggi',6,4);
 PERFORM pg_temp.assert_2c(public.chat_personale_non_letti_v1()->>'totale'='0','lettura personale aggiorna i non letti');
 -- Validazione parametri e accesso estraneo.
 BEGIN PERFORM public.chat_personale_messaggi_v1(c,'9223372036854775808'); RAISE EXCEPTION 'Overflow accettato';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN PERFORM public.chat_personale_elenco_v1(false,0); RAISE EXCEPTION 'Limite accettato';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 RESET ROLE; PERFORM set_config('request.jwt.claim.sub',outsider::text,true); SET LOCAL ROLE authenticated;
 BEGIN PERFORM public.chat_personale_messaggi_v1(c); RAISE EXCEPTION 'Accesso estraneo accettato';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE; PERFORM set_config('request.jwt.claim.sub','',true); SET LOCAL ROLE authenticated;
 BEGIN PERFORM public.chat_personale_non_letti_v1(); RAISE EXCEPTION 'Senza JWT accettato';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE; SET LOCAL ROLE anon;
 BEGIN PERFORM public.chat_personale_non_letti_v1(); RAISE EXCEPTION 'Anon accettato';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE;
 PERFORM pg_temp.assert_2c(NOT EXISTS(SELECT 1 FROM public.fixture_snapshot f LEFT JOIN public.messaggi m USING(id)
  WHERE m.id IS NULL OR to_jsonb(m)<>to_jsonb(f)),'integrita finale messaggi originali');
END $$;
ROLLBACK;
