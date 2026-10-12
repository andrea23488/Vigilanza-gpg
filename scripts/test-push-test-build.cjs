const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const BASE='ffdf03712b565170501be382776a18f7d3cc25e0';
const policy=require('./push-test-policy.cjs');
const appConfig=require('../app.config.js');
const guard=require('./preflight-push-test.cjs');
const base=require('../app.json').expo,eas=require('../eas.json');
const synthetic='sb_publishable_synthetic_not_a_real_key_123456';
const env={...eas.build['push-test-ios'].env,EAS_BUILD_PROFILE:'push-test-ios',EAS_BUILD_PLATFORM:'ios',EAS_BUILD:'true',EXPO_PUBLIC_PUSH_TEST_SUPABASE_PUBLISHABLE_KEY:synthetic};
const keys=[...Object.keys(env),'PUSH_REGISTRATION_ENABLED','PUSH_TRANSPORT_ENABLED'];
function withEnv(values,fn){const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));try{for(const k of keys)delete process.env[k];Object.assign(process.env,values);return fn();}finally{for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}}
function legacy(role='anon',ref=policy.TEST_REF){return Buffer.from(JSON.stringify({alg:'HS256'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({role,ref,exp:4102444800})).toString('base64url')+'.'+Buffer.from('synthetic-signature-not-a-real-token').toString('base64url');}
let realNetwork=0;global.fetch=()=>{realNetwork++;throw Error('rete vietata');};
test('profili e configurazione ufficiali esattamente preservati',()=>{const old=JSON.parse(cp.execFileSync('git',['show',BASE+':eas.json'],{encoding:'utf8'}));for(const n of ['development','preview','production'])assert.deepEqual(eas.build[n],old.build[n]);assert.deepEqual(eas.cli,old.cli);assert.deepEqual(eas.submit,old.submit);for(const profile of [undefined,'development','preview','production'])withEnv(profile?{EAS_BUILD_PROFILE:profile}:{},()=>{assert.equal(appConfig({config:base}),base);});assert.equal(fs.readFileSync(path.join(__dirname,'../app.json'),'utf8'),cp.execFileSync('git',['show',BASE+':app.json'],{encoding:'utf8'}));});
test('TEST Release interno: bundle/scheme separati, Watch/App Groups assenti',()=>{withEnv(env,()=>{const before=JSON.stringify(base),config=appConfig({config:base});assert.equal(config.ios.bundleIdentifier,'com.vigilanzagpg.app.pushtest');assert.equal(config.scheme,'vigilanzagpg-pushtest');assert.deepEqual(config.platforms,['ios']);assert.ok(!config.plugins.includes('@bacons/apple-targets'));assert.ok(!config.ios.entitlements['com.apple.security.application-groups']);assert.ok(!config.ios.entitlements['keychain-access-groups']);assert.ok(config.plugins.some(p=>Array.isArray(p)&&p[0]==='expo-dev-client'&&p[1].addGeneratedScheme===false));assert.equal(JSON.stringify(base),before);assert.equal(JSON.stringify(config).includes(synthetic),false);policy.validateProfile(eas.build['push-test-ios']);});});
test('URL diverso, dotenv attivo, flag push true, chiave mancante e ambiente ambiguo bloccati',()=>{for(const patch of [{EXPO_PUBLIC_SUPABASE_URL:'https://wrong.example'},{EXPO_NO_DOTENV:'0'},{EXPO_PUBLIC_PUSH_REGISTRATION_ENABLED:'true'},{EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'synthetic-other-key'},{EXPO_PUBLIC_PUSH_TEST_SUPABASE_PUBLISHABLE_KEY:undefined},{EXPO_PUBLIC_PUSH_PROJECT_ID:'different'},{EAS_BUILD_PLATFORM:'android'},{PUSH_TRANSPORT_ENABLED:'true'},{PUSH_REGISTRATION_ENABLED:'true'},{EXPO_PUBLIC_PUSH_TEST_BUILD:'false'},{EAS_BUILD_PROFILE:'production'}]){const candidate={...env,...patch};assert.throws(()=>policy.validateEnvironment(candidate),/PUSH_TEST_/);withEnv(Object.fromEntries(Object.entries(candidate).filter(([,v])=>v!==undefined)),()=>{if('EXPO_PUBLIC_PUSH_TEST_SUPABASE_PUBLISHABLE_KEY' in patch)assert.doesNotThrow(()=>appConfig({config:base}));else assert.throws(()=>appConfig({config:base}));});}});
test('chiavi anon legacy TEST ammesse, admin/altri progetti/malformate rifiutate senza valori negli errori',()=>{policy.validateKey(synthetic);policy.validateKey(legacy());for(const value of [null,'',{},'sb_secret_synthetic_do_not_use',legacy('service_role'),legacy('anon','different'),synthetic+' ','a.b.c']){assert.throws(()=>policy.validateKey(value),e=>/^PUSH_TEST_KEY_/.test(e.code)&&e.message===e.code);}});
test('profilo ereditarieta/distribuzione/secret in JSON rifiutati',()=>{for(const patch of [{extends:'production'},{distribution:'store'},{developmentClient:true},{environment:'production'},{env:{...eas.build['push-test-ios'].env,MY_SECRET:'synthetic'}}])assert.throws(()=>policy.validateProfile({...eas.build['push-test-ios'],...patch}));});
test('preflight locale accetta config isolata e rifiuta cartelle native pregenerate',()=>withEnv(env,()=>{assert.equal(guard.checkLocal().url,policy.TEST_URL);const original=fs.existsSync;fs.existsSync=f=>String(f).endsWith('/ios')||original(f);try{assert.throws(()=>guard.checkLocal(),e=>e.code==='PUSH_TEST_NATIVE_DIR_PRESENT');}finally{fs.existsSync=original;}}));
function client(source,vars){let seen;const body=source.replace(/^import .*;$/gm,'').replace(/^export \{.*\};$/gm,'').replace('export const supabase','const supabase');vm.runInNewContext(body,{process:{env:vars},AsyncStorage:{synthetic:true},createClient:(url,key,options)=>{seen={url,key,options};return {};}});return JSON.parse(JSON.stringify(seen));}
test('client ufficiale identico, TEST ignora chiave generica e usa solo quella dedicata',()=>{const current=fs.readFileSync(path.join(__dirname,'../supabase.js'),'utf8'),old=cp.execFileSync('git',['show',BASE+':supabase.js'],{encoding:'utf8'});const official={EXPO_PUBLIC_SUPABASE_URL:'https://synthetic-official.example',EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'synthetic-official'};assert.deepEqual(client(current,official),client(old,official));assert.equal(client(current,env).key,synthetic);assert.equal(client(current,env).url,policy.TEST_URL);assert.throws(()=>client(current,{...env,EXPO_PUBLIC_SUPABASE_URL:'https://wrong.example'}));assert.throws(()=>client(current,{...env,EXPO_PUBLIC_PUSH_TEST_SUPABASE_PUBLISHABLE_KEY:undefined}));});
test('App usa gli stessi URL/chiave del client per ogni percorso HTTP',()=>{const source=fs.readFileSync(path.join(__dirname,'../App.js'),'utf8');assert.match(source,/import \{ supabase, SUPABASE_URL, SUPABASE_KEY \} from '.\/supabase'/);assert.doesNotMatch(source,/const SUPABASE_KEY\s*=/);});
test('verifica chiave opaca solo gateway TEST, redirect vietati e risposte non stampate',async()=>{let call;await guard.verifyProjectKey(synthetic,async(url,o)=>{call={url,o};return {ok:true,redirected:false,url,body:{cancel:async()=>{}}};});assert.equal(call.url,policy.TEST_URL+'/rest/v1/');assert.equal(call.o.redirect,'error');assert.equal(call.o.headers.apikey,synthetic);assert.equal(call.o.headers.Authorization,undefined);});
test('chiave gateway errata, rete indisponibile o redirect bloccano compilazione',async()=>{for(const fake of [async()=>({ok:false}),async()=>({ok:true,redirected:true}),async()=>({ok:true,url:'https://wrong.example'}),async()=>{throw Error('synthetic-sensitive-text');}])await assert.rejects(guard.verifyProjectKey(synthetic,fake),e=>e.code==='PUSH_TEST_KEY_UNCONFIRMED'&&e.message===e.code);});
test('hook EAS obbligatorio, .env non letto e nessuna rete reale',()=>{assert.equal(require('../package.json').scripts['eas-build-pre-install'],'node scripts/preflight-push-test.cjs --eas-hook');assert.equal(realNetwork,0);});

test('metadata EAS prima delle Sensitive non compila: solo config senza chiave, hook obbligatorio rifiuta',()=>{const vars={...env};delete vars.EAS_BUILD;delete vars.EXPO_PUBLIC_PUSH_TEST_SUPABASE_PUBLISHABLE_KEY;withEnv(vars,()=>{assert.equal(appConfig({config:base}).ios.bundleIdentifier,policy.TEST_BUNDLE);assert.throws(()=>guard.checkLocal());});});

test('progetto EAS diverso blocca config senza esporre valori',()=>withEnv(env,()=>assert.throws(()=>appConfig({config:{...base,extra:{eas:{projectId:'synthetic-other-project'}}}}),e=>e.code==='PUSH_TEST_EAS_PROJECT_MISMATCH')));

for(const clock of [undefined,'true'])test('metadata indipendenti dalla chiave anche EAS_BUILD='+String(clock),()=>{
 for(const key of [undefined,'','synthetic-invalid','sb_secret_synthetic_never_use']){
  const vars={...env};if(clock===undefined)delete vars.EAS_BUILD;else vars.EAS_BUILD=clock;
  if(key===undefined)delete vars.EXPO_PUBLIC_PUSH_TEST_SUPABASE_PUBLISHABLE_KEY;else vars.EXPO_PUBLIC_PUSH_TEST_SUPABASE_PUBLISHABLE_KEY=key;
  withEnv(vars,()=>{assert.equal(appConfig({config:base}).ios.bundleIdentifier,policy.TEST_BUNDLE);assert.throws(()=>guard.checkLocal(),e=>e.code.startsWith('PUSH_TEST_KEY_'));});
 }
});
test('metadata non leggono la credenziale; nessuna escape hatch nel preflight',()=>{
 const vars={...env};Object.defineProperty(vars,'EXPO_PUBLIC_PUSH_TEST_SUPABASE_PUBLISHABLE_KEY',{get(){throw Error('synthetic-private-value');}});
 assert.doesNotThrow(()=>policy.validateMetadata(vars));
 const missing={...env};delete missing.EXPO_PUBLIC_PUSH_TEST_SUPABASE_PUBLISHABLE_KEY;
 assert.throws(()=>policy.validateEnvironment(missing,{configOnly:true}),e=>e.code==='PUSH_TEST_KEY_MISSING');
});
test('diagnostica esatta e nessun valore sensibile negli errori',()=>{
 const cases=[['EXPO_PUBLIC_SUPABASE_URL','https://synthetic-private.example','PUSH_TEST_URL_MISMATCH'],['EXPO_NO_DOTENV','0','PUSH_TEST_DOTENV_ENABLED'],['EXPO_PUBLIC_PUSH_REGISTRATION_ENABLED','true','PUSH_TEST_PUSH_ENABLED'],['EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY','synthetic-private-key','PUSH_TEST_FALLBACK_KEY'],['EXPO_PUBLIC_PUSH_PROJECT_ID','synthetic-private-project','PUSH_TEST_EAS_PROJECT_MISMATCH'],['EAS_BUILD_PLATFORM','android','PUSH_TEST_PLATFORM_INVALID']];
 for(const [field,value,code] of cases)assert.throws(()=>policy.validateMetadata({...env,[field]:value}),e=>e.code===code&&e.message===code&&!e.message.includes(value));
 assert.equal(policy.diagnosticCode(Error('synthetic-private-header')),'PUSH_TEST_INTERNAL');
 const unsafe=Error('synthetic-private');unsafe.code='synthetic-private-code';assert.equal(policy.diagnosticCode(unsafe),'PUSH_TEST_INTERNAL');
});
test('hook senza chiave termina con errore prima di qualunque verifica online',()=>{
 const vars={...env};delete vars.EXPO_PUBLIC_PUSH_TEST_SUPABASE_PUBLISHABLE_KEY;
 const r=cp.spawnSync(process.execPath,[path.join(__dirname,'preflight-push-test.cjs'),'--eas-hook'],{env:vars,encoding:'utf8'});
 assert.equal(r.status,1);assert.equal(r.stdout,'');assert.match(r.stderr,/^PUSH_TEST_KEY_MISSING: preflight TEST fallito; compilazione bloccata\.\s*$/);
});

test('hook EAS non puo usare offline per saltare la verifica online',()=>{
 const r=cp.spawnSync(process.execPath,[path.join(__dirname,'preflight-push-test.cjs'),'--eas-hook','--offline'],{env,encoding:'utf8'});
 assert.equal(r.status,1);assert.match(r.stderr,/^PUSH_TEST_MODE_INVALID:/);assert.equal(r.stdout,'');
});
