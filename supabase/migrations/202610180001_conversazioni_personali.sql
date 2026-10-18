-- Base dati personale: nessun UPDATE/DELETE/ALTER dei dati di messaggi.
-- Prerequisiti: public.messaggi(id bigint, mittente_id uuid,
-- destinatario_id uuid, created_at timestamptz), auth.users, auth.uid().
-- Non modifica le policy o i percorsi di lettura della chat esistente.
BEGIN;
SET LOCAL lock_timeout = '10s';

-- Blocca gli scrittori durante snapshot/backfill e installazione del trigger.
-- Un timeout annulla tutta la migrazione: riprovare in finestra di manutenzione.
LOCK TABLE public.messaggi IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.messaggi
    WHERE mittente_id IS NULL OR destinatario_id IS NULL
       OR mittente_id = destinatario_id OR id IS NULL) THEN
    RAISE EXCEPTION 'messaggi: partecipanti o identificativi non validi';
  END IF;
END;
$$;

CREATE TABLE public.chat_conversazioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utente_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  utente_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ultima_posizione bigint NOT NULL DEFAULT 0 CHECK (ultima_posizione >= 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT chat_coppia_canonica CHECK (utente_a < utente_b),
  UNIQUE (utente_a, utente_b)
);

CREATE TABLE public.chat_stati_personali (
  conversazione_id uuid NOT NULL REFERENCES public.chat_conversazioni(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stato text NOT NULL DEFAULT 'active' CHECK (stato IN ('active', 'archived', 'deleted')),
  nascosti_fino_a bigint NOT NULL DEFAULT 0 CHECK (nascosti_fino_a >= 0),
  letti_fino_a bigint NOT NULL DEFAULT 0 CHECK (letti_fino_a >= 0),
  versione bigint NOT NULL DEFAULT 1 CHECK (versione > 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (conversazione_id, user_id)
);

-- Sidecar: non aggiunge colonne e non cambia le righe della tabella condivisa.
-- Nessuna FK verso messaggi: non cambia il comportamento dei DELETE preesistenti.
-- In lettura occorre un JOIN con messaggi per escludere eventuali righe rimosse.
CREATE TABLE public.chat_posizioni_messaggi (
  messaggio_id bigint PRIMARY KEY,
  conversazione_id uuid NOT NULL REFERENCES public.chat_conversazioni(id) ON DELETE CASCADE,
  posizione bigint NOT NULL CHECK (posizione > 0),
  UNIQUE (conversazione_id, posizione)
);

CREATE TABLE public.chat_operazioni_personali (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operazione_id uuid NOT NULL,
  conversazione_id uuid NOT NULL REFERENCES public.chat_conversazioni(id) ON DELETE CASCADE,
  richiesta jsonb NOT NULL,
  risultato jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, operazione_id)
);

CREATE INDEX chat_stati_utente_stato_idx ON public.chat_stati_personali(user_id, stato);
CREATE INDEX chat_conversazioni_utente_b_idx ON public.chat_conversazioni(utente_b);

ALTER TABLE public.chat_conversazioni ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_stati_personali ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_posizioni_messaggi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_operazioni_personali ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.chat_conversazioni, public.chat_stati_personali,
  public.chat_posizioni_messaggi, public.chat_operazioni_personali
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.chat_conversazioni, public.chat_stati_personali,
  public.chat_posizioni_messaggi TO authenticated;
-- Il registro idempotente non e' esposto; accesso solo tramite RPC.

CREATE POLICY chat_conversazioni_partecipante ON public.chat_conversazioni
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IN (utente_a, utente_b));

CREATE POLICY chat_stati_solo_proprietario ON public.chat_stati_personali
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.chat_conversazioni c WHERE c.id = conversazione_id
      AND (SELECT auth.uid()) IN (c.utente_a, c.utente_b)
  ));

CREATE POLICY chat_posizioni_visibili ON public.chat_posizioni_messaggi
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chat_stati_personali s
    WHERE s.conversazione_id = chat_posizioni_messaggi.conversazione_id
      AND s.user_id = (SELECT auth.uid()) AND s.stato <> 'deleted'
      AND chat_posizioni_messaggi.posizione > s.nascosti_fino_a
  ));

