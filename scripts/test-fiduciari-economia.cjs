const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function caricaModulo(percorso, nomi) {
  const file = fs.readFileSync(percorso, 'utf8');
  const sorgente = file
    .replaceAll('export function ', 'function ')
    .replaceAll('export const ', 'const ') +
    `\nmodule.exports = { ${nomi.join(', ')} };`;
  const sandbox = { module: { exports: {} }, exports: {}, Date, Set, Map };
  vm.runInNewContext(sorgente, sandbox);
  return sandbox.module.exports;
}

const { calcolaOreFiduciari } = caricaModulo('fiduciariOre.js', [
  'calcolaOreFiduciari',
]);
const {
  TABELLE_RETRIBUTIVE_FIDUCIARI,
  selezionaPagaBaseFiduciari,
  normalizzaVociManuali,
  normalizzaRiconciliazionePayroll,
  stimaNettoFiduciari,
  stimaNettoFiduciariDaProfilo,
  calibraProfiloFiscaleFiduciari,
  calcolaEconomiaFiduciari,
} = caricaModulo('fiduciariEconomia.js', [
  'TABELLE_RETRIBUTIVE_FIDUCIARI',
  'selezionaPagaBaseFiduciari',
  'normalizzaVociManuali',
  'normalizzaRiconciliazionePayroll',
  'stimaNettoFiduciari',
  'stimaNettoFiduciariDaProfilo',
  'calibraProfiloFiscaleFiduciari',
  'calcolaEconomiaFiduciari',
]);
const fixture = require('../fixtures/fiduciari-agosto-2026.cjs');

const riepilogoVuoto = {
  ore: { fisiche: 0, riposoLavorato: 0 },
  straordinari: {},
  maggiorazioni: {},
  eventi: {},
};

function calcola(overrides = {}) {
  return calcolaEconomiaFiduciari({
    anno: 2026,
    mese: 8,
    livello: 'D',
    riepilogoOre: riepilogoVuoto,
    ...overrides,
  });
}

const tabellaD = selezionaPagaBaseFiduciari({
  anno: 2026,
  mese: 8,
  livello: 'D',
  tabelle: TABELLE_RETRIBUTIVE_FIDUCIARI,
});
assert.equal(tabellaD.importo, 1281.43);
assert.equal(tabellaD.decorrenza, 202604);

// Lavoratore senza scatti.
const senzaScatti = calcola();
assert.equal(senzaScatti.arrotondato.pagaBase, 1281.43);
assert.equal(senzaScatti.arrotondato.scattiAnzianita, 0);
assert.equal(senzaScatti.arrotondato.lordoStimato, 1281.43);

// Uno o più scatti restano separati dalla paga base ma entrano nella paga oraria.
const conScatti = calcola({ scattiAnzianita: 15 });
assert.equal(conScatti.arrotondato.pagaBase, 1281.43);
assert.equal(conScatti.arrotondato.scattiAnzianita, 15);
assert.equal(conScatti.retribuzioneDiFatto.toFixed(2), '1296.43');
assert.equal(conScatti.pagaOraria.toFixed(5), '7.49382');
const piuScatti = calcola({ scattiAnzianita: 30 });
assert.equal(piuScatti.arrotondato.scattiAnzianita, 30);

// Superminimo separato e, salvo configurazione, escluso dalla paga oraria.
const superminimo = calcola({ superminimo: 100 });
assert.equal(superminimo.arrotondato.superminimo, 100);
assert.equal(superminimo.arrotondato.lordoStimato, 1381.43);
assert.equal(superminimo.pagaOraria.toFixed(5), (1281.43 / 173).toFixed(5));

// Voci imponibili, esenti, trattenute e L.207/24 manuale.
const voci = calcola({
  vociManuali: [
    { id: 'imponibile', descrizione: 'Indennità imponibile', importo: 20, natura: 'imponibile' },
    { id: 'l207', descrizione: 'L.207/24', importo: 57.18, natura: 'esente' },
    { id: 'trattenuta', descrizione: 'Trattenuta', importo: 26, natura: 'trattenuta' },
  ],
});
assert.equal(voci.altreCompetenzeImponibili, 20);
assert.equal(voci.competenzeEsenti, 57.18);
assert.equal(voci.trattenute, 26);
assert.equal(voci.arrotondato.totaleDopoTrattenute, 1332.61);
assert.equal(normalizzaVociManuali([{ importo: 10, natura: 'esente' }])[0].imponibileFiscale, false);

