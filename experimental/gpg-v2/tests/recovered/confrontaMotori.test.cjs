'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const root=__dirname;
const {classifyHours}=require('../../core/classificaOre.cjs');
const {calculateEconomy}=require('../../core/calcolaEconomia.cjs');
const {runLegacy}=require('./legacyDiagnostico.cjs');
const {createComparator,payrollTemplate}=require('./confrontaMotori.cjs');
const compare=createComparator({classifyHours,calculateEconomy,runLegacy:(records,hours,cfg,period)=>runLegacy(root,records,hours,cfg,period)});
const shift=(x={})=>({id:'anon-1',date:'2026-08-03',start:'06:00',end:'14:00',...x});
function input(shifts=[shift()]){return {operator:'gpg',period:{year:2026,month:8},shifts,weekContextComplete:true,hours:{mode:'giornaliero',dailyMinutes:420,weeklyMinutes:2400,thresholdBasis:'shiftDate',timeBasis:'civil',night:['21:00','05:00'],holidays:['2026-08-15']},legacy:{level:'4',profile:'personalizzato',tariffs:{overtime:15,sunday:0,day:0,compensatory:0,night:0,rest:0},monthly:{indennita20724:0,festivitaNonGoduta:0,antirapina:0}},economy:{id:'synthetic-equivalence',currency:'EUR',rounding:'halfUpPerRule',payMode:'monthly',monthlyBaseEuro:'1468.88',tagPolicy:{night:'none',sunday:'none',holiday:'none',restWorked:'none'},baseRules:[{id:'covered',bucket:'ordinary',when:{},scope:'paid',kind:'covered'},{id:'extra',bucket:'overtime',when:{},scope:'paid',kind:'full',hourlyEuro:'15',factor:'1'}],premiumRules:[],premiumGroups:{},allowances:[]}};}
function run(x){const snapshot=JSON.stringify(x);const r=compare(x);assert.equal(JSON.stringify(x),snapshot);return r;}
function good(x){const r=run(x);assert.equal(r.complete,true,JSON.stringify(r));assert.equal(r.v2.net,null);return r;}
const scenarios={
 ordinaryWeek:()=>input(Array.from({length:5},(_,i)=>shift({id:String(i),date:`2026-08-0${3+i}`,end:'13:00'}))),
 dailyExtra:()=>input(),
 weeklyExtra:()=>{const x=input(Array.from({length:6},(_,i)=>shift({id:String(i),date:`2026-08-0${3+i}`})));x.hours.mode='settimanale';return x;},
 night:()=>input([shift({start:'22:00',end:'06:00'})]),
 sunday:()=>input([shift({date:'2026-08-09'})]),
 holiday:()=>input([shift({date:'2026-08-15'})]),
 splitDay:()=>input([shift({end:'10:00'}),shift({id:'b',start:'12:00',end:'18:00'})]),
 midnight:()=>input([shift({date:'2026-08-08',start:'22:00',end:'06:00'})]),
 manual:()=>input([shift({manualOvertimeMinutes:285})]),
 restWorked:()=>input([shift({restWorked:true})]),
 allowance:()=>{const x=input();x.legacy.monthly.antirapina=6;x.economy.allowances=[{id:'synthetic',description:'Synthetic only',quantity:'3',unit:'item',unitEuro:'2'}];return x;},
 incomplete:()=>{const x=input();delete x.economy.baseRules[1].hourlyEuro;return x;}
};
for(const [name,make]of Object.entries(scenarios))test('scenario '+name,()=>{const r=run(make());assert.equal(r.legacy.complete,true,JSON.stringify(r.legacy));if(name==='incomplete'){assert.equal(r.v2.complete,false);assert.equal(r.differences.grossCents,null);}else {assert.equal(r.complete,true,JSON.stringify(r));if(name==='restWorked'){assert.equal(r.differences.hours.overtime,1);assert.equal(r.differences.grossCents,'1500');}else assert.equal(r.differences.grossCents,'0');}});
test('giornaliero quantità esatte',()=>{const r=good(input());assert.equal(r.legacy.hours.total,8);assert.equal(r.legacy.hours.ordinary,7);assert.equal(r.legacy.hours.overtime,1);assert.equal(r.v2.hours.physical,8);assert.equal(r.differences.hours.overtime,0);});
test('settimanale 48 ore: 8 extra',()=>assert.equal(good(scenarios.weeklyExtra()).legacy.hours.overtime,8));
test('manuale 285 minuti',()=>assert.equal(good(scenarios.manual()).v2.hours.overtime,4.75));
test('manuale zero preservato',()=>assert.equal(good(input([shift({manualOvertimeMinutes:0})])).legacy.hours.overtime,0));
test('festivo oltre mezzanotte identifica 6 ore',()=>{const r=good(input([shift({date:'2026-08-14',start:'22:00',end:'06:00'})]));assert.equal(r.legacy.hours.holiday,0);assert.equal(r.v2.hours.holiday,6);assert.ok(r.differences.reasons.some(x=>x.startsWith('HOLIDAY_RULES')));});
test('fascia notturna diversa dimostrabile',()=>{const x=input([shift({start:'21:00',end:'23:00'})]);x.hours.night=['22:00','06:00'];const r=good(x);assert.equal(r.differences.hours.night,-1);assert.ok(r.differences.reasons.some(x=>x.startsWith('NIGHT_RULES')));});
test('attribuzione civile soglia: 18-06',()=>{const x=input([shift({start:'18:00',end:'06:00'})]);x.hours.thresholdBasis='civilDate';const r=good(x);assert.equal(r.legacy.hours.overtime,5);assert.equal(r.v2.hours.overtime,0);assert.equal(r.differences.hours.overtime,-5);});
test('premio configurato produce differenza economica, non ore',()=>{const x=scenarios.night();x.economy.premiumRules=[{id:'n',bucket:'all',when:{night:true},kind:'premium',scope:'worked',group:'n',hourlyEuro:'2',factor:'1'}];x.economy.premiumGroups={n:'sum'};const r=good(x);assert.equal(r.differences.grossCents,'1400');assert.equal(r.differences.hours.paid,0);});
test('pause: vecchio non confrontabile, nuovo disponibile',()=>{const r=run(input([shift({events:[{type:'paidBreak',fromMinutes:60,toMinutes:90}]})]));assert.equal(r.legacy.complete,false);assert.equal(r.v2.complete,true);assert.equal(r.v2.hours.physical,7.5);assert.equal(r.v2.hours.paid,8);assert.equal(r.differences.grossCents,null);});
test('secondi: vecchio non confrontabile',()=>{const r=run(input([shift({end:'14:00:30'})]));assert.equal(r.legacy.complete,false);assert.equal(r.v2.complete,true);});
test('contesto settimanale non confermato',()=>{const x=scenarios.weeklyExtra();delete x.weekContextComplete;assert.equal(run(x).complete,false);});
test('mese invalido',()=>{const x=input();x.period.month=13;assert.equal(run(x).complete,false);});
test('record duplicati',()=>assert.equal(run(input([shift(),shift()])).complete,false));
test('record sovrapposti',()=>assert.equal(run(input([shift(),shift({id:'b'})])).complete,false));
test('profilo legacy mancante',()=>{const x=input();delete x.legacy;const r=run(x);assert.equal(r.legacy.complete,false);assert.equal(r.v2.complete,true);});
test('nessun netto nuovo inventato',()=>{const r=good(input());assert.equal(r.v2.net,null);assert.equal(r.differences.net,null);assert.equal(typeof r.legacy.net.monthlyEuro,'number');});
test('operatori non GPG: non simulare il vecchio fiduciario',()=>{const x=input();x.operator='fiduciario';assert.equal(run(x).legacy.issues[0].code,'LEGACY_OPERATOR_NOT_SUPPORTED');});
test('determinismo e non mutazione',()=>assert.deepEqual(run(input()),run(input())));
test('ordine multiplo stesso giorno',()=>{const x=scenarios.splitDay(),y=scenarios.splitDay();y.shifts.reverse();assert.deepEqual(good(x).differences,good(y).differences);});
test('mensile base non duplicata e centesimi conservati',()=>{const r=good(input());assert.equal(r.v2.grossCents,'148388');assert.equal(r.legacy.grossCents,'148388');assert.equal(r.v2.economicBreakdown.baseCents,'148388');});
test('lordo legacy conserva float e suo arrotondamento',()=>{const x=input();x.legacy.tariffs.overtime=0.005;x.economy.baseRules[1].hourlyEuro='0.005';const r=good(x);assert.equal(r.v2.grossCents,'146889');assert.equal(r.differences.grossCents,'0');});
test('schema cedolino separa liquidato da fisico',()=>{const x=input();x.payroll=payrollTemplate(x.period);x.payroll.overtimePaid=[{code:'SYNTHETIC',quantity:'2.5',unit:'decimalHours',amountCents:'100',competence:'2026-07'}];const r=good(x);assert.equal(r.payroll.status,'awaitingRowMapping');assert.equal(r.legacy.hours.overtime,1);assert.equal(r.payroll.data.overtimePaid[0].quantity,'2.5');});
test('cedolino: campi personali inattesi rifiutati',()=>{const x=input();x.payroll={...payrollTemplate(x.period),name:'synthetic'};assert.equal(good(x).payroll.status,'invalid');});
test('cedolino ore:minuti non confuso con decimale',()=>{const x=input();x.payroll=payrollTemplate(x.period);x.payroll.workedHours='7:30';assert.equal(good(x).payroll.status,'invalid');});
test('cedolino periodo diverso',()=>{const x=input();x.payroll=payrollTemplate({year:2026,month:7});assert.equal(good(x).payroll.status,'invalid');});
test('classificazione parziale non valorizzata',()=>{const x=input([shift({start:'xx'})]);assert.equal(run(x).complete,false);});
test('confine mese: stessa attribuzione data iniziale',()=>{const x=input([shift({date:'2026-08-31',start:'22:00',end:'06:00'}),shift({id:'sept',date:'2026-09-01',start:'12:00',end:'14:00'})]);const r=good(x);assert.equal(r.legacy.hours.total,8);assert.equal(r.v2.hours.paid,8);});
scenarios.festiveBoundary=()=>input([shift({date:'2026-08-14',start:'22:00',end:'06:00'})]);
scenarios.civilAttribution=()=>{const x=input([shift({start:'18:00',end:'06:00'})]);x.hours.thresholdBasis='civilDate';return x;};
scenarios.differentNightBand=()=>{const x=input([shift({start:'21:00',end:'23:00'})]);x.hours.night=['22:00','06:00'];return x;};
scenarios.rounding=()=>{const x=input();x.legacy.tariffs.overtime=0.005;x.legacy.monthly.antirapina=0.005;x.economy.baseRules[1].hourlyEuro='0.005';x.economy.allowances=[{id:'rounding-item',description:'Synthetic rounding',unit:'item',quantity:'1',unitEuro:'0.005'}];return x;};
module.exports={scenarios,input,compare};
if(process.env.SYNTHETIC_REPORT){const fs=require('node:fs');fs.writeFileSync(process.env.SYNTHETIC_REPORT,JSON.stringify(Object.fromEntries(Object.entries(scenarios).map(([k,f])=>[k,compare(f())])),null,2)+'\n');}

