"""PostgreSQL 17.6 isolato, soli dati sintetici. Nessun URL/credenziale Supabase."""
import json
import os
from pathlib import Path
import subprocess
import time
import uuid
import hashlib

ROOT = Path(__file__).resolve().parents[1]
DOCKER = ['docker', '--host=unix:///var/run/docker.sock']
ENV = os.environ.copy()
for key in ('DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH'):
    ENV.pop(key, None)
NAME = 'vigilanza-push-sql-' + str(os.getpid())
count = 0
U1 = '00000000-0000-4000-8000-000000000001'
U2 = '00000000-0000-4000-8000-000000000002'
U3 = '00000000-0000-4000-8000-000000000003'
S2 = '00000000-0000-4000-8000-000000000012'
S2B = '00000000-0000-4000-8000-000000000013'
S3 = '00000000-0000-4000-8000-000000000014'
INSTALL = '00000000-0000-4000-8000-000000000022'
SECRET = 'a' * 64  # Credenziale esclusivamente sintetica.
MIGRATIONS = ['202610110001_push_foundation.sql', '202610120001_push_session_binding.sql', '202610120002_push_runtime.sql']


def json_rpc(body):
    clean=dict(body)
    if isinstance(clean.get('credenziale'),str):
        clean['credenziale_hash']=hashlib.sha256(clean.pop('credenziale').encode()).hexdigest()
    return json.dumps(clean)


def sql(text, database='postgres', failure=False):
    result = subprocess.run(DOCKER + ['exec', '-i', NAME, 'psql', '-U', 'postgres', '-d', database, '-At', '-v', 'ON_ERROR_STOP=1'],
                            input=text, text=True, capture_output=True, env=ENV)
    if failure:
        if result.returncode == 0:
            raise AssertionError('SQL doveva fallire')
        return result.stderr
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


def check(value, label):
    global count
    if not value:
        raise AssertionError(label)
    count += 1
    print('PASS:', label)


def rpc(user, session, body):
    body=dict(body)
    if body.get('azione') in ('registra','rinnova'):
        body['operation_id']=str(uuid.uuid4())
        prepare=dict(azione='prepara_operazione',operation_id=body['operation_id'],installation_id=body['installation_id'],credenziale=body['credenziale'])
        sql(f"SELECT public.push_gestisci_dispositivo('{user}','{session}','{json_rpc(prepare)}');")
    return json.loads(sql(f"SELECT public.push_gestisci_dispositivo('{user}','{session}','{json_rpc(body)}'::jsonb);"))


def claim():
    value = sql('SELECT public.push_worker_claim();')
    return json.loads(value) if value else None


def authorize(job):
    value = sql(f"SELECT public.push_worker_authorize('{job['id']}','{job['claim_id']}');")
    return json.loads(value) if value else None


def finish(job, outcome):
    sql(f"SELECT public.push_worker_finish('{job['id']}','{job['claim_id']}','{json_rpc(outcome)}'::jsonb);")


def state(job):
    return sql(f"SELECT stato FROM public.push_delivery_jobs WHERE id='{job['id']}';")


def message(num):
    sql(f"INSERT INTO public.messaggi VALUES({9007199254740992+num},'{U1}','{U2}',now(),NULL);")


def budget_reset():
    sql('DELETE FROM public.push_rate_budget;')


SCHEMA = '''CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users(id),not_after timestamptz);
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT coalesce(nullif(current_setting('test.claims',true),''),'{}')::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
CREATE TABLE public.messaggi(id bigint PRIMARY KEY,mittente_id uuid,destinatario_id uuid,created_at timestamptz,letto_at timestamptz);
CREATE TABLE public.consegne_servizio(id bigint PRIMARY KEY,mittente_id uuid,destinatario_id uuid,created_at timestamptz,letta boolean);
CREATE TABLE public.colleghi(user_id uuid,collega_id uuid,stato text);
CREATE TABLE public.utenti_bloccati(bloccante_id uuid,bloccato_id uuid);
'''

