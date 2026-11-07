'use strict';

// Prototipo puro: nessun import, I/O, tariffa o collegamento con l'app.
const DAY = 86400000;
const MINUTE = 60000;
const FIELDS = ['durationMs', 'workedMs', 'classifiableMs', 'ordinaryMs',
  'overtimeMs', 'nightMs', 'sundayMs', 'holidayMs', 'restWorkedMs'];
const POLICIES = ['shiftStartDateAfterContextClassification', 'civilDateAfterContextClassification'];
const RECORD_FIELDS = new Set(['id', 'anno', 'mese', 'giorno', 'tipo', 'inizio', 'fine',
  'ore', 'extra', 'minuti_aggiuntivi_retribuiti', 'straordinario_manuale_minuti',
  'riposo_lavorato', 'fascia', 'user_id', 'luogo', 'indirizzo_servizio',
  'localita_meteo', 'created_at', 'updated_at']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const key = value => new Date(value).toISOString().slice(0, 10);
const monday = value => value - ((new Date(value).getUTCDay() + 6) % 7) * DAY;
function check(condition, code) { if (!condition) throw new Error(code); }
function date(value) {
  check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'INVALID_DATE');
  const ms = Date.parse(value + 'T00:00:00Z');
  check(Number.isFinite(ms) && key(ms) === value && value >= '2000-01-01' && value <= '2099-12-31', 'INVALID_DATE');
  return ms;
}
function number(value, code) {
  check(typeof value === 'number' || typeof value === 'string' && /^(0|[1-9]\d*)(\.\d+)?$/.test(value), code);
  const n = Number(value);
  check(Number.isFinite(n) && n >= 0, code);
  return n;
}
function integer(value, code) {
  const n = number(value, code);
  check(Number.isSafeInteger(n), code);
  return n;
}
function ticks(n, multiplier, code) {
  const raw = n * multiplier, rounded = Math.round(raw);
  // Solo rumore di rappresentazione binaria, non tolleranza su ore discordanti.
  check(Number.isSafeInteger(rounded) && Math.abs(raw - rounded) <=
    4 * Number.EPSILON * Math.max(1, Math.abs(raw)), code);
  return rounded;
}
function clock(value) {
  // I produttori app lavorano al minuto; il backend può restituire secondi zero.
  check(typeof value === 'string' && /^\d{2}:\d{2}(?::00(?:\.0{1,6})?)?$/.test(value), 'INVALID_OR_UNSUPPORTED_TIME');
  const [h, m] = value.split(':').map(Number);
  check(h < 24 && m < 60, 'INVALID_OR_UNSUPPORTED_TIME');
  return { text: value.slice(0, 5), ms: (h * 60 + m) * MINUTE };
}
function readOptions(options) {
  check(object(options), 'OPTIONS_REQUIRED');
  check(options.operator === 'gpg', 'OPERATOR_NOT_SUPPORTED');
  check(options.civilTimeComparable === true, 'CIVIL_TIME_REVIEW_REQUIRED');
  check(options.holidaysComplete === true, 'HOLIDAY_CALENDAR_REVIEW_REQUIRED');
  check(typeof options.period === 'string' && /^20\d{2}-\d{2}$/.test(options.period), 'INVALID_PERIOD');
  const start = date(options.period + '-01');
  const d = new Date(start);
  const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  check(POLICIES.includes(options.periodPolicy), 'PERIOD_POLICY_REQUIRED');
  const h = options.hours;
  check(object(h) && ['giornaliero', 'settimanale'].includes(h.mode) &&
    ['shiftDate', 'civilDate'].includes(h.thresholdBasis) && h.timeBasis === 'civil', 'INVALID_HOURS_CONFIG');
  check(typeof h.thresholdMinutes === 'number', 'INVALID_THRESHOLD');
  ticks(number(h.thresholdMinutes, 'INVALID_THRESHOLD'), MINUTE, 'INVALID_THRESHOLD');
  check(Array.isArray(h.night) && h.night.length === 2, 'INVALID_NIGHT');
  const night = h.night.map(clock);
  check(night[0].ms !== night[1].ms, 'INVALID_NIGHT');
  check(Array.isArray(h.holidays), 'INVALID_HOLIDAYS');
  h.holidays.forEach(date);
  check(new Set(h.holidays).size === h.holidays.length, 'DUPLICATE_HOLIDAY');
  // Intervallo di copertura riferito alle DATE DI INIZIO dei record.
  let firstBucket = start - (options.periodPolicy === POLICIES[1] ? DAY : 0);
  let lastBucket = end - DAY;
  if (h.thresholdBasis === 'civilDate' && options.periodPolicy === POLICIES[0]) lastBucket = end;
  if (h.mode === 'settimanale') {
    firstBucket = monday(firstBucket);
    lastBucket = monday(lastBucket) + 6 * DAY;
  }
  // Include i servizi iniziati prima del primo giorno/settimana civile utile.
  const requiredFrom = firstBucket - (h.thresholdBasis === 'civilDate' ? DAY : 0);
  check(requiredFrom >= Date.parse('2000-01-01T00:00:00Z') &&
    lastBucket <= Date.parse('2099-12-31T00:00:00Z'), 'CONTEXT_OUT_OF_SUPPORTED_RANGE');
  return { start, end, requiredFrom, requiredTo: lastBucket,
    hours: { mode: h.mode, thresholdBasis: h.thresholdBasis, timeBasis: 'civil',
      thresholdMinutes: h.thresholdMinutes, night: night.map(v => v.text), holidays: [...h.holidays] } };
}

