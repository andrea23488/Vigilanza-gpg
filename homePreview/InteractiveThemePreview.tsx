import React from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import HomeScreen from '../HomeScreen';
import ThemeScenery from '../ThemeScenery';
import { ThemeEffectsProvider, useThemeDecorationPage, useThemeEffects } from '../ThemeEffects';
import { generaPalette, TEMI_SPECIALI } from '../temi';

type Preference = { version:number; preset:string; background:string|null; accent:string|null };
type Props = { preference:Preference; onPreference:(value:Preference)=>void; onBack:()=>void; data:any };
const noop=()=>{};
function InteractiveScene({preference,onPreference,onBack,data}:Props) {
  useThemeDecorationPage(preference,'home',true);
  const effects=useThemeEffects(),palette=generaPalette(preference);
  return <View style={{flex:1,minHeight:0,backgroundColor:palette.background}}>
    <SafeAreaView edges={['left','right']} style={{backgroundColor:palette.surface}}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:12}}>
        <Pressable accessibilityRole="button" accessibilityLabel="Torna a Aspetto e colori" onPress={onBack} style={{padding:12,minHeight:44}}>
          <Text style={{color:palette.text,fontWeight:'700'}}>‹ Colori · Anteprima</Text>
        </Pressable>
        <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
          <Text style={{color:palette.text,fontSize:12}}>Risparmio energia</Text>
          <Switch accessibilityLabel="Risparmio energia anteprima" value={effects.energy} disabled={!effects.ready||effects.busy} onValueChange={value=>{void effects.setEnergy(value);}} />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{paddingHorizontal:12,gap:8,paddingBottom:8}}>
        {TEMI_SPECIALI.map(theme=><Pressable key={theme.id} accessibilityRole="button" accessibilityState={{selected:preference.preset===theme.id}}
          onPress={()=>onPreference({version:1,preset:theme.id,background:null,accent:null})}
          style={{minHeight:44,padding:12,borderRadius:14,borderWidth:1,borderColor:palette.accent,backgroundColor:preference.preset===theme.id?palette.accent:palette.surface}}>
          <Text style={{color:preference.preset===theme.id?palette.onAccent:palette.text,fontWeight:'700'}}>{theme.nome}</Text>
        </Pressable>)}
      </ScrollView>
    </SafeAreaView>
    <View testID="interactive-theme-home" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{flex:1,minHeight:0}}>
      <HomeScreen {...data} decorationLayer={<ThemeScenery preference={preference}/>} paletteHome={palette} fotoProfilo={null} etaServizio={null} etaServizioLoading={false} etaTurno={null}
        onProfile={noop} onNotifications={noop} onSocial={noop} onSettings={noop} onCalendar={noop} onNavigate={noop} onColleghi={noop} onAddShift={noop}/>
    </View>
  </View>;
}
export default function InteractiveThemePreview(props:Props) {
  return <SafeAreaProvider><ThemeEffectsProvider><InteractiveScene {...props}/></ThemeEffectsProvider></SafeAreaProvider>;
}
