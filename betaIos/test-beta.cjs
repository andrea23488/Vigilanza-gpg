const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),cp=require('node:child_process');
const React=require('react'),ts=require('typescript'),{renderToStaticMarkup}=require('react-dom/server');
const linkedProject=require('./project.json');
const root=__dirname,parent=path.dirname(root),{prepare,graph}=require('./prepare.cjs'),policy=require('./policy.cjs'),{BUNDLE_ID,SCHEME,PROFILE,EXCLUDED,assertIdentity}=require('./identity.cjs');
const prepared=prepare(),stage=prepared.destination;
function config(env={},directory=root){return JSON.parse(cp.execFileSync(process.execPath,['-e','console.log(JSON.stringify(require("./app.config.js")()))'],{cwd:directory,env:{PATH:process.env.PATH,APP_VARIANT:'isolated-beta',EXPO_NO_DOTENV:'1',...env},encoding:'utf8',stdio:['ignore','pipe','pipe']}))}
function load(name,imports={},globals={}){const c={exports:{},require:key=>{assert.ok(key in imports,'Import inatteso '+key);return imports[key]},...globals};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,name),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,c);return c.exports}
test('identità iOS distinta, Release interna, niente OTA/capability e nessun profilo ufficiale modificato',()=>{
 const c=config();assert.equal(c.name,'Vigilanza GPG Beta');assert.equal(c.ios.bundleIdentifier,BUNDLE_ID);assert.notEqual(BUNDLE_ID,require('../app.json').expo.ios.bundleIdentifier);assert.equal(c.updates.enabled,false);assert.equal(c.ios.buildNumber,'1');assert.deepEqual(c.ios.entitlements,{});assert.ok(!c.plugins.some(p=>String(p).includes('notifications')));
 const eas=require('./eas.json');assert.deepEqual(Object.keys(eas.build),[PROFILE]);assert.equal(eas.build[PROFILE].distribution,'internal');assert.equal(eas.build[PROFILE].developmentClient,false);assert.equal(eas.build[PROFILE].ios.buildConfiguration,'Release');assert.equal(eas.submit,undefined);assert.equal(c.extra.eas.projectId,linkedProject.projectId);
 assertIdentity(c,BUNDLE_ID,'ios');for(const args of [[c,'com.vigilanzagpg.app','ios'],[c,BUNDLE_ID,'android'],[{...c,scheme:'vigilanzagpg'},BUNDLE_ID,'ios'],[{...c,updates:{enabled:true}},BUNDLE_ID,'ios']])assert.throws(()=>assertIdentity(...args));
});
test('config fail-closed: credenziali, progetto ufficiale, profilo errato e root non preparata rifiutati',()=>{
 for(const env of [{APP_VARIANT:''},{EXPO_NO_DOTENV:''},{EXPO_PUBLIC_SUPABASE_URL:'https://example.invalid'},{SUPABASE_KEY:'fake'},{EXPO_PUBLIC_OTHER:'fake'},{EXPO_UPDATES_URL:'https://example.invalid'},{BETA_EAS_PROJECT_ID:require('../app.json').expo.extra.eas.projectId},{EAS_BUILD_PROFILE:'production'},{EAS_BUILD_PROFILE:PROFILE,BETA_EAS_PROJECT_ID:'11111111-2222-4333-8444-555555555555'},{EAS_BUILD_PLATFORM:'android'},{EXPO_USE_COMMUNITY_AUTOLINKING:'1'}])assert.throws(()=>config(env));
 const c=config({EAS_BUILD_PROFILE:PROFILE,EAS_BUILD_PLATFORM:'ios'},stage);assert.equal(c.extra.eas.projectId,linkedProject.projectId);assert.equal(config({BETA_EAS_PROJECT_ID:linkedProject.projectId},stage).extra.eas.projectId,linkedProject.projectId);assert.throws(()=>config({BETA_EAS_PROJECT_ID:'11111111-2222-4333-8444-555555555555'},stage));
});
test('archivio completo: componenti reali nuovi inclusi, hash verificati, nessun backend o segreto',()=>{
 const names=Object.keys(prepared.manifest);for(const file of ['HomeScreen.js','betaIos/CalendarScreen.js','betaIos/rapidOperations.js','SocialScreen.tsx','SettingsScreen.tsx','AppearanceScreen.tsx','ThemeScenery.tsx','TurniCondivisiView.js'])assert.ok(names.includes(file),file);
 for(const n of names){assert.doesNotMatch(n,/(?:supabase|credentials|\.env|\.p12|\.p8|targets\/|homePreview\/)/i);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(stage,n))).digest('hex'),prepared.manifest[n])}
 assert.ok(!fs.existsSync(path.join(stage,'App.js')));assert.ok(!fs.existsSync(path.join(stage,'supabase.js')));assert.ok(!fs.existsSync(path.join(stage,'turniCondivisiApi.js')));assert.equal(require(path.join(stage,'package.json')).main,'betaIos/index.js');for(const n of EXCLUDED)assert.equal(require(path.join(stage,'react-native.config.js')).dependencies[n].platforms.ios,null);
 console.log('Copia sorgenti Beta verificata:',stage);
});
test('grafo e resolver: vietati API, Importa turni e moduli nativi di rete/servizi',()=>{
 const files=graph();assert.ok(files.length>25);for(const n of ['App.js','supabase.js','turniApi.js','pushNotifications.js','LoginScreen.js'])assert.throws(()=>policy.assertSource(path.join(parent,n)));
 for(const n of policy.BLOCKED)assert.throws(()=>policy.assertModule(n));const model=path.join(parent,'turniCondivisiModel.js');assert.equal(policy.substitution(model,'./turniCondivisiApi'),path.join(root,'sharedShiftStub.js'));assert.equal(policy.substitution(path.join(parent,'HomeScreen.js'),'react-native'),path.join(root,'native.js'));assert.equal(policy.substitution(path.join(parent,'ThemeEffects.tsx'),'@react-native-async-storage/async-storage'),path.join(root,'storage.js'));
});
test('trasporto bloccato prima della UI, non sostituibile; nessuna chiamata originale',async()=>{
 let hits=0;const target={fetch:()=>hits++,XMLHttpRequest:()=>hits++,WebSocket:()=>hits++};load('guard.js').installBetaGuard(target);await assert.rejects(target.fetch('https://example.invalid'));for(const n of ['XMLHttpRequest','WebSocket','EventSource'])assert.throws(()=>new target[n]());assert.equal(hits,0);assert.equal(Object.getOwnPropertyDescriptor(target,'fetch').writable,false);
 const entry=fs.readFileSync(path.join(root,'index.js'),'utf8');assert.ok(entry.indexOf('assertIdentity(')<entry.indexOf('installBetaGuard();'));assert.ok(entry.indexOf('installBetaGuard();')<entry.indexOf("require('./BetaApp')"));
});
test('Linking e Image native non possono aggirare il blocco fetch',async()=>{
 let hits=0;const native=load('native.js',{'react-native':{Linking:{openURL(){hits++}},Image:()=>hits++},react:React});await assert.rejects(native.Linking.openURL('https://example.invalid'));assert.equal(await native.Linking.canOpenURL('https://example.invalid'),false);assert.equal(native.Image({source:{uri:'https://example.invalid/a.png'}}),null);assert.equal(native.Image({source:{uri:'file:///private/test'}}),null);assert.ok(native.Image({source:1}));assert.equal(hits,0);
});
test('fixture coerenti, omonime distinte, date correnti e nessun URL remoto',()=>{
 const m=load('fixtures.js');for(const now of [new Date(2026,9,26,14),new Date(2026,9,1,0,30),new Date(2026,11,31,23,30)]){const d=m.createFixtures(now);assert.equal(d.records[0].id,'beta-today');assert.equal(d.profiles[0].nome,d.profiles[1].nome);assert.notEqual(d.profiles[0].user_id,d.profiles[1].user_id);assert.doesNotMatch(JSON.stringify(d),/https?:|supabase|foto_url/);assert.ok(m.sharedFixtures(d).every(s=>s.foto===null));const summary=m.monthSummary(d.records,now.getFullYear(),now.getMonth());assert.ok(parseFloat(summary.ore)>=0)}
});
test('storage Beta usa prefisso, senza condividere preferenze o sessioni',async()=>{
 const calls=[],s=load('storage.js',{'@react-native-async-storage/async-storage':{getItem:async k=>calls.push(k),setItem:async(k,v)=>calls.push([k,v])}}).default;await s.getItem('test');await s.setItem('test','1');assert.equal(calls[0],'@vigilanza_beta:test');assert.equal(calls[1][0],'@vigilanza_beta:test');
});
test('navigazione Beta: Home reale, Calendario/rapidi, Social/quattro sezioni, Impostazioni/colori, Strumenti',async()=>{
 const state=[],nodes=[],captured={};let i=0;const h={...React,useState:initial=>{const k=i++;if(!(k in state))state[k]=typeof initial==='function'?initial():initial;return[state[k],v=>state[k]=typeof v==='function'?v(state[k]):v]},useRef:initial=>{const k=i++;return state[k]||(state[k]={current:initial})},useEffect:()=>{}};
 const host=tag=>props=>{nodes.push({tag,...props});return React.createElement('div',null,props.children)},capture=name=>props=>{captured[name]=props;return null};const fixture=load('fixtures.js'),palette={background:'#000000',text:'#FFFFFF',border:'#FFFFFF'};
 const ui=load('BetaApp.js',{react:h,'react-native':{Alert:{alert:()=>{}},AppState:{currentState:'active'},...Object.fromEntries(['Pressable','ScrollView','Text','View'].map(n=>[n,host(n)]))},'react-native-safe-area-context':{SafeAreaProvider:host('SafeAreaProvider'),SafeAreaView:host('SafeAreaView')},'../HomeScreen':capture('home'),'./CalendarScreen':capture('calendar'),'../SocialScreen':capture('social'),'../SettingsScreen':capture('settings'),'../ColleghiSocialScreen':capture('profiles'),'../TurniCondivisiView':capture('shared'),'../AspettoColoriScreen':capture('appearance'),'../ThemeScenery':()=>null,'../ThemeEffects':{ThemeEffectsProvider:host('ThemeEffectsProvider'),useThemeDecorationPage:()=>{}},'../preferenzeAspetto':{creaArchivioAspetto:()=>({carica:async()=>({ok:false})})},'../temi':{generaPalette:()=>palette,ripristinaAspetto:()=>({version:1,preset:'originale',background:null,accent:null})},'../turniCondivisiModel':{aggiungiGiorni:(d,n)=>new Date(d.getTime()+n*86400000),lunediDellaSettimana:d=>d},'./storage':{},'./rapidOperations':{prepareRapidInsert(records,model,date,id){if(records.some(t=>t.anno===Number(date.slice(0,4))&&t.mese===Number(date.slice(5,7))&&t.giorno===Number(date.slice(8,10))))return{status:'blocked'};const [anno,mese,giorno]=date.split('-').map(Number),record={id,anno,mese,giorno,tipo:'turno',inizio:model.inizio,fine:model.fine,luogo:model.luogo};return{status:'inserted',before:records,records:[...records,record],record,action:{type:'insert',record}}},prepareRapidDelete(){return{status:'blocked'}},commitRapidProposal(current,proposal){return JSON.stringify(current)===JSON.stringify(proposal.before)?{status:proposal.status,records:proposal.records,operation:{...proposal.action,before:current,after:proposal.records}}:{status:'stale',records:current}},undoRapidOperation(current,operation){return operation&&JSON.stringify(current)===JSON.stringify(operation.after)?{status:'undone',records:operation.before,operation:null}:{status:'stale',records:current}},},'./fixtures':fixture});
 const draw=()=>{i=0;nodes.length=0;for(const key of Object.keys(captured))delete captured[key];renderToStaticMarkup(React.createElement(ui.default))};draw();assert.ok(captured.home.decorationLayer);captured.home.onCalendar();draw();assert.ok(captured.calendar.turniRapidi.length);assert.equal(captured.calendar.operazioniRapide,undefined);assert.equal(typeof captured.calendar.onRapidInsert,'function');assert.equal(typeof captured.calendar.onRapidDelete,'function');assert.equal(typeof captured.calendar.onUndoRapid,'function');const future=new Date();future.setDate(future.getDate()+45);const date=future.toISOString().slice(0,10),originalCount=fixture.createFixtures().records.length;let simulated=captured.calendar.onRapidInsert(captured.calendar.turniRapidi[0],date,false);assert.equal(simulated.status,'inserted');assert.equal(fixture.createFixtures().records.length,originalCount);draw();simulated=captured.calendar.onRapidInsert(captured.calendar.turniRapidi[0],date,false);assert.equal(simulated.status,'blocked');assert.equal(captured.calendar.onUndoRapid().status,'undone');draw();assert.equal(captured.calendar.onRapidInsert(captured.calendar.turniRapidi[0],date,false).status,'inserted');draw();assert.equal(captured.calendar.onUndoRapid().status,'undone');draw();captured.calendar.onMonthChange(1);draw();captured.calendar.onBack();draw();captured.home.onSocial();draw();const select=captured.social.onSelect;
 for(const id of ['shared-shifts','chat','colleague-profiles','find-colleague']){select(id);draw();if(id==='shared-shifts'){assert.equal(captured.shared.giornoSelezionato.toDateString(),new Date().toDateString());captured.shared.onBack()}else if(id==='chat'){nodes.find(n=>n.accessibilityLabel==='‹ Indietro').onPress()}else{assert.ok(captured.profiles.colleghi.every(c=>c.stato==='accettato'&&c.id));if(id==='find-colleague'){const results=await captured.profiles.cerca('Anna Rossi');assert.equal(results.length,2)}captured.profiles.onBack()}draw();assert.ok(captured.social)}
 captured.social.onBack();draw();captured.home.onSettings();draw();captured.settings.onSelect('appearance');draw();assert.ok(captured.appearance.archivio);const custom={version:1,preset:'natale',background:null,accent:null};captured.appearance.onSalvato(custom);draw();assert.ok(captured.appearance.renderAnteprima(palette,custom));captured.appearance.onBack();draw();captured.settings.onBack();draw();captured.home.onNavigate('strumenti');draw();assert.ok(nodes.some(n=>n.accessibilityLabel==='Calendario e turni rapidi'));
});
test('entry point, configurazioni e profili ufficiali preservati',()=>{
 const manifest=require('./official-baseline.json');for(const [file,hash]of Object.entries(manifest))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(parent,file))).digest('hex'),hash,file);
});

