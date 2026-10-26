const path = require('node:path');
const previewRoot = __dirname;
const appRoot = path.resolve(previewRoot, '..');
const shared = new Set(['HomeScreen.js', 'HomeArtwork.js', 'ElectricConnections.js', 'homeElectric.js', 'homeModel.js', 'temi.js', 'ThemeScenery.tsx', 'ThemeEffects.tsx', 'ThemeScene.tsx', 'ThemeGlyphs.tsx', 'themeDecorationsModel.js'].map(file => path.join(appRoot, file)));
const blocked = ['@supabase/supabase-js', 'react-native-watch-connectivity', 'expo-notifications', 'expo-local-authentication', 'expo-dev-client', '@bacons/apple-targets'];
const inside = (root, file) => file === root || file.startsWith(root + path.sep);
function assertModuleAllowed(name) {
  if (blocked.some(pkg => name === pkg || name.startsWith(pkg + '/'))) throw new Error(`Anteprima Home: modulo escluso (${name}).`);
}
function assertFileAllowed(file) {
  const absolute = path.resolve(file);
  if (!inside(previewRoot, absolute) && !inside(path.join(appRoot, 'node_modules'), absolute) && !shared.has(absolute)) {
    throw new Error(`Anteprima Home: file esterno al perimetro consentito (${path.basename(absolute)}).`);
  }
}
module.exports = { previewRoot, appRoot, shared, blocked, assertModuleAllowed, assertFileAllowed };
