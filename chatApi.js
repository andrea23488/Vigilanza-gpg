import { supabase } from './supabase';

async function getCurrentUser() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;

  if (!session?.user) {
    throw new Error('Utente non autenticato.');
  }

  return session.user;
}

export async function caricaMessaggi(destinatarioId) {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from('messaggi')
    .select('*')
    .or(
      `and(mittente_id.eq.${user.id},destinatario_id.eq.${destinatarioId}),and(mittente_id.eq.${destinatarioId},destinatario_id.eq.${user.id})`
    )
    .order('created_at', { ascending: true });

  if (error) throw error;

  return data || [];
}

export async function inviaMessaggio(destinatarioId, testo) {
  const user = await getCurrentUser();

  const pulito = testo.trim();

  if (!pulito) {
    throw new Error('Scrivi un messaggio.');
  }

  const { data, error } = await supabase
    .from('messaggi')
    .insert({
      mittente_id: user.id,
      destinatario_id: destinatarioId,
      testo: pulito,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function mioUserId() {
  const user = await getCurrentUser();
  return user.id;
}

export async function contaMessaggiNonLetti() {
  const user = await getCurrentUser();

  const { count, error } = await supabase
    .from('messaggi')
    .select('id', {
      count: 'exact',
      head: true,
    })
    .eq('destinatario_id', user.id)
    .is('letto_at', null);

  if (error) throw error;

  return count || 0;
}

export async function segnaMessaggiComeLetti(mittenteId) {
  const user = await getCurrentUser();

  const { error } = await supabase
    .from('messaggi')
    .update({
      letto_at: new Date().toISOString(),
    })
    .eq('destinatario_id', user.id)
    .eq('mittente_id', mittenteId)
    .is('letto_at', null);

  if (error) throw error;

  return true;
}

export async function ultimoMessaggioNonLetto() {
  const user = await getCurrentUser();

  const { data: messaggio, error } = await supabase
    .from('messaggi')
    .select('id, mittente_id, testo, created_at')
    .eq('destinatario_id', user.id)
    .is('letto_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!messaggio) return null;

  const { data: profilo, error: profiloError } = await supabase
    .from('profili')
    .select('nome, cognome')
    .eq('user_id', messaggio.mittente_id)
    .maybeSingle();

  if (profiloError) throw profiloError;

  return {
    ...messaggio,
    nomeMittente: [profilo?.nome, profilo?.cognome]
      .filter(Boolean)
      .join(' ') || 'Un collega',
  };
}

export async function mittentiConMessaggiNonLetti() {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from('messaggi')
    .select('mittente_id')
    .eq('destinatario_id', user.id)
    .is('letto_at', null);

  if (error) throw error;

  const conteggi = {};

  (data || []).forEach((m) => {
    conteggi[m.mittente_id] = (conteggi[m.mittente_id] || 0) + 1;
  });

  return conteggi;
}


export async function ultimoMessaggioConCollega(collegaId) {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from('messaggi')
    .select('*')
    .or(
      `and(mittente_id.eq.${user.id},destinatario_id.eq.${collegaId}),and(mittente_id.eq.${collegaId},destinatario_id.eq.${user.id})`
    )
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data || null;
}

export async function eliminaMessaggio(messaggioId) {
  const user = await getCurrentUser();

  const { error } = await supabase
    .from('messaggi')
    .delete()
    .eq('id', messaggioId)
    .eq('mittente_id', user.id);

  if (error) throw error;

  return true;
}

export async function eliminaConversazione(altroUserId) {
  const user = await getCurrentUser();

  const { data: deleted1, error: error1 } = await supabase
    .from('messaggi')
    .delete()
    .eq('mittente_id', user.id)
    .eq('destinatario_id', altroUserId)
    .select();

  if (error1) throw error1;

  const { data: deleted2, error: error2 } = await supabase
    .from('messaggi')
    .delete()
    .eq('mittente_id', altroUserId)
    .eq('destinatario_id', user.id)
    .select();

  if (error2) throw error2;

  console.log('DELETE CONVERSAZIONE:', {
    altroUserId,
    mieiEliminati: deleted1,
    suoiEliminati: deleted2
  });

  return true;
}

export async function colleghiConConversazione() {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from('messaggi')
    .select('mittente_id, destinatario_id')
    .or(`mittente_id.eq.${user.id},destinatario_id.eq.${user.id}`);

  if (error) throw error;

  const ids = [...new Set(
    (data || [])
      .map(m =>
        m.mittente_id === user.id
          ? m.destinatario_id
          : m.mittente_id
      )
      .filter(Boolean)
  )];

  return ids;
}

/* ===== RIEPILOGO LISTA CHAT ===== */
export async function caricaRiepilogoConversazioni() {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from('messaggi')
    .select('id, mittente_id, destinatario_id, testo, created_at, letto_at')
    .or(`mittente_id.eq.${user.id},destinatario_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const riepilogo = {};

  for (const m of data || []) {
    const altroUserId =
      m.mittente_id === user.id
        ? m.destinatario_id
        : m.mittente_id;

    if (!riepilogo[altroUserId]) {
      riepilogo[altroUserId] = {
        ultimoMessaggio: m.testo || '',
        created_at: m.created_at,
        nonLetti: 0,
      };
    }

    if (
      m.destinatario_id === user.id &&
      m.mittente_id === altroUserId &&
      !m.letto_at
    ) {
      riepilogo[altroUserId].nonLetti += 1;
    }
  }

  return riepilogo;
}

export async function inviaConsegna(destinatarioId, consegna) {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from('consegne_servizio')
    .insert({
      mittente_id: user.id,
      destinatario_id: destinatarioId,
      data_servizio: consegna.data || null,
      ora_servizio: consegna.ora || null,
      postazione: consegna.postazione || null,
      accaduto: consegna.accaduto || null,
      da_fare: consegna.daFare || null,
      anomalie: consegna.anomalie || null,
      chiavi: consegna.chiavi || null,
      apparati: consegna.apparati || null,
      note: consegna.note || null,
      letta: false
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function caricaConsegneRicevute() {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from('consegne_servizio')
    .select('*')
    .eq('destinatario_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data || [];
}

export async function segnaConsegnaComeLetta(consegnaId) {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from('consegne_servizio')
    .update({
      letta: true,
      letta_at: new Date().toISOString()
    })
    .eq('id', consegnaId)
    .eq('destinatario_id', user.id)
    .select()
    .single();

  if (error) throw error;

  return data;
}
