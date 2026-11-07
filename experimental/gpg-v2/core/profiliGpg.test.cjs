'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { validateProfile, validateCatalog, selectProfiles, prepareEconomyConfig } = require('./profiliGpg.cjs');
const { profile, request, premium, allowance, documentaryMetadataMock } = require('./fixtures-sintetiche.cjs');
const { classifyHours } = require('./classificaOre.cjs');
const { calculateEconomy } = require('./calcolaEconomia.cjs');
const { classifySnapshot } = require('./adattatoreCalendario.cjs');
const clone = v => JSON.parse(JSON.stringify(v));
function valid(p) { const r = validateProfile(p); assert.equal(r.valid, true, JSON.stringify(r.issues)); return r; }
function invalid(p, code) {
  const r = validateProfile(p); assert.equal(r.valid, false);
  assert.equal(r.hourlyEuro, null); assert.ok(r.issues.some(i => i.code === code), JSON.stringify(r.issues));
}
function unavailable(r, code) {
  assert.equal(r.available, false); assert.equal(r.config, null); assert.equal(r.realUseAuthorized, false);
  assert.ok(r.issues.some(i => i.code === code), JSON.stringify(r.issues));
}
function prepared(p = profile(), q = request()) {
  const r = prepareEconomyConfig([p], q); assert.equal(r.available, true, JSON.stringify(r.issues)); return r;
}
const hours = { mode: 'giornaliero', thresholdMinutes: 420, thresholdBasis: 'shiftDate',
  timeBasis: 'civil', night: ['22:00', '06:00'], holidays: [] };
const classification = () => classifyHours([{ id: 'SYN_SHIFT', date: '2030-04-01', start: '06:00', end: '14:00' }], hours);
function freeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }

