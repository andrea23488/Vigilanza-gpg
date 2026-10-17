-- Push operative per messaggi privati e consegne di servizio.
-- Il client non puo' leggere token di altri utenti.
BEGIN;

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_token text NOT NULL UNIQUE,
  piattaforma text NOT NULL CHECK (piattaforma IN ('ios','android')),
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_tokens_formato CHECK (
    char_length(expo_token) <= 512
    AND expo_token ~ '^(ExponentPushToken|ExpoPushToken)\\[[A-Za-z0-9_-]+\\]$'
  )
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.push_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_tokens TO service_role;

CREATE OR REPLACE FUNCTION public.registra_push_token(
  p_token text,
  p_piattaforma text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Utente non autenticato';
  END IF;

  IF p_piattaforma NOT IN ('ios','android') THEN
    RAISE EXCEPTION 'Piattaforma non valida';
  END IF;

  IF p_token IS NULL
     OR char_length(p_token) > 512
     OR p_token !~ '^(ExponentPushToken|ExpoPushToken)\\[[A-Za-z0-9_-]+\\]$' THEN
    RAISE EXCEPTION 'Token push non valido';
  END IF;

  INSERT INTO public.push_tokens (
    user_id, expo_token, piattaforma, attivo, updated_at
  )
  VALUES (
    v_uid, p_token, p_piattaforma, true, now()
  )
  ON CONFLICT (expo_token)
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    piattaforma = EXCLUDED.piattaforma,
    attivo = true,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.rimuovi_push_token(
  p_token text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.push_tokens
  SET attivo = false, updated_at = now()
  WHERE user_id = v_uid
    AND expo_token = p_token;
END;
$$;

REVOKE ALL ON FUNCTION public.registra_push_token(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rimuovi_push_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registra_push_token(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rimuovi_push_token(text) TO authenticated;

CREATE INDEX IF NOT EXISTS push_tokens_utente_attivi_idx
  ON public.push_tokens (user_id)
  WHERE attivo;

COMMIT;
