// Stable presentation IDs, to be connected to existing app callbacks in a later phase.
export const SETTINGS_OPTIONS = [
  { id: 'appearance', label: 'ASPETTO E COLORI', icon: 'color-palette-outline', description: 'Temi e colori della Home. La demo conserva le modifiche in memoria e non tocca le preferenze reali.' },
  { id: 'biometrics', label: 'ACCESSO BIOMETRICO', icon: 'finger-print-outline', description: 'Qui sarà collegata la gestione esistente di Face ID, Touch ID o biometria Android. La DEMO non richiede permessi e non modifica la sicurezza o le preferenze reali.' },
  { id: 'logout', label: 'LOGOUT', icon: 'log-out-outline', description: 'Il futuro collegamento al flusso esistente richiederà conferma prima di uscire dalla sessione. Questa DEMO non chiude alcuna sessione.' },
  { id: 'delete-account', label: 'ELIMINA ACCOUNT', icon: 'trash-outline', description: 'Il flusso esistente avverte che l’eliminazione è definitiva, rimuove account e dati associati e non consente il recupero dell’account. Sarà necessario confermare esplicitamente. Questa DEMO non cancella nulla.' },
  { id: 'legal-support', label: 'LEGALE E ASSISTENZA', icon: 'shield-checkmark-outline', description: 'Qui saranno collegati Privacy Policy, Termini d’uso, informazioni legali e assistenza già disponibili nell’app. La DEMO non apre siti né invia richieste di assistenza.' },
  { id: 'feedback', label: 'AIUTACI A MIGLIORARE', icon: 'bulb-outline', description: 'Spazio dimostrativo per suggerimenti, segnalazioni di problemi e proposte. Nessun messaggio viene composto, salvato o inviato.' },
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
