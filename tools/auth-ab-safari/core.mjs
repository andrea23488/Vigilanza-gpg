export const ORIGIN='https://ilmhjsrxhnishnbocrnm.supabase.co';
const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const time=v=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=8640000000000;
const fail=()=>{throw Error('Verifica rifiutata');};
const decode=s=>{
 if(typeof s!=='string'||s.length>32768||! /^[A-Za-z0-9_-]+$/.test(s))fail();
 const bytes=Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 if(btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')!==s)fail();return bytes;
};
const json=s=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decode(s)));
export function allowed(path){
 const paths=['/auth/v1/.well-known/jwks.json','/auth/v1/token?grant_type=password','/auth/v1/token?grant_type=refresh_token','/auth/v1/logout?scope=local'];
 if(typeof path!=='string'||!paths.includes(path))fail();return ORIGIN+path;
}
export async function verifyJwt(token,jwks,now=Math.floor(Date.now()/1000)){
 try{
  if(!time(now)||typeof token!=='string'||token.length>65536||!obj(jwks)||!Array.isArray(jwks.keys))fail();
  const parts=token.split('.');if(parts.length!==3)fail();const h=json(parts[0]);
  if(!obj(h)||h.alg!=='ES256'||typeof h.kid!=='string'||!h.kid||h.crit!==undefined||h.b64!==undefined)fail();
  const matches=jwks.keys.filter(k=>obj(k)&&k.kid===h.kid);if(matches.length!==1)fail();const k=matches[0];
  if(k.kty!=='EC'||k.crv!=='P-256'||k.d!==undefined||(k.alg!==undefined&&k.alg!=='ES256')||(k.use!==undefined&&k.use!=='sig')||(k.key_ops!==undefined&&(!Array.isArray(k.key_ops)||k.key_ops.length!==1||k.key_ops[0]!=='verify'))||decode(k.x).length!==32||decode(k.y).length!==32)fail();
  const key=await crypto.subtle.importKey('jwk',k,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  const sig=decode(parts[2]);if(sig.length!==64||!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,sig,new TextEncoder().encode(parts[0]+'.'+parts[1])))fail();
  const p=json(parts[1]);if(!obj(p)||p.iss!==ORIGIN+'/auth/v1'||p.aud!=='authenticated'||p.role!=='authenticated'||typeof p.sub!=='string'||!uuid.test(p.sub)||typeof p.session_id!=='string'||!uuid.test(p.session_id)||!time(p.exp)||p.exp<=now||!time(p.iat)||p.iat>now||p.iat>=p.exp||(p.nbf!==undefined&&(!time(p.nbf)||p.nbf>now)))fail();
  return {userId:p.sub,sessionId:p.session_id,expiresAt:p.exp};
 }catch{fail();}
}
export function transport({enabled=false,apiKey='',fetchImpl=(...a)=>fetch(...a),timeoutMs=15000}={}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1)fail();
 return async(path,body,bearer,signal)=>{
  if(enabled!==true)fail();const url=allowed(path),controller=new AbortController();
  const stop=()=>controller.abort();signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted)stop();
  const timer=setTimeout(stop,timeoutMs);
  try{
   const r=await fetchImpl(url,{method:path.endsWith('jwks.json')?'GET':'POST',headers:{'Content-Type':'application/json',...(apiKey?{apikey:apiKey}:{}),...(bearer?{Authorization:'Bearer '+bearer}:{})},body:body===undefined?undefined:JSON.stringify(body),credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',redirect:'error',signal:controller.signal});
   if(!r.ok||r.redirected||(r.url&&r.url!==url))fail();
   const text=await r.text();if(text.length>262144)fail();return text?JSON.parse(text):null;
  }catch{throw Error('Richiesta non confermata');}finally{clearTimeout(timer);signal?.removeEventListener('abort',stop);}
 };
}
export function createExperiment(request,clock=()=>Math.floor(Date.now()/1000)){
 const sessions={A:{attempted:false,access:null,refresh:null,claims:null,cleanup:'non necessario'},B:{attempted:false,access:null,refresh:null,claims:null,cleanup:'non necessario'}};
 let keys,oldA,oldClaims,phase=0,interrupted=false;
 const guard=()=>{if(interrupted)throw Error('Prova interrotta');};
 async function accept(s,r,previous){
  // Conservare il bearer anche se il resto della risposta non supera la verifica: solo cleanup.
  if(obj(r)&&typeof r.access_token==='string'&&r.access_token.length<=65536&&r.access_token)s.access=r.access_token;
  if(!obj(r)||typeof r.refresh_token!=='string'||!r.refresh_token||r.refresh_token.length>65536||!s.access)fail();
  const claims=await verifyJwt(r.access_token,keys,clock());
  if(previous&&(claims.userId!==previous.userId||claims.sessionId!==previous.sessionId))fail();
  s.refresh=r.refresh_token;s.claims=claims;
 }
 async function logout(s){
  if(!s.attempted){s.cleanup='non necessario';return;}
  if(!s.access){if(s.cleanup!=='HTTP confermato — verificare in Dashboard')s.cleanup='sconosciuto';return;}
  try{await request('/auth/v1/logout?scope=local',undefined,s.access);s.cleanup='HTTP confermato — verificare in Dashboard';s.access=null;s.refresh=null;}
  catch{s.cleanup='fallito o effetto sconosciuto — verifica manuale obbligatoria';}
 }
 return {
  snapshot(){return {phase,interrupted,A:{claims:sessions.A.claims,cleanup:sessions.A.cleanup},B:{claims:sessions.B.claims,cleanup:sessions.B.cleanup}};},
  async login(email,password){
   guard();if(phase!==0)fail();phase=-1;keys=await request('/auth/v1/.well-known/jwks.json');
   for(const name of ['A','B']){guard();const s=sessions[name];s.attempted=true;s.cleanup='sconosciuto';await accept(s,await request('/auth/v1/token?grant_type=password',{email,password}));}
   guard();if(sessions.A.claims.userId!==sessions.B.claims.userId||sessions.A.claims.sessionId===sessions.B.claims.sessionId)fail();phase=1;
  },
  async refreshA(){guard();if(phase!==1)fail();const s=sessions.A;await accept(s,await request('/auth/v1/token?grant_type=refresh_token',{refresh_token:s.refresh}),s.claims);guard();phase=2;},
  async logoutA(){guard();if(phase!==2)fail();const s=sessions.A;oldA=s.access;oldClaims=await verifyJwt(oldA,keys,clock());await logout(s);guard();if(s.access)fail();phase=3;},
  async checkA(){guard();if(phase!==3)fail();try{const c=await verifyJwt(oldA,keys,clock());if(c.sessionId!==oldClaims.sessionId)fail();phase=4;}catch{throw Error('Prova inconcludente: JWT A scaduto o non verificabile');}},
  async refreshB(){guard();if(phase!==4)fail();await verifyJwt(oldA,keys,clock());const s=sessions.B;await accept(s,await request('/auth/v1/token?grant_type=refresh_token',{refresh_token:s.refresh}),s.claims);await verifyJwt(oldA,keys,clock());guard();phase=5;},
  async cleanup(){interrupted=true;await Promise.allSettled(Object.values(sessions).map(logout));oldA=null;oldClaims=null;keys=null;},
  interrupt(){interrupted=true;},
 };
}