test('plugin iOS: nessuna capability condivisa o canale OTA',async()=>{
 const mocks={createRunOncePlugin:(fn)=>fn,withEntitlementsPlist:(c,fn)=>{c.entitlements=fn({modResults:{'aps-environment':'production','com.apple.security.application-groups':['group.official'],'keychain-access-groups':['official']}}).modResults;return c},withInfoPlist:(c,fn)=>{c.info=fn({modResults:{UIBackgroundModes:['remote-notification'],WKCompanionAppBundleIdentifier:'official.watch',NSFaceIDUsageDescription:'test',EXUpdatesURL:'https://example.invalid'}}).modResults;return c}};
 // CJS module is evaluated separately to retain module.exports.
 const context={module:{exports:{}},require:n=>n==='expo/config-plugins'?mocks:require('./identity.cjs')};vm.runInNewContext(fs.readFileSync(path.join(root,'withBetaIos.cjs'),'utf8'),context);const result=context.module.exports(config());assert.equal(Object.keys(result.entitlements).length,0);assert.equal(result.info.EXUpdatesEnabled,false);assert.equal(result.info.UIBackgroundModes,undefined);assert.equal(result.info.EXUpdatesURL,undefined);assert.equal(result.info.WKCompanionAppBundleIdentifier,undefined);
});
test('autolinking iOS reale: esclusi push, Watch, biometria, dev client e OTA; UI e storage presenti',()=>{
 const link=path.join(stage,'node_modules');fs.symlinkSync(path.join(parent,'node_modules'),link,'dir');
 try {
  const cli=path.join(parent,'node_modules/expo-modules-autolinking/bin/expo-modules-autolinking.js');
  const run=(command,platform)=>JSON.parse(cp.execFileSync(process.execPath,[cli,command,'--platform',platform,'--project-root',stage,'--json'],{cwd:stage,env:{PATH:process.env.PATH,EXPO_NO_DOTENV:'1'},encoding:'utf8',maxBuffer:8*1024*1024}));
  const expo=run('resolve','apple'),rn=run('react-native-config','ios');for(const name of EXCLUDED){assert.ok(!expo.modules.some(m=>m.packageName===name),name);assert.ok(!rn.dependencies[name],name)}assert.ok(expo.modules.some(m=>m.packageName==='expo-application'));assert.ok(rn.dependencies['@react-native-async-storage/async-storage']);assert.ok(rn.dependencies['react-native-svg']);
 }finally{fs.unlinkSync(link)}
});

