// Modulo puro, non ancora collegato ai motori di produzione.
// Il chiamante fornisce durate retribuite e soglie in minuti interi.
function validaMinuti(valore, nome) {
  if (!Number.isSafeInteger(valore) || valore < 0) {
    throw new RangeError(`${nome}: richiesto un intero non negativo`);
  }
  return valore;
}

export function oreMinutiInMinuti(ore, minuti) {
  validaMinuti(ore, 'ore');
  validaMinuti(minuti, 'minuti');
  if (minuti > 59) throw new RangeError('minuti: intervallo consentito 0–59');
  return validaMinuti(ore * 60 + minuti, 'durata');
}

export function minutiInOreMinuti(minuti) {
  validaMinuti(minuti, 'minuti');
  return { ore: Math.floor(minuti / 60), minuti: minuti % 60 };
}

export function classificaStraordinarioTurno({
  durataMinuti, automaticiMinuti, manualiMinuti = null,
}) {
  validaMinuti(durataMinuti, 'durataMinuti');
  validaMinuti(automaticiMinuti, 'automaticiMinuti');
  if (automaticiMinuti > durataMinuti) {
    throw new RangeError('straordinario automatico superiore alla durata');
  }
  if (manualiMinuti !== null) {
    validaMinuti(manualiMinuti, 'manualiMinuti');
    if (manualiMinuti > durataMinuti) {
      throw new RangeError('straordinario manuale superiore alla durata');
    }
  }
  const straordinariMinuti = manualiMinuti ?? automaticiMinuti;
  return {
    modalita: manualiMinuti === null ? 'automatico' : 'manuale',
    durataMinuti,
    automaticiMinuti,
    straordinariMinuti,
    ordinariMinuti: durataMinuti - straordinariMinuti,
  };
}

function leggiData(data) {
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new RangeError('data: richiesto YYYY-MM-DD');
  }
  const timestamp = Date.parse(`${data}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== data) {
    throw new RangeError('data non valida');
  }
  return timestamp;
}

// Input normalizzato: { id, data, inizioMinuti, durataMinuti, manualiMinuti? }.
// data è la data di attribuzione del turno, NON una segmentazione a mezzanotte.
// Non deduce durata, riposo lavorato o idoneità dal modello applicativo:
// questi restano responsabilità del futuro adattatore GPG/Fiduciari.
// Tutti i periodi vengono classificati prima di qualsiasi filtro mensile.
export function attribuisciStraordinariPerTurno(turni, {
  modalita, sogliaMinuti,
}) {
  if (!Array.isArray(turni)) throw new TypeError('turni: richiesto un array');
  if (modalita !== 'giornaliero' && modalita !== 'settimanale') {
    throw new RangeError('modalita non valida');
  }
  validaMinuti(sogliaMinuti, 'sogliaMinuti');
  const ids = new Set();
  const ordinati = turni.map((turno) => {
    if (!turno || typeof turno.id !== 'string' || !turno.id || ids.has(turno.id)) {
      throw new TypeError('id turno richiesto, stringa non vuota e univoca');
    }
    ids.add(turno.id);
    const timestamp = leggiData(turno.data);
    validaMinuti(turno.inizioMinuti, 'inizioMinuti');
    if (turno.inizioMinuti >= 1440) throw new RangeError('inizioMinuti fuori giornata');
    classificaStraordinarioTurno({ ...turno, automaticiMinuti: 0 });
    const lunedi = new Date(timestamp);
    lunedi.setUTCDate(lunedi.getUTCDate() - (lunedi.getUTCDay() + 6) % 7);
    return {
      ...turno, timestamp,
      periodo: modalita === 'giornaliero'
        ? turno.data : lunedi.toISOString().slice(0, 10),
    };
  }).sort((a, b) => a.timestamp - b.timestamp ||
    a.inizioMinuti - b.inizioMinuti || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const cumulati = new Map();
  return ordinati.map((turno) => {
    const cumulatoPrimaMinuti = cumulati.get(turno.periodo) ?? 0;
    const cumulatoDopoMinuti = validaMinuti(
      cumulatoPrimaMinuti + turno.durataMinuti, 'cumulato');
    const automaticiMinuti = Math.max(0, cumulatoDopoMinuti - sogliaMinuti) -
      Math.max(0, cumulatoPrimaMinuti - sogliaMinuti);
    // L'override sostituisce la classificazione, mai la durata nel cumulato.
    cumulati.set(turno.periodo, cumulatoDopoMinuti);
    return {
      id: turno.id, data: turno.data, periodo: turno.periodo,
      cumulatoPrimaMinuti, cumulatoDopoMinuti,
      ...classificaStraordinarioTurno({ ...turno, automaticiMinuti }),
    };
  });
}
