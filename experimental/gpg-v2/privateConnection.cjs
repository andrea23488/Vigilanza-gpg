'use strict';
const { createCoordinator } = require('./coordinatore.cjs');
const { captureLegacyMonthly } = require('./legacySnapshot.cjs');
const compare = createCoordinator({
  loadCore: () => ({
    classifyHours: require('./core/classificaOre.cjs').classifyHours,
    calculateEconomy: require('./core/calcolaEconomia.cjs').calculateEconomy,
    classifySnapshot: require('./core/adattatoreCalendario.cjs').classifySnapshot,
    prepareEconomyConfig: require('./core/profiliGpg.cjs').prepareEconomyConfig,
  }),
  loadCatalog: () => ({ profiles: [], approvedVersions: [], reviewedForPrivateDiagnostic: false, syntheticOnly: false }),
});
function canOpenPrivatePreview({ platform, config, operator, accountId, profileRole }) {
  return platform === 'ios' && config?.ios?.bundleIdentifier === 'com.vigilanzagpg.app.iosprivata' &&
    config?.extra?.privateIosRealTest === true && operator === 'gpg' &&
    profileRole === 'Guardia Particolare Giurata' &&
    typeof accountId === 'string' && accountId.length > 0;
}
function periodKey(year, monthIndex) {
  if (!Number.isInteger(year) || year < 2000 || year > 2099 ||
      !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) return null;
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}
const OMIT = new Set(['user_id', 'luogo', 'indirizzo_servizio', 'localita_meteo', 'created_at', 'updated_at']);
function readValue(object, key) {
  const d = Object.getOwnPropertyDescriptor(object, key);
  if (!d || !('value' in d)) throw Error('SNAPSHOT_NOT_PLAIN');
  return d.value;
}
function readonlySnapshot(records, accountId) {
  // Nessuna ricostruzione di orari o conversione di durate. Conserva anche zero/null.
  if (!Array.isArray(records) || records.length === 0) throw Error('ACCOUNT_SNAPSHOT_UNCONFIRMED');
  return Object.freeze(records.map(record => {
    if (!record || Object.getPrototypeOf(record) !== Object.prototype ||
        readValue(record, 'user_id') !== accountId) throw Error('ACCOUNT_SNAPSHOT_UNCONFIRMED');
    const copy = Object.create(null);
    for (const key of Object.keys(record)) {
      if (OMIT.has(key)) continue;
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('SNAPSHOT_NOT_PLAIN');
      const value = readValue(record, key);
      if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) throw Error('SNAPSHOT_NOT_PLAIN');
      if (typeof value === 'number' && !Number.isFinite(value)) throw Error('SNAPSHOT_NOT_PLAIN');
      copy[key] = value;
    }
    return Object.freeze(copy);
  }));
}
function previewResult(input) {
  if (!canOpenPrivatePreview(input)) return null; // non legge turni/importi dei Fiduciari
  const period = periodKey(input.year, input.monthIndex);
  if (!period) return null;
  let legacy = captureLegacyMonthly({ period, grossEuro: null, netEstimateEuro: null });
  try {
    const records = readonlySnapshot(input.records, input.accountId);
    legacy = captureLegacyMonthly({ period, grossEuro: input.grossEuro, netEstimateEuro: input.netEstimateEuro });
    const result = compare({ operator: 'gpg', enabled: true, legacy,
      snapshot: { records, coverage: { complete: false } },
      // Il calendario reale non certifica ancora copertura, DST o festivita: non dichiararli verificati.
      calendarOptions: { operator: 'gpg', period, civilTimeComparable: false, holidaysComplete: false },
      profileRequest: { operator: 'gpg', period, purpose: 'review' } });
    if (!result.issues.some(i => i.code === 'VERIFIED_GPG_PROFILE_MISSING')) {
      result.issues.push({ code: 'VERIFIED_GPG_PROFILE_MISSING' });
    }
    return result;
  } catch (error) {
    const code = ['ACCOUNT_SNAPSHOT_UNCONFIRMED', 'SNAPSHOT_NOT_PLAIN', 'INVALID_LEGACY_AMOUNT'].includes(error?.message)
      ? error.message : 'PRIVATE_COMPARISON_UNAVAILABLE';
    // Errori sanitizzati; mai inoltrare record, importi o messaggi di eccezione ai log.
    return { version: 1, status: 'unavailable', audience: 'privatePreview', operationalSource: 'legacy',
      legacy: captureLegacyMonthly({ period, grossEuro: null, netEstimateEuro: null }),
      experimental: { available: false, grossCents: null, netEstimateCents: null, hours: null },
      differences: { grossCents: null, netCents: null },
      issues: [{ code }, { code: 'VERIFIED_GPG_PROFILE_MISSING' }],
      fallback: { source: 'legacy', reason: code } };
  }
}
module.exports = { canOpenPrivatePreview, periodKey, readonlySnapshot, previewResult };
