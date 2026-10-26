import React,{useEffect,useRef,useState} from 'react';
import {Alert,AppState,Pressable,ScrollView,Text,View} from 'react-native';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import HomeScreen from '../HomeScreen';
import CalendarScreen from './CalendarScreen';
import SocialScreen from '../SocialScreen';
import SettingsScreen from '../SettingsScreen';
import ColleghiSocialScreen from '../ColleghiSocialScreen';
import TurniCondivisiView from '../TurniCondivisiView';
import AspettoColoriScreen from '../AspettoColoriScreen';
import ThemeScenery from '../ThemeScenery';
import {ThemeEffectsProvider,useThemeDecorationPage} from '../ThemeEffects';
import {creaArchivioAspetto} from '../preferenzeAspetto';
import {generaPalette,ripristinaAspetto} from '../temi';
import {aggiungiGiorni,lunediDellaSettimana} from '../turniCondivisiModel';
import storage from './storage';
import { prepareRapidInsert, prepareRapidDelete, commitRapidProposal, undoRapidOperation } from './rapidOperations';
import {createFixtures,monthSummary,sharedFixtures} from './fixtures';
const info=title=>Alert.alert(title,'BETA OFFLINE · Funzione remota disabilitata. Nessun dato salvato o inviato.');
export function BetaContent() {
 const [screen,setScreen]=useState('home'),[preference,setPreference]=useState(ripristinaAspetto),[data,setData]=useState(createFixtures);
 const recordsRef=useRef(null),operationId=useRef(0);if(!recordsRef.current)recordsRef.current=data.records;
 const [lastRapidOperation,setLastRapidOperation]=useState(null);
 const [today,setToday]=useState(()=>new Date()),[date,setDate]=useState(()=>new Date()),[month,setMonth]=useState(()=>new Date()),[shared,setShared]=useState(()=>new Date());
 const [active,setActive]=useState(AppState.currentState==='active');
 const archive=useRef(null);if(!archive.current)archive.current=creaArchivioAspetto(storage);
 useEffect(()=>{let live=true;archive.current.carica().then(r=>{if(live&&r.ok)setPreference(r.preferenza)});return()=>{live=false}},[]);
 useEffect(()=>{const sub=AppState.addEventListener('change',s=>{setActive(s==='active');if(s==='active')setToday(new Date())});return()=>sub.remove()},[]);
 useEffect(()=>{if(!active)return;const timer=setInterval(()=>setToday(new Date()),30000);return()=>clearInterval(timer)},[active]);
 useThemeDecorationPage(preference,screen,true);
 const palette=generaPalette(preference),summary=monthSummary(data.records,month.getFullYear(),month.getMonth()),homeSummary=monthSummary(data.records,today.getFullYear(),today.getMonth());
 const goto=id=>{if(id==='calendarioColleghi'){setShared(new Date());setScreen(id)}else if(id==='aspettoColori')setScreen(id);else if(['home','calendar','social','impostazioni','strumenti','stipendio','listaChat','profile','profiliSocial','cercaCollegaSocial','centroNotifiche'].includes(id))setScreen(id);else info('Funzione non disponibile nella Beta')};
 const applyRapidProposal=proposal=>{const committed=commitRapidProposal(recordsRef.current,proposal);if(committed.status!==proposal.status)return committed;recordsRef.current=committed.records;setData(previous=>({...previous,records:committed.records}));setLastRapidOperation(committed.operation);return committed;};
 const rapidInsert=(model,date,allowOccupied=false)=>{const proposal=prepareRapidInsert(recordsRef.current,{...model,operativita:model.operativita||model.luogo||''},date,`beta-rapid-${operationId.current+1}`,allowOccupied);if(proposal.status!=='inserted')return proposal;const result=applyRapidProposal(proposal);if(result.status==='inserted')operationId.current+=1;return result.status==='inserted'?{...result,record:proposal.record}:result;};
 const rapidDelete=key=>applyRapidProposal(prepareRapidDelete(recordsRef.current,key));
 const undoRapid=()=>{const result=undoRapidOperation(recordsRef.current,lastRapidOperation);if(result.status!=='undone')return result;recordsRef.current=result.records;setData(previous=>({...previous,records:result.records}));setLastRapidOperation(null);return result;};
 const home=()=>setScreen('home'),social=()=>setScreen('social');
 const button=(title,action)=><Pressable key={title} accessibilityRole="button" accessibilityLabel={title} onPress={action} style={{minHeight:48,padding:14,marginVertical:5,borderWidth:1,borderColor:palette.border,borderRadius:14}}><Text style={{color:palette.text}}>{title}</Text></Pressable>;
 const page=(title,children,back=home)=><SafeAreaView style={{flex:1,backgroundColor:palette.background}}><ScrollView contentContainerStyle={{padding:20}}>{button('‹ Indietro',back)}<Text style={{color:palette.text,fontSize:26,fontWeight:'800',marginVertical:16}}>{title}</Text>{children}{button('Home',home)}</ScrollView></SafeAreaView>;
 const makeHome=(colors=palette,p=preference)=><HomeScreen paletteHome={colors} decorationLayer={<ThemeScenery preference={p}/>} profilo={data.profile} fotoProfilo={null} numeroNotifiche={0} turni={data.records}
  ore={homeSummary.ore} extra={homeSummary.extra} notti={homeSummary.notti} periodo={today.toLocaleDateString('it-IT',{month:'long',year:'numeric'})}
  monthlySummary={{month:today.toLocaleDateString('it-IT',{month:'long',year:'numeric'}),hours:homeSummary.ore,extra:homeSummary.extra,days:String(homeSummary.days),progress:null}}
  etaServizio={null} etaServizioLoading={false} etaTurno={null}
  onProfile={()=>goto('profile')} onNotifications={()=>goto('centroNotifiche')} onSocial={social} onSettings={()=>goto('impostazioni')} onCalendar={()=>goto('calendar')} onNavigate={goto} onColleghi={()=>goto('profiliSocial')} onAddShift={()=>goto('calendar')}/>;
 let content;
 if(screen==='home')content=makeHome();
 else if(screen==='calendar')content=<CalendarScreen anno={month.getFullYear()} mese={month.getMonth()} records={data.records.filter(t=>t.anno===month.getFullYear()&&t.mese===month.getMonth()+1)} tuttiTurni={data.records} impegniPersonali={[]} filtroAgenda="tutti" giornoSelezionato={date.getDate()} summary={summary} turniRapidi={data.models} paletteHome={palette}
  onManualDay={day=>{setDate(new Date(month.getFullYear(),month.getMonth(),day));info('Editor turno · sola visualizzazione')}} onSelectDay={day=>setDate(new Date(month.getFullYear(),month.getMonth(),day))} onMonthChange={delta=>setMonth(d=>new Date(d.getFullYear(),d.getMonth()+delta,1))} onBack={home} nomeTipo={t=>String(t).toUpperCase()} onRapidInsert={rapidInsert} onRapidDelete={rapidDelete} onUndoRapid={undoRapid} lastRapidOperation={lastRapidOperation}/>;
 else if(screen==='social')content=<SocialScreen paletteHome={palette} onBack={home} onSelect={id=>goto({'shared-shifts':'calendarioColleghi','chat':'listaChat','colleague-profiles':'profiliSocial','find-colleague':'cercaCollegaSocial'}[id])}/>;
 else if(screen==='calendarioColleghi')content=<TurniCondivisiView palette={palette} elementi={sharedFixtures(data)} adesso={today} giornoSelezionato={shared} inizioSettimana={lunediDellaSettimana(shared)} onGiorno={setShared} onSettimana={delta=>setShared(d=>aggiungiGiorni(d,delta*7))} onBack={social} onHome={home} onGestioneColleghi={()=>goto('profiliSocial')} onCondividi={()=>info('Condivisione disabilitata')} onRefresh={()=>setToday(new Date())} loading={false} errore=""/>;
 else if(screen==='profiliSocial'||screen==='cercaCollegaSocial')content=<ColleghiSocialScreen paletteHome={palette} ricerca={screen==='cercaCollegaSocial'} colleghi={data.profiles.map(p=>({id:p.user_id,stato:'accettato',altro_user_id:p.user_id,profilo:p}))} loading={false} cerca={async q=>data.profiles.filter(p=>Object.values(p).join(' ').toLowerCase().includes(q.toLowerCase().trim()))} onBack={social} onProfile={p=>info(p?.nome||'Profilo DEMO')} onGestione={()=>info('Richieste e collegamenti disabilitati')}/>;
 else if(screen==='impostazioni')content=<SettingsScreen paletteHome={palette} onBack={home} onSelect={id=>id==='appearance'?goto('aspettoColori'):info({'biometrics':'Biometria disabilitata','logout':'Logout disabilitato: nessun account','delete-account':'Eliminazione account disabilitata','legal-support':'Documenti e contatti esterni disabilitati','feedback':'Invio segnalazioni disabilitato'}[id])}/>;
 else if(screen==='aspettoColori')content=<AspettoColoriScreen onBack={()=>goto('impostazioni')} backLabel="Impostazioni" archivio={archive.current} onSalvato={setPreference} paletteAttuale={palette} renderAnteprima={makeHome}/>;
 else if(screen==='strumenti')content=page('Strumenti · Beta',<>{button('Calendario e turni rapidi',()=>goto('calendar'))}{button('Riepilogo ore',()=>goto('stipendio'))}{button('Temi e colori',()=>goto('aspettoColori'))}{button('Consegne e servizi online · disabilitati',()=>info('Servizi esterni disabilitati'))}</>);
 else if(screen==='stipendio')content=page('Riepilogo simulato',<Text style={{color:palette.text}}>Ore {homeSummary.ore} · Extra {homeSummary.extra} · Notti {homeSummary.notti}{'\n'}Dati sintetici. La Beta non calcola né modifica un cedolino reale.</Text>);
 else if(screen==='listaChat')content=page('Chat · dati simulati',<>{data.profiles.map(p=>button(p.nome+' '+p.cognome+' · '+p.codice_gpg,()=>info('Messaggi dimostrativi · invio disabilitato')))}<Text style={{color:palette.text}}>Conversazioni fittizie. Invio, letture remote e notifiche disabilitati.</Text></>,social);
 else content=page(screen==='profile'?'Profilo Beta':'Notifiche disabilitate',<Text style={{color:palette.text}}>Utente Beta · Istituto DEMO{'\n'}Nessun account e nessuna notifica reale.</Text>);
 return <View style={{flex:1}}><SafeAreaView edges={['top']} style={{backgroundColor:'#FFF3CD'}}><Text accessibilityRole="header" style={{color:'#352A00',textAlign:'center',padding:6,fontSize:12,fontWeight:'800'}}>BETA OFFLINE · dati simulati · nessun servizio reale</Text></SafeAreaView><View style={{flex:1}}>{content}</View></View>;
}
export default function BetaApp(){return <SafeAreaProvider><ThemeEffectsProvider><BetaContent/></ThemeEffectsProvider></SafeAreaProvider>}
