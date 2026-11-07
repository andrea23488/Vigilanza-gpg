'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {classifyHours}=require('./classificaOre.cjs');
const M=60000;
const cfg={mode:'giornaliero',thresholdMinutes:420,night:['22:00','06:00'],holidays:['2026-08-15'],timeBasis:'civil',thresholdBasis:'shiftDate'};
const shift=(extra={})=>({id:'a',date:'2026-08-03',start:'06:00',end:'14:00',...extra});
function run(shifts,c={}){const snapshot=JSON.stringify(shifts);const r=classifyHours(shifts,{...cfg,...c});assert.equal(JSON.stringify(shifts),snapshot);if(r.complete){assert.equal(r.totals.ordinaryMs+r.totals.overtimeMs,r.totals.classifiableMs);for(const s of r.segments){assert.equal(s.ordinaryMs+s.overtimeMs,s.classifiableMs);for(const k of ['nightMs','sundayMs','holidayMs','restWorkedMs'])assert.ok(s[k]<=s.workedMs);}}return r;}
test('06–14: 8 fisiche, 7 ordinarie, 1 extra',()=>{const r=run([shift()]);assert.equal(r.totals.workedMs,480*M);assert.equal(r.totals.ordinaryMs,420*M);assert.equal(r.totals.overtimeMs,60*M);});
test('22–06: 8 notturne',()=>assert.equal(run([shift({start:'22:00',end:'06:00'})]).totals.nightMs,480*M));
test('18–06: 12 ore, 8 notte, 5 extra',()=>{const t=run([shift({start:'18:00',end:'06:00'})]).totals;assert.equal(t.workedMs,720*M);assert.equal(t.nightMs,480*M);assert.equal(t.overtimeMs,300*M);});
test('sabato–domenica: solo 6 ore domenicali',()=>assert.equal(run([shift({date:'2026-08-08',start:'22:00',end:'06:00'})]).totals.sundayMs,360*M));
test('festività completa',()=>assert.equal(run([shift({date:'2026-08-15'})]).totals.holidayMs,480*M));
test('ingresso festivo a mezzanotte senza duplicazioni',()=>{const r=run([shift({date:'2026-08-14',start:'22:00',end:'06:00'})]);assert.equal(r.totals.holidayMs,360*M);assert.equal(r.totals.workedMs,480*M);assert.ok(r.segments.some(s=>s.tags.includes('night')&&s.tags.includes('holiday')&&s.overlap));});
test('due turni: una soglia giornaliera',()=>{const r=run([shift({end:'10:00'}),shift({id:'b',start:'12:00',end:'18:00'})]);assert.equal(r.totals.ordinaryMs,420*M);assert.equal(r.totals.overtimeMs,180*M);});
test('override 4h45 preserva automatico e durata',()=>{const r=run([shift({manualOvertimeMinutes:285})]);assert.equal(r.shifts[0].calculatedOvertimeMs,60*M);assert.equal(r.totals.overtimeMs,285*M);assert.equal(r.totals.workedMs,480*M);});
test('override zero distinto da assente',()=>assert.equal(run([shift({manualOvertimeMinutes:0})]).totals.overtimeMs,0));
test('settimanale su più giorni',()=>{const s=Array.from({length:6},(_,i)=>shift({id:String(i),date:`2026-08-${String(3+i).padStart(2,'0')}`}));assert.equal(run(s,{mode:'settimanale',thresholdMinutes:2400}).totals.overtimeMs,480*M);assert.equal(run(s).totals.overtimeMs,360*M);});
test('secondi: minuti frazionari precisi',()=>{const t=run([shift({end:'14:00:30.123'})]).totals;assert.equal(t.workedMs,480*M+30123);assert.equal(t.overtimeMs,60*M+30123);});
test('pausa non pagata esplicita',()=>{const t=run([shift({events:[{type:'unpaidBreak',fromMinutes:120,toMinutes:150}]})]).totals;assert.equal(t.workedMs,450*M);assert.equal(t.classifiableMs,450*M);});
test('pausa pagata e trasferimento: retribuite separate dalle fisiche',()=>{const t=run([shift({events:[{type:'paidBreak',fromMinutes:120,toMinutes:150},{type:'paidTransfer',fromMinutes:180,toMinutes:195}]})]).totals;assert.equal(t.workedMs,435*M);assert.equal(t.classifiableMs,480*M);});
test('riposo lavorato come attributo sovrapposto',()=>{const t=run([shift({restWorked:true})]).totals;assert.equal(t.restWorkedMs,t.workedMs);assert.equal(t.workedMs,480*M);});
test('ordine input indipendente',()=>{const a=shift({end:'10:00'}),b=shift({id:'b',start:'12:00',end:'18:00'});assert.deepEqual(run([a,b]),run([b,a]));});
for(const [name,s] of Object.entries({incompleto:{id:'a'},data:shift({date:'2026-02-30'}),orario:shift({start:'25:00'}),ambiguo:shift({end:'06:00'}),manuale:shift({manualOvertimeMinutes:481}),extra:shift({paidExtraMinutes:15}),pause:shift({events:[{type:'unpaidBreak',fromMinutes:4,toMinutes:10},{type:'paidBreak',fromMinutes:9,toMinutes:12}]}),sottoprecisione:shift({manualOvertimeMinutes:1/700000})}))test('rifiuto esplicito: '+name,()=>{const r=run([s]);assert.equal(r.complete,false);assert.equal(r.totals,null);assert.ok(r.issues.length);});
test('servizi sovrapposti non contati due volte',()=>assert.equal(run([shift(),shift({id:'b'})]).complete,false));
test('id duplicati rifiutati',()=>assert.equal(run([shift(),shift()]).complete,false));
test('configurazione incompleta rifiutata',()=>assert.throws(()=>classifyHours([shift()],{mode:'giornaliero'})));
test('nessun import di app, rete, filesystem o tariffa nel modulo',()=>{const src=require('node:fs').readFileSync(require.resolve('./classificaOre.cjs'),'utf8');assert.doesNotMatch(src,/require\(|\bimport\b|fetch\(|supabase|11\.037|1\.3/);});

test('attribuzione civile esplicita: 18–06 diviso in due giorni',()=>assert.equal(run([shift({start:'18:00',end:'06:00'})],{thresholdBasis:'civilDate'}).totals.overtimeMs,0));
