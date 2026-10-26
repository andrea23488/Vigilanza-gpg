const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server'), ts = require('typescript');
const temi = require('../temi.js');

function load(name, imports) {
  const source = fs.readFileSync(path.join(__dirname, name), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { exports: module.exports, module, require: key => {
    assert.ok(key in imports, `Unexpected import: ${key}`);
    return imports[key];
  } });
  return module.exports;
}

const host = tag => ({ children, testID, width, height, viewBox, ...props }) => {
  const attrs = { ...(testID ? { 'data-testid': testID } : {}), ...(width ? { width } : {}), ...(height ? { height } : {}), ...(viewBox ? { viewBox } : {}) };
  if (tag === 'path' && props.d) attrs.d = props.d;
  return React.createElement(tag, attrs, children);
};
const svg = Object.fromEntries(['Svg','Circle','Ellipse','Line','Path','Polygon','Rect'].map(name => [name, host(name === 'Svg' ? 'svg' : name.toLowerCase())]));
svg.__esModule = true; svg.default = host('svg');
class AnimatedValue { stopAnimation() {} setValue() {} interpolate() { return 0; } }
const native = {
  Platform: { OS: 'web' },
  AccessibilityInfo: { addEventListener: () => ({ remove() {} }), isReduceMotionEnabled: () => Promise.resolve(true) },
  Animated: { Value: AnimatedValue, View: host('div'), timing: () => ({ start() {} }), delay: () => ({}), sequence: () => ({}), loop: () => ({ start() {}, stop() {} }) },
  AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
  StyleSheet: { create: styles => styles, absoluteFillObject: {} },
  View: host('div'),
  useWindowDimensions: () => ({ width: 390, height: 844 }),
};
const safeArea = { useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }) };
const decorations = load('ThemeDecorations.tsx', { react: React, 'react-native': native, 'react-native-safe-area-context': safeArea, 'react-native-svg': svg });
const { ThemeProvider, useDemoTheme } = load('ThemeContext.tsx', { react: React, 'react-native': native, '@expo/vector-icons': { Ionicons: host('span') }, '../temi': temi, './ThemeDecorations': { __esModule: true, default: decorations.default } });

function renderTheme(preference) {
  function Consumer() {
    const theme = useDemoTheme();
    return React.createElement('output', {
      'data-theme': theme.preset.id,
      'data-special': String(theme.special),
      'data-background': theme.palette.background,
      'data-surface': theme.palette.surface,
      'data-accent': theme.palette.homeAccent,
      'data-secondary': theme.palette.homeAccentSecondary,
    });
  }
  return renderToStaticMarkup(React.createElement(ThemeProvider, { preference }, React.createElement(Consumer)));
}

test('provider globale espone una palette coerente e i ruoli condivisi', () => {
  const preference = { version: 1, preset: 'neon-viola', background: null, accent: null };
  const html = renderTheme(preference);
  const expected = temi.generaPalette(preference);
  for (const [key, value] of [['data-background', expected.background], ['data-surface', expected.surface], ['data-accent', expected.homeAccent], ['data-secondary', expected.homeAccentSecondary]]) {
    assert.ok(html.includes(`${key}="${value}"`), key);
  }
  assert.ok(html.includes('data-special="false"'));
});

test('tutti gli otto temi speciali sono distinti e il provider li espone globalmente', () => {
  const ids = ['natale', 'halloween', 'cartoon', 'militare', 'galaxy', 'inverno', 'cyberpunk', 'gold-special'];
  const rendered = ids.map(id => {
    const preference = { version: 1, preset: id, background: null, accent: null };
    const html = renderTheme(preference);
    assert.ok(html.includes(`data-theme="${id}"`));
    assert.ok(html.includes('data-special="true"'));
    assert.ok(html.includes(`data-background="${temi.generaPalette(preference).background}"`));
    assert.ok(html.includes('data-testid="theme-decoration-layer"'));
    return html;
  });
  assert.equal(new Set(rendered).size, ids.length);
});

