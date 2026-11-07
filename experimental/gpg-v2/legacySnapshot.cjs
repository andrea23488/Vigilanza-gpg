'use strict';

// Conserva la rappresentazione già mostrata dal legacy (.toFixed(2)), senza formule nuove.
function displayedCents(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw Error('INVALID_LEGACY_AMOUNT');
  const displayed = value.toFixed(2);
  if (!/^-?\d+\.\d{2}$/.test(displayed)) throw Error('INVALID_LEGACY_AMOUNT');
  const negative = displayed.startsWith('-');
  const digits = displayed.replace('-', '').replace('.', '').replace(/^0+(?=\d)/, '');
  return negative && digits !== '0' ? '-' + digits : digits;
}
function captureLegacyMonthly({ period, grossEuro, netEstimateEuro }) {
  if (typeof period !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)) throw Error('INVALID_PERIOD');
  return { source: 'legacy', period, scope: 'fullMonth',
    grossCents: displayedCents(grossEuro), netEstimateCents: displayedCents(netEstimateEuro) };
}
module.exports = { captureLegacyMonthly };
