const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function caricaModuloFunzioni(percorso, nomi) {
  let sorgente = fs.readFileSync(percorso, 'utf8');
  sorgente = sorgente
    .replaceAll('export async function ', 'async function ')
    .replaceAll('export function ', 'function ')
    .replaceAll('export class ', 'class ')
    .replaceAll('export const ', 'const ');
  sorgente += `\nmodule.exports = { ${nomi.join(', ')} };`;

  const sandbox = {
    module: { exports: {} }, exports: {}, Date, Promise, AbortController,
    setTimeout, clearTimeout,
  };
  vm.runInNewContext(sorgente, sandbox);
  return sandbox.module.exports;
}

const {
  calcolaOreIntervallo, intervalloTemporaleTurno,
  aggregaTurniPerGiorno, rilevaSovrapposizioniGiornaliere,
} = caricaModuloFunzioni('turniCalcoli.js', [
  'calcolaOreIntervallo', 'intervalloTemporaleTurno',
  'aggregaTurniPerGiorno', 'rilevaSovrapposizioniGiornaliere',
]);
const { eseguiRichiestaTurni, creaErroreBackendTurni } =
  caricaModuloFunzioni('turniRete.js', [
    'eseguiRichiestaTurni', 'creaErroreBackendTurni',
  ]);

function turno({ id, giorno, mese = 9, anno = 2026, inizio, fine,
  ore, minutiAggiuntivi = 0 }) {
  return {
    id, tipo: 'turno', giorno, mese, anno, inizio, fine,
    ore: ore ?? calcolaOreIntervallo(inizio, fine),
    minuti_aggiuntivi_retribuiti: minutiAggiuntivi,
  };
}

async function main() {
  // A-B: turni rapidi di dodici ore, compreso quello oltre mezzanotte.
  assert.equal(calcolaOreIntervallo('06:00', '18:00'), 12);
  assert.equal(calcolaOreIntervallo('18:00', '06:00'), 12);
  const notturnoDodiciOre = turno({
    id: 'notte', giorno: 10, inizio: '18:00', fine: '06:00',
  });
  const intervalloNotturno = intervalloTemporaleTurno(notturnoDodiciOre);
  assert.equal(
    intervalloNotturno.fine - intervalloNotturno.inizio,
    12 * 60 * 60 * 1000
  );
  assert.equal(new Date(intervalloNotturno.fine).getUTCDate(), 11);

  // C e J: due record distinti e nessun minuto retribuito implicito.
  const scenario = [
    turno({ id: 1, giorno: 10, inizio: '06:00', fine: '14:00' }),
    turno({ id: 2, giorno: 10, inizio: '15:00', fine: '19:00' }),
  ];
  const [giorno] = aggregaTurniPerGiorno(scenario, 7);
  assert.equal(giorno.turni.length, 2);
  assert.deepEqual(Array.from(giorno.turni, (elemento) => elemento.id), [1, 2]);
  assert.equal(giorno.oreTurni, 12);
  assert.equal(giorno.oreRetribuite, 12);
  assert.equal(giorno.oreOrdinarie, 7);
  assert.equal(giorno.oreStraordinarie, 5);
  assert.equal(giorno.minutiAggiuntivi, 0);
  assert.equal(rilevaSovrapposizioniGiornaliere(scenario).length, 0);

  const [conStaccoEsplicito] = aggregaTurniPerGiorno(
    [scenario[0], { ...scenario[1], minuti_aggiuntivi_retribuiti: 60 }], 7
  );
  assert.equal(conStaccoEsplicito.oreTurni, 12);
  assert.equal(conStaccoEsplicito.oreRetribuite, 13);

  // D-E: contiguità consentita, sovrapposizione reale bloccata.
  const consecutivi = [
    turno({ id: 3, giorno: 12, inizio: '06:00', fine: '14:00' }),
    turno({ id: 4, giorno: 12, inizio: '14:00', fine: '22:00' }),
  ];
  assert.equal(rilevaSovrapposizioniGiornaliere(consecutivi).length, 0);
  const sovrappostiStessoGiorno = [
    turno({ id: 5, giorno: 12, inizio: '06:00', fine: '14:00' }),
    turno({ id: 6, giorno: 12, inizio: '13:00', fine: '19:00' }),
  ];
  assert.equal(rilevaSovrapposizioniGiornaliere(sovrappostiStessoGiorno).length, 1);

  // F-G: sovrapposizioni cross-date e confine esatto consentito.
  const notteESovrapposto = [
    turno({ id: 7, giorno: 10, inizio: '23:00', fine: '07:00' }),
    turno({ id: 8, giorno: 11, inizio: '06:00', fine: '14:00' }),
  ];
  assert.equal(rilevaSovrapposizioniGiornaliere(notteESovrapposto).length, 1);
  const notteEConsecutivo = [
    notteESovrapposto[0],
    turno({ id: 9, giorno: 11, inizio: '07:00', fine: '15:00' }),
  ];
  assert.equal(rilevaSovrapposizioniGiornaliere(notteEConsecutivo).length, 0);

  // H-I: cambio mese e cambio anno.
  const cambioMese = [
    turno({ id: 10, giorno: 31, mese: 10, inizio: '23:00', fine: '07:00' }),
    turno({ id: 11, giorno: 1, mese: 11, inizio: '06:00', fine: '14:00' }),
  ];
  assert.equal(rilevaSovrapposizioniGiornaliere(cambioMese).length, 1);
  const cambioAnno = [
    turno({ id: 12, giorno: 31, mese: 12, anno: 2026,
      inizio: '23:00', fine: '07:00' }),
    turno({ id: 13, giorno: 1, mese: 1, anno: 2027,
      inizio: '06:00', fine: '14:00' }),
  ];
  assert.equal(rilevaSovrapposizioniGiornaliere(cambioAnno).length, 1);

  // K: timeout, rete e backend mantengono diagnostiche distinte.
  await assert.rejects(
    eseguiRichiestaTurni({
      url: 'https://example.invalid/turni', operazione: 'il test timeout',
      timeoutMs: 5, fetchFn: () => new Promise(() => {}),
    }),
    (error) => error.codice === 'TIMEOUT'
  );
  await assert.rejects(
    eseguiRichiestaTurni({
      url: 'https://example.invalid/turni', operazione: 'il test rete',
      timeoutMs: 100,
      fetchFn: async () => { throw new TypeError('Network request failed'); },
    }),
    (error) => error.codice === 'RETE'
  );
  const backend = creaErroreBackendTurni({
    operazione: 'il test backend', status: 400, dettagli: 'column missing',
  });
  assert.equal(backend.codice, 'BACKEND');
  assert.equal(backend.status, 400);
  assert.match(backend.message, /column missing/);

  console.log('Regressione multi-turno e rete superata');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
