-- Multiplayer asincrono Scopa / Briscola.
-- Le partite sono visibili solo ai due partecipanti.
BEGIN;

CREATE TABLE IF NOT EXISTS public.partite_gioco (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gioco text NOT NULL CHECK (gioco IN ('scopa', 'briscola')),
  sfidante_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sfidato_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stato text NOT NULL DEFAULT 'in_attesa'
    CHECK (stato IN ('in_attesa', 'in_corso', 'finita', 'rifiutata', 'annullata')),
  turno_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stato_partita jsonb NOT NULL DEFAULT '{}'::jsonb,
  versione integer NOT NULL DEFAULT 0 CHECK (versione >= 0),
  vincitore_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  last_move_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partite_gioco_utenti_diversi CHECK (sfidante_id <> sfidato_id)
);

ALTER TABLE public.partite_gioco ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partite_gioco_partecipanti_select" ON public.partite_gioco;
CREATE POLICY "partite_gioco_partecipanti_select"
ON public.partite_gioco
FOR SELECT
TO authenticated
USING (
  auth.uid() = sfidante_id
  OR auth.uid() = sfidato_id
);

REVOKE INSERT, UPDATE, DELETE ON TABLE public.partite_gioco FROM authenticated;
GRANT SELECT ON TABLE public.partite_gioco TO authenticated;
GRANT ALL ON TABLE public.partite_gioco TO service_role;

CREATE INDEX IF NOT EXISTS partite_gioco_sfidante_idx
  ON public.partite_gioco (sfidante_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS partite_gioco_sfidato_idx
  ON public.partite_gioco (sfidato_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS partite_gioco_turno_idx
  ON public.partite_gioco (turno_user_id)
  WHERE stato = 'in_corso';

CREATE OR REPLACE FUNCTION public.crea_sfida_gioco(
  p_gioco text,
  p_sfidato_id uuid
)
RETURNS public.partite_gioco
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_record public.partite_gioco;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Utente non autenticato';
  END IF;

  IF p_gioco NOT IN ('scopa', 'briscola') THEN
    RAISE EXCEPTION 'Gioco non valido';
  END IF;

  IF p_sfidato_id IS NULL OR p_sfidato_id = v_uid THEN
    RAISE EXCEPTION 'Avversario non valido';
  END IF;

  INSERT INTO public.partite_gioco (
    gioco,
    sfidante_id,
    sfidato_id,
    stato,
    turno_user_id
  )
  VALUES (
    p_gioco,
    v_uid,
    p_sfidato_id,
    'in_attesa',
    NULL
  )
  RETURNING * INTO v_record;

  RETURN v_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.rispondi_sfida_gioco(
  p_partita_id uuid,
  p_accetta boolean
)
RETURNS public.partite_gioco
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_record public.partite_gioco;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Utente non autenticato';
  END IF;

  SELECT *
  INTO v_record
  FROM public.partite_gioco
  WHERE id = p_partita_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sfida non trovata';
  END IF;

  IF v_record.sfidato_id <> v_uid THEN
    RAISE EXCEPTION 'Operazione non autorizzata';
  END IF;

  IF v_record.stato <> 'in_attesa' THEN
    RAISE EXCEPTION 'Sfida gia gestita';
  END IF;

  UPDATE public.partite_gioco
  SET
    stato = CASE WHEN p_accetta THEN 'in_corso' ELSE 'rifiutata' END,
    turno_user_id = CASE WHEN p_accetta THEN sfidante_id ELSE NULL END,
    accepted_at = CASE WHEN p_accetta THEN now() ELSE accepted_at END,
    updated_at = now()
  WHERE id = p_partita_id
  RETURNING * INTO v_record;

  RETURN v_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.annulla_sfida_gioco(
  p_partita_id uuid
)
RETURNS public.partite_gioco
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_record public.partite_gioco;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Utente non autenticato';
  END IF;

  UPDATE public.partite_gioco
  SET
    stato = 'annullata',
    turno_user_id = NULL,
    updated_at = now()
  WHERE id = p_partita_id
    AND sfidante_id = v_uid
    AND stato = 'in_attesa'
  RETURNING * INTO v_record;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sfida non annullabile';
  END IF;

  RETURN v_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.salva_stato_partita_gioco(
  p_partita_id uuid,
  p_versione_attesa integer,
  p_stato_partita jsonb,
  p_prossimo_turno_user_id uuid,
  p_finita boolean DEFAULT false,
  p_vincitore_id uuid DEFAULT NULL
)
RETURNS public.partite_gioco
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_record public.partite_gioco;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Utente non autenticato';
  END IF;

  SELECT *
  INTO v_record
  FROM public.partite_gioco
  WHERE id = p_partita_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partita non trovata';
  END IF;

  IF v_record.stato <> 'in_corso' THEN
    RAISE EXCEPTION 'Partita non in corso';
  END IF;

  IF v_record.turno_user_id <> v_uid THEN
    RAISE EXCEPTION 'Non e il tuo turno';
  END IF;

  IF v_record.versione <> p_versione_attesa THEN
    RAISE EXCEPTION 'Partita aggiornata da un altro dispositivo';
  END IF;

  IF p_stato_partita IS NULL OR jsonb_typeof(p_stato_partita) <> 'object' THEN
    RAISE EXCEPTION 'Stato partita non valido';
  END IF;

  IF NOT p_finita AND p_prossimo_turno_user_id NOT IN (
    v_record.sfidante_id,
    v_record.sfidato_id
  ) THEN
    RAISE EXCEPTION 'Prossimo turno non valido';
  END IF;

  IF p_finita
     AND p_vincitore_id IS NOT NULL
     AND p_vincitore_id NOT IN (v_record.sfidante_id, v_record.sfidato_id) THEN
    RAISE EXCEPTION 'Vincitore non valido';
  END IF;

  UPDATE public.partite_gioco
  SET
    stato_partita = p_stato_partita,
    versione = versione + 1,
    turno_user_id = CASE WHEN p_finita THEN NULL ELSE p_prossimo_turno_user_id END,
    stato = CASE WHEN p_finita THEN 'finita' ELSE 'in_corso' END,
    vincitore_id = CASE WHEN p_finita THEN p_vincitore_id ELSE NULL END,
    last_move_at = now(),
    updated_at = now()
  WHERE id = p_partita_id
  RETURNING * INTO v_record;

  RETURN v_record;
END;
$$;

REVOKE ALL ON FUNCTION public.crea_sfida_gioco(text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rispondi_sfida_gioco(uuid,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.annulla_sfida_gioco(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.salva_stato_partita_gioco(uuid,integer,jsonb,uuid,boolean,uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.crea_sfida_gioco(text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rispondi_sfida_gioco(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.annulla_sfida_gioco(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.salva_stato_partita_gioco(uuid,integer,jsonb,uuid,boolean,uuid) TO authenticated;

COMMIT;
