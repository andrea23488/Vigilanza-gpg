\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.verifica(ok boolean, descrizione text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', descrizione; END IF;
END $$;
CREATE FUNCTION pg_temp.errore(sql text, codice text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
  BEGIN
    EXECUTE sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = codice THEN RETURN; END IF;
    RAISE EXCEPTION 'Codice inatteso %: % (atteso %)', SQLSTATE, SQLERRM, codice;
  END;
  RAISE EXCEPTION 'Operazione consentita inaspettatamente: %', sql;
END $$;

SELECT pg_temp.verifica(NOT EXISTS (
  (TABLE public.messaggi EXCEPT TABLE public.fixture_snapshot)
  UNION ALL (TABLE public.fixture_snapshot EXCEPT TABLE public.messaggi)
), 'backfill lascia intatti tutti i messaggi');
SELECT pg_temp.verifica((SELECT count(*) = 2 FROM public.chat_conversazioni), 'coppie univoche');
SELECT pg_temp.verifica((SELECT count(*) = 4 FROM public.chat_stati_personali), 'due stati per coppia');
SELECT pg_temp.verifica((SELECT posizione = 2 FROM public.chat_posizioni_messaggi WHERE messaggio_id=2), 'ordine deterministico con timestamp uguali');

DO $$
DECLARE
  a uuid := '00000000-0000-0000-0000-000000000001';
  b uuid := '00000000-0000-0000-0000-000000000002';
  c uuid;
  op uuid := gen_random_uuid();
  r jsonb;
  v bigint;
BEGIN
  SELECT id INTO c FROM public.chat_conversazioni WHERE utente_a=a AND utente_b=b;
  PERFORM set_config('request.jwt.claim.sub', a::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.verifica((SELECT count(*)=1 FROM public.chat_conversazioni), 'isolamento conversazioni');
  PERFORM pg_temp.verifica((SELECT count(*)=1 FROM public.chat_stati_personali), 'stato del solo chiamante');
  PERFORM pg_temp.verifica((SELECT count(*)=2 FROM public.chat_posizioni_messaggi), 'metadati dei soli partecipanti');
  PERFORM pg_temp.errore('UPDATE public.chat_stati_personali SET stato=''deleted''', '42501');
  PERFORM pg_temp.errore('INSERT INTO public.chat_conversazioni(utente_a,utente_b) VALUES (gen_random_uuid(),gen_random_uuid())', '42501');
  PERFORM pg_temp.errore('DELETE FROM public.chat_posizioni_messaggi', '42501');
  PERFORM pg_temp.errore('SELECT * FROM public.chat_operazioni_personali', '42501');
  PERFORM pg_temp.errore('SELECT public.chat_indicizza_nuovo_messaggio()', '42501');

  r := public.chat_personale_operazione(c,op,'svuota',1);
  PERFORM pg_temp.verifica(r->>'nascosti_fino_a'='2' AND r->>'stato'='active', 'svuota mantiene attiva');
  PERFORM pg_temp.verifica(r->>'letti_fino_a'='0', 'svuota non simula lettura');
  PERFORM pg_temp.verifica((SELECT count(*)=0 FROM public.chat_posizioni_messaggi), 'RLS nasconde metadati precedenti');
  PERFORM pg_temp.verifica(public.chat_personale_operazione(c,op,'svuota',1)=r, 'retry stessa risposta');
  PERFORM pg_temp.errore(format('SELECT public.chat_personale_operazione(%L,%L,''elimina'',1)',c,op), '22023');
  PERFORM pg_temp.errore(format('SELECT public.chat_personale_operazione(%L,gen_random_uuid(),''archivia'',1)',c), '40001');
  PERFORM pg_temp.errore(format('SELECT public.chat_personale_operazione(%L,gen_random_uuid(),''leggi'',2,3)',c), '22023');
  PERFORM pg_temp.errore(format('SELECT public.chat_personale_operazione(%L,gen_random_uuid(),NULL,2)',c), '22023');
  PERFORM pg_temp.errore(format('SELECT public.chat_personale_operazione(%L,gen_random_uuid(),''svuota'',2,0)',c), '22023');

  PERFORM public.chat_personale_operazione(c,gen_random_uuid(),'archivia',2);
  INSERT INTO public.messaggi(mittente_id,destinatario_id,testo) VALUES(a,b,'nuovo archiviato');
  SELECT versione INTO v FROM public.chat_stati_personali WHERE conversazione_id=c;
  PERFORM pg_temp.verifica((SELECT stato='archived' FROM public.chat_stati_personali WHERE conversazione_id=c), 'nuovo messaggio conserva archivio');
  PERFORM pg_temp.verifica((SELECT count(*)=1 FROM public.chat_posizioni_messaggi), 'solo nuovo messaggio visibile');
  PERFORM pg_temp.verifica(public.chat_personale_operazione(c,op,'svuota',1)=r, 'retry dopo messaggio non sposta cursore');
  PERFORM pg_temp.verifica((SELECT nascosti_fino_a=2 FROM public.chat_stati_personali WHERE conversazione_id=c), 'confine immutato dopo retry');
  PERFORM public.chat_personale_operazione(c,gen_random_uuid(),'ripristina',v);
  PERFORM public.chat_personale_operazione(c,gen_random_uuid(),'leggi',v+1,3);
  PERFORM public.chat_personale_operazione(c,gen_random_uuid(),'leggi',v+2,1);
  PERFORM pg_temp.verifica((SELECT letti_fino_a=3 FROM public.chat_stati_personali WHERE conversazione_id=c), 'lettura monotona');
  PERFORM public.chat_personale_operazione(c,gen_random_uuid(),'elimina',v+3);
  PERFORM pg_temp.verifica((SELECT stato='deleted' AND nascosti_fino_a=3 FROM public.chat_stati_personali WHERE conversazione_id=c), 'eliminazione personale');
  PERFORM pg_temp.errore(format('SELECT public.chat_personale_operazione(%L,gen_random_uuid(),''ripristina'',%s)',c,v+4), '22023');

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', b::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.verifica((SELECT stato='active' AND nascosti_fino_a=0 AND letti_fino_a=0 FROM public.chat_stati_personali WHERE conversazione_id=c), 'altro partecipante invariato');
  INSERT INTO public.messaggi(mittente_id,destinatario_id,testo) VALUES(b,a,'riapre eliminata');
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', a::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.verifica((SELECT stato='active' AND nascosti_fino_a=3 FROM public.chat_stati_personali WHERE conversazione_id=c), 'nuovo ricevuto riattiva senza storico');
  PERFORM pg_temp.verifica((SELECT count(*)=1 FROM public.chat_posizioni_messaggi), 'riapertura mostra solo nuovo');

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.verifica(NOT EXISTS(SELECT 1 FROM public.chat_conversazioni WHERE id=c), 'estraneo non vede coppia');
  PERFORM pg_temp.errore(format('SELECT public.chat_personale_operazione(%L,gen_random_uuid(),''elimina'',1)',c), '42501');
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub','',true);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.verifica((SELECT count(*)=0 FROM public.chat_stati_personali), 'JWT senza sub');
  PERFORM pg_temp.errore(format('SELECT public.chat_personale_operazione(%L,gen_random_uuid(),''elimina'',1)',c), '42501');
  RESET ROLE;
  SET LOCAL ROLE anon;
  PERFORM pg_temp.errore('SELECT * FROM public.chat_stati_personali', '42501');
  PERFORM pg_temp.errore(format('SELECT public.chat_personale_operazione(%L,gen_random_uuid(),''elimina'',1)',c), '42501');
  RESET ROLE;
END $$;

SELECT pg_temp.verifica(NOT EXISTS (
  SELECT 1 FROM public.fixture_snapshot f LEFT JOIN public.messaggi m USING(id)
  WHERE m.id IS NULL OR to_jsonb(m) <> to_jsonb(f)
), 'azioni non alterano messaggi originali o ricevute');
SELECT pg_temp.verifica(NOT EXISTS (
  SELECT 1 FROM public.chat_stati_personali s JOIN public.chat_conversazioni c ON c.id=s.conversazione_id
  WHERE s.nascosti_fino_a > c.ultima_posizione OR s.letti_fino_a > c.ultima_posizione
), 'cursori validi');

DO $$
DECLARE
  a uuid := '00000000-0000-0000-0000-000000000001';
  b uuid := '00000000-0000-0000-0000-000000000002';
  c uuid;
  nuovo uuid;
  op uuid := gen_random_uuid();
  v bigint;
  prima jsonb;
BEGIN
  SELECT id INTO c FROM public.chat_conversazioni WHERE utente_a=a AND utente_b=b;
  SELECT jsonb_agg(to_jsonb(s) ORDER BY user_id) INTO prima
  FROM public.chat_stati_personali s WHERE conversazione_id=c;
  -- Fallimento del trigger: nessun messaggio o metadato parziale.
  PERFORM pg_temp.errore(format('INSERT INTO public.messaggi(mittente_id,destinatario_id,testo) VALUES(%L,%L,''self'')',a,a), 'P0001');
  PERFORM pg_temp.verifica(prima=(SELECT jsonb_agg(to_jsonb(s) ORDER BY user_id)
    FROM public.chat_stati_personali s WHERE conversazione_id=c), 'trigger fallito non altera stato');

  PERFORM set_config('request.jwt.claim.sub', a::text, true);
  SET LOCAL ROLE authenticated;
  -- Prima conversazione: trigger crea coppia, posizione 1 e i due stati.
  INSERT INTO public.messaggi(mittente_id,destinatario_id,testo)
  VALUES(a,'00000000-0000-0000-0000-000000000003','prima AC');
  SELECT id INTO nuovo FROM public.chat_conversazioni
  WHERE utente_a=a AND utente_b='00000000-0000-0000-0000-000000000003';
  PERFORM pg_temp.verifica(nuovo IS NOT NULL, 'creazione coppia nuova');
  PERFORM pg_temp.verifica((SELECT ultima_posizione=1 FROM public.chat_conversazioni WHERE id=nuovo), 'prima posizione');
  SELECT versione INTO v FROM public.chat_stati_personali WHERE conversazione_id=c;
  PERFORM public.chat_personale_operazione(c,op,'archivia',v);
  PERFORM pg_temp.errore(format('SELECT public.chat_personale_operazione(%L,%L,''archivia'',1)',nuovo,op), '22023');
  PERFORM pg_temp.errore('DELETE FROM public.chat_conversazioni', '42501');
  PERFORM pg_temp.errore('INSERT INTO public.chat_stati_personali(conversazione_id,user_id) VALUES(gen_random_uuid(),auth.uid())', '42501');
  PERFORM pg_temp.errore('UPDATE public.chat_posizioni_messaggi SET posizione=999', '42501');
  RESET ROLE;
END $$;

-- Precisione oltre Number.MAX_SAFE_INTEGER: nessun arrotondamento nei risultati RPC.
DO $$
DECLARE c uuid; v bigint; r jsonb;
BEGIN
  SELECT id INTO c FROM public.chat_conversazioni
  WHERE utente_a='00000000-0000-0000-0000-000000000001'
    AND utente_b='00000000-0000-0000-0000-000000000002';
  UPDATE public.chat_conversazioni SET ultima_posizione=9007199254740992 WHERE id=c;
  INSERT INTO public.messaggi(id,mittente_id,destinatario_id,testo)
  VALUES(9007199254740993,'00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002','bigint');
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  SET LOCAL ROLE authenticated;
  SELECT versione INTO v FROM public.chat_stati_personali WHERE conversazione_id=c;
  r := public.chat_personale_operazione(c,gen_random_uuid(),'svuota',v);
  PERFORM pg_temp.verifica(r->>'nascosti_fino_a'='9007199254740993'
    AND jsonb_typeof(r->'nascosti_fino_a')='string'
    AND jsonb_typeof(r->'versione')='string', 'bigint testuali esatti');
  RESET ROLE;
END $$;
ROLLBACK;
\echo 'PASS: backfill, RLS, autorizzazione, azioni, cursori, retry, integrita messaggi'
