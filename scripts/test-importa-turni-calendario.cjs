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
    createElement(type, props, ...children) {
      props ??= {};
      if (!children.length && props.children) children = [props.children];
      if (typeof type === 'function') return type({ ...props, children });
      if (type === 'Modal' && !props.visible) return null;
      if (type === 'FlatList') children = [props.ListHeaderComponent, ...(props.data ?? []).map((item, index) => props.renderItem({ item, index })), props.ListFooterComponent];
      return { type, props, children: children.flat(Infinity).filter(v => v !== null && v !== undefined && v !== false) };
    },
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
  const nativi = Object.fromEntries(['ActivityIndicator', 'FlatList', 'KeyboardAvoidingView', 'Modal', 'SafeAreaView', 'Pressable', 'Button', 'ScrollView', 'Text', 'TextInput', 'View'].map(n => [n, n]));
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
    if (id === '../temi') return require('../temi.js');
    if (id === './documenti') return require('../importazioneTurni/documenti.ts');
    if (['./geometriaIOS', './prospetto', './interpretazione'].includes(id)) return require(`../importazioneTurni/${id.slice(2)}.ts`);
    throw new Error(`Import inatteso: ${id}`);
  } });
  const props = { palette: opzioni.palette, modalitaVerifica: true, identita: { nome: 'Persona due', cognome: null, matricola: null },
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
function testi(tree) { return typeof tree === 'string' || typeof tree === 'number' ? String(tree) : (tree?.children ?? []).map(testi).join(' '); }
function bottone(tree, titolo) {
  const b = elementi(tree).find(e => e.props.accessibilityRole === 'button' && e.props.accessibilityLabel === titolo);
  assert.ok(b, `Pulsante mancante: ${titolo}`); return b.props;
}
function apriGiornata(h, giorno) {
  const e = elementi(h.render()).find(e => e.type === 'Pressable' && e.props.accessibilityLabel?.startsWith('Apri giornata ') && new RegExp(`^Apri giornata (?:Giorno )?${giorno}\\b`).test(e.props.accessibilityLabel));
  assert.ok(e, `Giornata mancante: ${giorno}`); e.props.onPress();
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
  assert.match(testi(tree), /Importa turni/);
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
    assert.ok(elementi(h.render()).some(e => e.props.accessibilityLabel?.startsWith('Apri giornata ')));
  }
});
test('anteprima modificabile: due servizi separati, correzione e nessuna conferma finale', async () => {
  const h = schermata(); await bottone(h.render(), 'Scegli PDF o immagine').onPress();
  apriGiornata(h, '19');
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

function documentoRighe(righe) {
  return { id: 'documento-ui', tipo: 'screenshot', testoOriginale: null, pagineAttese: 1, pagine: [{
    id: 'p-1', numero: 1, larghezza: 1000, altezza: 1000, rotazione: 0, testo: null, errore: null,
    righe: righe.map((testo, i) => ({ id: `r-${i}`, testo, celle: null, rettangolo: null, confidenza: null })),
  }] };
}
async function caricaRighe(righe, opzioni = {}) {
  const h = schermata({ ...opzioni, lettura: { stato: 'letto', risultato: { documento: documentoRighe(righe), avvisi: [], impronta: `md5:${'a'.repeat(32)}:100` } } });
  await bottone(h.render(), 'Scegli PDF o immagine').onPress(); return h;
}
function scegliValore(h, titolo, valore) {
  bottone(h.render(), titolo).onPress(); bottone(h.render(), valore).onPress();
}
function confermaPeriodo(h, mese = 'ottobre', anno = '2026') {
  bottone(h.render(), 'Conferma periodo e dipendente').onPress();
  scegliValore(h, 'Mese: Da indicare', mese);
  campo(h, 'anno').onChangeText(anno);
  bottone(h.render(), 'Conferma periodo e dipendente e rileggi').onPress();
}
function campo(h, label, indice = 0) {
  const e = elementi(h.render()).filter(e => e.type === 'TextInput' && e.props.accessibilityLabel === label)[indice];
  assert.ok(e, `Campo mancante: ${label}`); return e.props;
}
function giornate(h) { return elementi(h.render()).filter(e => e.props.accessibilityLabel?.startsWith('Apri giornata ')); }
function nessunSalvataggio(h) {
  assert.equal(bottone(h.render(), 'Salvataggio definitivo disabilitato').disabled, true);
  assert.equal(h.chiamate.calendario, 0); assert.equal(h.chiamate.callback, 0);
}
test('31 giornate compatte, conteggi e date completate soltanto dopo conferma periodo', async () => {
  const h = await caricaRighe(Array.from({ length: 31 }, (_, i) => `${i + 1} 7/19 Sede riconosciuta`));
  assert.equal(giornate(h).length, 31);
  assert.match(testi(h.render()), /31\s+giornate ·\s+31\s+servizi/);
  assert.match(testi(h.render()), /31\s+elementi da verificare/);
  assert.ok(giornate(h).every(e => e.props.accessibilityLabel.includes('data da completare')));
  assert.equal(elementi(h.render()).filter(e => e.type === 'TextInput' && /postazione giorno/.test(e.props.accessibilityLabel)).length, 0);
  confermaPeriodo(h);
  assert.match(giornate(h)[0].props.accessibilityLabel, /1 ottobre 2026/);
  assert.match(giornate(h)[30].props.accessibilityLabel, /31 ottobre 2026/);
  nessunSalvataggio(h);
});
test('riposi e sigle ambigue mantengono significato esplicito e conferma separata', async () => {
  const h = await caricaRighe(['16 R', '17 PR', '18 riposo']);
  confermaPeriodo(h);
  assert.match(testi(h.render()), /Conferma il significato di PR/);
  apriGiornata(h, '17');
  bottone(h.render(), 'causale').onPress();
  assert.equal(campo(h, 'Sigla o causale').value, 'PR');
  campo(h, 'Significato della sigla').onChangeText('Causale confermata dalla persona');
  bottone(h.render(), 'Verifica questa voce').onPress();
  assert.match(testi(h.render()), /✓ Verificata/);
  bottone(h.render(), 'Chiudi giornata').onPress();
  assert.match(giornate(h)[1].props.accessibilityLabel, /Verificato/);
  apriGiornata(h, '18'); bottone(h.render(), 'Verifica questa voce').onPress();
  assert.match(testi(h.render()), /✓ Verificata/);
  nessunSalvataggio(h);
});
test('notturni: nessuna data finale dedotta, selezione esplicita e persistenza degli orari', async () => {
  const h = await caricaRighe(['18 7/19 Sede diurna', '19 22/6 Sede notturna']);
  confermaPeriodo(h); apriGiornata(h, '19');
  assert.match(testi(h.render()), /Conferma la data di fine/);
  bottone(h.render(), 'Verifica questa voce').onPress();
  assert.ok(elementi(h.render()).some(e => e.props.accessibilityRole === 'alert'));
  scegliValore(h, 'Giorno: Da indicare', '20');
  bottone(h.render(), 'Verifica questa voce').onPress();
  assert.match(testi(h.render()), /✓ Verificata/);
  scegliValore(h, 'Ora inizio: 22', '23');
  scegliValore(h, 'Minuti fine: 00', '15');
  bottone(h.render(), 'Chiudi giornata').onPress(); apriGiornata(h, '19');
  assert.match(testi(h.render()), /Inizio\s*:\s*23:00/);
  assert.match(testi(h.render()), /Fine\s*:\s*06:15/);
  assert.match(testi(h.render()), /Giorno: 20/);
  nessunSalvataggio(h);
});
test('due servizi nella stessa giornata: correzioni indipendenti, aggiunta ed esclusione', async () => {
  const h = await caricaRighe(['18 7/12 + 15/23 Sede A', '19 riposo']);
  confermaPeriodo(h); assert.equal(giornate(h).length, 2); apriGiornata(h, '18');
  assert.equal(elementi(h.render()).filter(e => e.type === 'TextInput' && e.props.accessibilityLabel === 'postazione giorno 18').length, 2);
  const lunga = 'Postazione con una denominazione molto lunga da mantenere leggibile senza tagli né perdita di contenuto';
  campo(h, 'postazione giorno 18').onChangeText(lunga);
  bottone(h.render(), 'Chiudi giornata').onPress();
  assert.ok(testi(h.render()).includes(lunga));
  apriGiornata(h, '18'); assert.equal(campo(h, 'postazione giorno 18').value, lunga);
  assert.equal(campo(h, 'postazione giorno 18', 1).value, 'Sede A');
  bottone(h.render(), 'Aggiungi un servizio nello stesso giorno').onPress();
  assert.equal(elementi(h.render()).filter(e => e.props.accessibilityLabel === 'postazione giorno 18').length, 3);
  bottone(h.render(), 'Escludi questa voce').onPress();
  assert.equal(elementi(h.render()).filter(e => e.props.accessibilityLabel === 'postazione giorno 18').length, 2);
  bottone(h.render(), 'Chiudi giornata').onPress(); apriGiornata(h, '18');
  assert.equal(campo(h, 'postazione giorno 18').value, 'Sede A');
  nessunSalvataggio(h);
});
test('cambio data non chiude la giornata e conserva le modifiche dopo riapertura', async () => {
  const h = await caricaRighe(['18 7/19 Sede A', '19 riposo']); confermaPeriodo(h); apriGiornata(h, '18');
  scegliValore(h, 'Giorno: 18', '20');
  campo(h, 'postazione giorno 18').onChangeText('Sede modificata');
  bottone(h.render(), 'Chiudi giornata').onPress(); apriGiornata(h, '20');
  assert.equal(campo(h, 'postazione giorno 18').value, 'Sede modificata');
  nessunSalvataggio(h);
});
test('periodo e dipendente: la rilettura sostituisce esplicitamente le correzioni manuali', async () => {
  const h = await caricaRighe(['18 7/19 Sede originale', '19 riposo']); confermaPeriodo(h); apriGiornata(h, '18');
  campo(h, 'postazione giorno 18').onChangeText('Sede manuale');
  bottone(h.render(), 'Chiudi giornata').onPress(); bottone(h.render(), 'Modifica periodo e dipendente').onPress();
  assert.match(testi(h.render()), /La rilettura sostituisce l’anteprima/);
  scegliValore(h, 'Mese: ottobre', 'novembre'); campo(h, 'nome').onChangeText('Persona corretta');
  bottone(h.render(), 'Conferma periodo e dipendente e rileggi').onPress();
  assert.match(testi(h.render()), /Persona corretta/);
  assert.match(giornate(h)[0].props.accessibilityLabel, /18 novembre 2026/);
  apriGiornata(h, '18'); assert.equal(campo(h, 'postazione giorno 18').value, 'Sede originale');
  assert.equal(h.chiamate.letture, 1); // Rilettura locale del documento già acquisito.
  nessunSalvataggio(h);
});
test('tutte le palette e sfondi personalizzati sono rispettati anche nel pannello', async () => {
  const temi = require('../temi.js');
  const preferenze = temi.PRESET_TEMI.map(p => ({ ...temi.ripristinaAspetto(), preset: p.id }));
  preferenze.push(temi.personalizzaAspetto(temi.ripristinaAspetto(), { background: '#FFFFFF', accent: '#FDA4AF' }));
  preferenze.push(temi.personalizzaAspetto(temi.ripristinaAspetto(), { background: '#777777', accent: '#777777' }));
  for (const preferenza of preferenze) {
    const palette = temi.generaPalette(preferenza);
    const h = await caricaRighe(['18 7/19 Sede A', '19 riposo'], { palette });
    assert.equal(h.render().props.style.backgroundColor, palette.background);
    apriGiornata(h, '18');
    const input = campo(h, 'postazione giorno 18');
    assert.equal(input.style.color, palette.text); assert.equal(input.style.backgroundColor, palette.surfaceRaised);
    for (const e of elementi(h.render()).filter(e => e.type === 'Text')) {
      const stile = Object.assign({}, ...[e.props.style].flat(Infinity).filter(Boolean));
      assert.ok([palette.text, palette.textMuted].includes(stile.color));
    }
    assert.ok(!elementi(h.render()).some(e => e.props.numberOfLines || e.props.allowFontScaling === false));
    nessunSalvataggio(h);
  }
});
test('selezione esplicita del dipendente rilegge senza mescolare persone', async () => {
  const h = await caricaRighe([
    'Data|Nome|Servizio|Postazione',
    '19/10/2026|Persona Alfa|06:00-14:00|Sede Alfa',
    '20/10/2026|Persona Alfa|06:00-14:00|Sede Alfa',
    '19/10/2026|Persona Beta|14:00-22:00|Sede Beta',
    '20/10/2026|Persona Beta|14:00-22:00|Sede Beta',
  ]);
  assert.equal(giornate(h).length, 0);
  bottone(h.render(), 'Conferma periodo e dipendente').onPress();
  const persona = elementi(h.render()).find(e => e.props.accessibilityLabel?.startsWith('Usa dipendente:') && e.props.accessibilityLabel.includes('Beta'));
  assert.ok(persona); persona.props.onPress();
  assert.equal(giornate(h).length, 2);
  assert.ok(giornate(h).every(e => e.props.accessibilityLabel.includes('Sede Beta') && !e.props.accessibilityLabel.includes('Sede Alfa')));
  nessunSalvataggio(h);
});
test('chiusura nativa mantiene le correzioni; date incomplete restano modificabili e non verificate', async () => {
  const h = await caricaRighe(['18 7/19 Sede A', '19 riposo']); apriGiornata(h, '18');
  assert.equal(campo(h, 'Anno data').value, '');
  scegliValore(h, 'Mese: Da indicare', 'febbraio');
  campo(h, 'Anno data').onChangeText('2027');
  scegliValore(h, 'Giorno: 18', '31');
  assert.match(testi(h.render()), /Controlla la data/);
  campo(h, 'postazione giorno 18').onChangeText('Correzione conservata');
  const modale = elementi(h.render()).find(e => e.type === 'Modal'); modale.props.onRequestClose();
  apriGiornata(h, '18');
  assert.equal(campo(h, 'postazione giorno 18').value, 'Correzione conservata');
  assert.equal(campo(h, 'Anno data').value, '2027');
  campo(h, 'Anno data').onChangeText('');
  assert.equal(campo(h, 'Anno data').value, '');
  assert.match(testi(h.render()), /Da confermare/);
  nessunSalvataggio(h);
});