test('persistenza Beta: salvataggio esplicito, riavvio e ripristino con archivio originale',async()=>{
 const data=new Map(),backend={getItem:async k=>data.get(k)??null,setItem:async(k,v)=>data.set(k,v)},storage=load('storage.js',{'@react-native-async-storage/async-storage':backend}).default;
 const temi=load('../temi.js'),{creaArchivioAspetto}=load('../preferenzeAspetto.js',{'./temi':temi,'@react-native-async-storage/async-storage':storage});
 const a=creaArchivioAspetto(storage);await a.carica();assert.equal(data.size,0);const preference={version:1,preset:'natale',background:null,accent:null};assert.equal((await a.salva(preference)).ok,true);const b=creaArchivioAspetto(storage);assert.equal((await b.carica()).preferenza.preset,'natale');assert.equal((await b.ripristina()).ok,true);assert.equal((await creaArchivioAspetto(storage).carica()).preferenza.preset,'originale');assert.ok([...data.keys()].every(k=>k.startsWith('@vigilanza_beta:')));
});

test('profilo Beta: niente campi vuoti; owner dedicato, Project ID Beta esplicito',()=>{
 const profile=require('./eas.json').build[PROFILE];assert.deepEqual(Object.keys(profile.env).sort(),['APP_VARIANT','EXPO_NO_DOTENV']);assert.ok(Object.values(profile.env).every(v=>typeof v==='string'&&v.length>0));const c=config();assert.equal(c.owner,'celest16');assert.equal(c.extra.eas.projectId,linkedProject.projectId);
});
const cliRoots=[process.env.BETA_EAS_CLI_ROOT,...(fs.existsSync('/home/codespace/.npm/_npx')?fs.readdirSync('/home/codespace/.npm/_npx').map(n=>path.join('/home/codespace/.npm/_npx',n,'node_modules/eas-cli')):[])].filter(p=>p&&fs.existsSync(path.join(p,'package.json')));
test('schema ufficiale EAS CLI: configurazione Beta accettata', {skip:!cliRoots.length},async()=>{
 const cliRequire=require('node:module').createRequire(path.join(cliRoots[0],'package.json'));const {EasJsonAccessor}=cliRequire('@expo/eas-json');const data=await EasJsonAccessor.fromProjectPath(root).readAsync();assert.equal(data.build[PROFILE].distribution,'internal');assert.equal(data.build[PROFILE].developmentClient,false);
});

