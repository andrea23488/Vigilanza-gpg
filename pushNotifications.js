import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let tokenCorrente = null;

function projectIdExpo() {
  return (
    Constants?.easConfig?.projectId ||
    Constants?.expoConfig?.extra?.eas?.projectId ||
    null
  );
}

export async function registraPushDispositivo() {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Vigilanza GPG',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  let permessi = await Notifications.getPermissionsAsync();

  if (permessi.status !== 'granted') {
    permessi = await Notifications.requestPermissionsAsync();
  }

  if (permessi.status !== 'granted') {
    return null;
  }

  const projectId = projectIdExpo();
  if (!projectId) {
    throw new Error('Project ID Expo non disponibile.');
  }

  const risultato = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  const expoToken = risultato?.data;
  if (!expoToken) {
    throw new Error('Token push non disponibile.');
  }

  const { error } = await supabase.rpc('registra_push_token', {
    p_token: expoToken,
    p_piattaforma: Platform.OS,
  });

  if (error) {
    throw error;
  }

  tokenCorrente = expoToken;
  return expoToken;
}

export async function disattivaPushDispositivo() {
  if (!tokenCorrente) return;

  try {
    await supabase.rpc('rimuovi_push_token', {
      p_token: tokenCorrente,
    });
  } finally {
    tokenCorrente = null;
  }
}

export function ascoltaTapNotifiche(onApri) {
  const gestisci = (response) => {
    const dati = response?.notification?.request?.content?.data;
    if (dati && typeof onApri === 'function') {
      onApri(dati);
    }
  };

  const subscription =
    Notifications.addNotificationResponseReceivedListener(gestisci);

  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) gestisci(response);
    })
    .catch((error) => {
      console.log('Errore lettura notifica iniziale:', error);
    });

  return () => subscription.remove();
}
