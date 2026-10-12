import {payloadGenericoPush} from './protocollo.ts';
type Outcome={kind:string;ticket?:string};
type Job={id:string;claim_id:string;mode:'send'|'receipt';ticket_id?:string};
export type WorkerPorts={claim:()=>Promise<Job|null>;authorize:(j:Job)=>Promise<any>;finish:(j:Job,o:Outcome)=>Promise<void>;send:(body:unknown)=>Promise<Outcome>;receipt:(ticket:string)=>Promise<Outcome>};
export async function eseguiWorker(ports:WorkerPorts,{enabled=false,limit=1}={}) {
  if(enabled!==true)return {processed:0,disabled:true};
  if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw Error('limite_non_valido');
  let processed=0;
  for(let i=0;i<limit;i++){
    const j=await ports.claim();if(!j)break;
    const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
    if(!uuid(j.id)||!uuid(j.claim_id))throw Error('job_non_valido');
    let outcome:Outcome;
    if(j.mode==='receipt'){
      if(typeof j.ticket_id!=='string'||!j.ticket_id)throw Error('ticket_non_valido');
      try{outcome=await ports.receipt(j.ticket_id);}catch{outcome={kind:'receipt_pending'};}
    }else if(j.mode==='send'){
      // Errori di autorizzazione fermano il worker prima di qualunque invio.
      const a=await ports.authorize(j);
      if(!a||!Number.isSafeInteger(a.expiration)||a.expiration<=Math.floor(Date.now()/1000)){outcome={kind:'cancelled'};}
      else {
        const p=payloadGenericoPush(a.tipo,a.evento_id,a.destinatario_id);
        if(typeof a.token!=='string'||a.token.length>512||! /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(a.token))throw Error('token_non_valido');
        try{outcome=await ports.send({to:a.token,...p,channelId:'comunicazioni',sound:'default',expiration:a.expiration});}
        catch{outcome={kind:'uncertain'};} // Un timeout puo' nascondere accettazione Expo: mai reinvio cieco.
      }
    }else throw Error('job_non_valido');
    await ports.finish(j,outcome);processed++;
  }
  return {processed,disabled:false};
}
const ENDPOINTS={send:'https://exp.host/--/api/v2/push/send',receipt:'https://exp.host/--/api/v2/push/getReceipts'};
const record=(v:any)=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function errorKind(value:any,receipt=false):Outcome {
  if(value?.details?.error==='DeviceNotRegistered')return {kind:'invalid_token'};
  if(!receipt&&value?.details?.error==='MessageRateExceeded')return {kind:'retry'};
  return {kind:receipt?'receipt_error':'failed'};
}
export function trasportoExpo({enabled=false,accessToken='',fetchImpl=globalThis.fetch}:{enabled?:boolean;accessToken?:string;fetchImpl?:typeof fetch}={}) {
  const request=async(mode:'send'|'receipt',body:unknown)=>{
    if(enabled!==true)throw Error('trasporto_disabilitato');
    try{
      const r=await fetchImpl(ENDPOINTS[mode],{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',Accept:'application/json',...(accessToken?{Authorization:`Bearer ${accessToken}`}:{})},body:JSON.stringify(body)});
      if(r.redirected||(r.url&&r.url!==ENDPOINTS[mode]))throw Error('redirect_non_valido');
      if(mode==='send'&&r.status===429)return {outcome:{kind:'retry'}};
      if(!r.ok){if(mode==='send'&&[400,401,403].includes(r.status))return {outcome:{kind:'failed'}};throw Error('risposta_non_valida');}
      const data=await r.json();if(!record(data))throw Error('risposta_non_valida');return {json:data};
    }catch{return {outcome:{kind:mode==='send'?'uncertain':'receipt_pending'}};}
  };
  return {
    async send(body:unknown):Promise<Outcome>{
      const r:any=await request('send',body);if(r.outcome)return r.outcome;
      const ticket=Array.isArray(r.json.data)?(r.json.data.length===1?r.json.data[0]:null):r.json.data;
      if(!record(ticket))return {kind:'uncertain'};
      if(ticket.status==='ok'&&typeof ticket.id==='string'&&ticket.id.length>0&&ticket.id.length<=512)return {kind:'ticket',ticket:ticket.id};
      if(ticket.status==='error')return errorKind(ticket);return {kind:'uncertain'};
    },
    async receipt(id:string):Promise<Outcome>{
      if(typeof id!=='string'||!id||id.length>512)throw Error('ticket_non_valido');
      const r:any=await request('receipt',{ids:[id]});if(r.outcome)return r.outcome;
      const value=record(r.json.data)&&Object.hasOwn(r.json.data,id)?r.json.data[id]:null;if(!record(value))return {kind:'receipt_pending'};
      if(value.status==='ok')return {kind:'receipt_ok'};
      if(value.status==='error')return errorKind(value,true);return {kind:'receipt_pending'};
    },
  };
}