-- Backfill deterministico, senza ricevute artificiali e senza push.
INSERT INTO public.chat_conversazioni(utente_a, utente_b)
SELECT DISTINCT least(mittente_id, destinatario_id), greatest(mittente_id, destinatario_id)
FROM public.messaggi;

INSERT INTO public.chat_posizioni_messaggi(messaggio_id, conversazione_id, posizione)
SELECT m.id, c.id, row_number() OVER (
  PARTITION BY c.id ORDER BY m.created_at NULLS FIRST, m.id
)
FROM public.messaggi m JOIN public.chat_conversazioni c
  ON c.utente_a = least(m.mittente_id, m.destinatario_id)
 AND c.utente_b = greatest(m.mittente_id, m.destinatario_id);

UPDATE public.chat_conversazioni c SET ultima_posizione = (
  SELECT max(p.posizione) FROM public.chat_posizioni_messaggi p WHERE p.conversazione_id = c.id
);
INSERT INTO public.chat_stati_personali(conversazione_id, user_id)
SELECT id, utente_a FROM public.chat_conversazioni
UNION ALL SELECT id, utente_b FROM public.chat_conversazioni;

CREATE FUNCTION public.chat_indicizza_nuovo_messaggio()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_pos bigint;
BEGIN
  IF NEW.mittente_id IS NULL OR NEW.destinatario_id IS NULL
     OR NEW.mittente_id = NEW.destinatario_id THEN
    RAISE EXCEPTION 'Partecipanti conversazione non validi';
  END IF;
  INSERT INTO public.chat_conversazioni(utente_a, utente_b)
  VALUES (least(NEW.mittente_id, NEW.destinatario_id), greatest(NEW.mittente_id, NEW.destinatario_id))
  ON CONFLICT (utente_a, utente_b) DO NOTHING;

  -- UPDATE acquisisce il lock per tutta la transazione. Anche la RPC usa
  -- questo lock: nessun affidamento all'ordine di allocazione degli ID globali.
  UPDATE public.chat_conversazioni SET ultima_posizione = ultima_posizione + 1
  WHERE utente_a = least(NEW.mittente_id, NEW.destinatario_id)
    AND utente_b = greatest(NEW.mittente_id, NEW.destinatario_id)
  RETURNING id, ultima_posizione INTO STRICT v_id, v_pos;

  INSERT INTO public.chat_posizioni_messaggi VALUES (NEW.id, v_id, v_pos);
  INSERT INTO public.chat_stati_personali AS s(conversazione_id, user_id)
  VALUES (v_id, least(NEW.mittente_id, NEW.destinatario_id)),
         (v_id, greatest(NEW.mittente_id, NEW.destinatario_id))
  ON CONFLICT (conversazione_id, user_id) DO UPDATE SET
    stato = CASE WHEN s.stato = 'deleted' THEN 'active' ELSE s.stato END,
    versione = s.versione + 1, updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.chat_indicizza_nuovo_messaggio() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER chat_indicizza_insert
AFTER INSERT ON public.messaggi
FOR EACH ROW EXECUTE FUNCTION public.chat_indicizza_nuovo_messaggio();

