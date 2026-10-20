'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const m = require('../importazioneTurni/modello.ts');
const { campi, servizio, nonTurno, creaFixture, dipendenteSintetico } = require('../fixtures/importazioneTurni/italpol-ottobre-2026.cjs');
const copia = v => JSON.parse(JSON.stringify(v));
function revisionata(righe = [servizio()]) {
  let b = m.confermaDipendente(creaFixture('pdf', righe), dipendenteSintetico);
  for (const v of b.voci) b = m.confermaVoce(b, v.id, m.datiEffettivi(v));
  return b;
}
test('Italpol: sette giorni, cinque servizi, 2340 minuti / 39 ore; MF irrisolta', () => {
  const b = creaFixture();
  assert.deepEqual(m.riepilogaBozza(b), { giorni: 7, servizi: 5, minutiProgrammati: 2340,
    oreProgrammate: 39, intervalliNonQuantificabili: 0, daVerificare: 1, esclusi: 0 });
  assert.equal(m.statoVoce(b.voci[2]), 'da_verificare');
  assert.equal(m.datiEffettivi(b.voci[2]).causale.associazioneConfermata, null);
  assert.equal(m.prontaPerFuturoSalvataggio(b), false);
});
test('notte esplicita 22→23, durata otto ore e nessun conflitto con il servizio delle 15', () => {
  const b = creaFixture(), i = m.intervalloVoce(m.datiEffettivi(b.voci[3]));
  assert.equal(i.fine - i.inizio, 8 * 3600000);
  assert.equal(new Date(i.fine).toISOString(), '2026-10-23T06:00:00.000Z');
  assert.deepEqual(m.confrontaVoci(b), []);
});
test('riposo senza orari né ore implicite', () => {
  const b = creaFixture('pdf', [nonTurno('2026-10-20', 'riposo')]);
  assert.equal(m.riepilogaBozza(b).oreProgrammate, 0);
  assert.deepEqual(m.problemiDati(m.datiEffettivi(b.voci[0]), true), []);
});
test('PDF, immagine e screenshot conservano origine e testo', () => {
  for (const tipo of ['pdf', 'immagine', 'screenshot']) {
    const b = creaFixture(tipo);
    assert.equal(b.sorgenti[0].tipo, tipo);
    assert.ok(b.sorgenti[0].testoOriginale.includes('MF'));
    assert.equal(b.voci[0].rilevati.inizio.testoOriginale, '06:00');
    assert.equal(b.voci[0].rilevati.inizio.provenienza.pagina, 1);
    assert.equal(b.voci[0].rilevati.inizio.affidabilita, 0.98);
  }
});
test('due turni nello stesso giorno: nessuna fusione e nessuna ora nel vuoto', () => {
  const b = creaFixture('pdf', [servizio(), servizio('2026-10-19', '15:00', '19:00')]);
  assert.equal(m.riepilogaBozza(b).giorni, 1);
  assert.equal(m.riepilogaBozza(b).servizi, 2);
  assert.equal(m.riepilogaBozza(b).oreProgrammate, 12);
  assert.deepEqual(m.confrontaVoci(b), []);
});
test('sovrapposizione interna e oltre mezzanotte', () => {
  for (const righe of [
    [servizio(), servizio('2026-10-19', '13:00', '16:00')],
    [servizio('2026-10-22', '22:00', '06:00', '2026-10-23'), servizio('2026-10-23', '05:00', '08:00')],
  ]) assert.equal(m.confrontaVoci(creaFixture('pdf', righe))[0].tipo, 'sovrapposizione');
});
test('intervalli adiacenti consentiti', () => {
  assert.deepEqual(m.confrontaVoci(creaFixture('pdf', [servizio(), servizio('2026-10-19', '14:00', '18:00')])), []);
});
test('duplicato interno rilevato senza rimozioni', () => {
  const b = creaFixture('pdf', [servizio(), servizio()]);
  assert.equal(m.confrontaVoci(b)[0].tipo, 'duplicato');
  assert.equal(b.voci.length, 2);
  assert.throws(() => m.confermaBozza(revisionata([servizio(), servizio()]), true));
});
test('duplicati e conflitti esistenti non mutano calendario né bozza', () => {
  const b = revisionata(), esistenti = [{ id: 'esistente-1', dati: servizio() }];
  const prima = JSON.stringify({ b, esistenti });
  assert.equal(m.confrontaVoci(b, esistenti)[0].origine, 'esistente');
  assert.equal(m.confrontaVoci(b, esistenti)[0].tipo, 'duplicato');
  assert.throws(() => m.confermaBozza(b, true, esistenti));
  assert.equal(JSON.stringify({ b, esistenti }), prima);
  const diversoPosto = [{ id: 'altro-posto', dati: { ...servizio(), postazione: 'POSTO SINTETICO B' } }];
  assert.equal(m.confrontaVoci(b, diversoPosto)[0].tipo, 'sovrapposizione');
});
test('riposo o assenza concomitante al turno da verificare', () => {
  const b = creaFixture('pdf', [servizio(), nonTurno('2026-10-19', 'riposo')]);
  assert.equal(m.confrontaVoci(b)[0].tipo, 'giornata_incompatibile');
});
test('orari, data finale e postazione mancanti non vengono inventati', () => {
  for (const campo of ['data', 'inizio', 'fine', 'dataFine', 'postazione', 'tipo']) {
    const d = { ...servizio(), [campo]: null }, b = creaFixture('pdf', [d]);
    assert.equal(m.datiEffettivi(b.voci[0])[campo], null);
    assert.equal(m.statoVoce(b.voci[0]), 'da_verificare');
    assert.throws(() => m.confermaVoce(b, 'voce-1', d));
  }
});
test('orari malformati, uguali e date impossibili sono bloccati', () => {
  for (const variazione of [{ inizio: '25:00' }, { fine: '14:60' }, { inizio: '6-14' },
    { fine: '06:00' }, { data: '2026-02-30' }, { dataFine: '2026-10-18' },
    { dataFine: '2026-10-20', fine: '06:00' }]) {
    assert.equal(m.intervalloVoce({ ...servizio(), ...variazione }), null);
  }
});
test('nessuna deduzione automatica del giorno successivo', () => {
  const d = servizio('2026-10-22', '22:00', '06:00');
  assert.equal(m.intervalloVoce(d), null);
});
test('alternative e bassa affidabilità richiedono verifica; conferma conserva estrazione', () => {
  const rilevati = copia(campi(servizio()));
  rilevati.inizio.alternative = ['08:00'];
  rilevati.inizio.affidabilita = 0.4;
  const b = m.creaBozza({ id: 'ambiguo', sorgenti: creaFixture().sorgenti,
    dipendente: campi(dipendenteSintetico), voci: [{ id: 'a', rilevati }] });
  assert.equal(m.statoVoce(b.voci[0]), 'da_verificare');
  const corretto = m.confermaVoce(b, 'a', { ...servizio(), inizio: '08:00' });
  assert.equal(corretto.voci[0].confermati.inizio, '08:00');
  assert.equal(corretto.voci[0].rilevati.inizio.valore, '06:00');
  assert.equal(b.voci[0].confermati, null);
});
test('dipendente errato correggibile senza alterare nome/matricola rilevati', () => {
  const b = creaFixture();
  const corretto = m.confermaDipendente(b, { nome: 'Altra', cognome: 'Persona sintetica', matricola: 'TEST-0002' });
  assert.equal(corretto.dipendente.confermati.matricola, 'TEST-0002');
  assert.equal(corretto.dipendente.rilevati.matricola.valore, 'TEST-0001');
  assert.equal(b.dipendente.confermati, null);
  assert.throws(() => m.confermaDipendente(b, { nome: null, cognome: null, matricola: null }));
});
test('identità parziale ammessa con matricola o solo nome', () => {
  for (const d of [{ nome: null, cognome: null, matricola: 'TEST-0003' }, { nome: 'Sintetico', cognome: null, matricola: null }]) {
    assert.deepEqual(m.confermaDipendente(creaFixture(), d).dipendente.confermati, d);
  }
});
test('MF irrisolta non confermabile e nessun trattamento economico generato', () => {
  const b = creaFixture(), d = m.datiEffettivi(b.voci[2]);
  assert.throws(() => m.confermaVoce(b, 'voce-3', d));
  assert.equal(JSON.stringify(b).includes('congedo30'), false);
  assert.equal(JSON.stringify(b).includes('congedo80'), false);
  assert.throws(() => m.confermaBozza(b, true));
});
test('mapping causale solo con scelta manuale esplicita, nessun calcolo stipendiale', () => {
  const b = creaFixture(), d = m.datiEffettivi(b.voci[2]);
  const c = m.confermaVoce(b, 'voce-3', { ...d, causale: { ...d.causale, associazioneConfermata: 'causale-verificata-manualmente' } });
  assert.equal(c.voci[2].confermati.causale.associazioneConfermata, 'causale-verificata-manualmente');
  assert.equal(c.voci[2].rilevati.causale.valore.associazioneConfermata, null);
});
test('dati rilevati affidabili restano non confermati', () => {
  const b = creaFixture('pdf', [servizio()]);
  assert.equal(m.statoVoce(b.voci[0]), 'rilevata');
  assert.throws(() => m.confermaBozza(b, true));
});
test('conferma esplicita obbligatoria, revisioni successive la invalidano', () => {
  const b = revisionata();
  assert.equal(m.prontaPerFuturoSalvataggio(b), false);
  assert.throws(() => m.confermaBozza(b, false));
  assert.throws(() => m.confermaBozza(b, 'true'));
  const c = m.confermaBozza(b, true);
  assert.equal(m.prontaPerFuturoSalvataggio(c), true);
  assert.equal(m.prontaPerFuturoSalvataggio(m.confermaVoce(c, 'voce-1', servizio())), false);
  assert.equal(m.prontaPerFuturoSalvataggio(m.confermaDipendente(c, dipendenteSintetico)), false);
  assert.equal(m.prontaPerFuturoSalvataggio(m.escludiVoce(c, 'voce-1', true)), false);
  assert.equal(m.prontaPerFuturoSalvataggio(c, [{ id: 'nuovo-concorrente', dati: servizio() }]), false);
});
test('Italpol parziale: MF esclusa esplicitamente e 39 ore preservate', () => {
  let b = m.confermaDipendente(creaFixture(), dipendenteSintetico);
  b = m.escludiVoce(b, 'voce-3', true);
  for (const v of b.voci.filter(v => !v.esclusa)) b = m.confermaVoce(b, v.id, m.datiEffettivi(v));
  b = m.confermaBozza(b, true);
  assert.equal(m.prontaPerFuturoSalvataggio(b), true);
  assert.equal(m.riepilogaBozza(b).esclusi, 1);
  assert.equal(m.riepilogaBozza(b).oreProgrammate, 39);
  assert.equal(b.voci.length, 7);
});
test('immutabilità profonda, input separato e serializzazione JSON', () => {
  const b = creaFixture();
  assert.throws(() => { b.voci[0].rilevati.inizio.valore = '09:00'; }, TypeError);
  const copiaDati = m.datiEffettivi(b.voci[0]); copiaDati.inizio = '09:00';
  assert.equal(b.voci[0].rilevati.inizio.valore, '06:00');
  assert.deepEqual(JSON.parse(JSON.stringify(b)), b);
  assert.deepEqual(m.riepilogaBozza(JSON.parse(JSON.stringify(b))), m.riepilogaBozza(b));
});
test('nessun identificativo duplicato o provenienza sconosciuta', () => {
  const source = creaFixture().sorgenti, emp = campi(dipendenteSintetico), r = campi(servizio());
  assert.throws(() => m.creaBozza({ id: 'x', sorgenti: source, dipendente: emp, voci: [{ id: 'a', rilevati: r }, { id: 'a', rilevati: r }] }));
  assert.throws(() => m.creaBozza({ id: 'x', sorgenti: source, dipendente: emp, voci: [{ id: 'a', rilevati: campi(servizio(), 'r', 'sconosciuta') }] }));
  assert.throws(() => m.confermaVoce(creaFixture(), 'inesistente', servizio()));
  assert.throws(() => m.escludiVoce(creaFixture(), 'inesistente', true));
});
test('affidabilità invalida rifiutata, affidabilità sconosciuta conservata', () => {
  for (const v of [-0.1, 1.1, NaN]) assert.throws(() => m.datoEstratto('x', 'x', campi(servizio()).inizio.provenienza, v));
  assert.equal(m.datoEstratto(null, '', campi(servizio()).inizio.provenienza).affidabilita, null);
});
test('riposo del giorno successivo intercetta la notte precedente', () => {
  const b = creaFixture('pdf', [servizio('2026-10-22', '22:00', '06:00', '2026-10-23'), nonTurno('2026-10-23', 'riposo')]);
  assert.equal(m.confrontaVoci(b)[0].tipo, 'giornata_incompatibile');
});
test('correzione dipendente richiede revisione dei servizi già confermati', () => {
  const b = m.confermaBozza(revisionata(), true);
  const c = m.confermaDipendente(b, { ...dipendenteSintetico, matricola: 'TEST-ALTRO' });
  assert.equal(c.voci[0].confermati, null);
  assert.equal(c.conferma, null);
  assert.throws(() => m.confermaBozza(c, true));
});
test('nessun mapping può arrivare come già confermato dall’estrazione', () => {
  const d = nonTurno('2026-10-21', 'causale', { codice: 'MF', descrizione: null, associazioneConfermata: 'congedo30' });
  assert.throws(() => creaFixture('pdf', [d]));
});
test('orari con alternative non contribuiscono al totale finché non revisionati', () => {
  const rilevati = copia(campi(servizio())); rilevati.inizio.alternative = ['08:00'];
  const b = m.creaBozza({ id: 'alternativa', sorgenti: creaFixture().sorgenti,
    dipendente: campi(dipendenteSintetico), voci: [{ id: 'a', rilevati }] });
  assert.equal(m.riepilogaBozza(b).oreProgrammate, 0);
  assert.equal(m.riepilogaBozza(b).intervalliNonQuantificabili, 1);
});
test('tutte le voci escluse impediscono la conferma', () => {
  assert.throws(() => m.confermaBozza(m.escludiVoce(revisionata(), 'voce-1', true), true));
});
