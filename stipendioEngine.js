const COEFFICIENTE_NETTO_GPG = 1992.00 / 2577.16;
const COEFFICIENTE_NETTO_FIDUCIARIO = 0.78;

function parseOrario(orario) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(orario ?? '').trim());

  if (!match) return null;

  const ore = Number(match[1]);
  const minuti = Number(match[2]);

  if (
    !Number.isInteger(ore) ||
    !Number.isInteger(minuti) ||
    ore < 0 ||
    ore > 23 ||
    minuti < 0 ||
    minuti > 59
  ) {
    return null;
  }

  return ore * 60 + minuti;
}

function calcolaDurataOre(inizio, fine) {
  const inizioMinuti = parseOrario(inizio);
  const fineMinuti = parseOrario(fine);

  if (
    inizioMinuti === null ||
    fineMinuti === null ||
    inizioMinuti === fineMinuti
  ) {
    return 0;
  }

  const durataMinuti =
    fineMinuti > inizioMinuti
      ? fineMinuti - inizioMinuti
      : 24 * 60 - inizioMinuti + fineMinuti;

  return durataMinuti / 60;
}

function creaIntervalloTurno(turno) {
  const inizioMinuti = parseOrario(turno?.inizio);
  const fineMinuti = parseOrario(turno?.fine);

  if (
    turno?.tipo !== 'turno' ||
    inizioMinuti === null ||
    fineMinuti === null ||
    inizioMinuti === fineMinuti
  ) {
    return null;
  }

  const data = new Date(
    Number(turno.anno),
    Number(turno.mese) - 1,
    Number(turno.giorno),
    0,
    0,
    0,
    0
  );

  if (Number.isNaN(data.getTime())) return null;

  const inizio = new Date(data.getTime() + inizioMinuti * 60000);
  const fine = new Date(data.getTime() + fineMinuti * 60000);

  if (fine <= inizio) fine.setDate(fine.getDate() + 1);

  return { inizio, fine };
}

function calcolaOreDomenicali(turni) {
  return turni.reduce((totale, turno) => {
    const intervallo = creaIntervalloTurno(turno);
    if (!intervallo) return totale;

    let cursor = new Date(intervallo.inizio);
    let minutiDomenicali = 0;

    while (cursor < intervallo.fine) {
      const mezzanotte = new Date(cursor);
      mezzanotte.setHours(24, 0, 0, 0);
      const limite = new Date(
        Math.min(mezzanotte.getTime(), intervallo.fine.getTime())
      );

      if (cursor.getDay() === 0) {
        minutiDomenicali += (limite - cursor) / 60000;
      }

      cursor = limite;
    }

    return totale + minutiDomenicali / 60;
  }, 0);
}

function filtraTurniConclusi(turni, adesso = new Date()) {
  return turni.filter((turno) => {
    const intervallo = creaIntervalloTurno(turno);
    return intervallo && intervallo.fine <= adesso;
  });
}

function calcolaOreRiposoLavorato(turni) {
  return turni.reduce(
    (totale, turno) =>
      turno.riposo_lavorato === true
        ? totale + Number(turno.ore || 0)
        : totale,
    0
  );
}

function calcolaStraordinariConfigurati({
  giornateMese,
  tuttiTurni,
  modalita,
  sogliaGiornaliera,
  sogliaSettimanale,
  meseTarget,
  annoTarget,
}) {
  if (modalita !== 'settimanale') {
    return giornateMese.reduce((totale, turno) => {
      if (turno.riposo_lavorato === true) return totale;
      return totale + Math.max(
        0,
        Number(turno.ore || 0) - Number(sogliaGiornaliera || 0)
      );
    }, 0);
  }

  const limite = Number(sogliaSettimanale) > 0
    ? Number(sogliaSettimanale)
    : 40;
  const settimane = {};

  tuttiTurni
    .filter((turno) =>
      turno.tipo === 'turno' &&
      turno.riposo_lavorato !== true &&
      Number(turno.ore || 0) > 0
    )
    .map((turno) => {
      const data = new Date(
        Number(turno.anno),
        Number(turno.mese) - 1,
        Number(turno.giorno),
        12
      );
      const lunedi = new Date(data);
      lunedi.setDate(data.getDate() + (data.getDay() === 0 ? -6 : 1 - data.getDay()));
      lunedi.setHours(0, 0, 0, 0);
      return { turno, data, chiave: lunedi.toISOString().slice(0, 10) };
    })
    .sort((a, b) => a.data - b.data)
    .forEach((elemento) => {
      (settimane[elemento.chiave] ||= []).push(elemento.turno);
    });

  return Object.values(settimane).reduce((totaleMese, settimana) => {
    let cumulato = 0;
    let extraMese = 0;

    settimana.forEach((turno) => {
      const extraPrima = Math.max(0, cumulato - limite);
      cumulato += Number(turno.ore || 0);
      const extraTurno = Math.max(0, cumulato - limite) - extraPrima;

      if (
        Number(turno.mese) === Number(meseTarget) &&
        Number(turno.anno) === Number(annoTarget)
      ) {
        extraMese += extraTurno;
      }
    });

    return totaleMese + extraMese;
  }, 0);
}

function coefficienteNetto(tipoOperatore) {
  return tipoOperatore === 'fiduciario'
    ? COEFFICIENTE_NETTO_FIDUCIARIO
    : COEFFICIENTE_NETTO_GPG;
}

module.exports = {
  COEFFICIENTE_NETTO_GPG,
  calcolaDurataOre,
  calcolaOreDomenicali,
  calcolaOreRiposoLavorato,
  calcolaStraordinariConfigurati,
  coefficienteNetto,
  creaIntervalloTurno,
  filtraTurniConclusi,
  parseOrario,
};
