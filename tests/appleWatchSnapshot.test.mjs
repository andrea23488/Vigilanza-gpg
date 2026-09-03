import assert from 'node:assert/strict';
import test from 'node:test';

import { createAppleWatchSnapshot } from '../appleWatchSnapshot.mjs';

const shifts = [
  {
    id: 2,
    giorno: 4,
    mese: 9,
    anno: 2026,
    tipo: 'turno',
    inizio: '14:00',
    fine: '22:00',
    luogo: 'Seconda sede',
  },
  {
    id: 1,
    giorno: 3,
    mese: 9,
    anno: 2026,
    tipo: 'turno',
    inizio: '22:00',
    fine: '06:00',
    luogo: '  Sede centrale  ',
    indirizzo_servizio: ' Via Roma 1 ',
  },
];

test('separa il turno notturno corrente dal prossimo turno', () => {
  const snapshot = createAppleWatchSnapshot(
    shifts,
    new Date(2026, 8, 4, 1, 0)
  );

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.currentShift.id, '1');
  assert.equal(snapshot.currentShift.date, '2026-09-03');
  assert.equal(snapshot.currentShift.place, 'Sede centrale');
  assert.equal(snapshot.currentShift.address, 'Via Roma 1');
  assert.equal(snapshot.nextShift.id, '2');
});

test('restituisce valori null senza turni validi', () => {
  const snapshot = createAppleWatchSnapshot(
    [
      { tipo: 'riposo', giorno: 3, mese: 9, anno: 2026 },
      {
        tipo: 'turno',
        giorno: 31,
        mese: 2,
        anno: 2026,
        inizio: '08:00',
        fine: '16:00',
      },
    ],
    new Date(2026, 8, 3, 12, 0)
  );

  assert.equal(snapshot.currentShift, null);
  assert.equal(snapshot.nextShift, null);
});

test('non modifica l’elenco dei turni ricevuto', () => {
  const input = [...shifts];

  createAppleWatchSnapshot(input, new Date(2026, 8, 3, 12, 0));

  assert.deepEqual(input, shifts);
});

test('rifiuta una data di riferimento non valida', () => {
  assert.throws(
    () => createAppleWatchSnapshot(shifts, 'non-valida'),
    /data valida/
  );
});
