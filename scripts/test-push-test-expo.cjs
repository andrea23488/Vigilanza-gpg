'use strict';
// Actual SDK54 Expo CLI/plugin resolution in an isolated fixture. No prebuild or network.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const modules=path.resolve(process.env.PUSH_TEST_EXPO_MODULES_ROOT||path.join(root,'node_modules'));
const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'vigilanza-expo-metadata-'));
const profile=require('../eas.json').build['push-test-ios'].env;
const synthetic='sb_publishable_synthetic_not_a_real_key_123456';
const common={EXPO_NO_DOTENV:'1',EXPO_OFFLINE:'1',EXPO_NO_TELEMETRY:'1',CI:'1'};
try{
 const installed=JSON.parse(fs.readFileSync(path.join(modules,'expo/package.json'),'utf8'));
 assert.equal(installed.version,require('../package.json').dependencies.expo,'Installare le dipendenze del lockfile prima del controllo Expo');
 fs.mkdirSync(path.join(fixture,'scripts'));
 for(const f of ['package.json','app.json','app.config.js','scripts/push-test-policy.cjs'])fs.copyFileSync(path.join(root,f),path.join(fixture,f));
 fs.cpSync(path.join(root,'targets'),path.join(fixture,'targets'),{recursive:true});
 fs.symlinkSync(modules,path.join(fixture,'node_modules'),'dir');
 fs.writeFileSync(path.join(fixture,'offline-guard.cjs'),"const block=()=>{throw Error('OFFLINE_CHECK_NETWORK_BLOCKED')}; globalThis.fetch=block; require('http').request=block; require('https').request=block; require('net').Socket.prototype.connect=block; require('tls').connect=block;\n");
}catch{
 fs.rmSync(fixture,{recursive:true,force:true});
 throw Error('Dipendenze SDK54 del lockfile necessarie per il controllo reale Expo/plugin');
}
function run(env){return cp.spawnSync(process.execPath,['--require',path.join(fixture,'offline-guard.cjs'),path.join(modules,'expo/bin/cli'),'config','--json'],{cwd:fixture,env:{...common,...env},encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024});}
function success(env){const r=run(env);assert.equal(r.status,0,((r.stdout+r.stderr).match(/PUSH_TEST_[A-Z_]+/)||['EXPO_CONFIG_FAILED'])[0]);assert.doesNotMatch(r.stderr,/OFFLINE_CHECK_NETWORK_BLOCKED/);assert.equal(r.stdout.includes(synthetic),false);return JSON.parse(r.stdout);}
const testEnv={...profile,EAS_BUILD_PROFILE:'push-test-ios',EAS_BUILD_PLATFORM:'ios',EAS_BUILD:'true'};
test('Expo config --json: chiave assente, plugin TEST risolti',()=>{const c=success(testEnv);assert.equal(c.ios.bundleIdentifier,'com.vigilanzagpg.app.pushtest');assert.equal(c.ios.entitlements?.['com.apple.security.application-groups'],undefined);});
test('Expo config --json: chiave sintetica valida, nessuna esposizione',()=>assert.equal(success({...testEnv,EXPO_PUBLIC_PUSH_TEST_SUPABASE_PUBLISHABLE_KEY:synthetic}).scheme,'vigilanzagpg-pushtest'));
test('Expo config --json: chiave malformata rinviata al preflight, plugin risolti',()=>assert.equal(success({...testEnv,EXPO_PUBLIC_PUSH_TEST_SUPABASE_PUBLISHABLE_KEY:'synthetic-invalid'}).ios.bundleIdentifier,'com.vigilanzagpg.app.pushtest'));
test('Expo config --json: URL non TEST resta bloccato nei metadati',()=>{const r=run({...testEnv,EXPO_PUBLIC_SUPABASE_URL:'https://synthetic-invalid.example'});assert.notEqual(r.status,0);assert.match(r.stdout+r.stderr,/PUSH_TEST_URL_MISMATCH/);});
test('Expo config --json: produzione e plugin ufficiali preservati',()=>{const c=success({EAS_BUILD_PROFILE:'production'});assert.equal(c.ios.bundleIdentifier,'com.vigilanzagpg.app');assert.deepEqual(c.ios.entitlements['com.apple.security.application-groups'],['group.com.vigilanzagpg.app.watch']);});
test.after(()=>fs.rmSync(fixture,{recursive:true,force:true}));
