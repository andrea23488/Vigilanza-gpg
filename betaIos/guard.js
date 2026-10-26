let installed=false;
export function installBetaGuard(target=globalThis) {
 if(installed)return;
 const deny=()=>{throw Error('BETA OFFLINE: operazione di rete disabilitata.');};
 for(const [name,value]of [['fetch',()=>Promise.reject(Error('BETA OFFLINE: rete disabilitata.'))],['XMLHttpRequest',deny],['WebSocket',deny],['EventSource',deny]])Object.defineProperty(target,name,{value,writable:false,configurable:false});
 installed=true;
}
