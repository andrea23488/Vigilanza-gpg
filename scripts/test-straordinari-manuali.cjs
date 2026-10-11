const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');

function carica(file, nomi) {
  const sandbox = { module: { exports: {} } };
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8')
    .replaceAll('export function ', 'function ') +
    `\nmodule.exports = { ${nomi.join(',')} };`, sandbox);
  return sandbox.module.exports;
}
const { oreMinutiInMinuti, minutiInOreMinuti, classificaStraordinarioTurno,
  attribuisciStraordinariPerTurno: attribuisci } = carica('straordinariManuali.js', [
  'oreMinutiInMinuti', 'minutiInOreMinuti', 'classificaStraordinarioTurno',
  'attribuisciStraordinariPerTurno',
]);
const { aggregaTurniPerGiorno, oreRetribuiteTurno } = carica('turniCalcoli.js', [
  'aggregaTurniPerGiorno', 'oreRetribuiteTurno',
]);
// Esegue la funzione GPG effettiva, senza importare React Native né modificarla.
const app = fs.readFileSync(path.join(root, 'App.js'), 'utf8');
const start = app.indexOf('function calcolaStraordinariConfigurati(');
const end = app.indexOf('export default function App()', start);
assert.ok(start >= 0 && end > start);
const sandbox = { aggregaTurniPerGiorno };
vm.runInNewContext(app.slice(start, end), sandbox);
const legacy = sandbox.calcolaStraordinariConfigurati;
const opzioni = (modalita, sogliaMinuti = modalita === 'giornaliero' ? 420 : 2400) =>
  ({ modalita, sogliaMinuti });
const turno = (id, data = '2026-10-05', durataMinuti = 720, manualiMinuti = null,
  inizioMinuti = 360) => ({ id, data, durataMinuti, manualiMinuti, inizioMinuti });
const somma = (righe) => righe.reduce((n, r) => n + r.straordinariMinuti, 0);

test('4 ore 45 minuti = 285, conversione esatta e reversibile', () => {
  assert.equal(oreMinutiInMinuti(4, 45), 285);
  const parti = minutiInOreMinuti(285);
  assert.equal(parti.ore, 4);
  assert.equal(parti.minuti, 45);
  for (let n = 0; n <= 1440; n++) {
    const p = minutiInOreMinuti(n);
    assert.equal(oreMinutiInMinuti(p.ore, p.minuti), n);
  }
});

test('06–18: manuale sostituisce 300 con 285 senza aggiungere ore', () => {
  const [r] = attribuisci([turno('a', undefined, 720, 285)], opzioni('giornaliero'));
  assert.equal(r.automaticiMinuti, 300);
  assert.equal(r.straordinariMinuti, 285);
  assert.equal(r.ordinariMinuti, 435);
  assert.equal(r.modalita, 'manuale');
  assert.equal(r.ordinariMinuti + r.straordinariMinuti, 720);
});

test('manuale zero, null e campo assente hanno significati distinti', () => {
  const base = { durataMinuti: 720, automaticiMinuti: 300 };
  assert.equal(classificaStraordinarioTurno({ ...base, manualiMinuti: 0 }).straordinariMinuti, 0);
  assert.equal(classificaStraordinarioTurno({ ...base, manualiMinuti: null }).straordinariMinuti, 300);
  assert.equal(classificaStraordinarioTurno(base).modalita, 'automatico');
  assert.equal(classificaStraordinarioTurno({ ...base, manualiMinuti: 720 }).ordinariMinuti, 0);
});

test('settimanale: override non cambia il cumulato né il turno successivo', () => {
  const precedenti = [1, 2, 3].map((n) => turno(String(n), `2026-10-0${n + 4}`));
  const righe = attribuisci([...precedenti, turno('m', '2026-10-08', 720, 285),
    turno('dopo', '2026-10-09', 480)], opzioni('settimanale'));
  assert.equal(righe[3].cumulatoPrimaMinuti, 2160);
  assert.equal(righe[3].cumulatoDopoMinuti, 2880);
  assert.equal(righe[3].automaticiMinuti, 480);
  assert.equal(righe[3].straordinariMinuti, 285);
  assert.equal(righe[4].automaticiMinuti, 480);
  assert.equal(somma(righe), 765);
  assert.equal(righe[4].cumulatoDopoMinuti, 3360);
});

test('settimanale sotto soglia: manuale esplicito, nuovo lunedì azzera cumulato', () => {
  const righe = attribuisci([turno('a', '2026-10-11', 720, 285),
    turno('b', '2026-10-12')], opzioni('settimanale'));
  assert.equal(righe[0].automaticiMinuti, 0);
  assert.equal(righe[0].straordinariMinuti, 285);
  assert.equal(righe[1].cumulatoPrimaMinuti, 0);
  assert.equal(righe[1].straordinariMinuti, 0);
});

