import React, { createContext, useContext, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { generaPalette, PALETTE_ORIGINALE, paletteHomeDaPreferenza, selezionaPreset } from '../temi';
import ThemeDecorations from './ThemeDecorations';

type Preference = { version: number; preset: string; background: string | null; accent: string | null };
type Palette = typeof PALETTE_ORIGINALE & { circuitColors?: readonly string[]; homeAccentSecondary?: string; progressTrack?: string; progressFill?: string };
type ThemeDefinition = { id: string; nome: string; background: string; accent: string; secondary?: string; special?: boolean; icon?: React.ComponentProps<typeof Ionicons>['name']; circuitColors?: readonly string[] };
type DemoTheme = { preference: Preference; palette: Palette; homePalette: Palette | null; preset: ThemeDefinition; special: boolean };
const originalPreference: Preference = { version: 1, preset: 'originale', background: null, accent: null };
const defaultTheme: DemoTheme = { preference: originalPreference, palette: PALETTE_ORIGINALE, homePalette: null, preset: selezionaPreset('originale'), special: false };
const ThemeContext = createContext<DemoTheme>(defaultTheme);
export function useDemoTheme() { return useContext(ThemeContext); }

export function ThemeProvider({ preference, children, decorations = true }: { preference: Preference; children: React.ReactNode; decorations?: boolean }) {
  const value = useMemo<DemoTheme>(() => {
    const preset = selezionaPreset(preference.preset) as ThemeDefinition, palette = generaPalette(preference) as Palette;
    return { preference, palette, homePalette: paletteHomeDaPreferenza(preference) as Palette | null, preset, special: Boolean(preset.special) };
  }, [preference]);
  return <ThemeContext.Provider value={value}>
    <View style={[styles.root, { backgroundColor: value.palette.background }]}><View style={styles.content}>{children}</View>
      {decorations && value.special && <ThemeDecorations theme={value.preset} palette={value.palette} />}
    </View>
  </ThemeContext.Provider>;
}

const styles = StyleSheet.create({ root: { flex: 1, overflow: 'hidden' }, content: { flex: 1, zIndex: 2 }, });
