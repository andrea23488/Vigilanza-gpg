import { intervalloTemporaleTurno } from './turniCalcoli';

// Piano descrittivo in memoria: non è un payload e non accede ad API o archivi.
export const STATI_ANTEPRIMA_RAPIDI = Object.freeze({
  'data-libera': 'Data libera',
  'turno-presente': 'Turno già presente',
  duplicato: 'Turno già presente · duplicato',
  sovrapposizione: 'Possibile sovrapposizione',
  notturno: 'Turno notturno',
  multipli: 'Più turni nella stessa giornata',
  assenza: 'Riposo o assenza',
  vietata: 'Operazione non consentita',
});

export function chiaveDataRapida(anno, mese, giorno) {
  if (![anno, mese, giorno].every(Number.isInteger)) return '';
  const d = new Date(Date.UTC(anno, mese, giorno));
  if (d.getUTCFullYear() !== anno || d.getUTCMonth() !== mese || d.getUTCDate() !== giorno) return '';
  return d.toISOString().slice(0, 10);
}

function dataValida(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y, m, d] = key.split('-').map(Number);
  return chiaveDataRapida(y, m - 1, d) === key;
}

export function alternaDataRapida(dates, key) {
  if (!dataValida(key)) return dates;
  return dates.includes(key) ? dates.filter(d => d !== key) : [...dates, key].sort();
}

function dataRecord(t) {
  return chiaveDataRapida(Number(t.anno), Number(t.mese) - 1, Number(t.giorno));
}

function personale(t) {
  return t.origin === 'personal' || t.tipoAgenda === 'personale' ||
    ['personal', 'personale', 'appuntamento', 'evento'].includes(t.tipo);
}

export function chiaveRecordRapido(t) {
  const date = dataRecord(t);
  return date && t.id != null && String(t.id).trim() ? `${date}|${String(t.id)}` : '';
}

function descrivi(t) {
  return {
    key: chiaveRecordRapido(t), id: t.id == null ? '' : String(t.id), date: dataRecord(t),
    tipo: t.tipo, inizio: t.inizio || '', fine: t.fine || '',
    luogo: t.luogo || '', postazione: t.indirizzo_servizio || '',
  };
}

function candidato(model, key) {
  if (!model || !dataValida(key)) return null;
  const [anno, mese, giorno] = key.split('-').map(Number);
  const tipo = model.tipo || 'turno';
  if (!['turno', 'riposo', 'ferie'].includes(tipo)) return null;
  const ora = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
  if (tipo === 'turno' && (!ora(model.inizio) || !ora(model.fine) || model.inizio === model.fine)) return null;
  return { anno, mese, giorno, tipo, inizio: model.inizio || '', fine: model.fine || '',
    luogo: model.operativita || '', indirizzo_servizio: model.postazione || '' };
}

function intervallo(t) {
  if (t.tipo === 'turno') return intervalloTemporaleTurno(t);
  const date = dataRecord(t);
  if (!date) return null;
  const inizio = Date.parse(`${date}T00:00:00Z`);
  return { inizio, fine: inizio + 86400000 };
}

const sovrapposti = (a, b) => a && b && a.inizio < b.fine && b.inizio < a.fine;
function notturno(t) {
  const i = intervalloTemporaleTurno(t), date = dataRecord(t);
  return !!(i && date && i.fine >= Date.parse(`${date}T00:00:00Z`) + 86400000);
}

