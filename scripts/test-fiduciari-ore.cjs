const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const file = fs.readFileSync('fiduciariOre.js', 'utf8');
const nomi = [
  'isFestivoNazionaleItaliano',
  'segmentaTurniFiduciari',
  'calcolaOreFiduciari',
];
const sorgente = file.replaceAll('export function ', 'function ') +
  `\nmodule.exports = { ${nomi.join(', ')} };`;
const sandbox = { module: { exports: {} }, exports: {}, Date, Set, Map };
vm.runInNewContext(sorgente, sandbox);

const { calcolaOreFiduciari } = sandbox.module.exports;
const fixtureAgosto = require('../fixtures/fiduciari-agosto-2026.cjs');

function turno(giorno, inizio, fine, extra = {}) {
  return {
    tipo: 'turno',
    giorno,
    mese: 8,
    anno: 2026,
    inizio,
    fine,
    ...extra,
  };
}

function calcola(turni, configurazione = {}, meseTarget = 8) {
  return calcolaOreFiduciari({
    turni,
    meseTarget,
    annoTarget: 2026,
    configurazione,
  });
}

// 23:00-07:00 feriale: sette ore notturne e una diurna.
const notteFeriale = calcola([turno(11, '23:00', '07:00')]);
assert.equal(notteFeriale.ore.fisiche, 8);
assert.equal(notteFeriale.ore.notturne, 7);
assert.equal(notteFeriale.ore.domenicali, 0);

// Entrata nel Ferragosto: il 14 resta feriale, il segmento del 15 è festivo.
const entraFestivita = calcola([turno(14, '23:00', '07:00')]);
assert.equal(entraFestivita.ore.festive, 7);
assert.equal(entraFestivita.maggiorazioni.festivoNotturno, 6);
assert.equal(entraFestivita.maggiorazioni.festivoDiurno, 1);

// Uscita dal Ferragosto e ingresso nella domenica 16.
const esceFestivita = calcola([turno(15, '23:00', '07:00')]);
assert.equal(esceFestivita.ore.festive, 1);
assert.equal(esceFestivita.ore.domenicali, 7);
assert.equal(esceFestivita.maggiorazioni.domenicaleNotturno, 6);
assert.equal(esceFestivita.maggiorazioni.domenicaleDiurno, 1);

// Sabato -> domenica e domenica -> lunedi sono attribuiti alle date civili.
const sabatoDomenica = calcola([turno(1, '23:00', '07:00')]);
assert.equal(sabatoDomenica.ore.domenicali, 7);
const domenicaLunedi = calcola([turno(2, '23:00', '07:00')]);
assert.equal(domenicaLunedi.ore.domenicali, 1);
const resetSettimanaleLunedi = calcola(
  [turno(2, '20:00', '04:00')],
  { modalitaStraordinario: 'settimanale', sogliaSettimanale: 4 }
);
assert.equal(resetSettimanaleLunedi.ore.fisiche, 8);
assert.equal(resetSettimanaleLunedi.ore.straordinarie, 0);

// Il cambio mese attribuisce ogni segmento al mese civile corretto.
const cambioMese = turno(31, '23:00', '07:00');
const agostoCambioMese = calcola([cambioMese]);
const settembreCambioMese = calcola([cambioMese], {}, 9);
assert.equal(agostoCambioMese.ore.fisiche, 1);
assert.equal(settembreCambioMese.ore.fisiche, 7);

// Riposo lavorato: resta fisico, entra nello straordinario ed è anche classificato.
const riposoLavorato = calcola(
  [turno(3, '07:00', '15:00', { riposo_lavorato: true })],
  { modalitaStraordinario: 'giornaliera', sogliaGiornaliera: 7 }
);
assert.equal(riposoLavorato.ore.fisiche, 8);
assert.equal(riposoLavorato.ore.riposoLavorato, 8);
assert.equal(riposoLavorato.ore.straordinarie, 1);

