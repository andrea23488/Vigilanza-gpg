import * as file from 'expo-file-system/legacy';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { uriCacheSelettore } from './acquisizioneExpo';
import { creaLettoreIOS } from './letturaIOS';
import type { ModuloTurniIOS } from './letturaIOS';

/** Metro sceglie questo file esclusivamente su iOS. Nessun fallback simulato. */
export function creaLettoreNativo() {
  return creaLettoreIOS({
    modulo: () => requireOptionalNativeModule<ModuloTurniIOS>('TurniDocumentiIOS'),
    async impronta(d) {
      if (!uriCacheSelettore(d.uriLocale, file.cacheDirectory, d.canale)) throw new Error('URI_NON_ACQUISITO');
      const info = await file.getInfoAsync(d.uriLocale, { md5: true });
      if (!info.exists || info.isDirectory || info.size !== d.dimensioneBytes || !info.md5) throw new Error('FILE_CAMBIATO');
      return `md5:${info.md5.toLowerCase()}:${info.size}`;
    },
  });
}
