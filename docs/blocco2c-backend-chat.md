# Blocco 2C — preparazione backend, nessuna connessione o SQL eseguito

Partenza: branch feature/release-candidate-completa, worktree /workspaces/vigilanza-release-candidate, HEAD 2392de113e659fda86174ddc7a7f1968c1dd2286. Working tree inizialmente pulito. Nessuna credenziale, .env, riga utente o database è stato consultato. I file del 2A/2B restano invariati e le azioni UI restano disabilitate.

## 1. Contratto effettivamente usato e schema non attestato

| Percorso nel codice attuale | Contratto atteso dal client | Limite |
| --- | --- | --- |
| chatApi.caricaMessaggi/inviaMessaggio | messaggi con id, mittente_id, destinatario_id, testo, created_at, letto_at; INSERT e SELECT | Query legacy senza stato personale; select('*') non prova tipi/vincoli effettivi |
| Realtime chat | INSERT su public.messaggi, filtro destinatario_id | Non aggiorna automaticamente stato personale/cache e operazioni effettuate da un altro dispositivo |
| Letture e badge | UPDATE messaggi.letto_at; conteggio NULL; riepilogo storico | Da coordinare con i cursori personali, mantenendo compatibilità con ricevute legacy |
| Profili conversazioni | profili.user_id, nome, cognome, azienda, sede, foto_url, codice_gpg; una query include anche id | id non va assunto presente: la correzione storica 27578c6 lo ha rimosso dalle query colleghi |
| Consegne e richieste collega | Tabelle/API distinte, sommate al totale chat | Non vanno sostituite dal conteggio delle sole chat |
| Elimina conversazione | Export attualmente bloccato e tre azioni UI disabilitate | Non ripristinare DELETE dei messaggi condivisi |

Il repository contiene una fixture sintetica e la proposta 202610180001, non un export attestato del catalogo distribuito. Le tabelle chat_conversazioni, chat_stati_personali, chat_posizioni_messaggi, chat_operazioni_personali e chat_personale_operazione sono oggetti della proposta 7bca7e0, NON API remote dichiarate disponibili. La preparazione 2C li assume soltanto per la futura prova su copia isolata. Non cambia lo schema originale di messaggi né le sue RLS/grant.

## 2. Vigilanza-GPG-Test-Push: valutazione senza accesso

**Idoneità attuale: NON ATTESTATA; nessun collegamento consentito in questo blocco.** Il nome da solo non identifica il progetto o il suo contenuto.

Evidenza locale: origin/feature/notifiche-push:docs/push-test-ios.md, relativo eas.json e scripts/push-test-policy.cjs dichiarano il ref TEST `ilmhjsrxhnishnbocrnm`. Non è stata verificata l'associazione tra quel ref e il nome Vigilanza-GPG-Test-Push. I riferimenti sono copie Git locali, non letture aggiornate della Dashboard. Quel vecchio profilo iOS usa inoltre lo stesso progetto EAS dell'app ufficiale: non attesta isolamento di token/APNs/FCM e non è presente come profilo attivo nella candidata. La Beta offline non può provare chat/Auth/push reali.

| Controllo prima di considerarlo adatto | Evidenza disponibile ora | Esito |
| --- | --- | --- |
| Nome, ref e proprietario del TEST corrispondono | Solo ref dichiarato nei documenti | Da verificare |
| Ref/endpoint distinti dalla produzione | Nessun riscontro indipendente attestato | Da verificare senza usare credenziali di produzione |
| Nessun dato/persona o copia Auth di produzione | Nessun inventario | Da verificare; abortire al primo riscontro incompatibile |
| Schema chat e RLS compatibili; DB major version | Solo fixture PostgreSQL 17 | Da verificare |
| Trigger, webhook, worker, cron ed email non inviano all'esterno | Nessun audit | Bloccante: un progetto creato per push può contenere trasporti attivi |
| Token e dispositivi soltanto sintetici/staging | Nessun inventario | Bloccante |
| Credenziali staging/sessioni e storage client isolati | Vecchia proposta push con protocolli diversi | Da preparare e verificare separatamente |