test('tariffe personalizzate incomplete non ricevono fallback diagnostici',()=>{const x=input();delete x.legacy.tariffs.night;assert.equal(run(x).legacy.issues[0].code,'LEGACY_TARIFFS_REQUIRED');});
test('profilo automatico usa il codice corrente e conserva provenienza',()=>{const x=input();x.legacy.profile='automatico';x.legacy.tariffs={};const r=good(x);assert.ok(r.legacy.provenance.hashes.salary);assert.equal(r.legacy.lines.straordinario.toFixed(5),'11.03783');});
test('mancanza festività configurate non viene inventata',()=>{const x=input();delete x.hours.holidays;assert.equal(run(x).complete,false);});
test('ripetere il confronto non accumula stato',()=>{const x=input();assert.deepEqual(good(x),good(x));assert.equal(x.shifts.length,1);});

test('arrotondamento per voce contro totale: un centesimo spiegabile',()=>{const r=good(scenarios.rounding());assert.equal(r.v2.grossCents,'146890');assert.equal(r.legacy.grossCents,'146889');assert.equal(r.differences.grossCents,'1');});

test('guardia arresta sorgenti cambiati',()=>{const {fragments,verifyFragments}=require('./legacyDiagnostico.cjs');const f=fragments(root);f.salary+='\n// modifica sintetica';assert.throws(()=>verifyFragments(f,require('./legacy-fragments.json')),/LEGACY_SOURCE_CHANGED:salary/);});
test('confronto puro privo di accessi esterni',()=>{const src=require('node:fs').readFileSync(require.resolve('./confrontaMotori.cjs'),'utf8');assert.doesNotMatch(src,/require\(|fetch\(|supabase|writeFile|process\.env/);});
test('contesto settimana a cavallo mese classificato prima del filtro',()=>{const x=input([shift({id:'july',date:'2026-07-31'}),shift({date:'2026-08-01'})]);x.hours.mode='settimanale';x.hours.weeklyMinutes=600;const r=good(x);assert.equal(r.legacy.hours.overtime,6);assert.equal(r.v2.hours.overtime,6);assert.equal(r.v2.hours.paid,8);});
test('esecuzione legacy assente segnalata, 2.0 disponibile',()=>{const local=createComparator({classifyHours,calculateEconomy});const r=local(input());assert.equal(r.legacy.issues[0].code,'LEGACY_RUNNER_REQUIRED');assert.equal(r.v2.complete,true);});
