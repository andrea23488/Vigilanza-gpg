import comparison from './experimental/gpg-v2/officialComparison.cjs';
import viewModel from './experimental/gpg-v2/viewModel.cjs';
import React from 'react';
import { ScrollView, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { oreRetribuiteTurno } from './turniCalcoli';
import { SUPPORT_EMAIL } from './FeedbackScreen';
export default function GpgComparisonScreen({ records, accountId, year, monthIndex, grossEuro, netEstimateEuro, onBack }) {
  const rows = records.filter(t => t.user_id === accountId && Number(t.anno) === year && Number(t.mese) === monthIndex + 1 && t.tipo === 'turno');
  const hours = rows.reduce((sum, t) => sum + oreRetribuiteTurno(t), 0);
  const result = comparison.officialComparison({ records, accountId, year, monthIndex, grossEuro, netEstimateEuro });
  const reasons = viewModel.buildViewModel(result).reasons;
  const style = { color: '#D1DDED', fontSize: 15, lineHeight: 23 };
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#07142F' }}><ScrollView contentContainerStyle={{ padding: 18, gap: 16 }}>
    <Pressable onPress={onBack} style={{ minHeight: 44 }}><Text style={style}>‹ Stipendio</Text></Pressable>
    <Text style={[style, { fontSize: 22, color: '#FFF' }]}>GPG 2.0 · non attivo</Text>
    <Text style={style}>{monthIndex + 1}/{year} · {new Set(rows.map(t => t.giorno)).size} giornate · {hours.toLocaleString('it-IT')} ore</Text>
    <Text style={style}>Sistema attuale: lordo € {Number(grossEuro || 0).toLocaleString('it-IT', {minimumFractionDigits:2})} · netto indicativo € {Number(netEstimateEuro || 0).toLocaleString('it-IT', {minimumFractionDigits:2})}.</Text>
    <Text style={style}>Il codice 2.0 recuperato comprende classificazione delle ore e calcolo del lordo con regole esplicite. Il calcolo fiscale ordinario 2025–2026 è implementato e testato, ma mancano un profilo contrattuale approvato, i dati fiscali personali e la validazione su cedolini reali. Il calcolo attuale rimane operativo.</Text>
    <Text style={style}>Per una stima 2.0 servono: azienda, CCNL e decorrenza, livello, base e divisore, regole di maggiorazione e cumulo, indennità spettanti, contributi, imponibili, detrazioni, addizionali e conguagli. Le sole ore del calendario non determinano queste voci.</Text>
    <Text style={style}>Il confronto con un cedolino richiede le singole righe, unità e quantità, imponibile previdenziale e fiscale, contributi, IRPEF, detrazioni, addizionali, arretrati e arrotondamenti. Puoi inviare una copia anonimizzata all’assistenza {SUPPORT_EMAIL}.</Text>
    {reasons.map(reason => <Text key={reason} style={style}>• {reason}</Text>)}
    {!!result.fiscal?.issues?.length && <Text style={style}>Per il netto mancano aliquota contributiva documentata, reddito annuo previsto, giorni e politiche di detrazione, addizionali e altre trattenute del periodo, oltre alla verifica dei regimi speciali. Nessuna aliquota personale viene presunta.</Text>}
    <Text style={style}>Netto 2.0: non calcolabile con i dati disponibili. La precisione di € 20–30 non è ancora validata. Nessuna correzione fissa viene applicata.</Text>
  </ScrollView></SafeAreaView>;
}
