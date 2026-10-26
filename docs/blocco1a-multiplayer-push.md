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

## Prossima integrazione isolata

Solo dopo revisione: nuova migrazione non applicata con stato privato/pubblico, presenza, preferenze/eventi/outbox e policy; funzioni SQL transazionali e test SQL; poi adattamento di `giochiMultiplayerApi.js`, `games/GiocoColleghiScreen.js`, `App.js`, `pushNotifications.js` e sender/worker. Testare prima su Supabase locale/staging con utenti sintetici e EAS/FCM/APNs di staging. `betaIos` resta offline e non va usata per push reali. Nessuna credenziale di produzione.
