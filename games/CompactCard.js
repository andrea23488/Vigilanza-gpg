import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import NapoletanaCard from './NapoletanaCard';
export default function CompactCard({ carta, width = 60, ...props }) {
  const viewport = useWindowDimensions();
  const base = Math.min(68, Math.max(58, (viewport.width - 72) / 3));
  const baseHeight = Math.round(base * 104 / 68);
  const height = baseHeight * width / base;
  return <View style={{ width: width + 8, height }}><View style={{ position: 'absolute', width: base + 8, height: baseHeight, left: (width - base) / 2, top: (height - baseHeight) / 2, transform: [{ scale: width / base }] }}><NapoletanaCard carta={carta} piccola {...props} /></View></View>;
}
