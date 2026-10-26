const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),babel=require('@babel/core');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const app=fs.readFileSync('App.js','utf8');
const ast=babel.parseSync(app,{babelrc:false,configFile:false,parserOpts:{plugins:['jsx']}});
const root=ast.program.body.find(n=>n.type==='ExportDefaultDeclaration').declaration;
const source=name=>{const n=root.body.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert.ok(n,name);return app.slice(n.start,n.end);};
const compile=file=>babel.transformSync(fs.readFileSync(file,'utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-react-jsx','@babel/plugin-transform-modules-commonjs']}).code;
const modules={};
for(const name of ['turniCalcoli','turniRapidiAnteprima','turniRapidiOperazioni']){
  const c={exports:{},require:key=>{assert.ok(modules[key],key);return modules[key];}};
  vm.runInNewContext(compile(name+'.js'),c);modules['./'+name]=c.exports;
}
const {creaCoordinatoreTurniRapidi}=modules['./turniRapidiOperazioni'];
const {creaAnteprimaRapidi}=modules['./turniRapidiAnteprima'];
const quick={id:'sera',nome:'Sera',inizio:'14:00',fine:'22:00',operativita:'Piantonamento',postazione:'Aeroporto'};
const record=(id,day,start='06:00',end='14:00',extra={})=>({id,anno:2026,mese:10,giorno:day,tipo:'turno',inizio:start,fine:end,ore:8,luogo:'Servizio',user_id:'fixture',...extra});
const clone=value=>JSON.parse(JSON.stringify(value));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};

function harness(options={}){
  let db=clone(options.records||[]),local=clone(db),nextId=100;
  const calls=[],publications=[];
  const editor={tipo:'turno',inizio:'06:00',fine:'14:00',minutiAggiuntiviRetribuiti:'0',extra:'0',
    modalitaExtraGpg:'automatico',oreExtraGpg:'0',minutiExtraGpg:'0',giorno:1,mese:9,anno:2026,
    luogo:'Editor da preservare',indirizzoServizio:'Indirizzo precedente',localitaMeteoTurno:'Roma',riposoLavorato:false,
    isFiduciario:!!options.fiduciario,oreOrdinarieGiornaliereNumero:options.soglia||7};
  vm.createContext(editor);
  for(const name of ['turniCalcoli','straordinariManuali','straordinariGpg'])vm.runInContext(fs.readFileSync(name+'.js','utf8').replace(/^import .*;\n/gm,'').replaceAll('export function ','function '),editor);
  vm.runInContext(source('fasciaTurno')+'\n'+source('creaPayload')+'\n'+source('inserisciTurno'),editor);
  const control={userId:'fixture',offline:false,saving:false,configKey:'gpg-7',readCount:0,...options.control};
  const services={
    context:()=>control,
    build:input=>editor.creaPayload(input),
    read:async()=>{calls.push(['GET']);control.readCount++;if(control.failRead||control.failRefresh&&control.readCount>1)throw Error('rete');return clone(db);},
    create:async payload=>editor.inserisciTurno(payload),
    publish:(rows,user)=>{assert.equal(user,control.userId);local=clone(rows);publications.push(clone(rows));},
    onBusy:value=>{control.saving=value;},
  };
  editor.creaTurnoUtente=async payload=>{
    calls.push(['POST',clone(payload)]);
    if(control.gate)await control.gate.promise;
    if(control.failure==='backend')throw Object.assign(Error('rifiuto'),{codice:'BACKEND',status:400});
    if(control.failure==='network-before'||control.failure==='timeout-before')throw Object.assign(Error('incerto'),{codice:control.failure.startsWith('timeout')?'TIMEOUT':'RETE'});
    const saved={...clone(payload),id:nextId++,user_id:control.userId};db.push(saved);
    if(control.failure==='network-after')throw Object.assign(Error('risposta persa'),{codice:'RETE'});
    if(control.failure==='missing-id')return{...saved,id:undefined};
    return clone(saved);
  };
  if(options.conditional)services.removeIfUnchanged=async(id,expected,user)=>{
    calls.push(['DELETE-CONDITIONAL',id]);assert.equal(user,control.userId);
    if(control.mutateDuringDelete)db=db.map(t=>t.id===id?{...t,luogo:'Modificato da altro dispositivo'}:t);
    const current=db.find(t=>t.id===id);
    if(JSON.stringify(current)!==JSON.stringify(expected))return{deleted:false};
    db=db.filter(t=>t.id!==id);return{deleted:true};
  };
  const ops=creaCoordinatoreTurniRapidi(services);
  return{ops,editor,control,calls,publications,services,records:()=>clone(db),local:()=>clone(local),mutate:fn=>{db=fn(db);}};
}

