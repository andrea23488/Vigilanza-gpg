import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

type TipoPush = 'messaggio' | 'consegna'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: 'Configurazione server mancante' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Utente non autenticato' }, 401)
    }

    const token = authHeader.slice('Bearer '.length)
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(token)

    if (userError || !user) {
      return json({ error: 'Sessione non valida' }, 401)
    }

    const input = await req.json().catch(() => null) as
      | { tipo?: TipoPush; id?: string | number }
      | null

    if (!input || !['messaggio', 'consegna'].includes(String(input.tipo))) {
      return json({ error: 'Tipo push non valido' }, 400)
    }

    if (input.id === undefined || input.id === null || String(input.id).trim() === '') {
      return json({ error: 'ID mancante' }, 400)
    }

    let destinatarioId = ''
    let data: Record<string, string> = {}
    let titolo = ''
    let corpo = ''

    const { data: profilo } = await admin
      .from('profili')
      .select('nome, cognome')
      .eq('user_id', user.id)
      .maybeSingle()

    const nomeMittente =
      [profilo?.nome, profilo?.cognome].filter(Boolean).join(' ') || 'Un collega'

    if (input.tipo === 'messaggio') {
      const { data: record, error } = await admin
        .from('messaggi')
        .select('id, mittente_id, destinatario_id')
        .eq('id', input.id)
        .maybeSingle()

      if (error || !record) {
        return json({ error: 'Messaggio non trovato' }, 404)
      }

      if (String(record.mittente_id) !== String(user.id)) {
        return json({ error: 'Operazione non autorizzata' }, 403)
      }

      destinatarioId = String(record.destinatario_id)
      titolo = 'Nuovo messaggio'
      corpo = `Hai ricevuto un nuovo messaggio da ${nomeMittente}`
      data = {
        tipo: 'chat',
        mittenteId: String(user.id),
        messaggioId: String(record.id),
        nomeMittente,
      }
    } else {
      const { data: record, error } = await admin
        .from('consegne_servizio')
        .select('id, mittente_id, destinatario_id')
        .eq('id', input.id)
        .maybeSingle()

      if (error || !record) {
        return json({ error: 'Consegna non trovata' }, 404)
      }

      if (String(record.mittente_id) !== String(user.id)) {
        return json({ error: 'Operazione non autorizzata' }, 403)
      }

      destinatarioId = String(record.destinatario_id)
      titolo = 'Consegna di servizio'
      corpo = `Hai ricevuto una nuova consegna da ${nomeMittente}`
      data = {
        tipo: 'consegna',
        mittenteId: String(user.id),
        consegnaId: String(record.id),
        nomeMittente,
      }
    }

    if (!destinatarioId || destinatarioId === user.id) {
      return json({ success: true, inviate: 0 })
    }

    const { data: dispositivi, error: tokenError } = await admin
      .from('push_tokens')
      .select('id, expo_token')
      .eq('user_id', destinatarioId)
      .eq('attivo', true)

    if (tokenError) {
      throw tokenError
    }

    if (!dispositivi?.length) {
      return json({ success: true, inviate: 0 })
    }

    const messaggi = dispositivi.map((d) => ({
      to: d.expo_token,
      sound: 'default',
      title: titolo,
      body: corpo,
      data,
      priority: 'high',
    }))

    const expoHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    }

    const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN')
    if (expoAccessToken) {
      expoHeaders.Authorization = `Bearer ${expoAccessToken}`
    }

    const expoResponse = await fetch(
      'https://exp.host/--/api/v2/push/send',
      {
        method: 'POST',
        headers: expoHeaders,
        body: JSON.stringify(messaggi),
      }
    )

    const expoBody = await expoResponse.json().catch(() => null)

    if (!expoResponse.ok) {
      console.error('Expo push error:', expoBody)
      return json({ error: 'Invio push non riuscito' }, 502)
    }

    const tickets = Array.isArray(expoBody?.data)
      ? expoBody.data
      : []

    for (let i = 0; i < tickets.length; i += 1) {
      const ticket = tickets[i]
      if (
        ticket?.status === 'error' &&
        ticket?.details?.error === 'DeviceNotRegistered' &&
        dispositivi[i]?.id
      ) {
        await admin
          .from('push_tokens')
          .update({ attivo: false, updated_at: new Date().toISOString() })
          .eq('id', dispositivi[i].id)
      }
    }

    const inviate = tickets.filter((t: any) => t?.status === 'ok').length

    return json({
      success: true,
      inviate,
      richieste: messaggi.length,
    })
  } catch (error) {
    console.error('SEND PUSH ERROR:', error)
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Errore sconosciuto',
      },
      500
    )
  }
})
