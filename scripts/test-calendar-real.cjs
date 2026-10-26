const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const theme = require('../temi.js');
const paletteLegacyModule = { exports: {}, require: name => { assert.equal(name, './temi'); return theme; } };
vm.runInNewContext(babel.transformSync(fs.readFileSync('temaSchermate.js','utf8'), {
  babelrc:false, configFile:false, plugins:['@babel/plugin-transform-modules-commonjs'],
}).code, paletteLegacyModule);
const paletteLegacy = paletteLegacyModule.exports;
const app = fs.readFileSync('App.js', 'utf8');
const ast = babel.parseSync(app, { babelrc:false, configFile:false, parserOpts:{plugins:['jsx']} });
const appNode = ast.program.body.find(n => n.type === 'ExportDefaultDeclaration').declaration;
const original = name => {
  const node = appNode.body.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === name);
  assert.ok(node, name); return app.slice(node.start, node.end);
};
const compile = source => babel.transformSync(source, {babelrc:false,configFile:false,
  plugins:['@babel/plugin-transform-react-jsx','@babel/plugin-transform-modules-commonjs']}).code;
const pure = {};
vm.createContext(pure);
vm.runInContext(fs.readFileSync('calendarioVista.js','utf8').replaceAll('export function ', 'function '), pure);
vm.runInContext(fs.readFileSync('turniCalcoli.js','utf8').replaceAll('export function ', 'function '), pure);
vm.runInContext(fs.readFileSync('turniRapidiAnteprima.js','utf8').replace(/^import .*;\n/gm,'').replaceAll('export const ', 'var ').replaceAll('export function ', 'function '), pure);
const palette = {background:'#FFFFFF',surface:'#EEEEEE',surfaceRaised:'#DDDDDD',border:'#333333',text:'#111111',textMuted:'#222222',homeAccent:'#0055AA',error:'#AA0000'};
const record = (id, day, start='06:00', end='14:00', more={}) => ({id,anno:2026,mese:10,giorno:day,tipo:'turno',inizio:start,fine:end,ore:8,luogo:'Servizio reale',...more});

function renderCalendar(options={}) {
  const nodes=[],calls=[],setters=[]; let slot=0;
  const host = name => ({children,...props}) => {
    if(name==='Modal'&&!props.visible)return null;
    nodes.push({name,...props});
    return React.createElement('div',null,children);
  };
  const native={...Object.fromEntries(['Modal','Pressable','ScrollView','Text','View'].map(n=>[n,host(n)])),
    StyleSheet:{create:x=>x,absoluteFill:{}},useWindowDimensions:()=>({fontScale:options.fontScale||1}),
    PanResponder:{create:handlers=>({panHandlers:handlers})}};
  const react={...React,useEffect:()=>{},useMemo:fn=>fn(),useRef:x=>({current:x}),useState:initial=>{
    const values=[!!options.menu,!!options.configure,!!options.panel,options.selected||null,''];
    const index=slot++;return[values[index]??initial,value=>setters.push([index,value])];
  }};
  const imports={react,'react-native':native,'react-native-safe-area-context':{SafeAreaView:host('SafeAreaView')},
    '@expo/vector-icons':{Ionicons:host('Ionicons')},'./temi':{...theme, PALETTE_ORIGINALE:palette},'./calendarioVista':pure,'./turniRapidiAnteprima':pure,'./TurniRapidiPreview':{__esModule:true,default:()=>null}};
  const c={exports:{},require:name=>{assert.ok(imports[name],name);return imports[name];}};
  vm.runInNewContext(compile(fs.readFileSync('CalendarScreen.js','utf8')),c);
  const props={anno:2026,mese:9,records:[],impegniPersonali:[],filtroAgenda:'tutto',giornoSelezionato:1,
    summary:{ore:'16h',extra:'4 h 45 min',notti:2},turniRapidi:[{id:'saved',nome:'Modello esistente',inizio:'22:00',fine:'06:00'}],paletteHome:palette,
    nomeTipo:type=>type.toUpperCase(),onBack:()=>calls.push('back'),onMonthChange:d=>calls.push(['month',d]),
    onManualDay:d=>calls.push(['manual',d]),onSelectDay:d=>calls.push(['select',d]),...options.props};
  const html=renderToStaticMarkup(React.createElement(c.exports.default,props));
  return{nodes,calls,setters,html,props,press:label=>{const n=nodes.find(n=>n.accessibilityLabel===label);assert.ok(n,label);n.onPress();}};
}

