'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { adaptCalendar, classifySnapshot } = require('./adattatoreCalendario.cjs');
const { classifyHours } = require('./classificaOre.cjs');
const HOUR = 3600000;
const row = patch => ({ id: 'TEST1', anno: 2030, mese: 4, giorno: 1, tipo: 'turno',
  inizio: '06:00', fine: '14:00', ore: 8, extra: 1,
  minuti_aggiuntivi_retribuiti: 0, straordinario_manuale_minuti: null,
  riposo_lavorato: false, ...patch });
const options = patch => ({ operator: 'gpg', period: '2030-04',
  periodPolicy: 'shiftStartDateAfterContextClassification', civilTimeComparable: true,
  holidaysComplete: true, hours: { mode: 'giornaliero', thresholdMinutes: 420,
    thresholdBasis: 'shiftDate', timeBasis: 'civil', night: ['22:00', '06:00'], holidays: [] }, ...patch });
const snapshot = (records = [row()], patch = {}) => ({ records,
  coverage: { from: '2030-03-01', to: '2030-06-30', complete: true }, ...patch });
const run = (records = [row()], opts = options(), patch = {}) => classifySnapshot(snapshot(records, patch), opts, classifyHours);
function good(result) { assert.equal(result.complete, true, JSON.stringify(result.issues)); return result; }
function bad(result, code) {
  assert.equal(result.complete, false);
  assert.deepEqual(result.shifts, []);
  assert.equal(result.periodResult, null);
  assert.ok(result.issues.some(i => i.code === code), JSON.stringify(result.issues));
}
const hasWarning = (r, code) => r.warnings.some(w => w.code === code);
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

