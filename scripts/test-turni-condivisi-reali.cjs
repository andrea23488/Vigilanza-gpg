const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
function load(file, imports, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const env = { exports: {}, require: key => { assert.ok(key in imports, `Import non simulato: ${key}`); return imports[key]; }, ...globals };
  vm.runInNewContext(code, env, { filename: file }); return env.exports;
}
const api = load('turniCondivisiApi.js', { './supabase': { supabase: {} } });
const model = load('turniCondivisiModel.js', { './turniCondivisiApi': api });
const themes = load('temi.js', {});
const key = model.chiaveData;
const now = () => new Date(2026, 9, 21, 15, 30);
const turno = (id, giorno = 21, inizio = '14:00', fine = '18:00', props = {}) => ({ id, anno: 2026, mese: 10, giorno, tipo: 'turno', inizio, fine, ...props });
const relazione = (id, stato = 'accettato') => ({ id: `r-${id}`, altro_user_id: id, stato, profilo: { nome: id } });
const ricevuto = (id, props = {}) => ({ condivisione_id: `share-${id}`, proprietario_id: id, livello: 'orari_luogo', profilo: { nome: id, cognome: 'Rossi', azienda: 'Istituto', foto_url: 'avatar-test' }, turno: turno(id), ...props });
function rows(overrides = {}) { return model.creaElementiCondivisi({ mieiTurni: [turno('mine')], ricevuti: [ricevuto('a')], colleghi: [relazione('a')], profilo: { nome: 'Utente', cognome: 'Reale' }, ...overrides }); }
function ids(list) { return Array.from(list, e => e.id); }

