export function numeroEconomico(valore, fallback = 0) {
  const numero = Number(String(valore ?? '').trim().replace(',', '.'));
  return Number.isFinite(numero) && numero >= 0 ? numero : fallback;
}

export function tariffaStraordinario30DaBase(lordoBase, divisore = 173) {
  const base = numeroEconomico(lordoBase);
  const ore = numeroEconomico(divisore, 173) || 173;
  return base > 0 ? (base / ore) * 1.3 : 0;
}

export function calcolaVociGpg({
  lordoBase = 0,
  oreStraordinario = 0,
  tariffaStraordinario = 0,
  oreDomenicali = 0,
  tariffaDomenicale = 0,
  serviziDiurni = 0,
  tariffaDiurno = 0,
  tariffaCompensativa = 0,
  serviziNotturni = 0,
  tariffaNotturno = 0,
  oreRiposoLavorato = 0,
  tariffaRiposo = 0,
  festivitaNonGoduta = 0,
  antirapina = 0,
  indennita20724 = 0,
  decurtazioni = 0,
}) {
  const voci = {
    base: numeroEconomico(lordoBase),
    straordinario: numeroEconomico(oreStraordinario) * numeroEconomico(tariffaStraordinario),
    domenicale: numeroEconomico(oreDomenicali) * numeroEconomico(tariffaDomenicale),
    piantonamentoDiurno: numeroEconomico(serviziDiurni) * numeroEconomico(tariffaDiurno),
    compensativa: numeroEconomico(serviziDiurni) * numeroEconomico(tariffaCompensativa),
    piantonamentoNotturno: numeroEconomico(serviziNotturni) * numeroEconomico(tariffaNotturno),
    riposoLavorato: numeroEconomico(oreRiposoLavorato) * numeroEconomico(tariffaRiposo),
    festivitaNonGoduta: numeroEconomico(festivitaNonGoduta),
    antirapina: numeroEconomico(antirapina),
    indennita20724: numeroEconomico(indennita20724),
    decurtazioni: numeroEconomico(decurtazioni),
  };

  // Arrotondamento di ciascuna voce prima della somma, come nel nucleo 2.0.
  for (const key of Object.keys(voci)) voci[key] = Math.round((voci[key] + Number.EPSILON) * 100) / 100;
  const competenzeLorde = Math.round((
    voci.base + voci.straordinario + voci.domenicale + voci.piantonamentoDiurno +
    voci.compensativa + voci.piantonamentoNotturno + voci.riposoLavorato +
    voci.festivitaNonGoduta + voci.antirapina - voci.decurtazioni
  ) * 100) / 100;
  // La somma L.207/2024 già configurata è esente: non è una maggiorazione lorda.
  // Questo non certifica gli imponibili previdenziale/fiscale delle altre voci.
  const sommeEsenti = voci.indennita20724;
  return { ...voci, competenzeLorde, sommeEsenti,
    imponibilePrevidenziale: null, imponibileFiscale: null,
    totale: Math.round((competenzeLorde + sommeEsenti) * 100) / 100,
  };
}

// Mantiene il metodo precedente fino alla validazione del nuovo netto.
// L'esente viene accreditato integralmente, una sola volta, senza applicare il coefficiente.
export function stimaNettoGpgLegacy({ competenze, esenti = 0, coefficiente }) {
  const totale = numeroEconomico(competenze);
  const quotaEsente = Math.min(totale, numeroEconomico(esenti));
  const fattore = Number(coefficiente);
  if (!Number.isFinite(fattore) || fattore < 0 || fattore > 1) return null;
  return Math.round(((totale - quotaEsente) * fattore + quotaEsente + Number.EPSILON) * 100) / 100;
}