-- Unico ingresso per le mutazioni. Chiave idempotente obbligatoria per TUTTE
-- le azioni; la stessa chiave con parametri diversi e' sempre un errore.
-- La versione attesa previene azioni da schermate obsolete. Per 'leggi' la
-- posizione e' il massimo messaggio effettivamente presentato dall'app futura.
CREATE FUNCTION public.chat_personale_operazione(
  p_conversazione_id uuid,
  p_operazione_id uuid,
  p_azione text,
  p_versione_attesa bigint,
  p_posizione_letta bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_c public.chat_conversazioni%ROWTYPE;
  v_s public.chat_stati_personali%ROWTYPE;
  v_op public.chat_operazioni_personali%ROWTYPE;
  v_richiesta jsonb;
  v_risultato jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticazione richiesta' USING ERRCODE = '42501';
  END IF;
  IF p_conversazione_id IS NULL OR p_operazione_id IS NULL
     OR p_azione IS NULL OR p_azione NOT IN ('svuota', 'elimina', 'archivia', 'ripristina', 'leggi')
     OR p_versione_attesa IS NULL OR p_versione_attesa < 1
     OR (p_azione = 'leggi' AND (p_posizione_letta IS NULL OR p_posizione_letta < 0))
     OR (p_azione <> 'leggi' AND p_posizione_letta IS NOT NULL) THEN
    RAISE EXCEPTION 'Parametri non validi' USING ERRCODE = '22023';
  END IF;
  v_richiesta := jsonb_build_object('conversazione_id', p_conversazione_id,
    'azione', p_azione, 'versione_attesa', p_versione_attesa::text,
    'posizione_letta', p_posizione_letta::text);

  -- Serializza la chiave anche quando riutilizzata su conversazioni diverse.
  -- Eventuali collisioni hash causano soltanto attesa, non confusione di identita'.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_operazione_id::text, 0));
  SELECT * INTO v_c FROM public.chat_conversazioni
  WHERE id = p_conversazione_id AND v_uid IN (utente_a, utente_b) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversazione non disponibile' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_op FROM public.chat_operazioni_personali
  WHERE user_id = v_uid AND operazione_id = p_operazione_id;
  IF FOUND THEN
    IF v_op.richiesta <> v_richiesta THEN
      RAISE EXCEPTION 'Chiave idempotente gia utilizzata' USING ERRCODE = '22023';
    END IF;
    -- Snapshot originale: il client deve confrontarne la versione con lo stato
    -- corrente, senza sovrascrivere aggiornamenti successivi con questo risultato.
    RETURN v_op.risultato;
  END IF;

  SELECT * INTO STRICT v_s FROM public.chat_stati_personali
  WHERE conversazione_id = v_c.id AND user_id = v_uid FOR UPDATE;
  IF v_s.versione <> p_versione_attesa THEN
    RAISE EXCEPTION 'Versione obsoleta: rileggere lo stato' USING ERRCODE = '40001';
  END IF;
  IF v_s.stato = 'deleted' AND p_azione IN ('archivia', 'ripristina', 'leggi', 'svuota') THEN
    RAISE EXCEPTION 'Conversazione eliminata: attendere un nuovo messaggio' USING ERRCODE = '22023';
  END IF;
  IF p_azione = 'leggi' AND p_posizione_letta > v_c.ultima_posizione THEN
    RAISE EXCEPTION 'Cursore oltre ultimo messaggio' USING ERRCODE = '22023';
  END IF;

  UPDATE public.chat_stati_personali SET
    stato = CASE p_azione WHEN 'elimina' THEN 'deleted' WHEN 'archivia' THEN 'archived'
      WHEN 'ripristina' THEN 'active' ELSE stato END,
    nascosti_fino_a = CASE WHEN p_azione IN ('svuota', 'elimina')
      THEN v_c.ultima_posizione ELSE nascosti_fino_a END,
    letti_fino_a = CASE WHEN p_azione = 'leggi'
      THEN greatest(letti_fino_a, p_posizione_letta) ELSE letti_fino_a END,
    versione = versione + 1, updated_at = clock_timestamp()
  WHERE conversazione_id = v_c.id AND user_id = v_uid
  RETURNING * INTO v_s;

  v_risultato := jsonb_build_object('conversazione_id', v_s.conversazione_id,
    'user_id', v_uid, 'stato', v_s.stato, 'nascosti_fino_a', v_s.nascosti_fino_a::text,
    'letti_fino_a', v_s.letti_fino_a::text, 'versione', v_s.versione::text,
    'ultima_posizione', v_c.ultima_posizione::text, 'updated_at', v_s.updated_at);
  INSERT INTO public.chat_operazioni_personali(user_id, operazione_id, conversazione_id, richiesta, risultato)
  VALUES (v_uid, p_operazione_id, v_c.id, v_richiesta, v_risultato);
  RETURN v_risultato;
END;
$$;
REVOKE ALL ON FUNCTION public.chat_personale_operazione(uuid, uuid, text, bigint, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_personale_operazione(uuid, uuid, text, bigint, bigint)
  TO authenticated;
COMMIT;
