const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const React=require('react'),ts=require('typescript'),{renderToStaticMarkup}=require('react-dom/server');
const root=__dirname,parent=path.dirname(root);
function load(file,imports){const context={exports:{},require:name=>{assert.ok(name in imports,'Import non simulato: '+name);return imports[name]},Date};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,context);return context.exports;}
const calculations=load(path.join(parent,'turniCalcoli.js'),{}),planner=load(path.join(parent,'turniRapidiAnteprima.js'),{'./turniCalcoli':calculations}),vista=load(path.join(parent,'calendarioVista.js'),{}),ops=load(path.join(root,'rapidOperations.js'),{'../turniRapidiAnteprima':planner});
const palette={background:'#FFFFFF',surface:'#EEEEEE',surfaceRaised:'#DDDDDD',text:'#111111',textMuted:'#222222',border:'#444444',homeAccent:'#004499',onAccent:'#FFFFFF',error:'#990000'};
const shift=(id,day,start='08:00',end='16:00',more={})=>({id,anno:2026,mese:10,giorno:day,tipo:'turno',inizio:start,fine:end,luogo:'Posto '+id,...more});
const models=[{id:'day',nome:'Diurno',inizio:'08:00',fine:'16:00',luogo:'Sede DEMO'},{id:'night',nome:'Notturno',inizio:'22:00',fine:'06:00',luogo:'Sede DEMO'}];
function harness({records=[],width=440,fontScale=1,...overrides}={}){
 const slots=[],nodes=[],calls=[];let slot=0,id=0,last=null,rows=records.map(row=>({...row}));
 const hooks={...React,useState:initial=>{const key=slot++;if(!(key in slots))slots[key]=typeof initial==='function'?initial():initial;return[slots[key],v=>slots[key]=typeof v==='function'?v(slots[key]):v]},useRef:initial=>{const key=slot++;return slots[key]||(slots[key]={current:initial})},useMemo:(fn,deps)=>{const key=slot++;if(!slots[key]||deps.some((v,i)=>v!==slots[key].deps[i]))slots[key]={value:fn(),deps};return slots[key].value},useEffect:()=>{}};
 const host=name=>props=>{if(name==='Modal'&&!props.visible)return null;nodes.push({name,...props});return React.createElement('div',null,props.children)};
 const native={...Object.fromEntries(['ActivityIndicator','Modal','Pressable','ScrollView','Text','View'].map(n=>[n,host(n)])),StyleSheet:{create:s=>s,absoluteFill:{}},useWindowDimensions:()=>({width,fontScale}),PanResponder:{create:handlers=>({panHandlers:handlers})}};
 const safe={'react-native-safe-area-context':{SafeAreaView:host('SafeAreaView')}};
 const Calendar=load(path.join(root,'CalendarScreen.js'),{react:hooks,'react-native':native,...safe,'@expo/vector-icons':{Ionicons:host('Ionicons')},'../temi':{PALETTE_ORIGINALE:palette,testoTema:()=>palette.text},'../calendarioVista':vista,'../turniRapidiAnteprima':planner}).default;
 const rapidInsert=(model,date,allowOccupied)=>{const result=ops.prepareRapidInsert(rows,model,date,`beta-rapid-${id+1}`,allowOccupied);if(result.status!=='inserted')return result;const committed=ops.commitRapidProposal(rows,result);if(committed.status!=='inserted')return committed;rows=committed.records;last=committed.operation;id+=1;calls.push(['insert',result.record.id]);return result};
 const rapidDelete=key=>{const result=ops.prepareRapidDelete(rows,key);if(result.status!=='deleted')return result;const committed=ops.commitRapidProposal(rows,result);if(committed.status!=='deleted')return committed;rows=committed.records;last=committed.operation;calls.push(['delete',result.record.id]);return committed};
 const undo=()=>{const result=ops.undoRapidOperation(rows,last);if(result.status==='undone'){rows=result.records;last=null;calls.push(['undo']);}return result};
 const props={anno:2026,mese:9,records:rows,tuttiTurni:rows,impegniPersonali:[],filtroAgenda:'tutti',giornoSelezionato:1,summary:{ore:'8',extra:'0',notti:'0'},turniRapidi:models,paletteHome:palette,onManualDay:d=>calls.push(['manual',d]),onSelectDay:d=>calls.push(['select',d]),onMonthChange:d=>calls.push(['month',d]),onBack:()=>calls.push(['home']),nomeTipo:t=>t,onRapidInsert:rapidInsert,onRapidDelete:rapidDelete,onUndoRapid:undo,...overrides};
 const draw=()=>{props.records=rows.filter(row=>row.anno===props.anno&&row.mese===props.mese+1);props.tuttiTurni=rows;props.lastRapidOperation=last;slot=0;nodes.length=0;renderToStaticMarkup(React.createElement(Calendar,props));};draw();
 const find=label=>{const node=nodes.find(n=>n.accessibilityLabel===label||n.testID===label);assert.ok(node,'Nodo mancante: '+label);return node};
 const press=label=>{const n=find(label);assert.ok(!n.disabled,'Controllo disabilitato: '+label);const result=n.onPress();draw();return result};
 const day=d=>{find('calendar-grid').props?.onTouchStart?.();const grid=find('calendar-grid');grid.onTouchStart?.();const result=find('calendar-day-'+d).onPress();draw();return result};
 return {nodes,calls,props,draw,find,press,day,get rows(){return rows},get last(){return last}};
}
function enterInsert(r,model='day'){r.press('Turni rapidi');r.press(`Inserisci modello ${models.find(m=>m.id===model).nome}, ${models.find(m=>m.id===model).inizio} ${models.find(m=>m.id===model).fine}`);}
const flatten=value=>Array.isArray(value)?value.map(flatten).join(' '):value&&typeof value==='object'?flatten(value.props?.children):String(value??'');
function enterDelete(r){r.press('Turni rapidi');r.press('Elimina · modalità simulata');}