// Settimana da 47 ore: le 8 ore di riposo lavorato non vengono sottratte.
const settimana47 = calcola([
  turno(3, '07:00', '14:00'),
  turno(4, '07:00', '15:00'),
  turno(5, '07:00', '15:00'),
  turno(6, '07:00', '15:00'),
  turno(7, '07:00', '15:00'),
  turno(8, '07:00', '15:00', { riposo_lavorato: true }),
]);
assert.equal(settimana47.ore.fisiche, 47);
assert.equal(settimana47.ore.riposoLavorato, 8);
assert.equal(settimana47.ore.straordinarie, 7);

// Festivo diurno e notturno alimentano categorie economiche distinte.
const festivoDiurno = calcola(
  [turno(15, '10:00', '12:00')],
  { modalitaStraordinario: 'giornaliera', sogliaGiornaliera: 1 }
);
assert.equal(festivoDiurno.straordinari.festivoDiurno50, 1);
const festivoNotturno = calcola(
  [turno(15, '22:00', '00:00')],
  { modalitaStraordinario: 'giornaliera', sogliaGiornaliera: 1 }
);
assert.equal(festivoNotturno.straordinari.festivoNotturno60, 1);

// Il calendario può aggiungere festività aziendali/locali senza hardcode.
const festivoConfigurato = calcola(
  [turno(3, '10:00', '12:00')],
  { festivitaAggiuntive: ['2026-08-03'] }
);
assert.equal(festivoConfigurato.ore.festive, 2);

// Una stessa ora può essere extra+domenicale+notturna senza duplicare il fisico.
const sovrapposizione = calcola(
  [turno(1, '23:00', '07:00')],
  { modalitaStraordinario: 'settimanale', sogliaSettimanale: 1 }
);
assert.equal(sovrapposizione.ore.fisiche, 8);
assert.equal(sovrapposizione.ore.straordinarie, 7);
assert.equal(sovrapposizione.ore.domenicali, 7);
assert.equal(sovrapposizione.ore.notturne, 7);
assert.equal(
  sovrapposizione.ore.ordinarie + sovrapposizione.ore.straordinarie,
  sovrapposizione.ore.fisiche
);

// Fixture reale: certifica solo ciò che calendario e configurazione determinano.
const agosto = calcolaOreFiduciari({
  turni: fixtureAgosto.turni,
  meseTarget: fixtureAgosto.meseTarget,
  annoTarget: fixtureAgosto.annoTarget,
  configurazione: fixtureAgosto.configurazione,
});
assert.equal(agosto.ore.fisiche, fixtureAgosto.certo.oreFisiche);
assert.equal(agosto.ore.notturne, fixtureAgosto.certo.oreNotturne);
assert.equal(agosto.ore.domenicali, fixtureAgosto.certo.oreDomenicali);
assert.equal(agosto.ore.festive, fixtureAgosto.certo.oreFestive);
assert.equal(agosto.ore.riposoLavorato, fixtureAgosto.certo.oreRiposoLavorato);
assert.equal(
  agosto.ore.straordinarie,
  fixtureAgosto.dipendenteDaConfigurazione.oreStraordinarieConSogliaSettimanale40
);
assert.equal(agosto.eventi.permesso.length, 1);
assert.equal(agosto.eventi.ferie, undefined);
assert.equal(agosto.ore.ordinarie + agosto.ore.straordinarie, 208.5);

const eventiDistinti = calcola([
  { tipo: 'ferie', giorno: 1, mese: 8, anno: 2026 },
  { tipo: 'permesso', giorno: 2, mese: 8, anno: 2026 },
  { tipo: 'rol', giorno: 3, mese: 8, anno: 2026 },
  { tipo: 'assenza', giorno: 4, mese: 8, anno: 2026 },
]);
assert.equal(eventiDistinti.eventi.ferie.length, 1);
assert.equal(eventiDistinti.eventi.permesso.length, 1);
assert.equal(eventiDistinti.eventi.rol.length, 1);
assert.equal(eventiDistinti.eventi.assenza.length, 1);

console.log('Regressione motore ore Fiduciari superata', {
  fisiche: agosto.ore.fisiche,
  ordinarie: agosto.ore.ordinarie,
  straordinarieConSoglia40: agosto.ore.straordinarie,
  notturne: agosto.ore.notturne,
  domenicali: agosto.ore.domenicali,
  festive: agosto.ore.festive,
  riposoLavorato: agosto.ore.riposoLavorato,
  categorieStraordinario: agosto.straordinari,
});
