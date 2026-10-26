import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Keyboard, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generaPalette, ripristinaAspetto, ascoltaRisparmioHome, notificaRisparmioHome } from './temi';
import { DECORATED_SCREENS, ENERGY_KEY, decorationBandHeight, motionPermitted, specialTheme } from './themeDecorationsModel';
import ThemeScene from './ThemeScene';

type Preference={version:number;preset:string;background:string|null;accent:string|null};
type Page={preference:Preference;screen:string;operational:boolean};
type Sync={setPage:(page:Page)=>void;setPreview:(open:boolean)=>void};
type Policy={ready:boolean;energy:boolean;busy:boolean;motion:boolean;setEnergy:(energy:boolean)=>Promise<boolean>;setPreview:(open:boolean)=>void;start:()=>void;end:(event?:any)=>void};
const idle=()=>{};
const BridgeContext=createContext<Sync>({setPage:idle,setPreview:idle});
const EffectsContext=createContext<Policy>({ready:false,energy:true,busy:false,motion:false,setEnergy:async()=>false,setPreview:idle,start:idle,end:idle});

export function useThemeDecorationPage(preference:Preference,screen:string,operational:boolean) {
  const {setPage}=useContext(BridgeContext);
  useEffect(()=>{setPage({preference,screen,operational});},[preference,screen,operational,setPage]);
}
export function useThemeEffects() { return useContext(EffectsContext); }

export function ThemeDecorationFrame({preference,enabled=true,animated=false,suspended=false,kind='live',children,onStart=idle,onEnd=idle}:{
  preference:Preference;enabled?:boolean;animated?:boolean;suspended?:boolean;kind?:string;children:React.ReactNode;onStart?:()=>void;onEnd?:(event?:any)=>void;
}) {
  const insets=useSafeAreaInsets(),window=useWindowDimensions();
  const palette=generaPalette(preference),theme=specialTheme(preference);
  const band=decorationBandHeight(window.height),visible=Boolean(enabled&&theme),height=visible?insets.top+band:0;
  // A reserved band, not an overlay: operational content cannot be covered by artwork.
  const bandColor=theme?generaPalette({version:1,preset:theme.id,background:null,accent:null}).background:palette.background;
  return <View testID={`theme-${kind}-frame`} style={{flex:1,backgroundColor:palette.background}}>
    <View testID="theme-decorative-band" pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{height,paddingTop:visible?insets.top:0,paddingLeft:insets.left,paddingRight:insets.right,backgroundColor:bandColor,overflow:'hidden'}}>
      {visible&&!suspended&&theme&&<ThemeScene key={theme.id} themeId={theme.id} width={Math.max(1,window.width-insets.left-insets.right)} height={band} animated={animated} secondary={theme.secondary||theme.accent} background={bandColor}/>}
    </View>
    <View testID="theme-operational-content" style={{flex:1}} onTouchStart={onStart} onTouchEnd={onEnd} onTouchCancel={onEnd}>
      <SafeAreaProvider style={{flex:1}}>{children}</SafeAreaProvider>
    </View>
  </View>;
}

