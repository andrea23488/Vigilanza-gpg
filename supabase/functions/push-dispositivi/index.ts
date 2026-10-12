// Candidato non distribuito. Nessun invio Expo; runtime disabilitato di default.
import { createClient } from 'npm:@supabase/supabase-js@2.112.3';
const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(status:number,code:string)=>new Response(JSON.stringify({errore:code}),{status,headers});
Deno.serve(async(req)=>{
  if(Deno.env.get('PUSH_REGISTRATION_ENABLED')!=='true')return reply(503,'servizio_disabilitato');
  if(req.method!=='POST')return reply(405,'metodo_non_valido');
  try {
    const bearer=req.headers.get('Authorization');if(!bearer?.startsWith('Bearer '))return reply(401,'sessione_non_valida');
    const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!key)return reply(503,'servizio_disabilitato');
    const token=bearer.slice(7),admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    // getUser da solo NON dimostra mancata revoca. Il JWT deve essere verificato
    // crittograficamente e la specifica sessione controllata dalla RPC atomica.
    const {data,error}=await admin.auth.getClaims(token);
    if(error||!data?.claims)return reply(401,'sessione_non_valida');
    const claims=data.claims;
    if(typeof claims.sub!=='string'||typeof claims.session_id!=='string'||claims.iss!==`${url}/auth/v1`
      ||claims.aud!=='authenticated'||typeof claims.exp!=='number'||claims.exp<=Date.now()/1000)return reply(401,'sessione_non_valida');
    const text=await req.text();if(text.length>4096)return reply(400,'input_non_valido');const input=JSON.parse(text);
    if(!input||typeof input!=='object'||!['stato','registra','revoca'].includes(input.azione))return reply(400,'input_non_valido');
    const {data:result,error:rpcError}=await admin.rpc('push_gestisci_dispositivo',{p_user:claims.sub,p_session:claims.session_id,p_input:input});
    if(rpcError)return reply(409,'operazione_non_confermata');
    return new Response(JSON.stringify(result),{status:200,headers});
  }catch{return reply(400,'operazione_non_confermata');}
});
