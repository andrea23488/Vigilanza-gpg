'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { registerHooks } = require('node:module');
const { readFileSync } = require('node:fs');
registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.includes('/importazioneTurni/') && /^\.\/[^.]+$/.test(specifier)) return next(`${specifier}.ts`, context);
  return next(specifier, context);
} });
const { creaLettoreDocumenti, righeDaTesto, MAX_PAGINE, MAX_TESTO, MAX_RIGHE } = require('../importazioneTurni/lettura.ts');
const { creaRevisioneImportazione, creaRegistroRevisioni, suggerisciDipendenti } = require('../importazioneTurni/revisione.ts');
const { interpretaDocumento } = require('../importazioneTurni/interpretazione.ts');
const m = require('../importazioneTurni/modello.ts');
const f = require('../fixtures/importazioneTurni/documenti-sintetici.cjs');
const impronta = `md5:${'a'.repeat(32)}:100`;
const persona = { nome: 'Persona', cognome: 'Sintetica', matricola: 'TEST-0001' };
const acquisito = { uriLocale: 'file:///cache/DocumentPicker/test.pdf', formato: 'pdf', tipoSorgente: 'pdf', dimensioneBytes: 100 };
const header = 'Data|Nome|Cognome|Matricola|Servizio|Postazione';
const turno = '2026-10-19|Persona|Sintetica|TEST-0001|06:00-14:00|SEDE TEST';
function lettore(extra = {}) {
  const chiamate = [];
  const porte = {
    async impronta(d) { chiamate.push(['impronta', d.uriLocale]); return impronta; },
    async pdfDisponibile() { return true; }, async immaginiDisponibili() { return true; },
    async numeroPagine(uri) { chiamate.push(['pagine', uri]); return 1; },
    async testoPagina(uri, n) { chiamate.push(['pagina', uri, n]); return `${header}\n${turno}`; },
    async testoImmagine(uri) { chiamate.push(['immagine', uri]); return [header, turno]; }, ...extra,
  };
  return { lettore: creaLettoreDocumenti(porte), chiamate };
}
function sessione(doc = f.italpol(), registro = creaRegistroRevisioni()) {
  return creaRevisioneImportazione({ impronta, documento: doc, avvisi: [] }, registro);
}
function confermaVoci(s, d = persona) {
  s.correggiDipendente(d);
  for (const v of s.anteprima().bozza.voci) {
    const dati = m.datiEffettivi(v);
    if (dati.tipo === 'causale') s.escludi(v.id, true);
    else s.correggiVoce(v.id, dati);
  }
}
test('PDF locale: URI passato al decoder per ogni pagina, testo e righe preservati', async () => {
  const x = lettore(); const r = await x.lettore.leggi(acquisito);
  assert.equal(r.stato, 'letto'); assert.equal(r.risultato.impronta, impronta);
  assert.equal(r.risultato.documento.pagine[0].testo, `${header}\n${turno}`);
  assert.equal(r.risultato.documento.pagine[0].righe[1].testo, turno);
  assert.deepEqual(x.chiamate.map(c => c[0]), ['impronta', 'pagine', 'pagina', 'impronta']);
  assert.equal(x.chiamate[2][1], acquisito.uriLocale);
  assert.equal(interpretaDocumento(r.risultato.documento).bozza.voci.length, 1);
});
test('foto e screenshot passano davvero al decoder immagini, senza geometria fabbricata', async () => {
  for (const tipoSorgente of ['immagine', 'screenshot']) {
    const x = lettore(); const r = await x.lettore.leggi({ ...acquisito, formato: 'png', tipoSorgente });
    assert.equal(r.stato, 'letto'); assert.equal(r.risultato.documento.tipo, tipoSorgente);
    assert.equal(r.risultato.documento.testoOriginale, null);
    assert.equal(r.risultato.documento.pagine[0].testo, null);
    assert.equal(r.risultato.documento.pagine[0].righe[0].confidenza, null);
    assert.equal(r.risultato.documento.pagine[0].righe[0].rettangolo, null);
    assert.ok(x.chiamate.some(c => c[0] === 'immagine'));
  }
});
test('decoder assente/incompatibile restituisce blocco prima di leggere il file', async () => {
  for (const formato of ['pdf', 'png']) {
    const x = lettore({ pdfDisponibile: async () => false, immaginiDisponibili: async () => false });
    assert.equal((await x.lettore.leggi({ ...acquisito, formato })).codice, 'DECODER_LOCALE_NON_DISPONIBILE');
    assert.deepEqual(x.chiamate, []);
  }
});
test('PDF scannerizzato segnala OCR mancante e non produce servizi', async () => {
  const x = lettore({ testoPagina: async () => '' });
  const r = await x.lettore.leggi(acquisito);
  assert.ok(r.risultato.avvisi.includes('OCR_PDF_SCANNERIZZATO_NON_DISPONIBILE'));
  assert.equal(interpretaDocumento(r.risultato.documento).bozza, null);
});
test('PDF protetto: codice stabile, nessuna password o messaggio personale esposto', async () => {
  const x = lettore({ numeroPagine: async () => { throw Object.assign(new Error('/privato/persona.pdf'), { code: 'PASSWORD_REQUIRED' }); } });
  assert.deepEqual(await x.lettore.leggi(acquisito), { stato: 'bloccato', codice: 'PDF_PROTETTO' });
});
test('multipagina parziale: pagina fallita conservata, quelle leggibili restano disponibili', async () => {
  const x = lettore({ numeroPagine: async () => 3, testoPagina: async (_, n) => {
    if (n === 2) throw new Error('errore personale'); return `${header}\n${turno}`;
  } });
  const r = await x.lettore.leggi(acquisito);
  assert.equal(r.risultato.documento.pagine.length, 3);
  assert.equal(r.risultato.documento.pagine[1].errore, 'ESTRAZIONE_PAGINA_FALLITA');
  assert.equal(interpretaDocumento(r.risultato.documento).stato, 'parziale');
});
test('dimensioni, numero pagine e testo eccessivi bloccati senza troncamenti silenziosi', async () => {
  assert.equal((await lettore().lettore.leggi({ ...acquisito, dimensioneBytes: 21 * 1024 * 1024 })).codice, 'DIMENSIONE_NON_VALIDA');
  for (const n of [0, 1.5, MAX_PAGINE + 1]) assert.equal((await lettore({ numeroPagine: async () => n }).lettore.leggi(acquisito)).codice, 'LIMITE_O_NUMERO_PAGINE_NON_VALIDO');
  assert.equal((await lettore({ testoPagina: async () => 'x'.repeat(MAX_TESTO + 1) }).lettore.leggi(acquisito)).codice, 'LIMITE_TESTO');
});
test('file cambiato durante lettura e impronta assente impediscono conferme su altro contenuto', async () => {
  let n = 0;
  const x = lettore({ impronta: async () => ++n === 1 ? impronta : impronta.replace(/a/g, 'b') });
  assert.equal((await x.lettore.leggi(acquisito)).codice, 'DOCUMENTO_CAMBIATO');
  assert.equal((await lettore({ impronta: async () => '' }).lettore.leggi(acquisito)).codice, 'IMPRONTA_NON_VERIFICABILE');
});
test('numero righe limitato anche tra pagine e frammenti OCR', async () => {
  assert.throws(() => righeDaTesto('\n'.repeat(MAX_RIGHE)), /LIMITE_RIGHE/);
  const testo = Array.from({ length: 3000 }, () => 'riga').join('\n');
  const x = lettore({ numeroPagine: async () => 2, testoPagina: async () => testo });
  assert.equal((await x.lettore.leggi(acquisito)).codice, 'LIMITE_RIGHE');
  const y = lettore({ testoImmagine: async () => Array.from({ length: MAX_RIGHE + 1 }, () => 'riga') });
  assert.equal((await y.lettore.leggi({ ...acquisito, formato: 'png' })).codice, 'LIMITE_RIGHE');
});
test('letture concorrenti rifiutate; il lettore torna disponibile dopo errore', async () => {
  let sblocca; const attesa = new Promise(resolve => { sblocca = resolve; });
  const x = lettore({ numeroPagine: async () => { await attesa; return 1; } });
  const prima = x.lettore.leggi(acquisito);
  assert.equal((await x.lettore.leggi(acquisito)).codice, 'LETTURA_OCCUPATA');
  sblocca(); assert.equal((await prima).stato, 'letto');
  assert.equal((await x.lettore.leggi(acquisito)).stato, 'letto');
});
test('separatori espliciti mantengono celle vuote; spazi e separatori misti restano ambigui', () => {
  assert.equal(righeDaTesto('A||C')[0].celle[1].testo, null);
  assert.equal(righeDaTesto('A  B  C')[0].celle, null);
  assert.deepEqual(righeDaTesto('A|B;C')[0].celle, []);
  const d = f.documento([f.pagina('p', 1, righeDaTesto('Data|Servizio;Postazione\n2026-10-19|06:00-14:00;Sede'))]);
  assert.equal(interpretaDocumento(d).bozza, null);
});
test('più servizi nello stesso giorno mantengono ID separati e non contano le pause', async () => {
  const x = lettore({ testoPagina: async () => `${header}\n${turno.replace('06:00-14:00', '06:00-10:00 + 15:00-19:00')}` });
  const r = await x.lettore.leggi(acquisito), s = sessione(r.risultato.documento);
  assert.equal(s.anteprima().riepilogo.servizi, 2); assert.equal(s.anteprima().riepilogo.oreProgrammate, 8);
  assert.equal(new Set(s.anteprima().bozza.voci.map(v => v.id)).size, 2);
});
test('notte senza data finale: alternativa, zero ore certe, correzione esplicita obbligatoria', async () => {
  const r = await lettore({ testoPagina: async () => `${header}\n${turno.replace('06:00-14:00', '22:00-06:00')}` }).lettore.leggi(acquisito);
  const s = sessione(r.risultato.documento), v = s.anteprima().bozza.voci[0];
  assert.equal(s.anteprima().riepilogo.oreProgrammate, 0);
  assert.deepEqual(v.rilevati.dataFine.alternative, ['2026-10-20']);
  s.correggiDipendente(persona);
  assert.throws(() => s.correggiVoce(v.id, m.datiEffettivi(v)));
  s.correggiVoce(v.id, { ...m.datiEffettivi(v), dataFine: '2026-10-20' });
  assert.equal(s.anteprima().riepilogo.oreProgrammate, 8);
  assert.equal(s.conferma(true, []).bozza.conferma.esplicita, true);
});
test('notte esplicita e servizio del giorno successivo: conflitto riconosciuto', () => {
  const s = sessione(); confermaVoci(s);
  const notte = s.anteprima().bozza.voci.find(v => m.datiEffettivi(v).inizio === '22:00');
  const d = m.datiEffettivi(notte);
  const esistenti = [{ id: 'precedente', dati: { ...d, data: '2026-10-23', dataFine: '2026-10-23', inizio: '05:00', fine: '07:00' } }];
  assert.ok(s.conflitti(esistenti).some(c => c.tipo === 'sovrapposizione'));
  assert.throws(() => s.conferma(true, esistenti));
});
test('nome o matricola suggeriscono candidati, omonimi e discordanza non diventano conferme', () => {
  const e = interpretaDocumento(f.matrice());
  const perMatricola = suggerisciDipendenti(e.candidati, persona);
  assert.equal(perMatricola.filter(c => c.corrispondenza === 'matricola').length, 1);
  assert.equal(perMatricola.find(c => c.corrispondenza === 'nome').discordanza, true);
  const perNome = suggerisciDipendenti(e.candidati, { ...persona, matricola: null });
  assert.equal(perNome.length, 2); assert.equal(e.bozza, null);
});
test('zeri iniziali matricola mai eliminati', () => {
  const doc = f.tabellaColonneSeparate(); doc.pagine[0].righe[1].celle[0].testo = '00012';
  const candidati = interpretaDocumento(doc).candidati;
  assert.equal(suggerisciDipendenti(candidati, { nome: null, cognome: null, matricola: '12' }).length, 0);
  assert.equal(suggerisciDipendenti(candidati, { nome: null, cognome: null, matricola: '00012' }).length, 1);
});
test('prospetto multipersona: scelta manuale alternativa anche con identità OCR errata', () => {
  const s = sessione(f.matrice()); assert.equal(s.anteprima().bozza, null);
  s.selezionaRighe(['pagina-A/persona-B']);
  assert.equal(s.anteprima().bozza.voci.length, 2);
  assert.equal(s.anteprima().bozza.dipendente.rilevati.nome.valore, null);
  assert.equal(s.anteprima().bozza.dipendente.confermati, null);
  s.correggiDipendente({ nome: 'Nome corretto', cognome: null, matricola: 'ALTRO' });
  assert.equal(s.anteprima().bozza.dipendente.confermati.matricola, 'ALTRO');
});
test('righe sconosciute, selezione vuota e combinazione candidato/manuale rifiutate', () => {
  const s = sessione(f.matrice());
  assert.throws(() => s.selezionaRighe(['inesistente']));
  assert.throws(() => s.selezionaRighe([]));
  assert.throws(() => interpretaDocumento(f.matrice(), { dipendenteId: 'qualcuno', righeManuali: ['pagina-A/persona-A'] }));
  s.scegliDipendente(s.anteprima().esito.candidati[0].id);
  assert.throws(() => s.scegliDipendente('inesistente'));
  s.ordineDate('DMY'); // La scelta rifiutata non avvelena lo stato interno.
  assert.equal(s.anteprima().bozza.voci.length, 2);
});
test('correzione manuale di testo non strutturato preserva fonte ed evidenza originali', () => {
  const doc = f.documento([f.pagina('p-1', 1, righeDaTesto('2026-10-19 Persona O6:00-14:00 Sede'))]);
  const s = sessione(doc); assert.equal(s.anteprima().bozza, null);
  s.intestazioneManuale('p-1', ['Data', 'Nome', 'Servizio', 'Postazione']);
  s.mappaRiga('p-1', 'r-1', ['2026-10-19', 'Persona', '06:00-14:00', 'Sede']);
  assert.equal(s.anteprima().bozza.voci.length, 1);
  const v = s.anteprima().bozza.voci[0];
  assert.equal(v.rilevati.inizio.testoOriginale, doc.pagine[0].righe[0].testo);
  assert.equal(v.rilevati.inizio.affidabilita, null);
  assert.deepEqual(s.anteprima().originale.documento, doc);
  assert.equal(s.anteprima().bozza.dipendente.rilevati.nome.testoOriginale, doc.pagine[0].righe[0].testo);
  assert.equal(s.anteprima().mappature.length, 2);
  assert.equal(s.anteprima().bozza.conferma, null);
});
test('data ambigua e ora OCR O6:00 mai corrette automaticamente', async () => {
  const r = await lettore({ testoPagina: async () => `${header}\n${turno.replace('2026-10-19', '03/04/2026').replace('06:00', 'O6:00')}` }).lettore.leggi(acquisito);
  const s = sessione(r.risultato.documento), v = s.anteprima().bozza.voci[0];
  assert.equal(v.rilevati.data.valore, null); assert.equal(v.rilevati.inizio.valore, null);
  assert.equal(s.anteprima().riepilogo.oreProgrammate, 0);
  assert.throws(() => s.conferma(true, []));
});
test('conferma esplicita, identità e voci obbligatorie; snapshot esistenti obbligatorio', () => {
  const s = sessione(); assert.throws(() => s.conferma(true, [])); confermaVoci(s);
  assert.throws(() => s.conferma(false, [])); assert.throws(() => s.conferma(true));
  assert.equal(s.conferma(true, []).ricevuta.stato, 'bozza_confermata');
});
test('lettura parziale richiede accettazione distinta e la registra nella ricevuta', () => {
  const doc = f.italpol(); doc.pagineAttese = 2;
  const s = sessione(doc); confermaVoci(s);
  assert.equal(s.anteprima().esito.stato, 'parziale');
  assert.throws(() => s.conferma(true, []), /LETTURA_PARZIALE_DA_ACCETTARE/);
  assert.throws(() => s.accettaLetturaParziale(false));
  s.accettaLetturaParziale(true);
  assert.equal(s.conferma(true, []).ricevuta.letturaParzialeAccettata, true);
  s.ordineDate('DMY');
  assert.equal(s.anteprima().letturaParzialeAccettata, false);
});
test('documenti duplicati bloccati anche con URI/ID documento differenti', () => {
  const registro = creaRegistroRevisioni(), a = sessione(f.italpol(), registro);
  confermaVoci(a); a.conferma(true, []);
  const doc = f.italpol(); doc.id = 'altro-file-stesso-contenuto';
  const b = sessione(doc, registro); confermaVoci(b);
  assert.throws(() => b.conferma(true, []), /DOCUMENTO_GIA_CONFERMATO/);
  assert.throws(() => a.conferma(true, []), /DOCUMENTO_GIA_CONFERMATO/);
});
test('stesso PDF per altro dipendente non è un documento duplicato', () => {
  const registro = creaRegistroRevisioni();
  for (const i of [0, 1]) {
    const s = sessione(f.matrice(), registro);
    s.scegliDipendente(s.anteprima().esito.candidati[i].id);
    const d = { ...persona, matricola: `TEST-000${i + 1}` }; s.correggiDipendente(d);
    for (const v of s.anteprima().bozza.voci) {
      const dati = m.datiEffettivi(v);
      if (dati.tipo === 'assenza') s.escludi(v.id, true); else s.correggiVoce(v.id, dati);
    }
    assert.equal(s.conferma(true, []).bozza.conferma.esplicita, true);
  }
});
test('registro ricostruito da ricevute; cambio ortografico nome con stessa matricola resta duplicato', () => {
  const a = sessione(); confermaVoci(a); const r = a.conferma(true, []).ricevuta;
  const registro = creaRegistroRevisioni([r]), b = sessione(f.italpol(), registro);
  confermaVoci(b, { ...persona, nome: 'Nome corretto' });
  assert.throws(() => b.conferma(true, []), /DOCUMENTO_GIA_CONFERMATO/);
});
test('turno già esistente blocca anche un file con impronta diversa; nessuna mutazione del calendario', () => {
  const s = sessione(); confermaVoci(s);
  const esistenti = [{ id: 'cloud-1', dati: m.datiEffettivi(s.anteprima().bozza.voci[0]) }];
  const prima = JSON.stringify(esistenti);
  assert.throws(() => s.conferma(true, esistenti)); assert.equal(JSON.stringify(esistenti), prima);
  assert.equal(s.anteprima().bozza.conferma, null);
});
test('duplicati interni non rimossi né sovrascritti', () => {
  const doc = f.tabellaColonneSeparate(); doc.pagine[0].righe[2].celle = structuredClone(doc.pagine[0].righe[1].celle);
  const s = sessione(doc); confermaVoci(s);
  assert.equal(s.anteprima().bozza.voci.length, 2); assert.throws(() => s.conferma(true, []));
});
test('correzioni invalidano conferma finale e cambio dipendente invalida le voci', () => {
  const s = sessione(); confermaVoci(s); s.conferma(true, []);
  const v = s.anteprima().bozza.voci[0]; s.correggiVoce(v.id, { ...m.datiEffettivi(v), postazione: 'Altra sede' });
  assert.equal(s.anteprima().bozza.conferma, null);
  s.correggiDipendente({ ...persona, matricola: 'ALTRA' });
  assert.ok(s.anteprima().bozza.voci.every(v => v.confermati === null));
});
test('nessuna conferma se tutte le righe sono escluse; MF non diventa trattamento economico', () => {
  const s = sessione(); s.correggiDipendente(persona);
  const mf = s.anteprima().bozza.voci.find(v => m.datiEffettivi(v).tipo === 'causale');
  assert.throws(() => s.correggiVoce(mf.id, m.datiEffettivi(mf)));
  for (const v of s.anteprima().bozza.voci) s.escludi(v.id, true);
  assert.throws(() => s.conferma(true, []));
});
test('originali e anteprime congelati, separati dagli input', () => {
  const doc = f.italpol(), s = sessione(doc), prima = JSON.stringify(s.anteprima());
  doc.pagine[0].righe[1].celle[0].testo = 'CAMBIATO';
  assert.equal(JSON.stringify(s.anteprima()), prima);
  assert.throws(() => { s.anteprima().originale.documento.id = 'no'; }, TypeError);
});
test('dipendenze Android incompatibili escluse; nessun collegamento a servizi o scritture calendario', () => {
  const pkg = require('../package.json');
  assert.deepEqual(pkg.expo.autolinking.android.exclude, ['expo-pdf-text-extract', 'expo-text-extractor']);
  for (const nome of ['lettura.ts', 'letturaNativa.ts', 'revisione.ts', 'ImportaTurni.tsx']) {
    const sorgente = readFileSync(new URL(`../importazioneTurni/${nome}`, `file://${__filename}`), 'utf8');
    assert.doesNotMatch(sorgente, /from ['"].*(supabase|turniApi|stipendio|notifiche|App\.js)/i);
    assert.doesNotMatch(sorgente, /\b(fetch|XMLHttpRequest|creaTurnoUtente|aggiornaTurnoUtente)\s*\(/);
  }
});
