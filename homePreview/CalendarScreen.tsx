import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { dateKey, entriesOn, horizontalDrag, monthCells, swipeMonth, type AgendaAction, type AgendaState, type AgendaEntry } from './calendarModel';
import { ManualDayDemo, AgendaConflictDialog } from './AgendaDialogs';
import QuickShiftEditor from './QuickShiftEditor';
import { useDemoTheme } from './ThemeContext';

type Props = { onManualDate?: (key:string,entries:AgendaEntry[])=>void; summary?: {ore:string;extra:string;notti:number} | null; state: AgendaState; dispatch: React.Dispatch<AgendaAction>; onBack: () => void };
export default function CalendarScreen({ state, dispatch, onBack, summary = null, onManualDate }: Props) {
  const { palette } = useDemoTheme();
  const [menu, setMenu] = useState(false);
  const [editor, setEditor] = useState<boolean>(false);
  const [manualDate,setManualDate]=useState<string|null>(null);
  const suppressTap=useRef(0);
  const changeMonth=(delta:number)=>dispatch({type:'month',delta});
  const pan=useMemo(()=>PanResponder.create({
    onMoveShouldSetPanResponderCapture:(_event,gesture)=>horizontalDrag(gesture.dx,gesture.dy),
    onPanResponderGrant:()=>{suppressTap.current=Date.now()+350;},
    onPanResponderMove:()=>{suppressTap.current=Date.now()+350;},
    onPanResponderRelease:(_event,gesture)=>{suppressTap.current=Date.now()+350;const delta=swipeMonth(gesture.dx,gesture.dy);if(delta)changeMonth(delta);},
    onPanResponderTerminate:()=>{suppressTap.current=Date.now()+350;},
    onPanResponderTerminationRequest:()=>true,
  }),[dispatch]);
  const { fontScale } = useWindowDimensions();
  const back = () => { if (menu) setMenu(false); else if (state.pending) dispatch({type:'resolve',choice:'cancel'}); else if (manualDate) setManualDate(null); else if (editor) setEditor(false); else onBack(); };
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; }); return () => sub.remove(); }, [menu, editor, manualDate, state.pending, onBack]);
  const cells = monthCells(state.year, state.month);
  const title = new Date(state.year, state.month, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  const selected = state.templates.find(t => t.id === state.selected);
  const openEditor = () => { setMenu(false); setEditor(true); };
  if(manualDate)return <ManualDayDemo date={manualDate} entries={entriesOn(state,manualDate)} onBack={()=>setManualDate(null)} onHome={onBack} />;
  if (editor) return <QuickShiftEditor state={state} dispatch={dispatch} onBack={() => setEditor(false)} onHome={onBack} />;
  return <SafeAreaView style={[styles.safe,{backgroundColor:'transparent'}]}>
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Torna alla Home" onPress={onBack} style={styles.iconButton}><Ionicons name="arrow-back" size={23} color={palette.text} /></Pressable>
        <View style={styles.heading}><Text accessibilityRole="header" style={[styles.title,{color:palette.text}]}>Agenda</Text><Text style={[styles.demo,{color:palette.textMuted}]}>DEMO · solo in memoria</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Turni rapidi" accessibilityState={{ expanded: state.panel }} onPress={() => dispatch({ type: 'panel', open: !state.panel })} style={[styles.chip,{borderColor:palette.border,backgroundColor:palette.surface},state.panel&&{borderColor:palette.homeAccent,backgroundColor:palette.surfaceRaised}]}><Text style={[styles.chipText,{color:palette.homeAccent}]}>Turni rapidi</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Menu calendario" accessibilityState={{ expanded: menu }} onPress={() => setMenu(true)} style={styles.iconButton}><Ionicons name="ellipsis-horizontal" size={24} color={palette.homeAccent} /></Pressable>
      </View>
      <View style={styles.month}>
        <Pressable accessibilityRole="button" accessibilityLabel="Mese precedente" onPress={() => changeMonth(-1)} style={styles.iconButton}><Ionicons name="chevron-back" size={22} color={palette.homeAccent} /></Pressable>
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.monthTitle,{color:palette.text}]}>{title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Mese successivo" onPress={() => changeMonth(1)} style={styles.iconButton}><Ionicons name="chevron-forward" size={22} color={palette.homeAccent} /></Pressable>
      </View>
      <View testID="calendar-summary" style={styles.summaryCards}>
        {[['Ore totali',summary?.ore,'time-outline',palette.homeAccent],['Extra',summary?.extra,'rocket',palette.homeAccentSecondary||palette.homeAccent],['Notti',summary?.notti,'moon',palette.homeAccent]].map(([label,value,icon,color])=><View key={String(label)} testID={`calendar-stat-${label}`} accessible accessibilityLabel={`${label}: ${value ?? 'non disponibile'}, ${title}, DEMO`} style={[styles.summaryCard,{borderColor:String(color),backgroundColor:palette.surface,minHeight:72*Math.max(1,fontScale)}]}>
          <Ionicons name={icon as React.ComponentProps<typeof Ionicons>['name']} size={17} color={String(color)} />
          <Text style={[styles.summaryLabel,{color:palette.textMuted}]}>{label}</Text><Text numberOfLines={1} style={[styles.summaryValue,{color:palette.text}]}>{value === undefined ? '—' : String(value).replace(/\s*h$/,'').replace('.',',')}</Text>
        </View>)}
      </View>
      {state.panel && <View style={[styles.quickPanel,{backgroundColor:palette.surface,borderColor:palette.border}]}>
        <View style={styles.panelTitle}><Text style={[styles.help,{color:palette.textMuted}]}>Seleziona, poi tocca le date</Text><Pressable accessibilityRole="button" accessibilityLabel="Chiudi turni rapidi" onPress={() => dispatch({ type: 'panel', open: false })} style={styles.iconButton}><Ionicons name="close" size={20} color={palette.homeAccent} /></Pressable></View>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.quickList}>
          {state.templates.map(t => <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={`Turno rapido ${t.label}, ${t.start} ${t.end}`} accessibilityState={{ selected: state.selected === t.id }} onPress={() => dispatch({ type: 'select', id: t.id })} style={[styles.quick, { borderColor: t.color, backgroundColor: state.selected === t.id ? palette.surfaceRaised : palette.surface, borderWidth: state.selected === t.id ? 2 : 1 }]}>
            <Text style={[styles.quickText, { color: t.color }]}>{t.label}</Text>{t.type === 'turno' && <Text style={[styles.quickTime,{color:palette.textMuted}]}>{t.start}–{t.end}</Text>}
          </Pressable>)}
          <Pressable accessibilityRole="button" accessibilityLabel="Elimina" accessibilityState={{ selected: state.selected === 'delete' }} onPress={() => dispatch({ type: 'select', id: 'delete' })} style={[styles.quick, { borderColor: '#F58EAC', backgroundColor: state.selected === 'delete' ? palette.surfaceRaised : palette.surface }]}><Ionicons name="trash-outline" size={20} color="#F58EAC" /><Text style={styles.quickText}>Elimina</Text></Pressable>
        </ScrollView>
        <Text accessibilityLiveRegion="polite" style={[styles.modeText,{color:palette.homeAccent}]}>{state.announcement || (selected ? `${selected.label} · tocca le date` : 'Scegli un turno rapido o Elimina')}</Text>
      </View>}
      <View style={styles.week}>{['LU', 'MA', 'ME', 'GI', 'VE', 'SA', 'DO'].map(day => <Text key={day} style={[styles.weekday,{color:palette.textMuted}]}>{day}</Text>)}</View>
      <View testID="calendar-grid" {...pan.panHandlers} style={styles.grid}>{Array.from({ length: cells.length / 7 }, (_, week) => <View key={week} style={styles.weekRow}>
        {cells.slice(week * 7, week * 7 + 7).map((day, column) => {
          if (!day) return <View key={column} style={styles.empty} />;
          const key = dateKey(state.year, state.month, day), entries = entriesOn(state,key), shift = entries[0], applied = state.lastApplied === key;
          const today = key === dateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
          return <Pressable key={key} accessibilityRole="button" accessibilityLabel={`${day} ${title}, ${entries.length ? entries.map(e=>`${e.label} ${e.start} ${e.end}`).join('; ') : 'nessun turno'}`} accessibilityState={{selected:state.selectedDate===key}} accessibilityHint={state.panel ? (state.selected ? (state.selected === 'delete' ? 'Scegli un turno DEMO da eliminare' : 'Applica turno rapido DEMO con controllo conflitti') : 'Seleziona prima un modello nella barra') : 'Apri inserimento o modifica manuale, navigazione DEMO'} onPress={() => {
            if(Date.now()<suppressTap.current)return;
            if(!state.panel){dispatch({type:'focus',key});if(onManualDate)onManualDate(key,entries);else setManualDate(key);}
            else dispatch({type:'apply',key});
          }} style={({ pressed }) => [styles.day, { minHeight: 56 * Math.max(1, fontScale), borderColor: applied || state.selectedDate===key ? palette.homeAccent : today ? (palette.homeAccentSecondary||palette.homeAccent) : palette.border, backgroundColor: pressed || applied ? palette.surfaceRaised : palette.surface }]}>
            <Text style={[styles.dayNumber,{color:today?(palette.homeAccentSecondary||palette.homeAccent):palette.text}]}>{day}</Text>
            {shift && <View style={[styles.shiftMark, { borderColor: shift.color }]}><Text numberOfLines={1} style={[styles.shiftLabel, { color: shift.color }]}>{shift.label}</Text></View>}
            {entries.length>1&&<Text style={styles.shiftLabel}>+{entries.length-1}</Text>}
            {applied && <Ionicons name="checkmark" size={12} color={palette.homeAccent} />}
          </Pressable>;
        })}
      </View>)}</View>
    </ScrollView>
    <AgendaConflictDialog state={state} dispatch={dispatch} />
    <Modal visible={menu} transparent animationType="none" onRequestClose={() => setMenu(false)}>
      <SafeAreaView style={[styles.menuShade,{backgroundColor:palette.background + "CC"}]}><Pressable accessibilityRole="button" accessibilityLabel="Chiudi menu calendario" onPress={() => setMenu(false)} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.menuBox,{backgroundColor:palette.surface,borderColor:palette.border}]}>{[
          ['CONFIGURA TURNI RAPIDI', openEditor],
        ].map(([label, action]) => <Pressable key={String(label)} accessibilityRole="button" accessibilityLabel={String(label)} onPress={action as () => void} style={styles.menuRow}><Text style={[styles.menuLabel,{color:palette.text}]}>{String(label)}</Text><Ionicons name="chevron-forward" color={palette.homeAccent} size={18} /></Pressable>)}</View>
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#03081B' }, page: { flexGrow: 1, paddingHorizontal: 12, paddingBottom: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, paddingVertical: 4 }, heading: { flex: 1, minWidth: 76 }, title: { color: '#F2F7FF', fontSize: 22, fontWeight: '800' }, demo: { color: '#B9CBE5', fontSize: 9, marginTop: 3 },
  iconButton: { minWidth: 40, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, chip: { minHeight: 44, borderWidth: 1, borderColor: '#3A6C9B', borderRadius: 14, paddingHorizontal: 10, justifyContent: 'center', backgroundColor: '#101F3A' }, activeChip: { borderColor: '#89E9FF', backgroundColor: '#1C3054' }, chipText: { color: '#A2E5FF', fontSize: 12, fontWeight: '700' },
  month: { flexDirection: 'row', alignItems: 'center', gap: 4, marginVertical: 8 }, monthTitle: { flex: 1, color: '#F2F7FF', fontSize: 20, fontWeight: '700', textAlign: 'center', textTransform: 'capitalize' },
  summaryCards: {flexDirection:'row',gap:8,marginBottom:10},summaryCard:{flex:1,minWidth:0,paddingHorizontal:6,paddingVertical:7,borderRadius:14,borderWidth:1,backgroundColor:'#0B1530',alignItems:'center',justifyContent:'center',gap:3},summaryLabel:{color:'#CBD8EC',fontSize:10,fontWeight:'600'},summaryValue:{color:'#F2F7FF',fontSize:19,fontWeight:'800'},
  quickPanel: { backgroundColor: '#0B1530', borderWidth: 1, borderColor: '#2F527C', borderRadius: 18, paddingHorizontal: 10, marginBottom: 10 }, panelTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, help: { color: '#C7D6EB', fontSize: 12, flexShrink: 1 }, quickList: { gap: 8, paddingBottom: 4 }, quick: { minHeight: 52, minWidth: 76, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7, alignItems: 'center', justifyContent: 'center', gap: 3 }, quickText: { color: '#F2F7FF', fontSize: 14, fontWeight: '800' }, quickTime: { color: '#BBCDE7', fontSize: 10 }, modeText: { color: '#A4DAEF', fontSize: 11, marginVertical: 8 },
  week: { flexDirection: 'row', marginBottom: 6 }, weekday: { flex: 1, textAlign: 'center', color: '#9DB9DA', fontSize: 11, fontWeight: '700' }, grid: { flexGrow: 1, gap: 4 }, weekRow: { flex: 1, flexDirection: 'row', gap: 3 }, empty: { flex: 1 }, day: { flex: 1, minWidth: 0, borderRadius: 10, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 2, gap: 4, alignItems: 'center' }, dayNumber: { color: '#F2F7FF', fontSize: 14, fontWeight: '700' }, shiftMark: { maxWidth: '100%', borderBottomWidth: 2, paddingBottom: 2 }, shiftLabel: { color:'#BDCCE3',fontSize: 10, fontWeight: '700' },
  menuShade: { flex: 1, padding: 20, backgroundColor: '#00000066', alignItems: 'flex-end' }, menuBox: { width: '100%', maxWidth: 320, borderRadius: 20, borderWidth: 1, borderColor: '#345C8D', padding: 10, backgroundColor: '#0C1630' }, menuRow: { minHeight: 52, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, menuLabel: { color: '#F2F7FF', flexShrink: 1, fontSize: 15 },
});
