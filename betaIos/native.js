import * as Native from 'react-native';
import React from 'react';
const disabled=()=>Promise.reject(Error('BETA: apertura esterna disabilitata.'));
export const Linking={...Native.Linking,openURL:disabled,canOpenURL:async()=>false};
// Remote Image loading is native and does not pass through the JS fetch guard.
export function Image(props) {
 const sources=Array.isArray(props.source)?props.source:[props.source];
 if(sources.some(s=>s?.uri && !s.uri.startsWith('data:')))return null;
 return React.createElement(Native.Image,props);
}
export * from 'react-native';
