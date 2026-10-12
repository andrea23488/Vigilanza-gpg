# Notifiche push: integrazione candidata, invio non attivato

Il checkout non invia notifiche. Non sono stati applicati SQL o effettuati deploy.

## Componenti

- Profilo / Notifiche di sistema: consenso esplicito, categorie separate.
- Gestore client: credenziale casuale persistita solo con provider sicuro iniettato;
  nessun fallback AsyncStorage. Cambio account invalida immediatamente il binding.
  Refresh Auth conserva il binding solo su evento TOKEN_REFRESHED.
- Tap: payload limitato a evento/tipo/destinatario, rivalidazione server e lettura
  della sorgente corrente prima della navigazione; nessuna modifica al Centro Notifiche.
- Endpoint candidato push-dispositivi: disabilitato senza PUSH_REGISTRATION_ENABLED=true;
  getClaims e controllo separato auth.sessions nella RPC. Errori generici.
- Migrazione additiva: session binding, TTL non preimpostato, versioni attese,
  collisioni conservative, lock SQL, revoca lavori obsoleti e preferenze consegne.
- Pianificatore puro chat/consegne: blocchi bidirezionali, relazione accettata,
  sessione verificata, sorgente presente/non letta, scadenza e deduplicazione.

## Limiti che impediscono l'attivazione

1. node_modules non e' presente: expo-notifications e supabase-js sono dichiarati
   nel lockfile, ma non eseguiti in questo ambiente. Le API usate sono state riscontrate nei sorgenti npm delle versioni bloccate,
   con integrita verificata, senza installazioni. Esecuzione nativa e getClaims
   richiedono verifica con i pacchetti 0.32.17 / 2.112.3 e prove su dispositivi reali.
2. Manca un provider nativo verificato per secure storage e CSPRNG; il client non
   registra alcun dispositivo e la schermata resta non attivabile. Non e' stata
   aggiunta una dipendenza o memorizzato un segreto in AsyncStorage.
3. La migrazione ha superato creazione e registrazione sintetica su PostgreSQL 17.6
   isolato (container senza rete e senza porte, rimosso a fine prova). Non e'
   un collaudo completo RLS/concorrenza/Auth Supabase. Richiede la fondazione;
   verificare schema consegne_servizio e auth.sessions.not_after, FK, RLS, ACL,
   privilegi ereditati e funzioni SECURITY DEFINER in ambiente isolato.
4. Il TTL binding resta NULL: occorre approvazione della durata prima di registrare.
   Il controllo di sessione copre riga/proprietario/not_after: politiche Auth di
   inattivita', sessione singola e ritardi di revoca richiedono collaudo dedicato.
5. Non e' implementato un worker reale Expo. Il trasporto storico resta disabilitato.
   La RPC candidata push_acquisisci_comunicazioni alimenta la coda SOLO da sorgenti
   SQL rivalidate, senza testo privato e con acquisizione disabilitata inizialmente.
   Consegne TTL resta NULL fino ad approvazione. Cutoff/retention vanno collaudati.
6. Prima dell'invio servono outbox per evento/dispositivo/versione, acquisizione
   atomica, rate limiting, retry, ticket/ricevute, invalidazione token e audit.
   Ripetere tutti i controlli autorizzativi immediatamente prima dell'invio.
7. Logout offline non garantisce revoca server immediata. Lo stato locale viene
   invalidato; servono riconciliazione persistente sicura e rinnovo periodico prima
   dell'attivazione. I flussi di reset password e cancellazione account non sono
   riscritti: il session binding server deve escludere le sessioni terminate.
8. Preferenze salvate e dispositivi devono essere ricaricati dal server prima di
   rendere attivabile la schermata; le switch attuali partono disabilitate.

## Attivazione futura, separata

Collaudare SQL/Auth nel progetto isolato; completare i prerequisiti sopra;
verificare APNs/FCM ed EAS per bundle/package esistenti, permessi iOS/Android,
background/chiusura, token rotation, tap a freddo, logout e cambio account.
Solo dopo approvazione applicare schema e distribuire backend/app. Nessuna
configurazione di invio deve attivarsi come effetto di questa modifica Git.
