import React,{useEffect,useState} from 'react';
import {View,Text,Switch,TouchableOpacity,Alert,Linking} from 'react-native';
export default function NotifichePushScreen({onBack,gestore}) {
  const [chat,setChat]=useState(false),[consegne,setConsegne]=useState(false),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[error,setError]=useState('');
  const available=gestore?.stato().storageSicuro&&gestore?.stato().abilitato;
  useEffect(()=>{let active=true;if(available){gestore.carica().then(p=>{if(active){setChat(p.chat);setConsegne(p.consegne);setLoaded(true);}}).catch(()=>{if(active)setError('Preferenze non caricate. Nessun valore è stato sovrascritto.');});}return()=>{active=false;};},[gestore,available]);
  async function salva(){if(!loaded)return;setBusy(true);try{await gestore.registra({chat,consegne},true);Alert.alert('Notifiche','Preferenze salvate.');}catch{Alert.alert('Notifiche','Salvataggio non completato. Riprova dopo aver verificato permessi e connessione.');}finally{setBusy(false);}}
  return <View style={{flex:1,backgroundColor:'#07111F',padding:24,paddingTop:60}}>
    <TouchableOpacity onPress={onBack} accessibilityRole="button"><Text style={{color:'#FFFFFF'}}>Torna al Profilo</Text></TouchableOpacity>
    <Text style={{color:'#FFFFFF',fontSize:24,marginVertical:24}}>Notifiche di sistema</Text>
    <Text style={{color:'#CBD5E1'}}>Gli avvisi sono generici e non contengono testi dei messaggi o dati di servizio.</Text>
    <Text style={{color:'#FFFFFF',marginTop:24}}>Messaggi privati</Text><Switch accessibilityLabel="Notifiche messaggi privati" value={chat} onValueChange={setChat} disabled={!loaded||busy}/>
    <Text style={{color:'#FFFFFF'}}>Consegne di servizio</Text><Switch accessibilityLabel="Notifiche consegne di servizio" value={consegne} onValueChange={setConsegne} disabled={!loaded||busy}/>
    {!available&&<Text style={{color:'#CBD5E1',marginVertical:20}}>Attivazione non ancora disponibile in questa versione.</Text>}
    {!!error&&<Text accessibilityRole="alert" style={{color:'#FCA5A5'}}>{error}</Text>}
    <TouchableOpacity onPress={salva} disabled={!loaded||busy} accessibilityRole="button"><Text style={{color:'#93C5FD'}}>Salva preferenze</Text></TouchableOpacity>
    <TouchableOpacity onPress={()=>Linking.openSettings().catch(()=>Alert.alert('Impostazioni','Apri le impostazioni del dispositivo.'))} accessibilityRole="button" style={{marginTop:24}}><Text style={{color:'#93C5FD'}}>Apri impostazioni del dispositivo</Text></TouchableOpacity>
  </View>;
}
