import { OFFLINE_TEST } from '../runtimeMode';
if (!OFFLINE_TEST) throw new Error('Servizi offline caricati fuori dalla variante Test. Avvio bloccato.');

// No SDK, credentials, session storage, native notification or Watch imports.
export const OFFLINE_RESOLVER = true;
export const OFFLINE_CLOUD_MESSAGE = 'TEST OFFLINE: operazione cloud disabilitata. Nessun dato salvato o inviato.';
const rejectCloud = async () => { throw new Error(OFFLINE_CLOUD_MESSAGE); };
const empty = async () => ({ data: [], error: null, count: 0 });
function readQuery() {
  const query = {};
  for (const name of ['select', 'eq', 'neq', 'or', 'in', 'order', 'limit', 'is', 'gte', 'lte', 'filter']) {
    query[name] = () => query;
  }
  query.maybeSingle = async () => ({ data: null, error: null });
  query.single = async () => ({ data: null, error: new Error(OFFLINE_CLOUD_MESSAGE) });
  for (const name of ['insert', 'upsert', 'update', 'delete']) query[name] = () => { throw new Error(OFFLINE_CLOUD_MESSAGE); };
  query.then = (resolve, reject) => empty().then(resolve, reject);
  return query;
}
const subscription = () => ({ unsubscribe() {} });
export const createClient = () => { throw new Error(OFFLINE_CLOUD_MESSAGE); };
export const supabase = {
  from: () => readQuery(),
  rpc: rejectCloud,
  functions: { invoke: rejectCloud },
  storage: { from: () => ({ upload: rejectCloud, remove: rejectCloud, download: rejectCloud,
    getPublicUrl: () => ({ data: { publicUrl: null } }) }) },
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: subscription() } }),
    startAutoRefresh() {}, stopAutoRefresh() {},
    signInWithPassword: rejectCloud, signUp: rejectCloud, signOut: rejectCloud,
    resetPasswordForEmail: rejectCloud, updateUser: rejectCloud, setSession: rejectCloud,
    exchangeCodeForSession: rejectCloud,
  },
  channel: () => {
    const channel = { on: () => channel, subscribe: () => channel, unsubscribe() {} };
    return channel;
  },
  removeChannel: async () => {},
};

export const caricaTurniUtente = async () => [];
export const creaTurnoUtente = rejectCloud;
export const aggiornaTurnoUtente = rejectCloud;
export const eliminaTurnoUtente = rejectCloud;
export const registraPushDispositivo = async () => null;
export const disattivaPushDispositivo = async () => {};
export const ascoltaTapNotifiche = () => () => {};
export const getIsPaired = async () => false;
export const getIsWatchAppInstalled = async () => false;
export const updateApplicationContext = () => {};
export const watchEvents = { addListener: () => () => {} };
// Defensive substitute for direct imports of expo-notifications, including reminders.
export const setNotificationHandler = () => {};
export const getPermissionsAsync = async () => ({ status: 'denied', granted: false });
export const requestPermissionsAsync = getPermissionsAsync;
export const getExpoPushTokenAsync = rejectCloud;
export const getDevicePushTokenAsync = rejectCloud;
export const scheduleNotificationAsync = rejectCloud;
export const cancelScheduledNotificationAsync = async () => {};
export const cancelAllScheduledNotificationsAsync = async () => {};
export const setNotificationChannelAsync = async () => {};
export const addNotificationResponseReceivedListener = () => ({ remove() {} });
export const getLastNotificationResponseAsync = async () => null;
export const SchedulableTriggerInputTypes = { DATE: 'date' };
export const AndroidImportance = { DEFAULT: 3, HIGH: 4 };
