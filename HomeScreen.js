import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, findNodeHandle, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ElectricConnections from './ElectricConnections';
import { coloriCircuiti } from './homeElectric';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PALETTE_ORIGINALE, testoTema, notificaRisparmioHome } from './temi';
import { avanzamentoMeseHome, formattaValoreHome, geometriaHome, servizioHome } from './homeModel';
import { AnimatedCoreRings, Atmosphere, CoinGlyph, NeonDisc, PhotoFade } from './HomeArtwork';

const ENERGY_KEY = '@vigilanza_home_risparmio_v1';

function NeonButton({ label, icon, onPress, palette, size = 48, motion, style, children, hint, accent = palette.homeAccent, orbital = false }) {
  const scale = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!motion) { scale.stopAnimation(); scale.setValue(1); flash.stopAnimation(); flash.setValue(0); }
    return () => { scale.stopAnimation(); flash.stopAnimation(); };
  }, [motion, scale, flash]);
  const light = () => {
    if (!motion) return;
    flash.stopAnimation(); flash.setValue(1);
    Animated.timing(flash, { toValue: 0, duration: 240, useNativeDriver: true, isInteraction: false }).start();
  };
  const animate = value => {
    if (motion) Animated.spring(scale, { toValue: value, speed: 28, bounciness: 2, useNativeDriver: true, isInteraction: false }).start();
  };
  return <Animated.View style={[style, { transform: [{ scale }] }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint}
      onPress={onPress} onPressIn={() => { light(); animate(0.97); }} onPressOut={() => animate(1)}
      style={({ pressed }) => [styles.button, { width: size, height: orbital ? size * 1.16 : size, opacity: pressed ? 0.8 : 1 }]}>
      {orbital && <View pointerEvents="none" style={StyleSheet.absoluteFill}><NeonDisc size={size} color={accent} /></View>}
      <Animated.View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, borderWidth: 2, borderRadius: size / 2,
          borderColor: accent, backgroundColor: accent, opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.3] }),
          transform: [{ scale: flash.interpolate({ inputRange: [0, 1], outputRange: [1.1, 1] }) }] }} />
      {children || <>
        <View style={orbital ? {position:'absolute',top:size*0.24,alignSelf:'center'} : undefined}>
          {icon === 'coins' ? <CoinGlyph size={size*0.36} color={accent} /> : <Ionicons name={icon} size={orbital ? size*0.36 : 25} color={orbital ? accent : palette.text} />}
        </View>
        {orbital && <Text numberOfLines={1} style={[styles.buttonLabel, {color:'#FFFFFF',top:size*0.80,fontSize:Math.max(11,size*0.145)}]}>{label}</Text>}
      </>}
    </Pressable>
  </Animated.View>;

}

