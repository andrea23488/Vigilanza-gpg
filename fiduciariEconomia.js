const CCNL_SERVIZI_SICUREZZA = 'vigilanza_privata_servizi_sicurezza';

export const TABELLE_RETRIBUTIVE_FIDUCIARI = [
  { ccnl: CCNL_SERVIZI_SICUREZZA, dal: 202401, livelli: { A: 1740.40, B: 1583.88, C: 1333.43, D: 1114.29, E: 1021.43 } },
  { ccnl: CCNL_SERVIZI_SICUREZZA, dal: 202407, livelli: { A: 1762.29, B: 1603.77, C: 1350.14, D: 1128.21, E: 1035.36 } },
  { ccnl: CCNL_SERVIZI_SICUREZZA, dal: 202410, livelli: { A: 1813.36, B: 1650.20, C: 1389.14, D: 1160.71, E: 1067.86 } },
  { ccnl: CCNL_SERVIZI_SICUREZZA, dal: 202501, livelli: { A: 1886.32, B: 1716.53, C: 1444.86, D: 1207.14, E: 1114.29 } },
  { ccnl: CCNL_SERVIZI_SICUREZZA, dal: 202507, livelli: { A: 1930.09, B: 1756.33, C: 1478.29, D: 1235.00, E: 1142.14 } },
  { ccnl: CCNL_SERVIZI_SICUREZZA, dal: 202512, livelli: { A: 1973.87, B: 1796.12, C: 1511.71, D: 1262.86, E: 1170.00 } },
  { ccnl: CCNL_SERVIZI_SICUREZZA, dal: 202604, livelli: { A: 2003.05, B: 1822.65, C: 1534.00, D: 1281.43, E: 1188.57 } },
  { ccnl: CCNL_SERVIZI_SICUREZZA, dal: 202612, livelli: { A: 2032.24, B: 1849.18, C: 1556.29, D: 1300.00, E: 1207.14 } },
];

function numero(valore, fallback = 0) {
  const testo = String(valore ?? '').trim().replace(',', '.');
  if (testo === '') return fallback;
  const risultato = Number(testo);
  return Number.isFinite(risultato) ? risultato : fallback;
}

function nonNegativo(valore, fallback = 0) {
  return Math.max(0, numero(valore, fallback));
}

function arrotondaImporto(valore) {
  return Math.round((numero(valore) + Number.EPSILON) * 100) / 100;
}

export function selezionaPagaBaseFiduciari({
  anno,
  mese,
  livello,
  ccnl = CCNL_SERVIZI_SICUREZZA,
  tabelle = TABELLE_RETRIBUTIVE_FIDUCIARI,
}) {
  const decorrenza = Number(anno) * 100 + Number(mese);
  const livelloNormalizzato = String(livello || '').toUpperCase();
  const tabella = [...tabelle]
    .filter((voce) => voce.ccnl === ccnl && Number(voce.dal) <= decorrenza)
    .sort((a, b) => Number(b.dal) - Number(a.dal))[0];

  if (
    !tabella ||
    !Object.prototype.hasOwnProperty.call(
      tabella.livelli || {},
      livelloNormalizzato
    )
  ) {
    return null;
  }

  return {
    ccnl,
    livello: livelloNormalizzato,
    decorrenza: Number(tabella.dal),
    importo: nonNegativo(tabella.livelli[livelloNormalizzato]),
  };
}

function normalizzaNatura(natura) {
  if (natura === 'esente' || natura === 'trattenuta') return natura;
  return 'imponibile';
}

export function normalizzaVociManuali(voci = []) {
  return (voci || [])
    .map((voce, indice) => {
      const natura = normalizzaNatura(voce?.natura);
      const importo = nonNegativo(voce?.importo);
      return {
        id: String(voce?.id || `voce-${indice + 1}`),
        descrizione: String(voce?.descrizione || 'Voce manuale'),
        importo,
        natura,
        imponibilePrevidenziale:
          natura === 'imponibile' && voce?.imponibilePrevidenziale !== false,
        imponibileFiscale:
          natura === 'imponibile' && voce?.imponibileFiscale !== false,
      };
    })
    .filter((voce) => voce.importo > 0);
}

