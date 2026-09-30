export const MAGGIORAZIONI_AUTOMATICHE_FIDUCIARI = Object.freeze({
  domenicaleDiurno: 15,
  domenicaleNotturno: 20,
  festivoDiurno: 0,
  festivoNotturno: 50,
});

export function costruisciInputEconomiaFiduciari({
  anno,
  mese,
  livello,
  oreSettimanali,
  profiloCalcolo = 'automatico',
  pagaBasePersonalizzata = 0,
  scattiAnzianita = 0,
  superminimo = 0,
  riepilogoOre,
  percentualiMaggiorazioni = {},
  configurazioneRiposoLavorato = {},
  vociManuali = [],
  riconciliazionePayroll = null,
} = {}) {
  const automatico = profiloCalcolo !== 'personalizzato';

  return {
    anno,
    mese,
    livello,
    oreSettimanali,
    pagaBasePersonalizzata: automatico ? 0 : pagaBasePersonalizzata,
    scattiAnzianita,
    superminimo,
    riepilogoOre,
    percentualiMaggiorazioni: automatico
      ? MAGGIORAZIONI_AUTOMATICHE_FIDUCIARI
      : percentualiMaggiorazioni,
    configurazioneRiposoLavorato,
    vociManuali,
    riconciliazionePayroll,
  };
}
