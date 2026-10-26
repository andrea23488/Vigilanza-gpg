import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import ThemeGlyph from './ThemeGlyphs';
import { layoutMotifs, layoutScenery } from './themeDecorationsModel';

type Props = { themeId:string; width:number; height:number; animated:boolean; secondary:string; background:string; immersive?:boolean };
export default function ThemeScene({ themeId, width, height, animated, secondary, background, immersive=false }:Props) {
  const phase = useRef(new Animated.Value(0.35)).current;
  const motifs = useMemo(() => (immersive?layoutScenery:layoutMotifs)(themeId,width,height),[themeId,width,height,immersive]);
  const moving = animated && motifs.some(m => m.motion !== 'static');
  useEffect(() => {
    phase.stopAnimation(); phase.setValue(moving ? 0 : .35);
    if (!moving) return undefined;
    const loop = Animated.loop(Animated.timing(phase, { toValue:1, duration:20000, easing:Easing.linear,
      useNativeDriver:Platform.OS !== 'web',isInteraction:false }));
    loop.start();
    return () => { loop.stop(); phase.stopAnimation(); };
  },[moving,phase,themeId]);
  return <View testID="theme-decoration-scene" pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{width,height,overflow:'hidden'}}>
    {motifs.map((motif,index) => {
      const style:any={position:'absolute',left:motif.x,top:motif.y,width:motif.drawWidth,height:motif.drawHeight,opacity:motif.background && motif.motion !== 'snow' ? .4 : .9};
      if(motif.motion==='snow') {
        const offset=(index%4)/4,cut=1-offset,distance=height+16;
        const y=offset ? phase.interpolate({inputRange:[0,cut-.002,cut+.002,1],outputRange:[offset*distance,distance,0,offset*distance]})
          : phase.interpolate({inputRange:[0,1],outputRange:[0,distance]});
        if(offset)style.opacity=phase.interpolate({inputRange:[0,cut-.004,cut-.002,cut+.002,cut+.004,1],outputRange:[.9,.9,0,0,.9,.9]});
        style.transform=[{translateY:y},{translateX:phase.interpolate({inputRange:[0,.5,1],outputRange:[0,index%2?5:-5,0]})}];
      }
      else if(motif.motion==='bat')style.transform=[{translateX:phase.interpolate({inputRange:[0,.5,1],outputRange:[-3,3,-3]})},{rotate:phase.interpolate({inputRange:[0,.5,1],outputRange:['-3deg','3deg','-3deg']})}];
      else if(motif.motion==='drift')style.transform=[{translateX:phase.interpolate({inputRange:[0,.5,1],outputRange:[-3,3,-3]})},{translateY:phase.interpolate({inputRange:[0,.5,1],outputRange:[1,-1,1]})}];
      if(['twinkle','pulse'].includes(motif.motion))style.opacity=phase.interpolate({inputRange:[0,.5,1],outputRange:immersive?[.38,.8,.38]:[.48,1,.48]});
      if(immersive) {
        const max=(motif as any).opacity ?? .5;
        style.opacity=motif.motion==='static'?max:phase.interpolate({inputRange:[0,.5,1],outputRange:[max*.65,max,max*.65]});
        if(motif.motion==='snow') {
          const offset=(index%4)/4,cut=1-offset;
          style.opacity=offset?phase.interpolate({inputRange:[0,cut-.004,cut-.002,cut+.002,cut+.004,1],outputRange:[max,max,0,0,max,max]}):phase.interpolate({inputRange:[0,.01,.98,1],outputRange:[0,max,max,0]});
        }
        if(motif.motion==='fly') {
          const start=index%2?.12:.58,end=start+.25;
          style.transform=[{translateX:phase.interpolate({inputRange:[0,start,end,1],outputRange:[0,0,width+120,width+120]})},{translateY:phase.interpolate({inputRange:[0,.5,1],outputRange:[0,-18,0]})}];
          style.opacity=phase.interpolate({inputRange:[0,start,start+.02,end-.02,end,1],outputRange:[0,0,max,max,0,0]});
        }
        if(motif.motion==='fly'&&!moving){style.left=width*(index%2?.08:.8);style.transform=[];style.opacity=max;}
        if(motif.motion==='cloud'||motif.motion==='mist')style.transform=[{translateX:phase.interpolate({inputRange:[0,.5,1],outputRange:[-12,16,-12]})}];
        if(motif.motion==='radar')style.transform=[{rotate:phase.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']})}];
      }
      return <Animated.View key={motif.key} testID={motif.id.startsWith('snow-')?'theme-snowflake':motif.id} pointerEvents="none" style={style}>
        <ThemeGlyph id={motif.id} width={motif.drawWidth} height={motif.drawHeight} secondary={secondary} background={background}/>
      </Animated.View>;
    })}
  </View>;
}
