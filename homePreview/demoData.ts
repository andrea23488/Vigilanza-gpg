export function creaDatiDemo(adesso = new Date()) {
  const inizio = new Date(adesso.getTime() - 60 * 60 * 1000);
  const fine = new Date(adesso.getTime() + 3 * 60 * 60 * 1000);
  const orario = (data: Date) => `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
  const turno = {
    id: 'home-demo-servizio', tipo: 'turno',
    giorno: inizio.getDate(), mese: inizio.getMonth() + 1, anno: inizio.getFullYear(),
    inizio: orario(inizio), fine: orario(fine), luogo: 'Piantonamento\nAeroporto FCO',
    // No external map actions or real addresses in this demo.
    indirizzo_servizio: '',
  };
  return {
    profilo: { nome: 'Francesco', azienda: 'Istituto DEMO', ruolo: 'Guardia particolare giurata', punto_partenza: '' },
    turni: [turno], ore: '208.0 h', extra: '31 h', notti: 2, numeroNotifiche: 3,
    monthlySummary: { month: 'OTTOBRE 2026', progress: 81, hours: '208.0h', extra: '31h', days: '25' },
    summaryYear: adesso.getFullYear(), summaryMonth: adesso.getMonth(),
    periodo: `${adesso.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })} · DEMO`,
  };
}
