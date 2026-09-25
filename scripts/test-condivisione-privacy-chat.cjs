const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function caricaModulo(percorso, nomi, dipendenze = {}) {
  let sorgente = fs.readFileSync(percorso, 'utf8')
    .replace(/^import .*?;\n/gms, '')
    .replaceAll('export async function ', 'async function ')
    .replaceAll('export function ', 'function ')
    .replaceAll('export const ', 'const ');
  sorgente += `\nmodule.exports = { ${nomi.join(', ')} };`;
  const sandbox = {
    module: { exports: {} }, exports: {}, console, Set, Map, Date,
    ...dipendenze,
  };
  vm.runInNewContext(sorgente, sandbox, { filename: percorso });
  return sandbox.module.exports;
}

function caricaUnioneMessaggi() {
  const sorgenteApp = fs.readFileSync('App.js', 'utf8');
  const inizio = sorgenteApp.indexOf('const unisciMessaggiChat =');
  const fine = sorgenteApp.indexOf('\n\nconst COLORS', inizio);
  assert.ok(inizio >= 0 && fine > inizio, 'Helper chat non individuato in App.js');

  const sandbox = { module: { exports: {} }, Map };
  vm.runInNewContext(
    `${sorgenteApp.slice(inizio, fine)}\nmodule.exports = unisciMessaggiChat;`,
    sandbox,
    { filename: 'App.js#unisciMessaggiChat' }
  );
  return sandbox.module.exports;
}

async function main() {
  const condivisione = caricaModulo('turniCondivisiApi.js', [
    'POSTAZIONE_NON_INDICATA',
    'valoreOperativitaStorica',
    'postazioneTurnoCondiviso',
  ]);

  // La sede esplicita vince sempre sul vecchio campo operatività.
  assert.equal(condivisione.postazioneTurnoCondiviso({
    indirizzo_servizio: 'ITA Airways – Fiumicino',
    luogo: 'Piantonamento',
  }), 'ITA Airways – Fiumicino');
  assert.equal(condivisione.postazioneTurnoCondiviso({
    indirizzo_servizio: 'Roma EUR', luogo: 'Ronda notturna',
  }), 'Roma EUR');

  // Un luogo storico plausibile resta compatibile; l'operatività no.
  assert.equal(condivisione.postazioneTurnoCondiviso({
    luogo: 'Aeroporto di Fiumicino',
  }), 'Aeroporto di Fiumicino');
  for (const operativita of [
    'Ronda', 'ronda notturna', 'Piantonamento',
    'piantonamento diurno', 'Servizio', 'Turno',
  ]) {
    assert.equal(condivisione.postazioneTurnoCondiviso({ luogo: operativita }),
      condivisione.POSTAZIONE_NON_INDICATA);
  }
  assert.equal(condivisione.postazioneTurnoCondiviso({}),
    'Postazione non indicata');

  const servizio = caricaModulo('servizioApi.js', [
    'CAMPI_COLLEGHI_IN_SERVIZIO', 'minimizzaRigaCollegaInServizio',
  ]);
  assert.equal(servizio.CAMPI_COLLEGHI_IN_SERVIZIO,
    'user_id, collega_id, giorno, mese, anno, inizio_utente, fine_utente, inizio_collega, fine_collega');
  const minimizzata = servizio.minimizzaRigaCollegaInServizio({
    user_id: 'u1', collega_id: 'u2', giorno: 25, mese: 9, anno: 2026,
    inizio_utente: '06:00', fine_utente: '14:00',
    inizio_collega: '07:00', fine_collega: '15:00',
    email: 'non-deve-uscire@example.test', campo_futuro: 'segreto',
  });
  assert.deepEqual(Object.keys(minimizzata), [
    'user_id', 'collega_id', 'giorno', 'mese', 'anno',
    'inizio_utente', 'fine_utente', 'inizio_collega', 'fine_collega',
  ]);
  assert.equal('email' in minimizzata, false);
  assert.equal('campo_futuro' in minimizzata, false);
  assert.doesNotMatch(fs.readFileSync('servizioApi.js', 'utf8'), /\.select\(['"]\*['"]\)/);

  // Deduplicazione per ID e ordinamento cronologico, inclusa la coppia
  // messaggio ottimistico + INSERT realtime dello stesso record.
  const unisciMessaggiChat = caricaUnioneMessaggi();
  const ottimistico = {
    id: 'm2', mittente_id: 'u1', destinatario_id: 'u2',
    testo: 'Secondo', created_at: '2026-09-25T10:02:00.000Z',
  };
  const uniti = unisciMessaggiChat(
    [ottimistico],
    [{ id: 'm1', created_at: '2026-09-25T10:01:00.000Z', testo: 'Primo' }],
    [{ ...ottimistico }]
  );
  assert.deepEqual(Array.from(uniti, (messaggio) => messaggio.id), ['m1', 'm2']);

  // Subscription: filtro server sul destinatario, controllo dei due
  // interlocutori, una sola callback e cleanup del canale.
  let configurazione = null;
  let gestoreInsert = null;
  let canaleRimosso = null;
  let numeroOn = 0;
  const canale = {
    on(_tipo, config, handler) {
      numeroOn += 1;
      configurazione = config;
      gestoreInsert = handler;
      return this;
    },
    subscribe(callback) {
      callback('SUBSCRIBED');
      return this;
    },
  };
  const supabase = {
    channel: () => canale,
    removeChannel: (ricevuto) => { canaleRimosso = ricevuto; },
  };
  const chat = caricaModulo('chatApi.js', ['sottoscriviMessaggiConversazione'], {
    supabase,
  });
  const ricevuti = [];
  const cleanup = chat.sottoscriviMessaggiConversazione({
    userId: 'u2', collegaId: 'u1',
    onMessaggio: (messaggio) => ricevuti.push(messaggio),
  });
  assert.equal(numeroOn, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(configurazione)), {
    event: 'INSERT', schema: 'public', table: 'messaggi',
    filter: 'destinatario_id=eq.u2',
  });
  gestoreInsert({ payload: 'ignorato' });
  gestoreInsert({ new: { id: 'x', mittente_id: 'u3', destinatario_id: 'u2' } });
  gestoreInsert({ new: { id: 'y', mittente_id: 'u1', destinatario_id: 'u3' } });
  gestoreInsert({ new: { id: 'm3', mittente_id: 'u1', destinatario_id: 'u2' } });
  assert.deepEqual(Array.from(ricevuti, (messaggio) => messaggio.id), ['m3']);
  cleanup();
  assert.equal(canaleRimosso, canale);

  const appSource = fs.readFileSync('App.js', 'utf8');
  assert.match(appSource, /rimuoviRealtime\?\.\(\)/);
  assert.match(appSource, /\[screen, collegaSelezionato\?\.altro_user_id\]/);

  console.log('Test condivisione, privacy e audit chat superati.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
