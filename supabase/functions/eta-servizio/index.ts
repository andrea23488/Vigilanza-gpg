const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { partenza, destinazione } = await req.json();

    if (!partenza || !destinazione) {
      return new Response(
        JSON.stringify({
          error: 'Partenza e destinazione sono obbligatorie',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const googleKey = Deno.env.get('GOOGLE_ROUTES_API_KEY');

    if (!googleKey) {
      throw new Error('GOOGLE_ROUTES_API_KEY non configurata');
    }

    const response = await fetch(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googleKey,
          'X-Goog-FieldMask':
            'routes.duration,routes.staticDuration,routes.distanceMeters',
        },
        body: JSON.stringify({
          origin: {
            address: String(partenza).trim(),
          },
          destination: {
            address: String(destinazione).trim(),
          },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
          computeAlternativeRoutes: false,
          languageCode: 'it-IT',
          units: 'METRIC',
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('GOOGLE ROUTES ERROR:', data);

      return new Response(
        JSON.stringify({
          error: 'Errore nel calcolo del percorso',
          details: data,
        }),
        {
          status: response.status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const route = data?.routes?.[0];

    if (!route) {
      return new Response(
        JSON.stringify({
          error: 'Nessun percorso trovato',
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const secondi = Math.round(
      Number(String(route.duration || '0s').replace('s', ''))
    );

    const secondiSenzaTraffico = Math.round(
      Number(String(route.staticDuration || '0s').replace('s', ''))
    );

    const minuti = Math.max(1, Math.round(secondi / 60));
    const minutiSenzaTraffico = Math.max(
      1,
      Math.round(secondiSenzaTraffico / 60)
    );

    const km = Number(
      ((route.distanceMeters || 0) / 1000).toFixed(1)
    );

    const ritardoTraffico = Math.max(
      0,
      minuti - minutiSenzaTraffico
    );

    return new Response(
      JSON.stringify({
        minuti,
        minuti_senza_traffico: minutiSenzaTraffico,
        ritardo_traffico: ritardoTraffico,
        km,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('ETA SERVIZIO ERROR:', error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Errore sconosciuto',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
