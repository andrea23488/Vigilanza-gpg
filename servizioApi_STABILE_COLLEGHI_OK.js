import { supabase } from './supabase';

async function getCurrentUser() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;
  if (!session?.user) throw new Error('Utente non autenticato.');

  return session.user;
}

export async function caricaColleghiInServizio(giorno, mese, anno) {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from('colleghi_in_servizio')
    .select('*')
    .eq('giorno', giorno)
    .eq('mese', mese)
    .eq('anno', anno)
    .or(`user_id.eq.${user.id},collega_id.eq.${user.id}`);

  if (error) throw error;

  const righe = (data || []).filter((riga) => {
    const toMinutes = (ora) => {
      if (!ora) return null;
      const [h, m] = ora.split(':').map(Number);
      return h * 60 + m;
    };

    const startA = toMinutes(riga.inizio_utente);
    let endA = toMinutes(riga.fine_utente);
    const startB = toMinutes(riga.inizio_collega);
    let endB = toMinutes(riga.fine_collega);

    if ([startA, endA, startB, endB].some((v) => v === null)) {
      return false;
    }

    // Se il turno termina dopo mezzanotte, lo portiamo al giorno successivo.
    if (endA <= startA) endA += 24 * 60;
    if (endB <= startB) endB += 24 * 60;

    // Due turni si sovrappongono se ciascuno inizia prima
    // che l'altro sia terminato.
    return startA < endB && startB < endA;
  });

  const risultati = await Promise.all(
    righe.map(async (riga) => {
      const altroUserId =
        riga.user_id === user.id
          ? riga.collega_id
          : riga.user_id;

      const { data: profilo, error: profiloError } = await supabase
        .from('profili')
        .select('nome, cognome, azienda, sede, foto_url, codice_gpg')
        .eq('user_id', altroUserId)
        .maybeSingle();

      if (profiloError) throw profiloError;

      const toMinutes = (ora) => {
        const [h, m] = ora.split(':').map(Number);
        return h * 60 + m;
      };

      const formatMinutes = (minuti) => {
        const valore = minuti % (24 * 60);
        const h = Math.floor(valore / 60);
        const m = valore % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      };

      const startA = toMinutes(riga.inizio_utente);
      let endA = toMinutes(riga.fine_utente);
      const startB = toMinutes(riga.inizio_collega);
      let endB = toMinutes(riga.fine_collega);

      if (endA <= startA) endA += 24 * 60;
      if (endB <= startB) endB += 24 * 60;

      const insiemeDa = Math.max(startA, startB);
      const insiemeA = Math.min(endA, endB);

      return {
        ...riga,
        altro_user_id: altroUserId,
        profilo: profilo || null,
        insieme_da: formatMinutes(insiemeDa),
        insieme_a: formatMinutes(insiemeA),
      };
    })
  );

  return risultati;
}