'use strict';
// Modulo sperimentale puro. Tempi civili normalizzati, NON istanti UTC reali.
const MIN = 60000, DAY = 86400000;
function ticks(n) {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) throw Error('Minuti non validi');
  const v = n * MIN, i = Math.round(v);
  if (!Number.isSafeInteger(i) || Math.abs(v-i) > Math.max(1e-7, Math.abs(v)*Number.EPSILON*4)) throw Error('Precisione inferiore al millisecondo non supportata');
  return i;
}
function date(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw Error('Data non valida');
  const t = Date.parse(s+'T00:00:00Z');
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0,10)!==s) throw Error('Data non valida');
  return t;
}
function clock(s) {
  if (typeof s !== 'string' || !/^\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(s)) throw Error('Orario non valido');
  const [h,m,sec=0]=s.split(':').map(Number);
  if(h>23||m>59||sec>=60) throw Error('Orario non valido');
  return Math.round((h*3600+m*60+sec)*1000);
}
const key = t => new Date(t).toISOString().slice(0,10);
function week(t) { const d=new Date(t); return key(Math.floor(t/DAY)*DAY-((d.getUTCDay()+6)%7)*DAY); }
function classifyHours(shifts, config) {
  if(!Array.isArray(shifts)||!config||!['giornaliero','settimanale'].includes(config.mode)) throw Error('Configurazione richiesta');
  if(!['shiftDate','civilDate'].includes(config.thresholdBasis)) throw Error('Criterio di attribuzione soglia richiesto');
  const limit=ticks(config.thresholdMinutes);
  if(!Array.isArray(config.night)||config.night.length!==2||!Array.isArray(config.holidays)||config.timeBasis!=='civil') throw Error('Fascia, festività e base civile esplicite richieste');
  const night=config.night.map(clock); if(night[0]===night[1])throw Error('Fascia notturna ambigua');
  const holidays=new Set(config.holidays.map(s=>{date(s);return s;}));
  const issues=[], valid=[], ids=new Set();
  const counts=new Map();for(const s of shifts) if(s&&typeof s.id==='string')counts.set(s.id,(counts.get(s.id)||0)+1);
  for(const s of shifts){
    try {
      if(!s||typeof s.id!=='string'||!s.id||ids.has(s.id)||counts.get(s.id)!==1)throw Error('Identificativo mancante o duplicato');
      ids.add(s.id);const day=date(s.date),start=day+clock(s.start);let end=day+clock(s.end);
      if(end===start)throw Error('Durata nulla o 24 ore ambigua');
      if(end<start)end+=DAY;
      if(s.paidExtraMinutes!=null&&ticks(s.paidExtraMinutes)>0)throw Error('Minuti aggiuntivi senza collocazione temporale');
      const events=(s.events||[]).map(e=>{
        if(!['paidBreak','unpaidBreak','paidTransfer'].includes(e.type))throw Error('Causale intervallo non valida');
        const a=start+ticks(e.fromMinutes),b=start+ticks(e.toMinutes);
        if(a>=b||b>end)throw Error('Intervallo fuori turno');return {a,b,type:e.type};
      }).sort((a,b)=>a.a-b.a);
      if(events.some((e,i)=>i&&e.a<events[i-1].b))throw Error('Intervalli sovrapposti');
      const payable=end-start-events.filter(e=>e.type==='unpaidBreak').reduce((n,e)=>n+e.b-e.a,0);
      const manual=s.manualOvertimeMinutes==null?null:ticks(s.manualOvertimeMinutes);
      if(manual!==null&&manual>payable)throw Error('Override superiore alla durata classificabile');
      valid.push({s,start,end,events,manual,payable});
    } catch(e){issues.push({shiftId:s?.id??null,code:'INVALID_SHIFT',message:e.message});}
  }
  valid.sort((a,b)=>a.start-b.start||a.s.id.localeCompare(b.s.id));
  // Servizi fisicamente sovrapposti: nessun conteggio ambiguo viene pubblicato.
  for(let i=0;i<valid.length;i++)for(let j=i+1;j<valid.length&&valid[j].start<valid[i].end;j++)
    issues.push({shiftId:valid[i].s.id,otherShiftId:valid[j].s.id,code:'OVERLAPPING_SHIFTS'});
  if(issues.length)return {version:1,complete:false,issues,shifts:[],segments:[],totals:null};
  const segments=[],rows=[],cumulative=new Map();
  for(const v of valid){
    const {s,start,end,events,manual,payable}=v;
    const cuts=new Set([start,end,...events.flatMap(e=>[e.a,e.b])]);
    for(let d=Math.floor(start/DAY)*DAY;d<=end;d+=DAY)for(const offset of [0,...night])if(d+offset>start&&d+offset<end)cuts.add(d+offset);
    const points=[...cuts].sort((a,b)=>a-b);let manualRemaining=manual,autoTotal=0;
    const own=[];
    for(let i=0;i<points.length-1;i++){
      const a=points[i],b=points[i+1],duration=b-a,event=events.find(e=>a>=e.a&&b<=e.b);
      const paid=event?.type!=='unpaidBreak',physical=!event;
      const attribution=config.thresholdBasis==='shiftDate'?date(s.date):a;
      const period=config.mode==='giornaliero'?key(attribution):week(attribution),before=cumulative.get(period)||0;
      const auto=paid?Math.max(0,before+duration-limit)-Math.max(0,before-limit):0;
      if(paid)cumulative.set(period,before+duration);autoTotal+=auto;
      const extra=paid?(manual===null?auto:Math.min(duration,manualRemaining)):0;
      if(manual!==null)manualRemaining-=extra;
      const tod=a-Math.floor(a/DAY)*DAY;
      const noct=night[0]<night[1]?tod>=night[0]&&tod<night[1]:tod>=night[0]||tod<night[1];
      const sunday=new Date(a).getUTCDay()===0,holiday=holidays.has(key(a));
      const tags=[noct&&'night',sunday&&'sunday',holiday&&'holiday',s.restWorked===true&&'restWorked'].filter(Boolean);
      const seg={shiftId:s.id,date:key(a),startCivil:new Date(a).toISOString().replace('Z',''),endCivil:new Date(b).toISOString().replace('Z',''),durationMs:duration,workedMs:physical?duration:0,classifiableMs:paid?duration:0,ordinaryMs:paid?duration-extra:0,overtimeMs:extra,calculatedOvertimeMs:auto,nightMs:physical&&noct?duration:0,sundayMs:physical&&sunday?duration:0,holidayMs:physical&&holiday?duration:0,restWorkedMs:physical&&s.restWorked===true?duration:0,tags,overlap:tags.length>1,source:manual===null?'calculated':'manual',event:event?.type??'work',rule:config.mode};
      own.push(seg);segments.push(seg);
    }
    rows.push({shiftId:s.id,date:s.date,manualOvertimeMs:manual,calculatedOvertimeMs:autoTotal,...sum(own),payableMs:payable});
  }
  return {version:1,complete:true,issues:[],warnings:['Tempi civili: cambi di ora legale non convertiti in durata reale.','Override distribuito cronologicamente sulle quantità retribuite; nessuna aliquota applicata.'],shifts:rows,segments,totals:sum(segments)};
}
function sum(rows){return Object.fromEntries(['durationMs','workedMs','classifiableMs','ordinaryMs','overtimeMs','nightMs','sundayMs','holidayMs','restWorkedMs'].map(k=>[k,rows.reduce((n,r)=>n+r[k],0)]));}
module.exports={classifyHours};
