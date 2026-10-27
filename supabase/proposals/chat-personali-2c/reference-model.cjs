// Modello di specifica in memoria. NON è un client/API/database e non è importato dall'app.
const clone=value=>JSON.parse(JSON.stringify(value));
const error=code=>Object.assign(new Error(code),{code});
class ChatSpec {
 constructor(snapshot){this.data=snapshot?JSON.parse(snapshot):{conversations:[],receipts:[]};}
 snapshot(){return JSON.stringify(this.data);}
 pair(a,b){if(!a||!b||a===b)throw error('42501');return JSON.stringify([a,b].sort());}
 conversation(a,b){return this.data.conversations.find(c=>c.id===this.pair(a,b));}
 send(a,b,id,text){
  if(typeof id!=='string'||!/^\d+$/.test(id))throw error('22023');
  const key=this.pair(a,b);let c=this.conversation(a,b);
  if(this.data.conversations.some(v=>v.messages.some(m=>m.id===id)))throw error('23505');
  if(!c){c={id:key,peers:[a,b].sort(),latest:'0',messages:[],states:{}};this.data.conversations.push(c);}
  c.latest=(BigInt(c.latest)+1n).toString();
  c.messages.push({id:String(id),position:c.latest,from:a,to:b,text,legacyRead:false});
  for(const u of c.peers){
   const s=c.states[u];if(!s)c.states[u]={state:'active',hidden:'0',read:'0',version:'1'};
   else{s.version=(BigInt(s.version)+1n).toString();if(s.state==='deleted')s.state='active';}
  }
 }
 state(a,b){const c=this.conversation(a,b);if(!c)throw error('42501');return clone(c.states[a]);}
 apply(a,b,{id,action,expected,read=null}){
  const c=this.conversation(a,b);if(!c)throw error('42501');
  if(!id||!['svuota','elimina','archivia','ripristina','leggi'].includes(action))throw error('22023');
  const request={conversation:c.id,action,expected:String(expected),read};
  const receipt=this.data.receipts.find(r=>r.user===a&&r.id===id);
  if(receipt){if(JSON.stringify(request)!==JSON.stringify(receipt.request))throw error('22023');return clone(receipt.result);}
  const s=c.states[a];if(s.version!==String(expected))throw error('40001');
  if(s.state==='deleted'&&action!=='elimina')throw error('22023');
  if(action==='leggi'&&(read===null||BigInt(read)<0n||BigInt(read)>BigInt(c.latest)))throw error('22023');
  if(action!=='leggi'&&read!==null)throw error('22023');
  if(action==='svuota'||action==='elimina')s.hidden=c.latest;
  if(action==='elimina')s.state='deleted';
  if(action==='archivia')s.state='archived';
  if(action==='ripristina')s.state='active';
  if(action==='leggi'&&BigInt(read)>BigInt(s.read))s.read=String(read);
  s.version=(BigInt(s.version)+1n).toString();
  const result=this.state(a,b);this.data.receipts.push({user:a,id,request,result:clone(result)});return result;
 }
 messages(a,b,{search='',before=null,limit=50,version=null}={}){
  const c=this.conversation(a,b);if(!c)throw error('42501');const s=c.states[a];
  if(version!==null&&String(version)!==s.version)throw error('40001');
  if(s.state==='deleted')return[];
  return clone(c.messages.filter(m=>BigInt(m.position)>BigInt(s.hidden)&&(!before||BigInt(m.position)<BigInt(before))&&m.text.toLowerCase().includes(search.trim().toLowerCase()))
   .sort((x,y)=>BigInt(x.position)>BigInt(y.position)?-1:1).slice(0,limit)
   .map(m=>({...m,unread:m.to===a&&BigInt(m.position)>BigInt(s.read)&&!m.legacyRead})));
 }
 list(a,archived=false,search=''){
  return this.data.conversations.filter(c=>c.peers.includes(a)&&c.states[a].state===(archived?'archived':'active'))
   .filter(c=>!search.trim()||this.messages(a,c.peers.find(p=>p!==a),{search}).length)
   .map(c=>({id:c.id,state:c.states[a].state,version:c.states[a].version}));
 }
 unread(a){
  let active=0n,archived=0n;
  for(const c of this.data.conversations.filter(c=>c.peers.includes(a))){
   const n=BigInt(this.messages(a,c.peers.find(p=>p!==a),{limit:Number.MAX_SAFE_INTEGER}).filter(m=>m.unread).length);
   if(c.states[a].state==='active')active+=n;if(c.states[a].state==='archived')archived+=n;
  }
  return{totale:(active+archived).toString(),attive:active.toString(),archiviate:archived.toString()};
 }
}
module.exports={ChatSpec};
