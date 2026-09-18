import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

const BIOMETRIA_KEY = 'vigilanza_accesso_biometrico_v1';

export async function leggiBiometriaAbilitata() {
  return (await AsyncStorage.getItem(BIOMETRIA_KEY)) === 'true';
}

export async function salvaBiometriaAbilitata(abilitata) {
  await AsyncStorage.setItem(BIOMETRIA_KEY, abilitata ? 'true' : 'false');
}

export async function statoBiometriaDispositivo() {
  const [hardware, configurata, tipi] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);

  const faceId = tipi.includes(
    LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
  );
  const impronta = tipi.includes(
    LocalAuthentication.AuthenticationType.FINGERPRINT
  );

  return {
    disponibile: hardware && configurata,
    hardware,
    configurata,
    nome: faceId ? 'Face ID' : impronta ? 'impronta digitale' : 'biometria',
  };
}

export async function autenticaConBiometria() {
  const stato = await statoBiometriaDispositivo();

  if (!stato.hardware) {
    return { success: false, error: 'not_available', stato };
  }

  if (!stato.configurata) {
    return { success: false, error: 'not_enrolled', stato };
  }

  const risultato = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Accedi a Vigilanza GPG',
    promptSubtitle: 'Conferma la tua identità',
    cancelLabel: 'Annulla',
    fallbackLabel: 'Usa il codice dispositivo',
    biometricsSecurityLevel: 'strong',
  });

  return { ...risultato, stato };
}

export function messaggioErroreBiometria(error) {
  if (error === 'not_enrolled') {
    return 'Configura prima Face ID, Touch ID o l’impronta nelle impostazioni del dispositivo.';
  }
  if (error === 'not_available') {
    return 'Questo dispositivo non dispone di un sistema biometrico compatibile.';
  }
  if (error === 'lockout') {
    return 'Biometria temporaneamente bloccata. Usa il codice dispositivo o accedi con email e password.';
  }
  if (['user_cancel', 'app_cancel', 'system_cancel'].includes(error)) {
    return 'Autenticazione annullata.';
  }
  return 'Identità non verificata. Riprova oppure accedi con email e password.';
}
