const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),ts=require('typescript');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
function load(name,imports){const code=ts.transpileModule(read(name),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;const c={exports:{},require:key=>{assert.ok(key in imports,`Unexpected import: ${key}`);return imports[key];}};vm.runInNewContext(code,c);return c.exports;}
const model=load('sharedShiftsModel.ts',{});
function fixed(){return new Date(2026,9,21,15,30);}
function testRow(id,dateKey,user,name,start,end,place='Piantonamento') {return{id,dateKey,user,name,company:'DEMO',start,end,place};}
test('apertura: settimana Lun 19–Dom 25 e oggi mercoledì 21 selezionato',()=>{
 const week=model.weekForDate(fixed());assert.deepEqual(Array.from(week,d=>[d.label,d.day,d.today]),[['lun',19,false],['mar',20,false],['mer',21,true],['gio',22,false],['ven',23,false],['sab',24,false],['dom',25,false]]);
 const strips=model.weekForDate(new Date(2026,9,19));assert.equal(strips[0].today,true);
 for(const sample of [new Date(2026,0,1),new Date(2024,11,31),new Date(2026,11,31)]){const days=model.weekForDate(sample);assert.equal(days.filter(d=>d.today).length,1);assert.ok(days.find(d=>d.today));}
});
test('lista filtra per giorno e ordina Tu, collega sullo stesso turno, poi per ora',()=>{
 const date='2026-10-21',shifts=[testRow('later',date,'a','Zoe','20:00','22:00'),testRow('self',date,'me','Tu','14:30','18:30'),testRow('same',date,'b','Giulia','14:30','18:30'),testRow('early',date,'c','Marco','06:00','14:00'),testRow('otherday','2026-10-22','d','Sara','14:30','18:30')];
 const order=Array.from(model.sortDayShifts(shifts.filter(s=>s.dateKey===date),fixed()),s=>s.id);assert.deepEqual(order,['self','same','early','later']);assert.equal(shifts.filter(s=>s.dateKey==='2026-10-22').length,1);
});
test('box “in servizio adesso”: intervalli correnti e notturni a cavallo del giorno',()=>{
 const now=fixed(),date=model.localDateKey(now),active=testRow('active',date,'a','Giulia','14:30','18:30'),before=testRow('before',date,'b','Marco','06:00','14:00');
 assert.equal(model.isOnShiftNow(active,now),true);assert.equal(model.isOnShiftNow(before,now),false);
 const night=testRow('night','2026-10-20','c','Luca','22:00','06:00');assert.equal(model.isOnShiftNow(night,new Date(2026,9,21,2)),true);assert.equal(model.isOnShiftNow(night,new Date(2026,9,21,6)),false);
});
test('auto-scroll centra oggi anche quando cade alla fine della settimana',()=>{
 assert.equal(model.todayScrollOffset(2,320),10);assert.equal(model.todayScrollOffset(6,320),282);assert.equal(model.todayScrollOffset(0,320),0);
});
function renderScreen({now=fixed(),shifts,viewport={width:375,height:812,fontScale:1}}={}){
 const nodes=[],effects=[],back=[],scrolls=[],refs=[];let hookState=[],cursor=0,rendered='';
 const host=name=>({children,...props})=>{nodes.push({name,...props});return React.createElement('div',null,children);};
 const Scroll=React.forwardRef((props,ref)=>{if(ref&&typeof ref==='object')ref.current={scrollTo:params=>scrolls.push(params)};nodes.push({name:'ScrollView',...props});return React.createElement('div',null,props.children);});
 const native={...Object.fromEntries(['Pressable','Text','View'].map(n=>[n,host(n)])),ScrollView:Scroll,StyleSheet:{create:x=>x},useWindowDimensions:()=>viewport,BackHandler:{addEventListener:(name,fn)=>{back.push(fn);return{remove(){}};}}};
 const react={...React,useMemo:fn=>fn(),useRef:initial=>{const ref={current:initial};refs.push(ref);return ref;},useEffect:fn=>effects.push(fn),useState:initial=>{const i=cursor++;if(!(i in hookState))hookState[i]=typeof initial==='function'?initial():initial;return[hookState[i],v=>hookState[i]=typeof v==='function'?v(hookState[i]):v];}};
 const imports={react,'react-native':native,'react-native-safe-area-context':{SafeAreaView:host('SafeAreaView')},'@expo/vector-icons':{Ionicons:host('Ionicons')},'./sharedShiftsModel':model,'./ThemeContext':{useDemoTheme:()=>({palette:{background:'#03081B',surface:'#0C1630',surfaceRaised:'#112340',border:'#345C8D',accent:'#CE8DFF',homeAccent:'#CE8DFF',text:'#F2F7FF',textMuted:'#BDCBE1',error:'#FFB2C9'}})}};
 const Screen=load('SharedShiftsScreen.tsx',imports).default;
 const draw=()=>{nodes.length=0;effects.length=0;refs.length=0;cursor=0;rendered=renderToStaticMarkup(React.createElement(Screen,{now,shifts,onBack:()=>back.push('back')}));effects.forEach(effect=>effect());};draw();
 return{nodes,scrolls,refs,back,get html(){return rendered;},rerender:draw,press(label){const p=nodes.find(n=>n.name==='Pressable'&&n.accessibilityLabel===label);assert.ok(p,label);p.onPress();}};
}
test('UI seleziona OGGI, scorre la barra, box attuale resta sopra e lista è compatta',()=>{
 const r=renderScreen();const today=r.nodes.find(n=>n.testID==='shared-day-today');assert.ok(today);assert.equal(today.accessibilityState.selected,true);assert.ok(r.scrolls.length>=1);assert.ok(r.html.includes('OGGI'));assert.ok(r.html.includes('IN SERVIZIO ADESSO'));
 const order=r.nodes.map(n=>n.testID).filter(x=>x==='shared-in-service'||x==='shared-day-list');assert.deepEqual(order,['shared-in-service','shared-day-list']);
 const rows=r.nodes.filter(n=>n.testID==='shared-colleague-row');assert.equal(rows.length,2);assert.ok(rows.length<=5);
 for(const row of rows){const style=Array.isArray(row.style)?Object.assign({},...row.style):row.style;assert.ok(style.minHeight<=70);assert.ok(row.accessibilityLabel.includes('DEMO')||row.accessibilityLabel.includes('TU'));}
 assert.ok(!r.html.includes('2026-10-20'));assert.ok(!r.html.includes('Lunedì 19')||r.html.includes('Lun'));
});
test('cambio giorno aggiorna selezione senza accumulare le sette liste',()=>{
 const r=renderScreen(),day=r.nodes.find(n=>n.testID==='shared-day-2026-10-22');assert.ok(day);day.onPress();r.rerender();
 const selected=r.nodes.find(n=>n.testID==='shared-day-2026-10-22');assert.equal(selected.accessibilityState.selected,true);const list=r.nodes.find(n=>n.testID==='shared-day-list');assert.ok(list.accessibilityLabel.includes('ottobre'));assert.ok(r.html.includes('Sara Conti'));assert.ok(!r.html.includes('Francesco'));assert.equal(r.nodes.filter(n=>n.testID==='shared-colleague-row').length,4);
});
test('navigazione da Social: Turni condivisi apre la vista dedicata',()=>{
 const nodes=[];const host=name=>({children,...props})=>{nodes.push({name,...props});return React.createElement('div',null,children);};
 class Value{stopAnimation(){}setValue(){}}
 const native={...Object.fromEntries(['Pressable','ScrollView','Text','View'].map(n=>[n,host(n)])),Animated:{Value,View:host('AnimatedView'),spring:()=>({start(){}})},StyleSheet:{create:x=>x},useWindowDimensions:()=>({width:375,height:812,fontScale:1}),AppState:{currentState:'active',addEventListener:()=>({remove(){}})},AccessibilityInfo:{addEventListener:()=>({remove(){}}),isReduceMotionEnabled:()=>Promise.resolve(true)},BackHandler:{addEventListener:()=>({remove(){}})}};
 const react={...React,useEffect:()=>{},useRef:x=>({current:x}),useState:init=>[typeof init==='function'?init():init,()=>{}]};
 const menu=load('socialOptions.ts',{}),shared=load('SharedShiftsScreen.tsx',{react,'react-native':native,'react-native-safe-area-context':{SafeAreaView:host('SafeAreaView')},'@expo/vector-icons':{Ionicons:host('Ionicons')},'./sharedShiftsModel':model,'./ThemeContext':{useDemoTheme:()=>({palette:{background:'#03081B',surface:'#0C1630',surfaceRaised:'#112340',border:'#345C8D',accent:'#CE8DFF',homeAccent:'#CE8DFF',text:'#F2F7FF',textMuted:'#BDCBE1',error:'#FFB2C9'}})}});
 const social=load('SocialScreen.tsx',{react,'react-native':native,'react-native-safe-area-context':{SafeAreaView:host('SafeAreaView')},'@expo/vector-icons':{Ionicons:host('Ionicons')},'./socialOptions':menu,'./SharedShiftsScreen':{__esModule:true,default:shared.default},'./ThemeContext':{useDemoTheme:()=>({palette:{background:'#03081B',surface:'#0C1630',surfaceRaised:'#112340',border:'#345C8D',accent:'#CE8DFF',homeAccent:'#CE8DFF',text:'#F2F7FF',textMuted:'#BDCBE1',error:'#FFB2C9'}})}});
 assert.ok(menu.SOCIAL_OPTIONS.some(option=>option.id==='shared-shifts'));let selected='shared-shifts';
 const detail=renderToStaticMarkup(React.createElement(social.SocialDemoDetail,{optionId:selected,onBack:()=>{},onHome:()=>{}}));assert.ok(detail.includes('Turni condivisi'));
});
