const MINUTI_GIORNO = 24 * 60;
const FESTIVITA_FISSE_ITALIANE = new Set([
  '01-01',
  '01-06',
  '04-25',
  '05-01',
  '06-02',
  '08-15',
  '11-01',
  '12-08',
  '12-25',
  '12-26',
]);

function arrotondaOre(minuti) {
  return Math.round((minuti / 60) * 10000) / 10000;
}

function chiaveDataDaTimestamp(timestamp) {
  const data = new Date(timestamp);
  return [
    data.getUTCFullYear(),
    String(data.getUTCMonth() + 1).padStart(2, '0'),
    String(data.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function timestampData(anno, mese, giorno, ora = 0, minuto = 0) {
  return Date.UTC(
    Number(anno),
    Number(mese) - 1,
    Number(giorno),
    Number(ora),
    Number(minuto),
    0,
    0
  );
}

function dataPasquaUtc(anno) {
  const a = anno % 19;
  const b = Math.floor(anno / 100);
  const c = anno % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31);
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;

  return timestampData(anno, mese, giorno);
}

export function isFestivoNazionaleItaliano(anno, mese, giorno) {
  const mmgg =
    `${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;

  if (FESTIVITA_FISSE_ITALIANE.has(mmgg)) return true;

  const data = timestampData(anno, mese, giorno);
  const pasqua = dataPasquaUtc(Number(anno));
  const pasquetta = pasqua + MINUTI_GIORNO * 60 * 1000;

  return data === pasqua || data === pasquetta;
}

function creaVerificaFestivo(configurazione = {}) {
  const aggiuntive = new Set(
    (configurazione.festivitaAggiuntive || []).map(String)
  );
  const verificaPersonalizzata = configurazione.isFestivo;

  return (anno, mese, giorno) => {
    const chiave = [
      anno,
      String(mese).padStart(2, '0'),
      String(giorno).padStart(2, '0'),
    ].join('-');

    if (aggiuntive.has(chiave)) return true;
    if (typeof verificaPersonalizzata === 'function') {
      return Boolean(verificaPersonalizzata(anno, mese, giorno));
    }

    return isFestivoNazionaleItaliano(anno, mese, giorno);
  };
}

function leggiOra(valore) {
  const parti = String(valore || '').split(':').map(Number);
  if (
    parti.length < 2 ||
    !Number.isInteger(parti[0]) ||
    !Number.isInteger(parti[1]) ||
    parti[0] < 0 ||
    parti[0] > 23 ||
    parti[1] < 0 ||
    parti[1] > 59
  ) {
    return null;
  }
  return { ora: parti[0], minuto: parti[1] };
}

function creaIntervalloTurno(turno) {
  if (!turno || turno.tipo !== 'turno') return null;

  const inizioOra = leggiOra(turno.inizio);
  const fineOra = leggiOra(turno.fine);
  const anno = Number(turno.anno);
  const mese = Number(turno.mese);
  const giorno = Number(turno.giorno);

  if (
    !inizioOra ||
    !fineOra ||
    !Number.isInteger(anno) ||
    !Number.isInteger(mese) ||
    !Number.isInteger(giorno)
  ) {
    return null;
  }

  const inizio = timestampData(
    anno,
    mese,
    giorno,
    inizioOra.ora,
    inizioOra.minuto
  );
  let fine = timestampData(
    anno,
    mese,
    giorno,
    fineOra.ora,
    fineOra.minuto
  );

  if (fine <= inizio) fine += MINUTI_GIORNO * 60 * 1000;

  return { inizio, fine };
}

function prossimoConfine(timestamp, ora, minuto = 0) {
  const data = new Date(timestamp);
  let confine = Date.UTC(
    data.getUTCFullYear(),
    data.getUTCMonth(),
    data.getUTCDate(),
    ora,
    minuto,
    0,
    0
  );

  if (confine <= timestamp) confine += MINUTI_GIORNO * 60 * 1000;
  return confine;
}

function chiaveSettimana(timestamp) {
  const data = new Date(timestamp);
  const giornoSettimana = data.getUTCDay();
  const giorniDaLunedi = giornoSettimana === 0 ? 6 : giornoSettimana - 1;
  const lunedi = Date.UTC(
    data.getUTCFullYear(),
    data.getUTCMonth(),
    data.getUTCDate() - giorniDaLunedi
  );
  return chiaveDataDaTimestamp(lunedi);
}

function segmentaIntervallo(turno, intervallo, verificaFestivo) {
  const segmenti = [];
  let cursore = intervallo.inizio;

  while (cursore < intervallo.fine) {
    const confini = [
      intervallo.fine,
      prossimoConfine(cursore, 0),
      prossimoConfine(cursore, 6),
      prossimoConfine(cursore, 22),
    ];
    const fine = Math.min(...confini.filter((valore) => valore > cursore));
    const data = new Date(cursore);
    const ora = data.getUTCHours();
    const domenicale = data.getUTCDay() === 0;
    const festivo = verificaFestivo(
      data.getUTCFullYear(),
      data.getUTCMonth() + 1,
      data.getUTCDate()
    );

    segmenti.push({
      turno,
      turnoId: turno.id ?? null,
      inizio: cursore,
      fine,
      minuti: (fine - cursore) / 60000,
      data: chiaveDataDaTimestamp(cursore),
      settimana: chiaveSettimana(cursore),
      anno: data.getUTCFullYear(),
      mese: data.getUTCMonth() + 1,
      giorno: data.getUTCDate(),
      notturno: ora >= 22 || ora < 6,
      domenicale,
      festivo,
      riposoLavorato: turno.riposo_lavorato === true,
    });

    cursore = fine;
  }

  return segmenti;
}

export function segmentaTurniFiduciari(turni, configurazione = {}) {
  const verificaFestivo = creaVerificaFestivo(configurazione);
  const invalidi = [];
  const segmenti = [];

  (turni || []).forEach((turno) => {
    if (!turno || turno.tipo !== 'turno') return;
    const intervallo = creaIntervalloTurno(turno);
    if (!intervallo) {
      invalidi.push(turno);
      return;
    }
    segmenti.push(...segmentaIntervallo(turno, intervallo, verificaFestivo));
  });

  return {
    segmenti: segmenti.sort((a, b) => a.inizio - b.inizio),
    turniInvalidi: invalidi,
  };
}

function dividiPerStraordinario(segmento, minutiPrima, limiteMinuti) {
  const minutiOrdinariDisponibili = Math.max(0, limiteMinuti - minutiPrima);
  const minutiOrdinari = Math.min(segmento.minuti, minutiOrdinariDisponibili);
  const parti = [];

  if (minutiOrdinari > 0) {
    parti.push({
      ...segmento,
      fine: segmento.inizio + minutiOrdinari * 60000,
      minuti: minutiOrdinari,
      straordinario: false,
    });
  }

  const minutiStraordinari = segmento.minuti - minutiOrdinari;
  if (minutiStraordinari > 0) {
    parti.push({
      ...segmento,
      inizio: segmento.fine - minutiStraordinari * 60000,
      minuti: minutiStraordinari,
      straordinario: true,
    });
  }

  return parti;
}

function classificaStraordinario(segmenti, configurazione) {
  const modalita =
    configurazione.modalitaStraordinario === 'giornaliera'
      ? 'giornaliera'
      : 'settimanale';
  const sogliaOre = modalita === 'giornaliera'
    ? Number(configurazione.sogliaGiornaliera || 7)
    : Number(configurazione.sogliaSettimanale || 40);
  const limiteMinuti = Math.max(0, sogliaOre) * 60;
  const cumulati = new Map();
  const classificati = [];

  segmenti.forEach((segmento) => {
    const chiave = modalita === 'giornaliera'
      ? segmento.data
      : segmento.settimana;
    const minutiPrima = cumulati.get(chiave) || 0;
    classificati.push(
      ...dividiPerStraordinario(segmento, minutiPrima, limiteMinuti)
    );
    cumulati.set(chiave, minutiPrima + segmento.minuti);
  });

  return classificati;
}

function creaContatori() {
  return {
    fisiche: 0,
    ordinarie: 0,
    straordinarie: 0,
    notturne: 0,
    domenicali: 0,
    festive: 0,
    riposoLavorato: 0,
    domenicaleDiurno: 0,
    domenicaleNotturno: 0,
    festivoDiurno: 0,
    festivoNotturno: 0,
    straordinarioFerialeDiurno25: 0,
    straordinarioFerialeNotturno35: 0,
    straordinarioFestivoDiurno50: 0,
    straordinarioFestivoNotturno60: 0,
  };
}

function aggiungiSegmento(contatori, segmento) {
  const minuti = segmento.minuti;
  const speciale = segmento.domenicale || segmento.festivo;

  contatori.fisiche += minuti;
  contatori[segmento.straordinario ? 'straordinarie' : 'ordinarie'] += minuti;
  if (segmento.notturno) contatori.notturne += minuti;
  if (segmento.domenicale) {
    contatori.domenicali += minuti;
    contatori[
      segmento.notturno ? 'domenicaleNotturno' : 'domenicaleDiurno'
    ] += minuti;
  }
  if (segmento.festivo) {
    contatori.festive += minuti;
    contatori[
      segmento.notturno ? 'festivoNotturno' : 'festivoDiurno'
    ] += minuti;
  }
  if (segmento.riposoLavorato) contatori.riposoLavorato += minuti;

  if (!segmento.straordinario) return;
  if (speciale && segmento.notturno) {
    contatori.straordinarioFestivoNotturno60 += minuti;
  } else if (speciale) {
    contatori.straordinarioFestivoDiurno50 += minuti;
  } else if (segmento.notturno) {
    contatori.straordinarioFerialeNotturno35 += minuti;
  } else {
    contatori.straordinarioFerialeDiurno25 += minuti;
  }
}

function contatoriInOre(contatori) {
  return Object.fromEntries(
    Object.entries(contatori).map(([chiave, minuti]) => [
      chiave,
      arrotondaOre(minuti),
    ])
  );
}

function eventoNelMese(evento, meseTarget, annoTarget) {
  return Number(evento?.mese) === Number(meseTarget) &&
    Number(evento?.anno) === Number(annoTarget);
}

export function calcolaOreFiduciari({
  turni = [],
  meseTarget,
  annoTarget,
  configurazione = {},
}) {
  const { segmenti, turniInvalidi } = segmentaTurniFiduciari(
    turni,
    configurazione
  );
  const classificati = classificaStraordinario(segmenti, configurazione);
  const contatori = creaContatori();
  const segmentiMese = classificati.filter(
    (segmento) =>
      Number(segmento.mese) === Number(meseTarget) &&
      Number(segmento.anno) === Number(annoTarget)
  );

  segmentiMese.forEach((segmento) => aggiungiSegmento(contatori, segmento));

  const eventiNonTurno = (turni || []).filter(
    (evento) =>
      evento &&
      evento.tipo !== 'turno' &&
      eventoNelMese(evento, meseTarget, annoTarget)
  );
  const eventiPerTipo = eventiNonTurno.reduce((gruppi, evento) => {
    const tipo = String(evento.tipo || 'altro');
    if (!gruppi[tipo]) gruppi[tipo] = [];
    gruppi[tipo].push(evento);
    return gruppi;
  }, {});
  const minutiAggiuntiviRetribuiti = (turni || []).reduce((totale, turno) => {
    if (
      turno?.tipo !== 'turno' ||
      !eventoNelMese(turno, meseTarget, annoTarget)
    ) {
      return totale;
    }
    return totale + Math.max(0, Number(turno.minuti_aggiuntivi_retribuiti || 0));
  }, 0);

  const ore = contatoriInOre(contatori);

  return {
    ore: {
      fisiche: ore.fisiche,
      ordinarie: ore.ordinarie,
      straordinarie: ore.straordinarie,
      notturne: ore.notturne,
      domenicali: ore.domenicali,
      festive: ore.festive,
      riposoLavorato: ore.riposoLavorato,
    },
    maggiorazioni: {
      domenicaleDiurno: ore.domenicaleDiurno,
      domenicaleNotturno: ore.domenicaleNotturno,
      festivoDiurno: ore.festivoDiurno,
      festivoNotturno: ore.festivoNotturno,
    },
    straordinari: {
      ferialeDiurno25: ore.straordinarioFerialeDiurno25,
      ferialeNotturno35: ore.straordinarioFerialeNotturno35,
      festivoDiurno50: ore.straordinarioFestivoDiurno50,
      festivoNotturno60: ore.straordinarioFestivoNotturno60,
      totale: ore.straordinarie,
    },
    eventi: eventiPerTipo,
    minutiAggiuntiviRetribuiti,
    segmenti: segmentiMese,
    turniInvalidi,
    configurazioneRichiesta: {
      minutiAggiuntiviRetribuiti: minutiAggiuntiviRetribuiti > 0,
      regoleAssenze: eventiNonTurno.length > 0,
    },
  };
}