function realApp(initial=[]) {
  let db=initial.map(t=>({...t})), nextId=100;
  const calls=[],alerts=[];
  const env={OFFLINE_TEST:false,isFiduciario:false,saving:false,loading:false,anno:2026,mese:9,giorno:1,
    giornoAgendaSelezionato:1,turni:db.map(t=>({...t})),editingId:null,tipo:'turno',inizio:'06:00',fine:'14:00',
    luogo:'Postazione manuale',indirizzoServizio:'Indirizzo reale',localitaMeteoTurno:'Roma',extra:'1',
    minutiAggiuntiviRetribuiti:'0',modalitaExtraGpg:'automatico',oreExtraGpg:'0',minutiExtraGpg:'0',
    riposoLavorato:false,oreOrdinarieGiornaliereNumero:7,promemoriaTurnoMinuti:30,
    console:{log(){},warn(){}},Alert:{alert:(title,message,buttons)=>alerts.push({title,message,buttons})},
    messaggioErroreTurni:(error,fallback)=>error.message||fallback,
    creaTurnoUtente:async payload=>{calls.push(['create',payload]);const saved={...payload,id:nextId++};db.push(saved);return {...saved};},
    aggiornaTurnoUtente:async(id,payload)=>{calls.push(['update',id,payload]);const i=db.findIndex(t=>t.id===id);assert.ok(i>=0);db[i]={...db[i],...payload};return {...db[i]};},
    eliminaTurnoUtente:async id=>{calls.push(['delete',id]);db=db.filter(t=>t.id!==id);},
    caricaTurniUtente:async()=>{calls.push(['read']);if(env.failRead)throw Error('rete non disponibile');return db.map(t=>({...t}));},
    programmaPromemoriaTurno:async t=>calls.push(['reminder',t.id]),leggiPromemoriaTurno:async()=>30,
    cancellaPromemoriaTurno:async id=>calls.push(['cancel-reminder',id]),
  };
  Object.defineProperty(env,'turniMese',{get:()=>env.turni.filter(t=>Number(t.mese)===env.mese+1&&Number(t.anno)===env.anno)});
  const functions=['caricaTurni','nuovoGiorno','apriGiornoCalendario','modificaGiorno','creaPayload','inserisciTurno','aggiornaTurno','salvaGiornata','confermaEliminazione','eliminaGiornata','mesePrecedente','meseSuccessivo','fasciaTurno'];
  const code=functions.map(original).join('\n');
  for(const name of new Set(code.match(/\bset[A-Z]\w+/g))) {
    const key=name[3].toLowerCase()+name.slice(4);
    env[name]=value=>{env[key]=typeof value==='function'?value(env[key]):value;};
  }
  vm.createContext(env);
  for(const file of ['turniCalcoli.js','straordinariManuali.js','straordinariGpg.js'])
    vm.runInContext(fs.readFileSync(file,'utf8').replace(/^import .*;\n/gm,'').replaceAll('export function ','function '),env);
  vm.runInContext(code,env);
  return{env,calls,alerts,records:()=>db};
}

