'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { registerHooks } = require('node:module');
const { readFileSync, statSync, realpathSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.includes('/importazioneTurni/') && /^\.\/[^.]+$/.test(specifier)) return next(`${specifier}.ts`, context);
  return next(specifier, context);
} });
const { creaLettoreIOS, verificaEstrazioneIOS } = require('../importazioneTurni/letturaIOS.ts');
const { strutturaPaginaIOS } = require('../importazioneTurni/geometriaIOS.ts');
const { interpretaDocumento } = require('../importazioneTurni/interpretazione.ts');
const { creaRevisioneImportazione, creaRegistroRevisioni } = require('../importazioneTurni/revisione.ts');
const m = require('../importazioneTurni/modello.ts');
const impronta = `md5:${'a'.repeat(32)}:100`;
const acquisito = { uriLocale: 'file:///cache/DocumentPicker/turni%20ottobre.pdf', dimensioneBytes: 100,
  formato: 'pdf', tipoSorgente: 'pdf', canale: 'documento' };
const xs = [.02, .18, .34, .49, .62, .83];
function pagina(righe = [
  ['Data', 'Nome', 'Cognome', 'Matricola', 'Servizio', 'Postazione'],
  ['2026-10-19', 'Persona', 'Sintetica', '0007', '06:00-14:00', 'Sede A'],
], metodo = 'pdfkit') {
  const elementi = [], righeOriginali = [];
  righe.forEach((r, i) => r.forEach((testo, c) => {
    if (testo === null) return;
    const id = `r${i}-c${c}`, x = xs[c], y = .04 + i * .05;
    const w = c === 0 ? .13 : c === 4 ? .17 : .10;
    elementi.push({ id, testo, rettangolo: [x, y, w, .02], confidenza: null, gruppo: metodo === 'vision' ? id : null });
    if (metodo === 'vision') righeOriginali.push({ id, testo, confidenza: .87, rettangolo: [x, y, w, .02] });
  }));
  return { numero: 1, larghezza: 1200, altezza: 1600, testo: metodo === 'pdfkit' ? righe.map(r => r.join(' ')).join('\n') : null,
    elementi, righeOriginali, errore: null };
}
const documento = (p = pagina(), metodo = 'pdfkit') => ({ versione: 1, metodo, pagineAttese: 1, pagine: [p] });
function lettore(raw = documento(), extra = {}) {
  const chiamate = [];
  const modulo = { versione: 1,
    async leggiPDF(uri) { chiamate.push(['pdf', uri]); return raw; },
    async leggiImmagine(uri) { chiamate.push(['immagine', uri]); return raw; },
  };
  const porte = { modulo: () => modulo, async impronta(d) { chiamate.push(['impronta', d.uriLocale]); return impronta; }, ...extra };
  return { lettore: creaLettoreIOS(porte), chiamate };
}
test('PDF senza delimitatori: struttura da coordinate e campi leggibili senza inventare identità', async () => {
  const x = lettore(), r = await x.lettore.leggi(acquisito);
  assert.equal(r.stato, 'letto');
  const e = interpretaDocumento(r.risultato.documento), v = e.bozza.voci[0];
  assert.equal(v.rilevati.data.valore, '2026-10-19'); assert.equal(v.rilevati.inizio.valore, '06:00');
  assert.equal(v.rilevati.postazione.valore, 'Sede A');
  assert.equal(e.bozza.dipendente.rilevati.matricola.valore, '0007');
  assert.equal(e.bozza.conferma, null); assert.equal(v.confermati, null);
  assert.deepEqual(x.chiamate.map(c => c[0]), ['impronta', 'pdf', 'impronta']);
  assert.equal(x.chiamate[1][1], acquisito.uriLocale);
  assert.ok(v.rilevati.inizio.provenienza.rettangolo);
});
test('foto e screenshot usano Vision, conservano righe/coordinate e confidenza reale della riga', async () => {
  for (const tipoSorgente of ['immagine', 'screenshot']) {
    const raw = documento(pagina(undefined, 'vision'), 'vision');
    const x = lettore(raw), r = await x.lettore.leggi({ ...acquisito, formato: 'jpeg', tipoSorgente });
    assert.equal(r.stato, 'letto'); assert.equal(r.risultato.documento.tipo, tipoSorgente);
    assert.equal(r.risultato.documento.pagine[0].testo, null);
    assert.equal(r.risultato.evidenzeIOS.pagine[0].righeOriginali[0].confidenza, .87);
    assert.equal(interpretaDocumento(r.risultato.documento).bozza.voci[0].rilevati.inizio.affidabilita, null);
    assert.ok(x.chiamate.some(c => c[0] === 'immagine'));
  }
});
test('più dipendenti e matricole con zeri: scelta manuale e nessuna associazione al codice GPG', async () => {
  const p = pagina([['Data', 'Nome', 'Cognome', 'Matricola', 'Servizio', 'Postazione'],
    ['2026-10-19', 'Persona', 'Sintetica', '0007', '06:00-14:00', 'Sede A'],
    ['2026-10-19', 'Persona', 'Sintetica', '0008', '14:00-22:00', 'Sede B']]);
  const r = await lettore(documento(p)).lettore.leggi(acquisito);
  const s = creaRevisioneImportazione(r.risultato, creaRegistroRevisioni());
  assert.equal(s.anteprima().bozza, null);
  const scelto = s.anteprima().esito.candidati.find(c => c.rilevati.matricola.valore === '0008');
  s.scegliDipendente(scelto.id);
  assert.equal(m.datiEffettivi(s.anteprima().bozza.voci[0]).inizio, '14:00');
  s.selezionaRighe(['p-1/geometria-r-2']);
  assert.equal(s.anteprima().bozza.dipendente.confermati, null);
  assert.equal(s.anteprima().bozza.dipendente.rilevati.nome.valore, null);
});
test('matrice dipendenti/date complete ricostruita senza spostare celle vuote', () => {
  const p = pagina([['Nome', 'Cognome', 'Matricola', 'Postazione', '2026-10-19', '2026-10-20'],
    ['Persona', 'Sintetica', '0007', 'Sede A', null, 'Riposo']]);
  const e = interpretaDocumento({ id: 'matrice', tipo: 'pdf', testoOriginale: null, pagineAttese: 1,
    pagine: [strutturaPaginaIOS(p).pagina] });
  assert.equal(e.bozza.voci.length, 2);
  assert.equal(e.bozza.voci[0].rilevati.tipo.valore, null);
  assert.equal(e.bozza.voci[1].rilevati.data.valore, '2026-10-20');
  assert.equal(e.bozza.voci[1].rilevati.tipo.valore, 'riposo');
});
test('due servizi separati da +: ID distinti, pause escluse e notte da correggere', async () => {
  const p = pagina();
  const service = p.elementi.find(t => t.id === 'r1-c4');
  service.testo = '06:00-10:00 + 15:00-19:00';
  const r = await lettore(documento(p)).lettore.leggi(acquisito);
  assert.equal(m.riepilogaBozza(interpretaDocumento(r.risultato.documento).bozza).oreProgrammate, 8);
  service.testo = '22:00-06:00';
  const notte = await lettore(documento(p)).lettore.leggi(acquisito);
  const e = interpretaDocumento(notte.risultato.documento);
  assert.equal(m.riepilogaBozza(e.bozza).oreProgrammate, 0);
  assert.deepEqual(e.bozza.voci[0].rilevati.dataFine.alternative, ['2026-10-20']);
});
test('date ambigue e carattere O al posto di zero non corretti automaticamente', async () => {
  const p = pagina(); p.elementi.find(t => t.id === 'r1-c0').testo = '03/04/2026';
  p.elementi.find(t => t.id === 'r1-c4').testo = 'O6:00-14:00';
  const r = await lettore(documento(p)).lettore.leggi(acquisito), v = interpretaDocumento(r.risultato.documento).bozza.voci[0];
  assert.equal(v.rilevati.data.valore, null); assert.equal(v.rilevati.inizio.valore, null);
  assert.equal(v.confermati, null);
});
test('parole separate nel servizio e nella postazione ricomposte entro le colonne', async () => {
  const p = pagina();
  p.elementi = p.elementi.filter(t => !['r1-c4', 'r1-c5'].includes(t.id));
  for (const [id, testo, x, w] of [['a', '06:00-10:00', .62, .07], ['b', '+', .70, .01],
    ['c', '15:00-19:00', .72, .08], ['d', 'Sede', .83, .04], ['e', 'A', .88, .01]]) {
    p.elementi.push({ id, testo, rettangolo: [x, .09, w, .02], gruppo: null, confidenza: null });
  }
  const r = await lettore(documento(p)).lettore.leggi(acquisito);
  const b = interpretaDocumento(r.risultato.documento).bozza;
  assert.equal(b.voci.length, 2); assert.equal(m.riepilogaBozza(b).oreProgrammate, 8);
  assert.equal(b.voci[0].rilevati.postazione.valore, 'Sede A');
});
test('intestazione Data fine su due parole consente una notte esplicita', async () => {
  const p = pagina([['Data', 'Data fine', 'Inizio', 'Fine', 'Postazione', 'Matricola'],
    ['2026-10-19', '2026-10-20', '22:00', '06:00', 'Sede A', '0007']]);
  const h = p.elementi.find(t => t.id === 'r0-c1');
  h.testo = 'Data'; h.rettangolo[2] = .04;
  p.elementi.push({ id: 'header-data-fine', testo: 'fine', rettangolo: [.225, .04, .03, .02], gruppo: null, confidenza: null });
  const r = await lettore(documento(p)).lettore.leggi(acquisito);
  const b = interpretaDocumento(r.risultato.documento).bozza;
  assert.equal(m.riepilogaBozza(b).oreProgrammate, 8);
  assert.equal(b.voci[0].rilevati.dataFine.valore, '2026-10-20');
});
test('token a cavallo delle colonne: ritorno al testo originale per mappatura, nessuna riga persa', () => {
  const p = pagina(); p.elementi.find(t => t.id === 'r1-c1').rettangolo = [.18, .09, .25, .02];
  const r = strutturaPaginaIOS(p);
  assert.ok(r.avvisi.includes('PAGINA_DA_MAPPARE_MANUALMENTE'));
  assert.equal(r.pagina.righe[1].testo, p.testo.split('\n')[1]);
  assert.equal(interpretaDocumento({ id: 'd', tipo: 'pdf', testoOriginale: null, pagineAttese: 1, pagine: [r.pagina] }).bozza, null);
});
test('geometria OCR incompleta mantiene tutte le righe Vision autentiche per la selezione manuale', () => {
  const p = pagina(undefined, 'vision'); p.elementi[0].rettangolo = null;
  const r = strutturaPaginaIOS(p);
  assert.equal(r.pagina.righe.length, p.righeOriginali.length);
  assert.equal(r.pagina.righe[0].testo, p.righeOriginali[0].testo);
  assert.equal(r.pagina.righe[0].confidenza, .87);
});
test('PDF scannerizzato o ruotato: limiti espliciti, nessuna geometria inventata', async () => {
  for (const errore of ['PDF_SCANSIONE_NON_SUPPORTATA', 'GEOMETRIA_PDF_RUOTATO_NON_DISPONIBILE']) {
    const p = pagina(); p.elementi = []; p.errore = errore;
    if (errore === 'PDF_SCANSIONE_NON_SUPPORTATA') p.testo = '';
    const r = await lettore(documento(p)).lettore.leggi(acquisito);
    assert.equal(r.risultato.documento.pagine[0].errore, errore);
    assert.ok(r.risultato.documento.pagine[0].righe.every(r => r.rettangolo === null));
  }
});
test('nessun modulo o versione differente: blocco prima di leggere il file', async () => {
  for (const modulo of [null, { versione: 2 }]) {
    const x = lettore(undefined, { modulo: () => modulo });
    assert.equal((await x.lettore.leggi(acquisito)).codice, 'DECODER_LOCALE_NON_DISPONIBILE');
    assert.equal(x.chiamate.length, 0);
  }
});
test('risposte native incoerenti, ID duplicati, geometria o confidenza invalida rifiutate', () => {
  for (const modifica of [
    e => e.pagineAttese = 31, e => e.pagine[0].numero = 2,
    e => e.pagine[0].elementi[0].rettangolo = [0, 0, 2, .1],
    e => e.pagine[0].elementi[0].confidenza = 2,
    e => e.pagine[0].elementi[0].gruppo = 'riga-assente',
    e => e.pagine[0].elementi[1].id = e.pagine[0].elementi[0].id,
  ]) { const e = documento(); modifica(e); assert.throws(() => verificaEstrazioneIOS(e)); }
});
test('metodo sbagliato per il formato e file cambiato durante la lettura sono bloccati', async () => {
  const x = lettore(documento(pagina(undefined, 'vision'), 'vision'));
  assert.equal((await x.lettore.leggi(acquisito)).stato, 'bloccato');
  let n = 0;
  const y = lettore(undefined, { impronta: async () => ++n === 1 ? impronta : impronta.replace(/a/g, 'b') });
  assert.equal((await y.lettore.leggi(acquisito)).codice, 'DOCUMENTO_CAMBIATO');
});
test('errori nativi protetti e limite vengono esposti senza percorsi o dati personali', async () => {
  for (const code of ['PDF_PROTETTO', 'LIMITE_PAGINE', 'LIMITE_ELEMENTI']) {
    const x = lettore(undefined, { modulo: () => ({ versione: 1, async leggiPDF() { throw { code, message: '/privato/persona.pdf' }; } }) });
    assert.deepEqual(await x.lettore.leggi(acquisito), { stato: 'bloccato', codice: code });
  }
});
test('letture concorrenti impedite; dati originali copiati e congelati', async () => {
  let sblocca; const attesa = new Promise(resolve => { sblocca = resolve; });
  const raw = documento();
  const x = lettore(raw, { impronta: async () => { await attesa; return impronta; } });
  const prima = x.lettore.leggi(acquisito);
  assert.equal((await x.lettore.leggi(acquisito)).codice, 'LETTURA_OCCUPATA');
  sblocca(); const r = await prima;
  raw.pagine[0].elementi[0].testo = 'modificato';
  assert.equal(r.risultato.evidenzeIOS.pagine[0].elementi[0].testo, 'Data');
  assert.throws(() => r.risultato.evidenzeIOS.pagine[0].elementi[0].testo = 'no', TypeError);
});
test('nuova lettura iOS mantiene conferme obbligatorie e controllo duplicati', async () => {
  const r = await lettore().lettore.leggi(acquisito);
  const registro = creaRegistroRevisioni();
  const a = creaRevisioneImportazione(r.risultato, registro);
  assert.throws(() => a.conferma(true, []));
  const d = { nome: 'Persona', cognome: 'Sintetica', matricola: '0007' };
  for (const s of [a, creaRevisioneImportazione(r.risultato, registro)]) {
    s.correggiDipendente(d);
    for (const v of s.anteprima().bozza.voci) s.correggiVoce(v.id, m.datiEffettivi(v));
    if (s === a) { assert.throws(() => s.conferma(false, [])); s.conferma(true, []); }
    else assert.throws(() => s.conferma(true, []), /DOCUMENTO_GIA_CONFERMATO/);
  }
});
test('Metro reale sceglie il nuovo adattatore soltanto per iOS', () => {
  const { resolve } = require('metro-resolver');
  const context = { originModulePath: path.resolve('importazioneTurni/ImportaTurni.tsx'),
    assetExts: new Set(), sourceExts: ['ts', 'tsx', 'js', 'json'], preferNativePlatform: true,
    getPackageForModule: () => null,
    fileSystemLookup(p) { try { const stat = statSync(p); return { exists: true, type: stat.isDirectory() ? 'd' : 'f', realPath: realpathSync(p) }; } catch { return { exists: false }; } },
  };
  assert.ok(resolve(context, './letturaNativa', 'ios').filePath.endsWith('letturaNativa.ios.ts'));
  assert.ok(resolve(context, './letturaNativa', 'android').filePath.endsWith('letturaNativa.ts'));
});
test('adattatore iOS usa un modulo nativo reale e verifica gli URI prima di passare i file', async () => {
  const source = readFileSync('importazioneTurni/letturaNativa.ios.ts', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const chiamate = [];
  const modulo = { exports: {} };
  const raw = documento();
  vm.runInNewContext(code, { exports: modulo.exports, require(id) {
    if (id === 'expo-modules-core') return { requireOptionalNativeModule(nome) {
      chiamate.push(nome); return { versione: 1, async leggiPDF(uri) { chiamate.push(uri); return raw; } };
    } };
    if (id === 'expo-file-system/legacy') return { cacheDirectory: 'file:///cache/', async getInfoAsync() { return { exists: true, isDirectory: false, size: 100, md5: 'a'.repeat(32) }; } };
    if (id === './acquisizioneExpo') return require('../importazioneTurni/acquisizioneExpo.ts');
    if (id === './letturaIOS') return { creaLettoreIOS };
    throw new Error(id);
  } });
  const l = modulo.exports.creaLettoreNativo();
  assert.equal((await l.leggi({ ...acquisito, uriLocale: 'https://server/turni.pdf' })).stato, 'bloccato');
  assert.ok(!chiamate.some(c => c.startsWith('https://')));
  assert.equal((await l.leggi(acquisito)).stato, 'letto');
  assert.ok(chiamate.includes('TurniDocumentiIOS')); assert.ok(chiamate.includes(acquisito.uriLocale));
});
test('config locale solo Apple e nessuna simulazione o servizio esterno nei sorgenti di produzione', () => {
  const conf = require('../modules/importazione-turni-ios/expo-module.config.json');
  assert.deepEqual(conf.platforms, ['apple']); assert.equal(conf.android, undefined);
  const swift = readFileSync('modules/importazione-turni-ios/ios/TurniDocumentiIOSModule.swift', 'utf8');
  assert.match(swift, /PDFDocument\(url:/); assert.match(swift, /VNRecognizeTextRequest/);
  assert.match(swift, /usesLanguageCorrection = false/); assert.match(swift, /kCGImageSourceCreateThumbnailWithTransform: true/);
  assert.doesNotMatch(swift.replace(/^\s*\/\/.*$/gm, ''), /URLSession|https?:|fixture|sintetic|simulat/i);
  for (const f of ['letturaNativa.ios.ts', 'letturaIOS.ts', 'geometriaIOS.ts']) {
    assert.doesNotMatch(readFileSync(`importazioneTurni/${f}`, 'utf8'), /from ['"].*(fixtures|supabase|turniApi|stipendio|chat|notifiche)/i);
  }
});
