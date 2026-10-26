import React, { memo, useEffect, useId, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { COLORI_NEON_HOME, miscelaNeon } from './homeElectric';

function useGraphicId(prefix) { return prefix + useId().replace(/[^a-zA-Z0-9]/g, ''); }

export function CoreRings({ size, surface = '#050D24', raised = '#0A1634', colors = COLORI_NEON_HOME }) {
  const id = useGraphicId('core');
  return <Svg width={size} height={size} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style={{width:size,height:size,aspectRatio:1,flexShrink:0}}> 
    <Defs>
      <LinearGradient id={id} x1="0%" y1="70%" x2="100%" y2="20%">
        <Stop offset="0" stopColor={miscelaNeon(colors[0],'#59ECFF',0.35)} /><Stop offset="0.25" stopColor={colors[0]} />
        <Stop offset="0.6" stopColor={colors[3]} /><Stop offset="0.85" stopColor={miscelaNeon(colors[3],'#FF90E8',0.4)} /><Stop offset="1" stopColor={colors[3]} />
      </LinearGradient>
      <RadialGradient id={id+'face'} cx="42%" cy="20%" rx="80%" ry="85%">
        <Stop offset="0" stopColor={raised} /><Stop offset="1" stopColor={surface} />
      </RadialGradient>
      <LinearGradient id={id+'rim'} x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0" stopColor="#314270" /><Stop offset="0.35" stopColor="#070C21" />
        <Stop offset="0.7" stopColor="#25204E" /><Stop offset="1" stopColor="#06091A" />
      </LinearGradient>
    </Defs>
    <Circle cx="50" cy="50" r="46" fill="none" stroke={'url(#'+id+')'} strokeWidth="8" opacity="0.035" />
    <Circle cx="50" cy="50" r="46" fill="none" stroke={'url(#'+id+')'} strokeWidth="5" opacity="0.08" />
    <Circle cx="50" cy="50" r="46" fill="none" stroke={'url(#'+id+')'} strokeWidth="2" opacity="0.35" />
    <Circle cx="50" cy="50" r="45" fill="#02071A" stroke={'url(#'+id+'rim)'} strokeWidth="3" />
    <Circle cx="50" cy="50" r="43.6" fill={'url(#'+id+'face)'} stroke="#15203C" strokeWidth="0.9" />
    <Circle cx="50" cy="50" r="43.9" fill="none" stroke={'url(#'+id+')'} strokeWidth="4" opacity="0.2" />
    <Circle cx="50" cy="50" r="43.4" fill="none" stroke={'url(#'+id+')'} strokeWidth="2.6" />
    <Circle cx="50" cy="50" r="43.1" fill="none" stroke="#C3ABFF" strokeWidth="2.5" strokeDasharray="24 17 58 172" strokeDashoffset="66" opacity="0.7" />
    <Circle cx="50" cy="50" r="41.8" fill="none" stroke={'url(#'+id+')'} strokeWidth="0.4" opacity="0.85" />
    <Path d="M 50 6.6 A 43.4 43.4 0 0 1 92.3 40.2" fill="none" stroke="#F1BCFF" strokeWidth="0.65" opacity="0.95" />
    <Path d="M 8.7 36.5 A 43.4 43.4 0 0 0 9.5 65.6" fill="none" stroke="#68F2FF" strokeWidth="0.7" />
    {Array.from({length: 40}, (_,i) => {
      const a=i*Math.PI/20, r=i%5===0?46:46.7;
      return <Line key={i} x1={50+Math.cos(a)*r} y1={50+Math.sin(a)*r} x2={50+Math.cos(a)*48} y2={50+Math.sin(a)*48}
        stroke={i<20?'#A44FFF':'#31CBFF'} strokeWidth={i%5===0?0.35:0.15} opacity={i%5===0?0.8:0.35} />;
    })}
  </Svg>;
}

// All graphic layers are rigid squares. Only decoration rotates; the content is
// rendered by HomeScreen as a sibling outside this memoized component.
export const INNER_RING_DURATION = 30000;
export const OUTER_RING_DURATION = 22000;
const HALO_DURATION = 7000;
const square = size => ({width:size,height:size,minWidth:size,minHeight:size,maxWidth:size,maxHeight:size,aspectRatio:1,flexGrow:0,flexShrink:0});
const layer = size => ({...square(size),position:'absolute',top:0,left:0});

function OrbitGraphic({size,outer=false,halo=false,colors=COLORI_NEON_HOME}) {
  const id=useGraphicId(outer?'outerflow':'innerflow');
  const radius=outer?46.5:40.6;
  const dash=outer?'66 226':'74 14 22 145';
  return <Svg width={size} height={size} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style={square(size)}>
    <Defs><LinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
      <Stop offset="0" stopColor={colors[0]} /><Stop offset="0.35" stopColor={miscelaNeon(colors[0],colors[3],0.65)} />
      <Stop offset="0.7" stopColor={colors[3]} /><Stop offset="1" stopColor={miscelaNeon(colors[0],'#59ECFF',outer?0.5:0.1)} />
    </LinearGradient></Defs>
    {halo ? <>
      <Circle cx="50" cy="50" r="46" fill="none" stroke={'url(#'+id+')'} strokeWidth="8" opacity="0.3" />
      <Circle cx="50" cy="50" r="46" fill="none" stroke={'url(#'+id+')'} strokeWidth="5" opacity="0.5" />
    </> : <>
      <Circle cx="50" cy="50" r={radius} fill="none" stroke={'url(#'+id+')'} strokeWidth={outer?5:1.5}
        strokeDasharray={dash} strokeLinecap="round" opacity={outer?0.13:0.25} />
      <Circle cx="50" cy="50" r={radius} fill="none" stroke={'url(#'+id+')'} strokeWidth={outer?1.3:0.85}
        strokeDasharray={dash} strokeLinecap="round" opacity="0.9" />
      {outer ? <Circle cx="96.5" cy="50" r="0.65" fill="#B8F8FF" opacity="0.85" />
        : <Path d="M 50 9.4 A 40.6 40.6 0 0 1 75 18" fill="none" stroke="#639EFF" strokeWidth="0.65" opacity="0.9" />}
    </>}
  </Svg>;
}

export const AnimatedCoreRings = memo(function AnimatedCoreRings({size,surface,raised,enabled,colors=COLORI_NEON_HOME}) {
  const inner = useRef(new Animated.Value(0)).current;
  const outer = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const running = enabled && size > 0;
  useEffect(()=>{
    inner.setValue(0);outer.setValue(0);halo.setValue(0);
    if(!running)return undefined;
    const cycle=(value,duration)=>Animated.loop(Animated.timing(value,{
      toValue:1,duration,easing:Easing.linear,useNativeDriver:true,isInteraction:false,
    }));
    const loops=[cycle(inner,INNER_RING_DURATION),cycle(outer,OUTER_RING_DURATION),cycle(halo,HALO_DURATION)];
    loops.forEach(loop=>loop.start());
    return()=>{loops.forEach(loop=>loop.stop());[inner,outer,halo].forEach(value=>{value.stopAnimation();value.setValue(0);});};
  },[running,inner,outer,halo]);
  return <View testID="home-core-visual" pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={square(size)}>
    <CoreRings size={size} surface={surface} raised={raised} colors={colors} />
    <Animated.View testID="home-ring-halo" style={[layer(size),{opacity:halo.interpolate({
      inputRange:[0,0.125,0.25,0.375,0.5,0.625,0.75,0.875,1],
      outputRange:[0.18,0.193,0.225,0.257,0.27,0.257,0.225,0.193,0.18],
    })}]}><OrbitGraphic size={size} colors={colors} outer halo /></Animated.View>
    <Animated.View testID="home-ring-inner" style={[layer(size),{transform:[{rotate:inner.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']})}]}]}>
      <OrbitGraphic size={size} colors={colors} />
    </Animated.View>
    <Animated.View testID="home-ring-outer" style={[layer(size),{transform:[{rotate:outer.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']})}]}]}>
      <OrbitGraphic size={size} colors={colors} outer />
    </Animated.View>
  </View>;
});

export function NeonDisc({ size, color }) {
  const id=useGraphicId('disc');
  return <Svg width={size} height={size*1.16} viewBox="0 0 100 116">
    <Defs>
      <RadialGradient id={id} cx="50%" cy="48%" rx="60%" ry="60%">
        <Stop offset="0" stopColor={miscelaNeon('#041025',color,0.1)} /><Stop offset="0.7" stopColor="#050B1F" />
        <Stop offset="1" stopColor={miscelaNeon('#02091A',color,0.32)} />
      </RadialGradient>
      <LinearGradient id={id+'label'} x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0" stopColor={miscelaNeon('#040B1E',color,0.2)} /><Stop offset="0.6" stopColor="#04081B" />
        <Stop offset="1" stopColor={miscelaNeon('#03091B',color,0.35)} />
      </LinearGradient>
      <LinearGradient id={id+'edge'} x1="0%" y1="0%" x2="80%" y2="100%">
        <Stop offset="0" stopColor={color} /><Stop offset="0.45" stopColor={miscelaNeon(color,'#FFFFFF',0.55)} />
        <Stop offset="1" stopColor={color} stopOpacity="0.3" />
      </LinearGradient>
    </Defs>
    <Circle cx="50" cy="48" r="43" fill="#00030D" opacity="0.45" />
    <Circle cx="50" cy="46" r="43" fill="none" stroke={color} strokeWidth="13" opacity="0.025" />
    <Circle cx="50" cy="46" r="43" fill="none" stroke={color} strokeWidth="8" opacity="0.075" />
    <Circle cx="50" cy="46" r="43" fill="none" stroke={color} strokeWidth="4" opacity="0.17" />
    <Circle cx="50" cy="46" r="43" fill={'url(#'+id+')'} stroke={color} strokeWidth="0.9" strokeOpacity="0.4" />
    <Path d="M 14 73 A 43 43 0 1 1 86 73" stroke={'url(#'+id+'edge)'} strokeWidth="2.4" fill="none" />
    <Path d="M 19 22 A 40 40 0 0 1 60 7" stroke="#FFFFFF" strokeWidth="0.5" opacity="0.3" fill="none" />
    <Rect x="1" y="78" width="98" height="28" rx="14" fill={'url(#'+id+'label)'} stroke={color} strokeWidth="0.5" strokeOpacity="0.22" />
    <Path d="M 14 82 Q 50 77 86 82" stroke={color} strokeWidth="0.7" opacity="0.2" fill="none" />
  </Svg>;
}

export function StatPanel({ color, surface = '#040B21' }) {
  const id=useGraphicId('stat');
  return <Svg width="100%" height="100%" viewBox="0 0 100 140" preserveAspectRatio="none">
    <Defs><LinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
      <Stop offset="0" stopColor={miscelaNeon(surface,color,0.18)} /><Stop offset="0.6" stopColor={surface} />
      <Stop offset="1" stopColor={miscelaNeon(surface,color,0.07)} />
    </LinearGradient></Defs>
    <Rect x="1.5" y="1.5" width="97" height="137" rx="11" fill={'url(#'+id+')'} stroke={color} strokeWidth="2.5" strokeOpacity="0.05" />
    <Rect x="2" y="2" width="96" height="136" rx="10" fill="none" stroke={color} strokeOpacity="0.36" strokeWidth="0.7" />
    <Path d="M 3 30 L 3 12 Q 3 3 13 3 L 65 3" stroke={color} opacity="0.55" strokeWidth="0.6" fill="none" />
    <Path d="M 40 137 L 88 137 Q 97 137 97 128 L 97 100" stroke={color} opacity="0.35" strokeWidth="0.7" fill="none" />
  </Svg>;
}

export function CoinGlyph({ size=30, color='#4DE5A6' }) {
  return <Svg width={size} height={size} viewBox="0 0 40 40">
    <G fill={color} stroke="#041B20" strokeWidth="1">
      {[0,1,2,3].map(i=><G key={i}><Path d={`M 20 ${9+i*6} v 5 c 0 5 18 5 18 0 v -5 Z`} /><Ellipse cx="29" cy={9+i*6} rx="9" ry="4" /></G>)}
      {[0,1,2].map(i=><G key={i}><Path d={`M 2 ${18+i*6} v 5 c 0 5 18 5 18 0 v -5 Z`} /><Ellipse cx="11" cy={18+i*6} rx="9" ry="4" /></G>)}
    </G>
  </Svg>;
}

export function Atmosphere() {
  const id=useGraphicId('ambient');
  return <Svg width="100%" height="100%" viewBox="0 0 400 900" preserveAspectRatio="none">
    <Defs><RadialGradient id={id} cx="65%" cy="55%" rx="75%" ry="45%">
      <Stop offset="0" stopColor="#321459" stopOpacity="0.3" /><Stop offset="0.6" stopColor="#091737" stopOpacity="0.1" /><Stop offset="1" stopColor="#03081C" stopOpacity="0" />
    </RadialGradient></Defs><Rect width="400" height="900" fill={'url(#'+id+')'} />
  </Svg>;
}

// No replacement photo: this overlay is rendered only when backgroundPhoto is supplied.
export function PhotoFade({color='#03081B'}) {
  const id=useGraphicId('photoFade');
  return <Svg width="100%" height="100%" style={{position:'absolute',top:0,left:0}}>
    <Defs><LinearGradient id={id} x1="0%" y1="0%" x2="0%" y2="100%">
      <Stop offset="0" stopColor={color} stopOpacity="1" />
      <Stop offset="0.3" stopColor={color} stopOpacity="0.8" />
      <Stop offset="0.7" stopColor={color} stopOpacity="0.25" />
      <Stop offset="1" stopColor={color} stopOpacity="0.08" />
    </LinearGradient></Defs><Rect width="100%" height="100%" fill={'url(#'+id+')'} />
  </Svg>;
}
