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
export const PRESET_TEMI = Object.freeze([
  Object.freeze({ id: 'originale', nome: 'Originale', background: '#07111F', accent: '#168BFF' }),
  Object.freeze({ id: 'grafite', nome: 'Grafite e acquamarina', background: '#151A20', accent: '#5EEAD4' }),
  Object.freeze({ id: 'lavanda', nome: 'Notte e lavanda', background: '#171426', accent: '#C4B5FD' }),
  Object.freeze({ id: 'petrolio', nome: 'Petrolio e ambra', background: '#082329', accent: '#FCD34D' }),
  Object.freeze({ id: 'ardesia', nome: 'Ardesia e ghiaccio', background: '#182230', accent: '#93C5FD' }),
  Object.freeze({ id: 'prugna', nome: 'Prugna e rosa', background: '#241522', accent: '#FDA4AF' }),
]);
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
  const preset = PRESET_TEMI.find(p => p.id === id);
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
      border: text, homeAccent: accent, ...COLORI_FUNZIONALI });
  }
  return Object.freeze({ background, surface, surfaceRaised, accent,
    onAccent: testoSu(accent), text: textSicuro, textMuted: textSicuro,
    border: textSicuro, homeAccent: accent, ...COLORI_FUNZIONALI });
}