/**
 * snapshot = {records, coverage:{from,to,complete:true}, localizedEvents?:[]}
 * localizedEvents è evidenza esterna esplicita, NON un campo già presente nell'app:
 * [{sourceIndex, reviewed:true, reference:'DOC1', events:[{type,fromMinutes,toMinutes}]}]
 * complete significa normalizzabile per il Blocco 1, mai equivalenza contrattuale.
 */
function adaptCalendar(snapshot, options) {
  const issues = [], warnings = [], decisions = [], shifts = [], intervals = [];
  const note = (code, sourceIndex) => warnings.push({ code, ...(sourceIndex === undefined ? {} : { sourceIndex }) });
  const result = (complete, requiredCoverage = null, hours = null) => ({
    version: 1, complete, scope: 'gpgCalendarHoursOnly',
    legacyComparable: false, // Nessuna equivalenza legacy o economica certificata.
    issues, warnings, decisions, requiredCoverage, hours: complete ? hours : null,
    shifts: complete ? shifts : [], periodResult: null,
  });
  let cfg;
  try {
    cfg = readOptions(options);
    check(object(snapshot) && Array.isArray(snapshot.records), 'RECORD_ARRAY_REQUIRED');
    const coverage = snapshot.coverage;
    check(object(coverage) && coverage.complete === true, 'CONTEXT_COMPLETENESS_REQUIRED');
    const from = date(coverage.from), to = date(coverage.to);
    check(from <= to, 'INVALID_COVERAGE');
    check(from <= cfg.requiredFrom && to >= cfg.requiredTo, 'INSUFFICIENT_CONTEXT_COVERAGE');
    check(snapshot.localizedEvents === undefined || Array.isArray(snapshot.localizedEvents), 'INVALID_EVENT_EVIDENCE');
    const owners = snapshot.records.filter(object).map(r => r.user_id ?? null);
    check(owners.every(v => v === null || typeof v === 'string' && v.trim().length > 0), 'INVALID_OWNER_METADATA');
    check(new Set(owners).size <= 1, 'MIXED_OR_UNKNOWN_RECORD_OWNER');
  } catch (error) {
    issues.push({ code: error.message });
    return result(false, cfg ? { from: key(cfg.requiredFrom), to: key(cfg.requiredTo) } : null);
  }
  const required = { from: key(cfg.requiredFrom), to: key(cfg.requiredTo) };
  const evidence = new Map();
  for (const entry of snapshot.localizedEvents || []) {
    try {
      check(object(entry) && Number.isSafeInteger(entry.sourceIndex) && entry.sourceIndex >= 0 &&
        entry.sourceIndex < snapshot.records.length && !evidence.has(entry.sourceIndex), 'INVALID_EVENT_EVIDENCE');
      check(entry.reviewed === true && typeof entry.reference === 'string' &&
        /^DOC[1-9]\d*$/.test(entry.reference) && Array.isArray(entry.events), 'EVENT_REVIEW_REQUIRED');
      check(Object.keys(entry).every(k => ['sourceIndex', 'reviewed', 'reference', 'events'].includes(k)), 'UNKNOWN_EVENT_EVIDENCE_FIELD');
      evidence.set(entry.sourceIndex, entry);
    } catch (error) { issues.push({ code: error.message }); }
  }
  const ids = new Set();
  for (let sourceIndex = 0; sourceIndex < snapshot.records.length; sourceIndex++) {
    const record = snapshot.records[sourceIndex];
    try {
      check(object(record), 'INVALID_RECORD');
      check(Object.keys(record).every(k => RECORD_FIELDS.has(k)), 'UNKNOWN_RECORD_FIELD');
      const sourceId = record.id;
      check(typeof sourceId === 'string' && sourceId.trim().length > 0 ||
        typeof sourceId === 'number' && Number.isSafeInteger(sourceId) && sourceId >= 0, 'INVALID_SOURCE_ID');
      check(!ids.has(String(sourceId)), 'DUPLICATE_SOURCE_ID');
      ids.add(String(sourceId));
      const y = integer(record.anno, 'INVALID_DATE'), m = integer(record.mese, 'INVALID_DATE'),
        d = integer(record.giorno, 'INVALID_DATE');
      const dayText = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const day = date(dayText);
      check(dayText >= snapshot.coverage.from && dayText <= snapshot.coverage.to, 'RECORD_OUTSIDE_DECLARED_COVERAGE');
      check(record.riposo_lavorato == null || typeof record.riposo_lavorato === 'boolean', 'INVALID_REST_FLAG');
      const additional = record.minuti_aggiuntivi_retribuiti == null ? 0 :
        number(record.minuti_aggiuntivi_retribuiti, 'INVALID_ADDITIONAL_MINUTES');
      check(additional === 0, 'UNLOCALIZED_PAID_EXTRA');
      const saved = record.ore == null ? null : number(record.ore, 'INVALID_SAVED_DURATION');
      const manual = record.straordinario_manuale_minuti == null ? null :
        integer(record.straordinario_manuale_minuti, 'INVALID_MANUAL_OVERTIME');
      const extra = record.extra == null ? null : number(record.extra, 'INVALID_LEGACY_EXTRA');
      if (record.tipo === 'riposo') {
        check(record.inizio == null && record.fine == null && (saved === null || saved === 0) &&
          (extra === null || extra === 0) && manual === null && record.riposo_lavorato !== true &&
          !evidence.has(sourceIndex), 'INCONSISTENT_NONWORK_RECORD');
        decisions.push({ sourceIndex, action: 'excluded', reason: 'EXPLICIT_NONWORK_REST' });
        continue;
      }
      check(record.tipo === 'turno', 'NONWORK_CAUSE_NOT_SUPPORTED');
      const start = clock(record.inizio), end = clock(record.fine);
      check(start.ms !== end.ms, 'AMBIGUOUS_ZERO_OR_24H');
      const duration = end.ms > start.ms ? end.ms - start.ms : DAY - start.ms + end.ms;
      if (saved !== null && saved > 0) {
        check(ticks(saved, 3600000, 'SAVED_DURATION_PRECISION') === duration, 'SAVED_DURATION_MISMATCH');
      } else note('DURATION_FROM_CLOCKS_LEGACY_WEEKLY_REVIEW', sourceIndex);
      if (extra !== null) note('LEGACY_EXTRA_IS_NOT_MANUAL_OVERRIDE', sourceIndex);
      if (record.riposo_lavorato === true) note('REST_THRESHOLD_DIFFERS_FROM_LEGACY', sourceIndex);
      if (record.riposo_lavorato === true && manual !== null) note('REST_MANUAL_NOT_ALLOWED_BY_APP_EDITOR', sourceIndex);
      const entry = evidence.get(sourceIndex);
      const events = (entry?.events || []).map(event => {
        check(object(event) && Object.keys(event).every(k => ['type', 'fromMinutes', 'toMinutes'].includes(k)) &&
          ['paidBreak', 'unpaidBreak', 'paidTransfer'].includes(event.type), 'INVALID_LOCALIZED_EVENT');
        check(typeof event.fromMinutes === 'number' && typeof event.toMinutes === 'number', 'INVALID_EVENT_POSITION');
        const from = ticks(number(event.fromMinutes, 'INVALID_EVENT_POSITION'), MINUTE, 'INVALID_EVENT_PRECISION');
        const to = ticks(number(event.toMinutes, 'INVALID_EVENT_POSITION'), MINUTE, 'INVALID_EVENT_PRECISION');
        check(from < to && to <= duration, 'EVENT_OUTSIDE_SHIFT');
        return { type: event.type, fromMinutes: event.fromMinutes, toMinutes: event.toMinutes };
      }).sort((a, b) => a.fromMinutes - b.fromMinutes);
      check(!events.some((event, i) => i && event.fromMinutes < events[i - 1].toMinutes), 'OVERLAPPING_EVENTS');
      const unpaid = events.filter(e => e.type === 'unpaidBreak')
        .reduce((n, e) => n + ticks(e.toMinutes, MINUTE, 'INVALID_EVENT_PRECISION') -
          ticks(e.fromMinutes, MINUTE, 'INVALID_EVENT_PRECISION'), 0);
      check(manual === null || ticks(manual, MINUTE, 'INVALID_MANUAL_OVERTIME') <= duration - unpaid, 'MANUAL_EXCEEDS_PAID_DURATION');
      const id = 'S' + String(sourceIndex + 1).padStart(6, '0');
      shifts.push({ id, date: dayText, start: start.text, end: end.text,
        restWorked: record.riposo_lavorato === true, manualOvertimeMinutes: manual, events });
      intervals.push({ sourceIndex, start: day + start.ms, end: day + start.ms + duration });
      decisions.push({ sourceIndex, shiftId: id, action: 'normalized', durationMs: duration,
        savedDuration: saved === null ? 'absent' : saved === 0 ? 'zeroFallback' : 'matchesClocks',
        manual: manual === null ? 'automatic' : 'explicit',
        ...(entry ? { eventReference: entry.reference } : {}) });
    } catch (error) { issues.push({ sourceIndex, code: error.message }); }
  }
  intervals.sort((a, b) => a.start - b.start || a.sourceIndex - b.sourceIndex);
  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length && intervals[j].start < intervals[i].end; j++) {
      issues.push({ sourceIndex: intervals[i].sourceIndex,
        otherSourceIndex: intervals[j].sourceIndex, code: 'OVERLAPPING_SHIFTS' });
    }
  }
  note('COVERAGE_AND_HOLIDAYS_ARE_CALLER_DECLARATIONS');
  note('CIVIL_TIME_NOT_ELAPSED_TIME_CERTIFICATION');
  note('NO_PAYROLL_OR_LEGACY_EQUIVALENCE_CERTIFICATION');
  return result(issues.length === 0, required, cfg.hours);
}

