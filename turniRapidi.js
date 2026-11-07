import AsyncStorage from '@react-native-async-storage/async-storage';

export const CHIAVE_TURNI_RAPIDI = '@vigilanza_turni_rapidi_v1';

export const TURNI_RAPIDI_PREDEFINITI = Object.freeze([
  Object.freeze({ id: 'pre_0614', nome: '06–14', inizio: '06:00', fine: '14:00', operativita: '', postazione: '' }),
  Object.freeze({ id: 'pre_1422', nome: '14–22', inizio: '14:00', fine: '22:00', operativita: '', postazione: '' }),
  Object.freeze({ id: 'pre_2206', nome: '22–06', inizio: '22:00', fine: '06:00', operativita: '', postazione: '' }),
  Object.freeze({ id: 'pre_0715', nome: '07–15', inizio: '07:00', fine: '15:00', operativita: '', postazione: '' }),
  Object.freeze({ id: 'pre_1523', nome: '15–23', inizio: '15:00', fine: '23:00', operativita: '', postazione: '' }),
  Object.freeze({ id: 'pre_2307', nome: '23–07', inizio: '23:00', fine: '07:00', operativita: '', postazione: '' }),
  Object.freeze({ id: 'pre_063015', nome: '06:30–15', inizio: '06:30', fine: '15:00', operativita: '', postazione: '' }),
  Object.freeze({ id: 'pre_152230', nome: '15–22:30', inizio: '15:00', fine: '22:30', operativita: '', postazione: '' }),
  Object.freeze({ id: 'pre_0618', nome: '06–18', inizio: '06:00', fine: '18:00', operativita: '', postazione: '' }),
  Object.freeze({ id: 'pre_1806', nome: '18–06', inizio: '18:00', fine: '06:00', operativita: '', postazione: '' }),
]);

function oraValida(valore) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(valore || '').trim());
}

function pulisciVoce(voce, indice = 0) {
  const nome = String(voce?.nome || '').trim().slice(0, 32);
  const inizio = String(voce?.inizio || '').trim();
  const fine = String(voce?.fine || '').trim();

  if (!nome || !oraValida(inizio) || !oraValida(fine)) {
    return null;
  }

  return {
    id: String(voce?.id || `rapido_${Date.now()}_${indice}`),
    nome,
    inizio,
    fine,
    operativita: String(voce?.operativita || '').trim().slice(0, 80),
    postazione: String(voce?.postazione || '').trim().slice(0, 160),
  };
}

export function normalizzaTurniRapidi(lista) {
  if (!Array.isArray(lista)) return TURNI_RAPIDI_PREDEFINITI.map(x => ({ ...x }));

  const pulita = lista
    .map((x, i) => pulisciVoce(x, i))
    .filter(Boolean)
    .slice(0, 20);

  return pulita.length > 0
    ? pulita
    : TURNI_RAPIDI_PREDEFINITI.map(x => ({ ...x }));
}

export async function caricaTurniRapidi() {
  try {
    const raw = await AsyncStorage.getItem(CHIAVE_TURNI_RAPIDI);
    if (!raw) return TURNI_RAPIDI_PREDEFINITI.map(x => ({ ...x }));
    return normalizzaTurniRapidi(JSON.parse(raw));
  } catch {
    return TURNI_RAPIDI_PREDEFINITI.map(x => ({ ...x }));
  }
}

export async function salvaTurniRapidi(lista) {
  const pulita = normalizzaTurniRapidi(lista);
  await AsyncStorage.setItem(CHIAVE_TURNI_RAPIDI, JSON.stringify(pulita));
  return pulita;
}

export async function ripristinaTurniRapidi() {
  const lista = TURNI_RAPIDI_PREDEFINITI.map(x => ({ ...x }));
  await AsyncStorage.setItem(CHIAVE_TURNI_RAPIDI, JSON.stringify(lista));
  return lista;
}
