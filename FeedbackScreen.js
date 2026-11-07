import React, { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
export const SUPPORT_EMAIL = 'vigilanzagpg.app@gmail.com';
export function feedbackUrl(body) { return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Suggerimento Vigilanza GPG')}&body=${encodeURIComponent(body.trim())}`; }
export default function FeedbackScreen({ onBack }) {
  const [message, setMessage] = useState('');
  const [opening, setOpening] = useState(false);
  const send = async () => {
    if (!message.trim() || opening) return;
    setOpening(true);
    try { await Linking.openURL(feedbackUrl(message)); }
    catch { Alert.alert('Email non disponibile', `Configura un’app email sul dispositivo oppure scrivi a ${SUPPORT_EMAIL}. Il testo della segnalazione rimane qui.`); }
    finally { setOpening(false); }
  };
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#07142F' }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18, gap: 14 }}>
    <Pressable onPress={onBack} style={{ minHeight: 44 }}><Text style={{ color: '#70DFFF' }}>‹ Indietro</Text></Pressable>
    <Text style={{ color: '#FFF', fontSize: 22 }}>Aiutaci a migliorare</Text>
    <Text style={{ color: '#CEDBEC' }}>Descrivi il problema o il tuo suggerimento. “Invia email” apre il compositore: conferma l’invio nell’app email.</Text>
    <TextInput multiline accessibilityLabel="Segnalazione" placeholder="Scrivi la tua segnalazione…" placeholderTextColor="#91A5BD" value={message} onChangeText={setMessage} style={{ minHeight: 180, textAlignVertical: 'top', color: '#FFF', backgroundColor: '#142943', padding: 14, borderRadius: 12 }} />
    <Pressable accessibilityRole="button" disabled={!message.trim() || opening} onPress={send} style={{ minHeight: 48, padding: 14, borderRadius: 12, backgroundColor: '#205780', opacity: message.trim() ? 1 : 0.4 }}><Text style={{ color: '#FFF', fontWeight: '700' }}>Invia email</Text></Pressable>
  </ScrollView></SafeAreaView>;
}
