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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function pulisciRicerca(valore) {
  return String(valore || '')
    .trim()
    .replace(/[(),]/g, ' ')
    .replace(/\s+/g, ' ');
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
  const ids = [
    ...new Set(
      relazioni
        .map((relazione) =>
          relazione.user_id === user.id
            ? relazione.collega_id
            : relazione.user_id
        )
        .filter(Boolean)
    ),
  ];

  let profili = [];

  if (ids.length > 0) {
    const { data: profiliData, error: profiliError } = await supabase
      .from('profili')
      .select('user_id, nome, cognome, azienda, sede, foto_url, codice_gpg')
      .in('user_id', ids);

    if (profiliError) throw profiliError;
    profili = profiliData || [];
  }

  const profiliPerUtente = new Map(
    profili.map((profilo) => [profilo.user_id, profilo])
  );

  return relazioni.map((relazione) => {
    const altroUserId =
      relazione.user_id === user.id
        ? relazione.collega_id
        : relazione.user_id;

    return {
      ...relazione,
      altro_user_id: altroUserId,
      ricevuta: relazione.collega_id === user.id,
      profilo: profiliPerUtente.get(altroUserId) || null,
    };
  });
}

export async function aggiungiCollega(testoRicerca) {
  const user = await getCurrentUser();
  const ricerca = pulisciRicerca(testoRicerca);

  if (!ricerca) {
    throw new Error(
      'Inserisci nome, cognome, UUID utente o codice GPG.'
    );
  }

  const selectProfilo =
    'user_id, nome, cognome, codice_gpg, azienda, sede, foto_url';

  let profiliTrovati = [];

  if (UUID_RE.test(ricerca)) {
    const { data, error } = await supabase
      .from('profili')
      .select(selectProfilo)
      .eq('user_id', ricerca)
      .limit(1);

    if (error) throw error;
    profiliTrovati = data || [];
  }

  if (profiliTrovati.length === 0) {
    const codice = ricerca.toUpperCase();

    const { data, error } = await supabase
      .from('profili')
      .select(selectProfilo)
      .eq('codice_gpg', codice)
      .limit(20);

    if (error) throw error;
    profiliTrovati = data || [];
  }

  if (profiliTrovati.length === 0) {
    const parole = ricerca
      .split(/\s+/)
      .map((x) => x.trim())
      .filter(Boolean);

    let query = supabase
      .from('profili')
      .select(selectProfilo)
      .neq('user_id', user.id);

    if (parole.length >= 2) {
      const nome = parole[0];
      const cognome = parole.slice(1).join(' ');

      query = query
        .ilike('nome', `%${nome}%`)
        .ilike('cognome', `%${cognome}%`);
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
    (profilo) => profilo?.user_id && profilo.user_id !== user.id
  );

  if (profiliTrovati.length === 0) {
    throw new Error(
      'Nessun collega trovato. Prova con nome e cognome, codice GPG o UUID.'
    );
  }

  if (profiliTrovati.length > 1) {
    const esempi = profiliTrovati
      .slice(0, 3)
      .map((profilo) =>
        [profilo?.nome, profilo?.cognome].filter(Boolean).join(' ').trim()
      )
      .filter(Boolean)
      .join(', ');

    throw new Error(
      `Ho trovato più colleghi${esempi ? `: ${esempi}` : ''}. Specifica meglio la ricerca.`
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
  const user = await getCurrentUser();

  const { error } = await supabase
    .from('colleghi')
    .delete()
    .eq('id', idRelazione)
    .or(`user_id.eq.${user.id},collega_id.eq.${user.id}`);

  if (error) throw error;

  return true;
}

export async function accettaCollega(idRelazione) {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from('colleghi')
    .update({ stato: 'accettato' })
    .eq('id', idRelazione)
    .eq('collega_id', user.id)
    .eq('stato', 'in_attesa')
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function rifiutaCollega(idRelazione) {
  const user = await getCurrentUser();

  const { error } = await supabase
    .from('colleghi')
    .delete()
    .eq('id', idRelazione)
    .eq('collega_id', user.id)
    .eq('stato', 'in_attesa');

  if (error) throw error;
  return true;
}
