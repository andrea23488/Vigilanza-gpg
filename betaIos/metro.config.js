const path=require('node:path');
const {getDefaultConfig}=require('expo/metro-config');
const policy=require('./policy.cjs');
const {betaProjectRoot}=require('./buildEnvironment.cjs');
// Choose the real root BEFORE Expo derives transformer/server/serializer paths.
const projectRoot=betaProjectRoot(__dirname);
const config=getDefaultConfig(projectRoot);
config.watchFolders=[policy.sharedRoot];config.resolver.nodeModulesPaths=[path.join(policy.sharedRoot,'node_modules')];config.cacheVersion='vigilanza-isolated-beta-v2';
config.resolver.resolveRequest=(context,name,platform)=>{
 policy.assertModule(name);
 const mapped=policy.substitution(context.originModulePath,name);
 if(mapped)return{type:'sourceFile',filePath:mapped};
 const result=context.resolveRequest(context,name,platform);
 // SDK 54 synthesizes this pure asset registry; it is not a disk/network path.
 const sdkAssetRegistry=result.type==='sourceFile'&&result.filePath==='\0polyfill:assets-registry'&&/^@react-native\/assets-registry\/registry(\.js)?$/.test(name);
 if(result.type==='sourceFile'&&!sdkAssetRegistry&&!result.filePath.includes(path.sep+'node_modules'+path.sep))policy.assertSource(result.filePath);
 return result;
};
module.exports=config;