Non creare né sostituire chiavi, non eseguire login, supabase link, REST/Auth/RPC, psql, Docker o CLI di database per questa valutazione. Non migrare automaticamente la linea push separata. Se il progetto è già usato da altri test, non resettarlo: preferire una copia/nuovo ambiente dedicato con autorizzazione distinta.

## 3. File predisposti, non autoapplicabili

Tutti i SQL nuovi sono in supabase/proposals/chat-personali-2c, fuori da supabase/migrations. Nessun runner li applica. 020 e 090 contengono un errore incondizionato prima del DDL/test: l'originale deve restare bloccato finché non viene prodotta una copia revisionata con autorizzazione separata. Non si tratta di un'identificazione automatica del database: il ref non è deducibile in modo attendibile da un flag SQL.

- 000_inventory_readonly.sql: bozza di inventario di soli metadati, transazione READ ONLY/ROLLBACK; colonne, RLS, privilegi, trigger (nomi, non argomenti), firme e hash dei corpi RPC. Non legge righe di messaggi/Auth, né corpi/argomenti che potrebbero contenere segreti. Non è stata eseguita. La visibilità del catalogo dipende dal ruolo: un risultato vuoto con ruolo limitato NON prova l'assenza di policy o funzioni. Qualsiasi espressione di policy va verificata/redatta prima di condividere l'export.
- 020_letture_proposte.sql: estensione di sola lettura della proposta 7bca7e0. Vista in schema privato con security_invoker/security_barrier; tre RPC STABLE SECURITY INVOKER, search_path fisso, auth.uid(), revoca PUBLIC/anon e soli EXECUTE autenticati. Nessun SECURITY DEFINER aggiuntivo e nessuna nuova facoltà SELECT sui messaggi: le RLS originarie e del sidecar continuano ad applicarsi. Lo schema privato non deve essere esposto dalla Data API.
- 090_test_letture_preparato.sql: test di integrazione futuro sulla fixture sintetica 2A A/B/C e sulle nuove letture. Non eseguito e non collegato al runner Docker del 2A.
- reference-model.cjs: modello di specifica in memoria, esclusivamente per test. Non è un backend, non emula una transazione PostgreSQL reale e non viene importato dall'app.
- scripts/test-chat-backend-2c.cjs: controlli statici sui testi SQL e test del modello, con soli moduli Node locali. Non importa driver database, non avvia processi SQL e non usa rete o credenziali.

La proposta 202610180001 resta la base per le mutazioni: RLS solo proprietario sui metadati, nessuna scrittura client diretta, lock di conversazione, operation ID idempotente e versione attesa. Non la duplico né la modifico senza catalogo. L'ordine futuro sarebbe: fixture/schema TEST verificato, base chat 202610180001, estensione letture revisionata, test. Mai eseguire in blocco le migrazioni del repository: includono anche bozze multiplayer incompatibili con il client attuale.

## 4. Contratti di lettura proposti

| RPC nuova, non attiva | Risposta e regole |
| --- | --- |
| chat_personale_messaggi_v1 | Stato/versione/cursori personali più messaggi visibili, ordine posizione DESC. Pagine 1..100 con cursore di posizione; versione attesa per impedire di mescolare pagine dopo nuovi messaggi/azioni. Bigint come stringhe. Il client deve invertire le righe per la timeline cronologica |
| chat_personale_elenco_v1 | Attive oppure Archiviate, una riga per coppia canonica; anteprima e ricerca solo su messaggi visibili. Chat svuotata resta nell'elenco con anteprima nulla. Keyset per (ordinamento, id), non OFFSET. Nessuna assunzione su nuove colonne di profili |
| chat_personale_non_letti_v1 | Totale/attive/archiviate testuali; ricezione, posizione sopra confine nascosto e letto, letto_at legacy nullo. Deleted esclusa; archivio incluso nel totale globale |

