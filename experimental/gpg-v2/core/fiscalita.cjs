'use strict';
// Fiscalità ordinaria 2025–2026, in centesimi. Nessuna aliquota INPS personale implicita.
// Fonti/versioni in ../fonti-fiscalita.json. Il risultato non autorizza l'attivazione.
const MAX = 100000000000n;
function check(ok, code) { if (!ok) throw Error(code); }
function cents(value, signed = false) {
  check(typeof value === 'string' && (signed ? /^-?(0|[1-9]\d*)$/ : /^(0|[1-9]\d*)$/).test(value), 'INVALID_CENTS');
  const n = BigInt(value); check(n <= MAX && n >= -MAX, 'AMOUNT_OUT_OF_RANGE'); return n;
}
function euro(value) {
  check(typeof value === 'string' && /^(0|[1-9]\d{0,8})(\.\d{1,2})?$/.test(value), 'EURO_DECIMAL_REQUIRED');
  const [whole, fraction = ''] = value.split('.'); return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
function round(n, d) { check(d > 0n, 'INVALID_DIVISOR'); return n < 0n ? -round(-n, d) : (n + d / 2n) / d; }
function rate(value) {
  check(typeof value === 'string' && /^(0|[1-9]\d?)(\.\d{1,4})?$/.test(value), 'CONTRIBUTION_RATE_REQUIRED');
  const [whole, fraction = ''] = value.split('.'); return BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'));
}
function annualIrpef(taxableCents, year) {
  check(year === 2025 || year === 2026, 'FISCAL_YEAR_NOT_SUPPORTED');
  const income = cents(taxableCents);
  const first = income < 2800000n ? income : 2800000n;
  const second = income > 2800000n ? (income < 5000000n ? income : 5000000n) - 2800000n : 0n;
  const third = income > 5000000n ? income - 5000000n : 0n;
  return round(first * 23n + second * (year === 2026 ? 33n : 35n) + third * 43n, 100n).toString();
}
// Detrazione annuale per lavoratore dipendente impiegato tutto l'anno.
// Contratti parziali nell'anno e minimi 690/1380 richiedono un diverso profilo: non presumerli.
function annualEmploymentDeduction(totalIncomeCents) {
  const r = cents(totalIncomeCents); let deduction = 0n;
  if (r <= 1500000n) deduction = 195500n;
  else if (r <= 2800000n) deduction = 191000n + round(119000n * (2800000n - r), 1300000n);
  else if (r <= 5000000n) deduction = round(191000n * (5000000n - r), 2200000n);
  if (r > 2500000n && r <= 3500000n) deduction += 6500n;
  return deduction.toString();
}
function annualWedge(totalIncomeCents, employmentIncomeCents) {
  const r = cents(totalIncomeCents), employment = cents(employmentIncomeCents);
  check(employment <= r, 'EMPLOYMENT_INCOME_EXCEEDS_TOTAL');
  if (r <= 2000000n) return { exemptCents: round(employment * (employment <= 850000n ? 71n : employment <= 1500000n ? 53n : 48n), 1000n).toString(), deductionCents: '0' };
  return { exemptCents: '0', deductionCents: (r <= 3200000n ? 100000n : r < 4000000n ? round(100000n * (4000000n - r), 800000n) : 0n).toString() };
}
const REQUIRED = ['contributionRatePercent', 'contributionSource', 'contributionScope', 'contributionBaseRounding',
  'totalIncomeAnnualEuro', 'employmentIncomeAnnualEuro', 'employmentDaysInYear', 'taxDaysInPeriod',
  'employmentDeduction', 'wedge', 'additionalTaxesEuro', 'otherTaxCreditsEuro',
  'integrativeTreatmentEuro', 'additionalEmploymentDeductionEuro', 'otherWithholdingsEuro', 'regimesReviewed', 'method'];
function calculateNet(lines, config) {
  const missing = REQUIRED.filter(key => config?.[key] == null || config[key] === '');
  if (missing.length) return { available: false, netCents: null, issues: missing.map(field => ({ code: 'FISCAL_INPUT_REQUIRED', field })) };
  try {
    check(/^20\d\d-(0[1-9]|1[0-2])$/.test(config.period || ''), 'PERIOD_REQUIRED');
    const year = Number(config.period.slice(0, 4)); check([2025, 2026].includes(year), 'FISCAL_YEAR_NOT_SUPPORTED');
    check(config.method === 'ordinaryMonthlyAnnualization12', 'WITHHOLDING_METHOD_NOT_SUPPORTED');
    check(config.contributionScope === 'documentedFlatRateNoThresholds' && typeof config.contributionSource === 'string' && config.contributionSource.trim(), 'CONTRIBUTION_PROFILE_NOT_SUPPORTED');
    check(config.regimesReviewed === true, 'SPECIAL_REGIMES_REVIEW_REQUIRED');
    // Il rateo di detrazioni qui supportato è un rapporto di lavoro continuativo per l'intero anno.
    const daysInMonth = new Date(Date.UTC(year, Number(config.period.slice(5)), 0)).getUTCDate();
    check(config.employmentDaysInYear === 365 && Number.isInteger(config.taxDaysInPeriod) && config.taxDaysInPeriod >= 0 && config.taxDaysInPeriod <= daysInMonth, 'EMPLOYMENT_DAYS_NOT_SUPPORTED');
    check(['statutory', 'none'].includes(config.employmentDeduction) && ['statutory', 'none'].includes(config.wedge), 'DEDUCTION_POLICY_REQUIRED');
    check(Array.isArray(lines) && lines.length > 0, 'PAY_LINES_REQUIRED');
    const ids = new Set(); let gross = 0n, socialBase = 0n, taxableBeforeContributions = 0n, taxableSocialBase = 0n;
    for (const line of lines) {
      check(typeof line.id === 'string' && line.id && !ids.has(line.id), 'DUPLICATE_PAY_LINE'); ids.add(line.id);
      check(typeof line.socialTaxable === 'boolean' && ['ordinary', 'exempt'].includes(line.incomeTax), 'LINE_TAX_CLASSIFICATION_REQUIRED');
      // Tassazione separata arretrati, sostitutive rinnovi/turni e premi non vengono trasformati in IRPEF ordinaria.
      check(typeof line.taxSource === 'string' && line.taxSource.trim(), 'LINE_TAX_SOURCE_REQUIRED');
      check(!(line.socialTaxable && line.incomeTax === 'exempt'), 'MIXED_TAX_BASE_PROFILE_REQUIRED');
      check(!(line.benefitCode === 'L207_2024' && config.wedge === 'statutory'), 'DUPLICATE_WEDGE_BENEFIT');
      const amount = cents(line.amountCents, true); gross += amount;
      if (line.socialTaxable) socialBase += amount;
      if (line.incomeTax === 'ordinary') { taxableBeforeContributions += amount; if (line.socialTaxable) taxableSocialBase += amount; }
    }
    check(gross >= 0n && socialBase >= 0n && taxableBeforeContributions >= 0n && taxableSocialBase >= 0n && taxableSocialBase <= socialBase, 'INVALID_TAX_BASE');
    check(['cent', 'nearestEuro'].includes(config.contributionBaseRounding), 'CONTRIBUTION_ROUNDING_REQUIRED');
    const roundedSocialBase = config.contributionBaseRounding === 'nearestEuro' ? round(socialBase, 100n) * 100n : socialBase;
    const percent = rate(config.contributionRatePercent);
    const contributions = round(roundedSocialBase * percent, 1000000n);
    const deductibleContributions = socialBase > 0n ? round(contributions * taxableSocialBase, socialBase) : 0n;
    const taxable = taxableBeforeContributions - deductibleContributions; check(taxable >= 0n, 'NEGATIVE_TAXABLE_INCOME');
    const totalIncome = euro(config.totalIncomeAnnualEuro), employmentIncome = euro(config.employmentIncomeAnnualEuro);
    check(employmentIncome <= totalIncome, 'EMPLOYMENT_INCOME_EXCEEDS_TOTAL');
    const annualDeduction = config.employmentDeduction === 'statutory' ? BigInt(annualEmploymentDeduction(totalIncome.toString())) : 0n;
    const wedge = config.wedge === 'statutory' ? annualWedge(totalIncome.toString(), employmentIncome.toString()) : { exemptCents: '0', deductionCents: '0' };
    const days = BigInt(config.taxDaysInPeriod);
    const annualExtra = config.employmentDeduction === 'statutory' && totalIncome > 2500000n && totalIncome <= 3500000n ? 6500n : 0n;
    const periodExtra = euro(config.additionalEmploymentDeductionEuro);
    check(periodExtra <= annualExtra, 'ADDITIONAL_DEDUCTION_NOT_ENTITLED');
    const employmentDeduction = round((annualDeduction - annualExtra) * days, 365n) + periodExtra;
    const wedgeDeduction = round(BigInt(wedge.deductionCents) * days, 365n);
    // La somma esente <=20mila si applica al reddito del periodo; solo la scelta della percentuale usa il reddito annualizzato.
    const exemptWedge = config.wedge === 'statutory' && totalIncome <= 2000000n ? round(taxable * (employmentIncome <= 850000n ? 71n : employmentIncome <= 1500000n ? 53n : 48n), 1000n) : 0n;
    const grossTax = round(BigInt(annualIrpef((taxable * 12n).toString(), year)), 12n);
    const taxCredits = euro(config.otherTaxCreditsEuro);
    const netTax = grossTax > employmentDeduction + wedgeDeduction + taxCredits ? grossTax - employmentDeduction - wedgeDeduction - taxCredits : 0n;
    const additionalTaxes = euro(config.additionalTaxesEuro), other = euro(config.otherWithholdingsEuro), treatment = euro(config.integrativeTreatmentEuro);
    const net = gross - contributions - netTax - additionalTaxes - other + exemptWedge + treatment;
    return { available: true, validated: false, method: config.method, period: config.period,
      grossCents: gross.toString(), socialBaseCents: socialBase.toString(), roundedSocialBaseCents: roundedSocialBase.toString(), contributionsCents: contributions.toString(),
      incomeTaxableCents: taxable.toString(), grossIncomeTaxCents: grossTax.toString(), employmentDeductionCents: employmentDeduction.toString(),
      wedgeDeductionCents: wedgeDeduction.toString(), netIncomeTaxCents: netTax.toString(), additionalTaxesCents: additionalTaxes.toString(),
      otherWithholdingsCents: other.toString(), exemptWedgeCents: exemptWedge.toString(), netCents: net.toString(),
      issues: [], warnings: ['STIMA_NON_VALIDATA_SU_CEDOLINI', 'CONGUAGLI_E_REGIMI_SPECIALI_ESCLUSI'] };
  } catch (error) { return { available: false, netCents: null, issues: [{ code: error.message }] }; }
}
module.exports = { annualIrpef, annualEmploymentDeduction, annualWedge, calculateNet };
