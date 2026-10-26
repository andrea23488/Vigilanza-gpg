export function createFixtures(now=new Date()) {
 const start=new Date(now.getTime()-3600000),end=new Date(now.getTime()+3*3600000),clock=d=>`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
 const record=(id,d,inizio,fine,luogo)=>({id,tipo:'turno',giorno:d.getDate(),mese:d.getMonth()+1,anno:d.getFullYear(),inizio,fine,luogo,indirizzo_servizio:''});
 const tomorrow=new Date(now);tomorrow.setDate(tomorrow.getDate()+1);
 const records=[record('beta-today',start,clock(start),clock(end),'Ingresso DEMO'),record('beta-next',tomorrow,'08:00','16:00','Sede DEMO')];
 const profiles=[{user_id:'beta-anna-1',nome:'Anna',cognome:'Rossi',azienda:'Istituto DEMO A',sede:'Sede Nord DEMO',codice_gpg:'DEMO-A1'},{user_id:'beta-anna-2',nome:'Anna',cognome:'Rossi',azienda:'Istituto DEMO B',sede:'Sede Sud DEMO',codice_gpg:'DEMO-A2'}];
 return{records,profiles,profile:{nome:'Utente',cognome:'Beta',azienda:'Istituto DEMO',ruolo:'GPG',punto_partenza:''},models:[{id:'beta-day',nome:'Diurno DEMO',inizio:'08:00',fine:'16:00',luogo:'Sede DEMO'},{id:'beta-night',nome:'Notturno DEMO',inizio:'22:00',fine:'06:00',luogo:'Sede DEMO'}]};
}
export function monthSummary(records,year,month) {
 const rows=records.filter(t=>t.anno===year&&t.mese===month+1),minutes=t=>{const parse=v=>Number(v.slice(0,2))*60+Number(v.slice(3));return(parse(t.fine)-parse(t.inizio)+1440)%1440||1440};
 return{ore:rows.reduce((n,t)=>n+minutes(t)/60,0).toFixed(1)+' h',extra:'0 h',notti:rows.filter(t=>t.fine<=t.inizio).length,days:new Set(rows.map(t=>t.giorno)).size};
}
export function sharedFixtures(data) {return data.records.map(t=>({id:'mio_'+t.id,personaId:'me',mio:true,nome:'Utente Beta',azienda:'Istituto DEMO',foto:null,turno:{...t,postazione:t.luogo}})).concat(data.profiles.map((p,i)=>({id:p.user_id,personaId:p.user_id,mio:false,nome:p.nome+' '+p.cognome,azienda:p.azienda,foto:null,turno:{...data.records[0],id:'beta-share-'+i,postazione:i?'Luogo non condiviso':'Sede DEMO A'}})));}
