import { chiaveDataTurno, oreRetribuiteTurno } from './turniCalcoli';
import { classificaStraordinarioTurno, oreMinutiInMinuti, minutiInOreMinuti } from './straordinariManuali';

// Quattro epsilon relativi coprono divisione/moltiplicazione binaria e la
// somma dei minuti aggiuntivi; il limite assoluto impedisce tolleranze ampie.
export function durataOreInMinuti(ore) {
  const minuti = ore * 60;
  const intero = Math.round(minuti);
  const tolleranza = Math.min(1e-9, 4 * Number.EPSILON * Math.max(1, Math.abs(minuti)));
  if (typeof ore !== 'number' || !Number.isFinite(minuti) ||
      !Number.isSafeInteger(intero) || intero < 0 || minuti < 0 ||
      Math.abs(minuti - intero) > tolleranza) {
    throw new RangeError('Durata non rappresentabile in minuti interi.');
  }
  return intero;
}

export function leggiManualeGpg(modalita, ore, minuti, durataOre) {
  if (modalita === 'automatico') return null;
  if (modalita !== 'manuale') throw new Error('Modalità straordinario non valida.');
  if (!/^\d+$/.test(String(ore)) || !/^\d+$/.test(String(minuti))) {
    throw new Error('Inserisci ore e minuti interi non negativi.');
  }
  const valore = oreMinutiInMinuti(Number(ore), Number(minuti));
  const durataMinuti = durataOreInMinuti(durataOre);
  // Nessun arrotondamento: durate storiche non rappresentabili al minuto
  // restano utilizzabili in automatico, ma non ricevono un override ambiguo.
  classificaStraordinarioTurno({ durataMinuti, automaticiMinuti: 0, manualiMinuti: valore });
  return valore;
}

export function riapriManualeGpg(turno) {
  const valore = turno.straordinario_manuale_minuti;
  if (valore == null) return { modalita: 'automatico', ore: '0', minuti: '0' };
  const parti = minutiInOreMinuti(valore);
  return { modalita: 'manuale', ore: String(parti.ore), minuti: String(parti.minuti) };
}

// Mantiene le durate decimali storiche e le convenzioni temporali GPG.
// Le soglie ricevono SEMPRE la durata originale, mai quella ordinaria manuale.
export function classificaTurniGpg(turni, { modalita, sogliaGiornaliera, sogliaSettimanale }) {
  const settimanale = modalita === 'settimanale';
  const soglia = settimanale
    ? (Number(sogliaSettimanale) > 0 ? Number(sogliaSettimanale) : 40)
    : Math.max(0, Number(sogliaGiornaliera || 0));
  const utili = turni.filter(t => t.tipo === 'turno' && t.riposo_lavorato !== true &&
    chiaveDataTurno(t) && (!settimanale || Number(t.ore || 0) > 0));
  const ordinati = utili.map((t, indice) => {
    const data = new Date(Number(t.anno), Number(t.mese) - 1, Number(t.giorno), 12);
    const lunedi = new Date(data);
    lunedi.setDate(data.getDate() + (data.getDay() === 0 ? -6 : 1 - data.getDay()));
    return { t, indice, data, periodo: settimanale
      ? [lunedi.getFullYear(), String(lunedi.getMonth() + 1).padStart(2, '0'), String(lunedi.getDate()).padStart(2, '0')].join('-')
      : chiaveDataTurno(t) };
  }).sort((a, b) => a.data - b.data || (settimanale ? a.indice - b.indice
    : String(a.t.inizio || '99:99').localeCompare(String(b.t.inizio || '99:99')) || a.indice - b.indice));
  const cumulati = new Map();
  return ordinati.map(({ t, periodo }) => {
    const ore = settimanale
      ? Number(t.ore || 0) + Number(t.minuti_aggiuntivi_retribuiti || 0) / 60
      : oreRetribuiteTurno(t);
    const prima = cumulati.get(periodo) || 0;
    const dopo = prima + ore;
    const automatiche = Math.max(0, dopo - soglia) - Math.max(0, prima - soglia);
    cumulati.set(periodo, dopo);
    let straordinarie = automatiche;
    if (t.straordinario_manuale_minuti != null) {
      // La quantità automatica può derivare da una soglia decimale storica;
      // per validare l'override non serve convertirla o arrotondarla.
      straordinarie = classificaStraordinarioTurno({ durataMinuti: durataOreInMinuti(ore),
        automaticiMinuti: 0, manualiMinuti: t.straordinario_manuale_minuti }).straordinariMinuti / 60;
    }
    return { turno: t, periodo, ore, automatiche, straordinarie,
      ordinarie: ore - straordinarie, cumulatoOre: dopo };
  });
}

export function formattaOreGpg(ore) {
  const minuti = ore * 60;
  if (!Number.isSafeInteger(minuti) || minuti < 0) return `${ore} h`;
  const parti = minutiInOreMinuti(minuti);
  return `${parti.ore} h ${String(parti.minuti).padStart(2, '0')} min`;
}
