import { supabase } from './supabase';

async function utenteCorrente() {
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

function inviaPushGiocoSenzaBloccare(tipo, id) {
  if (!id) return;

  supabase.functions
    .invoke('send-push', {
      body: { tipo, id },
    })
    .then(({ error }) => {
      if (error) {
        console.log('Push gioco non inviata:', tipo, error.message);
      }
    })
    .catch((error) => {
      console.log('Push gioco non inviata:', tipo, error);
    });
}

export async function creaSfidaGioco(gioco, sfidatoId) {
  const user = await utenteCorrente();

  if (!['scopa', 'briscola'].includes(gioco)) {
    throw new Error('Gioco non valido.');
  }

  if (!sfidatoId || String(sfidatoId) === String(user.id)) {
    throw new Error('Avversario non valido.');
  }

  const { data, error } = await supabase.rpc('crea_sfida_gioco', {
    p_gioco: gioco,
    p_sfidato_id: sfidatoId,
  });

  if (error) throw error;

  inviaPushGiocoSenzaBloccare('sfida_gioco', data?.id);
  return data;
}

export async function rispondiSfidaGioco(partitaId, accetta) {
  const { data, error } = await supabase.rpc('rispondi_sfida_gioco', {
    p_partita_id: partitaId,
    p_accetta: !!accetta,
  });

  if (error) throw error;
  return data;
}

export async function annullaSfidaGioco(partitaId) {
  const { data, error } = await supabase.rpc('annulla_sfida_gioco', {
    p_partita_id: partitaId,
  });

  if (error) throw error;
  return data;
}

export async function caricaPartiteGioco() {
  const user = await utenteCorrente();

  const { data, error } = await supabase
    .from('partite_gioco')
    .select('*')
    .or(`sfidante_id.eq.${user.id},sfidato_id.eq.${user.id}`)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function caricaPartitaGioco(partitaId) {
  await utenteCorrente();

  const { data, error } = await supabase
    .from('partite_gioco')
    .select('*')
    .eq('id', partitaId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function salvaStatoPartitaGioco({
  partitaId,
  versione,
  statoPartita,
  prossimoTurnoUserId,
  finita = false,
  vincitoreId = null,
}) {
  const { data, error } = await supabase.rpc('salva_stato_partita_gioco', {
    p_partita_id: partitaId,
    p_versione_attesa: Number(versione || 0),
    p_stato_partita: statoPartita || {},
    p_prossimo_turno_user_id: prossimoTurnoUserId || null,
    p_finita: !!finita,
    p_vincitore_id: vincitoreId || null,
  });

  if (error) throw error;

  if (!finita) {
    inviaPushGiocoSenzaBloccare('turno_gioco', data?.id);
  }

  return data;
}

export async function mioUserIdGioco() {
  const user = await utenteCorrente();
  return user.id;
}

export function sottoscriviPartitaGioco(partitaId, onAggiornamento, onErrore) {
  if (!partitaId) {
    throw new Error('Partita non valida.');
  }

  const canale = supabase
    .channel(`partita-gioco-${partitaId}-${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'partite_gioco',
        filter: `id=eq.${partitaId}`,
      },
      (payload) => {
        onAggiornamento?.(payload.new);
      }
    )
    .subscribe((stato, errore) => {
      if (stato === 'CHANNEL_ERROR' || stato === 'TIMED_OUT') {
        onErrore?.(errore || new Error(`Realtime non disponibile: ${stato}`));
      }
    });

  return () => {
    supabase.removeChannel(canale);
  };
}
