import React, { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, AppState, Platform, StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Ellipse, Line, Path, Polygon, Rect } from 'react-native-svg';

type Palette = { background: string; surface: string; accent: string; homeAccent: string; homeAccentSecondary?: string };
type Preset = { id: string; accent: string; secondary?: string };
type Props = { theme: Preset; palette: Palette; active?: boolean };
const AnimatedView = Animated.View;
const nativeDriver = Platform.OS !== 'web';

function useMotionAllowed() {
  const [reduced, setReduced] = React.useState(true);
  const [foreground, setForeground] = React.useState(AppState.currentState === 'active');
  useEffect(() => {
    let live = true, received = false;
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { received = true; if (live) setReduced(value); });
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live && !received) setReduced(value); }).catch(() => {});
    const app = AppState.addEventListener('change', state => { if (live) setForeground(state === 'active'); });
    return () => { live = false; motion.remove(); app.remove(); };
  }, []);
  return foreground && !reduced;
}

function usePhase(active: boolean, duration: number, delay = 0) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    value.stopAnimation(); value.setValue(0);
    if (!active) return undefined;
    const loop = Animated.loop(Animated.sequence([
      ...(delay ? [Animated.delay(delay)] : []),
      Animated.timing(value, { toValue: 1, duration, easing: undefined, useNativeDriver: nativeDriver, isInteraction: false }),
      Animated.timing(value, { toValue: 0, duration: 1, useNativeDriver: nativeDriver, isInteraction: false }),
    ]));
    loop.start();
    return () => { loop.stop(); value.stopAnimation(); };
  }, [active, delay, duration, value]);
  return value;
}

function Art({ id, width, height, children, style, testID }: { id: string; width: number; height: number; children: ReactNode; style?: ViewStyle; testID: string }) {
  return <View testID={testID} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.art, { width, height }, style]}>
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} accessibilityLabel={`Decorazione ${id}`}>
      {children}
    </Svg>
  </View>;
}

function FallingSnow({ x, top, color, index, active }: { x: number; top: number; color: string; index: number; active: boolean }) {
  const value = usePhase(active, 19000 + (index % 3) * 2500, index * 1700);
  const y = value.interpolate({ inputRange: [0, 1], outputRange: [-8, 96] });
  const drift = value.interpolate({ inputRange: [0, .5, 1], outputRange: [0, index % 2 ? 7 : -7, 2] });
  return <AnimatedView testID="theme-snowflake" pointerEvents="none" style={[styles.flake, { left: x, top, backgroundColor: color, opacity: active ? .82 : .34, transform: [{ translateY: y }, { translateX: drift }] }]} />;
}

function MovingBat({ x, top, size, color, phase, mirror = false }: { x: number; top: number; size: number; color: string; phase: Animated.Value; mirror?: boolean }) {
  const dx = phase.interpolate({ inputRange: [0, 1], outputRange: [mirror ? 5 : -5, mirror ? -5 : 5] });
  const rotate = phase.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] });
  return <AnimatedView testID="theme-bat" pointerEvents="none" style={{ position: 'absolute', left: x, top, transform: [{ translateX: dx }, { rotate }] }}>
    <Svg width={size} height={size * .58} viewBox="0 0 48 28"><Path d="M24 12 20 7 15 3 14 10 8 5 8 13 2 9 4 19 11 23 18 21 24 26 30 21 37 23 44 19 46 9 40 13 40 5 34 10 33 3 28 7Z" fill={color}/><Circle cx="20" cy="15" r="1" fill="#FFF1B8"/><Circle cx="28" cy="15" r="1" fill="#FFF1B8"/></Svg>
  </AnimatedView>;
}

function Snowflake({ color, x = 0, y = 0, size = 34 }: { color: string; x?: number; y?: number; size?: number }) {
  return <Svg x={x} y={y} width={size} height={size} viewBox="0 0 40 40"><Path d="M20 2v36M4.4 11l31.2 18M4.4 29 35.6 11M15 6l5 4 5-4M15 34l5-4 5 4M6 16l6-1 1-6M34 24l-6 1-1 6M6 24l6 1 1 6M34 16l-6-1-1-6" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none"/></Svg>;
}

