const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function creaFileSystemFake() {
  const files = new Set();
  const directories = new Set();
  const copyCalls = [];
  const deleteCalls = [];
  const erroriInfo = new Set();
  const erroriDelete = new Set();

  return {
    documentDirectory: 'file:///documenti/',
    files,
    directories,
    copyCalls,
    deleteCalls,
    erroriInfo,
    erroriDelete,
    async getInfoAsync(uri) {
      if (erroriInfo.has(uri)) throw new Error(`Errore info: ${uri}`);
      return { exists: files.has(uri) || directories.has(uri), uri };
    },
    async makeDirectoryAsync(uri) {
      directories.add(uri);
    },
    async copyAsync({ from, to }) {
      if (!files.has(from)) throw new Error(`Sorgente mancante: ${from}`);
      copyCalls.push({ from, to });
      files.add(to);
    },
    async deleteAsync(uri) {
      if (erroriDelete.has(uri)) throw new Error(`Errore delete: ${uri}`);
      deleteCalls.push(uri);
      files.delete(uri);
    },
  };
}

function caricaModulo(fileSystem) {
  let sorgente = fs.readFileSync('postazioniMedia.js', 'utf8');
  sorgente = sorgente
    .replace(
      "import * as FileSystem from 'expo-file-system/legacy';",
      'const FileSystem = __fileSystem;'
    )
    .replaceAll('export async function ', 'async function ')
    .replaceAll('export function ', 'function ')
    .replaceAll('export const ', 'const ');

  const nomi = [
    'CHIAVE_POSTAZIONI',
    'CARTELLA_FOTO_POSTAZIONI',
    'fotoInCartellaGestita',
    'creaUriFotoPostazione',
    'copiaFotoPostazionePermanente',
    'migraFotoPostazioni',
    'caricaPostazioniLocali',
    'eliminaFotoPostazioneSeInutilizzata',
  ];
  sorgente += `\nmodule.exports = { ${nomi.join(', ')} };`;

  const sandbox = {
    module: { exports: {} },
    exports: {},
    __fileSystem: fileSystem,
    Date,
    Math,
    JSON,
  };
  vm.runInNewContext(sorgente, sandbox);
  return sandbox.module.exports;
}

function creaStorage(iniziale = {}) {
  const dati = new Map(Object.entries(iniziale));
  return {
    dati,
    async getItem(chiave) {
      return dati.has(chiave) ? dati.get(chiave) : null;
    },
    async setItem(chiave, valore) {
      dati.set(chiave, valore);
    },
  };
}

