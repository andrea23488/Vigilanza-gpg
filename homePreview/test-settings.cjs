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
const options=load('settingsOptions.ts');
function renderSettings({reduced=false,active=true,detail=null,confirmation=false,viewport={width:320,height:568,fontScale:1}}={}) {
 const nodes=[],effects=[],timings=[],calls=[],setters=[],back=[];let hook=0;
 const host=name=>({children,...props})=>{nodes.push({name,...props});return React.createElement('div',null,children);};
 class Value { stopAnimation(){} setValue(){} interpolate(){return 0;} }
 const native={...Object.fromEntries(['Pressable','ScrollView','Text','View'].map(name=>[name,host(name)])),
  Animated:{Value,View:host('AnimatedView'),timing:(value,config)=>{timings.push(config);return{start(){}};}},
  StyleSheet:{create:x=>x},useWindowDimensions:()=>viewport,
  AppState:{currentState:active?'active':'background',addEventListener:()=>({remove(){}})},
  AccessibilityInfo:{addEventListener:()=>({remove(){}}),isReduceMotionEnabled:()=>Promise.resolve(reduced)},
  BackHandler:{addEventListener:(name,fn)=>{back.push(fn);return{remove(){}};}}};
 const react={...React,useEffect:f=>effects.push(f),useRef:v=>({current:v}),useState:initial=>[detail?confirmation:hook++===0?reduced:active,v=>setters.push(v)]};
 const components=load('SettingsScreen.tsx',{react,'react-native':native,'react-native-safe-area-context':{SafeAreaView:host('SafeAreaView'),useSafeAreaInsets:()=>({top:20,bottom:0,left:0,right:0})},'@expo/vector-icons':{Ionicons:host('Ionicons')},'./settingsOptions':options,'./ThemeContext':{useDemoTheme:()=>({palette:{background:'#03081B',surface:'#0C1630',surfaceRaised:'#112340',border:'#345C8D',accent:'#67CDFF',homeAccent:'#67CDFF',text:'#F2F7FF',textMuted:'#BDCBE1',error:'#FFB2C9'}})}});
 const element=detail?React.createElement(components.SettingsDemoDetail,{optionId:detail,onBack:()=>calls.push('settings'),onHome:()=>calls.push('home')}):React.createElement(components.default,{onBack:()=>calls.push('home'),onSelect:id=>calls.push(id)});
 const html=renderToStaticMarkup(element);
 return{nodes,effects,timings,calls,setters,back,html};
}
test('sei opzioni nell’ordine richiesto, selezionabili, con ritorno Home e nessuna barra',()=>{
 const r=renderSettings(),buttons=r.nodes.filter(n=>n.name==='Pressable');
 assert.deepEqual(Array.from(options.SETTINGS_OPTIONS,x=>x.label),['ASPETTO E COLORI','ACCESSO BIOMETRICO','LOGOUT','ELIMINA ACCOUNT','LEGALE E ASSISTENZA','AIUTACI A MIGLIORARE']);
 assert.deepEqual(buttons.slice(1).map(x=>x.accessibilityLabel),Array.from(options.SETTINGS_OPTIONS,x=>x.label));
 for(const option of options.SETTINGS_OPTIONS)buttons.find(n=>n.accessibilityLabel===option.label).onPress();
 buttons.find(n=>n.accessibilityLabel==='Torna alla Home').onPress();
 assert.deepEqual(r.calls,[...Array.from(options.SETTINGS_OPTIONS,x=>x.id),'home']);
 assert.ok(r.html.includes('DEMO'));assert.ok(!r.nodes.some(n=>n.accessibilityRole==='tab'));
});
test('dettagli DEMO con ritorni a Impostazioni/Home e back Android',()=>{
 for(const option of options.SETTINGS_OPTIONS){
  const r=renderSettings({detail:option.id});assert.ok(r.html.includes('SCHERMATA DEMO'));assert.ok(r.html.includes(option.label));
  for(const label of ['Torna a Impostazioni','Torna alla Home'])r.nodes.find(n=>n.accessibilityLabel===label).onPress();
  assert.deepEqual(r.calls,['settings','home']);
  r.effects.forEach(f=>f());assert.equal(r.back[0](),true);assert.equal(r.calls.at(-1),'settings');
 }
});
test('logout ed eliminazione: conferma soltanto dimostrativa, annullabile, senza successo simulato',()=>{
 for(const detail of ['logout','delete-account']){
  const r=renderSettings({detail});r.nodes.find(n=>n.accessibilityLabel==='Mostra conferma DEMO').onPress();
  assert.deepEqual(r.setters,[true]);assert.deepEqual(r.calls,[]);
  const confirmed=renderSettings({detail,confirmation:true});
  assert.ok(confirmed.html.includes('Conferma dimostrativa'));assert.ok(confirmed.html.includes('non è disponibile'));
  confirmed.nodes.find(n=>n.accessibilityLabel==='Annulla conferma DEMO').onPress();assert.deepEqual(confirmed.setters,[false]);assert.deepEqual(confirmed.calls,[]);
  assert.equal(confirmed.nodes.filter(n=>n.name==='Pressable').length,3);
 }
 assert.ok(renderSettings({detail:'delete-account'}).html.includes('definitiva'));
});
test('lampo di 260 ms sul driver nativo, senza attesa; Reduce Motion e background lo disattivano',()=>{
 for(const config of [{},{reduced:true},{active:false}]){
  const r=renderSettings(config),button=r.nodes.find(n=>n.accessibilityLabel==='ACCESSO BIOMETRICO');
  button.onPressIn();button.onPress();assert.deepEqual(r.calls,['biometrics']);
  assert.equal(r.timings.length,config.reduced||config.active===false?0:1);
  for(const animation of r.timings){assert.equal(animation.duration,260);assert.equal(animation.useNativeDriver,true);assert.equal(animation.isInteraction,false);}
 }
});
test('dimensioni iPhone: sei righe senza scroll stimato con testo standard; fallback accessibile',()=>{
 for(const [width,height,top,bottom] of [[320,568,20,0],[375,667,20,0],[375,812,44,34],[390,844,47,34],[393,852,59,34],[430,932,59,34]]){
  const g=options.settingsLayout(width,height,top,bottom,1);
  assert.ok(g.rowHeight>=60);assert.ok(g.estimatedHeight<=g.availableHeight+1e-8);assert.ok(!g.needsScroll);
  const r=renderSettings({viewport:{width,height,fontScale:1}});
  for(const node of r.nodes.filter(n=>n.name==='Pressable'&&n.accessibilityHint)){
   const styles=node.style({pressed:false});assert.ok(styles[1].minHeight>=60);
  }
 }
 for(const [w,h,font] of [[320,568,2],[844,390,1],[320,480,1],[393,852,3]]){
  const g=options.settingsLayout(w,h,20,20,font);assert.ok(g.needsScroll);
  const r=renderSettings({viewport:{width:w,height:h,fontScale:font}});
  assert.ok(r.nodes.some(n=>n.name==='ScrollView'&&n.scrollEnabled!==false));
  assert.ok(!r.nodes.some(n=>n.name==='Text'&&n.numberOfLines));
 }
});