test('più turni giornalieri: sostituzione locale e cumulato invariato', () => {
  const righe = attribuisci([turno('b', undefined, 300, 30, 840),
    turno('a', undefined, 300, null, 360)], opzioni('giornaliero'));
  assert.equal(righe[0].id, 'a');
  assert.equal(righe[1].automaticiMinuti, 180);
  assert.equal(righe[1].straordinariMinuti, 30);
  assert.equal(righe[1].cumulatoDopoMinuti, 600);
});

test('automatici: equivalenza con GPG attuale, mensile e settimanale', () => {
  const turni = [
    { id: 1, anno: 2026, mese: 9, giorno: 28, inizio: '06:00', fine: '18:00', ore: 12 },
    { id: 2, anno: 2026, mese: 9, giorno: 29, inizio: '06:00', fine: '18:00', ore: 12 },
    { id: 3, anno: 2026, mese: 9, giorno: 30, inizio: '22:00', fine: '06:00', ore: 8 },
    { id: 4, anno: 2026, mese: 10, giorno: 1, inizio: '06:00', fine: '12:00', ore: 6 },
    { id: 5, anno: 2026, mese: 10, giorno: 1, inizio: '14:00', fine: '18:00', ore: 4,
      minuti_aggiuntivi_retribuiti: 15 },
    { id: 6, anno: 2026, mese: 10, giorno: 2, inizio: '06:00', fine: '18:00', ore: 12 },
  ].map(t => ({ ...t, tipo: 'turno' }));
  const normalizzati = turni.map(t => {
    const [h, m] = t.inizio.split(':').map(Number);
    return turno(String(t.id), `${t.anno}-${String(t.mese).padStart(2, '0')}-${String(t.giorno).padStart(2, '0')}`,
      oreRetribuiteTurno(t) * 60, null, h * 60 + m);
  });
  for (const modalita of ['giornaliero', 'settimanale']) {
    const righe = attribuisci(normalizzati, opzioni(modalita));
    for (const meseTarget of [9, 10]) {
      const prima = legacy({ giornateMese: turni.filter(t => t.mese === meseTarget),
        tuttiTurni: turni, modalita, sogliaGiornaliera: 7, sogliaSettimanale: 40,
        meseTarget, annoTarget: 2026 });
      const dopo = somma(righe.filter(r => Number(r.data.slice(5, 7)) === meseTarget)) / 60;
      assert.equal(dopo, prima);
    }
  }
});

test('confine mese/anno: classificare prima di filtrare, attribuzione alla data iniziale', () => {
  const righe = attribuisci([turno('prima', '2026-12-31', 2400),
    turno('notte', '2027-01-01', 480, 285, 1320)], opzioni('settimanale'));
  assert.equal(righe[1].periodo, '2026-12-28');
  assert.equal(righe[1].automaticiMinuti, 480);
  assert.equal(righe[1].straordinariMinuti, 285);
  assert.equal(righe[1].data, '2027-01-01');
});

test('input invalidi rifiutati senza coercizione o clamp', () => {
  for (const valore of [-1, 0.5, NaN, Infinity, '285', false, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => minutiInOreMinuti(valore));
    assert.throws(() => classificaStraordinarioTurno({ durataMinuti: 720,
      automaticiMinuti: 300, manualiMinuti: valore }));
  }
  assert.throws(() => oreMinutiInMinuti(4, 60));
  assert.throws(() => oreMinutiInMinuti(4.75, 0));
  assert.throws(() => oreMinutiInMinuti(Number.MAX_SAFE_INTEGER, 0));
  assert.throws(() => classificaStraordinarioTurno({ durataMinuti: 720, automaticiMinuti: 721 }));
  assert.throws(() => attribuisci([turno('a', undefined, 720, 721)], opzioni('giornaliero')));
  for (const data of ['2026-02-30', '2026-13-01', '', null]) {
    assert.throws(() => attribuisci([turno('a', data)], opzioni('giornaliero')));
  }
  assert.throws(() => attribuisci([turno('a', undefined, 720, null, 1440)], opzioni('giornaliero')));
  assert.throws(() => attribuisci([turno('a'), turno('a')], opzioni('giornaliero')));
  assert.throws(() => attribuisci([], opzioni('mensile')));
  assert.throws(() => attribuisci([], opzioni('giornaliero', -1)));
  assert.throws(() => attribuisci(null, opzioni('giornaliero')));
});

test('funzioni pure: input immutato, ordine deterministico, conservazione minuti', () => {
  const input = [turno('b', undefined, 720, 285), turno('a', undefined, 60)];
  const prima = JSON.stringify(input);
  input.forEach(Object.freeze);
  Object.freeze(input);
  const righe = attribuisci(input, opzioni('giornaliero'));
  assert.equal(righe[0].id, 'a');
  assert.equal(JSON.stringify(input), prima);
  for (const r of righe) assert.equal(r.ordinariMinuti + r.straordinariMinuti, r.durataMinuti);
  assert.equal(JSON.stringify(righe), JSON.stringify(attribuisci([...input].reverse(), opzioni('giornaliero'))));
});
