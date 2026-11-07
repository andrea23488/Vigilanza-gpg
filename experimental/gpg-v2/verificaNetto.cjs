'use strict';

// Sole metriche diagnostiche. Nessuna calibrazione, aliquota o previsione fiscale.
const TOKEN = /^[A-Z][A-Z0-9_]{0,79}$/;
function failure(code) { const e = Error(code); e.code = code; throw e; }
function cents(v) {
  if (typeof v !== 'string' || !/^-?(0|[1-9]\d{0,29})$/.test(v)) failure('INVALID_CENTS');
  return BigInt(v);
}
function assessNetCase(item) {
  try {
    const fields = ['id', 'estimatePeriod', 'payrollPeriod', 'comparisonBasis', 'methodRevision',
      'estimatedCents', 'actualCents', 'reference'];
    if (!item || !Object.keys(item).every(k => fields.includes(k))) failure('INVALID_NET_CASE');
    for (const k of ['id', 'methodRevision', 'reference']) if (!TOKEN.test(item[k] || '')) failure('INVALID_REFERENCE');
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(item.estimatePeriod || '') ||
      item.estimatePeriod !== item.payrollPeriod || item.comparisonBasis !== 'closedMonth') failure('NET_PERIOD_NOT_COMPARABLE');
    const estimate = cents(item.estimatedCents), actual = cents(item.actualCents);
    if (actual < BigInt('0')) failure('INVALID_ACTUAL_NET');
    const delta = estimate - actual, absolute = delta < BigInt('0') ? -delta : delta;
    // Intervalli continui in centesimi: >30..50, >50..<100. Nessun arrotondamento che nasconda lo scarto.
    const band = absolute <= BigInt('3000') ? 'ottimo' : absolute <= BigInt('5000')
      ? 'daMigliorare' : absolute < BigInt('10000') ? 'richiedeVerifica' : 'nonAccettabile';
    return { available: true, id: item.id, period: item.estimatePeriod, methodRevision: item.methodRevision,
      deltaCents: delta.toString(), absoluteCents: absolute.toString(), band,
      absolutePercentage: actual === BigInt('0') ? null : {
        numerator: (absolute * BigInt('100')).toString(), denominator: actual.toString(),
      }, percentageUnavailableReason: actual === BigInt('0') ? 'ZERO_ACTUAL_NET' : null,
      diagnosticOnly: true, guarantee: false };
  } catch (e) {
    return { available: false, issue: e.code || 'INVALID_NET_CASE', deltaCents: null,
      absoluteCents: null, absolutePercentage: null, diagnosticOnly: true, guarantee: false };
  }
}
function assessNetCohort(items) {
  if (!Array.isArray(items) || !items.length) return { available: false, issue: 'NET_CASES_REQUIRED', cases: [] };
  const assessed = items.map(assessNetCase);
  if (assessed.some(r => !r.available)) return { available: false, issue: 'INCOMPLETE_NET_COHORT', cases: [] };
  if (new Set(assessed.map(r => r.id)).size !== assessed.length) return { available: false, issue: 'DUPLICATE_NET_CASE', cases: [] };
  if (new Set(assessed.map(r => r.methodRevision)).size !== 1) return { available: false, issue: 'MIXED_ESTIMATE_METHODS', cases: [] };
  const periods = new Set(assessed.map(r => r.period));
  const sum = assessed.reduce((n, r) => n + BigInt(r.absoluteCents), BigInt('0'));
  const max = assessed.reduce((n, r) => BigInt(r.absoluteCents) > n ? BigInt(r.absoluteCents) : n, BigInt('0'));
  return { available: true, status: periods.size < 2 ? 'insufficientPeriods' : 'diagnosticOnly',
    cases: assessed, distinctPeriods: periods.size,
    meanAbsoluteCents: { numerator: sum.toString(), denominator: String(assessed.length) },
    maxAbsoluteCents: max.toString(),
    bandCounts: Object.fromEntries(['ottimo', 'daMigliorare', 'richiedeVerifica', 'nonAccettabile']
      .map(band => [band, assessed.filter(r => r.band === band).length])),
    calibrated: false, guarantee: false,
    note: 'Almeno due periodi evita il singolo cedolino; non dimostra accuratezza generale.' };
}
module.exports = { assessNetCase, assessNetCohort };
