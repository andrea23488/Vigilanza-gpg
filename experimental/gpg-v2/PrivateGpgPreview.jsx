import React from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import viewModelModule from './viewModel.cjs';

// Presentazione privata: nessun accesso a turni, API, storage o logging.
export default function PrivateGpgPreview({ operator, result, onClose, onRequestComparison, canRun = false }) {
  if (operator !== 'gpg') return null;
  const model = viewModelModule.buildViewModel(result);
  const runnable = canRun && typeof onRequestComparison === 'function';
  const row = (label, value) => <View style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
  return <ScrollView contentContainerStyle={styles.container}>
    <Text accessibilityRole="header" style={styles.title}>{model.title}</Text>
    <Text style={styles.notice}>{model.subtitle}</Text>
    <Text style={styles.period}>{model.period}</Text>
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.section}>Sistema attuale</Text>
      {row('Lordo del mese', model.currentGross)}
      {row('Netto stimato attuale', model.currentNet)}
    </View>
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.section}>Motore 2.0 · sperimentale</Text>
      <Text style={styles.notice}>{model.status}</Text>
      {row('Lordo 2.0', model.newGross)}
      {row('Differenza lorda 2.0 − attuale', model.grossDifference)}
      {row('Netto 2.0', model.newNet)}
      {row('Ore retribuite normalizzate', model.paid)}
      {row('Ordinarie', model.ordinary)}
      {row('Straordinarie', model.overtime)}
      {model.reasons.map(reason => <Text key={reason} style={styles.reason}>{reason}</Text>)}
    </View>
    <Text style={styles.notice}>{model.dataNotice}</Text>
    <Pressable accessibilityRole="button" onPress={onClose} style={styles.button}>
      <Text style={styles.buttonText}>Torna al sistema attuale</Text>
    </Pressable>
  </ScrollView>;
}
const styles = StyleSheet.create({
  container: { padding: 20, gap: 16, backgroundColor: '#f4f6fa' },
  title: { fontSize: 24, fontWeight: '700', color: '#13243d' },
  period: { fontSize: 16, fontWeight: '600', color: '#13243d' },
  notice: { fontSize: 14, lineHeight: 21, color: '#43536b' },
  card: { padding: 16, borderRadius: 14, backgroundColor: '#ffffff', gap: 12 },
  section: { fontSize: 18, fontWeight: '700', color: '#13243d' },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  label: { fontSize: 14, color: '#43536b', flexShrink: 1 },
  value: { fontSize: 15, fontWeight: '600', color: '#13243d' },
  reason: { fontSize: 14, lineHeight: 21, color: '#714900' },
  button: { padding: 16, borderRadius: 12, backgroundColor: '#173c6b', alignItems: 'center' },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.45 },
});