test('date locali: apertura di ogni giorno, sette date, settimane a cavallo di mese e anno', () => {
  for (let day = 19; day <= 25; day++) {
    const today = new Date(2026, 9, day), monday = model.lunediDellaSettimana(today);
    assert.equal(monday.getDay(), 1); assert.equal(monday.getDate(), 19);
    assert.equal(model.aggiungiGiorni(today, 7).getDay(), today.getDay());
    assert.equal(Array.from({ length: 7 }, (_, i) => key(model.aggiungiGiorni(monday, i))).includes(key(today)), true);
  }
  assert.equal(key(model.lunediDellaSettimana(new Date(2026, 0, 1))), '2025-12-29');
  assert.equal(key(model.aggiungiGiorni(new Date(2026, 11, 30), 7)), '2027-01-06');
});
test('notturni dal giorno e dalla settimana precedente; fine esclusa, orari e date invalidi', () => {
  const night = turno('night', 18, '22:00', '06:00');
  assert.equal(model.turnoNelGiorno(night, new Date(2026, 9, 19)), true);
  assert.equal(model.turnoAttivo(night, new Date(2026, 9, 19, 2)), true);
  assert.equal(model.turnoAttivo(night, new Date(2026, 9, 19, 6)), false);
  assert.equal(model.turnoNelGiorno(turno('midnight', 20, '16:00', '00:00'), now()), false);
  assert.equal(model.turnoAttivo(turno('rest', 21, '14:00', '18:00', { tipo: 'riposo' }), now()), false);
  for (const time of ['25:10', '12:99', 'no', '']) assert.equal(model.intervalloTurno(turno('bad', 21, time)), null);
  assert.equal(model.dataTurno(turno('bad', 31, '08:00', '16:00', { mese: 2 })), null);
  assert.equal(model.orarioTurno(turno('bad', 21, '', '')), 'Orario non indicato');
});
test('giorno selezionato soltanto; turni multipli TU, sovrapposti a qualsiasi turno proprio, poi cronologici', () => {
  const data = rows({ mieiTurni: [turno('late', 21, '18:00', '22:00'), turno('early', 21, '06:00', '10:00')],
    colleghi: ['overlap-late','overlap-early','no-overlap','tomorrow'].map(x => relazione(x)),
    ricevuti: [ricevuto('overlap-late', { turno: turno('ol', 21, '20:00', '23:00') }), ricevuto('overlap-early', { turno: turno('oe', 21, '07:00', '09:00') }), ricevuto('no-overlap', { turno: turno('no', 21, '10:00', '12:00') }), ricevuto('tomorrow', { turno: turno('tom', 22) })] });
  assert.deepEqual(ids(model.elementiDelGiorno(data, now(), now())), ['mio_early','mio_late','collega_share-overlap-early','collega_share-overlap-late','collega_share-no-overlap']);
  assert.deepEqual(ids(model.elementiDelGiorno(data, new Date(2026,9,22), now())), ['collega_share-tomorrow']);
});
test('privacy: servono condivisione, livello noto e collegamento accettato; mai recuperare dati dai soli colleghi', () => {
  const r = rows({ ricevuti: [ricevuto('a'), ricevuto('pending'), ricevuto('blocked'), ricevuto('unknown', { livello: 'nuovo_livello' })], colleghi: [relazione('a'), relazione('pending','in_attesa'), relazione('unknown')] });
  assert.deepEqual(ids(r), ['mio_mine','collega_share-a']);
  assert.deepEqual(ids(rows({ ricevuti: [] })), ['mio_mine']);
  assert.deepEqual(ids(rows({ colleghi: [] })), ['mio_mine']);
});
test('solo_orari oscura tutti i campi di posizione anche nel riepilogo; assenza postazione neutra e avatar reale', () => {
  const secret = ricevuto('a', { livello: 'solo_orari', turno: turno('a',21,'14:00','18:00',{ postazione:'SEGRETO', luogo:'SEGRETO', indirizzo_servizio:'SEGRETO', email:'segreta' }) });
  const r = rows({ ricevuti: [secret] }), json = JSON.stringify(r);
  assert.doesNotMatch(json, /SEGRETO|email/); assert.equal(r[1].turno.postazione, 'Luogo non condiviso');
  assert.equal(model.inServizioAdesso(r, now())[1].turno.postazione, 'Luogo non condiviso');
  assert.equal(r[1].foto, 'avatar-test');
  assert.equal(rows()[0].turno.postazione, 'Postazione non indicata');
  assert.equal(rows({ mieiTurni:[turno('legacy',21,'14:00','18:00',{luogo:'Piantonamento'})] })[0].turno.postazione, 'Postazione non indicata');
});
test('in servizio: usa tutti i dati autorizzati, non la settimana selezionata; sovrapposizioni contano persone uniche', () => {
  const r = rows({ mieiTurni: [turno('m1'),turno('m2',21,'15:00','19:00')], ricevuti: [ricevuto('a'),ricevuto('a',{ condivisione_id:'s2', turno:turno('a2',21,'15:00','20:00') })] });
  const active = model.inServizioAdesso(r, now());assert.equal(active.length,4);assert.equal(model.contaPersone(active),2);
  assert.equal(model.inServizioAdesso(r,new Date(2026,9,21,20)).length,0);
});
function hooks() {
  const state=[], refs=[], memos=[], effects=[], cleanups=new Map(); let cursor=0, queue=[];
  const equal=(a,b)=>a && b && a.length===b.length && a.every((v,i)=>Object.is(v,b[i]));
  const react={...React,
    useState:initial=>{const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return[state[i],v=>state[i]=typeof v==='function'?v(state[i]):v];},
    useRef:initial=>{const i=cursor++;return refs[i]||(refs[i]={current:initial});},
    useMemo:(fn,deps)=>{const i=cursor++;if(!memos[i]||!equal(memos[i].deps,deps))memos[i]={deps,value:fn()};return memos[i].value;},
    useEffect:(fn,deps)=>{const i=cursor++;if(!effects[i]||!equal(effects[i],deps)){effects[i]=deps;queue.push(()=>{cleanups.get(i)?.();cleanups.set(i,fn());});}},
  };react.useCallback=(fn,deps)=>react.useMemo(()=>fn,deps);
  return {react,start(){cursor=0;queue=[];},effects(){const q=queue;queue=[];q.forEach(fn=>fn());},cleanup(){for(const fn of cleanups.values())fn?.();},state};
}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function screenHarness({turni=[turno('mine')], received=[ricevuto('a')], relazioni=[relazione('a')], shares=[]}={}) {
  const h=hooks(),nodes=[],calls=[],timers=new Map();let captured,change, fail=false, delayed=null, currentTime=now().getTime();
  const data={turni,received,relazioni,shares};
  const host=name=>({children,...props})=>{nodes.push({name,...props});return React.createElement('div',null,children);};
  const native={...Object.fromEntries(['View','Text','ScrollView','TouchableOpacity','ActivityIndicator'].map(n=>[n,host(n)])), Modal:props=>{nodes.push({name:'Modal',...props});return props.visible?React.createElement('div',null,props.children):null;},Alert:{alert:(...args)=>calls.push(['alert',...args])},AppState:{currentState:'active',addEventListener:(_,fn)=>{change=fn;return{remove(){}}}}};
  const service={
    caricaTurniCondivisiRicevuti:async()=>{if(fail)throw Error('Errore simulato');return delayed?await delayed:data.received;},
    caricaMieCondivisioni:async()=>data.shares,
    rimuoviCondivisioneTurni:async args=>{calls.push(['revoca',args]);data.shares=[];},
    condividiTurniConColleghi:async args=>calls.push(['condividi',args]),
  };
  class FixedDate extends Date { constructor(...args){super(...(args.length?args:[currentTime]));} }
  const component=load('CalendarioColleghiScreen.js',{
    react:h.react,'react-native':native,'@expo/vector-icons':{Ionicons:host('Ionicons')},'./temi':themes,
    './turniApi':{caricaTurniUtente:async()=>data.turni},'./colleghiApi':{caricaColleghi:async()=>data.relazioni},'./turniCondivisiApi':service,
    './TurniCondivisiView':{__esModule:true,default:props=>{captured=props;return null;}},'./turniCondivisiModel':model,
  },{Date:FixedDate,setInterval:(fn,ms)=>{timers.set(ms,fn);return ms;},clearInterval:id=>timers.delete(id)}).default;
  const render=()=>{h.start();nodes.length=0;renderToStaticMarkup(React.createElement(component,{onBack:()=>calls.push('social'),onHome:()=>calls.push('home'),onGestioneColleghi:()=>calls.push('colleghi'),profilo:{nome:'Utente',cognome:'Reale'}}));h.effects();return captured;};
  render();
  return{data,calls,timers,nodes,render,get view(){return captured;},async ready(){await flush();render();},background(state){native.AppState.currentState=state;change(state);},fail(){fail=true;},advance(date){currentTime=date.getTime();},delay(p){delayed=p;},cleanup:h.cleanup};
}
test('controller reale: oggi all’apertura, tutti i giorni, cambio settimana conserva giorno; collegamenti Social/Home/colleghi',async()=>{
  const r=screenHarness();await r.ready();assert.equal(key(r.view.giornoSelezionato),key(now()));
  for(let i=0;i<7;i++){const day=model.aggiungiGiorni(r.view.inizioSettimana,i);r.view.onGiorno(day);r.render();assert.equal(key(r.view.giornoSelezionato),key(day));}
  r.view.onSettimana(1);await r.ready();assert.equal(key(r.view.giornoSelezionato),'2026-11-01');
  r.view.onBack();r.view.onHome();r.view.onGestioneColleghi();assert.deepEqual(r.calls,['social','home','colleghi']);r.cleanup();assert.equal(r.timers.size,0);
});
test('controller reale: una revoca ricevuta e un collegamento revocato spariscono da lista e box al refresh',async()=>{
  const r=screenHarness();await r.ready();assert.equal(r.view.elementi.length,2);
  r.data.received=[];await r.view.onRefresh();r.render();assert.equal(r.view.elementi.length,1);
  r.data.received=[ricevuto('a')];await r.view.onRefresh();r.render();assert.equal(r.view.elementi.length,2);
  r.data.relazioni=[];await r.view.onRefresh();r.render();assert.equal(r.view.elementi.length,1);
  r.fail();await r.view.onRefresh();r.render();assert.match(r.view.errore,/Errore simulato/);assert.equal(r.view.elementi.length,0);r.cleanup();
});
test('background nasconde i dati; risposta obsoleta non ripristina condivisioni dopo revoca',async()=>{
  const r=screenHarness();await r.ready();let resolve;r.delay(new Promise(done=>resolve=done));const request=r.view.onRefresh();
  r.background('background');r.render();assert.equal(r.view.loading,true);assert.equal(r.view.elementi.filter(x=>!x.mio).length,0);
  resolve([ricevuto('a')]);await request;r.render();assert.equal(r.view.elementi.filter(x=>!x.mio).length,0);r.cleanup();
});
test('condivisione originale: nessuna scrittura aprendo la modale; scelta esplicita e livello; revoca con selezione vuota',async()=>{
  const r=screenHarness({turni:[turno('mine'),turno('future',28)],shares:[{turno_id:'mine',destinatario_id:'a',livello:'solo_orari'}]});await r.ready();
  r.view.onCondividi();r.render();assert.equal(r.calls.length,0);
  assert.ok(r.nodes.find(x=>x.name==='Modal').visible);
  const colleague=r.nodes.find(x=>x.accessibilityRole==='checkbox');assert.equal(colleague.accessibilityState.checked,true);
  colleague.onPress();r.render();await r.nodes.find(x=>x.accessibilityLabel==='Salva condivisione').onPress();r.render();
  assert.equal(r.calls[0][0],'revoca');assert.deepEqual(Array.from(r.calls[0][1].turnoIds),['mine']);assert.equal(r.calls.some(x=>x[0]==='condividi'),false);
  r.view.onCondividi();r.render();r.nodes.find(x=>x.accessibilityRole==='checkbox').onPress();r.render();
  await r.nodes.find(x=>x.accessibilityLabel==='Salva condivisione').onPress();r.render();
  const sent=r.calls.find(x=>x[0]==='condividi');assert.ok(sent);assert.deepEqual(Array.from(sent[1].collegaIds),['a']);assert.equal(sent[1].livello,'orari_luogo');assert.deepEqual(Array.from(sent[1].turnoIds),['mine']);r.cleanup();
});
function renderView({date=now(),selected=date,items=rows(),scale=1}={}) {
  const h=hooks(),nodes=[],calls=[],scrolls=[];
  const host=name=>({children,...props})=>{nodes.push({name,...props});return React.createElement('div',null,children);};
  const Scroll=React.forwardRef(({children,...props},ref)=>{if(ref)ref.current={scrollTo:x=>scrolls.push(x)};nodes.push({name:'ScrollView',...props});return React.createElement('div',null,children);});
  const Native={...Object.fromEntries(['ActivityIndicator','Image','Pressable','Text','View'].map(n=>[n,host(n)])),ScrollView:Scroll,StyleSheet:{create:x=>x},useWindowDimensions:()=>({width:320,height:568,fontScale:scale})};
  const Component=load('TurniCondivisiView.js',{react:h.react,'react-native':Native,'react-native-safe-area-context':{SafeAreaView:host('SafeAreaView')},'@expo/vector-icons':{Ionicons:host('Ionicons')},'./turniCondivisiModel':model,'./temi':themes}).default;
  const render=()=>{h.start();nodes.length=0;const html=renderToStaticMarkup(React.createElement(Component,{palette:themes.PALETTE_ORIGINALE,elementi:items,adesso:date,giornoSelezionato:selected,inizioSettimana:model.lunediDellaSettimana(selected),onGiorno:d=>calls.push(key(d)),onSettimana:d=>calls.push(d),onBack:()=>calls.push('social'),onHome:()=>calls.push('home'),onCondividi:()=>calls.push('share'),onRefresh:()=>calls.push('refresh'),loading:false,errore:''}));h.effects();return html;};
  const html=render();return{nodes,calls,html,scrolls,render};
}
test('vista approvata: OGGI selezionato, sette pulsanti, righe compatte, tema globale, nessuna demo',()=>{
  const r=renderView();assert.equal(r.nodes.find(n=>n.testID==='shared-day-today').accessibilityState.selected,true);
  const chips=r.nodes.filter(n=>n.testID?.startsWith('shared-day-')&&n.testID!=='shared-day-list');assert.equal(chips.length,7);
  chips.forEach(n=>n.onPress());assert.equal(new Set(r.calls).size,7);assert.ok(r.scrolls.length);
  assert.doesNotMatch(r.html,/DEMO|dimostrativ/i);assert.match(r.html,/Utente Reale/);assert.match(r.html,/TU/);
  for(const n of r.nodes.filter(n=>n.testID==='shared-colleague-row')){const style=Object.assign({},...n.style);assert.equal(style.minHeight,64);assert.equal(style.backgroundColor,n.accessibilityLabel.endsWith(', tu')?themes.PALETTE_ORIGINALE.surfaceRaised:themes.PALETTE_ORIGINALE.surface);}
  for(const label of ['Settimana precedente','Settimana successiva','Condividi la mia settimana','Torna al menu Social','Torna alla Home']){const node=r.nodes.find(n=>n.accessibilityLabel===label);assert.ok(node,label);node.onPress();}
});
test('schermo piccolo e caratteri grandi: righe si adattano senza altezza fissa; giorni hanno dimensione leggibile',()=>{
  const r=renderView({scale:1.8});for(const n of r.nodes.filter(n=>n.testID==='shared-colleague-row')){const s=Object.assign({},...n.style);assert.equal(s.flexDirection,'column');assert.equal(s.height,undefined);}
  const today=r.nodes.find(n=>n.testID==='shared-day-today');assert.ok(Object.assign({},...today.style).width>52);
});

