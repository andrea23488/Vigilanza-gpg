import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PALETTE_ORIGINALE, testoTema } from './temi';
import TurniRapidiPreview from './TurniRapidiPreview';
import { alternaDataRapida, chiaveDataRapida, creaAnteprimaRapidi } from './turniRapidiAnteprima';
import { celleMeseCalendario, trascinamentoCalendario, swipeCalendario } from './calendarioVista';

// Presentazione dei dati dell'app. Nessun archivio, payload o servizio di scrittura.
export default function CalendarScreen({ anno, mese, records, impegniPersonali,
  filtroAgenda, giornoSelezionato, summary, turniRapidi, paletteHome, tuttiTurni = records,
  onManualDay, onSelectDay, onMonthChange, onBack, nomeTipo, children, overlay, operazioniRapide = null }) {
  const palette = paletteHome || PALETTE_ORIGINALE;
  const { fontScale } = useWindowDimensions();
  const [menu, setMenu] = useState(false);
  const [configurazione, setConfigurazione] = useState(false);
  const [panel, setPanel] = useState(false);
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');
  const [dates, setDates] = useState([]);
  const [targets, setTargets] = useState([]);
  const [preview, setPreview] = useState(null);
  const [rapidState, setRapidState] = useState(operazioniRapide ? operazioniRapide.getState() : {busy:false,lastId:null});
  useEffect(() => {
    if (!operazioniRapide) return undefined;
    setRapidState(operazioniRapide.getState());
    return operazioniRapide.subscribe(setRapidState);
  }, [operazioniRapide]);

  const resetSelection = () => { setSelected(null); setDates([]); setTargets([]); setPreview(null); setNotice(''); };
  const chooseModel = id => {
    if (id !== selected) { setSelected(id); setTargets([]); setPreview(null); }
    setNotice('');
  };
  const prepare = (chosenTargets = targets) => creaAnteprimaRapidi({
    mode: selected === 'delete' ? 'delete' : 'insert',
    model: selected === 'delete' ? null : turniRapidi.find(t => t.id === selected),
    dates, targets: chosenTargets, records: tuttiTurni,
  });
  const toggleRecord = key => {
    const next = targets.includes(key) ? targets.filter(t => t !== key) : [...targets, key];
    setTargets(next);
    setPreview({ plan: prepare(next), warning: '' });
  };
  const confirmSimulation = async () => {
    if (!preview) return;
    const fresh = prepare();
    if (JSON.stringify(fresh) !== JSON.stringify(preview.plan)) {
      setPreview({ plan: fresh, warning: 'I dati disponibili sono cambiati. Ricontrolla il riepilogo e conferma di nuovo.' });
      return;
    }
    if (!fresh.canConfirm) return;
    if (operazioniRapide) {
      if (!rapidState.canDelete || fresh.mode !== 'delete') return;
      const ids = fresh.rows.flatMap(r => r.operations.map(t => String(t.id)));
      const expected = tuttiTurni.filter(t => ids.includes(String(t.id)));
      const result = await operazioniRapide.eliminaSelezionati(expected);
      if (result.status === 'deleted') { setPreview(null); setDates([]); setTargets([]); }
      return;
    }

    // Solo messaggio e stato visuale: nessuna chiamata a salvataggi o cancellazioni.
    setNotice(`Simulazione completata: ${fresh.operationCount} operazioni su ${fresh.rows.length} date. Nessun dato reale è stato modificato.`);
    setPreview(null); setDates([]); setTargets([]);
  };
  const suppressTap = useRef(0);
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_event, gesture) => trascinamentoCalendario(gesture.dx, gesture.dy),
    onPanResponderGrant: () => { suppressTap.current = Date.now() + 350; },
    onPanResponderMove: () => { suppressTap.current = Date.now() + 350; },
    onPanResponderRelease: (_event, gesture) => {
      suppressTap.current = Date.now() + 350;
      const delta = swipeCalendario(gesture.dx, gesture.dy);
      if (delta) onMonthChange(delta);
    },
    onPanResponderTerminate: () => { suppressTap.current = Date.now() + 350; },
    onPanResponderTerminationRequest: () => true,
  }), [onMonthChange]);
  const cells = celleMeseCalendario(anno, mese);
  const title = new Date(anno, mese, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  const today = new Date();
  const previewNotice = operazioniRapide ? 'Seleziona un modello e tocca una data per salvarlo. Elimina resta una modalità separata.' : 'Seleziona un modello e le date. La conferma è solo una simulazione. Nessun turno viene salvato o eliminato.';
  const dayPress = async day => {
    if (Date.now() < suppressTap.current) return;
    if (panel) {
      if (!selected) { setNotice('Scegli prima un modello oppure Elimina. Nessun turno viene salvato o eliminato.'); return; }
      const key = chiaveDataRapida(anno, mese, day);
      if (operazioniRapide && selected !== 'delete') {
        if (rapidState.busy) return;
        setNotice('');
        try { await operazioniRapide.inserisci(turniRapidi.find(t => t.id === selected), key); }
        catch { setNotice('Operazione non completata. Verifica l’elenco prima di riprovare.'); }
        return;
      }

      setDates(current => alternaDataRapida(current, key));
      if (dates.includes(key)) setTargets(current => current.filter(t => !t.startsWith(`${key}|`)));
      setPreview(null); setNotice('');
    } else {
      onManualDay(day);
    }
  };
  const button = (label, icon, action) => <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={action} style={styles.iconButton}>
    <Ionicons name={icon} size={23} color={testoTema(palette, palette.homeAccent, 3)} />
  </Pressable>;
  return <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
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
        <View style={styles.panelTitle}><Text style={[styles.help, { color: palette.text }]}>{operazioniRapide ? 'Turni rapidi' : 'Turni rapidi · anteprima senza salvataggio'}</Text>
          {button('Chiudi turni rapidi', 'close', () => { setPanel(false); resetSelection(); })}</View>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.quickList}>
          {turniRapidi.map(t => <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={`${operazioniRapide ? 'Turno rapido' : 'Anteprima turno rapido'} ${t.nome}, ${t.inizio} ${t.fine}`}
            accessibilityState={{ selected: selected === t.id }} onPress={() => chooseModel(t.id)}
            style={[styles.quick, { borderColor: palette.homeAccent, borderWidth: selected === t.id ? 2 : 1, backgroundColor: palette.surfaceRaised }]}>
            <Text style={[styles.quickText, { color: palette.text }]}>{selected === t.id ? '✓ ' : ''}{t.nome}</Text>
            <Text style={[styles.quickTime, { color: palette.textMuted }]}>{t.inizio}–{t.fine}</Text>
          </Pressable>)}
          <Pressable accessibilityRole="button" accessibilityLabel={operazioniRapide ? 'Elimina · selezione dei servizi' : 'Elimina · anteprima senza cancellazioni'} accessibilityState={{ selected: selected === 'delete' }}
            onPress={() => chooseModel('delete')} style={[styles.quick, { borderColor: palette.error, backgroundColor: palette.surfaceRaised }]}>
            <Ionicons name="trash-outline" size={20} color={palette.error} /><Text style={[styles.quickText, { color: palette.text }]}>Elimina</Text>
          </Pressable>
        </ScrollView>
        <Text accessibilityLiveRegion="polite" style={[styles.help, { color: palette.textMuted }]}>{notice || rapidState.message || previewNotice}</Text>
        {(!operazioniRapide || selected === 'delete') && <Text testID="rapid-selection-count" accessibilityLiveRegion="polite" style={[styles.help, { color: palette.text }]}>{dates.length} date selezionate</Text>}
        {!!selected && (!operazioniRapide || selected === 'delete') && dates.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel={selected === 'delete' ? 'Rivedi eliminazioni' : 'Applica turni'}
          onPress={() => setPreview({ plan: prepare(), warning: '' })} style={[styles.menuRow, { backgroundColor: palette.surfaceRaised, borderRadius: 12 }]}>
          <Text style={[styles.quickText, { color: testoTema(palette, palette.homeAccent) }]}>{selected === 'delete' ? 'Rivedi eliminazioni' : 'Applica turni'}</Text>
          <Ionicons name="chevron-forward" size={20} color={testoTema(palette, palette.homeAccent, 3)} />
        </Pressable>}
        {operazioniRapide && rapidState.uncertain && <Pressable accessibilityRole="button" accessibilityLabel="Verifica esito" disabled={rapidState.busy}
          onPress={() => operazioniRapide.verificaEsito()} style={styles.menuRow}><Text style={{color:testoTema(palette, palette.homeAccent)}}>Verifica esito</Text></Pressable>}
        {operazioniRapide && rapidState.lastId != null && <>
          <Pressable accessibilityRole="button" accessibilityLabel="ANNULLA ultimo inserimento" accessibilityState={{disabled:!rapidState.canUndo}} disabled={!rapidState.canUndo}
            onPress={() => operazioniRapide.annulla()} style={styles.menuRow}><Text style={{color:palette.textMuted}}>ANNULLA ultimo inserimento</Text></Pressable>
          {!rapidState.canUndo && <Text style={[styles.help,{color:palette.textMuted}]}>{rapidState.deleteReason}</Text>}
        </>}
      </View>}
      <View style={styles.week}>{['LU', 'MA', 'ME', 'GI', 'VE', 'SA', 'DO'].map(day => <Text key={day} style={[styles.weekday, { color: palette.textMuted }]}>{day}</Text>)}</View>
      <View testID="calendar-grid" {...pan.panHandlers} style={styles.grid}>
        {Array.from({ length: cells.length / 7 }, (_, week) => <View key={week} style={styles.weekRow}>
          {cells.slice(week * 7, week * 7 + 7).map((day, column) => {
            if (!day) return <View key={`empty-${column}`} style={styles.empty} />;
            const work = !panel && filtroAgenda === 'personale' ? [] : records.filter(t => Number(t.giorno) === day);
            const personal = filtroAgenda === 'lavoro' ? [] : impegniPersonali.filter(t => Number(t.giorno) === day);
            const labels = work.map(t => t.tipo === 'turno' ? `${t.inizio}–${t.fine}` : nomeTipo(t.tipo));
            const isToday = day === today.getDate() && mese === today.getMonth() && anno === today.getFullYear();
            const rapidSelected = panel && (!operazioniRapide || selected === 'delete') && dates.includes(chiaveDataRapida(anno, mese, day));
            const active = panel ? rapidSelected : Number(giornoSelezionato) === day;
            return <Pressable key={day} testID={`calendar-day-${day}`} accessibilityRole="button"
              accessibilityLabel={`${day} ${title}, ${labels.length ? labels.join('; ') : 'nessun turno'}${personal.length ? `, ${personal.length} impegni personali` : ''}`}
              disabled={!!operazioniRapide && rapidState.busy} accessibilityState={{ selected: active, busy: !!operazioniRapide && rapidState.busy && rapidState.pendingDate === chiaveDataRapida(anno,mese,day) }} accessibilityHint={panel ? (operazioniRapide && selected !== 'delete' ? 'Inserisci il modello selezionato senza sovrascrivere servizi esistenti' : 'Seleziona o deseleziona la data da rivedere') : 'Apri il modulo originale o scegli un turno. Tieni premuto per selezionare la giornata nella timeline'}
              onPress={() => dayPress(day)} onLongPress={() => { if (!panel) onSelectDay(day); }} style={({ pressed }) => [styles.day, { minHeight: 56 * Math.max(1, fontScale), borderWidth: rapidSelected ? 2 : 1, borderColor: active || isToday ? palette.homeAccent : palette.border, backgroundColor: pressed || active ? palette.surfaceRaised : palette.surface }]}>
              <Text style={[styles.dayNumber, { color: isToday ? palette.homeAccent : palette.text }]}>{day}</Text>
              {operazioniRapide && rapidState.busy && rapidState.pendingDate === chiaveDataRapida(anno,mese,day) && <ActivityIndicator testID="rapid-saving" size="small" color={palette.homeAccent} />}
              {operazioniRapide && rapidState.status === 'saved' && work.some(t => String(t.id) === String(rapidState.lastId)) && <Ionicons name="checkmark-circle" size={16} color={testoTema(palette, palette.homeAccent, 3)} />}
              {rapidSelected && <Ionicons name="checkmark-circle" size={16} color={testoTema(palette, palette.homeAccent, 3)} />}
              {!!labels.length && <View style={[styles.shiftMark, { borderColor: palette.homeAccent }]}><Text numberOfLines={1} style={[styles.shiftLabel, { color: palette.text }]}>{labels[0]}</Text></View>}
              {labels.length > 1 && <Text style={[styles.shiftLabel, { color: palette.textMuted }]}>+{labels.length - 1}</Text>}
              {!!personal.length && <Ionicons name="calendar-outline" size={13} color={palette.homeAccentSecondary || palette.homeAccent} />}
            </Pressable>;
          })}
        </View>)}
      </View>
      <Text style={[styles.help, { color: palette.textMuted }]}>Tocca una data per inserire o modificare un turno. Tieni premuto per selezionare la giornata nella timeline.</Text>
      {children}
    </ScrollView>
    <TurniRapidiPreview plan={preview?.plan || null} warning={preview?.warning || ''} palette={palette}
      confirmLabel={operazioniRapide ? 'Conferma eliminazione' : 'Conferma simulazione'} disabledReason={operazioniRapide && !rapidState.canDelete ? rapidState.deleteReason : ''}
      realMode={!!operazioniRapide} onToggleRecord={toggleRecord} onConfirm={confirmSimulation} onCancel={() => setPreview(null)} />
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
  safe: { flex: 1, backgroundColor: '#03081B' }, page: { flexGrow: 1, paddingHorizontal: 12, paddingBottom: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, paddingVertical: 4 }, heading: { flex: 1, minWidth: 76 }, title: { color: '#F2F7FF', fontSize: 22, fontWeight: '800' }, demo: { color: '#B9CBE5', fontSize: 9, marginTop: 3 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, chip: { minHeight: 44, borderWidth: 1, borderColor: '#3A6C9B', borderRadius: 14, paddingHorizontal: 10, justifyContent: 'center', backgroundColor: '#101F3A' }, activeChip: { borderColor: '#89E9FF', backgroundColor: '#1C3054' }, chipText: { color: '#A2E5FF', fontSize: 12, fontWeight: '700' },
  month: { flexDirection: 'row', alignItems: 'center', gap: 4, marginVertical: 8 }, monthTitle: { flex: 1, color: '#F2F7FF', fontSize: 20, fontWeight: '700', textAlign: 'center', textTransform: 'capitalize' },
  summaryCards: {flexDirection:'row',gap:8,marginBottom:10},summaryCard:{flex:1,minWidth:0,paddingHorizontal:6,paddingVertical:7,borderRadius:14,borderWidth:1,backgroundColor:'#0B1530',alignItems:'center',justifyContent:'center',gap:3},summaryLabel:{color:'#CBD8EC',fontSize:10,fontWeight:'600'},summaryValue:{color:'#F2F7FF',fontSize:19,fontWeight:'800'},
  quickPanel: { backgroundColor: '#0B1530', borderWidth: 1, borderColor: '#2F527C', borderRadius: 18, paddingHorizontal: 10, marginBottom: 10 }, panelTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, help: { color: '#C7D6EB', fontSize: 12, flexShrink: 1 }, quickList: { gap: 8, paddingBottom: 4 }, quick: { minHeight: 52, minWidth: 76, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7, alignItems: 'center', justifyContent: 'center', gap: 3 }, quickText: { color: '#F2F7FF', fontSize: 14, fontWeight: '800' }, quickTime: { color: '#BBCDE7', fontSize: 10 }, modeText: { color: '#A4DAEF', fontSize: 11, marginVertical: 8 },
  week: { flexDirection: 'row', marginBottom: 6 }, weekday: { flex: 1, textAlign: 'center', color: '#9DB9DA', fontSize: 11, fontWeight: '700' }, grid: { flexGrow: 1, gap: 4 }, weekRow: { flex: 1, flexDirection: 'row', gap: 3 }, empty: { flex: 1 }, day: { flex: 1, minWidth: 0, borderRadius: 10, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 2, gap: 4, alignItems: 'center' }, dayNumber: { color: '#F2F7FF', fontSize: 14, fontWeight: '700' }, shiftMark: { maxWidth: '100%', borderBottomWidth: 2, paddingBottom: 2 }, shiftLabel: { color:'#BDCCE3',fontSize: 10, fontWeight: '700' },
  menuShade: { flex: 1, padding: 20, backgroundColor: '#00000099', alignItems: 'flex-end' }, menuBox: { width: '100%', maxWidth: 320, borderRadius: 20, borderWidth: 1, borderColor: '#345C8D', padding: 10, backgroundColor: '#0C1630' }, menuRow: { minHeight: 52, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, menuLabel: { color: '#F2F7FF', flexShrink: 1, fontSize: 15 },
});