test('collegamento Beta persistente e incluso nella copia: nessun fallback al progetto ufficiale',()=>{
 const original=require('../app.json').expo.extra.eas.projectId;assert.notEqual(linkedProject.projectId,original);assert.equal(linkedProject.owner,'celest16');assert.equal(linkedProject.slug,'vigilanza-gpg-beta');assert.deepEqual(JSON.parse(fs.readFileSync(path.join(stage,'betaIos/project.json'),'utf8')),linkedProject);assert.equal(config().extra.eas.projectId,linkedProject.projectId);assert.throws(()=>config({BETA_EAS_PROJECT_ID:original}));assert.equal(config().updates.enabled,false);
});

test('metadata Expo: solo EXPO_PUBLIC_PROJECT_ROOT locale e verificato; servizi ancora rifiutati',()=>{
 const {betaProjectRoot,validateBuildEnvironment}=require('./buildEnvironment.cjs');assert.equal(betaProjectRoot(root),fs.realpathSync(root));assert.equal(betaProjectRoot(path.join(stage,'betaIos')),fs.realpathSync(stage));
 const c=config({EXPO_PUBLIC_PROJECT_ROOT:root});assert.equal(c.ios.bundleIdentifier,BUNDLE_ID);assert.equal(config({EAS_BUILD_PROFILE:PROFILE,EXPO_PUBLIC_PROJECT_ROOT:stage},stage).extra.eas.projectId,linkedProject.projectId);
 for(const value of ['',parent,'https://example.invalid',path.join(stage,'betaIos'),'/missing-beta-project'])assert.throws(()=>config({EXPO_PUBLIC_PROJECT_ROOT:value},stage));
 for(const name of ['EXPO_PUBLIC_SUPABASE_URL','EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY','EXPO_PUBLIC_OTHER','SUPABASE_TOKEN','EXPO_UPDATES_URL']){
  const secret='DO_NOT_PRINT_TEST_VALUE';assert.throws(()=>validateBuildEnvironment({EXPO_PUBLIC_PROJECT_ROOT:stage,[name]:secret},path.join(stage,'betaIos')),error=>error.message.includes(name)&&!error.message.includes(secret));
 }
});
test('Metro reale inizializza root e transformer sulla radice della copia EAS',()=>{
 const link=path.join(stage,'node_modules');fs.symlinkSync(path.join(parent,'node_modules'),link,'dir');
 try{
  const code="const c=require('./metro.config.js'); console.log(JSON.stringify({root:c.projectRoot,relative:c.transformer._expoRelativeProjectRoot,async:c.transformer.asyncRequireModulePath}));";
  const output=cp.execFileSync(process.execPath,['-e',code],{cwd:stage,env:{PATH:process.env.PATH,APP_VARIANT:'isolated-beta',EXPO_NO_DOTENV:'1',CI:'1'},encoding:'utf8',stdio:['ignore','pipe','pipe']});assert.doesNotMatch(output,/Could not find a package.json/);const c=JSON.parse(output.trim().split('\n').at(-1));assert.equal(c.root,fs.realpathSync(stage));assert.notEqual(c.relative,'betaIos');assert.equal(c.async,'expo/internal/async-require-module');
 }finally{fs.unlinkSync(link)}
});

