const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {test}=require('node:test');
const {execFileSync}=require('node:child_process');
const app=fs.readFileSync('App.js','utf8'),screen=fs.readFileSync('AspettoColoriScreen.js','utf8');
const c={AsyncStorage:{}};vm.createContext(c);
for(const f of ['temi.js','preferenzeAspetto.js'])vm.runInContext(fs.readFileSync(f,'utf8').replace(/^import .*;\n/gm,'').replaceAll('export ',''),c);
vm.runInContext(screen.slice(screen.indexOf('export const SFONDI_ASPETTO'),screen.indexOf('function Scelta(')).replaceAll('export ',''),c);
test('originale usa il rendering precedente senza sostituire colori',()=>{
 assert.equal(c.paletteHomeDaPreferenza(c.ripristinaAspetto()),null);
 for(const original of ['#07111F','rgba(94,235,255,0.78)','#6BFF8A','#5EEBFF']) assert.equal(c.coloreHome(null,'accent',original),original);
 assert.equal(c.paletteHomeDaPreferenza({version:999}),null);
});
test('sei preset e scelte indipendenti: contrasto anche su superfici',()=>{
 for(const preset of vm.runInContext('PRESET_TEMI',c)){
  const p=c.paletteHomeDaPreferenza({...c.ripristinaAspetto(),preset:preset.id});if(!p)continue;
  for(const bg of [p.background,p.surface,p.surfaceRaised])assert.ok(c.rapportoContrasto(p.text,bg)>=4.5);
  assert.ok(c.rapportoContrasto(p.onAccent,p.accent)>=4.5);
 }
 const pref=c.personalizzaAspetto(c.ripristinaAspetto(),{background:'#FFFFFF',accent:'#FDA4AF'});
 const p=c.paletteHomeDaPreferenza(pref);assert.equal(p.background,'#FFFFFF');assert.equal(p.homeAccent,'#FDA4AF');
 assert.ok(c.rapportoContrasto('#42F56C','#07160F')>=4.5);
});
test('handler reale applica solo dopo successo; reset e riavvio',async()=>{
 let raw=null,fail=false,active=c.ripristinaAspetto();
 const storage={getItem:async()=>raw,setItem:async(_,v)=>{if(fail)throw Error('storage');raw=v;}};
 const ctrl=c.creaControlloreAspetto(c.creaArchivioAspetto(storage));await ctrl.carica();
 const local={controllore:{current:ctrl},montato:{current:true},aggiorna:()=>{},setMessaggio:()=>{},onSalvato:p=>{active=p;}};vm.createContext(local);
 const start=screen.indexOf('  async function salva()');const end=screen.indexOf('  function indietro()',start);
 vm.runInContext(screen.slice(start,end),local);
 ctrl.selezionaPreset('lavanda');assert.equal(active.preset,'originale');
 fail=true;await local.salva();assert.equal(active.preset,'originale');
 fail=false;await local.salva();assert.equal(active.preset,'lavanda');
 const reboot=await c.creaArchivioAspetto(storage).carica();assert.equal(reboot.preferenza.preset,'lavanda');
 ctrl.ripristina();assert.equal(active.preset,'lavanda');await local.salva();assert.equal(active.preset,'originale');
});
test('annullare il draft non applica né scrive un tema',async()=>{
 let writes=0;const a=c.creaControlloreAspetto(c.creaArchivioAspetto({getItem:async()=>null,setItem:async()=>{writes++;}}));
 await a.carica();a.selezionaPreset('prugna');assert.equal(writes,0);
 assert.ok(screen.includes('Esci senza salvare'));assert.ok(screen.includes('onPress: onBack'));
});
test('animazioni identiche al commit precedente; stato attivo/inattivo conservato',()=>{
 const old=execFileSync('git',['show','7641fb865869f5a5cb8a6aea17d10e48cd761d0e:App.js'],{encoding:'utf8',maxBuffer:4*1024*1024});
 function animation(s){const a=s.indexOf('  const { width } = useWindowDimensions();');return s.slice(a,s.indexOf('  const titoloTurno =',a));}
 assert.equal(animation(app),animation(old));
 assert.ok(app.includes("paletteHome ? paletteHome.homeAccent : turnoInCorso ? '#6BFF8A' : '#5EEBFF'"));
 assert.ok(app.includes("turnoInCorso ? '● IN SERVIZIO' : '○ FUORI SERVIZIO'"));
 assert.ok(app.includes("color: '#42F56C'"));
});
test('nessuna modifica ai motori e Home esclusiva destinataria della palette',()=>{
 assert.equal((app.match(/<Screen homePalette=/g)||[]).length,1);
 assert.equal((app.match(/<HomeDigitalCore paletteHome=/g)||[]).length,1);
 assert.ok(app.includes('if (attivo && r.ok) setPreferenzaAspetto(r.preferenza)'));
 const old=execFileSync('git',['show','7641fb865869f5a5cb8a6aea17d10e48cd761d0e:App.js'],{encoding:'utf8',maxBuffer:4*1024*1024});
 function motore(s){return s.slice(s.indexOf('function calcolaStraordinariConfigurati('),s.indexOf('export default function App()'));}
 assert.ok(motore(old).length>0);
 assert.equal(motore(app),motore(old));
});
test('barra reale: originale invariato e contrasto almeno 3:1 per preset e tavolozze',()=>{
 const start=app.indexOf('AVANZ. {avanzamentoHomeV2}%');
 const bar=app.slice(start,app.indexOf("flexDirection: 'row'",start));
 assert.ok(start>=0);
 const track=bar.match(/backgroundColor: (coloreHome\(paletteHome, 'progressTrack', '#19264A'\))/);
 const fill=bar.match(/backgroundColor: (coloreHome\(paletteHome, 'progressFill', '#72FF45'\))/);
 assert.ok(track);assert.ok(fill);
 assert.ok(bar.includes('width: `${avanzamentoHomeV2}%`'));
 function verifica(preferenza){
  c.paletteHome=c.paletteHomeDaPreferenza(preferenza);
  const t=vm.runInContext(track[1],c),f=vm.runInContext(fill[1],c);
  assert.ok(c.rapportoContrasto(t,f)>=3,`${t} / ${f}`);
  if(c.paletteHome)assert.equal(f,c.paletteHome.accent);
  else {assert.equal(t,'#19264A');assert.equal(f,'#72FF45');}
 }
 for(const preset of vm.runInContext('PRESET_TEMI',c))verifica({...c.ripristinaAspetto(),preset:preset.id});
 for(const background of vm.runInContext('SFONDI_ASPETTO',c))
  for(const accent of vm.runInContext('ACCENTI_ASPETTO',c))verifica(c.personalizzaAspetto(c.ripristinaAspetto(),{background,accent}));
 // Anche colori validi esterni alla tavolozza con accento uguale alla superficie.
 verifica(c.personalizzaAspetto(c.ripristinaAspetto(),{background:'#777777',accent:'#777777'}));
});
