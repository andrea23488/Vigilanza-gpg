// Prospetti interamente sintetici: identità e matricole fittizie.
function cella(testo, id, extra = {}) {
  return { id, testo, confidenza: null, rettangolo: null, ...extra };
}
function riga(id, testi, extra = {}) {
  return { id, testo: null, confidenza: null, rettangolo: null,
    celle: testi.map((t, i) => cella(t, `c-${i}`)), ...extra };
}
function pagina(id, numero, righe, extra = {}) {
  return { id, numero, larghezza: null, altezza: null, rotazione: null,
    testo: null, righe, errore: null, ...extra };
}
function documento(pagine, extra = {}) {
  return { id: 'documento-sintetico', tipo: 'pdf', testoOriginale: null,
    pagineAttese: null, pagine, ...extra };
}
function italpol() {
  const righe = [riga('header', ['Data', 'Nome', 'Cognome', 'Matricola', 'Servizio', 'Postazione'])];
  const giorni = [
    ['19/10/2026', '06:00-14:00'], ['20/10/2026', 'Riposo'], ['21/10/2026', 'MF'],
    ['22/10/2026', '22:00-06:00 del 23/10/2026'], ['23/10/2026', '15:00-22:00'],
    ['24/10/2026', '14:00-22:00'], ['25/10/2026', '14:00-22:00'],
  ];
  giorni.forEach(([d, s], i) => righe.push(riga(`r-${i}`, [d, 'Persona', 'Sintetica', 'TEST-0001', s, 'ITA S.P.A. - SERVIZIO RONDA'])));
  return documento([pagina('pagina-A', 1, righe)], { testoOriginale: 'Prospetto sintetico Italpol 19–25 ottobre 2026' });
}
function tabellaColonneSeparate() {
  return documento([pagina('pagina-A', 1, [
    riga('header', ['Badge', 'Giorno', 'Entrata', 'Uscita', 'Sede', 'Dipendente']),
    riga('r-1', ['TEST-0002', '2026-11-19', '6.00', '14.00', 'SEDE SINTETICA A', 'Persona due']),
    riga('r-2', ['TEST-0002', '2026-11-19', '15:00', '19:00', 'SEDE SINTETICA A', 'Persona due']),
  ])]);
}
function matrice() {
  return documento([pagina('pagina-A', 1, [
    riga('header', ['Nome', 'Cognome', 'Matricola', 'Postazione', '2026-10-19', '2026-10-20']),
    riga('persona-A', ['Persona', 'Sintetica', 'TEST-0001', 'SEDE TEST', '06:00-14:00', 'Riposo']),
    riga('persona-B', ['Persona', 'Sintetica', 'TEST-0002', 'SEDE TEST', '14:00-22:00', 'Ferie']),
  ])]);
}
module.exports = { cella, riga, pagina, documento, italpol, tabellaColonneSeparate, matrice };