test('inserimenti successivi su date distinte: stesso payload manuale GPG/fiduciario, editor preservato',async()=>{
  for(const fiduciario of [false,true])for(const soglia of [7,8]){
    const h=harness({fiduciario,soglia});const before=clone(Object.fromEntries(Object.entries(h.editor).filter(([,v])=>typeof v!=='function')));
    assert.equal((await h.ops.inserisci(quick,'2026-10-05')).status,'saved');
    const payload=h.calls.find(c=>c[0]==='POST')[1];
    const manual={...before,tipo:'turno',giorno:5,anno:2026,mese:9,inizio:'14:00',fine:'22:00',luogo:'Piantonamento',indirizzoServizio:'Aeroporto',localitaMeteoTurno:''};
    Object.assign(h.editor,manual);assert.deepEqual(clone(h.editor.creaPayload()),payload);
    Object.assign(h.editor,before);
    assert.equal((await h.ops.inserisci(quick,'2027-01-01')).status,'saved');
    assert.equal(h.calls.filter(c=>c[0]==='POST').length,2);assert.equal(h.local().length,2);
    assert.equal(h.records()[1].anno,2027);assert.equal(h.records()[1].mese,1);
    assert.equal(h.editor.giorno,before.giorno);assert.equal(h.editor.luogo,before.luogo);
  }
});
test('blocco sincrono del doppio tocco: un solo POST e nessun successo anticipato',async()=>{
  const gate=deferred(),h=harness({control:{gate}});
  const first=h.ops.inserisci(quick,'2026-10-05');assert.equal(h.ops.getState().busy,true);
  assert.equal((await h.ops.inserisci(quick,'2026-10-05')).status,'busy');await tick();
  assert.equal(h.calls.filter(c=>c[0]==='POST').length,1);assert.equal(h.local().length,0);assert.notEqual(h.ops.getState().status,'saved');
  gate.resolve();assert.equal((await first).status,'saved');assert.equal(h.local().length,1);
  assert.equal((await h.ops.inserisci(quick,'2026-10-05')).status,'conflict');assert.equal(h.calls.filter(c=>c[0]==='POST').length,1);
});
test('notturni e turni multipli: aggiunta compatibile, duplicati e conflitti oltre il mese',async()=>{
  const h=harness({records:[record(1,5)]});assert.equal((await h.ops.inserisci(quick,'2026-10-05')).status,'saved');
  assert.equal(h.records().length,2);
  const night={...quick,inizio:'22:00',fine:'06:00'};
  assert.equal((await h.ops.inserisci(night,'2026-10-06')).status,'saved');assert.equal(h.records().at(-1).ore,8);
  const next=harness({records:[record(2,1,'05:00','10:00',{mese:11})]});
  assert.equal((await next.ops.inserisci(night,'2026-10-31')).status,'conflict');assert.ok(next.calls.every(c=>c[0]!=='POST'));
});
test('riposi, ferie, date e orari non validi impediscono qualsiasi POST',async()=>{
  for(const tipo of ['riposo','ferie','malattia']){
    const h=harness({records:[record(1,5,'','',{tipo})]});assert.equal((await h.ops.inserisci(quick,'2026-10-05')).status,'conflict');
    assert.equal(h.calls.filter(c=>c[0]==='POST').length,0);
  }
  for(const [m,date] of [[{...quick,inizio:'25:00'},'2026-10-05'],[quick,'2026-02-30']]){
    const h=harness();await h.ops.inserisci(m,date);assert.equal(h.calls.filter(c=>c[0]==='POST').length,0);
  }
});
test('errore di lettura prima dell’invio e rifiuto esplicito: nessun successo o tentativo automatico',async()=>{
  const read=harness({control:{failRead:true}});assert.equal((await read.ops.inserisci(quick,'2026-10-05')).status,'error');
  assert.equal(read.calls.filter(c=>c[0]==='POST').length,0);
  const h=harness({control:{failure:'backend'}});assert.equal((await h.ops.inserisci(quick,'2026-10-05')).status,'error');
  assert.equal(h.local().length,0);assert.equal(h.ops.getState().uncertain,false);
  h.control.failure=null;assert.equal((await h.ops.inserisci(quick,'2026-10-05')).status,'saved');
});
test('rete e timeout con esito sconosciuto: rilettura obbligatoria, nessun reinvio anche se la lettura non trova righe',async()=>{
  for(const failure of ['network-before','timeout-before']){
    const h=harness({control:{failure}});assert.equal((await h.ops.inserisci(quick,'2026-10-05')).status,'uncertain');
    assert.equal(h.ops.getState().uncertain,true);assert.equal(h.local().length,0);
    const count=h.calls.filter(c=>c[0]==='POST').length;
    h.control.failure=null;await h.ops.inserisci(quick,'2026-10-05');await h.ops.verificaEsito();
    assert.equal(h.calls.filter(c=>c[0]==='POST').length,count);assert.ok(h.calls.filter(c=>c[0]==='GET').length>=3);
  }
});
test('risposta persa dopo il commit simulato: elenco riconciliato, nessuna attribuzione di un ID per Annulla',async()=>{
  for(const failure of ['network-after','missing-id']){
    const h=harness({control:{failure}});assert.equal((await h.ops.inserisci(quick,'2026-10-05')).status,'uncertain');
    assert.equal(h.local().length,1);assert.equal(h.ops.getState().lastId,null);assert.notEqual(h.ops.getState().status,'saved');
    await h.ops.inserisci(quick,'2026-10-05');assert.equal(h.calls.filter(c=>c[0]==='POST').length,1);
  }
});
test('refresh fallito dopo ID confermato: il record resta visibile e non viene duplicato',async()=>{
  const h=harness({control:{failRefresh:true}});assert.equal((await h.ops.inserisci(quick,'2026-10-05')).status,'saved');
  assert.equal(h.local().length,1);assert.equal(h.ops.getState().lastId,100);assert.equal(h.ops.getState().uncertain,false);
  assert.match(h.ops.getState().message,/aggiornamento elenco non riuscito/);
});
test('cambio di contesto durante la verifica impedisce l’invio e il riutilizzo di impostazioni obsolete',async()=>{
  const h=harness(),gate=deferred();h.services.read=async()=>{await gate.promise;return[];};
  const pending=h.ops.inserisci(quick,'2026-10-05');h.control.configKey='fiduciario-8';gate.resolve();
  assert.equal((await pending).status,'blocked');assert.equal(h.calls.filter(c=>c[0]==='POST').length,0);
});
test('API attuali: Annulla ed Elimina disabilitati senza chiamare cancellazioni',async()=>{
  const h=harness();await h.ops.inserisci(quick,'2026-10-05');assert.equal(h.ops.getState().canUndo,false);assert.equal(h.ops.getState().canDelete,false);
  assert.equal((await h.ops.annulla()).status,'disabled');assert.equal((await h.ops.eliminaSelezionati(h.records())).status,'disabled');
  assert.equal(h.records().length,1);assert.ok(h.calls.every(c=>!c[0].startsWith('DELETE')));
});
test('servizio condizionale simulato: Annulla elimina soltanto l’ID restituito dall’ultimo inserimento',async()=>{
  const h=harness({conditional:true,records:[record(1,5)]});await h.ops.inserisci(quick,'2026-10-05');
  assert.equal(h.ops.getState().canUndo,true);assert.equal((await h.ops.annulla()).status,'deleted');
  assert.deepEqual(h.records().map(t=>t.id),[1]);assert.equal(h.calls.find(c=>c[0]==='DELETE-CONDITIONAL')[1],100);
});
test('servizio condizionale simulato: modifiche prima o durante Annulla preservano il record',async()=>{
  const before=harness({conditional:true});await before.ops.inserisci(quick,'2026-10-05');before.mutate(rows=>rows.map(t=>({...t,luogo:'Altro dispositivo'})));
  assert.equal((await before.ops.annulla()).status,'blocked');assert.equal(before.records().length,1);assert.ok(before.calls.every(c=>!c[0].startsWith('DELETE')));
  const during=harness({conditional:true,control:{mutateDuringDelete:true}});await during.ops.inserisci(quick,'2026-10-05');
  assert.equal((await during.ops.annulla()).status,'blocked');assert.equal(during.records().length,1);
});
test('servizio condizionale simulato: eliminazione selettiva non include altri servizi o personali',async()=>{
  const h=harness({conditional:true,records:[record(1,5),record(2,5,'16:00','20:00'),record(3,5,'','',{tipo:'personal'})]});
  assert.equal((await h.ops.eliminaSelezionati([h.records()[1]])).status,'deleted');assert.deepEqual(h.records().map(t=>t.id),[1,3]);
  assert.equal((await h.ops.eliminaSelezionati([h.records()[1]])).status,'blocked');
});