export default function HomeScreen({ paletteHome, profilo, fotoProfilo, numeroNotifiche, turni,
  ore, extra, notti, periodo, monthlySummary = null, onProfile, onNotifications, onSocial, onSettings, onCalendar, onNavigate, onColleghi, onAddShift, etaServizio, etaServizioLoading, etaTurno, backgroundPhoto = null, transparentThemeBackground = false, decorationLayer = null }) {
  const palette = paletteHome || PALETTE_ORIGINALE;
  const colors = useMemo(() => coloriCircuiti(palette), [palette]);
  const { fontScale, height } = useWindowDimensions();
  const tight = height < 700;
  const [now, setNow] = useState(() => new Date());
  const [active, setActive] = useState(AppState.currentState === 'active');
  // Fail closed until accessibility and the saved energy preference are loaded.
  const [reduced, setReduced] = useState(true);
  const [energy, setEnergy] = useState(true);
  const [ready, setReady] = useState(false);
  const [menu, setMenu] = useState(null);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const menuTitleRef = useRef(null);
  const motion = active && !reduced && !energy && ready && !menu;
  const service = servizioHome(turni, now);
  const g = geometriaHome(area.width, area.height, fontScale);
  const summary = monthlySummary || { month: periodo, hours: `${formattaValoreHome(ore)}h`, extra: `${formattaValoreHome(extra)}h`, days: '—', progress: null };
  const monthlyProgress = Number.isInteger(summary.year) && Number.isInteger(summary.monthIndex)
    ? avanzamentoMeseHome(summary.year, summary.monthIndex, now) : summary.progress;
  const progress = typeof monthlyProgress === 'number' && Number.isFinite(monthlyProgress) ? Math.min(100, Math.max(0, monthlyProgress)) : null;
  const compactText = g.diameter < 230 || (fontScale > 1.25 && g.diameter < 280);
  const shift = service.turno;
  const shiftTime = shift?.tipo === 'turno' ? `${shift.inizio} – ${shift.fine}` : String(shift?.tipo || 'Nessun turno').toUpperCase();
  const place = shift?.luogo || shift?.indirizzo_servizio || 'Postazione non indicata';

  useEffect(() => {
    let live = true, accessibilityChanged = false;
    const reducedListener = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { accessibilityChanged = true; if (live) setReduced(value); });
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live && !accessibilityChanged) setReduced(value); }).catch(() => {});
    AsyncStorage.getItem(ENERGY_KEY).then(value => { if (live) { setEnergy(value === '1'); setReady(true); } }).catch(() => { if (live) setReady(true); });
    const stateListener = AppState.addEventListener('change', state => { if (live) { setActive(state === 'active'); setNow(new Date()); } });
    return () => { live = false; reducedListener.remove(); stateListener.remove(); };
  }, []);
  useEffect(() => {
    if (!active) return undefined;
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, [active]);

  const navigate = screen => { setMenu(null); onNavigate(screen); };
  const toggleEnergy = value => {
    setEnergy(value);
    notificaRisparmioHome(value);
    AsyncStorage.setItem(ENERGY_KEY, value ? '1' : '0').catch(() => {});
  };
  const route = async () => {
    const destination = String(shift?.indirizzo_servizio || '').trim();
    if (!destination) return;
    const origin = String(profilo?.punto_partenza || '').trim();
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}${origin ? `&origin=${encodeURIComponent(origin)}` : ''}&travelmode=driving`;
    try { await Linking.openURL(url); } catch { setMenu('routeError'); }
  };
  const actions = [
    { label: 'Calendario', icon: 'calendar-outline', open: () => onCalendar ? onCalendar() : setMenu('calendar'), style: { top: 0, left: 0 } },
    { label: 'Strumenti', icon: 'construct', open: () => navigate('strumenti'), style: { top: 0, right: 0 } },
    { label: 'Stipendio', icon: 'coins', open: () => navigate('stipendio'), style: { bottom: 0, left: 0 } },
    { label: 'Social', icon: 'people', open: () => onSocial ? onSocial() : setMenu('social'), style: { bottom: 0, right: 0 } },
  ];
  const menuTitle = { settings: 'Impostazioni', social: 'Social', calendar: 'Calendario e turni', service: 'Servizio di oggi', routeError: 'Percorso non disponibile', more: 'Sezioni dell’app' }[menu];
  const row = (label, action, icon = 'chevron-forward') => <Pressable key={label} accessibilityRole="button" onPress={action}
    style={({ pressed }) => [styles.menuRow, { backgroundColor: palette.surfaceRaised, opacity: pressed ? 0.7 : 1 }]}>
    <Text style={[styles.menuText, { color: palette.text }]}>{label}</Text><Ionicons name={icon} color={palette.homeAccent} size={22} />
  </Pressable>;

  return <SafeAreaView style={[styles.safe, { backgroundColor: transparentThemeBackground ? 'transparent' : (paletteHome?.background || '#03081B') }]}>
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <View testID="home-photo-slot" style={styles.photoSlot}>
        {backgroundPhoto && <>
          <Image source={backgroundPhoto} resizeMode="cover" style={StyleSheet.absoluteFill} />
          <PhotoFade color={paletteHome?.background || '#03081B'} />
        </>}
      </View>
      {decorationLayer}
      <Atmosphere />
    </View>
    <View style={[styles.page,{paddingTop:tight?4:12}]} accessibilityElementsHidden={Boolean(menu)} importantForAccessibility={menu ? 'no-hide-descendants' : 'auto'}>
      <View style={[styles.header,{minHeight:tight?54:68}]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Profilo di ${profilo?.nome || 'utente'}`} onPress={onProfile} style={styles.greeting}>
          <Text style={[styles.hello,{color:palette.text,fontSize:tight?17:20}]}>Ciao</Text>
          <Text numberOfLines={1} style={[styles.name,{color:palette.text,fontSize:tight?22:26}]}>{profilo?.nome || 'Collega'}</Text>
        </Pressable>
        <View style={styles.headerActions}>
          <NeonButton label={`Notifiche${numeroNotifiche ? `, ${numeroNotifiche} non lette` : ''}`} palette={palette} motion={motion} size={44} onPress={onNotifications}>
            <Ionicons name="notifications-outline" size={27} color={palette.text} />
            {numeroNotifiche > 0 && <View style={[styles.badge,{backgroundColor:palette.error}]}><Text style={styles.badgeText}>{numeroNotifiche > 99 ? '99+' : numeroNotifiche}</Text></View>}
          </NeonButton>
          <NeonButton label="Impostazioni" icon="settings-outline" palette={palette} motion={motion} size={44} onPress={() => onSettings ? onSettings() : setMenu('settings')} />
          <NeonButton label="Profilo" palette={palette} motion={motion} size={tight?48:54} onPress={onProfile}>
            <View style={[styles.avatarFrame,{width:tight?46:52,height:tight?46:52,borderColor:colors[3]}]}>
              {fotoProfilo ? <Image source={{uri:fotoProfilo}} style={styles.avatar} /> : <Ionicons name="person" color={palette.text} size={25} />}
            </View>
          </NeonButton>
        </View>
      </View>
      <Pressable testID="home-monthly-summary" accessibilityRole="button" accessibilityLabel={`Riepilogo mensile ${summary.month}, avanzamento ${progress === null ? 'non disponibile' : `${progress}%`}, ${summary.hours} lavorate, ${summary.extra} extra, ${summary.days} giorni`}
        onPress={() => setMenu('summary')} style={[styles.monthlySummary, {marginTop:tight?8:14,backgroundColor:palette.surface,borderColor:colors[0]}]}>
        <View style={styles.summaryHeading}>
          <Text testID="home-summary-month" style={[styles.summaryMonth,{color:palette.text}]}>{String(summary.month || periodo || '').toUpperCase()}</Text>
          <Text style={[styles.summaryProgress,{color:testoTema(palette, palette.homeAccent)}]}>AVANZ. {progress === null ? '—' : `${progress}%`}</Text>
        </View>
        <View testID="home-monthly-progress" accessibilityRole="progressbar" accessibilityLabel="Avanzamento mensile" accessibilityValue={progress === null ? {min:0,max:100,text:'Non disponibile'} : {min:0,max:100,now:progress}}
          style={[styles.progressTrack,{backgroundColor:palette.progressTrack || palette.surfaceRaised}]}>
          <View testID="home-monthly-progress-fill" style={{height:'100%',width:`${progress ?? 0}%`,borderRadius:4,backgroundColor:palette.homeAccent}} />
        </View>
        <View style={styles.monthlyValues}>{[[summary.hours,'LAVORATE'],[summary.extra,'EXTRA'],[summary.days,'GIORNI']].map(([value,label])=><View key={label} style={styles.monthlyValue}>
          <Text testID={`home-monthly-${label}`} numberOfLines={1} style={[styles.monthlyNumber,{color:palette.text,fontSize:tight?21:24}]}>{String(value ?? '—')}</Text>
          <Text style={[styles.monthlyLabel,{color:palette.textMuted}]}>{label}</Text>
        </View>)}</View>
      </Pressable>
      <View style={[styles.stage,{marginTop:tight?4:8}]} onLayout={e => { const {width,height}=e.nativeEvent.layout;setArea(old=>old.width===width&&old.height===height?old:{width,height}); }}>
        {area.width > 0 && area.height > 0 && <>
          <ElectricConnections width={area.width} height={area.height} button={g.button} diameter={g.diameter} colors={colors} enabled={motion} />
          <View testID="home-core-frame" style={{position:'absolute',top:g.top,left:g.left,width:g.diameter,height:g.diameter,
            minWidth:g.diameter,minHeight:g.diameter,maxWidth:g.diameter,maxHeight:g.diameter,aspectRatio:1,flexGrow:0,flexShrink:0}}>
            <AnimatedCoreRings size={g.diameter} surface={paletteHome?.surface || '#03091D'} raised={paletteHome?.surfaceRaised || '#08122D'} colors={colors} enabled={motion} />
            <Pressable testID="home-core-content" accessibilityRole="button" accessibilityLabel={`${service.titolo}. ${shiftTime}. ${service.label}: ${service.countdown}. ${place}`}
              accessibilityHint="Apri dettagli, calendario e indicazioni stradali" onPress={()=>setMenu('service')}
              style={({pressed})=>[styles.core,{top:g.diameter*0.12,left:g.diameter*0.12,right:g.diameter*0.12,bottom:g.diameter*0.12,opacity:pressed?0.8:1}]}>
              {!compactText && <Ionicons name="shield-outline" size={Math.max(16,g.diameter*0.07)} color="#4BC4EF" />}
              {!compactText && <Text numberOfLines={1} style={[styles.coreLabel,{color:paletteHome?.text || '#69D0F5',fontSize:Math.max(9,g.diameter*0.04)}]}>TURNO DI OGGI</Text>}
              <Text numberOfLines={1} style={[styles.time,{color:paletteHome?.text || '#6DDDF0',fontSize:Math.max(14,g.diameter*0.065)}]}>{shiftTime}</Text>
              <Text testID="home-countdown" numberOfLines={1} style={[styles.countdown,{color:palette.text,fontSize:Math.min(46,Math.max(18,g.diameter*0.143))}]}>{service.countdown}</Text>
              {!compactText && <Text numberOfLines={1} style={[styles.countdownLabel,{color:palette.textMuted,fontSize:Math.max(10,g.diameter*0.045)}]}>{service.label === 'FINE TRA' ? 'alla fine del turno' : service.label.toLowerCase()}</Text>}
              <View style={styles.location}>
                <Ionicons name="location" size={Math.max(17,g.diameter*0.075)} color="#48BAEE" />
                <Text numberOfLines={2} style={[styles.place,{color:palette.text,fontSize:Math.max(10,g.diameter*0.049)}]}>{place}</Text>
              </View>
            </Pressable>
          </View>
          {actions.map((action,index)=><NeonButton key={action.label} label={action.label} icon={action.icon} onPress={action.open} orbital
            palette={palette} accent={colors[index]} motion={motion} size={g.button} style={[styles.orbitButton,g.buttons[index]]} />)}
        </>}
      </View>
    </View>
    <Modal visible={Boolean(menu)} onShow={() => { const node = findNodeHandle(menuTitleRef.current); if (node) AccessibilityInfo.setAccessibilityFocus(node); }} animationType={reduced || energy ? 'none' : 'fade'} transparent onRequestClose={() => setMenu(null)}>
      <View style={[styles.modalShade, { backgroundColor: '#00000099' }]}>
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: palette.background }]}>
          <View accessibilityViewIsModal style={styles.modalContent}>
            <View style={styles.modalHeader}><Text ref={menuTitleRef} accessible accessibilityRole="header" style={[styles.menuTitle, { color: palette.text }]}>{menu === 'summary' ? `Riepilogo · ${periodo}` : menuTitle}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Chiudi" onPress={() => setMenu(null)} style={styles.close}><Ionicons name="close" size={28} color={palette.text} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              {menu === 'more' && <>
                {row('Home', () => setMenu(null))}
                {row('Lista turni', () => navigate('turni'))}
                {row('Chat', () => navigate('listaChat'))}
                {row('Stipendio', () => navigate('stipendio'))}
                {row('Calendario e turni', () => setMenu('calendar'))}
                {row('Strumenti', () => navigate('strumenti'))}
                {row('Social e colleghi', () => { setMenu(null); onSocial ? onSocial() : setMenu('social'); })}
                {row('Profilo', () => { setMenu(null); onProfile(); })}
                {row('Impostazioni', () => setMenu('settings'))}
              </>}
              {menu === 'settings' && <>
                {row('Sezioni dell’app', () => setMenu('more'))}
                {row('Il mio profilo e impostazioni', () => { setMenu(null); onProfile(); })}
                {row('Aspetto e colori', () => navigate('aspettoColori'))}
                <View style={styles.menuRow}><Text style={[styles.menuText, { color: palette.text }]}>Risparmio energia · ferma gli effetti</Text>
                  <Switch accessibilityLabel="Risparmio energia, disattiva le animazioni della Home" value={energy} onValueChange={toggleEnergy} />
                </View>
                <Text style={{ color: palette.textMuted }}>Gli effetti si fermano anche con Riduci movimento e quando l’app è in background.</Text>
              </>}
              {menu === 'social' && <>
                {row('Chat', () => navigate('listaChat'), 'chatbubble-ellipses-outline')}
                {row('Condivisione turni', () => navigate('calendarioColleghi'), 'calendar-outline')}
                {row('Colleghi e richieste', () => { setMenu(null); onColleghi(); }, 'people-outline')}
              </>}
              {menu === 'calendar' && <>
                {row('Apri calendario', () => navigate('calendar'))}
                {row('Lista turni', () => navigate('turni'))}
                {row('Aggiungi turno', () => { setMenu(null); onAddShift(); }, 'add-circle-outline')}
              </>}
              {menu === 'service' && <>
                <Text style={[styles.detail, { color: palette.text }]}>{service.titolo}{'\n'}{shiftTime}{'\n'}{service.label}: {service.countdown}{'\n'}{place}{shift?.indirizzo_servizio ? `\n${shift.indirizzo_servizio}` : ''}</Text>
                {shift?.indirizzo_servizio ? <>
                  <Text style={{ color: palette.textMuted }}>{shift === etaTurno && etaServizioLoading ? 'Calcolo traffico in corso…' : shift === etaTurno && Number(etaServizio?.minuti) > 0 ? `${etaServizio.minuti} min · traffico +${Number(etaServizio.ritardo_traffico || 0)} min` : 'Percorso al servizio'}</Text>
                  {row('Indicazioni stradali', route, 'navigate-outline')}
                </> : null}
                {row('Apri calendario', () => navigate('calendar'))}
                {row('Aggiungi turno', () => { setMenu(null); onAddShift(); }, 'add-circle-outline')}
              </>}
              {menu === 'summary' && <>
                <Text style={[styles.detail, { color: palette.text }]}>Ore totali: {ore}{'\n'}Extra: {extra}{'\n'}Notti: {notti}</Text>
                <Text style={{ color: palette.textMuted }}>Notti indica il numero di turni che attraversano mezzanotte. I valori si riferiscono al mese mostrato.</Text>
                {row('Dettaglio stipendio', () => navigate('stipendio'))}
              </>}
              {menu === 'routeError' && <Text style={[styles.detail, { color: palette.text }]}>Impossibile aprire le indicazioni. Riprova dal dettaglio del servizio.</Text>}
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1},page:{flex:1,paddingHorizontal:20,maxWidth:600,width:'100%',alignSelf:'center',minHeight:0,paddingBottom:8},
  photoSlot:{position:'absolute',left:0,right:0,bottom:0,height:'36%'},
  header:{flexDirection:'row',alignItems:'center',gap:8},greeting:{flex:1,minWidth:0,minHeight:48,justifyContent:'center'},
  hello:{fontWeight:'500'},name:{fontWeight:'800',marginTop:1},headerActions:{flexDirection:'row',alignItems:'center',gap:2},
  button:{alignItems:'center',justifyContent:'center'},buttonLabel:{position:'absolute',left:-2,right:-2,textAlign:'center',fontWeight:'600',paddingTop:2},
  avatarFrame:{borderRadius:40,borderWidth:2,alignItems:'center',justifyContent:'center',overflow:'hidden'},avatar:{width:'100%',height:'100%'},
  badge:{position:'absolute',right:0,top:0,borderRadius:10,minWidth:17,minHeight:17,alignItems:'center',justifyContent:'center',paddingHorizontal:2},
  badgeText:{color:'#07111F',fontSize:9,fontWeight:'900'},
  monthlySummary:{borderWidth:1,borderRadius:18,paddingHorizontal:14,paddingVertical:10,shadowColor:'#23B5FF',shadowOpacity:0.12,shadowRadius:10,shadowOffset:{width:0,height:2}},
  summaryHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},summaryMonth:{flex:1,fontSize:12,fontWeight:'800',letterSpacing:0.5},summaryProgress:{fontSize:11,fontWeight:'700'},
  progressTrack:{height:6,borderRadius:4,marginTop:8,overflow:'hidden'},monthlyValues:{flexDirection:'row',gap:8,marginTop:8},monthlyValue:{flex:1,minWidth:0,alignItems:'center'},monthlyNumber:{fontWeight:'800'},monthlyLabel:{fontSize:9,fontWeight:'700',letterSpacing:0.8,marginTop:2},
  stage:{flex:1,minHeight:0},orbitButton:{position:'absolute'},
  core:{position:'absolute',alignItems:'center',justifyContent:'center',paddingHorizontal:4},
  coreLabel:{fontWeight:'700',marginTop:6,textAlign:'center'},time:{fontWeight:'600',marginTop:8},
  countdown:{fontWeight:'800',fontVariant:['tabular-nums'],marginTop:7},countdownLabel:{marginTop:3,textAlign:'center'},
  location:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,marginTop:12,maxWidth:'95%'},place:{textAlign:'left',flexShrink:1,fontWeight:'500'},
  modalShade:{flex:1,justifyContent:'center',padding:16},modalSafe:{maxHeight:'95%',borderRadius:24},modalContent:{flexShrink:1,padding:16},
  modalHeader:{flexDirection:'row',alignItems:'center',gap:8},menuTitle:{flex:1,fontSize:22,fontWeight:'800'},close:{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'},
  modalScroll:{paddingBottom:12},menuRow:{minHeight:56,padding:12,borderRadius:14,flexDirection:'row',alignItems:'center',gap:12,marginVertical:5},
  menuText:{flex:1,fontSize:16,fontWeight:'600'},detail:{fontSize:18,lineHeight:28,marginVertical:12},
});
