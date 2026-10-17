const TEST_BUNDLE_ID = 'com.vigilanzagpg.app.test';
const TEST_SCHEME = 'vigilanzagpg-test';
const TEST_VARIANT = 'offline-test';

function isOfflineIdentity(config, nativeId, platform) {
  const requested = config?.extra?.offlineTest === true;
  const dedicated = nativeId === TEST_BUNDLE_ID;
  if (!requested && !dedicated) return false;
  if (!requested || !dedicated || platform !== 'ios' ||
      config?.ios?.bundleIdentifier !== TEST_BUNDLE_ID || config?.scheme !== TEST_SCHEME) {
    throw new Error('Variante offline non coerente con l’identità iOS nativa. Avvio bloccato.');
  }
  return true;
}

module.exports = { TEST_BUNDLE_ID, TEST_SCHEME, TEST_VARIANT, isOfflineIdentity };
