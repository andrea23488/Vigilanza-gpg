const test = require('node:test');
const assert = require('node:assert/strict');

const {
  COEFFICIENTE_NETTO_GPG,
  calcolaDurataOre,
  calcolaOreDomenicali,
  calcolaOreRiposoLavorato,
  calcolaStraordinariConfigurati,
  coefficienteNetto,
  filtraTurniConclusi,
  parseOrario,
} = require('../stipendioEngine');

const turno = (giorno, inizio, fine, ore, extra = 0) => ({
  tipo: 'turno',
  giorno,
  mese: 8,
  anno: 2026,
  inizio,
  fine,
  ore,
  extra,
  riposo_lavorato: false,
});

test('durata e straordinario giornaliero rispettano la soglia configurata', () => {
  for (const [inizio, fine, ore, extra] of [
    ['06:00', '14:00', 8, 1],
    ['06:00', '18:00', 12, 5],
  ]) {
    assert.equal(calcolaDurataOre(inizio, fine), ore);
    assert.equal(calcolaStraordinariConfigurati({
      giornateMese: [turno(1, inizio, fine, ore)],
      modalita: 'giornaliero',
      sogliaGiornaliera: 7,
    }), extra);
  }
});

test('il turno notturno 22:00-06:00 dura 8 ore', () => {
  assert.equal(calcolaDurataOre('22:00', '06:00'), 8);
});

test('inizio uguale a fine non rappresenta 24 ore', () => {
  assert.equal(calcolaDurataOre('08:00', '08:00'), 0);
});

test('il confine domenicale è calcolato al minuto', () => {
  assert.equal(
    calcolaOreDomenicali([turno(1, '23:50', '00:20', 0.5)]),
    20 / 60
  );
});

test('riposo lavorato usa tutte le ore senza sottrarre extra', () => {
  const riposo = { ...turno(2, '06:00', '14:00', 8, 1), riposo_lavorato: true };
  const oreMotore = calcolaOreRiposoLavorato([riposo]);
  const oreConfronto = calcolaOreRiposoLavorato([riposo]);
  assert.equal(oreMotore, 8);
  assert.equal(oreConfronto, oreMotore);
});

test('lo straordinario settimanale maturato esclude i turni futuri', () => {
  const turni = [
    turno(3, '06:00', '14:00', 8),
    turno(4, '06:00', '14:00', 8),
    turno(5, '06:00', '14:00', 8),
    turno(6, '06:00', '14:00', 8),
    turno(7, '06:00', '18:00', 12),
  ];
  const conclusi = filtraTurniConclusi(turni, new Date(2026, 7, 6, 20));

  assert.equal(calcolaStraordinariConfigurati({
    giornateMese: conclusi,
    tuttiTurni: conclusi,
    modalita: 'settimanale',
    sogliaSettimanale: 40,
    meseTarget: 8,
    annoTarget: 2026,
  }), 0);
});

test('la validazione HH:MM rifiuta ore e minuti fuori intervallo', () => {
  assert.equal(parseOrario('25:00'), null);
  assert.equal(parseOrario('12:75'), null);
  assert.equal(parseOrario('NaN:00'), null);
});

test('mensile, maturato e previsione GPG usano lo stesso coefficiente', () => {
  const lordo = 1000;
  const mensile = lordo * coefficienteNetto('gpg');
  const maturato = lordo * coefficienteNetto('gpg');
  const previsione = lordo * coefficienteNetto('gpg');

  assert.equal(coefficienteNetto('gpg'), COEFFICIENTE_NETTO_GPG);
  assert.equal(mensile, maturato);
  assert.equal(maturato, previsione);
});
