const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const parser = require('@babel/parser'), ts = require('typescript');
const { getConfig } = require('@expo/config');
const { resolveEntryPoint } = require('@expo/config/paths');
const { launchPlan } = require('./start.cjs');
const policy = require('./isolation.cjs');
const root = __dirname, appRoot = path.dirname(root);

function loadDemo() {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, 'demoData.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const c = { exports: {}, Date }; vm.runInNewContext(code, c); return c.exports;
}
function loadModel() {
  const c = { Date }; vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(appRoot, 'homeModel.js'), 'utf8').replaceAll('export function ', 'function '), c);
  return c;
}

test('turno demo attivo, countdown reale e dati sintetici, anche a cambio mese/anno', () => {
  const { creaDatiDemo } = loadDemo(), { servizioHome } = loadModel();
  for (const now of [new Date(2026,9,25,14,15),new Date(2026,9,1,0,10),new Date(2027,0,1,0,10),new Date(2026,9,31,23,50)]) {
    const demo = creaDatiDemo(now), service = servizioHome(demo.turni,now);
    assert.equal(service.attivo,true);assert.equal(service.countdown,'3h 00m');
    assert.equal(demo.turni[0].indirizzo_servizio,'');assert.ok(demo.periodo.includes('DEMO'));
    assert.equal(servizioHome(demo.turni,new Date(now.getTime()+60000)).countdown,'2h 59m');
  }
});
test('la CLI risolve config ed entry separate dalla produzione, compatibili SDK 54', () => {
  const config = getConfig(root);
  assert.equal(config.exp.sdkVersion,'54.0.0');assert.equal(config.pkg.main,'index.js');
  assert.equal(config.exp.slug,'vigilanza-gpg-home-preview');assert.equal(config.exp.extra.homePreview,true);
  assert.equal(config.exp.extra.eas,undefined);assert.equal(config.exp.ios.bundleIdentifier,undefined);
  assert.equal(config.exp.plugins,undefined);assert.equal(config.exp.icon,undefined);
  assert.equal(resolveEntryPoint(root,{platform:'ios',pkg:config.pkg}),path.join(root,'index.js'));
  assert.ok(!fs.readFileSync(path.join(root,'index.js'),'utf8').includes("../App"));
});
test('piano di avvio usa dipendenze esistenti, Expo Go e tunnel, senza avviare processi', () => {
  const plan = launchPlan({ EXPO_PUBLIC_SUPABASE_URL:'valore-finto',EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'valore-finto',APP_VARIANT:'offline-test',EAS_BUILD_PROFILE:'production',HTTPS_PROXY:'proxy-da-preservare' });
  assert.equal(plan.cwd,root);assert.ok(fs.existsSync(plan.args[0]));
  assert.ok(plan.args.includes('--go'));assert.ok(plan.args.includes('--tunnel'));assert.ok(plan.args.includes('8082'));
  assert.equal(plan.env.EXPO_NO_DOTENV,'1');assert.equal(plan.env.APP_VARIANT,undefined);
  assert.equal(plan.env.EAS_BUILD_PROFILE,undefined);assert.equal(plan.env.EXPO_PUBLIC_SUPABASE_URL,undefined);
  assert.equal(plan.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,undefined);assert.equal(plan.env.HTTPS_PROXY,'proxy-da-preservare');
  assert.throws(()=>launchPlan({EXPO_PACKAGER_PROXY_URL:'exp://example.test'}),/HTTP\/HTTPS/);
});
test('grafo locale: riusa tutti i componenti reali e non importa App, API, runtime o Watch', () => {
  const visited = new Set(), pending = [path.join(root,'index.js')];
  while (pending.length) {
    const file=pending.pop();if(visited.has(file))continue;visited.add(file);policy.assertFileAllowed(file);
    const ast=parser.parse(fs.readFileSync(file,'utf8'),{sourceType:'module',plugins:['jsx','typescript']});
    for (const statement of ast.program.body) {
      if (!statement.source)continue;const name=statement.source.value;policy.assertModuleAllowed(name);
      if (!name.startsWith('.'))continue;
      const base=path.resolve(path.dirname(file),name);
      const resolved=['','.js','.tsx','.ts'].map(ext=>base+ext).find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
      assert.ok(resolved, name);pending.push(resolved);
    }
  }
  for(const file of policy.shared)assert.ok(visited.has(file),file);
  assert.ok(!visited.has(path.join(appRoot,'App.js')));
  assert.ok(!visited.has(path.join(appRoot,'supabase.js')));
  assert.ok(!visited.has(path.join(appRoot,'runtimeMode.js')));
});
test('resolver vieta moduli e file produttivi e isola le preferenze della Home', () => {
  const config=require('./metro.config.js');
  assert.equal(config.projectRoot,root);assert.ok(config.watchFolders.includes(appRoot));
  for(const name of policy.blocked)assert.throws(()=>config.resolver.resolveRequest({},name,'ios'),/modulo escluso/);
  for(const file of ['App.js','supabase.js','turniApi.js','pushNotifications.js','runtimeMode.js'])assert.throws(()=>policy.assertFileAllowed(path.join(appRoot,file)),/perimetro/);
  const originModulePath=path.join(appRoot,'HomeScreen.js');
  const mapped=config.resolver.resolveRequest({originModulePath},'@react-native-async-storage/async-storage','ios');
  assert.equal(mapped.filePath,path.join(root,'previewStorage.js'));
  const code=fs.readFileSync(mapped.filePath,'utf8').replace(/^import .*;\n/m,'').replace('export default','module.exports =');
  const calls=[],c={module:{exports:{}},AsyncStorage:{getItem:key=>calls.push(key),setItem:(key,value)=>calls.push([key,value])}};
  vm.runInNewContext(code,c);c.module.exports.getItem('key');c.module.exports.setItem('key','1');
  assert.equal(calls[0],'@vigilanza_home_preview:key');assert.equal(calls[1][0],'@vigilanza_home_preview:key');
});

test('riepiloghi Home e Agenda coerenti negli stessi dati DEMO, senza cambiare il countdown',()=>{
 const {creaDatiDemo}=loadDemo();const demo=creaDatiDemo(new Date(2026,9,25,14,15));
 const normalize=value=>String(value).replace(/\s/g,'');
 assert.equal(normalize(demo.ore),demo.monthlySummary.hours);assert.equal(normalize(demo.extra),demo.monthlySummary.extra);
 assert.equal(demo.monthlySummary.month,'OTTOBRE 2026');assert.equal(demo.monthlySummary.progress,81);assert.equal(demo.monthlySummary.days,'25');
 assert.equal(demo.summaryYear,2026);assert.equal(demo.summaryMonth,9);
 assert.equal(loadModel().servizioHome(demo.turni,new Date(2026,9,25,14,15)).countdown,'3h 00m');
});
