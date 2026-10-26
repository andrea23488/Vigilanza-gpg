const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const up = fs.readFileSync(path.join(root, 'supabase/migrations/202610260001_giochi_server_protetti_v2.sql'), 'utf8');
const down = fs.readFileSync(path.join(root, 'supabase/rollback/202610260001_giochi_server_protetti_v2.down.sql'), 'utf8');
const sqlTest = fs.readFileSync(path.join(root, 'supabase/tests/multiplayer_server_protected_v2.sql'), 'utf8');
const fixture = fs.readFileSync(path.join(root, 'supabase/tests/multiplayer_server_protected_v2_fixture.sql'), 'utf8');

test('migration isolates private state, presence, operation ledger and outbox behind RLS', () => {
  for (const table of [
    'partite_gioco_stati_privati_v2',
    'partite_gioco_presenze_v2',
    'partite_gioco_operazioni_v2',
    'partite_gioco_push_outbox_v2',
    'partite_gioco_push_consegne_v2',
  ]) {
    assert.match(up, new RegExp(`CREATE TABLE public\\.${table}\\b`));
    assert.match(up, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
  }
  assert.match(up, /UNIQUE \(tipo, partita_id, versione, destinatario_id\)/);
  assert.match(up, /UNIQUE \(evento_id, dispositivo_id\)/);
});

test('migration includes authenticated gates, safe player projection and legacy cutover', () => {
  for (const fn of [
    'leggi_partita_gioco_v2', 'elenco_partite_gioco_v2',
    'heartbeat_partita_gioco_v2', 'rilascia_presenza_partita_gioco_v2',
    'valida_mossa_partita_gioco_v2', 'risultato_partita_gioco_v2',
    'crea_sfida_gioco_v2', 'rispondi_sfida_gioco_v2', 'annulla_sfida_gioco_v2',
    'accoda_push_gioco_v2',
  ]) assert.ok(up.includes(`FUNCTION public.${fn}`), `missing ${fn}`);
  assert.match(up, /REVOKE SELECT ON TABLE public\.partite_gioco FROM authenticated/);
  assert.match(up, /REVOKE EXECUTE ON FUNCTION public\.salva_stato_partita_gioco/);
  assert.match(up, /'mani' - 'mazzo' - 'deck' - 'hands'/);
  assert.match(up, /lease_expires_at = clock_timestamp\(\)/);
  assert.match(up, /GREATEST\(old\.versione_ack, EXCLUDED\.versione_ack\)/);
  assert.match(up, /FOR UPDATE/);
});

test('rollback restores legacy privileges/state and refuses pending or uncertain push work', () => {
  assert.match(down, /stato_partita = s\.stato_completo/);
  assert.match(down, /GRANT SELECT ON TABLE public\.partite_gioco TO authenticated/);
  assert.match(down, /GRANT EXECUTE ON FUNCTION public\.salva_stato_partita_gioco/);
  assert.match(down, /stato IN \('pending', 'claimed', 'uncertain'\)/);
  assert.match(down, /DROP TABLE public\.partite_gioco_stati_privati_v2/);
});

test('SQL fixture and integration script use synthetic-only users and cover denials/duplicates', () => {
  assert.match(fixture, /example\.invalid/);
  assert.match(fixture, /synthetic-/);
  assert.match(sqlTest, /partite_gioco_stati_privati_v2/);
  assert.match(sqlTest, /event_a = event_b/);
  assert.match(sqlTest, /expect_error/);
  assert.match(sqlTest, /heartbeat_partita_gioco_v2/);
  assert.doesNotMatch(up, /https?:\/\/|EXPO_ACCESS_TOKEN|SUPABASE_SERVICE_ROLE_KEY/);
});
