const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const compile = file => babel.transformSync(fs.readFileSync(file,'utf8'), {babelrc:false,configFile:false,
  plugins:['@babel/plugin-transform-react-jsx','@babel/plugin-transform-modules-commonjs']}).code;
const codes = new Map();
const code = file => { if(!codes.has(file)) codes.set(file,compile(file)); return codes.get(file); };
const loadPure = file => {
  const c={exports:{},require:name=>{assert.equal(name,'./turniCalcoli');return calcoli;}};
  vm.runInNewContext(code(file),c);return c.exports;
};
const calcoli=loadPure('turniCalcoli.js'), model=loadPure('turniRapidiAnteprima.js');
const shift=(id,day,start='06:00',end='14:00',extra={})=>({id,anno:2026,mese:10,giorno:day,tipo:'turno',inizio:start,fine:end,luogo:'Servizio',indirizzo_servizio:'Postazione reale',...extra});
const quick={id:'evening',nome:'Sera',inizio:'14:00',fine:'22:00',operativita:'Piantonamento',postazione:'Aeroporto'};
const night={...quick,id:'night',nome:'Notte',inizio:'22:00',fine:'06:00'};
const key=day=>`2026-10-${String(day).padStart(2,'0')}`;
const plan=(options={})=>model.creaAnteprimaRapidi({mode:'insert',model:quick,dates:[key(5)],records:[],...options});
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

test('selezione pura: toggle, date uniche, mesi e anni distinti, date invalide',()=>{
  const original=freeze([]);let dates=model.alternaDataRapida(original,key(5));
  dates=model.alternaDataRapida(dates,'2026-11-05');assert.equal(dates.length,2);
  dates=model.alternaDataRapida(dates,key(5));assert.deepEqual(Array.from(dates),['2026-11-05']);
  assert.equal(model.alternaDataRapida(dates,'2026-02-30'),dates);assert.equal(original.length,0);
  assert.equal(model.chiaveDataRapida(2024,1,29),'2024-02-29');assert.equal(model.chiaveDataRapida(2026,1,29),'');
});
test('data libera e turno compatibile: solo aggiunte descrittive, nessuna sostituzione',()=>{
  assert.equal(plan().canConfirm,true);assert.ok(plan().rows[0].states.includes('data-libera'));
  const p=plan({records:freeze([shift(1,5,'06:00','14:00')])});
  assert.equal(p.canConfirm,true);assert.ok(p.rows[0].states.includes('turno-presente'));
  assert.equal(p.rows[0].operations[0].action,'insert');assert.equal(p.rows[0].candidate.postazione,'Aeroporto');
});
test('duplicati, sovrapposizioni, riposi e ferie bloccano la conferma dell’intero insieme',()=>{
  for(const [existing,state] of [[shift(1,5,'14:00','22:00'),'duplicato'],[shift(1,5,'13:00','16:00'),'sovrapposizione'],[shift(1,5,'','',{tipo:'riposo'}),'assenza'],[shift(1,5,'','',{tipo:'ferie'}),'assenza']]){
    const p=plan({dates:[key(5),key(6)],records:[existing]});
    assert.equal(p.canConfirm,false);assert.equal(p.blocked,1);assert.ok(p.rows[0].states.includes(state));
    assert.equal(p.rows[0].operations.length,0);assert.equal(p.rows[0].conflicts.length,1);
  }
});
test('notturni: conflitto sulla data adiacente anche cambiando mese o anno',()=>{
  const next=shift(1,1,'05:00','10:00',{mese:11});
  const p=plan({model:night,dates:['2026-10-31'],records:[next]});
  assert.equal(p.canConfirm,false);assert.ok(p.rows[0].states.includes('notturno'));assert.equal(p.rows[0].conflicts[0].date,'2026-11-01');
  const previous=shift(2,31,'22:00','06:00',{mese:12});
  assert.equal(plan({model:{...quick,inizio:'05:00',fine:'10:00'},dates:['2027-01-01'],records:[previous]}).canConfirm,false);
  assert.equal(plan({model:night,dates:[key(5),key(6)]}).canConfirm,true);
  assert.ok(!plan({records:[shift(3,5,'6:00','14:00')]}).rows[0].states.includes('notturno'));
  assert.ok(plan({mode:'delete',records:[shift(3,5,'06:00','06:00')]}).rows[0].states.includes('notturno'));
});
test('eliminazione: nessuna selezione implicita; scelta per ID, personali e assenze esclusi',()=>{
  const records=freeze([shift(1,5),shift(2,5,'16:00','20:00'),shift(3,5,'','',{tipo:'ferie'}),shift(4,5,'','',{tipo:'personal'})]);
  const p=plan({mode:'delete',model:null,records});assert.equal(p.canConfirm,false);assert.equal(p.rows[0].choices.length,2);
  assert.ok(p.rows[0].states.includes('multipli'));assert.ok(p.rows[0].choices.every(t=>!t.selected));
  const chosen=model.chiaveRecordRapido(records[1]);
  const selected=plan({mode:'delete',model:null,records,targets:[chosen]});
  assert.equal(selected.canConfirm,true);assert.equal(selected.operationCount,1);assert.equal(selected.rows[0].operations[0].id,'2');
  assert.equal(records.length,4);
});
test('eliminazione: ID mancanti o ambigui, date vuote, sole assenze e date invalide non sono consentiti',()=>{
  for(const records of [[],[shift(null,5)],[shift(1,5),shift(1,5,'16:00','20:00')],[shift(1,5),shift(1,6)],[shift(1,5,'','',{tipo:'riposo'})]]){
    const p=plan({mode:'delete',model:null,records,targets:[`${key(5)}|1`]});
    assert.equal(p.canConfirm,false);assert.ok(p.rows[0].states.includes('vietata'));
  }
  assert.equal(plan({dates:['2026-02-30']}).canConfirm,false);
  assert.equal(plan({model:{...quick,inizio:'30:00'}}).canConfirm,false);
  assert.equal(plan({records:[shift(1,5,'invalido','14:00')]}).canConfirm,false);
  assert.equal(plan({records:[shift(1,32)]}).canConfirm,false);
});
test('il piano e le conferme non alterano record, modelli o selezioni sorgenti',()=>{
  const input=freeze({mode:'delete',model:quick,dates:[key(5)],targets:[`${key(5)}|1`],records:[shift(1,5)]});
  const before=JSON.stringify(input);const p=model.creaAnteprimaRapidi(input);
  p.rows[0].choices[0].luogo='Solo descrizione';assert.equal(JSON.stringify(input),before);
});

