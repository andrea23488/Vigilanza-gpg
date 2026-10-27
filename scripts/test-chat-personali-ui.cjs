const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),babel=require('@babel/core');
const {execFileSync}=require('node:child_process');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function load(file,imports={},globals={}){
 const env={exports:{},require:k=>{assert.ok(k in imports,`Import non isolato ${k}`);return imports[k];},...globals};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,env,{filename:file});return env.exports;
}
const model=load('chatPersonaliUiModel.js'),themes=load('temi.js');
function hooks(){
 const states=[],refs=[],memos=[],deps=[];let slot=0,pending=[];
 const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 return{start(){slot=0;pending=[];},effects(){pending.forEach(f=>f());},react:{...React,
  useState:initial=>{const i=slot++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];},
  useRef:value=>{const i=slot++;return refs[i]||(refs[i]={current:value});},
  useMemo:(fn,d)=>{const i=slot++;if(!memos[i]||!equal(memos[i].deps,d))memos[i]={deps:d,value:fn()};return memos[i].value;},
  useEffect:(fn,d)=>{const i=slot++;if(!equal(deps[i],d)){deps[i]=d;pending.push(fn);}},
 }};
}
function renderRow(){
 const h=hooks(),nodes=[],calls=[];let clock=1000;
 const host=name=>({children,...props})=>{nodes.push({name,...props});return React.createElement('div',null,children);};
 const ui=load('ChatConversationActions.js',{
  react:h.react,'react-native':{View:host('View'),Text:host('Text'),Pressable:host('Pressable'),PanResponder:{create:panHandlers=>({panHandlers})}},
  './temi':themes,'./chatPersonaliUiModel':model,
 },{Date:{now:()=>clock}});
 const props={identity:model.chiaveConversazionePersonale('A','B'),onOpen:()=>calls.push('open'),children:'messaggio sintetico',style:{borderRadius:28}};
 const render=()=>{h.start();nodes.length=0;const html=renderToStaticMarkup(React.createElement(ui.default,props));h.effects();return html;};
 render();return{props,nodes,calls,ui,render,advance:()=>clock+=1000,find:id=>nodes.find(n=>n.testID===id)};
}
test('swipe orizzontale sinistro mostra tre operazioni disabilitate; il tap dopo swipe non apre la chat',()=>{
 const r=renderRow(),pan=r.find('chat-swipe-row');
 assert.equal(pan.onMoveShouldSetPanResponderCapture(null,{dx:-70,dy:2}),true);
 assert.equal(pan.onMoveShouldSetPanResponderCapture(null,{dx:-8,dy:80}),false);
 pan.onPanResponderGrant();pan.onPanResponderRelease(null,{dx:-70,dy:2});r.render();
 assert.ok(r.find('chat-personal-actions'));
 for(const label of ['Svuota chat','Elimina chat','Archivia chat']){
  const n=r.nodes.find(x=>x.accessibilityLabel===label);assert.ok(n,label);assert.equal(n.disabled,true);assert.equal(n.accessibilityState.disabled,true);assert.equal(n.onPress,undefined);
 }
 r.find('chat-open').onPress();assert.deepEqual(r.calls,[]);r.advance();r.find('chat-open').onPress();assert.deepEqual(r.calls,['open']);
 r.find('chat-swipe-row').onPanResponderRelease(null,{dx:70,dy:2});r.render();assert.equal(r.find('chat-personal-actions'),undefined);
});
test('gesto incompleto, verticale o annullato non apre operazioni e non produce mutazioni',()=>{
 for(const gesture of [{dx:-20,dy:0},{dx:-80,dy:100}]){
  const r=renderRow();r.find('chat-swipe-row').onPanResponderRelease(null,gesture);r.render();assert.equal(r.find('chat-personal-actions'),undefined);assert.equal(r.calls.length,0);
 }
 const r=renderRow();r.find('chat-swipe-row').onPanResponderTerminate();r.find('chat-open').onPress();assert.equal(r.calls.length,0);
});
test('alternativa accessibile e pressione lunga mostrano il blocco senza alcun comando distruttivo',()=>{
 const r=renderRow();r.nodes.find(n=>n.accessibilityLabel==='Azioni conversazione').onPress();assert.match(r.render(),/non è ancora disponibile in questa versione/);
 r.nodes.find(n=>n.accessibilityLabel==='Azioni conversazione').onPress();r.render();assert.equal(r.find('chat-personal-actions'),undefined);
 r.find('chat-open').onLongPress();r.render();assert.ok(r.find('chat-personal-actions'));assert.equal(r.calls.length,0);
});
test('doppio account e nuova istanza non ereditano il pannello azioni o stati personali inventati',()=>{
 const r=renderRow();r.find('chat-open').onLongPress();r.render();assert.ok(r.find('chat-personal-actions'));
 r.props.identity=model.chiaveConversazionePersonale('B','A');r.render();r.render();assert.equal(r.find('chat-personal-actions'),undefined);
 assert.equal(renderRow().find('chat-personal-actions'),undefined);
 assert.notEqual(model.chiaveConversazionePersonale('A','B'),model.chiaveConversazionePersonale('B','A'));
});
test('stessa controparte mantiene una sola card anche con nuovi riepiloghi, senza modificare input o messaggi',()=>{
 const one=Object.freeze({id:1,altro_user_id:'B'}),two=Object.freeze({id:2,altro_user_id:'B'});
 const input=Object.freeze([one,two,{altro_user_id:'A'},{altro_user_id:'C'},{}]);
 assert.deepEqual(Array.from(model.conversazioniUniche(input,'A'),c=>c.altro_user_id),['B','C']);
 assert.equal(model.conversazioniUniche(input,'A')[0],one);assert.equal(input.length,5);
 assert.equal(model.chiaveConversazionePersonale('A','B'),model.chiaveConversazionePersonale('A','B'));
});
test('il vecchio export Elimina conversazione rifiuta senza auth, letture, DELETE o altre chiamate di rete',async()=>{
 const calls=[];const supabase=new Proxy({},{get(_target,key){calls.push(key);throw Error('Accesso backend vietato nel test');}});
 const api=load('chatApi.js',{'./supabase':{supabase}});
 const result=await Promise.allSettled([api.eliminaConversazione('B'),api.eliminaConversazione('A')]);
 assert.ok(result.every(x=>x.status==='rejected'&&x.reason.code==='CHAT_PERSONALI_NON_DISPONIBILI'));assert.deepEqual(calls,[]);
});
const app=fs.readFileSync('App.js','utf8');
function branches(source){const ast=babel.parseSync(source,{babelrc:false,configFile:false,parserOpts:{plugins:['jsx']}});return ast.program.body.find(n=>n.type==='ExportDefaultDeclaration').declaration.body.body;}
function branch(source,screen){const n=branches(source).find(n=>n.type==='IfStatement'&&new RegExp("screen\\s*===\\s*'"+screen+"'").test(source.slice(n.test.start,n.test.end)));assert.ok(n,screen);return source.slice(n.start,n.end);}
function flat(node,out=[]){if(!node||typeof node!=='object')return out;if(Array.isArray(node)){node.forEach(n=>flat(n,out));return out;}out.push(node);flat(node.props?.children,out);return out;}
test('integrazione reale: un solo ramo chat, card unica per coppia/account, apertura originale e navigazione Archiviate',()=>{
 assert.equal(app.match(/if \(screen === 'listaChat'\)/g).length,1);assert.doesNotMatch(app,/eliminaConversazione/);
 const calls=[],colleague={id:'relation',altro_user_id:'B',profilo:{nome:'Sintetico'}};
 const env={screen:'listaChat',utenteAutenticato:{id:'A'},colleghi:[colleague,{...colleague,id:'duplicate'}],riepilogoChat:{B:{ultimoMessaggio:'Messaggio sintetico',nonLetti:2}},origineSocial:true,paletteHome:themes.PALETTE_ORIGINALE,
  ...model,coloreStileTema:(_p,c)=>c,coloreHome:themes.coloreHome,
  setCollegaSelezionato:c=>calls.push(c),setChatMessaggio:x=>calls.push(x),setScreen:x=>{calls.push(x);env.screen=x;},
  React:{createElement:(type,props,...children)=>({type,props:{...props,children}})},
  ...Object.fromEntries(['Screen','Back','Text','View','TouchableOpacity','Image','Ionicons','ChatConversationActions','ChatArchivedContent'].map(n=>[n,n]))};
 vm.createContext(env);
 const compiled=ts.transpileModule('function render(){'+branch(app,'chatArchiviate')+branch(app,'listaChat')+'}',{compilerOptions:{jsx:ts.JsxEmit.React}}).outputText;
 vm.runInContext(compiled,env);let nodes=flat(env.render());const cards=nodes.filter(n=>n.type==='ChatConversationActions');assert.equal(cards.length,1);
 assert.equal(cards[0].props.identity,model.chiaveConversazionePersonale('A','B'));cards[0].props.onOpen();assert.deepEqual(calls.slice(-3),[colleague,'','chatCollega']);
 env.screen='listaChat';nodes=flat(env.render());nodes.find(n=>n.props?.accessibilityLabel==='Apri Archiviate').props.onPress();assert.equal(env.screen,'chatArchiviate');
 nodes=flat(env.render());assert.ok(nodes.some(n=>n.type==='ChatArchivedContent'));nodes.find(n=>n.type==='Back').props.onPress();assert.equal(env.screen,'listaChat');
 env.utenteAutenticato={id:'B'};env.colleghi=[{id:'inverse',altro_user_id:'A',profilo:{nome:'Altro sintetico'}}];
 assert.equal(flat(env.render()).find(n=>n.type==='ChatConversationActions').props.key,model.chiaveConversazionePersonale('B','A'));
});
test('API messaggi, Realtime, letture e notifiche rimangono identiche al riferimento f76ab4d',()=>{
 const before=execFileSync('git',['show','f76ab4d:chatApi.js'],{encoding:'utf8'}),after=fs.readFileSync('chatApi.js','utf8');
 const exported=source=>{const ast=babel.parseSync(source,{babelrc:false,configFile:false});return new Map(ast.program.body.filter(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.type==='FunctionDeclaration').map(n=>[n.declaration.id.name,source.slice(n.declaration.start,n.declaration.end)]));};
 const old=exported(before),current=exported(after);for(const [name,code] of old)if(name!=='eliminaConversazione')assert.equal(current.get(name),code,name);
 const original=execFileSync('git',['show','f76ab4d:App.js'],{encoding:'utf8',maxBuffer:4*1024*1024});
 assert.equal(branch(app,'home'),branch(original,'home'));assert.equal(branch(app,'chatCollega'),branch(original,'chatCollega'));
 for(const f of ['pushNotifications.js','HomeScreen.js','turniRapidiOperazioni.js','stipendioCalcoli.js','giochiMultiplayerApi.js'])assert.equal(fs.readFileSync(f,'utf8'),execFileSync('git',['show','f76ab4d:'+f],{encoding:'utf8'}),f);
});


test('back Android di Archiviate torna alla lista senza modifiche ai dati',()=>{
 let handler,destination,removed=false;
 const env={Platform:{OS:'android'},OFFLINE_TEST:false,accessoTest:true,biometriaInizializzata:true,biometriaAbilitata:false,biometriaSbloccata:true,screen:'chatArchiviate',origineSocial:true,ritornoListaTurni:'home',useEffect:fn=>{env.cleanup=fn();},setScreen:value=>destination=value,BackHandler:{addEventListener:(_,fn)=>{handler=fn;return{remove:()=>removed=true};}}};
 const a=app.indexOf('  // Solo le destinazioni principali della Home:'),b=app.indexOf('\n\n  useEffect',a);vm.runInNewContext(app.slice(a,b),env);
 assert.equal(handler(),true);assert.equal(destination,'listaChat');env.cleanup();assert.equal(removed,true);
});
