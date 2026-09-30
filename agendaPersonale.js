export const CHIAVE_IMPEGNI_PERSONALI = '@vigilanza_gpg_impegni_personali_v1';

export function chiaveStorageAgenda(scope = 'locale') {
  const sicuro = String(scope || 'locale').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${CHIAVE_IMPEGNI_PERSONALI}:${sicuro}`;
}
export const PROMEMORIA_RAPIDI_MINUTI = [60, 120, 180, 240, 1440];

const pad2 = (n) => String(n).padStart(2, '0');

export function chiaveDataAgenda(anno, mese, giorno) {
  return `${Number(anno)}-${pad2(Number(mese))}-${pad2(Number(giorno))}`;
}

export function creaIdImpegnoPersonale() {
  return `personale-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizzaPromemoria(valori = []) {
  return Array.from(
    new Set(
      (Array.isArray(valori) ? valori : [])
        .map(Number)
        .filter((v) => PROMEMORIA_RAPIDI_MINUTI.includes(v))
    )
  ).sort((a, b) => a - b).slice(0, 2);
}

export function normalizzaImpegnoPersonale(input = {}) {
  const tuttoIlGiorno = input.tuttoIlGiorno === true;
  return {
    id: String(input.id || creaIdImpegnoPersonale()),
    titolo: String(input.titolo || '').trim(),
    anno: Number(input.anno),
    mese: Number(input.mese),
    giorno: Number(input.giorno),
    tuttoIlGiorno,
    inizio: tuttoIlGiorno ? null : String(input.inizio || '').trim(),
    fine: tuttoIlGiorno ? null : String(input.fine || '').trim() || null,
    luogo: String(input.luogo || '').trim(),
    note: String(input.note || '').trim(),
    promemoria: normalizzaPromemoria(input.promemoria),
    notificationIds: Array.isArray(input.notificationIds)
      ? input.notificationIds.map(String).filter(Boolean)
      : [],
    creatoIl: input.creatoIl || new Date().toISOString(),
    aggiornatoIl: new Date().toISOString(),
  };
}

export function validaImpegnoPersonale(input = {}) {
  const evento = normalizzaImpegnoPersonale(input);
  const errori = [];
  if (!evento.titolo) errori.push('Inserisci un titolo.');
  const data = new Date(evento.anno, evento.mese - 1, evento.giorno, 12, 0, 0, 0);
  if (
    !Number.isInteger(evento.anno) ||
    !Number.isInteger(evento.mese) ||
    !Number.isInteger(evento.giorno) ||
    data.getFullYear() !== evento.anno ||
    data.getMonth() !== evento.mese - 1 ||
    data.getDate() !== evento.giorno
  ) {
    errori.push('Data non valida.');
  }
  const oraValida = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || ''));
  if (!evento.tuttoIlGiorno && !oraValida(evento.inizio)) {
    errori.push('Ora di inizio non valida.');
  }
  if (!evento.tuttoIlGiorno && evento.fine && !oraValida(evento.fine)) {
    errori.push('Ora di fine non valida.');
  }
  return { valido: errori.length === 0, errori, evento };
}

export function ordinaImpegniPersonali(impegni = []) {
  return [...(Array.isArray(impegni) ? impegni : [])].sort((a, b) => {
    const ka = `${chiaveDataAgenda(a.anno, a.mese, a.giorno)}-${a.tuttoIlGiorno ? '00:00' : a.inizio || '23:59'}-${a.id}`;
    const kb = `${chiaveDataAgenda(b.anno, b.mese, b.giorno)}-${b.tuttoIlGiorno ? '00:00' : b.inizio || '23:59'}-${b.id}`;
    return ka.localeCompare(kb);
  });
}

export function impegniDelGiorno(impegni = [], anno, mese, giorno) {
  return ordinaImpegniPersonali(impegni).filter(
    (x) => Number(x.anno) === Number(anno) && Number(x.mese) === Number(mese) && Number(x.giorno) === Number(giorno)
  );
}

export async function caricaImpegniPersonali(storage, scope = 'locale') {
  if (!storage?.getItem) return [];
  try {
    const raw = await storage.getItem(chiaveStorageAgenda(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return ordinaImpegniPersonali(parsed.map(normalizzaImpegnoPersonale));
  } catch (error) {
    console.warn('Agenda personale: impossibile caricare gli impegni.', error);
    return [];
  }
}

export async function salvaImpegniPersonali(storage, impegni = [], scope = 'locale') {
  const normalizzati = ordinaImpegniPersonali(impegni.map(normalizzaImpegnoPersonale));
  await storage.setItem(chiaveStorageAgenda(scope), JSON.stringify(normalizzati));
  return normalizzati;
}

export async function upsertImpegnoPersonale(storage, impegni, input, scope = 'locale') {
  const { valido, errori, evento } = validaImpegnoPersonale(input);
  if (!valido) return { ok: false, errori, impegni: ordinaImpegniPersonali(impegni) };
  const altri = (Array.isArray(impegni) ? impegni : []).filter((x) => String(x.id) !== String(evento.id));
  const prossimi = await salvaImpegniPersonali(storage, [...altri, evento], scope);
  return { ok: true, evento, impegni: prossimi, errori: [] };
}

export async function rimuoviImpegnoPersonale(storage, impegni, id, scope = 'locale') {
  const prossimi = await salvaImpegniPersonali(
    storage,
    (Array.isArray(impegni) ? impegni : []).filter((x) => String(x.id) !== String(id)),
    scope
  );
  return prossimi;
}