// Le quattro categorie di straordinario usano percentuali indipendenti.
const quattroCategorie = calcola({
  scattiAnzianita: 15,
  riepilogoOre: {
    ...riepilogoVuoto,
    straordinari: {
      ferialeDiurno25: 1,
      ferialeNotturno35: 1,
      festivoDiurno50: 1,
      festivoNotturno60: 1,
    },
  },
});
const pagaOraria = 1296.43 / 173;
assert.equal(
  quattroCategorie.straordinari.totale.toFixed(5),
  (pagaOraria * (1.25 + 1.35 + 1.5 + 1.6)).toFixed(5)
);

// Le maggiorazioni si sovrappongono economicamente senza cambiare le ore fisiche.
const riepilogoSovrapposto = {
  ore: { fisiche: 8, riposoLavorato: 0 },
  straordinari: { festivoNotturno60: 8 },
  maggiorazioni: { domenicaleNotturno: 8 },
  eventi: {},
};
const sovrapposto = calcola({
  riepilogoOre: riepilogoSovrapposto,
  percentualiMaggiorazioni: { domenicaleNotturno: 20 },
});
assert.equal(riepilogoSovrapposto.ore.fisiche, 8);
assert.ok(sovrapposto.straordinari.totale > 0);
assert.ok(sovrapposto.maggiorazioni.totale > 0);

// Il riposo lavorato senza regola economica non inventa un compenso.
const riposoNonConfigurato = calcola({
  riepilogoOre: {
    ...riepilogoVuoto,
    ore: { fisiche: 8, riposoLavorato: 8 },
  },
});
assert.equal(riposoNonConfigurato.riposoLavorato.importo, 0);
assert.equal(riposoNonConfigurato.diagnostica.riposoLavoratoDaConfigurare, true);
const riposoConfigurato = calcola({
  riepilogoOre: {
    ...riepilogoVuoto,
    ore: { fisiche: 8, riposoLavorato: 8 },
  },
  configurazioneRiposoLavorato: { modalita: 'tariffa_oraria', valore: 2 },
});
assert.equal(riposoConfigurato.riposoLavorato.importo, 16);

// Ferie, permesso, ROL, malattia e assenza restano voci distinte e configurabili.
const eventi = calcola({
  riepilogoOre: {
    ...riepilogoVuoto,
    eventi: {
      ferie: [{ ore: 6 }],
      permesso: [{ ore: 4 }],
      rol: [{ ore: 3 }],
      malattia: [{ ore: 7 }],
      assenza: [{ ore: 2 }],
    },
  },
  regoleEventi: {
    ferie: { descrizione: 'Ferie', orePerEvento: 6, natura: 'imponibile' },
    permesso: { descrizione: 'Permesso', orePerEvento: 4, natura: 'imponibile' },
    rol: { descrizione: 'ROL', orePerEvento: 3, natura: 'imponibile' },
    malattia: { descrizione: 'Malattia', orePerEvento: 7, natura: 'imponibile' },
    assenza: { descrizione: 'Assenza', orePerEvento: 2, natura: 'trattenuta' },
  },
});
assert.equal(
  eventi.vociEventi.map((voce) => voce.descrizione).join('|'),
  'Ferie|Permesso|ROL|Malattia|Assenza'
);
assert.equal(eventi.vociEventi[4].natura, 'trattenuta');

