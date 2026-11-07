'use strict';

const { probeRuntime } = require('./runtimeProbe.cjs');
function check(ok, code) { if (!ok) { const e = Error(code); e.code = code; throw e; } }
function plainCopy(value, seen = new Set(), budget = { nodes: 0 }, depth = 0) {
  check(++budget.nodes <= 100000 && depth <= 40, 'SNAPSHOT_TOO_LARGE');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') { check(Number.isFinite(value), 'INVALID_SNAPSHOT'); return value; }
  check(value && typeof value === 'object' && !seen.has(value), 'INVALID_SNAPSHOT');
  check(Array.isArray(value) || [Object.prototype, null].includes(Object.getPrototypeOf(value)), 'INVALID_SNAPSHOT');
  seen.add(value);
  const entries = Object.entries(Object.getOwnPropertyDescriptors(value)).filter(([key]) => key !== 'length');
  const out = Array.isArray(value) ? [] : {};
  for (const [key, descriptor] of entries) {
    check(descriptor.enumerable && 'value' in descriptor && !['__proto__', 'constructor', 'prototype'].includes(key), 'INVALID_SNAPSHOT');
    out[key] = plainCopy(descriptor.value, seen, budget, depth + 1);
  }
  seen.delete(value);
  return Object.freeze(out);
}
function money(value) { return value === null || typeof value === 'string' && /^-?(0|[1-9]\d{0,29})$/.test(value); }
function legacySnapshot(raw) {
  check(raw && raw.source === 'legacy' && raw.scope === 'fullMonth' &&
    typeof raw.period === 'string' && /^20\d{2}-(0[1-9]|1[0-2])$/.test(raw.period) &&
    money(raw.grossCents) && money(raw.netEstimateCents), 'LEGACY_SNAPSHOT_INVALID');
  return { source: 'legacy', period: raw.period, scope: raw.scope,
    grossCents: raw.grossCents, netEstimateCents: raw.netEstimateCents };
}
function baseResult() {
  return { version: 1, status: 'unavailable', audience: 'privatePreview', operationalSource: 'legacy',
    legacy: null, experimental: { available: false, grossCents: null, netEstimateCents: null,
      hours: null, provenance: null, lines: [] },
    differences: { grossCents: null, netCents: null }, issues: [],
    fallback: { source: 'legacy', reason: 'EXPERIMENT_NOT_AVAILABLE' } };
}
function safeIssues(items, fallback) {
  return Array.isArray(items) && items.length ? items.map(i => ({
    code: typeof i.code === 'string' && /^[A-Z][A-Z0-9_]{0,90}$/.test(i.code) ? i.code : fallback,
  })) : [{ code: fallback }];
}
function createCoordinator({ loadCore, loadCatalog, runtimeProbe = probeRuntime } = {}) {
  // Factory separata dai punti di integrazione dell'app; nessun dato utente mantenuto fra chiamate.
  return function compare(input) {
    const result = baseResult();
    const stop = (code, issues = null) => {
      result.issues = issues || [{ code }]; result.fallback.reason = code; return result;
    };
    // Non si leggono neppure snapshot o loader per operatori diversi da GPG.
    if (!input || input.operator !== 'gpg') {
      result.status = 'notApplicable'; return stop('GPG_ONLY');
    }
    try {
      const legacyDescriptor = Object.getOwnPropertyDescriptor(input, 'legacy');
      check(legacyDescriptor && 'value' in legacyDescriptor, 'LEGACY_SNAPSHOT_INVALID');
      result.legacy = legacySnapshot(plainCopy(legacyDescriptor.value));
      if (input.enabled !== true) { result.status = 'disabled'; return stop('EXPERIMENT_DISABLED'); }
      const data = plainCopy(input);
      check(Object.keys(data).every(k => ['operator', 'enabled', 'legacy', 'snapshot', 'calendarOptions', 'profileRequest'].includes(k)), 'UNKNOWN_INPUT_FIELD');
      check(data.calendarOptions && data.profileRequest && data.calendarOptions.operator === 'gpg' &&
        data.profileRequest.operator === 'gpg', 'GPG_INPUT_REQUIRED');
      check(data.calendarOptions.period === result.legacy.period && data.profileRequest.period === result.legacy.period,
        'PERIOD_MISMATCH');
      // Review è una richiesta esplicita di diagnostica, non un aggiramento di realPayroll del Blocco 8.
      check(data.profileRequest.purpose === 'review', 'PRIVATE_REVIEW_PURPOSE_REQUIRED');
      check(runtimeProbe().supported === true, 'RUNTIME_NOT_SUPPORTED');
      check(typeof loadCore === 'function', 'CORE_NOT_AVAILABLE');
      const core = loadCore();
      const adapted = core.classifySnapshot(data.snapshot, data.calendarOptions, core.classifyHours);
      if (!adapted.complete) return stop('CALENDAR_NOT_AVAILABLE', safeIssues(adapted.issues, 'CALENDAR_NOT_AVAILABLE'));
      // Non si espongono segmenti, identificativi originali o riferimenti personali.
      result.experimental.hours = plainCopy(adapted.periodResult.totals);
      if (typeof loadCatalog !== 'function') return stop('VERIFIED_GPG_PROFILE_MISSING');
      const catalog = plainCopy(loadCatalog());
      check(catalog && Array.isArray(catalog.profiles) && Array.isArray(catalog.approvedVersions), 'CATALOG_INVALID');
      if (!catalog.profiles.length) return stop('VERIFIED_GPG_PROFILE_MISSING');
      check(catalog.reviewedForPrivateDiagnostic === true && typeof catalog.syntheticOnly === 'boolean', 'CATALOG_REVIEW_REQUIRED');
      const prepared = core.prepareEconomyConfig(catalog.profiles, data.profileRequest);
      if (!prepared.available) return stop('PROFILE_NOT_AVAILABLE', safeIssues(prepared.issues, 'PROFILE_NOT_AVAILABLE'));
      const p = prepared.provenance;
      check(p.origin === 'documentary' && p.verification.status === 'verified', 'VERIFIED_GPG_PROFILE_MISSING');
      const approval = catalog.approvedVersions.find(a => a.profileId === p.profileId && a.revision === p.revision);
      check(approval && approval.periodPolicy === data.calendarOptions.periodPolicy &&
        typeof approval.reviewReference === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(approval.reviewReference), 'PROFILE_REVIEW_RECEIPT_MISSING');
      const economy = core.calculateEconomy(adapted.periodResult, prepared.config);
      if (!economy.complete) return stop('ECONOMY_NOT_AVAILABLE', safeIssues(economy.issues, 'ECONOMY_NOT_AVAILABLE'));
      check(economy.totals && money(economy.totals.amountCents) && economy.totals.amountCents !== null, 'INVALID_ECONOMY_OUTPUT');
      result.status = 'readyForPrivateReview';
      result.audience = catalog.syntheticOnly ? 'syntheticHarness' : 'privatePreview';
      result.experimental.available = true;
      result.experimental.grossCents = economy.totals.amountCents;
      result.experimental.lines = plainCopy(economy.lines);
      result.experimental.provenance = plainCopy({ ...p, privateReviewReceipt: approval,
        period: data.profileRequest.period, periodPolicy: data.calendarOptions.periodPolicy,
        realUseAuthorized: false, syntheticOnly: catalog.syntheticOnly });
      if (result.legacy.grossCents !== null) {
        result.differences.grossCents = (BigInt(economy.totals.amountCents) - BigInt(result.legacy.grossCents)).toString();
      }
      // Nessun nuovo netto: quello legacy resta uno snapshot indipendente.
      result.fallback.reason = 'LEGACY_REMAINS_OPERATIONAL';
      JSON.stringify(result); // Il DTO deve essere serializzabile senza replacer o mutazioni globali.
      return result;
    } catch (error) {
      result.status = 'unavailable';
      result.experimental.available = false; result.experimental.grossCents = null;
      result.experimental.provenance = null; result.experimental.lines = [];
      result.differences.grossCents = null;
      const code = error && typeof error.code === 'string' && /^[A-Z][A-Z0-9_]{0,90}$/.test(error.code)
        ? error.code : 'COORDINATOR_FAILED';
      return stop(code);
    }
  };
}
module.exports = { createCoordinator };
