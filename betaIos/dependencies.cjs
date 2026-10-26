const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {EXCLUDED}=require('./identity.cjs');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function allows(value,list){if(!list)return true;const entries=Array.isArray(list)?list:[list];if(entries.length===1&&entries[0]==='any')return true;return !entries.includes('!'+value)&&(entries.every(v=>v.startsWith('!'))||entries.includes(value));}
function validateLock(pkg,lock,{os='darwin',cpu='arm64'}={}){
 if(pkg.vigilanzaIsolatedBeta!==true||pkg.name!=='vigilanza-gpg-isolated-beta')throw Error('BETA: manifest dipendenze non isolato');
 if(lock.lockfileVersion!==3||!lock.packages?.[''])throw Error('BETA: lockfile v3 completo obbligatorio');
 if(lock.name!==pkg.name||lock.version!==pkg.version)throw Error('BETA: identità del lockfile non coerente');
 const root=lock.packages[''];for(const field of ['dependencies','devDependencies','optionalDependencies','peerDependencies']){
  const a=pkg[field]||{},b=root[field]||{};if(JSON.stringify(Object.entries(a).sort())!==JSON.stringify(Object.entries(b).sort()))throw Error('BETA: lockfile non sincronizzato con '+field);
 }
 for(const name of Object.keys(pkg.dependencies||{}))if(!lock.packages['node_modules/'+name]||lock.packages['node_modules/'+name].version!==pkg.dependencies[name])throw Error('BETA: dipendenza diretta non bloccata alla versione prevista: '+name);
 let platformOptional=0;
 for(const [location,p]of Object.entries(lock.packages)){
  if(!location)continue;
  if(!location.startsWith('node_modules/')||location.split('/').some(v=>v==='..'||v==='.')||p.link)throw Error('BETA: lockfile contaminato da link o percorsi esterni: '+location);
  const name=location.slice(location.lastIndexOf('node_modules/')+'node_modules/'.length);
  if(name.startsWith('@expo/ngrok')||name.startsWith('@supabase/')||EXCLUDED.includes(name)||name==='@bacons/apple-targets')throw Error('BETA: dipendenza esclusa dal manifest isolato: '+name);
  if(typeof p.resolved!=='string'||!p.resolved.startsWith('https://registry.npmjs.org/')||!p.integrity)throw Error('BETA: dipendenza non riproducibile dal registro pubblico: '+name);
  const compatible=allows(os,p.os)&&allows(cpu,p.cpu)&&(!p.libc||os==='linux');
  if(!compatible&&!p.optional)throw Error('BETA: dipendenza obbligatoria incompatibile con '+os+'/'+cpu+': '+name);
  if((p.os||p.cpu||p.libc)&&p.optional)platformOptional++;
 }
 return{packages:Object.keys(lock.packages).length-1,platform:os+'/'+cpu,platformOptional};
}
function validateSource(){const root=__dirname;return validateLock(JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')),JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8')));}
function validateStage(root=path.dirname(__dirname)){
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));if(pkg.main!=='betaIos/index.js')throw Error('BETA: controllo stage riservato alla copia preparata');
 const result=validateLock(pkg,JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8')));
 const modules=path.join(root,'node_modules');if(fs.existsSync(modules)&&fs.lstatSync(modules).isSymbolicLink())throw Error('BETA: node_modules condiviso non consentito per installazione o build');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'SOURCE-MANIFEST.json'),'utf8'));if(!manifest['package-lock.json']||!manifest['package.json'])throw Error('BETA: manifest sorgenti privo delle dipendenze');
 for(const [file,expected]of Object.entries(manifest)){if(path.isAbsolute(file)||file.split('/').includes('..')||hash(path.join(root,file))!==expected)throw Error('BETA: copia alterata dopo la preparazione: '+file)}
 return result;
}
if(require.main===module){try{console.log(JSON.stringify(process.argv.includes('--stage')?validateStage():validateSource()))}catch(e){console.error(e.message);process.exitCode=1}}
module.exports={allows,validateLock,validateSource,validateStage};
