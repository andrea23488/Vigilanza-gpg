const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Match the existing dependency-free test approach; no app or services started.
process.env.TZ = 'Europe/Rome';
assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, 'Europe/Rome');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'watchTurni.js'), 'utf8');
const sandbox = { module: { exports: {} }, Date };
vm.runInNewContext(source.replaceAll('export function ', 'function ') +
  '\nmodule.exports = { normalizzaOraWatch, creaIntervalloWatch, preparaTurniWatch };', sandbox);
const { normalizzaOraWatch, creaIntervalloWatch, preparaTurniWatch } = sandbox.module.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));
const date = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min);
const turno = (id, giorno, inizio = '07:30', fine = '15:30', mese = 10, anno = 2026) =>
  ({ id, tipo: 'turno', anno, mese, giorno, inizio, fine,
    luogo: 'Postazione test', indirizzo_servizio: 'Indirizzo test' });

for (const [input, expected] of [
  ['7:30', '07:30'], ['07:30', '07:30'], [' 07:30 ', '07:30'],
  ['\t7:30:59\n', '07:30'], ['07:30:00', '07:30'],
  ['07:30:45', '07:30'], ['00:00', '00:00'], ['23:59:59', '23:59'],
]) {
  const result = normalizzaOraWatch(input);
  assert.equal(result.testo, expected, input);
  assert.equal(result.ore, Number(expected.slice(0, 2)));
  assert.equal(result.minuti, Number(expected.slice(3)));
}
for (const input of [null, undefined, 730, {}, '', ' ', '7:5', '007:30',
  '24:00', '-1:30', '07:60', '07:30:60', '07:30:5', '07:30:00Z',
  '07:30foo', '07: 30', '07:30:00.1', '07:30:00:00', '7.5:30']) {
  assert.equal(normalizzaOraWatch(input), null, String(input));
}
assert.equal(creaIntervalloWatch(null), null);
assert.equal(creaIntervalloWatch({ tipo: 'riposo' }), null);
assert.equal(creaIntervalloWatch(turno('bad', 17, '07:30', '25:00')), null);
assert.equal(creaIntervalloWatch({ ...turno('bad-date', 17), anno: 'invalid' }), null);

const now = date(2026, 10, 17, 6);
const a = Object.freeze(turno('A', 17, ' 07:30:00 ', '15:30:59'));
const b = Object.freeze(turno('B', 19, '7:30:45', ' 15:30 '));
const records = Object.freeze([b, a]);
const before = JSON.stringify(records);
const schedule = preparaTurniWatch(records, now);
assert.equal(schedule.prossimoWatch.turno.id, 'A');
assert.equal(schedule.successivoWatch.turno.id, 'B');
assert.equal(schedule.correnteWatch, null);
assert.deepEqual(plain(schedule), plain(preparaTurniWatch([a, b], now)));
assert.equal(JSON.stringify(records), before);
assert.notEqual(schedule.prossimoWatch.turno, a);
assert.equal(schedule.prossimoWatch.turno.inizio, '07:30');
assert.equal(schedule.prossimoWatch.turno.fine, '15:30');
assert.equal(schedule.prossimoWatch.inizio.getSeconds(), 0);
assert.equal(schedule.prossimoWatch.fine.getMilliseconds(), 0);
assert.equal(schedule.finestraTurniWatch[0].inizioTimestamp, date(2026, 10, 17, 7, 30).getTime() / 1000);
assert.deepEqual(Object.keys(schedule.finestraTurniWatch[0]).sort(), [
  'id', 'inizio', 'fine', 'luogo', 'indirizzo', 'inizioTimestamp', 'fineTimestamp',
].sort());
for (const item of schedule.finestraTurniWatch) {
  for (const key of ['inizioTimestamp', 'fineTimestamp']) {
    assert.equal(typeof item[key], 'number');
    assert.ok(Number.isFinite(item[key]));
    assert.ok(item[key] > 1e9 && item[key] < 1e10, 'seconds, not milliseconds');
  }
  assert.ok(item.fineTimestamp > item.inizioTimestamp);
}
assert.deepEqual(plain(preparaTurniWatch([], now).finestraTurniWatch), []);

