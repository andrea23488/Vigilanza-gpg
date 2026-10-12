'use strict';
const PROFILE='push-test-ios';
const TEST_REF='ilmhjsrxhnishnbocrnm';
const TEST_URL=`https://${TEST_REF}.supabase.co`;
const TEST_BUNDLE='com.vigilanzagpg.app.pushtest';
function fail(){throw Error('Configurazione push TEST rifiutata');}
function isTest(env){
 const profile=env.EAS_BUILD_PROFILE,flag=env.EXPO_PUBLIC_PUSH_TEST_BUILD;
 if(profile===PROFILE){if(flag!=='true')fail();return true;}
 if(flag==='true'){if(profile&&profile!==PROFILE)fail();return true;}
 return false;
}
function validateKey(key){
 if(typeof key!=='string'||key.length>4096||key!==key.trim())fail();
 if(/^sb_publishable_[A-Za-z0-9_-]{16,512}$/.test(key))return;
 // Legacy anon JWT: decode to reject wrong-project/admin keys, not to assert signature validity.
 const parts=key.split('.');if(parts.length!==3||parts.some(x=>! /^[A-Za-z0-9_-]+$/.test(x)))fail();
 try{
  const header=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
  const claim=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
  if(header.alg!=='HS256'||claim.role!=='anon'||claim.ref!==TEST_REF||!Number.isSafeInteger(claim.exp)||claim.exp<=Date.now()/1000)fail();
 }catch{fail();}
}
function validateEnvironment(env,{configOnly=false}={}){
 if(!isTest(env))fail();
 if(env.EXPO_NO_DOTENV!=='1'||env.EXPO_PUBLIC_SUPABASE_URL!==TEST_URL||env.EXPO_PUBLIC_PUSH_REGISTRATION_ENABLED!=='false'||env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!=='__PUSH_TEST_NO_FALLBACK__'||env.EXPO_PUBLIC_PUSH_PROJECT_ID!=='3f83a3a9-df1a-4dcc-beaf-8c390f52eca2')fail();
 if(env.EAS_BUILD_PLATFORM&&env.EAS_BUILD_PLATFORM!=='ios')fail();
 if(env.PUSH_REGISTRATION_ENABLED==='true'||env.PUSH_TRANSPORT_ENABLED==='true')fail();
 // EAS CLI resolves project metadata before downloading Sensitive variables.
 // Only that non-build config pass can omit the key; the pre-install hook never can.
 if(!(configOnly&&env.EAS_BUILD!=='true'&&env.EXPO_PUBLIC_PUSH_TEST_SUPABASE_PUBLISHABLE_KEY===undefined))validateKey(env.EXPO_PUBLIC_PUSH_TEST_SUPABASE_PUBLISHABLE_KEY);
 return {url:TEST_URL,key:env.EXPO_PUBLIC_PUSH_TEST_SUPABASE_PUBLISHABLE_KEY};
}
function validateProfile(profile){
 if(!profile||profile.extends!==undefined||profile.distribution!=='internal'||profile.developmentClient!==false||profile.environment!=='development'||profile.ios?.simulator!==false||profile.ios?.buildConfiguration!=='Release')fail();
 const e=profile.env;if(!e||e.EXPO_PUBLIC_PUSH_TEST_BUILD!=='true'||e.EXPO_NO_DOTENV!=='1'||e.EXPO_PUBLIC_SUPABASE_URL!==TEST_URL||e.EXPO_PUBLIC_PUSH_REGISTRATION_ENABLED!=='false'||e.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!=='__PUSH_TEST_NO_FALLBACK__'||e.EXPO_PUBLIC_PUSH_PROJECT_ID!=='3f83a3a9-df1a-4dcc-beaf-8c390f52eca2')fail();
 if(Object.keys(e).some(k=>/KEY|TOKEN|SECRET/.test(k)&&!(k==='EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'&&e[k]==='__PUSH_TEST_NO_FALLBACK__')))fail();
}
module.exports={PROFILE,TEST_REF,TEST_URL,TEST_BUNDLE,isTest,validateKey,validateEnvironment,validateProfile};