test('preset Babel risolto dalla versione Expo installata, anche con dipendenze annidate',()=>{
 const link=path.join(stage,'node_modules');fs.symlinkSync(path.join(parent,'node_modules'),link,'dir');
 try{const code="const path=require('path'),b=require('@babel/core'); const r=b.transformSync('export const Element = () => <View />',{filename:path.join(process.cwd(),'betaIos/probe.jsx'),configFile:path.join(process.cwd(),'babel.config.js'),caller:{name:'metro',platform:'ios',isDev:false,supportsStaticESM:false}}); if(!r.code)throw Error('Trasformazione vuota'); console.log('BABEL_OK');";const output=cp.execFileSync(process.execPath,['-e',code],{cwd:stage,env:{PATH:process.env.PATH,APP_VARIANT:'isolated-beta',EXPO_NO_DOTENV:'1',NODE_ENV:'production'},encoding:'utf8',stdio:['ignore','pipe','pipe']});assert.match(output,/BABEL_OK/);}finally{fs.unlinkSync(link)}
});

test('resolver: solo il registro asset virtuale esatto di Expo; altri virtuali e servizi rifiutati',()=>{
 const link=path.join(stage,'node_modules');fs.symlinkSync(path.join(parent,'node_modules'),link,'dir');
 try{
  const code=String.raw`const assert=require('assert/strict'),path=require('path'),m=require('./metro.config.js');const ctx=id=>({originModulePath:path.join(process.cwd(),'betaIos/index.js'),resolveRequest:()=>({type:'sourceFile',filePath:id})});const asset='\0polyfill:assets-registry';assert.equal(m.resolver.resolveRequest(ctx(asset),'@react-native/assets-registry/registry','ios').filePath,asset);assert.throws(()=>m.resolver.resolveRequest(ctx('\0polyfill:unknown'),'@react-native/assets-registry/registry','ios'));assert.throws(()=>m.resolver.resolveRequest(ctx(asset),'./supabase','ios'));assert.throws(()=>m.resolver.resolveRequest(ctx(asset),'@supabase/supabase-js','ios'));console.log('REGISTRY_OK');`;
  const out=cp.execFileSync(process.execPath,['-e',code],{cwd:stage,env:{PATH:process.env.PATH,APP_VARIANT:'isolated-beta',EXPO_NO_DOTENV:'1',CI:'1'},encoding:'utf8',stdio:['ignore','pipe','pipe']});assert.match(out,/REGISTRY_OK/);
 }finally{fs.unlinkSync(link)}
});