test('anteprima: Home → Impostazioni → ogni dettaglio → Impostazioni/Home senza importare servizi',()=>{
 const state=[],captured={};let cursor=0;
 const react={...React,useReducer:(reducer,arg,init)=>[init(arg),()=>{}],useState:initial=>{const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return[state[i],v=>state[i]=typeof v==='function'?v(state[i]):v];}};
 const capture=name=>props=>{captured[name]=props;return React.createElement('div',null,name);};
 const home=capture('home'),social=capture('settings'),detail=capture('settingsDetail');
 const demo=load('HomeDemo.tsx',{
  react,'react-native':{Platform:{OS:'web'},Alert:{alert(){throw Error('unexpected Alert');}},StatusBar:()=>null},
  'react-native-safe-area-context':{SafeAreaProvider:({children})=>React.createElement('div',null,children)},
  './CalendarScreen':capture('calendar'),'./calendarModel':load('calendarModel.ts'),
  './SettingsScreen':{__esModule:true,default:social,SettingsDemoDetail:detail},
  '../HomeScreen':home,'./SocialScreen':{__esModule:true,default:capture('social'),SocialDemoDetail:capture('socialDetail')},
  './DemoDialog':()=>null,'./demoData':{creaDatiDemo:()=>({profilo:{nome:'DEMO'}})},
  '../temi':{PALETTE_ORIGINALE:{background:'#03081B'},PRESET_TEMI:[{id:'originale'}],paletteHomeDaPreferenza:preference=>preference,rapportoContrasto:()=>10,ripristinaAspetto:()=>({version:1,preset:'originale',background:null,accent:null})},
  './InteractiveThemePreview':capture('interactive'), './AppearanceScreen':capture('appearance'),
  './ThemeContext':{ThemeProvider:({children})=>children},
 });
 const render=()=>{cursor=0;for(const key of Object.keys(captured))delete captured[key];return renderToStaticMarkup(React.createElement(demo.default));};
 render();assert.ok(captured.home);
 for(const option of options.SETTINGS_OPTIONS){
  captured.home.onSettings();render();assert.ok(captured.settings);assert.equal(captured.home,undefined);
  captured.settings.onSelect(option.id);render();
  if(option.id==='appearance'){
   assert.ok(captured.appearance);const temporary={version:1,preset:'neon-viola',background:null,accent:null};captured.appearance.onDraft(temporary);render();captured.appearance.onPreview();render();assert.ok(captured.interactive);assert.deepEqual(captured.interactive.preference,temporary);
   captured.interactive.onBack();render();assert.ok(captured.appearance);assert.deepEqual(captured.appearance.draft,temporary);
   captured.appearance.onBack();render();assert.ok(captured.settings);
  } else {
   assert.equal(captured.settingsDetail.optionId,option.id);captured.settingsDetail.onBack();render();assert.ok(captured.settings);
  }
  captured.settings.onBack();render();assert.ok(captured.home);
 }
 captured.home.onSocial();render();assert.ok(captured.social);captured.social.onBack();render();assert.ok(captured.home);
});

