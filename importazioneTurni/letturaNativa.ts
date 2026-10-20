import * as file from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { uriCacheSelettore } from './acquisizioneExpo';
import { creaLettoreDocumenti } from './lettura';
import type { PorteLettura } from './lettura';

/** Android escluso: i Gradle dei decoder richiedono un plugin rimosso in Expo 54.
 * Import differiti: l'assenza del modulo nel binario non impedisce l'avvio dell'app. */
export function creaLettoreNativo() {
  let pdf: typeof import('expo-pdf-text-extract') | null = null;
  let immagini: typeof import('expo-text-extractor') | null = null;
  const porte: PorteLettura = {
    async pdfDisponibile() {
      if (Platform.OS !== 'ios') return false;
      try { pdf = await import('expo-pdf-text-extract'); return pdf.isAvailable(); } catch { return false; }
    },
    async immaginiDisponibili() {
      if (Platform.OS !== 'ios') return false;
      try { immagini = await import('expo-text-extractor'); return immagini.isSupported === true; } catch { return false; }
    },
    async impronta(d) {
      if (!uriCacheSelettore(d.uriLocale, file.cacheDirectory, d.canale)) throw new Error('URI_NON_ACQUISITO');
      const info = await file.getInfoAsync(d.uriLocale, { md5: true });
      if (!info.exists || info.isDirectory || info.size !== d.dimensioneBytes || !info.md5) throw new Error('FILE_CAMBIATO');
      // MD5 è un filtro di duplicati accidentali, mai un controllo di autenticità.
      return `md5:${info.md5.toLowerCase()}:${info.size}`;
    },
    async numeroPagine(uri) { if (!pdf) throw new Error('DECODER_ASSENTE'); return pdf.getPageCount(uri); },
    async testoPagina(uri, n) { if (!pdf) throw new Error('DECODER_ASSENTE'); return pdf.extractTextFromPage(uri, n); },
    async testoImmagine(uri) { if (!immagini) throw new Error('DECODER_ASSENTE'); return immagini.extractTextFromImage(uri); },
  };
  return creaLettoreDocumenti(porte);
}
