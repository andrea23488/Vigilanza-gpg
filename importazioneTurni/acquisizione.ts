import type { TipoSorgente } from './modello';

export const LIMITE_DOCUMENTO_BYTES = 20 * 1024 * 1024;
export const BYTES_FIRMA = 16;
export type CanaleAcquisizione = 'documento' | 'galleria' | 'fotocamera';
export type FormatoDocumento = 'pdf' | 'jpeg' | 'png';
export interface OpzioniAcquisizione {
  canale: CanaleAcquisizione;
  /** Etichetta esplicita del chiamante, non ricavata dal nome del file. */
  tipoImmagine?: 'immagine' | 'screenshot';
}
export interface AssetSelezionato {
  uri: string | null;
  nome: string | null;
  mime: string | null;
  dimensioneDichiarata: number | null;
  larghezza: number | null;
  altezza: number | null;
}
export type RispostaSelettore = { stato: 'annullato' | 'permesso_negato' | 'non_supportato' | 'cache_non_disponibile' } |
  { stato: 'selezionato'; assets: readonly AssetSelezionato[] };
/** Solo capacità locali: nessuna porta per rete, calendario o persistenza. */
export interface PorteAcquisizione {
  seleziona(canale: CanaleAcquisizione): Promise<RispostaSelettore>;
  temporaneoDelSelettore(uri: string, canale: CanaleAcquisizione): boolean;
  informazioni(uri: string): Promise<{ esiste: boolean; directory: boolean; dimensione: number | null }>;
  leggiFirmaBase64(uri: string, bytes: number): Promise<string>;
  eliminaTemporaneo(uri: string): Promise<void>;
}
export type CodiceAcquisizione = 'OCCUPATO' | 'PIATTAFORMA_NON_SUPPORTATA' | 'CACHE_NON_DISPONIBILE' | 'OPZIONI_NON_VALIDE' | 'SELEZIONE_FALLITA' |
  'SELEZIONE_NON_VALIDA' | 'PERMESSO_NEGATO' | 'URI_MANCANTE' | 'URI_NON_TEMPORANEO' |
  'FILE_MANCANTE' | 'FILE_NON_ACCESSIBILE' | 'DIMENSIONE_NON_VERIFICABILE' | 'FILE_VUOTO' |
  'FILE_TROPPO_GRANDE' | 'MIME_NON_SUPPORTATO' | 'FORMATO_NON_SUPPORTATO' | 'MIME_INCOERENTE' |
  'FORMATO_NON_IMMAGINE' | 'PULIZIA_FALLITA';
export interface DocumentoAcquisito {
  uriLocale: string;
  nomeOriginale: string | null;
  mimeDichiarato: string | null;
  mimeVerificato: 'application/pdf' | 'image/jpeg' | 'image/png';
  formato: FormatoDocumento;
  tipoSorgente: TipoSorgente;
  dimensioneBytes: number;
  dimensioneDichiarata: number | null;
  larghezza: number | null;
  altezza: number | null;
  canale: CanaleAcquisizione;
  temporaneo: true;
  verifica: 'firma_iniziale';
  avvisi: readonly string[];
}
export interface EsitoPulizia { riuscita: boolean }
export type EsitoAcquisizione = { stato: 'annullato' } |
  { stato: 'errore'; codice: CodiceAcquisizione; puliziaRiuscita: boolean } |
  { stato: 'pronto'; documento: Readonly<DocumentoAcquisito>; rilascia(): Promise<EsitoPulizia> };