La vista centrale filtra esplicitamente proprietario e partecipazione, stato deleted e confine nascosti; JOIN a messaggi esclude righe eventualmente cancellate dai vecchi client. Svuota non marca letti i messaggi dell'altro utente; Elimina nasconde solo ad A; i messaggi nuovi riaprono deleted ma non abbassano il confine; archived resta tale fino a Ripristina.

La lista usa data dell'ultimo messaggio visibile (o creazione conversazione se vuota), con UUID come spareggio. Aggiornamenti durante la paginazione possono spostare conversazioni: deduplicare per id e ricaricare al cambiamento di versione/foreground. Non è uno snapshot mantenuto tra più richieste HTTP. La ricerca è una sottostringa letterale, non interpreta wildcard SQL. Nel client i bigint non vanno convertiti indiscriminatamente in Number.

Dipendenze non risolte: audit completo di SELECT/UPDATE/DELETE legacy, immutabilità di id/partecipanti, blocchi tra utenti, privilegi, oggetti già esistenti, indici/prestazioni e contratti sugli errori. Le RLS di messaggi attuali non sono fornite nel repository: non si può affermare che la bozza riproduca la semantica dei blocchi. Nessuna attivazione senza questa verifica.

## 5. Protocollo futuro di collaudo, con autorizzazioni distinte

1. **Solo dopo revisione:** confermare tramite evidenza amministrativa nome/ref/owner del TEST, distinzione dalla produzione, endpoint ammesso, inventario attività esistenti e assenza di dati di produzione. Nessuna azione odierna costituisce approvazione remota. Preparare snapshot/backup dell'ambiente di test e piano di ripristino senza cancellare dati altrui.
2. Autorizzare separatamente l'inventario remoto di soli metadati (000). Usare credenziali TEST fuori dal repository e dai log, senza fallback .env. Non usare il client ufficiale per il collaudo. Verificare RLS, grant, firme, hash, trigger e migrazioni realmente applicate. Non esportare token, corpi di funzioni contenenti segreti o righe Auth/messaggi.
3. Prima di inviare qualsiasi messaggio TEST, verificare assenza/disattivazione autorizzata di webhook, scheduler, worker, SMTP, Expo/APNs/FCM e invocazioni automatiche send-push. Usare trasporto fittizio. Se non è possibile garantire isolamento, non usare quel progetto. Non registrare dispositivi personali/produzione.
4. Con ulteriore autorizzazione, eseguire prima su PostgreSQL locale/copia dedicata soltanto fixture sintetica, base chat e copia revisionata di 020; poi suite 2A e 090. Oggi ciò è vietato e NON è stato fatto. Niente migrazioni multiplayer. Verificare transazioni/lock reali, rollback completo in caso di errore e integrità dello schema legacy.
5. Solo dopo quei risultati autorizzare il collaudo su TEST. Creare due utenti sintetici autenticati A/B e un estraneo C, mai clonati da produzione, senza invio email. Le azioni positive usano sessioni A/B reali di staging e RLS, non service_role per aggirarle. Verificare tutte le letture/RPC, non solo chiamate amministrative.
6. Integrare successivamente il client isolato: nessun token/endpoint staging deve finire nell'app ufficiale. Rilettura autorevole dopo Realtime/reconnect/foreground; risposta tardiva di altro account scartata; dopo timeout riusare stessa chiave e parametri; dopo 40001 riconfermare l'intento. Invalidare anche cache ricerca, anteprime e badge. Non pubblicare corpi/mani/segni riservati su canali Realtime.
7. Collaudare nuovo processo client, logout/cambio account e due dispositivi, più prova nativa iOS/Android. I non letti chat nuovi devono sostituire solo la componente chat del badge, preservando richieste colleghi/consegne. Distinguere badge in-app, badge di sistema e trasporto push: nessun invio reale autorizzato. Scheduler e ricevute push richiedono attività separata.
8. Solo con tutti i gate sotto soddisfatti proporre l'abilitazione delle azioni UI; nessuna impostazione client da sola può dichiarare il backend pronto. Nessun commit/deploy/build è autorizzato da questo documento.

