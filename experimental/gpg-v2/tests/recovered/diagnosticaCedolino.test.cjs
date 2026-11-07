'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {classifyHours}=require('../../core/classificaOre.cjs');
const {calculateEconomy}=require('../../core/calcolaEconomia.cjs');
const {createDiagnostic}=require('./eseguiDiagnostica.cjs');
const {diagnose}=require('../../diagnosticaCedolino.cjs');
const run=createDiagnostic({classifyHours,calculateEconomy});
function fixture() {
 return {period:'2026-08',periodPolicy:'shiftStartDateAfterContextClassification',contextComplete:true,civilTimeComparable:true,
 shifts:[{id:'S1',date:'2026-08-03',start:'08:00',end:'17:00'}],
 hours:{mode:'giornaliero',thresholdMinutes:480,thresholdBasis:'shiftDate',timeBasis:'civil',night:['22:00','06:00'],holidays:[]},
 economy:{id:'SYNTHETIC',currency:'EUR',rounding:'halfUpPerRule',payMode:'hourly',tagPolicy:{night:'none',sunday:'none',holiday:'none',restWorked:'none'},
 baseRules:[{id:'ORD',bucket:'ordinary',when:{},scope:'paid',kind:'full',hourlyEuro:'10',factor:'1'},{id:'EXT',bucket:'overtime',when:{},scope:'paid',kind:'full',hourlyEuro:'10',factor:'1.3'}],premiumRules:[],premiumGroups:{},allowances:[]},
 payroll:{period:'2026-08',grossCents:'9300',completeGrossInventory:true,rows:[
 {code:'R1',competence:'2026-08',basis:'liquidated',unit:'decimalHours',quantity:'8',amountCents:'8000'},
 {code:'R2',competence:'2026-08',basis:'liquidated',unit:'minutes',quantity:'60',amountCents:'1300'}]},
 mappings:[{rowCode:'R1',engineIds:['ORD'],basis:'paid',evidence:'DOC1'},{rowCode:'R2',engineIds:['EXT'],basis:'paid',evidence:'DOC2'}]};
}
function autoFixture(change) {
 const f=fixture(); change(f);
 const c=classifyHours(f.shifts,f.hours),e=calculateEconomy(c,f.economy);
 assert.equal(e.complete,true);
 f.payroll.rows=e.lines.map((l,i)=>({code:'R'+i,competence:f.period,basis:l.kind==='allowance'?'accessory':'liquidated',unit:l.quantityMs?'minutes':l.unit,quantity:l.quantityMs?String(Number(l.quantityMs)/60000):l.quantity,amountCents:l.amountCents}));
 f.mappings=e.lines.map((l,i)=>({rowCode:'R'+i,engineIds:[l.id],basis:l.kind==='allowance'?'accessory':'paid',evidence:'DOC'}));
 f.payroll.grossCents=e.totals.amountCents;
 return f;
}
test('straordinario: voci e lordo confrontati esattamente',()=>{const r=run(fixture());assert.equal(r.status,'match');assert.equal(r.rows[1].quantityDelta.milliseconds,'0');assert.equal(r.netCents,null);assert.equal(r.realPayrollValidated,false);});
test('minuti e ore decimali non confusi',()=>{const f=fixture();f.payroll.rows[1].quantity='1.30';f.payroll.rows[1].unit='decimalHours';const r=run(f);assert.equal(r.rows[1].quantityDelta.milliseconds,'-1080000');assert.equal(r.rows[1].quantityDelta.minutes.numerator,'-1080000');assert.equal(r.status,'insufficientData');});
for(const [name,change,field,expected] of [
 ['notturno',f=>{f.shifts[0].start='22:00';f.shifts[0].end='07:00';},'nightMs',28800000],
 ['festivo',f=>{f.hours.holidays=['2026-08-03'];},'holidayMs',32400000],
 ['domenicale',f=>{f.shifts[0].date='2026-08-02';},'sundayMs',32400000],
 ['turni multipli',f=>{f.shifts=[{id:'S1',date:'2026-08-03',start:'08:00',end:'12:00'},{id:'S2',date:'2026-08-03',start:'14:00',end:'19:00'}];},'overtimeMs',3600000],
 ['trasferimento retribuito',f=>{f.shifts[0].events=[{type:'paidTransfer',fromMinutes:0,toMinutes:60}];},'workedMs',28800000],
 ['pausa non retribuita',f=>{f.shifts[0].events=[{type:'unpaidBreak',fromMinutes:0,toMinutes:60}];},'classifiableMs',28800000],
 ['pausa retribuita',f=>{f.shifts[0].events=[{type:'paidBreak',fromMinutes:0,toMinutes:30}];},'workedMs',30600000],
 ['override esplicito zero',f=>{f.shifts[0].manualOvertimeMinutes=0;},'overtimeMs',0]
]) test(name,()=>{const r=run(autoFixture(change));assert.equal(r.status,'match');assert.equal(r.engine.classification.totals[field],expected);});
test('premio notturno configurato e indennità sintetica',()=>{const f=autoFixture(f=>{f.shifts[0].start='22:00';f.shifts[0].end='07:00';f.economy.premiumGroups.N='sum';f.economy.premiumRules=[{id:'N',bucket:'all',when:{night:true},scope:'worked',kind:'premium',group:'N',hourlyEuro:'10',factor:'0.2'}];f.economy.allowances=[{id:'A',description:'SYNTHETIC',unit:'shift',quantity:'1',unitEuro:'2'}];});const r=run(f);assert.equal(r.status,'match');assert.equal(r.engine.economy.totals.premiumCents,'1600');assert.equal(r.engine.economy.totals.allowanceCents,'200');});
test('scarto di un centesimo non dichiarato bug',()=>{const f=fixture();f.payroll.rows[1].amountCents='1299';f.payroll.grossCents='9299';const r=run(f);assert.equal(r.rows[1].amountDeltaCents,'1');assert.equal(r.status,'insufficientData');assert.equal(r.grossDeltaCents,null);});
test('arrotondamento documentato con delta esatto',()=>{const f=fixture();f.payroll.rows[1].amountCents='1299';f.payroll.grossCents='9299';f.mappings[1].explanation={kind:'rounding',reference:'ROUND1',expectedAmountDeltaCents:'1',expectedQuantityDelta:'0'};const r=run(f);assert.equal(r.status,'explainedDifference');assert.equal(r.grossDeltaCents,'1');});
test('spiegazione che non coincide non assolve lo scarto',()=>{const f=fixture();f.payroll.rows[1].amountCents='1299';f.mappings[1].explanation={kind:'rounding',reference:'ROUND1',expectedAmountDeltaCents:'2',expectedQuantityDelta:'0'};assert.equal(run(f).rows[1].status,'insufficientData');});
test('contraddizione aritmetica dimostrata solo nel cedolino',()=>{const f=fixture();f.payroll.grossCents='9301';const r=run(f);assert.equal(r.status,'demonstratedError');assert.equal(r.arithmetic[0].scope,'declaredPayrollGrossArithmetic');assert.equal(r.arithmetic[0].deltaCents,'-1');});
test('inventario parziale non prova errore lordo',()=>{const f=fixture();f.payroll.grossCents='9301';f.payroll.completeGrossInventory=false;assert.deepEqual(run(f).arithmetic,[]);});
test('competenza precedente: niente scarto fittizio',()=>{const f=fixture();f.payroll.rows[1].competence='2026-07';const r=run(f);assert.equal(r.rows[1].amountDeltaCents,null);assert.equal(r.status,'insufficientData');});
test('ore fisiche non equiparate alle liquidate',()=>{const f=fixture();f.payroll.rows[0].basis='worked';assert.equal(run(f).rows[0].quantityDelta,null);});
test('osservazioni fisiche e pagate distinte',()=>{const f=autoFixture(f=>{f.shifts[0].events=[{type:'paidTransfer',fromMinutes:0,toMinutes:60}];});f.payroll.observations=[{metric:'worked',competence:f.period,unit:'decimalHours',quantity:'8',evidence:'PRES1'},{metric:'paid',competence:f.period,unit:'minutes',quantity:'540',evidence:'PRES2'}];assert.equal(run(f).status,'match');f.payroll.observations[0].quantity='9';assert.equal(run(f).status,'insufficientData');});
for(const [name,change] of [
 ['campo personale inatteso',f=>{f.payroll.nome='Persona sintetica';}],
 ['campo personale nella riga',f=>{f.payroll.rows[0].matricola='SYNTHETIC';}],
 ['codice libero',f=>{f.payroll.rows[0].code='Nome Cognome';}],
 ['ora con due punti',f=>{f.payroll.rows[0].quantity='8:30';}],
 ['unità mancante',f=>{delete f.payroll.rows[0].unit;}],
 ['riga riusata',f=>{f.mappings.push(f.mappings[0]);}],
 ['voce motore riusata',f=>{f.mappings[1].engineIds=['ORD'];}],
 ['riga duplicata',f=>{f.payroll.rows.push({...f.payroll.rows[0]});}],
 ['linea inesistente',f=>{f.mappings[0].engineIds=['ABSENT'];}],
 ['periodo invalido',f=>{f.payroll.period='2026-13';}],
 ['contesto mancante',f=>{f.contextComplete=false;}],
 ['cambio ora irrisolto',f=>{f.civilTimeComparable=false;}],
 ['policy implicita',f=>{delete f.periodPolicy;}],
 ['sovrapposizione',f=>{f.shifts.push({...f.shifts[0],id:'S2'});}],
 ['importo numerico',f=>{f.payroll.rows[0].amountCents=8000;}]
]) test('rifiuto: '+name,()=>{const f=fixture();change(f);assert.equal(run(f).complete,false);assert.equal(run(f).status,'insufficientData');});
test('riga senza abbinamento impedisce totale confrontabile',()=>{const f=fixture();f.mappings.pop();assert.deepEqual(run(f).unmappedRows,['R2']);assert.equal(run(f).grossDeltaCents,null);});
test('voce negativa conservata, nessuna tariffa inventata',()=>{const f=fixture();f.payroll.rows[1].amountCents='-100';f.payroll.grossCents='7900';assert.equal(run(f).rows[1].amountDeltaCents,'1400');});
test('importi oltre precisione Number confrontati con BigInt',()=>{const f=fixture();f.payroll.rows[1].amountCents='9007199254740993';assert.equal(run(f).rows[1].amountDeltaCents,'-9007199254739693');});
test('immutabilità e determinismo',()=>{const f=fixture(),before=JSON.stringify(f);assert.deepEqual(run(f),run(f));assert.equal(JSON.stringify(f),before);});
test('economia incompleta non produce totale parziale',()=>{const f=fixture();f.economy.baseRules=[];const r=run(f);assert.equal(r.complete,false);assert.equal(r.grossDeltaCents,null);});
test('modulo puro senza risultato disponibile',()=>{assert.equal(diagnose({period:'2026-08'},fixture().payroll,[]).complete,false);});
test('arrotondamento economico half-up reale su quantità sintetica',()=>{const f=autoFixture(f=>{f.shifts[0].end='08:01';f.economy.baseRules[0].hourlyEuro='0.3';});const r=run(f);assert.equal(r.status,'match');assert.equal(r.engine.economy.totals.amountCents,'1');});
test('contesto settimanale prima del filtro mensile',()=>{const f=autoFixture(f=>{f.hours.mode='settimanale';f.hours.thresholdMinutes=480;f.shifts=[{id:'CTX',date:'2026-07-31',start:'08:00',end:'16:00'},{id:'S1',date:'2026-08-01',start:'08:00',end:'17:00'}];});f.payroll.rows=[{code:'R1',competence:'2026-08',basis:'liquidated',unit:'minutes',quantity:'540',amountCents:'11700'}];f.payroll.grossCents='11700';f.mappings=[{rowCode:'R1',engineIds:['EXT'],basis:'paid',evidence:'DOC'}];assert.equal(run(f).status,'match');});
test('mensilizzato: ore coperte e base mensile separate',()=>{const f=fixture();f.economy.payMode='monthly';f.economy.monthlyBaseEuro='1000';f.economy.baseRules[0]={id:'ORD',bucket:'ordinary',when:{},scope:'paid',kind:'covered'};f.payroll.rows[0].amountCents='0';f.payroll.rows.push({code:'R3',competence:f.period,basis:'accessory',unit:'month',quantity:'1',amountCents:'100000'});f.payroll.grossCents='101300';f.mappings.push({rowCode:'R3',engineIds:['$monthlyBase'],basis:'accessory',evidence:'DOC3'});assert.equal(run(f).status,'match');});
test('premio e base: minuti sovrapposti non sommati',()=>{const f=fixture();f.economy.premiumGroups.N='sum';f.economy.premiumRules=[{id:'P',bucket:'ordinary',when:{},scope:'paid',kind:'premium',group:'N',hourlyEuro:'1',factor:'1'}];f.mappings[0].engineIds.push('P');const r=run(f);assert.equal(r.rows[0].quantityDelta,null);assert.equal(r.rows[0].status,'insufficientData');});
test('importo assente non convertito a zero',()=>{const f=fixture();f.payroll.rows[0].amountCents=null;const r=run(f);assert.equal(r.rows[0].amountDeltaCents,null);assert.equal(r.grossDeltaCents,null);});
test('differenza di mese mai assolta da spiegazione',()=>{const f=fixture();f.payroll.period='2026-09';f.mappings[1].explanation={kind:'settlementTiming',reference:'DOC',expectedAmountDeltaCents:'0',expectedQuantityDelta:'0'};assert.equal(run(f).status,'insufficientData');});