function calcolaVoceEvento(tipo, eventi, regola, pagaOraria) {
  if (!regola || !Array.isArray(eventi) || eventi.length === 0) return null;

  const importoPerEvento = nonNegativo(regola.importoPerEvento);
  const orePredefinite = nonNegativo(regola.orePerEvento);
  const moltiplicatore = nonNegativo(regola.moltiplicatorePagaOraria, 1);
  const importo = eventi.reduce((totale, evento) => {
    const oreEvento = nonNegativo(evento?.ore, orePredefinite);
    if (importoPerEvento > 0) return totale + importoPerEvento;
    return totale + oreEvento * pagaOraria * moltiplicatore;
  }, 0);

  if (importo <= 0) return null;
  return {
    id: `evento-${tipo}`,
    descrizione: String(regola.descrizione || tipo),
    importo,
    natura: normalizzaNatura(regola.natura),
    imponibilePrevidenziale: regola.imponibilePrevidenziale !== false,
    imponibileFiscale: regola.imponibileFiscale !== false,
  };
}

function calcolaRiposoLavorato(ore, configurazione, pagaOraria) {
  const modalita = configurazione?.modalita || 'nessuna';
  const valore = nonNegativo(configurazione?.valore);
  if (ore <= 0 || modalita === 'nessuna' || valore <= 0) return 0;
  if (modalita === 'tariffa_oraria') return ore * valore;
  if (modalita === 'percentuale') return ore * pagaOraria * valore / 100;
  if (modalita === 'importo_fisso') return valore;
  return 0;
}

function sommaVoci(voci, natura) {
  return voci
    .filter((voce) => voce.natura === natura)
    .reduce((totale, voce) => totale + voce.importo, 0);
}