// Renderer con stato persistente: esegue i callback reali e ripete il rendering.
// Il resolver ammette solo componenti di presentazione e helper puri; rete e storage
// restano indisponibili anche se una dipendenza venisse introdotta per errore.
function calendarHarness(initialRecords=[]) {
  const states=[],refs=[],calls=[];let stateIndex=0,refIndex=0,nodes=[],now=Date.now(),all=initialRecords;
  const palette={background:'#07111F',surface:'#101C2D',surfaceRaised:'#172536',border:'#456789',text:'#FFFFFF',textMuted:'#C0D0E0',homeAccent:'#168BFF',onAccent:'#FFFFFF',error:'#FF6B6B'};
  const host=name=>({children,...props})=>{
    if(name==='Modal'&&!props.visible)return null;
    nodes.push({name,...props,children});return React.createElement('div',null,children);
  };
  const react={...React,useEffect:()=>{},useMemo:fn=>fn(),useState:initial=>{
    const slot=stateIndex++;if(!(slot in states))states[slot]=typeof initial==='function'?initial():initial;
    return[states[slot],next=>{states[slot]=typeof next==='function'?next(states[slot]):next;}];
  },useRef:initial=>{const slot=refIndex++;return refs[slot]||(refs[slot]={current:initial});}};
  const native={...Object.fromEntries(['Modal','Pressable','ScrollView','Text','View'].map(n=>[n,host(n)])),StyleSheet:{create:s=>s,absoluteFill:{}},useWindowDimensions:()=>({fontScale:1}),PanResponder:{create:handlers=>({panHandlers:handlers})}};
  const modules={react,'react-native':native,'react-native-safe-area-context':{SafeAreaView:host('SafeAreaView')},'@expo/vector-icons':{Ionicons:host('Ionicons')},'./temi':{...require('../temi.js'),PALETTE_ORIGINALE:palette},'./turniCalcoli':calcoli};
  for(const file of ['calendarioVista','turniRapidiAnteprima','TurniRapidiPreview','CalendarScreen']){
    const c={exports:{},Date:class extends Date{static now(){return now;}},require:name=>{assert.ok(name in modules,`Dipendenza non ammessa: ${name}`);return modules[name];}};
    vm.runInNewContext(code(`${file}.js`),c);modules[`./${file}`]=c.exports;
  }
  const props={anno:2026,mese:9,impegniPersonali:[],filtroAgenda:'tutto',giornoSelezionato:1,summary:{ore:'16h',extra:'1h',notti:1},turniRapidi:[quick,night],paletteHome:palette,nomeTipo:t=>t,
    onManualDay:d=>calls.push(['manual',d]),onSelectDay:d=>calls.push(['select',d]),onBack:()=>calls.push(['back']),onMonthChange:delta=>{
      calls.push(['month',delta]);const date=new Date(props.anno,props.mese+delta,1);props.anno=date.getFullYear();props.mese=date.getMonth();
    }};
  const render=()=>{
    stateIndex=0;refIndex=0;nodes=[];
    const html=renderToStaticMarkup(React.createElement(modules['./CalendarScreen'].default,{...props,tuttiTurni:all,records:all.filter(t=>t.anno===props.anno&&t.mese===props.mese+1)})).replace(/<!--.*?-->/g,'');
    const find=label=>nodes.find(n=>n.accessibilityLabel===label);
    return{nodes,html,find,press:label=>{const n=find(label);assert.ok(n,label);assert.ok(!n.disabled,`Disabilitato: ${label}`);n.onPress();},day:d=>{const n=nodes.find(n=>n.testID===`calendar-day-${d}`);assert.ok(n);n.onPress();}};
  };
  return{render,calls,props,advance:ms=>{now+=ms;},setRecords:records=>{all=records;}};
}
const open = h => {h.render().press('Turni rapidi');h.render().press('Anteprima turno rapido Sera, 14:00 22:00');};

