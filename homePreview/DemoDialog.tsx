import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type AlertButton } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type DemoMessage = { title: string; message: string; buttons: AlertButton[] };
type Props = {
  message: DemoMessage | null;
  onClose: () => void;
  colors: { background: string; surface: string; text: string; homeAccent: string };
};

// React Native Web's Alert.alert is a no-op. Only demo callbacks use this dialog.
export default function DemoDialog({ message, onClose, colors }: Props) {
  return <Modal visible={Boolean(message)} transparent animationType="none" onRequestClose={onClose}>
    <SafeAreaView style={styles.shade}>
      <View accessibilityViewIsModal style={[styles.card, { backgroundColor: colors.surface }]}>
        <ScrollView>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{message?.title}</Text>
          <Text style={[styles.message, { color: colors.text }]}>{message?.message}</Text>
          {message?.buttons.map((button, index) => <Pressable key={index} accessibilityRole="button"
            onPress={() => { onClose(); button.onPress?.(); }}
            style={({ pressed }) => [styles.button, { borderColor: colors.homeAccent, opacity: pressed ? 0.7 : 1 }]}>
            <Text style={[styles.label, { color: colors.text }]}>{button.text}</Text>
          </Pressable>)}
        </ScrollView>
      </View>
    </SafeAreaView>
  </Modal>;
}
const styles = StyleSheet.create({
  shade: { flex: 1, backgroundColor: '#00000099', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 480, maxHeight: '90%', alignSelf: 'center', borderRadius: 22, padding: 20 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 12 }, message: { fontSize: 16, lineHeight: 24, marginBottom: 12 },
  button: { minHeight: 48, padding: 12, marginTop: 8, borderWidth: 1, borderRadius: 12, justifyContent: 'center' },
  label: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