test('lockfile Beta autonomo: dipendenze coerenti, piattaforma macOS arm64 e optional conservate',()=>{
 const {validateLock}=require('./dependencies.cjs'),pkg=require('./package.json'),lock=require('./package-lock.json');const result=validateLock(pkg,lock,{os:'darwin',cpu:'arm64'});assert.ok(result.packages>0);assert.ok(result.platformOptional>0);assert.equal(result.platform,'darwin/arm64');assert.ok(!Object.keys(lock.packages).some(n=>n.includes('ngrok')));assert.deepEqual(require(path.join(stage,'package-lock.json')),lock);assert.equal(require(path.join(stage,'package.json')).scripts['eas-build-pre-install'],'node betaIos/dependencies.cjs --stage');assert.ok(prepared.manifest['package-lock.json']);
});
test('regressione EBADPLATFORM: un binario Linux obbligatorio fallisce, uno opzionale è escluso',()=>{
 const {validateLock}=require('./dependencies.cjs'),pkg=require('./package.json'),lock=JSON.parse(JSON.stringify(require('./package-lock.json')));
 const entry={version:'1.0.0',resolved:'https://registry.npmjs.org/beta-linux-helper/-/beta-linux-helper-1.0.0.tgz',integrity:'sha512-test',os:['linux'],cpu:['x64']};lock.packages['node_modules/beta-linux-helper']=entry;assert.throws(()=>validateLock(pkg,lock),/obbligatoria incompatibile.*darwin\/arm64/);entry.devOptional=true;assert.throws(()=>validateLock(pkg,lock),/obbligatoria incompatibile/);entry.optional=true;assert.equal(validateLock(pkg,lock).platform,'darwin/arm64');
});
test('lockfile contaminato: link esterni, ngrok e versioni non sincronizzate rifiutati',()=>{
 const {validateLock}=require('./dependencies.cjs'),pkg=require('./package.json'),clean=require('./package-lock.json');const clone=()=>JSON.parse(JSON.stringify(clean));let bad=clone();bad.packages['../../workspaces/official/node_modules/tool']=bad.packages['node_modules/react'];assert.throws(()=>validateLock(pkg,bad),/percorsi esterni/);
 bad=clone();bad.packages['node_modules/react'].link=true;assert.throws(()=>validateLock(pkg,bad),/link o percorsi/);
 bad=clone();bad.packages['node_modules/@expo/ngrok-bin-linux-x64']={...bad.packages['node_modules/react'],optional:true,os:['linux'],cpu:['x64']};assert.throws(()=>validateLock(pkg,bad),/dipendenza esclusa/);
 bad=clone();bad.packages[''].dependencies.expo='0.0.0';assert.throws(()=>validateLock(pkg,bad),/non sincronizzato/);
});
test('pre-install Beta rifiuta node_modules condiviso e lockfile alterato dopo prepare',()=>{
 const {validateStage}=require('./dependencies.cjs'),p=prepare().destination;assert.equal(validateStage(p).platform,'darwin/arm64');const link=path.join(p,'node_modules');fs.symlinkSync(path.join(parent,'node_modules'),link,'dir');assert.throws(()=>validateStage(p),/node_modules condiviso/);fs.unlinkSync(link);fs.appendFileSync(path.join(p,'package-lock.json'),'\n');assert.throws(()=>validateStage(p),/copia alterata/);
});

test('controllo piattaforma npm reale: lockfile obbligatorio compatibile darwin/arm64 e regressione ngrok',()=>{
 const executable=process.env.npm_execpath||fs.realpathSync(cp.execFileSync('which',['npm'],{encoding:'utf8'}).trim());const npmPackage=path.resolve(path.dirname(executable),'../package.json');const npmRequire=require('node:module').createRequire(npmPackage);const {checkPlatform}=npmRequire('npm-install-checks');const lock=require('./package-lock.json');
 for(const [name,p]of Object.entries(lock.packages))if(name&&!p.optional)assert.doesNotThrow(()=>checkPlatform(p,false,{os:'darwin',cpu:'arm64'}),name);
 assert.throws(()=>checkPlatform({name:'@expo/ngrok-bin-linux-x64',version:'2.3.41',os:['linux'],cpu:['x64']},false,{os:'darwin',cpu:'arm64'}),e=>e.code==='EBADPLATFORM');
});
