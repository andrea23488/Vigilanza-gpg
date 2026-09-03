const SNAPSHOT_SCHEMA_VERSION = 1;

function parseTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));

  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) return null;

  return { hours, minutes };
}

function getShiftDates(shift) {
  if (!shift || shift.tipo !== 'turno') return null;

  const year = Number(shift.anno);
  const month = Number(shift.mese);
  const day = Number(shift.giorno);
  const startTime = parseTime(shift.inizio);
  const endTime = parseTime(shift.fine);

  if (!year || !month || !day || !startTime || !endTime) return null;

  const start = new Date(
    year,
    month - 1,
    day,
    startTime.hours,
    startTime.minutes,
    0,
    0
  );

  const end = new Date(
    year,
    month - 1,
    day,
    endTime.hours,
    endTime.minutes,
    0,
    0
  );

  if (
    Number.isNaN(start.getTime()) ||
    start.getFullYear() !== year ||
    start.getMonth() !== month - 1 ||
    start.getDate() !== day
  ) {
    return null;
  }

  if (end <= start) {
    end.setDate(end.getDate() + 1);
  }

  return { start, end };
}

function toWatchShift(shift, dates) {
  return {
    id: shift.id == null ? null : String(shift.id),
    kind: 'work',
    date: [shift.anno, shift.mese, shift.giorno]
      .map((value, index) =>
        String(value).padStart(index === 0 ? 4 : 2, '0')
      )
      .join('-'),
    startTime: String(shift.inizio),
    endTime: String(shift.fine),
    startAt: dates.start.toISOString(),
    endAt: dates.end.toISOString(),
    place: String(shift.luogo || '').trim() || null,
    address: String(shift.indirizzo_servizio || '').trim() || null,
  };
}

export function createAppleWatchSnapshot(shifts, now = new Date()) {
  const referenceDate = now instanceof Date ? new Date(now) : new Date(now);

  if (Number.isNaN(referenceDate.getTime())) {
    throw new TypeError('now deve rappresentare una data valida.');
  }

  const orderedShifts = (Array.isArray(shifts) ? shifts : [])
    .map((shift) => {
      const dates = getShiftDates(shift);
      return dates ? { shift, dates } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.dates.start - b.dates.start);

  const current =
    orderedShifts.find(
      ({ dates }) => referenceDate >= dates.start && referenceDate < dates.end
    ) || null;

  const next =
    orderedShifts.find(({ dates }) => dates.start > referenceDate) || null;

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    generatedAt: referenceDate.toISOString(),
    currentShift: current ? toWatchShift(current.shift, current.dates) : null,
    nextShift: next ? toWatchShift(next.shift, next.dates) : null,
  };
}
