// Local iOS JavaScript export only. Never invokes EAS Build, prebuild or signing.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const {prepare}=require('./prepare.cjs');
const {validateStage}=require('./dependencies.cjs');
function checkBundle(){
 const prepared=prepare(),stage=prepared.destination,parent=path.dirname(__dirname),modules=path.join(parent,'node_modules'),link=path.join(stage,'node_modules');
 if(!fs.existsSync(modules))throw Error('Servono le dipendenze già installate nel worktree; nessuna installazione automatica');
 const output=fs.mkdtempSync(path.join(os.tmpdir(),'vigilanza-beta-ios-export-')),bundle=path.join(output,'main.jsbundle'),map=path.join(output,'main.map');
 fs.symlinkSync(modules,link,'dir');
 try{
  const cli=path.join(path.dirname(require.resolve('expo/package.json')),'bin/cli');
  const result=cp.spawnSync(process.execPath,[cli,'export:embed','--platform','ios','--entry-file','betaIos/index.js','--bundle-output',bundle,'--assets-dest',path.join(output,'assets'),'--sourcemap-output',map,'--dev','false','--max-workers','2'],{cwd:stage,env:{...process.env,APP_VARIANT:'isolated-beta',EXPO_NO_DOTENV:'1',EAS_BUILD:'1',EAS_BUILD_PROFILE:'ios-beta',EAS_BUILD_PLATFORM:'ios',EXPO_NO_TELEMETRY:'1',CI:'1',NODE_ENV:'production'},encoding:'utf8',maxBuffer:16*1024*1024});
  const log=(result.stdout||'')+(result.stderr||'');fs.writeFileSync(path.join(output,'export.log'),log);
  if(result.error)throw result.error;if(result.status!==0)throw Error('Bundling JavaScript locale fallito; diagnostica in '+path.join(output,'export.log'));
  const sources=JSON.parse(fs.readFileSync(map,'utf8')).sources;
  const forbidden=sources.filter(s=>/(?:^|\/)(?:App|LoginScreen|supabase|turniApi|pushNotifications|turniCondivisiApi)\.[jt]sx?$/.test(s)||/node_modules\/(?:@supabase\/|expo-notifications\/|react-native-watch-connectivity\/|expo-updates\/|expo-local-authentication\/|expo-dev-client\/)/.test(s));
  if(forbidden.length)throw Error('Moduli non consentiti nel bundle: '+forbidden.join(', '));
  if(/Could not find a package.json|BETA: variabili di servizio non consentite/.test(log))throw Error('Errore di configurazione ancora presente');
  return{stage,output,bundle,sourceMap:map,modules:sources.length,bytes:fs.statSync(bundle).size,forbiddenModules:forbidden};
 }finally{fs.unlinkSync(link);validateStage(stage)}
}
if(require.main===module){try{console.log(JSON.stringify(checkBundle(),null,2))}catch(e){console.error(e.message);process.exitCode=1}}
module.exports={checkBundle};
