import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import http from 'node:http'; import https from 'node:https'; import net from 'node:net'; import tls from 'node:tls'; import dgram from 'node:dgram';
let tentativiRete=0;const ripristini:(()=>void)[]=[];
function vieta(obj:object,key:string){const o=obj as Record<string,unknown>,old=o[key];o[key]=()=>{tentativiRete++;throw Error('rete_vietata');};ripristini.push(()=>{o[key]=old;});}
vieta(globalThis,'fetch');for(const o of [http,https])for(const k of ['get','request'])vieta(o,k);
for(const k of ['connect','createConnection'])vieta(net,k);vieta(net.Socket.prototype,'connect');vieta(tls,'connect');vieta(dgram,'createSocket');syncBuiltinESMExports();
const a=await import('./adattatori.ts');
const {autorizzaEvento}=await import('./autorizzazione.ts');
const {elaboraConsegna}=await import('./elaborazione.ts');
const id='00000000-0000-0000-0000-000000000001',mittente='00000000-0000-0000-0000-000000000002',destinatario='00000000-0000-0000-0000-000000000003',device='00000000-0000-0000-0000-000000000004';
const rigaEvento={id,tipo:'messaggio_privato',messaggio_id:'9007199254740993',collegamento_id:null,mittente_id:mittente,destinatario_id:destinatario,created_at:'2026-10-11 10:00:00+00',expires_at:'2026-10-11T11:00:00Z',testo:'sintetico',expo_token:'non_reale',credenziale_hash:'sintetico'};
const rigaDevice={id:device,user_id:destinatario,piattaforma:'ios',attivo:true,binding_version:'1',expo_token:'non_reale',credenziale_hash:'sintetico',project_id:id};
const ctx={mittenteVerificatoId:mittente,destinatarioVerificatoId:destinatario,sorgenteEsiste:true,collegamentoAccettato:true,bloccoMittente:false,bloccoDestinatario:false,messaggioLetto:false,richiestaStato:'in_attesa',chatEnabled:true,collegamentiEnabled:true};
const bad={ok:false,codice:'input_non_valido'};
test('bigint esatti anche oltre MAX_SAFE_INTEGER, mai number',()=>{
 for(const v of ['0','1','9007199254740993','9223372036854775807'])assert.deepEqual(a.bigintIdDaSql(v),{ok:true,valore:v});
 for(const v of [1,9007199254740993,1n,null,undefined,'','01','-1','+1','1.0','1e3',' 1','9223372036854775808',[],{}])assert.deepEqual(a.bigintIdDaSql(v),bad);
 assert.deepEqual(a.adattaEvento({...rigaEvento,messaggio_id:9007199254740993}),bad);
});
test('date PostgreSQL: zone, leap year e precisione submillisecondo esplicita',()=>{
 const date=a.dataPostgresInMillisecondi('2026-10-11 12:00:00.123456+02');assert.deepEqual(date,{ok:true,valore:Date.UTC(2026,9,11,10,0,0,123)});
 assert.deepEqual(a.dataPostgresInMillisecondi('2026-10-11T10:00:00Z'),a.dataPostgresInMillisecondi('2026-10-11 12:00:00+0200'));
 assert.ok(a.dataPostgresInMillisecondi('2024-02-29T00:00:00Z').ok);
 assert.ok(a.dataPostgresInMillisecondi('9999-12-31T23:59:59Z').ok);
 for(const v of [null,undefined,0,new Date(),'infinity','-infinity','2026-02-29T00:00:00Z','2026-04-31T00:00:00Z','2026-00-01T00:00:00Z','2026-01-00T00:00:00Z','2026-01-01T24:00:00Z','2026-01-01T00:60:00Z','2026-01-01T00:00:60Z','2026-01-01T00:00:00','2026-01-01T00:00:00+14:01','2026-01-01T00:00:00.1234567Z','1969-12-31T23:59:59Z','10000-01-01T00:00:00Z'])assert.deepEqual(a.dataPostgresInMillisecondi(v),bad);
});
test('enum rigorosi, array oggetti e stringhe incapsulate rifiutati',()=>{
 for(const v of [null,undefined,1,[],{},['messaggio_privato'],new String('messaggio_privato'),'sconosciuto'])assert.deepEqual(a.adattaEvento({...rigaEvento,tipo:v}),bad);
 for(const v of [null,undefined,1,['ios'],{},new String('ios'),'web'])assert.deepEqual(a.adattaDispositivo({...rigaDevice,piattaforma:v}),bad);
 for(const v of [null,undefined,1,['in_attesa'],{},new String('in_attesa'),'sconosciuto'])assert.deepEqual(a.adattaContesto({...ctx,richiestaStato:v}),bad);
});
test('versioni valide e invalide, nessuna coercizione',()=>{
 for(const v of [1,'1',Number.MAX_SAFE_INTEGER,String(Number.MAX_SAFE_INTEGER)])assert.ok(a.versioneDaSql(v).ok);
 for(const v of [0,-1,1.5,NaN,Infinity,null,undefined,'01','1.0','9007199254740992',[],{}]){assert.deepEqual(a.versioneDaSql(v),bad);assert.deepEqual(a.adattaDispositivo({...rigaDevice,binding_version:v}),bad);}
});
test('campi mancanti, sorgenti incoerenti e scadenza collassata rifiutati',()=>{
 for(const fn of [a.adattaEvento,a.adattaDispositivo,a.adattaContesto])for(const input of [null,undefined,[],{},'sintetico'])assert.deepEqual(fn(input),bad);
 for(const key of ['id','tipo','messaggio_id','collegamento_id','mittente_id','destinatario_id','created_at','expires_at']){const input={...rigaEvento} as Record<string,unknown>;delete input[key];assert.deepEqual(a.adattaEvento(input),bad);}
 assert.deepEqual(a.adattaEvento({...rigaEvento,collegamento_id:'2'}),bad);
 assert.deepEqual(a.adattaEvento({...rigaEvento,destinatario_id:mittente}),bad);
 assert.deepEqual(a.adattaEvento({...rigaEvento,created_at:'2026-10-11T10:00:00.000001Z',expires_at:'2026-10-11T10:00:00.000999Z'}),bad);
 const getter=Object.defineProperty({},'id',{get(){throw Error('segreto_sintetico');}});assert.deepEqual(a.adattaEvento(getter),bad);
});
test('output minimi senza sensibili, immutabilita e richieste',()=>{
 const before=JSON.stringify(rigaEvento);const e=a.adattaEvento(rigaEvento);assert.ok(e.ok);assert.equal(e.valore.sorgenteId,'9007199254740993');
 assert.deepEqual(Object.keys(e.valore).sort(),['id','tipo','sorgenteId','mittenteId','destinatarioId','creatoAt','scadeAt'].sort());
 const d=a.adattaDispositivo(rigaDevice);assert.ok(d.ok);assert.deepEqual(Object.keys(d.valore).sort(),['id','utenteId','piattaforma','attivo','bindingVersion'].sort());
 assert.equal(JSON.stringify(rigaEvento),before);
 assert.ok(a.adattaEvento({...rigaEvento,tipo:'richiesta_collegamento',messaggio_id:null,collegamento_id:'9223372036854775807'}).ok);
 for(const result of [e,d,a.adattaEvento({...rigaEvento,tipo:'segreto_sintetico'})])assert.doesNotMatch(JSON.stringify(result),/expo_token|credenziale_hash|segreto_sintetico|non_reale|sintetico/);
});
test('consegne coerenti e versioni obsolete rifiutate; trasporto disabilitato',()=>{
 const e=a.adattaEvento(rigaEvento),d=a.adattaDispositivo(rigaDevice),c=a.adattaContesto(ctx);assert.ok(e.ok&&d.ok&&c.ok);
 const row={evento_id:id,dispositivo_id:device,destinatario_id:destinatario,binding_version:'1',expo_token:'non_reale'};
 const out=a.adattaConsegna(row,e.valore,d.valore);assert.ok(out.ok);
 assert.ok(autorizzaEvento(e.valore,c.valore,e.valore.creatoAt+1000));
 assert.equal(elaboraConsegna(out.valore,e.valore,d.valore,c.valore,e.valore.creatoAt+1000).inviata,false);
 for(const patch of [{destinatario_id:mittente},{evento_id:device},{dispositivo_id:id},{binding_version:'2'},{binding_version:null}])assert.deepEqual(a.adattaConsegna({...row,...patch},e.valore,d.valore),bad);
 assert.deepEqual(a.adattaConsegna(row,e.valore,{...d.valore,utenteId:mittente}),bad);
 assert.deepEqual(a.adattaConsegna(row,null,d.valore),bad);
 assert.deepEqual(a.adattaContesto({...ctx,chatEnabled:'true'}),bad);
});
test('Proxy, getter e ispezioni ostili restituiscono soltanto il rifiuto generico',()=>{
 const e=a.adattaEvento(rigaEvento),d=a.adattaDispositivo(rigaDevice);assert.ok(e.ok&&d.ok);
 const row={evento_id:id,dispositivo_id:device,destinatario_id:destinatario,binding_version:'1'};
 const casi: [object,(v:unknown)=>unknown][]=[
  [rigaEvento,a.adattaEvento],[rigaDevice,a.adattaDispositivo],[ctx,a.adattaContesto],
  [row,v=>a.adattaConsegna(v,e.valore,d.valore)],
  [e.valore,v=>a.adattaConsegna(row,v,d.valore)],
  [d.valore,v=>a.adattaConsegna(row,e.valore,v)],
 ];
 const lancia=()=>{throw Error('segreto_sintetico_proxy');};
 for(const [base,fn] of casi){
  const chiave=Object.keys(base)[0];
  const getter=Object.defineProperty({...base},chiave,{get:lancia});
  const revocabile=Proxy.revocable({...base},{});revocabile.revoke();
  const ostili=[getter,revocabile.proxy,
   new Proxy({...base},{get:lancia}),new Proxy({...base},{getPrototypeOf:lancia}),
   new Proxy({...base},{ownKeys:lancia}),new Proxy({...base},{getOwnPropertyDescriptor:lancia}),
   new Proxy(getter,{}),new Proxy({...base},{get(target,key){if(key===chiave)return lancia();return Reflect.get(target,key);}}),
  ];
  for(const v of ostili){const risultato=fn(v);assert.deepEqual(risultato,bad);assert.doesNotMatch(JSON.stringify(risultato),/segreto|stack|proxy/);}
 }
 // Le conversioni primitive non devono tentare coercizioni di oggetti ostili.
 const ostile=new Proxy({},{get:lancia});
 for(const fn of [a.bigintIdDaSql,a.versioneDaSql,a.dataPostgresInMillisecondi])assert.deepEqual(fn(ostile),bad);
 for(const fn of [a.tipoEventoValido,a.piattaformaValida,a.statoRichiestaValido])assert.equal(fn(ostile),false);
 assert.deepEqual(a.adattaConsegna(row,e.valore,{...d.valore,piattaforma:{toString:lancia}}),bad);
 assert.equal(tentativiRete,0);
});
test('nessuna API di rete o dipendenza esterna negli adattatori',()=>{
 const source=readFileSync(new URL('./adattatori.ts',import.meta.url),'utf8');assert.doesNotMatch(source,/\bfetch\s*\(|https?:\/\/|@supabase|expo-notifications|XMLHttpRequest|WebSocket/);
 for(const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g))assert.equal(match[1],'./modello.ts');
 assert.equal(tentativiRete,0);
});
after(()=>{try{assert.equal(tentativiRete,0);}finally{for(const r of ripristini.reverse())r();syncBuiltinESMExports();}});
