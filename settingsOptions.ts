// Identificativi del menu reale; le azioni account restano nell’app.
export const SETTINGS_OPTIONS = [
  { id: 'appearance', label: 'ASPETTO E COLORI', icon: 'color-palette-outline' },
  { id: 'biometrics', label: 'ACCESSO BIOMETRICO', icon: 'finger-print-outline' },
  { id: 'logout', label: 'LOGOUT', icon: 'log-out-outline' },
  { id: 'delete-account', label: 'ELIMINA ACCOUNT', icon: 'trash-outline' },
  { id: 'legal-support', label: 'LEGALE E ASSISTENZA', icon: 'shield-checkmark-outline' },
  { id: 'feedback', label: 'AIUTACI A MIGLIORARE', icon: 'bulb-outline' },
] as const;
export type SettingsOptionId = typeof SETTINGS_OPTIONS[number]['id'];

// Sizing estimate for the six compact rows. Natural text height may still grow;
// the ScrollView remains available rather than hiding large accessibility text.
export function settingsLayout(width: number, height: number, top = 0, bottom = 0, fontScale = 1) {
  const font = Math.max(1, fontScale);
  const body = Math.max(0, height - top - bottom - 56);
  const fixed = 50 * font + 80;
  const minimum = Math.max(60, Math.ceil(44 * font + 16));
  const rowHeight = Math.max(minimum, Math.min(76, (body - fixed) / 6));
  return { rowHeight, contentWidth: Math.min(560, Math.max(0, width)),
    estimatedHeight: fixed + rowHeight * 6, availableHeight: body,
    needsScroll: fixed + rowHeight * 6 > body };
}