// Regressione diagnostica agosto 2026: calendario e cedolino restano separati.
const oreAgosto = calcolaOreFiduciari({
  turni: fixture.turni,
  meseTarget: fixture.meseTarget,
  annoTarget: fixture.annoTarget,
  configurazione: fixture.configurazione,
});
const economiaAgosto = calcolaEconomiaFiduciari({
  anno: fixture.annoTarget,
  mese: fixture.meseTarget,
  livello: fixture.configurazioneEconomicaDiagnostica.livello,
  scattiAnzianita: fixture.configurazioneEconomicaDiagnostica.scattiAnzianita,
  riepilogoOre: oreAgosto,
  percentualiMaggiorazioni:
    fixture.configurazioneEconomicaDiagnostica.percentualiMaggiorazioni,
  vociManuali: fixture.configurazioneEconomicaDiagnostica.vociManuali,
});
assert.equal(oreAgosto.ore.fisiche, 208.5);
assert.equal(economiaAgosto.arrotondato.pagaBase, 1281.43);
assert.equal(economiaAgosto.arrotondato.scattiAnzianita, 15);
assert.equal(economiaAgosto.riposoLavorato.configurato, false);
assert.equal(economiaAgosto.arrotondato.straordinari, 362.33);
assert.equal(economiaAgosto.arrotondato.maggiorazioni, 54.33);
assert.equal(economiaAgosto.arrotondato.altreCompetenze, 57.18);
assert.equal(economiaAgosto.arrotondato.lordoStimato, 1770.27);

const economiaRiconciliata = calcolaEconomiaFiduciari({
  anno: fixture.annoTarget,
  mese: fixture.meseTarget,
  livello: fixture.configurazioneEconomicaDiagnostica.livello,
  scattiAnzianita: fixture.configurazioneEconomicaDiagnostica.scattiAnzianita,
  riepilogoOre: oreAgosto,
  percentualiMaggiorazioni:
    fixture.configurazioneEconomicaDiagnostica.percentualiMaggiorazioni,
  vociManuali: fixture.configurazioneEconomicaDiagnostica.vociManuali,
  riconciliazionePayroll: fixture.riconciliazioneCedolino,
});
assert.equal(economiaRiconciliata.arrotondato.straordinari, 414.22);
assert.equal(economiaRiconciliata.arrotondato.maggiorazioni, 49.91);
assert.equal(economiaRiconciliata.arrotondato.altreCompetenze, 107.16);
assert.equal(
  economiaRiconciliata.arrotondato.lordoStimato,
  fixture.cedolinoReale.totaleCompetenze
);
assert.equal(economiaRiconciliata.arrotondato.trattenute, 49.98);
assert.equal(economiaRiconciliata.arrotondato.totaleDopoTrattenute, 1817.74);
assert.equal(economiaRiconciliata.riconciliazionePayroll.attiva, true);
assert.equal(
  economiaRiconciliata.riconciliazionePayroll.automatico.straordinari.totale,
  33.5
);

const nettoSenzaDatiFiscali = stimaNettoFiduciari({
  economia: economiaRiconciliata,
});
assert.equal(nettoSenzaDatiFiscali.disponibile, false);
assert.equal(
  nettoSenzaDatiFiscali.motivo,
  'trattenute_fiscali_previdenziali_mancanti'
);

const trattenuteResidueReali =
  economiaRiconciliata.arrotondato.totaleDopoTrattenute -
  fixture.cedolinoReale.netto;
const nettoRiconciliato = stimaNettoFiduciari({
  economia: economiaRiconciliata,
  trattenutePrevidenziali: trattenuteResidueReali,
  trattenuteFiscali: 0,
});
assert.equal(nettoRiconciliato.netto, fixture.cedolinoReale.netto);


// Regressione netto reale agosto 2026.
// Il netto viene ricostruito esclusivamente dalle componenti documentate
// del cedolino, senza coefficienti fissi o correttivi artificiali.
const cedolino = fixture.cedolinoReale;

const economiaNettoCedolino = {
  totaleDopoTrattenute:
    cedolino.totaleCompetenze -
    fixture.riconciliazioneCedolino.voci
      .filter((voce) => voce.natura === 'trattenuta')
      .reduce((totale, voce) => totale + voce.importo, 0),

  // Base imponibile usata dal profilo fiscale calibrato.
  // Nel caso reale coincide con l'imponibile previdenziale documentato.
  competenzeImponibili: cedolino.imponibilePrevidenziale,
};

const trattenuteFiscaliCedolino =
  cedolino.irpefMese +
  cedolino.addizionali.totale;

const nettoRiconciliatoCedolino = stimaNettoFiduciari({
  economia: economiaNettoCedolino,
  trattenutePrevidenziali: cedolino.contributi.totale,
  trattenuteFiscali: trattenuteFiscaliCedolino,
  altreTrattenute: cedolino.altreTrattenute,
  detrazioni: cedolino.arrotondamentoAttuale,
});

