'use strict';
const FIELDS=['durationMs','workedMs','classifiableMs','ordinaryMs','overtimeMs','nightMs','sundayMs','holidayMs','restWorkedMs'];
const issue=code=>({code});
const failed=code=>({complete:false,issues:[issue(code)],hours:null,grossCents:null,net:null});
function payrollTemplate(period){return {period:{...period},workedHours:null,paidHours:null,overtimePaid:[],premiums:[],allowances:[],arrears:[],deductions:[],netCents:null,comparabilityConfirmed:false};}
function validatePayroll(p,period){
 if(!p)return {status:'notProvided',data:null,issues:[]};
 if(p.comparabilityConfirmed!==undefined&&typeof p.comparabilityConfirmed!=='boolean')return {status:'invalid',data:null,issues:[issue('PAYROLL_COMPARABILITY_BOOLEAN_REQUIRED')]};
 const expected=Object.keys(payrollTemplate(period));
 if(!p||Object.keys(p).some(k=>!expected.includes(k)))return {status:'invalid',data:null,issues:[issue('PAYROLL_UNKNOWN_FIELDS')]};
 if(!p.period||p.period.year!==period.year||p.period.month!==period.month||Object.keys(p.period).some(k=>!['year','month'].includes(k)))return {status:'invalid',data:null,issues:[issue('PAYROLL_PERIOD_MISMATCH')]};
 const dec=v=>typeof v==='string'&&/^\d+(\.\d+)?$/.test(v),cent=v=>typeof v==='string'&&/^\d+$/.test(v);
 for(const k of ['workedHours','paidHours'])if(p[k]!=null&&!dec(p[k]))return {status:'invalid',data:null,issues:[issue('PAYROLL_EXPLICIT_UNITS_REQUIRED')]};
 if(p.netCents!=null&&!cent(p.netCents))return {status:'invalid',data:null,issues:[issue('PAYROLL_CENTS_REQUIRED')]};
 for(const k of ['overtimePaid','premiums','allowances','arrears','deductions']){
  if(!Array.isArray(p[k]))return {status:'invalid',data:null,issues:[issue('PAYROLL_CATEGORIES_REQUIRED')]};
  for(const r of p[k]){
   if(!r||Object.keys(r).some(k=>!['code','quantity','unit','amountCents','competence'].includes(k))||typeof r.code!=='string'||!r.code||!['decimalHours','minutes','days','shifts','items','amountOnly'].includes(r.unit)||!cent(r.amountCents)||(r.unit==='amountOnly'?r.quantity!==null:!dec(r.quantity))||typeof r.competence!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.competence))return {status:'invalid',data:null,issues:[issue('PAYROLL_ROW_INVALID')]};
  }
 }
 return {status:'awaitingRowMapping',data:JSON.parse(JSON.stringify(p)),issues:[issue('PAID_QUANTITIES_NOT_AUTOMATICALLY_PHYSICAL_HOURS')]};
}
function createComparator({classifyHours,calculateEconomy,runLegacy}){
 if(typeof classifyHours!=='function'||typeof calculateEconomy!=='function')throw Error('BLOCKS_REQUIRED');
 return function compare(input){
  const invalid=code=>({version:1,complete:false,issues:[issue(code)],legacy:failed(code),v2:failed(code),differences:{},payroll:null});
  if(!input||!Array.isArray(input.shifts)||!input.period||!Number.isInteger(input.period.year)||input.period.year<1900||input.period.year>9999||!Number.isInteger(input.period.month)||input.period.month<1||input.period.month>12)return invalid('INVALID_PERIOD_OR_SHIFTS');
  const {period,hours}=input;
  if(!hours||!['giornaliero','settimanale'].includes(hours.mode)||![hours.dailyMinutes,hours.weeklyMinutes].every(n=>Number.isFinite(n)&&n>0))return invalid('EXPLICIT_THRESHOLDS_REQUIRED');
  if(hours.mode==='settimanale'&&input.weekContextComplete!==true)return invalid('WEEK_CONTEXT_NOT_CONFIRMED');
  let c;
  try{c=classifyHours(input.shifts,{...hours,thresholdMinutes:hours.mode==='giornaliero'?hours.dailyMinutes:hours.weeklyMinutes});}catch(e){return invalid('CLASSIFIER_CONFIG:'+e.message);}
  if(!c.complete)return {...invalid('INVALID_CLASSIFICATION'),issues:c.issues};
  const month=`${period.year}-${String(period.month).padStart(2,'0')}`;
  const selected=new Set(input.shifts.filter(s=>s.date.startsWith(month+'-')).map(s=>s.id));
  // Mantiene il contesto di soglia; filtra dopo la classificazione, per data iniziale.
  const segments=c.segments.filter(s=>selected.has(s.shiftId));
  const totals=Object.fromEntries(FIELDS.map(k=>[k,segments.reduce((n,s)=>n+s[k],0)]));
  const filtered={...c,segments,shifts:c.shifts.filter(s=>selected.has(s.shiftId)),totals};
  const econ=calculateEconomy(filtered,input.economy);
  const newHours={physical:totals.workedMs/3600000,paid:totals.classifiableMs/3600000,ordinary:totals.ordinaryMs/3600000,overtime:totals.overtimeMs/3600000,night:totals.nightMs/3600000,sunday:totals.sundayMs/3600000,holiday:totals.holidayMs/3600000,rest:totals.restWorkedMs/3600000};
  const v2={complete:econ.complete,issues:econ.issues,hours:newHours,grossCents:econ.complete?econ.totals.amountCents:null,net:null,netReason:'NO_VERIFIED_FISCAL_MODEL',economicBreakdown:econ.complete?econ.totals:null,lines:econ.lines,decisions:econ.decisions,warnings:c.warnings};
  let legacy;
  try{
   const cfg=input.legacy;
   if(input.operator!=='gpg')throw Error('LEGACY_OPERATOR_NOT_SUPPORTED');
   if(!cfg||!['1','2','3','4','5','6'].includes(cfg.level)||!['automatico','personalizzato'].includes(cfg.profile))throw Error('LEGACY_PROFILE_REQUIRED');
   for(const k of ['indennita20724','festivitaNonGoduta','antirapina'])if(typeof cfg.monthly?.[k]!=='number'||!Number.isFinite(cfg.monthly[k])||cfg.monthly[k]<0)throw Error('LEGACY_MONTHLY_VALUES_REQUIRED');
   if(cfg.profile==='personalizzato')for(const k of ['overtime','sunday','day','compensatory','night','rest'])if(typeof cfg.tariffs?.[k]!=='number'||!Number.isFinite(cfg.tariffs[k])||cfg.tariffs[k]<0)throw Error('LEGACY_TARIFFS_REQUIRED');
   if(input.shifts.some(s=>s.events?.length||s.paidExtraMinutes))throw Error('LEGACY_EVENT_MAPPING_NOT_EQUIVALENT');
   if(input.shifts.some(s=>!/^\d\d:\d\d$/.test(s.start)||!/^\d\d:\d\d$/.test(s.end)))throw Error('LEGACY_SUBMINUTE_MAPPING_NOT_EQUIVALENT');
   if(typeof runLegacy!=='function')throw Error('LEGACY_RUNNER_REQUIRED');
   const records=input.shifts.map(s=>{
    const [year,month,day]=s.date.split('-').map(Number),[h,m]=s.start.split(':').map(Number),[eh,em]=s.end.split(':').map(Number);
    let duration=eh*60+em-h*60-m;if(duration<0)duration+=1440;
    return {id:s.id,tipo:'turno',anno:year,mese:month,giorno:day,inizio:s.start,fine:s.end,ore:duration/60,riposo_lavorato:s.restWorked===true,straordinario_manuale_minuti:s.manualOvertimeMinutes??null,minuti_aggiuntivi_retribuiti:0};
   });
   const result=runLegacy(records,hours,{...cfg,tariffs:cfg.tariffs||{}},period);
   legacy={complete:true,issues:[],...result,net:{monthlyEuro:result.netMonthlyEuro,projectionEuro:result.netProjectionEuro},basis:'totaleCompetenzeStimate mensile; non maturatoAdOggi'};
  }catch(e){legacy=failed(e.message);}
  const differences={direction:'v2-minus-legacy',hours:{},grossCents:null,net:null,reasons:[],insufficient:[]};
  if(legacy.complete){
   for(const [name,old]of Object.entries({paid:'total',ordinary:'ordinary',overtime:'overtime',night:'night',sunday:'sunday',holiday:'holiday',rest:'rest'}))differences.hours[name]=Number((newHours[name]-legacy.hours[old]).toFixed(10));
   differences.insufficient.push('LEGACY_TOTAL_LABEL_IS_PAID_NOT_INDEPENDENT_PHYSICAL_MEASUREMENT');
   if(econ.complete)differences.grossCents=(BigInt(v2.grossCents)-BigInt(legacy.grossCents)).toString();
   if(differences.hours.night)differences.reasons.push('NIGHT_RULES_DIFFER: legacy 21-05; v2 explicit configured band');
   if(differences.hours.holiday)differences.reasons.push('HOLIDAY_RULES_DIFFER: legacy entire shift by initial date; v2 segment tags and explicit calendar');
   if(differences.hours.overtime&&input.shifts.some(s=>s.restWorked))differences.reasons.push('REST_POLICY_DIFFER: legacy excludes rest work from ordinary overtime; block1 includes it in potential overtime');
   if(differences.hours.overtime&&hours.thresholdBasis==='civilDate')differences.reasons.push('THRESHOLD_ATTRIBUTION_DIFFER: legacy shift date; v2 civil date');
   if(differences.grossCents!==null&&differences.grossCents!=='0')differences.reasons.push('ECONOMIC_RULES_AND_ROUNDING_DIFFER: inspect legacy lines and v2 rule decisions; not proof of error');
  }else differences.insufficient.push(...legacy.issues.map(i=>i.code));
  if(!econ.complete)differences.insufficient.push(...econ.issues.map(i=>i.code));
  differences.insufficient.push('V2_NET_NOT_CALCULATED');
  return {version:1,complete:legacy.complete&&econ.complete,period:{...period},periodPolicy:'shiftStartDateAfterContextClassification',issues:[],legacy,v2,differences,payroll:validatePayroll(input.payroll,period)};
 };
}
module.exports={createComparator,payrollTemplate,validatePayroll};
