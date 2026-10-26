-- BLOCCO 1B-2 draft. Local-only until reviewed; never apply to production.
-- V2 primitives plus an explicitly breaking permission cutover at the end.
-- The legacy client/API is intentionally not rewired here; do not apply yet.
BEGIN;

CREATE TABLE public.partite_gioco_stati_privati_v2 (
  partita_id uuid PRIMARY KEY REFERENCES public.partite_gioco(id) ON DELETE CASCADE,
  stato_completo jsonb NOT NULL CHECK (jsonb_typeof(stato_completo) = 'object'),
  aggiornato_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.partite_gioco_stati_privati_v2 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.partite_gioco_stati_privati_v2 FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.partite_gioco_stati_privati_v2 TO service_role;

CREATE TABLE public.partite_gioco_presenze_v2 (
  partita_id uuid NOT NULL REFERENCES public.partite_gioco(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  app_state text NOT NULL CHECK (app_state IN ('foreground', 'background', 'disconnected', 'left')),
  route_visible boolean NOT NULL DEFAULT false,
  versione_ack integer NOT NULL DEFAULT 0 CHECK (versione_ack >= 0),
  heartbeat_at timestamptz NOT NULL DEFAULT now(),
  lease_expires_at timestamptz NOT NULL,
  PRIMARY KEY (partita_id, user_id, session_id),
  CHECK (isfinite(heartbeat_at) AND isfinite(lease_expires_at) AND lease_expires_at >= heartbeat_at),
  CHECK (app_state = 'foreground' OR route_visible = false)
);
CREATE INDEX partite_gioco_presenze_live_v2_idx
  ON public.partite_gioco_presenze_v2 (partita_id, user_id, lease_expires_at)
  WHERE app_state = 'foreground' AND route_visible;
ALTER TABLE public.partite_gioco_presenze_v2 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.partite_gioco_presenze_v2 FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.partite_gioco_operazioni_v2 (
  partita_id uuid NOT NULL REFERENCES public.partite_gioco(id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  versione_attesa integer NOT NULL CHECK (versione_attesa >= 0),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  esito jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (partita_id, operation_id),
  CHECK (isfinite(created_at))
);
ALTER TABLE public.partite_gioco_operazioni_v2 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.partite_gioco_operazioni_v2 FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.partite_gioco_push_outbox_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE CHECK (char_length(event_key) BETWEEN 1 AND 300),
  tipo text NOT NULL CHECK (tipo IN ('sfida', 'turno')),
  partita_id uuid NOT NULL REFERENCES public.partite_gioco(id) ON DELETE CASCADE,
  versione integer NOT NULL CHECK (versione >= 0),
  mittente_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  destinatario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stato text NOT NULL DEFAULT 'pending'
    CHECK (stato IN ('pending', 'claimed', 'suppressed', 'sent', 'failed', 'uncertain', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  UNIQUE (tipo, partita_id, versione, destinatario_id),
  CHECK (mittente_id <> destinatario_id),
  CHECK (isfinite(created_at) AND (lease_until IS NULL OR isfinite(lease_until)))
);
CREATE INDEX partite_gioco_push_outbox_pending_v2_idx
  ON public.partite_gioco_push_outbox_v2 (created_at, id) WHERE stato = 'pending';
ALTER TABLE public.partite_gioco_push_outbox_v2 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.partite_gioco_push_outbox_v2 FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.partite_gioco_push_outbox_v2 TO service_role;

CREATE TABLE public.partite_gioco_push_consegne_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.partite_gioco_push_outbox_v2(id) ON DELETE CASCADE,
  dispositivo_id uuid NOT NULL,
  stato text NOT NULL DEFAULT 'pending'
    CHECK (stato IN ('pending', 'claimed', 'accepted', 'receipt_ok', 'failed', 'uncertain', 'cancelled')),
  tentativi integer NOT NULL DEFAULT 0 CHECK (tentativi BETWEEN 0 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evento_id, dispositivo_id),
  CHECK (isfinite(created_at))
);
ALTER TABLE public.partite_gioco_push_consegne_v2 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.partite_gioco_push_consegne_v2 FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.partite_gioco_push_consegne_v2 TO service_role;

CREATE OR REPLACE FUNCTION public.leggi_partita_gioco_v2(p_partita_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_partita public.partite_gioco;
  v_stato jsonb;
  v_mano jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Utente non autenticato' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_partita FROM public.partite_gioco
  WHERE id = p_partita_id AND v_uid IN (sfidante_id, sfidato_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Partita non disponibile' USING ERRCODE = '42501'; END IF;
  SELECT stato_completo INTO v_stato FROM public.partite_gioco_stati_privati_v2 WHERE partita_id = p_partita_id;
  IF v_stato IS NULL THEN RAISE EXCEPTION 'Stato server non inizializzato' USING ERRCODE = '55000'; END IF;
  v_mano := COALESCE(v_stato #> ARRAY['mani', v_uid::text], '[]'::jsonb);
  IF jsonb_typeof(v_mano) <> 'array' OR jsonb_typeof(v_stato->'mazzo') <> 'array' THEN
    RAISE EXCEPTION 'Stato server incompleto' USING ERRCODE = '55000';
  END IF;
  RETURN jsonb_build_object(
    'partita', jsonb_build_object(
      'id', v_partita.id, 'gioco', v_partita.gioco, 'stato', v_partita.stato,
      'sfidante_id', v_partita.sfidante_id, 'sfidato_id', v_partita.sfidato_id,
      'turno_user_id', v_partita.turno_user_id, 'versione', v_partita.versione,
      'vincitore_id', v_partita.vincitore_id,
      'stato_partita', (v_partita.stato_partita - 'mani' - 'mazzo' - 'deck' - 'hands')
        || jsonb_build_object('mano', v_mano,
          'carteRimanenti', jsonb_array_length(COALESCE(v_stato->'mazzo', '[]'::jsonb)))
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.inizializza_stato_partita_gioco_v2(p_partita_id uuid, p_stato_completo jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_game public.partite_gioco;
  v_players jsonb;
  v_hidden_count integer;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Operazione non autorizzata' USING ERRCODE = '42501'; END IF;
  IF p_stato_completo IS NULL OR jsonb_typeof(p_stato_completo) <> 'object' THEN
    RAISE EXCEPTION 'Stato partita non valido' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_game FROM public.partite_gioco WHERE id = p_partita_id FOR UPDATE;
  IF NOT FOUND OR v_game.stato <> 'in_corso' OR v_game.versione <> 0 THEN
    RAISE EXCEPTION 'Partita non inizializzabile' USING ERRCODE = '55000';
  END IF;
  IF p_stato_completo->>'tipo' IS DISTINCT FROM v_game.gioco THEN
    RAISE EXCEPTION 'Tipo stato non coerente' USING ERRCODE = '22023';
  END IF;
  v_players := p_stato_completo->'giocatori';
  IF jsonb_typeof(v_players) <> 'array' OR jsonb_array_length(v_players) <> 2
     OR NOT (v_players @> jsonb_build_array(v_game.sfidante_id::text))
     OR NOT (v_players @> jsonb_build_array(v_game.sfidato_id::text)) THEN
    RAISE EXCEPTION 'Giocatori stato non coerenti' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_stato_completo->'mani') <> 'object'
     OR jsonb_typeof(p_stato_completo->'mazzo') <> 'array' THEN
    RAISE EXCEPTION 'Carte private non valide' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.partite_gioco_stati_privati_v2(partita_id, stato_completo)
  VALUES (p_partita_id, p_stato_completo);
  v_hidden_count := jsonb_array_length(p_stato_completo->'mazzo');
  UPDATE public.partite_gioco SET
    stato_partita = (p_stato_completo - 'mani' - 'mazzo' - 'deck' - 'hands')
      || jsonb_build_object('carteRimanenti', v_hidden_count),
    updated_at = now()
  WHERE id = p_partita_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.elenco_partite_gioco_v2()
RETURNS SETOF jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', p.id, 'gioco', p.gioco, 'sfidante_id', p.sfidante_id,
    'sfidato_id', p.sfidato_id, 'stato', p.stato,
    'turno_user_id', p.turno_user_id, 'versione', p.versione,
    'vincitore_id', p.vincitore_id, 'created_at', p.created_at, 'updated_at', p.updated_at
  )
  FROM public.partite_gioco p
  WHERE auth.uid() IN (p.sfidante_id, p.sfidato_id)
  ORDER BY p.updated_at DESC
$$;

CREATE OR REPLACE FUNCTION public.crea_sfida_gioco_v2(p_gioco text, p_sfidato_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_record public.partite_gioco;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Utente non autenticato' USING ERRCODE = '28000'; END IF;
  IF p_gioco NOT IN ('scopa', 'briscola') OR p_sfidato_id IS NULL OR p_sfidato_id = v_uid THEN
    RAISE EXCEPTION 'Sfida non valida' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.colleghi c
    WHERE c.stato = 'accettato'
      AND ((c.user_id = v_uid AND c.collega_id = p_sfidato_id)
        OR (c.user_id = p_sfidato_id AND c.collega_id = v_uid))
  ) THEN RAISE EXCEPTION 'Collegamento non accettato' USING ERRCODE = '42501'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.utenti_bloccati b
    WHERE (b.bloccante_id = v_uid AND b.bloccato_id = p_sfidato_id)
       OR (b.bloccante_id = p_sfidato_id AND b.bloccato_id = v_uid)
  ) THEN RAISE EXCEPTION 'Utente bloccato' USING ERRCODE = '42501'; END IF;
  IF (SELECT count(*) FROM public.partite_gioco p
      WHERE p.sfidante_id = v_uid AND p.created_at > now() - interval '5 minutes') >= 5 THEN
    RAISE EXCEPTION 'Limite sfide raggiunto' USING ERRCODE = '54000';
  END IF;
  INSERT INTO public.partite_gioco(gioco, sfidante_id, sfidato_id, stato, turno_user_id)
  VALUES (p_gioco, v_uid, p_sfidato_id, 'in_attesa', NULL)
  RETURNING * INTO v_record;
  PERFORM public.accoda_push_gioco_v2(v_record.id, 'sfida', 0, v_uid, p_sfidato_id);
  RETURN jsonb_build_object('id', v_record.id, 'gioco', v_record.gioco,
    'stato', v_record.stato, 'sfidante_id', v_record.sfidante_id,
    'sfidato_id', v_record.sfidato_id, 'versione', v_record.versione);
END;
$$;

CREATE OR REPLACE FUNCTION public.rispondi_sfida_gioco_v2(p_partita_id uuid, p_accetta boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_record public.partite_gioco;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Utente non autenticato' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_record FROM public.partite_gioco
  WHERE id = p_partita_id AND sfidato_id = v_uid AND stato = 'in_attesa' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sfida non disponibile' USING ERRCODE = '42501'; END IF;
  IF p_accetta THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.colleghi c
      WHERE c.stato = 'accettato'
        AND ((c.user_id = v_record.sfidante_id AND c.collega_id = v_record.sfidato_id)
          OR (c.user_id = v_record.sfidato_id AND c.collega_id = v_record.sfidante_id))
    ) THEN RAISE EXCEPTION 'Collegamento non più accettato' USING ERRCODE = '42501'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.utenti_bloccati b
      WHERE (b.bloccante_id = v_record.sfidante_id AND b.bloccato_id = v_record.sfidato_id)
         OR (b.bloccante_id = v_record.sfidato_id AND b.bloccato_id = v_record.sfidante_id)
    ) THEN RAISE EXCEPTION 'Utente bloccato' USING ERRCODE = '42501'; END IF;
  END IF;
  UPDATE public.partite_gioco SET
    stato = CASE WHEN p_accetta THEN 'in_corso' ELSE 'rifiutata' END,
    turno_user_id = CASE WHEN p_accetta THEN sfidante_id ELSE NULL END,
    accepted_at = CASE WHEN p_accetta THEN now() ELSE accepted_at END,
    updated_at = now()
  WHERE id = p_partita_id RETURNING * INTO v_record;
  IF p_accetta THEN
    PERFORM public.accoda_push_gioco_v2(v_record.id, 'turno', v_record.versione,
      v_record.sfidato_id, v_record.sfidante_id);
  END IF;
  RETURN jsonb_build_object('id', v_record.id, 'gioco', v_record.gioco,
    'stato', v_record.stato, 'sfidante_id', v_record.sfidante_id,
    'sfidato_id', v_record.sfidato_id, 'turno_user_id', v_record.turno_user_id,
    'versione', v_record.versione);
END;
$$;

CREATE OR REPLACE FUNCTION public.annulla_sfida_gioco_v2(p_partita_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_record public.partite_gioco;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Utente non autenticato' USING ERRCODE = '28000'; END IF;
  UPDATE public.partite_gioco SET stato = 'annullata', turno_user_id = NULL, updated_at = now()
  WHERE id = p_partita_id AND sfidante_id = auth.uid() AND stato = 'in_attesa'
  RETURNING * INTO v_record;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sfida non annullabile' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object('id', v_record.id, 'stato', v_record.stato,
    'sfidante_id', v_record.sfidante_id, 'sfidato_id', v_record.sfidato_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.heartbeat_partita_gioco_v2(
  p_partita_id uuid,
  p_session_id uuid,
  p_app_state text,
  p_route_visible boolean,
  p_versione_ack integer
)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_partita public.partite_gioco;
  v_state text;
  v_visible boolean;
  v_expiry timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Utente non autenticato' USING ERRCODE = '28000'; END IF;
  IF p_session_id IS NULL OR p_app_state IS NULL OR p_app_state NOT IN ('foreground', 'background', 'disconnected', 'left')
     OR p_versione_ack IS NULL OR p_versione_ack < 0 THEN
    RAISE EXCEPTION 'Presenza non valida' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_partita FROM public.partite_gioco
  WHERE id = p_partita_id AND v_uid IN (sfidante_id, sfidato_id);
  IF NOT FOUND OR v_partita.stato <> 'in_corso' THEN
    RAISE EXCEPTION 'Partita non disponibile' USING ERRCODE = '42501';
  END IF;
  IF p_versione_ack > v_partita.versione THEN
    RAISE EXCEPTION 'Ack oltre la versione corrente' USING ERRCODE = '22023';
  END IF;
  v_state := p_app_state;
  v_visible := p_app_state = 'foreground' AND COALESCE(p_route_visible, false);
  v_expiry := clock_timestamp() + interval '45 seconds';
  INSERT INTO public.partite_gioco_presenze_v2 AS old (
    partita_id, user_id, session_id, app_state, route_visible,
    versione_ack, heartbeat_at, lease_expires_at
  ) VALUES (
    p_partita_id, v_uid, p_session_id, v_state, v_visible,
    p_versione_ack, clock_timestamp(), v_expiry
  )
  ON CONFLICT (partita_id, user_id, session_id) DO UPDATE SET
    app_state = EXCLUDED.app_state,
    route_visible = EXCLUDED.route_visible,
    versione_ack = GREATEST(old.versione_ack, EXCLUDED.versione_ack),
    heartbeat_at = EXCLUDED.heartbeat_at,
    lease_expires_at = EXCLUDED.lease_expires_at
  RETURNING lease_expires_at INTO v_expiry;
  RETURN v_expiry;
END;
$$;

CREATE OR REPLACE FUNCTION public.rilascia_presenza_partita_gioco_v2(p_partita_id uuid, p_session_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Utente non autenticato' USING ERRCODE = '28000'; END IF;
  UPDATE public.partite_gioco_presenze_v2
  SET app_state = 'left', route_visible = false, lease_expires_at = clock_timestamp(),
      heartbeat_at = clock_timestamp()
  WHERE partita_id = p_partita_id AND user_id = auth.uid() AND session_id = p_session_id;
END;
$$;

-- This is an authorization/legality preflight only, not an atomic move commit.
-- A later server rules engine must apply the transition and outbox insert together.
CREATE OR REPLACE FUNCTION public.valida_mossa_partita_gioco_v2(
  p_partita_id uuid,
  p_versione_attesa integer,
  p_carta_id text,
  p_presa_ids text[] DEFAULT '{}'
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_partita public.partite_gioco;
  v_state jsonb;
  v_card jsonb;
  v_capture jsonb;
  v_table jsonb;
  v_target integer;
  v_sum integer;
  v_unique_count integer;
  v_found_count integer;
  v_equals integer;
  v_selected_equals integer;
  v_combinations integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Utente non autenticato' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_partita FROM public.partite_gioco
  WHERE id = p_partita_id AND v_uid IN (sfidante_id, sfidato_id) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partita non disponibile' USING ERRCODE = '42501'; END IF;
  IF v_partita.stato <> 'in_corso' THEN RAISE EXCEPTION 'Partita non in corso' USING ERRCODE = '55000'; END IF;
  IF v_partita.turno_user_id <> v_uid THEN RAISE EXCEPTION 'Non è il tuo turno' USING ERRCODE = '42501'; END IF;
  IF v_partita.versione <> p_versione_attesa THEN RAISE EXCEPTION 'Versione obsoleta' USING ERRCODE = '40001'; END IF;
  SELECT stato_completo INTO v_state FROM public.partite_gioco_stati_privati_v2 WHERE partita_id = p_partita_id;
  IF v_state IS NULL OR v_state->>'tipo' IS DISTINCT FROM v_partita.gioco THEN
    RAISE EXCEPTION 'Stato server non valido' USING ERRCODE = '55000';
  END IF;
  SELECT h.carta INTO v_card FROM jsonb_array_elements(COALESCE(v_state #> ARRAY['mani', v_uid::text], '[]'::jsonb)) AS h(carta)
  WHERE h.carta->>'id' = p_carta_id LIMIT 1;
  IF v_card IS NULL THEN RAISE EXCEPTION 'Carta non nella propria mano' USING ERRCODE = '42501'; END IF;

  IF v_partita.gioco = 'briscola' THEN
    IF COALESCE(cardinality(p_presa_ids), 0) <> 0 THEN
      RAISE EXCEPTION 'Briscola non accetta carte di presa' USING ERRCODE = '22023';
    END IF;
    RETURN true;
  END IF;

  IF p_presa_ids IS NULL OR cardinality(p_presa_ids) <> cardinality(ARRAY(SELECT DISTINCT unnest(p_presa_ids))) THEN
    RAISE EXCEPTION 'Selezione presa duplicata o non valida' USING ERRCODE = '22023';
  END IF;
  v_target := (v_card->>'valore')::integer;
  v_table := COALESCE(v_state->'tavolo', '[]'::jsonb);
  SELECT count(*) INTO v_equals
  FROM jsonb_array_elements(v_table) AS item(carta)
  WHERE (item.carta->>'valore')::integer = v_target;
  IF cardinality(p_presa_ids) > 0 THEN
    SELECT count(*), COALESCE(sum((item.carta->>'valore')::integer), 0),
           count(*) FILTER (WHERE (item.carta->>'valore')::integer = v_target)
    INTO v_found_count, v_sum, v_selected_equals
    FROM jsonb_array_elements(v_table) AS item(carta)
    WHERE item.carta->>'id' = ANY(p_presa_ids);
    IF v_found_count <> cardinality(p_presa_ids) THEN RAISE EXCEPTION 'Carta di presa non sul tavolo' USING ERRCODE = '22023'; END IF;
    IF v_equals > 0 THEN
      IF cardinality(p_presa_ids) <> 1 OR v_selected_equals <> 1 THEN RAISE EXCEPTION 'Presa uguale non valida' USING ERRCODE = '22023'; END IF;
    ELSIF v_sum <> v_target THEN
      RAISE EXCEPTION 'Somma della presa non valida' USING ERRCODE = '22023';
    END IF;
  ELSE
    -- Do not accept an unclaimed capture when a single equal-value card exists.
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_table) AS item(carta)
      WHERE (item.carta->>'valore')::integer = v_target
    ) THEN
      RAISE EXCEPTION 'Presa disponibile non selezionata' USING ERRCODE = '22023';
    END IF;
    WITH RECURSIVE c AS (
      SELECT 0::bigint AS ord, 0::integer AS totale
      UNION ALL
      SELECT t.ord, c.totale + (t.carta->>'valore')::integer
      FROM c JOIN LATERAL jsonb_array_elements(v_table) WITH ORDINALITY AS t(carta, ord) ON t.ord > c.ord
      WHERE c.totale + (t.carta->>'valore')::integer <= v_target
    )
    SELECT count(*) INTO v_combinations FROM c WHERE totale = v_target;
    IF v_combinations > 0 THEN RAISE EXCEPTION 'Presa disponibile non selezionata' USING ERRCODE = '22023'; END IF;
  END IF;
  RETURN true;
END;
$$;

-- Result is derived from the server-private final state; callers cannot pass a winner.
CREATE OR REPLACE FUNCTION public.risultato_partita_gioco_v2(p_partita_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_game public.partite_gioco;
  v_state jsonb;
  v_scores jsonb;
  v_a integer;
  v_b integer;
  v_winner uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Operazione non autorizzata' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_game FROM public.partite_gioco WHERE id = p_partita_id FOR UPDATE;
  IF NOT FOUND OR v_game.stato <> 'finita' THEN RAISE EXCEPTION 'Partita non terminata' USING ERRCODE = '55000'; END IF;
  SELECT stato_completo INTO v_state FROM public.partite_gioco_stati_privati_v2 WHERE partita_id = p_partita_id;
  IF v_game.gioco = 'scopa' THEN v_scores := v_state->'punteggio'; ELSE v_scores := v_state->'punti'; END IF;
  IF jsonb_typeof(v_scores) <> 'object' THEN RAISE EXCEPTION 'Punteggio server non disponibile' USING ERRCODE = '55000'; END IF;
  v_a := (v_scores->>v_game.sfidante_id::text)::integer;
  v_b := (v_scores->>v_game.sfidato_id::text)::integer;
  IF v_a IS NULL OR v_b IS NULL OR v_a < 0 OR v_b < 0 THEN RAISE EXCEPTION 'Punteggio server non valido' USING ERRCODE = '22023'; END IF;
  IF v_a > v_b THEN v_winner := v_game.sfidante_id; ELSIF v_b > v_a THEN v_winner := v_game.sfidato_id; END IF;
  IF v_winner IS DISTINCT FROM v_game.vincitore_id THEN
    RAISE EXCEPTION 'Vincitore non coerente con il punteggio server' USING ERRCODE = '23514';
  END IF;
  RETURN jsonb_build_object('scores', v_scores, 'winner_id', v_winner);
END;
$$;

CREATE OR REPLACE FUNCTION public.accoda_push_gioco_v2(
  p_partita_id uuid,
  p_tipo text,
  p_versione integer,
  p_mittente_id uuid,
  p_destinatario_id uuid
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_game public.partite_gioco;
  v_key text;
  v_id uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Operazione non autorizzata' USING ERRCODE = '42501'; END IF;
  IF p_tipo NOT IN ('sfida', 'turno') OR p_versione < 0 OR p_mittente_id = p_destinatario_id THEN
    RAISE EXCEPTION 'Evento gioco non valido' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_game FROM public.partite_gioco WHERE id = p_partita_id;
  IF NOT FOUND OR p_destinatario_id NOT IN (v_game.sfidante_id, v_game.sfidato_id)
     OR p_mittente_id NOT IN (v_game.sfidante_id, v_game.sfidato_id) THEN
    RAISE EXCEPTION 'Destinatari non partecipanti' USING ERRCODE = '42501';
  END IF;
  IF p_tipo = 'turno' AND (v_game.stato <> 'in_corso' OR v_game.versione <> p_versione OR v_game.turno_user_id <> p_destinatario_id) THEN
    RAISE EXCEPTION 'Evento turno non corrisponde alla partita' USING ERRCODE = '40001';
  END IF;
  IF p_tipo = 'sfida' AND (v_game.stato <> 'in_attesa' OR v_game.sfidante_id <> p_mittente_id OR v_game.sfidato_id <> p_destinatario_id) THEN
    RAISE EXCEPTION 'Evento sfida non corrisponde alla partita' USING ERRCODE = '40001';
  END IF;
  v_key := format('game:%s:%s:v%s:%s', p_tipo, p_partita_id, p_versione, p_destinatario_id);
  INSERT INTO public.partite_gioco_push_outbox_v2(event_key, tipo, partita_id, versione, mittente_id, destinatario_id)
  VALUES (v_key, p_tipo, p_partita_id, p_versione, p_mittente_id, p_destinatario_id)
  ON CONFLICT (event_key) DO UPDATE SET event_key = EXCLUDED.event_key
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.leggi_partita_gioco_v2(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.elenco_partite_gioco_v2() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.inizializza_stato_partita_gioco_v2(uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crea_sfida_gioco_v2(text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rispondi_sfida_gioco_v2(uuid,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.annulla_sfida_gioco_v2(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.heartbeat_partita_gioco_v2(uuid,uuid,text,boolean,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rilascia_presenza_partita_gioco_v2(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.valida_mossa_partita_gioco_v2(uuid,integer,text,text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.risultato_partita_gioco_v2(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accoda_push_gioco_v2(uuid,text,integer,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leggi_partita_gioco_v2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.elenco_partite_gioco_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.inizializza_stato_partita_gioco_v2(uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.crea_sfida_gioco_v2(text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rispondi_sfida_gioco_v2(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.annulla_sfida_gioco_v2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_partita_gioco_v2(uuid,uuid,text,boolean,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rilascia_presenza_partita_gioco_v2(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.valida_mossa_partita_gioco_v2(uuid,integer,text,text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.risultato_partita_gioco_v2(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.accoda_push_gioco_v2(uuid,text,integer,uuid,uuid) TO service_role;

-- Cutover gate: direct row reads and legacy client-state writes expose private
-- cards or permit client-authored results. Restore these grants only via down.
REVOKE SELECT ON TABLE public.partite_gioco FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.crea_sfida_gioco(text,uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.rispondi_sfida_gioco(uuid,boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.annulla_sfida_gioco(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.salva_stato_partita_gioco(uuid,integer,jsonb,uuid,boolean,uuid) FROM authenticated;

COMMIT;
