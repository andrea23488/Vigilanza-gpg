# Conversazioni personali — base dati del BLOCCO 1

Migrazione: `supabase/migrations/202610180001_conversazioni_personali.sql`.
Non applicata a database remoti. App, API chat e push restano da integrare.

## Oggetti e garanzie

- `chat_conversazioni`: coppia canonica UUID, contatore per conversazione.
- `chat_posizioni_messaggi`: sidecar `messaggio_id → conversazione/posizione`.
  Non viene aggiunta alcuna colonna a `messaggi`.
- `chat_stati_personali`: una riga per partecipante; stato, confine personale di
  visibilità, cursore di lettura e versione. Archiviazione e lettura sono distinte.
- `chat_operazioni_personali`: registro privato delle richieste idempotenti.
- `chat_indicizza_insert`: trigger AFTER INSERT che scrive soltanto metadati.
- `chat_personale_operazione`: unica RPC di mutazione, `SECURITY DEFINER`, percorso
  di ricerca vuoto, oggetti qualificati, controllo esplicito di `auth.uid()`.

RLS e privilegi impediscono scritture dirette dei client su tutte le nuove tabelle.
Solo i partecipanti leggono la conversazione; soltanto il proprietario legge il
proprio stato. Le posizioni precedenti al confine e quelle di chat eliminate
sono nascoste dalle RLS. Nessun accesso client al registro idempotente.

Le policy, i privilegi e le righe di `messaggi` non vengono modificati. Non si
eseguono UPDATE/DELETE dei messaggi, neppure per segnare letture. Lo storico e le
ricevute dell'altro partecipante restano invariati.

## Contratto RPC

Parametri, nell'ordine:

1. `p_conversazione_id uuid`: conversazione già esistente.
2. `p_operazione_id uuid`: UUID nuovo per ogni intento; riutilizzare lo stesso UUID
   e gli stessi parametri in caso di timeout/retry.
3. `p_azione text`: `svuota`, `elimina`, `archivia`, `ripristina`, `leggi`.
4. `p_versione_attesa bigint`: versione dello stato letto dall'utente.
5. `p_posizione_letta bigint DEFAULT NULL`: obbligatoria soltanto per `leggi`.

Esempio (solo dopo applicazione autorizzata in ambiente di test):

```sql
SELECT public.chat_personale_operazione(
  '<conversazione-uuid>', '<operazione-uuid>', 'svuota', 1
);
```

Risposta JSON: `conversazione_id`, `user_id`, `stato`, `nascosti_fino_a`,
`letti_fino_a`, `versione`, `ultima_posizione`, `updated_at`. Bigint restituiti
come stringhe. Anche i futuri client devono inviare i bigint senza conversioni
a Number e usare letture che ne preservino la precisione.

La risposta di un retry è lo snapshot originale, non necessariamente lo stato
più recente: confrontare la versione e ricaricare, senza ripristinare dati obsoleti.

Errori: `42501` autenticazione/appartenenza; `22023` parametri, chiave riutilizzata
con richiesta diversa o transizione vietata; `40001` versione obsoleta. Dopo
`40001` ricaricare lo stato e riconciliare l'intento: non ripetere automaticamente
Svuota/Elimina sulla nuova versione, perché includerebbe messaggi appena arrivati.

## Transizioni

| Azione | Stato risultante | Confine nascosti | Cursore lettura |
| --- | --- | --- | --- |
| Svuota | Stato attuale active/archived | Ultima posizione sotto lock | Invariato |
| Elimina | deleted | Ultima posizione sotto lock | Invariato |
| Archivia | archived | Invariato | Invariato |
| Ripristina | active da active/archived | Invariato | Invariato |
| Leggi | Invariato | Invariato | Massimo tra attuale e richiesto |

Da deleted è consentita solo un'ulteriore eliminazione; un nuovo messaggio inviato
o ricevuto riattiva la chat senza abbassare il confine. I messaggi nuovi mantengono
archived. Aprire una chat vuota non crea conversazioni; il primo INSERT le crea.
Ogni operazione accettata e ogni nuovo messaggio incrementano la versione dello
stato coinvolto. Un retry già registrato non modifica nulla.

## Concorrenza

Trigger e RPC bloccano la stessa riga di conversazione fino al commit. La posizione
viene assegnata dopo acquisizione del lock: non dipende da clock client, timestamp
identici o ID allocati prima del commit. La RPC serializza anche la chiave
`utente/operazione` con advisory lock; il registro verifica l'intera richiesta.
La modifica dello stato e il salvataggio del risultato sono nella stessa transazione.

Chiamare una RPC per transazione HTTP. Scritture batch su molte conversazioni
possono avere deadlock (`40P01`), come altri accessi concorrenti PostgreSQL:
annullare e ritentare l'intera transazione, preservando la chiave dell'intento.

