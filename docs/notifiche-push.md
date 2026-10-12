# Notifiche push: implementazione candidata, attivazione separata

Nessun invio reale, SQL remoto, deploy o build è stato eseguito.

## Client

SecureStore 15.0.8 e Crypto 15.0.9 sono le versioni previste da Expo SDK
54.0.37. Le API utilizzate sono state verificate nei sorgenti dei pacchetti
bloccati. La configurazione include il plugin SecureStore. La credenziale
casuale viene conservata nello storage nativo, senza fallback AsyncStorage o
Math.random. Lo storage è separato per progetto Supabase e progetto EAS.

La schermata carica le preferenze server prima di consentire modifiche.
Permessi richiesti solo dopo un'azione esplicita; errori non sovrascrivono le
preferenze. Rinnovo in foreground e rotazione token mantengono le versioni.

Logout/cambio account invalidano immediatamente il binding locale. Una coda
sicura conserva revoche e intenzioni di registrazione da riconciliare. Le
operazioni preparate sul server impediscono che una registrazione tardiva
riattivi il dispositivo dopo una revoca. Nessun JWT è salvato nella coda.
I percorsi di uscita esistenti richiamano soltanto questo cleanup push.

Tap con payload minimo: evento/tipo/destinatario, controllo server della sorgente
corrente, poi apertura chat o consegna. Il Centro Notifiche rimane invariato.

## Backend e worker

La migrazione 202610120002 aggiunge outbox, lease, budget persistenti,
intenzioni idempotenti e gate Auth. Nessun trigger, scheduler o invio SQL.
Registrazione autenticata: verifica JWT separata da auth.sessions;
credenziale trasformata in hash nell'endpoint prima della RPC.
Le operazioni negative offline possono soltanto revocare un'associazione
provata, mai registrare, leggere dati o trasferire account.

Il worker usa esclusivamente gli endpoint Expo fissi, senza redirect.
Acquisizione atomica, deduplicazione evento/dispositivo, versione di binding,
rate limiting e controlli freschi su sessioni, blocchi e sorgenti precedono
l'invio. Payload generici, senza nomi o testo privato, con scadenza assoluta.
Ticket e ricevute sono distinti: receipt_ok significa accettazione del provider,
non prova di visualizzazione sul telefono. Timeout o risposta ambigua all'invio
producono uncertain e non un reinvio cieco; retry solo per rifiuti certi.
I token invalidi vengono disattivati soltanto per la versione interessata.

## Gate di attivazione

Default disabilitati: EXPO_PUBLIC_PUSH_REGISTRATION_ENABLED,
PUSH_REGISTRATION_ENABLED, PUSH_TRANSPORT_ENABLED e send_enabled SQL.
La configurazione richiede anche auth_session_check_approved, progetto/ambiente,
TTL binding e consegne, cutoff acquisizione e ritardo ricevute approvati.
Modalità test richiede allowlist dispositivo/versione. Non vengono scelti
implicitamente durate di sicurezza o criteri di recupero.

PUSH_WORKER_SECRET e l'eventuale EXPO_ACCESS_TOKEN restano esclusivamente server.
Le funzioni con verify_jwt=false effettuano controlli espliciti: JWT per azioni
positive, prova d'installazione per revoche, segreto worker per l'elaborazione.
La schedulazione deve essere predisposta separatamente. Nessun workflow è
aggiunto per distribuire o attivare queste funzioni.

## Collaudi e limiti

Test client/trasporto simulato e motori TypeScript non usano servizi reali.
Il collaudo SQL usa PostgreSQL 17.6 Docker senza rete, porte o dati reali;
verifica sintassi, ACL/RLS, concorrenza, ricevute, revoche e rollback.
Non dimostra il comportamento del servizio Supabase Auth reale.

Prima dell'attivazione occorrono collaudo Auth A/B nel progetto separato,
verifica schema sorgenti e privilegi effettivi, configurazione APNs/FCM/EAS,
prove native iOS/Android (storage, permessi, token, background, tap a freddo),
poi approvazione distinta per migrazioni e deploy. node_modules e un runtime
nativo non sono disponibili in questo ambiente: il lockfile è aggiornato,
ma non equivale a un'esecuzione nativa riuscita.

Logout offline non garantisce revoca immediata sul server; TTL, rinnovo e
riconciliazione limitano il periodo residuo. Una notifica già accettata da
APNs/FCM non può essere ritirata. Le verifiche SQL non eliminano la breve
finestra tra autorizzazione e invio esterno. Le intenzioni non vanno eliminate
senza un protocollo di retention che impedisca replay: gestione amministrativa
futura, con invii disabilitati finché i prerequisiti non sono collaudati.

Il controllo AST e i test Node verificano sintassi ed esecuzione del codice
puro, ma non sostituiscono il controllo statico completo: tsc e Deno non sono
disponibili nel checkout. Gli endpoint Deno richiedono validazione nel runtime
di collaudo prima del deploy.
