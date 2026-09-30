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

// Regressione cedolino reale GPG agosto 2026.
// Le tariffe note sono indipendenti dagli importi attesi:
// il test deve proteggere le regole economiche, non ricavare
// la tariffa dallo stesso risultato che intende verificare.
const lordoLivello4 = 1468.88;
const tariffaStraordinario30 = tariffaStraordinario30DaBase(lordoLivello4);

assert.equal(lordoLivello4.toFixed(2), '1468.88');
assert.ok(Math.abs(tariffaStraordinario30 - 11.03783) < 0.0001);

const agosto2026 = calcolaVociGpg({
  lordoBase: lordoLivello4,
  oreStraordinario: 47.98,
  tariffaStraordinario: tariffaStraordinario30,
  oreDomenicali: 30.5,
  tariffaDomenicale: 0.71,
  serviziNotturni: 12,
  tariffaNotturno: 4.18,
  festivitaNonGoduta: 56.50,
  antirapina: 3.12,
  indennita20724: 89.08,
});

assert.equal(agosto2026.base.toFixed(2), '1468.88');
assert.ok(
  Math.abs(agosto2026.straordinario - 529.60) <= 0.01,
  `Straordinario agosto 2026 fuori tolleranza: ${agosto2026.straordinario.toFixed(2)}`
);
assert.ok(
  Math.abs(agosto2026.domenicale - 21.66) <= 0.01,
  `Domenicale agosto 2026 fuori tolleranza: ${agosto2026.domenicale.toFixed(2)}`
);
assert.equal(agosto2026.piantonamentoNotturno.toFixed(2), '50.16');
assert.equal(agosto2026.festivitaNonGoduta.toFixed(2), '56.50');
assert.equal(agosto2026.antirapina.toFixed(2), '3.12');
assert.equal(agosto2026.indennita20724.toFixed(2), '89.08');

// Piantonamento diurno e compensativa non vengono calibrati qui:
// dal cedolino disponibile non possiamo dimostrare in modo indipendente
// il numero di servizi a cui applicare le rispettive tariffe.

console.log('Regressione voci stipendio agosto 2026 superata');
