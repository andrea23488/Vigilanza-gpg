// Solo presentazione: nessuna API, cache persistente o mutazione dei messaggi.
export const BLOCCO_CHAT_PERSONALI = 'La gestione personale delle conversazioni non è ancora disponibile in questa versione. Nessun messaggio verrà modificato.';
export const AZIONI_CHAT_PERSONALI = Object.freeze(['Svuota chat', 'Elimina chat', 'Archivia chat']);
export function chiaveConversazionePersonale(userId, peerId) {
  return JSON.stringify([String(userId || ''), String(peerId || '')]);
}
export function conversazioniUniche(colleghi, userId) {
  const viste = new Set();
  return (Array.isArray(colleghi) ? colleghi : []).filter(c => {
    const peer = String(c?.altro_user_id || '').trim();
    if (!peer || peer === String(userId || '') || viste.has(peer)) return false;
    viste.add(peer); return true;
  });
}
export function trascinamentoChat(dx, dy) {
  return Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.5;
}
export function azioneSwipeChat(dx, dy) {
  if (!trascinamentoChat(dx, dy) || Math.abs(dx) < 48) return null;
  return dx < 0 ? 'apri' : 'chiudi';
}
