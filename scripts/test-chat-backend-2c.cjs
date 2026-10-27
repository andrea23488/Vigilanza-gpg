// Solo lettura di file e modello in memoria: niente database, rete o subprocessi.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {ChatSpec}=require('../supabase/proposals/chat-personali-2c/reference-model.cjs');
const dir='supabase/proposals/chat-personali-2c/';
const sql=fs.readFileSync(dir+'020_letture_proposte.sql','utf8');
const prepared=fs.readFileSync(dir+'090_test_letture_preparato.sql','utf8');
const inventory=fs.readFileSync(dir+'000_inventory_readonly.sql','utf8');
const clean=s=>s.replace(/--[^\n]*/g,'');
const fixture=()=>{const m=new ChatSpec();m.send('A','B','1','messaggio A');m.send('B','A','2','storico B');return m;};
const apply=(m,action,id=action)=>m.apply('A','B',{id,action,expected:m.state('A','B').version});

test('statico: bozze non autoapplicabili, guard prima del DDL e nessuna mutazione dei messaggi',()=>{
 assert.ok(sql.indexOf('BOZZA_2C_NON_ESEGUIBILE')<sql.indexOf('CREATE SCHEMA'));
 assert.ok(prepared.indexOf('TEST_2C_NON_ESEGUIBILE')<prepared.indexOf('CREATE FUNCTION'));
 assert.doesNotMatch(clean(sql),/\b(?:UPDATE|DELETE\s+FROM|INSERT\s+INTO|ALTER\s+TABLE)\s+public\.messaggi\b/i);
 assert.doesNotMatch(clean(sql),/CREATE\s+OR\s+REPLACE|ALTER\s+PUBLICATION/i);
 assert.ok(!fs.existsSync('supabase/migrations/020_letture_proposte.sql'));
 assert.doesNotMatch(fs.readFileSync('App.js','utf8'),/chat_personale_(?:elenco|messaggi|non_letti)_v1|chat-personali-2c/);
});
test('statico: tre RPC invoker con snapshot stabile, search_path fisso e view che rispetta RLS',()=>{
 assert.equal((clean(sql).match(/SECURITY INVOKER SET search_path=''/g)||[]).length,3);
 assert.equal((clean(sql).match(/LANGUAGE plpgsql STABLE/g)||[]).length,3);
 assert.match(sql,/security_invoker=true, security_barrier=true/);
 assert.match(sql,/s\.user_id=\(SELECT auth\.uid\(\)\)/);
 assert.match(sql,/s\.user_id IN\(c\.utente_a,c\.utente_b\)/);
 assert.match(sql,/p\.posizione>s\.nascosti_fino_a/);
 assert.match(sql,/JOIN public\.messaggi m ON m\.id=p\.messaggio_id/);
 assert.doesNotMatch(clean(sql),/SECURITY DEFINER/);
 for(const name of ['non_letti','messaggi','elenco']){
  assert.match(sql,new RegExp('REVOKE ALL ON FUNCTION public\\.chat_personale_'+name+'_v1'));
  assert.match(sql,new RegExp('GRANT EXECUTE ON FUNCTION public\\.chat_personale_'+name+'_v1[^;]+TO authenticated'));
 }
});
test('statico: inventario limitato ai metadati e nessuna esecuzione di SQL in questo runner',()=>{
 assert.match(inventory,/BEGIN READ ONLY/);assert.match(inventory,/ROLLBACK/);
 assert.doesNotMatch(clean(inventory),/SELECT\s+\*|FROM\s+public\.messaggi|pg_get_functiondef|pg_get_triggerdef|\btgargs\b/i);
 assert.match(inventory,/md5\(p\.prosrc\)/);
 const own=fs.readFileSync(__filename,'utf8');
 assert.ok(!own.includes("require('node:"+'child_process'+"')"));
 assert.ok(!own.includes("require('"+'pg'+"')"));
});
test('modello: tutte le azioni di A lasciano intatti messaggi e stato personale di B',()=>{
 for(const action of ['svuota','elimina','archivia','ripristina','leggi']){
  const m=fixture(),c=m.conversation('A','B');const messages=JSON.stringify(c.messages),before=m.state('B','A');
  m.apply('A','B',{id:action,action,expected:m.state('A','B').version,read:action==='leggi'?'2':null});
  assert.deepEqual(m.state('B','A'),before);assert.equal(JSON.stringify(c.messages),messages);
  assert.equal(m.messages('B','A').length,2);
 }
});
test('modello: archivio recuperabile, non letti globali includono Archiviate e nessuna lettura implicita',()=>{
 const m=fixture();assert.deepEqual(m.unread('A'),{totale:'1',attive:'1',archiviate:'0'});
 apply(m,'archivia');assert.equal(m.list('A').length,0);assert.equal(m.list('A',true).length,1);
 assert.deepEqual(m.unread('A'),{totale:'1',attive:'0',archiviate:'1'});
 m.send('B','A','3','altro nuovo');assert.equal(m.list('A',true).length,1);assert.equal(m.unread('A').totale,'2');
 apply(m,'ripristina');assert.equal(m.list('A').length,1);assert.equal(m.list('A',true).length,0);
});
test('modello: svuota aggiorna vista, ricerca, anteprima e non letti senza alterare B',()=>{
 const m=fixture();apply(m,'svuota');assert.deepEqual(m.messages('A','B'),[]);
 assert.equal(m.list('A',false,'storico').length,0);assert.equal(m.unread('A').totale,'0');assert.equal(m.list('A').length,1);
 m.send('B','A','3','nuovo');assert.deepEqual(m.messages('A','B').map(x=>x.text),['nuovo']);
 assert.equal(m.messages('A','B',{search:'storico'}).length,0);assert.equal(m.unread('A').totale,'1');
});
test('modello: eliminata riaperta una sola volta, senza ripristinare storico dopo riconnessione',()=>{
 let m=fixture();apply(m,'elimina');assert.equal(m.list('A').length,0);assert.equal(m.list('A',true).length,0);
 m=new ChatSpec(m.snapshot());assert.equal(m.list('A').length,0);assert.equal(m.messages('B','A').length,2);
 m.send('B','A','3','riaperta');m=new ChatSpec(m.snapshot());
 assert.equal(m.list('A').length,1);assert.equal(m.messages('A','B').length,1);assert.equal(m.data.conversations.length,1);
 assert.deepEqual(m.messages('A','B').map(x=>x.id),['3']);
});
test('modello: stato e registro idempotente persistono in una nuova istanza',()=>{
 let m=fixture();const expected=m.state('A','B').version,request={id:'op',action:'svuota',expected};
 const reply=m.apply('A','B',request);m.send('B','A','3','nuovo');m=new ChatSpec(m.snapshot());
 const version=m.state('A','B').version;assert.deepEqual(m.apply('A','B',request),reply);
 assert.equal(m.state('A','B').version,version);assert.equal(m.messages('A','B').length,1);
 assert.throws(()=>m.apply('A','B',{...request,action:'elimina'}),e=>e.code==='22023');
});
test('modello: due intenti con la stessa versione e interleaving con messaggi non perdono dati',()=>{
 const m=fixture(),expected=m.state('A','B').version;
 m.apply('A','B',{id:'first',action:'archivia',expected});
 assert.throws(()=>m.apply('A','B',{id:'second',action:'elimina',expected}),e=>e.code==='40001');
 const stale=m.state('A','B').version;m.send('B','A','3','arrivato tra lettura e azione');
 assert.throws(()=>m.apply('A','B',{id:'clear-stale',action:'svuota',expected:stale}),e=>e.code==='40001');
 assert.equal(m.messages('A','B').length,3);assert.equal(m.data.conversations.length,1);
});
test('modello: pagine con cursore e versione non mescolano snapshot o duplicano messaggi',()=>{
 const m=fixture(),version=m.state('A','B').version;const one=m.messages('A','B',{limit:1,version});
 const two=m.messages('A','B',{limit:1,version,before:one[0].position});
 assert.deepEqual([...one,...two].map(x=>x.id),['2','1']);
 m.send('B','A','3','concorrenza');assert.throws(()=>m.messages('A','B',{before:one[0].position,version}),e=>e.code==='40001');
});
test('modello: lettura monotona, bigint oltre Number e conteggio globale oltre una pagina',()=>{
 const m=fixture();m.conversation('A','B').latest='9007199254740992';
 m.send('B','A','9007199254740993','precisione');assert.equal(m.messages('A','B')[0].position,'9007199254740993');
 const version=m.state('A','B').version;m.apply('A','B',{id:'read',action:'leggi',expected:version,read:'9007199254740993'});
 m.apply('A','B',{id:'older-read',action:'leggi',expected:m.state('A','B').version,read:'1'});
 assert.equal(m.state('A','B').read,'9007199254740993');assert.equal(m.unread('A').totale,'0');
 const many=new ChatSpec();for(let i=0;i<55;i++)many.send('B','A',String(i+1),'sintetico');assert.equal(many.unread('A').totale,'55');
});
test('modello: terzo utente e secondo account non ereditano confini o conversazioni di A',()=>{
 const m=fixture();apply(m,'svuota');assert.equal(m.messages('B','A').length,2);assert.equal(m.list('C').length,0);
 assert.throws(()=>m.apply('C','B',{id:'foreign',action:'elimina',expected:'1'}),e=>e.code==='42501');
 assert.deepEqual(m.unread('C'),{totale:'0',attive:'0',archiviate:'0'});
});


test('modello: ricevute legacy già lette non ricompaiono nel badge dopo archiviazione o riavvio',()=>{
 let m=fixture();m.conversation('A','B').messages.find(x=>x.id==='2').legacyRead=true;
 assert.equal(m.unread('A').totale,'0');apply(m,'archivia');m=new ChatSpec(m.snapshot());
 assert.equal(m.unread('A').archiviate,'0');m.send('B','A','3','nuovo non letto');
 assert.deepEqual(m.unread('A'),{totale:'1',attive:'0',archiviate:'1'});
 assert.equal(m.conversation('A','B').messages.find(x=>x.id==='2').legacyRead,true);
});
