const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),React=require('react'),ts=require('typescript');
const {renderToStaticMarkup}=require('react-dom/server');
function load(file,imports={},globals={}){const env={exports:{},require:key=>{assert.ok(key in imports,`Import non simulato: ${key}`);return imports[key]},...globals};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,env,{filename:file});return env.exports;}
const themes=load('temi.js'),model=load('themeDecorationsModel.js',{'./temi':themes});
const pref=id=>({version:1,preset:id,background:null,accent:null});
function hooks(){const slots=[],effects=new Map(),cleanups=new Map();let cursor=0,pending=[];const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));const react={...React,useState:initial=>{const i=cursor++;if(!(i in slots)){slots[i]=typeof initial==='function'?initial():initial;if(slots[i]?.width===0&&slots[i]?.height===0)slots[i]={width:340,height:350}}return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef:initial=>{const i=cursor++;return slots[i]||(slots[i]={current:initial})},useMemo:(fn,deps)=>{const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={deps,value:fn()};return slots[i].value},useEffect:(fn,deps)=>{const i=cursor++;if(!effects.has(i)||!same(effects.get(i),deps)){effects.set(i,deps);pending.push(()=>{cleanups.get(i)?.();cleanups.set(i,fn())})}}};react.useCallback=(fn,deps)=>react.useMemo(()=>fn,deps);return{react,start(){cursor=0;pending=[]},effects(){const p=pending;pending=[];p.forEach(fn=>fn())},cleanup(){for(const fn of cleanups.values())fn?.();cleanups.clear()},slots};}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
function nativeHarness({width=390,height=844,insets={top:44,bottom:34,left:0,right:0},os='ios'}={}){
 const nodes=[],loops=[],values=[],listeners=new Map(),timers=new Map(),writes=[];let next=0,raw='0',failRead=false,failWrite=false,delayed=null;
 const flat=style=>Object.assign({},...(Array.isArray(style)?style.flat(Infinity):[style]).filter(Boolean));
 function css(style){const s={...flat(style)};if(Array.isArray(s.transform))s.transform=s.transform.map(t=>Object.entries(t).map(([k,v])=>`${k}(${typeof v==='number'?(k==='scale'?v:v+'px'):v})`).join(' ')).join(' ');for(const k of ['shadowOffset','shadowColor','shadowOpacity','shadowRadius','elevation','resizeMode','aspectRatio'])delete s[k];return s;}
 const host=tag=>({children,...props})=>{if(tag==='Modal'&&!props.visible)return null;const style=typeof props.style==='function'?props.style({pressed:false}):props.style;nodes.push({tag,children,...props,flatStyle:flat(style)});const htmlTag=tag==='Text'?'span':'div';return React.createElement(htmlTag,{'data-testid':props.testID,'data-native':tag,'aria-label':props.accessibilityLabel,style:{...(htmlTag==='div'?{display:'flex',flexDirection:'column'}:{}),...css(style)}},children)};
 const svg={__esModule:true};for(const name of ['Svg','Circle','Ellipse','G','Path','Rect','Defs','LinearGradient','RadialGradient','Stop','Line','Polygon']){const Component=({children,testID,accessible,accessibilityLabel,...props})=>{nodes.push({tag:name,...props,testID});return React.createElement(name==='Svg'?'svg':name==='LinearGradient'?'linearGradient':name==='RadialGradient'?'radialGradient':name.toLowerCase(),{...(name==='Svg'?{xmlns:'http://www.w3.org/2000/svg'}:{}),...props},children)};svg[name]=Component;if(name==='Svg')svg.default=Component;}
 function add(kind,event,fn){const key=++next;listeners.set(key,{kind,event,fn});return{remove:()=>listeners.delete(key)}}
 class Value{constructor(initial){this.value=initial;values.push(this)}setValue(v){this.value=v}stopAnimation(){}interpolate({inputRange,outputRange}){let i=0;while(i<inputRange.length-2&&this.value>inputRange[i+1])i++;const a=outputRange[i],b=outputRange[i+1],t=(this.value-inputRange[i])/(inputRange[i+1]-inputRange[i]);if(typeof a==='number')return a+(b-a)*t;return a.endsWith('deg')?`${parseFloat(a)+(parseFloat(b)-parseFloat(a))*t}deg`:a;}}
 const native={...Object.fromEntries(['View','Text','Pressable','SafeAreaView','Modal','ScrollView','TouchableOpacity','Switch','Image'].map(n=>[n,host(n)])),StyleSheet:{create:x=>x,flatten:flat,absoluteFill:{position:'absolute',top:0,right:0,bottom:0,left:0}},useWindowDimensions:()=>({width,height,fontScale:1}),Platform:{OS:os},Easing:{linear:x=>x},Animated:{Value,View:host('AnimatedView'),timing:(value,config)=>({value,config,start(){}}),loop:animation=>{const loop={animation,running:false,start(){this.running=true},stop(){this.running=false}};loops.push(loop);return loop}},
  AccessibilityInfo:{addEventListener:(event,fn)=>add('a11y',event,fn),isReduceMotionEnabled:async()=>false,setAccessibilityFocus(){}},AppState:{currentState:'active',addEventListener:(event,fn)=>add('app',event,fn)},Keyboard:{addListener:(event,fn)=>add('keyboard',event,fn)},Linking:{openURL:()=>{throw Error('URL non autorizzato')}},findNodeHandle:()=>null};
 const storage={getItem:async key=>{assert.equal(key,model.ENERGY_KEY);if(failRead)throw Error('read');return delayed?await delayed:raw},setItem:async(key,value)=>{assert.equal(key,model.ENERGY_KEY);if(failWrite)throw Error('write');writes.push([key,value]);raw=value}};
 const safe={'SafeAreaProvider':host('SafeAreaProvider'),'SafeAreaView':host('SafeAreaView'),useSafeAreaInsets:()=>insets};
 const globals={setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id),setInterval:(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id},clearInterval:id=>timers.delete(id)};
 return{nodes,host,native,svg,safe,storage,globals,loops,values,listeners,timers,writes,failRead(){failRead=true},failWrite(){failWrite=true},delay(p){delayed=p},get raw(){return raw},emit(kind,event,value){if(kind==='app')native.AppState.currentState=value;for(const listener of [...listeners.values()])if(listener.kind===kind&&listener.event===event)listener.fn(value)},expire(){for(const [id,t]of [...timers]){timers.delete(id);t.fn()}},running(){return loops.filter(l=>l.running).length}};
}
function modules(h,n,{stubScene=false}={}){const glyph=load('ThemeGlyphs.tsx',{react:h.react,'react-native-svg':n.svg});const scene=load('ThemeScene.tsx',{react:h.react,'react-native':n.native,'./ThemeGlyphs':glyph,'./themeDecorationsModel':model});const rendered=[];const target=stubScene?{__esModule:true,default:props=>{rendered.push(props);return React.createElement('span',{'data-scene':props.themeId})}}:scene;
 const effects=load('ThemeEffects.tsx',{react:h.react,'react-native':n.native,'react-native-safe-area-context':n.safe,'@react-native-async-storage/async-storage':n.storage,'./temi':themes,'./themeDecorationsModel':model,'./ThemeScene':target},n.globals);return{effects,scene,glyph,rendered};}
