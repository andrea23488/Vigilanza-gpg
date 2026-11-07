'use strict';
// Solo CLI Node: lettura di sorgenti selezionati, mai App(), rete o dati utenti.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
function part(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a+start.length);if(a<0||b<0)throw Error('SOURCE_MARKER_MISSING');return text.slice(a,b);}
// Snapshot verificato dei frammenti storici: non legge App.js né sorgenti privati a runtime.
function fragments(){ return JSON.parse(JSON.stringify(require('./legacy-source.snapshot.json'))); }
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
function verifyFragments(f,expected){for(const [k,v]of Object.entries(f))if(digest(v)!==expected[k])throw Error('LEGACY_SOURCE_CHANGED:'+k);}
function runLegacy(root,records,hours,config,period){
 if(new Date(2026,0,1).getTimezoneOffset()!==0||new Date(2026,6,1).getTimezoneOffset()!==0)throw Error('LEGACY_REQUIRES_UTC_PROCESS');
 const f=fragments(root),expected=require('./legacy-fragments.json');
 verifyFragments(f,expected);
 const context={records:JSON.parse(JSON.stringify(records)),hours,config,period};vm.createContext(context);
 for(const key of ['turniCalcoli.js','straordinariManuali.js','straordinariGpg.js','stipendioCalcoli.js','extra','night'])vm.runInContext(f[key],context,{timeout:1000});
 const source=`function evaluate(){
const turni=records,turniStipendioMese=records.filter(t=>t.anno===period.year&&t.mese===period.month),giornateStipendioMese=turniStipendioMese;
const stipendioLivello=config.level,stipendioProfiloCalcolo=config.profile;
const stipendioTariffaStraordinario=config.tariffs.overtime,stipendioTariffaDomenicale=config.tariffs.sunday,stipendioTariffaDiurno=config.tariffs.day,stipendioTariffaIndennitaCompensativa=config.tariffs.compensatory,stipendioTariffaNotturno=config.tariffs.night,stipendioTariffaRiposo=config.tariffs.rest;
const stipendioIndennita20724=config.monthly.indennita20724,stipendioFestivitaNonGoduta=config.monthly.festivitaNonGoduta,stipendioAntirapina=config.monthly.antirapina;
const oreOrdinarieGiornaliereNumero=hours.dailyMinutes/60;
const extraStipendioMese=calcolaStraordinariConfigurati({giornateMese:giornateStipendioMese,tuttiTurni:turni,modalita:hours.mode,sogliaGiornaliera:hours.dailyMinutes/60,sogliaSettimanale:hours.weeklyMinutes/60,meseTarget:period.month,annoTarget:period.year});
${f.sunday}
const oreDomenicaliMese=oreDomenicaliMeseLegacy;
${f.salary}
${f.holiday}
${f.netMonth}
${f.netToday}
const total=giornateStipendioMese.reduce((n,t)=>n+oreRetribuiteTurno(t),0);
return {hours:{total,ordinary:Math.max(0,total-extraStipendioMese),overtime:extraStipendioMese,night:giornateStipendioMese.reduce((n,t)=>n+calcolaOreNotturneTurno(t.inizio,t.fine),0),sunday:oreDomenicaliMese,holiday:oreFestiveMese,rest:oreRiposoLavoratoMese},grossEuro:totaleCompetenzeStimate,grossCents:Math.round(Number(totaleCompetenzeStimate.toFixed(2))*100).toString(),lines:vociCompetenzeGpg,netMonthlyEuro:Number((totaleCompetenzeStimate*coefficienteNettoStimato).toFixed(2)),netProjectionEuro:Number((totaleCompetenzeStimate*coefficienteNettoGpgAdOggi).toFixed(2)),baseEuro:lordoBaseLivello};}
evaluate()`;
 return {...JSON.parse(JSON.stringify(vm.runInContext(source,context,{timeout:1000}))),provenance:{type:'verifiedSourceFragments',hashes:expected}};
}
module.exports={runLegacy,fragments,digest,verifyFragments};
