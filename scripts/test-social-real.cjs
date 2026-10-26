const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'), vm=require('node:vm'), ts=require('typescript');
const app=fs.readFileSync('App.js','utf8');
function load(file,imports){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,{exports,require:k=>{assert.ok(k in imports,k);return imports[k]}});return exports;}
test('destinazioni Social reali e ritorno Home senza scritture',async()=>{
 const a=app.indexOf("  if (screen === 'social') {"),b=app.indexOf('  /* Home isolata:',a);
 const calls=[];
 const env={screen:'social',paletteHome:{},SocialScreen:'social',ColleghiSocialScreen:'colleghi',React:{createElement:(type,props)=>({type,props})},setScreen:x=>calls.push(x),setOrigineSocial:x=>calls.push(x),aggiornaColleghi:async()=>{},Alert:{alert:()=>{}},colleghi:[],loadingColleghi:false,cercaColleghi:()=>{},setCollegaSelezionato:x=>calls.push(x)};
 vm.createContext(env);vm.runInContext(require('@babel/core').transformSync(`function render(){${app.slice(a,b)}}`,{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-react-jsx']}).code,env);
 const r=env.render();for(const id of ['shared-shifts','chat','colleague-profiles','find-colleague'])r.props.onSelect(id);
 assert.deepEqual(calls,['calendarioColleghi','listaChat','profiliSocial','cercaCollegaSocial']);r.props.onBack();assert.deepEqual(calls.slice(-2),[false,'home']);
 env.screen='profiliSocial';let list=env.render();list.props.onProfile({id:'linked'});assert.equal(calls.at(-1),'profiloCollega');list.props.onBack();assert.equal(calls.at(-1),'social');
 env.screen='cercaCollegaSocial';assert.equal(env.render().props.ricerca,true);
});
test('ricerca esistente separata dalle scritture, omonimi mantenuti e nessun collegamento automatico',async()=>{
 const rows=[{user_id:'one',nome:'Mario',cognome:'Rossi',codice_gpg:'A'},{user_id:'two',nome:'Mario',cognome:'Rossi',codice_gpg:'B'}];let count=0;
 const chain={select(){return this},eq(){return this},neq(){return this},ilike(){return this},or(){return this},limit(){count++;return Promise.resolve({data:count===1?[]:rows,error:null})}};
 const supabase={auth:{getSession:async()=>({data:{session:{user:{id:'me'}}}})},from:table=>{assert.equal(table,'profili');return chain}};
 const api=load('colleghiApi.js',{'./supabase':{supabase}});
 const found=await api.cercaColleghi('Mario Rossi');assert.equal(found.length,2);assert.equal(found[0].codice_gpg,'A');assert.equal(found[1].codice_gpg,'B');
 await assert.rejects(api.aggiungiCollega('Mario Rossi'),/più colleghi/);
});
test('UI reale riusa layout approvato, tema globale e sola ricerca',()=>{
 const social=fs.readFileSync('SocialScreen.tsx','utf8'),ui=fs.readFileSync('ColleghiSocialScreen.js','utf8');
 assert.doesNotMatch(social,/DEMO|useDemoTheme|SocialDemoDetail|homePreview/);
 assert.match(social,/paletteHome \|\| PALETTE_ORIGINALE/);
 assert.match(ui,/c\.stato === 'accettato'/);assert.match(ui,/key=\{p.user_id\}/);
 assert.match(ui,/setPreview\(p\)/);assert.match(ui,/request.current/);
 assert.doesNotMatch(ui,/aggiungiCollega|inserisci|supabase|inviaMessaggio/);
 for(const marker of ["if (screen === 'listaChat') {","if (screen === 'calendarioColleghi') {","if (screen === 'colleghi') {"]){const a=app.indexOf(marker);assert.match(app.slice(a,a+1800),/origineSocial \? 'social' : 'home'/);}
});
