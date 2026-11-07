'use strict';

const { createCoordinator } = require('./coordinatore.cjs');
const PRIVATE_GPG_PREVIEW_ENABLED = false;
const compare = createCoordinator({
  loadCore: () => ({
    classifyHours: require('./core/classificaOre.cjs').classifyHours,
    calculateEconomy: require('./core/calcolaEconomia.cjs').calculateEconomy,
    classifySnapshot: require('./core/adattatoreCalendario.cjs').classifySnapshot,
    prepareEconomyConfig: require('./core/profiliGpg.cjs').prepareEconomyConfig,
  }),
  // Nessun catalogo reale approvato disponibile: non importare fixture di test.
  loadCatalog: () => ({ profiles: [], approvedVersions: [], reviewedForPrivateDiagnostic: false, syntheticOnly: false }),
});
function comparePrivateGpg(input) {
  if (!input || input.operator !== 'gpg') return compare({ operator: 'notGpg' });
  if (!PRIVATE_GPG_PREVIEW_ENABLED) {
    return compare({ operator: 'gpg', enabled: false, legacy: input.legacy });
  }
  return compare(input);
}
module.exports = { comparePrivateGpg, PRIVATE_GPG_PREVIEW_ENABLED };
