'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { registerHooks } = require('node:module');
const hook = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.includes('/importazioneTurni/') && ['./acquisizione', './acquisizioneExpo'].includes(specifier)) return next(`${specifier}.ts`, context);
  return next(specifier, context);
} });
const { creaAcquisitore, LIMITE_DOCUMENTO_BYTES, BYTES_FIRMA } = require('../importazioneTurni/acquisizione.ts');
const { creaPorteAcquisizioneExpo, uriCacheSelettore } = require('../importazioneTurni/acquisizioneExpo.ts');
hook.deregister();
const firme = {
  pdf: Buffer.from('%PDF-1.7\nTEST\n'),
  jpeg: Buffer.from([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1]),
  png: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]),
};
// File sintetici virtuali: nessuna foto o documento personale, nessun filesystem reale.
function scenario(opzioni = {}) {
  const formato = opzioni.formato ?? 'pdf';
  const uri = opzioni.uri === undefined ? `file:///cache/DocumentPicker/test.${formato}` : opzioni.uri;
  const mime = opzioni.mime === undefined ? ({ pdf: 'application/pdf', jpeg: 'image/jpeg', png: 'image/png' })[formato] : opzioni.mime;
  const nome = opzioni.nome === undefined ? `sintetico.${formato}` : opzioni.nome;
  const registro = [], eliminati = [], attivi = new Set(uri ? [uri] : []);
  let errorePulizia = false;
  const asset = { uri, name: nome, mimeType: mime, size: opzioni.dichiarata ?? 100, lastModified: 0 };
  const imageAsset = { uri, fileName: nome, mimeType: mime, fileSize: opzioni.dichiarata ?? 100, width: 200, height: 100, type: 'image' };
  const stato = { risposta: opzioni.annullato ? { canceled: true, assets: null } : { canceled: false, assets: [asset] }, immagine: { canceled: false, assets: [imageAsset] } };
  const moduli = {
    piattaforma: opzioni.piattaforma ?? 'ios',
    documenti: { async getDocumentAsync(o) { registro.push(['documento', o]); if (opzioni.erroreSelettore) throw opzioni.erroreSelettore; return stato.risposta; } },
    immagini: {
      async requestCameraPermissionsAsync() { registro.push(['permesso_camera']); return { granted: !opzioni.permessoNegato }; },
      async launchImageLibraryAsync(o) { registro.push(['galleria', o]); if (opzioni.erroreGalleria) throw opzioni.erroreGalleria; return stato.immagine; },
      async launchCameraAsync(o) { registro.push(['fotocamera', o]); return stato.immagine; },
    },
    file: {
      cacheDirectory: opzioni.noCache ? null : 'file:///cache/',
      async getInfoAsync(u) {
        registro.push(['info', u]); if (opzioni.infoFallisce) throw new Error('Errore sintetico');
        return { exists: opzioni.mancante ? false : attivi.has(u), isDirectory: opzioni.directory ?? false,
          size: opzioni.dimensione === undefined ? 100 : opzioni.dimensione, uri: u, modificationTime: 0 };
      },
      async readAsStringAsync(u, o) {
        registro.push(['firma', u, o]); if (opzioni.letturaFallisce) throw new Error('Illeggibile');
        return opzioni.base64 ?? (opzioni.firma ?? firme[formato]).subarray(0, o.length).toString('base64');
      },
      async deleteAsync(u, o) {
        registro.push(['elimina', u, o]); if (errorePulizia) throw new Error('Pulizia simulata fallita');
        eliminati.push(u); attivi.delete(u);
      },
    },
  };
  const porte = creaPorteAcquisizioneExpo(moduli), acquisitore = creaAcquisitore(porte);
  return { acquisitore, porte, moduli, stato, uri, registro, eliminati, attivi,
    fallisciPulizia(v) { errorePulizia = v; } };
}
async function errore(opzioni, codice, canale = 'documento') {
  const s = scenario(opzioni), r = await s.acquisitore.acquisisci({ canale });
  assert.equal(r.stato, 'errore'); assert.equal(r.codice, codice);
  return s;
}
test('PDF: selezione SDK, metadati verificati e nessuna estrazione o conferma', async () => {
  const s = scenario(), r = await s.acquisitore.acquisisci({ canale: 'documento' });
  assert.equal(r.stato, 'pronto'); assert.equal(r.documento.formato, 'pdf');
  assert.equal(r.documento.tipoSorgente, 'pdf'); assert.equal(r.documento.dimensioneBytes, 100);
  assert.equal(r.documento.mimeVerificato, 'application/pdf'); assert.equal(r.documento.temporaneo, true);
  assert.equal(r.documento.uriLocale, s.uri); assert.equal(r.documento.larghezza, null);
  assert.equal('testoOriginale' in r.documento, false); assert.equal('conferma' in r.documento, false);
  assert.deepEqual(s.registro[0][1], { type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true, multiple: false, base64: false });
  assert.equal(s.registro.find(x => x[0] === 'firma')[2].length, BYTES_FIRMA);
  assert.equal(s.registro.find(x => x[0] === 'firma')[2].position, 0);
  assert.equal(s.registro.find(x => x[0] === 'firma')[2].encoding, 'base64');
  assert.equal((await r.rilascia()).riuscita, true); assert.equal(s.attivi.size, 0);
});
test('JPEG e PNG reali per firma, da selettore documenti e da galleria', async () => {
  for (const formato of ['jpeg', 'png']) for (const canale of ['documento', 'galleria']) {
    const s = scenario({ formato, uri: `file:///cache/${canale === 'documento' ? 'DocumentPicker' : 'ImagePicker'}/test.${formato}` });
    const r = await s.acquisitore.acquisisci({ canale });
    assert.equal(r.stato, 'pronto'); assert.equal(r.documento.formato, formato);
    assert.equal(r.documento.tipoSorgente, 'immagine'); await r.rilascia();
  }
});
test('screenshot soltanto se dichiarato, nome screenshot non cambia il tipo', async () => {
  const s = scenario({ formato: 'png', nome: 'screenshot.png' });
  const a = await s.acquisitore.acquisisci({ canale: 'documento' });
  assert.equal(a.documento.tipoSorgente, 'immagine'); await a.rilascia();
  const t = scenario({ formato: 'png' }), b = await t.acquisitore.acquisisci({ canale: 'documento', tipoImmagine: 'screenshot' });
  assert.equal(b.documento.tipoSorgente, 'screenshot'); await b.rilascia();
});
test('annullamento documenti senza lettura né cancellazione', async () => {
  const s = scenario({ annullato: true });
  assert.deepEqual(await s.acquisitore.acquisisci({ canale: 'documento' }), { stato: 'annullato' });
  assert.deepEqual(s.registro.map(x => x[0]), ['documento']);
});
test('annullamento galleria e fotocamera senza file acquisito', async () => {
  for (const canale of ['galleria', 'fotocamera']) {
    const s = scenario(); s.stato.immagine = { canceled: true, assets: null };
    assert.equal((await s.acquisitore.acquisisci({ canale })).stato, 'annullato');
    assert.equal(s.registro.some(x => ['info', 'firma', 'elimina'].includes(x[0])), false);
  }
});
test('URI mancante', async () => { await errore({ uri: null }, 'URI_MANCANTE'); });
test('MIME non valido bloccato e copia temporanea eliminata', async () => {
  const s = await errore({ mime: 'text/plain' }, 'MIME_NON_SUPPORTATO');
  assert.equal(s.eliminati.length, 1); assert.equal(s.registro.some(x => x[0] === 'firma'), false);
});
test('file troppo grande controllato prima di leggere contenuti', async () => {
  const s = await errore({ dimensione: LIMITE_DOCUMENTO_BYTES + 1 }, 'FILE_TROPPO_GRANDE');
  assert.equal(s.registro.some(x => x[0] === 'firma'), false); assert.equal(s.attivi.size, 0);
});
test('limite esatto accettato', async () => {
  const s = scenario({ dimensione: LIMITE_DOCUMENTO_BYTES });
  const r = await s.acquisitore.acquisisci({ canale: 'documento' }); assert.equal(r.stato, 'pronto'); await r.rilascia();
});
test('file mancante, directory, illeggibile e metadati non accessibili', async () => {
  await errore({ mancante: true }, 'FILE_MANCANTE');
  await errore({ directory: true }, 'FILE_NON_ACCESSIBILE');
  await errore({ letturaFallisce: true }, 'FILE_NON_ACCESSIBILE');
  await errore({ infoFallisce: true }, 'FILE_NON_ACCESSIBILE');
});
test('file vuoto o dimensione assente non vengono accettati', async () => {
  await errore({ dimensione: 0 }, 'FILE_VUOTO');
  await errore({ dimensione: null }, 'DIMENSIONE_NON_VERIFICABILE');
  await errore({ dimensione: -1 }, 'DIMENSIONE_NON_VERIFICABILE');
});
test('MIME valido ma firma incoerente, HEIC e altri formati rifiutati', async () => {
  await errore({ formato: 'png', mime: 'application/pdf' }, 'MIME_INCOERENTE');
  await errore({ mime: 'image/heic' }, 'MIME_NON_SUPPORTATO');
  await errore({ firma: Buffer.from('file non supportato') }, 'FORMATO_NON_SUPPORTATO');
});
test('MIME assente o generico ricavato dalla firma senza inventare dichiarazioni', async () => {
  for (const mime of [null, 'application/octet-stream']) {
    const s = scenario({ formato: 'png', mime }), r = await s.acquisitore.acquisisci({ canale: 'documento' });
    assert.equal(r.documento.mimeDichiarato, mime); assert.equal(r.documento.mimeVerificato, 'image/png');
    assert.ok(r.documento.avvisi.includes('mime_ricavato_dalla_firma')); await r.rilascia();
  }
});
test('metadati originali preservati; dimensione effettiva prevale e nome non determina formato', async () => {
  const s = scenario({ nome: 'nome-originale.heic', dichiarata: 12 }), r = await s.acquisitore.acquisisci({ canale: 'documento' });
  assert.equal(r.documento.nomeOriginale, 'nome-originale.heic'); assert.equal(r.documento.formato, 'pdf');
  assert.equal(r.documento.dimensioneDichiarata, 12); assert.equal(r.documento.dimensioneBytes, 100);
  assert.ok(r.documento.avvisi.includes('nome_non_coerente_con_formato'));
  assert.ok(r.documento.avvisi.includes('dimensione_dichiarata_differente')); await r.rilascia();
});
test('permesso fotocamera negato: nessun lancio del selettore e nessuna lettura', async () => {
  const s = await errore({ permessoNegato: true }, 'PERMESSO_NEGATO', 'fotocamera');
  assert.deepEqual(s.registro.map(x => x[0]), ['permesso_camera']);
});
test('errore permesso galleria riconosciuto senza accesso generale alle foto', async () => {
  const s = await errore({ erroreGalleria: { code: 'ERR_MISSING_PHOTO_LIBRARY_PERMISSION' } }, 'PERMESSO_NEGATO', 'galleria');
  assert.deepEqual(s.registro.map(x => x[0]), ['galleria']);
});
test('fotocamera JPEG e opzioni minimizzate, senza EXIF o base64 dell’immagine completa', async () => {
  const s = scenario({ formato: 'jpeg', uri: 'file:///cache/ImagePicker/test.jpg' });
  const r = await s.acquisitore.acquisisci({ canale: 'fotocamera' }); assert.equal(r.stato, 'pronto');
  const o = s.registro.find(x => x[0] === 'fotocamera')[1];
  assert.equal(o.exif, false); assert.equal(o.base64, false); assert.equal(o.allowsEditing, false);
  assert.equal(r.documento.larghezza, 200); assert.equal(r.documento.altezza, 100); await r.rilascia();
});
test('URI esterni, permanenti, percorsi traversal non vengono letti né cancellati', async () => {
  for (const uri of ['https://example.invalid/file.pdf', 'content://provider/document/1', 'file:///documents/file.pdf',
    'file:///cache/DocumentPicker/../original.pdf', 'file:///cache/DocumentPicker/%2e%2e%2foriginal.pdf',
    'file:///cache/DocumentPicker/test.pdf?x=1', 'file:///cache/DocumentPicker/']) {
    const s = await errore({ uri }, 'URI_NON_TEMPORANEO');
    assert.equal(s.registro.some(x => ['info', 'firma', 'elimina'].includes(x[0])), false);
  }
});
test('cache assente o piattaforma web non supportate senza letture', async () => {
  const senzaCache = await errore({ noCache: true }, 'CACHE_NON_DISPONIBILE'); assert.equal(senzaCache.registro.length, 0);
  const s = await errore({ piattaforma: 'web' }, 'PIATTAFORMA_NON_SUPPORTATA'); assert.equal(s.registro.length, 0);
});
test('guardia cache riconosce soltanto file diretti delle cartelle corrette', () => {
  assert.equal(uriCacheSelettore('file:///cache/DocumentPicker/test.pdf', 'file:///cache/', 'documento'), true);
  assert.equal(uriCacheSelettore('file:///cache/ImagePicker/test.png', 'file:///cache/', 'documento'), false);
  assert.equal(uriCacheSelettore('file:///cache/DocumentPicker/sub/test.pdf', 'file:///cache/', 'documento'), false);
  assert.equal(uriCacheSelettore('file:///cache/DocumentPicker/%00.pdf', 'file:///cache/', 'documento'), false);
});
test('più asset inattesi: rifiutati e puliti solo quelli temporanei', async () => {
  const s = scenario(); s.stato.risposta.assets.push({ ...s.stato.risposta.assets[0], uri: 'file:///documents/originale.pdf' });
  const r = await s.acquisitore.acquisisci({ canale: 'documento' });
  assert.equal(r.codice, 'SELEZIONE_NON_VALIDA'); assert.deepEqual(s.eliminati, [s.uri]);
});
test('rilascio idempotente', async () => {
  const s = scenario(), r = await s.acquisitore.acquisisci({ canale: 'documento' });
  assert.equal((await r.rilascia()).riuscita, true); assert.equal((await r.rilascia()).riuscita, true);
  assert.equal(s.eliminati.length, 1);
});
test('errore pulizia esplicito e retry locale senza salvare URI su disco', async () => {
  const s = scenario({ dimensione: LIMITE_DOCUMENTO_BYTES + 1 }); s.fallisciPulizia(true);
  const r = await s.acquisitore.acquisisci({ canale: 'documento' });
  assert.equal(r.codice, 'FILE_TROPPO_GRANDE'); assert.equal(r.puliziaRiuscita, false);
  s.fallisciPulizia(false); assert.equal((await s.acquisitore.riprovaPulizia()).riuscita, true);
  assert.equal(s.attivi.size, 0);
});
test('errore nel selettore restituito senza dettagli personali o log', async () => {
  const s = scenario({ erroreSelettore: new Error('percorso o nome sensibile simulato') });
  const r = await s.acquisitore.acquisisci({ canale: 'documento' });
  assert.equal(r.codice, 'SELEZIONE_FALLITA'); assert.equal(JSON.stringify(r).includes('sensibile'), false);
});
test('guardia concorrente non avvia due selettori', async () => {
  const s = scenario(); let continua;
  const originale = s.moduli.documenti.getDocumentAsync;
  s.moduli.documenti.getDocumentAsync = async o => { await new Promise(resolve => { continua = resolve; }); return originale(o); };
  const prima = s.acquisitore.acquisisci({ canale: 'documento' });
  const seconda = await s.acquisitore.acquisisci({ canale: 'documento' }); assert.equal(seconda.codice, 'OCCUPATO');
  continua(); const r = await prima; await r.rilascia();
});
test('nessuna scrittura calendario o rete: solo le quattro capacità locali previste', async () => {
  const s = scenario(), r = await s.acquisitore.acquisisci({ canale: 'documento' }); await r.rilascia();
  assert.deepEqual(s.registro.map(x => x[0]), ['documento', 'info', 'firma', 'elimina']);
  assert.deepEqual(Object.keys(s.porte).sort(), ['eliminaTemporaneo', 'informazioni', 'leggiFirmaBase64', 'seleziona', 'temporaneoDelSelettore'].sort());
});
test('adattatore non elimina file non restituiti da una sua selezione', async () => {
  const s = scenario(); await assert.rejects(() => s.porte.eliminaTemporaneo('file:///cache/DocumentPicker/altro.pdf'));
  assert.equal(s.eliminati.length, 0);
});
test('base64 illeggibile rifiutato e pulito', async () => { await errore({ base64: '???' }, 'FILE_NON_ACCESSIBILE'); });
test('rilasci concorrenti condividono una sola cancellazione', async () => {
  const s = scenario(), r = await s.acquisitore.acquisisci({ canale: 'documento' });
  const risultati = await Promise.all([r.rilascia(), r.rilascia()]);
  assert.ok(risultati.every(x => x.riuscita)); assert.equal(s.eliminati.length, 1);
});
test('retry pulizia dopo rilascio fallito mantiene il rilascio idempotente', async () => {
  const s = scenario(), r = await s.acquisitore.acquisisci({ canale: 'documento' });
  s.fallisciPulizia(true); assert.equal((await r.rilascia()).riuscita, false);
  s.fallisciPulizia(false); assert.equal((await s.acquisitore.riprovaPulizia()).riuscita, true);
  assert.equal((await r.rilascia()).riuscita, true); assert.equal(s.eliminati.length, 1);
});
test('pulizia fallita blocca nuove acquisizioni prima del selettore', async () => {
  const s = scenario({ dimensione: LIMITE_DOCUMENTO_BYTES + 1 }); s.fallisciPulizia(true);
  await s.acquisitore.acquisisci({ canale: 'documento' });
  const r = await s.acquisitore.acquisisci({ canale: 'documento' });
  assert.equal(r.codice, 'PULIZIA_FALLITA'); assert.equal(r.puliziaRiuscita, false);
  assert.equal(s.registro.filter(x => x[0] === 'documento').length, 1);
});
test('adattatore non permette lettura integrale o non autorizzata', async () => {
  const s = scenario(); await s.porte.seleziona('documento');
  await assert.rejects(() => s.porte.leggiFirmaBase64(s.uri, 1024));
  await assert.rejects(() => s.porte.leggiFirmaBase64('file:///documents/originale.pdf', 16));
  assert.equal(s.registro.some(x => x[0] === 'firma'), false);
});
test('PDF dalla galleria rifiutato senza interpretarlo come screenshot', async () => {
  await errore({ uri: 'file:///cache/ImagePicker/test.pdf' }, 'FORMATO_NON_IMMAGINE', 'galleria');
});
test('adattatore simulato su iOS e Android mantiene lo stesso contratto', async () => {
  for (const piattaforma of ['ios', 'android']) {
    const s = scenario({ piattaforma }), r = await s.acquisitore.acquisisci({ canale: 'documento' });
    assert.equal(r.stato, 'pronto'); assert.equal(r.documento.formato, 'pdf'); await r.rilascia();
  }
});
test('metadati opzionali mancanti restano null e risultato non modificabile', async () => {
  const s = scenario({ formato: 'png', uri: 'file:///cache/ImagePicker/test.png', nome: null });
  delete s.stato.immagine.assets[0].fileSize;
  s.stato.immagine.assets[0].width = 0; s.stato.immagine.assets[0].height = 0;
  const r = await s.acquisitore.acquisisci({ canale: 'galleria' });
  assert.equal(r.documento.nomeOriginale, null); assert.equal(r.documento.dimensioneDichiarata, null);
  assert.equal(r.documento.larghezza, null); assert.equal(r.documento.altezza, null);
  assert.throws(() => { r.documento.uriLocale = 'https://example.invalid/'; }, TypeError);
  await r.rilascia();
});
