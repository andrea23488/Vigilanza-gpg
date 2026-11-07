'use strict';
// Esclusivamente fixture dei test. Nessun valore è una tariffa GPG reale.
const clone = v => JSON.parse(JSON.stringify(v));
function profile(patch = {}) {
  return { schemaVersion: 1, id: 'SYN_PROFILE', revision: 1, operator: 'gpg', origin: 'synthetic',
    ccnl: { id: 'SYN_CCNL', version: 'SYN_V1' }, companyId: 'SYN_A', level: 'SYN_L1',
    validity: { from: '2030-01-01', to: null },
    verification: { status: 'experimental', reviewId: null, reviewedOn: null },
    sources: [{ id: 'SRC1', kind: 'synthetic', reference: 'SYNTHETIC_TEST_ONLY', sha256: null, status: 'unreviewed' }],
    basis: { payMode: 'monthly', monthlyBaseEuro: '1000', divisor: '100', sourceIds: ['SRC1'],
      hourlyRate: { mode: 'exactBaseDivisor', sourceIds: ['SRC1'] } },
    rounding: { policy: 'halfUpPerRule', sourceIds: ['SRC1'] },
    tagPolicy: Object.fromEntries(['night', 'sunday', 'holiday', 'restWorked']
      .map(tag => [tag, { policy: 'none', sourceIds: ['SRC1'] }])),
    baseRules: [
      { id: 'ORD', bucket: 'ordinary', when: {}, scope: 'paid', kind: 'covered', sourceIds: ['SRC1'] },
      { id: 'OT', bucket: 'overtime', when: {}, scope: 'paid', kind: 'full',
        rate: { mode: 'profileHourly', sourceIds: ['SRC1'] }, factor: '1.25', sourceIds: ['SRC1'] },
    ], premiumRules: [], premiumGroups: [], allowances: [], ...clone(patch) };
}
function request(patch = {}) {
  return { operator: 'gpg', period: '2030-04', purpose: 'syntheticTest',
    assignments: [{ from: '2030-04-01', to: '2030-04-30', companyId: 'SYN_A',
      ccnlId: 'SYN_CCNL', contractVersion: 'SYN_V1', level: 'SYN_L1' }],
    baseContext: { kind: 'fullUnadjustedMonth', reviewed: true, reference: 'SYN_BASE_CONTEXT' },
    allowanceQuantities: [], ...clone(patch) };
}
function premium(id, when, group = 'PREM') {
  return { id, bucket: 'all', when, scope: 'worked', kind: 'premium',
    rate: { mode: 'explicit', euro: '2', sourceIds: ['SRC1'] },
    factor: '1', group, sourceIds: ['SRC1'] };
}
function allowance(patch = {}) {
  return { id: 'ALLOW1', concept: 'SYN_SERVICE_ALLOWANCE', description: 'SYN_ALLOWANCE_ONLY',
    unit: 'day', unitEuro: '3.25', sourceIds: ['SRC1'], ...clone(patch) };
}
function documentaryMetadataMock() {
  // Mock della dichiarazione di verifica, NON un documento o profilo reale verificato.
  const p = profile();
  p.origin = 'documentary';
  p.verification = { status: 'verified', reviewId: 'SYN_MOCK_REVIEW', reviewedOn: '2030-03-01' };
  p.sources = [{ id: 'SRC1', kind: 'documentary', reference: 'SYN_FAKE_DOCUMENT_NOT_EVIDENCE',
    sha256: 'a'.repeat(64), status: 'reviewed' }];
  return p;
}
module.exports = { profile, request, premium, allowance, documentaryMetadataMock };