test('griglia mensile lunedì, mesi bisestili e soglie swipe conservate',()=>{
  const feb=Array.from(pure.celleMeseCalendario(2024,1));
  assert.equal(feb.filter(Boolean).length,29);assert.equal(feb.indexOf(1),3);assert.equal(feb.length%7,0);
  assert.equal(pure.swipeCalendario(-80,10),1);assert.equal(pure.swipeCalendario(80,10),-1);
  assert.equal(pure.swipeCalendario(40,0),0);assert.equal(pure.swipeCalendario(80,70),0);
  assert.equal(pure.trascinamentoCalendario(20,1),true);assert.equal(pure.trascinamentoCalendario(10,30),false);
});
test('rendering dati reali: notturni, multipli, riposi, ferie, personali e palette',()=>{
  const r=renderCalendar({props:{records:[record(1,2,'22:00','06:00'),record(2,2),record(3,3,'','',{tipo:'riposo'}),record(4,4,'','',{tipo:'ferie'})],impegniPersonali:[{giorno:2,titolo:'Visita'}]}});
  const day=n=>r.nodes.find(x=>x.testID===`calendar-day-${n}`);
  assert.match(day(2).accessibilityLabel,/22:00–06:00; 06:00–14:00, 1 impegni/);
  assert.match(day(3).accessibilityLabel,/RIPOSO/);assert.match(day(4).accessibilityLabel,/FERIE/);
  day(2).onPress();assert.deepEqual(r.calls,[['manual',2]]);
  assert.ok(r.html.includes('4 h 45 min'));assert.ok(r.html.includes('16h'));
  assert.equal(r.nodes.find(n=>n.testID==='calendar-stat-Extra').style[1].backgroundColor,palette.surface);
  const p=renderCalendar({props:{filtroAgenda:'personale'}});p.nodes.find(n=>n.testID==='calendar-day-3').onPress();
  assert.deepEqual(p.calls,[['manual',3]]);
  p.nodes.find(n=>n.testID==='calendar-day-3').onLongPress();assert.deepEqual(p.calls.at(-1),['select',3]);
});
test('frecce e swipe richiamano lo stesso cambio mese; nessun tap dopo trascinamento',()=>{
  const r=renderCalendar();r.press('Mese successivo');r.press('Mese precedente');
  const grid=r.nodes.find(n=>n.testID==='calendar-grid');
  grid.onPanResponderRelease(null,{dx:-80,dy:1});r.nodes.find(n=>n.testID==='calendar-day-5').onPress();
  assert.deepEqual(r.calls,[['month',1],['month',-1],['month',1]]);
});
test('barra rapida ed Elimina non aprono editor e non simulano salvataggi',()=>{
  for(const selected of [null,'saved','delete']){
    const records=Object.freeze([Object.freeze(record(1,5))]);
    const r=renderCalendar({panel:true,selected,props:{records}});
    r.nodes.find(n=>n.testID==='calendar-day-5').onPress();
    assert.deepEqual(r.calls,[]);assert.ok(r.html.includes('Nessun turno viene salvato o eliminato'));
    assert.equal(records.length,1);r.press('Elimina · anteprima senza cancellazioni');
    if(selected !== 'delete') assert.ok(r.setters.some(([slot,value])=>slot===3&&value==='delete'));
    else assert.equal(r.nodes.find(n=>n.accessibilityLabel==='Elimina · anteprima senza cancellazioni').accessibilityState.selected,true);
  }
  const menu=renderCalendar({menu:true});menu.press('CONFIGURA TURNI RAPIDI');
  assert.ok(menu.setters.some(([slot,value])=>slot===1&&value===true));
  const config=renderCalendar({configure:true});assert.ok(config.html.includes('sola lettura'));
  config.press('Torna al Calendario');assert.ok(config.setters.some(([slot,value])=>slot===1&&value===false));
});
test('tap reale: nuovo turno, modifica record esistente e scelta dei multipli',async()=>{
  const r=realApp([record(1,2),record(2,3),record(3,3,'16:00','20:00')]);
  r.env.apriGiornoCalendario(1);assert.equal(r.env.screen,'edit');assert.equal(r.env.editingId,null);
  r.env.apriGiornoCalendario(2);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(r.env.editingId,1);assert.equal(r.env.screen,'edit');
  r.env.apriGiornoCalendario(3);assert.equal(r.env.screen,'giornoTurni');assert.equal(r.env.giornoAgendaSelezionato,3);
  assert.equal(r.calls.length,0);
});
test('lettura e salvataggio manuale originali con backend simulato aggiornano subito la griglia',async()=>{
  const r=realApp([record(1,2)]);await r.env.caricaTurni();assert.equal(r.env.turni.length,1);
  r.env.apriGiornoCalendario(5);Object.assign(r.env,{inizio:'22:00',fine:'06:00',luogo:'Notte reale'});
  await r.env.salvaGiornata();assert.equal(r.records().length,2);assert.equal(r.env.turni.length,2);
  assert.equal(r.records()[1].ore,8);assert.equal(r.records()[1].straordinario_manuale_minuti,null);
  const calendar=renderCalendar({props:{records:r.env.turniMese}});
  assert.match(calendar.nodes.find(n=>n.testID==='calendar-day-5').accessibilityLabel,/22:00–06:00/);
  r.alerts.at(-1).buttons[0].onPress();assert.equal(r.env.screen,'giornoTurni');
});
test('modifica originale conserva override, minuti pagati, indirizzo, altri turni e annullamento eliminazione',async()=>{
  const first=record(1,2,'06:00','14:00',{straordinario_manuale_minuti:285,extra:4.75,minuti_aggiuntivi_retribuiti:15,indirizzo_servizio:'Via reale'});
  const r=realApp([first,record(2,2,'15:00','18:00')]);await r.env.modificaGiorno(r.env.turni[0]);
  assert.equal(r.env.oreExtraGpg,'4');assert.equal(r.env.minutiExtraGpg,'45');
  r.env.luogo='Operatività aggiornata';await r.env.salvaGiornata();
  assert.equal(r.records().length,2);assert.equal(r.records()[0].straordinario_manuale_minuti,285);
  assert.equal(r.records()[0].minuti_aggiuntivi_retribuiti,15);assert.equal(r.records()[0].indirizzo_servizio,'Via reale');
  assert.equal(r.records()[1].id,2);assert.ok(r.calls.some(c=>c[0]==='update'));
  r.env.editingId=1;r.env.confermaEliminazione();assert.equal(r.records().length,2);
  assert.equal(r.alerts.at(-1).buttons[0].style,'cancel');
  await r.alerts.at(-1).buttons[1].onPress();assert.equal(r.records().length,1);assert.equal(r.env.turni[0].id,2);
});
test('riposi e ferie usano il payload originale; sovrapposizioni e override frazionari non scrivono',async()=>{
  for(const tipo of ['riposo','ferie']){
    const r=realApp();r.env.tipo=tipo;await r.env.salvaGiornata();
    assert.equal(r.records()[0].tipo,tipo);assert.equal(r.records()[0].ore,0);assert.equal(r.records()[0].inizio,null);
  }
  const r=realApp([record(1,1,'22:00','06:00')]);Object.assign(r.env,{giorno:2,inizio:'05:00',fine:'10:00'});
  await r.env.salvaGiornata();assert.equal(r.records().length,1);assert.equal(r.alerts.at(-1).title,'Turni sovrapposti');
  Object.assign(r.env,{giorno:3,modalitaExtraGpg:'manuale',minutiExtraGpg:'45.5'});
  await r.env.salvaGiornata();assert.equal(r.calls.filter(c=>c[0]==='create').length,0);
});
test('refresh fallito dopo salvataggio conserva il record locale; cambio mese riutilizza le funzioni originali',async()=>{
  const r=realApp();r.env.failRead=true;await r.env.salvaGiornata();
  assert.equal(r.records().length,1);assert.equal(r.env.turni.length,1);assert.match(r.alerts.at(-1).message,/dati locali restano/);
  r.env.anno=2026;r.env.mese=11;r.env.meseSuccessivo();assert.equal(r.env.anno,2027);assert.equal(r.env.mese,0);
  r.env.mesePrecedente();assert.equal(r.env.anno,2026);assert.equal(r.env.mese,11);assert.equal(r.env.giornoAgendaSelezionato,1);
});
test('Calendario di produzione non importa preview, servizi di scrittura o reducer dimostrativi',()=>{
  const source=fs.readFileSync('CalendarScreen.js','utf8');
  assert.doesNotMatch(source,/homePreview|ManualDayDemo|agendaReducer|supabase|turniApi|salvaGiornata/);
  assert.ok(app.includes('onManualDay={apriGiornoCalendario}'));
  assert.ok(app.includes('extra: !haOverrideGpgMese ? `${statistiche.extraOre}h` : formattaOreGpg(statistiche.extraOre)'));
  assert.ok(app.includes('onSave={\n            salvaImpegnoPersonale'));
});


