import React, { memo, useEffect, useId, useMemo, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { ELECTRIC_CYCLE_MS, fotogrammiImpulso, miscelaNeon, percorsoElettrico } from './homeElectric';

function ElectricConnections({width,height,button,diameter,colors,enabled}) {
  const size=Math.max(0,Math.min(width,height));
  const clock=useRef(new Animated.Value(0)).current;
  const id='ribbons'+useId().replace(/[^a-zA-Z0-9]/g,'');
  const routes=useMemo(()=>colors.map((color,index)=>{
    const route=percorsoElettrico(width,height,button,diameter,index);
    return route && {...route,color,trails:[0,1,2].map(tail=>fotogrammiImpulso(route,index,tail))};
  }),[width,height,button,diameter,colors]);
  useEffect(()=>{
    clock.setValue(0);if(!enabled)return undefined;
    const loop=Animated.loop(Animated.timing(clock,{toValue:1,duration:ELECTRIC_CYCLE_MS,easing:Easing.linear,useNativeDriver:true,isInteraction:false}));
    loop.start();return()=>{loop.stop();clock.stopAnimation();clock.setValue(0);};
  },[enabled,clock,width,height,button,diameter]);
  return <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" testID="home-outer-orbit" style={{position:'absolute',top:0,left:(width-size)/2,width:size,height:size,aspectRatio:1,flexGrow:0,flexShrink:0}}>
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} preserveAspectRatio="xMidYMid meet" style={{width:size,height:size,aspectRatio:1,flexShrink:0}}>
      <Defs>{routes.map((r,i)=>r&&<LinearGradient key={i} id={id+i} x1={r.points[0].x} y1={r.points[0].y} x2={r.points[32].x} y2={r.points[32].y} gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor={r.color} stopOpacity="0.1" /><Stop offset="0.4" stopColor={r.color} />
        <Stop offset="0.65" stopColor={miscelaNeon(r.color,'#FFFFFF',0.65)} /><Stop offset="1" stopColor={r.color} stopOpacity="0.2" />
      </LinearGradient>)}</Defs>
      {routes.map((r,i)=>r&&<G key={i}>
        <Path d={r.d} fill="none" stroke={r.color} strokeWidth="18" opacity="0.025" />
        <Path d={r.d} fill="none" stroke={r.color} strokeWidth="9" opacity="0.07" />
        <Path d={r.ribbonD} fill={'url(#'+id+i+')'} opacity="0.32" />
        <Path d={r.d} fill="none" stroke={'url(#'+id+i+')'} strokeWidth="2.4" opacity="0.75" />
        <Path d={r.d} fill="none" stroke={r.color} strokeWidth="0.6" opacity="0.9" />
      </G>)}
    </Svg>
    {enabled&&routes.map((r,i)=>r&&r.trails.map((f,tail)=>{
      const size=tail?6:10;
      return <Animated.View key={`${i}-${tail}`} style={{position:'absolute',left:-size/2,top:-size/2,width:size,height:size,borderRadius:size,
        backgroundColor:miscelaNeon(r.color,'#FFFFFF',tail?0.05:0.65),
        shadowColor:r.color,shadowOpacity:0.65,shadowRadius:tail?4:8,shadowOffset:{width:0,height:0},
        opacity:clock.interpolate({inputRange:f.opacityInput,outputRange:f.opacityOutput,extrapolate:'clamp'}),
        transform:[{translateX:clock.interpolate({inputRange:f.inputRange,outputRange:f.x,extrapolate:'clamp'})},
          {translateY:clock.interpolate({inputRange:f.inputRange,outputRange:f.y,extrapolate:'clamp'})}]}} />;
    }))}
  </View>;
}
export default memo(ElectricConnections);
