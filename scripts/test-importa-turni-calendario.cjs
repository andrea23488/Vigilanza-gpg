'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { registerHooks } = require('node:module');
const vm = require('node:vm');
const ts = require('typescript');
const { parse } = require('@babel/parser');
registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.includes('/importazioneTurni/') && /^\.\/[^.]+$/.test(specifier)) return next(`${specifier}.ts`, context);
  return next(specifier, context);
} });
const revisione = require('../importazioneTurni/revisione.ts');
const modello = require('../importazioneTurni/modello.ts');
const fixture = require('../fixtures/importazioneTurni/documenti-sintetici.cjs');
const sorgente = readFileSync('importazioneTurni/ImportaTurni.tsx', 'utf8');
// Trasformazione del solo componente in memoria per i test, senza build dell'app.
const compilato = ts.transpileModule(sorgente, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
} }).outputText;

function schermata(opzioni = {}) {
  const slots = [], effetti = [];
  let indice = 0, montata = true, aggiornamentiDopoSmontaggio = 0;
  const chiamate = { selezioni: [], letture: 0, rilasci: 0, calendario: 0, callback: 0 };
  const react = {
    createElement(type, props, ...children) { return { type, props: props ?? {}, children: children.flat(Infinity).filter(v => v !== null && v !== undefined && v !== false) }; },
    useState(initial) {
      const i = indice++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => {
        if (!montata) aggiornamentiDopoSmontaggio++;
        slots[i] = typeof value === 'function' ? value(slots[i]) : value;
      }];
    },
    useRef(initial) { const i = indice++; return slots[i] ?? (slots[i] = { current: initial }); },
    useEffect(effect, deps) {
      const i = indice++;
      if (!slots[i] || deps.some((d, n) => !Object.is(d, slots[i][n]))) {
        effetti[i]?.(); slots[i] = deps; effetti[i] = effect();
      }
    },
  };
  const nativi = Object.fromEntries(['ActivityIndicator', 'Pressable', 'Button', 'ScrollView', 'Text', 'TextInput', 'View'].map(n => [n, n]));
  nativi.Platform = { OS: opzioni.os ?? 'ios' };
  const acquisitore = {
    async acquisisci(o) {
      chiamate.selezioni.push(o);
      return opzioni.acquisizione ?? { stato: 'pronto', documento: { uriLocale: 'file:///cache/test' },
        async rilascia() { chiamate.rilasci++; return { riuscita: opzioni.pulizia !== false }; } };
    },
    async riprovaPulizia() { return { riuscita: true }; },
  };
  const lettore = { async leggi() {
    chiamate.letture++;
    if (opzioni.attesa) await opzioni.attesa;
    return opzioni.lettura ?? { stato: 'letto', risultato: {
      impronta: `md5:${'a'.repeat(32)}:100`, documento: fixture.tabellaColonneSeparate(), avvisi: [],
    } };
  } };
  const modulo = { exports: {} };
  vm.runInNewContext(compilato, { __DEV__: false, exports: modulo.exports, module: modulo, require(id) {
    if (id === 'react') return react;
    if (id === 'react-native') return nativi;
    if (id === './acquisizioneNativa') return { creaAcquisitoreNativo: () => acquisitore };
    if (id === './letturaNativa') return { creaLettoreNativo: () => lettore };
    if (id === './revisione') return revisione;
    if (id === './modello') return modello;
    if (['./geometriaIOS', './prospetto', './interpretazione'].includes(id)) return require(`../importazioneTurni/${id.slice(2)}.ts`);
    throw new Error(`Import inatteso: ${id}`);
  } });
  const props = { modalitaVerifica: true, identita: { nome: 'Persona due', cognome: null, matricola: null },
    // Difesa runtime: nemmeno callback fornite erroneamente possono essere invocate.
    async leggiEsistenti() { chiamate.calendario++; return []; },
    onBozzaConfermata() { chiamate.callback++; },
  };
  return {
    chiamate,
    render() { indice = 0; return modulo.exports.default(props); },
    smonta() { for (const pulisci of effetti) pulisci?.(); montata = false; },
    aggiornamentiTardivi() { return aggiornamentiDopoSmontaggio; },
  };
}
function elementi(tree) {
  if (tree === null || typeof tree !== 'object') return [];
  return [tree, ...(tree.children ?? []).flatMap(elementi)];
}
function testi(tree) { return typeof tree === 'string' ? tree : (tree?.children ?? []).map(testi).join(' '); }
function bottone(tree, titolo) {
  const b = elementi(tree).find(e => e.type === 'Button' && e.props.title === titolo);
  assert.ok(b, `Pulsante mancante: ${titolo}`); return b.props;
}
function visita(nodo, predicato, esito = []) {
  if (!nodo || typeof nodo !== 'object') return esito;
  if (predicato(nodo)) esito.push(nodo);
  for (const v of Object.values(nodo)) {
    if (Array.isArray(v)) v.forEach(n => visita(n, predicato, esito));
    else if (v && typeof v === 'object') visita(v, predicato, esito);
  }
  return esito;
}
test('Agenda: pulsante visibile apre la schermata di verifica con ritorno al calendario', () => {
  const ast = parse(readFileSync('App.js', 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
  const route = visita(ast, n => n.type === 'IfStatement' && n.test.type === 'BinaryExpression' && n.test.right.value === 'importaTurniVerifica');
  assert.equal(route.length, 1);
  const componente = visita(route[0], n => n.type === 'JSXOpeningElement' && n.name.name === 'ImportaTurni');
  assert.equal(componente.length, 1);
  assert.equal(componente[0].attributes.find(a => a.name?.name === 'modalitaVerifica').value.expression.value, true);
  assert.ok(componente[0].attributes.every(a => !['leggiEsistenti', 'onBozzaConfermata'].includes(a.name?.name)));
  assert.equal(visita(route[0], n => n.type === 'JSXAttribute' && n.name.name === 'onPress' && n.value.expression.name === 'tornaCalendario').length, 1);
  const calendario = visita(ast, n => n.type === 'IfStatement' && n.test.type === 'BinaryExpression' && n.test.right.value === 'calendar');
  assert.equal(calendario.length, 1);
  assert.equal(visita(calendario[0], n => n.type === 'CallExpression' && n.callee.name === 'setScreen' && n.arguments[0]?.value === 'importaTurniVerifica').length, 1);
  assert.equal(visita(componente[0], n => n.type === 'ObjectProperty' && n.key.name === 'matricola' && n.value.type === 'NullLiteral').length, 1);
});
test('avviso di verifica e salvataggio disabilitato presenti prima della selezione', () => {
  const h = schermata(), tree = h.render();
  assert.match(testi(tree), /Anteprima turni/);
  assert.match(testi(tree), /salvataggio definitivo è disabilitato/i);
  assert.equal(bottone(tree, 'Salvataggio definitivo disabilitato').disabled, true);
  assert.ok(!elementi(tree).some(e => e.props.title === 'Confermo esplicitamente la bozza e le esclusioni'));
});
test('PDF, foto, screenshot e fotocamera aprono i canali corretti e rilasciano i file', async () => {
  for (const [titolo, canale, tipoImmagine] of [
    ['Scegli PDF o immagine', 'documento'],
    ['Scegli o ritaglia foto / screenshot', 'galleria'],
    ['Fotografa il prospetto', 'fotocamera'],
  ]) {
    const h = schermata(); await bottone(h.render(), titolo).onPress();
    assert.deepEqual(JSON.parse(JSON.stringify(h.chiamate.selezioni)), [{ canale }]);
    assert.equal(h.chiamate.letture, 1); assert.equal(h.chiamate.rilasci, 1);
    assert.match(testi(h.render()), /Giorno/);
  }
});
test('anteprima modificabile: due servizi separati, correzione e nessuna conferma finale', async () => {
  const h = schermata(); await bottone(h.render(), 'Scegli PDF o immagine').onPress();
  const campi = elementi(h.render()).filter(e => e.type === 'TextInput' && e.props.accessibilityLabel === 'postazione giorno 19');
  assert.equal(campi.length, 2);
  campi[0].props.onChangeText('Sede corretta');
  const dopo = elementi(h.render()).filter(e => e.type === 'TextInput' && e.props.accessibilityLabel === 'postazione giorno 19');
  assert.equal(dopo[0].props.value, 'Sede corretta');
  assert.equal(bottone(h.render(), 'Salvataggio definitivo disabilitato').disabled, true);
  assert.ok(!testi(h.render()).includes('INTESTAZIONE_GEOMETRICA'));
  assert.equal(h.chiamate.calendario, 0); assert.equal(h.chiamate.callback, 0);
});
test('Android senza decoder: messaggio comprensibile, niente falsa anteprima, pulizia eseguita', async () => {
  const h = schermata({ os: 'android', lettura: { stato: 'bloccato', codice: 'DECODER_LOCALE_NON_DISPONIBILE' } });
  await bottone(h.render(), 'Scegli o ritaglia foto / screenshot').onPress();
  assert.match(testi(h.render()), /non è ancora disponibile su Android/);
  assert.ok(!elementi(h.render()).some(e => typeof e.type === 'function'));
  assert.equal(h.chiamate.rilasci, 1); assert.equal(h.chiamate.callback, 0);
});
test('iOS senza moduli nel binario e PDF protetto non fingono riconoscimento', async () => {
  for (const [codice, messaggio] of [['DECODER_LOCALE_NON_DISPONIBILE', /moduli di riconoscimento inclusi/], ['PDF_PROTETTO', /protetto da password/]]) {
    const h = schermata({ lettura: { stato: 'bloccato', codice } });
    await bottone(h.render(), 'Scegli PDF o immagine').onPress();
    assert.match(testi(h.render()), messaggio); assert.equal(h.chiamate.rilasci, 1);
  }
});
test('annullamento selettore non legge file e non modifica il calendario', async () => {
  const h = schermata({ acquisizione: { stato: 'annullato' } });
  await bottone(h.render(), 'Scegli PDF o immagine').onPress();
  assert.equal(h.chiamate.letture, 0); assert.equal(h.chiamate.rilasci, 0); assert.equal(h.chiamate.callback, 0);
});
test('uscita durante lettura rilascia il file senza aggiornare una schermata smontata', async () => {
  let termina; const attesa = new Promise(resolve => { termina = resolve; });
  const h = schermata({ attesa });
  const lettura = bottone(h.render(), 'Scegli PDF o immagine').onPress();
  await Promise.resolve(); h.smonta(); termina(); await lettura;
  assert.equal(h.chiamate.rilasci, 1); assert.equal(h.aggiornamentiTardivi(), 0); assert.equal(h.chiamate.callback, 0);
});
test('nuova apertura non recupera dati personali della bozza precedente', async () => {
  const prima = schermata(); await bottone(prima.render(), 'Scegli PDF o immagine').onPress(); prima.smonta();
  const nuova = schermata();
  assert.ok(!elementi(nuova.render()).some(e => typeof e.type === 'function'));
  assert.equal(nuova.chiamate.letture, 0);
});
