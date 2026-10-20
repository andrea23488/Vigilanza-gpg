import type { TipoSorgente } from './modello';

/** Tutti i metadati opzionali restano null quando l'estrattore non li conosce. */
export interface RettangoloDocumento {
  x: number; y: number; larghezza: number; altezza: number;
  unita: 'pixel' | 'normalizzata';
}
export interface EvidenzaDocumento {
  testo: string | null;
  confidenza: number | null;
  rettangolo: RettangoloDocumento | null;
}
export interface CellaDocumento extends EvidenzaDocumento { id: string }
export interface RigaDocumento extends EvidenzaDocumento {
  id: string;
  /** Ordine di lettura fornito dall'estrattore; non ricostruito dalle coordinate. */
  celle: readonly CellaDocumento[] | null;
}
export interface PaginaDocumento {
  id: string;
  numero: number | null;
  larghezza: number | null;
  altezza: number | null;
  /** Rotazione oraria delle coordinate originali rispetto alla pagina leggibile. */
  rotazione: 0 | 90 | 180 | 270 | null;
  testo: string | null;
  righe: readonly RigaDocumento[] | null;
  errore: string | null;
}
export interface DocumentoEstratto {
  id: string;
  tipo: TipoSorgente;
  testoOriginale: string | null;
  /** Pagine effettivamente ricevute: nessuna pagina viene generata. */
  pagine: readonly PaginaDocumento[];
  pagineAttese: number | null;
}
export interface SegnalazioneDocumento {
  codice: string;
  paginaId: string | null;
  rigaId: string | null;
  campo: string | null;
}
export interface Normalizzato {
  originale: string | null;
  valore: string | null;
  alternative: readonly string[];
  problema: string | null;
}

function risultato(originale: string | null, valore: string | null, alternative: string[] = [], problema: string | null = null): Normalizzato {
  return { originale, valore, alternative, problema };
}
function iso(anno: number, mese: number, giorno: number): string | null {
  if (anno < 1000 || anno > 9999 || mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return null;
  const s = `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
  const t = Date.parse(`${s}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s ? s : null;
}
/** Senza ordine dichiarato 03/04 è ambiguo; nessun anno viene aggiunto. */
export function normalizzaData(originale: string | null, ordine: 'DMY' | 'MDY' | null = null): Normalizzato {
  const s = originale?.trim() ?? '';
  if (!s) return risultato(originale, null, [], 'data_mancante');
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (a) {
    const v = iso(+a[1], +a[2], +a[3]);
    return risultato(originale, v, [], v ? null : 'data_invalida');
  }
  const p = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(s);
  if (!p) return risultato(originale, null, [], 'data_incompleta_o_non_supportata');
  const dmy = iso(+p[3], +p[2], +p[1]), mdy = iso(+p[3], +p[1], +p[2]);
  if (ordine) {
    const v = ordine === 'DMY' ? dmy : mdy;
    return risultato(originale, v, [], v ? null : 'data_invalida');
  }
  const opzioni = [...new Set([dmy, mdy].filter((v): v is string => v !== null))];
  return opzioni.length === 1 ? risultato(originale, opzioni[0]) :
    risultato(originale, null, opzioni, opzioni.length ? 'data_ambigua' : 'data_invalida');
}
export function normalizzaOra(originale: string | null): Normalizzato {
  const s = originale?.trim() ?? '';
  if (!s) return risultato(originale, null, [], 'ora_mancante');
  const p = /^(\d{1,2})[:.](\d{2})$/.exec(s);
  if (!p || +p[1] > 23 || +p[2] > 59) return risultato(originale, null, [], 'ora_ambigua_o_invalida');
  return risultato(originale, `${p[1].padStart(2, '0')}:${p[2]}`);
}
/** Restituisce null se geometria o orientamento non sono verificabili. */
export function normalizzaRettangolo(e: EvidenzaDocumento, p: PaginaDocumento): readonly [number, number, number, number] | null {
  const r = e.rettangolo;
  if (!r || p.rotazione === null) return null;
  if (![r.x, r.y, r.larghezza, r.altezza].every(Number.isFinite)) return null;
  if (r.unita !== 'pixel' && r.unita !== 'normalizzata') return null;
  if (r.unita === 'pixel' && (!(p.larghezza! > 0) || !(p.altezza! > 0))) return null;
  const w = r.unita === 'pixel' ? p.larghezza! : 1, h = r.unita === 'pixel' ? p.altezza! : 1;
  const x = r.x / w, y = r.y / h, a = r.larghezza / w, b = r.altezza / h;
  if (x < 0 || y < 0 || a <= 0 || b <= 0 || x + a > 1 + 1e-9 || y + b > 1 + 1e-9) return null;
  switch (p.rotazione) {
    case 0: return [x, y, a, b];
    case 90: return [y, 1 - x - a, b, a];
    case 180: return [1 - x - a, 1 - y - b, a, b];
    case 270: return [1 - y - b, x, b, a];
    default: return null;
  }
}