test('Natale rende neve e albero; Halloween rende pipistrelli, zucca, ragnatela e fantasma senza neve', () => {
  const christmas = renderTheme({ version: 1, preset: 'natale', background: null, accent: null });
  const halloween = renderTheme({ version: 1, preset: 'halloween', background: null, accent: null });
  assert.equal((christmas.match(/data-testid="theme-snowflake"/g) || []).length, 4);
  for (const id of ['theme-art-christmas-tree','theme-art-christmas-lights','theme-art-christmas-star']) assert.ok(christmas.includes(`data-testid="${id}"`), id);
  for (const id of ['theme-art-halloween-web','theme-art-halloween-pumpkin','theme-art-halloween-ghost','theme-art-halloween-zombie']) assert.ok(halloween.includes(`data-testid="${id}"`), id);
  assert.equal((halloween.match(/data-testid="theme-bat"/g) || []).length, 2);
  assert.equal((halloween.match(/data-testid="theme-snowflake"/g) || []).length, 0);
});

test('Cartoon e Militare renderizzano arcobaleno/castello e camouflage/bussola', () => {
  const cartoon = renderTheme({ version: 1, preset: 'cartoon', background: null, accent: null });
  const military = renderTheme({ version: 1, preset: 'militare', background: null, accent: null });
  for (const id of ['theme-art-cartoon-rainbow','theme-art-cartoon-castle','theme-art-cartoon-cloud','theme-art-cartoon-stars']) assert.ok(cartoon.includes(`data-testid="${id}"`), id);
  for (const id of ['theme-art-military-camo','theme-art-military-compass','theme-art-military-topography']) assert.ok(military.includes(`data-testid="${id}"`), id);
  assert.ok((cartoon.match(/<path/g) || []).length >= 8);
  assert.ok((military.match(/<path/g) || []).length >= 4);
});

test('Galaxy, Cyberpunk, Inverno e Gold rendono i rispettivi motivi SVG', () => {
  const cases = [
    ['galaxy',['theme-art-galaxy-planet','theme-art-galaxy-stars','theme-art-galaxy-twinkle']],
    ['cyberpunk',['theme-art-cyberpunk-circuit','theme-art-cyberpunk-traces','theme-art-cyberpunk-scan']],
    ['inverno',['theme-art-winter-frost','theme-art-winter-crystal','theme-winter-particle']],
    ['gold-special',['theme-art-gold-filigree','theme-art-gold-medallion','theme-art-gold-shimmer']],
  ];
  for (const [id,artIds] of cases) {
    const html = renderTheme({ version: 1, preset: id, background: null, accent: null });
    for (const artId of artIds) assert.ok(html.includes(`data-testid="${artId}"`), artId);
    assert.ok((html.match(/<svg/g) || []).length >= 3, `${id} contains rendered SVG artwork`);
  }
});

test('reset tema standard rimuove completamente il layer grafico', () => {
  const normal = renderTheme({ version: 1, preset: 'originale', background: null, accent: null });
  assert.ok(!normal.includes('theme-decoration-layer'));
});

test('le animazioni si avviano solo senza Reduce Motion e con app attiva', () => {
  function loopCount({ reduced, foreground }) {
    let stateIndex = 0, started = 0;
    const effects = [];
    class Value extends AnimatedValue { interpolate() { return 0; } }
    const react = { ...React,
      useState: initial => { const index = stateIndex++; return [index === 0 ? reduced : foreground, () => {}]; },
      useRef: initial => ({ current: initial }),
      useEffect: effect => effects.push(effect),
    };
    const rn = { ...native, AppState: { currentState: foreground ? 'active' : 'background', addEventListener: () => ({ remove() {} }) },
      Animated: { ...native.Animated, Value, loop: () => ({ start() { started++; }, stop() {} }) } };
    const component = load('ThemeDecorations.tsx', { react, 'react-native': rn, 'react-native-safe-area-context': safeArea, 'react-native-svg': svg }).default;
    component({ theme: { id: 'halloween', accent: '#FF7A24' }, palette: { background: '#160B24', surface: '#21142D', accent: '#FF7A24', homeAccent: '#FF7A24' } });
    effects.forEach(effect => effect());
    return started;
  }
  assert.equal(loopCount({ reduced: true, foreground: true }), 0);
  assert.equal(loopCount({ reduced: false, foreground: false }), 0);
  assert.equal(loopCount({ reduced: false, foreground: true }), 1);
});
