import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import NapoletanaCard from './NapoletanaCard';
import { pagineTavolo } from './layoutMinigiochi';

// Adattatore locale: riutilizza integralmente carte, asset e callback originali.
function Carta({ carta, width, piccola = false, ...props }) {
  const { width: viewportWidth } = useWindowDimensions();
  const baseWidth = Math.min(piccola ? 68 : 86, Math.max(58, (viewportWidth - 72) / 3));
  const baseHeight = Math.round(baseWidth * (piccola ? 104 / 68 : 132 / 86));
  const scale = width / baseWidth;
  const height = baseHeight * scale;
  return <View style={{ width: width + 8, height, alignItems: 'center' }}>
    <View style={{ position: 'absolute', width: baseWidth + 8, height: baseHeight,
      left: (width + 8 - baseWidth - 8) / 2, top: (height - baseHeight) / 2, transform: [{ scale }] }}>
      <NapoletanaCard carta={carta} piccola={piccola} {...props} />
    </View>
    {!props.coperta && carta.seme === 'denari' && carta.valore === 7 && <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 3, right: 3, borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 8 }} />}
  </View>;
}
const text = { color: '#FFFFFF', fontWeight: '800' };
const button = { minHeight: 44, minWidth: 44, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0E4A37', borderRadius: 10 };

export default function ScopaPlayLayout({ onBack, manoCpu, manoGiocatore, tavolo, messaggio,
  bloccato, puntiGiocatore, puntiCpu, scopeGiocatore, scopeCpu, preseGiocatore, preseCpu,
  onPlay, fine, partitaFinita = false, summary, action }) {
  const viewport = useWindowDimensions();
  const [area, setArea] = useState({ width: viewport.width - 16, height: 180 });
  const [page, setPage] = useState(0);
  const [details, setDetails] = useState(false);
  useEffect(() => { if (fine) setDetails(false); }, [fine]);
  const grid = pagineTavolo(area.width, area.height, tavolo.length, Math.min(viewport.fontScale, 1.5));
  const current = Math.min(page, grid.pages - 1);
  const handWidth = Math.min(viewport.height < 700 ? 68 : 86, (viewport.width - 32) / 3 - 8);
  // Come nella versione precedente, l'esito è visibile a fine mano senza aprire finestre.
  if (fine && summary) return <View testID="scopa-summary-layout" style={{ flex: 1, minHeight: 0, padding: 12, gap: 8 }}>
    <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
      <Text accessibilityRole="header" style={[text, { fontSize: 24, textAlign: 'center' }]}>
        {partitaFinita ? 'RISULTATO FINALE' : 'RISULTATO SMAZZATA'}
      </Text>
      <Text accessibilityLiveRegion="polite" style={[text, { fontSize: 18, textAlign: 'center', marginVertical: 12 }]}>{messaggio}</Text>
      <Text style={[text, { fontSize: 22, textAlign: 'center', marginBottom: 12 }]}>TU {puntiGiocatore} – CPU {puntiCpu}</Text>
      {summary}
    </ScrollView>
    <View testID="scopa-summary-actions">{action}</View>
    <TouchableOpacity onPress={onBack} accessibilityLabel="Torna alla Sala Giochi" style={button}>
      <Text style={text}>Torna alla Sala Giochi</Text>
    </TouchableOpacity>
  </View>;
  return <View testID="scopa-fixed-layout" style={{ flex: 1, minHeight: 0, paddingHorizontal: 8, paddingBottom: 4, gap: 6, justifyContent: 'center' }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <TouchableOpacity onPress={onBack} accessibilityLabel="Indietro" style={button}><Text maxFontSizeMultiplier={1.5} style={text}>‹</Text></TouchableOpacity>
      <Text maxFontSizeMultiplier={1.5} style={[text, { flex: 1, textAlign: 'center', fontSize: 15 }]}>SCOPA · {puntiGiocatore}–{puntiCpu}</Text>
      <TouchableOpacity onPress={() => setDetails(true)} accessibilityLabel="Punteggi e dettagli Scopa" style={button}><Text maxFontSizeMultiplier={1.5} style={text}>{fine ? 'Esito' : 'ⓘ'}</Text></TouchableOpacity>
    </View>
    <Text maxFontSizeMultiplier={1.5} accessibilityLiveRegion="polite" numberOfLines={1} accessibilityLabel={messaggio} style={[text, { fontSize: 12, textAlign: 'center' }]}>{messaggio}</Text>
    <View testID="scopa-cpu" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <Text maxFontSizeMultiplier={1.5} style={[text, { fontSize: 12 }]}>CPU</Text>
      {manoCpu.map(carta => <Carta key={carta.id} carta={carta} width={30} coperta piccola retroLabel="SCOPA" />)}
    </View>
    <View testID="scopa-table-area" onLayout={({ nativeEvent: { layout } }) => setArea(layout)} style={{ flex: 1, maxHeight: Math.min(300, viewport.height * 0.44), minHeight: 0, borderRadius: 26, borderWidth: 4, borderColor: '#85653E', backgroundColor: '#145637', padding: 5, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8 }}>
      <View style={{ flex: 1, minHeight: 0, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'center', justifyContent: 'center', padding: 4, rowGap: 6 }}>
        {tavolo.slice(current * grid.capacity, (current + 1) * grid.capacity).map(carta => <Carta key={carta.id} carta={carta} width={grid.cardWidth} piccola />)}
        {!tavolo.length && <Text maxFontSizeMultiplier={1.5} style={text}>Tavolo vuoto</Text>}
      </View>
      <View testID="scopa-table-pages" style={{ minHeight: grid.pagerHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity accessibilityLabel="Pagina precedente del tavolo" disabled={current === 0} onPress={() => setPage(current - 1)} style={[button, { opacity: current === 0 ? 0.4 : 1 }]}><Text maxFontSizeMultiplier={1.5} style={text}>‹</Text></TouchableOpacity>
        <Text maxFontSizeMultiplier={1.5} style={[text, { fontSize: 12, flex: 1, textAlign: 'center' }]}>{tavolo.length} carte · {current + 1}/{grid.pages}</Text>
        <TouchableOpacity accessibilityLabel="Pagina successiva del tavolo" disabled={current + 1 >= grid.pages} onPress={() => setPage(current + 1)} style={[button, { opacity: current + 1 >= grid.pages ? 0.4 : 1 }]}><Text maxFontSizeMultiplier={1.5} style={text}>›</Text></TouchableOpacity>
      </View>
    </View>
    <View testID="scopa-hand" style={{ flexDirection: 'row', justifyContent: 'center' }}>
      {manoGiocatore.map(carta => <Carta key={carta.id} carta={carta} width={handWidth} disabled={bloccato} onPress={() => onPlay(carta)} />)}
    </View>
    <View testID="scopa-actions">{action}</View>
    <Modal visible={details} transparent onRequestClose={() => setDetails(false)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#071A12' }}>
        <TouchableOpacity onPress={() => setDetails(false)} style={button}><Text maxFontSizeMultiplier={1.5} style={text}>Torna al tavolo</Text></TouchableOpacity>
        <ScrollView contentContainerStyle={{ padding: 12 }}>
          <Text style={[text, { fontSize: 18 }]}>Prima a 11 · TU {puntiGiocatore} – CPU {puntiCpu}</Text>
          <Text style={text}>Prese: TU {preseGiocatore}, CPU {preseCpu}. Scope: TU {scopeGiocatore}, CPU {scopeCpu}.</Text>
          <Text style={text}>{messaggio}</Text>
          {fine && summary}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </View>;
}
