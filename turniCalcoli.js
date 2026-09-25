export function chiaveDataTurno(turno) {
  const anno = Number(turno?.anno);
  const mese = Number(turno?.mese);
  const giorno = Number(turno?.giorno);

  if (!anno || !mese || !giorno) return null;

  return [
    anno,
    String(mese).padStart(2, '0'),
    String(giorno).padStart(2, '0'),
  ].join('-');
}

export function calcolaOreIntervallo(inizio, fine) {
  if (!inizio || !fine) return 0;

  const [hi, mi] = String(inizio).split(':').map(Number);
  const [hf, mf] = String(fine).split(':').map(Number);

  if ([hi, mi, hf, mf].some(Number.isNaN)) return 0;

  const start = hi * 60 + mi;
  let end = hf * 60 + mf;

  if (end <= start) end += 24 * 60;
  return (end - start) / 60;
}

function leggiOraTurno(valore) {
  const parti = String(valore || '').split(':');
  if (parti.length !== 2) return null;

  const ore = Number(parti[0]);
  const minuti = Number(parti[1]);
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

  return { ore, minuti };
}

export function intervalloTemporaleTurno(turno) {
  if (turno?.tipo !== 'turno') return null;

  const anno = Number(turno.anno);
  const mese = Number(turno.mese);
  const giorno = Number(turno.giorno);
  const oraInizio = leggiOraTurno(turno.inizio);
  const oraFine = leggiOraTurno(turno.fine);

  if (
    !Number.isInteger(anno) ||
    !Number.isInteger(mese) ||
    !Number.isInteger(giorno) ||
    !oraInizio ||
    !oraFine
  ) {
    return null;
  }

  const inizio = Date.UTC(
    anno,
    mese - 1,
    giorno,
    oraInizio.ore,
    oraInizio.minuti
  );
  const dataVerifica = new Date(inizio);
  if (
    dataVerifica.getUTCFullYear() !== anno ||
    dataVerifica.getUTCMonth() !== mese - 1 ||
    dataVerifica.getUTCDate() !== giorno
  ) {
    return null;
  }

  let fine = Date.UTC(
    anno,
    mese - 1,
    giorno,
    oraFine.ore,
    oraFine.minuti
  );
  if (fine <= inizio) fine += 24 * 60 * 60 * 1000;

  return { turno, inizio, fine };
}

export function minutiAggiuntiviTurno(turno) {
  const minuti = Number(turno?.minuti_aggiuntivi_retribuiti || 0);
  return Number.isFinite(minuti) && minuti > 0 ? minuti : 0;
}

export function oreRetribuiteTurno(turno) {
  if (turno?.tipo !== 'turno') return 0;

  const durataSalvata = Number(turno?.ore);
  const durata =
    Number.isFinite(durataSalvata) && durataSalvata > 0
      ? durataSalvata
      : calcolaOreIntervallo(turno?.inizio, turno?.fine);

  return durata + minutiAggiuntiviTurno(turno) / 60;
}

export function aggregaTurniPerGiorno(turni = [], sogliaGiornaliera = 7) {
  const gruppi = new Map();

  (Array.isArray(turni) ? turni : []).forEach((turno) => {
    if (turno?.tipo !== 'turno') return;

    const chiave = chiaveDataTurno(turno);
    if (!chiave) return;

    if (!gruppi.has(chiave)) {
      gruppi.set(chiave, {
        chiave,
        turni: [],
        oreTurni: 0,
        minutiAggiuntivi: 0,
      });
    }

    const gruppo = gruppi.get(chiave);
    gruppo.turni.push(turno);
    gruppo.oreTurni +=
      oreRetribuiteTurno(turno) - minutiAggiuntiviTurno(turno) / 60;
    gruppo.minutiAggiuntivi += minutiAggiuntiviTurno(turno);
  });

  const soglia = Math.max(0, Number(sogliaGiornaliera || 0));

  return Array.from(gruppi.values()).map((gruppo) => {
    const turniOrdinati = [...gruppo.turni].sort((a, b) =>
      String(a?.inizio || '99:99').localeCompare(
        String(b?.inizio || '99:99')
      )
    );
    const oreRetribuite =
      gruppo.oreTurni + gruppo.minutiAggiuntivi / 60;

    return {
      ...gruppo,
      turni: turniOrdinati,
      oreRetribuite,
      oreOrdinarie: Math.min(oreRetribuite, soglia),
      oreStraordinarie: Math.max(0, oreRetribuite - soglia),
    };
  });
}

export function rilevaSovrapposizioniGiornaliere(turni = []) {
  const intervalli = (Array.isArray(turni) ? turni : [])
    .map(intervalloTemporaleTurno)
    .filter(Boolean)
    .sort((a, b) => a.inizio - b.inizio);

  const conflitti = [];
  for (let i = 0; i < intervalli.length; i += 1) {
    for (let j = i + 1; j < intervalli.length; j += 1) {
      if (intervalli[j].inizio >= intervalli[i].fine) break;
      if (intervalli[j].fine > intervalli[i].inizio) {
        conflitti.push([intervalli[i].turno, intervalli[j].turno]);
      }
    }
  }
  return conflitti;
}
