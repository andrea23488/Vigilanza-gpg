// Dati sintetici: nessun nome o matricola di persone reali.
const m = require('../../importazioneTurni/modello.ts');
const dipendenteSintetico = { nome: 'Persona', cognome: 'Sintetica', matricola: 'TEST-0001' };
function campi(dati, riferimento = 'riga sintetica', sorgenteId = 'prospetto-test') {
  return Object.fromEntries(Object.entries(dati).map(([k, v]) => [k,
    m.datoEstratto(v, v === null ? '' : typeof v === 'object' ? v.codice : String(v),
      { sorgenteId, pagina: 1, riferimento, rettangolo: null }, 0.98)]));
}
function servizio(data = '2026-10-19', inizio = '06:00', fine = '14:00', dataFine = data) {
  return { data, tipo: 'turno', inizio, fine, dataFine,
    postazione: 'ITA S.P.A. - SERVIZIO RONDA', causale: null };
}
function nonTurno(data, tipo, causale = null) {
  return { data, tipo, inizio: null, fine: null, dataFine: null, postazione: null, causale };
}
function creaFixture(tipoSorgente = 'pdf', righe) {
  const dati = righe ?? [
    servizio(), nonTurno('2026-10-20', 'riposo'),
    nonTurno('2026-10-21', 'causale', { codice: 'MF', descrizione: 'Maternità facoltativa', associazioneConfermata: null }),
    servizio('2026-10-22', '22:00', '06:00', '2026-10-23'),
    servizio('2026-10-23', '15:00', '22:00'),
    servizio('2026-10-24', '14:00', '22:00'),
    servizio('2026-10-25', '14:00', '22:00'),
  ];
  return m.creaBozza({ id: 'italpol-sintetico-2026-10',
    sorgenti: [{ id: 'prospetto-test', tipo: tipoSorgente,
      testoOriginale: 'Fixture sintetica Italpol 19–25/10/2026: 19 06:00-14:00; 20 riposo; 21 MF; 22 22:00-06:00 del 23; 23 15:00-22:00; 24 e 25 14:00-22:00.' }],
    dipendente: campi(dipendenteSintetico),
    voci: dati.map((d, i) => ({ id: `voce-${i + 1}`, rilevati: campi(d, `riga ${i + 1}`) })),
  });
}
module.exports = { campi, servizio, nonTurno, creaFixture, dipendenteSintetico };
