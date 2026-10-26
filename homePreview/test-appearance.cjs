const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server'), ts = require('typescript');
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
function load(name, imports = {}) {
  const code = ts.transpileModule(read(name), { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const c = { exports: {}, require: key => { assert.ok(key in imports, `Unexpected import: ${key}`); return imports[key]; } };
  vm.runInNewContext(code, c); return c.exports;
}
const themeCode = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../temi.js'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const themeModule = { exports: {} }; vm.runInNewContext(themeCode, themeModule);
const themes = themeModule.exports;
const electric = load('../homeElectric.js', {});
const original = themes.ripristinaAspetto();

test('catalogo: 12 temi standard, 8 speciali, icone e palette/circuiti distinti', () => {
  assert.equal(themes.PRESET_TEMI.length, 6, 'vista legacy invariata');
  assert.equal(themes.TEMI_PREIMPOSTATI.length, 12);
  assert.deepEqual(Array.from(themes.TEMI_PREIMPOSTATI, theme => theme.nome), ['Originale','Blu elettrico','Neon viola','Grafite','Oceano','Verde smeraldo','Rosso rubino','Oro e nero','Petrolio e ambra','Notte e lavanda','Ardesia e ghiaccio','Prugna e rosa']);
  assert.deepEqual(Array.from(themes.TEMI_SPECIALI, theme => theme.nome), ['Halloween','Natale','Militare','Cartoon','Galaxy','Cyberpunk','Inverno','Gold']);
  assert.ok(themes.TEMI_SPECIALI.every(theme => theme.icon && theme.circuitColors.length === 4));
  const circuitPalettes = Array.from(themes.TEMI_SPECIALI, theme => electric.coloriCircuiti(themes.generaPalette({ version: 1, preset: theme.id, background: null, accent: null }))); 
  assert.equal(new Set(circuitPalettes.map(palette => palette.join(','))).size, 8);
});
test('preferenze v1 già salvate restano valide e mantengono i valori storici', () => {
  const legacy = [
    { version: 1, preset: 'originale', background: null, accent: null },
    { version: 1, preset: 'grafite', background: null, accent: null },
    { version: 1, preset: 'lavanda', background: '#101020', accent: '#C4B5FD' },
    { version: 1, preset: 'petrolio', background: null, accent: null },
    { version: 1, preset: 'ardesia', background: null, accent: null },
    { version: 1, preset: 'prugna', background: null, accent: null },
  ];
  for (const preference of legacy) assert.deepEqual(JSON.parse(JSON.stringify(themes.validaPreferenzaAspetto(preference))), preference);
  assert.equal(themes.selezionaPreset('grafite').background, '#151A20');
  assert.equal(themes.selezionaPreset('lavanda').accent, '#C4B5FD');
  assert.equal(themes.selezionaPreset('petrolio').accent, '#FCD34D');
  assert.throws(() => themes.validaPreferenzaAspetto({ ...original, preset: 'unknown' }));
});
function renderAppearance({ draft = original, saved = original, viewport = { width: 390, height: 844, fontScale: 1 } } = {}) {
  const nodes = [], calls = [], hookState = ['main', false]; let cursor = 0;
  const host = name => ({ children, ...props }) => {
    if (name === 'Modal' && !props.visible) return null;
    nodes.push({ name, ...props }); return React.createElement('div', null, children);
  };
  const native = { ...Object.fromEntries(['Pressable','ScrollView','Text','View','Modal'].map(name => [name, host(name)])), StyleSheet: { create: value => value }, useWindowDimensions: () => viewport };
  const react = { ...React, useState: initial => { const i = cursor++; if (hookState[i] === undefined) hookState[i] = typeof initial === 'function' ? initial() : initial; return [hookState[i], value => { hookState[i] = typeof value === 'function' ? value(hookState[i]) : value; }]; } };
  const screen = load('AppearanceScreen.tsx', { react, 'react-native': native, 'react-native-safe-area-context': { SafeAreaView: host('SafeAreaView'), useSafeAreaInsets: () => ({ top: 20, bottom: 20, left: 0, right: 0 }) }, '@expo/vector-icons': { Ionicons: host('Ionicons') }, '../temi': themes });
  let currentDraft = draft, currentSaved = saved, html = '';
  const draw = () => { nodes.length = 0; cursor = 0; html = renderToStaticMarkup(React.createElement(screen.default, {
    draft: currentDraft, saved: currentSaved,
    onDraft: value => { currentDraft = value; calls.push(['draft', value]); },
    onSave: () => { calls.push(['save', currentDraft]); currentSaved = currentDraft; },
    onReset: () => { calls.push(['reset']); currentDraft = original; currentSaved = original; },
    onPreview: () => calls.push(['preview', currentDraft]), onBack: () => calls.push(['back']),
  })); };
  draw();
  const press = label => { const node = nodes.find(item => item.name === 'Pressable' && item.accessibilityLabel === label); assert.ok(node, label); node.onPress(); };
  return { nodes, calls, get html() { return html; }, get draft() { return currentDraft; }, get saved() { return currentSaved; }, draw, press };
}
test('UI mostra temi senza codici, evidenzia selezione e mantiene provvisorio prima del salvataggio', () => {
  const r = renderAppearance();
  for (const name of ['Blu elettrico','Neon viola','Grafite','Oceano','Verde smeraldo','Rosso rubino','Oro e nero','Petrolio e ambra','Notte e lavanda','Ardesia e ghiaccio','Prugna e rosa','Halloween','Natale','Militare','Cartoon','Galaxy','Cyberpunk','Inverno','Gold']) assert.ok(r.nodes.some(node => node.accessibilityLabel === `Tema ${name}`), name);
  assert.doesNotMatch(r.html, /#[0-9a-fA-F]{6}/);
  assert.ok(r.nodes.some(node => node.accessibilityLabel === 'Tema Originale' && node.accessibilityState.selected));
  assert.equal(r.calls.length, 0, 'il primo rendering non salva');
  r.press('Tema Neon viola');
  assert.equal(r.draft.preset, 'neon-viola'); assert.equal(r.saved.preset, 'originale');
  assert.deepEqual(r.calls.map(call => call[0]), ['draft']);
  r.draw(); assert.equal(r.nodes.find(node => node.accessibilityLabel === 'Salva colori').accessibilityState.disabled, false);
  r.press('Salva colori'); assert.equal(r.saved.preset, 'neon-viola'); assert.deepEqual(r.calls.map(call => call[0]), ['draft','save']);
});
test('menu manuale: scelta colore nominata, ritorno alla pagina e nessun codice esadecimale', () => {
  const r = renderAppearance(); r.press('SFONDO'); r.draw();
  assert.ok(r.html.includes('Blu notte')); assert.ok(r.html.includes('Petrolio')); assert.doesNotMatch(r.html, /#[0-9a-fA-F]{6}/);
  r.press('Blu notte'); assert.equal(r.draft.background, '#07111F'); assert.equal(r.draft.preset, 'originale');
  r.draw(); r.press('CERCHIO ED EVIDENZE'); r.draw(); assert.ok(r.html.includes('Ciano'));
  r.press('Rosa'); assert.equal(r.draft.accent, '#FDA4AF'); assert.equal(r.saved.preset, 'originale');
});
test('il colore speciale corrente è nominato e selezionato anche nel menu manuale', () => {
  const special = { version: 1, preset: 'halloween', background: null, accent: null };
  const r = renderAppearance({ draft: special, saved: special }); r.press('CERCHIO ED EVIDENZE'); r.draw();
  assert.equal(r.nodes.find(node => node.accessibilityLabel === 'Arancio').accessibilityState.selected, true);
  r.press('Annulla scelta colore'); r.draw(); r.press('SFONDO'); r.draw();
  assert.equal(r.nodes.find(node => node.accessibilityLabel === 'Halloween').accessibilityState.selected, true);
});
test('anteprima app usa bozza senza salvarla; annullamento mantiene la selezione e reset richiede conferma', () => {
  const r = renderAppearance(); r.press('Tema Cyberpunk'); r.press('ANTEPRIMA APP');
  assert.deepEqual(r.calls.map(call => call[0]), ['draft','preview']); assert.equal(r.saved.preset, 'originale');
  assert.equal(r.calls[1][1].preset, 'cyberpunk');
  r.press('Ripristina colori originali'); r.draw(); assert.ok(r.nodes.some(node => node.name === 'Modal' && node.visible));
  assert.equal(r.calls.some(call => call[0] === 'reset'), false);
  r.press('Annulla ripristino'); assert.equal(r.calls.some(call => call[0] === 'reset'), false);
  r.press('Ripristina colori originali'); r.draw(); r.press('Conferma ripristino colori');
  assert.equal(r.calls.at(-1)[0], 'reset'); assert.equal(r.draft.preset, 'originale'); assert.equal(r.saved.preset, 'originale');
});
test('layout adattabile: griglia a due colonne stretta, tre ampia e scroll disponibile', () => {
  const { appearanceLayout } = load('AppearanceScreen.tsx', { react: React, 'react-native': { StyleSheet: { create: x => x } }, 'react-native-safe-area-context': { SafeAreaView: () => null }, '@expo/vector-icons': { Ionicons: () => null }, '../temi': themes });
  assert.equal(appearanceLayout(320).columns, 2); assert.equal(appearanceLayout(430).columns, 3);
  const r = renderAppearance({ viewport: { width: 320, height: 568, fontScale: 2 } });
  assert.ok(r.nodes.some(node => node.name === 'ScrollView'));
  assert.ok(r.nodes.filter(node => node.name === 'Pressable').every(node => node.accessibilityRole === 'button'));
});
