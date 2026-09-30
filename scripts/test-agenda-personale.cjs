const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function caricaModulo(percorso, nomi, extra = {}) {
  const file = fs.readFileSync(percorso, 'utf8');
  const sorgente = file
    .replace(/^import .*;$/gm, '')
    .replaceAll('export async function ', 'async function ')
    .replaceAll('export function ', 'function ')
    .replaceAll('export const ', 'const ') +
    `\nmodule.exports = { ${nomi.join(', ')} };`;
  const sandbox = {
    module: { exports: {} }, exports: {}, Date, Set, Map, Math, JSON,
    console: { warn() {}, log() {} }, process: { env: { EXPO_OS: 'ios' } },
    Platform: { OS: 'ios' },
    ...extra,
  };
  vm.runInNewContext(sorgente, sandbox);
  return sandbox.module.exports;
}

const agenda = caricaModulo('agendaPersonale.js', [
  'CHIAVE_IMPEGNI_PERSONALI', 'chiaveStorageAgenda', 'normalizzaPromemoria', 'normalizzaImpegnoPersonale',
  'validaImpegnoPersonale', 'impegniDelGiorno', 'caricaImpegniPersonali',
  'salvaImpegniPersonali', 'upsertImpegnoPersonale', 'rimuoviImpegnoPersonale',
]);

const memoria = new Map();
const storage = {
  async getItem(k) { return memoria.has(k) ? memoria.get(k) : null; },
  async setItem(k, v) { memoria.set(k, v); },
};

(async () => {
  const base = { id: 'a', titolo: 'Dentista', anno: 2026, mese: 10, giorno: 3, inizio: '17:30', fine: '18:30', promemoria: [60, 1440] };
  assert.equal(agenda.chiaveStorageAgenda('utente@example.com'), '@vigilanza_gpg_impegni_personali_v1:utente_example_com');
  assert.equal(agenda.validaImpegnoPersonale(base).valido, true);
  assert.equal(agenda.validaImpegnoPersonale({ ...base, titolo: '' }).valido, false);
  assert.deepEqual(Array.from(agenda.normalizzaPromemoria([60, 60, 120, 180])), [60, 120]);

  let lista = [];
  let risultato = await agenda.upsertImpegnoPersonale(storage, lista, base);
  assert.equal(risultato.ok, true);
  lista = risultato.impegni;
  risultato = await agenda.upsertImpegnoPersonale(storage, lista, { ...base, titolo: 'Dentista controllo' });
  lista = risultato.impegni;
  assert.equal(lista.length, 1);
  assert.equal(lista[0].titolo, 'Dentista controllo');

  risultato = await agenda.upsertImpegnoPersonale(storage, lista, { ...base, id: 'b', titolo: 'Palestra', inizio: '20:00' });
  lista = risultato.impegni;
  assert.equal(agenda.impegniDelGiorno(lista, 2026, 10, 3).length, 2);
  assert.equal((await agenda.caricaImpegniPersonali(storage)).length, 2);
  lista = await agenda.rimuoviImpegnoPersonale(storage, lista, 'a');
  assert.equal(lista.length, 1);

  const chiamate = { cancellate: [], programmate: [] };
  const Notifications = {
    SchedulableTriggerInputTypes: { DATE: 'date' }, AndroidImportance: { DEFAULT: 3 },
    async getPermissionsAsync() { return { status: 'granted' }; },
    async requestPermissionsAsync() { return { status: 'granted' }; },
    async setNotificationChannelAsync() {},
    async cancelScheduledNotificationAsync(id) { chiamate.cancellate.push(id); },
    async scheduleNotificationAsync(payload) { chiamate.programmate.push(payload); return `n-${chiamate.programmate.length}`; },
  };
  const promemoria = caricaModulo('promemoriaPersonali.js', [
    'dataInizioImpegno', 'calcolaDatePromemoria', 'cancellaPromemoriaImpegno',
    'programmaPromemoriaImpegno', 'etichettaPromemoria',
  ], { Notifications });

  const evento = { ...base, notificationIds: ['vecchio-1'] };
  const date = promemoria.calcolaDatePromemoria(evento, new Date(2026, 9, 1, 12, 0));
  assert.equal(date.length, 2);
  assert.equal(date[1].data.getTime(), new Date(2026, 9, 3, 16, 30).getTime());
  const ids = await promemoria.programmaPromemoriaImpegno(evento, new Date(2026, 9, 1, 12, 0));
  assert.deepEqual(chiamate.cancellate, ['vecchio-1']);
  assert.deepEqual(Array.from(ids), ['n-1', 'n-2']);
  assert.equal(chiamate.programmate.length, 2);

  console.log('OK agenda personale: modello, persistenza e promemoria');
})().catch((error) => { console.error(error); process.exitCode = 1; });
