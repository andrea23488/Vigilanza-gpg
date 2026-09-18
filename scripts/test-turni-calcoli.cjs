const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const file = fs.readFileSync('turniCalcoli.js', 'utf8');
const nomi = [
  'chiaveDataTurno',
  'calcolaOreIntervallo',
  'minutiAggiuntiviTurno',
  'oreRetribuiteTurno',
  'aggregaTurniPerGiorno',
  'rilevaSovrapposizioniGiornaliere',
];
const sorgente =
  file.replaceAll('export function ', 'function ') +
  `\nmodule.exports = { ${nomi.join(', ')} };`;
const sandbox = { module: { exports: {} }, exports: {} };
vm.runInNewContext(sorgente, sandbox);

const {
  aggregaTurniPerGiorno,
  rilevaSovrapposizioniGiornaliere,
} = sandbox.module.exports;

const scenario = [
  {
    id: 1,
    tipo: 'turno',
    giorno: 10,
    mese: 9,
    anno: 2026,
    inizio: '06:00',
    fine: '14:00',
    ore: 8,
  },
  {
    id: 2,
    tipo: 'turno',
    giorno: 10,
    mese: 9,
    anno: 2026,
    inizio: '15:00',
    fine: '19:00',
    ore: 4,
  },
];

const [giorno] = aggregaTurniPerGiorno(scenario, 7);
assert.equal(giorno.oreRetribuite, 12);
assert.equal(giorno.oreOrdinarie, 7);
assert.equal(giorno.oreStraordinarie, 5);
assert.equal(giorno.minutiAggiuntivi, 0);
assert.equal(rilevaSovrapposizioniGiornaliere(scenario).length, 0);

const [conStaccoEsplicito] = aggregaTurniPerGiorno(
  [
    scenario[0],
    { ...scenario[1], minuti_aggiuntivi_retribuiti: 60 },
  ],
  7
);
assert.equal(conStaccoEsplicito.oreRetribuite, 13);
assert.equal(conStaccoEsplicito.oreStraordinarie, 6);

const sovrapposti = [
  scenario[0],
  { ...scenario[1], inizio: '13:30' },
];
assert.equal(rilevaSovrapposizioniGiornaliere(sovrapposti).length, 1);

console.log('Regressione multi-turno superata');