test('profilo sintetico valido, senza autorizzazione per uso reale', () => {
  const r = valid(profile()); assert.equal(r.hourlyEuro, '10'); assert.equal(r.realUseAuthorized, false);
});
test('selezione corretta del livello, senza fallback', () => {
  const a = profile(), b = profile({ id: 'SYN_L2_PROFILE', level: 'SYN_L2' });
  const q = request(); q.assignments[0].level = 'SYN_L2';
  assert.equal(selectProfiles([a, b], q).segments[0].profileId, b.id);
  q.assignments[0].level = 'MISSING'; unavailable(selectProfiles([a, b], q), 'PROFILE_NOT_FOUND');
});
test('selezione corretta dell’azienda, senza profilo aziendale generico implicito', () => {
  const a = profile(), b = profile({ id: 'SYN_B_PROFILE', companyId: 'SYN_B' });
  const q = request(); q.assignments[0].companyId = 'SYN_B';
  assert.equal(selectProfiles([a, b], q).segments[0].profileId, b.id);
});
test('selezione corretta del CCNL e della sua versione', () => {
  const a = profile(), b = profile({ id: 'SYN_OTHER_CCNL', ccnl: { id: 'SYN_CCNL_B', version: 'SYN_V2' } });
  const q = request(); q.assignments[0].ccnlId = 'SYN_CCNL_B'; q.assignments[0].contractVersion = 'SYN_V2';
  assert.equal(selectProfiles([a, b], q).segments[0].profileId, b.id);
  q.assignments[0].contractVersion = 'SYN_V1'; unavailable(selectProfiles([a, b], q), 'PROFILE_NOT_FOUND');
});
test('decorrenza e fine validità inclusive, profilo successivo scelto per il mese successivo', () => {
  const a = profile({ validity: { from: '2030-01-01', to: '2030-03-31' } });
  const b = profile({ id: 'SYN_NEW', revision: 2, validity: { from: '2030-04-01', to: null } });
  assert.equal(selectProfiles([a, b], request()).segments[0].profileId, b.id);
});
test('ordine del catalogo non cambia la scelta o la configurazione', () => {
  const a = profile(), b = profile({ id: 'SYN_OTHER', companyId: 'SYN_B' });
  assert.deepEqual(prepareEconomyConfig([a, b], request()), prepareEconomyConfig([b, a], request()));
});
test('cambio livello inframese richiede coordinamento, nessuna configurazione parziale', () => {
  const p = profile(), b = profile({ id: 'SYN_L2_PROFILE', level: 'SYN_L2' });
  const q = request(); q.assignments = [
    { ...q.assignments[0], to: '2030-04-14' }, { ...q.assignments[0], from: '2030-04-15', level: 'SYN_L2' },
  ];
  const r = prepareEconomyConfig([p, b], q);
  unavailable(r, 'INTRAMONTH_BASE_COORDINATION_REQUIRED'); assert.equal(r.status, 'coordinationRequired');
  assert.equal(r.segments.length, 2); assert.equal(r.provenance, null);
});
test('cambio tariffa inframese non duplica la base mensile', () => {
  const a = profile({ validity: { from: '2030-01-01', to: '2030-04-14' } });
  const b = profile({ revision: 2, validity: { from: '2030-04-15', to: null } });
  b.baseRules[1].factor = '1.4';
  const r = prepareEconomyConfig([a, b], request());
  unavailable(r, 'INTRAMONTH_BASE_COORDINATION_REQUIRED'); assert.equal(r.segments.length, 2);
});
test('cambio base inframese e cambio versione contrattuale richiedono coordinamento', () => {
  const a = profile({ validity: { from: '2030-01-01', to: '2030-04-14' } });
  const b = profile({ revision: 2, ccnl: { id: 'SYN_CCNL', version: 'SYN_V2' },
    validity: { from: '2030-04-15', to: null } }); b.basis.monthlyBaseEuro = '2000';
  const q = request(); q.assignments = [{ ...q.assignments[0], to: '2030-04-14' },
    { ...q.assignments[0], from: '2030-04-15', contractVersion: 'SYN_V2' }];
  unavailable(prepareEconomyConfig([a, b], q), 'INTRAMONTH_BASE_COORDINATION_REQUIRED');
});
test('buco di decorrenza non sostituito con ultimo profilo noto', () => {
  const a = profile({ validity: { from: '2030-01-01', to: '2030-04-14' } });
  const b = profile({ revision: 2, validity: { from: '2030-04-16', to: null } });
  unavailable(prepareEconomyConfig([a, b], request()), 'PROFILE_NOT_FOUND');
});
test('assegnazioni mancanti o sovrapposte bloccano il mese intero', () => {
  const q = request(); q.assignments[0].from = '2030-04-02';
  unavailable(selectProfiles([profile()], q), 'ASSIGNMENT_GAP');
  const q2 = request(); q2.assignments.push(clone(q2.assignments[0]));
  unavailable(selectProfiles([profile()], q2), 'OVERLAPPING_ASSIGNMENTS');
});
test('profilo duplicato id+revisione rifiutato anche con date distinte', () => {
  const a = profile({ validity: { from: '2030-01-01', to: '2030-03-31' } });
  const b = profile({ validity: { from: '2030-04-01', to: null } });
  assert.ok(validateCatalog([a, b]).issues.some(i => i.code === 'DUPLICATE_PROFILE_VERSION'));
});
test('sovrapposizioni temporali rifiutate anche fra versioni contrattuali diverse', () => {
  const b = profile({ id: 'SYN_OTHER', ccnl: { id: 'SYN_CCNL', version: 'SYN_V2' } });
  unavailable(selectProfiles([profile(), b], request()), 'OVERLAPPING_PROFILE_VALIDITY');
});
test('la data di fine è inclusiva: due profili nello stesso giorno sono ambigui', () => {
  const a = profile({ validity: { from: '2030-01-01', to: '2030-04-15' } });
  const b = profile({ revision: 2, validity: { from: '2030-04-15', to: null } });
  assert.ok(validateCatalog([a, b]).issues.some(i => i.code === 'OVERLAPPING_PROFILE_VALIDITY'));
});
test('un profilo invalido non viene ignorato per selezionarne un altro apparentemente valido', () => {
  const b = profile({ id: 'SYN_OTHER', companyId: 'SYN_B' }); delete b.basis.divisor;
  unavailable(selectProfiles([profile(), b], request()), 'INVALID_DECIMAL');
});