// Rendering con coordinatore reale e soli servizi in memoria.
function ui(h){
  const states=[],refs=[],effects=new Map();let slot=0,refSlot=0,effectSlot=0,nodes=[];
  const palette={background:'#07111F',surface:'#101C2D',surfaceRaised:'#172536',border:'#456789',text:'#FFFFFF',textMuted:'#C0D0E0',homeAccent:'#168BFF',onAccent:'#FFFFFF',error:'#FF6B6B'};
  const host=name=>({children,...props})=>{if(name==='Modal'&&!props.visible)return null;nodes.push({name,...props});return React.createElement('div',null,children);};
  const react={...React,useMemo:fn=>fn(),useEffect:fn=>{const i=effectSlot++;if(!effects.has(i))effects.set(i,fn());},
    useState:initial=>{const i=slot++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];},
    useRef:initial=>{const i=refSlot++;return refs[i]||(refs[i]={current:initial});}};
  const native={...Object.fromEntries(['Modal','Pressable','ScrollView','Text','View','ActivityIndicator'].map(n=>[n,host(n)])),StyleSheet:{create:s=>s,absoluteFill:{}},useWindowDimensions:()=>({fontScale:1}),PanResponder:{create:handlers=>({panHandlers:handlers})}};
  const imports={...modules,react,'react-native':native,'react-native-safe-area-context':{SafeAreaView:host('SafeAreaView')},'@expo/vector-icons':{Ionicons:host('Ionicons')},'./temi':{...require('../temi.js'),PALETTE_ORIGINALE:palette}};
  for(const name of ['calendarioVista','TurniRapidiPreview','CalendarScreen']){const c={exports:{},require:key=>{assert.ok(imports[key],key);return imports[key];}};vm.runInNewContext(compile(name+'.js'),c);imports['./'+name]=c.exports;}
  const render=()=>{slot=0;refSlot=0;effectSlot=0;nodes=[];const html=renderToStaticMarkup(React.createElement(imports['./CalendarScreen'].default,{anno:2026,mese:9,records:h.local(),tuttiTurni:h.local(),impegniPersonali:[],filtroAgenda:'tutto',giornoSelezionato:1,summary:{ore:'0h',extra:'0h',notti:0},turniRapidi:[quick],paletteHome:palette,nomeTipo:t=>t,operazioniRapide:h.ops,onManualDay:()=>assert.fail('Editor manuale invocato in modalità rapida'),onSelectDay:()=>{},onMonthChange:()=>{},onBack:()=>{}})).replace(/<!--.*?-->/g,'');
    return{nodes,html,press:label=>{const n=nodes.find(n=>n.accessibilityLabel===label);assert.ok(n,label);assert.ok(!n.disabled,label);return n.onPress();},day:day=>nodes.find(n=>n.testID===`calendar-day-${day}`).onPress()};};
  return{render,cleanup:()=>effects.forEach(fn=>typeof fn==='function'&&fn())};
}
test('UI reale: nessuna conferma per l’inserimento, indicatore in attesa, calendario aggiornato solo dopo successo',async()=>{
  const gate=deferred(),h=harness({control:{gate}}),view=ui(h);view.render().press('Turni rapidi');view.render().press('Turno rapido Sera, 14:00 22:00');
  const pending=view.render().day(5);await tick();let r=view.render();assert.ok(r.nodes.some(n=>n.testID==='rapid-saving'));assert.ok(!r.html.includes('Turno salvato.'));
  assert.equal(r.nodes.find(n=>n.testID==='calendar-day-5').accessibilityLabel.includes('14:00–22:00'),false);
  gate.resolve();await pending;r=view.render();assert.ok(r.html.includes('Turno salvato.'));
  assert.ok(r.nodes.find(n=>n.testID==='calendar-day-5').accessibilityLabel.includes('14:00–22:00'));
  assert.equal(r.nodes.find(n=>n.accessibilityLabel==='Turno rapido Sera, 14:00 22:00').accessibilityState.selected,true);
  assert.equal(r.nodes.find(n=>n.accessibilityLabel==='ANNULLA ultimo inserimento').disabled,true);view.cleanup();
});
test('UI reale: selezione e riepilogo Elimina disponibili, conferma disabilitata senza garanzia condizionale',()=>{
  const h=harness({records:[record(1,5),record(2,5,'16:00','20:00')]}),view=ui(h);
  view.render().press('Turni rapidi');view.render().press('Elimina · selezione dei servizi');view.render().day(5);view.render().press('Rivedi eliminazioni');
  let r=view.render();assert.equal(r.nodes.filter(n=>n.accessibilityRole==='checkbox').length,2);
  r.nodes.find(n=>n.accessibilityRole==='checkbox').onPress();r=view.render();
  assert.equal(r.nodes.find(n=>n.accessibilityLabel==='Conferma eliminazione').disabled,true);assert.ok(r.html.includes('altro dispositivo'));
  assert.equal(h.calls.length,0);view.cleanup();
});
test('collegamento App: servizi originali iniettati e nessuna capacità di cancellazione reale',async()=>{
  const n=root.body.body.find(n=>n.type==='IfStatement'&&app.slice(n.test.start,n.test.end)==='!operazioniRapideRef.current');assert.ok(n);
  let captured,created=0,read=0;const ctx={operazioniRapideRef:{current:null},contestoRapidiRef:{current:{userId:'fixture',build:d=>d}},
    creaCoordinatoreTurniRapidi:services=>{captured=services;return{};},inserisciTurno:async p=>{created++;return{id:1,...p};},caricaTurniUtente:async()=>{read++;return[];},setTurni:()=>{},setSaving:()=>{}};
  vm.runInNewContext(app.slice(n.start,n.end),ctx);await captured.create({tipo:'turno'});await captured.read();
  assert.equal(created,1);assert.equal(read,1);assert.equal(captured.removeIfUnchanged,undefined);
  assert.ok(app.includes('operazioniRapide={operazioniRapideRef.current}'));
});