try:
    subprocess.run(DOCKER + ['info', '--format', '{{.ServerVersion}}'], env=ENV, check=True, capture_output=True)
    # --pull=never: nessun download implicito, --network=none: nessun accesso esterno.
    subprocess.run(DOCKER + ['run', '--pull=never', '-d', '--name', NAME, '--network', 'none', '-e', 'POSTGRES_PASSWORD=synthetic-local-only', 'postgres:17.6'],
                   env=ENV, check=True, capture_output=True)
    for attempt in range(100):
        result = subprocess.run(DOCKER + ['exec', NAME, 'pg_isready', '-U', 'postgres'], env=ENV, capture_output=True)
        pid = subprocess.run(DOCKER + ['exec', NAME, 'cat', '/proc/1/comm'], env=ENV, capture_output=True, text=True)
        if result.returncode == 0 and pid.stdout.strip() == 'postgres':
            break
        time.sleep(0.2)
    else:
        raise RuntimeError('PostgreSQL non pronto')
    check(sql('SHOW server_version;').startswith('17.6'), 'PostgreSQL 17.6')
    sql('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;')
    sql('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;')
    sql(SCHEMA)
    for name in MIGRATIONS:
        sql((ROOT / 'supabase/migrations' / name).read_text())
        check(True, 'migrazione ' + name)
    check(sql('SELECT send_enabled OR auth_session_check_approved FROM public.push_configurazione;') == 'f', 'invio e approvazione inizialmente false')
    check(claim() is None, 'worker disabilitato non crea job')
    check('permission denied' in sql('SET ROLE authenticated; SELECT * FROM public.push_delivery_jobs;', failure=True), 'RLS/ACL client senza accesso outbox')
    check('permission denied' in sql('SET ROLE anon; SELECT public.push_worker_claim();', failure=True), 'client non puo invocare worker')
    check('permission denied' in sql('SET ROLE service_role; UPDATE public.push_configurazione SET send_enabled=true;', failure=True), 'runtime non attiva configurazione')
    check(sql("SELECT bool_and(relrowsecurity) FROM pg_class WHERE relname IN('push_delivery_jobs','push_rate_budget');") == 't', 'RLS nuove tabelle')
    sql(f"INSERT INTO auth.users VALUES('{U1}'),('{U2}'),('{U3}'); INSERT INTO auth.sessions VALUES('{S2}','{U2}',NULL),('{S2B}','{U2}',NULL),('{S3}','{U3}',NULL);")
    body = dict(azione='registra', installation_id=INSTALL, credenziale=SECRET, expected_binding_version='0', expo_token='ExpoPushToken[synthetic]', piattaforma='ios', chat=True, consegne=True,token_rotation=False)
    error = sql(f"SELECT public.push_gestisci_dispositivo('{U2}','{S2}','{json_rpc(body)}');", failure=True)
    check('sessione_non_verificata' in error, 'approvazione Auth obbligatoria')
    sql("UPDATE public.push_configurazione SET auth_session_check_approved=true,binding_ttl_seconds=1200,receipt_delay_seconds=1,consegne_ttl_seconds=3600,acquisition_cutoff=now()-interval '1 hour',project_id='3f83a3a9-df1a-4dcc-beaf-8c390f52eca2',ambiente='development';")
    binding = rpc(U2, S2, body)
    check(binding['binding_version'] == '1', 'registrazione autenticata')
    body['expected_binding_version'] = '1'
    check(rpc(U2, S2, body)['binding_version'] == '1', 'rinnovo invariato non cambia versione')
    renew = dict(body, azione='rinnova', chat=False, consegne=False)
    rpc(U2, S2, renew)
    check(rpc(U2, S2, {'azione': 'preferenze'}) == {'chat': True, 'consegne': True}, 'rinnovo non sovrascrive preferenze')
    stale = dict(body, expected_binding_version='0',operation_id=str(uuid.uuid4()))
    sql(f"SELECT public.push_gestisci_dispositivo('{U2}','{S2}','{json_rpc(dict(azione='prepara_operazione',installation_id=INSTALL,credenziale=SECRET,operation_id=stale['operation_id']))}');")
    check('versione_obsoleta' in sql(f"SELECT public.push_gestisci_dispositivo('{U2}','{S2}','{json_rpc(stale)}');", failure=True), 'replay versione obsoleta rifiutato')
    offline = dict(azione='revoca_offline', id=binding['id'], binding_version='1', credenziale=SECRET)
    value = json.loads(sql(f"SELECT public.push_gestisci_dispositivo(NULL,NULL,'{json_rpc(offline)}');"))
    check(value['revocata'] is True, 'revoca offline senza JWT solo negativa')
    check(sql(f"SELECT attivo FROM public.push_dispositivi WHERE id='{binding['id']}';") == 'f', 'dispositivo disattivato')
    sql(f"SELECT public.push_gestisci_dispositivo(NULL,NULL,'{json_rpc(offline)}');")
    check(sql(f"SELECT binding_version FROM public.push_dispositivi WHERE id='{binding['id']}';") == '2', 'revoca ripetuta idempotente')
    body['expected_binding_version'] = '2'
    binding = rpc(U2, S2B, body)
    check(binding['binding_version'] == '3', 'nuova sessione incrementa versione')
    sql(f"SELECT public.push_gestisci_dispositivo(NULL,NULL,'{json_rpc(offline)}');")
    check(sql(f"SELECT attivo FROM public.push_dispositivi WHERE id='{binding['id']}';") == 't', 'revoca vecchia non colpisce nuovo binding')
    collision = dict(body, installation_id='00000000-0000-4000-8000-000000000023', expected_binding_version='0',operation_id=str(uuid.uuid4()))
    sql(f"SELECT public.push_gestisci_dispositivo('{U3}','{S3}','{json_rpc(dict(azione='prepara_operazione',installation_id=collision['installation_id'],credenziale=SECRET,operation_id=collision['operation_id']))}');")
    check('collisione' in sql(f"SELECT public.push_gestisci_dispositivo('{U3}','{S3}','{json_rpc(collision)}');", failure=True), 'token non appropriabile da altra installazione')
    sql(f"INSERT INTO public.colleghi VALUES('{U1}','{U2}','accettato');")
    message(1)
    check(claim() is None, 'send_enabled false blocca acquisizione')
    sql("UPDATE public.push_configurazione SET send_enabled=true,modalita='test';")
    check(claim() is None, 'modalita test richiede allowlist dispositivo/versione')
    sql(f"INSERT INTO public.push_dispositivi_test VALUES('{binding['id']}',3,now(),now()+interval '1 hour');")
    j = claim()
    check(j is not None and j['mode'] == 'send', 'claim atomico')
    check(authorize(j) is not None, 'autorizzazione fresca')
    check(sql('SELECT sorgente_id FROM public.push_comunicazioni ORDER BY created_at LIMIT 1;') == '9007199254740993', 'bigint oltre MAX_SAFE_INTEGER preservato')
    sql('UPDATE public.messaggi SET letto_at=now();')
    check(authorize(j) is None, 'lettura dopo claim blocca invio')
    finish(j, {'kind': 'cancelled'})
    check(state(j) == 'cancelled', 'annullamento coerente')
    check(claim() is None, 'deduplicazione evento/dispositivo')
    message(2)
    sql('UPDATE public.push_configurazione SET max_per_destinatario_minuto=1;')
    check(claim() is None, 'rate limit destinatario persistente')
    budget_reset()
    sql("UPDATE public.push_delivery_jobs SET next_at=now() WHERE stato IN('pending','retry');")
    j = claim()
    finish(j, {'kind': 'ticket', 'ticket': 'synthetic-ticket-2'})
    check(state(j) == 'submitted', 'ticket accettato non e delivered')
    sql(f"UPDATE public.push_delivery_jobs SET next_at=now() WHERE id='{j['id']}';")
    receipt = claim()
    check(receipt['mode'] == 'receipt', 'ricevuta distinta da invio')
    finish(receipt, {'kind': 'receipt_pending'})
    check(state(j) == 'submitted', 'ricevuta mancante resta pendente')
    sql(f"UPDATE public.push_delivery_jobs SET next_at=now() WHERE id='{j['id']}';")
    receipt = claim()
    finish(receipt, {'kind': 'receipt_ok'})
    check(state(j) == 'receipt_ok', 'ricevuta positiva completa')
    check('check constraint' in sql(f"UPDATE public.push_delivery_jobs SET receipt_status=NULL,receipt_checked_at=NULL WHERE id='{j['id']}';", failure=True), 'ricevuta incompleta non positiva')
    message(3)
    budget_reset()
    sql('UPDATE public.push_configurazione SET max_attempts=2;')
    j = claim()
    finish(j, {'kind': 'retry'})
    check(state(j) == 'retry', 'retry errore definitivamente non accettato')
    sql(f"UPDATE public.push_delivery_jobs SET next_at=now() WHERE id='{j['id']}';")
    budget_reset()
    retry = claim()
    finish(retry, {'kind': 'retry'})
    check(state(j) == 'failed', 'numero tentativi limitato')
    message(4)
    budget_reset()
    j = claim()
    body['expected_binding_version'] = '3'
    body['expo_token'] = 'ExpoPushToken[newsynthetic]'
    binding = rpc(U2, S2B, body)
    check(authorize(j) is None, 'versione cambiata dopo claim impedisce invio')
    finish(j, {'kind': 'invalid_token'})
    check(sql(f"SELECT attivo FROM public.push_dispositivi WHERE id='{binding['id']}';") == 't', 'errore token vecchio non disattiva nuova versione')
    sql(f"UPDATE public.push_dispositivi_test SET binding_version=4 WHERE dispositivo_id='{binding['id']}';")
    message(5)
    budget_reset()
    j = claim()
    sql(f"DELETE FROM auth.sessions WHERE id='{S2B}';")
    check(authorize(j) is None, 'sessione revocata dopo claim rifiutata')
    finish(j, {'kind': 'cancelled'})
    sql(f"INSERT INTO auth.sessions VALUES('{S2B}','{U2}',NULL);")
    message(6)
    budget_reset()
    j = claim()
    sql(f"UPDATE public.push_delivery_jobs SET lease_until=now()-interval '1 second' WHERE id='{j['id']}';")
    claim()
    check(state(j) == 'uncertain', 'lease invio scaduta non provoca reinvio')
    # Concorrenza: due worker non ottengono lo stesso evento.
    message(7)
    budget_reset()
    workers = [subprocess.Popen(DOCKER + ['exec','-i',NAME,'psql','-U','postgres','-At','-v','ON_ERROR_STOP=1'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=ENV) for _ in range(2)]
    for process in workers:
        process.stdin.write('SELECT public.push_worker_claim();\n')
        process.stdin.close()
    outputs = []
    for process in workers:
        output=process.stdout.read().strip();error=process.stderr.read();process.wait()
        if process.returncode:raise RuntimeError(error)
        if output:outputs.append(json.loads(output))
    check(len(outputs)==1, 'due worker concorrenti: un solo claim')
    j=outputs[0]
    sql(f"INSERT INTO public.utenti_bloccati VALUES('{U2}','{U1}');")
    check(authorize(j) is None,'blocco inverso dopo claim impedisce invio')
    sql('DELETE FROM public.utenti_bloccati;')
    sql(f"INSERT INTO public.utenti_bloccati VALUES('{U1}','{U2}');")
    check(authorize(j) is None,'blocco diretto dopo claim impedisce invio')
    sql('DELETE FROM public.utenti_bloccati;')
    finish(j,{'kind':'cancelled'})
    # UUID consegne e FK composta destinatario/evento.
    sql('ALTER TABLE public.consegne_servizio ALTER COLUMN id TYPE uuid USING md5(id::text)::uuid;')
    cid='00000000-0000-4000-8000-000000000088'
    sql(f"INSERT INTO public.consegne_servizio VALUES('{cid}','{U1}','{U2}',now(),false);")
    budget_reset()
    j=claim()
    check(authorize(j)['tipo']=='consegna_servizio','consegna UUID supportata senza conversione number')
    event=sql(f"SELECT evento_id FROM public.push_delivery_jobs WHERE id='{j['id']}';")
    other=rpc(U3,S3,dict(body,installation_id='00000000-0000-4000-8000-000000000024',expected_binding_version='0',expo_token='ExpoPushToken[other-synthetic]'))
    check('foreign key constraint' in sql(f"INSERT INTO public.push_delivery_jobs(evento_id,destinatario_id,dispositivo_id,binding_version) VALUES('{event}','{U3}','{other['id']}',1);",failure=True),'FK composta rifiuta destinatario incoerente')
    finish(j,{'kind':'cancelled'})
    # Intenzione revocata impedisce registrazione tardiva.
    budget_reset()
    opid=str(uuid.uuid4())
    prep=dict(azione='prepara_operazione',operation_id=opid,installation_id=INSTALL,credenziale=SECRET)
    rpc(U2,S2B,prep)
    revoke_intent=dict(azione='revoca_intenzione',operation_id=opid,installation_id=INSTALL,credenziale=SECRET)
    sql(f"SELECT public.push_gestisci_dispositivo(NULL,NULL,'{json_rpc(revoke_intent)}');")
    late=dict(body,operation_id=opid,expected_binding_version='4')
    check('operazione_non_valida' in sql(f"SELECT public.push_gestisci_dispositivo('{U2}','{S2B}','{json_rpc(late)}');",failure=True),'revoca intenzione blocca richiesta tardiva')
    # Risposta persa: replay identico restituisce metadata, senza ulteriori versioni.
    opid=str(uuid.uuid4());prep['operation_id']=opid;rpc(U2,S2B,prep)
    identical=dict(body,operation_id=opid,expected_binding_version='4')
    query=f"SELECT public.push_gestisci_dispositivo('{U2}','{S2B}','{json_rpc(identical)}');"
    first=json.loads(sql(query));second=json.loads(sql(query))
    check(first==second,'registrazione idempotente dopo risposta persa')
    changed=dict(identical,chat=False)
    check('operazione_obsoleta' in sql(f"SELECT public.push_gestisci_dispositivo('{U2}','{S2B}','{json_rpc(changed)}');",failure=True),'nonce riutilizzato con payload diverso rifiutato')
    revoke_intent['operation_id']=opid
    sql(f"SELECT public.push_gestisci_dispositivo(NULL,NULL,'{json_rpc(revoke_intent)}');")
    check(sql(f"SELECT attivo FROM public.push_dispositivi WHERE id='{binding['id']}';")=='f','risposta persa: revoca intenzione disattiva associazione')
    bad=dict(azione='revoca_offline',credenziale=SECRET,binding_version='1')
    check('input_non_valido' in sql(f"SELECT public.push_gestisci_dispositivo(NULL,NULL,'{json_rpc(bad)}');",failure=True),'id mancante non dichiarato revocato')
    # Limite preparazioni autenticato e persistente.
    sql('UPDATE public.push_configurazione SET max_per_mittente_minuto=1;')
    budget_reset();prep['operation_id']=str(uuid.uuid4());rpc(U2,S2B,prep)
    prep['operation_id']=str(uuid.uuid4())
    check('rate_limit' in sql(f"SELECT public.push_gestisci_dispositivo('{U2}','{S2B}','{json_rpc(prep)}');",failure=True),'rate limit preparazioni impedisce crescita illimitata')
    # Fallimento della migrazione: intera transazione annullata, nessuno schema parziale.
    sql('CREATE DATABASE rollbackcheck;')
    sql(SCHEMA, 'rollbackcheck')
    for name in MIGRATIONS[:2]:
        sql((ROOT / 'supabase/migrations' / name).read_text(), 'rollbackcheck')
    candidate = (ROOT / 'supabase/migrations' / MIGRATIONS[2]).read_text().replace('COMMIT;', 'SELECT 1/0; COMMIT;')
    sql(candidate, 'rollbackcheck', failure=True)
    check(sql("SELECT to_regclass('public.push_delivery_jobs') IS NULL;", 'rollbackcheck') == 't', 'errore migrazione rollback outbox')
    check(sql("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='push_configurazione' AND column_name='auth_session_check_approved';", 'rollbackcheck') == '0', 'errore migrazione rollback colonne')
    print('CONTROLLI SQL SUPERATI:', count)
finally:
    result = subprocess.run(DOCKER + ['rm', '-f', '-v', NAME], env=ENV, capture_output=True)
    print('Container e volumi test rimossi:', result.returncode == 0)
