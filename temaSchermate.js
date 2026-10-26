import { rapportoContrasto } from './temi';

function rgb(value) {
  if (typeof value !== 'string') return null;
  const hex = /^#([\da-f]{6}|[\da-f]{3})$/i.exec(value);
  if (hex) { const s = hex[1].length === 3 ? [...hex[1]].map(c => c + c).join('') : hex[1]; return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16)); }
  const match = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(value);
  if (match) return match.slice(1, 4).map(Number);
  if (value.toLowerCase() === 'white') return [255, 255, 255];
  if (value.toLowerCase() === 'black') return [0, 0, 0];
  return null;
}
function hex(c) { return '#' + c.map(x => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase(); }
// Keep the selected accent unchanged; derive only its readable text variant.
export function testoLeggibile(colore, palette, rapporto = 4.5) {
  const c = rgb(colore);
  if (!c) return palette.text;
  const backgrounds = [palette.background, palette.surface, palette.surfaceRaised];
  const original = hex(c);
  if (backgrounds.every(bg => rapportoContrasto(original, bg) >= rapporto)) return original;
  const target = rgb(palette.text);
  for (let step = 1; step <= 20; step++) {
    const value = hex(c.map((x, i) => x + (target[i] - x) * step / 20));
    if (backgrounds.every(bg => rapportoContrasto(value, bg) >= rapporto)) return value;
  }
  return palette.text;
}
export function testoSuColore(colore) {
  return rapportoContrasto('#FFFFFF', colore) >= rapportoContrasto('#000000', colore) ? '#FFFFFF' : '#000000';
}
function funzionale(c) {
  if (!c) return false;
  const [r, g, b] = c;
  return (r > g * 1.22 && r > b * 1.12) || (g > r * 1.3 && g > b * 1.12);
}
export function coloreStileTema(palette, originale, proprieta, ruolo = '') {
  if (!palette || originale == null) return originale;
  if (originale === 'transparent') return originale;
  const c = rgb(originale);
  if (!c) return originale;
  if (proprieta === 'backgroundColor') {
    if ([palette.background, palette.surface, palette.surfaceRaised].includes(originale)) return originale;
    // Preserve transparent layers and black modal shades.
    if (/rgba\([^)]*,\s*0\s*\)/i.test(originale) || (c.every(x => x === 0) && /^rgba/i.test(originale))) return originale;
    if (ruolo === 'background') return palette.background;
    if (ruolo === 'accent') return palette.accent;
    return palette.surface;
  }
  if (proprieta === 'shadowColor') return palette.accent;
  if (/border.*Color/i.test(proprieta)) return funzionale(c) ? testoLeggibile(originale, palette, 3) : palette.border;
  if (proprieta === 'color' || proprieta === 'placeholderTextColor') {
    if (ruolo === 'onAccent') return palette.onAccent;
    if (funzionale(c)) return testoLeggibile(originale, palette);
    if (Math.max(...c) - Math.min(...c) > 45 && c[2] >= c[0]) return testoLeggibile(palette.homeAccent, palette);
    return proprieta === 'placeholderTextColor' ? palette.textMuted : palette.text;
  }
  return originale;
}
// Adapt only explicitly opted-in legacy screens; never mutate global styles.
export function stiliConTema(stili, palette, flatten = value => value) {
  if (!palette) return stili;
  return Object.fromEntries(Object.entries(stili).map(([name, value]) => {
    const style = flatten(value);
    if (!style || typeof style !== 'object') return [name, value];
    const result = { ...style };
    for (const key of Object.keys(result)) {
      if (!['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor', 'shadowColor'].includes(key)) continue;
      const role = /^(safe|screen|page|container)$/i.test(name) ? 'background'
        : /(?:save|send|primary|confirm)(?:button|text)/i.test(name) ? (key === 'color' ? 'onAccent' : 'accent') : '';
      result[key] = coloreStileTema(palette, result[key], key, role);
    }
    return [name, result];
  }));
}
