const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const c = { AsyncStorage: {} }; vm.createContext(c);
for (const file of ['temi.js', 'preferenzeAspetto.js']) vm.runInContext(
  fs.readFileSync(file, 'utf8').replace(/^import .*;\n/gm, '').replaceAll('export ', ''), c);
const presets = vm.runInContext('PRESET_TEMI', c);
const originale = vm.runInContext('PALETTE_ORIGINALE', c);
const plain = x => JSON.parse(JSON.stringify(x));
function storage() {
  let value = null;
  return { getItem: async () => value, setItem: async (_, v) => { value = v; }, raw: () => value };
}
test('originale identico ai colori correnti, default e sei preset immutabili', () => {
  assert.equal(presets.length, 6); assert.equal(new Set(presets.map(p => p.id)).size, 6);
  const app = fs.readFileSync('App.js', 'utf8');
  const legacy = vm.runInNewContext(app.slice(app.indexOf('const COLORS = {'), app.indexOf('const MESI =')) + '\nCOLORS');
  for (const [a,b] of Object.entries({background:'bg',surface:'card',border:'border',text:'white',textMuted:'muted',accent:'blue',success:'green',warning:'orange',error:'red'})) assert.equal(originale[a], legacy[b]);
  assert.equal(c.generaPalette(), originale);
  assert.equal(originale.homeAccent, '#5EEBFF'); assert.equal(originale.serviceActive, '#6BFF8A');
  assert.ok(Object.isFrozen(originale));
});
function contrasto(p) {
  for(const bg of [p.background,p.surface,p.surfaceRaised]) {
    assert.ok(c.rapportoContrasto(p.text,bg)>=4.5);
    assert.ok(c.rapportoContrasto(p.textMuted,bg)>=4.5);
  }
  assert.ok(c.rapportoContrasto(p.onAccent,p.accent)>=4.5);
}
test('contrasto dei sei preset e colori funzionali costanti', () => {
  for(const preset of presets) {
    const p=c.generaPalette({...c.ripristinaAspetto(),preset:preset.id}); contrasto(p);
    for(const k of ['success','warning','error','serviceActive']) assert.equal(p[k],originale[k]);
  }
  assert.equal(c.rapportoContrasto('#FFFFFF','#000000'),21);
});
test('sfondo e accento indipendenti: chiari, scuri e vicino alla soglia', () => {
  for(const bg of ['#FFFFFF','#000000','#777777','#808080','#ABCDEF']) {
    const pref=c.personalizzaAspetto(c.ripristinaAspetto(),{background:bg});
    assert.equal(pref.accent,null);
    const custom=c.personalizzaAspetto(pref,{accent:'#ff0000'});
    assert.equal(custom.background,bg); assert.equal(custom.accent,'#FF0000');
    contrasto(c.generaPalette(custom));
  }
  assert.throws(()=>c.validaColore('#FFF')); assert.throws(()=>c.selezionaPreset('ignoto'));
});
test('preferenze corrotte, versioni sconosciute e reset sicuro', () => {
  for(const input of [null,[],{version:2,preset:'originale'},{version:1,preset:'ignoto'},{version:1,preset:'originale',accent:'rosso'}]) assert.deepEqual(plain(c.normalizzaPreferenzaAspetto(input)),plain(c.ripristinaAspetto()));
  assert.equal(c.generaPalette({version:2}),originale);
});
test('persistenza, ricaricamento e reset solo sulla chiave dedicata', async () => {
  const s=storage(), a=c.creaArchivioAspetto(s);
  assert.equal((await a.salva(c.ripristinaAspetto())).errore,'caricamento_non_completato');
  assert.equal(s.raw(),null); await a.carica();
  const p=c.personalizzaAspetto({...c.ripristinaAspetto(),preset:'prugna'},{accent:'#123456'});
  assert.ok((await a.salva(p)).ok);
  assert.deepEqual(plain((await a.carica()).preferenza),plain(p));
  assert.deepEqual(plain((await c.creaArchivioAspetto(s).carica()).preferenza),plain(p));
  await a.ripristina(); assert.deepEqual(JSON.parse(s.raw()),plain(c.ripristinaAspetto()));
});
test('lettura pendente e fallita non consentono sovrascritture; retry', async () => {
  let release; let writes=0;
  const a=c.creaArchivioAspetto({getItem:()=>new Promise(r=>{release=r;}),setItem:async()=>{writes++;}});
  const loading=a.carica(); assert.equal((await a.ripristina()).ok,false); assert.equal(writes,0);
  release(null); await loading; assert.ok((await a.ripristina()).ok);
  let fail=true;
  const b=c.creaArchivioAspetto({getItem:async()=>{if(fail)throw Error('I/O');return null;},setItem:async()=>{writes++;}});
  assert.equal((await b.carica()).errore,'lettura'); assert.equal((await b.ripristina()).ok,false);
  fail=false; assert.ok((await b.carica()).ok);
});
test('JSON corrotto non riscritto automaticamente, errori scrittura e coda', async () => {
  let value='{rotto',fail=true;
  const a=c.creaArchivioAspetto({getItem:async()=>value,setItem:async(_,v)=>{if(fail)throw Error('I/O');value=v;}});
  assert.equal((await a.carica()).recuperata,true); assert.equal(value,'{rotto');
  assert.equal((await a.ripristina()).errore,'scrittura'); assert.equal(value,'{rotto');
  fail=false;
  await Promise.all([a.salva({...c.ripristinaAspetto(),preset:'grafite'}),a.salva({...c.ripristinaAspetto(),preset:'lavanda'})]);
  assert.equal(JSON.parse(value).preset,'lavanda');
  assert.equal((await a.salva({version:99})).errore,'validazione');
});
