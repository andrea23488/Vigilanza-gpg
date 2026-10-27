import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import { PALETTE_ORIGINALE } from './temi';
import { AZIONI_CHAT_PERSONALI, BLOCCO_CHAT_PERSONALI, azioneSwipeChat, trascinamentoChat } from './chatPersonaliUiModel';

// Nessun callback di mutazione: le capacità personali non sono attestate dal backend.
export default function ChatConversationActions({ identity, paletteHome, onOpen, style, children }) {
  const palette = paletteHome || PALETTE_ORIGINALE;
  const [expanded, setExpanded] = useState(false);
  const suppressUntil = useRef(0);
  useEffect(() => { setExpanded(false); suppressUntil.current = 0; }, [identity]);
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_event, g) => trascinamentoChat(g.dx, g.dy),
    onPanResponderGrant: () => { suppressUntil.current = Date.now() + 600; },
    onPanResponderRelease: (_event, g) => {
      suppressUntil.current = Date.now() + 350;
      const action = azioneSwipeChat(g.dx, g.dy);
      if (action) setExpanded(action === 'apri');
    },
    onPanResponderTerminate: () => { suppressUntil.current = Date.now() + 350; },
    onPanResponderTerminationRequest: () => true,
  }), []);
  return <View {...pan.panHandlers} testID="chat-swipe-row">
    <Pressable testID="chat-open" accessibilityRole="button" style={style}
      accessibilityHint="Apri la conversazione. Scorri a sinistra o usa Azioni conversazione per mostrare le operazioni disponibili."
      onPress={() => { if (Date.now() >= suppressUntil.current) onOpen(); }}
      onLongPress={() => { suppressUntil.current = Date.now() + 350; setExpanded(true); }}>
      {children}
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Azioni conversazione" accessibilityState={{ expanded }}
      onPress={() => setExpanded(value => !value)} style={{ alignSelf: 'flex-end', minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', marginBottom: 8 }}>
      <Text style={{ color: palette.textMuted }}>{expanded ? 'Chiudi azioni' : 'Azioni conversazione'}</Text>
    </Pressable>
    {expanded && <View testID="chat-personal-actions" style={{ backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {AZIONI_CHAT_PERSONALI.map(label => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label}
          accessibilityState={{ disabled: true }} accessibilityHint={BLOCCO_CHAT_PERSONALI} disabled
          style={{ minHeight: 48, padding: 12, borderWidth: 1, borderColor: palette.border, borderRadius: 12, opacity: 0.55 }}>
          <Text style={{ color: palette.text }}>{label}</Text>
        </Pressable>)}
      </View>
      <Text accessibilityLiveRegion="polite" style={{ color: palette.textMuted, marginTop: 10 }}>{BLOCCO_CHAT_PERSONALI}</Text>
    </View>}
  </View>;
}

export function ChatArchivedContent({ paletteHome }) {
  const palette = paletteHome || PALETTE_ORIGINALE;
  return <View>
    <Text accessibilityRole="header" style={{ color: palette.text, fontSize: 28, fontWeight: '800', marginBottom: 16 }}>Archiviate</Text>
    <Text style={{ color: palette.textMuted, fontSize: 16 }}>{BLOCCO_CHAT_PERSONALI}</Text>
    <Text style={{ color: palette.textMuted, marginTop: 12 }}>Questa versione non consente ancora di consultare o ripristinare le chat archiviate. Le chat attuali restano accessibili nell’elenco principale.</Text>
  </View>;
}
