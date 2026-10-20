import type { DocumentoEstratto, RigaDocumento } from './documenti';
import { normalizzaData, normalizzaOra } from './documenti';
import { interpretaDocumento } from './interpretazione';
import type { DatiVoce, Dipendente } from './modello';
import { datiEffettivi } from './modello';

export interface Regione { pagina: number; x: number; y: number; larghezza: number; altezza: number }
export interface Contesto { mese: string; anno: string; dipendente: Dipendente; confermato: boolean; candidatoId?: string }
export interface RigaAnteprima extends DatiVoce { id: string; giorno: string; sigla: string | null; verificata: boolean }
const esterni = /\b(whatsapp|rispondi|inoltra|forward|reply)\b/i;
const intervallo = /(\d{1,2}(?:[:.]\d{2})?)\s*[-–—/]\s*(\d{1,2}(?:[:.]\d{2})?)/g;
const ora = (s: string) => normalizzaOra(/^\d{1,2}$/.test(s) ? `${s}:00` : s).valore;
export function dataGiorno(giorno: string, contesto: Contesto): string | null {
  if (!contesto.confermato || !/^\d{4}$/.test(contesto.anno) || !/^\d{1,2}$/.test(contesto.mese)) return null;
  return normalizzaData(`${contesto.anno}-${contesto.mese.padStart(2, '0')}-${giorno.padStart(2, '0')}`).valore;
}
export function regioneValida(r: Regione): boolean {
  return Number.isInteger(r.pagina) && r.pagina > 0 && [r.x, r.y, r.larghezza, r.altezza].every(Number.isFinite) &&
    r.x >= 0 && r.y >= 0 && r.larghezza > 0 && r.altezza > 0 && r.x + r.larghezza <= 1.000001 && r.y + r.altezza <= 1.000001;
}
/** Regione sulle evidenze, prima del raggruppamento: nessuna eliminazione dell'originale. */
export function nellaRegione(box: readonly number[] | null, pagina: number, regione?: Regione): boolean {
  if (!regione) return true;
  if (!regioneValida(regione) || pagina !== regione.pagina || !box) return false;
  const cx = box[0] + box[2] / 2, cy = box[1] + box[3] / 2;
  return cx >= regione.x && cx <= regione.x + regione.larghezza && cy >= regione.y && cy <= regione.y + regione.altezza;
}
function testo(r: RigaDocumento): string { return r.celle?.map(c => c.testo ?? '').join(' ') || r.testo || ''; }
/** Riconoscimento senza intestazione: richiede almeno due righe di giorni coerenti.
 * La barra è un intervallo soltanto DOPO un giorno/data ancorato a inizio riga. */
export function leggiProspetto(doc: DocumentoEstratto, contesto: Contesto): RigaAnteprima[] {
  const esito = interpretaDocumento(doc, { ordineDate: 'DMY', dipendenteId: contesto.candidatoId });
  // Per le tabelle con identità non mescolare persone in assenza di scelta.
  if (esito.selezioneRichiesta) return [];
  if (esito.bozza?.voci.some(v => v.rilevati.data.valore && v.rilevati.tipo.valore)) {
    return esito.bozza.voci.filter(v => v.rilevati.data.valore && v.rilevati.tipo.valore).map(v => {
      const d = datiEffettivi(v);
      return { ...d, id: v.id, giorno: d.data!.slice(8), sigla: d.causale?.codice ?? null, verificata: false };
    });
  }
  const risultato: RigaAnteprima[] = [];
  for (const p of doc.pagine) {
    const candidate: { id: string; giorno: string; data: string | null; contenuto: string; x: number | null }[] = [];
    for (const r of p.righe ?? []) {
      const s = testo(r).trim();
      if (esterni.test(s)) continue;
      const m = /^(\d{4}-\d{2}-\d{2}|\d{1,2}[/.]\d{1,2}[/.]\d{4}|\d{1,2}[/.]\d{1,2}|\d{1,2})\s+(.*)$/.exec(s);
      if (!m) continue;
      const completa = normalizzaData(m[1], 'DMY').valore;
      const parziale = /^(\d{1,2})[/.](\d{1,2})$/.exec(m[1]);
      const giorno = completa ? completa.slice(8) : parziale ? parziale[1] : m[1];
      if (+giorno < 1 || +giorno > 31) continue;
      let data = completa ?? dataGiorno(giorno, contesto);
      if (parziale && (!contesto.confermato || +parziale[2] !== +contesto.mese)) data = null;
      const contenuto = m[2].trim();
      if (!/^(?:\d{1,2}(?:[:.]\d{2})?\s*[-–—/]\s*\d{1,2}|[A-Z]{1,5}\b|riposo\b|ferie\b|permesso\b|malattia\b)/i.test(contenuto)) continue;
      candidate.push({ id: `${p.id}/${r.id}`, giorno, data, contenuto, x: r.celle?.[0]?.rettangolo?.x ?? null });
    }
    // Richiede una colonna di giorni, evitando numeri sparsi in email/cornici.
    const coerenti = candidate.filter(c => candidate.some(a => a !== c && +a.giorno !== +c.giorno &&
      (a.x === null || c.x === null || Math.abs(a.x - c.x) < .035)));
    if (coerenti.length < 2) continue;
    for (const c of coerenti) {
      const matches = [...c.contenuto.matchAll(intervallo)];
      if (matches.length) {
        const residuo = c.contenuto.replace(intervallo, '').replace(/[+;,|]/g, ' ').trim();
        for (const [i, m] of matches.entries()) {
          const inizio = ora(m[1]), fine = ora(m[2]);
          if (!inizio || !fine) continue;
          const dataFine = c.data && fine > inizio ? c.data : null;
          risultato.push({ id: `${c.id}/${i}`, giorno: c.giorno, data: c.data, tipo: 'turno', inizio, fine,
            dataFine, postazione: residuo || null, causale: null, sigla: null, verificata: false });
        }
      } else {
        const riposo = /^riposo(?: settimanale)?$/i.test(c.contenuto);
        risultato.push({ id: c.id, giorno: c.giorno, data: c.data, tipo: riposo ? 'riposo' : null,
          inizio: null, fine: null, dataFine: null, postazione: null, causale: null,
          sigla: riposo ? null : c.contenuto, verificata: false });
      }
    }
  }
  return risultato;
}
