import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { preparaNotifichePersonali } from './promemoriaPersonali';

const CHIAVE = '@vigilanza_promemoria_turni';

async function leggiArchivio() {
  try {
    const raw = await AsyncStorage.getItem(CHIAVE);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function salvaArchivio(archivio) {
  await AsyncStorage.setItem(CHIAVE, JSON.stringify(archivio || {}));
}

export async function leggiPromemoriaTurno(turnoId) {
  if (turnoId === null || turnoId === undefined) return 0;

  const archivio = await leggiArchivio();
  return Math.max(
    0,
    Number(archivio[String(turnoId)]?.minuti || 0)
  );
}

export async function cancellaPromemoriaTurno(turnoId) {
  if (turnoId === null || turnoId === undefined) return;

  const archivio = await leggiArchivio();
  const chiave = String(turnoId);
  const notificationId = archivio[chiave]?.notificationId;

  if (notificationId) {
    await Notifications.cancelScheduledNotificationAsync(
      String(notificationId)
    ).catch(() => null);
  }

  delete archivio[chiave];
  await salvaArchivio(archivio);
}

function dataInizioTurno(turno) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(
    String(turno?.inizio || '')
  );

  if (!match) return null;

  const data = new Date(
    Number(turno.anno),
    Number(turno.mese) - 1,
    Number(turno.giorno),
    Number(match[1]),
    Number(match[2]),
    0,
    0
  );

  return Number.isNaN(data.getTime()) ? null : data;
}

export function etichettaPromemoriaTurno(minuti) {
  const valore = Number(minuti || 0);

  if (valore <= 0) return 'Nessun avviso';
  if (valore < 60) return `${valore} min prima`;
  if (valore % 60 === 0) {
    const ore = valore / 60;
    return `${ore} ${ore === 1 ? 'ora' : 'ore'} prima`;
  }

  const ore = Math.floor(valore / 60);
  const minutiRestanti = valore % 60;

  return `${ore}h ${minutiRestanti}m prima`;
}

function corpoNotifica(turno, minuti) {
  const valore = Number(minuti || 0);

  let tempo;
  if (valore < 60) {
    tempo = `${valore} minuti`;
  } else if (valore % 60 === 0) {
    const ore = valore / 60;
    tempo = `${ore} ${ore === 1 ? 'ora' : 'ore'}`;
  } else {
    const ore = Math.floor(valore / 60);
    const restanti = valore % 60;
    tempo = `${ore}h ${restanti}m`;
  }

  const luogo =
    String(
      turno?.indirizzo_servizio ||
      turno?.luogo ||
      ''
    ).trim();

  return `Mancano ${tempo} all’inizio del turno · ${
    turno?.inizio || ''
  }${luogo ? ` · ${luogo}` : ''}`;
}

export async function programmaPromemoriaTurno(
  turno,
  minuti,
  adesso = new Date()
) {
  if (!turno?.id) return null;

  await cancellaPromemoriaTurno(turno.id);

  const valore = Math.max(0, Number(minuti || 0));
  if (valore <= 0) return null;

  const inizio = dataInizioTurno(turno);
  if (!inizio) return null;

  const dataNotifica = new Date(
    inizio.getTime() - valore * 60 * 1000
  );

  if (dataNotifica.getTime() <= adesso.getTime()) {
    return null;
  }

  const autorizzato = await preparaNotifichePersonali();
  if (!autorizzato) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(
      'promemoria-turni',
      {
        name: 'Promemoria turni',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 180, 120, 180],
      }
    );
  }

  const notificationId =
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Turno in arrivo',
        body: corpoNotifica(turno, valore),
        data: {
          tipo: 'promemoria_turno',
          turnoId: turno.id,
        },
        sound: true,
      },

      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: dataNotifica,
        ...(Platform.OS === 'android'
          ? { channelId: 'promemoria-turni' }
          : {}),
      },
    });

  const archivio = await leggiArchivio();

  archivio[String(turno.id)] = {
    minuti: valore,
    notificationId,
  };

  await salvaArchivio(archivio);

  return notificationId;
}
