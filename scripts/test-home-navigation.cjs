const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const babel = require('@babel/core');
const loadPure = file => {
  const c = {}; vm.createContext(c);
  vm.runInContext(fs.readFileSync(file, 'utf8').replaceAll('export function ', 'function ').replaceAll('export const ', 'var '), c);
  return c;
};
const model = loadPure('homeModel.js'), themes = loadPure('temi.js'), electric = loadPure('homeElectric.js');
const source = fs.readFileSync('HomeScreen.js', 'utf8');
const compiled = babel.transformSync(source, { babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'] }).code;

// Render actual JSX and invoke its Pressable callbacks. Native effects are mocked;
// this verifies menu wiring, accessible labels and modal visibility, not device layout.
function render(menu = null, options = {}) {
  const presses = new Map(), interactions = new Map(), calls = [], effects = [], setters = [], animations = [], targets = [], nodes = [];
  let stateIndex = 0, starts = 0, stops = 0;
  const host = name => ({ children, ...props }) => {
    if (name === 'Modal' && !props.visible) return null;
    const style = typeof props.style === 'function' ? props.style({pressed:false}) : props.style;
    const flatStyle = Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
    nodes.push({name,...props,children,flatStyle});
    if (name === 'Pressable') interactions.set(props.accessibilityLabel, props);
    if (name === 'Pressable') presses.set(props.accessibilityLabel || (typeof children?.[0]?.props?.children === 'string' ? children[0].props.children : ''), props.onPress);
    if (name === 'Text' && props.children) return React.createElement('span', null, children);
    return React.createElement('div', { 'data-native': name, 'aria-label': props.accessibilityLabel, 'data-hidden': props.accessibilityElementsHidden }, children);
  };
  class Value { setValue() {} stopAnimation() {} interpolate(config) { return {interpolation:config}; } }
  const native = Object.fromEntries(['Image','Modal','Pressable','ScrollView','Switch','Text','View'].map(n => [n, host(n)]));
  Object.assign(native, {
    Animated: { Value, View: host('AnimatedView'), timing: (v, config) => { animations.push(config); targets.push({value:v,config}); return { start: () => {} }; }, spring: (v, config) => { animations.push(config); return { start: () => {} }; }, sequence: x => x, delay: () => ({}), loop: () => ({ start: () => starts++, stop: () => stops++ }) },
    Easing: { linear: x => x }, AccessibilityInfo: {}, AppState: { currentState: 'active' }, Linking: { openURL: async url => calls.push(['url', url]) },
    StyleSheet: { create: x => x, absoluteFillObject: {}, absoluteFill: {} },
    useWindowDimensions: () => options.viewport || ({ width: 320, height: 568, fontScale: 1 }),
  });
  const react = { ...React,
    useMemo: fn => fn(), useEffect: fn => effects.push(fn), useRef: value => ({ current: value }),
    useState: initial => {
      let value = typeof initial === 'function' ? initial() : initial;
      const overrides = { 0: options.now ?? value, 1: options.active ?? true, 2: options.reduced ?? false, 3: options.energy ?? false, 4: options.ready ?? true };
      if (stateIndex in overrides) value = overrides[stateIndex];
      stateIndex++;
      if (value === null) value = menu;
      if (value?.width === 0) value = options.area || { width: 296, height: 350 };
      return [value, update => setters.push(update)];
    },
  };
  const imports = {
    react, 'react-native': native, 'react-native-safe-area-context': { SafeAreaView: host('SafeAreaView') },
    '@expo/vector-icons': { Ionicons: host('Ionicons') },
    'react-native-svg': { __esModule: true, default: host('Svg'), ...Object.fromEntries(['Circle','Defs','Ellipse','G','Line','LinearGradient','Path','RadialGradient','Rect','Stop'].map(name=>[name,host(name)])) },
    '@react-native-async-storage/async-storage': { setItem: async () => {} }, './temi': themes, './homeModel': model, './homeElectric': electric,
  };
  const artworkCode = babel.transformSync(fs.readFileSync('HomeArtwork.js','utf8'), {babelrc:false,configFile:false,plugins:['@babel/plugin-transform-react-jsx','@babel/plugin-transform-modules-commonjs']}).code;
  const artwork = {exports:{},require:name=>{assert.ok(imports[name],name);return imports[name];}};
  vm.runInNewContext(artworkCode,artwork);imports['./HomeArtwork']=artwork.exports;
  const connectionCode = babel.transformSync(fs.readFileSync('ElectricConnections.js', 'utf8'), { babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'] }).code;
  const connections = { exports: {}, require: name => { assert.ok(imports[name], name); return imports[name]; } };
  vm.runInNewContext(connectionCode, connections);
  imports['./ElectricConnections'] = connections.exports;
  const c = { exports: {}, require: name => { assert.ok(imports[name], name); return imports[name]; } };
  vm.runInNewContext(compiled, c);
  const html = renderToStaticMarkup(React.createElement(c.exports.default, {
    profilo: { nome: 'Andrea', punto_partenza: 'Partenza' }, numeroNotifiche: 3, turni: [],
    ore: '100.5 h', extra: '4.5 h', notti: 3, periodo: 'ottobre 2026',
    onProfile: () => calls.push('profile'), onNotifications: () => calls.push('notifications'),
    onNavigate: screen => calls.push(screen), onColleghi: () => calls.push('colleghi'), onAddShift: () => calls.push('add'), ...options.props,
  }));
  return { presses, interactions, calls, html, setters, effects, animations, targets, nodes, starts: () => starts, stops: () => stops };
}

test('Home iniziale: quattro azioni, intestazione e riepilogo mensile; nessuno ScrollView', () => {
  const r = render();
  for (const label of ['Calendario', 'Strumenti', 'Stipendio', 'Social', 'Impostazioni', 'Profilo', 'Notifiche, 3 non lette']) assert.ok(r.presses.has(label), label);
  assert.ok(!r.html.includes('data-native="ScrollView"'));
  assert.ok(r.html.includes('LAVORATE')); assert.ok(r.html.includes('GIORNI'));assert.ok(!r.html.includes('Ore totali'));assert.ok(!r.html.includes('Notti'));
  r.presses.get('Strumenti')(); r.presses.get('Stipendio')(); r.presses.get('Profilo')(); r.presses.get('Notifiche, 3 non lette')();
  assert.deepEqual(r.calls, ['strumenti', 'stipendio', 'profile', 'notifications']);
  r.presses.get('Social')(); assert.equal(r.setters.at(-1), 'social');
});
test('Social conserva chat, turni condivisi e gestione colleghi', () => {
  const r = render('social');
  r.presses.get('Chat')(); r.presses.get('Condivisione turni')(); r.presses.get('Colleghi e richieste')();
  assert.deepEqual(r.calls, ['listaChat', 'calendarioColleghi', 'colleghi']);
  assert.ok(r.html.includes('data-hidden="true"'));
  assert.ok(r.presses.has('Chiudi'));
});
test('Calendario conserva lista turni e aggiunta', () => {
  const r = render('calendar');
  r.presses.get('Apri calendario')(); r.presses.get('Lista turni')(); r.presses.get('Aggiungi turno')();
  assert.deepEqual(r.calls, ['calendar', 'turni', 'add']);
});
test('Impostazioni conserva profilo, personalizzazione e comando energia', () => {
  const r = render('settings');
  r.presses.get('Il mio profilo e impostazioni')(); r.presses.get('Aspetto e colori')();
  assert.deepEqual(r.calls, ['profile', 'aspettoColori']);
  assert.ok(r.html.includes('Risparmio energia'));
});

test('animazioni sul driver nativo, non interattive e fermate allo smontaggio', () => {
  const r = render(); const cleanup = r.effects.slice(2).map(effect => effect());
  assert.equal(r.starts(), 4);
  assert.ok(r.animations.length > 0);
  for (const animation of r.animations) {
    assert.equal(animation.useNativeDriver, true); assert.equal(animation.isInteraction, false);
  }
  cleanup.forEach(stop => { if (typeof stop === 'function') stop(); }); assert.equal(r.stops(), 4);
});
for (const [name, options, menu] of [
  ['Reduce Motion', { reduced: true }, null],
  ['risparmio energia', { energy: true }, null],
  ['background', { active: false }, null],
  ['preferenze ancora in caricamento', { ready: false }, null],
  ['menu aperto', {}, 'social'],
]) test(`nessun loop con ${name}`, () => {
  const r = render(menu, options); r.effects.slice(2).forEach(effect => effect()); assert.equal(r.starts(), 0);
});

test('lampo al contatto, navigazione immediata al rilascio senza aspettare l’animazione', () => {
  for (const label of ['Calendario','Strumenti','Stipendio','Social']) {
    const r=render(), button=r.interactions.get(label);
    button.onPressIn();
    assert.ok(r.animations.some(animation=>animation.duration===240 && animation.useNativeDriver));
    assert.equal(r.calls.length,0); assert.equal(r.setters.length,0);
    button.onPressOut(); button.onPress();
    if(label==='Strumenti'||label==='Stipendio') assert.deepEqual(r.calls,[label.toLowerCase()]);
    else assert.equal(r.setters.at(-1),label==='Social'?'social':'calendar');
  }
});
test('Reduce Motion e risparmio energia sopprimono il lampo ma conservano il tap', () => {
  for (const options of [{reduced:true},{energy:true}]) {
    const r=render(null,options),button=r.interactions.get('Strumenti');
    button.onPressIn();button.onPressOut();button.onPress();
    assert.equal(r.animations.length,0);assert.deepEqual(r.calls,['strumenti']);
  }
});

test('nessuna barra inferiore; collegamenti conservati nei menu',()=>{
 const r=render();
 for(const label of ['Home','Turni','Chat','Stipendio','Altro'])assert.ok(!r.presses.has(`${label}, navigazione`));
 const settings=render('settings');settings.presses.get('Sezioni dell’app')();assert.equal(settings.setters.at(-1),'more');
 const sections=render('more');sections.presses.get('Lista turni')();sections.presses.get('Chat')();sections.presses.get('Stipendio')();
 assert.deepEqual(sections.calls,['turni','listaChat','stipendio']);
 sections.presses.get('Calendario e turni')();assert.equal(sections.setters.at(-1),'calendar');
 sections.presses.get('Social e colleghi')();assert.equal(sections.setters.at(-1),'social');
});
test('anelli con clock indipendenti: giro interno orario in 30 secondi, scia esterna in 22 e alone in 7',()=>{
 const r=render();r.effects.slice(2).forEach(effect=>effect());
 const inner=r.targets.find(t=>t.config.duration===30000),outer=r.targets.find(t=>t.config.duration===22000),halo=r.targets.find(t=>t.config.duration===7000);
 assert.ok(inner&&outer&&halo);assert.notEqual(inner.value,outer.value);assert.notEqual(inner.value,halo.value);
 for(const target of [inner,outer,halo]){assert.equal(target.config.toValue,1);assert.equal(target.config.useNativeDriver,true);assert.equal(target.config.isInteraction,false);}
 for(const id of ['home-ring-inner','home-ring-outer']){
  const node=r.nodes.find(n=>n.testID===id);assert.deepEqual(Array.from(node.flatStyle.transform[0].rotate.interpolation.outputRange),['0deg','360deg']);
 }
 const glow=r.nodes.find(n=>n.testID==='home-ring-halo');assert.equal(glow.flatStyle.transform,undefined);
 const values=Array.from(glow.flatStyle.opacity.interpolation.outputRange);assert.equal(values[0],values.at(-1));assert.ok(Math.max(...values)-Math.min(...values)<0.1);
});
test('cornice e livelli grafici 1:1, senza flex shrink né scale; contenuto fuori dai rotatori',()=>{
 for(const [width,height,fontScale] of [[320,568,1],[375,667,1],[390,844,1],[393,852,1.5],[430,932,2]]){
  const r=render(null,{viewport:{width,height,fontScale},area:{width:width-40,height:height-230}});
  for(const id of ['home-core-frame','home-core-visual','home-ring-inner','home-ring-outer','home-ring-halo']){
   const n=r.nodes.find(node=>node.testID===id),style=n.flatStyle;
   assert.equal(style.width,style.height);assert.equal(style.aspectRatio,1);assert.equal(style.flexShrink,0);
   assert.ok(!style.transform?.some(t=>'scale'in t||'scaleX'in t||'scaleY'in t));
  }
  const frame=r.nodes.find(n=>n.testID==='home-core-frame');assert.equal(frame.flatStyle.transform,undefined);
  const content=r.nodes.find(n=>n.testID==='home-core-content');assert.equal(content.flatStyle.transform,undefined);
  const clock=r.nodes.find(n=>n.testID==='home-countdown');assert.equal(clock.flatStyle.transform,undefined);
  assert.ok(!content.children.some(child=>child?.props?.testID?.startsWith('home-ring-')));
 }
});

test('sfondo fotografico opzionale con dissolvenza; nessuna fotografia inventata',()=>{
 const plain=render();assert.equal(plain.nodes.filter(n=>n.name==='Image').length,0);
 const photo=render(null,{props:{backgroundPhoto:{uri:'demo-original-photo'}}});
 assert.ok(photo.nodes.some(n=>n.name==='Image'&&n.source?.uri==='demo-original-photo'));
 const fade=photo.nodes.filter(n=>n.name==='Stop'&&n.stopColor==='#03081B').map(n=>Number(n.stopOpacity));
 assert.deepEqual(fade,[1,0.8,0.25,0.08]);
});
test('anelli e pulsanti ricevono colori dalla tavolozza esistente',()=>{
 const palette={...themes.PALETTE_ORIGINALE,homeAccent:'#FDA4AF'};
 const r=render(null,{props:{paletteHome:palette}}),colors=electric.coloriCircuiti(palette);
 for(const label of ['Calendario','Strumenti','Stipendio','Social'])assert.ok(r.interactions.has(label));
 for(const color of [colors[0],colors[3]])assert.ok(r.nodes.some(n=>n.name==='Stop'&&n.stopColor===color));
});

test('callback Social opzionale apre la nuova destinazione senza cambiare il menu preesistente',()=>{
 let opened=0;const r=render(null,{props:{onSocial:()=>opened++}});
 r.presses.get('Social')();assert.equal(opened,1);assert.equal(r.setters.length,0);
 const original=render();original.presses.get('Social')();assert.equal(original.setters.at(-1),'social');
});

test('callback Impostazioni opzionale: nuova schermata o menu originale senza callback',()=>{
 let opened=0;const r=render(null,{props:{onSettings:()=>opened++}});
 r.presses.get('Impostazioni')();assert.equal(opened,1);assert.equal(r.setters.length,0);
 const original=render();original.presses.get('Impostazioni')();assert.equal(original.setters.at(-1),'settings');
});

test('callback Calendario opzionale apre Agenda senza alterare il menu originale',()=>{
 let opened=0;const r=render(null,{props:{onCalendar:()=>opened++}});
 r.presses.get('Calendario')();assert.equal(opened,1);assert.equal(r.setters.length,0);
 const original=render();original.presses.get('Calendario')();assert.equal(original.setters.at(-1),'calendar');
});

test('riepilogo mensile richiesto, barra accessibile e vecchie card assenti dalla Home',()=>{
 const r=render(null,{props:{monthlySummary:{month:'OTTOBRE 2026',progress:81,hours:'208.0h',extra:'31h',days:'25'}}});
 for(const text of ['OTTOBRE 2026','AVANZ. 81%','208.0h','31h','25','LAVORATE','EXTRA','GIORNI'])assert.ok(r.html.includes(text),text);
 assert.equal(r.nodes.find(n=>n.testID==='home-monthly-progress').accessibilityValue.now,81);
 assert.equal(r.nodes.find(n=>n.testID==='home-monthly-progress-fill').flatStyle.width,'81%');
 for(const value of [-1,130,NaN]){
  const sample=render(null,{props:{monthlySummary:{month:'DEMO',progress:value,hours:'1h',extra:'0h',days:'1'}}});
  const progress=sample.nodes.find(n=>n.testID==='home-monthly-progress').accessibilityValue;
  assert.ok(progress.now===undefined||(progress.now>=0&&progress.now<=100));
 }
});
test('spazio centrale ampliato uniformemente senza muovere il testo o deformare gli anelli',()=>{
 for(const [width,height,fontScale] of [[320,568,1],[375,667,1],[390,844,1],[430,932,1.5]]){
  const r=render(null,{viewport:{width,height,fontScale},area:{width:width-40,height:height-220}});
  const frame=r.nodes.find(n=>n.testID==='home-core-frame').flatStyle;
  const content=r.nodes.find(n=>n.testID==='home-core-content').flatStyle;
  assert.equal(frame.width,frame.height);assert.equal(content.top,content.left);assert.equal(content.left,content.right);assert.equal(content.right,content.bottom);
  assert.ok(Math.abs((frame.width-2*content.left)/frame.width-.76)<1e-9);assert.equal(content.transform,undefined);
 }
});


test('rendering del servizio reale prima, durante e dopo: orari, postazione e label accessibile',()=>{
 const t={id:'reale',anno:2026,mese:10,giorno:25,tipo:'turno',inizio:'14:00',fine:'18:00',luogo:'Postazione reale'};
 for(const [hour,label,countdown] of [[12,'INIZIA TRA','2h 00m'],[15,'FINE TRA','3h 00m'],[19,'TURNO TERMINATO','0h 00m']]){
  const r=render(null,{now:new Date(2026,9,25,hour),props:{turni:[t]}});
  const core=r.nodes.find(n=>n.testID==='home-core-content');
  assert.ok(core.accessibilityLabel.includes(label));assert.ok(core.accessibilityLabel.includes(countdown));
  assert.ok(core.accessibilityLabel.includes('Postazione reale'));assert.ok(r.html.includes('14:00'));
 }
});
test('riepilogo reale segue il mese selezionato e il back della modale conserva la Home',()=>{
 const props={monthlySummary:{month:'ottobre 2026',year:2026,monthIndex:9,hours:'123.5 h',extra:'4 h 45 min',days:2}};
 const r=render(null,{now:new Date(2026,9,25,12),props});
 assert.equal(r.nodes.find(n=>n.testID==='home-monthly-progress').accessibilityValue.now,81);
 assert.ok(r.html.includes('4 h 45 min'));assert.ok(r.html.includes('123.5 h'));
 const modal=render('settings');modal.nodes.find(n=>n.name==='Modal').onRequestClose();
 assert.equal(modal.setters.at(-1),null);assert.deepEqual(modal.calls,[]);
});

test('Altro mantiene le opzioni Home precedenti, compreso il risparmio energia',()=>{
 let opened=0;const r=render('more',{props:{onSettings:()=>opened++}});
 r.presses.get('Impostazioni')();assert.equal(opened,0);assert.equal(r.setters.at(-1),'settings');
 assert.ok(render('settings').html.includes('Risparmio energia'));
});


test('percorsi visibili della Home reale: riepilogo e nucleo conservano Lista turni senza cambiare i quattro accessi', () => {
  const props = {onCalendar:()=>{},onSocial:()=>{},onSettings:()=>{}};
  const home=render(null,{props});
  home.interactions.get('Calendario').onPress();
  assert.equal(home.setters.length,0); // Il calendario resta diretto, nessun menu intermedio.
  const summary=home.nodes.find(n=>n.testID==='home-monthly-summary');
  summary.onPress();assert.equal(home.setters.at(-1),'summary');
  const core=home.nodes.find(n=>n.testID==='home-core-content');
  core.onPress();assert.equal(home.setters.at(-1),'service');
  for(const menu of ['summary','service']){
    const opened=render(menu,{props});
    opened.presses.get('Lista turni')();opened.presses.get('Apri calendario')();
    assert.deepEqual(opened.calls,['turni','calendar']);
    opened.nodes.find(n=>n.name==='Modal').onRequestClose();assert.equal(opened.setters.at(-1),null);
  }
});
test('indicazioni del prossimo servizio anche senza turni oggi: dati reali ricevuti, origine e destinazione codificate', async () => {
  const future={id:'future',anno:2026,mese:11,giorno:3,tipo:'turno',inizio:'06:00',fine:'14:00',indirizzo_servizio:'Via Roma 1 & ingresso B'};
  const opened=render('service',{props:{turni:[],etaTurno:future,etaServizio:{minuti:32,ritardo_traffico:4}}});
  assert.match(opened.html,/Prossimo servizio/);assert.match(opened.html,/32 min/);
  await opened.presses.get('Indicazioni stradali')();
  const url=new URL(opened.calls[0][1]);assert.equal(url.searchParams.get('destination'),future.indirizzo_servizio);
  assert.equal(url.searchParams.get('origin'),'Partenza');assert.equal(url.searchParams.get('travelmode'),'driving');
  assert.ok(!render('service',{props:{turni:[],etaTurno:null}}).presses.has('Indicazioni stradali'));
});
