const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const { previewRoot, appRoot, assertModuleAllowed, assertFileAllowed } = require('./isolation.cjs');
const config = getDefaultConfig(previewRoot);
// This nested app is not an npm workspace. Share the existing dependency installation
// and source files explicitly, without loading the parent's Metro configuration.
config.projectRoot = previewRoot;
config.watchFolders = [appRoot];
config.resolver.nodeModulesPaths = [path.join(appRoot, 'node_modules')];
config.cacheVersion = 'vigilanza-home-preview-v1';
// The installed SDK 54 Metro validator does not accept this optional Expo flag.
// Removing false preserves the default worker mode and avoids a validation warning.
if (config.watcher?.unstable_workerThreads === false) delete config.watcher.unstable_workerThreads;
config.resolver.resolveRequest = (context, name, platform) => {
  assertModuleAllowed(name);
  if (name === '@react-native-async-storage/async-storage' && ['HomeScreen.js', 'ThemeEffects.tsx'].some(file => context.originModulePath === path.join(appRoot, file))) {
    return { type: 'sourceFile', filePath: path.join(previewRoot, 'previewStorage.js') };
  }
  const result = context.resolveRequest(context, name, platform);
  if (result.type === 'sourceFile') assertFileAllowed(result.filePath);
  if (result.type === 'assetFiles') result.filePaths.forEach(assertFileAllowed);
  return result;
};
module.exports = config;
