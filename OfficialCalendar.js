import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { caricaTurniRapidi, salvaTurniRapidi } from './turniRapidi';
const Button = ({ title, onPress, selected, disabled }) => <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected, disabled: !!disabled }} disabled={disabled} onPress={onPress} style={[styles.button, selected && styles.selected, disabled && { opacity: 0.4 }]}><Text style={styles.text}>{title}</Text></Pressable>;

export default function OfficialCalendar({ anno, mese, records, coordinator, onBack, onPrevious, onNext, onDay, onRefresh, summary }) {
  const [models, setModels] = useState([]);
  const [mode, setMode] = useState(null);
  const [state, setState] = useState(coordinator.getState());
  const [edit, setEdit] = useState(null);
  const [deleteDay, setDeleteDay] = useState(null);
  const [selected, setSelected] = useState([]);
  const lock = useRef(false);
  useEffect(() => { let live = true; caricaTurniRapidi().then(rows => { if (live) setModels(rows); }); return () => { live = false; }; }, []);
  useEffect(() => { setState(coordinator.getState()); return coordinator.subscribe(setState); }, [coordinator]);
  useEffect(() => { setDeleteDay(null); setSelected([]); }, [anno, mese, mode]);
  const monthRows = records.filter(t => Number(t.anno) === anno && Number(t.mese) === mese + 1);
  const dayRows = monthRows.filter(t => Number(t.giorno) === deleteDay && t.tipo === 'turno');
  const changeMode = value => { if (!state.busy) { setMode(value); setDeleteDay(null); setSelected([]); } };
  const tap = async day => {
    if (state.busy || lock.current) return;
    if (!mode) { onDay(day); return; }
    if (mode === 'delete') {
      const choices = monthRows.filter(t => Number(t.giorno) === day && t.tipo === 'turno');
      if (!choices.length) { Alert.alert('Nessun servizio', 'Questa giornata non contiene turni lavorativi da eliminare.'); return; }
      if (choices.length === 1) { confirmRemove(choices.map(t => ({ ...t }))); return; }
      setDeleteDay(day); setSelected([]); return;
    }
    const model = models.find(t => t.id === mode);
    lock.current = true;
    try { await coordinator.inserisci(model, `${anno}-${String(mese + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`); }
    catch { Alert.alert('Inserimento non completato', 'Controlla la connessione e aggiorna il calendario prima di riprovare.'); }
    finally { lock.current = false; }
  };
  const confirmRemove = expected => {
    if (state.busy || lock.current) return;
    if (!expected.length) return;
    Alert.alert('Elimina i servizi selezionati', expected.map(t => `${t.giorno}/${t.mese} · ${t.inizio}–${t.fine} · ${t.luogo || 'Servizio'}`).join('\n') + '\n\nGli altri servizi rimangono invariati.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        if (lock.current) return;
        lock.current = true;
        try {
          const result = await coordinator.eliminaSelezionati(expected);
          if (result.status === 'deleted') { setDeleteDay(null); setSelected([]); }
          else if (result.completed?.length) setSelected(ids => ids.filter(id => !result.completed.map(String).includes(id)));
        } finally { lock.current = false; }
      } },
    ]);
  };
  const saveModel = async () => {
    if (!edit?.nome?.trim() || !/^([01]\d|2[0-3]):[0-5]\d$/.test(edit.inizio) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(edit.fine) || edit.inizio === edit.fine) {
      Alert.alert('Campi obbligatori', 'Inserisci nome e orari diversi nel formato HH:MM. Operatività e postazione sono facoltative.'); return;
    }
    try { const rows = await salvaTurniRapidi(models.some(m => m.id === edit.id) ? models.map(m => m.id === edit.id ? edit : m) : [...models, edit]); setModels(rows); setEdit(null); }
    catch { Alert.alert('Salvataggio non riuscito', 'Il modello non è stato aggiornato. Riprova.'); }
  };
  const first = (new Date(anno, mese, 1).getDay() + 6) % 7;
  const days = new Date(anno, mese + 1, 0).getDate();
  return <SafeAreaView style={styles.root}><ScrollView contentContainerStyle={{ padding: 12 }}>
    <Button title="‹ Home" onPress={onBack} />
    <View style={styles.row}><Button title="‹" onPress={onPrevious} disabled={state.busy} /><Text style={[styles.text, { flex: 1, textAlign: 'center', fontSize: 19 }]}>{new Date(anno, mese, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</Text><Button title="›" onPress={onNext} disabled={state.busy} /></View>
    <Text style={styles.label}>{Number(summary?.ore || 0).toLocaleString('it-IT')} ore · {Number(summary?.extra || 0).toLocaleString('it-IT')} extra · {summary?.notti || 0} notti</Text>
    <Text style={styles.label}>Turni rapidi · scegli un modello, poi tocca la data</Text>
    <ScrollView horizontal contentContainerStyle={{ gap: 6 }}><Button title="Apri giornata" selected={!mode} onPress={() => changeMode(null)} />{models.map(m => <Button key={m.id} title={m.nome} selected={mode === m.id} disabled={state.busy} onPress={() => changeMode(m.id)} />)}<Button title="Elimina" selected={mode === 'delete'} onPress={() => changeMode('delete')} /></ScrollView>
    <Button title="Gestisci turni rapidi" disabled={state.busy} onPress={() => setEdit(edit ? null : { ...(models.find(m => m.id === mode) || models[0]) })} />
    {edit && <View style={styles.panel}><Text style={styles.label}>Modello · Operatività vuota = Servizio</Text>
      <ScrollView horizontal>{models.map(m => <Button key={m.id} title={m.nome} onPress={() => setEdit({ ...m })} />)}<Button title="+ Nuovo" onPress={() => setEdit({ id: `rapido_${Date.now()}`, nome: '', inizio: '', fine: '', operativita: '', postazione: '' })} /></ScrollView>
      {[['nome', 'Nome *'], ['inizio', 'Inizio HH:MM *'], ['fine', 'Fine HH:MM *'], ['operativita', 'Operatività (facoltativa)'], ['postazione', 'Postazione (facoltativa)']].map(([field, label]) => <View key={field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={edit[field] || ''} onChangeText={value => setEdit(current => ({ ...current, [field]: value }))} style={styles.input} /></View>)}
      <Button title="Salva modello" onPress={saveModel} /><Button title="Chiudi" onPress={() => setEdit(null)} /></View>}
    <View style={styles.grid}>{['L','M','M','G','V','S','D'].map((d,i) => <Text key={`w${i}`} style={styles.week}>{d}</Text>)}{Array.from({ length: first + days }, (_, i) => {
      const day = i - first + 1;
      if (day < 1) return <View key={i} style={styles.cell} />;
      const rows = monthRows.filter(t => Number(t.giorno) === day);
      return <Pressable key={i} accessibilityRole="button" accessibilityLabel={`${day}, ${rows.length} servizi`} disabled={state.busy} onPress={() => tap(day)} style={[styles.cell, rows.length > 0 && { backgroundColor: '#153453' }, deleteDay === day && styles.selected]}><Text style={styles.text}>{day}</Text>{rows.slice(0, 2).map(t => <Text key={t.id} numberOfLines={1} style={styles.time}>{t.tipo === 'turno' ? String(t.inizio).slice(0,5) : t.tipo}</Text>)}{rows.length > 2 && <Text style={styles.time}>+{rows.length - 2}</Text>}</Pressable>;
    })}</View>
    {deleteDay != null && <View style={styles.panel}><Text style={styles.label}>Seleziona i servizi del {deleteDay}/{mese + 1}</Text>{dayRows.map(t => <Button key={t.id} selected={selected.includes(String(t.id))} title={`${selected.includes(String(t.id)) ? '✓ ' : ''}${t.inizio}–${t.fine} · ${t.luogo || 'Servizio'}`} disabled={state.busy} onPress={() => setSelected(ids => ids.includes(String(t.id)) ? ids.filter(id => id !== String(t.id)) : [...ids, String(t.id)])} />)}<Button title="Elimina selezionati" disabled={!selected.length || state.busy} onPress={() => confirmRemove(dayRows.filter(t => selected.includes(String(t.id))).map(t => ({ ...t })))} /></View>}
    {!!state.message && <Text accessibilityLiveRegion="polite" style={styles.label}>{state.message}</Text>}
    {state.uncertain && <Button title="Verifica esito sul server" onPress={() => coordinator.verificaEsito()} disabled={state.busy} />}
    <Button title="↻ Aggiorna calendario" onPress={onRefresh} disabled={state.busy} />
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#07142F' }, text: { color: '#FFF', fontWeight: '700' }, label: { color: '#CEDBEC', marginVertical: 10 }, button: { minHeight: 44, padding: 10, backgroundColor: '#18304D', borderRadius: 10, justifyContent: 'center', marginVertical: 3 }, selected: { borderWidth: 2, borderColor: '#5CE1F0' }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, grid: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 12 }, week: { width: '14.2857%', color: '#AFC0D7', textAlign: 'center', paddingVertical: 8 }, cell: { width: '14.2857%', minHeight: 67, borderWidth: 1, borderColor: '#29405F', borderRadius: 7, padding: 4 }, time: { color: '#A5E6EE', fontSize: 10 }, panel: { padding: 10, borderRadius: 12, backgroundColor: '#10243D' }, input: { color: '#FFF', borderWidth: 1, borderColor: '#557088', padding: 10, borderRadius: 8, minHeight: 44 } });
