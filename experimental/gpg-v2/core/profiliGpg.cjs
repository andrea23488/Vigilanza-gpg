'use strict';

// Modulo puro: nessun catalogo reale, I/O, default tariffario o attivazione.
const SCALE = 1000000n;
const DAY = 86400000;
const TAGS = ['night', 'sunday', 'holiday', 'restWorked'];
const EVENTS = ['work', 'paidBreak', 'paidTransfer'];
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function check(ok, code) { if (!ok) { const e = new Error(code); e.code = code; throw e; } }
function token(v) {
  check(typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(v) &&
    !['constructor', 'prototype', '__proto__'].includes(v), 'INVALID_TOKEN');
}
function shape(v, fields) {
  check(object(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v)), 'INVALID_OBJECT');
  check(Object.keys(v).every(k => fields.includes(k)), 'UNKNOWN_FIELD');
}
function jsonInput(v, seen = new Set()) {
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return;
  if (typeof v === 'number') { check(Number.isFinite(v), 'NON_JSON_INPUT'); return; }
  check(typeof v === 'object' && !seen.has(v), 'NON_JSON_INPUT');
  seen.add(v);
  if (!Array.isArray(v)) shape(v, Object.keys(v));
  for (const k of Object.keys(v)) {
    check('value' in Object.getOwnPropertyDescriptor(v, k), 'NON_JSON_INPUT');
    jsonInput(v[k], seen);
  }
  seen.delete(v);
}
const copy = v => JSON.parse(JSON.stringify(v));
function date(v) {
  check(typeof v === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(v), 'INVALID_DATE');
  const n = Date.parse(v + 'T00:00:00Z');
  check(Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === v, 'INVALID_DATE');
  return n;
}
const dayKey = n => new Date(n).toISOString().slice(0, 10);
function decimal(v) {
  check(typeof v === 'string' && /^(0|[1-9]\d{0,11})(\.\d{1,6})?$/.test(v), 'INVALID_DECIMAL');
  const [a, b = ''] = v.split('.');
  return BigInt(a) * SCALE + BigInt(b.padEnd(6, '0'));
}
function decimalText(v) {
  const tail = (v % SCALE).toString().padStart(6, '0').replace(/0+$/, '');
  return (v / SCALE).toString() + (tail ? '.' + tail : '');
}
function sourcesFor(refs, sources) {
  check(Array.isArray(refs) && refs.length > 0 && new Set(refs).size === refs.length, 'SOURCE_REFERENCES_REQUIRED');
  refs.forEach(id => { token(id); check(sources.has(id), 'UNKNOWN_SOURCE'); });
}
function selector(r) {
  check(['ordinary', 'overtime', 'all'].includes(r.bucket), 'INVALID_BUCKET');
  shape(r.when, [...TAGS, 'event']);
  for (const [k, v] of Object.entries(r.when)) {
    check(k === 'event' ? [...EVENTS, 'unpaidBreak'].includes(v) : typeof v === 'boolean', 'INVALID_SELECTOR');
  }
  check(['paid', 'worked'].includes(r.scope), 'INVALID_SCOPE');
}
function matches(r, state) {
  return (r.bucket === 'all' || r.bucket === state.bucket) &&
    Object.entries(r.when).every(([k, v]) => state[k] === v);
}
function rate(v, sources) {
  shape(v, ['mode', 'euro', 'sourceIds']);
  sourcesFor(v.sourceIds, sources);
  check(['profileHourly', 'explicit'].includes(v.mode), 'INVALID_RATE_MODE');
  if (v.mode === 'explicit') decimal(v.euro);
  else check(!Object.hasOwn(v, 'euro'), 'UNEXPECTED_RATE');
}
function hourlyRate(p) {
  const h = p.basis.hourlyRate;
  if (h.mode === 'explicit') return h.euro;
  const numerator = decimal(p.basis.monthlyBaseEuro) * SCALE;
  const denominator = decimal(p.basis.divisor);
  check(numerator % denominator === 0n, 'HOURLY_RATE_PRECISION_UNRESOLVED');
  const value = decimalText(numerator / denominator);
  decimal(value); // Stesso limite di rappresentazione del Blocco 2.
  return value;
}
function verifyProfile(p) {
  jsonInput(p);
  shape(p, ['schemaVersion', 'id', 'revision', 'operator', 'origin', 'ccnl', 'companyId',
    'level', 'validity', 'verification', 'sources', 'basis', 'rounding', 'tagPolicy',
    'baseRules', 'premiumRules', 'premiumGroups', 'allowances']);
  check(p.schemaVersion === 1, 'UNSUPPORTED_SCHEMA');
  token(p.id); token(p.companyId); token(p.level);
  check(Number.isSafeInteger(p.revision) && p.revision > 0, 'INVALID_REVISION');
  check(p.operator === 'gpg', 'OPERATOR_NOT_SUPPORTED');
  check(['synthetic', 'documentary', 'codeObservation'].includes(p.origin), 'ORIGIN_REQUIRED');
  shape(p.ccnl, ['id', 'version']); token(p.ccnl.id); token(p.ccnl.version);
  shape(p.validity, ['from', 'to']);
  const from = date(p.validity.from);
  check(p.validity.to === null || date(p.validity.to) >= from, 'INVALID_VALIDITY');
  shape(p.verification, ['status', 'reviewId', 'reviewedOn']);
  check(['experimental', 'verified'].includes(p.verification.status), 'VERIFICATION_STATUS_REQUIRED');
  check(Array.isArray(p.sources) && p.sources.length > 0, 'DOCUMENTARY_SOURCES_MISSING');
  const sources = new Map();
  for (const s of p.sources) {
    shape(s, ['id', 'kind', 'reference', 'sha256', 'status']);
    token(s.id); token(s.reference);
    check(!sources.has(s.id), 'DUPLICATE_SOURCE');
    check(s.kind === p.origin && ['unreviewed', 'reviewed'].includes(s.status), 'SOURCE_ORIGIN_MISMATCH');
    if (s.kind === 'documentary') check(typeof s.sha256 === 'string' && /^[a-f0-9]{64}$/.test(s.sha256), 'DOCUMENT_DIGEST_REQUIRED');
    else check(s.sha256 === null, 'UNEXPECTED_DOCUMENT_DIGEST');
    sources.set(s.id, s);
  }
  if (p.verification.status === 'verified') {
    check(p.origin === 'documentary' && p.sources.every(s => s.status === 'reviewed'), 'PROFILE_NOT_DOCUMENTARILY_VERIFIED');
    token(p.verification.reviewId); date(p.verification.reviewedOn);
  } else {
    check(p.verification.reviewId === null && p.verification.reviewedOn === null, 'EXPERIMENTAL_REVIEW_METADATA');
  }
  shape(p.basis, ['payMode', 'monthlyBaseEuro', 'divisor', 'sourceIds', 'hourlyRate']);
  check(['monthly', 'hourly'].includes(p.basis.payMode), 'INVALID_PAY_MODE');
  decimal(p.basis.monthlyBaseEuro);
  check(decimal(p.basis.divisor) > 0n, 'INVALID_DIVISOR');
  sourcesFor(p.basis.sourceIds, sources);
  shape(p.basis.hourlyRate, ['mode', 'euro', 'sourceIds']);
  check(['explicit', 'exactBaseDivisor'].includes(p.basis.hourlyRate.mode), 'INVALID_HOURLY_BASIS');
  sourcesFor(p.basis.hourlyRate.sourceIds, sources);
  if (p.basis.hourlyRate.mode === 'explicit') decimal(p.basis.hourlyRate.euro);
  else check(!Object.hasOwn(p.basis.hourlyRate, 'euro'), 'UNEXPECTED_RATE');
  const hourly = hourlyRate(p);
  shape(p.rounding, ['policy', 'sourceIds']);
  check(p.rounding.policy === 'halfUpPerRule', 'UNSUPPORTED_ROUNDING');
  sourcesFor(p.rounding.sourceIds, sources);
  shape(p.tagPolicy, TAGS);
  for (const tag of TAGS) {
    shape(p.tagPolicy[tag], ['policy', 'sourceIds']);
    check(['none', 'rules'].includes(p.tagPolicy[tag].policy), 'TAG_POLICY_REQUIRED');
    sourcesFor(p.tagPolicy[tag].sourceIds, sources);
  }
  check(Array.isArray(p.baseRules) && p.baseRules.length > 0 && Array.isArray(p.premiumRules) &&
    Array.isArray(p.premiumGroups) && Array.isArray(p.allowances), 'RULE_ARRAYS_REQUIRED');
  const ids = new Set(), groups = new Map();
  const unique = id => { token(id); check(!ids.has(id), 'DUPLICATE_ECONOMIC_ID'); ids.add(id); };
  for (const g of p.premiumGroups) {
    shape(g, ['id', 'policy', 'sourceIds']); token(g.id);
    check(!groups.has(g.id), 'DUPLICATE_PREMIUM_GROUP');
    check(['sum', 'exclusive'].includes(g.policy), 'GROUP_POLICY_REQUIRED');
    sourcesFor(g.sourceIds, sources); groups.set(g.id, g);
  }
  for (const r of p.baseRules) {
    shape(r, ['id', 'bucket', 'when', 'scope', 'kind', 'rate', 'factor', 'sourceIds']);
    unique(r.id); selector(r); sourcesFor(r.sourceIds, sources);
    check(r.scope === 'paid', 'INVALID_BASE_SCOPE');
    if (p.basis.payMode === 'monthly' && r.bucket === 'ordinary') {
      check(r.kind === 'covered' && !Object.hasOwn(r, 'rate') && !Object.hasOwn(r, 'factor'), 'DOUBLE_MONTHLY_BASE');
    } else {
      check(r.kind === 'full' && (p.basis.payMode === 'hourly' || r.bucket === 'overtime'), 'INVALID_BASE_KIND');
      rate(r.rate, sources); decimal(r.factor);
    }
  }
  for (const r of p.premiumRules) {
    shape(r, ['id', 'bucket', 'when', 'scope', 'kind', 'rate', 'factor', 'group', 'sourceIds']);
    unique(r.id); selector(r); sourcesFor(r.sourceIds, sources);
    check(r.kind === 'premium' && groups.has(r.group), 'INVALID_PREMIUM');
    rate(r.rate, sources); decimal(r.factor);
  }
  const concepts = new Set();
  for (const a of p.allowances) {
    shape(a, ['id', 'concept', 'description', 'unit', 'unitEuro', 'sourceIds']);
    unique(a.id); token(a.concept); token(a.description);
    check(!concepts.has(a.concept), 'DUPLICATE_ALLOWANCE_CONCEPT'); concepts.add(a.concept);
    check(['day', 'shift', 'month', 'item'].includes(a.unit), 'INVALID_ALLOWANCE_UNIT');
    decimal(a.unitEuro); sourcesFor(a.sourceIds, sources);
  }
  // Verifica preventiva di tutto il dominio del Blocco 2: due bucket,
  // 16 combinazioni di attributi e tre eventi retribuiti. Nessuna precedenza implicita.
  for (const bucket of ['ordinary', 'overtime']) for (const event of EVENTS) for (let mask = 0; mask < 16; mask++) {
    const state = { bucket, event, ...Object.fromEntries(TAGS.map((t, i) => [t, !!(mask & (1 << i))])) };
    const base = p.baseRules.filter(r => matches(r, state));
    check(base.length === 1, base.length ? 'AMBIGUOUS_BASE_RULES' : 'BASE_RULE_COVERAGE_GAP');
    const premiums = p.premiumRules.filter(r => matches(r, state) && (r.scope === 'paid' || event === 'work'));
    for (const g of p.premiumGroups) {
      check(g.policy !== 'exclusive' || premiums.filter(r => r.group === g.id).length <= 1, 'OVERLAPPING_EXCLUSIVE_PREMIUMS');
    }
    for (const tag of TAGS) if (state[tag] && p.tagPolicy[tag].policy === 'rules') {
      check([base[0], ...premiums].some(r => r.when[tag] === true), 'UNRESOLVED_TAG_POLICY');
    }
  }
  return { hourly };
}
const errorCode = e => e.code || 'INVALID_PROFILE_SHAPE';
function validateProfile(profile) {
  try {
    const { hourly } = verifyProfile(profile);
    return { valid: true, issues: [], hourlyEuro: hourly,
      documentaryVerificationDeclared: profile.verification.status === 'verified',
      realUseAuthorized: false };
  } catch (e) { return { valid: false, issues: [{ code: errorCode(e) }], hourlyEuro: null, realUseAuthorized: false }; }
}
function validateCatalog(profiles) {
  const issues = [];
  if (!Array.isArray(profiles) || profiles.length === 0) return { valid: false, issues: [{ code: 'EMPTY_CATALOG' }] };
  const identities = new Set();
  profiles.forEach((p, profileIndex) => {
    const r = validateProfile(p);
    if (!r.valid) { issues.push(...r.issues.map(i => ({ ...i, profileIndex }))); return; }
    const identity = p.id + '@' + p.revision;
    if (identities.has(identity)) issues.push({ code: 'DUPLICATE_PROFILE_VERSION', profileIndex });
    identities.add(identity);
  });
  if (issues.length) return { valid: false, issues };
  for (let i = 0; i < profiles.length; i++) for (let j = i + 1; j < profiles.length; j++) {
    const a = profiles[i], b = profiles[j];
    if (a.companyId === b.companyId && a.level === b.level && a.ccnl.id === b.ccnl.id &&
      (a.validity.to === null || a.validity.to >= b.validity.from) &&
      (b.validity.to === null || b.validity.to >= a.validity.from)) {
      issues.push({ code: 'OVERLAPPING_PROFILE_VALIDITY', profileIndex: i, otherProfileIndex: j });
    }
  }
  return { valid: issues.length === 0, issues };
}
function unavailable(code, issues = null) {
  return { available: false, status: 'notAvailable', realUseAuthorized: false,
    issues: issues || [{ code }], segments: [], config: null, provenance: null };
}
function requestRange(request) {
  jsonInput(request);
  shape(request, ['operator', 'period', 'purpose', 'assignments', 'baseContext', 'allowanceQuantities']);
  check(request.operator === 'gpg', 'OPERATOR_NOT_SUPPORTED');
  check(['syntheticTest', 'review', 'realPayroll'].includes(request.purpose), 'EXPLICIT_PURPOSE_REQUIRED');
  check(typeof request.period === 'string' && /^20\d{2}-\d{2}$/.test(request.period), 'INVALID_PERIOD');
  const from = date(request.period + '-01');
  const d = new Date(from), to = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - DAY;
  check(Array.isArray(request.assignments) && request.assignments.length > 0, 'ASSIGNMENTS_REQUIRED');
  for (const a of request.assignments) {
    shape(a, ['from', 'to', 'companyId', 'level', 'ccnlId', 'contractVersion']);
    check(date(a.from) <= date(a.to), 'INVALID_ASSIGNMENT_DATES');
    for (const k of ['companyId', 'level', 'ccnlId', 'contractVersion']) token(a[k]);
  }
  return { from, to };
}
function selectProfiles(profiles, request) {
  let range;
  try { range = requestRange(request); }
  catch (e) { return unavailable(errorCode(e)); }
  const valid = validateCatalog(profiles);
  if (!valid.valid) return unavailable(null, valid.issues);
  // Blocco intenzionale a prescindere dai metadati: nessuna attivazione reale nel prototipo.
  if (request.purpose === 'realPayroll') return unavailable('REAL_PAYROLL_DISABLED_IN_PROTOTYPE');
  const segments = [];
  for (let day = range.from; day <= range.to; day += DAY) {
    const key = dayKey(day);
    const assignments = request.assignments.filter(a => a.from <= key && a.to >= key);
    if (assignments.length !== 1) return unavailable(assignments.length ? 'OVERLAPPING_ASSIGNMENTS' : 'ASSIGNMENT_GAP');
    const a = assignments[0];
    const candidates = profiles.filter(p => p.companyId === a.companyId && p.level === a.level &&
      p.ccnl.id === a.ccnlId && p.ccnl.version === a.contractVersion && p.validity.from <= key &&
      (p.validity.to === null || p.validity.to >= key));
    if (candidates.length !== 1) return unavailable(candidates.length ? 'AMBIGUOUS_PROFILE' : 'PROFILE_NOT_FOUND');
    const p = candidates[0];
    if (request.purpose === 'syntheticTest' && (p.origin !== 'synthetic' || p.verification.status !== 'experimental')) {
      return unavailable('SYNTHETIC_FIXTURE_REQUIRED');
    }
    if (request.purpose === 'review' && (p.origin !== 'documentary' || p.verification.status !== 'verified')) {
      return unavailable('VERIFIED_DOCUMENTARY_PROFILE_REQUIRED');
    }
    const last = segments[segments.length - 1];
    if (last && last.profileId === p.id && last.revision === p.revision) last.to = key;
    else segments.push({ from: key, to: key, profileId: p.id, revision: p.revision,
      companyId: p.companyId, level: p.level, ccnlId: p.ccnl.id, contractVersion: p.ccnl.version });
  }
  if (segments.length !== 1) {
    return { ...unavailable('INTRAMONTH_BASE_COORDINATION_REQUIRED'), status: 'coordinationRequired', segments };
  }
  return { available: true, status: 'selected', realUseAuthorized: false, issues: [],
    segments, config: null, provenance: null };
}
function prepareEconomyConfig(profiles, request) {
  const selected = selectProfiles(profiles, request);
  if (!selected.available) return selected;
  try {
    const choice = selected.segments[0];
    const p = profiles.find(p => p.id === choice.profileId && p.revision === choice.revision);
    if (p.basis.payMode === 'monthly') {
      check(object(request.baseContext), 'MONTHLY_BASE_CONTEXT_REQUIRED');
      shape(request.baseContext, ['kind', 'reviewed', 'reference']);
      check(request.baseContext.kind === 'fullUnadjustedMonth' && request.baseContext.reviewed === true, 'MONTHLY_BASE_CONTEXT_REQUIRED');
      token(request.baseContext.reference);
    } else check(!Object.hasOwn(request, 'baseContext'), 'UNEXPECTED_MONTHLY_CONTEXT');
    check(Array.isArray(request.allowanceQuantities), 'ALLOWANCE_QUANTITIES_REQUIRED');
    const quantities = new Map();
    for (const q of request.allowanceQuantities) {
      shape(q, ['id', 'quantity', 'reviewed', 'reference']); token(q.id); token(q.reference);
      check(q.reviewed === true, 'QUANTITY_REVIEW_REQUIRED'); decimal(q.quantity);
      check(!quantities.has(q.id), 'DUPLICATE_ALLOWANCE_QUANTITY'); quantities.set(q.id, q);
    }
    check(quantities.size === p.allowances.length && p.allowances.every(a => quantities.has(a.id)), 'MISSING_OR_UNKNOWN_ALLOWANCE_QUANTITY');
    const hourly = hourlyRate(p);
    const compile = r => {
      const v = { id: r.id, bucket: r.bucket, when: copy(r.when), scope: r.scope, kind: r.kind };
      if (r.kind !== 'covered') {
        v.hourlyEuro = r.rate.mode === 'profileHourly' ? hourly : r.rate.euro;
        v.factor = r.factor;
      }
      if (r.kind === 'premium') v.group = r.group;
      return v;
    };
    const config = { id: p.id + '@' + p.revision + ':' + request.period, currency: 'EUR',
      rounding: p.rounding.policy, payMode: p.basis.payMode,
      ...(p.basis.payMode === 'monthly' ? { monthlyBaseEuro: p.basis.monthlyBaseEuro } : {}),
      tagPolicy: Object.fromEntries(TAGS.map(t => [t, p.tagPolicy[t].policy])),
      baseRules: p.baseRules.map(compile), premiumRules: p.premiumRules.map(compile),
      premiumGroups: Object.fromEntries(p.premiumGroups.map(g => [g.id, g.policy])),
      allowances: p.allowances.map(a => ({ id: a.id, description: a.description,
        unit: a.unit, quantity: quantities.get(a.id).quantity, unitEuro: a.unitEuro })) };
    const fields = { monthlyBaseEuro: p.basis.sourceIds, divisor: p.basis.sourceIds,
      hourlyEuro: p.basis.hourlyRate.sourceIds, rounding: p.rounding.sourceIds };
    if (p.basis.payMode === 'monthly') fields['rule:$monthlyBase'] = p.basis.sourceIds;
    for (const tag of TAGS) fields['tagPolicy:' + tag] = p.tagPolicy[tag].sourceIds;
    for (const r of [...p.baseRules, ...p.premiumRules, ...p.allowances]) {
      fields['rule:' + r.id] = r.sourceIds;
      if (r.rate) fields['rate:' + r.id] = r.rate.sourceIds;
    }
    for (const g of p.premiumGroups) fields['group:' + g.id] = g.sourceIds;
    const provenance = copy({ profileId: p.id, revision: p.revision, origin: p.origin,
      verification: p.verification, validity: p.validity, ccnl: p.ccnl, companyId: p.companyId,
      level: p.level, sources: p.sources, fields,
      hourlyDerivation: p.basis.hourlyRate.mode,
      baseContext: request.baseContext ?? null, quantityEvidence: request.allowanceQuantities });
    return { ...selected, status: 'preparedForIsolatedUse', config, provenance,
      warnings: ['No real payroll authorization; documentary metadata require external authentication.'] };
  } catch (e) { return unavailable(errorCode(e)); }
}

module.exports = { validateProfile, validateCatalog, selectProfiles, prepareEconomyConfig };
