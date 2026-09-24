const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const file = fs.readFileSync('profiloUtente.js', 'utf8');
const nomi = ['creaProfiloVuoto', 'costruisciProfiloUtente'];
const sorgente =
  file.replaceAll('export function ', 'function ') +
  `\nmodule.exports = { ${nomi.join(', ')} };`;
const sandbox = { module: { exports: {} }, exports: {} };
vm.runInNewContext(sorgente, sandbox);

const { creaProfiloVuoto, costruisciProfiloUtente } =
  sandbox.module.exports;

const vuoto = creaProfiloVuoto();
assert.equal(vuoto.nome, '');
assert.equal(vuoto.azienda, '');
assert.equal(vuoto.ruolo, '');

const daCloud = costruisciProfiloUtente(
  {
    nome: 'Giulia',
    cognome: 'Verdi',
    azienda: 'Sicurezza Uno',
    ruolo: 'Fiduciaria',
    sede: 'Milano',
    codice_gpg: 'G123',
  },
  { nome: 'Nome metadata', cognome: 'Cognome metadata' }
);
assert.equal(daCloud.nome, 'Giulia');
assert.equal(daCloud.cognome, 'Verdi');
assert.equal(daCloud.azienda, 'Sicurezza Uno');
assert.equal(daCloud.ruolo, 'Fiduciaria');

const senzaRiga = costruisciProfiloUtente(null, {
  nome: 'Elena',
  cognome: 'Bianchi',
  matricola: 'F456',
});
assert.equal(senzaRiga.nome, 'Elena');
assert.equal(senzaRiga.cognome, 'Bianchi');
assert.equal(senzaRiga.codice_gpg, 'F456');
assert.equal(senzaRiga.azienda, '');

const senzaRigaNéMetadata = costruisciProfiloUtente(null, {});
assert.equal(senzaRigaNéMetadata.nome, '');
assert.equal(senzaRigaNéMetadata.cognome, '');
assert.equal(senzaRigaNéMetadata.azienda, '');
assert.equal(senzaRigaNéMetadata.ruolo, '');

const utenteA = costruisciProfiloUtente(
  { nome: 'Utente A', azienda: 'Azienda A' },
  {}
);
const utenteB = costruisciProfiloUtente(
  null,
  { nome: 'Utente B' }
);
assert.equal(utenteA.nome, 'Utente A');
assert.equal(utenteB.nome, 'Utente B');
assert.equal(utenteB.azienda, '');

const app = fs.readFileSync('App.js', 'utf8');
const login = fs.readFileSync('LoginScreen.js', 'utf8');
assert.doesNotMatch(app, /PROFILO_DEFAULT/);
assert.doesNotMatch(login, /VERSIONE TEST/);
assert.doesNotMatch(app, /Andrea|Ischiboni|Italpol/);
assert.doesNotMatch(login, /Andrea|Ischiboni|Italpol/);

console.log('Regressione profilo utente production superata');
