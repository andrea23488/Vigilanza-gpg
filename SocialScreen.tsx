import { testoTema } from './temi';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, BackHandler, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SOCIAL_OPTIONS, type SocialOptionId } from './socialOptions';
import { PALETTE_ORIGINALE } from './temi';
type Palette = typeof PALETTE_ORIGINALE;

type Props = { onBack: () => void; onSelect: (id: SocialOptionId) => void; paletteHome?: Palette | null };
// Stesso layout approvato della preview, con la tavolozza globale dell’app.
const colors = { background: '#03081B', surface: '#0C1230', accent: '#CE8DFF', text: '#F6F2FF', muted: '#C2BED8' };
function usePressMotion() {
  const [reduced, setReduced] = useState(true);
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    let live = true, changed = false;
    const reduce = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { changed = true; if (live) setReduced(value); });
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live && !changed) setReduced(value); }).catch(() => {});
    const state = AppState.addEventListener('change', value => { if (live) setActive(value === 'active'); });
    return () => { live = false; reduce.remove(); state.remove(); };
  }, []);
  return active && !reduced;
}
function SocialCard({ option, onSelect, motion, palette }: { option: typeof SOCIAL_OPTIONS[number]; onSelect: Props['onSelect']; motion: boolean; palette: Palette }) {
  const { fontScale } = useWindowDimensions();
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => { if (!motion) { scale.stopAnimation(); scale.setValue(1); } return () => scale.stopAnimation(); }, [motion, scale]);
  const animate = (value: number) => {
    if (motion) Animated.spring(scale, { toValue: value, speed: 28, bounciness: 2, useNativeDriver: true, isInteraction: false }).start();
  };
  return <Animated.View style={[styles.cardFrame, { minHeight: 104 * Math.max(1, fontScale), transform: [{ scale }] }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={option.label} accessibilityHint="Apri sezione"
      onPress={() => onSelect(option.id)} onPressIn={() => animate(0.985)} onPressOut={() => animate(1)}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1, backgroundColor: palette.surface, borderColor: palette.border, shadowColor: palette.homeAccent }]}>
      <View pointerEvents="none" style={[styles.neonLine,{backgroundColor:palette.homeAccent}]} />
      <View style={[styles.icon,{backgroundColor:palette.surfaceRaised,borderColor:palette.accent}]}><Ionicons name={option.icon} color={testoTema(palette, palette.homeAccent, 3)} size={29} /></View>
      <View style={styles.cardCopy}><Text style={[styles.cardTitle,{color:palette.text}]}>{option.label}</Text><Text style={[styles.description,{color:palette.textMuted}]}>{option.description}</Text></View>
      <Ionicons name="chevron-forward" size={20} color={testoTema(palette, palette.homeAccent, 3)} />
    </Pressable>
  </Animated.View>;
}
function useBack(onBack: () => void) {
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; }); return () => sub.remove(); }, [onBack]);
}
function Header({ onBack, detail = false, palette }: { onBack: () => void; detail?: boolean; palette: Palette }) {
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel={detail ? 'Torna al menu Social' : 'Torna alla Home'} onPress={onBack} style={styles.back}>
      <Ionicons name="arrow-back" size={23} color={palette.text} /><Text style={[styles.backText,{color:palette.text}]}>{detail ? 'Social' : 'Home'}</Text>
    </Pressable>
    
  </View>;
}
export default function SocialScreen({ onBack, onSelect, paletteHome }: Props) {
  const motion = usePressMotion(), palette = paletteHome || PALETTE_ORIGINALE;
  const { height } = useWindowDimensions();
  useBack(onBack);
  return <SafeAreaView style={[styles.safe,{backgroundColor:palette.background}]}>
    <Header onBack={onBack} palette={palette} />
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: height < 650 ? 4 : 16 }]}>
      <View style={styles.heading}><Text accessibilityRole="header" style={[styles.title,{color:palette.text}]}>Social</Text><Text style={[styles.subtitle,{color:palette.textMuted}]}>Il tuo spazio con i colleghi</Text></View>
      <View style={styles.cards}>{SOCIAL_OPTIONS.map(option => <SocialCard key={option.id} option={option} motion={motion} onSelect={onSelect} palette={palette} />)}</View>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 4, minHeight: 56 },
  back: { minHeight: 48, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }, backText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  demo: { color: colors.accent, fontSize: 12, letterSpacing: 2, fontWeight: '700' },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 12, width: '100%', maxWidth: 560, alignSelf: 'center' },
  heading: { marginBottom: 18 }, title: { color: colors.text, fontSize: 34, fontWeight: '800' }, subtitle: { color: colors.muted, fontSize: 15, marginTop: 5 },
  cards: { flexGrow: 1, gap: 12, justifyContent: 'center' }, cardFrame: { flexGrow: 1, flexBasis: 104 },
  card: { flex: 1, minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: '#6D4199', shadowColor: '#A251EF', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 3 } },
  neonLine: { position: 'absolute', left: 22, right: 22, top: 0, height: 1, backgroundColor: colors.accent, opacity: 0.6 },
  icon: { width: 48, height: 48, borderRadius: 16, borderWidth: 1, borderColor: '#7547A3', backgroundColor: '#24163E', alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, flexShrink: 1 }, cardTitle: { color: colors.text, fontSize: 14, fontWeight: '800', letterSpacing: 0.4 }, description: { color: colors.muted, fontSize: 12, marginTop: 5, lineHeight: 17 },
  notice: { color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: 16 },
  detail: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 18, maxWidth: 560, width: '100%', alignSelf: 'center' },
  detailIcon: { padding: 24, borderRadius: 36, backgroundColor: '#21153B', borderWidth: 1, borderColor: '#7547A3' },
  detailTitle: { color: colors.text, fontWeight: '800', fontSize: 24, textAlign: 'center' }, detailText: { color: colors.muted, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  homeButton: { minHeight: 52, padding: 16, gap: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.accent, borderRadius: 16 },
});
