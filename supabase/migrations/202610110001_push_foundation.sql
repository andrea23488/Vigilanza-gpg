-- CANDIDATA: non applicata. Nessun trigger, job, endpoint o invio.
-- Recupero conservativo: token/installation_id non provano la proprieta'.
-- Registrazione, revoca e trasferimento richiederanno operazioni server atomiche:
-- JWT verificato + credenziale casuale indipendente (almeno 256 bit), hash SHA-256;
-- nessun trasferimento su collisione senza prova valida. Mai salvare il segreto.
-- Versione attesa, incremento binding, annullamento lavori e revoca test devono
-- essere controllati dal server. Il database non prova il possesso fisico.
-- Logout offline: usare scadenza e rinnovo autenticato; non garantisce revoca immediata.
-- Bigint sorgente: futura lettura come testo PRIMA della conversione JavaScript.
-- Retention: non ricreare eventi gia' eliminati; serve cutoff di acquisizione.
BEGIN;

CREATE TABLE public.push_dispositivi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  installation_id uuid NOT NULL UNIQUE,
  expo_token text NOT NULL UNIQUE,
  project_id uuid NOT NULL,
  piattaforma text NOT NULL CHECK (piattaforma IN ('ios', 'android')),
  ambiente text NOT NULL CHECK (ambiente IN ('development', 'production')),
  credenziale_hash text NOT NULL CHECK (credenziale_hash ~ '^[0-9a-f]{64}$'),
  binding_version bigint NOT NULL DEFAULT 1
    CHECK (binding_version BETWEEN 1 AND 9007199254740991),
  attivo boolean NOT NULL DEFAULT false,
  registrato_at timestamptz NOT NULL DEFAULT now(),
  ultima_verifica_autenticata_at timestamptz NOT NULL,
  associazione_scade_at timestamptz NOT NULL,
  disattivato_at timestamptz,
  motivo_disattivazione text,
  CONSTRAINT push_dispositivi_token CHECK (
    char_length(expo_token) <= 512
    AND expo_token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'
  ),
  CONSTRAINT push_dispositivi_date CHECK (
    isfinite(registrato_at) AND isfinite(ultima_verifica_autenticata_at)
    AND isfinite(associazione_scade_at)
    AND registrato_at >= TIMESTAMPTZ '1970-01-01 00:00:00+00'
    AND ultima_verifica_autenticata_at >= registrato_at
    AND associazione_scade_at > ultima_verifica_autenticata_at
    AND (disattivato_at IS NULL OR
      (isfinite(disattivato_at) AND disattivato_at >= registrato_at))
  ),
  CONSTRAINT push_dispositivi_disattivazione CHECK (
    (attivo AND disattivato_at IS NULL AND motivo_disattivazione IS NULL)
    OR (NOT attivo AND disattivato_at IS NOT NULL
      AND motivo_disattivazione IS NOT NULL
      AND motivo_disattivazione IN (
        'registrazione_inattiva', 'logout', 'cambio_account',
        'permesso_revocato', 'token_non_valido', 'scadenza',
        'sessione_revocata', 'amministrazione'
      ))
  )
);
CREATE INDEX push_dispositivi_utente_attivi_idx
  ON public.push_dispositivi (user_id, project_id, ambiente) WHERE attivo;
CREATE INDEX push_dispositivi_scadenza_idx
  ON public.push_dispositivi (associazione_scade_at) WHERE attivo;

CREATE TABLE public.push_preferenze (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_enabled boolean NOT NULL DEFAULT false,
  collegamenti_enabled boolean NOT NULL DEFAULT false,
  -- Prima versione: soltanto avvisi generici, senza nome o testo privato.
  privacy_mode text NOT NULL DEFAULT 'generica' CHECK (privacy_mode = 'generica'),
  updated_at timestamptz NOT NULL DEFAULT now() CHECK (isfinite(updated_at))
);

