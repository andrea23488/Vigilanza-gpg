-- Integration tests; disposable local Supabase DB only. Never production.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.assert(ok boolean, label text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
END $$;
CREATE FUNCTION pg_temp.expect_error(command text, expected_state text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
  BEGIN EXECUTE command;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected_state THEN RETURN; END IF;
    RAISE EXCEPTION 'Unexpected SQLSTATE % (expected %)', SQLSTATE, expected_state;
  END;
  RAISE EXCEPTION 'Unexpectedly allowed: %', command;
END $$;

DO $$
DECLARE
  a uuid := '00000000-0000-4000-8000-0000000000a1';
  b uuid := '00000000-0000-4000-8000-0000000000b2';
  intruder uuid := '00000000-0000-4000-8000-0000000000c3';
  game_scopa uuid := '10000000-0000-4000-8000-000000000001';
  game_briscola uuid := '10000000-0000-4000-8000-000000000002';
  game_finished uuid := '10000000-0000-4000-8000-000000000003';
  view_state jsonb;
  expires_at timestamptz;
  event_a uuid;
  event_b uuid;
  result jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', a::text, true);
  SET LOCAL ROLE authenticated;
  view_state := public.leggi_partita_gioco_v2(game_scopa);
  PERFORM pg_temp.assert(view_state #>> '{partita,stato_partita,mano,0,id}' = 'synthetic-a-card', 'player A receives own Scopa hand');
  PERFORM pg_temp.assert(position('synthetic-b-card' in view_state::text) = 0, 'player A cannot see player B hand');
  PERFORM pg_temp.assert(position('synthetic-hidden-deck' in view_state::text) = 0, 'player A cannot see deck order');
  PERFORM pg_temp.expect_error('SELECT * FROM public.partite_gioco_stati_privati_v2', '42501');
  PERFORM pg_temp.expect_error('SELECT * FROM public.partite_gioco', '42501');
  PERFORM pg_temp.expect_error('SELECT * FROM public.partite_gioco_presenze_v2', '42501');

  PERFORM pg_temp.assert(public.valida_mossa_partita_gioco_v2(game_scopa, 4, 'synthetic-a-card', '{}'), 'authorized Scopa card/current turn/version');
  PERFORM pg_temp.assert(public.valida_mossa_partita_gioco_v2(game_briscola, 2, 'synthetic-a-card', '{}'), 'authorized Briscola card/current turn/version');
  PERFORM pg_temp.expect_error(format('SELECT public.valida_mossa_partita_gioco_v2(%L,4,%L,''{}'')', game_scopa, 'synthetic-b-card'), '42501');
  PERFORM pg_temp.expect_error(format('SELECT public.valida_mossa_partita_gioco_v2(%L,3,%L,''{}'')', game_scopa, 'synthetic-a-card'), '40001');
  PERFORM pg_temp.expect_error(format('SELECT public.valida_mossa_partita_gioco_v2(%L,2,%L,ARRAY[%L])', game_briscola, 'synthetic-a-card', 'synthetic-table'), '22023');

  expires_at := public.heartbeat_partita_gioco_v2(game_scopa, '20000000-0000-4000-8000-000000000001', 'foreground', true, 4);
  PERFORM pg_temp.assert(expires_at > clock_timestamp(), 'heartbeat issues a future server lease');
  PERFORM public.heartbeat_partita_gioco_v2(game_scopa, '20000000-0000-4000-8000-000000000001', 'background', true, 4);
  PERFORM pg_temp.expect_error(format('SELECT public.heartbeat_partita_gioco_v2(%L,%L,%L,true,99)', game_scopa, '20000000-0000-4000-8000-000000000002', 'foreground'), '22023');
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  SET LOCAL ROLE service_role;
  PERFORM pg_temp.assert(EXISTS (
    SELECT 1 FROM public.partite_gioco_presenze_v2
    WHERE partita_id = game_scopa AND user_id = a
      AND session_id = '20000000-0000-4000-8000-000000000001'
      AND app_state = 'background' AND route_visible = false
  ), 'background presence is not visually active');
  UPDATE public.partite_gioco_presenze_v2
  SET lease_expires_at = clock_timestamp() - interval '1 second'
  WHERE partita_id = game_scopa AND user_id = a
    AND session_id = '20000000-0000-4000-8000-000000000001';
  PERFORM pg_temp.assert(NOT EXISTS (
    SELECT 1 FROM public.partite_gioco_presenze_v2
    WHERE partita_id = game_scopa AND user_id = a
      AND app_state = 'foreground' AND route_visible
      AND lease_expires_at > clock_timestamp()
  ), 'expired lease cannot suppress a push');
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  PERFORM public.rilascia_presenza_partita_gioco_v2(game_scopa, '20000000-0000-4000-8000-000000000001');
  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub', intruder::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.expect_error(format('SELECT public.leggi_partita_gioco_v2(%L)', game_scopa), '42501');
  PERFORM pg_temp.expect_error(format('SELECT public.heartbeat_partita_gioco_v2(%L,%L,%L,true,0)', game_scopa, '20000000-0000-4000-8000-000000000003', 'foreground'), '42501');
  PERFORM pg_temp.expect_error(format('SELECT public.crea_sfida_gioco_v2(%L,%L)', 'scopa', intruder), '22023');
  RESET ROLE;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  SET LOCAL ROLE service_role;
  event_a := public.accoda_push_gioco_v2(game_scopa, 'turno', 4, b, a);
  event_b := public.accoda_push_gioco_v2(game_scopa, 'turno', 4, b, a);
  PERFORM pg_temp.assert(event_a = event_b, 'duplicate logical event maps to one outbox row');
  SELECT public.risultato_partita_gioco_v2(game_finished) INTO result;
  PERFORM pg_temp.assert(result->>'winner_id' = a::text, 'winner is derived from private server score');
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.expect_error(format('SELECT public.risultato_partita_gioco_v2(%L)', game_finished), '42501');
  RESET ROLE;
END $$;

ROLLBACK;
\echo 'PASS: only-own-hand projection, locked private rows, move envelope, presence leases, outbox dedupe, server result ACL'
