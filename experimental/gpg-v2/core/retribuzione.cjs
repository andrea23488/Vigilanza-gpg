'use strict';
const { calculateEconomy } = require('./calcolaEconomia.cjs');
const { calculateNet } = require('./fiscalita.cjs');
// Estensione del nucleo recuperato: conserva la classificazione delle ore e non muta il calendario.
function calculatePayroll({ classification, economyConfig, taxByLine, fiscalConfig }) {
  const economy = calculateEconomy(classification, economyConfig);
  if (!economy.complete) return { complete: false, gross: null, fiscal: null, issues: economy.issues };
  const unknown = Object.keys(taxByLine || {}).filter(id => !economy.lines.some(line => line.id === id));
  if (unknown.length) return { complete: false, gross: economy, fiscal: null, issues: unknown.map(id => ({ code: 'UNKNOWN_TAX_LINE', id })) };
  const fiscal = calculateNet(economy.lines.map(line => ({ ...line, ...taxByLine?.[line.id], id: line.id, amountCents: line.amountCents })), fiscalConfig);
  return { complete: fiscal.available, operationallyApproved: false, gross: economy, fiscal, issues: fiscal.issues };
}
function reconcilePayroll({ rows, grossCents, deductionsCents, roundingCents, actualNetCents }) {
  try {
    const parse = value => { if (typeof value !== 'string' || !/^-?(0|[1-9]\d*)$/.test(value)) throw Error('CENTS_REQUIRED'); return BigInt(value); };
    if (!Array.isArray(rows) || !rows.length || new Set(rows.map(row => row.code)).size !== rows.length) throw Error('INVALID_PAYROLL_ROWS');
    const sum = rows.reduce((n, row) => n + parse(row.amountCents), 0n);
    const reconstructed = sum - parse(deductionsCents) + parse(roundingCents);
    return { available: true, type: 'payrollReconstructionNotEstimate', grossDifferenceCents: (sum - parse(grossCents)).toString(),
      reconstructedNetCents: reconstructed.toString(), netDifferenceCents: (reconstructed - parse(actualNetCents)).toString() };
  } catch (error) { return { available: false, issue: error.message, reconstructedNetCents: null }; }
}
module.exports = { calculatePayroll, reconcilePayroll };