CREATE TABLE public.push_eventi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('messaggio_privato', 'richiesta_collegamento')),
  -- Riferimenti logici: nessuna FK che cambi le cancellazioni delle sorgenti.
  messaggio_id bigint UNIQUE,
  collegamento_id bigint UNIQUE,
  mittente_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  destinatario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  stato text NOT NULL DEFAULT 'pendente'
    CHECK (stato IN ('pendente', 'espanso', 'scartato', 'scaduto')),
  expanded_at timestamptz,
  UNIQUE (id, destinatario_id),
  CHECK (mittente_id <> destinatario_id),
  CONSTRAINT push_eventi_sorgente CHECK (
    (tipo = 'messaggio_privato' AND messaggio_id IS NOT NULL AND collegamento_id IS NULL)
    OR (tipo = 'richiesta_collegamento' AND collegamento_id IS NOT NULL AND messaggio_id IS NULL)
  ),
  CONSTRAINT push_eventi_date CHECK (
    isfinite(created_at) AND isfinite(expires_at)
    AND created_at >= TIMESTAMPTZ '1970-01-01 00:00:00+00'
    AND expires_at > created_at
    AND (expanded_at IS NULL OR
      (isfinite(expanded_at) AND expanded_at >= created_at AND expanded_at < expires_at))
  ),
  CONSTRAINT push_eventi_espansione CHECK (
    (stato = 'espanso' AND expanded_at IS NOT NULL)
    OR (stato <> 'espanso' AND expanded_at IS NULL)
  )
);
CREATE INDEX push_eventi_pendenti_idx ON public.push_eventi (created_at, id) WHERE stato = 'pendente';
CREATE INDEX push_eventi_scadenza_idx ON public.push_eventi (expires_at);
CREATE INDEX push_eventi_mittente_idx ON public.push_eventi (mittente_id);
CREATE INDEX push_eventi_destinatario_idx ON public.push_eventi (destinatario_id);

