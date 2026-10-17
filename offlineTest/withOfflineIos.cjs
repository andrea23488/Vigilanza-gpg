const { createRunOncePlugin, withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');
const { TEST_BUNDLE_ID } = require('./identity.cjs');

module.exports = (config) => {
  if (config.ios?.bundleIdentifier !== TEST_BUNDLE_ID || config.extra?.offlineTest !== true) {
    throw new Error('Il plugin di isolamento iOS è riservato alla variante Test.');
  }
  // Expo can apply installed SDK plugins automatically even after filtering plugins[].
  // Mark these as deliberately handled so their native capabilities are not re-added.
  for (const name of ['expo-notifications', 'expo-local-authentication']) {
    config = createRunOncePlugin((value) => value, name, 'offline-test')(config);
  }
  config = withEntitlementsPlist(config, (value) => {
    for (const key of ['aps-environment', 'com.apple.developer.aps-environment',
      'com.apple.security.application-groups', 'keychain-access-groups']) delete value.modResults[key];
    return value;
  });
  return withInfoPlist(config, (value) => {
    delete value.modResults.UIBackgroundModes;
    delete value.modResults.WKCompanionAppBundleIdentifier;
    return value;
  });
};
