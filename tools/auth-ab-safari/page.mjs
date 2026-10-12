import {transport,createExperiment} from './core.mjs';
const get=id=>document.getElementById(id),actions=['login','refreshA','logoutA','checkA','refreshB'];let experiment,busy=false,controller,currentAction;
const show=message=>{get('result').textContent=message+(experiment?'\n'+JSON.stringify(experiment.snapshot(),null,2):'');};
function buttons(){if(experiment){const snap=experiment.snapshot();if(snap.A.claims&&snap.B.claims)get('query').textContent="SELECT clock_timestamp() AS osservato_at, id, user_id, created_at, not_after FROM auth.sessions WHERE id IN ('"+snap.A.claims.sessionId+"'::uuid, '"+snap.B.claims.sessionId+"'::uuid);";}actions.forEach((id,i)=>get(id).disabled=busy||(experiment?experiment.snapshot().phase!==i:i!==0));get('cleanup').disabled=!experiment;}
async function action(id){if(busy)return;busy=true;buttons();try{
 if(id==='login'){
  if(!get('private').checked||!window.isSecureContext||!crypto.subtle)throw Error('Contesto sicuro o porta privata non confermati');
  let apiKey=get('key').value,email=get('email').value,password=get('password').value;
  ['key','email','password'].forEach(id=>get(id).value='');if(!apiKey||!email||!password)throw Error('Credenziali TEST mancanti');
  controller=new AbortController();const raw=transport({enabled:true,apiKey});apiKey='';
  experiment=createExperiment((path,body,bearer)=>raw(path,body,bearer,path.endsWith('scope=local')?undefined:controller.signal));
  try{await experiment.login(email,password);}finally{email='';password='';}
 }else await experiment[id]();
 show(id==='checkA'?'JWT A ancora valido. Osservazioni SQL da revisionare, non certificate.':'Operazione completata; annotare evidenze e verificare in Dashboard.');
 }catch{controller?.abort();experiment?.interrupt();show('Prova fallita o inconcludente. Eseguire cleanup e verificare le sessioni in Dashboard.');}
 finally{busy=false;buttons();}
}
actions.forEach(id=>get(id).addEventListener('click',()=>{currentAction=action(id);}));
get('cleanup').addEventListener('click',async()=>{if(!experiment)return;controller?.abort();experiment.interrupt();get('cleanup').disabled=true;try{await currentAction;await experiment.cleanup();show('Cleanup terminato. Verificare entrambi gli esiti e le sessioni in Dashboard.');}finally{buttons();}});
window.addEventListener('pagehide',()=>{controller?.abort();experiment?.interrupt();});
window.addEventListener('beforeunload',e=>{if(experiment){e.preventDefault();e.returnValue='';}});
buttons();
