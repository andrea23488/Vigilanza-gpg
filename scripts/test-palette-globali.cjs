const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),React=require('react'),ts=require('typescript');
const {renderToStaticMarkup}=require('react-dom/server'),babel=require('@babel/core');
function load(file,imports={},globals={}){const env={exports:{},require:key=>{assert.ok(key in imports,`Import non simulato: ${key}`);return imports[key];},...globals};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,env,{filename:file});return env.exports;}
const effectsMock={useThemeEffects:()=>({ready:true,energy:true,busy:false,setPreview:()=>{},setEnergy:async()=>true}),ThemeEffectsPreview:({children})=>children,ThemeEffectsSample:()=>null};
const themes=load('temi.js'),legacy=load('temaSchermate.js',{'./temi':themes});
const persistence=load('preferenzeAspetto.js',{'./temi':themes,'@react-native-async-storage/async-storage':{}});
function storage(initial=null){let raw=initial,reads=0,writes=0,failRead=false,failWrite=false;return{get raw(){return raw},get reads(){return reads},get writes(){return writes},failRead(){failRead=true},failWrite(){failWrite=true},recover(){failRead=failWrite=false},getItem:async key=>{assert.equal(key,'@vigilanza_aspetto_dispositivo_v1');reads++;if(failRead)throw Error('read');return raw},setItem:async(key,value)=>{assert.equal(key,'@vigilanza_aspetto_dispositivo_v1');if(failWrite)throw Error('write');writes++;raw=value}};}
function hooks(){const slots=[],effects=new Map(),cleanups=new Map();let cursor=0,queue=[];const same=(a,b)=>a&&b&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));const react={...React,useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value]},useRef:initial=>{const i=cursor++;return slots[i]||(slots[i]={current:initial})},useMemo:(fn,deps)=>{const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={deps,value:fn()};return slots[i].value},useEffect:(fn,deps)=>{const i=cursor++;if(!effects.has(i)||!same(effects.get(i),deps)){effects.set(i,deps);queue.push(()=>{cleanups.get(i)?.();cleanups.set(i,fn())})}}};return{react,start(){cursor=0;queue=[]},effects(){const q=queue;queue=[];q.forEach(fn=>fn())},cleanup(){for(const fn of cleanups.values())fn?.()}};}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
function editorHarness(store=storage(),extra={}){const h=hooks(),nodes=[],published=[],alerts=[],backs=[],previews=[];let captured;
 const host=tag=>({children,...props})=>{if(tag==='Modal'&&!props.visible)return null;nodes.push({tag,children,...props});return React.createElement('div',null,children)};
 const native={...Object.fromEntries(['SafeAreaView','ScrollView','View','Text','TouchableOpacity','Modal','Pressable','ActivityIndicator'].map(n=>[n,host(n)])),StyleSheet:{create:x=>x},Alert:{alert:(...x)=>alerts.push(x)},Platform:{OS:'android'},BackHandler:{addEventListener:(_,fn)=>{backs.push(fn);return{remove(){}}}}};
 const archive=persistence.creaArchivioAspetto(store);
 const module=load('AspettoColoriScreen.js',{react:h.react,'react-native':native,'@expo/vector-icons':{Ionicons:host('Ionicons')},'./temi':themes,'./temaSchermate':legacy,'./preferenzeAspetto':{creaArchivioAspetto:()=>archive},'react-native-safe-area-context':{SafeAreaView:host('PreviewSafeAreaView')},'./ThemeEffects':effectsMock,'./AppearanceScreen':{__esModule:true,default:props=>{captured=props;return null}}});
 const props={archivio:archive,onSalvato:p=>published.push(p),onBack:()=>published.push('back'),renderAnteprima:palette=>{previews.push(palette);return React.createElement('div',null,'Home locale')},...extra};
 const render=()=>{h.start();nodes.length=0;renderToStaticMarkup(React.createElement(module.default,props));h.effects();return captured};render();
 return{render,get view(){return captured},nodes,published,alerts,backs,previews,archive,store,async ready(){await flush();render()},cleanup:h.cleanup};
}
test('primo avvio e preferenze v1: nessuna scrittura implicita, tutti i preset e override storici conservati',async()=>{
 const values=[null,...[...themes.TEMI_PREIMPOSTATI,...themes.TEMI_SPECIALI].map(p=>JSON.stringify({version:1,preset:p.id,background:null,accent:null})),JSON.stringify({version:1,preset:'lavanda',background:'#FFFFFF',accent:'#FDA4AF'})];
 for(const raw of values){const s=storage(raw),r=await persistence.creaArchivioAspetto(s).carica();assert.ok(r.ok);assert.equal(s.writes,0);assert.equal(s.raw,raw);if(raw)assert.equal(JSON.stringify(r.preferenza),raw);}
 const corrupt=storage('non-json');assert.ok((await persistence.creaArchivioAspetto(corrupt).carica()).recuperata);assert.equal(corrupt.raw,'non-json');assert.equal(corrupt.writes,0);
});
test('editor reale: selezione immediata nella bozza, salvataggio esplicito e riavvio simulato',async()=>{
 const r=editorHarness();assert.equal(r.view.disabled,true);await r.ready();assert.equal(r.view.disabled,false);
 r.view.onDraft({version:1,preset:'natale',background:null,accent:null});r.render();assert.equal(r.view.draft.preset,'natale');assert.equal(r.store.writes,0);assert.deepEqual(r.published,[]);
 await r.view.onSave();r.render();assert.equal(r.store.writes,1);assert.equal(r.published[0].preset,'natale');assert.equal(r.view.saved.preset,'natale');assert.match(r.view.message,/salvati sul dispositivo/);
 const reboot=await persistence.creaArchivioAspetto(r.store).carica();assert.equal(reboot.preferenza.preset,'natale');assert.equal(r.store.writes,1);r.cleanup();
});
test('cambio sfondo/accento e anteprima fullscreen: nessuna pubblicazione o operazione sui dati',async()=>{
 const r=editorHarness();await r.ready();r.view.onDraft({version:1,preset:'galaxy',background:'#FFFFFF',accent:'#FDA4AF'});r.render();r.view.onPreview();r.render();
 assert.equal(r.previews.length,1);assert.equal(r.previews[0].background,'#FFFFFF');assert.equal(r.previews[0].accent,'#FDA4AF');assert.equal(r.store.writes,0);assert.deepEqual(r.published,[]);
 assert.ok(r.nodes.some(n=>n.pointerEvents==='none'&&n.accessibilityElementsHidden));
 r.nodes.find(n=>n.tag==='Modal').onRequestClose();r.render();assert.equal(r.view.draft.preset,'galaxy');assert.equal(r.store.writes,0);r.cleanup();
});
test('Annulla mantiene il tema salvato; ripristino è una bozza fino a Salva',async()=>{
 const original={version:1,preset:'prugna',background:null,accent:null},s=storage(JSON.stringify(original)),r=editorHarness(s);await r.ready();
 r.view.onReset();r.render();assert.equal(r.view.draft.preset,'originale');assert.equal(JSON.parse(s.raw).preset,'prugna');r.view.onBack();assert.match(r.alerts[0][0],/non salvate/);assert.equal(s.writes,0);
 r.alerts[0][2].find(b=>b.text==='Esci senza salvare').onPress();assert.equal(r.published.at(-1),'back');assert.equal(JSON.parse(s.raw).preset,'prugna');
 await r.view.onSave();r.render();assert.equal(JSON.parse(s.raw).preset,'originale');assert.equal(themes.paletteHomeDaPreferenza(JSON.parse(s.raw)),null);r.cleanup();
});
test('errore lettura o scrittura: nessuna sovrascrittura sconosciuta e nessun falso successo',async()=>{
 const s=storage(JSON.stringify({version:1,preset:'grafite',background:null,accent:null}));s.failRead();const r=editorHarness(s);await r.ready();assert.equal(r.view.disabled,true);assert.equal(s.writes,0);assert.deepEqual(r.published,[]);r.cleanup();
 const t=editorHarness();await t.ready();t.view.onDraft({version:1,preset:'halloween',background:null,accent:null});t.render();t.store.failWrite();await t.view.onSave();t.render();assert.match(t.view.message,/non riuscito/);assert.equal(t.view.draft.preset,'halloween');assert.equal(t.store.writes,0);assert.deepEqual(t.published,[]);t.cleanup();
});
function appearanceHarness(initial=themes.ripristinaAspetto()){
 const h=hooks(),nodes=[],calls=[],backs=[];let draft=initial,saved=initial,disabled=false,html='';
 const host=tag=>({children,...p})=>{if(tag==='Modal'&&!p.visible)return null;nodes.push({tag,...p,style:typeof p.style==='function'?p.style({pressed:false}):p.style});return React.createElement('div',null,children)};
 const component=load('AppearanceScreen.tsx',{react:h.react,'react-native':{...Object.fromEntries(['Modal','Pressable','ScrollView','Text','View'].map(n=>[n,host(n)])),StyleSheet:{create:x=>x},useWindowDimensions:()=>({width:320,height:568,fontScale:1.8}),BackHandler:{addEventListener:(_,fn)=>{backs.push(fn);return{remove(){}}}}},'react-native-safe-area-context':{SafeAreaView:host('SafeAreaView'),useSafeAreaInsets:()=>({top:20,bottom:20,left:0,right:0})},'@expo/vector-icons':{Ionicons:host('Ionicons')},'./temi':themes,'./temaSchermate':legacy,'./ThemeEffects':effectsMock}).default;
 const draw=()=>{h.start();nodes.length=0;html=renderToStaticMarkup(React.createElement(component,{draft,saved,disabled,onDraft:p=>{draft=p;calls.push('draft')},onSave:()=>{saved=draft;calls.push('save')},onReset:()=>{draft=themes.ripristinaAspetto();calls.push('reset')},onPreview:()=>calls.push('preview'),onBack:()=>calls.push('back')}));h.effects()};draw();
 return{nodes,calls,backs,draw,get html(){return html},get draft(){return draft},get saved(){return saved},setDisabled(v){disabled=v;draw()},press(label){const p=nodes.find(n=>n.tag==='Pressable'&&n.accessibilityLabel===label);assert.ok(p,label);assert.ok(!p.disabled,label+' disabilitato');p.onPress()}};
}
test('grafica approvata: 12 preset e otto speciali, menu colori nominati, anteprima e nessuna demo',()=>{
 const r=appearanceHarness();assert.doesNotMatch(r.html,/DEMO|memoria della demo/);for(const p of [...themes.TEMI_PREIMPOSTATI,...themes.TEMI_SPECIALI])assert.ok(r.nodes.some(n=>n.accessibilityLabel==='Tema '+p.nome));
 r.press('Tema Cyberpunk');r.draw();assert.equal(r.draft.preset,'cyberpunk');assert.equal(r.saved.preset,'originale');r.press('ANTEPRIMA APP');assert.deepEqual(r.calls,['draft','preview']);
 r.press('SFONDO');r.draw();r.press('Bianco');r.draw();assert.equal(r.draft.background,'#FFFFFF');r.press('CERCHIO ED EVIDENZE');r.draw();assert.ok(r.nodes.some(n=>n.accessibilityLabel==='Ciano'));assert.ok(r.nodes.some(n=>n.accessibilityLabel==='Ciano brillante'));r.press('Rosa');r.draw();assert.equal(r.draft.accent,'#FDA4AF');assert.equal(r.saved.preset,'originale');r.press('Salva colori');assert.equal(r.saved.accent,'#FDA4AF');
});
test('reset UI richiede conferma e non applica il tema finché non viene salvato; back chiude il menu colori',()=>{
 const r=appearanceHarness({version:1,preset:'galaxy',background:null,accent:null});r.press('Ripristina colori originali');r.draw();assert.ok(r.nodes.some(n=>n.tag==='Modal'));r.press('Annulla ripristino');r.draw();assert.equal(r.calls.length,0);
 r.press('Ripristina colori originali');r.draw();r.press('Conferma ripristino colori');r.draw();assert.equal(r.draft.preset,'originale');assert.equal(r.saved.preset,'galaxy');assert.deepEqual(r.calls,['reset']);
 r.press('SFONDO');r.draw();r.backs.at(-1)();r.draw();assert.ok(r.nodes.some(n=>n.accessibilityLabel==='Salva colori'));r.press('Annulla modifiche');assert.equal(r.calls.at(-1),'back');
});
test('UI occupata impedisce scelte e salvataggi; testo grande resta scorrevole',()=>{
 const r=appearanceHarness();r.setDisabled(true);for(const label of ['Tema Natale','SFONDO','CERCHIO ED EVIDENZE','ANTEPRIMA APP','Salva colori','Ripristina colori originali','Annulla modifiche'])assert.equal(r.nodes.find(n=>n.accessibilityLabel===label).disabled,true,label);assert.ok(r.nodes.some(n=>n.tag==='ScrollView'));
});
test('contrasto chiaro/scuro di testo, accenti, pulsanti e colori funzionali senza alterare la preferenza',()=>{
 for(const preset of [...themes.TEMI_PREIMPOSTATI,...themes.TEMI_SPECIALI])for(const bg of [null,'#FFFFFF','#E8EDF3','#07111F']){
  const pref={version:1,preset:preset.id,background:bg,accent:'#FDA4AF'},before=JSON.stringify(pref),p=themes.generaPalette(pref);
  for(const surface of [p.background,p.surface,p.surfaceRaised]){assert.ok(themes.rapportoContrasto(p.text,surface)>=4.5);assert.ok(themes.rapportoContrasto(themes.testoTema(p,p.accent),surface)>=4.5);for(const c of ['#FF7A8A','#54E878','#FFFFFF','#61778D'])assert.ok(themes.rapportoContrasto(legacy.coloreStileTema(p,c,'color'),surface)>=4.5);}
  assert.ok(themes.rapportoContrasto(p.onAccent,p.accent)>=4.5);assert.equal(p.accent,'#FDA4AF');assert.equal(JSON.stringify(pref),before);
 }
});
test('adattamento legacy non muta stili originali, stati dei campi o colori scelti',()=>{
 const styles={safe:{backgroundColor:'#080D22'},input:{color:'white',backgroundColor:'#0B1E2D',padding:12},saveButton:{backgroundColor:'#1368E8'},saveText:{color:'white'}},before=JSON.stringify(styles);
 assert.equal(legacy.stiliConTema(styles,null),styles);
 const p=themes.generaPalette({version:1,preset:'originale',background:'#FFFFFF',accent:'#93C5FD'}),result=legacy.stiliConTema(styles,p);
 assert.equal(result.safe.backgroundColor,p.background);assert.equal(result.input.color,p.text);assert.equal(result.input.padding,12);assert.equal(result.saveButton.backgroundColor,p.accent);assert.equal(result.saveText.color,p.onAccent);assert.equal(JSON.stringify(styles),before);
});
test('App: una sola preferenza caricata senza scritture, propagata alle schermate dopo salvataggio e riavvio',async()=>{
 const source=fs.readFileSync('App.js','utf8'),start=source.indexOf('  const archivioAspettoRef'),end=source.indexOf('  const giorniSettimana',start),prefix=source.slice(start,end);
 const store=storage(JSON.stringify({version:1,preset:'natale',background:null,accent:null})),h=hooks();
 const env={...h.react,creaArchivioAspetto:()=>persistence.creaArchivioAspetto(store),ripristinaAspetto:themes.ripristinaAspetto,paletteHomeDaPreferenza:themes.paletteHomeDaPreferenza,stiliConTema:legacy.stiliConTema,styles:{},StyleSheet:{flatten:x=>x}};
 vm.createContext(env);vm.runInContext(`function root(){${prefix}return {paletteHome,setPreferenzaAspetto};}`,env);
 const render=()=>{h.start();const result=env.root();h.effects();return result};render();await flush();let state=render();assert.equal(state.paletteHome.accent,themes.selezionaPreset('natale').accent);assert.equal(store.writes,0);
 const editor=editorHarness(store,{onSalvato:p=>state.setPreferenzaAspetto(p)});await editor.ready();editor.view.onDraft({version:1,preset:'inverno',background:'#FFFFFF',accent:'#168BFF'});editor.render();await editor.view.onSave();state=render();assert.equal(state.paletteHome.background,'#FFFFFF');
 const ast=babel.parseSync(source,{babelrc:false,configFile:false,parserOpts:{plugins:['jsx']}}),traverse=require('@babel/traverse').default,found=new Set();
 traverse(ast,{JSXOpeningElement(path){const n=path.node;if(!['HomeScreen','CalendarScreen','SocialScreen','CalendarioColleghiScreen','SettingsScreen','ColleghiSocialScreen'].includes(n.name.name))return;const prop=n.attributes.find(a=>['paletteHome','palette'].includes(a.name?.name)&&a.value?.expression?.name==='paletteHome');if(prop){assert.equal(vm.runInNewContext(source.slice(prop.value.expression.start,prop.value.expression.end),{paletteHome:state.paletteHome}),state.paletteHome);found.add(n.name.name)}}});
 assert.equal(found.size,6);const reboot=await persistence.creaArchivioAspetto(store).carica();assert.equal(themes.paletteHomeDaPreferenza(reboot.preferenza).background,'#FFFFFF');editor.cleanup();h.cleanup();
});
test('nessun motore o servizio nella tavolozza; effetti delegati al sistema grafico condiviso',()=>{
 for(const file of ['AppearanceScreen.tsx','temaSchermate.js'])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/supabase|fetch\(|auth\.|inviaMessaggio|ThemeDecorations|ThemeProvider|sharedDayFixture/);
 const storageSource=fs.readFileSync('preferenzeAspetto.js','utf8');assert.match(storageSource,/@vigilanza_aspetto_dispositivo_v1/);
 const app=fs.readFileSync('App.js','utf8');assert.doesNotMatch(app,/from ['"].*homePreview|ThemeDecorations/);
});

test('interfaccia classica e nuova condividono archivio e restano leggibili su sfondo chiaro',async()=>{
 const preference={version:1,preset:'prugna',background:'#FFFFFF',accent:'#FDA4AF'},store=storage(JSON.stringify(preference)),palette=themes.paletteHomeDaPreferenza(preference);
 const r=editorHarness(store,{classica:true,paletteAttuale:palette});await r.ready();
 const flatten=style=>Object.assign({},...(Array.isArray(style)?style.flat(Infinity):[style]).filter(Boolean));
 const title=r.nodes.find(n=>n.tag==='Text'&&n.children==='Aspetto e colori');assert.ok(title);assert.ok(themes.rapportoContrasto(flatten(title.style).color,palette.background)>=4.5);
 for(const n of r.nodes.filter(n=>n.tag==='TouchableOpacity'&&n.accessibilityState?.selected!==undefined))assert.equal(flatten(n.style).backgroundColor,palette.surface);
 assert.equal(store.writes,0);const fresh=await persistence.creaArchivioAspetto(store).carica();assert.equal(fresh.preferenza.background,'#FFFFFF');r.cleanup();
});
