const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const file = fs.readFileSync('stipendioCalcoli.js', 'utf8');
const nomi = ['numeroEconomico', 'tariffaStraordinario30DaBase', 'calcolaVociGpg'];
const sorgente = file.replaceAll('export function ', 'function ') +
  `\nmodule.exports = { ${nomi.join(', ')} };`;
const sandbox = { module: { exports: {} }, exports: {} };
vm.runInNewContext(sorgente, sandbox);

const { tariffaStraordinario30DaBase, calcolaVociGpg } = sandbox.module.exports;
const tariffa = tariffaStraordinario30DaBase(1468.88);
assert.ok(Math.abs(tariffa - 11.03783) < 0.0001);

const agosto2026 = calcolaVociGpg({
  oreStraordinario: 47.98,
  tariffaStraordinario: 529.60 / 47.98,
  oreDomenicali: 30.5,
  tariffaDomenicale: 21.66 / 30.5,
  serviziDiurni: 13,
  tariffaDiurno: 8.45 / 13,
  tariffaCompensativa: 24.18 / 13,
  serviziNotturni: 12,
  tariffaNotturno: 50.16 / 12,
  festivitaNonGoduta: 56.50,
  antirapina: 3.12,
  indennita20724: 89.08,
});

assert.equal(agosto2026.straordinario.toFixed(2), '529.60');
assert.equal(agosto2026.domenicale.toFixed(2), '21.66');
assert.equal(agosto2026.piantonamentoDiurno.toFixed(2), '8.45');
assert.equal(agosto2026.compensativa.toFixed(2), '24.18');
assert.equal(agosto2026.piantonamentoNotturno.toFixed(2), '50.16');
assert.equal(agosto2026.festivitaNonGoduta.toFixed(2), '56.50');
assert.equal(agosto2026.antirapina.toFixed(2), '3.12');
assert.equal(agosto2026.indennita20724.toFixed(2), '89.08');

console.log('Regressione voci stipendio agosto 2026 superata');