test('orologio vivo: riepilogo si aggiorna senza cambiare la data selezionata, anche visitando un’altra settimana',async()=>{
  const r=screenHarness();await r.ready();
  assert.equal(model.inServizioAdesso(r.view.elementi,r.view.adesso).length,2);
  r.advance(new Date(2026,9,21,18));r.timers.get(15000)();r.render();
  assert.equal(model.inServizioAdesso(r.view.elementi,r.view.adesso).length,0);
  assert.equal(key(r.view.giornoSelezionato),'2026-10-21');
  r.view.onSettimana(1);await r.ready();assert.equal(key(r.view.giornoSelezionato),'2026-10-28');
  r.advance(new Date(2026,9,21,16));r.timers.get(15000)();r.render();
  assert.equal(model.inServizioAdesso(r.view.elementi,r.view.adesso).length,2);r.cleanup();
});
test('notturno al cambio dell’ora e lista di un giorno futuro indipendenti dal riepilogo corrente',()=>{
  const night=turno('ora-solare',24,'22:00','06:00');
  assert.equal(model.turnoAttivo(night,new Date(2026,9,25,2,30)),true);
  assert.equal(model.turnoNelGiorno(night,new Date(2026,9,25)),true);
  const r=renderView({selected:new Date(2026,9,28)});
  assert.match(r.html,/a Rossi/);assert.equal(r.nodes.filter(n=>n.testID==='shared-colleague-row').length,0);
});


test('Torna su recuperato: compare dopo lo scroll e risale senza alterare date o dati condivisi',()=>{
 const r=renderView();assert.ok(!r.nodes.some(n=>n.accessibilityLabel==='Torna su'));
 r.nodes.find(n=>n.name==='ScrollView'&&!n.horizontal).onScroll({nativeEvent:{contentOffset:{y:400}}});r.render();
 const button=r.nodes.find(n=>n.accessibilityLabel==='Torna su');assert.ok(button);button.onPress();
 assert.equal(JSON.stringify(r.scrolls.at(-1)),JSON.stringify({y:0,animated:false}));assert.equal(r.calls.length,0);
 r.nodes.find(n=>n.name==='ScrollView'&&!n.horizontal).onScroll({nativeEvent:{contentOffset:{y:0}}});r.render();
 assert.ok(!r.nodes.some(n=>n.accessibilityLabel==='Torna su'));
});
