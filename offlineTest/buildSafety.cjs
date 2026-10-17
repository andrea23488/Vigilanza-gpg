const { TEST_VARIANT } = require('./identity.cjs');
const NATIVE_EXCLUSIONS = ['expo-notifications', 'react-native-watch-connectivity'];

function validateVariant(env, pkg) {
  const variant = env.APP_VARIANT;
  const requested = env.EAS_BUILD_PROFILE === 'offline-test' || pkg.vigilanzaOfflineTest === true;
  if ((requested && variant !== TEST_VARIANT) ||
      (variant !== undefined && variant !== '' && variant !== TEST_VARIANT)) {
    throw new Error('Variante Test richiesta ma APP_VARIANT non valida: preparazione bloccata.');
  }
  if (variant !== TEST_VARIANT) return false;
  if (env.EAS_BUILD_PROFILE && env.EAS_BUILD_PROFILE !== 'offline-test') {
    throw new Error('La variante offline richiede il profilo offline-test.');
  }
  if (env.EXPO_USE_COMMUNITY_AUTOLINKING === '1') {
    throw new Error('La variante Test richiede Expo Autolinking per applicare le esclusioni native.');
  }
  return true;
}

function validateStage(pkg) {
  const excluded = pkg.expo?.autolinking?.ios?.exclude || [];
  if (pkg.vigilanzaOfflineTest !== true || !NATIVE_EXCLUSIONS.every((name) => excluded.includes(name))) {
    throw new Error('Build Test consentita solo nella copia esterna preparata da scripts/prepare-offline-stage.cjs.');
  }
}

module.exports = { NATIVE_EXCLUSIONS, validateVariant, validateStage };
