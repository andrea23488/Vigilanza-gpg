'use strict';
// Solo dati forniti dal chiamante: nessun I/O, nessuna tariffa o regola implicita.
const check = (ok, code) => { if (!ok) throw Error(code); };
function shape(o, allowed, required = allowed) {
  check(o && typeof o === 'object' && !Array.isArray(o), 'OBJECT_REQUIRED');
  check(Object.keys(o).every(k => allowed.includes(k)), 'UNKNOWN_FIELD');
  check(required.every(k => Object.hasOwn(o, k)), 'MISSING_FIELD');
}
function token(s) { check(typeof s === 'string' && /^(?:[A-Z][A-Z0-9_]{0,39})$/.test(s), 'ANONYMOUS_CODE_REQUIRED'); }
function period(s) { check(typeof s === 'string' && /^(19|20|21)\d\d-(0[1-9]|1[0-2])$/.test(s), 'INVALID_PERIOD'); }
function cents(s) { check(typeof s === 'string' && /^-?(0|[1-9]\d{0,29})$/.test(s), 'CENTS_STRING_REQUIRED'); return BigInt(s); }
function decimal(s) {
  check(typeof s === 'string' && /^(0|[1-9]\d{0,11})(\.\d{1,6})?$/.test(s), 'DECIMAL_REQUIRED');
  const [a,b=''] = s.split('.'); return BigInt(a)*1000000n + BigInt(b.padEnd(6,'0'));
}
function quantity(q, unit) {
  if (unit === 'amountOnly') { check(q === null, 'AMOUNT_ONLY_QUANTITY'); return null; }
  const n = decimal(q);
  if (unit === 'decimalHours' || unit === 'minutes') {
    const ms = n * (unit === 'decimalHours' ? 3600000n : 60000n);
    check(ms % 1000000n === 0n, 'SUBMILLISECOND_QUANTITY');
    return {dimension:'time', value:ms/1000000n};
  }
  check(['day','shift','month','item'].includes(unit), 'INVALID_UNIT');
  return {dimension:unit, value:n};
}
function fraction(n,d) { return {numerator:n.toString(), denominator:d.toString()}; }
function timeDelta(ms) { return {milliseconds:ms.toString(), minutes:fraction(ms,60000n), hours:fraction(ms,3600000n)}; }
function lineQuantity(l) {
  if (l.quantityMs !== undefined) return {dimension:'time',value:BigInt(l.quantityMs)};
  if (l.kind === 'monthlyBase') return quantity(l.quantity,'month');
  return quantity(l.quantity,l.unit);
}
function reconcile(engine, payroll, mappings) {
  shape(payroll,['period','rows','grossCents','completeGrossInventory','observations'],['period','rows','grossCents','completeGrossInventory']); period(payroll.period);
  check(typeof payroll.completeGrossInventory === 'boolean' && Array.isArray(payroll.rows), 'INVALID_PAYROLL');
  if (payroll.grossCents !== null) cents(payroll.grossCents);
  const rows = new Map();
  for (const r of payroll.rows) {
    shape(r,['code','competence','basis','unit','quantity','amountCents']); token(r.code); period(r.competence);
    check(!rows.has(r.code), 'DUPLICATE_ROW');
    check(['worked','paid','liquidated','accessory'].includes(r.basis), 'INVALID_BASIS');
    quantity(r.quantity,r.unit); if(r.amountCents !== null) cents(r.amountCents);
    rows.set(r.code,r);
  }
  check(Array.isArray(mappings), 'MAPPINGS_REQUIRED');
  const usedRows=new Set(), usedLines=new Set(), results=[];
  const lines=new Map((engine.economy?.complete ? engine.economy.lines : []).map(l=>[l.id,l]));
  for (const m of mappings) {
    shape(m,['rowCode','engineIds','basis','evidence','explanation'],['rowCode','engineIds','basis','evidence']);
    token(m.rowCode); token(m.evidence);
    check(rows.has(m.rowCode) && !usedRows.has(m.rowCode), 'MISSING_OR_REUSED_ROW'); usedRows.add(m.rowCode);
    check(Array.isArray(m.engineIds) && m.engineIds.length>0 && m.engineIds.every(id=>typeof id==='string' && lines.has(id)), 'MISSING_ENGINE_LINE');
    check(m.engineIds.every(id=>!usedLines.has(id)) && new Set(m.engineIds).size===m.engineIds.length, 'REUSED_ENGINE_LINE');
    m.engineIds.forEach(id=>usedLines.add(id));
    check(['paid','accessory'].includes(m.basis), 'MAPPING_BASIS_REQUIRED');
    const r=rows.get(m.rowCode), selected=m.engineIds.map(id=>lines.get(id));
    const qs=selected.map(lineQuantity), rq=quantity(r.quantity,r.unit);
    const kindOK=selected.every(l=>m.basis==='accessory' ? ['allowance','monthlyBase'].includes(l.kind) : ['full','covered','premium'].includes(l.kind));
    // Premi e basi possono condividere gli stessi minuti: mai sommarli come ore.
    const quantityOK=qs.every(q=>q.dimension===qs[0].dimension) && !(selected.length>1 && selected.some(l=>l.kind==='premium'));
    const comparable=r.competence===engine.period && payroll.period===engine.period && kindOK &&
      ((r.basis==='liquidated' && m.basis==='paid') || r.basis===m.basis);
    const amountDelta=comparable && r.amountCents!==null ? selected.reduce((n,l)=>n+BigInt(l.amountCents),0n)-cents(r.amountCents) : null;
    const qDelta=comparable && quantityOK && rq && rq.dimension===qs[0].dimension ? qs.reduce((n,q)=>n+q.value,0n)-rq.value : null;
    const result={rowCode:r.code,engineIds:[...m.engineIds],evidence:m.evidence,status:'insufficientData',reasons:[],amountDeltaCents:amountDelta?.toString()??null,amountDeltaEuro:amountDelta===null?null:fraction(amountDelta,100n),
      quantityDelta:qDelta===null?null:{dimension:rq.dimension,...(rq.dimension==='time'?timeDelta(qDelta):{millionths:qDelta.toString()})}};
    if(!comparable) result.reasons.push('PERIOD_OR_BASIS_NOT_COMPARABLE');
    if(amountDelta===null) result.reasons.push('AMOUNT_UNAVAILABLE');
    if(qDelta===null && r.unit!=='amountOnly') result.reasons.push('QUANTITY_NOT_COMPARABLE');
    const quantitiesKnown=r.unit==='amountOnly'||qDelta!==null;
    if(comparable && amountDelta!==null && quantitiesKnown) {
      if(amountDelta===0n && (qDelta===null||qDelta===0n)) result.status='match';
      else result.reasons.push('DISCREPANCY_REQUIRES_REVIEW');
    }
    if(m.explanation!==undefined) {
      const e=m.explanation;
      shape(e,['kind','reference','expectedAmountDeltaCents','expectedQuantityDelta']);
      check(['rounding','settlementTiming','documentedRule'].includes(e.kind),'INVALID_EXPLANATION'); token(e.reference);
      const expected=cents(e.expectedAmountDeltaCents);
      if(e.expectedQuantityDelta!==null) cents(e.expectedQuantityDelta);
      if(result.status==='insufficientData' && comparable && quantitiesKnown && amountDelta===expected &&
        (qDelta===null?e.expectedQuantityDelta===null:e.expectedQuantityDelta!==null&&qDelta===BigInt(e.expectedQuantityDelta))) {
        result.status='explainedDifference'; result.reasons=['DOCUMENTED_EXPECTED_DELTA']; result.explanation={...e};
      }
    }
    results.push(result);
  }
  const observations=[];
  check(payroll.observations===undefined || Array.isArray(payroll.observations),'INVALID_OBSERVATIONS');
  const metrics={worked:'workedMs',paid:'classifiableMs',ordinaryPaid:'ordinaryMs',overtimePaid:'overtimeMs',nightWorked:'nightMs',sundayWorked:'sundayMs',holidayWorked:'holidayMs'};
  const seenMetrics=new Set();
  for(const o of payroll.observations||[]) {
    shape(o,['metric','competence','quantity','unit','evidence']); period(o.competence); token(o.evidence);
    check(Object.hasOwn(metrics,o.metric) && !seenMetrics.has(o.metric),'INVALID_OR_DUPLICATE_METRIC'); seenMetrics.add(o.metric);
    check(['minutes','decimalHours'].includes(o.unit),'TIME_UNIT_REQUIRED'); const q=quantity(o.quantity,o.unit);
    const ms=engine.classification?.totals?.[metrics[o.metric]];
    const available=o.competence===engine.period && Number.isSafeInteger(ms);
    const d=available?BigInt(ms)-q.value:null;
    observations.push({metric:o.metric,evidence:o.evidence,status:d===0n?'match':'insufficientData',delta:d===null?null:timeDelta(d),reason:available?'CIVIL_TIME_COMPARISON_ONLY':'PERIOD_OR_QUANTITY_UNAVAILABLE'});
  }
  const unmappedRows=[...rows.keys()].filter(id=>!usedRows.has(id));
  const unmappedEngineIds=[...lines.keys()].filter(id=>!usedLines.has(id));
  const arithmetic=[];
  // Una contraddizione interna del cedolino non dimostra un bug nel motore.
  if(payroll.completeGrossInventory && payroll.grossCents!==null && payroll.rows.every(r=>r.amountCents!==null)) {
    const sum=payroll.rows.reduce((n,r)=>n+cents(r.amountCents),0n), delta=sum-cents(payroll.grossCents);
    arithmetic.push({status:delta===0n?'match':'demonstratedError',scope:'declaredPayrollGrossArithmetic',deltaCents:delta.toString()});
  }
  const fullyComparable=engine.economy?.complete===true && payroll.period===engine.period && payroll.completeGrossInventory &&
    observations.every(o=>o.status==='match') && payroll.grossCents!==null && unmappedRows.length===0 && unmappedEngineIds.length===0 && results.every(r=>r.status!=='insufficientData');
  return {version:1,valid:true,realPayrollValidated:false,netCents:null,netReason:'NO_VERIFIED_FISCAL_MODEL',direction:'engine-minus-payroll',
    rows:results,observations,arithmetic,unmappedRows,unmappedEngineIds,
    grossDeltaCents:fullyComparable?(BigInt(engine.economy.totals.amountCents)-cents(payroll.grossCents)).toString():null,
    complete:fullyComparable && arithmetic.every(a=>a.status==='match'),
    status:arithmetic.some(a=>a.status==='demonstratedError')?'demonstratedError':!fullyComparable?'insufficientData':results.some(r=>r.status==='explainedDifference')?'explainedDifference':'match'};
}
function diagnose(engine,payroll,mappings) {
  try { return reconcile(engine,payroll,mappings); }
  catch(e) { return {version:1,valid:false,complete:false,status:'insufficientData',issues:[{code:e.message}],rows:[],grossDeltaCents:null,netCents:null,realPayrollValidated:false}; }
}
module.exports={diagnose};
