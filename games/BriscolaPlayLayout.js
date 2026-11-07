import React from 'react';
import { Alert, View, Text, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from './CompactCard';
const text = { color: '#FFF', fontWeight: '700' };
const button = { minWidth: 44, minHeight: 44, paddingHorizontal: 10, justifyContent: 'center', backgroundColor: '#154F3B', borderRadius: 10 };
export default function BriscolaPlayLayout({ onBack, onRestart, briscola, mazzo, manoCpu, manoGiocatore, cartaCpu, cartaGiocatore, puntiCpu, puntiGiocatore, messaggio, fase, onPlay }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const available = height - insets.top - insets.bottom;
  const cardWidth = Math.max(36, Math.min(68, (width - 48) / 3 - 8, (available - 170) / 4.9));
  const cpuWidth = Math.min(38, cardWidth * 0.65);
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#071A12' }}><View testID="briscola-fixed-layout" style={{ flex: 1, minHeight: 0, padding: 8, gap: 5 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Pressable accessibilityRole="button" accessibilityLabel="Indietro" style={button} onPress={onBack}><Text style={text}>‹</Text></Pressable><Text maxFontSizeMultiplier={1.3} style={[text, { flex: 1, textAlign: 'center' }]}>BRISCOLA · TU {puntiGiocatore}–{puntiCpu} CPU</Text><Pressable accessibilityRole="button" accessibilityLabel="Nuova partita" style={button} onPress={() => Alert.alert('Nuova partita', 'Ricominciare la partita?', [{ text: 'Annulla', style: 'cancel' }, { text: 'Ricomincia', onPress: onRestart }])}><Text style={text}>↻</Text></Pressable></View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{briscola && <Card carta={briscola} width={cpuWidth} />}<View style={{ flex: 1 }}><Text maxFontSizeMultiplier={1.3} style={text}>Briscola · {briscola?.semeNome}</Text><Text maxFontSizeMultiplier={1.3} style={text}>Mazzo: {mazzo.length}</Text></View></View>
    <View style={{ flexDirection: 'row', justifyContent: 'center' }}>{manoCpu.map(c => <Card key={c.id} carta={c} width={cpuWidth} coperta />)}</View>
    <View style={{ flex: 1, minHeight: 0, justifyContent: 'center', backgroundColor: '#124C34', borderWidth: 2, borderColor: '#A78C4F', borderRadius: 24 }}><View style={{ flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' }}>{[['CPU', cartaCpu], ['TU', cartaGiocatore]].map(([label, c]) => <View key={label} style={{ alignItems: 'center', gap: 4 }}><Text maxFontSizeMultiplier={1.3} style={text}>{label}</Text>{c ? <Card carta={c} width={cardWidth} /> : <View style={{ width: cardWidth, height: cardWidth * 104 / 68, borderRadius: 8, borderWidth: 1, borderColor: '#62937C', borderStyle: 'dashed' }} />}</View>)}</View></View>
    <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.3} numberOfLines={2} style={[text, { fontSize: 12, textAlign: 'center' }]}>{messaggio}</Text>
    <View style={{ flexDirection: 'row', justifyContent: 'center', paddingVertical: 4 }}>{manoGiocatore.map(c => <Card key={c.id} carta={c} width={cardWidth} disabled={fase !== 'giocatore'} onPress={() => onPlay(c)} />)}</View>
  </View></SafeAreaView>;
}