// Execute the production payload block, using its actual imported pure module.
const app = fs.readFileSync(path.join(root, 'App.js'), 'utf8');
assert.match(app, /import \{ preparaTurniWatch \} from '\.\/watchTurni';/);
const callIndex = app.indexOf('} = preparaTurniWatch(turni, adessoWatch);');
assert.ok(callIndex > 0);
const start = app.lastIndexOf('        const {', callIndex);
const end = app.indexOf('        updateApplicationContext(payloadWatch);', callIndex);
assert.ok(start >= 0 && end > start);
function payload(turni, adessoWatch) {
  const context = { preparaTurniWatch, turni, adessoWatch, Date,
    sessioneWatch: { user: { id: 'test-user' } }, meteoServizio: null };
  return vm.runInNewContext(app.slice(start, end) + '\npayloadWatch;', context);
}
const p = payload(records, now);
assert.equal(p.inizio, '07:30');
assert.equal(p.fine, '15:30');
assert.equal(p.prossimoInizio, '07:30');
assert.equal(p.prossimoFine, '15:30');
assert.equal(p.inizioTimestamp, p.turni[0].inizioTimestamp);
assert.equal(p.fineTimestamp, p.turni[0].fineTimestamp);
assert.equal(p.prossimoInizioTimestamp, p.turni[1].inizioTimestamp);
assert.equal(p.prossimoFineTimestamp, p.turni[1].fineTimestamp);
assert.equal(p.stato, 'prossimo_turno');
assert.deepEqual(Object.keys(p).sort(), [
  'versione', 'utenteId', 'turni', 'stato', 'riposoFinoTimestamp', 'tipo',
  'giorno', 'mese', 'anno', 'inizio', 'fine', 'luogo', 'indirizzo',
  'inizioTimestamp', 'fineTimestamp', 'prossimoInizio', 'prossimoFine',
  'prossimoLuogo', 'prossimoInizioTimestamp', 'prossimoFineTimestamp',
  'aggiornatoTimestamp', 'temperatura', 'codiceMeteo', 'meteoLocalita',
].sort());
assert.equal(JSON.stringify(records), before);

const night = turno('night', 17, '23:30:59', '07:30:00');
const after = turno('after', 19);
assert.equal(preparaTurniWatch([after, night], date(2026, 10, 17, 23, 29)).prossimoWatch.turno.id, 'night');
for (const currentTime of [date(2026, 10, 17, 23, 30), date(2026, 10, 18, 0), date(2026, 10, 18, 7, 29)]) {
  const s = preparaTurniWatch([after, night], currentTime);
  assert.equal(s.correnteWatch.turno.id, 'night');
  assert.equal(s.prossimoWatch.turno.id, 'after');
  assert.equal(s.successivoWatch.turno.id, 'after');
  const currentPayload = payload([after, night], currentTime);
  assert.equal(currentPayload.stato, 'in_servizio');
  assert.equal(currentPayload.inizio, '23:30');
  assert.equal(currentPayload.prossimoInizio, '07:30');
}
const finished = preparaTurniWatch([night, after], date(2026, 10, 18, 7, 30));
assert.equal(finished.correnteWatch, null);
assert.equal(finished.prossimoWatch.turno.id, 'after');
assert.equal(finished.finestraTurniWatch.length, 1);

for (const [record, expectedEnd] of [
  [turno('midnight-end', 17, '22:00', '00:00'), date(2026, 10, 18)],
  [turno('midnight-start', 17, '00:00', '08:00'), date(2026, 10, 17, 8)],
  [turno('equal', 17, '00:00', '00:00'), date(2026, 10, 18)],
  [turno('month', 31, '23:30', '07:30'), date(2026, 11, 1, 7, 30)],
  [turno('year', 31, '23:30', '07:30', 12), date(2027, 1, 1, 7, 30)],
]) {
  assert.equal(creaIntervalloWatch(record).fine.getTime(), expectedEnd.getTime());
}
// Real local-time DST transitions, not a fixed 24-hour addition.
for (const [record, expectedHours, expectedDay] of [
  [turno('spring', 28, '23:30', '07:30', 3), 7, 29],
  [turno('autumn', 24, '23:30', '07:30', 10), 9, 25],
]) {
  const interval = creaIntervalloWatch(record);
  assert.equal((interval.fine - interval.inizio) / 3600000, expectedHours);
  assert.equal(interval.fine.getDate(), expectedDay);
  assert.equal(interval.fine.getHours(), 7);
  assert.equal(interval.fine.getMinutes(), 30);
}

const many = Array.from({ length: 40 }, (_, i) => {
  const day = date(2026, 10, i + 1);
  return turno(String(i + 1), day.getDate(), '07:30', '15:30',
    day.getMonth() + 1, day.getFullYear());
});
const limited = preparaTurniWatch([...many].reverse(), date(2026, 10, 1, 6));
assert.equal(limited.finestraTurniWatch.length, 31);
assert.deepEqual(Array.from(limited.finestraTurniWatch, (x) => x.id),
  Array.from({ length: 31 }, (_, i) => String(i + 1)));
assert.equal(limited.prossimoWatch.turno.id, '1');
console.log('Watch: formati, selezione, payload, immutabilità, confini, notte, DST Europe/Rome e limite 31 superati');