test('ordinario: 8 retribuite, 7 ordinarie e 1 extra; compatibilità reale Blocco 1', () => {
  const r = good(run());
  assert.equal(r.periodResult.totals.classifiableMs, 8 * HOUR);
  assert.equal(r.periodResult.totals.ordinaryMs, 7 * HOUR);
  assert.equal(r.periodResult.totals.overtimeMs, HOUR);
  assert.equal(r.legacyComparable, false);
});
test('notte oltre mezzanotte: fascia completa di 8 ore', () => {
  const r = good(run([row({ inizio: '22:00', fine: '06:00' })]));
  assert.equal(r.periodResult.totals.nightMs, 8 * HOUR);
  assert.deepEqual([...new Set(r.periodResult.segments.map(s => s.date))], ['2030-04-01', '2030-04-02']);
});
test('due turni stesso giorno: un solo cumulo e nessun trasferimento inventato nel vuoto', () => {
  const r = good(run([row({ fine: '10:00', ore: 4 }), row({ id: 'TEST2', inizio: '12:00', fine: '18:00', ore: 6 })]));
  assert.equal(r.periodResult.totals.classifiableMs, 10 * HOUR);
  assert.equal(r.periodResult.totals.overtimeMs, 3 * HOUR);
  assert.ok(r.shifts.every(s => s.events.length === 0));
});
test('ordine input invertito: stesse quantità', () => {
  const a = row({ fine: '10:00', ore: 4 }), b = row({ id: 'TEST2', inizio: '12:00', fine: '18:00', ore: 6 });
  assert.deepEqual(good(run([a, b])).periodResult.totals, good(run([b, a])).periodResult.totals);
});
test('override 4 ore 45 minuti preservato senza usare extra', () => {
  const r = good(run([row({ straordinario_manuale_minuti: 285, extra: 0 })]));
  assert.equal(r.shifts[0].manualOvertimeMinutes, 285);
  assert.equal(r.periodResult.totals.overtimeMs, 285 * 60000);
});
test('zero manuale esplicito distinto da assente e null', () => {
  assert.equal(good(run([row({ straordinario_manuale_minuti: 0 })])).periodResult.totals.overtimeMs, 0);
  const absent = row(); delete absent.straordinario_manuale_minuti;
  assert.equal(good(run([absent])).periodResult.totals.overtimeMs, HOUR);
  assert.equal(good(run()).shifts[0].manualOvertimeMinutes, null);
});
test('override non altera il cumulo per il turno successivo', () => {
  const r = good(run([row({ straordinario_manuale_minuti: 0 }),
    row({ id: 'TEST2', inizio: '16:00', fine: '18:00', ore: 2 })]));
  assert.equal(r.periodResult.totals.overtimeMs, 2 * HOUR);
});
test('extra storico non viene promosso a override', () => {
  const r = good(run([row({ extra: 4.75 })]));
  assert.equal(r.periodResult.totals.overtimeMs, HOUR);
  assert.ok(hasWarning(r, 'LEGACY_EXTRA_IS_NOT_MANUAL_OVERRIDE'));
});
test('numeri persistiti come stringhe e ore backend HH:mm:00', () => {
  const r = good(run([row({ anno: '2030', mese: '4', giorno: '1', ore: '8',
    inizio: '06:00:00', fine: '14:00:00.000000', straordinario_manuale_minuti: '0' })]));
  assert.equal(r.shifts[0].start, '06:00');
  assert.equal(r.shifts[0].manualOvertimeMinutes, 0);
});
test('ore assenti o zero: fallback esplicito agli orari, avviso sulla modalità settimanale legacy', () => {
  for (const ore of [null, undefined, 0, '0']) {
    const r = good(run([row({ ore })]));
    assert.equal(r.periodResult.totals.durationMs, 8 * HOUR);
    assert.ok(hasWarning(r, 'DURATION_FROM_CLOCKS_LEGACY_WEEKLY_REVIEW'));
  }
});
test('durata storica frazionaria al minuto: accetta soltanto rumore binario', () => {
  assert.equal(good(run([row({ fine: '13:59', ore: 479 / 60 })])).periodResult.totals.durationMs, 479 * 60000);
  bad(run([row({ ore: 8 + 1 / HOUR })]), 'SAVED_DURATION_MISMATCH');
});
test('riposo lavorato conservato come attributo con divergenza legacy dichiarata', () => {
  const r = good(run([row({ riposo_lavorato: true })]));
  assert.equal(r.periodResult.totals.restWorkedMs, 8 * HOUR);
  assert.equal(r.periodResult.totals.overtimeMs, HOUR);
  assert.ok(hasWarning(r, 'REST_THRESHOLD_DIFFERS_FROM_LEGACY'));
});
test('riposo non lavorato esplicito escluso e spiegato; non produce ore', () => {
  const r = good(run([row({ tipo: 'riposo', inizio: null, fine: null, ore: 0, extra: 0 })]));
  assert.equal(r.shifts.length, 0);
  assert.equal(r.periodResult.totals.classifiableMs, 0);
  assert.equal(r.decisions[0].reason, 'EXPLICIT_NONWORK_REST');
});
test('domenica e festivo derivati dal segmento civile e dal calendario esplicito', () => {
  const opts = options(); opts.hours.holidays = ['2030-04-07'];
  const r = good(run([row({ giorno: 6, inizio: '22:00', fine: '06:00' })], opts));
  assert.equal(r.periodResult.totals.sundayMs, 6 * HOUR);
  assert.equal(r.periodResult.totals.holidayMs, 6 * HOUR);
  assert.equal(r.periodResult.totals.durationMs, 8 * HOUR); // niente doppio conteggio
});
test('nessuna festività aggiunta automaticamente', () => {
  assert.equal(good(run([row({ giorno: 25 })])).periodResult.totals.holidayMs, 0);
});
test('confine mensile per data iniziale: conserva anche le ore del mese successivo', () => {
  const r = good(run([row({ giorno: 30, inizio: '22:00', fine: '06:00' })]));
  assert.equal(r.periodResult.totals.durationMs, 8 * HOUR);
  assert.ok(r.periodResult.segments.some(s => s.date === '2030-05-01'));
});
test('competenza civile: include quota entrante e taglia quella uscente soltanto dopo classificazione', () => {
  const r = good(run([row({ mese: 3, giorno: 31, inizio: '22:00', fine: '06:00' }),
    row({ id: 'TEST2', giorno: 30, inizio: '22:00', fine: '06:00' })],
  options({ periodPolicy: 'civilDateAfterContextClassification' })));
  assert.equal(r.shifts.length, 2);
  assert.equal(r.periodResult.totals.durationMs, 8 * HOUR); // 6 entranti + 2 uscenti
  assert.ok(r.periodResult.segments.every(s => s.date.startsWith('2030-04')));
});
test('settimana a cavallo mese: il lavoro precedente influenza gli extra del mese selezionato', () => {
  const opts = options({ period: '2030-05' });
  opts.hours.mode = 'settimanale'; opts.hours.thresholdMinutes = 24 * 60;
  const r = good(run([row({ giorno: 29, ore: 12, fine: '18:00' }),
    row({ id: 'TEST2', giorno: 30, ore: 12, fine: '18:00' }),
    row({ id: 'TEST3', mese: 5, giorno: 1, ore: 12, fine: '18:00' })], opts));
  assert.equal(r.periodResult.totals.overtimeMs, 12 * HOUR);
  assert.equal(r.periodResult.totals.durationMs, 12 * HOUR);
  assert.deepEqual(r.requiredCoverage, { from: '2030-04-29', to: '2030-06-02' });
});
test('civile e soglia per data iniziale: contesto precedente necessario per classificare il turno entrante', () => {
  const opts = options({ periodPolicy: 'civilDateAfterContextClassification' });
  opts.hours.mode = 'settimanale'; opts.hours.thresholdMinutes = 40 * 60;
  const records = Array.from({ length: 6 }, (_, i) => row({ id: 'TEST' + i, mese: 3, giorno: 25 + i }));
  records.push(row({ id: 'TEST7', mese: 3, giorno: 31, inizio: '22:00', fine: '06:00' }));
  assert.equal(good(run(records, opts)).periodResult.totals.overtimeMs, 6 * HOUR);
});
test('soglia civile: il turno iniziato prima del lunedì concorre alla settimana successiva', () => {
  const opts = options(); opts.hours.mode = 'settimanale';
  opts.hours.thresholdBasis = 'civilDate'; opts.hours.thresholdMinutes = 6 * 60;
  const r = good(run([row({ mese: 3, giorno: 31, inizio: '22:00', fine: '06:00' }), row({ id: 'TEST2' })], opts));
  assert.equal(r.periodResult.totals.overtimeMs, 8 * HOUR);
  assert.equal(r.requiredCoverage.from, '2030-03-31');
});
test('soglia civile mensile: include i servizi del giorno successivo utili al cumulo', () => {
  const opts = options(); opts.hours.thresholdBasis = 'civilDate';
  const r = good(run([row({ giorno: 30, inizio: '22:00', fine: '06:00' }),
    row({ id: 'TEST2', mese: 5, giorno: 1, inizio: '06:00', fine: '08:00', ore: 2 })], opts));
  assert.equal(r.requiredCoverage.to, '2030-05-01');
  assert.equal(r.shifts.length, 2);
  assert.equal(r.periodResult.totals.durationMs, 8 * HOUR);
  assert.equal(r.periodResult.totals.overtimeMs, 0);
});

