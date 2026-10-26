const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const app = fs.readFileSync('App.js', 'utf8');
const start = app.indexOf("  if (screen === 'home') {");
const end = app.indexOf('\n  return (', start);
const code = babel.transformSync(`function home() { ${app.slice(start, end)} }`, {
  babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-react-jsx'],
}).code;
function mount(overrides = {}) {
  const calls = [];
  const env = {
    ThemeScenery:'ThemeScenery',preferenzaAspetto:{version:1,preset:'natale',background:null,accent:null}, screen: 'home', paletteHome: {homeAccent:'#5EEBFF'}, profilo: {nome:'Utente reale'},
    fotoProfilo: 'foto-reale', numeroNotifiche: 7, etaServizio: null, etaServizioLoading: false,
    turnoInCorso: null, turnoOggi: null, prossimoServizioMeteo: null, turni: [], oreStipendioMese: 123.5,
    extraStipendioMese: 4.75, haOverrideGpgMese: false, statistiche: {notti:2},
    anno: 2026, mese: 9,
    giornateStipendioMese: [{anno:2026,mese:10,giorno:1},{anno:2026,mese:10,giorno:1},{anno:2026,mese:10,giorno:2}],
    React: {createElement: (type, props) => ({type, props})}, HomeScreen: 'HomeScreen',
    setRitornoListaTurni: value => calls.push(['ritornoListaTurni',value]), setRitornoAspetto: value => calls.push(['ritornoAspetto',value]), setOrigineSocial: value => calls.push(value), setScreen: value => calls.push(value), apriProfilo: () => calls.push('profilo-originale'),
    aggiornaColleghi: async () => calls.push('aggiorna-colleghi'),
    caricaRiepilogoConversazioni: async () => ({nonLetti:7}), caricaConsegneRicevute: async () => ['consegna'],
    setRiepilogoChat: value => calls.push(value.nonLetti), setConsegneRicevute: value => calls.push(value[0]),
    ...overrides,
  };
  vm.createContext(env);
  vm.runInContext(fs.readFileSync('turniCalcoli.js','utf8').replaceAll('export function ', 'function '), env);
  vm.runInContext(fs.readFileSync('straordinariManuali.js','utf8').replaceAll('export function ', 'function '), env);
  vm.runInContext(fs.readFileSync('straordinariGpg.js','utf8').replace(/^import .*;\n/gm,'').replaceAll('export function ', 'function '), env);
  vm.runInContext(code, env);
  return {props:env.home().props, calls, env};
}
test('il ramo Home reale riceve dati e riepiloghi esistenti, senza duplicare giornate', () => {
  const {props,env} = mount();
  assert.equal(props.turni, env.turni); assert.equal(props.profilo, env.profilo);
  assert.equal(props.fotoProfilo, 'foto-reale'); assert.equal(props.numeroNotifiche, 7);
  assert.equal(props.monthlySummary.hours, '123.5 h'); assert.equal(props.monthlySummary.extra, '4.8 h');
  assert.equal(props.monthlySummary.days, 2); assert.equal(props.monthlySummary.monthIndex, 9);
  assert.equal(props.monthlySummary.month, props.periodo);
  const manual = mount({haOverrideGpgMese:true});
  assert.equal(manual.props.extra, manual.env.formattaOreGpg(4.75));
  assert.equal(manual.props.monthlySummary.extra, manual.props.extra);
  assert.equal(mount({giornateStipendioMese:[],oreStipendioMese:0,extraStipendioMese:0}).props.monthlySummary.days, 0);
});
test('callback del ramo reale: calendario, destinazioni originali, profilo, colleghi e campanella', async () => {
  const {props,calls} = mount();
  props.onCalendar(); props.onNavigate('strumenti'); props.onNavigate('stipendio');
  props.onProfile(); await props.onColleghi(); await props.onNotifications();
  assert.deepEqual(calls, ['calendar','strumenti','stipendio','profilo-originale','colleghi','aggiorna-colleghi',7,'consegna','centroNotifiche']);
  assert.equal(typeof props.onSocial, 'function'); assert.equal(typeof props.onSettings, 'function');
});
test('rientro Android dalle sezioni principali; editor e iOS non intercettati', () => {
  const a = app.indexOf('  // Solo le destinazioni principali della Home:');
  const b = app.indexOf('\n\n  useEffect', a);
  for (const [screen, os, expected] of [['calendar','android','home'],['aspettoColori','android',null],['edit','android',null],['calendar','ios',null],['home','android',null]]) {
    let handler,removed=false,destination;
    const env={Platform:{OS:os},OFFLINE_TEST:false,accessoTest:true,biometriaInizializzata:true,
      biometriaAbilitata:false,biometriaSbloccata:true, screen, origineSocial:false, ritornoListaTurni:'home',
      useEffect:fn=>{env.cleanup=fn();}, setScreen:value=>destination=value,
      BackHandler:{addEventListener:(name,fn)=>{assert.equal(name,'hardwareBackPress');handler=fn;return{remove:()=>removed=true};}}};
    vm.runInNewContext(app.slice(a,b),env);
    if(expected){assert.equal(handler(),true);assert.equal(destination,expected);env.cleanup();assert.ok(removed);}
    else assert.equal(handler,undefined);
  }
});
test('entry point reale senza preview; parser accetta l’intera app e conserva le schermate originali', () => {
  babel.parseSync(app,{babelrc:false,configFile:false,parserOpts:{plugins:['jsx']}});
  for(const file of ['App.js','index.js','HomeScreen.js','HomeArtwork.js','ElectricConnections.js','homeElectric.js','homeModel.js']) {
    assert.doesNotMatch(fs.readFileSync(file,'utf8'), /(?:from\s*|require\(\s*)['"][^'"]*(?:homePreview|demoData|HomeDemo)/);
  }
  const home = fs.readFileSync('HomeScreen.js','utf8');
  for(const route of ['calendar','turni','strumenti','stipendio','listaChat','calendarioColleghi','aspettoColori']) {
    assert.ok(home.includes(`navigate('${route}')`),route);
    assert.ok(app.includes(`'${route}'`),route);
  }
  assert.ok(app.indexOf('if (!accessoTest)') < start);
  assert.ok(app.indexOf('if (biometriaAbilitata && !biometriaSbloccata)') < start);
});

test('Home apre Social reale',()=>{const {props,calls}=mount();props.onSocial();assert.deepEqual(calls,[true,'social']);});

test('Home apre le nuove Impostazioni',()=>{const {props,calls}=mount();props.onSettings();assert.deepEqual(calls,['impostazioni']);});

test('menu Home precedente: Aspetto e colori conserva il ritorno originale al Profilo',()=>{
 const {props,calls}=mount();props.onNavigate('aspettoColori');
 assert.deepEqual(calls,[['ritornoAspetto','profile'],'aspettoColori']);
});


test('Lista turni dalla Home imposta il ritorno Home e il prossimo servizio mantiene il riferimento originale',()=>{
 const future={id:'future',indirizzo_servizio:'Via reale'};
 const r=mount({prossimoServizioMeteo:{turno:future}});assert.equal(r.props.etaTurno,future);
 r.props.onNavigate('turni');assert.deepEqual(r.calls,[['ritornoListaTurni','home'],'turni']);
 const active={id:'active'};assert.equal(mount({turnoInCorso:active,prossimoServizioMeteo:{turno:future}}).props.etaTurno,active);
});
test('ritorno della Lista turni: pulsante e back Android rispettano Home o Agenda senza modificare il mese',()=>{
 const ast=babel.parseSync(app,{babelrc:false,configFile:false,parserOpts:{plugins:['jsx']}});
 const body=ast.program.body.find(n=>n.type==='ExportDefaultDeclaration').declaration.body.body;
 const branch=body.find(n=>n.type==='IfStatement'&&/screen\s*===\s*'turni'/.test(app.slice(n.test.start,n.test.end)));
 let attribute;
 function walk(n){if(!n||typeof n!=='object')return;if(n.type==='JSXOpeningElement'&&n.name.name==='Back')attribute=n.attributes.find(a=>a.name?.name==='onPress');for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}
 walk(branch);assert.ok(attribute);
 for(const origin of ['home','calendar']){
   let destination,handler;
   const env={ritornoListaTurni:origin,tornaCalendario:()=>destination='calendar',tornaHome:()=>destination='home'};
   const expression=attribute.value.expression;
   vm.runInNewContext('('+app.slice(expression.start,expression.end)+')()',env);assert.equal(destination,origin);
   destination=null;
   Object.assign(env,{screen:'turni',origineSocial:false,Platform:{OS:'android'},OFFLINE_TEST:false,accessoTest:true,biometriaInizializzata:true,biometriaAbilitata:false,biometriaSbloccata:true,useEffect:fn=>fn(),setScreen:v=>destination=v,BackHandler:{addEventListener:(_,fn)=>{handler=fn;return{remove(){}};}}});
   const a=app.indexOf('  // Solo le destinazioni principali della Home:'),b=app.indexOf('\n\n  useEffect',a);
   vm.runInNewContext(app.slice(a,b),env);handler();assert.equal(destination,origin);
 }
});
