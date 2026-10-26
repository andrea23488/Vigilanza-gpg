// Only this pure label helper is required by the shared view/model. No API exports.
export function postazioneTurnoCondiviso(t) {return String(t.postazione||t.luogo||'').trim()||'Postazione non indicata';}