export function calcolaEconomiaFiduciari({
  anno,
  mese,
  livello,
  ccnl = CCNL_SERVIZI_SICUREZZA,
  oreSettimanali = 40,
  pagaBasePersonalizzata,
  scattiAnzianita = 0,
  superminimo = 0,
  superminimoInPagaOraria = false,
  divisore = 173,
  riepilogoOre,
  percentualiStraordinari = {},
  percentualiMaggiorazioni = {},
  configurazioneRiposoLavorato = {},
  regoleEventi = {},
  vociManuali = [],
  tabelle,
}) {
  const tabella = selezionaPagaBaseFiduciari({
    anno,
    mese,
    livello,
    ccnl,
    tabelle,
  });
  const basePersonalizzata = nonNegativo(pagaBasePersonalizzata);
  const pagaBaseTempoPieno = basePersonalizzata > 0
    ? basePersonalizzata
    : nonNegativo(tabella?.importo);
  const coefficientePartTime = Math.min(1, Math.max(0, nonNegativo(oreSettimanali, 40) / 40));
  const pagaBase = pagaBaseTempoPieno * coefficientePartTime;
  const scatti = nonNegativo(scattiAnzianita) * coefficientePartTime;
  const superminimoCalcolato = nonNegativo(superminimo) * coefficientePartTime;
  const baseOraria =
    pagaBaseTempoPieno +
    nonNegativo(scattiAnzianita) +
    (superminimoInPagaOraria ? nonNegativo(superminimo) : 0);
  const pagaOraria = baseOraria / Math.max(1, nonNegativo(divisore, 173));
  const straordinariOre = riepilogoOre?.straordinari || {};
  const maggiorazioniOre = riepilogoOre?.maggiorazioni || {};
  const ore = riepilogoOre?.ore || {};

  const percentualiExtra = {
    ferialeDiurno25: nonNegativo(percentualiStraordinari.ferialeDiurno25, 25),
    ferialeNotturno35: nonNegativo(percentualiStraordinari.ferialeNotturno35, 35),
    festivoDiurno50: nonNegativo(percentualiStraordinari.festivoDiurno50, 50),
    festivoNotturno60: nonNegativo(percentualiStraordinari.festivoNotturno60, 60),
  };
  const dettagliStraordinari = Object.fromEntries(
    Object.entries(percentualiExtra).map(([categoria, percentuale]) => {
      const quantita = nonNegativo(straordinariOre[categoria]);
      return [categoria, {
        ore: quantita,
        percentuale,
        importo: quantita * pagaOraria * (1 + percentuale / 100),
      }];
    })
  );
  const totaleStraordinari = Object.values(dettagliStraordinari)
    .reduce((totale, voce) => totale + voce.importo, 0);

  const percentualiPremium = {
    domenicaleDiurno: nonNegativo(percentualiMaggiorazioni.domenicaleDiurno),
    domenicaleNotturno: nonNegativo(percentualiMaggiorazioni.domenicaleNotturno),
    festivoDiurno: nonNegativo(percentualiMaggiorazioni.festivoDiurno),
    festivoNotturno: nonNegativo(percentualiMaggiorazioni.festivoNotturno),
  };
  const dettagliMaggiorazioni = Object.fromEntries(
    Object.entries(percentualiPremium).map(([categoria, percentuale]) => {
      const quantita = nonNegativo(maggiorazioniOre[categoria]);
      return [categoria, {
        ore: quantita,
        percentuale,
        importo: quantita * pagaOraria * percentuale / 100,
      }];
    })
  );
  const totaleMaggiorazioni = Object.values(dettagliMaggiorazioni)
    .reduce((totale, voce) => totale + voce.importo, 0);

  const importoRiposoLavorato = calcolaRiposoLavorato(
    nonNegativo(ore.riposoLavorato),
    configurazioneRiposoLavorato,
    pagaOraria
  );
  const vociEventi = Object.entries(riepilogoOre?.eventi || {})
    .map(([tipo, eventi]) => calcolaVoceEvento(
      tipo,
      eventi,
      regoleEventi[tipo],
      pagaOraria
    ))
    .filter(Boolean);
  const altreVoci = normalizzaVociManuali(vociManuali);
  const vociVariabili = [...vociEventi, ...altreVoci];
  if (importoRiposoLavorato > 0) {
    vociVariabili.push({
      id: 'riposo-lavorato',
      descrizione: 'Riposo lavorato',
      importo: importoRiposoLavorato,
      natura: 'imponibile',
      imponibilePrevidenziale: true,
      imponibileFiscale: true,
    });
  }

  const altreCompetenzeImponibili = sommaVoci(vociVariabili, 'imponibile');
  const competenzeEsenti = sommaVoci(vociVariabili, 'esente');
  const trattenute = sommaVoci(vociVariabili, 'trattenuta');
  const competenzeImponibili =
    pagaBase + scatti + superminimoCalcolato +
    totaleStraordinari + totaleMaggiorazioni + altreCompetenzeImponibili;
  const totaleCompetenze = competenzeImponibili + competenzeEsenti;

  return {
    tabella,
    pagaBase,
    scattiAnzianita: scatti,
    superminimo: superminimoCalcolato,
    retribuzioneDiFatto: pagaBase + scatti + superminimoCalcolato,
    pagaOraria,
    straordinari: {
      dettagli: dettagliStraordinari,
      totale: totaleStraordinari,
    },
    maggiorazioni: {
      dettagli: dettagliMaggiorazioni,
      totale: totaleMaggiorazioni,
    },
    riposoLavorato: {
      ore: nonNegativo(ore.riposoLavorato),
      configurato: importoRiposoLavorato > 0,
      importo: importoRiposoLavorato,
    },
    vociEventi,
    vociManuali: altreVoci,
    altreCompetenzeImponibili,
    competenzeEsenti,
    trattenute,
    competenzeImponibili,
    totaleCompetenze,
    totaleDopoTrattenute: totaleCompetenze - trattenute,
    imponibilePrevidenzialeTeorico: vociVariabili
      .filter((voce) => voce.imponibilePrevidenziale)
      .reduce((totale, voce) => totale + voce.importo, 0) +
      pagaBase + scatti + superminimoCalcolato + totaleStraordinari + totaleMaggiorazioni,
    imponibileFiscaleTeorico: vociVariabili
      .filter((voce) => voce.imponibileFiscale)
      .reduce((totale, voce) => totale + voce.importo, 0) +
      pagaBase + scatti + superminimoCalcolato + totaleStraordinari + totaleMaggiorazioni,
    diagnostica: {
      pagaBaseMancante: pagaBase <= 0,
      riposoLavoratoDaConfigurare:
        nonNegativo(ore.riposoLavorato) > 0 && importoRiposoLavorato <= 0,
      eventiSenzaRegola: Object.keys(riepilogoOre?.eventi || {})
        .filter((tipo) => !regoleEventi[tipo]),
    },
    arrotondato: {
      pagaBase: arrotondaImporto(pagaBase),
      scattiAnzianita: arrotondaImporto(scatti),
      superminimo: arrotondaImporto(superminimoCalcolato),
      straordinari: arrotondaImporto(totaleStraordinari),
      maggiorazioni: arrotondaImporto(totaleMaggiorazioni),
      altreCompetenze: arrotondaImporto(
        altreCompetenzeImponibili + competenzeEsenti
      ),
      trattenute: arrotondaImporto(trattenute),
      lordoStimato: arrotondaImporto(totaleCompetenze),
      totaleDopoTrattenute: arrotondaImporto(totaleCompetenze - trattenute),
    },
  };
}
