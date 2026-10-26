import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { entriesOn, insertionIssue, type AgendaAction, type AgendaState, type AgendaEntry } from './calendarModel';
import { useDemoTheme } from './ThemeContext';
const caption = (e: AgendaEntry) => `${e.label}${e.type === 'turno' ? ` · ${e.start}–${e.end}` : ''}`;
export function ManualDayDemo({date,entries,onBack,onHome}:{date:string;entries:AgendaEntry[];onBack:()=>void;onHome:()=>void}) {
  const { palette } = useDemoTheme();
  return <SafeAreaView style={[styles.safe,{backgroundColor:'transparent'}]}><ScrollView contentContainerStyle={styles.page}>
    <Pressable accessibilityRole="button" accessibilityLabel="Torna all’Agenda" onPress={onBack} style={styles.button}><Text style={[styles.buttonText,{color:palette.text}]}>‹ Agenda</Text></Pressable>
    <Text accessibilityRole="header" style={[styles.title,{color:palette.text}]}>Inserimento / modifica turno</Text><Text style={[styles.demo,{color:palette.homeAccent}]}>NAVIGAZIONE DEMO · {date}</Text>
    <Text style={[styles.text,{color:palette.textMuted}]}>Il modulo originale non è incluso in questa anteprima. Nessun dato viene inserito o salvato da questa schermata.</Text>
    <Text style={[styles.text,{color:palette.textMuted}]}>Il futuro collegamento aprirà l’editor esistente con tutti i suoi campi e controlli: orari, postazioni, pause e straordinari se previsti, causali e gestione di più turni. Il modulo non viene ricostruito qui.</Text>
    <Text accessibilityRole="header" style={[styles.subtitle,{color:palette.text}]}>Elementi della giornata · DEMO</Text>
    {entries.length ? entries.map(e=><View key={e.entryId} style={[styles.entry,{backgroundColor:palette.surface,borderColor:palette.border}]}><Text style={[styles.text,{color:palette.textMuted}]}>{caption(e)}</Text><Text style={[styles.demo,{color:palette.homeAccent}]}>{e.type==='personal'?'Evento personale · protetto':'Turno dimostrativo · sola lettura'}</Text></View>) : <Text style={[styles.text,{color:palette.textMuted}]}>Nessun elemento dimostrativo in questa data.</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel="Torna alla Home" onPress={onHome} style={styles.button}><Text style={[styles.buttonText,{color:palette.text}]}>Torna alla Home</Text></Pressable>
  </ScrollView></SafeAreaView>;
}
export function AgendaConflictDialog({state,dispatch}:{state:AgendaState;dispatch:React.Dispatch<AgendaAction>}) {
  const { palette } = useDemoTheme();
  const pending=state.pending,entries=pending?entriesOn(state,pending.key):[];
  const cancel=()=>dispatch({type:'resolve',choice:'cancel'});
  return <Modal visible={Boolean(pending)} transparent animationType="none" onRequestClose={cancel}>
    <SafeAreaView style={styles.shade}><View accessibilityViewIsModal style={[styles.dialog,{backgroundColor:palette.surface,borderColor:palette.border}]}><ScrollView>
      <Text accessibilityRole="header" style={[styles.title,{color:palette.text}]}>{pending?.mode==='delete'?'Scegli cosa eliminare':'Data occupata o conflitto'}</Text>
      <Text style={[styles.demo,{color:palette.homeAccent}]}>DEMO · {pending?.key}</Text><Text accessibilityLiveRegion="polite" style={[styles.text,{color:palette.textMuted}]}>{pending?.reason}</Text>
      <Text style={[styles.text,{color:palette.textMuted}]}>Nessun turno viene sovrascritto automaticamente. Gli eventi personali restano invariati.</Text>
      {pending?.mode==='insert'&&pending.candidate&&!insertionIssue(state,pending.key,pending.candidate)&&<Pressable accessibilityRole="button" accessibilityLabel="Aggiungi come altro turno DEMO" onPress={()=>dispatch({type:'resolve',choice:'append'})} style={[styles.button,{borderColor:palette.homeAccent,backgroundColor:palette.surface}]}><Text style={[styles.buttonText,{color:palette.text}]}>Aggiungi come altro turno · DEMO</Text></Pressable>}
      {entries.map((e,index)=><View key={e.entryId} style={[styles.entry,{backgroundColor:palette.surface,borderColor:palette.border}]}>
        <Text style={[styles.text,{color:palette.text}]}>{index+1}. {caption(e)}</Text>
        {e.type==='personal'||e.origin==='personal'?<Text style={[styles.demo,{color:palette.homeAccent}]}>Evento personale · protetto</Text>
          : pending?.mode==='delete'?<Pressable accessibilityRole="button" accessibilityLabel={`Elimina solo turno ${index+1}`} onPress={()=>dispatch({type:'resolve',choice:'delete',entryId:e.entryId})} style={[styles.button,{borderColor:palette.homeAccent,backgroundColor:palette.surface}]}><Text style={[styles.buttonText,{color:palette.text}]}>Elimina solo questo turno · DEMO</Text></Pressable>
          : pending?.candidate&&!insertionIssue(state,pending.key,pending.candidate,e.entryId)?<Pressable accessibilityRole="button" accessibilityLabel={`Sostituisci solo turno ${index+1}`} onPress={()=>dispatch({type:'resolve',choice:'replace',entryId:e.entryId})} style={[styles.button,{borderColor:palette.homeAccent,backgroundColor:palette.surface}]}><Text style={[styles.buttonText,{color:palette.text}]}>Sostituisci solo questo turno · DEMO</Text></Pressable>:<Text style={[styles.demo,{color:palette.error}]}>Inserimento bloccato per conflitto o duplicato</Text>}
      </View>)}
      <Pressable accessibilityRole="button" accessibilityLabel="Annulla operazione" onPress={cancel} style={[styles.button,{borderColor:palette.border,backgroundColor:palette.surface}]}><Text style={[styles.buttonText,{color:palette.text}]}>Annulla · nessuna modifica</Text></Pressable>
    </ScrollView></View></SafeAreaView>
  </Modal>;
}
const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:'#03081B'},page:{padding:20,gap:16,maxWidth:640,width:'100%',alignSelf:'center'},title:{color:'#F2F7FF',fontSize:23,fontWeight:'800',marginBottom:12},subtitle:{color:'#F2F7FF',fontSize:17,fontWeight:'700'},demo:{color:'#8CDFFF',fontSize:12,marginVertical:8},text:{color:'#CBD9EC',fontSize:15,lineHeight:23,marginBottom:12},button:{minHeight:48,padding:12,borderWidth:1,borderColor:'#497DAF',borderRadius:14,marginVertical:8},buttonText:{color:'#F2F7FF',fontSize:15,fontWeight:'600'},entry:{padding:12,borderRadius:14,borderWidth:1,borderColor:'#2D4D75',marginVertical:8,backgroundColor:'#0C1630'},shade:{flex:1,justifyContent:'center',backgroundColor:'#00000088',padding:20},dialog:{maxHeight:'90%',maxWidth:560,width:'100%',alignSelf:'center',padding:18,backgroundColor:'#0B1530',borderRadius:20,borderWidth:1,borderColor:'#476C9C'},
});
