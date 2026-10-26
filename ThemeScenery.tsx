import React, { useState } from 'react';
import { View } from 'react-native';
import { generaPalette } from './temi';
import { specialTheme } from './themeDecorationsModel';
import { useThemeEffects } from './ThemeEffects';
import ThemeScene from './ThemeScene';

type Preference={version:number;preset:string;background:string|null;accent:string|null};
export default function ThemeScenery({preference}:{preference:Preference}) {
  const policy=useThemeEffects(),theme=specialTheme(preference);
  const [area,setArea]=useState({width:0,height:0});
  if(!theme)return null;
  const palette=generaPalette(preference);
  return <View testID="theme-home-scenery" pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    onLayout={event=>{const {width,height}=event.nativeEvent.layout;if(width>0&&height>0)setArea(old=>old.width===width&&old.height===height?old:{width,height});}}
    style={{position:'absolute',top:0,left:0,right:0,bottom:0,overflow:'hidden'}}>
    {area.width>0&&area.height>0&&<ThemeScene themeId={theme.id} width={area.width} height={area.height} animated={policy.motion} secondary={theme.secondary||theme.accent} background={palette.background} immersive/>}
  </View>;
}
