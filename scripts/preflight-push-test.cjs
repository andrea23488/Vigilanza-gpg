'use strict';
const fs=require('node:fs'),path=require('node:path');
const {isTest,validateEnvironment,validateProfile,validateKey,TEST_URL,TEST_BUNDLE,fail,diagnosticCode}=require('./push-test-policy.cjs');
const ROOT=path.resolve(__dirname,'..');
function checkLocal(env=process.env){
 const profile=JSON.parse(fs.readFileSync(path.join(ROOT,'eas.json'),'utf8')).build['push-test-ios'];
 validateProfile(profile);
 const resolved=validateEnvironment(env);
 if(['ios','android'].some(d=>fs.existsSync(path.join(ROOT,d))))fail('PUSH_TEST_NATIVE_DIR_PRESENT');
 const base=JSON.parse(fs.readFileSync(path.join(ROOT,'app.json'),'utf8')).expo;
 const config=require('../app.config.js')({config:base});
 if(config.ios.bundleIdentifier!==TEST_BUNDLE||config.ios.entitlements['com.apple.security.application-groups']!==undefined||config.ios.entitlements['keychain-access-groups']!==undefined||config.plugins.some(p=>(Array.isArray(p)?p[0]:p)==='@bacons/apple-targets')||config.extra?.eas?.build?.experimental?.ios?.appExtensions?.length)fail('PUSH_TEST_NATIVE_ISOLATION');
 return resolved;
}
async function verifyProjectKey(key,fetchImpl=globalThis.fetch){
 // Read-only gateway check: an opaque publishable key cannot prove its project offline.
 // No fallback, JWT login, response logging or redirect. Never call production.
 validateKey(key);
 const url=TEST_URL+'/rest/v1/';
 try{
  const response=await fetchImpl(url,{method:'GET',headers:{apikey:key,Accept:'application/openapi+json'},redirect:'error',signal:AbortSignal.timeout(15000)});
  await response.body?.cancel();
  if(!response.ok||response.redirected||(response.url&&response.url!==url))throw Error('rejected');
 }catch{fail('PUSH_TEST_KEY_UNCONFIRMED');}
}
async function main(){
 const hook=process.argv.includes('--eas-hook');
 if(hook&&!isTest(process.env))return;
 if(hook&&process.argv.includes('--offline'))fail('PUSH_TEST_MODE_INVALID');
 const {key}=checkLocal();
 if(process.argv.includes('--offline')){console.log('Controlli locali TEST superati; associazione chiave/progetto NON verificata online.');return;}
 if(!hook)fail('PUSH_TEST_MODE_INVALID');
 await verifyProjectKey(key);
 console.log('Isolamento push TEST verificato; registrazione push disabilitata.');
}
if(require.main===module)main().catch(error=>{console.error(`${diagnosticCode(error)}: preflight TEST fallito; compilazione bloccata.`);process.exitCode=1;});
module.exports={checkLocal,verifyProjectKey};
