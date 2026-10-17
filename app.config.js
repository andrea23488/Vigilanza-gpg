const base = require('./app.json').expo;
const { TEST_BUNDLE_ID, TEST_SCHEME } = require('./offlineTest/identity.cjs');
const pkg = require('./package.json');
const { validateVariant, validateStage } = require('./offlineTest/buildSafety.cjs');

module.exports = () => {
  if (!validateVariant(process.env, pkg)) return base;
  if (process.env.EAS_BUILD_PLATFORM && process.env.EAS_BUILD_PLATFORM !== 'ios') {
    throw new Error('La variante offline è riservata a iOS.');
  }
  if (process.env.EAS_BUILD || process.env.EAS_BUILD_PROFILE || pkg.vigilanzaOfflineTest === true) {
    validateStage(pkg);
  }
  if (process.env.EXPO_NO_DOTENV !== '1' || process.env.EXPO_PUBLIC_SUPABASE_URL ||
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('Offline: disabilitare dotenv e rimuovere le variabili Supabase.');
  }
  const extra = { offlineTest: true };
  const testProject = process.env.OFFLINE_EAS_PROJECT_ID;
  if (testProject) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(testProject) ||
        testProject === base.extra.eas.projectId) throw new Error('Serve un progetto EAS Test distinto.');
    extra.eas = { projectId: testProject };
  } else if (process.env.EAS_BUILD || process.env.EAS_BUILD_PROFILE) {
    throw new Error('OFFLINE_EAS_PROJECT_ID necessario prima di una build; nessun fallback produttivo.');
  }
  return {
    ...base,
    name: 'Vigilanza GPG Test', slug: 'vigilanza-gpg-test', scheme: TEST_SCHEME, platforms: ['ios'],
    ios: { ...base.ios, bundleIdentifier: TEST_BUNDLE_ID, entitlements: {} },
    plugins: [...base.plugins.filter((plugin) => !['@bacons/apple-targets', 'expo-notifications',
      'expo-local-authentication'].includes(Array.isArray(plugin) ? plugin[0] : plugin)),
      './offlineTest/withOfflineIos.cjs'],
    extra, updates: { enabled: false },
  };
};