CREATE TABLE public.push_consegne (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL,
  destinatario_id uuid NOT NULL,
  dispositivo_id uuid NOT NULL REFERENCES public.push_dispositivi(id) ON DELETE CASCADE,
  FOREIGN KEY (evento_id, destinatario_id)
    REFERENCES public.push_eventi(id, destinatario_id) ON DELETE CASCADE,
  -- Snapshot: NON FK alla versione/proprietario corrente e NON aggiornamento CASCADE.
  binding_version bigint NOT NULL CHECK (binding_version BETWEEN 1 AND 9007199254740991),
  stato text NOT NULL DEFAULT 'pendente' CHECK (stato IN (
    'pendente', 'in_elaborazione', 'retry', 'esito_incerto',
    'ticket_accettato', 'ricevuta_ok', 'fallita', 'annullata', 'scaduta'
  )),
  tentativi integer NOT NULL DEFAULT 0 CHECK (tentativi BETWEEN 0 AND 10),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claim_id uuid,
  lease_until timestamptz,
  expo_ticket_id text UNIQUE CHECK (char_length(expo_ticket_id) BETWEEN 1 AND 512),
  receipt_due_at timestamptz,
  ricevuta_stato text CHECK (ricevuta_stato IN ('ok', 'error')),
  ultimo_codice_errore text CHECK (ultimo_codice_errore IN (
    'transitorio', 'rate_limit', 'token_non_valido', 'credenziali_non_valide',
    'permanente', 'esito_incerto', 'non_autorizzata', 'scaduta'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  receipt_checked_at timestamptz,
  finished_at timestamptz,
  UNIQUE (evento_id, dispositivo_id),
  CONSTRAINT push_consegne_date CHECK (
    isfinite(created_at) AND isfinite(next_attempt_at)
    AND created_at >= TIMESTAMPTZ '1970-01-01 00:00:00+00'
    AND next_attempt_at >= created_at
    AND (lease_until IS NULL OR (isfinite(lease_until) AND lease_until > created_at))
    AND (submitted_at IS NULL OR (isfinite(submitted_at) AND submitted_at >= created_at))
    AND (receipt_due_at IS NULL OR (isfinite(receipt_due_at) AND receipt_due_at >= created_at))
    AND (receipt_checked_at IS NULL OR (isfinite(receipt_checked_at) AND receipt_checked_at >= created_at))
    AND (finished_at IS NULL OR (isfinite(finished_at) AND finished_at >= created_at))
    AND (finished_at IS NULL OR receipt_checked_at IS NULL
      OR finished_at >= receipt_checked_at)
    AND (finished_at IS NULL OR submitted_at IS NULL
      OR finished_at >= submitted_at)
  ),
  CONSTRAINT push_consegne_lease CHECK (
    (stato = 'in_elaborazione' AND claim_id IS NOT NULL AND lease_until IS NOT NULL)
    OR (stato <> 'in_elaborazione' AND claim_id IS NULL AND lease_until IS NULL)
  ),
  CONSTRAINT push_consegne_tentativi CHECK (
    (stato = 'pendente' AND tentativi = 0)
    OR (stato IN ('in_elaborazione', 'retry', 'esito_incerto', 'ticket_accettato', 'ricevuta_ok') AND tentativi > 0)
    OR stato IN ('fallita', 'annullata', 'scaduta')
  ),
  CONSTRAINT push_consegne_terminale CHECK (
    (stato IN ('ricevuta_ok', 'fallita', 'annullata', 'scaduta') AND finished_at IS NOT NULL)
    OR (stato NOT IN ('ricevuta_ok', 'fallita', 'annullata', 'scaduta') AND finished_at IS NULL)
  ),
  CONSTRAINT push_consegne_ticket CHECK (
    (expo_ticket_id IS NULL AND submitted_at IS NULL AND receipt_due_at IS NULL)
    OR (expo_ticket_id IS NOT NULL AND submitted_at IS NOT NULL
      AND receipt_due_at IS NOT NULL AND receipt_due_at >= submitted_at)
  ),
  CONSTRAINT push_consegne_ricevuta CHECK (
    (ricevuta_stato IS NULL AND receipt_checked_at IS NULL)
    OR (ricevuta_stato IS NOT NULL AND receipt_checked_at IS NOT NULL
      AND expo_ticket_id IS NOT NULL AND submitted_at IS NOT NULL
      AND receipt_checked_at >= submitted_at)
  ),
  CONSTRAINT push_consegne_esiti CHECK (
    (stato <> 'ticket_accettato' OR (expo_ticket_id IS NOT NULL AND ricevuta_stato IS NULL))
    AND (stato <> 'ricevuta_ok' OR
      (ricevuta_stato IS NOT DISTINCT FROM 'ok' AND expo_ticket_id IS NOT NULL
        AND submitted_at IS NOT NULL AND receipt_checked_at IS NOT NULL
        AND finished_at IS NOT NULL AND finished_at >= receipt_checked_at))
    AND (ricevuta_stato IS DISTINCT FROM 'ok' OR stato = 'ricevuta_ok')
    AND (ricevuta_stato IS DISTINCT FROM 'error' OR stato = 'fallita')
    AND (stato NOT IN ('pendente', 'in_elaborazione', 'retry', 'esito_incerto') OR expo_ticket_id IS NULL)
  )
);
CREATE INDEX push_consegne_lavori_idx ON public.push_consegne (next_attempt_at, id) WHERE stato IN ('pendente', 'retry');
CREATE INDEX push_consegne_lease_idx ON public.push_consegne (lease_until) WHERE stato = 'in_elaborazione';
CREATE INDEX push_consegne_ricevute_idx ON public.push_consegne (receipt_due_at) WHERE stato = 'ticket_accettato';
CREATE INDEX push_consegne_dispositivo_idx ON public.push_consegne (dispositivo_id);
CREATE INDEX push_consegne_evento_destinatario_idx ON public.push_consegne (evento_id, destinatario_id);
CREATE INDEX push_consegne_destinatario_idx ON public.push_consegne (destinatario_id);

CREATE TABLE public.push_configurazione (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  send_enabled boolean NOT NULL DEFAULT false,
  modalita text NOT NULL DEFAULT 'disabled' CHECK (modalita IN ('disabled', 'test', 'production')),
  project_id uuid,
  ambiente text CHECK (ambiente IN ('development', 'production')),
  max_attempts integer NOT NULL DEFAULT 4 CHECK (max_attempts BETWEEN 1 AND 10),
  batch_size integer NOT NULL DEFAULT 50 CHECK (batch_size BETWEEN 1 AND 100),
  lease_seconds integer NOT NULL DEFAULT 60 CHECK (lease_seconds BETWEEN 10 AND 600),
  chat_ttl_seconds integer NOT NULL DEFAULT 3600 CHECK (chat_ttl_seconds BETWEEN 60 AND 86400),
  collegamenti_ttl_seconds integer NOT NULL DEFAULT 86400 CHECK (collegamenti_ttl_seconds BETWEEN 60 AND 604800),
  max_per_destinatario_minuto integer NOT NULL DEFAULT 10 CHECK (max_per_destinatario_minuto BETWEEN 1 AND 100),
  max_per_mittente_minuto integer NOT NULL DEFAULT 20 CHECK (max_per_mittente_minuto BETWEEN 1 AND 200),
  retention_days integer NOT NULL DEFAULT 7 CHECK (retention_days BETWEEN 1 AND 30),
  updated_at timestamptz NOT NULL DEFAULT now() CHECK (isfinite(updated_at)),
  CHECK (
    (NOT send_enabled AND modalita = 'disabled')
    OR (send_enabled AND modalita IN ('test', 'production') AND project_id IS NOT NULL AND ambiente IS NOT NULL)
  )
);
INSERT INTO public.push_configurazione (id) VALUES (1);

CREATE TABLE public.push_dispositivi_test (
  dispositivo_id uuid PRIMARY KEY REFERENCES public.push_dispositivi(id) ON DELETE CASCADE,
  binding_version bigint NOT NULL CHECK (binding_version BETWEEN 1 AND 9007199254740991),
  autorizzato_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CHECK (isfinite(autorizzato_at) AND isfinite(expires_at) AND expires_at > autorizzato_at)
);

-- Normalizza anche concessioni DEFAULT a ruoli personalizzati sulle sole nuove
-- tabelle. Non altera DEFAULT PRIVILEGES ne' oggetti preesistenti.
DO $$
DECLARE
  nome text;
  r record;
BEGIN
  FOREACH nome IN ARRAY ARRAY[
    'push_dispositivi', 'push_preferenze', 'push_eventi',
    'push_consegne', 'push_configurazione', 'push_dispositivi_test'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', nome);
    FOR r IN
      SELECT DISTINCT grantee.rolname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      CROSS JOIN LATERAL aclexplode(c.relacl) a
      JOIN pg_roles grantee ON grantee.oid = a.grantee
      WHERE n.nspname = 'public' AND c.relname = nome
        AND a.grantee <> c.relowner
    LOOP
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I', nome, r.rolname);
    END LOOP;
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role', nome);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.push_dispositivi, public.push_preferenze,
  public.push_eventi, public.push_consegne TO service_role;
GRANT SELECT ON TABLE
  public.push_configurazione, public.push_dispositivi_test TO service_role;

-- BYPASSRLS non bypassa i privilegi ordinari: gli ACL sono verificati sotto.
-- Ownership e appartenenze sono controllate separatamente su tutte le nuove tabelle.
-- Fail-closed: ogni percorso di membership verso proprietari, SUPERUSER o
-- CREATEROLE viene rifiutato, anche se NOINHERIT o SET FALSE lo rende oggi
-- inutilizzabile. Non si presume che membership significhi SET ROLE consentito:
-- questa scelta conservativa evita dipendenze dalle opzioni/versioni PostgreSQL.
-- Prerequisiti esterni: runtime senza credenziali amministrative; revisione di
-- funzioni SECURITY DEFINER e di altri percorsi privilegiati accessibili.
-- Il controllo fotografa i cataloghi attuali, non impedisce futuri GRANT/membership
-- amministrativi e non dimostra sicurezza dei futuri endpoint applicativi.
DO $$
DECLARE
  nome text;
  ruolo text;
  runtime_oid oid;
  proprietario_oid oid;
BEGIN
  FOREACH ruolo IN ARRAY ARRAY['service_role', 'anon', 'authenticated'] LOOP
    SELECT oid INTO STRICT runtime_oid FROM pg_roles WHERE rolname = ruolo;
    FOREACH nome IN ARRAY ARRAY[
      'push_dispositivi', 'push_preferenze', 'push_eventi',
      'push_consegne', 'push_configurazione', 'push_dispositivi_test'
    ] LOOP
      SELECT c.relowner INTO STRICT proprietario_oid
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = nome AND c.relkind = 'r';
      IF EXISTS (
        WITH RECURSIVE appartenenze(oid) AS (
          SELECT runtime_oid
          UNION
          SELECT m.roleid FROM pg_auth_members m
          JOIN appartenenze a ON m.member = a.oid
        )
        SELECT 1 FROM appartenenze a JOIN pg_roles r ON r.oid = a.oid
        WHERE a.oid = proprietario_oid OR r.rolsuper OR r.rolcreaterole
      ) THEN
        RAISE EXCEPTION 'Ownership o appartenenza privilegiata: % su %', ruolo, nome;
      END IF;
    END LOOP;
  END LOOP;
  FOREACH nome IN ARRAY ARRAY['push_configurazione', 'push_dispositivi_test'] LOOP
    IF has_table_privilege('service_role', 'public.' || nome, 'INSERT')
      OR has_table_privilege('service_role', 'public.' || nome, 'UPDATE')
      OR has_table_privilege('service_role', 'public.' || nome, 'DELETE')
      OR has_table_privilege('service_role', 'public.' || nome, 'TRUNCATE') THEN
      RAISE EXCEPTION 'Privilegi runtime eccessivi su %', nome;
    END IF;
  END LOOP;
  FOREACH nome IN ARRAY ARRAY[
    'push_dispositivi', 'push_preferenze', 'push_eventi',
    'push_consegne', 'push_configurazione', 'push_dispositivi_test'
  ] LOOP
    FOREACH ruolo IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF has_table_privilege(ruolo, 'public.' || nome, 'SELECT')
        OR has_table_privilege(ruolo, 'public.' || nome, 'INSERT')
        OR has_table_privilege(ruolo, 'public.' || nome, 'UPDATE')
        OR has_table_privilege(ruolo, 'public.' || nome, 'DELETE')
        OR has_table_privilege(ruolo, 'public.' || nome, 'TRUNCATE') THEN
        RAISE EXCEPTION 'Privilegi client inattesi: % su %', ruolo, nome;
      END IF;
    END LOOP;
  END LOOP;
END $$;
COMMIT;
