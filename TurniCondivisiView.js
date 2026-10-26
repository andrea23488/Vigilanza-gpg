import { testoTema } from './temi';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { aggiungiGiorni, chiaveData, formattaBreve, elementiDelGiorno, inServizioAdesso, orarioTurno, contaPersone } from './turniCondivisiModel';

// Layout copied from the approved preview. All content is supplied by the real screen.
export default function TurniCondivisiView({ palette, elementi, adesso, giornoSelezionato, inizioSettimana, onGiorno, onSettimana, onBack, onHome, onGestioneColleghi, onCondividi, onRefresh, loading, errore, backLabel = 'Social' }) {
  const { fontScale } = useWindowDimensions();
  const todayKey = chiaveData(adesso), activeKey = chiaveData(giornoSelezionato);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => aggiungiGiorni(inizioSettimana, i)), [inizioSettimana]);
  const dayShifts = loading ? [] : elementiDelGiorno(elementi, giornoSelezionato, adesso);
  const inService = loading ? [] : inServizioAdesso(elementi, adesso);
  const [layoutWidth, setLayoutWidth] = useState(320), scroll = useRef(null);
  const selectedIndex = days.findIndex(d => chiaveData(d) === activeKey);
  const slotWidth = Math.max(52, 52 * fontScale) + 7;
  useEffect(() => {
    if (selectedIndex >= 0) scroll.current?.scrollTo({ x: Math.max(0, selectedIndex * slotWidth - (layoutWidth - slotWidth) / 2), animated: false });
  }, [selectedIndex, layoutWidth, slotWidth]);
  const displayDate = giornoSelezionato.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const weekLabel = `${formattaBreve(inizioSettimana)} – ${formattaBreve(aggiungiGiorni(inizioSettimana, 6))}`;
  return <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={backLabel === 'Social' ? 'Torna al menu Social' : 'Torna alla Home'} onPress={onBack} style={styles.back}><Ionicons name="arrow-back" size={23} color={palette.text} /><Text style={[styles.backText, { color: palette.text }]}>{backLabel}</Text></Pressable>
      {onHome && backLabel !== 'Home' && <Pressable accessibilityRole="button" accessibilityLabel="Torna alla Home" onPress={onHome} style={styles.back}><Ionicons name="home-outline" size={23} color={palette.text} /></Pressable>}
    </View>
    <ScrollView contentContainerStyle={styles.page}>
      <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>Turni condivisi</Text>
      <View style={[styles.weekSelector, { borderColor: palette.border, backgroundColor: palette.surface }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Settimana precedente" onPress={() => onSettimana(-1)} style={styles.weekArrow}><Ionicons name="chevron-back" size={22} color={palette.text} /></Pressable>
        <Text testID="shared-week-label" style={[styles.weekLabel, { color: palette.text }]}>{weekLabel}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Settimana successiva" onPress={() => onSettimana(1)} style={styles.weekArrow}><Ionicons name="chevron-forward" size={22} color={palette.text} /></Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Condividi la mia settimana" onPress={onCondividi} disabled={loading || !!errore} style={[styles.share, { backgroundColor: palette.accent, opacity: loading || errore ? .5 : 1 }]}><Ionicons name="share-social-outline" size={20} color={palette.onAccent} /><Text style={[styles.shareText, { color: palette.onAccent }]}>Condividi la mia settimana</Text></Pressable>
      <View testID="shared-in-service" style={[styles.currentBox, { borderColor: palette.border, backgroundColor: palette.surface }]}>
        <View style={styles.currentHeading}><View style={[styles.liveDot, { backgroundColor: palette.serviceActive }]} /><Text style={[styles.currentTitle, { color: testoTema(palette, palette.homeAccent) }]}>IN SERVIZIO ADESSO</Text><Text accessibilityLabel={`${contaPersone(inService)} persone in servizio`} style={[styles.currentCount, { color: testoTema(palette, palette.serviceActive) }]}>{contaPersone(inService)}</Text></View>
        {loading ? <ActivityIndicator accessibilityLabel="Aggiornamento turni" color={palette.homeAccent} /> : inService.length ? inService.map(shift => <Text key={shift.id} style={[styles.currentName, { color: palette.text }]}>{shift.mio ? 'Tu' : shift.nome} · {orarioTurno(shift.turno)} · {shift.turno.postazione}</Text>) : <Text style={[styles.empty, { color: palette.textMuted }]}>{errore ? 'Dati non disponibili.' : 'Nessun turno condiviso in corso.'}</Text>}
      </View>
      <View style={styles.daysHeading}><Text style={[styles.sectionTitle, { color: palette.text }]}>Giorni della settimana</Text><Text style={[styles.todayLabel, { color: testoTema(palette, palette.homeAccent) }]}>OGGI · {adesso.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).toUpperCase()}</Text></View>
      <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} onLayout={event => setLayoutWidth(event.nativeEvent.layout.width)} contentContainerStyle={styles.dayStrip}>
        {days.map(day => {
          const key = chiaveData(day), today = key === todayKey, selected = key === activeKey;
          return <Pressable key={key} testID={today ? 'shared-day-today' : `shared-day-${key}`} accessibilityRole="button" accessibilityLabel={`${day.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}${today ? ', oggi' : ''}`} accessibilityState={{ selected }} onPress={() => onGiorno(day)} style={[styles.dayChip, { width: slotWidth - 7, backgroundColor: selected ? palette.surfaceRaised : palette.surface, borderColor: today || selected ? palette.homeAccent : palette.border }]}><Text style={[styles.dayName, { color: selected ? palette.text : palette.textMuted }]}>{day.toLocaleDateString('it-IT', { weekday: 'short' })}</Text><Text style={[styles.dayNumber, { color: selected ? palette.homeAccent : palette.text }]}>{day.getDate()}</Text>{today && <Text style={[styles.todayTiny, { color: testoTema(palette, palette.homeAccent) }]}>OGGI</Text>}</Pressable>;
        })}
      </ScrollView>
      <View style={styles.listHeading}><Text accessibilityRole="header" style={[styles.sectionTitle, { color: palette.text }]}>{activeKey === todayKey ? `Oggi · ${displayDate}` : displayDate}</Text><Text style={[styles.count, { color: palette.textMuted }]}>{dayShifts.length} turni</Text></View>
      {!!errore && <Text accessibilityRole="alert" style={[styles.empty, { color: testoTema(palette, palette.error) }]}>{errore}</Text>}
      <View testID="shared-day-list" accessibilityLabel={`Turni del ${displayDate}`}>
        {loading ? <ActivityIndicator color={palette.homeAccent} /> : dayShifts.length ? dayShifts.map(shift => <ColleagueRow key={shift.id} shift={shift} palette={palette} stacked={fontScale > 1.3} />) : <Text style={[styles.empty, { color: palette.textMuted }]}>{errore ? 'Riprova ad aggiornare i turni.' : 'Nessun turno per questo giorno.'}</Text>}
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Aggiorna turni condivisi" onPress={onRefresh} disabled={loading} style={styles.back}><Ionicons name="refresh" size={20} color={testoTema(palette, palette.homeAccent, 3)} /><Text style={[styles.backText, { color: palette.text }]}>Aggiorna</Text></Pressable>
        {onGestioneColleghi && <Pressable accessibilityRole="button" accessibilityLabel="Gestisci collegamenti colleghi" onPress={onGestioneColleghi} style={styles.back}><Text style={[styles.backText, { color: palette.text }]}>Gestisci colleghi</Text></Pressable>}
      </View>
    </ScrollView>
  </SafeAreaView>;
}
function ColleagueRow({ shift, palette, stacked }) {
  return <View testID="shared-colleague-row" accessibilityLabel={`${shift.nome}${shift.azienda ? `, ${shift.azienda}` : ''}, ${orarioTurno(shift.turno)}, ${shift.turno.postazione}${shift.mio ? ', tu' : ''}`} style={[styles.row, { backgroundColor: shift.mio ? palette.surfaceRaised : palette.surface, borderColor: shift.mio ? palette.homeAccent : palette.border }, stacked && { flexDirection: 'column', alignItems: 'stretch' }]}>
    <View style={styles.identity}>
      <View style={[styles.avatar, { backgroundColor: palette.surfaceRaised }]}>{shift.foto ? <Image source={{ uri: shift.foto }} style={styles.avatar} accessibilityLabel={`Foto di ${shift.nome}`} /> : <Ionicons name={shift.mio ? 'person' : 'person-outline'} color={shift.mio ? palette.homeAccent : palette.textMuted} size={17} />}</View>
      <View style={styles.nameCompany}><View style={styles.nameLine}><Text style={[styles.name, { color: palette.text }]}>{shift.nome}</Text>{shift.mio && <Text style={[styles.you, { color: testoTema(palette, palette.homeAccent) }]}>TU</Text>}</View>{!!shift.azienda && <Text style={[styles.company, { color: palette.textMuted }]}>{shift.azienda}</Text>}</View>
    </View>
    <View style={[styles.shiftDetails, stacked && { maxWidth: '100%', alignItems: 'flex-start' }]}><Text style={[styles.time, { color: testoTema(palette, palette.homeAccent) }]}>{orarioTurno(shift.turno)}</Text><Text style={[styles.place, { color: palette.textMuted }]}>{shift.turno.postazione}</Text></View>
  </View>;
}
const styles=StyleSheet.create({
 weekSelector:{flexDirection:'row',alignItems:'center',borderRadius:16,borderWidth:1,marginBottom:10},weekArrow:{minWidth:44,minHeight:48,alignItems:'center',justifyContent:'center'},weekLabel:{flex:1,textAlign:'center',fontSize:13,fontWeight:'700'},share:{minHeight:48,padding:10,borderRadius:16,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginBottom:12},shareText:{flexShrink:1,fontSize:14,fontWeight:'800'},actions:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',marginTop:10},

 safe:{flex:1,backgroundColor:'#03081B'},header:{minHeight:52,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20},back:{minHeight:44,flexDirection:'row',alignItems:'center',gap:8},backText:{color:'#F6F2FF',fontSize:15,fontWeight:'600'},demo:{color:'#CE8DFF',fontSize:11,fontWeight:'700',letterSpacing:2},page:{flexGrow:1,paddingHorizontal:16,paddingTop:4,paddingBottom:12,width:'100%',maxWidth:560,alignSelf:'center'},title:{color:'#F6F2FF',fontSize:28,lineHeight:34,fontWeight:'800',marginBottom:12},
 currentBox:{paddingHorizontal:12,paddingVertical:9,marginBottom:12,borderRadius:16,borderWidth:1,borderColor:'#27658E',backgroundColor:'#0B1930'},currentHeading:{minHeight:22,flexDirection:'row',alignItems:'center',gap:8},liveDot:{width:8,height:8,borderRadius:4,backgroundColor:'#61E8C1'},currentTitle:{flex:1,color:'#9DE9FF',fontSize:11,fontWeight:'800',letterSpacing:.8},currentCount:{color:'#61E8C1',fontSize:12,fontWeight:'800'},currentName:{color:'#D8E5F6',fontSize:11,lineHeight:17,marginTop:3},
 daysHeading:{flexWrap:'wrap',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:6},sectionTitle:{color:'#F3F6FF',fontSize:16,fontWeight:'700'},todayLabel:{color:'#9DE9FF',fontSize:10,fontWeight:'800',letterSpacing:.5},dayStrip:{gap:7,paddingVertical:4,paddingHorizontal:2},dayChip:{width:52,minHeight:67,alignItems:'center',justifyContent:'center',gap:2,borderWidth:1,borderRadius:14,borderColor:'#293D5D',backgroundColor:'#0B1530'},daySelected:{borderColor:'#67CDFF',backgroundColor:'#142947'},todayChip:{borderColor:'#A77BFF'},dayName:{color:'#AFC2DE',fontSize:11,fontWeight:'600',textTransform:'capitalize'},dayNumber:{color:'#F3F6FF',fontSize:18,fontWeight:'800'},dayTextSelected:{color:'#9DE9FF'},todayTiny:{color:'#CE8DFF',fontSize:8,fontWeight:'900'},
 listHeading:{flexWrap:'wrap',gap:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:12,marginBottom:5},count:{color:'#AFC2DE',fontSize:11},row:{minHeight:64,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,paddingHorizontal:10,paddingVertical:7,marginTop:6,borderRadius:14,borderWidth:1,borderColor:'#203959',backgroundColor:'#09152B'},selfRow:{borderColor:'#3983A6',backgroundColor:'#0B1D33'},identity:{flexGrow:1,flexShrink:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:8},avatar:{width:34,height:34,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#14233A'},selfAvatar:{backgroundColor:'#13314A'},nameCompany:{flex:1,minWidth:0},nameLine:{flexWrap:'wrap',flexDirection:'row',alignItems:'center',gap:5},name:{flexShrink:1,color:'#F2F6FF',fontSize:13,fontWeight:'700'},you:{flexShrink:0,color:'#9DE9FF',fontSize:8,fontWeight:'900',letterSpacing:.6},company:{color:'#90A6C5',fontSize:9,marginTop:2},shiftDetails:{alignItems:'flex-end',maxWidth:'43%',minWidth:92},time:{color:'#9DE9FF',fontSize:15,fontWeight:'800'},place:{color:'#B8C8DD',fontSize:10,marginTop:2},empty:{color:'#B8C8DD',fontSize:12,paddingVertical:9},footnote:{color:'#8197B5',fontSize:10,textAlign:'center',marginTop:12},
});
