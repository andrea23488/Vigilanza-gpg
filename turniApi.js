import { supabase } from './supabase';

async function getAuthContext() {
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

  return {
    user: session.user,
    accessToken: session.access_token,
  };
}

function buildHeaders(accessToken, includeJson = false) {
  const headers = {
    apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${accessToken}`,
  };

  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

export async function caricaTurniUtente() {
  const { user, accessToken } = await getAuthContext();

  const url =
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}` +
    `/rest/v1/turni` +
    `?select=*` +
    `&user_id=eq.${user.id}` +
    `&order=anno.asc,mese.asc,giorno.asc`;

  const response = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(accessToken),
  });

  const testo = await response.text();

  if (!response.ok) {
    throw new Error(
      `Errore lettura turni HTTP ${response.status}: ${testo}`
    );
  }

  return testo ? JSON.parse(testo) : [];
}

export async function creaTurnoUtente(payload) {
  const { user, accessToken } = await getAuthContext();

  const payloadCompleto = {
    ...payload,
    user_id: user.id,
  };

  const response = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/turni`,
    {
      method: 'POST',
      headers: {
        ...buildHeaders(accessToken, true),
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payloadCompleto),
    }
  );

  const testo = await response.text();

  if (!response.ok) {
    throw new Error(
      `Errore creazione turno HTTP ${response.status}: ${testo}`
    );
  }

  const righe = testo ? JSON.parse(testo) : [];

  if (!Array.isArray(righe) || righe.length === 0) {
    throw new Error('Supabase non ha restituito il turno creato.');
  }

  return righe[0];
}

export async function aggiornaTurnoUtente(id, payload) {
  const { user, accessToken } = await getAuthContext();

  const payloadCompleto = {
    ...payload,
    user_id: user.id,
  };

  const response = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/turni?id=eq.${id}&user_id=eq.${user.id}`,
    {
      method: 'PATCH',
      headers: {
        ...buildHeaders(accessToken, true),
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payloadCompleto),
    }
  );

  const testo = await response.text();

  if (!response.ok) {
    throw new Error(
      `Errore modifica turno HTTP ${response.status}: ${testo}`
    );
  }

  const righe = testo ? JSON.parse(testo) : [];

  if (!Array.isArray(righe) || righe.length === 0) {
    throw new Error('Turno non trovato o non modificabile.');
  }

  return righe[0];
}

export async function eliminaTurnoUtente(id) {
  const { user, accessToken } = await getAuthContext();

  const response = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/turni?id=eq.${id}&user_id=eq.${user.id}`,
    {
      method: 'DELETE',
      headers: buildHeaders(accessToken),
    }
  );

  const testo = await response.text();

  if (!response.ok) {
    throw new Error(
      `Errore eliminazione turno HTTP ${response.status}: ${testo}`
    );
  }

  return true;
}