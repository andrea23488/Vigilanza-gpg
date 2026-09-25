import * as FileSystem from 'expo-file-system/legacy';

export const CHIAVE_POSTAZIONI = 'vigilanza_postazioni';
export const CARTELLA_FOTO_POSTAZIONI =
  `${FileSystem.documentDirectory}postazioni_vigilanza/`;

let sequenzaNomeFile = 0;

function estensioneSicura(uri, nomeOriginale) {
  const sorgente = String(nomeOriginale || uri || '');
  const match = sorgente.match(/\.([a-zA-Z0-9]{2,5})(?:\?|#|$)/);
  return match?.[1]?.toLowerCase() || 'jpg';
}

export function fotoInCartellaGestita(
  uri,
  cartella = CARTELLA_FOTO_POSTAZIONI
) {
  return Boolean(uri) && String(uri).startsWith(cartella);
}

export function creaUriFotoPostazione({
  nomeOriginale,
  uriOriginale,
  cartella = CARTELLA_FOTO_POSTAZIONI,
  ora = Date.now,
  casuale = Math.random,
}) {
  sequenzaNomeFile += 1;
  const estensione = estensioneSicura(uriOriginale, nomeOriginale);
  const suffisso = casuale().toString(36).slice(2, 10) || 'foto';
  return `${cartella}postazione_${ora()}_${sequenzaNomeFile}_${suffisso}.${estensione}`;
}

async function assicuraCartella(fileSystem, cartella) {
  const info = await fileSystem.getInfoAsync(cartella);
  if (!info.exists) {
    await fileSystem.makeDirectoryAsync(cartella, { intermediates: true });
  }
}

export async function copiaFotoPostazionePermanente({
  uri,
  nomeOriginale,
  fileSystem = FileSystem,
  cartella = CARTELLA_FOTO_POSTAZIONI,
  creaDestinazione = creaUriFotoPostazione,
}) {
  if (!uri) return null;

  const sorgente = String(uri);
  if (fotoInCartellaGestita(sorgente, cartella)) {
    const info = await fileSystem.getInfoAsync(sorgente);
    if (!info.exists) throw new Error('La fotografia selezionata non esiste più.');
    return sorgente;
  }

  const infoSorgente = await fileSystem.getInfoAsync(sorgente);
  if (!infoSorgente.exists) {
    throw new Error('La fotografia selezionata non è più disponibile.');
  }

  await assicuraCartella(fileSystem, cartella);
  const destinazione = creaDestinazione({
    nomeOriginale,
    uriOriginale: sorgente,
    cartella,
  });

  try {
    await fileSystem.copyAsync({ from: sorgente, to: destinazione });
    const verifica = await fileSystem.getInfoAsync(destinazione);
    if (!verifica.exists) {
      throw new Error('La copia permanente della fotografia non è riuscita.');
    }
    return destinazione;
  } catch (error) {
    try {
      const parziale = await fileSystem.getInfoAsync(destinazione);
      if (parziale.exists) {
        await fileSystem.deleteAsync(destinazione, { idempotent: true });
      }
    } catch (_) {}
    throw error;
  }
}

export async function migraFotoPostazioni({
  postazioni = [],
  fileSystem = FileSystem,
  cartella = CARTELLA_FOTO_POSTAZIONI,
  copiaFoto = copiaFotoPostazionePermanente,
}) {
  const risultato = [];
  const errori = [];
  const fileCreati = [];
  let cambiato = false;

  for (const postazione of Array.isArray(postazioni) ? postazioni : []) {
    const foto = postazione?.foto ? String(postazione.foto) : null;
    if (!foto) {
      risultato.push(postazione);
      continue;
    }

    try {
      const info = await fileSystem.getInfoAsync(foto);
      if (!info.exists) {
        const aggiornata = {
          ...postazione,
          fotoNonDisponibile: true,
        };
        if (postazione.fotoNonDisponibile !== true) cambiato = true;
        risultato.push(aggiornata);
        continue;
      }

      if (fotoInCartellaGestita(foto, cartella)) {
        if (postazione.fotoNonDisponibile === true) {
          cambiato = true;
          risultato.push({ ...postazione, fotoNonDisponibile: false });
        } else {
          risultato.push(postazione);
        }
        continue;
      }

      const persistente = await copiaFoto({
        uri: foto,
        nomeOriginale: foto,
        fileSystem,
        cartella,
      });
      risultato.push({
        ...postazione,
        foto: persistente,
        fotoNonDisponibile: false,
      });
      fileCreati.push(persistente);
      cambiato = true;
    } catch (error) {
      errori.push({ postazioneId: postazione?.id || null, foto, error });
      risultato.push(postazione);
    }
  }

  return { postazioni: risultato, cambiato, errori, fileCreati };
}

export async function caricaPostazioniLocali({
  storage,
  fileSystem = FileSystem,
  chiave = CHIAVE_POSTAZIONI,
}) {
  const raw = await storage.getItem(chiave);
  if (!raw) return { postazioni: [], migrate: false, errori: [] };

  const parsed = JSON.parse(raw);
  const lista = Array.isArray(parsed) ? parsed : [];
  const migrazione = await migraFotoPostazioni({
    postazioni: lista,
    fileSystem,
  });

  if (migrazione.cambiato) {
    try {
      await storage.setItem(chiave, JSON.stringify(migrazione.postazioni));
    } catch (error) {
      migrazione.errori.push({
        postazioneId: null,
        foto: null,
        fase: 'persistenza_migrazione',
        error,
      });

      for (const uri of migrazione.fileCreati) {
        try {
          const info = await fileSystem.getInfoAsync(uri);
          if (info.exists) {
            await fileSystem.deleteAsync(uri, { idempotent: true });
          }
        } catch (puliziaError) {
          migrazione.errori.push({
            postazioneId: null,
            foto: uri,
            fase: 'rollback_migrazione',
            error: puliziaError,
          });
        }
      }

      return {
        postazioni: lista,
        migrate: false,
        errori: migrazione.errori,
      };
    }
  }

  return {
    postazioni: migrazione.postazioni,
    migrate: migrazione.cambiato,
    errori: migrazione.errori,
  };
}

export async function eliminaFotoPostazioneSeInutilizzata({
  uri,
  postazioniResidue = [],
  fileSystem = FileSystem,
  cartella = CARTELLA_FOTO_POSTAZIONI,
}) {
  if (!fotoInCartellaGestita(uri, cartella)) {
    return { eliminata: false, motivo: 'esterna' };
  }

  const ancoraUsata = (Array.isArray(postazioniResidue) ? postazioniResidue : [])
    .some((postazione) => String(postazione?.foto || '') === String(uri));
  if (ancoraUsata) return { eliminata: false, motivo: 'condivisa' };

  const info = await fileSystem.getInfoAsync(uri);
  if (!info.exists) return { eliminata: false, motivo: 'mancante' };

  await fileSystem.deleteAsync(uri, { idempotent: true });
  return { eliminata: true, motivo: null };
}
