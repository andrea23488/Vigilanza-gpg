const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function caricaModulo(percorso, nomi) {
  const file = fs.readFileSync(percorso, 'utf8');
  const sorgente =
    file
      .replaceAll('export function ', 'function ')
      .replaceAll('export const ', 'const ') +
    `\nmodule.exports = { ${nomi.join(', ')} };`;
  const sandbox = {
    module: { exports: {} },
    exports: {},
    Date,
    Set,
    Map,
    Object,
  };
  vm.runInNewContext(sorgente, sandbox);
  return sandbox.module.exports;
}

const { calcolaOreFiduciari } = caricaModulo('fiduciariOre.js', [
  'calcolaOreFiduciari',
]);
const {
  calcolaEconomiaFiduciari,
  calibraProfiloFiscaleFiduciari,
  stimaNettoFiduciariDaProfilo,
} = caricaModulo('fiduciariEconomia.js', [
  'calcolaEconomiaFiduciari',
  'calibraProfiloFiscaleFiduciari',
  'stimaNettoFiduciariDaProfilo',
]);
const {
  costruisciInputEconomiaFiduciari,
} = caricaModulo('fiduciariIntegrazione.js', [
  'costruisciInputEconomiaFiduciari',
]);

const fixture = require('../fixtures/fiduciari-agosto-2026.cjs');

const ore = calcolaOreFiduciari({
  turni: fixture.turni,
  meseTarget: fixture.meseTarget,
  annoTarget: fixture.annoTarget,
  configurazione: fixture.configurazione,
});

assert.equal(ore.ore.fisiche, 208.5);
assert.equal(ore.ore.ordinarie, 175);
assert.equal(ore.ore.straordinarie, 33.5);

const inputAutomatico = costruisciInputEconomiaFiduciari({
  anno: fixture.annoTarget,
  mese: fixture.meseTarget,
  livello: fixture.configurazioneEconomicaDiagnostica.livello,
  oreSettimanali: 40,
  profiloCalcolo: 'automatico',
  scattiAnzianita:
    fixture.configurazioneEconomicaDiagnostica.scattiAnzianita,
  riepilogoOre: ore,
  percentualiMaggiorazioni: {
    domenicaleDiurno: 0,
    domenicaleNotturno: 0,
    festivoDiurno: 0,
    festivoNotturno: 0,
  },
  vociManuali: fixture.configurazioneEconomicaDiagnostica.vociManuali,
});

const economiaAutomatica = calcolaEconomiaFiduciari(inputAutomatico);
assert.equal(economiaAutomatica.arrotondato.lordoStimato, 1770.27);

const inputRiconciliato = costruisciInputEconomiaFiduciari({
  ...inputAutomatico,
  profiloCalcolo: 'automatico',
  riconciliazionePayroll: fixture.riconciliazioneCedolino,
});

const economiaRiconciliata = calcolaEconomiaFiduciari(inputRiconciliato);
assert.equal(
  economiaRiconciliata.arrotondato.lordoStimato,
  fixture.cedolinoReale.totaleCompetenze
);
assert.equal(economiaRiconciliata.arrotondato.totaleDopoTrattenute, 1817.74);

const cedolino = fixture.cedolinoReale;
const profilo = calibraProfiloFiscaleFiduciari({
  imponibilePrevidenziale: cedolino.imponibilePrevidenziale,
  imponibileFiscale: cedolino.imponibileIrpef,
  contributi: cedolino.contributi.totale,
  irpefMese: cedolino.irpefMese,
  addizionali: cedolino.addizionali.totale,
  altreTrattenute: cedolino.altreTrattenute,
});

assert.equal(profilo.disponibile, true);

const rapportoImponibileFiscale =
  cedolino.imponibileIrpef / cedolino.imponibilePrevidenziale;

assert.ok(Math.abs(
  rapportoImponibileFiscale -
    (1191.25 / 1761)
) < 1e-12);

const nettoStorico = stimaNettoFiduciariDaProfilo({
  economia: economiaRiconciliata,
  imponibilePrevidenziale: cedolino.imponibilePrevidenziale,
  imponibileFiscale:
    cedolino.imponibilePrevidenziale * rapportoImponibileFiscale,
  aliquotaContributiva: profilo.aliquotaContributiva,
  aliquotaFiscale: profilo.aliquotaFiscale,
  addizionali: profilo.addizionali,
  altreTrattenute: profilo.altreTrattenute,
  detrazioni: cedolino.arrotondamentoAttuale,
});

assert.equal(nettoStorico.disponibile, true);
assert.equal(nettoStorico.netto, 1519);

console.log('OK integrazione Fiduciari agosto 2026');