class ErroreAcquisizione extends Error {
  readonly codice: CodiceAcquisizione;
  constructor(codice: CodiceAcquisizione) { super(codice); this.codice = codice; }
}
function fallisci(codice: CodiceAcquisizione): never { throw new ErroreAcquisizione(codice); }
const positivo = (v: number | null) => v !== null && Number.isFinite(v) && v > 0 ? v : null;
const mimeFormati: Record<FormatoDocumento, DocumentoAcquisito['mimeVerificato']> = {
  pdf: 'application/pdf', jpeg: 'image/jpeg', png: 'image/png',
};
function decodificaFirma(base64: string): number[] {
  if (!base64 || base64.length > 24 || base64.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) fallisci('FILE_NON_ACCESSIBILE');
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = []; let accumulatore = 0, bit = 0;
  for (const c of base64.replace(/=+$/, '')) {
    accumulatore = (accumulatore << 6) | alfabeto.indexOf(c); bit += 6;
    if (bit >= 8) { bit -= 8; bytes.push((accumulatore >>> bit) & 255); }
  }
  return bytes;
}
function formatoFirma(base64: string): FormatoDocumento | null {
  const bytes = decodificaFirma(base64);
  const inizia = (firma: number[]) => firma.every((b, i) => bytes[i] === b);
  if (inizia([0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf';
  if (inizia([0xff, 0xd8, 0xff])) return 'jpeg';
  if (inizia([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  return null;
}
/** Un servizio per schermata/flusso; il chiamante rilascia sempre il risultato in finally. */
export function creaAcquisitore(porte: PorteAcquisizione) {
  let occupato = false;
  const residui = new Set<string>(), completati = new Set<string>();
  const pulizieInCorso = new Map<string, Promise<boolean>>();
  const pulisci = (uri: string): Promise<boolean> => {
    if (completati.has(uri)) return Promise.resolve(true);
    const corrente = pulizieInCorso.get(uri);
    if (corrente) return corrente;
    const operazione = (async () => {
      try { await porte.eliminaTemporaneo(uri); residui.delete(uri); completati.add(uri); return true; }
      catch { residui.add(uri); return false; }
    })().finally(() => { pulizieInCorso.delete(uri); });
    pulizieInCorso.set(uri, operazione);
    return operazione;
  };
  return {
    async riprovaPulizia(): Promise<EsitoPulizia> {
      let riuscita = true;
      for (const uri of [...residui]) if (!await pulisci(uri)) riuscita = false;
      return { riuscita };
    },
    async acquisisci(opzioni: OpzioniAcquisizione): Promise<EsitoAcquisizione> {
      if (occupato) return { stato: 'errore', codice: 'OCCUPATO', puliziaRiuscita: true };
      if (!['documento', 'galleria', 'fotocamera'].includes(opzioni.canale) ||
          (opzioni.tipoImmagine !== undefined && !['immagine', 'screenshot'].includes(opzioni.tipoImmagine))) {
        return { stato: 'errore', codice: 'OPZIONI_NON_VALIDE', puliziaRiuscita: true };
      }
      occupato = true;
      let daEliminare: string[] = [];
      let errorePredefinito: CodiceAcquisizione = 'SELEZIONE_FALLITA';
      try {
        // Un precedente errore di pulizia viene risolto prima di acquisire nuovi dati.
        for (const uri of [...residui]) if (!await pulisci(uri)) fallisci('PULIZIA_FALLITA');
        const selezione = await porte.seleziona(opzioni.canale);
        if (selezione.stato === 'annullato') return { stato: 'annullato' };
        if (selezione.stato === 'permesso_negato') fallisci('PERMESSO_NEGATO');
        if (selezione.stato === 'non_supportato') fallisci('PIATTAFORMA_NON_SUPPORTATA');
        if (selezione.stato === 'cache_non_disponibile') fallisci('CACHE_NON_DISPONIBILE');
        if (selezione.stato !== 'selezionato') fallisci('SELEZIONE_NON_VALIDA');
        daEliminare = selezione.assets.filter(a => a.uri && porte.temporaneoDelSelettore(a.uri, opzioni.canale)).map(a => a.uri!);
        daEliminare.forEach(uri => completati.delete(uri));
        if (selezione.assets.length !== 1) fallisci('SELEZIONE_NON_VALIDA');
        const asset = selezione.assets[0], uri = asset.uri;
        if (!uri?.trim()) fallisci('URI_MANCANTE');
        // Non si leggono né si eliminano originali, URI remoti o percorsi arbitrari.
        if (!porte.temporaneoDelSelettore(uri, opzioni.canale)) fallisci('URI_NON_TEMPORANEO');
        errorePredefinito = 'FILE_NON_ACCESSIBILE';
        const info = await porte.informazioni(uri);
        if (!info.esiste) fallisci('FILE_MANCANTE');
        if (info.directory) fallisci('FILE_NON_ACCESSIBILE');
        const bytes = info.dimensione;
        if (bytes === null || !Number.isSafeInteger(bytes) || bytes < 0) fallisci('DIMENSIONE_NON_VERIFICABILE');
        if (bytes === 0) fallisci('FILE_VUOTO');
        if (bytes > LIMITE_DOCUMENTO_BYTES) fallisci('FILE_TROPPO_GRANDE');
        const mime = asset.mime?.trim().toLowerCase() || null;
        if (mime && mime !== 'application/octet-stream' && !Object.values(mimeFormati).includes(mime as DocumentoAcquisito['mimeVerificato'])) fallisci('MIME_NON_SUPPORTATO');
        const formato = formatoFirma(await porte.leggiFirmaBase64(uri, BYTES_FIRMA));
        if (!formato) fallisci('FORMATO_NON_SUPPORTATO');
        const mimeVerificato = mimeFormati[formato];
        if (mime && mime !== 'application/octet-stream' && mime !== mimeVerificato) fallisci('MIME_INCOERENTE');
        if (opzioni.canale !== 'documento' && formato === 'pdf') fallisci('FORMATO_NON_IMMAGINE');
        const avvisi: string[] = [];
        if (!mime || mime === 'application/octet-stream') avvisi.push('mime_ricavato_dalla_firma');
        if (asset.dimensioneDichiarata !== null && asset.dimensioneDichiarata !== bytes) avvisi.push('dimensione_dichiarata_differente');
        const estensione = asset.nome?.split('.').pop()?.toLowerCase();
        if (asset.nome && estensione && !(formato === 'jpeg' ? ['jpg', 'jpeg'] : [formato]).includes(estensione)) avvisi.push('nome_non_coerente_con_formato');
        const documento: Readonly<DocumentoAcquisito> = Object.freeze({
          uriLocale: uri, nomeOriginale: asset.nome, mimeDichiarato: asset.mime,
          mimeVerificato, formato, tipoSorgente: formato === 'pdf' ? 'pdf' : opzioni.tipoImmagine ?? 'immagine',
          dimensioneBytes: bytes, dimensioneDichiarata: asset.dimensioneDichiarata,
          larghezza: formato === 'pdf' ? null : positivo(asset.larghezza), altezza: formato === 'pdf' ? null : positivo(asset.altezza),
          canale: opzioni.canale, temporaneo: true, verifica: 'firma_iniziale', avvisi: Object.freeze(avvisi),
        });
        let rilasciato = false;
        const rilascia = async (): Promise<EsitoPulizia> => {
          if (rilasciato) return { riuscita: true };
          const riuscita = await pulisci(uri); if (riuscita) rilasciato = true;
          return { riuscita };
        };
        return { stato: 'pronto', documento, rilascia };
      } catch (error) {
        let puliziaRiuscita = true;
        for (const uri of new Set(daEliminare)) if (!await pulisci(uri)) puliziaRiuscita = false;
        if (residui.size) puliziaRiuscita = false;
        return { stato: 'errore', codice: error instanceof ErroreAcquisizione ? error.codice : errorePredefinito, puliziaRiuscita };
      } finally {
        occupato = false;
      }
    },
  };
}
