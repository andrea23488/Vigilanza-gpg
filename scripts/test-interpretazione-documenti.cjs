'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
// Risoluzione locale per Node 24; il codice app usa import senza estensione per Expo.
const { registerHooks } = require('node:module');
const risoluzione = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.includes('/importazioneTurni/') && ['./modello', './documenti'].includes(specifier)) {
    return next(`${specifier}.ts`, context);
  }
  return next(specifier, context);
} });
const d = require('../importazioneTurni/documenti.ts');
const { interpretaDocumento } = require('../importazioneTurni/interpretazione.ts');
const m = require('../importazioneTurni/modello.ts');
const f = require('../fixtures/importazioneTurni/documenti-sintetici.cjs');
risoluzione.deregister();
const copia = x => JSON.parse(JSON.stringify(x));
const codici = e => e.segnalazioni.map(s => s.codice);
function singola(contenuto, data = '2026-10-19', extra = {}) {
  return f.documento([f.pagina('p', 1, [
    f.riga('h', ['Data', 'Servizio', 'Postazione']), f.riga('r', [data, contenuto, 'SEDE TEST']),
  ])], extra);
}
test('Italpol interpretato: sette giorni, cinque turni e 39 ore senza conferme', () => {
  const e = interpretaDocumento(f.italpol());
  assert.equal(e.bozza.voci.length, 7);
  const r = m.riepilogaBozza(e.bozza);
  assert.equal(r.giorni, 7); assert.equal(r.servizi, 5); assert.equal(r.oreProgrammate, 39);
  assert.equal(e.bozza.conferma, null);
  assert.equal(e.bozza.dipendente.confermati, null);
  assert.ok(e.bozza.voci.every(v => v.confermati === null));
  assert.equal(m.prontaPerFuturoSalvataggio(e.bozza), false);
});
test('nessuna regola sul nome aziendale', () => {
  const a = f.italpol(), b = copia(a); b.testoOriginale = 'Prospetto di altra azienda sintetica';
  const estratti = x => interpretaDocumento(x).bozza.voci.map(m.datiEffettivi);
  assert.deepEqual(estratti(a), estratti(b));
});
test('layout A: colonne separate, sinonimi e due servizi nello stesso giorno', () => {
  const e = interpretaDocumento(f.tabellaColonneSeparate());
  assert.equal(e.bozza.voci.length, 2);
  assert.equal(m.riepilogaBozza(e.bozza).oreProgrammate, 12);
  assert.equal(m.riepilogaBozza(e.bozza).giorni, 1);
  assert.equal(e.bozza.voci[0].rilevati.inizio.valore, '06:00');
  assert.equal(e.bozza.voci[0].rilevati.inizio.testoOriginale, '6.00');
});
test('layout B: matrice, omonimi e selezione obbligatoria', () => {
  const doc = f.matrice(), e = interpretaDocumento(doc);
  assert.equal(e.candidati.length, 2); assert.equal(e.selezioneRichiesta, true); assert.equal(e.bozza, null);
  assert.ok(codici(e).includes('omonimi_selezione_obbligatoria'));
  const c = e.candidati.find(c => c.rilevati.matricola.valore === 'TEST-0002');
  const s = interpretaDocumento(doc, { dipendenteId: c.id });
  assert.equal(s.bozza.voci.length, 2);
  assert.equal(s.bozza.dipendente.rilevati.matricola.valore, 'TEST-0002');
  assert.equal(s.bozza.dipendente.confermati, null);
  assert.equal(m.riepilogaBozza(s.bozza).oreProgrammate, 8);
});
test('identità di solo nome non diventa certezza; matricole conservano zeri iniziali', () => {
  const doc = f.tabellaColonneSeparate();
  doc.pagine[0].righe[1].celle[0].testo = '000012';
  doc.pagine[0].righe[2].celle[0].testo = '000012';
  assert.equal(interpretaDocumento(doc).candidati[0].rilevati.matricola.valore, '000012');
  doc.pagine[0].righe[1].celle[0].testo = null; doc.pagine[0].righe[2].celle[0].testo = null;
  assert.ok(codici(interpretaDocumento(doc)).includes('identita_senza_matricola_da_verificare'));
});
test('selezione sconosciuta rifiutata', () => {
  assert.throws(() => interpretaDocumento(f.matrice(), { dipendenteId: 'inesistente' }));
});
test('multipagina: righe e pagine effettive con intestazioni ripetute', () => {
  const a = f.tabellaColonneSeparate(), p2 = copia(a.pagine[0]); p2.id = 'pagina-B'; p2.numero = 2;
  p2.righe[1].celle[1].testo = '2026-11-20'; p2.righe[2].celle[1].testo = '2026-11-20';
  a.pagine.push(p2); a.pagineAttese = 2;
  const e = interpretaDocumento(a);
  assert.equal(e.bozza.voci.length, 4);
  assert.equal(e.documento.pagine.length, 2);
  assert.equal(e.bozza.voci[2].rilevati.data.provenienza.pagina, 2);
  assert.equal(new Set(e.bozza.voci.map(v => v.id)).size, 4);
});
test('pagina assente non viene generata', () => {
  const a = f.italpol(); a.pagineAttese = 3;
  const e = interpretaDocumento(a);
  assert.equal(e.documento.pagine.length, 1); assert.equal(e.stato, 'parziale');
  assert.ok(codici(e).includes('pagine_incomplete_o_incoerenti'));
});
test('pagina illeggibile e fallimento estrazione non scompaiono', () => {
  const a = f.italpol(); a.pagine.push(f.pagina('pagina-B', 2, null, { errore: 'OCR fallito' }));
  const e = interpretaDocumento(a);
  assert.equal(e.stato, 'parziale'); assert.ok(codici(e).includes('errore_estrazione_pagina'));
});
test('nessuna intestazione viene copiata automaticamente nella pagina successiva', () => {
  const a = f.italpol(); a.pagine.push(f.pagina('pagina-B', 2, [f.riga('r', ['2026-10-26', '06:00-14:00'])]));
  const e = interpretaDocumento(a);
  assert.equal(e.bozza.voci.length, 7); assert.ok(codici(e).includes('intestazione_non_riconosciuta'));
});
test('celle incomplete conservate senza orari o data inventati', () => {
  const a = f.tabellaColonneSeparate(); a.pagine[0].righe[1].celle[2].testo = null;
  a.pagine[0].righe[2].celle[1].testo = null;
  const e = interpretaDocumento(a);
  assert.equal(e.bozza.voci[0].rilevati.inizio.valore, null);
  assert.equal(e.bozza.voci[1].rilevati.data.valore, null);
  assert.equal(e.bozza.voci[0].rilevati.dataFine.valore, null);
  assert.equal(m.riepilogaBozza(e.bozza).oreProgrammate, 0);
});
test('righe corte e celle matrice mancanti segnalate, senza scartare la giornata', () => {
  const a = f.matrice(); a.pagine[0].righe[1].celle.pop();
  const e = interpretaDocumento(a), s = interpretaDocumento(a, { dipendenteId: e.candidati[0].id });
  assert.equal(s.bozza.voci.length, 2);
  assert.equal(s.bozza.voci[1].rilevati.tipo.valore, null);
  assert.ok(codici(s).includes('contenuto_mancante'));
});
test('normalizzazione date non assume ordine, anno o validità', () => {
  const a = d.normalizzaData('03/04/2026');
  assert.equal(a.valore, null); assert.deepEqual(a.alternative, ['2026-04-03', '2026-03-04']);
  assert.equal(d.normalizzaData('03/04/2026', 'DMY').valore, '2026-04-03');
  assert.equal(d.normalizzaData('03/04/2026', 'MDY').valore, '2026-03-04');
  for (const s of ['19/10', '19/10/26', '2026-02-30', '31/04/2026', '']) assert.equal(d.normalizzaData(s).valore, null);
  assert.equal(d.normalizzaData('19/10/2026').valore, '2026-10-19');
});
test('normalizzazione orari preserva originale, non corregge O in zero', () => {
  assert.deepEqual(d.normalizzaOra(' 6.00 '), { originale: ' 6.00 ', valore: '06:00', alternative: [], problema: null });
  for (const s of ['6', 'O6:00', '24:00', '06:70', '6/14', '']) assert.equal(d.normalizzaOra(s).valore, null);
});
test('date ambigue arrivano nella bozza come alternative e non ore certe', () => {
  const e = interpretaDocumento(singola('06:00-14:00', '03/04/2026'));
  assert.equal(e.bozza.voci[0].rilevati.data.valore, null);
  assert.equal(e.bozza.voci[0].rilevati.data.alternative.length, 2);
  assert.equal(m.riepilogaBozza(e.bozza).oreProgrammate, 0);
});
test('notte senza data finale propone soltanto il giorno successivo', () => {
  const e = interpretaDocumento(singola('22:00-06:00', '2026-12-31')), v = e.bozza.voci[0];
  assert.equal(v.rilevati.dataFine.valore, null);
  assert.deepEqual(v.rilevati.dataFine.alternative, ['2027-01-01']);
  assert.equal(v.rilevati.dataFine.testoOriginale, '');
  assert.equal(v.rilevati.dataFine.affidabilita, null);
  assert.equal(m.riepilogaBozza(e.bozza).oreProgrammate, 0);
  assert.ok(codici(e).includes('notte_data_fine_da_verificare'));
});
test('notte con data esplicita: otto ore, fonte originale conservata', () => {
  const e = interpretaDocumento(singola('22:00-06:00 del 2026-10-20'));
  assert.equal(e.bozza.voci[0].rilevati.dataFine.valore, '2026-10-20');
  assert.equal(m.riepilogaBozza(e.bozza).oreProgrammate, 8);
  assert.ok(codici(e).includes('attraversamento_mezzanotte'));
});
test('orari uguali e testo residuo non producono durate inventate', () => {
  for (const testo of ['06:00-06:00', '6-14', '06:00-14:00 ???']) {
    const e = interpretaDocumento(singola(testo));
    assert.equal(m.riepilogaBozza(e.bozza).oreProgrammate, 0);
  }
});
test('riposo, assenza e MF separati senza mapping economico', () => {
  for (const [s, tipo] of [['Riposo', 'riposo'], ['Malattia', 'assenza'], ['MF', 'causale'], ['XYZ', 'causale']]) {
    const e = interpretaDocumento(singola(s)), v = m.datiEffettivi(e.bozza.voci[0]);
    assert.equal(v.tipo, tipo); assert.equal(v.causale?.associazioneConfermata ?? null, null);
    assert.equal(m.riepilogaBozza(e.bozza).oreProgrammate, 0);
    if (tipo !== 'riposo') assert.equal(v.causale.codice, s);
  }
});
test('confidenza assente resta null, confidenza reale preservata', () => {
  const a = singola('06:00-14:00'); a.pagine[0].righe[1].celle[1].confidenza = 0.72;
  const v = interpretaDocumento(a).bozza.voci[0];
  assert.equal(v.rilevati.inizio.affidabilita, 0.72);
  assert.equal(v.rilevati.data.affidabilita, null);
  assert.equal(v.rilevati.dataFine.affidabilita, null);
});
test('coordinate mancanti, pagina ignota e nessuna geometria costruita', () => {
  const a = singola('06:00-14:00'); a.pagine[0].numero = null;
  const e = interpretaDocumento(a), v = e.bozza.voci[0];
  assert.equal(v.rilevati.data.provenienza.pagina, null);
  assert.equal(v.rilevati.data.provenienza.rettangolo, null);
  assert.equal(e.documento.pagine[0].numero, null);
});
test('coordinate ruotate 0, 90, 180, 270 e geometria non verificabile', () => {
  const t = { testo: 'x', confidenza: null, rettangolo: { x: 10, y: 40, larghezza: 20, altezza: 60, unita: 'pixel' } };
  const p = f.pagina('p', 1, [], { larghezza: 100, altezza: 200, rotazione: 0 });
  const attesi = [[0.1, 0.2, 0.2, 0.3], [0.2, 0.7, 0.3, 0.2], [0.7, 0.5, 0.2, 0.3], [0.5, 0.1, 0.3, 0.2]];
  [0, 90, 180, 270].forEach((rotazione, i) => {
    const a = d.normalizzaRettangolo(t, { ...p, rotazione });
    a.forEach((v, j) => assert.ok(Math.abs(v - attesi[i][j]) < 1e-9));
  });
  assert.equal(d.normalizzaRettangolo(t, { ...p, rotazione: null }), null);
  assert.equal(d.normalizzaRettangolo(t, { ...p, larghezza: null }), null);
  assert.equal(d.normalizzaRettangolo({ ...t, rettangolo: { ...t.rettangolo, x: -1 } }, p), null);
});
test('geometria ruotata passa alla provenienza, originale preservata', () => {
  const a = singola('06:00-14:00'); a.pagine[0].rotazione = 90;
  a.pagine[0].righe[1].celle[0].rettangolo = { x: 0.1, y: 0.2, larghezza: 0.2, altezza: 0.3, unita: 'normalizzata' };
  const e = interpretaDocumento(a), r = e.bozza.voci[0].rilevati.data.provenienza.rettangolo;
  assert.equal(r[0], 0.2); assert.ok(Math.abs(r[1] - 0.7) < 1e-9);
  assert.equal(e.documento.pagine[0].righe[1].celle[0].rettangolo.x, 0.1);
});
test('testo delimitato interpretato senza fabbricare celle', () => {
  const a = f.documento([f.pagina('p', null, [
    f.riga('h', [], { celle: null, testo: 'Data | Servizio | Postazione' }),
    f.riga('r', [], { celle: null, testo: '2026-10-19 | 06:00-14:00 | SEDE TEST' }),
  ])]);
  const e = interpretaDocumento(a);
  assert.equal(e.documento.pagine[0].righe[1].celle, null);
  assert.equal(e.bozza.voci[0].rilevati.inizio.provenienza.rettangolo, null);
  assert.equal(m.riepilogaBozza(e.bozza).oreProgrammate, 8);
});
test('testo libero o documento vuoto: nessuna riga o bozza inventata', () => {
  const a = f.documento([f.pagina('p', null, null, { testo: 'testo libero non strutturato' })]);
  assert.equal(interpretaDocumento(a).stato, 'non_supportato');
  assert.equal(interpretaDocumento(a).bozza, null);
  const e = interpretaDocumento(f.documento([])); assert.equal(e.stato, 'illeggibile'); assert.equal(e.bozza, null);
});
test('identificativi duplicati e confidenze invalide rifiutati', () => {
  const a = f.italpol(); a.pagine.push(copia(a.pagine[0])); assert.throws(() => interpretaDocumento(a));
  const b = f.italpol(); b.pagine[0].righe[1].celle[0].confidenza = 2; assert.throws(() => interpretaDocumento(b));
});
test('più servizi nella stessa cella, senza ore nel vuoto', () => {
  const e = interpretaDocumento(singola('06:00-10:00 + 15:00-19:00'));
  assert.equal(e.bozza.voci.length, 2); assert.equal(m.riepilogaBozza(e.bozza).oreProgrammate, 8);
});
test('intestazioni ambigue non assegnano colonne arbitrariamente', () => {
  const a = f.documento([f.pagina('p', 1, [f.riga('h', ['Data', 'Servizio', 'Orario']), f.riga('r', ['2026-10-19', '06:00-14:00', '08:00-16:00'])])]);
  const e = interpretaDocumento(a); assert.equal(e.bozza, null); assert.ok(codici(e).includes('intestazione_ambigua'));
});
test('nessuna mutazione input e output congelato; tutti i tipi sorgente', () => {
  for (const tipo of ['pdf', 'immagine', 'screenshot']) {
    const a = f.italpol(); a.tipo = tipo; const prima = JSON.stringify(a), e = interpretaDocumento(a);
    assert.equal(JSON.stringify(a), prima); assert.equal(e.bozza.sorgenti[0].tipo, tipo);
    assert.throws(() => { e.documento.pagine.push({}); }, TypeError);
  }
});
test('data incompleta nelle intestazioni matrice non perde silenziosamente la colonna', () => {
  const a = f.matrice(); a.pagine[0].righe[0].celle[5].testo = '20/10';
  const e = interpretaDocumento(a), s = interpretaDocumento(a, { dipendenteId: e.candidati[0].id });
  assert.equal(s.bozza.voci.length, 2);
  assert.equal(s.bozza.voci[1].rilevati.data.valore, null);
  assert.equal(s.bozza.voci[1].rilevati.data.testoOriginale, '20/10');
});
test('colonna senza ruolo viene preservata e segnalata come parziale', () => {
  const a = f.matrice(); a.pagine[0].righe[0].celle[5].testo = null;
  const e = interpretaDocumento(a);
  assert.equal(e.stato, 'parziale'); assert.ok(codici(e).includes('colonna_senza_ruolo'));
  assert.equal(e.documento.pagine[0].righe[1].celle[5].testo, 'Riposo');
});
test('orari segmentati conservano testo integrale della cella di provenienza', () => {
  const a = singola('06:00-10:00 + 15:00-19:00'), e = interpretaDocumento(a);
  assert.equal(e.bozza.voci[0].rilevati.inizio.testoOriginale, '06:00-10:00 + 15:00-19:00');
  assert.equal(e.bozza.voci[1].rilevati.inizio.testoOriginale, '06:00-10:00 + 15:00-19:00');
});
test('data finale diurna derivata ha fonte e segnalazione, senza confidenza inventata', () => {
  const e = interpretaDocumento(singola('06:00-14:00')), v = e.bozza.voci[0];
  assert.equal(v.rilevati.dataFine.valore, '2026-10-19');
  assert.equal(v.rilevati.dataFine.testoOriginale, '2026-10-19');
  assert.equal(v.rilevati.dataFine.affidabilita, null);
  assert.ok(codici(e).includes('data_fine_derivata_stessa_giornata'));
});
