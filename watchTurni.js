// Watch-only conversion: validate optional seconds, then keep minute precision.
export function normalizzaOraWatch(valore) {
  if (typeof valore !== 'string') return null;
  const match = /^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(valore.trim());
  if (!match) return null;
  return {
    ore: Number(match[1]),
    minuti: Number(match[2]),
    testo: `${match[1].padStart(2, '0')}:${match[2]}`,
  };
}

export function creaIntervalloWatch(turno) {
  if (turno?.tipo !== 'turno') return null;
  const start = normalizzaOraWatch(turno.inizio);
  const end = normalizzaOraWatch(turno.fine);
  if (!start || !end) return null;
  const inizio = new Date(
    Number(turno.anno), Number(turno.mese) - 1, Number(turno.giorno),
    start.ore, start.minuti, 0, 0
  );
  const fine = new Date(
    Number(turno.anno), Number(turno.mese) - 1, Number(turno.giorno),
    end.ore, end.minuti, 0, 0
  );
  if (!Number.isFinite(inizio.getTime()) || !Number.isFinite(fine.getTime())) return null;
  if (fine <= inizio) fine.setDate(fine.getDate() + 1);
  return {
    turno: { ...turno, inizio: start.testo, fine: end.testo },
    inizio,
    fine,
  };
}

export function preparaTurniWatch(turni, adessoWatch) {
  const intervalli = turni.map(creaIntervalloWatch).filter(Boolean)
    .sort((a, b) => a.inizio - b.inizio);
  const finestraTurniWatch = intervalli
    .filter(({ fine }) => fine > adessoWatch)
    .slice(0, 31)
    .map(({ turno, inizio, fine }) => ({
      id: String(turno.id || ''),
      inizio: turno.inizio,
      fine: turno.fine,
      luogo: String(turno.luogo || ''),
      indirizzo: String(turno.indirizzo_servizio || ''),
      inizioTimestamp: inizio.getTime() / 1000,
      fineTimestamp: fine.getTime() / 1000,
    }));
  const correnteWatch = intervalli.find(
    ({ inizio, fine }) => adessoWatch >= inizio && adessoWatch < fine
  ) || null;
  const prossimoWatch = intervalli.find(({ inizio }) => inizio > adessoWatch) || null;
  const successivoWatch = correnteWatch ? prossimoWatch : intervalli.find(
    ({ inizio }) => prossimoWatch && inizio > prossimoWatch.inizio
  ) || null;
  return { finestraTurniWatch, correnteWatch, prossimoWatch, successivoWatch };
}
