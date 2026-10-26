import React, { useMemo, useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PALETTE_ORIGINALE, testoTema } from '../temi';
import { chiaveDataRapida, chiaveRecordRapido } from '../turniRapidiAnteprima';
import { celleMeseCalendario, swipeCalendario } from '../calendarioVista';

// Beta-only presentation fork of CalendarScreen: shared planner and data rules stay unchanged.
// No persistence coordinator or service access. The official component is untouched.
export default function CalendarScreen({ anno, mese, records, impegniPersonali,
  filtroAgenda, giornoSelezionato, summary, turniRapidi, paletteHome, tuttiTurni = records,
  onManualDay, onSelectDay, onMonthChange, onBack, nomeTipo, children, overlay,
  onRapidInsert, onRapidDelete, onUndoRapid, lastRapidOperation }) {
  const palette = paletteHome || PALETTE_ORIGINALE;
  const { fontScale, width } = useWindowDimensions();
  const [menu, setMenu] = useState(false);
  const [configurazione, setConfigurazione] = useState(false);
  const [panel, setPanel] = useState(false);
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');
  const [insertDialog, setInsertDialog] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const resetSelection = () => { setSelected(null); setNotice(''); setInsertDialog(null); setDeleteDialog(null); };
  const chooseModel = id => {
    if (id !== selected) { setSelected(id); setInsertDialog(null); setDeleteDialog(null); }
    setNotice('');
  };
  const formatService = record => `${record.inizio || '--:--'}–${record.fine || '--:--'}${record.luogo ? ` · ${record.luogo}` : ''}${record.indirizzo_servizio ? ` · ${record.indirizzo_servizio}` : ''}`;
  const startDelete = date => {
    const key = chiaveDataRapida(anno, mese, date);
    const all = tuttiTurni.filter(record => record.tipo === 'turno' && record.origin !== 'personal' && record.tipoAgenda !== 'personale' && chiaveRecordRapido(record)?.startsWith(`${key}|`));
    const identifiable = all.filter(record => record.id != null && tuttiTurni.filter(other => String(other.id) === String(record.id)).length === 1);
    setDeleteDialog({ date: key, choices: identifiable, invalidCount: all.length - identifiable.length, selected: identifiable.length === 1 ? chiaveRecordRapido(identifiable[0]) : null });
  };
  const toggleDeleteChoice = key => setDeleteDialog(current => current ? { ...current, selected: key } : current);
  const confirmDelete = () => {
    if (!deleteDialog?.selected) return;
    const record = tuttiTurni.find(item => chiaveRecordRapido(item) === deleteDialog.selected);
    if (!record) { setNotice('Il turno non è più disponibile. Aggiorna la selezione.'); setDeleteDialog(null); return; }
    const result = onRapidDelete?.(deleteDialog.selected);
    if (result?.status === 'deleted') {
      setNotice(`Turno eliminato nella simulazione: ${formatService(record)}.`);
      setDeleteDialog(null);
    } else {
      setNotice(result?.reason || 'Nessuna modifica applicata.');
      setDeleteDialog(null);
    }
  };
  const tapRapidDate = day => {
    if (!selected) { setNotice('Scegli prima un modello oppure attiva Elimina.'); return; }
    if (selected === 'delete') { startDelete(day); return; }
    const model = turniRapidi.find(item => String(item.id) === String(selected));
    if (!model) { setNotice('Modello non disponibile.'); return; }
    const date = chiaveDataRapida(anno, mese, day);
    const result = onRapidInsert?.(model, date, false);
    if (result?.status === 'inserted') setNotice(`Inserito ${formatService(result.record)} · ${date.split('-').reverse().join('/')}.`);
    else if (result?.status === 'choice') setInsertDialog({ model, date, existing: result.existing });
    else setInsertDialog({ date, blocked: true, reason: result?.reason || 'Turno non inserito.', existing: result?.conflicts || result?.existing || [] });
  };
  const confirmInsertAlongside = () => {
    if (!insertDialog?.model) return;
    const result = onRapidInsert?.(insertDialog.model, insertDialog.date, true);
    if (result?.status === 'inserted') {
      setNotice(`Inserito ${formatService(result.record)} · ${insertDialog.date.split('-').reverse().join('/')}.`);
      setInsertDialog(null);
    } else setInsertDialog({ ...insertDialog, blocked: true, reason: result?.reason || 'I dati sono cambiati. Nessuna modifica applicata.', existing: result?.conflicts || result?.existing || insertDialog.existing });
  };
  const undoLast = () => {
    const result = onUndoRapid?.();
    setNotice(result?.status === 'undone' ? 'Ultima operazione annullata nella simulazione.' : result?.reason || 'Nessuna operazione annullata.');
  };
  const suppressTap = useRef(0);
  // Keep the responder stable while parent callbacks/month rerender.
  const monthChange = useRef(onMonthChange);
  monthChange.current = onMonthChange;
  const gestureState = useRef({ active: false, longPress: false });
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (_event, g) => !gestureState.current.longPress &&
      g.numberActiveTouches === 1 && Math.abs(g.dx) >= 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.7,
    onPanResponderGrant: () => { gestureState.current.active = true; suppressTap.current = Date.now() + 350; },
    onPanResponderMove: (_event, g) => { if (g.numberActiveTouches > 1) gestureState.current.active = false; suppressTap.current = Date.now() + 350; },
    onPanResponderRelease: (_event, g) => {
      const active = gestureState.current.active;
      gestureState.current.active = false;
      suppressTap.current = Date.now() + 350;
      const delta = swipeCalendario(g.dx, g.dy);
      if (active && !gestureState.current.longPress && Math.abs(g.dx) > Math.abs(g.dy) * 1.7 && delta) monthChange.current(delta);
    },
    onPanResponderTerminate: () => { gestureState.current.active = false; suppressTap.current = Date.now() + 350; },
    onPanResponderTerminationRequest: () => true,
  }), []);
  const cells = celleMeseCalendario(anno, mese);
  const title = new Date(anno, mese, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  const today = new Date();
  const dayPress = day => {
    if (Date.now() < suppressTap.current || gestureState.current.longPress) return;
    if (panel) { tapRapidDate(day); return; }
    onManualDay(day);
  };
  const button = (label, icon, action) => <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={action} style={styles.iconButton}>
    <Ionicons name={icon} size={23} color={testoTema(palette, palette.homeAccent, 3)} />
  </Pressable>;
  return <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.safe, { backgroundColor: palette.background }]}>
    <ScrollView keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
      <View style={styles.header}>
        {button('Torna alla Home', 'arrow-back', onBack)}
        <View style={styles.heading}><Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>Agenda</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Turni rapidi" accessibilityState={{ expanded: panel }}
          onPress={() => { setPanel(!panel); resetSelection(); }}
          style={[styles.chip, { borderColor: panel ? palette.homeAccent : palette.border, backgroundColor: palette.surface }]}>
          <Text style={[styles.chipText, { color: testoTema(palette, palette.homeAccent) }]}>Turni rapidi</Text>
        </Pressable>
        {button('Menu calendario', 'ellipsis-horizontal', () => setMenu(true))}
      </View>
      <View style={styles.month}>
        {button('Mese precedente', 'chevron-back', () => onMonthChange(-1))}
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.monthTitle, { color: palette.text }]}>{title}</Text>
        {button('Mese successivo', 'chevron-forward', () => onMonthChange(1))}
      </View>
      <View testID="calendar-summary" style={styles.summaryCards}>
        {[
          ['Ore totali', summary.ore, 'time-outline', palette.homeAccent],
          ['Extra', summary.extra, 'rocket', palette.homeAccentSecondary || palette.homeAccent],
          ['Notti', summary.notti, 'moon', palette.homeAccent],
        ].map(([label, value, icon, color]) => <View key={label} testID={`calendar-stat-${label}`} accessible accessibilityLabel={`${label}: ${value}, ${title}`}
          style={[styles.summaryCard, { borderColor: color, backgroundColor: palette.surface, minHeight: 72 * Math.max(1, fontScale) }]}>
          <Ionicons name={icon} size={17} color={color} />
          <Text style={[styles.summaryLabel, { color: palette.textMuted }]}>{label}</Text>
          <Text style={[styles.summaryValue, { color: palette.text }]}>{value}</Text>
        </View>)}
      </View>
      {panel && <View style={[styles.quickPanel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={styles.panelTitle}><Text style={[styles.help, { color: palette.text }]}>Turni rapidi · modalità simulata</Text>
          {button('Chiudi turni rapidi', 'close', () => { setPanel(false); resetSelection(); })}</View>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.quickList}>
          {turniRapidi.map(t => <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={`Inserisci modello ${t.nome}, ${t.inizio} ${t.fine}`}
            accessibilityState={{ selected: selected === t.id }} onPress={() => chooseModel(t.id)}
            style={[styles.quick, { borderColor: palette.homeAccent, borderWidth: selected === t.id ? 2 : 1, backgroundColor: palette.surfaceRaised }]}>
            <Text style={[styles.quickText, { color: palette.text }]}>{selected === t.id ? '✓ ' : ''}{t.nome}</Text>
            <Text style={[styles.quickTime, { color: palette.textMuted }]}>{t.inizio}–{t.fine}</Text>
          </Pressable>)}
          <Pressable accessibilityRole="button" accessibilityLabel='Elimina · modalità simulata' accessibilityState={{ selected: selected === 'delete' }}
            onPress={() => { chooseModel('delete'); setNotice('Elimina · simulazione attiva. Tocca una data e seleziona il servizio esatto.'); }} style={[styles.quick, { borderColor: palette.error, borderWidth: selected === 'delete' ? 2 : 1, backgroundColor: palette.surfaceRaised }]}>
            <Ionicons name="trash-outline" size={20} color={palette.error} /><Text style={[styles.quickText, { color: palette.text }]}>Elimina</Text>
          </Pressable>
        </ScrollView>
        <Text testID="rapid-feedback" accessibilityLiveRegion="polite" style={[styles.help, { color: palette.textMuted }]}>{notice || (selected === 'delete' ? 'Modalità Elimina · scegli una data e poi il servizio esatto.' : selected ? 'Inserimento immediato · tocca le date desiderate.' : 'Scegli un modello per inserirlo subito oppure attiva Elimina.')}</Text>
        {!!lastRapidOperation && <Pressable accessibilityRole="button" accessibilityLabel="Annulla ultima operazione" onPress={undoLast} style={[styles.undoButton, { borderColor: palette.homeAccent, backgroundColor: palette.surfaceRaised }]}>
          <Ionicons name="arrow-undo" size={18} color={testoTema(palette, palette.homeAccent, 3)} /><Text style={[styles.quickText, { color: testoTema(palette, palette.homeAccent) }]}>Annulla ultima operazione</Text>
        </Pressable>}
      </View>}
      <View style={styles.week}>{['LU', 'MA', 'ME', 'GI', 'VE', 'SA', 'DO'].map(day => <Text key={day} style={[styles.weekday, { color: palette.textMuted }]}>{day}</Text>)}</View>
      <View testID="calendar-grid" onTouchStart={() => { gestureState.current.longPress = false; }} {...pan.panHandlers} style={styles.grid}>
        {Array.from({ length: cells.length / 7 }, (_, week) => <View key={week} style={styles.weekRow}>
          {cells.slice(week * 7, week * 7 + 7).map((day, column) => {
            if (!day) return <View key={`empty-${column}`} style={styles.empty} />;
            const work = panel || filtroAgenda !== 'personale' ? records.filter(t => Number(t.giorno) === day) : [];
            const personal = filtroAgenda === 'lavoro' ? [] : impegniPersonali.filter(t => Number(t.giorno) === day);
            const labels = work.map(t => t.tipo === 'turno' ? `${t.inizio}–${t.fine}` : nomeTipo(t.tipo));
            const isToday = day === today.getDate() && mese === today.getMonth() && anno === today.getFullYear();
            const active = Number(giornoSelezionato) === day;
            return <Pressable key={day} testID={`calendar-day-${day}`} accessibilityRole="button"
              accessibilityLabel={`${day} ${title}, ${labels.length ? labels.join('; ') : 'nessun turno'}${personal.length ? `, ${personal.length} impegni personali` : ''}`}
              accessibilityState={{ selected: active }} accessibilityHint={panel ? (selected === 'delete' ? 'Apri i turni della data e scegli quello da eliminare' : 'Inserisci subito il modello selezionato; in caso di conflitto nessun turno viene sovrascritto') : 'Apri il modulo originale o scegli un turno. Tieni premuto per selezionare la giornata nella timeline'}
              onPress={() => dayPress(day)} onLongPress={() => { gestureState.current.longPress = true; if (!panel && !gestureState.current.active && Date.now() >= suppressTap.current) onSelectDay(day); }} style={({ pressed }) => [styles.day, { minHeight: 56 * Math.max(1, fontScale), borderWidth: 1, borderColor: active || isToday ? palette.homeAccent : palette.border, backgroundColor: pressed || active ? palette.surfaceRaised : palette.surface }]}>
              <Text style={[styles.dayNumber, { color: isToday ? palette.homeAccent : palette.text }]}>{day}</Text>
              {!!labels.length && <View style={[styles.shiftMark, { borderColor: palette.homeAccent }]}><Text numberOfLines={1} style={[styles.shiftLabel, { color: palette.text }]}>{labels[0]}</Text></View>}
              {labels.length > 1 && <Text style={[styles.shiftLabel, { color: palette.textMuted }]}>+{labels.length - 1}</Text>}
              {!!personal.length && <Ionicons name="calendar-outline" size={13} color={palette.homeAccentSecondary || palette.homeAccent} />}
            </Pressable>;
          })}
        </View>)}
      </View>
      <Text testID="calendar-instructions" style={[styles.instructions, { color: palette.textMuted }]}>Tocca una data per inserire o modificare un turno. Tieni premuto per selezionare la giornata nella timeline. Scorri orizzontalmente sulla griglia per cambiare mese.</Text>
      {children}
    </ScrollView>
    <Modal visible={!!deleteDialog || !!insertDialog} transparent animationType="fade" onRequestClose={() => { setDeleteDialog(null); setInsertDialog(null); }}>
      <View style={styles.dialogShade}>
        <Pressable accessibilityRole="button" accessibilityLabel="Chiudi conferma turno" onPress={() => { setDeleteDialog(null); setInsertDialog(null); }} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.dialogSafe, { width: Math.min(width - 32, 460) }]}>
          {!!deleteDialog && <View accessibilityViewIsModal style={[styles.dialogCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text accessibilityRole="header" style={[styles.dialogTitle, { color: palette.text }]}>Elimina turno · simulazione</Text>
            <Text style={[styles.help, { color: palette.textMuted }]}>{deleteDialog.date.split('-').reverse().join('/')}. Seleziona il servizio preciso; l’eliminazione richiede una conferma finale.</Text>
            {deleteDialog.choices.length > 1 && <ScrollView style={styles.dialogChoices}>
              {deleteDialog.choices.map(record => { const key = chiaveRecordRapido(record); return <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: deleteDialog.selected === key }} accessibilityLabel={`Scegli turno ${formatService(record)}`} onPress={() => toggleDeleteChoice(key)} style={[styles.serviceChoice, { borderColor: deleteDialog.selected === key ? palette.homeAccent : palette.border, backgroundColor: palette.surfaceRaised }]}>
                <Text style={{ color: palette.text }}>{deleteDialog.selected === key ? '✓ ' : ''}{formatService(record)}</Text>
              </Pressable>; })}
            </ScrollView>}
            {deleteDialog.choices.length === 1 && <View style={[styles.serviceChoice, { borderColor: palette.homeAccent, backgroundColor: palette.surfaceRaised }]}><Text style={{ color: palette.text }}>{formatService(deleteDialog.choices[0])}</Text></View>}
            {deleteDialog.choices.length === 0 && <Text style={{ color: palette.textMuted }}>Nessun turno identificabile da eliminare in questa data.</Text>}
            {deleteDialog.invalidCount > 0 && <Text style={{ color: palette.textMuted }}>{deleteDialog.invalidCount} turno/i senza identificativo univoco esclusi.</Text>}
            {!!deleteDialog.selected && <Text accessibilityLiveRegion="polite" style={[styles.help, { color: palette.text }]}>Conferma l’eliminazione del solo servizio selezionato.</Text>}
            <View style={styles.dialogActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Annulla eliminazione" onPress={() => setDeleteDialog(null)} style={[styles.dialogButton, { borderColor: palette.border }]}><Text style={{ color: palette.text }}>Indietro</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Elimina turno" disabled={!deleteDialog.selected} onPress={confirmDelete} style={[styles.dialogButton, { backgroundColor: palette.error, opacity: deleteDialog.selected ? 1 : 0.45 }]}><Text style={{ color: palette.onAccent || '#FFFFFF', fontWeight: '800' }}>Elimina turno</Text></Pressable>
            </View>
          </View>}
          {!!insertDialog && <View accessibilityViewIsModal style={[styles.dialogCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text accessibilityRole="header" style={[styles.dialogTitle, { color: palette.text }]}>{insertDialog.blocked ? 'Turno non inserito' : 'Data già occupata'}</Text>
            <Text style={[styles.help, { color: palette.textMuted }]}>{insertDialog.reason || `La data ${insertDialog.date.split('-').reverse().join('/')} contiene già turni. Non è stato modificato alcun servizio.`}</Text>
            {insertDialog.existing?.map((record, index) => <View key={`${record.id}-${index}`} style={[styles.serviceChoice, { borderColor: palette.border }]}><Text style={{ color: palette.text }}>{formatService(record)}</Text></View>)}
            <View style={styles.dialogActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Scegli un’altra data" onPress={() => setInsertDialog(null)} style={[styles.dialogButton, { borderColor: palette.border }]}><Text style={{ color: palette.text }}>Annulla</Text></Pressable>
              {!insertDialog.blocked && <Pressable accessibilityRole="button" accessibilityLabel="Aggiungi turno senza sovrapposizione" onPress={confirmInsertAlongside} style={[styles.dialogButton, { backgroundColor: palette.homeAccent }]}><Text style={{ color: palette.onAccent || '#FFFFFF', fontWeight: '800' }}>Aggiungi turno</Text></Pressable>}
            </View>
          </View>}
        </SafeAreaView>
      </View>
    </Modal>
    <Modal visible={menu} transparent animationType="none" onRequestClose={() => setMenu(false)}>
      <SafeAreaView style={styles.menuShade}>
        <Pressable accessibilityRole="button" accessibilityLabel="Chiudi menu calendario" onPress={() => setMenu(false)} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.menuBox, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="CONFIGURA TURNI RAPIDI" onPress={() => { setMenu(false); setConfigurazione(true); }} style={styles.menuRow}>
            <Text style={[styles.menuLabel, { color: palette.text }]}>CONFIGURA TURNI RAPIDI</Text><Ionicons name="chevron-forward" size={18} color={testoTema(palette, palette.homeAccent, 3)} />
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
    <Modal visible={configurazione} animationType="none" onRequestClose={() => setConfigurazione(false)}>
      <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}><ScrollView contentContainerStyle={styles.page}>
        {button('Torna al Calendario', 'arrow-back', () => setConfigurazione(false))}
        <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>Configura turni rapidi</Text>
        <Text style={[styles.help, { color: palette.textMuted }]}>Anteprima di sola lettura dei modelli esistenti. La configurazione dei modelli non viene modificata da questa schermata.</Text>
        {turniRapidi.map(t => <View key={t.id} style={[styles.quickPanel, { borderColor: palette.border, backgroundColor: palette.surface }]}>
          <Text style={[styles.quickText, { color: palette.text }]}>{t.nome} · {t.inizio}–{t.fine}</Text>
          <Text style={[styles.help, { color: palette.textMuted }]}>{[t.operativita, t.postazione].filter(Boolean).join(' · ')}</Text>
        </View>)}
      </ScrollView></SafeAreaView>
    </Modal>
    {overlay}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#03081B' }, page: { flexGrow: 1, paddingHorizontal: 12, paddingBottom: 24, maxWidth: 720, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, paddingVertical: 4 }, heading: { flex: 1, minWidth: 76 }, title: { color: '#F2F7FF', fontSize: 22, fontWeight: '800' }, demo: { color: '#B9CBE5', fontSize: 9, marginTop: 3 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, chip: { minHeight: 44, borderWidth: 1, borderColor: '#3A6C9B', borderRadius: 14, paddingHorizontal: 10, justifyContent: 'center', backgroundColor: '#101F3A' }, activeChip: { borderColor: '#89E9FF', backgroundColor: '#1C3054' }, chipText: { color: '#A2E5FF', fontSize: 12, fontWeight: '700' },
  month: { flexDirection: 'row', alignItems: 'center', gap: 4, marginVertical: 8 }, monthTitle: { flex: 1, color: '#F2F7FF', fontSize: 20, fontWeight: '700', textAlign: 'center', textTransform: 'capitalize' },
  summaryCards: {flexDirection:'row',gap:8,marginBottom:10},summaryCard:{flex:1,minWidth:0,paddingHorizontal:6,paddingVertical:7,borderRadius:14,borderWidth:1,backgroundColor:'#0B1530',alignItems:'center',justifyContent:'center',gap:3},summaryLabel:{color:'#CBD8EC',fontSize:10,fontWeight:'600'},summaryValue:{color:'#F2F7FF',fontSize:19,fontWeight:'800'},
  quickPanel: { backgroundColor: '#0B1530', borderWidth: 1, borderColor: '#2F527C', borderRadius: 18, paddingHorizontal: 10, marginBottom: 10 }, panelTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, help: { color: '#C7D6EB', fontSize: 12, flexShrink: 1 }, quickList: { gap: 8, paddingBottom: 4 }, quick: { minHeight: 52, minWidth: 76, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7, alignItems: 'center', justifyContent: 'center', gap: 3 }, quickText: { color: '#F2F7FF', fontSize: 14, fontWeight: '800' }, quickTime: { color: '#BBCDE7', fontSize: 10 }, modeText: { color: '#A4DAEF', fontSize: 11, marginVertical: 8 },
  week: { flexDirection: 'row', marginBottom: 6 }, weekday: { flex: 1, textAlign: 'center', color: '#9DB9DA', fontSize: 11, fontWeight: '700' }, grid: { flexGrow: 1, gap: 4 }, weekRow: { flex: 1, flexDirection: 'row', gap: 3 }, empty: { flex: 1 }, day: { flex: 1, minWidth: 0, borderRadius: 10, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 2, gap: 4, alignItems: 'center' }, dayNumber: { color: '#F2F7FF', fontSize: 14, fontWeight: '700' }, shiftMark: { maxWidth: '100%', borderBottomWidth: 2, paddingBottom: 2 }, shiftLabel: { color:'#BDCCE3',fontSize: 10, fontWeight: '700' },
  undoButton: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12 },
  dialogShade: { flex: 1, backgroundColor: '#0009', justifyContent: 'center', alignItems: 'center', padding: 16 }, dialogSafe: { maxHeight: '90%', justifyContent: 'center' }, dialogCard: { borderRadius: 20, borderWidth: 1, padding: 18, gap: 12, maxHeight: '90%' }, dialogTitle: { fontSize: 21, lineHeight: 27, fontWeight: '800' }, dialogChoices: { maxHeight: 220 }, dialogActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }, dialogButton: { minHeight: 46, minWidth: 116, flexGrow: 1, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  instructions: { fontSize: 15, lineHeight: 22, marginTop: 18, marginBottom: 12, paddingHorizontal: 4, flexShrink: 0 },
  deleteSelection: { gap: 10, paddingVertical: 8 }, serviceChoice: { minHeight: 48, padding: 12, borderWidth: 1, borderRadius: 12, gap: 4 },
  menuShade: { flex: 1, padding: 20, backgroundColor: '#00000099', alignItems: 'flex-end' }, menuBox: { width: '100%', maxWidth: 320, borderRadius: 20, borderWidth: 1, borderColor: '#345C8D', padding: 10, backgroundColor: '#0C1630' }, menuRow: { minHeight: 52, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, menuLabel: { color: '#F2F7FF', flexShrink: 1, fontSize: 15 },
});
