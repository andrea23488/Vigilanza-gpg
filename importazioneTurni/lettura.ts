import type { DocumentoAcquisito } from './acquisizione';
import { LIMITE_DOCUMENTO_BYTES } from './acquisizione';
import type { DocumentoEstratto, PaginaDocumento, RigaDocumento } from './documenti';

export const MAX_PAGINE = 30;
export const MAX_TESTO = 500_000;
export const MAX_RIGHE = 5_000;
export interface PorteLettura {
  /** Controlla nuovamente dimensione e contenuto del file locale acquisito. */
  impronta(documento: DocumentoAcquisito): Promise<string>;
  pdfDisponibile(): Promise<boolean>;
  immaginiDisponibili(): Promise<boolean>;
  numeroPagine(uri: string): Promise<number>;
  testoPagina(uri: string, numero: number): Promise<string>;
  /** Frammenti OCR, senza una promessa di ordine tabellare o coordinate. */
  testoImmagine(uri: string): Promise<readonly string[]>;
}
export interface DocumentoLetto {
  impronta: string;
  documento: DocumentoEstratto;
  avvisi: readonly string[];
}
export type EsitoLettura = { stato: 'letto'; risultato: DocumentoLetto } |
  { stato: 'bloccato'; codice: string };

function congela<T>(v: T): T {
  if (v && typeof v === 'object') { Object.values(v).forEach(congela); Object.freeze(v); }
  return v;
}
/** Solo separatori espliciti. Gli spazi dell'OCR non provano l'esistenza di colonne. */
export function righeDaTesto(testo: string, prefisso = 'r'): RigaDocumento[] {
  const righe = testo.split(/\r\n|\n|\r/);
  if (righe.length > MAX_RIGHE) throw new Error('LIMITE_RIGHE');
  return righe.map((originale, i) => {
    const delimitatori = ['\t', '|', ';'].filter(s => originale.includes(s));
    const separatore = delimitatori.length === 1 ? delimitatori[0] : null;
    return { id: `${prefisso}-${i + 1}`, testo: originale, confidenza: null, rettangolo: null,
      celle: separatore ? originale.split(separatore).map((t, c) => ({ id: `c-${c + 1}`,
        testo: t.trim() || null, confidenza: null, rettangolo: null })) : delimitatori.length > 1 ? [] : null };
  });
}
/** Decodifica reale delegata a moduli locali; nessuna porta per rete o salvataggio. */
export function creaLettoreDocumenti(porte: PorteLettura) {
  let occupato = false;
  return {
    async leggi(d: DocumentoAcquisito): Promise<EsitoLettura> {
      if (occupato) return { stato: 'bloccato', codice: 'LETTURA_OCCUPATA' };
      occupato = true;
      try {
        if (!Number.isSafeInteger(d.dimensioneBytes) || d.dimensioneBytes <= 0 || d.dimensioneBytes > LIMITE_DOCUMENTO_BYTES) {
          return { stato: 'bloccato', codice: 'DIMENSIONE_NON_VALIDA' };
        }
        const disponibile = d.formato === 'pdf' ? await porte.pdfDisponibile() : await porte.immaginiDisponibili();
        if (!disponibile) return { stato: 'bloccato', codice: 'DECODER_LOCALE_NON_DISPONIBILE' };
        const impronta = await porte.impronta(d);
        if (!/^md5:[a-f0-9]{32}:\d+$/.test(impronta)) return { stato: 'bloccato', codice: 'IMPRONTA_NON_VERIFICABILE' };
        const pagine: PaginaDocumento[] = [], avvisi = new Set<string>();
        let caratteri = 0, numeroRighe = 0;
        const aggiungi = (numero: number, testo: string | null, errore: string | null, righe?: RigaDocumento[]) => {
          caratteri += testo?.length ?? 0;
          if (caratteri > MAX_TESTO) throw new Error('LIMITE_TESTO');
          const estratte = righe ?? (testo === null ? null : righeDaTesto(testo));
          numeroRighe += estratte?.length ?? 0;
          if (numeroRighe > MAX_RIGHE) throw new Error('LIMITE_RIGHE');
          pagine.push({ id: `p-${numero}`, numero, larghezza: null, altezza: null, rotazione: null,
            testo, righe: estratte, errore });
        };
        let pagineAttese: number;
        if (d.formato === 'pdf') {
          pagineAttese = await porte.numeroPagine(d.uriLocale);
          if (!Number.isInteger(pagineAttese) || pagineAttese < 1 || pagineAttese > MAX_PAGINE) {
            return { stato: 'bloccato', codice: 'LIMITE_O_NUMERO_PAGINE_NON_VALIDO' };
          }
          for (let n = 1; n <= pagineAttese; n++) {
            let testo: string;
            try { testo = await porte.testoPagina(d.uriLocale, n); }
            catch { aggiungi(n, null, 'ESTRAZIONE_PAGINA_FALLITA'); avvisi.add('PAGINE_NON_LETTE'); continue; }
            if (typeof testo !== 'string') throw new Error('RISPOSTA_DECODER_NON_VALIDA');
            aggiungi(n, testo, testo.trim() ? null : 'PAGINA_SENZA_TESTO_O_SCANSIONE');
            if (!testo.trim()) avvisi.add('OCR_PDF_SCANNERIZZATO_NON_DISPONIBILE');
          }
        } else {
          const frammenti = await porte.testoImmagine(d.uriLocale);
          if (!Array.isArray(frammenti) || frammenti.length > 10_000 || frammenti.some(f => typeof f !== 'string')) throw new Error('RISPOSTA_DECODER_NON_VALIDA');
          pagineAttese = 1;
          // Non si concatenano blocchi fingendo che siano righe/celle della tabella.
          const righe = frammenti.flatMap((f, i) => righeDaTesto(f, `blocco-${i + 1}-r`));
          aggiungi(1, null, null, righe);
          avvisi.add('OCR_SENZA_GEOMETRIA_ORDINE_DA_VERIFICARE');
          avvisi.add('TESTO_GLOBALE_NON_DISPONIBILE');
          if (frammenti.reduce((s, f) => s + f.length, 0) > MAX_TESTO) throw new Error('LIMITE_TESTO');
        }
        if (await porte.impronta(d) !== impronta) return { stato: 'bloccato', codice: 'DOCUMENTO_CAMBIATO' };
        return { stato: 'letto', risultato: congela({ impronta, avvisi: [...avvisi], documento: {
          id: impronta, tipo: d.tipoSorgente, testoOriginale: null, pagineAttese, pagine,
        } }) };
      } catch (e) {
        const codice = e && typeof e === 'object' && 'code' in e ? String(e.code) : '';
        return { stato: 'bloccato', codice: ['PASSWORD_REQUIRED', 'INCORRECT_PASSWORD'].includes(codice)
          ? 'PDF_PROTETTO' : e instanceof Error && ['LIMITE_TESTO', 'LIMITE_RIGHE'].includes(e.message) ? e.message : 'LETTURA_FALLITA' };
      } finally { occupato = false; }
    },
  };
}
