// Solo l'Edge Function costruisce la prova per SQL; il client deve fornire il segreto.
// Il segreto in chiaro non viene inoltrato come parametro PostgREST/PostgreSQL.
export async function preparaProvaSQL(input:Record<string,unknown>) {
  const actions=['stato','registra','rinnova','prepara_operazione','revoca','revoca_offline','revoca_intenzione'];
  const copy={...input};delete copy.credenziale_hash;
  if(actions.includes(input.azione as string)){
    if(typeof input.credenziale!=='string'||!/^[0-9a-f]{64}$/.test(input.credenziale))throw Error('prova_non_valida');
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input.credenziale)));
    copy.credenziale_hash=Array.from(digest,v=>v.toString(16).padStart(2,'0')).join('');
  }
  delete copy.credenziale;return copy;
}
