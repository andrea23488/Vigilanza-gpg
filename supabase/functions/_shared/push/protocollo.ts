const uuidPush=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
// Autorizzazione aggiuntiva: non modifica il motore storico o il trasporto disabilitato.
export type FontePush = {tipo:'messaggio_privato'|'consegna_servizio';id:string;mittenteId:string;destinatarioId:string;letta:boolean;esiste:boolean;scadeAt:number};
export function autorizzaFontePush(f:FontePush, c:{sessioneVerificata:boolean;collegamentoAccettato:boolean;bloccoMittente:boolean;bloccoDestinatario:boolean;chat:boolean;consegne:boolean}, now:number):boolean {
  return Number.isSafeInteger(now)&&now>=0&&f?.esiste===true&&f.letta===false
    && ['messaggio_privato','consegna_servizio'].includes(f.tipo)&&typeof f.id==='string'&&(/^(0|[1-9][0-9]*)$/.test(f.id)||uuidPush(f.id))
    && uuidPush(f.mittenteId)&&uuidPush(f.destinatarioId)&&f.mittenteId!==f.destinatarioId
    && Number.isSafeInteger(f.scadeAt)&&f.scadeAt>now&&c?.sessioneVerificata===true
    &&c.collegamentoAccettato===true&&c.bloccoMittente===false&&c.bloccoDestinatario===false
    && (f.tipo==='messaggio_privato'?c.chat===true:c.consegne===true);
}
export function payloadGenericoPush(tipo:FontePush['tipo'],eventoId:string,destinatarioId:string) {
  if(!['messaggio_privato','consegna_servizio'].includes(tipo)||!uuidPush(eventoId)||!uuidPush(destinatarioId))throw Error('tipo_non_valido');
  return {title:'Vigilanza GPG',body:tipo==='messaggio_privato'?'Hai un nuovo messaggio.':'Hai una nuova consegna di servizio.',data:{tipo,evento_id:eventoId,destinatario_id:destinatarioId}};
}
// Invii intenzionalmente impossibili in questo checkout; futuro worker separato.
export async function preparaInvioPush(f:FontePush,c:Parameters<typeof autorizzaFontePush>[1],now:number) {
  return {autorizzata:autorizzaFontePush(f,c,now),inviata:false,stato:'trasporto_disabilitato'} as const;
}
export function pianificaComunicazione(f:FontePush,c:Parameters<typeof autorizzaFontePush>[1],devices:unknown,now:number,esistenti:readonly string[]=[]) {
  if(!autorizzaFontePush(f,c,now)||!Array.isArray(devices)||!Array.isArray(esistenti)||esistenti.some(v=>typeof v!=='string'))return [];
  const result:{chiave:string;dispositivoId:string;bindingVersion:string}[]=[],seen=new Set(esistenti);
  const ids=new Set<string>();
  for(let i=0;i<devices.length;i++){
    if(!Object.hasOwn(devices,i))return [];
    const d=devices[i];
    if(!d||typeof d!=='object'||!uuidPush(d.id)||ids.has(d.id)||typeof d.bindingVersion!=='string'||!/^[1-9][0-9]{0,15}$/.test(d.bindingVersion)||BigInt(d.bindingVersion)>9007199254740991n)return [];
    ids.add(d.id);
    if(d.utenteId!==f.destinatarioId||d.attivo!==true||d.sessioneVerificata!==true||!Number.isSafeInteger(d.scadeAt)||d.scadeAt<=now)continue;
    const chiave=JSON.stringify([f.tipo,f.id,d.id]);if(seen.has(chiave))continue;
    seen.add(chiave);result.push({chiave,dispositivoId:d.id,bindingVersion:d.bindingVersion});
  }
  return result;
}
