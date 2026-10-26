const fs=require('node:fs'),path=require('node:path');
function readPackage(dir){const file=path.join(dir,'package.json');return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;}
function betaProjectRoot(betaRoot){
 const parent=path.dirname(betaRoot),pkg=readPackage(parent);
 if(pkg?.vigilanzaIsolatedBeta){
  if(pkg.main!=='betaIos/index.js')throw Error('BETA: struttura della copia preparata non valida');
  return fs.realpathSync(parent);
 }
 const local=readPackage(betaRoot);
 if(local?.vigilanzaIsolatedBeta&&local.main==='index.js')return fs.realpathSync(betaRoot);
 throw Error('BETA: radice progetto isolata non verificabile');
}
function validateBuildEnvironment(env,betaRoot){
 const root=betaProjectRoot(betaRoot),metadata='EXPO_PUBLIC_PROJECT_ROOT';
 // Expo CLI SDK 54 injects this exact local-path metadata during export:embed.
 // It cannot carry an endpoint/key: require the canonical root of this Beta.
 if(Object.prototype.hasOwnProperty.call(env,metadata)){
  const value=env[metadata];let valid=false;
  try{valid=typeof value==='string'&&path.isAbsolute(value)&&fs.realpathSync(value)===root;}catch{}
  if(!valid)throw Error('BETA: EXPO_PUBLIC_PROJECT_ROOT non coincide con la radice Beta verificata');
 }
 const forbidden=Object.keys(env).filter(k=>k!==metadata&&/^EXPO_PUBLIC_|SUPABASE|EXPO_UPDATES/.test(k)&&env[k]);
 if(forbidden.length)throw Error('BETA: variabili di servizio non consentite ('+forbidden.join(', ')+')');
 return root;
}
module.exports={betaProjectRoot,validateBuildEnvironment};
