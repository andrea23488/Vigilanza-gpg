# Blocco 1A — modello locale multiplayer e push

Questo documento e i modelli associati sono una preparazione locale su `feature/blocco1a-multiplayer-push`, basata su `5fc8795`. Non sono importati dall'app, dall'Edge Function o da una RPC: non effettuano rete, non scrivono database e non inviano notifiche.

## Policy di presenza proposta

- Una sessione di gioco e identificata da `user_id`, `partita_id` e `session_id` casuale per la sessione foreground del dispositivo.
- Il server registra `app_state`, `route_visible`, `acknowledged_version`, `heartbeat_at` e `lease_expires_at`; il tempo autorevole e `now()` del server.
- Il client rinnova soltanto mentre la partita e visibile e l'app attiva. Background, uscita partita o disconnessione non sono presenza visuale.
- Lease breve (modello: 45 s), rinnovo frequente; la scadenza consente di recuperare dopo terminazione forzata senza cleanup client.
- Dopo una mossa il client ack della versione solo quando la vista Realtime e stata applicata. Il worker differisce brevemente (modello: 3 s) la push di turno; sopprime solo se una presenza foreground della partita ha ackato quella versione. Presenza senza ack scaduto => fallback push.
- In multi-device, la policy proposta sopprime per l'utente se almeno una sessione attiva della stessa partita ha ackato la versione. Da approvare e collaudare.

## Identita e deduplicazione eventi

Chiave deterministica locale: tipo + partita + versione + destinatario. In futuro la chiave dovra essere persistita con vincolo UNIQUE nell'outbox, non solo in memoria. Sfida, risposta/accettazione e ciascuna versione di turno devono avere eventi distinti. Retry di esito incerto non deve reinviare alla cieca.

## Protezioni server da progettare

La migrazione esistente `202610170002_giochi_multiplayer.sql` limita la lettura della riga ai partecipanti, ma lo stato JSON contiene entrambe le mani; RLS sulla riga non nasconde singole carte. Il nuovo modello dovra separare stato privato e snapshot pubblico, restituire via RPC solo mano del giocatore autenticato e non pubblicare segreti su Realtime.

Le RPC attuali controllano autenticazione, partecipanti/turno e versione, ma `salva_stato_partita_gioco` accetta lo stato e il vincitore dal client. La futura RPC dovra ricevere un'azione, caricare lo stato server, bloccare la partita, verificare relazione `colleghi` accettata e assenza blocchi `utenti_bloccati` alla creazione, applicare le regole server-side e scrivere stato + outbox nella stessa transazione.

## BLOCCO 1B-1 — test locali e specifica di sicurezza

`games/multiplayerSecurityFixture.cjs` fornisce due identità sintetiche, due sessioni indipendenti, carte fittizie e una partita deterministica per ciascun gioco. `scripts/test-multiplayer-sicurezza-locale.cjs` verifica proiezione delle mani, autorizzazione envelope, turni/versioni/stato, coerenza del vincitore, presenza, scadenza, background, disconnessione, riconnessione, chiavi evento e coordinamento logico tra sender diretto e outbox.

I test sono modelli locali puri: non eseguono il motore completo della partita, non chiamano Supabase, non provano RLS/RPC/Postgres, non accedono a Expo/FCM/APNs e non cambiano i flussi multiplayer esistenti. `validateCalculatedResult` è valido solo per confrontare un risultato calcolato da un motore attendibile; non autorizza un risultato fornito dal client. `coordinateGamePush` descrive un single-dispatcher futuro e non è collegata al sender.

### Specifica server-side per la revisione successiva

1. **Stato privato e pubblico:** spostare mani e ordine del mazzo in stato privato non leggibile direttamente; esporre snapshot pubblico e sola mano del chiamante tramite RPC. Rimuovere dalla pubblicazione Realtime ogni campo privato. Definire e testare una migrazione/backfill per partite esistenti prima di cambiare il client.
2. **Mosse:** RPC autenticata riceve soltanto `operation_id`, versione attesa e azione minima. Blocca la partita, controlla partecipanti, partita in corso, turno, versione, carta nella mano server e regole Scopa/Briscola server-side; il server calcola turno successivo, punteggio e vincitore. Deduplicare `operation_id` e restituire lo stesso esito ai retry.
3. **Sfide:** RPC verifica collegamento accettato, blocchi in entrambe le direzioni, gioco valido, rate limit e destinatario diverso. La risposta è ammessa solo al destinatario e solo una volta. La fixture deve definire in modo autorevole le tabelle `colleghi` e `utenti_bloccati`, che non sono dichiarate dalle migrazioni incluse in questo worktree.
4. **Presenza:** tabella con chiave `(partita_id, user_id, session_id)`, stato app, route visibile, versione ack, heartbeat e lease. Nessun accesso tabellare ai ruoli client: RPC usa `auth.uid()`, controlla partecipazione, usa `now()` server e impedisce regressione dell'ack. Background/uscita rilascia visibilità; crash/assenza rete si risolve con TTL.
5. **Eventi e invio:** l'operazione scrive nella stessa transazione un evento con chiave univoca (tipo, partita, versione, destinatario). Un outbox/worker è l'unico dispatcher quando attivo; il sender diretto legacy non deve inviare lo stesso evento. Vincolo univoco evento/dispositivo; controllo presenza, ack e preferenze prima del trasporto. Gli esiti di rete incerti non vanno ritentati alla cieca: “exactly once” verso Expo non è garantibile dalla sola transazione DB.
6. **RLS e privilegi:** revocare accesso diretto allo stato privato, presenza e outbox; concedere solo RPC necessarie; `SECURITY DEFINER` con `search_path` fisso e privilegi minimi; verificare non partecipante, sessione contraffatta, blocchi e lettura della mano avversaria.

### Ambiente e gate prima dei test d'integrazione

Nel worktree è presente `supabase/config.toml`, ma non è stato confermato uno stack Supabase eseguibile: CLI `supabase` e Deno assenti; client Docker presente ma socket daemon non accessibile. `psql` da solo non fornisce Auth, Realtime o Edge Runtime. Le migrazioni non definiscono tutte le tabelle applicative, incluse `colleghi` e `utenti_bloccati`; un reset basato solo sullo schema presente non dimostrerebbe fedeltà all'app.

Prima dell'integrazione servono CLI/daemon disponibili e stack locale isolato con project ID distinto, oppure schema/fixture sintetico completo. Non eseguire `supabase link`; non usare chiavi remote. Le push restano su trasporto fake. Il collaudo Android reale richiederà una successiva autorizzazione e progetto Expo/EAS, FCM e token di staging separati.

## Prossima integrazione isolata

Solo dopo revisione: nuova migrazione non applicata con stato privato/pubblico, presenza, preferenze/eventi/outbox e policy; funzioni SQL transazionali e test SQL; poi adattamento di `giochiMultiplayerApi.js`, `games/GiocoColleghiScreen.js`, `App.js`, `pushNotifications.js` e sender/worker. Testare prima su Supabase locale/staging con utenti sintetici e EAS/FCM/APNs di staging. `betaIos` resta offline e non va usata per push reali. Nessuna credenziale di produzione.