const localized = events => ({ localizedEvents: [{ sourceIndex: 0, reviewed: true, reference: 'DOC1', events }] });
test('pause e trasferimento localizzati: lavoro fisico distinto da retribuito', () => {
  const r = good(run(undefined, undefined, localized([
    { type: 'paidBreak', fromMinutes: 60, toMinutes: 90 },
    { type: 'paidTransfer', fromMinutes: 120, toMinutes: 135 },
    { type: 'unpaidBreak', fromMinutes: 180, toMinutes: 210 },
  ])));
  assert.equal(r.periodResult.totals.workedMs, 405 * 60000);
  assert.equal(r.periodResult.totals.classifiableMs, 450 * 60000);
  assert.equal(r.decisions[0].eventReference, 'DOC1');
});
test('nessuna evidenza di eventi: non si sottrae una pausa presunta', () => {
  assert.equal(good(run()).periodResult.totals.workedMs, 8 * HOUR);
});
test('override oltre la durata retribuita dopo pausa non pagata rifiutato', () => {
  bad(run([row({ straordinario_manuale_minuti: 480 })], undefined,
    localized([{ type: 'unpaidBreak', fromMinutes: 60, toMinutes: 90 }])), 'MANUAL_EXCEEDS_PAID_DURATION');
});

const invalidRecords = [
  ['durata salvata discordante', { ore: 7.5 }, 'SAVED_DURATION_MISMATCH'],
  ['trasferimento/stacco aggiuntivo senza collocazione', { minuti_aggiuntivi_retribuiti: 15 }, 'UNLOCALIZED_PAID_EXTRA'],
  ['aggiuntivi negativi', { minuti_aggiuntivi_retribuiti: -1 }, 'INVALID_ADDITIONAL_MINUTES'],
  ['orario mancante', { inizio: null }, 'INVALID_OR_UNSUPPORTED_TIME'],
  ['data non esistente', { giorno: 31 }, 'INVALID_DATE'],
  ['anno fuori perimetro', { anno: 1999 }, 'INVALID_DATE'],
  ['ora invalida', { fine: '25:00' }, 'INVALID_OR_UNSUPPORTED_TIME'],
  ['secondi non zero non comparabili agli helper al minuto', { fine: '14:00:01' }, 'INVALID_OR_UNSUPPORTED_TIME'],
  ['ora zero oppure 24 ore ambigue', { fine: '06:00' }, 'AMBIGUOUS_ZERO_OR_24H'],
  ['override superiore alla durata', { straordinario_manuale_minuti: 481 }, 'MANUAL_EXCEEDS_PAID_DURATION'],
  ['override negativo', { straordinario_manuale_minuti: -1 }, 'INVALID_MANUAL_OVERTIME'],
  ['override frazionario', { straordinario_manuale_minuti: 1.5 }, 'INVALID_MANUAL_OVERTIME'],
  ['override booleano', { straordinario_manuale_minuti: false }, 'INVALID_MANUAL_OVERTIME'],
  ['durata malformata', { ore: '' }, 'INVALID_SAVED_DURATION'],
  ['durata non finita', { ore: Infinity }, 'INVALID_SAVED_DURATION'],
  ['riposo flag non booleano', { riposo_lavorato: 'true' }, 'INVALID_REST_FLAG'],
  ['causale congedo', { tipo: 'congedo80' }, 'NONWORK_CAUSE_NOT_SUPPORTED'],
  ['causale assente', { tipo: undefined }, 'NONWORK_CAUSE_NOT_SUPPORTED'],
  ['campo intervalli app non documentato', { pause: [] }, 'UNKNOWN_RECORD_FIELD'],
  ['identificativo mancante', { id: null }, 'INVALID_SOURCE_ID'],
];
for (const [name, patch, code] of invalidRecords) test('rifiuto: ' + name, () => bad(run([row(patch)]), code));
test('un record invalido impedisce di pubblicare il lotto parziale valido', () => {
  bad(run([row(), row({ id: 'TEST2', giorno: 2, fine: null })]), 'INVALID_OR_UNSUPPORTED_TIME');
});
test('duplicati ID anche tra stringa e numero rifiutati', () => {
  bad(run([row({ id: 1 }), row({ id: '1', giorno: 2 })]), 'DUPLICATE_SOURCE_ID');
});
test('sovrapposizione fisica oltre mezzanotte rifiutata', () => {
  bad(run([row({ inizio: '22:00', fine: '06:00' }),
    row({ id: 'TEST2', giorno: 2, inizio: '05:00', fine: '07:00', ore: 2 })]), 'OVERLAPPING_SHIFTS');
});
test('record nullo e snapshot non valido rifiutati', () => {
  bad(run([null]), 'INVALID_RECORD');
  bad(adaptCalendar(null, options()), 'RECORD_ARRAY_REQUIRED');
});
test('riposo dichiarato ma contenente lavoro non viene scartato', () => {
  bad(run([row({ tipo: 'riposo' })]), 'INCONSISTENT_NONWORK_RECORD');
});
test('nessun record: zero solo con contesto esplicitamente completo', () => {
  assert.equal(good(run([])).periodResult.totals.durationMs, 0);
  bad(run([], undefined, { coverage: { from: '2030-04-01', to: '2030-04-30' } }), 'CONTEXT_COMPLETENESS_REQUIRED');
});
test('contesto settimanale incompleto ai bordi rifiutato', () => {
  const opts = options({ period: '2030-05' }); opts.hours.mode = 'settimanale';
  bad(run([], opts, { coverage: { from: '2030-05-01', to: '2030-05-31', complete: true } }), 'INSUFFICIENT_CONTEXT_COVERAGE');
});
test('contesto civile privo del giorno precedente rifiutato', () => {
  const opts = options(); opts.hours.thresholdBasis = 'civilDate';
  bad(run([], opts, { coverage: { from: '2030-04-01', to: '2030-05-01', complete: true } }), 'INSUFFICIENT_CONTEXT_COVERAGE');
});
test('record fuori copertura dichiarata rifiutato', () => {
  bad(run([row({ mese: 2 })]), 'RECORD_OUTSIDE_DECLARED_COVERAGE');
});
test('revisione base temporale e calendario festivo obbligatoria', () => {
  bad(run(undefined, options({ civilTimeComparable: false })), 'CIVIL_TIME_REVIEW_REQUIRED');
  bad(run(undefined, options({ holidaysComplete: false })), 'HOLIDAY_CALENDAR_REVIEW_REQUIRED');
});
test('Fiduciari non vengono simulati come GPG', () => bad(run(undefined,
  options({ operator: 'fiduciario' })), 'OPERATOR_NOT_SUPPORTED'));
