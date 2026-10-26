const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),React=require('react'),ts=require('typescript'),{renderToStaticMarkup}=require('react-dom/server');
const root=__dirname;
function load(name,imports){const c={exports:{},require:key=>{assert.ok(key in imports,key);return imports[key]}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,name),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,c);return c.exports;}
test('anteprima interattiva: otto selezioni vive, Home reale disabilitata e ritorno',()=>{
 const themes=load('../temi.js',{}),nodes=[];let preference={version:1,preset:'natale',background:null,accent:null},back=0,home,page,energy;
 const host=tag=>props=>{nodes.push({tag,...props});return React.createElement('div',null,props.children)};
 const scene=load('InteractiveThemePreview.tsx',{
  react:React,'react-native':Object.fromEntries(['Pressable','ScrollView','Switch','Text','View'].map(n=>[n,host(n)])),
  'react-native-safe-area-context':{SafeAreaProvider:host('SafeAreaProvider'),SafeAreaView:host('SafeAreaView')},
  '../ThemeScenery':()=>null, '../HomeScreen':props=>{home=props;return null},'../temi':themes,
  '../ThemeEffects':{ThemeEffectsProvider:host('ThemeEffectsProvider'),useThemeDecorationPage:(...args)=>page=args,useThemeEffects:()=>({energy:false,ready:true,busy:false,setEnergy:async v=>energy=v})},
 });
 const draw=()=>{nodes.length=0;renderToStaticMarkup(React.createElement(scene.default,{preference,onPreference:v=>preference=v,onBack:()=>back++,data:{profilo:{nome:'DEMO'},turni:[]}}))};
 draw();assert.equal(nodes.filter(n=>n.tag==='ThemeEffectsProvider').length,1);
 for(const theme of themes.TEMI_SPECIALI){const buttons=nodes.filter(n=>n.accessibilityState);const button=buttons.find(n=>n.children.props.children===theme.nome);assert.ok(button,theme.id);button.onPress();draw();assert.equal(page[0].preset,theme.id);assert.equal(page[1],'home');assert.equal(page[2],true);assert.equal(home.paletteHome.background,theme.background);assert.equal(home.profilo.nome,'DEMO');assert.equal(nodes.find(n=>n.testID==='interactive-theme-home').pointerEvents,'none');assert.equal(nodes.filter(n=>n.accessibilityState?.selected).length,1)}
 nodes.find(n=>n.tag==='Switch').onValueChange(true);assert.equal(energy,true);nodes.find(n=>n.accessibilityLabel==='Torna a Aspetto e colori').onPress();assert.equal(back,1);
 for(const key of ['onProfile','onNotifications','onSocial','onSettings','onCalendar','onNavigate','onColleghi','onAddShift'])assert.equal(home[key](),undefined);
});
test('Metro isola anche l’archivio degli effetti condivisi',()=>{
 const config=require('./metro.config.js'),policy=require('./isolation.cjs'),base=path.resolve(root,'..');
 for(const f of ['ThemeEffects.tsx','ThemeScene.tsx','ThemeGlyphs.tsx','themeDecorationsModel.js'])policy.assertFileAllowed(path.join(base,f));
 const mapped=config.resolver.resolveRequest({originModulePath:path.join(base,'ThemeEffects.tsx')},'@react-native-async-storage/async-storage','web');assert.equal(mapped.filePath,path.join(root,'previewStorage.js'));
 const src=fs.readFileSync(path.join(root,'InteractiveThemePreview.tsx'),'utf8');assert.doesNotMatch(src,/fetch\(|supabase|App\.js|ThemeDecorations|setInterval/);
 assert.match(fs.readFileSync(path.join(root,'HomeDemo.tsx'),'utf8'),/decorations=\{!appearancePreview\}/);
});
