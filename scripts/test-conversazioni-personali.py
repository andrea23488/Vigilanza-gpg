#!/usr/bin/env python3
"""PostgreSQL 17 usa-e-getta, senza rete/porte/volumi; nessun DB_URL remoto.

Richiede Docker locale. Esecuzione: python3 scripts/test-conversazioni-personali.py
"""
import concurrent.futures
import pathlib
import subprocess
import time
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
NAME = 'vigilanza-chat-test-' + uuid.uuid4().hex[:12]
DOCKER = ['docker', '--host=unix:///var/run/docker.sock']
A = '00000000-0000-0000-0000-000000000001'
B = '00000000-0000-0000-0000-000000000002'


def command(args, source=None, timeout=120):
    result = subprocess.run(args, input=source, text=True, capture_output=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError(result.stderr + result.stdout)
    return result.stdout.strip()


def sql(source):
    return command(DOCKER + ['exec', '-i', NAME, 'psql', '-X', '-qAt',
                            '-v', 'ON_ERROR_STOP=1', '-U', 'postgres'], source)


def actor(source):
    return f"SET ROLE authenticated; SET request.jwt.claim.sub='{A}';\n" + source


def sleeping_session(label):
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        if sql(f"SELECT count(*) FROM pg_stat_activity WHERE application_name='{label}' AND wait_event='PgSleep'") == '1':
            return
        time.sleep(0.05)
    raise AssertionError('Sessione concorrente non raggiunta: ' + label)


def concurrent_tests():
    c = sql(f"SELECT id FROM public.chat_conversazioni WHERE utente_a='{A}' AND utente_b='{B}'")
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        # Inserimento acquisisce prima il lock; Svuota vede anche quel messaggio.
        first = pool.submit(sql, actor(f"""
          SET application_name='chat_test_insert_first'; BEGIN;
          INSERT INTO public.messaggi(mittente_id,destinatario_id,testo) VALUES('{A}','{B}','prima');
          SELECT pg_sleep(2); COMMIT;
        """))
        sleeping_session('chat_test_insert_first')
        second = pool.submit(sql, actor(f"SELECT public.chat_personale_operazione('{c}','{uuid.uuid4()}','svuota',2)"))
        first.result()
        second.result()
        assert sql(f"SELECT nascosti_fino_a=3 FROM public.chat_stati_personali WHERE conversazione_id='{c}' AND user_id='{A}'") == 't'

        # Elimina acquisisce prima il lock; il messaggio successivo riattiva.
        first = pool.submit(sql, actor(f"""
          SET application_name='chat_test_delete_first'; BEGIN;
          SELECT public.chat_personale_operazione('{c}','{uuid.uuid4()}','elimina',3);
          SELECT pg_sleep(2); COMMIT;
        """))
        sleeping_session('chat_test_delete_first')
        second = pool.submit(sql, actor(f"INSERT INTO public.messaggi(mittente_id,destinatario_id,testo) VALUES('{A}','{B}','dopo')"))
        first.result()
        second.result()
        assert sql(f"SELECT stato='active' AND nascosti_fino_a=3 AND versione=5 FROM public.chat_stati_personali WHERE conversazione_id='{c}' AND user_id='{A}'") == 't'

        # Due richieste simultanee identiche producono un solo aggiornamento.
        op = str(uuid.uuid4())
        query = actor(f"SELECT public.chat_personale_operazione('{c}','{op}','svuota',5)")
        one, two = pool.submit(sql, query), pool.submit(sql, query)
        assert one.result() == two.result()
        assert sql(f"SELECT versione=6 FROM public.chat_stati_personali WHERE conversazione_id='{c}' AND user_id='{A}'") == 't'
        assert sql(f"SELECT count(*) FROM public.chat_operazioni_personali WHERE operazione_id='{op}'") == '1'

        # Due primi invii opposti sulla stessa coppia ancora inesistente.
        third = '00000000-0000-0000-0000-000000000003'
        one = pool.submit(sql, actor(f"INSERT INTO public.messaggi(mittente_id,destinatario_id,testo) VALUES('{A}','{third}','prima AC')"))
        two = pool.submit(sql, f"SET ROLE authenticated; SET request.jwt.claim.sub='{third}'; INSERT INTO public.messaggi(mittente_id,destinatario_id,testo) VALUES('{third}','{A}','prima CA')")
        one.result()
        two.result()
        assert sql(f"SELECT count(*)=1 AND max(ultima_posizione)=2 FROM public.chat_conversazioni WHERE utente_a='{A}' AND utente_b='{third}'") == 't'
        assert sql(f"SELECT count(*)=2 AND min(s.versione)=2 FROM public.chat_stati_personali s JOIN public.chat_conversazioni c ON c.id=s.conversazione_id WHERE c.utente_a='{A}' AND c.utente_b='{third}'") == 't'
    print('PASS: concorrenza insert/svuota, elimina/insert, retry simultanei, prima coppia')


def main():
    started = False
    try:
        command(DOCKER + ['run', '--detach', '--name', NAME, '--network', 'none',
                         '--label', 'vigilanza.test=conversazioni-personali',
                         '-e', 'POSTGRES_PASSWORD=local-disposable-test', 'postgres:17-alpine'])
        started = True
        deadline = time.monotonic() + 45
        while True:
            try:
                sql('SELECT 1')
                break
            except RuntimeError:
                if time.monotonic() > deadline:
                    raise
                time.sleep(0.2)
        for path in ['supabase/tests/conversazioni_personali_fixture.sql',
                     'supabase/migrations/202610180001_conversazioni_personali.sql',
                     'supabase/tests/conversazioni_personali.sql']:
            output = sql((ROOT / path).read_text())
            print(path + ': OK')
            if 'PASS:' in output:
                print(output[output.index('PASS:'):])
        concurrent_tests()
        # Lo snapshot include anche letto_at: i test non devono modificarlo.
        assert sql("""SELECT NOT EXISTS (
          SELECT 1 FROM public.fixture_snapshot f LEFT JOIN public.messaggi m USING(id)
          WHERE m.id IS NULL OR to_jsonb(m) <> to_jsonb(f))""") == 't'
        print('PASS: integrita messaggi dopo concorrenza')
    finally:
        if started:
            command(DOCKER + ['rm', '-f', NAME])


if __name__ == '__main__':
    main()