## Letture e integrazioni future obbligatorie

Questa è soltanto la base dati: i client attuali non applicano lo stato personale.
Le RLS originali di `messaggi` rimangono intenzionalmente invariate: una query diretta
può ancora restituire lo storico nascosto. Non è quindi ancora una funzionalità
utente completa né una revoca dell'accesso ai messaggi originari.

Le future letture devono unire messaggi, posizioni e stato personale e applicare:

- conversazione visibile se `stato <> 'deleted'`;
- messaggio visibile se `posizione > nascosti_fino_a`;
- non letto se ricevuto dal chiamante, visibile, `posizione > letti_fino_a`
  e `messaggi.letto_at IS NULL` (compatibilità con ricevute preesistenti);
- archivio incluso nel totale globale, distinto nel totale della lista attiva;
- anteprime e ordinamento basati soltanto sui messaggi visibili;
- JOIN con `messaggi` per escludere eventuali record cancellati dai vecchi percorsi.

Nessuna pubblicazione Realtime, funzione push o ricevuta condivisa viene cambiata
in questa fase. Occorreranno letture paginate con bigint testuali, aggiornamento
notifiche, cache e sottoscrizioni personali nel blocco di integrazione.

## Prerequisiti e rischi prima del collaudo su una copia Supabase

1. Verificare schema reale: `messaggi.id` bigint univoco e non riutilizzato,
   mittente/destinatario UUID non null e distinti, `created_at` ordinabile;
   utenti esistenti in `auth.users`. Dati invalidi fanno fallire la migrazione
   senza correzioni automatiche dei messaggi.
2. Verificare che ID e partecipanti dei messaggi siano immutabili nei percorsi
   esistenti, comprese RPC/ruoli privilegiati. Il sidecar non segue UPDATE
   dell'identità del messaggio: questo è un prerequisito da confermare sullo
   schema reale, non una garanzia delle policy originarie mancanti nel repository.
3. Ispezionare RLS, grant, trigger esistenti e nomi degli oggetti; verificare i
   permessi del ruolo che applicherà la migrazione. I test usano policy minime
   esplicite, non riproducono policy remote sconosciute.
4. Il backfill blocca le scritture di messaggi; lock timeout 10 secondi e rollback
   completo. Stimare durata, dimensione degli indici e carico su una copia realistica.
   Non impostiamo un timeout al backfill dopo acquisizione del lock.
5. Il trigger aggiunge costo e lock a ogni invio. Errori del trigger annullano
   anche l'INSERT; verificare carico, batch e compatibilità degli altri trigger.
6. Il registro idempotente cresce: nessuna pulizia automatica. Una retention
   futura richiede un contratto sui retry; cancellare ricevute può far rieseguire
   un vecchio Svuota/Elimina.
7. Cancellazione account: le FK da auth.users rimuovono i nuovi metadati tramite
   CASCADE; verificare il flusso esistente sulla copia, senza modificare messaggi.

## Test locali

```sh
python3 scripts/test-conversazioni-personali.py
git diff --check
```

Il runner usa esclusivamente `/var/run/docker.sock`, crea un container
`postgres:17-alpine` con `--network none`, nessuna porta o bind mount, cluster
su tmpfs, e lo elimina al termine. L'immagine deve essere già disponibile:
il runner usa `--pull=never` e non effettua download; non legge configurazioni o
credenziali Supabase e non accetta URL remoti. Fixture eseguibile soltanto su un
database usa-e-getta: crea ruoli, auth e messaggi minimi. Non applicare la fixture
a un progetto Supabase esistente.

La suite verifica il SQL reale, backfill, integrità delle ricevute, RLS e grant,
azioni, cursori, parametri invalidi, chiavi riutilizzate, creazione conversazioni,
rollback del trigger e quattro scenari concorrenti su connessioni distinte.

Su una copia Supabase, dopo revisione e autorizzazione separata: applicare soltanto
la migrazione nuova usando il flusso del progetto; usare due utenti autenticati
e un terzo estraneo per ripetere i casi tramite API/RPC reali. Verificare che
Svuota/Elimina/Archivia non cambino alcun messaggio, che nuovo messaggio e riavvio
mantengano lo stato server, e che i vecchi client continuino a inviare/leggere.
Misurare anche backfill e contesa. Nessun comando remoto è eseguito dal runner.


Estensione BLOCCO 2A: `supabase/tests/conversazioni_personali_2a.sql` aggiunge
verifiche di isolamento A/B, archivio, ricerca, non letti e retry tardivi. Il
runner verifica anche lo stato tra processi client nuovi. Vedere
`docs/blocco2a-chat-personali.md` per il blocco di verifica dello schema remoto
e i limiti: queste prove riguardano la proposta, non l’app già integrata.