test('UI: scelta modello, selezione/deselezione, contatore e cambio modello senza scritture',()=>{
  const h=calendarHarness(freeze([]));open(h);h.render().day(5);h.render().day(6);
  let view=h.render();assert.ok(view.html.includes('2 date selezionate'));
  assert.equal(view.nodes.find(n=>n.testID==='calendar-day-5').accessibilityState.selected,true);
  view.day(5);assert.ok(h.render().html.includes('1 date selezionate'));
  h.render().press('Anteprima turno rapido Notte, 22:00 06:00');
  h.render().press('Applica turni');view=h.render();assert.ok(view.html.includes('Notte'));assert.ok(view.html.includes('22:00–06:00'));
  assert.equal(h.calls.length,0);
});
test('UI: selezione su mesi differenti, frecce e swipe conservano le date',()=>{
  const h=calendarHarness();open(h);h.render().day(31);h.render().press('Mese successivo');h.render().day(1);
  let view=h.render();assert.ok(view.html.includes('2 date selezionate'));view.press('Applica turni');view=h.render();
  assert.ok(view.html.includes('31/10/2026'));assert.ok(view.html.includes('01/11/2026'));
  view.press('Annulla e torna al Calendario');view=h.render();
  view.nodes.find(n=>n.testID==='calendar-grid').onPanResponderRelease(null,{dx:80,dy:1});
  view=h.render();assert.equal(h.props.mese,9);assert.ok(view.html.includes('2 date selezionate'));
  assert.equal(view.nodes.find(n=>n.testID==='calendar-day-31').accessibilityState.selected,true);
});
test('UI: annullamento conserva selezione; conferma simula e lascia immutati i dati reali',()=>{
  const records=freeze([shift(1,2)]),before=JSON.stringify(records),h=calendarHarness(records);open(h);h.render().day(5);
  h.render().press('Applica turni');h.render().press('Annulla e torna al Calendario');
  assert.ok(h.render().html.includes('1 date selezionate'));h.render().press('Applica turni');
  h.render().press('Conferma simulazione');const view=h.render();
  assert.ok(view.html.includes('Simulazione completata'));assert.ok(view.html.includes('Nessun dato reale è stato modificato'));
  assert.ok(view.html.includes('0 date selezionate'));assert.equal(JSON.stringify(records),before);assert.deepEqual(h.calls,[]);
});
test('UI: eliminazione multipla richiede la scelta dei singoli servizi; appuntamenti esclusi',()=>{
  const records=freeze([shift(1,5),shift(2,5,'16:00','20:00'),shift(3,6),shift(4,5,'','',{tipo:'personal'})]);
  const h=calendarHarness(records);h.render().press('Turni rapidi');h.render().press('Elimina · anteprima senza cancellazioni');
  h.render().day(5);h.render().day(6);h.render().press('Rivedi eliminazioni');
  let view=h.render();assert.equal(view.find('Conferma simulazione').disabled,true);
  let choices=view.nodes.filter(n=>n.accessibilityRole==='checkbox');assert.equal(choices.length,3);assert.ok(choices.every(n=>!n.accessibilityState.checked));
  choices.find(n=>n.accessibilityLabel.includes('servizio 2 ')).onPress();view=h.render();assert.equal(view.find('Conferma simulazione').disabled,true);
  view.nodes.find(n=>n.accessibilityRole==='checkbox'&&n.accessibilityLabel.includes('servizio 3 ')).onPress();
  view=h.render();assert.equal(view.find('Conferma simulazione').disabled,false);view.press('Conferma simulazione');
  assert.equal(records.length,4);assert.ok(h.render().html.includes('2 operazioni su 2 date'));assert.deepEqual(h.calls,[]);
});
test('UI: conflitto nuovo mentre il riepilogo è aperto richiede una nuova revisione',()=>{
  const h=calendarHarness();open(h);h.render().day(5);h.render().press('Applica turni');
  h.setRecords([shift(1,5,'14:00','22:00')]);h.render().press('Conferma simulazione');
  const view=h.render();assert.ok(view.html.includes('I dati disponibili sono cambiati'));
  assert.equal(view.find('Conferma simulazione').disabled,true);assert.ok(!view.html.includes('Simulazione completata'));
  assert.deepEqual(h.calls,[]);
});
test('UI: nessuna selezione senza modello; chiusura pannello ripristina il manuale originale',()=>{
  const h=calendarHarness();h.render().press('Turni rapidi');h.render().day(5);
  let view=h.render();assert.ok(view.html.includes('0 date selezionate'));assert.equal(view.find('Applica turni'),undefined);
  view.press('Chiudi turni rapidi');h.render().day(5);assert.deepEqual(h.calls,[['manual',5]]);
});
