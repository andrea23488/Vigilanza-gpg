import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SHIFT_COLORS, validateDraft, type AgendaAction, type AgendaState, type QuickDraft } from './calendarModel';
import { useDemoTheme } from './ThemeContext';

type Props = { state: AgendaState; dispatch: React.Dispatch<AgendaAction>; onBack: () => void; onHome: () => void };
const blank = (): QuickDraft => ({ label: '', start: '06:00', end: '14:00', type: 'turno', color: SHIFT_COLORS[0] });
export default function QuickShiftEditor({ state, dispatch, onBack, onHome }: Props) {
  const { palette } = useDemoTheme();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<QuickDraft>(blank);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const reset = () => { setEditing(null); setDraft(blank()); setError(''); };
  const save = () => {
    const problem = validateDraft(draft); if (problem) { setError(problem); return; }
    dispatch({ type: 'save', draft, ...(editing ? { id: editing } : {}) });
    setNotice('Modello aggiornato solo nella DEMO.'); reset();
  };
  return <SafeAreaView style={[styles.safe,{backgroundColor:'transparent'}]}><KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Torna all’Agenda" onPress={onBack} style={styles.back}><Ionicons name="arrow-back" size={22} color={palette.homeAccent} /><Text style={[styles.text,{color:palette.text}]}>Agenda</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Torna alla Home" onPress={onHome} style={styles.back}><Ionicons name="home-outline" size={22} color={palette.homeAccent} /></Pressable></View>
      <Text accessibilityRole="header" style={[styles.title,{color:palette.text}]}>Configura turni rapidi</Text>
      <Text style={[styles.demo,{color:palette.homeAccent}]}>DEMO · modifiche solo in memoria</Text>
      <Text style={[styles.help,{color:palette.textMuted}]}>Crea un modello oppure selezionane uno da modificare. Le frecce cambiano l’ordine.</Text>
      {state.templates.length === 0 && <Text style={[styles.help,{color:palette.textMuted}]}>Nessun modello. Puoi aggiungerne uno qui sotto.</Text>}
      {state.templates.map((t, index) => <View key={t.id} style={[styles.template, { borderColor: editing === t.id ? palette.homeAccent : palette.border, backgroundColor: palette.surface }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Modifica ${t.label}`} onPress={() => { setEditing(t.id); setDraft({ label: t.label, start: t.start, end: t.end, type: t.type, color: t.color }); setError(''); setNotice(''); }} style={styles.templateCopy}><Text style={[styles.label, { color: t.color }]}>{t.label}</Text><Text style={[styles.help,{color:palette.textMuted}]}>{t.type === 'turno' ? `${t.start}–${t.end}` : t.type}</Text></Pressable>
        <>
          <Pressable accessibilityRole="button" accessibilityLabel={`Sposta su ${t.label}`} accessibilityState={{ disabled: index === 0 }} disabled={index === 0} onPress={() => dispatch({ type: 'move', id: t.id, delta: -1 })} style={[styles.control, { borderColor: palette.border }, index === 0 && styles.disabled]}><Ionicons name="arrow-up" size={20} color={palette.homeAccent} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Sposta giù ${t.label}`} accessibilityState={{ disabled: index === state.templates.length - 1 }} disabled={index === state.templates.length - 1} onPress={() => dispatch({ type: 'move', id: t.id, delta: 1 })} style={[styles.control, { borderColor: palette.border }, index === state.templates.length - 1 && styles.disabled]}><Ionicons name="arrow-down" size={20} color={palette.homeAccent} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Elimina modello ${t.label}`} onPress={() => { dispatch({ type: 'remove', id: t.id }); if (editing === t.id) reset(); setNotice('Modello rimosso dalla DEMO; le date già assegnate restano invariate.'); }} style={styles.control}><Ionicons name="trash-outline" size={20} color="#F58EAC" /></Pressable>
        </>
      </View>)}
      <View style={[styles.form,{backgroundColor:palette.surface,borderColor:palette.border}]}>
        <Text accessibilityRole="header" style={[styles.label,{color:palette.text}]}>{editing ? 'Modifica modello DEMO' : 'Nuovo modello DEMO'}</Text>
        {editing && <Pressable accessibilityRole="button" accessibilityLabel="Prepara nuovo turno rapido" onPress={reset} style={[styles.button,{borderColor:palette.border}]}><Text style={[styles.text,{color:palette.text}]}>Aggiungi un altro modello</Text></Pressable>}
        <Text style={[styles.help,{color:palette.textMuted}]}>Etichetta</Text><TextInput accessibilityLabel="Etichetta turno rapido" value={draft.label} onChangeText={label => setDraft(d => ({ ...d, label }))} maxLength={24} placeholder="Es. Aeroporto sera" placeholderTextColor="#8FA7C9" style={[styles.input,{color:palette.text,backgroundColor:palette.background,borderColor:palette.border}]} />
        <Text style={[styles.help,{color:palette.textMuted}]}>Tipo</Text><View style={styles.types}>{(['turno', 'riposo', 'ferie'] as const).map(type => <Pressable key={type} accessibilityRole="button" accessibilityLabel={`Tipo ${type}`} accessibilityState={{ selected: draft.type === type }} onPress={() => setDraft(d => ({ ...d, type }))} style={[styles.button,{borderColor:palette.border},draft.type === type && {borderColor:palette.homeAccent,backgroundColor:palette.surfaceRaised}]}><Text style={[styles.text,{color:palette.text}]}>{type}</Text></Pressable>)}</View>
        {draft.type === 'turno' && <View style={styles.times}>
          <View style={styles.timeField}><Text style={[styles.help,{color:palette.textMuted}]}>Inizio · HH:MM</Text><TextInput accessibilityLabel="Orario inizio" value={draft.start} onChangeText={start => setDraft(d => ({ ...d, start }))} autoCorrect={false} maxLength={5} style={[styles.input,{color:palette.text,backgroundColor:palette.background,borderColor:palette.border}]} /></View>
          <View style={styles.timeField}><Text style={[styles.help,{color:palette.textMuted}]}>Fine · HH:MM</Text><TextInput accessibilityLabel="Orario fine" value={draft.end} onChangeText={end => setDraft(d => ({ ...d, end }))} autoCorrect={false} maxLength={5} style={[styles.input,{color:palette.text,backgroundColor:palette.background,borderColor:palette.border}]} /></View>
        </View>}
        <Text style={[styles.help,{color:palette.textMuted}]}>Colore</Text><View style={styles.types}>{SHIFT_COLORS.map((color, i) => <Pressable key={color} accessibilityRole="button" accessibilityLabel={`Colore ${i + 1}`} accessibilityState={{ selected: draft.color === color }} onPress={() => setDraft(d => ({ ...d, color }))} style={[styles.color, { backgroundColor: color, borderColor: draft.color === color ? palette.text : palette.surface }]}>{draft.color === color && <Ionicons name="checkmark" size={20} color={palette.background} />}</Pressable>)}</View>
        {!!error && <Text accessibilityRole="alert" style={[styles.error,{color:palette.error}]}>{error}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel="Salva modello DEMO" onPress={save} style={[styles.button, { borderColor: palette.homeAccent, backgroundColor: palette.surfaceRaised }]}><Text style={[styles.text,{color:palette.text}]}>{editing ? 'Salva modifiche · DEMO' : 'Aggiungi turno rapido · DEMO'}</Text></Pressable>
      </View>
      {!!notice && <Text accessibilityLiveRegion="polite" style={[styles.help,{color:palette.textMuted}]}>{notice}</Text>}
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#03081B' }, page: { padding: 16, gap: 12, width: '100%', maxWidth: 640, alignSelf: 'center', paddingBottom: 32 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, back: { minHeight: 44, minWidth: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#F2F7FF', fontSize: 26, fontWeight: '800' }, demo: { color: '#67CDFF', fontSize: 12, fontWeight: '700' }, help: { color: '#BDCCE3', fontSize: 13, lineHeight: 19 }, text: { color: '#F2F7FF', fontSize: 14, fontWeight: '600' }, label: { color: '#F2F7FF', fontSize: 16, fontWeight: '700' },
  template: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', padding: 10, borderRadius: 16, borderWidth: 1, backgroundColor: '#0B1530', gap: 2 }, templateCopy: { flex: 1, minWidth: 90, minHeight: 48, justifyContent: 'center', gap: 4 }, control: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.35 },
  form: { backgroundColor: '#0C1630', borderWidth: 1, borderColor: '#315586', borderRadius: 20, padding: 14, gap: 10 }, input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#45618C', padding: 12, color: '#F2F7FF', fontSize: 16, backgroundColor: '#071127' },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, timeField: { flex: 1, minWidth: 100, gap: 6 }, types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, button: { minHeight: 44, borderWidth: 1, borderColor: '#385579', borderRadius: 12, padding: 12, alignItems: 'center', justifyContent: 'center' }, selected: { borderColor: '#8CE1FF', backgroundColor: '#1A3151' }, color: { width: 44, height: 44, borderWidth: 3, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, error: { color: '#FFB2C9', fontSize: 14 },
});
