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

export async function eliminaTurnoUtente(id, options) {
  if (options) return eliminaTurnoVerificato(id, options);
  const { user, accessToken } = await getAuthContext();
  if (!((typeof id === 'string' && id.trim()) || (typeof id === 'number' && Number.isFinite(id)))) throw new Error('Identificativo turno non valido.');
  const query = new URLSearchParams({ id: `eq.${id}`, user_id: `eq.${user.id}` });
  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/turni?${query}`;
  const { response, testo } = await eseguiRichiestaTurni({ url, operazione: 'l’eliminazione del turno',
    opzioni: { method: 'DELETE', headers: { ...buildHeaders(accessToken), Prefer: 'return=representation' } } });
  if (!response.ok) throw creaErroreBackendTurni({ operazione: 'l’eliminazione del turno', status: response.status, dettagli: testo });
  const deleted = testo ? JSON.parse(testo) : null;
  if (!Array.isArray(deleted) || deleted.length !== 1 || String(deleted[0].id) !== String(id) || deleted[0].user_id !== user.id) {
    throw new Error('Il server non ha confermato la cancellazione. Aggiorna il calendario e verifica i permessi.');
  }
  const verification = await eseguiRichiestaTurni({ url: `${url}&select=id`, operazione: 'la verifica dell’eliminazione',
    opzioni: { method: 'GET', headers: buildHeaders(accessToken) } });
  if (!verification.response.ok) throw creaErroreBackendTurni({ operazione: 'la verifica dell’eliminazione', status: verification.response.status, dettagli: verification.testo });
  const remaining = JSON.parse(verification.testo);
  const current = await getAuthContext();
  if (current.user.id !== user.id || !Array.isArray(remaining) || remaining.length) throw new Error('Cancellazione non verificata sul server. Aggiorna il calendario.');
  return true;
}

// Confronto atomico sullo snapshot letto dal server, con JWT e RLS originali.
// Nessun GET seguito da DELETE incondizionata: tutti i valori attesi sono nel WHERE.
function filtroValoreAtteso(value) {
  if (value === null) return 'is.null';
  // eq semplice conserva il valore letterale: le virgolette non sono delimitatori.
  // URLSearchParams codifica separatori e caratteri speciali senza alterare il valore.
  if (typeof value === 'string') return `eq.${value}`;
  if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return `eq.${value}`;
  throw new Error('Formato del turno non confrontabile in sicurezza. Aggiorna il calendario.');
}

async function eliminaTurnoVerificato(id, { expected, expectedUserId }) {
  const { user, accessToken } = await getAuthContext();
  const validId = (typeof id === 'string' && !!id.trim()) || (typeof id === 'number' && Number.isFinite(id));
  if (!validId || !accessToken || !expected || String(expected.id) !== String(id) ||
      expected.tipo !== 'turno' || expected.user_id !== user.id || expectedUserId !== user.id ||
      !['anno', 'mese', 'giorno', 'inizio', 'fine'].every(key => Object.prototype.hasOwnProperty.call(expected, key))) {
    throw new Error('Turno o sessione non validi per l’eliminazione. Aggiorna il calendario.');
  }
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(expected)) {
    if (!/^[a-z_][a-z0-9_]*$/i.test(key)) throw new Error('Campo del turno non confrontabile in sicurezza.');
    query.set(key, filtroValoreAtteso(value));
  }
  const base = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/turni`;
  const { response, testo } = await eseguiRichiestaTurni({
    url: `${base}?${query.toString()}`,
    operazione: 'l’eliminazione del turno',
    opzioni: { method: 'DELETE', headers: { ...buildHeaders(accessToken), Prefer: 'return=representation' } },
  });
  if (!response.ok) throw creaErroreBackendTurni({operazione: 'l’eliminazione del turno', status: response.status, dettagli: testo});
  const deleted = testo ? JSON.parse(testo) : null;
  if (!Array.isArray(deleted) || deleted.length > 1 || deleted.some(row =>
    String(row.id) !== String(id) || row.user_id !== user.id)) {
    throw new Error('Esito eliminazione non verificabile. Aggiorna il calendario.');
  }
  const check = new URLSearchParams({select: 'id,user_id', id: filtroValoreAtteso(id), user_id: filtroValoreAtteso(user.id)});
  const verification = await eseguiRichiestaTurni({
    url: `${base}?${check.toString()}`, operazione: 'la verifica dell’eliminazione',
    opzioni: {method: 'GET', headers: buildHeaders(accessToken)},
  });
  if (!verification.response.ok) throw creaErroreBackendTurni({operazione: 'la verifica dell’eliminazione', status: verification.response.status, dettagli: verification.testo});
  const remaining = JSON.parse(verification.testo);
  const current = await getAuthContext();
  if (current.user.id !== user.id || !Array.isArray(remaining) || remaining.length > 1 ||
      remaining.some(row => String(row.id) !== String(id) || row.user_id !== user.id)) {
    throw new Error('Sessione o risposta di verifica cambiata. Aggiorna il calendario.');
  }
  // Assenza senza riga DELETE restituita: non attribuire a questa richiesta una cancellazione.
  return {deleted: deleted.length === 1 && remaining.length === 0,
    absent: deleted.length === 0 && remaining.length === 0};
}