export default function ThemeDecorations({ theme, palette, active = true }: Props) {
  const motion = useMotionAllowed() && active;
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const phase = usePhase(motion && ['halloween','cartoon','galaxy','cyberpunk','inverno','gold-special'].includes(theme.id), 11500);
  const accent = palette.homeAccent || palette.accent;
  const secondary = palette.homeAccentSecondary || theme.secondary || accent;
  const scale = Math.max(.72, Math.min(1.12, width / 390));
  const top = Math.max(4, insets.top - 40);
  const bottom = Math.max(4, height - insets.bottom - 62 * scale);
  const left = 5;
  const right = Math.max(5, width - 69 * scale);
  const edgeY = Math.max(insets.top + 82, Math.round(height * .24));
  const lowerY = Math.min(height - 124, Math.round(height * .69));
  const id = theme.id;

  return <View testID="theme-decoration-layer" pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={styles.layer}>
    {id === 'natale' && <>
      <Art id="albero di Natale" testID="theme-art-christmas-tree" width={40 * scale} height={52 * scale} style={{ left: right, top }}>
        <Path d="M20 2 10 15h6L6 27h9l-4 8h8v14h6V35h8l-4-8h9L24 15h6Z" fill="#237D56" stroke="#90E6B0" strokeWidth="1.2"/><Path d="m20 2 2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4Z" fill="#FFD779"/><Circle cx="17" cy="22" r="2" fill="#F66C78"/><Circle cx="25" cy="30" r="2" fill="#F5D064"/><Circle cx="19" cy="38" r="1.7" fill="#86E5EF"/>
      </Art>
      <Art id="pallina e lucine" testID="theme-art-christmas-lights" width={49 * scale} height={34 * scale} style={{ left, top: Math.max(0, insets.top - 36 * scale) }}>
        <Path d="M2 7Q14 22 26 8T47 10" stroke="#D7C877" strokeWidth="1.3" fill="none"/><Circle cx="9" cy="14" r="3" fill="#E75364"/><Circle cx="24" cy="12" r="3" fill="#65D9A2"/><Circle cx="39" cy="12" r="3" fill="#F2D06C"/><Circle cx="9" cy="14" r="1" fill="#FFF4C4"/><Circle cx="24" cy="12" r="1" fill="#D8FFF0"/><Circle cx="39" cy="12" r="1" fill="#FFF4C4"/>
      </Art>
      {[0,1,2,3].map(i => <FallingSnow key={i} index={i} x={i % 2 ? width - 17 : 13} top={edgeY + Math.floor(i / 2) * 135} color={i % 2 ? secondary : '#F2FBFF'} active={motion} />)}
      <Art id="stella natalizia" testID="theme-art-christmas-star" width={20} height={20} style={{ left: right - 2, top: lowerY }}><Path d="m10 1 2.2 6.2L19 10l-6.8 2.8L10 19l-2.2-6.2L1 10l6.8-2.8Z" fill="#F8D878"/><Circle cx="10" cy="10" r="2" fill="#FFF6D2"/></Art>
    </>}

    {id === 'halloween' && <>
      <Art id="ragnatela" testID="theme-art-halloween-web" width={58 * scale} height={58 * scale} style={{ left, top }}>
        <Path d="M2 2Q30 12 56 2M2 2Q14 30 2 56M2 2Q33 29 56 56M4 12Q17 17 18 4M7 24Q24 30 30 7M11 38Q32 44 43 13" stroke="#A98CD2" strokeWidth="1.2" opacity=".8" fill="none"/><Circle cx="7" cy="8" r="2.2" fill="#C8B5E1"/>
      </Art>
      <MovingBat x={right} top={top + 1} size={37 * scale} color="#AB78E8" phase={phase}/>
      <MovingBat x={left + 5} top={top + 8 * scale} size={31 * scale} color="#7D68B5" phase={phase} mirror/>
      <Art id="zucca" testID="theme-art-halloween-pumpkin" width={54 * scale} height={48 * scale} style={{ left: right - 8, top: bottom }}>
        <Ellipse cx="27" cy="27" rx="22" ry="18" fill="#F08028" stroke="#FFB04D" strokeWidth="1.5"/><Path d="M27 8q-4 10 0 36M16 13q7 12 0 27M38 13q-7 12 0 27" stroke="#C7591C" strokeWidth="1.5" fill="none"/><Path d="M25 9q-1-7 5-8l3 2-4 7" fill="#71A54A"/><Path d="m18 22 4 4 4-4M29 22l4 4 4-4M20 34q7 5 14 0" stroke="#31182F" strokeWidth="2.3" strokeLinecap="round" fill="none"/>
      </Art>
      <Art id="fantasma" testID="theme-art-halloween-ghost" width={34 * scale} height={42 * scale} style={{ left: left + 4, top: bottom + 5 * scale }}>
        <Path d="M17 2C8 2 4 10 4 19v19l7-5 6 5 6-5 7 5V19C30 10 26 2 17 2Z" fill="#D8D3E5" opacity=".82"/><Circle cx="12" cy="18" r="2" fill="#33223D"/><Circle cx="22" cy="18" r="2" fill="#33223D"/><Path d="M14 26q3 3 6 0" stroke="#33223D" strokeWidth="1.7" fill="none"/>
      </Art>
      <Art id="sagoma zombie" testID="theme-art-halloween-zombie" width={30 * scale} height={45 * scale} style={{ left: left + 43 * scale, top: bottom + 4 * scale }}>
        <Circle cx="15" cy="8" r="6" fill="#8C9B68"/><Path d="M9 7 5 3M20 8l5-3M12 7l2 1m5-2-2 2M12 13l-3 14 5 2 2-8 3 8 5-2-4-14ZM9 16 3 25l3 2 6-7m9-4 7 7-3 3-7-6" fill="#667751" stroke="#9CAC76" strokeWidth="1.2" strokeLinejoin="round"/><Path d="m12 30-2 12m10-11 3 11" stroke="#91A272" strokeWidth="2.3" strokeLinecap="round"/><Circle cx="13" cy="8" r="1" fill="#DAE59B"/><Circle cx="18" cy="8" r="1" fill="#DAE59B"/>
      </Art>
    </>}

    {id === 'cartoon' && <>
      <Art id="arcobaleno" testID="theme-art-cartoon-rainbow" width={115 * scale} height={70 * scale} style={{ left: right - 62 * scale, top }}>
        <Path d="M5 65a52 52 0 0 1 104 0" stroke="#FF5CA8" strokeWidth="8" fill="none"/><Path d="M15 65a42 42 0 0 1 84 0" stroke="#FFE66D" strokeWidth="7" fill="none"/><Path d="M25 65a32 32 0 0 1 64 0" stroke="#6DEBFF" strokeWidth="7" fill="none"/><Path d="M35 65a22 22 0 0 1 44 0" stroke="#8E76FF" strokeWidth="7" fill="none"/>
        <Ellipse cx="10" cy="61" rx="12" ry="7" fill="#E7F7FF"/><Ellipse cx="105" cy="61" rx="12" ry="7" fill="#E7F7FF"/>
      </Art>
      <Art id="castello" testID="theme-art-cartoon-castle" width={74 * scale} height={64 * scale} style={{ left, top: bottom }}>
        <Rect x="17" y="24" width="41" height="38" rx="2" fill="#9B83F4" stroke="#C8B7FF" strokeWidth="1.3"/><Path d="M7 27V8h13v19M55 27V8h13v19M24 24V5h11v19M41 24V5h11v19" fill="#F5A4D3" stroke="#FAD4F0" strokeWidth="1.2"/><Path d="m6 8 7-7 7 7M54 8l7-7 7 7M23 5l6-5 6 5M40 5l6-5 6 5" fill="#FFE66D"/><Rect x="32" y="42" width="12" height="20" rx="6" fill="#FFE7A6"/><Circle cx="37" cy="32" r="3" fill="#6DEBFF"/>
      </Art>
      <AnimatedView testID="theme-art-cartoon-cloud" pointerEvents="none" style={{ position: 'absolute', left: right, top: bottom + 10 * scale, transform: [{ translateX: phase.interpolate({ inputRange: [0,1], outputRange: [-4,5] }) }, { translateY: phase.interpolate({ inputRange: [0,1], outputRange: [2,-2] }) }] }}>
        <Svg width={50 * scale} height={31 * scale} viewBox="0 0 50 31"><Path d="M8 26a8 8 0 0 1 0-16 12 12 0 0 1 23-2 9 9 0 0 1 9 18Z" fill="#D7F4FF" stroke="#83DDF4" strokeWidth="1.5"/><Path d="m24 12 1.8 4.5 4.8 1.7-4.8 1.8-1.8 4.7-1.7-4.7-4.8-1.8 4.8-1.7Z" fill="#FFE66D"/></Svg>
      </AnimatedView>
      <Art id="stelline" testID="theme-art-cartoon-stars" width={42 * scale} height={38 * scale} style={{ left: right - 3, top: lowerY - 44 * scale }}><Path d="m11 2 2.5 7.5L21 12l-7.5 2.5L11 22l-2.5-7.5L1 12l7.5-2.5Z" fill="#FFE66D"/><Path d="m32 17 1.8 5.2L39 24l-5.2 1.8L32 31l-1.8-5.2L25 24l5.2-1.8Z" fill="#FF8BCC"/></Art>
    </>}

    {id === 'militare' && <>
      <Art id="camouflage" testID="theme-art-military-camo" width={82 * scale} height={62 * scale} style={{ left, top }}>
        <Path d="M0 10q18-18 32 2t32 0q15-10 18 1v19q-16 6-27-1T27 35Q12 29 0 41Z" fill="#718052" opacity=".48"/><Path d="M0 40q14-12 27-3t26 1q18-10 29 2v18H0Z" fill="#B2A078" opacity=".4"/><Ellipse cx="58" cy="15" rx="13" ry="7" fill="#394630" opacity=".65"/><Ellipse cx="18" cy="25" rx="11" ry="8" fill="#3C4B30" opacity=".56"/>
      </Art>
      <Art id="bussola" testID="theme-art-military-compass" width={58 * scale} height={58 * scale} style={{ left: right, top: bottom }}>
        <Circle cx="29" cy="29" r="24" fill="#19261B" fillOpacity=".66" stroke="#C4B68D" strokeWidth="1.5"/><Circle cx="29" cy="29" r="18" fill="none" stroke="#8CA276" strokeWidth="1"/><Path d="m29 8 5 20-5 22-5-22Z" fill="#D5C38D"/><Path d="m29 8-5 20 5-5 5 5Z" fill="#9B4D3C"/><Circle cx="29" cy="29" r="2.5" fill="#F1DFA8"/><Path d="M29 1v5M29 52v5M1 29h5M52 29h5" stroke="#C9BD9D" strokeWidth="1.5"/><TextCompass />
      </Art>
      <Art id="linee topografiche" testID="theme-art-military-topography" width={78 * scale} height={44 * scale} style={{ left, top: bottom + 8 * scale }}>
        <Path d="M2 40q5-18 22-12t20-13q8-15 30-11M0 30q11-17 24-7t22-16q10-10 28-3M8 43q11-5 18 0t21-8q11-8 25-5" stroke="#A5B58A" strokeWidth="1.2" opacity=".8" fill="none"/><Circle cx="46" cy="15" r="2" fill="#D5C38D"/>
      </Art>
    </>}

    {id === 'galaxy' && <>
      <Art id="pianeta" testID="theme-art-galaxy-planet" width={67 * scale} height={62 * scale} style={{ left: right, top }}>
        <Ellipse cx="34" cy="33" rx="30" ry="10" fill="none" stroke="#72DCF5" strokeWidth="2.5" transform="rotate(-22 34 33)"/><Circle cx="34" cy="31" r="19" fill="#7656C5" stroke="#B49CFF" strokeWidth="1.5"/><Path d="M18 27q16-11 31 1M18 35q15 10 31-1" stroke="#C3A9FF" strokeWidth="3" opacity=".45" fill="none"/><Circle cx="27" cy="24" r="4" fill="#A38DE8" opacity=".7"/>
      </Art>
      <Art id="costellazione" testID="theme-art-galaxy-stars" width={76 * scale} height={55 * scale} style={{ left, top: bottom + 5 * scale }}>
        <Path d="m9 12 20 15 17-19 20 26" stroke="#7866B9" strokeWidth="1" opacity=".6" fill="none"/>{[[9,12],[29,27],[46,8],[66,34],[20,48],[55,50]].map(([cx,cy],i)=><Path key={i} d={`M${cx} ${cy-4} ${cx+1.2} ${cy-1} ${cx+4} ${cy} ${cx+1.2} ${cy+1} ${cx} ${cy+4} ${cx-1} ${cy+1} ${cx-4} ${cy} ${cx-1} ${cy-1}Z`} fill={i%2?secondary:'#FFF3B1'}/>)}
      </Art>
      <AnimatedView testID="theme-art-galaxy-twinkle" pointerEvents="none" style={{ position: 'absolute', left: right - 5, top: lowerY - 26, opacity: phase.interpolate({ inputRange: [0,.5,1], outputRange: [.18,.9,.18] }) }}><Svg width={18 * scale} height={18 * scale} viewBox="0 0 18 18"><Path d="m9 0 2.1 6 6 3-6 2.1L9 17l-2.1-5.9L1 9l5.9-3Z" fill="#FFF2BE"/></Svg></AnimatedView>
      <Art id="luna" testID="theme-art-galaxy-moon" width={30 * scale} height={30 * scale} style={{ left: right + 4, top: bottom }}><Circle cx="15" cy="15" r="11" fill="#D9D1FF" opacity=".82"/><Circle cx="20" cy="11" r="10" fill={palette.background}/><Circle cx="9" cy="18" r="1.2" fill="#A68BFF"/></Art>
    </>}

    {id === 'cyberpunk' && <>
      <Art id="circuito" testID="theme-art-cyberpunk-circuit" width={22 * scale} height={112 * scale} style={{ left: 0, top: edgeY - 25 }}>
        <Path d="M3 4v21h15v15H4v20h14v15H7v18h13" stroke="#00E5FF" strokeWidth="2" opacity=".8" fill="none"/><Path d="M19 7h-7v18H5v15" stroke="#FF2E93" strokeWidth="1.7" opacity=".76" fill="none"/><Circle cx="3" cy="4" r="2" fill="#00E5FF"/><Circle cx="20" cy="93" r="2" fill="#FF2E93"/><Circle cx="5" cy="40" r="2" fill="#B7FF3C"/>
      </Art>
      <Art id="tracce neon" testID="theme-art-cyberpunk-traces" width={20 * scale} height={72 * scale} style={{ left: width - 20 * scale, top: lowerY }}>
        <Path d="M2 2h13v18H4v16h13v17H5v17" stroke="#FF2E93" strokeWidth="1.6" fill="none"/><Circle cx="15" cy="2" r="2.2" fill="#00E5FF"/><Circle cx="4" cy="36" r="2.2" fill="#B7FF3C"/>
      </Art>
      <AnimatedView testID="theme-art-cyberpunk-scan" pointerEvents="none" style={{ position: 'absolute', left: width - 34 * scale, top: top + 2, opacity: phase.interpolate({ inputRange: [0, .5, 1], outputRange: [.18, .88, .18] }), transform: [{ translateY: phase.interpolate({ inputRange: [0,1], outputRange: [-2,12] }) }] }}><Svg width={25 * scale} height={25 * scale} viewBox="0 0 25 25"><Circle cx="12.5" cy="12.5" r="6" fill="#00E5FF" fillOpacity=".18" stroke="#00E5FF" strokeWidth="1.3"/><Circle cx="12.5" cy="12.5" r="2.2" fill="#E7FFFF"/></Svg></AnimatedView>
    </>}

    {id === 'inverno' && <>
      <Art id="brina" testID="theme-art-winter-frost" width={65 * scale} height={58 * scale} style={{ left, top }}>
        <Path d="M0 4Q18 11 28 0M0 13Q22 20 40 4M0 23Q18 31 52 10M3 0v26M12 6v25M22 11v23" stroke="#D8F5FF" strokeWidth="1.5" opacity=".76" fill="none"/><Snowflake color="#B8E8FF" x={30} y={20} size={25}/>
      </Art>
      <Art id="cristallo" testID="theme-art-winter-crystal" width={57 * scale} height={57 * scale} style={{ left: right, top: bottom }}><Snowflake color="#9DDCFF" size={52 * scale}/><Circle cx={26 * scale} cy={26 * scale} r={3 * scale} fill="#F3FCFF"/></Art>
      {[0,1].map(i=><AnimatedView key={i} testID="theme-winter-particle" pointerEvents="none" style={{ position: 'absolute', left: i ? right + 20 : left + 17, top: edgeY + i * 130, opacity: phase.interpolate({ inputRange: [0,.5,1], outputRange: [.25,.75,.25] }), transform: [{ translateY: phase.interpolate({ inputRange: [0,1], outputRange: [4,-7] }) }] }}><Svg width={13} height={13} viewBox="0 0 13 13"><Path d="M6.5 0v13M1 3.2l11 6.6M1 9.8l11-6.6" stroke="#DDF6FF" strokeWidth="1"/></Svg></AnimatedView>)}
    </>}

    {id === 'gold-special' && <>
      <Art id="filigrana dorata" testID="theme-art-gold-filigree" width={54 * scale} height={63 * scale} style={{ left, top }}>
        <Path d="M1 1h28q22 0 22 22v39M1 9h22q16 0 16 16v37M1 17h16q9 0 9 9v36" stroke="#D9B45B" strokeWidth="1.2" opacity=".8" fill="none"/><Circle cx="29" cy="1" r="2" fill="#FFF0BC"/><Circle cx="39" cy="25" r="2" fill="#E7C46F"/>
      </Art>
      <Art id="medaglione dorato" testID="theme-art-gold-medallion" width={56 * scale} height={56 * scale} style={{ left: right, top: bottom }}>
        <Circle cx="28" cy="28" r="23" fill="#302512" fillOpacity=".72" stroke="#D9B45B" strokeWidth="1.5"/><Circle cx="28" cy="28" r="17" fill="none" stroke="#F0D38A" strokeWidth=".8"/><Path d="m28 11 4.5 11.5L45 28l-12.5 5.5L28 45l-4.5-11.5L11 28l12.5-5.5Z" fill="#D9B45B"/><Circle cx="28" cy="28" r="4" fill="#FFF0BC"/>
      </Art>
      <AnimatedView testID="theme-art-gold-shimmer" pointerEvents="none" style={{ position: 'absolute', left: right - 5, top: edgeY + 22, opacity: phase.interpolate({ inputRange: [0,.5,1], outputRange: [.12,.65,.12] }), transform: [{ translateX: phase.interpolate({ inputRange: [0,1], outputRange: [-7,8] }) }] }}><Svg width={28 * scale} height={28 * scale} viewBox="0 0 28 28"><Path d="m14 1 3.2 9.8L27 14l-9.8 3.2L14 27l-3.2-9.8L1 14l9.8-3.2Z" fill="#FFF0BC"/></Svg></AnimatedView>
    </>}
  </View>;
}

function TextCompass() { return <Path d="M29 4v4M29 50v4M4 29h4M50 29h4" stroke="#D5C38D" strokeWidth="1.2"/>; }

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, zIndex: 1, overflow: 'hidden' },
  art: { position: 'absolute', opacity: .42 },
  flake: { position: 'absolute', width: 8, height: 8, borderRadius: 5 },
});
