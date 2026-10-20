'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { registerHooks } = require('node:module');
registerHooks({ resolve(s, c, next) {
  return next(c.parentURL?.includes('/importazioneTurni/') && /^\.\/[^.]+$/.test(s) ? `${s}.ts` : s, c);
} });
const { leggiProspetto, nellaRegione, dataGiorno } = require('../importazioneTurni/prospetto.ts');
const { strutturaPaginaIOS } = require('../importazioneTurni/geometriaIOS.ts');
const c = { mese: '10', anno: '2026', dipendente: { nome: 'Persona test', cognome: null, matricola: null }, confermato: true };
function doc(lines) {
  return { id: 'test', tipo: 'screenshot', testoOriginale: null, pagineAttese: 1, pagine: [{ id: 'p-1', numero: 1, larghezza: 1000, altezza: 1000, rotazione: 0, testo: null, errore: null,
    righe: lines.map((testo, i) => ({ id: `r-${i}`, testo, celle: null, rettangolo: null, confidenza: null })) }] };
}
test('giorni 16–20: orari compatti e sigle da confermare, cornice esclusa', () => {
  const r = leggiProspetto(doc(['WhatsApp', '15/23', 'Rispondi Inoltra', '16 R', '17 PR', '18 15/23 NPU', '19 15/22 NPU', '20 7/19 NPU']), c);
  assert.equal(r.length, 5);
  assert.deepEqual(r.map(v => v.inizio), [null, null, '15:00', '15:00', '07:00']);
  assert.deepEqual(r.map(v => v.fine), [null, null, '23:00', '22:00', '19:00']);
  assert.deepEqual(r.slice(0, 2).map(v => [v.sigla, v.tipo]), [['R', null], ['PR', null]]);
  assert.equal(r[2].data, '2026-10-18'); assert.equal(r[2].postazione, 'NPU');
  assert.ok(r.every(v => !v.verificata));
});
test('mese/anno non confermati non vengono inventati; date impossibili respinte', () => {
  assert.equal(leggiProspetto(doc(['18 15/23 NPU', '19 riposo']), { ...c, confermato: false })[0].data, null);
  assert.equal(dataGiorno('31', { ...c, mese: '2' }), null);
});
test('più servizi, notturni e date parziali', () => {
  const r = leggiProspetto(doc(['18/10 7/12 + 15/23 Sede A', '19/10 22/6 Sede B']), c);
  assert.equal(r.length, 3); assert.equal(r[0].postazione, 'Sede A');
  assert.equal(r[2].fine, '06:00'); assert.equal(r[2].dataFine, null);
  assert.equal(leggiProspetto(doc(['18/11 7/12 A', '19/11 riposo']), c)[0].data, null);
});
test('nessun turno da contatori o testo esterno isolato', () => {
  assert.deepEqual(leggiProspetto(doc(['WhatsApp', '15/23', '18 15/23 NPU', 'Inoltra']), c), []);
});
test('tabelle con intestazione, date complete e nomi composti', () => {
  const r = leggiProspetto(doc(['Data|Nome|Cognome|Servizio|Postazione', '19/10/2026|Persona|Di Test|06:00-14:00|Sede A', '20/10/2026|Persona|Di Test|Riposo|']), c);
  assert.equal(r.length, 2); assert.equal(r[0].inizio, '06:00'); assert.equal(r[1].tipo, 'riposo');
});
test('più dipendenti richiedono una scelta esplicita', () => {
  const d = doc(['Data|Nome|Servizio|Postazione', '19/10/2026|Uno|06:00-14:00|A', '19/10/2026|Due|14:00-22:00|B']);
  assert.deepEqual(leggiProspetto(d, c), []);
});
test('regione filtra le evidenze prima della geometria; ricostruzione senza header', () => {
  const regione = { pagina: 1, x: .1, y: .2, larghezza: .8, altezza: .6 };
  assert.equal(nellaRegione([.1, .05, .2, .02], 1, regione), false);
  assert.equal(nellaRegione(null, 1, regione), false);
  assert.equal(nellaRegione([.1, .3, .1, .02], 2, regione), false);
  const elementi = [];
  [['18', '15/23', 'NPU'], ['19', '7/19', 'NPU']].forEach((r, i) => r.forEach((testo, j) => elementi.push({ id: `${i}-${j}`, testo, rettangolo: [.15 + j * .25, .3 + i * .1, .1, .03], gruppo: null, confidenza: null })));
  const p = strutturaPaginaIOS({ numero: 1, larghezza: 1000, altezza: 1000, testo: null, elementi, righeOriginali: [], errore: null }).pagina;
  const d = doc([]); d.pagine = [p];
  assert.equal(leggiProspetto(d, c).length, 2);
});
test('tabella con intestazione e orari compatti conserva dipendente e postazione', () => {
  const r = leggiProspetto(doc(['Data|Nome|Servizio|Postazione', '19/10/2026|Persona|15/23|NPU', '20/10/2026|Persona|7/19|NPU']), c);
  assert.equal(r.length, 2); assert.equal(r[0].inizio, '15:00'); assert.equal(r[1].fine, '19:00');
});
test('geometria con colonna aggiuntiva e lieve disallineamento mantiene i servizi', () => {
  const elementi = [];
  [['Data', 'Nome', 'Servizio', 'Postazione', 'Note'], ['2026-10-18', 'Persona', '15/23', 'NPU', ''], ['2026-10-19', 'Persona', '7/19', 'NPU', '']].forEach((r, i) => r.forEach((testo, j) => {
    if (testo) elementi.push({ id: `${i}-${j}`, testo, rettangolo: [.02 + j * .19, .1 + i * .1 + (j % 2 ? .008 : 0), .15, .02], gruppo: null, confidenza: null });
  }));
  const p = strutturaPaginaIOS({ numero: 1, larghezza: 1000, altezza: 1000, testo: null, elementi, righeOriginali: [], errore: null }).pagina;
  const d = doc([]); d.pagine = [p];
  const r = leggiProspetto(d, c);
  assert.equal(r.length, 2); assert.equal(r[0].inizio, '15:00');
});
