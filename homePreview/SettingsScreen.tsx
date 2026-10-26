import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, BackHandler, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SETTINGS_OPTIONS, settingsLayout, type SettingsOptionId } from './settingsOptions';
import { useDemoTheme } from './ThemeContext';

type Props = { onBack: () => void; onSelect: (id: SettingsOptionId) => void };
const colors = { background: '#03081B', surface: '#0C1630', accent: '#67CDFF', text: '#F2F7FF', muted: '#BDCBE1' };
function useMotion() {
  const [reduced, setReduced] = useState(true);
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    let live = true, changed = false;
    const reduce = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { changed = true; if (live) setReduced(value); });
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live && !changed) setReduced(value); }).catch(() => {});
    const app = AppState.addEventListener('change', value => { if (live) setActive(value === 'active'); });
    return () => { live = false; reduce.remove(); app.remove(); };
  }, []);
  return active && !reduced;
}
function useBack(onBack: () => void) {
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; }); return () => sub.remove(); }, [onBack]);
}
function Header({ onBack, detail = false, palette }: { onBack: () => void; detail?: boolean; palette: ReturnType<typeof useDemoTheme>['palette'] }) {
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel={detail ? 'Torna a Impostazioni' : 'Torna alla Home'} onPress={onBack} style={styles.back}>
      <Ionicons name="arrow-back" size={23} color={palette.text} /><Text style={[styles.backText,{color:palette.text}]}>{detail ? 'Impostazioni' : 'Home'}</Text>
    </Pressable><Text style={[styles.demo,{color:palette.homeAccent}]}>DEMO</Text>
  </View>;
}
function SettingsCard({ option, onSelect, motion, minHeight, palette }: { option: typeof SETTINGS_OPTIONS[number]; onSelect: Props['onSelect']; motion: boolean; minHeight: number; palette: ReturnType<typeof useDemoTheme>['palette'] }) {
  const flash = useRef(new Animated.Value(0)).current;
  useEffect(() => { if (!motion) { flash.stopAnimation(); flash.setValue(0); } return () => flash.stopAnimation(); }, [motion, flash]);
  const light = () => {
    if (!motion) return;
    flash.stopAnimation(); flash.setValue(1);
    Animated.timing(flash, { toValue: 0, duration: 260, useNativeDriver: true, isInteraction: false }).start();
  };
  return <Pressable accessibilityRole="button" accessibilityLabel={option.label} accessibilityHint="Apri schermata DEMO, senza operazioni reali"
    onPress={() => onSelect(option.id)} onPressIn={light}
    style={({ pressed }) => [styles.card, { minHeight, opacity: pressed ? 0.88 : 1, backgroundColor: palette.surface, borderColor: palette.border }]}>
    <Animated.View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.flash, { backgroundColor: palette.accent, opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.16] }) }]} />
    <View style={[styles.icon,{backgroundColor:palette.surfaceRaised,borderColor:palette.accent}]}><Ionicons name={option.icon} color={palette.accent} size={24} /></View>
    <Text style={[styles.cardTitle,{color:palette.text}]}>{option.label}</Text><Ionicons name="chevron-forward" color={palette.accent} size={19} />
  </Pressable>;
}
export default function SettingsScreen({ onBack, onSelect }: Props) {
  const motion = useMotion(), { palette } = useDemoTheme();
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = settingsLayout(width, height, insets.top, insets.bottom, fontScale);
  useBack(onBack);
  return <SafeAreaView style={[styles.safe,{backgroundColor:'transparent'}]}>
    <Header onBack={onBack} palette={palette} />
    <ScrollView contentContainerStyle={[styles.content, { maxWidth: layout.contentWidth }]}>
      <Text accessibilityRole="header" style={[styles.title,{color:palette.text}]}>Impostazioni</Text>
      <View style={styles.cards}>{SETTINGS_OPTIONS.map(option => <SettingsCard key={option.id} option={option} onSelect={onSelect} motion={motion} minHeight={layout.rowHeight} palette={palette} />)}</View>
      <Text style={[styles.notice,{color:palette.textMuted}]}>Anteprima · nessuna modifica ai dati</Text>
    </ScrollView>
  </SafeAreaView>;
}
export function SettingsDemoDetail({ optionId, onBack, onHome }: { optionId: SettingsOptionId; onBack: () => void; onHome: () => void }) {
  const option = SETTINGS_OPTIONS.find(item => item.id === optionId)!;
  const [confirmation, setConfirmation] = useState(false);
  const destructive = optionId === 'logout' || optionId === 'delete-account', { palette } = useDemoTheme();
  useBack(onBack);
  return <SafeAreaView style={[styles.safe,{backgroundColor:'transparent'}]}>
    <Header onBack={onBack} detail palette={palette} />
    <ScrollView contentContainerStyle={styles.detail}>
      <View style={[styles.detailIcon,{backgroundColor:palette.surface,borderColor:palette.accent}]}><Ionicons name={option.icon} size={44} color={palette.accent} /></View>
      <Text accessibilityRole="header" style={[styles.detailTitle,{color:palette.text}]}>{option.label}</Text><Text style={[styles.demo,{color:palette.accent}]}>SCHERMATA DEMO</Text>
      <Text style={[styles.detailText,{color:palette.textMuted}]}>{option.description}</Text>
      {destructive && <View style={styles.confirmation}>
        {confirmation ? <>
          <Text accessibilityRole="header" style={[styles.confirmTitle,{color:palette.text}]}>Conferma dimostrativa</Text>
          <Text accessibilityLiveRegion="polite" style={[styles.detailText,{color:palette.textMuted}]}>{optionId === 'delete-account' ? 'In un flusso reale, confermare eliminerebbe definitivamente account e dati associati. Qui non è disponibile alcuna cancellazione.' : 'In un flusso reale, confermare terminerebbe la sessione. Qui non è disponibile alcun logout.'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Annulla conferma DEMO" onPress={() => setConfirmation(false)} style={[styles.outline,{borderColor:palette.accent}]}><Text style={[styles.backText,{color:palette.text}]}>Annulla · nessuna operazione</Text></Pressable>
        </> : <Pressable accessibilityRole="button" accessibilityLabel="Mostra conferma DEMO" onPress={() => setConfirmation(true)} style={[styles.outline,{borderColor:palette.accent}]}><Text style={[styles.backText,{color:palette.text}]}>Mostra conferma · DEMO</Text></Pressable>}
      </View>}
      <Pressable accessibilityRole="button" accessibilityLabel="Torna alla Home" onPress={onHome} style={[styles.outline,{borderColor:palette.accent}]}><Ionicons name="home-outline" size={22} color={palette.accent} /><Text style={[styles.backText,{color:palette.text}]}>Torna alla Home</Text></Pressable>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, gap: 12 },
  back: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }, backText: { color: colors.text, fontSize: 15, fontWeight: '600', flexShrink: 1 }, demo: { color: colors.accent, fontSize: 12, letterSpacing: 2, fontWeight: '700' },
  content: { flexGrow: 1, width: '100%', alignSelf: 'center', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  title: { color: colors.text, fontSize: 28, lineHeight: 34, fontWeight: '800', marginBottom: 12 },
  cards: { gap: 8 }, card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 18, borderWidth: 1, borderColor: '#345C8D', backgroundColor: colors.surface, shadowColor: '#299FFF', shadowOpacity: 0.14, shadowRadius: 9, shadowOffset: { width: 0, height: 2 } },
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#112C4B', alignItems: 'center', justifyContent: 'center', borderColor: '#356F9F', borderWidth: 1 },
  flash: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 18, backgroundColor: colors.accent },
  cardTitle: { flex: 1, flexShrink: 1, color: colors.text, fontSize: 13, fontWeight: '800', lineHeight: 18, letterSpacing: 0.25 },
  notice: { color: colors.muted, fontSize: 12, lineHeight: 16, textAlign: 'center', marginTop: 12 },
  detail: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, maxWidth: 560, width: '100%', alignSelf: 'center' },
  detailIcon: { padding: 24, borderRadius: 32, backgroundColor: '#112340', borderWidth: 1, borderColor: '#356F9F' },
  detailTitle: { fontSize: 23, fontWeight: '800', textAlign: 'center', color: colors.text }, detailText: { color: colors.muted, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  confirmation: { gap: 16, width: '100%' }, confirmTitle: { color: colors.text, fontSize: 19, fontWeight: '700', textAlign: 'center' },
  outline: { minHeight: 52, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: colors.accent, borderRadius: 16 },
});
