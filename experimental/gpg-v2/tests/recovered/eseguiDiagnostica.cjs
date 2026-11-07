'use strict';
const {diagnose}=require('../../diagnosticaCedolino.cjs');
const FIELDS=['durationMs','workedMs','classifiableMs','ordinaryMs','overtimeMs','nightMs','sundayMs','holidayMs','restWorkedMs'];
// Dipendenze iniettate: nessuna importazione dell'app o del runner legacy.
function createDiagnostic({classifyHours,calculateEconomy}) {
  return function run(input) {
    try {
      if(!input || !/^20\d\d-(0[1-9]|1[0-2])$/.test(input.period)) throw Error('PERIOD_REQUIRED');
      if(input.periodPolicy!=='shiftStartDateAfterContextClassification') throw Error('PERIOD_POLICY_REQUIRED');
      if(input.contextComplete!==true) throw Error('CONTEXT_NOT_CONFIRMED');
      if(input.civilTimeComparable!==true) throw Error('DST_OR_TIME_BASIS_UNRESOLVED');
      const classification=classifyHours(input.shifts,input.hours);
      if(!classification.complete) return {complete:false,status:'insufficientData',issues:classification.issues,netCents:null};
      const ids=new Set(input.shifts.filter(s=>s.date.startsWith(input.period+'-')).map(s=>s.id));
      const segments=classification.segments.filter(s=>ids.has(s.shiftId));
      const totals=Object.fromEntries(FIELDS.map(k=>[k,segments.reduce((n,s)=>n+s[k],0)]));
      const filtered={...classification,segments,shifts:classification.shifts.filter(s=>ids.has(s.shiftId)),totals};
      const economy=calculateEconomy(filtered,input.economy);
      const engine={period:input.period,economy,classification:filtered};
      const report=diagnose(engine,input.payroll,input.mappings);
      return {...report,period:input.period,periodPolicy:input.periodPolicy,engine:{classification:filtered,economy},
        issues:[...(report.issues||[]),...economy.issues],warnings:classification.warnings};
    } catch(e) { return {complete:false,valid:false,status:'insufficientData',issues:[{code:e.message}],grossDeltaCents:null,netCents:null,realPayrollValidated:false}; }
  };
}
module.exports={createDiagnostic};
