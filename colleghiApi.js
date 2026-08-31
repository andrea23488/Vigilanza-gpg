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

export async function caricaColleghi() {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from('colleghi')
    .select('id, user_id, collega_id, stato, created_at')
    .or(`user_id.eq.${user.id},collega_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const relazioni = data || [];

  const risultati = await Promise.all(
    relazioni.map(async (relazione) => {
      const altroUserId =
        relazione.user_id === user.id
          ? relazione.collega_id
          : relazione.user_id;

      const { data: profilo, error: profiloError } = await supabase
        .from('profili')
        .select('user_id, nome, cognome, azienda, sede, foto_url, codice_gpg')
        .eq('user_id', altroUserId)
        .maybeSingle();

      if (profiloError) throw profiloError;

      return {
        ...relazione,
        altro_user_id: altroUserId,
        ricevuta: relazione.collega_id === user.id,
        profilo: profilo || null,
      };
    })
  );

  return risultati;
}

export async function aggiungiCollega(testoRicerca) {
  const user = await getCurrentUser();

  const ricerca = String(testoRicerca || '').trim();

  if (!ricerca) {
    throw new Error(
      'Inserisci nome, cognome, matricola o codice GPG.'
    );
  }

  let profiliTrovati = [];

  // Prima prova il codice GPG esatto
  const codice = ricerca.toUpperCase();

  const { data: profiloCodice, error: erroreCodice } =
    await supabase
      .from('profili')
      .select('user_id, nome, cognome, codice_gpg, azienda, sede')
      .eq('codice_gpg', codice)
      .maybeSingle();

  if (erroreCodice) throw erroreCodice;

  if (profiloCodice) {
    profiliTrovati = [profiloCodice];
  } else {
    // Ricerca per nome/cognome
    const parole = ricerca
      .split(/\s+/)
      .map(x => x.trim())
      .filter(Boolean);

    let query = supabase
      .from('profili')
      .select('user_id, nome, cognome, codice_gpg, azienda, sede')
      .neq('user_id', user.id);

    if (parole.length >= 2) {
      const nome = parole[0];
      const cognome = parole.slice(1).join(' ');

      query = query
        .ilike('nome', nome)
        .ilike('cognome', cognome);
    } else {
      const q = parole[0];

      query = query.or(
        `nome.ilike.%${q}%,cognome.ilike.%${q}%,codice_gpg.ilike.%${q}%`
      );
    }

    const { data, error } = await query.limit(20);

    if (error) throw error;

    profiliTrovati = data || [];
  }

  profiliTrovati = profiliTrovati.filter(
    p => p.user_id !== user.id
  );

  if (profiliTrovati.length === 0) {
    throw new Error(
      'Nessun collega trovato. Prova con nome e cognome completi oppure con la matricola.'
    );
  }

  if (profiliTrovati.length > 1) {
    const esempi = profiliTrovati
      .slice(0, 3)
      .map(
        p =>
          `${p.nome || ''} ${p.cognome || ''}`.trim()
      )
      .filter(Boolean)
      .join(', ');

    throw new Error(
      `Ho trovato più colleghi${esempi ? `: ${esempi}` : ''}. Scrivi nome e cognome completi oppure la matricola.`
    );
  }

  const profiloCollega = profiliTrovati[0];
  const collegaId = profiloCollega.user_id;

  const { data: esistenti, error: erroreEsistenti } =
    await supabase
      .from('colleghi')
      .select('id, user_id, collega_id, stato')
      .or(
        `and(user_id.eq.${user.id},collega_id.eq.${collegaId}),and(user_id.eq.${collegaId},collega_id.eq.${user.id})`
      );

  if (erroreEsistenti) throw erroreEsistenti;

  const esistente = (esistenti || [])[0];

  if (esistente?.stato === 'accettato') {
    throw new Error('Siete già colleghi.');
  }

  if (esistente?.stato === 'in_attesa') {
    throw new Error('Esiste già una richiesta in attesa.');
  }

  const { data, error } = await supabase
    .from('colleghi')
    .insert({
      user_id: user.id,
      collega_id: collegaId,
      stato: 'in_attesa',
    })
    .select()
    .single();

  if (error) throw error;

  return {
    ...data,
    profilo: profiloCollega,
  };
}

export async function rimuoviCollega(idRelazione) {
  await getCurrentUser();

  const { error } = await supabase
    .from('colleghi')
    .delete()
    .eq('id', idRelazione);

  if (error) throw error;

  return true;
}
export async function accettaCollega(idRelazione) {
  const user = await getCurrentUser();
  const { data, error } = await supabase.from("colleghi").update({ stato: "accettato" }).eq("id", idRelazione).eq("collega_id", user.id).eq("stato", "in_attesa").select().single();
  if (error) throw error;
  return data;
}

export async function rifiutaCollega(idRelazione) {
  const user = await getCurrentUser();
  const { error } = await supabase.from("colleghi").delete().eq("id", idRelazione).eq("collega_id", user.id).eq("stato", "in_attesa");
  if (error) throw error;
  return true;
}
