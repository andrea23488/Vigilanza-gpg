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

export async function condividiTurniConColleghi({
  turnoIds = [],
  collegaIds = [],
  livello = 'orari_luogo',
}) {
  const user = await getCurrentUser();

  const turniValidi = Array.from(
    new Set(turnoIds.filter(Boolean).map(String))
  );

  const colleghiValidi = Array.from(
    new Set(collegaIds.filter(Boolean))
  );

  if (turniValidi.length === 0) {
    throw new Error('Nessun turno selezionato.');
  }

  if (colleghiValidi.length === 0) {
    throw new Error('Seleziona almeno un collega.');
  }

  if (!['solo_orari', 'orari_luogo'].includes(livello)) {
    throw new Error('Livello di condivisione non valido.');
  }

  // Verifica che siano davvero colleghi accettati
  const { data: relazioni, error: relazioniError } = await supabase
    .from('colleghi')
    .select('user_id, collega_id, stato')
    .eq('stato', 'accettato')
    .or(`user_id.eq.${user.id},collega_id.eq.${user.id}`);

  if (relazioniError) throw relazioniError;

  const consentiti = new Set(
    (relazioni || []).map(r =>
      r.user_id === user.id ? r.collega_id : r.user_id
    )
  );

  const destinatari = colleghiValidi.filter(id =>
    consentiti.has(id)
  );

  if (destinatari.length === 0) {
    throw new Error(
      'Nessuno dei colleghi selezionati risulta accettato.'
    );
  }

  const righe = [];

  for (const turnoId of turniValidi) {
    for (const destinatarioId of destinatari) {
      righe.push({
        turno_id: turnoId,
        proprietario_id: user.id,
        destinatario_id: destinatarioId,
        livello,
      });
    }
  }

  const { data, error } = await supabase
    .from('turni_condivisioni')
    .upsert(righe, {
      onConflict:
        'turno_id,proprietario_id,destinatario_id',
    })
    .select();

  if (error) throw error;

  return data || [];
}

export async function rimuoviCondivisioneTurni({
  turnoIds = [],
  collegaIds = [],
}) {
  const user = await getCurrentUser();

  const turniValidi = Array.from(
    new Set(turnoIds.filter(Boolean).map(String))
  );

  const colleghiValidi = Array.from(
    new Set(collegaIds.filter(Boolean))
  );

  if (turniValidi.length === 0) return true;

  let query = supabase
    .from('turni_condivisioni')
    .delete()
    .eq('proprietario_id', user.id)
    .in('turno_id', turniValidi);

  if (colleghiValidi.length > 0) {
    query = query.in(
      'destinatario_id',
      colleghiValidi
    );
  }

  const { error } = await query;

  if (error) throw error;

  return true;
}

export async function caricaTurniCondivisiRicevuti() {
  const user = await getCurrentUser();

  const { data: condivisioni, error: errorCondivisioni } =
    await supabase
      .from('turni_condivisioni')
      .select(
        'id, turno_id, proprietario_id, destinatario_id, livello, created_at'
      )
      .eq('destinatario_id', user.id)
      .order('created_at', { ascending: false });

  if (errorCondivisioni) throw errorCondivisioni;

  const condivisi = condivisioni || [];

  if (condivisi.length === 0) {
    return [];
  }

  const proprietari = Array.from(
    new Set(condivisi.map(x => x.proprietario_id))
  );

  const turnoIds = Array.from(
    new Set(condivisi.map(x => String(x.turno_id)))
  );

  const { data: profili, error: errorProfili } =
    await supabase
      .from('profili')
      .select(
        'user_id, nome, cognome, azienda, sede, foto_url, codice_gpg'
      )
      .in('user_id', proprietari);

  if (errorProfili) throw errorProfili;

  const { data: turni, error: errorTurni } =
    await supabase
      .from('turni')
      .select('*')
      .in('id', turnoIds);

  if (errorTurni) throw errorTurni;

  const profiloPerUser = new Map(
    (profili || []).map(p => [p.user_id, p])
  );

  const turnoPerId = new Map(
    (turni || []).map(t => [String(t.id), t])
  );

  return condivisi
    .map(condivisione => {
      const turno = turnoPerId.get(
        String(condivisione.turno_id)
      );

      if (!turno) return null;

      const profilo =
        profiloPerUser.get(
          condivisione.proprietario_id
        ) || null;

      const turnoVisibile = {
        ...turno,
      };

      if (
        condivisione.livello ===
        'solo_orari'
      ) {
        turnoVisibile.luogo = null;
      }

      return {
        condivisione_id: condivisione.id,
        livello: condivisione.livello,
        proprietario_id:
          condivisione.proprietario_id,
        profilo,
        turno: turnoVisibile,
      };
    })
    .filter(Boolean);
}

export async function caricaMieCondivisioni() {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from('turni_condivisioni')
    .select(
      'id, turno_id, destinatario_id, livello, created_at'
    )
    .eq('proprietario_id', user.id);

  if (error) throw error;

  return data || [];
}
