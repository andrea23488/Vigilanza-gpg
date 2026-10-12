// Nessun segreto in AsyncStorage. Il provider sicuro viene iniettato dal runtime.
export const PUSH_PROJECT_ID = '3f83a3a9-df1a-4dcc-beaf-8c390f52eca2';
const uuid = v => typeof v === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
export function destinazionePush(data, userId) {
  if (!data || !uuid(userId) || data.destinatario_id !== userId || !uuid(data.evento_id)
    || !['messaggio_privato','consegna_servizio'].includes(data.tipo)) return null;
  return { eventoId:data.evento_id, tipo:data.tipo };
}
export function creaGestorePush({ notifiche, secureStorage, randomBytes, api, platform, projectId = PUSH_PROJECT_ID }) {
  let generation=0, session=null, binding=null, salvate=null;
  const assertCurrent=g=>{if(g!==generation || !session?.user?.id)throw new Error('Sessione push cambiata');};
  async function installation() {
    if(!secureStorage || !randomBytes)throw new Error('Archivio sicuro non disponibile: registrazione push disabilitata');
    const existing=await secureStorage.get('vigilanza.push.installation.v1');
    if(existing){const value=JSON.parse(existing);if(uuid(value.id)&&/^[0-9a-f]{64}$/.test(value.secret))return value;throw Error('Credenziale installazione non valida');}
    const bytes=await randomBytes(32);if(!(bytes instanceof Uint8Array)||bytes.length!==32)throw Error('Generatore sicuro non disponibile');
    const idBytes=await randomBytes(16);if(!(idBytes instanceof Uint8Array)||idBytes.length!==16)throw Error('Generatore sicuro non disponibile');
    idBytes[6]=(idBytes[6]&15)|64;idBytes[8]=(idBytes[8]&63)|128;
    const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');const h=hex(idBytes);
    const value={id:`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`,secret:hex(bytes)};
    await secureStorage.set('vigilanza.push.installation.v1',JSON.stringify(value));return value;
  }
  return {
    cambiaSessione(next, refresh=false){if(session?.user?.id===next?.user?.id&&session?.access_token===next?.access_token)return;
      const preserve=refresh&&session?.user?.id===next?.user?.id;
      generation++;session=next;if(!preserve){binding=null;salvate=null;}},
    stato(){return {pronto:Boolean(session),registrato:Boolean(binding),storageSicuro:Boolean(secureStorage&&randomBytes)};},
    async registra(preferenze,richiediPermesso=false){
      const g=generation,currentSession=session;assertCurrent(g);
      if(!['ios','android'].includes(platform))throw Error('Piattaforma non supportata');
      if(typeof preferenze?.chat!=='boolean'||typeof preferenze?.consegne!=='boolean')throw Error('Preferenze non valide');
      const i=await installation();assertCurrent(g);
      if(platform==='android')await notifiche.setNotificationChannelAsync('comunicazioni',{name:'Comunicazioni',importance:4});
      let p=await notifiche.getPermissionsAsync();assertCurrent(g);
      if(p.status!=='granted'&&richiediPermesso)p=await notifiche.requestPermissionsAsync();assertCurrent(g);
      if(p.status!=='granted')throw Error('Permesso notifiche non concesso');
      const status=await api('stato',{installation_id:i.id,credenziale:i.secret},currentSession.access_token);assertCurrent(g);
      if(typeof status?.binding_version!=='string'||!/^\d+$/.test(status.binding_version))throw Error('Versione associazione non verificata');
      const token=await notifiche.getExpoPushTokenAsync({projectId});assertCurrent(g);
      const result=await api('registra',{installation_id:i.id,credenziale:i.secret,expected_binding_version:status.binding_version,expo_token:token.data,piattaforma:platform,chat:preferenze.chat,consegne:preferenze.consegne},currentSession.access_token);
      if(g!==generation){if(uuid(result?.id))await api('revoca',{id:result.id,binding_version:result.binding_version,credenziale:i.secret},currentSession.access_token).catch(()=>{});assertCurrent(g);}
      if(!uuid(result?.id)||!/^\d+$/.test(result.binding_version))throw Error('Registrazione non confermata');
      binding=result;salvate={...preferenze};return {ok:true};
    },
    async rinnova(){if(!salvate||!binding)return {ok:false};return this.registra(salvate,false);},
    async revoca(){
      const oldSession=session,oldBinding=binding;generation++;binding=null;salvate=null;session=null;
      if(!oldBinding)return {ok:true};
      const i=await installation();
      await api('revoca',{id:oldBinding.id,binding_version:oldBinding.binding_version,credenziale:i.secret},oldSession.access_token);
      return {ok:true};
    },
  };
}
