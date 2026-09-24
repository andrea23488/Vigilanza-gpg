function turno(giorno, inizio, fine, ore, extra = {}) {
  return {
    id: `agosto-2026-${giorno}`,
    tipo: 'turno',
    giorno,
    mese: 8,
    anno: 2026,
    inizio,
    fine,
    ore,
    ...extra,
  };
}

const turni = [
  turno(1, '07:00', '15:00', 8),
  { id: 'agosto-2026-2', tipo: 'permesso', giorno: 2, mese: 8, anno: 2026 },
  turno(3, '15:00', '22:00', 7),
  turno(4, '07:00', '19:00', 12),
  { id: 'agosto-2026-5', tipo: 'riposo', giorno: 5, mese: 8, anno: 2026 },
  turno(6, '15:00', '23:00', 8),
  turno(7, '15:00', '23:00', 8),
  turno(8, '15:00', '23:00', 8),
  turno(9, '15:00', '22:00', 7),
  turno(10, '07:00', '14:00', 7),
  turno(11, '23:00', '07:00', 8),
  turno(12, '23:00', '07:00', 8),
  turno(13, '23:00', '07:00', 8),
  turno(14, '23:00', '07:00', 8),
  turno(15, '23:00', '07:00', 8, { riposo_lavorato: true }),
  { id: 'agosto-2026-17', tipo: 'riposo', giorno: 17, mese: 8, anno: 2026 },
  turno(18, '07:00', '15:00', 8),
  turno(19, '07:00', '15:00', 8),
  turno(20, '07:00', '15:00', 8),
  turno(21, '07:00', '19:00', 12),
  turno(22, '07:00', '15:00', 8),
  { id: 'agosto-2026-23', tipo: 'riposo', giorno: 23, mese: 8, anno: 2026 },
  turno(24, '07:00', '19:00', 12),
  turno(25, '07:00', '15:00', 8),
  turno(26, '07:00', '15:00', 8),
  turno(27, '07:00', '15:00', 8),
  turno(28, '07:00', '15:00', 8),
  { id: 'agosto-2026-29', tipo: 'riposo', giorno: 29, mese: 8, anno: 2026 },
  turno(30, '15:00', '23:30', 8.5),
  turno(31, '15:00', '22:00', 7),
];

module.exports = {
  descrizione: 'Caso reale Fiduciari agosto 2026 ricostruito dal calendario app',
  meseTarget: 8,
  annoTarget: 2026,
  configurazione: {
    modalitaStraordinario: 'settimanale',
    sogliaSettimanale: 40,
  },
  turni,
  certo: {
    oreFisiche: 208.5,
    oreNotturne: 39.5,
    oreDomenicali: 22.5,
    oreFestive: 8,
    oreRiposoLavorato: 8,
  },
  dipendenteDaConfigurazione: {
    oreStraordinarieConSogliaSettimanale40: 33.5,
    nota:
      'Le 42,67 ore del cedolino richiedono cartellino e regole aziendali; non sono un risultato forzato della fixture.',
  },
};
