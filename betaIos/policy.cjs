const path=require('node:path');
const betaRoot=__dirname,sharedRoot=path.dirname(betaRoot);
const SHARED=['HomeScreen.js','HomeArtwork.js','ElectricConnections.js','homeElectric.js','homeModel.js','turniRapidiAnteprima.js','turniCalcoli.js','calendarioVista.js','SocialScreen.tsx','socialOptions.ts','SettingsScreen.tsx','settingsOptions.ts','ColleghiSocialScreen.js','TurniCondivisiView.js','turniCondivisiModel.js','AspettoColoriScreen.js','AppearanceScreen.tsx','preferenzeAspetto.js','temaSchermate.js','temi.js','ThemeScenery.tsx','ThemeEffects.tsx','ThemeScene.tsx','ThemeGlyphs.tsx','themeDecorationsModel.js'];
const OWN=['BetaApp.js','CalendarScreen.js','rapidOperations.js','fixtures.js','identity.cjs','guard.js','index.js','native.js','storage.js','sharedShiftStub.js'];
const BLOCKED=['@supabase/supabase-js','expo-notifications','react-native-watch-connectivity','expo-local-authentication','expo-dev-client','expo-updates','expo-file-system','expo-image-picker','expo-document-picker','expo-sharing','expo-web-browser'];
function assertModule(name){if(BLOCKED.some(n=>name===n||name.startsWith(n+'/')))throw Error('BETA: modulo vietato '+name)}
function assertSource(file){const p=path.resolve(file);if(!SHARED.some(n=>p===path.join(sharedRoot,n))&&!OWN.some(n=>p===path.join(betaRoot,n)))throw Error('BETA: file fuori perimetro '+path.basename(file));}
function substitution(origin,name){
 const p=path.resolve(path.dirname(origin),name).replace(/\.js$/,'');
 if(name.startsWith('.')&&p===path.join(sharedRoot,'turniCondivisiApi'))return path.join(betaRoot,'sharedShiftStub.js');
 const own=OWN.some(n=>origin===path.join(betaRoot,n)),shared=SHARED.some(n=>origin===path.join(sharedRoot,n));
 if((own||shared)&&name==='react-native'&&!['native.js','index.js'].includes(path.basename(origin)))return path.join(betaRoot,'native.js');
 if(shared&&name==='@react-native-async-storage/async-storage')return path.join(betaRoot,'storage.js');
 return null;
}
module.exports={SHARED,OWN,BLOCKED,betaRoot,sharedRoot,assertModule,assertSource,substitution};
