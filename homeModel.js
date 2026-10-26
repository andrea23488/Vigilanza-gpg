// Pure presentation helpers: no writes, API access or payroll calculations.
export function dateServizio(turno) {
  if (turno?.tipo !== 'turno') return null;
  const parse = value => /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
  const a = parse(turno.inizio), b = parse(turno.fine);
  if (!a || !b || +a[1] > 23 || +b[1] > 23 || +a[2] > 59 || +b[2] > 59) return null;
  const y = Number(turno.anno), m = Number(turno.mese), d = Number(turno.giorno);
  const inizio = new Date(y, m - 1, d, +a[1], +a[2]);
  if (!Number.isFinite(inizio.getTime()) || inizio.getFullYear() !== y || inizio.getMonth() !== m - 1 || inizio.getDate() !== d) return null;
  const fine = new Date(y, m - 1, d, +b[1], +b[2]);
  if (fine <= inizio) fine.setDate(fine.getDate() + 1);
  return { inizio, fine };
}

export function servizioHome(turni, adesso = new Date()) {
  const oggi = t => Number(t.anno) === adesso.getFullYear() && Number(t.mese) === adesso.getMonth() + 1 && Number(t.giorno) === adesso.getDate();
  const servizi = turni.map(turno => ({ turno, date: dateServizio(turno) }))
    .filter(s => s.date).sort((a, b) => a.date.inizio - b.date.inizio);
  const attivo = servizi.find(s => s.date.inizio <= adesso && adesso < s.date.fine);
  const prossimo = servizi.find(s => oggi(s.turno) && s.date.inizio > adesso);
  const ultimo = servizi.filter(s => oggi(s.turno)).pop();
  const scelto = attivo || prossimo || ultimo;
  const turno = scelto?.turno || turni.find(oggi) || null;
  let label = 'NESSUN TURNO', countdown = '—';
  if (scelto) {
    const diff = (attivo || !prossimo ? scelto.date.fine : scelto.date.inizio) - adesso;
    label = attivo ? 'FINE TRA' : prossimo ? 'INIZIA TRA' : 'TURNO TERMINATO';
    if (diff > 0) {
      const minuti = Math.ceil(diff / 60000);
      countdown = `${Math.floor(minuti / 60)}h ${String(minuti % 60).padStart(2, '0')}m`;
    } else countdown = '0h 00m';
  } else if (turno) label = String(turno.tipo || 'NESSUN TURNO').toUpperCase();
  return { turno, attivo: Boolean(attivo), label, countdown, titolo: attivo ? 'IN SERVIZIO' : 'TURNO DI OGGI' };
}

// One square composition: button disc centres lie on the outer circle.
// All lengths shrink together when either available axis is constrained.
export function geometriaHome(width, height, fontScale = 1) {
  const w = Math.max(0, width), h = Math.max(0, height);
  const panelHeight = Math.min(w, h);
  const button = panelHeight * 0.22;
  const radius = panelHeight * 0.442;
  const offset = radius / Math.SQRT2;
  const dx = Math.max(0, offset - button / 2);
  const dy = Math.max(0, offset - button * 0.66);
  const diameter = Math.max(0, 2 * (Math.hypot(dx, dy) - 6 * panelHeight / 280));
  const cx = w / 2, cy = panelHeight / 2;
  return { button, diameter, panelHeight, top: cy - diameter / 2, left: cx - diameter / 2,
    buttons: [[-1,-1],[1,-1],[-1,1],[1,1]].map(([x,y]) => ({
      left: cx + x * offset - button / 2, top: cy + y * offset - button / 2 })) };
}

export function formattaValoreHome(value) {
  const text = String(value);
  return /^\d+(?:[.,]\d+)?\s*h?$/.test(text) ? text.replace(/\s*h$/, '').replace('.', ',') : text;
}

// Avanzamento temporale, come nella Home originale; non misura stipendio o ore.
// Il periodo segue il riepilogo selezionato, anche tornando da mesi passati/futuri.
export function avanzamentoMeseHome(anno, mese, adesso = new Date()) {
  if (!Number.isInteger(anno) || !Number.isInteger(mese) || mese < 0 || mese > 11) return null;
  const periodo = anno * 12 + mese;
  const corrente = adesso.getFullYear() * 12 + adesso.getMonth();
  if (periodo < corrente) return 100;
  if (periodo > corrente) return 0;
  return Math.round((adesso.getDate() / new Date(anno, mese + 1, 0).getDate()) * 100);
}
