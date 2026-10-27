-- SOLO BOZZA: non eseguita nel blocco 2C. Non interroga righe applicative.
-- Futuro utilizzo soltanto dopo autorizzazione, su endpoint TEST verificato.
BEGIN READ ONLY;
SELECT current_setting('server_version') AS server_version;
SELECT n.nspname AS schema_name,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND (c.relname IN('messaggi','profili','colleghi','utenti_bloccati') OR c.relname LIKE 'chat_%')
ORDER BY c.relname;
SELECT table_schema,table_name,column_name,data_type,is_nullable
FROM information_schema.columns WHERE table_schema='public'
 AND (table_name='messaggi' OR table_name LIKE 'chat_%') ORDER BY table_name,ordinal_position;
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_catalog.pg_policies
WHERE schemaname='public' AND (tablename='messaggi' OR tablename LIKE 'chat_%') ORDER BY tablename,policyname;
SELECT n.nspname,c.relname,t.tgname,t.tgenabled,p.proname AS trigger_function
FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
WHERE NOT t.tgisinternal AND n.nspname='public' AND c.relname='messaggi';
-- Non esportare tgargs o corpi di trigger/RPC: possono incorporare segreti.
SELECT n.nspname,p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid) AS signature,
 pg_catalog.pg_get_function_result(p.oid) AS result,p.prosecdef,p.provolatile,md5(p.prosrc) AS body_hash
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname LIKE 'chat_%' ORDER BY p.proname;
SELECT table_schema,table_name,grantee,privilege_type FROM information_schema.role_table_grants
WHERE table_schema='public' AND (table_name='messaggi' OR table_name LIKE 'chat_%') ORDER BY table_name,grantee;
SELECT specific_schema,routine_name,grantee,privilege_type FROM information_schema.role_routine_grants
WHERE specific_schema='public' AND routine_name LIKE 'chat_%' ORDER BY routine_name,grantee;
-- I risultati di catalogo sono parziali se il ruolo non ha visibilità sufficiente.
ROLLBACK;
