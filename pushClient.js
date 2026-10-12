export const PUSH_PROJECT_ID = '3f83a3a9-df1a-4dcc-beaf-8c390f52eca2';
const uuid = v => typeof v === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
const version = v => typeof v==='string' && /^[1-9][0-9]{0,15}$/.test(v) && BigInt(v)<=9007199254740991n;
const LEGACY_KEYS={installation:'vigilanza.push.installation.v1',binding:'vigilanza.push.binding.v1',pending:'vigilanza.push.revoche.v1',intents:'vigilanza.push.intenzioni.v1'};
export function destinazionePush(data,userId) {
  if(!data||!uuid(userId)||data.destinatario_id!==userId||!uuid(data.evento_id)||!['messaggio_privato','consegna_servizio'].includes(data.tipo))return null;
  return {eventoId:data.evento_id,tipo:data.tipo};
}
export function creaGestorePush({notifiche,secureStorage,randomBytes,api,platform,projectId=PUSH_PROJECT_ID,enabled=false,namespace=null}) {
  enabled=enabled===true&&['ios','android'].includes(platform);
  if(namespace!==null&&(typeof namespace!=='string'||!/^[A-Za-z0-9_.-]{1,128}$/.test(namespace)))throw Error('Ambiente push non valido');
  const KEYS=namespace?Object.fromEntries(Object.entries(LEGACY_KEYS).map(([k,v])=>[k,v.replace('vigilanza.push.',`vigilanza.push.${namespace}.`)])):LEGACY_KEYS;
  let generation=0,session=null,binding=null,salvate=null,loaded=false,busy=false,installationPromise=null;
  const unpersisted=new Map();
  let storageQueue=Promise.resolve();
  const serial=fn=>{const p=storageQueue.then(fn);storageQueue=p.catch(()=>{});return p;};
  const assertCurrent=g=>{if(g!==generation||!session?.user?.id)throw Error('Sessione push cambiata');};
  const assertEnabled=()=>{if(!enabled||!['ios','android'].includes(platform)||!secureStorage||!randomBytes)throw Error('Registrazione push disabilitata');};
  const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
  async function installation() {
    assertEnabled();
    if(!installationPromise)installationPromise=serial(async()=>{
      const raw=await secureStorage.get(KEYS.installation);
      if(raw){const v=JSON.parse(raw);if(uuid(v.id)&&/^[0-9a-f]{64}$/.test(v.secret))return v;throw Error('Credenziale installazione non valida');}
      const bytes=await randomBytes(32),ids=await randomBytes(16);
      if(!(bytes instanceof Uint8Array)||bytes.length!==32||!(ids instanceof Uint8Array)||ids.length!==16)throw Error('Generatore sicuro non disponibile');
      ids[6]=(ids[6]&15)|64;ids[8]=(ids[8]&63)|128;const h=hex(ids);
      const v={id:`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`,secret:hex(bytes)};
      await secureStorage.set(KEYS.installation,JSON.stringify(v));return v;
    }).catch(e=>{installationPromise=null;throw e;});
    return installationPromise;
  }
  async function pending() {
    const raw=await secureStorage.get(KEYS.pending),v=raw?JSON.parse(raw):[];
    if(!Array.isArray(v)||v.length>100)throw Error('Revoche locali non valide');
    for(let n=0;n<v.length;n++)if(!Object.hasOwn(v,n)||!uuid(v[n]?.id)||!version(v[n]?.binding_version))throw Error('Revoca locale non valida');
    return v;
  }
  async function enqueue(b) {
    if(!uuid(b?.id)||!version(b?.binding_version))throw Error('Binding non valido');
    await serial(async()=>{
      const list=await pending();
      if(!list.some(v=>v.id===b.id&&v.binding_version===b.binding_version))list.push({id:b.id,binding_version:b.binding_version});
      if(list.length>100)throw Error('Troppe revoche pendenti');
      await secureStorage.set(KEYS.pending,JSON.stringify(list));
    });
  }
  async function intents() {
    const raw=await secureStorage.get(KEYS.intents),v=raw?JSON.parse(raw):[];
    if(!Array.isArray(v)||v.length>100)throw Error('Intenzioni non valide');
    for(let n=0;n<v.length;n++)if(!Object.hasOwn(v,n)||!uuid(v[n]?.operation_id)||!uuid(v[n]?.installation_id))throw Error('Intenzione non valida');
    return v;
  }
  async function removeIntent(op) {
    await serial(async()=>{const list=await intents();await secureStorage.set(KEYS.intents,JSON.stringify(list.filter(v=>v.operation_id!==op)));});
  }
  async function clearBinding(b) {
    await serial(async()=>{const raw=await secureStorage.get(KEYS.binding),old=raw?JSON.parse(raw):null;if(old?.id===b.id&&old?.binding_version===b.binding_version)await secureStorage.set(KEYS.binding,'null');});
  }
  async function reconcile() {
    assertEnabled();const i=await installation();
    for(const [key,b] of unpersisted){await enqueue(b);unpersisted.delete(key);await clearBinding(b);}
    const raw=await serial(()=>secureStorage.get(KEYS.binding)),old=raw?JSON.parse(raw):null;
    if(old&&old.userId!==session?.user?.id){await enqueue(old);await clearBinding(old);}
    for(const intent of await serial(intents)){
      const r=await api('revoca_intenzione',{...intent,credenziale:i.secret},undefined);
      if(r?.revocata!==true)throw Error('Intenzione non riconciliata');
      await removeIntent(intent.operation_id);
    }
    const list=await serial(pending);
    for(const b of list){
      const r=await api('revoca_offline',{...b,credenziale:i.secret},undefined);
      if(r?.revocata!==true)throw Error('Revoca non confermata');
      await serial(async()=>{const latest=await pending();await secureStorage.set(KEYS.pending,JSON.stringify(latest.filter(v=>v.id!==b.id||v.binding_version!==b.binding_version)));});
    }
    return {ok:true};
  }
  return {
    cambiaSessione(next,refresh=false){
      if(session?.user?.id===next?.user?.id&&session?.access_token===next?.access_token)return;
      const preserve=refresh&&session?.user?.id===next?.user?.id;
      const old=binding;if(!preserve)generation++;session=next;
      if(!preserve){binding=null;salvate=null;loaded=false;
        if(enabled&&old){const key=JSON.stringify([old.id,old.binding_version]);unpersisted.set(key,old);enqueue(old).then(()=>{unpersisted.delete(key);return clearBinding(old);}).catch(()=>{});}
      }
    },
    stato(){return {pronto:loaded&&Boolean(session),caricato:loaded,registrato:Boolean(binding),abilitato:enabled,storageSicuro:Boolean(secureStorage&&randomBytes),preferenze:salvate?{...salvate}:null};},
    async carica(){
      assertEnabled();if(busy){if(loaded&&salvate)return {...salvate};throw Error('Operazione push in corso');}const g=generation,current=session;assertCurrent(g);
      await reconcile();assertCurrent(g);
      const r=await api('preferenze',{},current.access_token);assertCurrent(g);
      if(typeof r?.chat!=='boolean'||typeof r?.consegne!=='boolean')throw Error('Preferenze non confermate');
      const i=await installation();assertCurrent(g);
      const status=await api('stato',{installation_id:i.id,credenziale:i.secret},current.access_token);assertCurrent(g);
      if(uuid(status?.id)&&version(status?.binding_version)&&status.rinnovo_consentito===true&&status.stessa_sessione===true){
        binding={id:status.id,binding_version:status.binding_version,renewNeeded:status.rinnovo_necessario===true};
        await serial(()=>secureStorage.set(KEYS.binding,JSON.stringify({...binding,userId:current.user.id})));assertCurrent(g);
      }else binding=null;
      salvate={chat:r.chat,consegne:r.consegne};loaded=true;return {...salvate};
    },
    riconcilia:reconcile,
    async registra(preferenze,richiediPermesso=false,salvaPreferenze=true,tokenRotation=false){
      assertEnabled();if(busy)throw Error('Operazione push in corso');busy=true;
      const g=generation,current=session;
      try {
        assertCurrent(g);if(!loaded)throw Error('Preferenze non caricate');
        if(typeof preferenze?.chat!=='boolean'||typeof preferenze?.consegne!=='boolean')throw Error('Preferenze non valide');
        await reconcile();assertCurrent(g);
        if(!preferenze.chat&&!preferenze.consegne){
          const r=await api('salva_preferenze',{chat:false,consegne:false},current.access_token);assertCurrent(g);
          if(r?.chat!==false||r?.consegne!==false)throw Error('Preferenze non confermate');
          salvate={chat:false,consegne:false};return {ok:true};
        }
        const i=await installation();assertCurrent(g);
        if(platform==='android')await notifiche.setNotificationChannelAsync('comunicazioni',{name:'Comunicazioni',importance:4});
        let p=await notifiche.getPermissionsAsync();assertCurrent(g);
        if(p.status!=='granted'&&richiediPermesso)p=await notifiche.requestPermissionsAsync();assertCurrent(g);
        if(p.status!=='granted'){const old=binding;binding=null;if(old){await enqueue(old);await clearBinding(old);await reconcile().catch(()=>{});}throw Error('Permesso notifiche non concesso');}
        const status=await api('stato',{installation_id:i.id,credenziale:i.secret},current.access_token);assertCurrent(g);
        if(typeof status?.binding_version!=='string'||!/^(0|[1-9][0-9]{0,15})$/.test(status.binding_version))throw Error('Versione non valida');
        const token=await notifiche.getExpoPushTokenAsync({projectId});assertCurrent(g);
        const bytes=await randomBytes(16);if(!(bytes instanceof Uint8Array)||bytes.length!==16)throw Error('Generatore sicuro non disponibile');
        bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const h=hex(bytes);
        const operation_id=`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
        await serial(async()=>{const list=await intents();list.push({operation_id,installation_id:i.id});if(list.length>100)throw Error('Troppe intenzioni');await secureStorage.set(KEYS.intents,JSON.stringify(list));});
        assertCurrent(g);
        const prepared=await api('prepara_operazione',{installation_id:i.id,operation_id,credenziale:i.secret},current.access_token);assertCurrent(g);
        if(prepared?.preparata!==true)throw Error('Operazione non preparata');
        const r=await api(salvaPreferenze?'registra':'rinnova',{operation_id,token_rotation:tokenRotation,installation_id:i.id,credenziale:i.secret,expected_binding_version:status.binding_version,expo_token:token.data,piattaforma:platform,chat:preferenze.chat,consegne:preferenze.consegne},current.access_token);
        if(!uuid(r?.id)||!version(r?.binding_version))throw Error('Registrazione non confermata');
        if(g!==generation){await enqueue(r);await reconcile().catch(()=>{});assertCurrent(g);}
        await serial(()=>secureStorage.set(KEYS.binding,JSON.stringify({id:r.id,binding_version:r.binding_version,userId:current.user.id})));
        if(g!==generation){await enqueue(r);assertCurrent(g);}
        await removeIntent(operation_id);
        if(g!==generation){await enqueue(r);await reconcile().catch(()=>{});assertCurrent(g);}
        binding={id:r.id,binding_version:r.binding_version};salvate={...preferenze};return {ok:true};
      } finally {busy=false;}
    },
    async rinnova(force=false){if(busy)return {ok:false};await this.carica();if(!salvate||!binding||(!salvate.chat&&!salvate.consegne)||(!force&&!binding.renewNeeded))return {ok:false};return this.registra(salvate,false,false,force);},
    async revoca(){
      const old=binding,userId=session?.user?.id;generation++;binding=null;salvate=null;loaded=false;session=null;
      if(!enabled)return {ok:true};
      let b=old;
      const raw=await serial(()=>secureStorage.get(KEYS.binding));
      if(raw){const v=JSON.parse(raw);if(v?.userId===userId){if(b&&b.binding_version!==v.binding_version)await enqueue(b);b=v;}}
      if(!b){try{await reconcile();return {ok:true};}catch{return {ok:false,pendente:true};}}
      await enqueue(b); // Persistenza prima della rete: logout offline recuperabile.
      await clearBinding(b);
      try {await reconcile();return {ok:true};}catch{return {ok:false,pendente:true};}
    },
  };
}
