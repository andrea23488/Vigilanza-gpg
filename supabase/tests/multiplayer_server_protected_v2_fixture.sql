-- Synthetic-only fixture. Run only after the V2 migration in a disposable local DB.
BEGIN;

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'player-a@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-0000000000b2', 'authenticated', 'authenticated', 'player-b@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-0000000000c3', 'authenticated', 'authenticated', 'intruder@example.invalid', '', now(), '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.colleghi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  collega_id uuid NOT NULL,
  stato text NOT NULL
);
CREATE TABLE IF NOT EXISTS public.utenti_bloccati (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bloccante_id uuid NOT NULL,
  bloccato_id uuid NOT NULL
);

INSERT INTO public.colleghi(user_id, collega_id, stato)
VALUES ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b2', 'accettato');

INSERT INTO public.partite_gioco(id, gioco, sfidante_id, sfidato_id, stato, turno_user_id, versione, stato_partita)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'scopa',
   '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b2',
   'in_corso', '00000000-0000-4000-8000-0000000000a1', 4, '{"tipo":"scopa","tavolo":[{"id":"synthetic-table","valore":3,"seme":"coppe"}]}'),
  ('10000000-0000-4000-8000-000000000002', 'briscola',
   '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b2',
   'in_corso', '00000000-0000-4000-8000-0000000000a1', 2, '{"tipo":"briscola","tavolo":[],"punti":{}}'),
  ('10000000-0000-4000-8000-000000000003', 'scopa',
   '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b2',
   'finita', NULL, 9, '{"tipo":"scopa","tavolo":[]}');

INSERT INTO public.partite_gioco_stati_privati_v2(partita_id, stato_completo)
VALUES
  ('10000000-0000-4000-8000-000000000001', '{"tipo":"scopa","mani":{"00000000-0000-4000-8000-0000000000a1":[{"id":"synthetic-a-card","valore":1,"seme":"denari"}],"00000000-0000-4000-8000-0000000000b2":[{"id":"synthetic-b-card","valore":2,"seme":"spade"}]},"mazzo":[{"id":"synthetic-hidden-deck"}],"tavolo":[{"id":"synthetic-table","valore":3,"seme":"coppe"}],"prese":{},"scope":{},"punteggio":null}'),
  ('10000000-0000-4000-8000-000000000002', '{"tipo":"briscola","mani":{"00000000-0000-4000-8000-0000000000a1":[{"id":"synthetic-a-card","valore":1,"seme":"denari"}],"00000000-0000-4000-8000-0000000000b2":[{"id":"synthetic-b-card","valore":2,"seme":"spade"}]},"mazzo":[{"id":"synthetic-hidden-deck"}],"tavolo":[],"punti":{"00000000-0000-4000-8000-0000000000a1":0,"00000000-0000-4000-8000-0000000000b2":0}}'),
  ('10000000-0000-4000-8000-000000000003', '{"tipo":"scopa","mani":{},"mazzo":[],"tavolo":[],"prese":{},"scope":{},"punteggio":{"00000000-0000-4000-8000-0000000000a1":12,"00000000-0000-4000-8000-0000000000b2":8}}');

UPDATE public.partite_gioco SET vincitore_id = '00000000-0000-4000-8000-0000000000a1'
WHERE id = '10000000-0000-4000-8000-000000000003';
COMMIT;