const invalidCases = [
  ['CCNL assente', p => { delete p.ccnl; }, 'INVALID_OBJECT'],
  ['versione contrattuale assente', p => { delete p.ccnl.version; }, 'INVALID_TOKEN'],
  ['azienda assente', p => { delete p.companyId; }, 'INVALID_TOKEN'],
  ['livello assente', p => { delete p.level; }, 'INVALID_TOKEN'],
  ['base mancante', p => { delete p.basis.monthlyBaseEuro; }, 'INVALID_DECIMAL'],
  ['divisore zero', p => { p.basis.divisor = '0'; }, 'INVALID_DIVISOR'],
  ['tariffa Number', p => { p.basis.hourlyRate = { mode: 'explicit', euro: 10, sourceIds: ['SRC1'] }; }, 'INVALID_DECIMAL'],
  ['tariffa negativa', p => { p.basis.monthlyBaseEuro = '-1'; }, 'INVALID_DECIMAL'],
  ['tariffa con virgola', p => { p.basis.monthlyBaseEuro = '1,25'; }, 'INVALID_DECIMAL'],
  ['tariffa oltre sei decimali', p => { p.basis.monthlyBaseEuro = '1.1234567'; }, 'INVALID_DECIMAL'],
  ['tariffa esponenziale', p => { p.basis.monthlyBaseEuro = '1e3'; }, 'INVALID_DECIMAL'],
  ['fattore non valido', p => { p.baseRules[1].factor = '-1'; }, 'INVALID_DECIMAL'],
  ['fonte regola mancante', p => { p.baseRules[1].sourceIds = []; }, 'SOURCE_REFERENCES_REQUIRED'],
  ['fonte non presente nel registro', p => { p.baseRules[1].sourceIds = ['NO_SOURCE']; }, 'UNKNOWN_SOURCE'],
  ['fonti assenti', p => { p.sources = []; }, 'DOCUMENTARY_SOURCES_MISSING'],
  ['fonti duplicate', p => { p.sources.push(clone(p.sources[0])); }, 'DUPLICATE_SOURCE'],
  ['fonte arrotondamento assente', p => { delete p.rounding.sourceIds; }, 'SOURCE_REFERENCES_REQUIRED'],
  ['arrotondamento non supportato', p => { p.rounding.policy = 'floorTotal'; }, 'UNSUPPORTED_ROUNDING'],
  ['politica attributo assente', p => { delete p.tagPolicy.night; }, 'INVALID_OBJECT'],
  ['data impossibile', p => { p.validity.from = '2030-02-30'; }, 'INVALID_DATE'],
  ['validità invertita', p => { p.validity.to = '2029-01-01'; }, 'INVALID_VALIDITY'],
  ['schema futuro', p => { p.schemaVersion = 2; }, 'UNSUPPORTED_SCHEMA'],
  ['campi sconosciuti', p => { p.unknownRule = 'SYN'; }, 'UNKNOWN_FIELD'],
  ['Fiduciari esclusi', p => { p.operator = 'fiduciario'; }, 'OPERATOR_NOT_SUPPORTED'],
  ['doppia base mensile', p => { p.baseRules[0].kind = 'full'; }, 'DOUBLE_MONTHLY_BASE'],
  ['id regole duplicati', p => { p.baseRules[1].id = p.baseRules[0].id; }, 'DUPLICATE_ECONOMIC_ID'],
  ['id riservato', p => { p.premiumGroups = [{ id: 'constructor', policy: 'sum', sourceIds: ['SRC1'] }]; }, 'INVALID_TOKEN'],
];
for (const [name, mutate, code] of invalidCases) test('rifiuto: ' + name, () => {
  const p = profile(); mutate(p); invalid(p, code);
});
test('catalogo vuoto e oggetti non JSON rifiutati senza eccezioni esterne', () => {
  assert.equal(validateCatalog([]).valid, false); invalid(null, 'INVALID_OBJECT');
  const p = profile(); p.self = p; invalid(p, 'NON_JSON_INPUT');
});
test('divisione non esatta non arrotondata implicitamente', () => {
  const p = profile(); p.basis.divisor = '173'; invalid(p, 'HOURLY_RATE_PRECISION_UNRESOLVED');
});
test('tariffa esplicita con provenienza ammessa senza dedurre una precisione contrattuale', () => {
  const p = profile(); p.basis.divisor = '173';
  p.basis.hourlyRate = { mode: 'explicit', euro: '5.780347', sourceIds: ['SRC1'] };
  assert.equal(valid(p).hourlyEuro, '5.780347');
});
test('buchi nelle categorie straordinarie riconosciuti anche senza presenze del caso mancante', () => {
  const p = profile(); p.baseRules[1].when = { night: false }; invalid(p, 'BASE_RULE_COVERAGE_GAP');
});
test('regole base sovrapposte rifiutate sul dominio completo', () => {
  const p = profile(); p.baseRules.push({ ...clone(p.baseRules[1]), id: 'OT_DUP' });
  invalid(p, 'AMBIGUOUS_BASE_RULES');
});
test('straordinari notturni e festivi disgiunti configurabili senza cambiare il motore', () => {
  const p = profile(), original = p.baseRules.pop();
  for (const night of [false, true]) for (const holiday of [false, true]) {
    p.baseRules.push({ ...clone(original), id: 'OT_' + Number(night) + Number(holiday),
      when: { night, holiday }, factor: night ? '1.5' : holiday ? '1.4' : '1.25' });
  }
  valid(p); assert.equal(prepared(p).config.baseRules.length, 5);
});
test('maggiorazioni sovrapposte in gruppo esclusivo rifiutate anche su notte+festivo', () => {
  const p = profile(); p.premiumGroups = [{ id: 'PREM', policy: 'exclusive', sourceIds: ['SRC1'] }];
  p.premiumRules = [premium('NIGHT', { night: true }), premium('HOLIDAY', { holiday: true })];
  invalid(p, 'OVERLAPPING_EXCLUSIVE_PREMIUMS');
});
test('cumulo esplicito documentato nel profilo preservato nel Blocco 2', () => {
  const p = profile(); p.premiumGroups = [{ id: 'PREM', policy: 'sum', sourceIds: ['SRC1'] }];
  p.premiumRules = [premium('NIGHT', { night: true }), premium('HOLIDAY', { holiday: true })];
  const c = classifyHours([{ id: 'SYN_SHIFT', date: '2030-04-01', start: '22:00', end: '23:00' }],
    { ...hours, holidays: ['2030-04-01'] });
  const result = calculateEconomy(c, prepared(p).config);
  assert.equal(result.complete, true); assert.equal(result.totals.premiumCents, '400');
});
test('politica tags rules esige copertura anche delle pause retribuite', () => {
  const p = profile(); p.tagPolicy.night.policy = 'rules';
  p.premiumGroups = [{ id: 'PREM', policy: 'sum', sourceIds: ['SRC1'] }];
  p.premiumRules = [premium('NIGHT', { night: true })];
  invalid(p, 'UNRESOLVED_TAG_POLICY');
});
test('indennità duplicate per id oppure causale semantica rifiutate', () => {
  const p = profile(); p.allowances = [allowance(), allowance()]; invalid(p, 'DUPLICATE_ECONOMIC_ID');
  p.allowances[1].id = 'ALLOW2'; invalid(p, 'DUPLICATE_ALLOWANCE_CONCEPT');
});
test('quantità indennità richiesta esplicitamente, mai dedotta da turni o giorni del mese', () => {
  const p = profile(); p.allowances = [allowance()];
  unavailable(prepareEconomyConfig([p], request()), 'MISSING_OR_UNKNOWN_ALLOWANCE_QUANTITY');
  const q = request(); q.allowanceQuantities = [{ id: 'ALLOW1', quantity: '2', reviewed: true, reference: 'SYN_QTY' }];
  const r = calculateEconomy(classification(), prepared(p, q).config);
  assert.equal(r.complete, true); assert.equal(r.totals.allowanceCents, '650');
});
test('quantità zero esplicita preservata; quantità non revisionata o duplicata rifiutata', () => {
  const p = profile(); p.allowances = [allowance()];
  const q = request(); q.allowanceQuantities = [{ id: 'ALLOW1', quantity: '0', reviewed: true, reference: 'SYN_QTY' }];
  assert.equal(prepared(p, q).config.allowances[0].quantity, '0');
  q.allowanceQuantities[0].reviewed = false;
  unavailable(prepareEconomyConfig([p], q), 'QUANTITY_REVIEW_REQUIRED');
  q.allowanceQuantities[0].reviewed = true; q.allowanceQuantities.push(clone(q.allowanceQuantities[0]));
  unavailable(prepareEconomyConfig([p], q), 'DUPLICATE_ALLOWANCE_QUANTITY');
});
test('quantità per indennità sconosciuta rifiutata', () => {
  const q = request(); q.allowanceQuantities = [{ id: 'UNKNOWN', quantity: '1', reviewed: true, reference: 'SYN_QTY' }];
  unavailable(prepareEconomyConfig([profile()], q), 'MISSING_OR_UNKNOWN_ALLOWANCE_QUANTITY');
});
test('base mensile non attestata non disponibile, nessun riproporzionamento inventato', () => {
  const q = request(); delete q.baseContext;
  unavailable(prepareEconomyConfig([profile()], q), 'MONTHLY_BASE_CONTEXT_REQUIRED');
  q.baseContext = { kind: 'partialMonth', reviewed: true, reference: 'SYN_BASE' };
  unavailable(prepareEconomyConfig([profile()], q), 'MONTHLY_BASE_CONTEXT_REQUIRED');
});
test('profili non verificati non possono entrare nel percorso di revisione documentale', () => {
  unavailable(prepareEconomyConfig([profile()], request({ purpose: 'review' })), 'VERIFIED_DOCUMENTARY_PROFILE_REQUIRED');
});
test('profilo sintetico non può dichiararsi verificato', () => {
  const p = profile(); p.verification = { status: 'verified', reviewId: 'SYN_REVIEW', reviewedOn: '2030-03-01' };
  invalid(p, 'PROFILE_NOT_DOCUMENTARILY_VERIFIED');
});
test('osservazioni del codice non sono una fonte contrattuale verificata', () => {
  const p = profile({ origin: 'codeObservation' }); p.sources[0].kind = 'codeObservation';
  valid(p);
  unavailable(prepareEconomyConfig([p], request()), 'SYNTHETIC_FIXTURE_REQUIRED');
  unavailable(prepareEconomyConfig([p], request({ purpose: 'review' })), 'VERIFIED_DOCUMENTARY_PROFILE_REQUIRED');
});
test('digest o revisione documentale mancanti bloccano il falso verified', () => {
  const p = documentaryMetadataMock(); p.sources[0].sha256 = null; invalid(p, 'DOCUMENT_DIGEST_REQUIRED');
  p.sources[0].sha256 = 'a'.repeat(64); p.sources[0].status = 'unreviewed';
  invalid(p, 'PROFILE_NOT_DOCUMENTARILY_VERIFIED');
});
test('mock documentale prepara soltanto per revisione isolata e non autentica fonti', () => {
  const r = prepared(documentaryMetadataMock(), request({ purpose: 'review' }));
  assert.equal(r.realUseAuthorized, false); assert.equal(r.provenance.origin, 'documentary');
});
test('uso reale disabilitato per sintetici, sperimentali e perfino metadati dichiarati verified', () => {
  for (const p of [profile(), documentaryMetadataMock()]) {
    unavailable(prepareEconomyConfig([p], request({ purpose: 'realPayroll' })), 'REAL_PAYROLL_DISABLED_IN_PROTOTYPE');
  }
});
test('nessuna scelta automatica dello scopo o conversione documentale in fixture', () => {
  const q = request(); delete q.purpose;
  unavailable(selectProfiles([profile()], q), 'EXPLICIT_PURPOSE_REQUIRED');
  unavailable(selectProfiles([documentaryMetadataMock()], request()), 'SYNTHETIC_FIXTURE_REQUIRED');
});
test('Fiduciari esclusi anche dalla richiesta, senza instradamento al GPG', () => {
  unavailable(prepareEconomyConfig([profile()], request({ operator: 'fiduciario' })), 'OPERATOR_NOT_SUPPORTED');
});
test('compatibilità con il Blocco 2 originale: base mensile una volta e extra distinti', () => {
  const r = calculateEconomy(classification(), prepared().config);
  assert.equal(r.complete, true, JSON.stringify(r.issues));
  assert.equal(r.totals.amountCents, '101250');
  assert.equal(r.lines.filter(l => l.id === '$monthlyBase').length, 1);
  assert.equal(r.lines.find(l => l.id === 'ORD').amountCents, '0');
});
test('arrotondamento al centesimo per regola, senza sostituirlo con arrotondamento del totale esatto', () => {
  const p = profile(); p.basis.monthlyBaseEuro = '0';
  p.basis.hourlyRate = { mode: 'explicit', euro: '0.005', sourceIds: ['SRC1'] };
  p.baseRules[1].factor = '1'; p.premiumGroups = [{ id: 'PREM', policy: 'sum', sourceIds: ['SRC1'] }];
  p.premiumRules = ['P1', 'P2'].map(id => ({ ...premium(id, {}), bucket: 'overtime',
    rate: { mode: 'profileHourly', sourceIds: ['SRC1'] } }));
  const r = calculateEconomy(classification(), prepared(p).config);
  assert.equal(r.complete, true); assert.equal(r.totals.amountCents, '3');
});
test('modalità oraria: niente base mensile aggiunta al compenso orario', () => {
  const p = profile(); p.basis.payMode = 'hourly';
  Object.assign(p.baseRules[0], { kind: 'full', rate: { mode: 'profileHourly', sourceIds: ['SRC1'] }, factor: '1' });
  const q = request(); delete q.baseContext;
  const config = prepared(p, q).config;
  assert.ok(!Object.hasOwn(config, 'monthlyBaseEuro'));
  const r = calculateEconomy(classification(), config);
  assert.equal(r.complete, true); assert.equal(r.totals.amountCents, '8250');
});
test('provenienza di basi, divisore, tariffe, regole, gruppi e quantità conservata', () => {
  const p = profile(); p.allowances = [allowance()];
  p.premiumGroups = [{ id: 'PREM', policy: 'sum', sourceIds: ['SRC1'] }]; p.premiumRules = [premium('NIGHT', { night: true })];
  const q = request(); q.allowanceQuantities = [{ id: 'ALLOW1', quantity: '0', reviewed: true, reference: 'SYN_QTY' }];
  const r = prepared(p, q);
  for (const field of ['monthlyBaseEuro', 'rule:$monthlyBase', 'divisor', 'hourlyEuro', 'rounding', 'rule:ORD', 'rule:OT',
    'rule:NIGHT', 'rate:NIGHT', 'group:PREM', 'rule:ALLOW1']) assert.deepEqual(r.provenance.fields[field], ['SRC1']);
  assert.equal(r.provenance.quantityEvidence[0].reference, 'SYN_QTY');
});
test('input profondamente congelati e immutati sia su successo sia su errore', () => {
  const p = freeze(profile()), q = freeze(request()); const before = JSON.stringify({ p, q });
  prepared(p, q); assert.equal(JSON.stringify({ p, q }), before);
  const bad = profile(); bad.baseRules[1].factor = '-1'; freeze(bad);
  const badBefore = JSON.stringify(bad); invalid(bad, 'INVALID_DECIMAL'); assert.equal(JSON.stringify(bad), badBefore);
});
test('mutare configurazione o provenienza non modifica il profilo o la richiesta', () => {
  const p = profile(), q = request(), r = prepared(p, q);
  r.config.baseRules[1].when.night = true; r.provenance.sources[0].reference = 'MODIFIED';
  r.provenance.fields.divisor.push('OTHER'); r.provenance.baseContext.reference = 'MODIFIED';
  assert.deepEqual(p.baseRules[1].when, {}); assert.equal(p.sources[0].reference, 'SYNTHETIC_TEST_ONLY');
  assert.deepEqual(p.basis.sourceIds, ['SRC1']); assert.equal(q.baseContext.reference, 'SYN_BASE_CONTEXT');
});
test('integrazione esclusivamente sintetica con Blocco 7 e Blocchi 1–2 originali', () => {
  const adapted = classifySnapshot({ records: [{ id: 'SYN1', anno: 2030, mese: 4, giorno: 1,
    tipo: 'turno', inizio: '06:00', fine: '14:00', ore: 8 }],
  coverage: { from: '2030-04-01', to: '2030-04-30', complete: true } },
  { operator: 'gpg', period: '2030-04', periodPolicy: 'shiftStartDateAfterContextClassification',
    civilTimeComparable: true, holidaysComplete: true, hours }, classifyHours);
  assert.equal(adapted.complete, true);
  const r = calculateEconomy(adapted.periodResult, prepared().config);
  assert.equal(r.complete, true); assert.equal(r.totals.amountCents, '101250');
});
test('modulo privo di I/O, import, orologio corrente e tariffe legacy preinstallate', () => {
  const source = require('node:fs').readFileSync(path.join(__dirname, 'profiliGpg.cjs'), 'utf8');
  assert.doesNotMatch(source, /\brequire\s*\(|\bimport\s|\bfetch\s*\(|process\.|console\.|Date\.now\s*\(|new Date\(\)|1468\.88|11\.03783/);
});
