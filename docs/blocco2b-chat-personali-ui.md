# Blocco 2B — UI concreta, operazioni personali bloccate

Partenza: feature/release-candidate-completa, HEAD f76ab4d588fd0e8e6229934f94c7492066f6454d, stato pulito. Nessun export dello schema remoto attestato è stato aggiunto dopo il blocco 2A. Restano disponibili le API reali legacy di messaggi e letture, non un contratto verificato per stato personale, elenco Archiviate e conteggi filtrati.

## Implementato nel runtime

- La card effettiva della lista chat riusa i contenuti e gli stili precedenti. Swipe orizzontale sinistro mostra tre azioni distinte; swipe destro richiude. Scorrimento verticale, gesto breve e annullamento non attivano operazioni. Il tap immediatamente successivo allo swipe viene soppresso.
- Alternativa accessibile tramite Azioni conversazione e pressione lunga. Svuota chat, Elimina chat e Archivia chat sono realmente disabilitati, senza callback di mutazione, con spiegazione visibile del blocco.
- Accesso e ritorno dalla sezione Archiviate, dichiaratamente indisponibile: non mostra un falso archivio vuoto o successi simulati.
- Una sola card per controparte e chiave composta da account/controparte; cambio account o nuova istanza non conservano il pannello aperto. Non vengono inventati cursori, ricevute o stati persistenti locali.
- Rimossa la pressione lunga che cancellava messaggi condivisi. Il vecchio export eliminaConversazione ora rifiuta con CHAT_PERSONALI_NON_DISPONIBILI prima di qualunque accesso al backend, anche se richiamato da un altro consumer. L'eliminazione del singolo messaggio inviato, già esistente, non viene alterata.
- Rimosso soltanto il secondo ramo listaChat, prima irraggiungibile. La prima card conserva apertura della chat, riepilogo e non letti; invio, letture e Realtime restano invariati.

## Blocco preciso e comportamento non attivo

Nessuna operazione personale è abilitata. Non è verificato che esistano sul backend distribuito gli oggetti della proposta 7bca7e0. Non esiste nell'app una lettura personale attestata per elenco, archivio, ricerca, messaggi visibili e non letti. I percorsi legacy ignorano i confini personali. Un solo flag client non sarebbe sufficiente: attivare i pulsanti richiede un'integrazione verificata di letture, mutazioni, versioni/idempotenza, Realtime e conteggi.

Non viene aggiunto un fallback AsyncStorage che nasconda dati soltanto su un dispositivo o faccia credere di avere aggiornato il backend. Di conseguenza Svuota/Elimina/Archivia e il recupero dall'archivio non sono ancora funzionanti nell'app, né se ne dichiara la persistenza reale. Non sono cambiate notifiche o ricevute. La proposta e i test SQL del blocco 2A restano separati e non applicati a Supabase; non occorre inventare una seconda migrazione prima della verifica del catalogo remoto.

## Verifica

scripts/test-chat-personali-ui.cjs esercita i componenti effettivi e i callback App con dati sintetici: swipe, annullamento, azioni disabilitate, alternativa accessibile, doppio account, deduplicazione, nuovi riepiloghi, Archiviate/ritorno, due chiamate concorrenti all'export legacy senza rete. Confronta inoltre API e schermo chatCollega con f76ab4d per preservare invio/lettura/Realtime e le chiamate push esistenti. I test SQL 2A verificano separatamente isolamento di due utenti, stato personale, concorrenza, messaggi nuovi, non letti e persistenza tra processi client.

I test UI usano host nativi simulati; non certificano gesto e layout su dispositivo iOS/Android. Serve il collaudo nativo. Il blocco backend richiede schema verificato e successivo collaudo dei contratti: i test della proposta non attestano lo schema di produzione.


## Esito finale locale

Passati i 210 test di regressione preesistenti e i 9 nuovi test UI/API; passati typecheck senza emissione/cache incrementale e git diff --check. Ripetuta con successo la suite PostgreSQL 17 del blocco 2A (backfill, RLS, isolamento A/B, archivio/ricerca/non letti, quattro casi concorrenti, retry e persistenza tra processi client). Le ultime rifiniture di etichette/accessibilità e il ritorno Android sono stati verificati rieseguendo tutti i 9 test nuovi.

Sono cambiati soltanto App.js, chatApi.js, ChatConversationActions.js, chatPersonaliUiModel.js, scripts/test-chat-personali-ui.cjs e questo documento. Home, calendario, motori stipendio/giochi, notifiche e migrazioni sono invariati. Nessun dato o messaggio reale usato/inviato, nessun commit/staging/push/build/deploy. HEAD resta f76ab4d588fd0e8e6229934f94c7492066f6454d. Le operazioni personali restano disabilitate: questi risultati non sono una dichiarazione di supporto backend o collaudo nativo.
