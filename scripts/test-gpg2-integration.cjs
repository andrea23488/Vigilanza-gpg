const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),babel=require('@babel/core');
const reference=require('../experimental/gpg-v2/reference/agosto-2026.cjs');
const {classifyHours}=require('../experimental/gpg-v2/core/classificaOre.cjs');
const {runLegacy}=require('../experimental/gpg-v2/tests/recovered/legacyDiagnostico.cjs');
const code=babel.transformSync(fs.readFileSync('stipendioCalcoli.js','utf8'),{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code;
const context={exports:{}};vm.runInNewContext(code,context);const {calcolaVociGpg,tariffaStraordinario30DaBase,stimaNettoGpgLegacy}=context.exports;
function august(){return calcolaVociGpg({lordoBase:1468.88,oreStraordinario:67.5,tariffaStraordinario:tariffaStraordinario30DaBase(1468.88),oreDomenicali:35,tariffaDomenicale:0.71,serviziDiurni:15,tariffaDiurno:0.65,tariffaCompensativa:1.86,serviziNotturni:11,tariffaNotturno:4.18});}
test('agosto: differenza ricostruita voce per voce senza cambiare ore, tariffe o netto per persona',()=>{
 const values=august();assert.equal(values.totale,2322.41);
 const predicted=[['BASE',values.base],['EXTRA',values.straordinario],['DOMENICA',values.domenicale],['DIURNO',values.piantonamentoDiurno],['COMPENSATIVA',values.compensativa],['NOTTURNO',values.piantonamentoNotturno],['ARRETRATI',0],['CONTROL_ROOM',0]];
 const payroll=Object.fromEntries(reference.payroll.rows.map(r=>[r.code,Number(r.amountCents)]));payroll.EXTRA=payroll.EXTRA30+payroll.EXTRA35+payroll.EXTRA40;
 const deltas=Object.fromEntries(predicted.map(([key,eur])=>[key,payroll[key]-Math.round(eur*100)]));
 assert.deepEqual(deltas,{BASE:0,EXTRA:8132,DOMENICA:0,DIURNO:-130,COMPENSATIVA:-372,NOTTURNO:836,ARRETRATI:22503,CONTROL_ROOM:3000});
 assert.equal(Object.values(deltas).reduce((a,b)=>a+b),33969);
 const oldNet=stimaNettoGpgLegacy({competenze:values.totale,coefficiente:1860/2273.30});assert.equal(oldNet,1900.18);assert.equal(Math.round((2133-oldNet)*100),23282);
});
test('tutta la filiera storica conserva i risultati, con il netto etichettato come legacy',()=>{
 const classification=classifyHours(reference.calendar,{mode:'giornaliero',thresholdMinutes:420,thresholdBasis:'shiftDate',timeBasis:'civil',night:['21:00','05:00'],holidays:['2026-08-15']});
 const records=reference.calendar.map(t=>{const [anno,mese,giorno]=t.date.split('-').map(Number);const r=classification.shifts.find(s=>s.shiftId===t.id);return{id:t.id,anno,mese,giorno,tipo:'turno',inizio:t.start,fine:t.end,ore:r.durationMs/3600000};});
 const result=runLegacy(null,records,{mode:'giornaliero',dailyMinutes:420,weeklyMinutes:2400},{level:'4',profile:'automatico',tariffs:{},monthly:{indennita20724:0,festivitaNonGoduta:0,antirapina:0}},{year:2026,month:8});
 assert.equal(result.grossCents,reference.reportedApp.grossCents);assert.equal(result.netProjectionEuro,1900.18);assert.equal(result.hours.total,249.5);assert.equal(result.hours.overtime,67.5);
});
test('L.207/2024: esente distinto dal lordo e accreditato integralmente in ogni stima legacy',()=>{
 const values=calcolaVociGpg({lordoBase:2000,indennita20724:100});assert.equal(values.competenzeLorde,2000);assert.equal(values.sommeEsenti,100);assert.equal(values.totale,2100);assert.equal(values.imponibileFiscale,null);
 assert.equal(stimaNettoGpgLegacy({competenze:values.totale,esenti:values.sommeEsenti,coefficiente:0.8}),1700);
 assert.equal(stimaNettoGpgLegacy({competenze:1050,esenti:50,coefficiente:0.8}),850);
});
test('arrotondamento delle righe al centesimo prima di sommare',()=>{
 const r=calcolaVociGpg({serviziDiurni:1,tariffaDiurno:0.335,tariffaCompensativa:0.335});assert.equal(r.totale,0.68);assert.equal(r.piantonamentoDiurno,0.34);
});

test('schermata collegata al nucleo fiscale, ma nessun netto promosso in assenza di un profilo validato',()=>{
 const {officialComparison}=require('../experimental/gpg-v2/officialComparison.cjs');
 const result=officialComparison({records:[{id:'test',user_id:'test',anno:2026,mese:8,giorno:1,tipo:'turno',inizio:'06:00',fine:'14:00',ore:8}],accountId:'test',year:2026,monthIndex:7,grossEuro:2322.41,netEstimateEuro:1900.18});
 assert.equal(result.operationalSource,'legacy');assert.equal(result.experimental.netEstimateCents,null);assert.equal(result.fiscal.available,false);assert.equal(result.fiscal.netCents,null);assert.ok(result.fiscal.issues.some(i=>i.field==='contributionRatePercent'));
});
