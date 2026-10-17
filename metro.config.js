const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { validateVariant } = require('./offlineTest/buildSafety.cjs');
const config = getDefaultConfig(__dirname);

if (validateVariant(process.env, require('./package.json'))) {
  config.cacheVersion = 'offline-test-v1';
  if (process.env.EXPO_NO_DOTENV !== '1' || process.env.EXPO_PUBLIC_SUPABASE_URL ||
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) throw new Error('Metro offline: ambiente non isolato.');
  const isolatedFiles = new Set(['supabase.js', 'turniApi.js', 'pushNotifications.js']);
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const relativePath = moduleName.startsWith('.')
      ? path.resolve(path.dirname(context.originModulePath), moduleName).replace(/\.js$/, '')
      : null;
    if (relativePath === path.join(__dirname, 'offlineTest/resolverCheck') ||
        ['react-native-watch-connectivity', 'expo-notifications', '@supabase/supabase-js'].includes(moduleName) ||
        (moduleName.startsWith('.') && isolatedFiles.has(path.basename(moduleName.replace(/\.js$/, '') + '.js')) &&
         path.dirname(path.resolve(path.dirname(context.originModulePath), moduleName)) === __dirname)) {
      return { type: 'sourceFile', filePath: path.join(__dirname, 'offlineTest/services.js') };
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}
module.exports = config;