/** Classifica TUTTO il contesto e soltanto dopo seleziona i segmenti del periodo. */
function classifySnapshot(snapshot, options, classifyHours) {
  const adapted = adaptCalendar(snapshot, options);
  if (!adapted.complete) return adapted;
  const fail = code => ({ ...adapted, complete: false, shifts: [], hours: null,
    periodResult: null, issues: [{ code }] });
  if (typeof classifyHours !== 'function') return fail('CLASSIFIER_REQUIRED');
  let classification;
  try { classification = classifyHours(adapted.shifts, adapted.hours); }
  catch { return fail('CLASSIFIER_REJECTED_INPUT'); }
  if (!classification || classification.version !== 1 || classification.complete !== true ||
    !Array.isArray(classification.segments) || !classification.totals) return fail('CLASSIFIER_INCOMPLETE');
  const dates = new Map(adapted.shifts.map(s => [s.id, s.date]));
  const segments = classification.segments.filter(s => {
    const attributedDate = options.periodPolicy === POLICIES[0] ? dates.get(s.shiftId) : s.date;
    return typeof attributedDate === 'string' && attributedDate.slice(0, 7) === options.period;
  });
  const totals = Object.fromEntries(FIELDS.map(field => [field, segments.reduce((n, s) => n + s[field], 0)]));
  return { ...adapted, periodResult: { version: 1, complete: true,
    period: options.period, periodPolicy: options.periodPolicy, segments,
    warnings: [...(classification.warnings || [])], totals } };
}

module.exports = { adaptCalendar, classifySnapshot };
