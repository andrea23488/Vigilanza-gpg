// Fondazione indipendente dalle schermate. Nessun colore funzionale personalizzabile.
export const COLORI_FUNZIONALI = Object.freeze({
  success: '#50D89F', warning: '#FFAE57', error: '#FF6B6B',
  serviceActive: '#6BFF8A',
});
export const PALETTE_ORIGINALE = Object.freeze({
  background: '#07111F', surface: '#101C2D', surfaceRaised: '#101C2D',
  accent: '#168BFF', onAccent: '#07111F', text: '#FFFFFF',
  textMuted: '#91A3BA', border: '#203550',
  lightBlue: '#55B8FF', homeAccent: '#5EEBFF',
  ...COLORI_FUNZIONALI,
});
// Un solo catalogo alimenta le preferenze v1, la schermata Aspetto e la Home.
// Gli ID storici restano invariati per leggere senza migrazioni i salvataggi esistenti.
const CATALOGO_TEMI = Object.freeze([
  Object.freeze({ id: 'originale', nome: 'Originale', background: '#07111F', accent: '#168BFF', secondary: '#5EEBFF' }),
  Object.freeze({ id: 'blu-elettrico', nome: 'Blu elettrico', background: '#071329', accent: '#168BFF', secondary: '#55D8FF' }),
  Object.freeze({ id: 'neon-viola', nome: 'Neon viola', background: '#120D27', accent: '#9A57FF', secondary: '#F15BFF' }),
  Object.freeze({ id: 'grafite', nome: 'Grafite', background: '#151A20', accent: '#5EEAD4', secondary: '#7AA2B7' }),
  Object.freeze({ id: 'oceano', nome: 'Oceano', background: '#061D2A', accent: '#18A8C8', secondary: '#4DE4D0' }),
  Object.freeze({ id: 'verde-smeraldo', nome: 'Verde smeraldo', background: '#071F1A', accent: '#29C78A', secondary: '#95F0C8' }),
  Object.freeze({ id: 'rosso-rubino', nome: 'Rosso rubino', background: '#240D17', accent: '#EF476F', secondary: '#FF9A7A' }),
  Object.freeze({ id: 'oro-nero', nome: 'Oro e nero', background: '#17130A', accent: '#D7B35A', secondary: '#FFF0B3' }),
  Object.freeze({ id: 'petrolio', nome: 'Petrolio e ambra', background: '#082329', accent: '#FCD34D', secondary: '#42C8B6' }),
  Object.freeze({ id: 'lavanda', nome: 'Notte e lavanda', background: '#171426', accent: '#C4B5FD', secondary: '#8B7CF6' }),
  Object.freeze({ id: 'ardesia', nome: 'Ardesia e ghiaccio', background: '#182230', accent: '#93C5FD', secondary: '#D7F1FF' }),
  Object.freeze({ id: 'prugna', nome: 'Prugna e rosa', background: '#241522', accent: '#FDA4AF', secondary: '#C084FC' }),
  Object.freeze({ id: 'halloween', nome: 'Halloween', special: true, icon: 'moon-outline', background: '#160B24', accent: '#FF7A24', secondary: '#B65CFF', circuitColors: ['#FF7A24', '#B65CFF', '#79D65A', '#F04B87'] }),
  Object.freeze({ id: 'natale', nome: 'Natale', special: true, icon: 'snow-outline', background: '#08231C', accent: '#E75057', secondary: '#DDB759', circuitColors: ['#E75057', '#3BC68B', '#DDB759', '#8BD7E8'] }),
  Object.freeze({ id: 'militare', nome: 'Militare', special: true, icon: 'shield-half-outline', background: '#1B2217', accent: '#A9C17D', secondary: '#D7C7A2', circuitColors: ['#A9C17D', '#D7C7A2', '#69875A', '#C99C58'] }),
  Object.freeze({ id: 'cartoon', nome: 'Cartoon', special: true, icon: 'color-wand-outline', background: '#151B35', accent: '#FF5CA8', secondary: '#6DEBFF', circuitColors: ['#FF5CA8', '#6DEBFF', '#FFE66D', '#9E83FF'] }),
  Object.freeze({ id: 'galaxy', nome: 'Galaxy', special: true, icon: 'planet-outline', background: '#120D2C', accent: '#A68BFF', secondary: '#38D4F5', circuitColors: ['#A68BFF', '#38D4F5', '#ED6AFF', '#5F8DFF'] }),
  Object.freeze({ id: 'cyberpunk', nome: 'Cyberpunk', special: true, icon: 'flash-outline', background: '#10091F', accent: '#FF2E93', secondary: '#00E5FF', circuitColors: ['#FF2E93', '#00E5FF', '#B7FF3C', '#A24CFF'] }),
  Object.freeze({ id: 'inverno', nome: 'Inverno', special: true, icon: 'snow-outline', background: '#111E31', accent: '#9DDCFF', secondary: '#E7F4FF', circuitColors: ['#9DDCFF', '#E7F4FF', '#5F9FE5', '#B9C9E0'] }),
  Object.freeze({ id: 'gold-special', nome: 'Gold', special: true, icon: 'sparkles-outline', background: '#0F0C08', accent: '#D9B45B', secondary: '#FFF0BC', circuitColors: ['#D9B45B', '#FFF0BC', '#BA7C36', '#F0D38A'] }),
]);
// PRESET_TEMI rimane la vista legacy usata dalla schermata impostazioni già esistente.
// Il nuovo editor usa le due viste complete qui sotto, dalla stessa fonte canonica.
export const PRESET_TEMI = Object.freeze(CATALOGO_TEMI.filter(theme => ['originale', 'grafite', 'lavanda', 'petrolio', 'ardesia', 'prugna'].includes(theme.id)));
export const TEMI_PREIMPOSTATI = Object.freeze(CATALOGO_TEMI.filter(theme => !theme.special));
export const TEMI_SPECIALI = Object.freeze(CATALOGO_TEMI.filter(theme => theme.special));
export function validaColore(colore) {
  if (typeof colore !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(colore)) {
    throw new TypeError('Colore richiesto nel formato #RRGGBB.');
  }
  return colore.toUpperCase();
}
function canali(colore) {
  const hex = validaColore(colore);
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
}
function luminanza(colore) {
  const c = canali(colore).map(v => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
}
export function rapportoContrasto(a, b) {
  const x = luminanza(a), y = luminanza(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function testoSu(sfondo) {
  return rapportoContrasto('#FFFFFF', sfondo) >= rapportoContrasto('#000000', sfondo)
    ? '#FFFFFF' : '#000000';
}
function miscela(a, b, quota) {
  const x = canali(a), y = canali(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * quota)
    .toString(16).padStart(2, '0')).join('').toUpperCase();
}
export function selezionaPreset(id) {
  const preset = CATALOGO_TEMI.find(p => p.id === id);
  if (!preset) throw new RangeError('Preset sconosciuto.');
  return preset;
}
export function ripristinaAspetto() {
  return { version: 1, preset: 'originale', background: null, accent: null };
}
export function validaPreferenzaAspetto(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p) || p.version !== 1) {
    throw new TypeError('Preferenza aspetto non valida.');
  }
  selezionaPreset(p.preset);
  return { version: 1, preset: p.preset,
    background: p.background == null ? null : validaColore(p.background),
    accent: p.accent == null ? null : validaColore(p.accent) };
}
export function normalizzaPreferenzaAspetto(p) {
  try { return validaPreferenzaAspetto(p); } catch { return ripristinaAspetto(); }
}
export function personalizzaAspetto(p, { background, accent }) {
  const corrente = validaPreferenzaAspetto(p);
  return validaPreferenzaAspetto({ ...corrente,
    ...(background !== undefined ? { background } : {}),
    ...(accent !== undefined ? { accent } : {}) });
}
export function generaPalette(preferenza = ripristinaAspetto()) {
  const p = normalizzaPreferenzaAspetto(preferenza);
  if (p.preset === 'originale' && p.background === null && p.accent === null) {
    return PALETTE_ORIGINALE;
  }
  const preset = selezionaPreset(p.preset);
  const background = p.background ?? preset.background;
  const accent = p.accent ?? preset.accent;
  const secondary = preset.secondary ?? accent;
  const circuitColors = preset.circuitColors ? preset.circuitColors.map(color => p.accent ? miscela(color, accent, 0.2) : color) : undefined;
  const text = testoSu(background);
  const surface = miscela(background, text, 0.04);
  const surfaceRaised = miscela(background, text, 0.08);
  // Sceglie il testo anche sulle superfici: contrasto >= 4.5 per ogni ruolo.
  const coloriTesto = [background, surface, surfaceRaised];
  const textSicuro = ['#FFFFFF', '#000000'].find(t =>
    coloriTesto.every(b => rapportoContrasto(t, b) >= 4.5));
  if (!textSicuro) {
    // Sfondi prossimi alla soglia: mantenere superfici identiche evita zone illeggibili.
    return Object.freeze({ background, surface: background, surfaceRaised: background,
      accent, onAccent: testoSu(accent), text, textMuted: text,
      border: text, homeAccent: accent, homeAccentSecondary: secondary, ...(circuitColors ? { circuitColors } : {}), ...COLORI_FUNZIONALI });
  }
  return Object.freeze({ background, surface, surfaceRaised, accent,
    onAccent: testoSu(accent), text: textSicuro, textMuted: textSicuro,
    border: textSicuro, homeAccent: accent, homeAccentSecondary: secondary, ...(circuitColors ? { circuitColors } : {}), ...COLORI_FUNZIONALI });
}

