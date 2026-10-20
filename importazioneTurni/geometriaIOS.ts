import type { CellaDocumento, PaginaDocumento, RigaDocumento } from './documenti';
import { normalizzaData } from './documenti';
import { righeDaTesto } from './lettura';

export interface ElementoIOS {
  id: string;
  testo: string;
  rettangolo: readonly [number, number, number, number] | null;
  confidenza: number | null;
  gruppo: string | null;
}
export interface PaginaIOS {
  numero: number;
  larghezza: number | null;
  altezza: number | null;
  testo: string | null;
  elementi: readonly ElementoIOS[];
  righeOriginali: readonly { id: string; testo: string; confidenza: number | null; rettangolo: ElementoIOS['rettangolo'] }[];
  errore: string | null;
}
export interface EstrazioneIOS {
  versione: 1;
  metodo: 'pdfkit' | 'vision';
  pagineAttese: number;
  pagine: readonly PaginaIOS[];
}
type Token = ElementoIOS & { rettangolo: readonly [number, number, number, number] };
const pulisci = (s: string) => s.trim().toLocaleLowerCase('it-IT').replace(/\s+/g, ' ');
const identita = new Set(['nome', 'cognome', 'dipendente', 'matricola', 'badge']);
const data = new Set(['data', 'giorno', 'date']);
const orario = new Set(['inizio', 'entrata', 'dalle', 'fine', 'uscita', 'alle', 'servizio', 'turno', 'orario', 'causale', 'assenza']);
function rettangolo(ts: readonly Token[]): Token['rettangolo'] {
  const x = Math.min(...ts.map(t => t.rettangolo[0])), y = Math.min(...ts.map(t => t.rettangolo[1]));
  return [x, y, Math.max(...ts.map(t => t.rettangolo[0] + t.rettangolo[2])) - x,
    Math.max(...ts.map(t => t.rettangolo[1] + t.rettangolo[3])) - y];
}
function cella(ts: readonly Token[], idVuoto: string): CellaDocumento {
  const box = ts.length ? rettangolo(ts) : null;
  return { id: ts.length ? ts.map(t => t.id).join('+') : idVuoto,
    testo: ts.length ? ts.map(t => t.testo).join(' ') : null,
    // Ricostruzione geometrica: nessun punteggio di certezza inventato.
    confidenza: null, rettangolo: box ? { x: box[0], y: box[1], larghezza: box[2], altezza: box[3], unita: 'normalizzata' } : null };
}
function header(tokens: readonly Token[]) {
  const colonne: { testo: string; tokens: Token[]; x: number }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (pulisci(t.testo) === 'data' && pulisci(tokens[i + 1]?.testo ?? '') === 'fine' &&
      tokens[i + 1].rettangolo[0] - t.rettangolo[0] - t.rettangolo[2] < 0.015) {
      colonne.push({ testo: 'data fine', tokens: [t, tokens[++i]], x: t.rettangolo[0] });
    } else colonne.push({ testo: pulisci(t.testo), tokens: [t], x: t.rettangolo[0] });
  }
  const haDate = colonne.some(c => normalizzaData(c.testo).valore || normalizzaData(c.testo).alternative.length);
  const plausibile = (colonne.some(c => data.has(c.testo)) && colonne.some(c => orario.has(c.testo))) ||
    (colonne.some(c => identita.has(c.testo)) && haDate);
  if (!plausibile) return null;
  // Colonne aggiuntive restano nella griglia: l'interprete segnala quelle senza ruolo.
  // Non rifiutare l'intera tabella per una colonna Note o un titolo aziendale.
  return colonne;
}

/** Strutturazione prudente: righe allineate e colonne ancorate alle intestazioni effettive.
 * I token nativi completi vengono conservati dal lettore, anche se non assegnabili. */
