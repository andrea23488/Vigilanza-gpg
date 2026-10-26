const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),ts=require('typescript');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
function load(name,imports={}){
 const code=ts.transpileModule(read(name),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 const c={exports:{},require:key=>{assert.ok(key in imports,`Unexpected import: ${key}`);return imports[key];}};vm.runInNewContext(code,c);return c.exports;
}
const model=load('calendarModel.ts');
const create=()=>model.createAgenda(new Date(2026,9,15));
const reduce=model.agendaReducer,key=day=>model.dateKey(2026,9,day);
test('griglia lunedì-domenica, mesi reali, bisestili e cambio anno',()=>{
 for(let year=2024;year<=2028;year++)for(let month=0;month<12;month++){
  const cells=model.monthCells(year,month),days=Array.from(cells).filter(x=>x!==null);
  assert.equal(cells.length%7,0);assert.ok(cells.length>=28&&cells.length<=42);
  assert.equal(days.length,new Date(year,month+1,0).getDate());
  assert.deepEqual(days,Array.from({length:days.length},(_,i)=>i+1));
  assert.equal(cells.indexOf(1),(new Date(year,month,1).getDay()+6)%7);
 }
 let s=create();s=reduce(s,{type:'month',delta:3});assert.equal(s.year,2027);assert.equal(s.month,0);
 s=reduce(s,{type:'month',delta:-1});assert.equal(s.year,2026);assert.equal(s.month,11);
});
test('tap ripetuti, date occupate e cancellazione richiedono scelte esplicite',()=>{
 const initial=create();let s=reduce(initial,{type:'select',id:'afternoon'});
 for(const day of [4,5,8])s=reduce(s,{type:'apply',key:key(day)});
 assert.equal(s.selected,'afternoon');assert.equal(Object.keys(s.days).length,3);assert.equal(Object.keys(initial.days).length,0);
 assert.equal(model.entriesOn(s,key(5))[0].start,'14:00');
 s=reduce(s,{type:'select',id:'night'});const before=s.days;s=reduce(s,{type:'apply',key:key(5)});
 assert.equal(s.days,before);assert.ok(s.pending);const target=model.entriesOn(s,key(5))[0].entryId;
 s=reduce(s,{type:'resolve',choice:'replace',entryId:target});assert.equal(model.entriesOn(s,key(5))[0].end,'06:00');
 s=reduce(s,{type:'select',id:'delete'});
 for(const day of [4,5]){s=reduce(s,{type:'apply',key:key(day)});assert.ok(s.pending);s=reduce(s,{type:'resolve',choice:'delete',entryId:model.entriesOn(s,key(day))[0].entryId});}
 assert.equal(Object.keys(s.days).length,1);assert.equal(s.selected,'delete');assert.ok(s.announcement.includes('Rimosso solo'));
 assert.equal(reduce(s,{type:'apply',key:'2026-10-32'}),s);
 s=reduce(s,{type:'panel',open:false});assert.equal(s.selected,null);assert.equal(reduce(s,{type:'apply',key:key(8)}).days,s.days);
});
test('selezione persistente tra mesi; dati distinti tra mesi e anni',()=>{
 let s=reduce(create(),{type:'select',id:'morning'});s=reduce(s,{type:'apply',key:key(1)});
 s=reduce(s,{type:'month',delta:1});assert.equal(s.selected,'morning');assert.ok(s.panel);
 s=reduce(s,{type:'apply',key:'2026-11-01'});assert.equal(Object.keys(s.days).length,2);
 s=reduce(s,{type:'month',delta:-1});assert.equal(model.entriesOn(s,key(1))[0].start,'06:00');
});
test('configurazione, modifica, rimozione e riordino modelli; assegnazioni già fatte preservate',()=>{
 let s=reduce(create(),{type:'select',id:'morning'});s=reduce(s,{type:'apply',key:key(1)});
 const draft={label:'Notte aeroporto',start:'21:30',end:'05:45',type:'turno',color:'#67CDFF'};
 assert.equal(model.validateDraft(draft),null);s=reduce(s,{type:'save',draft});
 assert.equal(s.templates.at(-1).id,'quick-1');
 s=reduce(s,{type:'move',id:'quick-1',delta:-1});assert.equal(s.templates[3].id,'quick-1');
 s=reduce(s,{type:'save',id:'morning',draft:{...draft,label:'Cambiato'}});
 assert.equal(model.entriesOn(s,key(1))[0].label,'06–14');assert.equal(s.templates[0].label,'Cambiato');
 s=reduce(s,{type:'remove',id:'morning'});assert.equal(s.selected,null);assert.ok(s.days[key(1)]);
 s=reduce(s,{type:'save',draft:{...draft,label:'RIP nuovo',type:'riposo'}});assert.equal(s.templates.at(-1).start,'');
 const before=s;assert.equal(reduce(s,{type:'move',id:s.templates[0].id,delta:-1}),s);
 for(const invalid of [{...draft,label:''},{...draft,start:'24:00'},{...draft,end:'12:75'},{...draft,end:'21:30'},{...draft,color:'red'}]){
  assert.ok(model.validateDraft(invalid));assert.equal(reduce(s,{type:'save',draft:invalid}),before);
 }
});
function renderCalendar({state=create(),view='agenda',menu=false,editor=null,formDraft=null,summary=null,manualDate=null,viewport={width:320,height:568,fontScale:1}}={}){
 const nodes=[],calls=[],setters=[];let index=0;
 const host=name=>({children,...props})=>{
  if(name==='Modal'&&!props.visible)return null;
  nodes.push({name,...props});return React.createElement('div',null,children);
 };
 const native={...Object.fromEntries(['Pressable','ScrollView','Text','View','TextInput','KeyboardAvoidingView','Modal'].map(n=>[n,host(n)])),Platform:{OS:'web'},StyleSheet:{create:x=>x,absoluteFill:{}},useWindowDimensions:()=>viewport,PanResponder:{create:handlers=>({panHandlers:handlers})},BackHandler:{addEventListener:()=>({remove(){}})}};
 const react={...React,useMemo:fn=>fn(),useRef:value=>({current:value}),useEffect:()=>{},useState:initial=>{
  let value=typeof initial==='function'?initial():initial;
  if(view==='agenda')value=index===0?menu:index===1?editor:manualDate;
  if(view!=='agenda'&&index===1&&formDraft)value=formDraft;
  const slot=index++;return[value,v=>setters.push([slot,v])];
 }};
 const imports={react,'react-native':native,'react-native-safe-area-context':{SafeAreaView:host('SafeAreaView')},'@expo/vector-icons':{Ionicons:host('Ionicons')},'./calendarModel':model,'./ThemeContext':{useDemoTheme:()=>({palette:{background:'#03081B',surface:'#0C1630',surfaceRaised:'#112340',border:'#345C8D',accent:'#67CDFF',homeAccent:'#67CDFF',homeAccentSecondary:'#CE8DFF',text:'#F2F7FF',textMuted:'#BDCBE1',error:'#FFB2C9'}})}};
 const Editor=load('QuickShiftEditor.tsx',imports).default;
 imports['./AgendaDialogs']=load('AgendaDialogs.tsx',imports);
 const Component=view==='agenda'?load('CalendarScreen.tsx',{...imports,'./QuickShiftEditor':Editor}).default:Editor;
 const html=renderToStaticMarkup(React.createElement(Component,{state,summary,dispatch:a=>calls.push(a),onBack:()=>calls.push('back'),onHome:()=>calls.push('home'),mode:view==='configure'?'configure':'edit'}));
 const press=label=>{const button=nodes.find(n=>n.name==='Pressable'&&n.accessibilityLabel===label);assert.ok(button,label);button.onPress();};
 return{nodes,calls,setters,html,press};
}
test('Agenda: chip separato, unica voce di configurazione e griglia; nessun riepilogo o pannello sotto',()=>{
 const r=renderCalendar();r.press('Turni rapidi');assert.equal(r.calls[0].type,'panel');assert.equal(r.calls[0].open,true);
 r.press('Mese successivo');assert.equal(r.calls[1].delta,1);r.press('Mese precedente');assert.equal(r.calls[2].delta,-1);
 r.press('Menu calendario');assert.deepEqual(r.setters[0],[0,true]);
 const m=renderCalendar({menu:true});
 assert.ok(m.nodes.some(n=>n.accessibilityLabel==='CONFIGURA TURNI RAPIDI'));
 assert.ok(!m.nodes.some(n=>n.accessibilityLabel==='Modifica turni rapidi'));
 assert.equal(m.nodes.filter(n=>n.accessibilityLabel==='Turni rapidi').length,1);
 m.press('CONFIGURA TURNI RAPIDI');assert.ok(m.setters.some(x=>x[0]===1&&x[1]===true));
 assert.doesNotMatch(r.html,/Timeline|aggiungi alla giornata|Aggiorna calendario/);
 assert.equal(r.nodes.filter(n=>n.name==='Pressable'&&n.accessibilityLabel?.includes('nessun turno')).length,31);
});
test('barra orizzontale e calendario presenti insieme; selezione, tap e chiusura cablati',()=>{
 const state=reduce(create(),{type:'select',id:'afternoon'}),r=renderCalendar({state});
 assert.ok(r.nodes.some(n=>n.name==='ScrollView'&&n.horizontal));
 const selected=r.nodes.find(n=>n.accessibilityLabel==='Turno rapido 14–22, 14:00 22:00');assert.equal(selected.accessibilityState.selected,true);
 const day=r.nodes.find(n=>n.accessibilityLabel?.startsWith('4 ottobre'));day.onPress();assert.equal(r.calls[0].key,key(4));assert.equal(r.calls[0].type,'apply');
 r.press('Elimina');assert.equal(r.calls.at(-1).id,'delete');r.press('Chiudi turni rapidi');assert.equal(r.calls.at(-1).open,false);
 r.press('Torna alla Home');assert.equal(r.calls.at(-1),'back');
});
test('editor: salvataggio valido, errori, modifica, eliminazione e riordino cablati',()=>{
 const draft={label:'Sera',start:'14:30',end:'22:45',type:'turno',color:'#67CDFF'};
 const valid=renderCalendar({view:'configure',formDraft:draft});valid.press('Salva modello DEMO');assert.equal(valid.calls[0].type,'save');assert.equal(valid.calls[0].draft.label,'Sera');
 const invalid=renderCalendar({view:'configure'});invalid.press('Salva modello DEMO');assert.equal(invalid.calls.length,0);assert.ok(invalid.setters.some(x=>String(x[1]).includes('etichetta')));
 const edit=renderCalendar({view:'edit'});edit.press('Modifica 06–14');assert.ok(edit.setters.some(x=>x[1]==='morning'));
 edit.press('Sposta giù 06–14');assert.equal(edit.calls[0].type,'move');edit.press('Elimina modello 06–14');assert.equal(edit.calls[1].type,'remove');
 edit.press('Torna all’Agenda');edit.press('Torna alla Home');assert.deepEqual(edit.calls.slice(-2),['back','home']);
});
test('anteprima: Home → Agenda → Home, stato DEMO persistente e navigazione Social/Impostazioni preservata',()=>{
 const state=[],captured={};let cursor=0;
 const useState=initial=>{const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return[state[i],v=>state[i]=typeof v==='function'?v(state[i]):v];};
 const react={...React,useState,useReducer:(reducer,arg,init)=>{const [s,set]=useState(()=>init(arg));return[s,a=>set(old=>reducer(old,a))];}};
 const capture=name=>props=>{captured[name]=props;return React.createElement('div',null,name);};
 const Demo=load('HomeDemo.tsx',{
  react,'react-native':{Platform:{OS:'web'},Alert:{alert(){throw Error('unexpected Alert');}},StatusBar:()=>null},
  'react-native-safe-area-context':{SafeAreaProvider:({children})=>React.createElement('div',null,children)},
  '../HomeScreen':capture('home'),'./CalendarScreen':capture('agenda'),'./calendarModel':model,
  './SettingsScreen':{__esModule:true,default:capture('settings'),SettingsDemoDetail:capture('settingsDetail')},
  './SocialScreen':{__esModule:true,default:capture('social'),SocialDemoDetail:capture('socialDetail')},
  './DemoDialog':()=>null,'./demoData':{creaDatiDemo:()=>({profilo:{nome:'DEMO'},ore:'208.0 h',extra:'31 h',notti:2,summaryYear:new Date().getFullYear(),summaryMonth:new Date().getMonth()})},
  '../temi':{PALETTE_ORIGINALE:{background:'#03081B'},PRESET_TEMI:[{id:'originale'}],paletteHomeDaPreferenza:()=>null,rapportoContrasto:()=>10,ripristinaAspetto:()=>({version:1,preset:'originale',background:null,accent:null})},
  './InteractiveThemePreview':capture('interactive'), './AppearanceScreen':capture('appearance'),'./ThemeContext':{ThemeProvider:({children})=>children},
 }).default;
 const render=()=>{cursor=0;for(const key of Object.keys(captured))delete captured[key];renderToStaticMarkup(React.createElement(Demo));};
 render();captured.home.onCalendar();render();assert.ok(captured.agenda);assert.equal(captured.home,undefined);assert.equal(captured.agenda.summary.ore,'208.0 h');
 captured.agenda.dispatch({type:'month',delta:1});render();assert.equal(captured.agenda.summary,null);
 captured.agenda.dispatch({type:'month',delta:-1});render();assert.equal(captured.agenda.summary.extra,'31 h');
 const current=captured.agenda.state,key=model.dateKey(current.year,current.month,3);
 captured.agenda.dispatch({type:'select',id:'rest'});render();captured.agenda.dispatch({type:'apply',key});render();assert.equal(model.entriesOn(captured.agenda.state,key)[0].label,'RIP');
 captured.agenda.onBack();render();captured.home.onCalendar();render();assert.equal(model.entriesOn(captured.agenda.state,key)[0].label,'RIP');
 captured.agenda.onBack();render();captured.home.onSocial();render();assert.ok(captured.social);captured.social.onBack();render();captured.home.onSettings();render();assert.ok(captured.settings);
});

test('viewport iPhone e testo ingrandito: sette colonne, sei settimane, nessuna trasformazione e scroll disponibile',()=>{
 for(const [width,height,fontScale] of [[320,568,1],[375,667,1],[390,844,1],[430,932,1],[393,852,2],[844,390,1]]){
  const state=reduce(model.createAgenda(new Date(2026,7,1)),{type:'panel',open:true});
  const r=renderCalendar({state,viewport:{width,height,fontScale}});
  const days=r.nodes.filter(n=>n.name==='Pressable'&&n.accessibilityLabel?.includes('nessun turno'));
  assert.equal(days.length,31);assert.equal(model.monthCells(2026,7).length,42);
  for(const day of days){
   const style=Object.assign({},...day.style({pressed:false}));
   assert.ok(style.minHeight>=56*fontScale);assert.equal(style.flex,1);assert.equal(style.minWidth,0);assert.equal(style.transform,undefined);
  }
  assert.ok(r.nodes.some(n=>n.name==='ScrollView'&&n.horizontal));
  assert.ok(r.nodes.some(n=>n.name==='ScrollView'&&!n.horizontal&&n.scrollEnabled!==false));
 }
});

test('tre card compatte sopra la griglia, senza modificare tap o turni rapidi',()=>{
 const r=renderCalendar({summary:{ore:'37.5 h',extra:'4.5 h',notti:2}});
 const cards=r.nodes.filter(n=>n.testID?.startsWith('calendar-stat-'));
 assert.deepEqual(cards.map(n=>n.testID),['calendar-stat-Ore totali','calendar-stat-Extra','calendar-stat-Notti']);
 const firstDay=r.nodes.findIndex(n=>n.name==='Pressable'&&n.accessibilityLabel?.includes('nessun turno'));
 for(const card of cards){assert.ok(r.nodes.indexOf(card)<firstDay);assert.equal(card.style[0].flex,1);assert.equal(card.style[1].minHeight,72);}
 assert.ok(r.html.includes('37,5'));assert.ok(r.html.includes('4,5'));
 const unavailable=renderCalendar();assert.ok(unavailable.nodes.filter(n=>n.testID?.startsWith('calendar-stat-')).every(n=>n.accessibilityLabel.includes('non disponibile')));
});

test('tap normale è manuale, nessun inserimento senza modello; chiusura ripristina il manuale',()=>{
 const manual=renderCalendar();const day=manual.nodes.find(n=>n.accessibilityLabel?.startsWith('4 ottobre'));day.onPress();
 assert.equal(manual.calls[0].type,'focus');assert.ok(manual.setters.some(x=>x[0]===2&&x[1]===key(4)));
 const open=reduce(create(),{type:'panel',open:true}),r=renderCalendar({state:open});
 r.nodes.find(n=>n.accessibilityLabel?.startsWith('4 ottobre')).onPress();assert.equal(r.calls[0].type,'apply');
 assert.equal(reduce(open,r.calls[0]).days,open.days);assert.equal(r.setters.length,0);
 const detail=renderCalendar({manualDate:key(4)});assert.ok(detail.html.includes('NAVIGAZIONE DEMO'));assert.ok(!detail.html.includes('Turni rapidi'));assert.equal(detail.nodes.filter(n=>n.name==='TextInput').length,0);
 detail.press('Torna all’Agenda');assert.ok(detail.setters.some(x=>x[0]===2&&x[1]===null));
});
test('swipe due sensi: soglie, discriminazione verticale/tap e frecce condividono il cambio mese',()=>{
 assert.equal(model.swipeMonth(-80,10),1);assert.equal(model.swipeMonth(80,10),-1);
 for(const [dx,dy] of [[10,0],[50,0],[100,100],[20,100]])assert.equal(model.swipeMonth(dx,dy),0);
 assert.equal(model.horizontalDrag(17,0),false);assert.equal(model.horizontalDrag(30,40),false);assert.equal(model.horizontalDrag(-20,1),true);
 const r=renderCalendar(),grid=r.nodes.find(n=>n.testID==='calendar-grid');
 assert.equal(grid.onMoveShouldSetPanResponderCapture({}, {dx:3,dy:0}),false);
 grid.onPanResponderGrant();grid.onPanResponderRelease({}, {dx:-90,dy:5});assert.equal(r.calls[0].type,'month');assert.equal(r.calls[0].delta,1);
 r.nodes.find(n=>n.accessibilityLabel?.startsWith('4 ottobre')).onPress();assert.equal(r.calls.length,1);assert.equal(r.setters.length,0);
 grid.onPanResponderRelease({}, {dx:90,dy:5});assert.equal(r.calls[1].delta,-1);
 r.press('Mese successivo');assert.equal(r.calls[2].type,r.calls[0].type);assert.equal(r.calls[2].delta,r.calls[0].delta);
 const strip=renderCalendar({state:reduce(create(),{type:'panel',open:true})}).nodes.find(n=>n.name==='ScrollView'&&n.horizontal);
 assert.equal(strip.onPanResponderRelease,undefined);
 let s=reduce(create(),{type:'month',delta:2});s=reduce(s,{type:'month',delta:model.swipeMonth(-90,0)});
 assert.equal(s.year,2027);assert.equal(s.month,0);assert.equal(s.selectedDate,'2027-01-01');
 s=reduce(s,{type:'month',delta:model.swipeMonth(90,0)});assert.equal(s.selectedDate,'2026-12-01');
});
const entry=(id,start,end,type='turno')=>({id,label:id,start,end,type,color:'#67CDFF',entryId:id,origin:type==='personal'?'personal':'existing'});
test('turni multipli non sovrapposti: aggiunta esplicita e rimozione del solo turno scelto',()=>{
 let s={...create(),days:{[key(4)]:[entry('early','06:00','10:00'),entry('event','12:00','13:00','personal')]}};
 s=reduce(s,{type:'select',id:'afternoon'});s=reduce(s,{type:'apply',key:key(4)});assert.equal(model.entriesOn(s,key(4)).length,2);
 s=reduce(s,{type:'resolve',choice:'append'});assert.equal(model.entriesOn(s,key(4)).length,3);
 s=reduce(s,{type:'select',id:'delete'});s=reduce(s,{type:'apply',key:key(4)});
 const protectedState=reduce(s,{type:'resolve',choice:'delete',entryId:'event'});assert.equal(protectedState,s);
 s=reduce(s,{type:'resolve',choice:'delete',entryId:'early'});assert.equal(model.entriesOn(s,key(4)).length,2);assert.ok(model.entriesOn(s,key(4)).some(e=>e.type==='personal'));assert.ok(model.entriesOn(s,key(4)).some(e=>e.id==='afternoon'));
});
test('notturni, riposi, duplicati e conflitti su data adiacente non vengono sovrascritti',()=>{
 let s={...create(),days:{[key(4)]:[entry('overnight','22:00','08:00')]}};
 s=reduce(s,{type:'select',id:'morning'});s=reduce(s,{type:'apply',key:key(5)});const days=s.days;
 assert.ok(s.pending.reason.includes('Sovrapposizione'));s=reduce(s,{type:'resolve',choice:'append'});assert.equal(s.days,days);
 s=reduce(s,{type:'resolve',choice:'cancel'});assert.equal(s.pending,null);
 s=reduce(s,{type:'select',id:'rest'});s=reduce(s,{type:'apply',key:key(5)});assert.ok(s.pending);s=reduce(s,{type:'resolve',choice:'append'});assert.equal(s.days,days);
 let dup=reduce(create(),{type:'select',id:'morning'});dup=reduce(dup,{type:'apply',key:key(4)});dup=reduce(dup,{type:'apply',key:key(4)});assert.ok(dup.pending.reason.includes('duplicato'));dup=reduce(dup,{type:'resolve',choice:'append'});assert.equal(model.entriesOn(dup,key(4)).length,1);
 const conflict=renderCalendar({state:s});assert.ok(conflict.html.includes('Nessun turno viene sovrascritto'));assert.ok(!conflict.nodes.some(n=>n.accessibilityLabel==='Aggiungi come altro turno DEMO'));
});

test('lettura conservativa dei vecchi snapshot e protezione degli eventi personali nel dialogo',()=>{
 const legacy={...create(),days:{[key(4)]:{id:'old',label:'Vecchio turno',start:'06:00',end:'10:00',type:'turno',color:'#67CDFF'}}};
 assert.equal(model.entriesOn(legacy,key(4))[0].origin,'existing');
 let s=reduce(legacy,{type:'select',id:'afternoon'});s=reduce(s,{type:'apply',key:key(4)});s=reduce(s,{type:'resolve',choice:'append'});
 assert.equal(model.entriesOn(s,key(4)).length,2);assert.equal(model.entriesOn(s,key(4))[0].label,'Vecchio turno');
 const event=entry('private','12:00','13:00','personal');s={...s,days:{...s.days,[key(4)]:[...model.entriesOn(s,key(4)),event]}};
 s=reduce(s,{type:'select',id:'delete'});s=reduce(s,{type:'apply',key:key(4)});
 const r=renderCalendar({state:s});assert.ok(r.html.includes('Evento personale · protetto'));
 assert.ok(r.nodes.some(n=>n.accessibilityLabel==='Elimina solo turno 1'));assert.ok(!r.nodes.some(n=>n.accessibilityLabel==='Elimina solo turno 3'));
 r.press('Elimina solo turno 1');assert.equal(r.calls[0].entryId,'legacy-2026-10-04');
});

test('conflitti notturni dicembre/gennaio e identificativi ambigui non modificano altri turni',()=>{
 let s={...model.createAgenda(new Date(2027,0,1)),days:{'2026-12-31':[entry('year-night','22:00','08:00')]}};
 s=reduce(s,{type:'select',id:'morning'});s=reduce(s,{type:'apply',key:'2027-01-01'});assert.ok(s.pending.reason.includes('Sovrapposizione'));
 const duplicates={...create(),days:{[key(4)]:[entry('same','06:00','10:00'),entry('same','14:00','18:00')]}};
 let d=reduce(duplicates,{type:'select',id:'delete'});d=reduce(d,{type:'apply',key:key(4)});d=reduce(d,{type:'resolve',choice:'delete',entryId:'same'});
 assert.equal(model.entriesOn(d,key(4)).length,2);assert.ok(d.pending.reason.includes('ambiguo'));
 const occupiedId={...create(),days:{[key(1)]:[entry('entry-1','06:00','10:00')]}};
 let unique=reduce(occupiedId,{type:'select',id:'morning'});unique=reduce(unique,{type:'apply',key:key(4)});
 assert.equal(model.entriesOn(unique,key(4))[0].entryId,'entry-2');
});
