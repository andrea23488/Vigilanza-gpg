// Source/archive preparation only. No EAS, signing, install, prebuild or network.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const parser=require('@babel/parser'),traverse=require('@babel/traverse').default;
const policy=require('./policy.cjs'),{EXCLUDED}=require('./identity.cjs');
const {validateSource,validateStage}=require('./dependencies.cjs');
function graph(){
 const queue=[path.join(__dirname,'index.js')],seen=new Set();
 while(queue.length){const file=queue.pop();if(seen.has(file))continue;policy.assertSource(file);seen.add(file);
  const ast=parser.parse(fs.readFileSync(file,'utf8'),{sourceType:'unambiguous',plugins:['jsx','typescript']}),names=[];
  traverse(ast,{ImportDeclaration(p){names.push(p.node.source.value)},ExportNamedDeclaration(p){if(p.node.source)names.push(p.node.source.value)},ExportAllDeclaration(p){names.push(p.node.source.value)},CallExpression(p){if(p.node.callee.name==='require'){if(p.node.arguments[0]?.type!=='StringLiteral')throw Error('BETA: require dinamico non consentito');names.push(p.node.arguments[0].value)}}});
  for(const name of names){policy.assertModule(name);const mapped=policy.substitution(file,name);if(mapped){queue.push(mapped);continue}if(!name.startsWith('.'))continue;
   const base=path.resolve(path.dirname(file),name),resolved=['','.js','.tsx','.ts','.cjs'].map(e=>base+e).find(f=>fs.existsSync(f)&&fs.statSync(f).isFile());if(!resolved)throw Error('BETA: import mancante '+name);queue.push(resolved);
  }
 }
 return [...seen];
}
function prepare(){
 validateSource();
 const files=graph(),destination=fs.mkdtempSync(path.join(os.tmpdir(),'vigilanza-beta-stage-')),manifest={};
 const copy=(source,relative)=>{if(!fs.lstatSync(source).isFile())throw Error('BETA: sorgente non regolare');const out=path.join(destination,relative);fs.mkdirSync(path.dirname(out),{recursive:true});const bytes=fs.readFileSync(source);fs.writeFileSync(out,bytes);manifest[relative]=crypto.createHash('sha256').update(bytes).digest('hex')};
 for(const file of files)copy(file,path.relative(policy.sharedRoot,file));
 for(const name of ['app.config.js','metro.config.js','babel.config.js','withBetaIos.cjs','policy.cjs','project.json','buildEnvironment.cjs','dependencies.cjs'])copy(path.join(__dirname,name),'betaIos/'+name);
 copy(path.join(policy.sharedRoot,'assets/icon.png'),'assets/icon.png');
 const pkg=JSON.parse(fs.readFileSync(path.join(__dirname,'package.json'),'utf8'));pkg.main='betaIos/index.js';pkg.scripts={'eas-build-pre-install':'node betaIos/dependencies.cjs --stage'};fs.writeFileSync(path.join(destination,'package.json'),JSON.stringify(pkg,null,2)+'\n');
 copy(path.join(__dirname,'package-lock.json'),'package-lock.json');
 fs.copyFileSync(path.join(__dirname,'eas.json'),path.join(destination,'eas.json'));
 for(const name of ['app.config.js','metro.config.js','babel.config.js'])fs.writeFileSync(path.join(destination,name),`module.exports=require('./betaIos/${name}');\n`);
 fs.writeFileSync(path.join(destination,'react-native.config.js'),'module.exports='+JSON.stringify({dependencies:Object.fromEntries(EXCLUDED.map(n=>[n,{platforms:{ios:null,android:null}}]))})+';\n');
 fs.writeFileSync(path.join(destination,'.easignore'),'node_modules/\n.git/\n.env*\n**/.env*\n*.p8\n*.p12\n*.mobileprovision\ncredentials.json\n');
 for(const f of fs.readdirSync(destination)){const full=path.join(destination,f);if(fs.statSync(full).isFile())manifest[f]=crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex')}
 fs.writeFileSync(path.join(destination,'SOURCE-MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');
 for(const [file,hash]of Object.entries(manifest))if(crypto.createHash('sha256').update(fs.readFileSync(path.join(destination,file))).digest('hex')!==hash)throw Error('BETA: copia non integra');
 validateStage(destination);
 return{destination,files:files.length,manifest};
}
if(require.main===module)console.log(JSON.stringify(prepare(),null,2));
module.exports={graph,prepare};
