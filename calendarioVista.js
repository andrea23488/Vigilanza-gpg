// Geometria e gesti della griglia approvata, senza logica di turni o salvataggi.
export function celleMeseCalendario(anno, mese) {
  const count = new Date(anno, mese + 1, 0).getDate();
  const offset = (new Date(anno, mese, 1).getDay() + 6) % 7;
  const length = Math.ceil((count + offset) / 7) * 7;
  return Array.from({ length }, (_, i) => i >= offset && i < offset + count ? i - offset + 1 : null);
}
export function trascinamentoCalendario(dx, dy) {
  return Math.abs(dx) >= 18 && Math.abs(dx) > Math.abs(dy) * 1.5;
}
export function swipeCalendario(dx, dy) {
  return Math.abs(dx) >= 64 && Math.abs(dx) > Math.abs(dy) * 1.5 ? (dx < 0 ? 1 : -1) : 0;
}
