// Solo geometria: le coordinate e le regole delle simulazioni non cambiano.
export function dimensioniBlock(width, height) {
  return Math.max(0, Math.min(25, Math.floor((width - 88) / 10), Math.floor((height - 4) / 20)));
}
export function dimensioniPong(width, height) {
  const scale = Math.max(0, Math.min(1, width / 320, height / 440));
  return { scale, width: 320 * scale, height: 440 * scale };
}
export function pagineTavolo(width, height, count, fontScale = 1) {
  const columns = Math.max(1, Math.floor(Math.max(0, width - 8) / 64));
  // Riservare anche i controlli di pagina prima di scegliere il numero di righe.
  const pagerHeight = Math.max(44, Math.ceil(24 * fontScale));
  const cardWidth = Math.min(68, Math.max(44, (width - 10) / columns - 8), Math.max(0, (height - pagerHeight - 16) * 68 / 104));
  const cardHeight = Math.round(cardWidth * 104 / 68);
  const rows = Math.max(1, Math.floor((height - pagerHeight - 10) / (cardHeight + 6)));
  const capacity = columns * rows;
  return { columns, rows, cardWidth, cardHeight, capacity, pages: Math.max(1, Math.ceil(count / capacity)), pagerHeight };
}
