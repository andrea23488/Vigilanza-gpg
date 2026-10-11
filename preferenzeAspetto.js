import AsyncStorage from '@react-native-async-storage/async-storage';
import { validaPreferenzaAspetto, normalizzaPreferenzaAspetto, ripristinaAspetto } from './temi';

export const CHIAVE_ASPETTO = '@vigilanza_aspetto_dispositivo_v1';

// Una sola istanza per dispositivo nel futuro provider. Storage iniettabile nei test.
// Ogni errore è restituito senza valori salvati o dati personali.
export function creaArchivioAspetto(storage = AsyncStorage) {
  let caricamento = null;
  let caricato = false;
  let coda = Promise.resolve();
  let corrente = ripristinaAspetto();
  function carica() {
    if (caricato) return coda.then(() => ({ ok: true, recuperata: false, preferenza: { ...corrente } }));
    if (!caricamento) {
      caricamento = (async () => {
        try {
          const raw = await storage.getItem(CHIAVE_ASPETTO);
          let p;
          try { p = raw == null ? ripristinaAspetto() : validaPreferenzaAspetto(JSON.parse(raw)); }
          catch { p = ripristinaAspetto(); corrente = p; caricato = true;
            return { ok: true, recuperata: true, preferenza: { ...p } }; }
          corrente = normalizzaPreferenzaAspetto(p);
          caricato = true;
          return { ok: true, recuperata: false, preferenza: { ...corrente } };
        } catch {
          // Un errore I/O non autorizza a sovrascrivere una preferenza sconosciuta.
          caricamento = null;
          return { ok: false, errore: 'lettura', preferenza: { ...corrente } };
        }
      })();
    }
    return caricamento;
  }
  function salva(input) {
    let p;
    try { p = validaPreferenzaAspetto(input); }
    catch { return Promise.resolve({ ok: false, errore: 'validazione' }); }
    if (!caricato) return Promise.resolve({ ok: false, errore: 'caricamento_non_completato' });
    const operazione = coda.then(async () => {
      try {
        await storage.setItem(CHIAVE_ASPETTO, JSON.stringify(p));
        corrente = p;
        return { ok: true, preferenza: { ...corrente } };
      } catch { return { ok: false, errore: 'scrittura', preferenza: { ...corrente } }; }
    });
    coda = operazione;
    return operazione;
  }
  return { carica, salva, ripristina: () => salva(ripristinaAspetto()) };
}
