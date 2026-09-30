import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const pad2 = (n) => String(n).padStart(2, '0');

export function dataInizioImpegno(evento) {
  if (!evento) return null;
  const ora = evento.tuttoIlGiorno ? '09:00' : evento.inizio;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(ora || ''));
  if (!match) return null;
  const data = new Date(
    Number(evento.anno),
    Number(evento.mese) - 1,
    Number(evento.giorno),
    Number(match[1]),
    Number(match[2]),
    0,
    0
  );
  return Number.isNaN(data.getTime()) ? null : data;
}

export function calcolaDatePromemoria(evento, adesso = new Date()) {
  const inizio = dataInizioImpegno(evento);
  if (!inizio) return [];
  return (Array.isArray(evento.promemoria) ? evento.promemoria : [])
    .map(Number)
    .filter((minuti) => Number.isFinite(minuti) && minuti > 0)
    .map((minuti) => ({ minuti, data: new Date(inizio.getTime() - minuti * 60 * 1000) }))
    .filter(({ data }) => data.getTime() > adesso.getTime())
    .sort((a, b) => a.data - b.data);
}

export async function preparaNotifichePersonali() {
  const permessi = await Notifications.getPermissionsAsync();
  let stato = permessi.status;
  if (stato !== 'granted') {
    const richiesta = await Notifications.requestPermissionsAsync();
    stato = richiesta.status;
  }
  if (stato !== 'granted') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('agenda-personale', {
      name: 'Agenda personale',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180, 120, 180],
    });
  }
  return true;
}

export async function cancellaPromemoriaImpegno(evento) {
  const ids = Array.isArray(evento?.notificationIds) ? evento.notificationIds : [];
  await Promise.all(
    ids.map((id) => Notifications.cancelScheduledNotificationAsync(String(id)).catch(() => null))
  );
}

export async function programmaPromemoriaImpegno(evento, adesso = new Date()) {
  await cancellaPromemoriaImpegno(evento);
  if (!evento?.promemoria?.length) return [];
  const autorizzato = await preparaNotifichePersonali();
  if (!autorizzato) return [];

  const date = calcolaDatePromemoria(evento, adesso);
  const ids = [];
  for (const voce of date) {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: evento.titolo,
        body: evento.luogo ? `📌 ${evento.luogo}` : 'Hai un impegno personale in agenda.',
        data: { tipo: 'agenda_personale', eventoId: evento.id },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: voce.data,
        ...(Platform.OS === 'android' ? { channelId: 'agenda-personale' } : {}),
      },
    });
    ids.push(id);
  }
  return ids;
}

export function etichettaPromemoria(minuti) {
  if (Number(minuti) === 1440) return 'Giorno precedente';
  return `${Number(minuti) / 60} ${Number(minuti) === 60 ? 'ora' : 'ore'} prima`;
}

export function descriviDataPromemoria(data) {
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) return '';
  return `${pad2(data.getDate())}/${pad2(data.getMonth() + 1)} ${pad2(data.getHours())}:${pad2(data.getMinutes())}`;
}
