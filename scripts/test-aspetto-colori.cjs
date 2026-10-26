const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {test}=require('node:test');
const source=fs.readFileSync('AspettoColoriScreen.js','utf8');
const c={AsyncStorage:{}};vm.createContext(c);
for(const f of ['temi.js','preferenzeAspetto.js']) vm.runInContext(fs.readFileSync(f,'utf8').replace(/^import .*;\n/gm,'').replaceAll('export ',''),c);
vm.runInContext(source.slice(source.indexOf('export const SFONDI_ASPETTO'),source.indexOf('function Scelta(')).replaceAll('export ',''),c);
function fixture(){let value=null,writes=0,failRead=false,failWrite=false;const storage={getItem:async()=>{if(failRead)throw Error('read');return value;},setItem:async(_,v)=>{if(failWrite)throw Error('write');writes++;value=v;}};return {controller:()=>c.creaControlloreAspetto(c.creaArchivioAspetto(storage)),value:()=>value,writes:()=>writes,failRead:v=>failRead=v,failWrite:v=>failWrite=v};}
test('sei preset selezionabili, anteprima e nessun salvataggio implicito',async()=>{const f=fixture(),a=f.controller();await a.carica();for(const p of vm.runInContext('PRESET_TEMI',c)){assert.ok(a.selezionaPreset(p.id));assert.equal(a.stato().draft.preset,p.id);assert.equal(c.generaPalette(a.stato().draft).background,p.background);}assert.equal(f.writes(),0);assert.throws(()=>a.selezionaPreset('ignoto'));});
test('tavolozze indipendenti, contrasto e anteprima immediata',async()=>{const a=fixture().controller();await a.carica();a.personalizza({background:'#FFFFFF'});a.personalizza({accent:'#FDA4AF'});assert.equal(a.stato().draft.background,'#FFFFFF');assert.equal(a.stato().draft.accent,'#FDA4AF');const p=c.generaPalette(a.stato().draft);assert.ok(c.rapportoContrasto(p.text,p.background)>=4.5);assert.ok(c.rapportoContrasto(p.onAccent,p.accent)>=4.5);});
test('salvataggio esplicito, riapertura e reset esplicito',async()=>{const f=fixture(),a=f.controller();await a.carica();a.selezionaPreset('prugna');assert.ok(a.stato().modificato);await a.salva();assert.equal(a.stato().modificato,false);const b=f.controller();await b.carica();assert.equal(b.stato().draft.preset,'prugna');b.ripristina();assert.equal(JSON.parse(f.value()).preset,'prugna');assert.ok(b.stato().modificato);await b.salva();assert.equal(JSON.parse(f.value()).preset,'originale');});
test('lettura fallita e caricamento iniziale impediscono modifiche e scritture',async()=>{const f=fixture(),a=f.controller();assert.equal(a.personalizza({accent:'#FFFFFF'}),false);assert.equal((await a.salva()).ok,false);f.failRead(true);assert.equal((await a.carica()).ok,false);assert.equal(a.selezionaPreset('prugna'),false);assert.equal(f.writes(),0);f.failRead(false);await a.carica();assert.ok(a.stato().pronto);});
test('errore scrittura conserva il draft per riprovare',async()=>{const f=fixture(),a=f.controller();await a.carica();a.selezionaPreset('grafite');f.failWrite(true);assert.equal((await a.salva()).ok,false);assert.equal(a.stato().draft.preset,'grafite');assert.ok(a.stato().modificato);f.failWrite(false);assert.ok((await a.salva()).ok);});
test('salvataggio pendente blocca cambi e doppio invio',async()=>{let done;const a=c.creaControlloreAspetto({carica:async()=>({ok:true,preferenza:c.ripristinaAspetto()}),salva:p=>new Promise(r=>{done=()=>r({ok:true,preferenza:p});})});await a.carica();a.selezionaPreset('lavanda');const pending=a.salva();assert.equal(a.ripristina(),false);assert.equal((await a.salva()).ok,false);done();await pending;assert.equal(a.stato().draft.preset,'lavanda');});
test('editor originale raggiungibile da Profilo e Impostazioni, con archivio e anteprima esistenti',()=>{
 const app=fs.readFileSync('App.js','utf8');
 const babel=require('@babel/core');
 const a=app.indexOf("  if (screen === 'aspettoColori') {"), b=app.indexOf("\n  if (",a+1);
 const code=babel.transformSync(`function render(){${app.slice(a,b)}}`,{babelrc:false,configFile:false,plugins:['@babel/plugin-transform-react-jsx']}).code;
 for(const origin of ['profile','impostazioni']){
  let destination;
  const env={screen:'aspettoColori',ritornoAspetto:origin,AspettoColoriScreen:'original-editor',React:{createElement:(type,props)=>({type,props})},setScreen:value=>destination=value,archivioAspettoRef:{current:{}},setPreferenzaAspetto:()=>{},paletteHome:null};
  vm.createContext(env);vm.runInContext(code,env);const view=env.render();assert.equal(view.type,'original-editor');assert.equal(view.props.archivio,env.archivioAspettoRef.current);view.props.onBack();assert.equal(destination,origin);
 }
 assert.ok(source.includes('<Anteprima palette={palette} />'));assert.ok(source.includes('Modifiche non salvate'));
 assert.ok(!app.includes('ThemeProvider'));
});
