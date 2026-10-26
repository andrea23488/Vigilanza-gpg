import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { isOnShiftNow, localDateKey, sharedDayFixture, sortDayShifts, todayScrollOffset, weekForDate } from './sharedShiftsModel';
import type { DayOption, SharedShift } from './sharedShiftsModel';
import { useDemoTheme } from './ThemeContext';

type Props={onBack:()=>void;now?:Date;shifts?:SharedShift[]};
export default function SharedShiftsScreen({onBack,now:providedNow,shifts:providedShifts}:Props){
 const {palette}=useDemoTheme();
 const now=providedNow||new Date(),todayKey=localDateKey(now),days=useMemo(()=>weekForDate(now),[todayKey]),fixture=useMemo(()=>providedShifts||sharedDayFixture(now),[providedShifts,todayKey]);
 const [selectedKey,setSelectedKey]=useState(todayKey),[layoutWidth,setLayoutWidth]=useState(320),scroll=useRef<ScrollView|null>(null);
 const activeDay=days.some(d=>d.dateKey===selectedKey)?selectedKey:todayKey;
 const todayShifts=fixture.filter(s=>s.dateKey===todayKey),inService=todayShifts.filter(s=>isOnShiftNow(s,now));
 const dayShifts=sortDayShifts(fixture.filter(s=>s.dateKey===activeDay),now);
 const date=days.find(d=>d.dateKey===activeDay),displayDate=new Date(`${activeDay}T12:00:00`).toLocaleDateString('it-IT',{day:'numeric',month:'long'});
 const todayIndex=days.findIndex(d=>d.dateKey===todayKey);
 useEffect(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>{onBack();return true;});return()=>sub.remove();},[onBack]);
 useEffect(()=>{if(todayIndex>=0)scroll.current?.scrollTo({x:todayScrollOffset(todayIndex,layoutWidth),animated:false});},[todayIndex,layoutWidth]);
 const selectDay=(day:DayOption)=>setSelectedKey(day.dateKey);
 return <SafeAreaView style={[styles.safe,{backgroundColor:'transparent'}]}>
  <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Torna al menu Social" onPress={onBack} style={styles.back}><Ionicons name="arrow-back" size={23} color={palette.text}/><Text style={[styles.backText,{color:palette.text}]}>Social</Text></Pressable><Text style={[styles.demo,{color:palette.homeAccent}]}>DEMO</Text></View>
  <ScrollView contentContainerStyle={styles.page}>
   <Text accessibilityRole="header" style={[styles.title,{color:palette.text}]}>Turni condivisi</Text>
   <View testID="shared-in-service" style={[styles.currentBox,{borderColor:palette.border,backgroundColor:palette.surface}]}><View style={styles.currentHeading}><View style={styles.liveDot}/><Text style={[styles.currentTitle,{color:palette.homeAccent}]}>IN SERVIZIO ADESSO</Text><Text accessibilityLabel={`${inService.length} persone in servizio`} style={styles.currentCount}>{inService.length}</Text></View>
    {inService.length?inService.slice(0,3).map(shift=><Text key={shift.id} numberOfLines={1} style={[styles.currentName,{color:palette.text}]}>{shift.user==='me'?'Tu':shift.name} · {shift.start}–{shift.end} · {shift.place}</Text>):<Text style={[styles.empty,{color:palette.textMuted}]}>Nessun collega demo in servizio al momento.</Text>}
    {inService.length>3&&<Text style={[styles.empty,{color:palette.textMuted}]}>+{inService.length-3} colleghi</Text>}
   </View>
   <View style={styles.daysHeading}><Text style={[styles.sectionTitle,{color:palette.text}]}>Questa settimana</Text><Text style={[styles.todayLabel,{color:palette.homeAccent}]}>OGGI · {new Date(`${todayKey}T12:00:00`).toLocaleDateString('it-IT',{day:'numeric',month:'short'}).toUpperCase()}</Text></View>
   <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} onLayout={event=>setLayoutWidth(event.nativeEvent.layout.width)} contentContainerStyle={styles.dayStrip}>
    {days.map(day=><Pressable key={day.dateKey} testID={day.today?'shared-day-today':`shared-day-${day.dateKey}`} accessibilityRole="button" accessibilityLabel={`${day.label} ${day.day}${day.today?', oggi':''}`} accessibilityState={{selected:activeDay===day.dateKey}} onPress={()=>selectDay(day)} style={[styles.dayChip,{backgroundColor:palette.surface,borderColor:day.today?palette.homeAccent:palette.border},activeDay===day.dateKey&&{borderColor:palette.homeAccent,backgroundColor:palette.surfaceRaised}]}>
      <Text style={[styles.dayName,{color:palette.textMuted},activeDay===day.dateKey&&{color:palette.text}]}>{day.label}</Text><Text style={[styles.dayNumber,{color:palette.text},activeDay===day.dateKey&&{color:palette.homeAccent}]}>{day.day}</Text>{day.today&&<Text style={[styles.todayTiny,{color:palette.homeAccent}]}>OGGI</Text>}
    </Pressable>)}
   </ScrollView>
   <View style={styles.listHeading}><Text accessibilityRole="header" style={[styles.sectionTitle,{color:palette.text}]}>{date?.today?'Oggi':displayDate}</Text><Text style={[styles.count,{color:palette.textMuted}]}>{dayShifts.length} turni</Text></View>
   <View testID="shared-day-list" accessibilityLabel={`Turni del ${displayDate}`}>
    {dayShifts.length?dayShifts.map(shift=><ColleagueRow key={shift.id} shift={shift} palette={palette}/>):<Text style={[styles.empty,{color:palette.textMuted}]}>Nessun turno dimostrativo per questo giorno.</Text>}
   </View>
   <Text style={[styles.footnote,{color:palette.textMuted}]}>Dati dimostrativi · nessuna informazione viene caricata dall’app.</Text>
  </ScrollView>
 </SafeAreaView>;
}
function ColleagueRow({shift,palette}:{shift:SharedShift;palette:ReturnType<typeof useDemoTheme>['palette']}){
 return <View testID="shared-colleague-row" accessibilityLabel={`${shift.name}, ${shift.company}, ${shift.start}–${shift.end}, ${shift.place}${shift.user==='me'?', tu':''}`} style={[styles.row,{backgroundColor:palette.surface,borderColor:palette.border},shift.user==='me'&&{borderColor:palette.homeAccent,backgroundColor:palette.surfaceRaised}]}>
  <View style={styles.identity}><View style={[styles.avatar,shift.user==='me'&&styles.selfAvatar]}><Ionicons name={shift.user==='me'?'person':'person-outline'} color={shift.user==='me'?palette.homeAccent:palette.textMuted} size={17}/></View><View style={styles.nameCompany}><View style={styles.nameLine}><Text numberOfLines={1} style={[styles.name,{color:palette.text}]}>{shift.name}</Text>{shift.user==='me'&&<Text style={styles.you}>TU</Text>}</View><Text numberOfLines={1} style={[styles.company,{color:palette.textMuted}]}>{shift.company}</Text></View></View>
  <View style={styles.shiftDetails}><Text style={[styles.time,{color:palette.homeAccent}]}>{shift.start}–{shift.end}</Text><Text numberOfLines={1} style={[styles.place,{color:palette.textMuted}]}>{shift.place}</Text></View>
 </View>;
}
const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:'#03081B'},header:{minHeight:52,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20},back:{minHeight:44,flexDirection:'row',alignItems:'center',gap:8},backText:{color:'#F6F2FF',fontSize:15,fontWeight:'600'},demo:{color:'#CE8DFF',fontSize:11,fontWeight:'700',letterSpacing:2},page:{flexGrow:1,paddingHorizontal:16,paddingTop:4,paddingBottom:12,width:'100%',maxWidth:560,alignSelf:'center'},title:{color:'#F6F2FF',fontSize:28,lineHeight:34,fontWeight:'800',marginBottom:12},
 currentBox:{paddingHorizontal:12,paddingVertical:9,marginBottom:12,borderRadius:16,borderWidth:1,borderColor:'#27658E',backgroundColor:'#0B1930'},currentHeading:{minHeight:22,flexDirection:'row',alignItems:'center',gap:8},liveDot:{width:8,height:8,borderRadius:4,backgroundColor:'#61E8C1'},currentTitle:{flex:1,color:'#9DE9FF',fontSize:11,fontWeight:'800',letterSpacing:.8},currentCount:{color:'#61E8C1',fontSize:12,fontWeight:'800'},currentName:{color:'#D8E5F6',fontSize:11,lineHeight:17,marginTop:3},
 daysHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:6},sectionTitle:{color:'#F3F6FF',fontSize:16,fontWeight:'700'},todayLabel:{color:'#9DE9FF',fontSize:10,fontWeight:'800',letterSpacing:.5},dayStrip:{gap:7,paddingVertical:4,paddingHorizontal:2},dayChip:{width:52,minHeight:67,alignItems:'center',justifyContent:'center',gap:2,borderWidth:1,borderRadius:14,borderColor:'#293D5D',backgroundColor:'#0B1530'},daySelected:{borderColor:'#67CDFF',backgroundColor:'#142947'},todayChip:{borderColor:'#A77BFF'},dayName:{color:'#AFC2DE',fontSize:11,fontWeight:'600',textTransform:'capitalize'},dayNumber:{color:'#F3F6FF',fontSize:18,fontWeight:'800'},dayTextSelected:{color:'#9DE9FF'},todayTiny:{color:'#CE8DFF',fontSize:8,fontWeight:'900'},
 listHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:12,marginBottom:5},count:{color:'#AFC2DE',fontSize:11},row:{minHeight:64,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,paddingHorizontal:10,paddingVertical:7,marginTop:6,borderRadius:14,borderWidth:1,borderColor:'#203959',backgroundColor:'#09152B'},selfRow:{borderColor:'#3983A6',backgroundColor:'#0B1D33'},identity:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:8},avatar:{width:34,height:34,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#14233A'},selfAvatar:{backgroundColor:'#13314A'},nameCompany:{flex:1,minWidth:0},nameLine:{flexDirection:'row',alignItems:'center',gap:5},name:{flexShrink:1,color:'#F2F6FF',fontSize:13,fontWeight:'700'},you:{color:'#9DE9FF',fontSize:8,fontWeight:'900',letterSpacing:.6},company:{color:'#90A6C5',fontSize:9,marginTop:2},shiftDetails:{alignItems:'flex-end',maxWidth:'43%',minWidth:92},time:{color:'#9DE9FF',fontSize:15,fontWeight:'800'},place:{color:'#B8C8DD',fontSize:10,marginTop:2},empty:{color:'#B8C8DD',fontSize:12,paddingVertical:9},footnote:{color:'#8197B5',fontSize:10,textAlign:'center',marginTop:12},
});