### Matrice minima futura, da eseguire davvero prima dell'abilitazione

- Svuota A: B conserva testo/ricevute/stato; A non trova lo storico in ricerca, anteprime o non letti; chat vuota ancora elencata.
- Elimina A: esclusa da attive/Archiviate/non letti di A; B invariato; nuovo messaggio riapre una sola riga e mostra solo il nuovo.
- Archivia/Ripristina: elenchi coerenti, nessuna lettura implicita, nuovi messaggi restano archiviati, totale globale include archivio.
- Tre o più conversazioni, timestamp identici, molte pagine, arrivi mentre si pagina, testo unicode e ricerca con simboli: nessuna fuga di storico, limiti e cursori rispettati.
- A/B/C/anon/JWT scaduto: niente accesso a coppie altrui, stati personali o ledger. Testare anche utente bloccato e relazione rimossa secondo RLS attestata.
- Due sessioni simultanee: messaggio vs Svuota/Elimina, due intenti sulla stessa versione, retry identico e chiave riusata con richiesta diversa, deadlock/timeout/reconnect. Nessun retry automatico amplia un confine su nuovi messaggi.
- ID, posizioni e versioni oltre 2^53, più di 50 non letti, ricevute legacy già valorizzate e cancellazione singolo messaggio legacy: conteggi/pagine corretti.
- Cambio account mentre arrivano risposte, cold start e due dispositivi: nessun dato personale di A attribuito a B. Provare l'app isolata, non solo il modello serializzato.

## 6. Gate di abilitazione e ripristino

Restano tutti aperti: identità/isolamento progetto; catalogo e compatibilità legacy; verifica RLS/grant/blocchi; parsing/esecuzione della bozza SQL su copia; test transazionali concorrenti; integrazione client di tutte le letture e cursori; non letti/cache/Realtime coerenti; collaudo nativo e secondo account. La UI 2B rimane disabilitata e il vecchio export di cancellazione globale resta bloccato.

In caso di problema: fermare il collaudo e disabilitare le azioni nella variante TEST, preservare messaggi e metadati personali e raccogliere esiti depurati. Non eliminare automaticamente sidecar/cursori: perdere i confini personali potrebbe far riapparire storico nascosto. Un rollback dello schema richiede revisione separata, writer fermati e riconciliazione delle operazioni; nessuno script distruttivo viene predisposto qui.

## 7. Test consentiti ed effettivamente eseguiti

`node --test scripts/test-chat-backend-2c.cjs`: 13 test superati, di cui 3 controlli statici dei file e 10 prove del modello in memoria. Coprono A/B/C, retry/versioni, stato serializzato, nuovi messaggi, ricerca, archivio, conteggi e bigint. La serializzazione del modello NON prova durabilità PostgreSQL o riavvio dell'app. Gli interleaving del modello NON provano lock/deadlock reali. I controlli testuali NON certificano sintassi SQL, RLS in esecuzione o idoneità del progetto remoto.

Nessun SQL, compreso 000/020/090 o il runner Docker 2A, è stato eseguito in questo blocco. Nessuna connessione a database, nessuna richiesta Supabase/Auth/REST, nessuna notifica e nessun dato reale. La bozza SQL deve ancora essere revisionata, parsata e collaudata secondo la procedura sopra.


Verifica finale aggiuntiva: eseguiti insieme i 13 test 2C, i 9 test UI/API 2B e il test privacy esistente: 23 superati, zero fallimenti. Passati node --check sui due file CJS nuovi e git diff --check. Nessun SQL è stato parsato o eseguito, nessun driver/database/container è stato aperto. Restano sei file nuovi non tracciati e nessun file tracciato modificato; nessuno staging o commit. HEAD finale invariato a 2392de113e659fda86174ddc7a7f1968c1dd2286.
