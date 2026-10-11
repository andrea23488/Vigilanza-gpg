// Nessun endpoint, token, fetch o interruttore per attivare invii reali.
export function trasportoDisabilitato(): { stato: 'invio_disabilitato'; inviata: false } {
  return { stato: 'invio_disabilitato', inviata: false };
}