test('ramo Calendario reale passa record e riepiloghi originali e mantiene timeline, modali e refresh',()=>{
  const r=realApp([record(1,2)]),env=r.env;
  Object.assign(env,{screen:'calendar',operazioniRapideRef:{current:{getState:()=>({busy:false})}},impegniPersonali:[],filtroAgenda:'tutto',giornoAgendaSelezionato:2,
    paletteHome:palette,turniRapidi:[],statistiche:{ore:16.5,extraOre:4.75,notti:1},haOverrideGpgMese:true,
    styles:{},stiliTema:{},coloreStileTema:paletteLegacy.coloreStileTema,MESI:['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'],
    impegniDelGiorno:()=>[],sceltaAgendaVisibile:false,editorPersonaleVisibile:false,impegnoPersonaleInModifica:null,
    nomeTipo:t=>t,formattaOra:t=>t,coloreHome:(p,k,f)=>p?.[k]??f,
    tornaHome:()=>{},salvaImpegnoPersonale:async()=>{},eliminaImpegnoPersonaleConConferma:()=>{},
    React:{createElement:(type,props,...children)=>({type,props:{...props,children}})}});
  for(const name of ['CalendarScreen','KeyboardDoneOverlay','Text','View','TouchableOpacity','Ionicons','SceltaAgendaModal','ImpegnoPersonaleModal'])env[name]=name;
  const branch=appNode.body.body.find(n=>n.type==='IfStatement'&&/screen\s*===\s*'calendar'/.test(app.slice(n.test.start,n.test.end)));
  assert.ok(branch);
  vm.runInContext(compile(`function calendarBranch(){${app.slice(branch.start,branch.end)}}`),env);
  const tree=env.calendarBranch();assert.equal(tree.type,'CalendarScreen');
  assert.equal(tree.props.records[0],env.turni[0]);assert.equal(tree.props.tuttiTurni,env.turni);assert.equal(tree.props.onManualDay,env.apriGiornoCalendario);
  assert.equal(tree.props.summary.ore,'16.5h');assert.equal(tree.props.summary.extra,env.formattaOreGpg(4.75));
  assert.equal(tree.props.summary.notti,1);
  const all=[];const walk=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(walk);return;}all.push(node);walk(node.props?.children);};walk(tree);
  assert.ok(all.some(n=>n.type==='ImpegnoPersonaleModal'&&n.props.onSave===env.salvaImpegnoPersonale));
  assert.ok(all.some(n=>n.type==='SceltaAgendaModal'));
  const workRow=all.find(n=>n.type==='TouchableOpacity'&&n.props.style?.minHeight===66);
  assert.ok(workRow);assert.equal(workRow.props.style.backgroundColor,palette.surfaceRaised);
  assert.ok(all.some(n=>typeof n==='object'&&n.type==='TouchableOpacity'&&n.props.onPress?.toString().includes('caricaTurni')));
});
