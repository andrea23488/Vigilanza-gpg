import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

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
    matricola: profilo.matricola || null,
    sede: profilo.sede || '',
    updated_at: new Date().toISOString(),
  };

  if (profilo.foto_url !== undefined) {
    payload.foto_url = profilo.foto_url;
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

export async function caricaFotoProfilo(uriLocale) {
  const user = await getCurrentUser();

  if (!uriLocale) {
    throw new Error('Nessuna foto selezionata.');
  }

  const base64 = await FileSystem.readAsStringAsync(
    uriLocale,
    {
      encoding: FileSystem.EncodingType.Base64,
    }
  );

  const filePath = `${user.id}/avatar.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('profili')
    .upload(
      filePath,
      decode(base64),
      {
        contentType: 'image/jpeg',
        upsert: true,
      }
    );

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage
    .from('profili')
    .getPublicUrl(filePath);

  const publicUrl = data?.publicUrl;

  if (!publicUrl) {
    throw new Error(
      'Impossibile ottenere l’URL della foto.'
    );
  }

  return publicUrl;
}

export async function eliminaFotoProfiloCloud() {
  const user = await getCurrentUser();

  const filePath = `${user.id}/avatar.jpg`;

  const { error } = await supabase.storage
    .from('profili')
    .remove([filePath]);

  if (error) {
    throw error;
  }

  return true;
}