export function ThemeEffectsProvider({children}:{children:React.ReactNode}) {
  const [page,setPageState]=useState<Page>({preference:ripristinaAspetto(),screen:'home',operational:false});
  const [preview,setPreview]=useState(false),[ready,setReady]=useState(false),[energy,setEnergyState]=useState(true);
  const [busy,setBusy]=useState(false),[reduced,setReduced]=useState(true),[foreground,setForeground]=useState(AppState.currentState==='active');
  const [interacting,setInteracting]=useState(false),[keyboard,setKeyboard]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null),mounted=useRef(false),writing=useRef(false);
  const setPage=useCallback((next:Page)=>setPageState(old=>old.preference===next.preference&&old.screen===next.screen&&old.operational===next.operational?old:next),[]);
  const start=useCallback(()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;setInteracting(true);},[]);
  const end=useCallback((event?:any)=>{
    if(event?.nativeEvent?.touches?.length)return;
    if(timer.current)clearTimeout(timer.current);
    timer.current=setTimeout(()=>{timer.current=null;if(mounted.current)setInteracting(false);},800);
  },[]);
  useEffect(()=>{
    mounted.current=true;let live=true,accessibilityChanged=false,readVersion=0;
    const readEnergy=async()=>{
      const version=++readVersion;setReady(false);
      try{const raw=await AsyncStorage.getItem(ENERGY_KEY);if(live&&version===readVersion){setEnergyState(raw==='1');setReady(true);}}
      catch{if(live&&version===readVersion){setEnergyState(true);setReady(true);}}
    };
    const unsubscribe=ascoltaRisparmioHome(value=>{++readVersion;if(live){setEnergyState(value);setReady(true);}});
    readEnergy();
    const a11y=AccessibilityInfo.addEventListener('reduceMotionChanged',value=>{accessibilityChanged=true;if(live)setReduced(value);});
    AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(live&&!accessibilityChanged)setReduced(value);}).catch(()=>{});
    const app=AppState.addEventListener('change',state=>{if(!live)return;setForeground(state==='active');if(state==='active')readEnergy();});
    const show=Keyboard.addListener('keyboardDidShow',()=>{if(live)setKeyboard(true);});
    const hide=Keyboard.addListener('keyboardDidHide',()=>{if(live)setKeyboard(false);});
    return()=>{live=false;mounted.current=false;++readVersion;unsubscribe();a11y.remove();app.remove();show.remove();hide.remove();if(timer.current)clearTimeout(timer.current);timer.current=null;};
  },[]);
  const setEnergy=useCallback(async(value:boolean)=>{
    if(writing.current)return false;writing.current=true;if(mounted.current)setBusy(true);
    try{await AsyncStorage.setItem(ENERGY_KEY,value?'1':'0');notificaRisparmioHome(value);return true;}
    catch{return false;}
    finally{writing.current=false;if(mounted.current)setBusy(false);}
  },[]);
  const motion=motionPermitted({ready,reduced,foreground,energy,interacting:interacting||keyboard});
  const bridge=useMemo(()=>({setPage,setPreview}),[setPage]);
  const policy=useMemo(()=>({ready,energy,busy,motion,setEnergy,setPreview,start,end}),[ready,energy,busy,motion,setEnergy,start,end]);
  const enabled=page.operational&&DECORATED_SCREENS.includes(page.screen);
  return <BridgeContext.Provider value={bridge}><EffectsContext.Provider value={policy}>
    <ThemeDecorationFrame preference={page.preference} enabled={enabled} animated={motion && page.screen!=='home'} suspended={preview} onStart={start} onEnd={end}>{children}</ThemeDecorationFrame>
  </EffectsContext.Provider></BridgeContext.Provider>;
}

export function ThemeEffectsPreview({preference,children}:{preference:Preference;children:React.ReactNode}) {
  const policy=useThemeEffects();
  return <SafeAreaProvider style={{flex:1}}><ThemeDecorationFrame preference={preference} animated={false} kind="preview" onStart={policy.start} onEnd={policy.end}>{children}</ThemeDecorationFrame></SafeAreaProvider>;
}
export function ThemeEffectsSample({preference}:{preference:Preference}) {
  const theme=specialTheme(preference),window=useWindowDimensions();
  const [width,setWidth]=useState(Math.max(1,window.width-30));
  if(!theme)return null;
  const height=decorationBandHeight(window.height),background=generaPalette({version:1,preset:theme.id,background:null,accent:null}).background;
  return <View testID="theme-inline-preview" pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    onLayout={event=>{const value=event.nativeEvent.layout.width;if(value>0)setWidth(value);}}
    style={{height,overflow:'hidden',borderRadius:14,backgroundColor:background}}>
    <ThemeScene themeId={theme.id} width={width} height={height} animated={false} secondary={theme.secondary||theme.accent} background={background}/>
  </View>;
}
