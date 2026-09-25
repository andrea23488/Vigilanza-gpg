import { supabase } from './supabase';
import {
  creaErroreBackendTurni,
  eseguiRichiestaTurni,
} from './turniRete';

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
    `&order=anno.asc,mese.asc,giorno.asc,inizio.asc.nullslast`;

  const { response, testo } = await eseguiRichiestaTurni({
    url,
    operazione: 'il caricamento dei turni',
    opzioni: {
      method: 'GET',
      headers: buildHeaders(accessToken),
    },
  });

  if (!response.ok) {
    throw creaErroreBackendTurni({
      operazione: 'il caricamento dei turni',
      status: response.status,
      dettagli: testo,
    });
  }

  return testo ? JSON.parse(testo) : [];
}

export async function creaTurnoUtente(payload) {
  const { user, accessToken } = await getAuthContext();

  const payloadCompleto = {
    ...payload,
    user_id: user.id,
  };

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/turni`;
  const { response, testo } = await eseguiRichiestaTurni({
    url,
    operazione: 'il salvataggio del turno',
    opzioni: {
      method: 'POST',
      headers: {
        ...buildHeaders(accessToken, true),
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payloadCompleto),
    },
  });

  if (!response.ok) {
    throw creaErroreBackendTurni({
      operazione: 'il salvataggio del turno',
      status: response.status,
      dettagli: testo,
    });
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

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/turni?id=eq.${id}&user_id=eq.${user.id}`;
  const { response, testo } = await eseguiRichiestaTurni({
    url,
    operazione: 'la modifica del turno',
    opzioni: {
      method: 'PATCH',
      headers: {
        ...buildHeaders(accessToken, true),
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payloadCompleto),
    },
  });

  if (!response.ok) {
    throw creaErroreBackendTurni({
      operazione: 'la modifica del turno',
      status: response.status,
      dettagli: testo,
    });
  }

  const righe = testo ? JSON.parse(testo) : [];

  if (!Array.isArray(righe) || righe.length === 0) {
    throw new Error('Turno non trovato o non modificabile.');
  }

  return righe[0];
}

export async function eliminaTurnoUtente(id) {
  const { user, accessToken } = await getAuthContext();

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/turni?id=eq.${id}&user_id=eq.${user.id}`;
  const { response, testo } = await eseguiRichiestaTurni({
    url,
    operazione: 'l’eliminazione del turno',
    opzioni: {
      method: 'DELETE',
      headers: buildHeaders(accessToken),
    },
  });

  if (!response.ok) {
    throw creaErroreBackendTurni({
      operazione: 'l’eliminazione del turno',
      status: response.status,
      dettagli: testo,
    });
  }

  return true;
}
