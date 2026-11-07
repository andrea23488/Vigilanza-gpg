'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { annualIrpef, annualEmploymentDeduction, annualWedge, calculateNet } = require('../core/fiscalita.cjs');
const { calculatePayroll, reconcilePayroll } = require('../core/retribuzione.cjs');
const { classifyHours } = require('../core/classificaOre.cjs');
const reference = require('../reference/agosto-2026.cjs');
const line = (patch = {}) => ({ id:'base',amountCents:'200000',socialTaxable:true,incomeTax:'ordinary',taxSource:'SYNTHETIC_NOT_REAL_PROFILE',...patch });
const config = (patch = {}) => ({ period:'2026-08', contributionRatePercent:'10',contributionSource:'SYNTHETIC_NOT_INPS_RATE',contributionScope:'documentedFlatRateNoThresholds',contributionBaseRounding:'cent',
  totalIncomeAnnualEuro:'24000',employmentIncomeAnnualEuro:'24000',employmentDaysInYear:365,taxDaysInPeriod:31,
  employmentDeduction:'none',wedge:'none',additionalTaxesEuro:'0',otherTaxCreditsEuro:'0',additionalEmploymentDeductionEuro:'0',integrativeTreatmentEuro:'0',otherWithholdingsEuro:'0',regimesReviewed:true,method:'ordinaryMonthlyAnnualization12',...patch });
