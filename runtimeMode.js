import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { isOfflineIdentity } from './offlineTest/identity.cjs';

// Read the installed app identity, not just an environment variable or JS flag.
const nativeId = requireOptionalNativeModule('ExpoApplication')?.applicationId;
export const OFFLINE_TEST = isOfflineIdentity(Constants.expoConfig, nativeId, Platform.OS);