export function creaAnteprimaRapidi({ mode, model = null, dates = [], targets = [], records = [] }) {
  const keys = [...new Set(dates)].sort();
  const all = records.filter(t => t && !personale(t));
  const chosen = new Set(targets);
  const rows = keys.map(date => {
    const existing = all.filter(t => dataRecord(t) === date);
    const work = existing.filter(t => t.tipo === 'turno');
    const states = [];
    if (!existing.length) states.push('data-libera');
    if (work.length) states.push('turno-presente');
    if (work.length > 1) states.push('multipli');
    if (existing.some(t => t.tipo !== 'turno')) states.push('assenza');
    if (work.some(notturno)) states.push('notturno');
    const row = { date, states, blocked: false, reason: '', candidate: null,
      existing: existing.map(descrivi), conflicts: [], choices: [], operations: [] };
    const block = reason => { row.blocked = true; row.reason = reason; if (!states.includes('vietata')) states.push('vietata'); };
    if (!dataValida(date)) { block('Data non valida.'); return row; }
    if (mode === 'delete') {
      row.choices = work.map(t => {
        const description = descrivi(t);
        const identifiable = !!description.key && all.filter(other => other.id != null && String(other.id) === String(t.id)).length === 1;
        return { ...description, identifiable, selected: identifiable && chosen.has(description.key) };
      });
      row.operations = row.choices.filter(t => t.selected).map(t => ({ action: 'delete', ...t }));
      if (!row.choices.some(t => t.identifiable)) block('Nessun turno lavorativo identificabile da eliminare. Riposi, assenze e appuntamenti restano esclusi.');
      else if (!row.operations.length) block('Scegli esplicitamente almeno un servizio di questa data.');
      return row;
    }
    if (mode !== 'insert') { block('Modalità non valida.'); return row; }
    const t = candidato(model, date);
    const interval = t && intervallo(t);
    if (!interval) { block('Modello mancante o non valido.'); return row; }
    row.candidate = descrivi(t);
    if (notturno(t) && !states.includes('notturno')) states.push('notturno');
    for (const other of all) {
      const otherInterval = intervallo(other);
      if (sovrapposti(interval, otherInterval)) {
        row.conflicts.push(descrivi(other));
        if (other.tipo !== 'turno' && !states.includes('assenza')) states.push('assenza');
        const duplicate = other.tipo === t.tipo && dataRecord(other) === date &&
          interval.inizio === otherInterval.inizio && interval.fine === otherInterval.fine;
        const state = duplicate ? 'duplicato' : 'sovrapposizione';
        if (!states.includes(state)) states.push(state);
        block(duplicate ? 'Duplicato: nessun nuovo turno può essere proposto.' : 'Conflitto con un servizio, un riposo o un’assenza. Nessuna sostituzione automatica.');
      } else if (other.tipo === 'turno' && !otherInterval && (!dataValida(dataRecord(other)) ||
          Math.abs(Date.parse(`${dataRecord(other)}T00:00:00Z`) - interval.inizio) <= 86400000)) {
        block('Un servizio vicino alla data ha orari non validi: verifica manuale necessaria.');
      }
    }
    if (!row.blocked) row.operations.push({ action: 'insert', ...row.candidate });
    return row;
  });
  // Si verificano anche le proposte tra loro, senza cambiare i record sorgente.
  for (let i = 0; mode === 'insert' && i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const a = candidato(model, rows[i].date), b = candidato(model, rows[j].date);
    if (a && b && sovrapposti(intervallo(a), intervallo(b))) for (const row of [rows[i], rows[j]]) {
      row.blocked = true; row.operations = []; row.reason = 'Le date proposte generano servizi sovrapposti.';
      if (!row.states.includes('sovrapposizione')) row.states.push('sovrapposizione');
      if (!row.states.includes('vietata')) row.states.push('vietata');
    }
  }
  const blocked = rows.filter(r => r.blocked).length;
  const operationCount = rows.reduce((sum, r) => sum + r.operations.length, 0);
  return {
    mode, model: model ? { id: String(model.id || ''), nome: model.nome || '', tipo: model.tipo || 'turno',
      inizio: model.inizio || '', fine: model.fine || '', operativita: model.operativita || '', postazione: model.postazione || '' } : null,
    rows, blocked, operationCount,
    canConfirm: rows.length > 0 && !blocked && operationCount > 0,
  };
}
