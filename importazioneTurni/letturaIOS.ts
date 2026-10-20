import type { DocumentoAcquisito } from './acquisizione';
import { LIMITE_DOCUMENTO_BYTES } from './acquisizione';
import type { DocumentoLetto } from './lettura';
import { MAX_PAGINE, MAX_TESTO, MAX_RIGHE } from './lettura';
import { strutturaPaginaIOS } from './geometriaIOS';
import type { EstrazioneIOS } from './geometriaIOS';

export interface ModuloTurniIOS {
  versione: number;
  leggiPDF(uri: string): Promise<EstrazioneIOS>;
  leggiImmagine(uri: string): Promise<EstrazioneIOS>;
}
export interface PorteLetturaIOS {
  modulo(): ModuloTurniIOS | null;
  impronta(d: DocumentoAcquisito): Promise<string>;
}
export type EsitoLetturaIOS = { stato: 'letto'; risultato: DocumentoLetto & { evidenzeIOS: EstrazioneIOS } } |
  { stato: 'bloccato'; codice: string };
function congela<T>(v: T): T {
  if (v && typeof v === 'object') { Object.values(v).forEach(congela); Object.freeze(v); }
  return v;
}
/** Controllo runtime del contratto nativo, senza fidarsi delle sole dichiarazioni TS. */
export function verificaEstrazioneIOS(e: EstrazioneIOS): void {
  if (!e || e.versione !== 1 || !['pdfkit', 'vision'].includes(e.metodo) || !Array.isArray(e.pagine) ||
    !Number.isInteger(e.pagineAttese) || e.pagineAttese < 1 || e.pagineAttese > MAX_PAGINE || e.pagine.length !== e.pagineAttese) throw new Error('RISPOSTA_NATIVA_NON_VALIDA');
  let caratteri = 0, elementi = 0;
  const numeri = new Set<number>();
  const box = (r: readonly number[] | null) => r === null || (Array.isArray(r) && r.length === 4 && r.every(Number.isFinite) &&
    r[0] >= 0 && r[1] >= 0 && r[2] > 0 && r[3] > 0 && r[0] + r[2] <= 1 + 1e-7 && r[1] + r[3] <= 1 + 1e-7);
  const conf = (n: number | null) => n === null || (Number.isFinite(n) && n >= 0 && n <= 1);
  for (const p of e.pagine) {
    if (!Number.isInteger(p.numero) || p.numero < 1 || p.numero > e.pagineAttese || numeri.has(p.numero) ||
      ![p.larghezza, p.altezza].every(n => n === null || (Number.isFinite(n) && n > 0)) ||
      (p.testo !== null && typeof p.testo !== 'string') || (p.errore !== null && typeof p.errore !== 'string') ||
      !Array.isArray(p.elementi) || !Array.isArray(p.righeOriginali) || p.righeOriginali.length > MAX_RIGHE) throw new Error('RISPOSTA_NATIVA_NON_VALIDA');
    numeri.add(p.numero);
    const ids = new Set<string>(), righe = new Set<string>();
    for (const r of p.righeOriginali) {
      if (typeof r.id !== 'string' || !r.id || righe.has(r.id) || typeof r.testo !== 'string' || !box(r.rettangolo) || !conf(r.confidenza)) throw new Error('RISPOSTA_NATIVA_NON_VALIDA');
      righe.add(r.id); caratteri += r.testo.length;
    }
    for (const t of p.elementi) {
      if (typeof t.id !== 'string' || !t.id || ids.has(t.id) || typeof t.testo !== 'string' || !t.testo.trim() || !box(t.rettangolo) || !conf(t.confidenza) ||
        (t.gruppo !== null && !righe.has(t.gruppo))) throw new Error('RISPOSTA_NATIVA_NON_VALIDA');
      ids.add(t.id); caratteri += t.testo.length; elementi++;
    }
    caratteri += p.testo?.length ?? 0;
  }
  // Token e righe ripetono il testo della pagina: limite al payload oltre a quello nativo.
  if (caratteri > MAX_TESTO * 3 || elementi > 20_000) throw new Error('LIMITE_TESTO');
}
export function creaLettoreIOS(porte: PorteLetturaIOS) {
  let occupato = false;
  return { async leggi(d: DocumentoAcquisito): Promise<EsitoLetturaIOS> {
    if (occupato) return { stato: 'bloccato', codice: 'LETTURA_OCCUPATA' };
    occupato = true;
    try {
      const modulo = porte.modulo();
      if (!modulo || modulo.versione !== 1) return { stato: 'bloccato', codice: 'DECODER_LOCALE_NON_DISPONIBILE' };
      if (!Number.isSafeInteger(d.dimensioneBytes) || d.dimensioneBytes < 1 || d.dimensioneBytes > LIMITE_DOCUMENTO_BYTES ||
        !['pdf', 'jpeg', 'png'].includes(d.formato)) return { stato: 'bloccato', codice: 'DIMENSIONE_O_FORMATO_NON_VALIDO' };
      const impronta = await porte.impronta(d);
      if (!/^md5:[a-f0-9]{32}:\d+$/.test(impronta)) return { stato: 'bloccato', codice: 'IMPRONTA_NON_VERIFICABILE' };
      const raw = d.formato === 'pdf' ? await modulo.leggiPDF(d.uriLocale) : await modulo.leggiImmagine(d.uriLocale);
      verificaEstrazioneIOS(raw);
      if (raw.metodo !== (d.formato === 'pdf' ? 'pdfkit' : 'vision')) throw new Error('RISPOSTA_NATIVA_NON_VALIDA');
      if (await porte.impronta(d) !== impronta) return { stato: 'bloccato', codice: 'DOCUMENTO_CAMBIATO' };
      const strutturate = [...raw.pagine].sort((a, b) => a.numero - b.numero).map(strutturaPaginaIOS);
      if (strutturate.reduce((n, p) => n + (p.pagina.righe?.length ?? 0), 0) > MAX_RIGHE) throw new Error('LIMITE_RIGHE');
      const risultato = { impronta, documento: { id: impronta, tipo: d.tipoSorgente, testoOriginale: null,
        pagineAttese: raw.pagineAttese, pagine: strutturate.map(p => p.pagina) }, evidenzeIOS: raw,
        avvisi: [...new Set(strutturate.flatMap(p => p.avvisi))] };
      // Copia: la bozza non dipende da successive mutazioni del bridge.
      return { stato: 'letto', risultato: congela(JSON.parse(JSON.stringify(risultato))) };
    } catch (e) {
      const code = e && typeof e === 'object' && 'code' in e ? String(e.code) : '';
      const noti = ['PDF_PROTETTO', 'PDF_NON_VALIDO', 'LIMITE_PAGINE', 'LIMITE_TESTO', 'LIMITE_RIGHE', 'LIMITE_ELEMENTI', 'IMMAGINE_NON_VALIDA_O_TROPPO_GRANDE'];
      return { stato: 'bloccato', codice: noti.includes(code) ? code : e instanceof Error && noti.includes(e.message) ? e.message : 'LETTURA_FALLITA' };
    } finally { occupato = false; }
  } };
}
