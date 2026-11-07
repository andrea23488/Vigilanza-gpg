'use strict';
// Sperimentale: nessuna tariffa contrattuale predefinita, nessun effetto esterno.
const HOUR = 3600000n, SCALE = 1000000n;
const TAGS = ['night', 'sunday', 'holiday', 'restWorked'];
const FIELDS = ['durationMs','workedMs','classifiableMs','ordinaryMs','overtimeMs','nightMs','sundayMs','holidayMs','restWorkedMs'];
function requireValue(ok, message) { if (!ok) throw Error(message); }
function decimal(value) {
  requireValue(typeof value === 'string' && /^(0|[1-9]\d{0,11})(\.\d{1,6})?$/.test(value), 'DECIMAL_STRING_REQUIRED');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, '0'));
}
function integer(value) { requireValue(Number.isSafeInteger(value) && value >= 0, 'INVALID_DURATION'); return BigInt(value); }
function cents(n, d) { return ((n * 100n + d / 2n) / d).toString(); }
function civil(value) {
  requireValue(typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}$/.test(value), 'INVALID_CIVIL_TIME');
  const t = Date.parse(value + 'Z');
  requireValue(Number.isFinite(t) && new Date(t).toISOString() === value + 'Z', 'INVALID_CIVIL_TIME');
  return t;
}
function matches(rule, seg, bucket) {
  return (rule.bucket === 'all' || rule.bucket === bucket) && Object.entries(rule.when).every(([k,v]) =>
    k === 'event' ? seg.event === v : seg.tags.includes(k) === v);
}
function calculateEconomy(classification, config) {
  try { return calculate(classification, config); }
  catch (e) { return { version: 1, complete: false, issues: [{code:e.message}], lines:[], decisions:[], totals:null }; }
}
function calculate(c, cfg) {
  requireValue(c?.version === 1 && c.complete === true && Array.isArray(c.segments) && c.totals, 'INCOMPLETE_CLASSIFICATION');
  requireValue(cfg && typeof cfg.id === 'string' && cfg.id && cfg.currency === 'EUR' && cfg.rounding === 'halfUpPerRule', 'INVALID_CONFIG');
  requireValue(['hourly','monthly'].includes(cfg.payMode), 'PAY_MODE_REQUIRED');
  requireValue(Array.isArray(cfg.baseRules) && Array.isArray(cfg.premiumRules) && Array.isArray(cfg.allowances), 'RULE_ARRAYS_REQUIRED');
  requireValue(cfg.tagPolicy && TAGS.every(t=>['none','rules'].includes(cfg.tagPolicy[t])), 'TAG_POLICY_REQUIRED');
  const monthly = cfg.payMode === 'monthly' ? decimal(cfg.monthlyBaseEuro) : 0n;
  requireValue(cfg.payMode !== 'hourly' || cfg.monthlyBaseEuro == null, 'MONTHLY_BASE_WITH_HOURLY');
  const ids = new Set(), rules = [...cfg.baseRules,...cfg.premiumRules];
  for (const rule of rules) {
    requireValue(rule && typeof rule.id === 'string' && rule.id && rule.id !== '$monthlyBase' && !ids.has(rule.id), 'DUPLICATE_OR_INVALID_RULE'); ids.add(rule.id);
    requireValue(['ordinary','overtime','all'].includes(rule.bucket) && rule.when && typeof rule.when === 'object' && !Array.isArray(rule.when), 'INVALID_SELECTOR');
    for(const [k,v] of Object.entries(rule.when)) requireValue(TAGS.includes(k) ? typeof v === 'boolean' : k === 'event' && ['work','paidBreak','paidTransfer','unpaidBreak'].includes(v), 'INVALID_SELECTOR');
    requireValue(['worked','paid'].includes(rule.scope), 'SCOPE_REQUIRED');
    if(cfg.baseRules.includes(rule)) {
      requireValue(rule.scope === 'paid' && ['full','covered'].includes(rule.kind), 'INVALID_BASE_RULE');
      requireValue(rule.kind !== 'covered' || cfg.payMode === 'monthly' && rule.bucket === 'ordinary', 'INVALID_MONTHLY_COVERAGE');
      requireValue(!(cfg.payMode === 'monthly' && rule.kind === 'full' && rule.bucket !== 'overtime'), 'DOUBLE_MONTHLY_BASE');
    } else requireValue(rule.kind === 'premium' && typeof rule.group === 'string' && rule.group, 'INVALID_PREMIUM');
    if(rule.kind !== 'covered') { decimal(rule.hourlyEuro); decimal(rule.factor); }
  }
  requireValue(cfg.premiumGroups && typeof cfg.premiumGroups === 'object', 'PREMIUM_GROUPS_REQUIRED');
  for(const rule of cfg.premiumRules) requireValue(['sum','exclusive'].includes(cfg.premiumGroups[rule.group]), 'GROUP_POLICY_REQUIRED');
  const totals = Object.fromEntries(FIELDS.map(k=>[k,0n])), intervals=[];
  for (const s of c.segments) {
    requireValue(s && typeof s.shiftId === 'string' && s.shiftId && Array.isArray(s.tags) && new Set(s.tags).size === s.tags.length && s.tags.every(t=>TAGS.includes(t)), 'INVALID_SEGMENT');
    const start=civil(s.startCivil), end=civil(s.endCivil);
    requireValue(end>start && end-start===s.durationMs && s.date===s.startCivil.slice(0,10), 'INVALID_INTERVAL');
    requireValue(['work','paidBreak','paidTransfer','unpaidBreak'].includes(s.event) && ['manual','calculated'].includes(s.source), 'INVALID_SEGMENT_SOURCE');
    for(const k of FIELDS) totals[k]+=integer(s[k]);
    requireValue(s.workedMs === (s.event === 'work' ? s.durationMs : 0) && s.classifiableMs === (s.event === 'unpaidBreak' ? 0 : s.durationMs), 'INCONSISTENT_EVENT');
    requireValue(s.ordinaryMs+s.overtimeMs===s.classifiableMs, 'INCONSISTENT_CLASSIFICATION');
    for(const [i,t] of TAGS.entries()) requireValue(s[FIELDS[5+i]] === (s.tags.includes(t) ? s.workedMs : 0), 'INCONSISTENT_TAG_QUANTITY');
    intervals.push({start,end});
  }
  intervals.sort((a,b)=>a.start-b.start);
  requireValue(!intervals.some((v,i)=>i && v.start<intervals[i-1].end), 'OVERLAPPING_SEGMENTS');
  for(const k of FIELDS) requireValue(integer(c.totals[k])===totals[k], 'TOTALS_MISMATCH');
  const quantities=new Map(), decisions=[];
  const add=(rule,ms)=>quantities.set(rule.id,(quantities.get(rule.id)||0n)+integer(ms));
  for(const s of c.segments) for(const bucket of ['ordinary','overtime']) {
    const ms=s[bucket+'Ms']; if(!ms)continue;
    const bases=cfg.baseRules.filter(r=>matches(r,s,bucket));
    requireValue(bases.length===1,'MISSING_OR_AMBIGUOUS_BASE');
    const base=bases[0]; add(base,ms);
    const candidates=cfg.premiumRules.filter(r=>matches(r,s,bucket) && (r.scope==='paid'||s.event==='work'));
    // Anche lo zero premio per una caratteristica attiva deve essere una scelta esplicita.
    for(const tag of s.tags) if(cfg.tagPolicy[tag]==='rules') requireValue([base,...candidates].some(r=>r.when[tag]===true),'UNRESOLVED_TAG_'+tag);
    const grouped=new Map();for(const r of candidates){if(!grouped.has(r.group))grouped.set(r.group,[]);grouped.get(r.group).push(r);}
    const selected=[];
    for(const [group,list] of grouped) {
      requireValue(cfg.premiumGroups[group]!=='exclusive'||list.length===1,'AMBIGUOUS_EXCLUSIVE_GROUP');
      selected.push(...list);
    }
    for(const rule of selected)add(rule,ms);
    decisions.push({shiftId:s.shiftId,date:s.date,startCivil:s.startCivil,endCivil:s.endCivil,bucket,quantityMs:ms,source:s.source,baseRule:base.id,premiumRules:selected.map(r=>r.id).sort()});
  }
  const lines=[];
  if(cfg.payMode==='monthly')lines.push({id:'$monthlyBase',kind:'monthlyBase',quantity:'1',amountCents:cents(monthly,SCALE)});
  for(const r of [...rules].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)) {
    const ms=quantities.get(r.id);if(ms===undefined)continue;
    const n=r.kind==='covered'?0n:ms*decimal(r.hourlyEuro)*decimal(r.factor);
    lines.push({id:r.id,kind:r.kind,quantityMs:ms.toString(),hourlyEuro:r.hourlyEuro??null,factor:r.factor??null,exactEuroNumerator:n.toString(),exactEuroDenominator:(HOUR*SCALE*SCALE).toString(),amountCents:cents(n,HOUR*SCALE*SCALE)});
  }
  for(const a of cfg.allowances) {
    requireValue(a && typeof a.id==='string' && a.id && !ids.has(a.id) && a.id!=='$monthlyBase', 'DUPLICATE_ALLOWANCE');ids.add(a.id);
    requireValue(['day','shift','month','item'].includes(a.unit) && typeof a.description==='string' && a.description, 'INVALID_ALLOWANCE');
    const q=decimal(a.quantity),rate=decimal(a.unitEuro);
    lines.push({id:a.id,kind:'allowance',description:a.description,unit:a.unit,quantity:a.quantity,unitEuro:a.unitEuro,amountCents:cents(q*rate,SCALE*SCALE)});
  }
  const total=lines.reduce((n,l)=>n+BigInt(l.amountCents),0n);
  return {version:1,complete:true,configId:cfg.id,currency:'EUR',issues:[],warnings:[...(c.warnings||[]),'Importi lordi sperimentali: nessun calcolo fiscale.'],quantities:Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,v.toString()])),lines,decisions,totals:{amountCents:total.toString(),baseCents:lines.filter(l=>['full','covered','monthlyBase'].includes(l.kind)).reduce((n,l)=>n+BigInt(l.amountCents),0n).toString(),premiumCents:lines.filter(l=>l.kind==='premium').reduce((n,l)=>n+BigInt(l.amountCents),0n).toString(),allowanceCents:lines.filter(l=>l.kind==='allowance').reduce((n,l)=>n+BigInt(l.amountCents),0n).toString()}};
}
module.exports={calculateEconomy};