test('politica di competenza esplicita obbligatoria', () => bad(run(undefined,
  options({ periodPolicy: null })), 'PERIOD_POLICY_REQUIRED'));
test('configurazioni ore invalide rifiutate prima del classificatore', () => {
  for (const patch of [{ mode: 'mensile' }, { thresholdBasis: null }, { timeBasis: 'utc' }]) {
    const opts = options(); Object.assign(opts.hours, patch);
    bad(run(undefined, opts), 'INVALID_HOURS_CONFIG');
  }
  const opts = options(); opts.hours.holidays = ['2030-02-30'];
  bad(run(undefined, opts), 'INVALID_DATE');
});
test('eventi senza revisione, duplicati o riferiti a indice assente rifiutati', () => {
  const e = localized([]).localizedEvents[0];
  bad(run(undefined, undefined, { localizedEvents: [{ ...e, reviewed: false }] }), 'EVENT_REVIEW_REQUIRED');
  bad(run(undefined, undefined, { localizedEvents: [e, e] }), 'INVALID_EVENT_EVIDENCE');
  bad(run(undefined, undefined, { localizedEvents: [{ ...e, sourceIndex: 9 }] }), 'INVALID_EVENT_EVIDENCE');
});
test('eventi fuori turno o sovrapposti rifiutati', () => {
  bad(run(undefined, undefined, localized([{ type: 'paidTransfer', fromMinutes: 470, toMinutes: 500 }])), 'EVENT_OUTSIDE_SHIFT');
  bad(run(undefined, undefined, localized([{ type: 'paidBreak', fromMinutes: 10, toMinutes: 30 },
    { type: 'paidTransfer', fromMinutes: 20, toMinutes: 40 }])), 'OVERLAPPING_EVENTS');
});
test('evidenza localizzata non trasforma in intervallo i minuti aggiuntivi', () => {
  bad(run([row({ minuti_aggiuntivi_retribuiti: 15 })], undefined,
    localized([{ type: 'paidTransfer', fromMinutes: 60, toMinutes: 75 }])), 'UNLOCALIZED_PAID_EXTRA');
});
test('input profondamente congelato, identico dopo normalizzazione e classificazione', () => {
  const input = freeze(snapshot([row()], localized([{ type: 'paidBreak', fromMinutes: 60, toMinutes: 90 }])));
  const opts = freeze(options());
  const before = JSON.stringify({ input, opts });
  good(classifySnapshot(input, opts, classifyHours));
  assert.equal(JSON.stringify({ input, opts }), before);
});
test('modificare output non modifica snapshot o configurazione', () => {
  const input = snapshot([row()], localized([{ type: 'paidBreak', fromMinutes: 60, toMinutes: 90 }]));
  const opts = options(); opts.hours.holidays = ['2030-04-07'];
  const r = good(classifySnapshot(input, opts, classifyHours));
  r.shifts[0].events[0].toMinutes = 80;
  r.hours.holidays.push('2030-04-08');
  assert.equal(input.localizedEvents[0].events[0].toMinutes, 90);
  assert.deepEqual(opts.hours.holidays, ['2030-04-07']);
});
test('metadati estranei al calcolo non transitano nell’output e nei messaggi', () => {
  const marker = 'SYNTHETIC_METADATA_TO_DISCARD';
  const input = snapshot([row({ id: marker, user_id: marker, luogo: marker,
    indirizzo_servizio: marker, localita_meteo: marker, fascia: marker })]);
  assert.ok(!JSON.stringify(good(classifySnapshot(input, options(), classifyHours))).includes(marker));
});
test('classificatore non disponibile, incompleto o che lancia non espone risultati parziali', () => {
  bad(classifySnapshot(snapshot(), options(), null), 'CLASSIFIER_REQUIRED');
  bad(classifySnapshot(snapshot(), options(), () => { throw Error('NON_ECHO'); }), 'CLASSIFIER_REJECTED_INPUT');
  bad(classifySnapshot(snapshot(), options(), () => ({ version: 1, complete: false, totals: null })), 'CLASSIFIER_INCOMPLETE');
});
test('determinismo e conservazione delle quantità in entrambe le politiche', () => {
  for (const periodPolicy of ['shiftStartDateAfterContextClassification', 'civilDateAfterContextClassification']) {
    const opts = options({ periodPolicy });
    const a = good(run(undefined, opts));
    assert.deepEqual(a, good(run(undefined, opts)));
    const t = a.periodResult.totals;
    assert.equal(t.ordinaryMs + t.overtimeMs, t.classifiableMs);
    assert.ok(t.workedMs <= t.durationMs);
  }
});
test('snapshot di account diversi o con proprietari misti non viene aggregato', () => {
  bad(run([row({ user_id: 'SYNTHETIC_OWNER_A' }),
    row({ id: 'TEST2', giorno: 2, user_id: 'SYNTHETIC_OWNER_B' })]), 'MIXED_OR_UNKNOWN_RECORD_OWNER');
  bad(run([row({ user_id: 'SYNTHETIC_OWNER_A' }),
    row({ id: 'TEST2', giorno: 2 })]), 'MIXED_OR_UNKNOWN_RECORD_OWNER');
});
test('stesso proprietario sintetico ammesso ma non esposto né autenticato dal prototipo', () => {
  const r = good(run([row({ user_id: 'SYNTHETIC_OWNER_A' })]));
  assert.ok(!JSON.stringify(r).includes('SYNTHETIC_OWNER_A'));
});
test('snapshot congelato rimane identico anche in caso di rifiuto', () => {
  const input = freeze(snapshot([row({ ore: 7.5 })]));
  const before = JSON.stringify(input);
  bad(classifySnapshot(input, freeze(options()), classifyHours), 'SAVED_DURATION_MISMATCH');
  assert.equal(JSON.stringify(input), before);
});
test('riposo con override preservato tecnicamente e segnalato come incompatibile con editor legacy', () => {
  const r = good(run([row({ riposo_lavorato: true, straordinario_manuale_minuti: 0 })]));
  assert.equal(r.shifts[0].manualOvertimeMinutes, 0);
  assert.ok(hasWarning(r, 'REST_MANUAL_NOT_ALLOWED_BY_APP_EDITOR'));
});
test('confine anno: la quota successiva resta assegnata alla data iniziale se richiesto', () => {
  const opts = options({ period: '2030-12' });
  const input = snapshot([row({ mese: 12, giorno: 31, inizio: '22:00', fine: '06:00' })],
    { coverage: { from: '2030-12-01', to: '2031-01-02', complete: true } });
  const r = good(classifySnapshot(input, opts, classifyHours));
  assert.equal(r.periodResult.totals.durationMs, 8 * HOUR);
  assert.ok(r.periodResult.segments.some(s => s.date === '2031-01-01'));
});
test('normalizzazione rifiuta campi mancanti anziché applicare i default del form app', () => {
  const record = row(); delete record.inizio;
  bad(run([record]), 'INVALID_OR_UNSUPPORTED_TIME');
});
test('normalizzatore non ha dipendenze o effetti esterni', () => {
  const source = require('node:fs').readFileSync(path.join(__dirname, 'adattatoreCalendario.cjs'), 'utf8');
  assert.doesNotMatch(source, /\brequire\s*\(|\bimport\s|\bfetch\s*\(|process\.|console\.|Date\.now\s*\(|new Date\(\)/);
});
