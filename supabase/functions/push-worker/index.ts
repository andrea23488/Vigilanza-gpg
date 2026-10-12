import {createClient} from 'npm:@supabase/supabase-js@2.112.3';
import {eseguiWorker,trasportoExpo} from '../_shared/push/worker.ts';
const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
async function sameSecret(a:string,b:string){
 const encode=new TextEncoder(),h=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',encode.encode(s)));
 const x=await h(a),y=await h(b);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0;
}
Deno.serve(async req=>{
 if(Deno.env.get('PUSH_TRANSPORT_ENABLED')!=='true')return new Response('{"disabled":true}',{status:503,headers});
 const secret=Deno.env.get('PUSH_WORKER_SECRET')||'',auth=req.headers.get('Authorization')||'';
 if(req.method!=='POST'||secret.length<32||auth.length>512||!await sameSecret(auth,`Bearer ${secret}`))return new Response('{"error":"unauthorized"}',{status:401,headers});
 try{
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!key)throw Error('config');
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const rpc=async(name:string,args={})=>{const {data,error}=await db.rpc(name,args);if(error)throw Error('rpc');return data;};
  const transport=trasportoExpo({enabled:true,accessToken:Deno.env.get('EXPO_ACCESS_TOKEN')||''});
  const result=await eseguiWorker({claim:()=>rpc('push_worker_claim'),authorize:j=>rpc('push_worker_authorize',{p_job:j.id,p_claim:j.claim_id}),
   finish:async(j,o)=>{await rpc('push_worker_finish',{p_job:j.id,p_claim:j.claim_id,p_outcome:o});},send:transport.send,receipt:transport.receipt},{enabled:true,limit:1});
  return new Response(JSON.stringify(result),{headers});
 }catch{return new Response('{"error":"worker_interrotto"}',{status:503,headers});}
});
