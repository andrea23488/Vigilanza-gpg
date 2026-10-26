import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { STATI_ANTEPRIMA_RAPIDI } from './turniRapidiAnteprima';

const data = key => key.split('-').reverse().join('/');
const servizio = t => `${t.inizio}–${t.fine}${t.luogo ? ` · ${t.luogo}` : ''}${t.postazione ? ` · ${t.postazione}` : ''}`;

export default function TurniRapidiPreview({ plan, warning = '', disabledReason = '', confirmLabel = 'Conferma simulazione', realMode = false, palette, onToggleRecord, onConfirm, onCancel }) {
  if (!plan) return null;
  const text = { color: palette.text }, muted = { color: palette.textMuted };
  return <Modal visible animationType="none" onRequestClose={onCancel}>
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text accessibilityRole="header" style={[styles.title, text]}>{realMode ? 'Elimina turni selezionati' : plan.mode === 'delete' ? 'Elimina turni · simulazione' : 'Applica turni · simulazione'}</Text>
        <Text style={muted}>{realMode ? 'Controlla i singoli servizi prima di confermare.' : 'Solo anteprima: la conferma non salva e non elimina dati reali.'}</Text>
        {!!disabledReason && <Text accessibilityLiveRegion="polite" style={[styles.reason, text]}>{disabledReason}</Text>}
        {!!warning && <Text accessibilityLiveRegion="assertive" style={[styles.reason, text]}>{warning}</Text>}
        {plan.model && <View style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}>
          <Text style={[styles.heading, text]}>{plan.model.nome} · {plan.model.inizio}–{plan.model.fine}</Text>
          {!!plan.model.operativita && <Text style={text}>{plan.model.operativita}</Text>}
          <Text style={muted}>Postazione: {plan.model.postazione || 'non specificata'}</Text>
        </View>}
        <Text accessibilityLiveRegion="polite" style={[styles.heading, text]}>{plan.rows.length} date · {plan.operationCount} operazioni proposte · {plan.blocked} date da verificare</Text>
        {plan.rows.map(row => <View key={row.date} style={[styles.card, { borderColor: row.blocked ? palette.error : palette.border, backgroundColor: palette.surface }]}>
          <Text accessibilityRole="header" style={[styles.heading, text]}>{data(row.date)}</Text>
          <Text style={muted}>{row.states.map(s => STATI_ANTEPRIMA_RAPIDI[s]).join(' · ')}</Text>
          {row.candidate && <Text style={text}>Aggiunta proposta: {row.candidate.tipo === 'turno' ? servizio(row.candidate) : row.candidate.tipo}. I record esistenti restano invariati.</Text>}
          {row.conflicts.map((t, i) => <Text key={`${t.key}-${i}`} style={text}>Conflitto: {data(t.date)} · {t.tipo === 'turno' ? servizio(t) : t.tipo}</Text>)}
          {plan.mode === 'delete' && row.choices.map((t, i) => <Pressable key={`${t.key}-${i}`} accessibilityRole="checkbox"
            accessibilityLabel={`Elimina servizio ${t.id || 'senza ID'} del ${data(row.date)}, ${servizio(t)}`}
            accessibilityState={{ checked: t.selected, disabled: !t.identifiable }} disabled={!t.identifiable}
            onPress={() => onToggleRecord(t.key)} style={[styles.choice, { borderColor: t.selected ? palette.homeAccent : palette.border, backgroundColor: palette.surfaceRaised }]}>
            <Text style={text}>{t.selected ? '☑' : '☐'} {servizio(t)} · ID {t.id || 'non disponibile'}</Text>
            {!t.identifiable && <Text style={muted}>Identificativo mancante o ambiguo: operazione non consentita.</Text>}
          </Pressable>)}
          {!!row.reason && <Text accessibilityLiveRegion="polite" style={[styles.reason, text]}>{row.reason}</Text>}
        </View>)}
        <Pressable accessibilityRole="button" accessibilityLabel={confirmLabel} accessibilityState={{ disabled: !plan.canConfirm || !!disabledReason }} disabled={!plan.canConfirm || !!disabledReason}
          onPress={onConfirm} style={[styles.button, { backgroundColor: palette.homeAccent, opacity: plan.canConfirm && !disabledReason ? 1 : 0.45 }]}>
          <Text style={{ color: palette.onAccent || palette.text }}>{confirmLabel}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Annulla e torna al Calendario" onPress={onCancel} style={[styles.button, { borderWidth: 1, borderColor: palette.border }]}>
          <Text style={text}>Annulla e torna al Calendario</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, page: { padding: 16, gap: 12, width: '100%', maxWidth: 720, alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: '800' }, heading: { fontSize: 15, fontWeight: '700' },
  card: { padding: 12, borderRadius: 16, borderWidth: 1, gap: 8 },
  choice: { minHeight: 48, borderWidth: 1, borderRadius: 10, padding: 10, gap: 4 },
  reason: { fontWeight: '600' }, button: { minHeight: 48, borderRadius: 12, padding: 12, alignItems: 'center', justifyContent: 'center' },
});
