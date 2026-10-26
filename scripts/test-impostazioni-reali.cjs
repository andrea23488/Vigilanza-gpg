const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),{execFileSync}=require('node:child_process');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const app=fs.readFileSync('App.js','utf8');
function load(file,imports){const env={exports:{},require:key=>{assert.ok(key in imports,`Import non simulato: ${key}`);return imports[key];}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,env,{filename:file});return env.exports;}
const themes=load('temi.js',{}),legacy=load('temaSchermate.js',{'./temi':themes}),options=load('settingsOptions.ts',{});
function jsx(code){return require('@babel/core').transformSync(code,{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-react-jsx']}).code;}
function routeHarness(overrides={}){
 const calls=[];
 const env={screen:'impostazioni',paletteHome:themes.PALETTE_ORIGINALE,SettingsScreen:'SettingsScreen',SettingsDetailScreen:'SettingsDetailScreen',AspettoColoriScreen:'AspettoColoriScreen',BiometriaImpostazioni:'BiometriaImpostazioni',LegaleAssistenzaImpostazioni:'LegaleAssistenzaImpostazioni',Text:'Text',TouchableOpacity:'TouchableOpacity',
  React:{createElement:(type,props,...children)=>({type,props:{...props,children}}),Fragment:'Fragment'},
  ritornoAspetto:'profile',archivioAspettoRef:{current:{originale:true}},setPreferenzaAspetto:p=>calls.push(['palette',p]),
  biometriaAbilitata:false,cambiaBiometria:()=>calls.push('toggle-bio'),logout:()=>calls.push('logout'),eliminaAccount:()=>calls.push('delete'),coloreHome:themes.coloreHome,
  setScreen:s=>{calls.push(s);env.screen=s;},setRitornoAspetto:s=>{calls.push(['ritorno',s]);env.ritornoAspetto=s;},...overrides};
 const a=app.indexOf("  if (screen === 'impostazioni') {"),b=app.indexOf("\n  if (\n    screen ===\n    'profile'",a);assert.ok(a>0&&b>a);
 vm.createContext(env);vm.runInContext(jsx(`function render(){${app.slice(a,b)}}`),env);
 return{env,calls,render:()=>env.render()};
}
function flat(element){if(!element||typeof element!=='object')return[];return[element,...(element.props?.children||[]).flatMap(c=>Array.isArray(c)?c.flatMap(flat):flat(c))];}
function renderUI(file,exportName='default',{props={},imports={}}={}){
 const nodes=[],effects=[],backs=[],links=[],timings=[];
 const host=name=>({children,...p})=>{nodes.push({name,...p});return React.createElement('div',null,children);};
 class Value{stopAnimation(){}setValue(){}interpolate(){return 0;}}
 const native={...Object.fromEntries(['View','Text','ScrollView','Pressable','TouchableOpacity'].map(n=>[n,host(n)])),StyleSheet:{create:x=>x},useWindowDimensions:()=>({width:320,height:568,fontScale:1.6}),Animated:{Value,View:host('AnimatedView'),timing:(_,config)=>{timings.push(config);return{start(){}};}},
  AccessibilityInfo:{addEventListener:()=>({remove(){}}),isReduceMotionEnabled:()=>Promise.resolve(true)},AppState:{currentState:'active',addEventListener:()=>({remove(){}})},BackHandler:{addEventListener:(_,fn)=>{backs.push(fn);return{remove(){}};}},Linking:{openURL:async url=>links.push(url)}};
 const react={...React,useEffect:fn=>effects.push(fn),useRef:v=>({current:v}),useState:v=>[typeof v==='function'?v():v,()=>{}]};
 const module=load(file,{react,'react-native':native,'react-native-safe-area-context':{SafeAreaView:host('SafeAreaView'),useSafeAreaInsets:()=>({top:20,bottom:20,left:0,right:0})},'@expo/vector-icons':{Ionicons:host('Ionicons')},'./settingsOptions':options,'./temi':themes,'./temaSchermate':legacy,...imports});
 const html=renderToStaticMarkup(React.createElement(module[exportName],props));effects.forEach(fn=>fn());return{html,nodes,backs,links,timings};
}
test('menu reale: sei voci approvate, icone, palette e ritorno Home senza operazioni al montaggio',()=>{
 const calls=[];const r=renderUI('SettingsScreen.tsx','default',{props:{paletteHome:themes.PALETTE_ORIGINALE,onBack:()=>calls.push('home'),onSelect:id=>calls.push(id)}});
 assert.deepEqual(calls,[]);assert.doesNotMatch(r.html,/DEMO|dimostrativ|anteprima/i);
 const buttons=r.nodes.filter(n=>n.name==='Pressable');
 assert.deepEqual(buttons.filter(n=>n.accessibilityLabel!=='Torna alla Home').map(n=>n.accessibilityLabel),['ASPETTO E COLORI','ACCESSO BIOMETRICO','LOGOUT','ELIMINA ACCOUNT','LEGALE E ASSISTENZA','AIUTACI A MIGLIORARE']);
 for(const option of options.SETTINGS_OPTIONS){buttons.find(b=>b.accessibilityLabel===option.label).onPress();assert.ok(r.nodes.some(n=>n.name===option.icon&&n.color===themes.PALETTE_ORIGINALE.accent));}
 assert.deepEqual(calls,Array.from(options.SETTINGS_OPTIONS,o=>o.id));assert.equal(r.backs.at(-1)(),true);assert.equal(calls.at(-1),'home');
 const safe=r.nodes.find(n=>n.name==='SafeAreaView');assert.equal(Object.assign({},...safe.style).backgroundColor,themes.PALETTE_ORIGINALE.background);
 assert.ok(r.nodes.some(n=>n.name==='ScrollView'));
});
test('sei collegamenti reali: editor originale, biometria, logout, eliminazione, documenti e limite feedback',()=>{
 const r=routeHarness();let menu=r.render();assert.deepEqual(r.calls,[]);
 menu.props.onSelect('appearance');assert.equal(r.env.screen,'aspettoColori');let editor=r.render();assert.equal(editor.type,'AspettoColoriScreen');assert.equal(editor.props.archivio,r.env.archivioAspettoRef.current);assert.equal(editor.props.backLabel,'Impostazioni');editor.props.onBack();assert.equal(r.env.screen,'impostazioni');
 menu=r.render();menu.props.onSelect('biometrics');let bio=r.render();assert.equal(bio.type,'SettingsDetailScreen');const panel=flat(bio).find(n=>n.type==='BiometriaImpostazioni');assert.equal(panel.props.cambiaBiometria,r.env.cambiaBiometria);assert.ok(!r.calls.includes('toggle-bio'));bio.props.onBack();
 r.render().props.onSelect('legal-support');assert.ok(flat(r.render()).some(n=>n.type==='LegaleAssistenzaImpostazioni'));r.render().props.onBack();
 r.render().props.onSelect('feedback');const feedback=r.render();assert.match(JSON.stringify(feedback),/non è disponibile/);assert.doesNotMatch(JSON.stringify(feedback),/mailto:|https:|DEMO/);flat(feedback).find(n=>n.props.accessibilityLabel==='Apri Legale e assistenza').props.onPress();assert.equal(r.env.screen,'impostazioniLegale');r.render().props.onBack();
 menu=r.render();menu.props.onSelect('logout');menu.props.onSelect('delete-account');assert.deepEqual(r.calls.slice(-2),['logout','delete']);menu.props.onBack();assert.equal(r.env.screen,'home');
});
test('ritorno editor colori conserva anche l’ingresso dal Profilo; dettagli tornano a Impostazioni/Home',()=>{
 const r=routeHarness();r.env.screen='aspettoColori';const editor=r.render();assert.equal(editor.props.backLabel,'Profilo');editor.props.onBack();assert.equal(r.env.screen,'profile');
 for(const screen of ['impostazioniBiometria','impostazioniLegale','impostazioniFeedback']){r.env.screen=screen;const detail=r.render();detail.props.onBack();assert.equal(r.env.screen,'impostazioni');r.env.screen=screen;r.render().props.onHome();assert.equal(r.env.screen,'home');}
 const calls=[];const ui=renderUI('SettingsScreen.tsx','SettingsDetailScreen',{props:{title:'Accesso biometrico',onBack:()=>calls.push('settings'),onHome:()=>calls.push('home'),children:React.createElement('span',null,'Configurazione')}});
 ui.backs.at(-1)();ui.nodes.find(n=>n.accessibilityLabel==='Torna alla Home').onPress();assert.deepEqual(calls,['settings','home']);
});
test('pannelli originali: nessuna biometria, URL o email all’apertura; soltanto azioni esplicite',async()=>{
 let bioCalls=0;const bio=renderUI('ImpostazioniOriginali.js','BiometriaImpostazioni',{props:{biometriaAbilitata:false,cambiaBiometria:()=>bioCalls++,paletteHome:themes.PALETTE_ORIGINALE}});assert.equal(bioCalls,0);bio.nodes.find(n=>n.accessibilityLabel==='Attiva accesso biometrico').onPress();assert.equal(bioCalls,1);
 const legal=renderUI('ImpostazioniOriginali.js','LegaleAssistenzaImpostazioni');assert.deepEqual(legal.links,[]);
 for(const label of ['Privacy Policy','Termini d’uso','Assistenza'])await legal.nodes.find(n=>n.accessibilityLabel===label).onPress();
 assert.deepEqual(legal.links,['https://andrea23488.github.io/Vigilanza-gpg/privacy.html','https://andrea23488.github.io/Vigilanza-gpg/terms.html','mailto:vigilanzagpg.app@gmail.com?subject=Assistenza%20Vigilanza%20GPG']);
});
function section(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b).trim();}
const ranges={bio:['  const cambiaBiometria =','  const usaAccessoNormale ='],logout:['async function logout()','  async function salvaProfilo()'],delete:['  async function eliminaAccount()','async function logout()']};
test('procedure protette originali identiche a HEAD; editor e persistenza non sostituiti dalla demo',()=>{
 const original=execFileSync('git',['show','HEAD:App.js'],{encoding:'utf8',maxBuffer:4*1024*1024});for(const range of Object.values(ranges))assert.equal(section(app,...range),section(original,...range));
 assert.doesNotMatch(app,/from ['"].*homePreview/);assert.ok(app.indexOf("if (screen === 'impostazioni')")>app.indexOf('if (biometriaAbilitata && !biometriaSbloccata)'));
 for(const file of ['SettingsScreen.tsx','ImpostazioniOriginali.js','settingsOptions.ts'])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/supabase|fetch\(|AsyncStorage|expo-local-authentication|homePreview|SettingsDemoDetail/);
});
function accountHarness({failLogout=false,failDelete=false,token='test-only-token'}={}){
 const calls=[],alerts=[];
 const env={supabase:{auth:{signOut:async()=>{calls.push('signOut');return{error:failLogout?{message:'Errore simulato'}:null};},getSession:async()=>({data:{session:token?{access_token:token}:null}})}},
  Alert:{alert:(...args)=>alerts.push(args)},SUPABASE_URL:'https://example.invalid',SUPABASE_KEY:'fake-key',fetch:async(url,options)=>{calls.push(['fetch',url,options]);return{ok:!failDelete,json:async()=>failDelete?{error:'Eliminazione simulata fallita'}:{}};},
  biometriaAbilitata:true,richiestaBiometriaRef:{current:true},azzeraStatoProfilo:()=>calls.push('azzeraProfilo'),invalidaContestoAppleWatch:()=>calls.push('watch-mock')};
 for(const name of ['setProfiloErrore','setProfiloCaricamento','setTurni','setBiometriaSbloccata','setUtenteAutenticato','setAccessoTest','setScreen'])env[name]=v=>calls.push([name,v]);
 vm.createContext(env);vm.runInContext(section(app,...ranges.logout)+'\n'+section(app,...ranges.delete),env);return{env,calls,alerts};
}
test('logout originale simulato dal nuovo menu: una disconnessione mock, nessun servizio reale',async()=>{
 const r=accountHarness();const route=routeHarness({logout:r.env.logout});await route.render().props.onSelect('logout');assert.equal(r.calls.filter(x=>x==='signOut').length,1);assert.ok(r.calls.some(x=>x[0]==='setAccessoTest'&&x[1]===false));assert.equal(r.env.richiestaBiometriaRef.current,false);
 const fail=accountHarness({failLogout:true});await fail.env.logout();assert.equal(fail.alerts.at(-1)[0],'Errore');assert.ok(!fail.calls.some(x=>x[0]==='setAccessoTest'));
});
test('eliminazione originale simulata: entrambe le conferme obbligatorie e annullamento senza richieste',async()=>{
 const r=accountHarness();const route=routeHarness({eliminaAccount:r.env.eliminaAccount});await route.render().props.onSelect('delete-account');assert.equal(r.alerts[0][0],'Elimina account');assert.equal(r.calls.length,0);assert.equal(r.alerts[0][2][0].style,'cancel');assert.equal(r.alerts[0][2][0].onPress,undefined);
 r.alerts[0][2].find(x=>x.text==='CONTINUA').onPress();assert.equal(r.alerts[1][0],'Sei sicuro?');assert.equal(r.calls.length,0);await r.alerts[1][2].find(x=>x.text==='ELIMINA DEFINITIVAMENTE').onPress();
 assert.equal(r.calls.filter(x=>x[0]==='fetch').length,1);assert.ok(r.calls.includes('signOut'));assert.equal(r.alerts.at(-1)[0],'Account eliminato');
});
test('eliminazione: sessione assente o servizio simulato in errore non producono falsi successi',async()=>{
 for(const opts of [{token:null},{failDelete:true}]){const r=accountHarness(opts);await r.env.eliminaAccount();r.alerts[0][2][1].onPress();await r.alerts[1][2][1].onPress();assert.equal(r.alerts.at(-1)[0],'Errore');assert.ok(!r.calls.includes('signOut'));if(!opts.token&&!opts.failDelete)assert.equal(r.calls.filter(x=>x[0]==='fetch').length,0);}
});
test('biometria originale simulata: attivazione esplicita, annullamento senza scrittura e disattivazione originale',async()=>{
 for(const [enabled,success,expected] of [[false,true,true],[false,false,null],[true,true,false]]){
  const writes=[],alerts=[];const env={biometriaAbilitata:enabled,statoBiometriaDispositivo:async()=>({disponibile:true,nome:'Face ID'}),autenticaConBiometria:async()=>({success,error:success?null:'user_cancel'}),salvaBiometriaAbilitata:async v=>writes.push(v),setBiometriaAbilitata:()=>{},setBiometriaSbloccata:()=>{},messaggioErroreBiometria:()=> 'Annullata',Alert:{alert:(...a)=>alerts.push(a)},console:{log(){}}};
  vm.createContext(env);vm.runInContext(section(app,...ranges.bio)+'\nthis.toggle=cambiaBiometria;',env);assert.deepEqual(writes,[]);await env.toggle();assert.deepEqual(writes,expected===null?[]:[expected]);
 }
});
test('back Android dell’editor mantiene la conferma originale dei colori non salvati',()=>{
 const source=fs.readFileSync('AspettoColoriScreen.js','utf8');const a=source.indexOf('  function indietro()'),b=source.indexOf('  if (!classica)',a);assert.ok(b>a);
 for(const stato of [{occupato:false,modificato:false},{occupato:false,modificato:true},{occupato:true,modificato:true}]){
  let handler,returned=0;const alerts=[];const env={stato,anteprimaAperta:false,setAnteprimaAperta:()=>{},onBack:()=>returned++,Alert:{alert:(...x)=>alerts.push(x)},Platform:{OS:'android'},BackHandler:{addEventListener:(_,fn)=>{handler=fn;return{remove(){}};}},useEffect:fn=>fn()};
  vm.runInNewContext(source.slice(a,b),env);assert.equal(handler(),true);
  if(stato.occupato){assert.equal(returned,0);assert.equal(alerts.length,0);}else if(stato.modificato){assert.equal(returned,0);alerts[0][2].find(x=>x.text==='Esci senza salvare').onPress();assert.equal(returned,1);}else assert.equal(returned,1);
 }
});
