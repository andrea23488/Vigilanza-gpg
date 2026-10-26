const path=require('node:path'),fs=require('node:fs');
const {BUNDLE_ID,SCHEME,PROFILE,EXCLUDED}=require('./identity.cjs');
const betaProject=require('./project.json');
const {validateBuildEnvironment}=require('./buildEnvironment.cjs');
module.exports=()=>{
 const env=process.env;
 if(env.APP_VARIANT!=='isolated-beta'||env.EXPO_NO_DOTENV!=='1')throw Error('BETA: ambiente dedicato obbligatorio');
 validateBuildEnvironment(env,__dirname);
 if(env.EAS_BUILD_PROFILE&&env.EAS_BUILD_PROFILE!==PROFILE)throw Error('BETA: profilo non consentito');
 if(env.EAS_BUILD_PLATFORM&&env.EAS_BUILD_PLATFORM!=='ios')throw Error('BETA: solo iOS');
 if(env.EXPO_USE_COMMUNITY_AUTOLINKING==='1')throw Error('BETA: autolinking non isolato');
 if(betaProject.owner!=='celest16'||betaProject.slug!=='vigilanza-gpg-beta')throw Error('BETA: owner o slug del collegamento non coerenti');
 if(env.BETA_EAS_PROJECT_ID&&env.BETA_EAS_PROJECT_ID!==betaProject.projectId)throw Error('BETA: Project ID diverso dal collegamento Beta');
 const project=betaProject.projectId;
 if(project&&(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(project)||project==='3f83a3a9-df1a-4dcc-beaf-8c390f52eca2'))throw Error('BETA: serve un progetto EAS distinto');
 if(env.EAS_BUILD||env.EAS_BUILD_PROFILE){
  const manifest=path.join(__dirname,'..','package.json'),pkg=JSON.parse(fs.readFileSync(manifest,'utf8'));
  if(!pkg.vigilanzaIsolatedBeta||pkg.main!=='betaIos/index.js'||!EXCLUDED.every(n=>(pkg.expo?.autolinking?.ios?.exclude||[]).includes(n)))throw Error('BETA: build consentita solo dalla copia preparata');
  if(!project)throw Error('BETA_EAS_PROJECT_ID obbligatorio prima della build');
 }
 return{owner:'celest16',name:'Vigilanza GPG Beta',slug:'vigilanza-gpg-beta',version:'1.0.3',scheme:SCHEME,orientation:'portrait',platforms:['ios'],newArchEnabled:true,userInterfaceStyle:'light',icon:path.join(__dirname,'../assets/icon.png'),
 ios:{supportsTablet:true,bundleIdentifier:BUNDLE_ID,buildNumber:'1',appleTeamId:'CAA4U7J8QJ',entitlements:{},infoPlist:{ITSAppUsesNonExemptEncryption:false,EXUpdatesEnabled:false}},
 plugins:['expo-font',require.resolve('./withBetaIos.cjs')],updates:{enabled:false,checkAutomatically:'NEVER'},extra:{isolatedBeta:true,...(project?{eas:{projectId:project}}:{})}};
};