test('IRPEF progressiva: confini e seconda aliquota distinta 2025/2026', () => {
  assert.equal(annualIrpef('2800000',2026),'644000');
  assert.equal(annualIrpef('5000000',2026),'1370000');
  assert.equal(annualIrpef('5000000',2025),'1414000');
  assert.equal(annualIrpef('6000000',2026),'1800000');
  assert.equal(annualIrpef('0',2026),'0');
  assert.throws(()=>annualIrpef('2000000',2027),/NOT_SUPPORTED/);
});
test('detrazioni e cuneo: soglie e 65 euro separati dalla detrazione di base', () => {
  assert.equal(annualEmploymentDeduction('1500000'),'195500');
  assert.equal(annualEmploymentDeduction('2800000'),'197500');
  assert.equal(annualEmploymentDeduction('5000000'),'0');
  assert.deepEqual(annualWedge('850000','850000'),{exemptCents:'60350',deductionCents:'0'});
  assert.deepEqual(annualWedge('1500000','1500000'),{exemptCents:'79500',deductionCents:'0'});
  assert.deepEqual(annualWedge('2000000','2000000'),{exemptCents:'96000',deductionCents:'0'});
  assert.equal(annualWedge('3200000','3200000').deductionCents,'100000');
  assert.equal(annualWedge('3600000','3600000').deductionCents,'50000');
  assert.equal(annualWedge('4000000','4000000').deductionCents,'0');
});
test('contributi e IRPEF separati; rimborso esente accreditato interamente', () => {
  const result=calculateNet([line(),line({id:'rimborso',amountCents:'10000',socialTaxable:false,incomeTax:'exempt'})],config());
  assert.equal(result.available,true);assert.equal(result.socialBaseCents,'200000');assert.equal(result.contributionsCents,'20000');
  assert.equal(result.incomeTaxableCents,'180000');assert.equal(result.grossIncomeTaxCents,'41400');assert.equal(result.netCents,'148600');assert.equal(result.validated,false);
});
test('detrazioni non rimborsabili sotto zero, altre trattenute e addizionali esplicite', () => {
  const r=calculateNet([line()],config({otherTaxCreditsEuro:'1000',additionalTaxesEuro:'15.50',otherWithholdingsEuro:'20'}));
  assert.equal(r.netIncomeTaxCents,'0');assert.equal(r.netCents,'176450');
});
test('cuneo esente calcolato sul reddito del periodo e non su un rateo annuale fittizio', () => {
  const r=calculateNet([line({amountCents:'100000'})],config({totalIncomeAnnualEuro:'15000',employmentIncomeAnnualEuro:'15000',wedge:'statutory'}));
  assert.equal(r.exemptWedgeCents,'4770'); // 900 euro imponibili del periodo × 5,3%
  assert.equal(r.netCents,'74070');
});
test('assenze informative, aliquote mancanti e regimi speciali non generano un numero', () => {
  const missing=calculateNet([line()],{period:'2026-08'});assert.equal(missing.netCents,null);assert.ok(missing.issues.some(i=>i.field==='contributionRatePercent'));
  for(const patch of [{contributionRatePercent:''},{regimesReviewed:false},{employmentDaysInYear:200},{method:'arbitraryRatio'}])assert.equal(calculateNet([line()],config(patch)).netCents,null);
  assert.equal(calculateNet([line({incomeTax:'separate'})],config()).netCents,null);
  assert.equal(calculateNet([line(),line()],config()).netCents,null);
  assert.equal(calculateNet([line({socialTaxable:false,incomeTax:'exempt',benefitCode:'L207_2024'})],config({wedge:'statutory'})).netCents,null);
});
test('agosto reale: ore intatte e rifiuto di una nuova stima senza dati fiscali', () => {
  const classification=classifyHours(reference.calendar,{mode:'giornaliero',thresholdMinutes:420,thresholdBasis:'shiftDate',timeBasis:'civil',night:['21:00','05:00'],holidays:['2026-08-15']});
  assert.equal(classification.complete,true);assert.equal(classification.totals.workedMs/3600000,249.5);assert.equal(classification.totals.overtimeMs/3600000,67.5);assert.equal(classification.totals.sundayMs/3600000,35);
  const r=calculateNet(reference.payroll.rows,{period:reference.period});assert.equal(r.available,false);assert.equal(r.netCents,null);
  const payroll=reconcilePayroll({rows:reference.payroll.rows,grossCents:reference.payroll.declaredGrossCents,deductionsCents:reference.payroll.deductionsCents,roundingCents:reference.roundingCents,actualNetCents:reference.payroll.netStatedCents});
  assert.equal(payroll.reconstructedNetCents,'213300');assert.equal(payroll.type,'payrollReconstructionNotEstimate');assert.equal(payroll.grossDifferenceCents,'0');assert.equal(payroll.netDifferenceCents,'0');
});
test('pipeline usa il nucleo recuperato e conserva classificazione e importi; nessuna approvazione automatica', () => {
  const classification=classifyHours([{id:'a',date:'2026-08-03',start:'06:00',end:'14:00'}],{mode:'giornaliero',thresholdMinutes:420,thresholdBasis:'shiftDate',timeBasis:'civil',night:['21:00','05:00'],holidays:[]});
  const before=JSON.stringify(classification);
  const economyConfig={id:'SYNTHETIC',currency:'EUR',rounding:'halfUpPerRule',payMode:'monthly',monthlyBaseEuro:'1000',tagPolicy:{night:'none',sunday:'none',holiday:'none',restWorked:'none'},baseRules:[{id:'covered',bucket:'ordinary',when:{},scope:'paid',kind:'covered'},{id:'extra',bucket:'overtime',when:{},scope:'paid',kind:'full',hourlyEuro:'10',factor:'1.3'}],premiumRules:[],premiumGroups:{},allowances:[{id:'control-room',description:'Synthetic service',unit:'day',quantity:'2',unitEuro:'2'}]};
  const taxByLine=Object.fromEntries(['$monthlyBase','covered','extra','control-room'].map(id=>[id,{socialTaxable:true,incomeTax:'ordinary',taxSource:'SYNTHETIC'}]));
  const r=calculatePayroll({classification,economyConfig,taxByLine,fiscalConfig:config()});
  assert.equal(r.complete,true);assert.equal(r.operationallyApproved,false);assert.equal(r.gross.totals.amountCents,'101700');assert.equal(JSON.stringify(classification),before);
});

test('detrazioni del periodo: quota per giorni, incremento 65 esplicito e cuneo senza doppio conteggio',()=>{
  const result=calculateNet([line()],config({totalIncomeAnnualEuro:'30000',employmentIncomeAnnualEuro:'30000',employmentDeduction:'statutory',wedge:'statutory',additionalEmploymentDeductionEuro:'5.42'}));
  assert.equal(result.available,true);assert.equal(result.employmentDeductionCents,'15289');assert.equal(result.wedgeDeductionCents,'8493');assert.equal(result.netIncomeTaxCents,'17618');assert.equal(result.netCents,'162382');
  assert.equal(calculateNet([line()],config({period:'2026-02',taxDaysInPeriod:31})).netCents,null);
});

test('imponibile previdenziale arrotondato secondo il profilo documentato, separato dalle competenze',()=>{
 const base=line({amountCents:'200049'});
 const cent=calculateNet([base],config());const whole=calculateNet([base],config({contributionBaseRounding:'nearestEuro'}));
 assert.equal(cent.socialBaseCents,'200049');assert.equal(cent.contributionsCents,'20005');
 assert.equal(whole.socialBaseCents,'200049');assert.equal(whole.roundedSocialBaseCents,'200000');assert.equal(whole.contributionsCents,'20000');assert.equal(whole.grossCents,'200049');
});