export function strutturaPaginaIOS(p: PaginaIOS): { pagina: PaginaDocumento; avvisi: string[] } {
  const avvisi = new Set<string>();
  const base = { id: `p-${p.numero}`, numero: p.numero, larghezza: p.larghezza, altezza: p.altezza,
    rotazione: 0 as const, testo: p.testo, errore: p.errore };
  const manuale = () => p.testo !== null ? righeDaTesto(p.testo) : p.righeOriginali.map(r => ({
    id: r.id, testo: r.testo, confidenza: r.confidenza, rettangolo: null, celle: null,
  }));
  if (!p.elementi.length || p.elementi.some(t => !t.rettangolo)) {
    avvisi.add('GEOMETRIA_INCOMPLETA_MAPPATURA_MANUALE');
    return { pagina: { ...base, righe: manuale() }, avvisi: [...avvisi] };
  }
  const tokens = [...p.elementi] as Token[];
  tokens.sort((a, b) => a.rettangolo[1] + a.rettangolo[3] / 2 - b.rettangolo[1] - b.rettangolo[3] / 2 || a.rettangolo[0] - b.rettangolo[0]);
  const gruppi: Token[][] = [];
  for (const t of tokens) {
    const cy = t.rettangolo[1] + t.rettangolo[3] / 2;
    const candidati = gruppi.filter(g => {
      const primo = g[0];
      return Math.abs(cy - primo.rettangolo[1] - primo.rettangolo[3] / 2) <= Math.min(primo.rettangolo[3], t.rettangolo[3]) * 0.6;
    });
    if (candidati.length === 1) candidati[0].push(t);
    else { gruppi.push([t]); if (candidati.length > 1) avvisi.add('ALLINEAMENTO_RIGHE_AMBIGUO'); }
  }
  let colonne: ReturnType<typeof header> = null;
  const righe: RigaDocumento[] = [];
  for (const [i, gruppo] of gruppi.entries()) {
    gruppo.sort((a, b) => a.rettangolo[0] - b.rettangolo[0]);
    const h = header(gruppo);
    const id = `geometria-r-${i + 1}`;
    // Righe ricostruite non vengono spacciate per testo originale globale/di riga.
    let celle: CellaDocumento[];
    if (h) {
      colonne = h;
      celle = h.map((c, n) => cella(c.tokens, `vuota-${n}`));
    } else if (colonne) {
      const assegnati: Token[][] = colonne.map(() => []);
      let ambiguo = false;
      for (const t of gruppo) {
        let indice = -1;
        for (let c = 0; c < colonne.length; c++) if (t.rettangolo[0] >= colonne[c].x - 0.012) indice = c;
        const successiva = colonne[indice + 1];
        if (indice < 0 || (successiva && t.rettangolo[0] + t.rettangolo[2] > successiva.x - 0.004)) ambiguo = true;
        else assegnati[indice].push(t);
      }
      if (ambiguo) {
        // Il testo è visibile per mappatura, ma la riga non alimenta turni automatici.
        avvisi.add(`RIGA_GEOMETRICA_AMBIGUA:${id}`);
        celle = [];
      } else celle = assegnati.map((ts, n) => cella(ts, `vuota-${n}`));
    } else {
      avvisi.add('INTESTAZIONE_GEOMETRICA_NON_RICONOSCIUTA');
      celle = gruppo.map((t, n) => cella([t], `vuota-${n}`));
    }
    const gruppiSorgente = new Set(gruppo.map(t => t.gruppo).filter(Boolean));
    const originale = gruppiSorgente.size === 1 ? p.righeOriginali.find(r => r.id === [...gruppiSorgente][0]) : null;
    righe.push({ id, testo: originale?.testo ?? null, confidenza: null, rettangolo: null, celle });
  }
  if (avvisi.has('ALLINEAMENTO_RIGHE_AMBIGUO') || [...avvisi].some(a => a.startsWith('RIGA_GEOMETRICA_AMBIGUA:'))) {
    // Non perdere righe scartate dalla geometria: ritorno al testo autentico completo della pagina.
    avvisi.add('PAGINA_DA_MAPPARE_MANUALMENTE');
    return { pagina: { ...base, righe: manuale() }, avvisi: [...avvisi] };
  }
  avvisi.add('STRUTTURA_GEOMETRICA_DA_VERIFICARE');
  return { pagina: { ...base, righe }, avvisi: [...avvisi] };
}