async function main() {
  const fileSystem = creaFileSystemFake();
  const media = caricaModulo(fileSystem);
  const cartella = media.CARTELLA_FOTO_POSTAZIONI;

  // Foto nuova: copia verificata nella directory permanente.
  const sorgenteNuova = 'file:///cache/foto.jpg';
  fileSystem.files.add(sorgenteNuova);
  const nuovaFoto = await media.copiaFotoPostazionePermanente({
    uri: sorgenteNuova,
    nomeOriginale: 'ingresso.jpg',
    fileSystem,
  });
  assert.equal(nuovaFoto.startsWith(cartella), true);
  assert.equal(fileSystem.files.has(nuovaFoto), true);

  // Anche con timestamp e casualità uguali il nome non collide.
  const nome1 = media.creaUriFotoPostazione({
    nomeOriginale: 'foto.jpg', cartella, ora: () => 100, casuale: () => 0.5,
  });
  const nome2 = media.creaUriFotoPostazione({
    nomeOriginale: 'foto.jpg', cartella, ora: () => 100, casuale: () => 0.5,
  });
  assert.notEqual(nome1, nome2);

  // Persistenza e ricaricamento di un record con file esistente.
  const storagePersistenza = creaStorage({
    [media.CHIAVE_POSTAZIONI]: JSON.stringify([
      { id: 'persistita', nome: 'Ingresso', foto: nuovaFoto },
    ]),
  });
  const ricaricate = await media.caricaPostazioniLocali({
    storage: storagePersistenza,
    fileSystem,
  });
  assert.equal(ricaricate.postazioni[0].foto, nuovaFoto);
  assert.notEqual(ricaricate.postazioni[0].fotoNonDisponibile, true);

  // URI storico recuperabile: migrazione una sola volta e URI originale intatto.
  const vecchioUri = 'file:///cache/vecchia.png';
  fileSystem.files.add(vecchioUri);
  const storageStorico = creaStorage({
    [media.CHIAVE_POSTAZIONI]: JSON.stringify([
      { id: 'storica', nome: 'Storica', foto: vecchioUri },
    ]),
  });
  const primaMigrazione = await media.caricaPostazioniLocali({
    storage: storageStorico,
    fileSystem,
  });
  const fotoMigrata = primaMigrazione.postazioni[0].foto;
  assert.equal(fotoMigrata.startsWith(cartella), true);
  assert.equal(fileSystem.files.has(vecchioUri), true);
  const copieDopoPrimaMigrazione = fileSystem.copyCalls.length;

  const secondaMigrazione = await media.caricaPostazioniLocali({
    storage: storageStorico,
    fileSystem,
  });
  assert.equal(secondaMigrazione.postazioni[0].foto, fotoMigrata);
  assert.equal(fileSystem.copyCalls.length, copieDopoPrimaMigrazione);

  // URI irrecuperabile: record conservato e foto marcata non disponibile.
  const uriMancante = 'file:///cache/non-esiste.jpg';
  const mancanti = await media.migraFotoPostazioni({
    postazioni: [{ id: 'mancante', nome: 'Senza foto', foto: uriMancante }],
    fileSystem,
  });
  assert.equal(mancanti.postazioni[0].nome, 'Senza foto');
  assert.equal(mancanti.postazioni[0].foto, uriMancante);
  assert.equal(mancanti.postazioni[0].fotoNonDisponibile, true);

  // Sostituzione/rimozione/eliminazione: file gestito eliminato se non condiviso.
  const vecchiaGestita = `${cartella}vecchia.jpg`;
  const nuovaGestita = `${cartella}nuova.jpg`;
  fileSystem.files.add(vecchiaGestita);
  fileSystem.files.add(nuovaGestita);
  const sostituzione = await media.eliminaFotoPostazioneSeInutilizzata({
    uri: vecchiaGestita,
    postazioniResidue: [{ id: 'p1', foto: nuovaGestita }],
    fileSystem,
  });
  assert.equal(sostituzione.eliminata, true);
  assert.equal(fileSystem.files.has(vecchiaGestita), false);

  const rimossa = `${cartella}rimossa.jpg`;
  fileSystem.files.add(rimossa);
  assert.equal((await media.eliminaFotoPostazioneSeInutilizzata({
    uri: rimossa, postazioniResidue: [], fileSystem,
  })).eliminata, true);

  const eliminataConPostazione = `${cartella}eliminata.jpg`;
  fileSystem.files.add(eliminataConPostazione);
  assert.equal((await media.eliminaFotoPostazioneSeInutilizzata({
    uri: eliminataConPostazione, postazioniResidue: [], fileSystem,
  })).eliminata, true);

  // File condiviso: resta finché almeno un record lo usa.
  const condivisa = `${cartella}condivisa.jpg`;
  fileSystem.files.add(condivisa);
  const nonEliminata = await media.eliminaFotoPostazioneSeInutilizzata({
    uri: condivisa,
    postazioniResidue: [{ id: 'seconda', foto: condivisa }],
    fileSystem,
  });
  assert.equal(nonEliminata.motivo, 'condivisa');
  assert.equal(fileSystem.files.has(condivisa), true);

  // URI esterno: non viene mai cancellato.
  const esterna = 'file:///documenti/altra-app/foto.jpg';
  fileSystem.files.add(esterna);
  const esternaIntatta = await media.eliminaFotoPostazioneSeInutilizzata({
    uri: esterna, postazioniResidue: [], fileSystem,
  });
  assert.equal(esternaIntatta.motivo, 'esterna');
  assert.equal(fileSystem.files.has(esterna), true);

  // Errore filesystem durante migrazione: nessun crash e record non alterato.
  const uriErrore = 'file:///cache/errore.jpg';
  fileSystem.erroriInfo.add(uriErrore);
  const recordOriginale = { id: 'errore', nome: 'Integra', foto: uriErrore };
  const conErrore = await media.migraFotoPostazioni({
    postazioni: [recordOriginale], fileSystem,
  });
  assert.equal(conErrore.errori.length, 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(conErrore.postazioni[0])),
    recordOriginale
  );

  // Errore di eliminazione: il file resta integro e l'errore è diagnosticabile.
  const nonEliminabile = `${cartella}non-eliminabile.jpg`;
  fileSystem.files.add(nonEliminabile);
  fileSystem.erroriDelete.add(nonEliminabile);
  await assert.rejects(
    media.eliminaFotoPostazioneSeInutilizzata({
      uri: nonEliminabile,
      postazioniResidue: [],
      fileSystem,
    }),
    /Errore delete/
  );
  assert.equal(fileSystem.files.has(nonEliminabile), true);

  // Se il JSON migrato non può essere salvato, la copia viene rimossa e
  // il record storico originale viene restituito senza corruzioni.
  const uriRollback = 'file:///cache/rollback.jpg';
  fileSystem.files.add(uriRollback);
  const storageInErrore = {
    async getItem() {
      return JSON.stringify([{ id: 'rollback', foto: uriRollback }]);
    },
    async setItem() {
      throw new Error('Storage non disponibile');
    },
  };
  const copiePrimaRollback = new Set(fileSystem.files);
  const rollback = await media.caricaPostazioniLocali({
    storage: storageInErrore,
    fileSystem,
  });
  assert.equal(rollback.postazioni[0].foto, uriRollback);
  assert.equal(rollback.errori.some(
    (errore) => errore.fase === 'persistenza_migrazione'
  ), true);
  const nuoviFileResidui = [...fileSystem.files].filter(
    (uri) => !copiePrimaRollback.has(uri)
  );
  assert.deepEqual(nuoviFileResidui, []);

  console.log('Regressione media postazioni superata');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
