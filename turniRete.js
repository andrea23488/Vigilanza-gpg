export const TIMEOUT_TURNI_MS = 15000;

export class ErroreTurniRemoto extends Error {
  constructor(messaggio, { codice, operazione, status, dettagli, causa } = {}) {
    super(messaggio);
    this.name = 'ErroreTurniRemoto';
    this.codice = codice || 'SCONOSCIUTO';
    this.operazione = operazione || null;
    this.status = status || null;
    this.dettagli = dettagli || null;
    this.cause = causa;
  }
}

export async function eseguiRichiestaTurni({
  url,
  opzioni = {},
  operazione,
  timeoutMs = TIMEOUT_TURNI_MS,
  fetchFn = fetch,
}) {
  const controller = new AbortController();
  let timer;
  let scaduta = false;

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      scaduta = true;
      controller.abort();
      reject(
        new ErroreTurniRemoto(
          `Tempo scaduto durante ${operazione}. Riprova quando la connessione è stabile.`,
          { codice: 'TIMEOUT', operazione }
        )
      );
    }, timeoutMs);
  });

  try {
    const richiesta = (async () => {
      const response = await fetchFn(url, {
        ...opzioni,
        signal: controller.signal,
      });
      const testo = await response.text();
      return { response, testo };
    })();

    return await Promise.race([richiesta, timeout]);
  } catch (error) {
    if (error instanceof ErroreTurniRemoto) throw error;
    if (scaduta || error?.name === 'AbortError') {
      throw new ErroreTurniRemoto(
        `Tempo scaduto durante ${operazione}. Riprova quando la connessione è stabile.`,
        { codice: 'TIMEOUT', operazione, causa: error }
      );
    }

    throw new ErroreTurniRemoto(
      `Errore di rete durante ${operazione}. Controlla la connessione e riprova.`,
      { codice: 'RETE', operazione, causa: error }
    );
  } finally {
    clearTimeout(timer);
  }
}

export function creaErroreBackendTurni({ operazione, status, dettagli }) {
  const dettaglio = String(dettagli || '').trim();
  return new ErroreTurniRemoto(
    `Il database ha rifiutato ${operazione} (HTTP ${status}).${
      dettaglio ? ` Dettagli: ${dettaglio}` : ''
    }`,
    {
      codice: 'BACKEND',
      operazione,
      status,
      dettagli: dettaglio || null,
    }
  );
}

export function messaggioErroreTurni(error, fallback) {
  if (error?.codice === 'TIMEOUT' || error?.codice === 'RETE') {
    return error.message;
  }
  if (error?.codice === 'BACKEND') {
    return 'Il database non ha accettato l’operazione. Controlla i dati e riprova; se il problema continua, segnala l’errore tecnico mostrato nei log.';
  }
  return error?.message || fallback;
}
