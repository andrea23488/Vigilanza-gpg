import { coloreStileTema } from './temaSchermate';
import React from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { coloreHome } from './temi';
import { Ionicons } from '@expo/vector-icons';

// Original Profile panels, reused by Settings. Account procedures remain in App.js.
export function BiometriaImpostazioni({ biometriaAbilitata, cambiaBiometria, paletteHome = null }) {
  return (
<View
        style={{
          marginTop: 12,
          marginBottom: 8,
          padding: 16,
          borderRadius: 22,
          backgroundColor: coloreStileTema(paletteHome, coloreHome(paletteHome, 'surface', 'rgba(15, 38, 68, 0.86)'), 'backgroundColor'),
          borderWidth: 1,
          borderColor: coloreStileTema(paletteHome, coloreHome(paletteHome, 'border', 'rgba(83, 216, 255, 0.32)'), 'borderColor'),
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="finger-print-outline" size={27} color={coloreHome(paletteHome, 'accent', '#69E7FF')} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ color: coloreStileTema(paletteHome, coloreHome(paletteHome, 'text', '#FFFFFF'), 'color'), fontSize: 15, fontWeight: '900' }}>
              Accesso biometrico
            </Text>
            <Text style={{ color: coloreStileTema(paletteHome, coloreHome(paletteHome, 'textMuted', '#8FA5CC'), 'color'), fontSize: 10.5, lineHeight: 15, marginTop: 3 }}>
              Protegge la sessione salvata con Face ID, Touch ID o biometria Android. La password non viene memorizzata.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={biometriaAbilitata ? 'Disattiva accesso biometrico' : 'Attiva accesso biometrico'}
          onPress={cambiaBiometria}
          style={{
            marginTop: 13,
            minHeight: 44,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: coloreStileTema(paletteHome, biometriaAbilitata
              ? 'rgba(255, 100, 126, 0.18)'
              : 'rgba(40, 76, 255, 0.82)', 'backgroundColor'),
            borderWidth: 1,
            borderColor: coloreStileTema(paletteHome, biometriaAbilitata
              ? 'rgba(255, 100, 126, 0.42)'
              : 'rgba(111, 134, 255, 0.72)', 'borderColor'),
          }}
        >
          <Text style={{ color: coloreStileTema(paletteHome, coloreHome(paletteHome, 'text', '#FFFFFF'), 'color'), fontWeight: '900' }}>
            {biometriaAbilitata ? 'DISATTIVA' : 'ATTIVA'}
          </Text>
        </TouchableOpacity>
      </View>
  );
}

export function LegaleAssistenzaImpostazioni({ paletteHome = null }) {
  return (
<View
            style={{
              marginTop: 18,
              marginBottom: 4,
              padding: 14,
              borderRadius: 20,
              backgroundColor: coloreStileTema(paletteHome, coloreHome(paletteHome, 'surface', 'rgba(15, 31, 58, 0.72)'), 'backgroundColor'),
              borderWidth: 1,
              borderColor: coloreStileTema(paletteHome, coloreHome(paletteHome, 'border', 'rgba(100, 145, 205, 0.22)'), 'borderColor'),
            }}
          >
            <Text
              style={{
                color: coloreStileTema(paletteHome, coloreHome(paletteHome, 'textMuted', '#8FA5CC'), 'color'),
                fontSize: 10,
                fontWeight: '900',
                letterSpacing: 1,
                marginBottom: 10,
              }}
            >
              LEGALE E ASSISTENZA
            </Text>

            <TouchableOpacity
              accessibilityRole="link"
              accessibilityLabel="Privacy Policy"
              activeOpacity={0.82}
              onPress={() =>
                Linking.openURL(
                  'https://andrea23488.github.io/Vigilanza-gpg/privacy.html'
                )
              }
              style={{
                minHeight: 46,
                borderRadius: 15,
                paddingHorizontal: 13,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: coloreStileTema(paletteHome, coloreHome(paletteHome, 'surfaceRaised', 'rgba(70, 110, 175, 0.14)'), 'backgroundColor'),
                borderWidth: 1,
                borderColor: coloreStileTema(paletteHome, coloreHome(paletteHome, 'border', 'rgba(95, 150, 220, 0.24)'), 'borderColor'),
                marginBottom: 8,
              }}
            >
              <Text style={{ fontSize: 17, marginRight: 10 }}>🔒</Text>
              <Text
                style={{
                  color: coloreStileTema(paletteHome, coloreHome(paletteHome, 'text', '#FFFFFF'), 'color'),
                  fontSize: 13,
                  fontWeight: '800',
                  flex: 1,
                }}
              >
                Privacy Policy
              </Text>
              <Ionicons
                name="open-outline"
                size={16}
                color={coloreHome(paletteHome, 'textMuted', '#8FA5CC')}
              />
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="link"
              accessibilityLabel="Termini d’uso"
              activeOpacity={0.82}
              onPress={() =>
                Linking.openURL(
                  'https://andrea23488.github.io/Vigilanza-gpg/terms.html'
                )
              }
              style={{
                minHeight: 46,
                borderRadius: 15,
                paddingHorizontal: 13,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: coloreStileTema(paletteHome, coloreHome(paletteHome, 'surfaceRaised', 'rgba(70, 110, 175, 0.14)'), 'backgroundColor'),
                borderWidth: 1,
                borderColor: coloreStileTema(paletteHome, coloreHome(paletteHome, 'border', 'rgba(95, 150, 220, 0.24)'), 'borderColor'),
                marginBottom: 8,
              }}
            >
              <Text style={{ fontSize: 17, marginRight: 10 }}>📄</Text>
              <Text
                style={{
                  color: coloreStileTema(paletteHome, coloreHome(paletteHome, 'text', '#FFFFFF'), 'color'),
                  fontSize: 13,
                  fontWeight: '800',
                  flex: 1,
                }}
              >
                Termini d'uso
              </Text>
              <Ionicons
                name="open-outline"
                size={16}
                color={coloreHome(paletteHome, 'textMuted', '#8FA5CC')}
              />
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="link"
              accessibilityLabel="Assistenza"
              activeOpacity={0.82}
              onPress={() =>
                Linking.openURL(
                  'mailto:vigilanzagpg.app@gmail.com?subject=Assistenza%20Vigilanza%20GPG'
                )
              }
              style={{
                minHeight: 46,
                borderRadius: 15,
                paddingHorizontal: 13,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: coloreStileTema(paletteHome, coloreHome(paletteHome, 'surfaceRaised', 'rgba(70, 110, 175, 0.14)'), 'backgroundColor'),
                borderWidth: 1,
                borderColor: coloreStileTema(paletteHome, coloreHome(paletteHome, 'border', 'rgba(95, 150, 220, 0.24)'), 'borderColor'),
              }}
            >
              <Text style={{ fontSize: 17, marginRight: 10 }}>✉️</Text>
              <Text
                style={{
                  color: coloreStileTema(paletteHome, coloreHome(paletteHome, 'text', '#FFFFFF'), 'color'),
                  fontSize: 13,
                  fontWeight: '800',
                  flex: 1,
                }}
              >
                Assistenza
              </Text>
              <Ionicons
                name="mail-outline"
                size={16}
                color={coloreHome(paletteHome, 'textMuted', '#8FA5CC')}
              />
            </TouchableOpacity>
          </View>
  );
}
