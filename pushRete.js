// Il timeout limita anche l'attesa del refresh Auth interno all'SDK.
export async function conTimeoutPush(azione,timeoutMs=15000) {
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1)throw Error('Timeout non valido');
  const controller=new AbortController();let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Richiesta push non confermata'));},timeoutMs);});
  try{return await Promise.race([Promise.resolve().then(()=>azione(controller.signal)),timeout]);}
  finally{clearTimeout(timer);}
}
