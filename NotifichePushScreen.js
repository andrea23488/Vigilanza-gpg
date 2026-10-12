import React, { useState } from 'react';
import { View, Text, Switch, TouchableOpacity, Alert, Linking } from 'react-native';
export default function NotifichePushScreen({onBack,gestore}) {
  const [chat,setChat]=useState(false),[consegne,setConsegne]=useState(false),[busy,setBusy]=useState(false);
  const ready=gestore?.stato().storageSicuro;
  async function salva(){setBusy(true);try{await gestore.registra({chat,consegne},true);Alert.alert('Notifiche','Preferenze salvate.');}catch{Alert.alert('Notifiche','Attivazione non completata. Verifica permessi e disponibilità del servizio.');}finally{setBusy(false);}}
  return <View style={{flex:1,backgroundColor:'#07111F',padding:24,paddingTop:60}}>
    <TouchableOpacity onPress={onBack} accessibilityRole="button"><Text style={{color:'#FFFFFF'}}>Torna al Profilo</Text></TouchableOpacity>
    <Text style={{color:'#FFFFFF',fontSize:24,marginVertical:24}}>Notifiche di sistema</Text>
    <Text style={{color:'#CBD5E1'}}>Gli avvisi sono generici e non contengono testi dei messaggi o dati di servizio.</Text>
    <Text style={{color:'#FFFFFF',marginTop:24}}>Messaggi privati</Text><Switch value={chat} onValueChange={setChat} disabled={!ready||busy}/>
    <Text style={{color:'#FFFFFF'}}>Consegne di servizio</Text><Switch value={consegne} onValueChange={setConsegne} disabled={!ready||busy}/>
    {!ready&&<Text style={{color:'#CBD5E1',marginVertical:20}}>Attivazione non ancora disponibile in questa versione.</Text>}
    <TouchableOpacity onPress={salva} disabled={!ready||busy} accessibilityRole="button"><Text style={{color:'#93C5FD'}}>Salva e richiedi il permesso</Text></TouchableOpacity>
    <TouchableOpacity onPress={()=>Linking.openSettings().catch(()=>Alert.alert('Impostazioni','Apri le impostazioni del dispositivo.'))} accessibilityRole="button" style={{marginTop:24}}><Text style={{color:'#93C5FD'}}>Apri impostazioni del dispositivo</Text></TouchableOpacity>
  </View>;
}
