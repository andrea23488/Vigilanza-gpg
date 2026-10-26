import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OFFLINE_TEST } from './runtimeMode';
import { installOfflineNetworkGuard } from './offlineTest/networkGuard';

if (OFFLINE_TEST) {
  installOfflineNetworkGuard();
  if (require('./offlineTest/resolverCheck').OFFLINE_RESOLVER !== true) {
    throw new Error('TEST OFFLINE: bundle non isolato. Avvio bloccato prima di App.');
  }
}
// Require only after the guard: App dependencies must never start online services in Test.
const App = require('./App').default;
const { ThemeEffectsProvider } = require('./ThemeEffects');

function Root() {
  return (
    <SafeAreaProvider>
      <ThemeEffectsProvider><App /></ThemeEffectsProvider>
    </SafeAreaProvider>
  );
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(Root);
