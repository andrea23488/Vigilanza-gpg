'use strict';
const PROFILE='push-test-ios';
const TEST_REF='ilmhjsrxhnishnbocrnm';
const TEST_URL=`https://${TEST_REF}.supabase.co`;
const TEST_BUNDLE='com.vigilanzagpg.app.pushtest';
const CODES=new Set([
 'PUSH_TEST_PROFILE_MISMATCH','PUSH_TEST_MARKER_INVALID','PUSH_TEST_DOTENV_ENABLED',
 'PUSH_TEST_URL_MISMATCH','PUSH_TEST_PUSH_ENABLED','PUSH_TEST_FALLBACK_KEY',
 'PUSH_TEST_EAS_PROJECT_MISMATCH','PUSH_TEST_PLATFORM_INVALID','PUSH_TEST_KEY_MISSING',
 'PUSH_TEST_KEY_FORMAT','PUSH_TEST_KEY_ROLE_INVALID','PUSH_TEST_KEY_PROJECT_MISMATCH',
 'PUSH_TEST_KEY_EXPIRED','PUSH_TEST_PROFILE_INVALID','PUSH_TEST_NATIVE_DIR_PRESENT',
 'PUSH_TEST_NATIVE_ISOLATION','PUSH_TEST_KEY_UNCONFIRMED','PUSH_TEST_MODE_INVALID','PUSH_TEST_INTERNAL',
]);
function fail(code='PUSH_TEST_INTERNAL'){
 const safe=CODES.has(code)?code:'PUSH_TEST_INTERNAL';
 const error=new Error(safe);error.code=safe;throw error;
}
function diagnosticCode(error){try{return CODES.has(error?.code)?error.code:'PUSH_TEST_INTERNAL';}catch{return 'PUSH_TEST_INTERNAL';}}
function isTest(env){
 const profile=env.EAS_BUILD_PROFILE,flag=env.EXPO_PUBLIC_PUSH_TEST_BUILD;
 if(profile===PROFILE){if(flag!=='true')fail('PUSH_TEST_MARKER_INVALID');return true;}
 if(flag==='true'){if(profile&&profile!==PROFILE)fail('PUSH_TEST_PROFILE_MISMATCH');return true;}
 return false;
}
function validateKey(key){
 if(key===undefined||key===null||key==='')fail('PUSH_TEST_KEY_MISSING');
 if(typeof key!=='string'||key.length>4096||key!==key.trim())fail('PUSH_TEST_KEY_FORMAT');
 if(key.startsWith('sb_secret_'))fail('PUSH_TEST_KEY_ROLE_INVALID');
 // Publishable keys are opaque: validate HTTP-safe ASCII, not an assumed encoding.
 if(key.startsWith('sb_publishable_')){
  if(!/^sb_publishable_[\x21-\x7E]+$/.test(key))fail('PUSH_TEST_KEY_FORMAT');
  return;
 }
 // Legacy anon JWT: decode to reject wrong-project/admin keys, not to assert signature validity.
 const parts=key.split('.');if(parts.length!==3||parts.some(x=>! /^[A-Za-z0-9_-]+$/.test(x)))fail('PUSH_TEST_KEY_FORMAT');
 let header,claim;
 try{
  header=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
  claim=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
 }catch{fail('PUSH_TEST_KEY_FORMAT');}
 if(!header||typeof header!=='object'||Array.isArray(header)||header.alg!=='HS256'||!claim||typeof claim!=='object'||Array.isArray(claim))fail('PUSH_TEST_KEY_FORMAT');
 if(claim.role!=='anon')fail('PUSH_TEST_KEY_ROLE_INVALID');
 if(claim.ref!==TEST_REF)fail('PUSH_TEST_KEY_PROJECT_MISMATCH');
 if(!Number.isSafeInteger(claim.exp))fail('PUSH_TEST_KEY_FORMAT');
 if(claim.exp<=Date.now()/1000)fail('PUSH_TEST_KEY_EXPIRED');
}
// Expo metadata never reads or validates the dedicated credential, even on EAS_BUILD=true.
function validateMetadata(env){
 if(!isTest(env))fail('PUSH_TEST_PROFILE_MISMATCH');
 if(env.EXPO_NO_DOTENV!=='1')fail('PUSH_TEST_DOTENV_ENABLED');
 if(env.EXPO_PUBLIC_SUPABASE_URL!==TEST_URL)fail('PUSH_TEST_URL_MISMATCH');
 if(env.EXPO_PUBLIC_PUSH_REGISTRATION_ENABLED!=='false'||env.PUSH_REGISTRATION_ENABLED==='true'||env.PUSH_TRANSPORT_ENABLED==='true')fail('PUSH_TEST_PUSH_ENABLED');
 if(env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!=='__PUSH_TEST_NO_FALLBACK__')fail('PUSH_TEST_FALLBACK_KEY');
 if(env.EXPO_PUBLIC_PUSH_PROJECT_ID!=='3f83a3a9-df1a-4dcc-beaf-8c390f52eca2')fail('PUSH_TEST_EAS_PROJECT_MISMATCH');
 if(env.EAS_BUILD_PLATFORM&&env.EAS_BUILD_PLATFORM!=='ios')fail('PUSH_TEST_PLATFORM_INVALID');
 return {url:TEST_URL};
}
// Pre-install only: no configOnly escape hatch; missing or invalid key always fails.
function validateEnvironment(env){
 validateMetadata(env);
 validateKey(env.EXPO_PUBLIC_PUSH_TEST_SUPABASE_PUBLISHABLE_KEY);
 return {url:TEST_URL,key:env.EXPO_PUBLIC_PUSH_TEST_SUPABASE_PUBLISHABLE_KEY};
}
function validateProfile(profile){
 if(!profile||profile.extends!==undefined||profile.distribution!=='internal'||profile.developmentClient!==false||profile.environment!=='development'||profile.ios?.simulator!==false||profile.ios?.buildConfiguration!=='Release')fail('PUSH_TEST_PROFILE_INVALID');
 const e=profile.env;if(!e||e.EXPO_PUBLIC_PUSH_TEST_BUILD!=='true'||e.EXPO_NO_DOTENV!=='1'||e.EXPO_PUBLIC_SUPABASE_URL!==TEST_URL||e.EXPO_PUBLIC_PUSH_REGISTRATION_ENABLED!=='false'||e.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!=='__PUSH_TEST_NO_FALLBACK__'||e.EXPO_PUBLIC_PUSH_PROJECT_ID!=='3f83a3a9-df1a-4dcc-beaf-8c390f52eca2')fail('PUSH_TEST_PROFILE_INVALID');
 if(Object.keys(e).some(k=>/KEY|TOKEN|SECRET/.test(k)&&!(k==='EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'&&e[k]==='__PUSH_TEST_NO_FALLBACK__')))fail('PUSH_TEST_PROFILE_INVALID');
}
module.exports={PROFILE,TEST_REF,TEST_URL,TEST_BUNDLE,isTest,validateKey,validateMetadata,validateEnvironment,validateProfile,fail,diagnosticCode};