// null mantiene integralmente il rendering precedente della Home.
export function paletteHomeDaPreferenza(preferenza) {
  const p = normalizzaPreferenzaAspetto(preferenza);
  if (p.preset === 'originale' && p.background === null && p.accent === null) return null;
  const palette = generaPalette(p);
  // Mantiene l'accento scelto: adatta soltanto la traccia della barra se necessario.
  const progressTrack = rapportoContrasto(palette.accent, palette.surface) >= 3
    ? palette.surface : testoSu(palette.accent);
  return Object.freeze({ ...palette, progressTrack, progressFill: palette.accent });
}
export function coloreHome(palette, ruolo, originale) {
  return palette === null ? originale : palette[ruolo];
}

// Accessible text variants never alter the stored accent or animation colors.
export function testoTema(palette, colore, minimo = 4.5) {
  if (!palette) return colore;
  let c; try { c = validaColore(colore); } catch { return palette.text; }
  const sfondi = [palette.background, palette.surface, palette.surfaceRaised];
  if (sfondi.every(s => rapportoContrasto(c, s) >= minimo)) return c;
  for (let step = 1; step <= 20; step++) {
    const leggibile = miscela(c, palette.text, step / 20);
    if (sfondi.every(s => rapportoContrasto(leggibile, s) >= minimo)) return leggibile;
  }
  return palette.text;
}

// Shared notification for the existing Home energy preference; no new storage key.
const ascoltatoriRisparmioHome = new Set();
export function ascoltaRisparmioHome(listener) {
  ascoltatoriRisparmioHome.add(listener);
  return () => ascoltatoriRisparmioHome.delete(listener);
}
export function notificaRisparmioHome(value) {
  ascoltatoriRisparmioHome.forEach(listener => { try { listener(Boolean(value)); } catch {} });
}
