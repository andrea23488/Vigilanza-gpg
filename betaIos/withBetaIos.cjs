const {createRunOncePlugin,withEntitlementsPlist,withInfoPlist}=require('expo/config-plugins');
const {BUNDLE_ID}=require('./identity.cjs');
module.exports=config=>{
 if(config.ios?.bundleIdentifier!==BUNDLE_ID||config.extra?.isolatedBeta!==true)throw Error('BETA: plugin fuori variante');
 for(const name of ['expo-notifications','expo-local-authentication','expo-dev-client','expo-updates'])config=createRunOncePlugin(value=>value,name,'isolated-beta')(config);
 config=withEntitlementsPlist(config,value=>{value.modResults={};return value});
 return withInfoPlist(config,value=>{for(const key of ['UIBackgroundModes','WKCompanionAppBundleIdentifier','NSFaceIDUsageDescription','EXUpdatesURL','EXUpdatesRequestHeaders'])delete value.modResults[key];value.modResults.EXUpdatesEnabled=false;return value});
};
