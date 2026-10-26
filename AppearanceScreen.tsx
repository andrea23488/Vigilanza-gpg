import { ThemeEffectsSample } from './ThemeEffects';
import React, { useEffect, useState } from 'react';
import { BackHandler, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { generaPalette, personalizzaAspetto, ripristinaAspetto, TEMI_PREIMPOSTATI, TEMI_SPECIALI, PRESET_TEMI } from './temi';
import { PALETTE_ORIGINALE } from './temi';
import { testoLeggibile, testoSuColore } from './temaSchermate';
type Palette = typeof PALETTE_ORIGINALE;

type Theme = { id: string; nome: string; background: string; accent: string; secondary?: string; special?: boolean; icon?: React.ComponentProps<typeof Ionicons>['name'] };
const STANDARD_THEMES = TEMI_PREIMPOSTATI as readonly Theme[];
const SPECIAL_THEMES = TEMI_SPECIALI as readonly Theme[];
type Preference = { version: number; preset: string; background: string | null; accent: string | null };
type Props = { draft: Preference; saved: Preference; onDraft: (value: Preference) => void; onSave: () => void; onReset: () => void; onPreview: () => void; onBack: () => void; disabled?: boolean; message?: string; backLabel?: string; energy?: boolean; energyReady?: boolean; onEnergy?: (value: boolean) => void };
type ColorChoice = { name: string; value: string };
const BACKGROUNDS: ColorChoice[] = [
  { name: 'Bianco', value: '#FFFFFF' }, { name: 'Grigio chiaro', value: '#E8EDF3' },
  { name: 'Blu notte', value: '#07111F' }, { name: 'Petrolio', value: '#082329' }, { name: 'Grafite', value: '#151A20' },
  { name: 'Ardesia', value: '#182230' }, { name: 'Prugna', value: '#241522' }, { name: 'Notte profonda', value: '#100D20' },
  { name: 'Verde bosco', value: '#10251D' }, { name: 'Carbone', value: '#202833' }, { name: 'Nero', value: '#0B0C10' },
  { name: 'Blu elettrico profondo', value: '#071329' }, { name: 'Notte viola', value: '#120D27' }, { name: 'Oceano profondo', value: '#061D2A' },
  { name: 'Verde smeraldo scuro', value: '#071F1A' }, { name: 'Rosso rubino scuro', value: '#240D17' }, { name: 'Nero e oro', value: '#17130A' },
  { name: 'Halloween', value: '#160B24' }, { name: 'Natale', value: '#08231C' }, { name: 'Verde militare', value: '#1B2217' },
  { name: 'Blu cartoon', value: '#151B35' }, { name: 'Galaxy', value: '#120D2C' }, { name: 'Cyberpunk', value: '#10091F' },
  { name: 'Blu inverno', value: '#111E31' }, { name: 'Nero Gold', value: '#0F0C08' },
];
const ACCENTS: ColorChoice[] = [
  { name: 'Blu elettrico', value: '#168BFF' }, { name: 'Ciano', value: '#55D8FF' }, { name: 'Viola', value: '#9A57FF' },
  { name: 'Magenta', value: '#F15BFF' }, { name: 'Verde', value: '#29C78A' }, { name: 'Smeraldo', value: '#50D89F' },
  { name: 'Oro', value: '#D7B35A' }, { name: 'Ambra', value: '#FCD34D' }, { name: 'Rosso rubino', value: '#EF476F' },
  { name: 'Ghiaccio', value: '#93C5FD' }, { name: 'Rosa', value: '#FDA4AF' }, { name: 'Arancio', value: '#FF7A24' },
  { name: 'Ciano brillante', value: '#5EEBFF' }, { name: 'Acquamarina', value: '#5EEAD4' }, { name: 'Oceano', value: '#18A8C8' },
  { name: 'Lilla', value: '#C4B5FD' }, { name: 'Corallo', value: '#E75057' }, { name: 'Oliva', value: '#A9C17D' },
  { name: 'Fucsia', value: '#FF5CA8' }, { name: 'Lavanda', value: '#A68BFF' }, { name: 'Ciano neon', value: '#00E5FF' },
  { name: 'Ghiaccio chiaro', value: '#9DDCFF' }, { name: 'Oro luminoso', value: '#D9B45B' },
];
const colors = { background: '#03081B', surface: '#0B1730', raised: '#112441', accent: '#67CDFF', text: '#F2F7FF', muted: '#AFC2DE', purple: '#C68BFF', border: '#29496D' };
function same(a: Preference, b: Preference) { return a.preset === b.preset && a.background === b.background && a.accent === b.accent && a.version === b.version; }
function Header({ title, onBack, home = false, palette, backLabel = 'Impostazioni' }: { title: string; onBack: () => void; home?: boolean; palette: Palette; backLabel?: string }) {
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel={home ? 'Torna a Aspetto e colori' : `Torna a ${backLabel}`} onPress={onBack} style={styles.back}>
      <Ionicons name="arrow-back" size={22} color={palette.text} /><Text style={[styles.backText,{color:palette.text}]}>{home ? 'Aspetto e colori' : backLabel}</Text>
    </Pressable>
  </View>;
}
function Swatches({ theme }: { theme: Theme }) {
  return <View style={styles.swatches} accessible={false}>
    {[theme.background, theme.accent, theme.secondary || theme.accent].map((color, index) => <View key={index} style={[styles.swatch, { backgroundColor: color }]} />)}
  </View>;
}
function ThemeCard({ theme, selected, special, onPress, palette, disabled }: { disabled?: boolean; theme: Theme; selected: boolean; special?: boolean; onPress: () => void; palette: Palette }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Tema ${theme.nome}`} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.themeCard,{backgroundColor:palette.surface,borderColor:palette.border},selected&&{borderColor:palette.homeAccent,backgroundColor:palette.surfaceRaised,shadowColor:palette.homeAccent},special&&styles.specialCard]}>
    <View style={styles.themeCardTop}><Swatches theme={theme} />{special && <Ionicons name={theme.icon || 'sparkles-outline'} color={testoLeggibile(theme.secondary || theme.accent,palette,3)} size={16} />}{selected && <Ionicons name="checkmark-circle" color={testoLeggibile(palette.homeAccent,palette,3)} size={17} />}</View>
    <Text numberOfLines={1} style={[styles.themeName,{color:palette.text},selected&&{color:testoLeggibile(palette.homeAccent,palette)}]}>{theme.nome}</Text>
  </Pressable>;
}
export function appearanceLayout(width: number) { return { columns: width < 350 ? 2 : 3, maxWidth: Math.min(width, 600) }; }
export default function AppearanceScreen({ draft, saved, onDraft, onSave, onReset, onPreview, onBack, disabled = false, message = '', backLabel = 'Impostazioni', energy = true, energyReady = false, onEnergy }: Props) {
  const [section, setSection] = useState<'main' | 'background' | 'accent'>('main');
  const [confirmReset, setConfirmReset] = useState(false);
  const notice = message;
  useEffect(() => {
    if (section === 'main' && !confirmReset) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (confirmReset) setConfirmReset(false); else setSection('main');
      return true;
    });
    return () => sub.remove();
  }, [section, confirmReset]);
  const { width } = useWindowDimensions(), insets = useSafeAreaInsets(), dirty = !same(draft, saved), palette = generaPalette(draft) as Palette;
  const selectTheme = (theme: Theme) => { onDraft(personalizzaAspetto({ ...ripristinaAspetto(), preset: theme.id }, { background: null, accent: null })); };
  const chooseColor = (role: 'background' | 'accent', choice: ColorChoice) => {
    onDraft(role === 'background'
      ? personalizzaAspetto(draft, { background: choice.value, accent: draft.accent ?? palette.homeAccent })
      : personalizzaAspetto(draft, { background: draft.background ?? palette.background, accent: choice.value })); setSection('main');
  };
  const sectionTitle = section === 'background' ? 'Sfondo' : 'Cerchio ed evidenze';
  const choices = section === 'background' ? BACKGROUNDS : ACCENTS;
  if (section !== 'main') return <SafeAreaView style={[styles.safe,{backgroundColor:palette.background}]}>
    <Header title={sectionTitle} onBack={() => setSection('main')} home palette={palette} />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(20, insets.bottom + 12), maxWidth: appearanceLayout(width).maxWidth }]}>
      <Text accessibilityRole="header" style={[styles.title,{color:palette.text}]}>{sectionTitle}</Text>
      <Text style={[styles.subtitle,{color:palette.textMuted}]}>Scegli un colore per la tua Home. La modifica resta provvisoria finché non premi Salva colori.</Text>
      <View style={styles.colorGrid}>
        {choices.map(choice => {
          const selected = (section === 'background' ? (draft.background ?? palette.background) : (draft.accent ?? palette.homeAccent)).toUpperCase() === choice.value;
          return <Pressable key={choice.value} accessibilityRole="button" accessibilityLabel={choice.name} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => chooseColor(section, choice)} style={[styles.colorChoice,{backgroundColor:palette.surface,borderColor:palette.border},selected&&{borderColor:palette.homeAccent}]}>
            <View style={[styles.colorDot, { backgroundColor: choice.value }]}>{selected && <Ionicons name="checkmark" color={testoSuColore(choice.value)} size={17} />}</View>
            <Text style={[styles.colorName,{color:palette.text}]}>{choice.name}</Text>
          </Pressable>;
        })}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Annulla scelta colore" disabled={disabled} onPress={() => setSection('main')} style={[styles.secondaryButton,{backgroundColor:palette.surface,borderColor:palette.border}]}><Text style={[styles.secondaryText,{color:palette.text}]}>Indietro</Text></Pressable>
    </ScrollView>
  </SafeAreaView>;
  return <SafeAreaView style={[styles.safe,{backgroundColor:palette.background}]}>
    <Header title="Aspetto e colori" onBack={onBack} palette={palette} backLabel={backLabel} />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(22, insets.bottom + 12), maxWidth: appearanceLayout(width).maxWidth }]}>
      <View style={styles.titleRow}><View style={{ flex: 1 }}><Text accessibilityRole="header" style={[styles.title,{color:palette.text}]}>Aspetto e colori</Text><Text style={[styles.subtitle,{color:palette.textMuted}]}>Personalizza l’app. Le modifiche restano in anteprima finché non premi Salva colori.</Text></View></View>
      <View accessibilityLiveRegion="polite" style={[styles.stateBanner, { backgroundColor: palette.surfaceRaised }]}>
        <Ionicons name={dirty ? 'time-outline' : 'checkmark-circle-outline'} color={testoLeggibile(dirty ? colors.purple : '#60D9AD',palette,3)} size={17} />
        <Text style={[styles.stateText, { color: palette.text }]}>{dirty ? 'MODIFICHE PROVVISORIE · NON SALVATE' : 'COLORI SALVATI SUL DISPOSITIVO'}</Text>
      </View>
      <ThemeEffectsSample preference={draft} />
      {onEnergy && <View style={[styles.manualCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.manualTitle, { flex: 1, color: palette.text }]}>Risparmio energia · Home ed effetti</Text>
        <Switch accessibilityLabel="Risparmio energia, sospende le animazioni della Home e dei temi" accessibilityState={{ disabled: !energyReady }} disabled={!energyReady} value={energy} onValueChange={onEnergy} />
      </View>}
      <View style={styles.sectionHeading}><Text style={[styles.sectionLabel,{color:palette.textMuted}]}>TEMI PREIMPOSTATI</Text><Text style={[styles.sectionHint,{color:palette.textMuted}]}>Seleziona uno stile</Text></View>
      <View style={[styles.themeGrid, { flexDirection: 'row', flexWrap: 'wrap' }]}>
        {STANDARD_THEMES.map(theme => <View key={theme.id} style={{ width: `${100 / appearanceLayout(width).columns}%`, padding: 3 }}><ThemeCard theme={theme} disabled={disabled} palette={palette} selected={draft.preset === theme.id && draft.background === null && draft.accent === null} onPress={() => selectTheme(theme)} /></View>)}
      </View>
      <View style={styles.sectionHeading}><Text style={[styles.sectionLabel,{color:palette.textMuted}]}>TEMI SPECIALI</Text><Text style={[styles.sectionHint,{color:palette.textMuted}]}>Palette e identità dedicate</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.specialRow} accessibilityLabel="Temi speciali scorrevoli">
        {SPECIAL_THEMES.map(theme => <ThemeCard key={theme.id} theme={theme} disabled={disabled} palette={palette} special selected={draft.preset === theme.id && draft.background === null && draft.accent === null} onPress={() => selectTheme(theme)} />)}
      </ScrollView>
      <View style={styles.sectionHeading}><Text style={[styles.sectionLabel,{color:palette.textMuted}]}>PERSONALIZZAZIONE MANUALE</Text></View>
      <View style={styles.manualRows}>
        <Pressable accessibilityRole="button" accessibilityLabel="SFONDO" disabled={disabled} onPress={() => setSection('background')} style={[styles.manualCard,{backgroundColor:palette.surface,borderColor:palette.border}]}>
          <View style={[styles.manualIcon, { backgroundColor: palette.background, borderColor: palette.accent }]}><Ionicons name="contrast-outline" color={testoLeggibile(palette.accent,palette,3)} size={20} /></View>
          <View style={styles.manualCopy}><Text style={[styles.manualTitle,{color:palette.text}]}>SFONDO</Text><Text numberOfLines={1} style={[styles.manualSubtitle,{color:palette.textMuted}]}>Colore base · {BACKGROUNDS.find(item => item.value === (draft.background ?? palette.background))?.name || 'Personalizzato'}</Text></View>
          <Ionicons name="chevron-forward" color={testoLeggibile(palette.homeAccent,palette,3)} size={19} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="CERCHIO ED EVIDENZE" disabled={disabled} onPress={() => setSection('accent')} style={[styles.manualCard,{backgroundColor:palette.surface,borderColor:palette.border}]}>
          <View style={[styles.manualIcon, { borderColor: palette.homeAccent, backgroundColor: palette.surfaceRaised }]}><Ionicons name="color-wand-outline" color={testoLeggibile(palette.homeAccent,palette,3)} size={20} /></View>
          <View style={styles.manualCopy}><Text style={[styles.manualTitle,{color:palette.text}]}>CERCHIO ED EVIDENZE</Text><Text numberOfLines={1} style={[styles.manualSubtitle,{color:palette.textMuted}]}>Accenti · {ACCENTS.find(item => item.value === (draft.accent ?? palette.homeAccent))?.name || 'Personalizzato'}</Text></View>
          <Ionicons name="chevron-forward" color={testoLeggibile(palette.homeAccent,palette,3)} size={19} />
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="ANTEPRIMA APP" accessibilityHint="Apre la Home a schermo intero con la selezione provvisoria" disabled={disabled} onPress={onPreview} style={[styles.previewCard,{backgroundColor:palette.surface,borderColor:palette.border}]}>
        <View style={[styles.previewIcon, { backgroundColor: palette.surfaceRaised }]}><Ionicons name="phone-portrait-outline" color={testoLeggibile(palette.accent,palette,3)} size={22} /></View>
        <View style={styles.manualCopy}><Text style={[styles.manualTitle,{color:palette.text}]}>ANTEPRIMA APP</Text><Text style={[styles.manualSubtitle,{color:palette.textMuted}]}>Apri la Home con colori ed effetti in anteprima</Text></View>
        <Ionicons name="expand-outline" color={testoLeggibile(palette.accent,palette,3)} size={20} />
      </Pressable>
      {!!notice && <Text accessibilityLiveRegion="polite" style={[styles.notice, { color: palette.textMuted }]}>{notice}</Text>}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Salva colori" accessibilityState={{ disabled: disabled || !dirty }} disabled={disabled || !dirty} onPress={onSave} style={[styles.saveButton,{backgroundColor:palette.homeAccent},(disabled || !dirty) && styles.disabledButton]}>
          <Ionicons name="save-outline" color={palette.onAccent} size={18} /><Text style={[styles.saveText,{color:palette.onAccent}]}>Salva colori</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Ripristina colori originali" disabled={disabled} onPress={() => setConfirmReset(true)} style={[styles.resetButton,{borderColor:palette.border,backgroundColor:palette.surface}]}>
          <Ionicons name="refresh-outline" color={palette.textMuted} size={17} /><Text style={[styles.resetText,{color:palette.textMuted}]}>Ripristina colori originali</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Annulla modifiche" disabled={disabled} onPress={onBack} style={[styles.resetButton, { backgroundColor: palette.surface, borderColor: palette.border }]}><Text style={[styles.resetText, { color: palette.text }]}>Annulla modifiche</Text></Pressable>
    </ScrollView>
    <Modal visible={confirmReset} transparent animationType="none" onRequestClose={() => setConfirmReset(false)}>
      <View style={styles.modalShade}><View accessibilityViewIsModal style={[styles.confirmBox, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={[styles.confirmIcon, { backgroundColor: palette.surfaceRaised }]}><Ionicons name="refresh-outline" color={colors.accent} size={24} /></View>
        <Text accessibilityRole="header" style={[styles.confirmTitle, { color: palette.text }]}>Ripristinare i colori originali?</Text>
        <Text style={[styles.confirmBody, { color: palette.textMuted }]}>Il ripristino modifica solo l’anteprima. Premi Salva colori per confermarlo; Annulla mantiene i colori salvati.</Text>
        <View style={styles.confirmActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Annulla ripristino" onPress={() => setConfirmReset(false)} style={[styles.secondaryButton, { backgroundColor: palette.surfaceRaised, borderColor: palette.border }]}><Text style={[styles.secondaryText, { color: palette.text }]}>Annulla</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Conferma ripristino colori" onPress={() => { onReset(); setConfirmReset(false);  }} style={[styles.saveButton, { backgroundColor: palette.accent }]}><Text style={[styles.saveText, { color: palette.onAccent }]}>Ripristina</Text></Pressable>
        </View>
      </View></View>
    </Modal>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, header: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 }, back: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8 }, backText: { color: colors.text, fontSize: 14, fontWeight: '600' }, demo: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  content: { width: '100%', alignSelf: 'center', paddingHorizontal: 15, paddingTop: 2, gap: 4 }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, title: { color: colors.text, fontSize: 25, lineHeight: 31, fontWeight: '800' }, subtitle: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 }, demoBadge: { borderWidth: 1, borderColor: '#7752A1', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 4 }, demoBadgeText: { color: colors.purple, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  stateBanner: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 12, marginTop: 5 }, draftBanner: { backgroundColor: '#271A3B' }, savedBanner: { backgroundColor: '#102B2A' }, stateText: { fontSize: 9, fontWeight: '900', letterSpacing: .6 }, sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8, marginBottom: 2 }, sectionLabel: { color: '#C7D8F1', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, sectionHint: { color: '#8199B8', fontSize: 10 },
  themeGrid: { marginHorizontal: -3 }, themeCard: { minHeight: 53, justifyContent: 'center', gap: 4, borderWidth: 1, borderColor: '#233D5D', borderRadius: 13, backgroundColor: colors.surface, paddingHorizontal: 7, paddingVertical: 6 }, selectedCard: { borderColor: colors.accent, backgroundColor: '#122946', shadowColor: colors.accent, shadowOpacity: .22, shadowRadius: 6, elevation: 2 }, specialCard: { width: 112, minHeight: 62 }, themeCardTop: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 18 }, swatches: { flexDirection: 'row', gap: 4, flex: 1 }, swatch: { width: 13, height: 13, borderRadius: 5, borderWidth: 1, borderColor: '#9BAFC9' }, themeName: { color: '#DFE9F7', fontSize: 10, lineHeight: 13, fontWeight: '700' }, selectedText: { color: '#A9E6FF' }, specialRow: { gap: 7, paddingVertical: 3, paddingRight: 4 },
  manualRows: { gap: 6 }, manualCard: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, manualIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.raised, borderWidth: 1 }, manualCopy: { flex: 1, minWidth: 0 }, manualTitle: { color: colors.text, fontSize: 11, fontWeight: '900', letterSpacing: .35 }, manualSubtitle: { color: colors.muted, fontSize: 10, marginTop: 2 }, previewCard: { minHeight: 53, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: '#526B9C', backgroundColor: '#101D3A', marginTop: 3 }, previewIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A2E54' },
  actions: { gap: 5, marginTop: 6 }, saveButton: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 13, backgroundColor: '#67CDFF', paddingHorizontal: 12 }, saveText: { color: '#05101F', fontSize: 13, fontWeight: '900' }, disabledButton: { opacity: .48 }, resetButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: '#324763', backgroundColor: '#09152A' }, resetText: { color: colors.muted, fontSize: 11, fontWeight: '700' }, notice: { color: '#8FE5C4', fontSize: 11, textAlign: 'center', paddingVertical: 3 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 8 }, colorChoice: { width: '31%', minWidth: 94, flexGrow: 1, minHeight: 80, alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 15, borderWidth: 1, borderColor: '#263E5D', backgroundColor: colors.surface, padding: 8 }, colorDot: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#9BB2D0', alignItems: 'center', justifyContent: 'center' }, colorName: { color: colors.text, fontSize: 11, fontWeight: '700', textAlign: 'center' }, secondaryButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: '#4E6484', backgroundColor: '#111D35' }, secondaryText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  modalShade: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22, backgroundColor: '#000000BB' }, confirmBox: { width: '100%', maxWidth: 420, alignItems: 'center', gap: 12, padding: 20, borderRadius: 22, borderWidth: 1, borderColor: colors.accent, backgroundColor: '#0A1428' }, confirmIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#142945' }, confirmTitle: { color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' }, confirmBody: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' }, confirmActions: { width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 4 },
});
