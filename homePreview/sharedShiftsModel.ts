export type SharedShift = { id:string; dateKey:string; user:string; name:string; company:string; start:string; end:string; place:string };
export type DayOption = { dateKey:string; day:number; label:string; today:boolean };
export function localDateKey(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function weekForDate(now=new Date()):DayOption[]{
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate()),monday=new Date(today);
 monday.setDate(today.getDate()-((today.getDay()+6)%7));
 return Array.from({length:7},(_,index)=>{const date=new Date(monday);date.setDate(monday.getDate()+index);return{dateKey:localDateKey(date),day:date.getDate(),label:date.toLocaleDateString('it-IT',{weekday:'short'}).replace(/\.$/,'').slice(0,3),today:localDateKey(date)===localDateKey(today)};});
}
export function shiftInterval(shift:Pick<SharedShift,'dateKey'|'start'|'end'>){
 const [year,month,day]=shift.dateKey.split('-').map(Number),[sh,sm]=shift.start.split(':').map(Number),[eh,em]=shift.end.split(':').map(Number);
 const start=new Date(year,month-1,day,sh,sm),end=new Date(year,month-1,day,eh,em);if(end<=start)end.setDate(end.getDate()+1);return[start.getTime(),end.getTime()] as const;
}
export function isOnShiftNow(shift:SharedShift,now:Date){const [start,end]=shiftInterval(shift);return start<=now.getTime()&&now.getTime()<end;}
export function sortDayShifts(shifts:SharedShift[],now=new Date()):SharedShift[]{
 const user=shifts.find(shift=>shift.user==='me'),userInterval=user?shiftInterval(user):null;
 return [...shifts].sort((a,b)=>{
  if(a.user==='me'&&b.user!=='me')return -1;if(b.user==='me'&&a.user!=='me')return 1;
  const activeA=Boolean(userInterval&&a.user!=='me'&&(()=>{const[i,j]=shiftInterval(a);return i<userInterval[1]&&userInterval[0]<j;})());
  const activeB=Boolean(userInterval&&b.user!=='me'&&(()=>{const[i,j]=shiftInterval(b);return i<userInterval[1]&&userInterval[0]<j;})());
  if(activeA!==activeB)return activeA?-1:1;
  return shiftInterval(a)[0]-shiftInterval(b)[0]||a.name.localeCompare(b.name,'it');
 });
}
export function sharedDayFixture(now=new Date()):SharedShift[]{
 const days=weekForDate(now),todayKey=localDateKey(now);
 const start=new Date(now.getTime()-60*60*1000),end=new Date(now.getTime()+180*60*1000);
 const time=(d:Date)=>`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
 const result:SharedShift[]=[];
 const add=(dateKey:string,user:string,name:string,company:string,a:string,b:string,place:string)=>result.push({id:`${dateKey}-${user}`,dateKey,user,name,company,start:a,end:b,place});
 add(todayKey,'me','Francesco','ISTITUTO DEMO',time(start),time(end),'Piantonamento · Aeroporto');
 add(todayKey,'colleague-current','Giulia Riva','VIGILANZA DEMO',time(start),time(end),'Ingresso principale');
 for(const day of days){if(day.today)continue;const i=days.findIndex(option=>option.dateKey===day.dateKey),slots=[['06:00','14:00'],['14:00','22:00'],['22:00','06:00'],['08:00','16:00']];
  for(let j=0;j<4;j++){const[a,b]=slots[(i+j)%slots.length],people=[['colleague-a','Marco Bianchi','ISTITUTO DEMO','Varco nord'],['colleague-b','Sara Conti','VIGILANZA DEMO','Sala controllo'],['colleague-c','Luca Ferri','ISTITUTO DEMO','Terminal partenze'],['colleague-d','Elena Greco','SERVIZI DEMO','Area parcheggi']][j];add(day.dateKey,people[0],people[1],people[2],a,b,people[3]);}
 }

 return result;
}
export function todayScrollOffset(selectedIndex:number,width:number,slotWidth=68){return Math.max(0,selectedIndex*slotWidth-(width-slotWidth)/2);}
