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

  const righe = data || [];

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

      return {
        ...riga,
        altro_user_id: altroUserId,
        profilo: profilo || null,
      };
    })
  );

  return risultati;
}