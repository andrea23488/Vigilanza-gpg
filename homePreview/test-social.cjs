const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),ts=require('typescript');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
function load(name,imports={}) {
 const code=ts.transpileModule(read(name),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 const c={exports:{},require:key=>{assert.ok(key in imports,`Unexpected import: ${key}`);return imports[key];}};
 vm.runInNewContext(code,c);return c.exports;
}
const options=load('socialOptions.ts');
function renderSocial({reduced=false,active=true,detail=null}={}) {
 const nodes=[],effects=[],springs=[],calls=[],values=[];let hook=0;
 const host=name=>({children,...props})=>{nodes.push({name,...props});return React.createElement('div',null,children);};
 class Value { constructor(){values.push(this);} stopAnimation(){} setValue(){} }
 const native={...Object.fromEntries(['Pressable','ScrollView','Text','View'].map(name=>[name,host(name)])),
  Animated:{Value,View:host('AnimatedView'),spring:(value,config)=>{springs.push(config);return{start(){}};}},
  StyleSheet:{create:x=>x},useWindowDimensions:()=>({width:320,height:568,fontScale:1}),
  AppState:{currentState:active?'active':'background',addEventListener:()=>({remove(){}})},
  AccessibilityInfo:{addEventListener:()=>({remove(){}}),isReduceMotionEnabled:()=>Promise.resolve(reduced)},
  BackHandler:{addEventListener:()=>({remove(){}})}};
 const react={...React,useEffect:f=>effects.push(f),useRef:v=>({current:v}),useState:initial=>[hook++===0?reduced:active,()=>{}]};
 const components=load('SocialScreen.tsx',{react,'react-native':native,'react-native-safe-area-context':{SafeAreaView:host('SafeAreaView')},'@expo/vector-icons':{Ionicons:host('Ionicons')},'./socialOptions':options,'./SharedShiftsScreen':{__esModule:true,default:()=>React.createElement('div',null,'Turni condivisi DEMO')},'./ThemeContext':{useDemoTheme:()=>({palette:{background:'#03081B',surface:'#0C1630',surfaceRaised:'#112340',border:'#345C8D',accent:'#CE8DFF',homeAccent:'#CE8DFF',text:'#F2F7FF',textMuted:'#BDCBE1'}})}});
 const element=detail?React.createElement(components.SocialDemoDetail,{optionId:detail,onBack:()=>calls.push('social'),onHome:()=>calls.push('home')}):React.createElement(components.default,{onBack:()=>calls.push('home'),onSelect:id=>calls.push(id)});
 const html=renderToStaticMarkup(element);
 return{nodes,effects,springs,calls,html};
}
test('menu Social: quattro opzioni reali selezionabili e ritorno Home',()=>{
 const r=renderSocial();
 const buttons=r.nodes.filter(n=>n.name==='Pressable');
 for(const option of options.SOCIAL_OPTIONS){const b=buttons.find(n=>n.accessibilityLabel===option.label);assert.ok(b);b.onPress();}
 buttons.find(n=>n.accessibilityLabel==='Torna alla Home').onPress();
 assert.deepEqual(r.calls,['shared-shifts','chat','colleague-profiles','find-colleague','home']);
 assert.ok(r.html.includes('DEMO'));assert.equal(new Set(options.SOCIAL_OPTIONS.map(x=>x.id)).size,4);
});
test('quattro dettagli esplicitamente DEMO, senza dati né operazioni reali',()=>{
 for(const option of options.SOCIAL_OPTIONS.filter(option=>option.id!=='shared-shifts')){
  const r=renderSocial({detail:option.id});
  assert.ok(r.html.includes('SCHERMATA DEMO'));assert.ok(r.html.includes(option.label));
  assert.ok(r.html.includes('non vengono caricate')||r.html.includes('non vengono caricati'));
  for(const label of ['Torna al menu Social','Torna alla Home'])r.nodes.find(n=>n.accessibilityLabel===label).onPress();
  assert.deepEqual(r.calls,['social','home']);
 }
});
test('pressione leggera sul driver nativo, disattivata con Reduce Motion o background',()=>{
 for(const config of [{},{reduced:true},{active:false}]){
  const r=renderSocial(config),button=r.nodes.find(n=>n.accessibilityLabel==='CHAT');
  button.onPressIn();button.onPressOut();button.onPress();
  assert.deepEqual(r.calls,['chat']);
  assert.equal(r.springs.length,config.reduced||config.active===false?0:2);
  for(const spring of r.springs){assert.equal(spring.useNativeDriver,true);assert.equal(spring.isInteraction,false);}
 }
});
test('anteprima: Home → Social → ogni dettaglio → Social/Home senza importare servizi',()=>{
 const state=[],captured={};let cursor=0;
 const react={...React,useReducer:(reducer,arg,init)=>[init(arg),()=>{}],useState:initial=>{const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return[state[i],v=>state[i]=typeof v==='function'?v(state[i]):v];}};
 const capture=name=>props=>{captured[name]=props;return React.createElement('div',null,name);};
 const home=capture('home'),social=capture('social'),detail=capture('detail');
 const demo=load('HomeDemo.tsx',{
  react,'react-native':{Platform:{OS:'web'},Alert:{alert(){throw Error('unexpected Alert');}},StatusBar:()=>null},
  'react-native-safe-area-context':{SafeAreaProvider:({children})=>React.createElement('div',null,children)},
  './CalendarScreen':capture('calendar'),'./calendarModel':load('calendarModel.ts'),
  './SettingsScreen':{__esModule:true,default:capture('settings'),SettingsDemoDetail:capture('settingsDetail')},
  '../HomeScreen':home,'./SocialScreen':{__esModule:true,default:social,SocialDemoDetail:detail},
  './DemoDialog':()=>null,'./demoData':{creaDatiDemo:()=>({profilo:{nome:'DEMO'}})},
  '../temi':{PALETTE_ORIGINALE:{background:'#03081B'},PRESET_TEMI:[{id:'originale'}],paletteHomeDaPreferenza:()=>null,rapportoContrasto:()=>10,ripristinaAspetto:()=>({version:1,preset:'originale',background:null,accent:null})},
  './InteractiveThemePreview':capture('interactive'), './AppearanceScreen':capture('appearance'),'./ThemeContext':{ThemeProvider:({children})=>children},
 });
 const render=()=>{cursor=0;for(const key of Object.keys(captured))delete captured[key];return renderToStaticMarkup(React.createElement(demo.default));};
 render();assert.ok(captured.home);
 for(const option of options.SOCIAL_OPTIONS){
  captured.home.onSocial();render();assert.ok(captured.social);assert.equal(captured.home,undefined);
  captured.social.onSelect(option.id);render();assert.equal(captured.detail.optionId,option.id);
  captured.detail.onBack();render();assert.ok(captured.social);
  captured.social.onBack();render();assert.ok(captured.home);
 }
 captured.home.onSocial();render();captured.social.onSelect('chat');render();captured.detail.onHome();render();assert.ok(captured.home);
});