test('il tema provvisorio resta globale passando da Impostazioni a Home, Social e Agenda',()=>{
 const state=[],captured={};let cursor=0,providerPreference=null;
 const react={...React,useReducer:(reducer,arg,init)=>[init(arg),()=>{}],useState:initial=>{const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return[state[i],v=>state[i]=typeof v==='function'?v(state[i]):v];}};
 const capture=name=>props=>{captured[name]=props;return React.createElement('div',null,name);};
 const demo=load('HomeDemo.tsx',{
  react,'react-native':{Platform:{OS:'web'},Alert:{alert(){}},StatusBar:()=>null},
  'react-native-safe-area-context':{SafeAreaProvider:({children})=>React.createElement('div',null,children)},
  './CalendarScreen':capture('calendar'),'./calendarModel':load('calendarModel.ts'),
  './SettingsScreen':{__esModule:true,default:capture('settings'),SettingsDemoDetail:capture('settingsDetail')},
  '../HomeScreen':capture('home'),'./SocialScreen':{__esModule:true,default:capture('social'),SocialDemoDetail:capture('socialDetail')},
  './DemoDialog':()=>null,'./demoData':{creaDatiDemo:()=>({profilo:{nome:'DEMO'}})},
  '../temi':{PALETTE_ORIGINALE:{background:'#03081B'},paletteHomeDaPreferenza:p=>p,rapportoContrasto:()=>10,ripristinaAspetto:()=>({version:1,preset:'originale',background:null,accent:null})},
  './InteractiveThemePreview':capture('interactive'), './AppearanceScreen':capture('appearance'),
  './ThemeContext':{ThemeProvider:({preference,children})=>{providerPreference=preference;return children;}},
 });
 const render=()=>{cursor=0;for(const key of Object.keys(captured))delete captured[key];renderToStaticMarkup(React.createElement(demo.default));};
 render();captured.home.onSettings();render();captured.settings.onSelect('appearance');render();
 const temporary={version:1,preset:'natale',background:null,accent:null};captured.appearance.onDraft(temporary);render();
 assert.deepEqual(JSON.parse(JSON.stringify(providerPreference)),temporary,'il provider riceve la bozza in Impostazioni');
 captured.appearance.onSave();render();captured.appearance.onPreview();render();
 assert.deepEqual(JSON.parse(JSON.stringify(providerPreference)),temporary);assert.deepEqual(captured.interactive.preference,temporary);
 captured.interactive.onBack();render();captured.appearance.onBack();render();captured.settings.onBack();render();captured.home.onSocial();render();assert.deepEqual(JSON.parse(JSON.stringify(providerPreference)),temporary);assert.ok(captured.social);
 captured.social.onBack();render();captured.home.onCalendar();render();
 assert.deepEqual(JSON.parse(JSON.stringify(providerPreference)),temporary);assert.ok(captured.calendar);
 captured.calendar.onBack();render();assert.deepEqual(JSON.parse(JSON.stringify(providerPreference)),temporary);assert.ok(captured.home);
});