function sceneHarness(id,options={}){const h=hooks(),n=nativeHarness(options),m=modules(h,n);let props={themeId:id,width:options.width||390,height:options.immersive?700:54,animated:options.animated??true,immersive:options.immersive??false,secondary:themes.selezionaPreset(id).secondary,background:themes.selezionaPreset(id).background},html;
 const draw=()=>{h.start();n.nodes.length=0;html=renderToStaticMarkup(React.createElement(m.scene.default,props));h.effects();return html};draw();return{h,n,draw,get html(){return html},set(next){props={...props,...next};return draw()}};}
const expected={natale:['theme-art-christmas-tree','theme-art-christmas-lights','theme-art-christmas-star','theme-snowflake'],halloween:['theme-bat','theme-art-halloween-pumpkin','theme-art-halloween-web','theme-art-halloween-ghost','theme-art-halloween-glow'],cartoon:['theme-art-cartoon-rainbow','theme-art-cartoon-castle','theme-art-cartoon-cloud','theme-art-cartoon-stars'],militare:['theme-art-military-camo','theme-art-military-compass','theme-art-military-topography'],galaxy:['theme-art-galaxy-stars','theme-art-galaxy-planet','theme-art-galaxy-nebula'],cyberpunk:['theme-art-cyberpunk-circuit','theme-art-cyberpunk-traces','theme-art-cyberpunk-scan'],inverno:['theme-art-winter-frost','theme-art-winter-crystal','theme-winter-particle'],'gold-special':['theme-art-gold-filigree','theme-art-gold-medallion','theme-art-gold-shimmer','theme-art-gold-sparkles']};
for(const id of Object.keys(expected))test(`rendering anteprima reale: ${id}, SVG e identità riconoscibile`,()=>{
 const h=hooks(),n=nativeHarness(),m=modules(h,n);h.start();const html=renderToStaticMarkup(React.createElement(m.effects.ThemeEffectsPreview,{preference:pref(id)},React.createElement(n.native.Pressable,{testID:'operational-button'},'Pulsante operativo')));h.effects();
 for(const marker of expected[id])assert.ok(html.includes(`data-testid="${marker}"`),marker);assert.match(html,/<svg/);assert.ok(n.nodes.filter(x=>['Path','Circle','Ellipse','Rect'].includes(x.tag)).length>=3);
 const band=n.nodes.find(x=>x.testID==='theme-decorative-band'),content=n.nodes.find(x=>x.testID==='theme-operational-content');assert.equal(band.flatStyle.height,98);assert.equal(band.flatStyle.overflow,'hidden');assert.equal(band.pointerEvents,'none');assert.notEqual(content.flatStyle.position,'absolute');assert.ok(html.indexOf('theme-decorative-band')<html.indexOf('operational-button'));
 assert.equal(n.nodes.filter(x=>x.testID==='theme-decoration-scene').length,1);assert.equal(n.running(),0,'anteprima isolata senza policy attiva resta statica');h.cleanup();
});
test('un solo ciclo condiviso: fotogrammi diversi, neve discendente, driver nativo e cleanup',()=>{
 const r=sceneHarness('natale');assert.equal(r.n.running(),1);assert.equal(r.n.loops[0].animation.config.duration,20000);assert.equal(r.n.loops[0].animation.config.useNativeDriver,true);assert.equal(r.n.loops[0].animation.config.isInteraction,false);
 r.n.values[0].value=.1;r.draw();const first=r.n.nodes.find(n=>n.testID==='theme-snowflake').flatStyle.transform[0].translateY;
 r.n.values[0].value=.2;r.draw();assert.ok(r.n.nodes.find(n=>n.testID==='theme-snowflake').flatStyle.transform[0].translateY>first);assert.equal(r.n.running(),1);
 r.set({animated:false});assert.equal(r.n.running(),0);for(const id of Object.keys(expected)){r.set({themeId:id,animated:true});assert.equal(r.n.running(),id==='militare'?0:1)}r.h.cleanup();assert.equal(r.n.running(),0);
});
test('decorazioni statiche con Reduce Motion o energia: tutti i disegni restano renderizzati',()=>{
 for(const id of Object.keys(expected)){const r=sceneHarness(id,{animated:false});assert.equal(r.n.running(),0);for(const marker of expected[id])assert.ok(r.html.includes(`data-testid="${marker}"`));r.h.cleanup()}
 for(const stop of [{ready:false},{reduced:true},{foreground:false},{energy:true},{interacting:true}])assert.equal(model.motionPermitted({ready:true,reduced:false,foreground:true,energy:false,interacting:false,...stop}),false);
});
function providerHarness(options={}){const h=hooks(),n=nativeHarness(options),m=modules(h,n,{stubScene:true});let page={preference:pref('natale'),screen:'home',operational:true},policy,html;
 function Page(){m.effects.useThemeDecorationPage(page.preference,page.screen,page.operational);policy=m.effects.useThemeEffects();return React.createElement('span',null,'Contenuto')}
 const child=React.createElement(Page);const draw=()=>{h.start();n.nodes.length=0;m.rendered.length=0;html=renderToStaticMarkup(React.createElement(m.effects.ThemeEffectsProvider,null,child));h.effects();return html};draw();
 return{h,n,m,draw,get html(){return html},get policy(){return policy},get page(){return page},setPage(next){page={...page,...next};draw();draw()},async ready(){await flush();draw();draw()}};
}
test('provider globale: persistenza del preset, cambio schermata e rimozione con tema standard senza cambiare il figlio',async()=>{
 const r=providerHarness();await r.ready();assert.equal(r.m.rendered[0].themeId,'natale');assert.equal(r.m.rendered[0].animated,false,'fascia Home statica: anima solo lo sfondo');
 for(const screen of model.DECORATED_SCREENS){r.setPage({screen});assert.equal(r.m.rendered.length,1);assert.equal(r.m.rendered[0].themeId,'natale')}
 for(const screen of ['importaTurni','login','unknown']){r.setPage({screen});assert.equal(r.m.rendered.length,0);assert.equal(r.n.nodes.find(n=>n.testID==='theme-decorative-band').flatStyle.height,0)}
 r.setPage({screen:'home',operational:false});assert.equal(r.m.rendered.length,0);r.setPage({operational:true,preference:pref('originale')});assert.equal(r.m.rendered.length,0);
 r.setPage({preference:pref('galaxy')});assert.equal(r.m.rendered[0].themeId,'galaxy');assert.equal(r.n.writes.length,0);r.h.cleanup();assert.equal(r.n.listeners.size,0);
});
test('policy: Reduce Motion, background, tastiera e risparmio Home sospendono subito il movimento',async()=>{
 const r=providerHarness();await r.ready();assert.ok(r.policy.motion);
 r.n.emit('a11y','reduceMotionChanged',true);r.draw();assert.equal(r.m.rendered[0].animated,false);
 r.n.emit('a11y','reduceMotionChanged',false);r.draw();assert.ok(r.policy.motion);
 r.n.emit('app','change','background');r.draw();assert.equal(r.policy.motion,false);r.n.emit('app','change','active');await r.ready();assert.ok(r.policy.motion);
 r.n.emit('keyboard','keyboardDidShow',{});r.draw();assert.equal(r.policy.motion,false);r.n.emit('keyboard','keyboardDidHide',{});r.draw();assert.ok(r.policy.motion);
 themes.notificaRisparmioHome(true);r.draw();assert.equal(r.policy.motion,false);assert.equal(r.policy.energy,true);assert.equal(r.n.writes.length,0);r.h.cleanup();
});
test('gesti non intercettati: pausa durante il tocco e un solo timer di ripresa, rimosso allo smontaggio',async()=>{
 const r=providerHarness();await r.ready();let content=r.n.nodes.find(n=>n.testID==='theme-operational-content');assert.equal(content.onStartShouldSetResponder,undefined);assert.equal(content.onMoveShouldSetResponder,undefined);
 content.onTouchStart();r.draw();assert.equal(r.policy.motion,false);content=r.n.nodes.find(n=>n.testID==='theme-operational-content');content.onTouchEnd({nativeEvent:{touches:[]}});content.onTouchEnd({nativeEvent:{touches:[]}});assert.equal(r.n.timers.size,1);r.n.expire();r.draw();assert.ok(r.policy.motion);
 content.onTouchStart();content.onTouchEnd();assert.equal(r.n.timers.size,1);r.h.cleanup();assert.equal(r.n.timers.size,0);assert.equal(r.n.listeners.size,0);
});
test('risparmio energia usa solo la chiave già esistente; errore I/O non dichiara successo',async()=>{
 const r=providerHarness();await r.ready();assert.equal(await r.policy.setEnergy(true),true);r.draw();assert.equal(r.policy.energy,true);assert.deepEqual(r.n.writes,[[model.ENERGY_KEY,'1']]);r.n.failWrite();assert.equal(await r.policy.setEnergy(false),false);r.draw();assert.equal(r.policy.energy,true);assert.equal(r.n.writes.length,1);r.h.cleanup();
 const fail=providerHarness();fail.n.failRead();await fail.ready();fail.n.emit('app','change','active');await fail.ready();assert.equal(fail.policy.energy,true);assert.equal(fail.policy.motion,false);fail.h.cleanup();
});
test('durante la preview non parte una seconda animazione dietro la modale',async()=>{
 const r=providerHarness();await r.ready();assert.equal(r.m.rendered.length,1);r.policy.setPreview(true);r.draw();assert.equal(r.m.rendered.length,0);assert.equal(r.n.nodes.find(n=>n.testID==='theme-decorative-band').flatStyle.height,98);r.policy.setPreview(false);r.draw();assert.equal(r.m.rendered.length,1);r.h.cleanup();
});
test('safe area, notch e layout: disegni confinati alla fascia, senza coprire testo o controlli',()=>{
 for(const width of [240,320,390,844])for(const id of Object.keys(expected))for(const height of [44,54]){
  for(const m of model.layoutMotifs(id,width,height).filter(m=>!m.background)){assert.ok(m.x>=0&&m.y>=0);assert.ok(m.x+m.drawWidth<=width);assert.ok(m.y+m.drawHeight<=height)}
 }
 const h=hooks(),n=nativeHarness({width:844,height:390,insets:{top:0,bottom:21,left:44,right:44}}),m=modules(h,n);h.start();renderToStaticMarkup(React.createElement(m.effects.ThemeEffectsPreview,{preference:pref('halloween')},'test'));h.effects();const scene=n.nodes.find(n=>n.testID==='theme-decoration-scene');assert.equal(scene.flatStyle.width,756);assert.equal(scene.flatStyle.height,44);h.cleanup();
});
test('riavvio simulato e contrasto: preferenze v1 invariate, nessuna decorazione sotto il contenuto',async()=>{
 for(const id of Object.keys(expected)){
  const value={...pref(id),background:'#FFFFFF'},raw=JSON.stringify(value);let writes=0;
  const archive=load('preferenzeAspetto.js',{'./temi':themes,'@react-native-async-storage/async-storage':{}}).creaArchivioAspetto({getItem:async()=>raw,setItem:async()=>writes++});
  const loaded=await archive.carica();assert.equal(model.specialTheme(loaded.preferenza).id,id);assert.equal(writes,0);const p=themes.generaPalette(loaded.preferenza);assert.ok(themes.rapportoContrasto(p.text,p.background)>=4.5);
 }
 assert.equal(model.specialTheme(pref('originale')),null);
});
test('cablaggio reale: un provider dopo il guard offline, sola lettura della preferenza, preview e campione condivisi',()=>{
 const index=fs.readFileSync('index.js','utf8'),app=fs.readFileSync('App.js','utf8'),editor=fs.readFileSync('AspettoColoriScreen.js','utf8');assert.ok(index.indexOf("require('./ThemeEffects')")>index.indexOf('installOfflineNetworkGuard();'));assert.equal((index.match(/<ThemeEffectsProvider>/g)||[]).length,1);assert.match(app,/useThemeDecorationPage\(preferenzaAspetto, screen,/);assert.match(editor,/<ThemeEffectsPreview preference=\{stato.draft\}/);
 assert.match(fs.readFileSync('AppearanceScreen.tsx','utf8'),/<ThemeEffectsSample preference=\{draft\}/);for(const file of ['ThemeEffects.tsx','ThemeScene.tsx','ThemeGlyphs.tsx','themeDecorationsModel.js'])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/supabase|fetch\(|pushNotifications|watch-connectivity|setInterval\(/);
});
if(process.env.VIGILANZA_THEME_PREVIEW_DIR){
 test('artefatto di rendering: otto anteprime con la Home reale, dati simulati e comandi disabilitati',()=>{
  const directory=process.env.VIGILANZA_THEME_PREVIEW_DIR;fs.mkdirSync(directory,{recursive:true});const cards=[];
  for(const id of Object.keys(expected)){
   const h=hooks(),n=nativeHarness(),m=modules(h,n);
   Object.assign(n.native.Animated,{createAnimatedComponent:component=>component,sequence:animations=>({start(){},stop(){}}),parallel:animations=>({start(){},stop(){}}),delay:()=>({}),spring:()=>({start(){}})});
   const common={react:h.react,'react-native':n.native,'react-native-safe-area-context':n.safe,'react-native-svg':n.svg,'@expo/vector-icons':{Ionicons:({name,color,size})=>React.createElement('span',{'data-icon':name,style:{color,fontSize:size}},'◇')},'@react-native-async-storage/async-storage':n.storage,'./temi':themes,'./homeModel':load('homeModel.js'),'./homeElectric':load('homeElectric.js')};
   common['./HomeArtwork']=load('HomeArtwork.js',common,n.globals);common['./ElectricConnections']=load('ElectricConnections.js',common,n.globals);
   const Home=load('HomeScreen.js',common,n.globals).default,preference=pref(id),palette=themes.paletteHomeDaPreferenza(preference),noop=()=>{};
   const home=React.createElement(n.native.View,{pointerEvents:'none',accessibilityElementsHidden:true,importantForAccessibility:'no-hide-descendants',style:{flex:1}},React.createElement(Home,{paletteHome:palette,profilo:{nome:'Anteprima'},fotoProfilo:null,numeroNotifiche:0,turni:[],ore:'128h',extra:'22h',notti:3,periodo:'OTTOBRE 2026',onProfile:noop,onNotifications:noop,onSocial:noop,onSettings:noop,onCalendar:noop,onNavigate:noop,onColleghi:noop,onAddShift:noop,etaServizio:null,etaServizioLoading:false,etaTurno:null}));
   h.start();const html=renderToStaticMarkup(React.createElement(m.effects.ThemeEffectsPreview,{preference},home));h.effects();
   for(const marker of expected[id])assert.ok(html.includes(`data-testid="${marker}"`));assert.match(html,/theme-preview-frame/);assert.ok(n.nodes.some(n=>n.testID==='home-core-frame'));assert.equal(n.writes.length,0);
   fs.writeFileSync(directory+'/'+id+'.html','<!doctype html><meta charset="utf-8"><title>Anteprima '+id+'</title><style>body{margin:0;font-family:system-ui}#preview{width:390px;height:844px;display:flex;flex-direction:column}</style><div id="preview">'+html+'</div>');
   cards.push('<section><h2>'+themes.selezionaPreset(id).nome+'</h2><div class="phone">'+html+'</div></section>');h.cleanup();assert.equal(n.running(),0);assert.equal(n.timers.size,0);
  }
  fs.writeFileSync(directory+'/index.html','<!doctype html><meta charset="utf-8"><title>Temi speciali — verifica rendering</title><style>body{margin:24px;background:#121820;color:#fff;font-family:system-ui}main{display:grid;grid-template-columns:repeat(auto-fit,390px);gap:24px}.phone{height:844px;width:390px;display:flex;flex-direction:column;border:1px solid #536477;border-radius:20px;overflow:hidden}h2{font-size:18px}</style><h1>Anteprime dei temi speciali</h1><p>Componenti reali, dati simulati. Fotogrammi statici; gli effetti sono verificati separatamente con driver simulato.</p><main>'+cards.join('')+'</main>');
 });
}

test('anteprima animata completa: fotogrammi reali diversi con policy attiva, un solo ciclo anche su Android',async()=>{
 for(const id of Object.keys(expected)){
  const h=hooks(),n=nativeHarness({os:'android'}),m=modules(h,n);
  function Preview(){m.effects.useThemeDecorationPage(preference,'aspettoColori',true);const policy=m.effects.useThemeEffects();h.react.useEffect(()=>{policy.setPreview(true);return()=>policy.setPreview(false)},[policy.setPreview]);return React.createElement(m.effects.ThemeEffectsPreview,{preference},React.createElement(m.scene.default,{themeId:id,width:390,height:700,animated:policy.motion,secondary:themes.selezionaPreset(id).secondary,background:themes.selezionaPreset(id).background,immersive:true}))}
  const preference=pref(id),child=React.createElement(Preview);
  const draw=()=>{h.start();n.nodes.length=0;renderToStaticMarkup(React.createElement(m.effects.ThemeEffectsProvider,null,child));h.effects()};
  draw();await flush();draw();assert.equal(n.running(),1,id);assert.equal(n.nodes.filter(v=>v.testID==='theme-decoration-scene').length,2);
  for(const marker of expected[id])assert.ok(n.nodes.some(v=>v.testID===marker),marker);
  const loop=n.loops.find(loop=>loop.running);
  if(loop){assert.equal(loop.animation.config.useNativeDriver,true);loop.animation.value.value=.1;draw();const first=JSON.stringify(n.nodes.filter(v=>v.tag==='AnimatedView').map(v=>v.flatStyle));loop.animation.value.value=.2;draw();const next=JSON.stringify(n.nodes.filter(v=>v.tag==='AnimatedView').map(v=>v.flatStyle));assert.notEqual(next,first,id)}
  h.cleanup();assert.equal(n.running(),0);assert.equal(n.listeners.size,0);assert.equal(n.timers.size,0);
 }
});

test('sfondo scenografico: tutti gli otto temi, limite finito di livelli e dimensioni reali',()=>{
 for(const id of Object.keys(expected))for(const width of [320,390,820]) {
  const motifs=model.layoutScenery(id,width,700);assert.ok(motifs.length>0&&motifs.length<=20);assert.ok(motifs.some(m=>m.y>100));
  const r=sceneHarness(id,{width,immersive:true});assert.equal(r.n.running(),1,id);
  const start=r.html;r.n.values[0].value=.7;r.draw();assert.notEqual(r.html,start,id);
  r.set({animated:false});assert.equal(r.n.running(),0);assert.match(r.html,/<svg/);r.h.cleanup();assert.equal(r.n.running(),0);
 }
 assert.ok(model.layoutScenery('natale',390,700).filter(m=>m.motion==='snow').length>=12);
 assert.ok(model.layoutScenery('halloween',390,700).some(m=>m.motion==='fly'));
 assert.ok(model.layoutScenery('militare',390,700).some(m=>m.motion==='radar'));
 assert.ok(model.layoutScenery('cartoon',390,700).some(m=>m.motion==='cloud'));
});
test('Home scenery: usa misure onLayout, policy condivisa e nessun target operativo',async()=>{
 const h=hooks(),n=nativeHarness(),m=modules(h,n);let last,policy={motion:true};
 const scenery=load('ThemeScenery.tsx',{react:h.react,'react-native':n.native,'./temi':themes,'./themeDecorationsModel':model,'./ThemeEffects':{useThemeEffects:()=>policy},'./ThemeScene':{__esModule:true,default:p=>{last=p;return React.createElement('span',null,p.themeId)}}});
 let preference=pref('natale');const draw=()=>{h.start();n.nodes.length=0;last=null;renderToStaticMarkup(React.createElement(scenery.default,{preference}));h.effects()};draw();
 const node=n.nodes.find(n=>n.testID==='theme-home-scenery');assert.equal(node.pointerEvents,'none');assert.equal(node.flatStyle.position,'absolute');node.onLayout({nativeEvent:{layout:{width:390,height:744}}});draw();assert.equal(last.width,390);assert.equal(last.height,744);assert.equal(last.immersive,true);assert.equal(last.animated,true);
 policy={motion:false};draw();assert.equal(last.animated,false);preference=pref('originale');draw();assert.equal(last,null);h.cleanup();
});
