import { supabase } from './supabase';

async function getCurrentUser() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!session?.user) {
    throw new Error('Utente non autenticato.');
  }

  return session.user;
}

export async function caricaProfiloUtente() {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from('profili')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function salvaProfiloUtente(profilo) {
  const user = await getCurrentUser();

  const payload = {
    user_id: user.id,
    nome: profilo.nome || '',
    cognome: profilo.cognome || '',
    azienda: profilo.azienda || '',
    ruolo: profilo.ruolo || '',
    sede: profilo.sede || '',
    foto_url: profilo.foto_url || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('profili')
    .upsert(payload, {
      onConflict: 'user_id',
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}