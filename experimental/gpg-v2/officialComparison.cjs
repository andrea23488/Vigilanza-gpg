'use strict';
const { calculateNet } = require('./core/fiscalita.cjs');
const { createCoordinator } = require('./coordinatore.cjs');
const { captureLegacyMonthly } = require('./legacySnapshot.cjs');
const { readonlySnapshot, periodKey } = require('./privateConnection.cjs');
const compare = createCoordinator({
  loadCore: () => ({
    classifyHours: require('./core/classificaOre.cjs').classifyHours,
    calculateEconomy: require('./core/calcolaEconomia.cjs').calculateEconomy,
    classifySnapshot: require('./core/adattatoreCalendario.cjs').classifySnapshot,
    prepareEconomyConfig: require('./core/profiliGpg.cjs').prepareEconomyConfig,
  }),
  // I materiali recuperati non contengono profili reali approvati. Non promuovere fixture sintetiche.
  loadCatalog: () => ({ profiles: [], approvedVersions: [], reviewedForPrivateDiagnostic: false, syntheticOnly: false }),
});
function officialComparison({ records, accountId, year, monthIndex, grossEuro, netEstimateEuro, fiscalConfig, taxByLine }) {
  const period = periodKey(year, monthIndex);
  try {
    const snapshot = readonlySnapshot(records, accountId);
    const result = compare({ operator: 'gpg', enabled: true,
      legacy: captureLegacyMonthly({ period, grossEuro, netEstimateEuro }),
      snapshot: { records: snapshot, coverage: { complete: false } },
      calendarOptions: { operator: 'gpg', period, civilTimeComparable: false, holidaysComplete: false },
      profileRequest: { operator: 'gpg', period, purpose: 'review' } });
    if (!result.issues.some(issue => issue.code === 'VERIFIED_GPG_PROFILE_MISSING')) result.issues.push({code:'VERIFIED_GPG_PROFILE_MISSING'});
    // La fiscalità è collegata al lordo 2.0, mai al lordo legacy per simulare una validazione.
    const fiscalLines = result.experimental.available ? result.experimental.lines.map(line => ({...line, ...taxByLine?.[line.id], id:line.id, amountCents:line.amountCents})) : [];
    result.fiscal = calculateNet(fiscalLines, {...fiscalConfig, period});
    // Anche un calcolo completo resta di revisione: nessun nuovo netto operativo senza validazione reale.
    result.experimental.netEstimateCents = null;
    return result;
  } catch {
    return { issues: [{ code: 'ACCOUNT_SNAPSHOT_UNCONFIRMED' }], fiscal: calculateNet([], {...fiscalConfig, period}) };
  }
}
module.exports = { officialComparison };
