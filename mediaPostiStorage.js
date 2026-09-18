import * as FileSystem from 'expo-file-system/legacy';

const CARTELLA_MEDIA_POSTI =
  `${FileSystem.documentDirectory}posti_vigilanza/`;

async function assicuraCartellaMedia() {
  const info = await FileSystem.getInfoAsync(CARTELLA_MEDIA_POSTI);

  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CARTELLA_MEDIA_POSTI, {
      intermediates: true,
    });
  }
}

function estensioneMedia(uri, nomeOriginale, tipo) {
  const sorgente = String(nomeOriginale || uri || '');
  const match = sorgente.match(/\.([a-zA-Z0-9]{2,5})(?:\?|$)/);

  if (match?.[1]) {
    return match[1].toLowerCase();
  }

  return tipo === 'video' ? 'mp4' : 'jpg';
}

export function mediaPostoInStoragePermanente(uri) {
  return String(uri || '').startsWith(CARTELLA_MEDIA_POSTI);
}

export async function copiaMediaPostoPermanente({
  uri,
  nomeOriginale,
  tipo = 'foto',
}) {
  if (!uri) return null;
  if (mediaPostoInStoragePermanente(uri)) return uri;

  await assicuraCartellaMedia();

  const estensione = estensioneMedia(uri, nomeOriginale, tipo);
  const destinazione =
    `${CARTELLA_MEDIA_POSTI}${tipo}_${Date.now()}_` +
    `${Math.random().toString(36).slice(2)}.${estensione}`;

  await FileSystem.copyAsync({ from: uri, to: destinazione });
  return destinazione;
}

export async function normalizzaMediaPosto(lista = []) {
  let cambiato = false;

  const media = await Promise.all(
    (Array.isArray(lista) ? lista : []).map(async (elemento) => {
      if (!elemento?.uri) {
        cambiato = true;
        return { ...elemento, nonDisponibile: true };
      }

      const info = await FileSystem.getInfoAsync(elemento.uri);

      if (!info.exists) {
        if (elemento.nonDisponibile !== true) cambiato = true;
        return { ...elemento, nonDisponibile: true };
      }

      if (mediaPostoInStoragePermanente(elemento.uri)) {
        if (elemento.nonDisponibile) cambiato = true;
        return { ...elemento, nonDisponibile: false };
      }

      try {
        const uriPersistente = await copiaMediaPostoPermanente({
          uri: elemento.uri,
          nomeOriginale: elemento.nomeOriginale,
          tipo: elemento.tipo,
        });

        cambiato = true;
        return {
          ...elemento,
          uri: uriPersistente,
          nonDisponibile: false,
        };
      } catch (error) {
        console.log('Migrazione media posto non riuscita:', error);
        return { ...elemento, nonDisponibile: false };
      }
    })
  );

  return { media, cambiato };
}

export async function eliminaMediaPostoPermanente(elemento) {
  const uri = elemento?.uri;
  if (!uri || !mediaPostoInStoragePermanente(uri)) return;

  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}
