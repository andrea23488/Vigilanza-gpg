import { postazioneTurnoCondiviso } from './turniCondivisiApi';

export function aggiungiGiorni(data, giorni) {
  const d = new Date(data); d.setDate(d.getDate() + giorni); return d;
}
export function lunediDellaSettimana(data) {
  const d = new Date(data); d.setHours(12, 0, 0, 0);
  return aggiungiGiorni(d, -((d.getDay() + 6) % 7));
}
export function chiaveData(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}
export function dataTurno(turno) {
  const a = Number(turno?.anno), m = Number(turno?.mese), g = Number(turno?.giorno);
  if (![a, m, g].every(Number.isInteger) || a < 1900 || m < 1 || m > 12 || g < 1 || g > 31) return null;
  const d = new Date(a, m - 1, g, 12);
  return d.getFullYear() === a && d.getMonth() === m - 1 && d.getDate() === g ? d : null;
}
export function formattaBreve(data) {
  return data.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function nomeProfilo(p) {
  return [p?.nome, p?.cognome].map(v => String(v || '').trim()).filter(Boolean).join(' ') || 'Collega';
}
function minuti(ora) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(ora || ''));
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}
export function intervalloTurno(turno) {
  if (turno?.tipo && turno.tipo !== 'turno') return null;
  const data = dataTurno(turno), inizio = minuti(turno?.inizio), fine = minuti(turno?.fine);
  if (!data || inizio === null || fine === null) return null;
  const a = new Date(data), b = new Date(data);
  a.setHours(Math.floor(inizio / 60), inizio % 60, 0, 0);
  b.setHours(Math.floor(fine / 60), fine % 60, 0, 0);
  if (fine <= inizio) b.setDate(b.getDate() + 1);
  return [a.getTime(), b.getTime()];
}
export function turnoAttivo(turno, adesso) {
  const i = intervalloTurno(turno), ora = adesso.getTime();
  return Boolean(i && i[0] <= ora && ora < i[1]);
}
function limitiGiorno(data) {
  const a = new Date(data); a.setHours(0, 0, 0, 0);
  const b = aggiungiGiorni(a, 1);
  return [a.getTime(), b.getTime()];
}
export function turnoNelGiorno(turno, giorno) {
  const i = intervalloTurno(turno), [a, b] = limitiGiorno(giorno);
  return i ? i[0] < b && a < i[1] : chiaveData(dataTurno(turno) || new Date(NaN)) === chiaveData(giorno);
}
export function orarioTurno(turno) {
  if (turno?.tipo && turno.tipo !== 'turno') return String(turno.tipo).toUpperCase();
  return intervalloTurno(turno) ? `${turno.inizio}–${turno.fine}` : 'Orario non indicato';
}
// Only explicitly received shares from accepted, unblocked colleagues enter the view.
// Whitelist display fields and redact location again, even if a future API returns more fields.
export function creaElementiCondivisi({ mieiTurni = [], ricevuti = [], colleghi = [], profilo = null, fotoProfilo = null }) {
  const consentiti = new Set(colleghi.filter(c => c?.stato === 'accettato').map(c => c.altro_user_id).filter(Boolean));
  const turnoVisibile = (t, luogo) => ({ id: t.id, giorno: t.giorno, mese: t.mese, anno: t.anno, tipo: t.tipo, inizio: t.inizio, fine: t.fine, postazione: luogo });
  const righe = mieiTurni.filter(t => dataTurno(t)).map(t => ({
    id: `mio_${t.id}`, personaId: 'me', mio: true, nome: nomeProfilo(profilo) === 'Collega' ? 'Tu' : nomeProfilo(profilo),
    azienda: String(profilo?.azienda || '').trim(), foto: fotoProfilo || profilo?.foto_url || null,
    turno: turnoVisibile(t, postazioneTurnoCondiviso(t)),
  }));
  const visti = new Set();
  for (const e of ricevuti) {
    if (!e?.condivisione_id || !consentiti.has(e.proprietario_id) || !['solo_orari', 'orari_luogo'].includes(e.livello) || !dataTurno(e.turno)) continue;
    const key = `${e.proprietario_id}:${e.turno.id}`;
    if (visti.has(key)) continue;
    visti.add(key);
    const luogo = e.livello === 'orari_luogo'
      ? String(e.turno.postazione || postazioneTurnoCondiviso(e.turno)).trim() || 'Postazione non indicata'
      : 'Luogo non condiviso';
    righe.push({ id: `collega_${e.condivisione_id}`, personaId: e.proprietario_id, mio: false,
      nome: nomeProfilo(e.profilo), azienda: String(e.profilo?.azienda || '').trim(), foto: e.profilo?.foto_url || null,
      turno: turnoVisibile(e.turno, luogo),
    });
  }
  return righe;
}
export function elementiDelGiorno(elementi, giorno, adesso) {
  const righe = elementi.filter(e => turnoNelGiorno(e.turno, giorno));
  const [giornoInizio, giornoFine] = limitiGiorno(giorno);
  const mieiIntervalli = righe.filter(e => e.mio).map(e => intervalloTurno(e.turno)).filter(Boolean);
  const insieme = e => {
    const i = intervalloTurno(e.turno);
    return Boolean(!e.mio && i && mieiIntervalli.some(m => Math.max(i[0], m[0], giornoInizio) < Math.min(i[1], m[1], giornoFine)));
  };
  return [...righe].sort((a, b) => {
    if (chiaveData(giorno) === chiaveData(adesso)) {
      if (a.mio !== b.mio) return a.mio ? -1 : 1;
      if (insieme(a) !== insieme(b)) return insieme(a) ? -1 : 1;
    }
    return (intervalloTurno(a.turno)?.[0] ?? Infinity) - (intervalloTurno(b.turno)?.[0] ?? Infinity)
      || a.nome.localeCompare(b.nome, 'it') || a.id.localeCompare(b.id);
  });
}
export function inServizioAdesso(elementi, adesso) {
  return elementi.filter(e => turnoAttivo(e.turno, adesso)).sort((a, b) => Number(b.mio) - Number(a.mio) || a.nome.localeCompare(b.nome, 'it'));
}
export function contaPersone(elementi) { return new Set(elementi.map(e => e.personaId)).size; }
