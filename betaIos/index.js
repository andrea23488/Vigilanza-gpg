import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { assertIdentity } from './identity.cjs';
import { installBetaGuard } from './guard';
assertIdentity(Constants.expoConfig,Application.applicationId,Platform.OS);
installBetaGuard();
// UI and its dependencies load only after identity and transport checks.
const {registerRootComponent}=require('expo');
registerRootComponent(require('./BetaApp').default);