assert.equal(
  nettoRiconciliatoCedolino.disponibile,
  true,
  'Il netto deve essere disponibile quando sono presenti i dati fiscali e previdenziali'
);

assert.equal(
  nettoRiconciliatoCedolino.netto,
  cedolino.netto,
  `Netto Fiduciari errato: atteso ${cedolino.netto}, ottenuto ${nettoRiconciliatoCedolino.netto}`
);


// Calibrazione automatica dal cedolino reale.
const profiloCalibrato = calibraProfiloFiscaleFiduciari({
  imponibilePrevidenziale: cedolino.imponibilePrevidenziale,
  contributi: cedolino.contributi.totale,
  irpefMese: cedolino.irpefMese,
  addizionali: cedolino.addizionali.totale,
  altreTrattenute: cedolino.altreTrattenute,
});

assert.equal(
  profiloCalibrato.disponibile,
  true,
  'La calibrazione fiscale dal cedolino deve essere disponibile'
);

const nettoDaCalibrazioneAutomatica = stimaNettoFiduciariDaProfilo({
  economia: economiaNettoCedolino,
  imponibilePrevidenziale: cedolino.imponibilePrevidenziale,
  aliquotaContributiva: profiloCalibrato.aliquotaContributiva,
  aliquotaFiscale: profiloCalibrato.aliquotaFiscale,
  addizionali: profiloCalibrato.addizionali,
  altreTrattenute: profiloCalibrato.altreTrattenute,
  detrazioni: cedolino.arrotondamentoAttuale,
});

assert.equal(
  nettoDaCalibrazioneAutomatica.disponibile,
  true,
  'Il netto da calibrazione automatica deve essere disponibile'
);

assert.equal(
  nettoDaCalibrazioneAutomatica.netto,
  cedolino.netto,
  `Calibrazione automatica errata: atteso ${cedolino.netto}, ottenuto ${nettoDaCalibrazioneAutomatica.netto}`
);

// Regressione profilo fiscale calibrato.
// Le aliquote vengono ricavate dalle componenti documentate del cedolino,
// non da un coefficiente netto arbitrario.
const aliquotaContributivaCedolino =
  (cedolino.contributi.totale / cedolino.imponibilePrevidenziale) * 100;

const baseFiscaleCalibrata =
  cedolino.imponibilePrevidenziale - cedolino.contributi.totale;

const aliquotaFiscaleCedolino =
  (cedolino.irpefMese / baseFiscaleCalibrata) * 100;

const nettoDaProfilo = stimaNettoFiduciariDaProfilo({
  economia: economiaNettoCedolino,
  imponibilePrevidenziale: cedolino.imponibilePrevidenziale,
  aliquotaContributiva: aliquotaContributivaCedolino,
  aliquotaFiscale: aliquotaFiscaleCedolino,
  addizionali: cedolino.addizionali.totale,
  altreTrattenute: cedolino.altreTrattenute,
  detrazioni: cedolino.arrotondamentoAttuale,
});

assert.equal(
  nettoDaProfilo.disponibile,
  true,
  'Il netto da profilo calibrato deve essere disponibile'
);

assert.equal(
  nettoDaProfilo.netto,
  cedolino.netto,
  `Netto da profilo Fiduciari errato: atteso ${cedolino.netto}, ottenuto ${nettoDaProfilo.netto}`
);

console.log('Regressione motore economico Fiduciari superata', {
  pagaBase: economiaAgosto.arrotondato.pagaBase,
  scatti: economiaAgosto.arrotondato.scattiAnzianita,
  straordinari: economiaAgosto.arrotondato.straordinari,
  maggiorazioni: economiaAgosto.arrotondato.maggiorazioni,
  altreCompetenze: economiaAgosto.arrotondato.altreCompetenze,
  lordoStimato: economiaAgosto.arrotondato.lordoStimato,
  lordoRiconciliato: economiaRiconciliata.arrotondato.lordoStimato,
  totaleDopoTrattenute: economiaRiconciliata.arrotondato.totaleDopoTrattenute,
  cedolinoCompetenze: fixture.cedolinoReale.totaleCompetenze,
});
