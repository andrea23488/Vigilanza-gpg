import type * as DocumentPicker from 'expo-document-picker';
import type * as ImagePicker from 'expo-image-picker';
import type * as FileSystem from 'expo-file-system/legacy';
import { BYTES_FIRMA } from './acquisizione';
import type { AssetSelezionato, CanaleAcquisizione, PorteAcquisizione, RispostaSelettore } from './acquisizione';

/** API ristrette alle sole operazioni locali effettivamente presenti nelle versioni installate. */
export interface ModuliAcquisizioneExpo {
  documenti: Pick<typeof DocumentPicker, 'getDocumentAsync'>;
  immagini: Pick<typeof ImagePicker, 'launchImageLibraryAsync' | 'launchCameraAsync' | 'requestCameraPermissionsAsync'>;
  file: Pick<typeof FileSystem, 'cacheDirectory' | 'getInfoAsync' | 'readAsStringAsync' | 'deleteAsync'>;
  piattaforma: string;
}
export function uriCacheSelettore(uri: string, cache: string | null, canale: CanaleAcquisizione): boolean {
  if (!cache || !uri.startsWith('file:///') || !cache.startsWith('file:///')) return false;
  try {
    const percorso = decodeURIComponent(uri), radice = decodeURIComponent(cache);
    if (/[\\?#\u0000]/.test(percorso) || /[\\?#\u0000]/.test(radice)) return false;
    if ([percorso, radice].some(v => v.split('/').some(s => s === '..' || s === '.'))) return false;
    const cartella = canale === 'documento' ? 'DocumentPicker/' : 'ImagePicker/';
    const prefisso = `${radice.endsWith('/') ? radice : `${radice}/`}${cartella}`;
    if (!percorso.startsWith(prefisso)) return false;
    const nome = percorso.slice(prefisso.length);
    return nome.length > 0 && !nome.includes('/');
  } catch { return false; }
}
function permessoNegato(error: unknown): boolean {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  return ['ERR_MISSING_CAMERA_PERMISSION', 'ERR_MISSING_PHOTO_LIBRARY_PERMISSION',
    'ERR_USER_REJECTED_PERMISSIONS', 'E_NO_CAMERA_PERMISSION', 'E_NO_LIBRARY_PERMISSION'].includes(code);
}
export function creaPorteAcquisizioneExpo(moduli: ModuliAcquisizioneExpo): PorteAcquisizione {
  // Si possono cancellare solo copie restituite da questo adattatore, non altri file dei selettori.
  const posseduti = new Set<string>();
  const locale = (uri: string, canale: CanaleAcquisizione) => uriCacheSelettore(uri, moduli.file.cacheDirectory, canale);
  const registra = (assets: AssetSelezionato[], canale: CanaleAcquisizione): RispostaSelettore => {
    for (const a of assets) if (a.uri && locale(a.uri, canale)) posseduti.add(a.uri);
    return { stato: 'selezionato', assets };
  };
  return {
    async seleziona(canale) {
      if (!['ios', 'android'].includes(moduli.piattaforma)) return { stato: 'non_supportato' };
      if (!moduli.file.cacheDirectory?.startsWith('file:///')) return { stato: 'cache_non_disponibile' };
      try {
        if (canale === 'documento') {
          const r = await moduli.documenti.getDocumentAsync({
            type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true,
            multiple: false, base64: false,
          });
          if (r.canceled) return { stato: 'annullato' };
          return registra(r.assets.map(a => ({ uri: a.uri ?? null, nome: a.name ?? null,
            mime: a.mimeType ?? null, dimensioneDichiarata: a.size ?? null, larghezza: null, altezza: null })), canale);
        }
        if (canale === 'fotocamera') {
          const p = await moduli.immagini.requestCameraPermissionsAsync();
          if (!p.granted) return { stato: 'permesso_negato' };
        }
        // I selettori di sistema moderni non richiedono un accesso generale alla galleria.
        const opzioni: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: false,
          allowsMultipleSelection: false, quality: 1, exif: false, base64: false };
        const r = canale === 'fotocamera' ? await moduli.immagini.launchCameraAsync(opzioni) :
          await moduli.immagini.launchImageLibraryAsync(opzioni);
        if (r.canceled) return { stato: 'annullato' };
        return registra(r.assets.map(a => ({ uri: a.uri ?? null, nome: a.fileName ?? null,
          mime: a.mimeType ?? null, dimensioneDichiarata: a.fileSize ?? null,
          larghezza: a.width ?? null, altezza: a.height ?? null })), canale);
      } catch (error) {
        if (permessoNegato(error)) return { stato: 'permesso_negato' };
        throw error;
      }
    },
    temporaneoDelSelettore: locale,
    async informazioni(uri) {
      const i = await moduli.file.getInfoAsync(uri);
      return { esiste: i.exists, directory: i.isDirectory, dimensione: i.exists ? i.size : null };
    },
    async leggiFirmaBase64(uri, bytes) {
      if (!posseduti.has(uri) || bytes !== BYTES_FIRMA) throw new Error('Lettura non consentita.');
      return moduli.file.readAsStringAsync(uri, { encoding: 'base64', position: 0, length: bytes });
    },
    async eliminaTemporaneo(uri) {
      if (!posseduti.has(uri) || !(locale(uri, 'documento') || locale(uri, 'galleria'))) throw new Error('File non acquisito.');
      await moduli.file.deleteAsync(uri, { idempotent: true });
      posseduti.delete(uri);
    },
  };
}
