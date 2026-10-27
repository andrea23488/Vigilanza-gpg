# Blocco 2A — proposta e test chat personali, non attivati

Worktree: /workspaces/vigilanza-release-candidate. Branch feature/release-candidate-completa.
HEAD di partenza: 9c176d86aae24b429530bf2c9a53576d7991a09f. Working tree inizialmente pulito.

## Verifica dello schema: risultato e limite

Non è stato usato alcun dato, token, file .env o credenziale Supabase reale. Non è disponibile un connettore che esponga lo schema remoto senza credenziali, né un export attestato del catalogo remoto nel repository. Non è stata eseguita alcuna interrogazione remota. Lo schema realmente distribuito **non è quindi verificato**.

Evidenze locali: chatApi.js usa messaggi, profili e consegne_servizio. Le colonne in queste query provano soltanto il contratto atteso dal codice, non il catalogo effettivo o le RLS distribuite. Il repository non definisce integralmente la tabella messaggi e le relative policy originali. La migrazione 202610180001_conversazioni_personali.sql, commit 7bca7e0, è dichiarata non applicata: le sue quattro tabelle e la RPC chat_personale_operazione sono soltanto una proposta esistente. Nessuna nuova tabella, colonna, RPC o persistenza è stata scelta o aggiunta in questo blocco.

Prima di qualsiasi integrazione occorre un export di soli metadati attestato per l'ambiente interessato: colonne/tipi/vincoli di messaggi, RLS/grant, trigger, firme RPC e definizioni pertinenti, migrazioni effettivamente applicate. Escludere righe utente, segreti, credenziali e configurazioni Auth sensibili. Confrontare il catalogo con la proposta e verificare immutabilità di ID/partecipanti e compatibilità con i client esistenti. In assenza di questo riscontro non è corretto attivare automaticamente il vecchio contratto proposto.

## Stato delle sette funzionalità richieste

| Funzione | Stato dell'app | Cosa verifica la proposta locale |
| --- | --- | --- |
| Swipe sinistro con tre azioni | Non implementato/attivato | Nessuna UI di facciata che richiami la cancellazione legacy |
| Svuota personale | Non collegato al backend | Confine personale nasconde lo storico ad A; B e messaggi/ricevute restano invariati |
| Elimina personale | Non collegato; il vecchio eliminaConversazione esegue DELETE condivisi | Stato deleted soltanto per A; nuovo messaggio riapre senza ripristinare lo storico nascosto |
| Archivia/Archiviate | Non collegato al backend | Stato archived escluso dalla lista principale, conservato anche all'arrivo di nuovi messaggi; ripristino già coperto dalla suite originaria |
| Persistenza | Nessun nuovo storage client | Stato server proposto sopravvive a chiusura e nuova connessione di processi psql indipendenti; non è un collaudo del riavvio dell'app |
| Non letti, ricerca e nuovi messaggi | I percorsi legacy non applicano lo stato personale | Proiezione sintetica SQL con filtri coerenti; l'archivio conserva i non letti, lo storico nascosto non entra in ricerca o conteggi |
| Concorrenza | Nessuna nuova operazione reale introdotta | Lock di conversazione, versione attesa, retry idempotenti e arrivo messaggi testati su PostgreSQL reale isolato |

## Contratto da completare dopo la verifica dello schema

Riutilizzare la proposta 7bca7e0 soltanto se risulta compatibile con il catalogo attestato. Occorre ancora definire e collaudare le letture effettive per elenco principale/Archiviate, messaggi paginati, ricerca, anteprima, ordinamento e conteggi; oggi non esistono RPC di lettura integrate nell'app. Nessun nome o firma di nuova API viene presunto qui.

La UI futura deve confermare gli esiti server prima di mostrare successo, isolare stato/cache/richieste per utente e invalidare risposte tardive al cambio sessione. Riutilizzare lo stesso operation ID e gli stessi parametri dopo un timeout; un conflitto di versione richiede rilettura e riconferma, senza spostare automaticamente il confine di Svuota/Elimina su messaggi appena arrivati. Mantenere bigint testuali oltre il limite Number di JavaScript. Applicare i filtri anche agli eventi Realtime e alle push aperte. Una UI swipe dovrà offrire tre pulsanti distinti e accessibili, conferme per Svuota/Elimina e accesso separato ad Archiviate.

Le letture, i conteggi e il sender attuali non consumano lo stato personale. La proposta non cambia le RLS di messaggi: i test dimostrano esplicitamente che una lettura legacy può ancora recuperare lo storico nascosto. Non basta aggiungere pulsanti o un filtro in memoria. Eventuali adeguamenti backend rimangono una proposta da revisionare e testare su copia sintetica; nessuna migrazione è stata modificata o applicata a Supabase.

## Test isolati

Estesa la suite esistente con supabase/tests/conversazioni_personali_2a.sql. La funzione pg_temp.vista_2a è una proiezione di test nella sessione PostgreSQL, non una nuova RPC di produzione. Usa esattamente gli oggetti della proposta locale e utenti UUID sintetici A/B; la suite originaria include anche un terzo utente estraneo.

Esecuzione: python3 scripts/test-conversazioni-personali.py. Serve l'immagine pubblica postgres:17-alpine già disponibile: il runner usa --pull=never. Crea soltanto il proprio container, rete none, nessuna porta o bind mount, cluster su tmpfs, password fittizia locale; rimuove il container al termine anche in caso di errore. L'attesa distingue il server temporaneo initdb da quello definitivo. Nessuna lettura di credenziali Supabase e nessun URL remoto.

Le prove eseguono fixture, proposta esistente e test soltanto nel database usa-e-getta. Questo non certifica il catalogo remoto, la persistenza dopo reinstallazione dell'app, notifiche push o rendering/gesti su iOS e Android. Queste verifiche restano bloccate fino alla conferma dello schema e all'integrazione successiva.


## Esito della verifica locale

Eseguiti con successo su PostgreSQL 17 isolato: suite originaria (backfill, RLS, autorizzazione, cursori, retry e integrità), nuova suite 2A, quattro scenari concorrenti, persistenza tra processi client/riconnessioni e integrità finale dei messaggi. Passati inoltre i 210 test di regressione dei 28 file selezionati, typecheck `tsc --noEmit --incremental false`, compilazione sintattica Python e `git diff --check`. Container e collegamento temporaneo alle dipendenze rimossi. Nessun collaudo remoto o su dispositivo. Nessun commit, staging, push, build o deploy.

Sono modificati soltanto questo documento, il riferimento documentale della base dati, il runner e il nuovo file SQL di test. Codice applicativo e migrazione 202610180001 sono byte per byte identici a HEAD iniziale. Nessuna funzionalità personale viene dichiarata operativa nell'app finché il blocco sullo schema reale non è risolto.