test('Inserimento immediato al tocco, aggiornamento del calendario e nessun riepilogo',()=>{
 const r=harness();enterInsert(r);r.day(5);assert.equal(r.rows.length,1);assert.match(r.find('calendar-day-5').accessibilityLabel,/08:00–16:00/);assert.equal(r.nodes.some(n=>n.name==='Modal'&&n.visible),false);assert.match(r.find('rapid-feedback').children,/Inserito 08:00–16:00/);
});
test('Tocchi ripetuti non creano duplicati e il conflitto richiede una scelta esplicita',()=>{
 const r=harness();enterInsert(r);r.day(5);r.day(5);assert.equal(r.rows.length,1);assert.equal(r.nodes.some(n=>n.accessibilityLabel==='Aggiungi turno senza sovrapposizione'),false);assert.match(flatten(r.nodes.find(n=>n.name==='Modal'&&n.visible).children),/Turno non inserito/);
});
test('Turni multipli non sovrapposti: l’app mostra i dettagli e richiede di aggiungere esplicitamente',()=>{
 const r=harness({records:[shift('existing',5,'06:00','08:00')]});enterInsert(r);r.day(5);assert.equal(r.rows.length,1);assert.ok(r.find('Aggiungi turno senza sovrapposizione'));r.press('Aggiungi turno senza sovrapposizione');assert.equal(r.rows.length,2);assert.match(r.find('calendar-day-5').accessibilityLabel,/06:00–08:00; 08:00–16:00/);assert.deepEqual(r.calls,[['insert','beta-rapid-1']]);
});
test('Conflitti sovrapposti e attraversamento della mezzanotte vengono bloccati',()=>{
 const conflict=harness({records:[shift('a',5,'14:00','18:00')]});enterInsert(conflict);conflict.day(5);assert.equal(conflict.rows.length,1);assert.equal(conflict.find('Scegli un’altra data').accessibilityLabel,'Scegli un’altra data');assert.equal(conflict.nodes.some(n=>n.accessibilityLabel==='Aggiungi turno senza sovrapposizione'),false);
 const midnight=harness({records:[shift('night-old',4,'23:00','07:00')]});enterInsert(midnight,'night');midnight.day(4);assert.equal(midnight.rows.length,1);assert.equal(midnight.nodes.some(n=>n.accessibilityLabel==='Aggiungi turno senza sovrapposizione'),false);
});
test('Inserimento notturno mantiene il modello 22–06 e il giorno successivo senza sovrapposizioni',()=>{
 const r=harness();enterInsert(r,'night');r.day(6);assert.equal(r.rows.length,1);assert.equal(r.rows[0].inizio,'22:00');assert.equal(r.rows[0].fine,'06:00');r.day(7);assert.equal(r.rows.length,2);
});
test('Annulla ultima operazione ripristina l’elenco precedente senza effetti parziali',()=>{
 const r=harness({records:[shift('base',2)]});enterInsert(r);r.day(5);assert.equal(r.rows.length,2);r.press('Annulla ultima operazione');assert.deepEqual(Array.from(r.rows,row=>row.id),['base']);assert.equal(r.last,null);assert.match(r.find('rapid-feedback').children,/annullata/);
});
test('Eliminazione singola: tocco turno apre una conferma compatta e cancella soltanto dopo il comando',()=>{
 const r=harness({records:[shift('one',5,'14:00','22:00')]});enterDelete(r);r.day(5);assert.equal(r.rows.length,1);assert.ok(r.find('Elimina turno'));assert.ok(r.nodes.some(n=>n.name==='Text'&&n.children==='14:00–22:00 · Posto one'));r.press('Elimina turno');assert.equal(r.rows.length,0);assert.equal(r.nodes.some(n=>n.name==='Modal'&&n.visible),false);
});
test('Eliminazione con più turni consente la scelta precisa e la sola conferma finale',()=>{
 const r=harness({records:[shift('one',5,'06:00','14:00'),shift('two',5,'14:00','22:00'),shift('three',6)]});enterDelete(r);r.day(5);assert.ok(r.find('Scegli turno 14:00–22:00 · Posto two'));r.press('Scegli turno 14:00–22:00 · Posto two');assert.ok(r.find('Elimina turno'));r.press('Elimina turno');assert.deepEqual(Array.from(r.rows,row=>row.id),['one','three']);assert.deepEqual(r.calls,[['delete','two']]);
});
test('Eliminazione rifiuta ID mancanti o ambigui e non seleziona riposi o dati personali',()=>{
 const r=harness({records:[shift('dup',5),shift('dup',5,'14:00','22:00'),shift(null,5),shift('rest',5,'','',{tipo:'riposo'}),shift('personal',5,'08:00','09:00',{origin:'personal'})]});enterDelete(r);r.day(5);assert.equal(r.find('Elimina turno').disabled,true);assert.match(flatten(r.nodes.find(n=>n.name==='Modal'&&n.visible).children),/senza identificativo univoco esclusi/);assert.equal(r.rows.length,5);
});
test('Un solo annullamento riguarda l’ultima operazione: delete poi undo ripristina il turno appena eliminato',()=>{
 const r=harness({records:[shift('one',5)]});enterDelete(r);r.day(5);r.press('Elimina turno');assert.equal(r.rows.length,0);r.press('Annulla ultima operazione');assert.deepEqual(Array.from(r.rows,row=>row.id),['one']);
});
test('Swipe, frecce, tap, pressione lunga, gesture verticali e cancellazione restano compatibili',()=>{
 const realNow=Date.now;let clock=Date.now();Date.now=()=>clock;const r=harness(),grid=r.find('calendar-grid'),g={dx:-90,dy:8,numberActiveTouches:1};assert.equal(grid.onStartShouldSetPanResponder(),false);assert.equal(grid.onMoveShouldSetPanResponderCapture(null,g),true);grid.onPanResponderGrant();r.draw();grid.onPanResponderRelease(null,g);grid.onPanResponderRelease(null,g);assert.deepEqual(r.calls,[['month',1]]);
 const changed=[];r.props.onMonthChange=d=>changed.push(d);r.draw();grid.onPanResponderGrant();grid.onPanResponderRelease(null,{...g,dx:90});assert.deepEqual(changed,[-1]);r.press('Mese successivo');r.press('Mese precedente');assert.deepEqual(changed,[-1,1,-1]);
 clock+=400;r.day(2);assert.deepEqual(r.calls.slice(-1),[['manual',2]]);grid.onTouchStart();r.find('calendar-day-3').onLongPress();r.find('calendar-day-3').onPress();assert.deepEqual(r.calls.at(-1),['select',3]);
 grid.onTouchStart();assert.equal(grid.onMoveShouldSetPanResponderCapture(null,{dx:0,dy:90,numberActiveTouches:1}),false);grid.onPanResponderGrant();grid.onPanResponderTerminate();grid.onPanResponderRelease(null,g);assert.equal(r.calls.filter(c=>c[0]==='month').length,1);Date.now=realNow;
});
test('Modello puro: conflitto e mancato commit sono atomici; undo rifiuta snapshot diventati obsoleti',()=>{
 const before=[shift('base',5,'00:00','08:00')],proposal=ops.prepareRapidInsert(before,models[0],'2026-10-05','new',true);assert.equal(proposal.status,'inserted');const missed=ops.commitRapidProposal(before.map(row=>({...row,luogo:'altro'})),proposal);assert.equal(missed.status,'stale');assert.equal(missed.records[0].id,'base');
 const committed=ops.commitRapidProposal(before,proposal),undone=ops.undoRapidOperation(committed.records,committed.operation);assert.equal(undone.status,'undone');assert.deepEqual(Array.from(undone.records,row=>row.id),['base']);assert.equal(ops.undoRapidOperation([...committed.records,shift('remote',8)],committed.operation).status,'stale');
});
test('Commit futuro chiama un adapter una sola volta e applica solo un successo esplicito',async()=>{
 const before=[],proposal=ops.prepareRapidInsert(before,models[0],'2026-10-05','new');let calls=0;const refused=await ops.commitRapidWithAdapter(before,proposal,async()=>{calls++;return{ok:false}});assert.equal(refused.status,'failed');assert.deepEqual(refused.records,before);assert.equal(calls,1);const accepted=await ops.commitRapidWithAdapter(before,proposal,async op=>{calls++;assert.equal(op.type,'insert');return{ok:true,records:op.after}});assert.equal(accepted.status,'inserted');assert.equal(accepted.persisted,true);assert.equal(accepted.records[0].id,'new');assert.equal(calls,2);
});
test('Eliminazione esatta usa una proposta transazionale senza alterare altri record',()=>{
 const rows=[shift('a',5),shift('b',5,'14:00','22:00')],p=ops.prepareRapidDelete(rows,'2026-10-05|b');assert.equal(p.status,'deleted');assert.deepEqual(Array.from(p.records,row=>row.id),['a']);assert.deepEqual(Array.from(rows,row=>row.id),['a','b']);assert.equal(ops.prepareRapidDelete(rows,'2026-10-05|missing').status,'blocked');assert.equal(ops.prepareRapidDelete([shift('personal',5,'08:00','09:00',{origin:'personal'})],'2026-10-05|personal').status,'blocked');
});
test('Layout resta responsive, safe area e Calendario sempre visibile mentre si opera',()=>{
 for(const [width,fontScale] of [[320,1],[440,1],[900,1.5]]){const r=harness({width,fontScale});enterInsert(r);assert.ok(r.find('calendar-grid'));r.day(4);assert.ok(r.find('calendar-grid'));assert.equal(r.find('calendar-instructions').style[0].fontSize>=15,true);assert.equal(r.find('calendar-grid').testID,'calendar-grid')}
});
