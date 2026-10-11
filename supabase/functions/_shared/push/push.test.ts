import { test, after } from 'node:test';
import type { Evento, Contesto, Dispositivo } from './modello.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import dgram from 'node:dgram';
let rete = 0;
const ripristini: (() => void)[] = [];
function vieta(oggetto: object, nome: string) {
  const o = oggetto as Record<string, unknown>, originale = o[nome];
  o[nome] = () => { rete++; throw new Error('Rete vietata nei test push'); };
  ripristini.push(() => { o[nome] = originale; });
}
vieta(globalThis,'fetch');
for (const o of [http,https]) for (const n of ['request','get']) vieta(o,n);
for (const n of ['connect','createConnection']) vieta(net,n);
vieta(net.Socket.prototype,'connect');vieta(tls,'connect');vieta(dgram,'createSocket');
syncBuiltinESMExports();
// Import dopo le guardie: anche l'inizializzazione dei moduli è controllata.
const m = await import('./modello.ts');
const { autorizzaEvento } = await import('./autorizzazione.ts');
const { pianificaConsegne } = await import('./pianificazione.ts');
const { elaboraConsegna, simulaTentativo } = await import('./elaborazione.ts');
const { trasportoDisabilitato } = await import('./trasportoDisabilitato.ts');
const evento: Evento = {id:'evento_1',tipo:'messaggio_privato',sorgenteId:'sorgente_1',mittenteId:'utente_a',destinatarioId:'utente_b',creatoAt:100,scadeAt:100000};
const contesto: Contesto = {mittenteVerificatoId:'utente_a',destinatarioVerificatoId:'utente_b',sorgenteEsiste:true,collegamentoAccettato:true,bloccoMittente:false,bloccoDestinatario:false,messaggioLetto:false,richiestaStato:'in_attesa',chatEnabled:true,collegamentiEnabled:true};
const dispositivo: Dispositivo = {id:'dispositivo_1',utenteId:'utente_b',piattaforma:'ios',attivo:true,bindingVersion:1};
test('validazione rigorosa e assenza di contenuti privati',()=>{
 assert.ok(m.eventoValido(evento));assert.ok(m.dispositivoValido(dispositivo));
 for(const v of [null,{}, {...evento,testo:'contenuto sintetico'}, {...evento,destinatarioId:'utente_a'}, {...evento,scadeAt:100}, {...evento,creatoAt:NaN}]) assert.equal(m.eventoValido(v),false);
 for(const v of [null,{}, {...dispositivo,bindingVersion:0}, {...dispositivo,bindingVersion:1.5}, {...dispositivo,attivo:'true'}, {...dispositivo,token:'vietato'}]) assert.equal(m.dispositivoValido(v),false);
});
test('tipi evento malformati non sono convertiti né autorizzati come richieste',()=>{
 const permissivoRichieste={...contesto,collegamentoAccettato:false,messaggioLetto:true,chatEnabled:false};
 for(const tipo of [undefined,null,0,1,'','sconosciuto',['messaggio_privato'],['richiesta_collegamento'],{},new String('messaggio_privato'),{toString:()=> 'richiesta_collegamento'}]) {
  const e={...evento,tipo};
  assert.equal(m.eventoValido(e),false);
  for(const c of [contesto,permissivoRichieste]) {
   assert.doesNotThrow(()=>assert.equal(autorizzaEvento(e,c,200),false));
   assert.deepEqual(pianificaConsegne(e,c,[dispositivo],200),[]);
  }
 }
 assert.ok(m.eventoValido({...evento,tipo:'richiesta_collegamento'}));
});
test('array dispositivi sparsi, null e malformati sono rifiutati senza eccezioni',()=>{
 const primo=Array(3);primo[1]=dispositivo;primo[2]=dispositivo;
 const centro=Array(3);centro[0]=dispositivo;centro[2]=dispositivo;
 const ultimo=Array(3);ultimo[0]=dispositivo;ultimo[1]=dispositivo;
 const ereditato=Array(1);Object.setPrototypeOf(ereditato,{0:dispositivo});
 for(const input of [null,undefined,{},'dispositivi',Array(1),primo,centro,ultimo,ereditato,[null],[undefined],[{}],[dispositivo,null],[undefined,dispositivo]]) {
  assert.doesNotThrow(()=>assert.deepEqual(pianificaConsegne(evento,contesto,input,200),[]));
 }
 assert.equal(pianificaConsegne(evento,contesto,[dispositivo],200).length,1);
});
test('identità, blocchi bidirezionali e dati mancanti rifiutati',()=>{
 assert.ok(autorizzaEvento(evento,contesto,200));
 for(const patch of [{mittenteVerificatoId:'utente_c'},{destinatarioVerificatoId:'utente_c'},{bloccoMittente:true},{bloccoDestinatario:true},{sorgenteEsiste:false},{collegamentoAccettato:false},{messaggioLetto:true},{chatEnabled:false}]) assert.equal(autorizzaEvento(evento,{...contesto,...patch},200),false);
 for(const key of Object.keys(contesto)){const incompleto={...contesto} as Record<string,unknown>;delete incompleto[key];assert.equal(autorizzaEvento(evento,incompleto,200),false);}
 for(const now of [99,100000,NaN,-1]) assert.equal(autorizzaEvento(evento,contesto,now),false);
});
test('richieste pendenti e preferenze indipendenti',()=>{
 const richiesta={...evento,tipo:'richiesta_collegamento' as const};const c={...contesto,collegamentoAccettato:false,chatEnabled:false};
 assert.ok(autorizzaEvento(richiesta,c,200));
 for(const patch of [{richiestaStato:'accettato'},{richiestaStato:'rifiutato'},{collegamentiEnabled:false},{collegamentoAccettato:true}])assert.equal(autorizzaEvento(richiesta,{...c,...patch},200),false);
 assert.ok(autorizzaEvento(evento,{...contesto,collegamentiEnabled:false},200));
});
test('multidispositivo, deduplicazione, account e versioni ambigue',()=>{
 const input=[dispositivo,{...dispositivo,id:'dispositivo_2',piattaforma:'android' as const},dispositivo,{...dispositivo,id:'dispositivo_3',attivo:false},{...dispositivo,id:'dispositivo_4',utenteId:'utente_c'}];
 const snapshot=JSON.stringify(input);const out=pianificaConsegne(evento,contesto,input,200);
 assert.equal(out.length,2);assert.equal(JSON.stringify(input),snapshot);
 assert.deepEqual(pianificaConsegne(evento,contesto,input,200,out.map(c=>c.chiave)),[]);
 assert.deepEqual(pianificaConsegne(evento,contesto,[dispositivo,{...dispositivo,bindingVersion:2}],200),[]);
 assert.deepEqual(pianificaConsegne(evento,contesto,[{}],200),[]);
 assert.deepEqual(pianificaConsegne(evento,contesto,[],200),[]);
});
test('ricontrollo prima della consegna, logout e rinnovo token',()=>{
 const [c]=pianificaConsegne(evento,contesto,[dispositivo],200);
 assert.deepEqual(elaboraConsegna(c,evento,dispositivo,contesto,200),{stato:'invio_disabilitato',inviata:false});
 for(const d of [{...dispositivo,bindingVersion:2},{...dispositivo,utenteId:'utente_c'},{...dispositivo,attivo:false}])assert.equal(elaboraConsegna(c,evento,d,contesto,200).stato,'rifiutata');
 assert.equal(elaboraConsegna(c,evento,dispositivo,{...contesto,bloccoDestinatario:true},200).stato,'rifiutata');
 assert.equal(elaboraConsegna(c,evento,dispositivo,contesto,100000).stato,'rifiutata');
 assert.equal(elaboraConsegna({...c,chiave:'errata'},evento,dispositivo,contesto,200).stato,'rifiutata');
});
test('tentativi e errori soltanto simulati, limitati e mai inviati',()=>{
 assert.equal(simulaTentativo('transitorio',0,200,100000).stato,'retry_simulato');
 assert.equal(simulaTentativo('transitorio',4,200,100000).stato,'conclusa_simulata');
 assert.equal(simulaTentativo('transitorio',0,200,300).stato,'conclusa_simulata');
 assert.equal(simulaTentativo('permanente',0,200,100000).stato,'conclusa_simulata');
 assert.equal(simulaTentativo('token_non_valido',0,200,100000).stato,'token_da_disattivare_simulato');
 assert.equal(simulaTentativo('credenziali_non_valide',0,200,100000).stato,'sospesa_simulata');
 assert.equal(simulaTentativo('transitorio',-1,200,100000).stato,'rifiutata');
 for(const errore of ['transitorio','permanente','token_non_valido','credenziali_non_valide'] as const)assert.equal(simulaTentativo(errore,0,200,100000).inviata,false);
 assert.deepEqual(trasportoDisabilitato(),{stato:'invio_disabilitato',inviata:false});
});
test('isolamento: nessuna dipendenza o API di rete nel codice produttivo',()=>{
 for(const file of ['modello.ts','autorizzazione.ts','pianificazione.ts','elaborazione.ts','trasportoDisabilitato.ts']){
  const source=readFileSync(new URL(file,import.meta.url),'utf8');
  assert.doesNotMatch(source,/\bfetch\s*\(|https?:\/\/|@supabase|expo-notifications|XMLHttpRequest|WebSocket/);
  for(const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g))assert.ok(match[1].startsWith('./'));
 }
 assert.equal(rete,0);
});
after(()=>{try{assert.equal(rete,0,'Tentativi di rete rilevati');}finally{for(const r of ripristini.reverse())r();syncBuiltinESMExports();}});
