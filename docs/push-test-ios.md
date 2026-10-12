# Profilo iPhone push-test-ios — non attivato

Solo progetto Supabase TEST `ilmhjsrxhnishnbocrnm`. Nessuna build, modifica
remota, migrazione, deploy o notifica eseguita durante la preparazione.

## Configurazione

Nuovo profilo interno Release per iPhone fisico, senza development client e
senza ereditarietà da production/development/preview. `EXPO_NO_DOTENV=1`:
nessuna lettura del `.env` da parte degli strumenti Expo per questo profilo.
URL Supabase fisso, flag registrazione push `false`, progetto EAS esplicito.
La chiave generica è sovrascritta con un marcatore non valido per evitare che
una chiave originale ereditata venga incorporata nel bundle TEST.

La chiave dedicata `EXPO_PUBLIC_PUSH_TEST_SUPABASE_PUBLISHABLE_KEY` va creata
nella Dashboard EAS del progetto `3f83a3a9-df1a-4dcc-beaf-8c390f52eca2`, scope
Project, ambiente Development, visibilità Sensitive, tipo String. Copiare
solo la chiave Publishable del progetto Supabase TEST nella Dashboard EAS:
non in chat, terminale, file o repository. Non utilizzare service_role,
sb_secret o il JWT signing secret. Non creare globalmente le altre variabili
del profilo: sono già fissate in eas.json.

La chiave pubblicabile è destinata al client e sarà presente nell'app compilata;
Sensitive evita l'esposizione ordinaria nei log EAS, non la rende un segreto
nel binario. La variabile dedicata non sostituisce quelle dei profili originali.

## Identificativi e Watch

La configurazione dinamica restituisce quella originale senza modificarla per
i profili esistenti. Solo TEST: bundle `com.vigilanzagpg.app.pushtest`, nome
riconoscibile e scheme `vigilanzagpg-pushtest`, piattaforma iOS.
`@bacons/apple-targets` è escluso dal profilo TEST, così i sorgenti targets/watch
e targets/watch-widget restano nel repository ma non generano estensioni.
App Groups e keychain access groups condivisi vengono rimossi soltanto dal
config TEST; gli eventuali appExtensions EAS vengono esclusi.
Il plugin expo-dev-client non aggiunge lo scheme exp+slug condiviso nel TEST.
Il modulo WatchConnectivity resta installato: il pod collega il framework iOS,
non crea target Watch o entitlement di gruppo. La build TEST non ha una
companion Watch. Nessun sorgente Watch ufficiale è modificato.

Per il nuovo bundle occorre un App ID/provisioning dedicato, con push capability
e iPhone registrato per distribuzione interna. La chiave APNs del team può
servire più App ID se autorizzata: la verifica dell'app ufficiale non dimostra
che il nuovo provisioning sia già pronto. Non cambiare quello ufficiale.
EAS projectId e team Apple rimangono quelli attuali: isolamento dell'app e di
Supabase, non creazione di un altro account/progetto Expo.

## Controlli bloccanti

app.config.js verifica URL, marker TEST, dotenv disabilitato, flag push false,
progetto EAS e formato/tipo della chiave. Durante la sola risoluzione iniziale
locale dei metadati EAS la chiave può essere assente: EAS CLI deve prima leggere
il projectId per scaricare le Sensitive. Questo NON autorizza compilazione.
Nel processo EAS_BUILD=true la chiave deve essere presente.

Il hook eas-build-pre-install verifica tutto prima di installazione/prebuild:
chiave obbligatoria, profilo, identificativi e assenza di cartelle ios/android
pregenerate. La verifica online usa soltanto GET sul gateway REST del progetto
TEST, con timeout e redirect vietati; non effettua login né SQL. Una chiave
opaca sb_publishable non dimostra il progetto offline: errore/rete indisponibile
bloccano la compilazione. Il hook non stampa chiavi, header o risposte.
Nei profili originali il hook è un no-op.

Il client Supabase seleziona la chiave dedicata solo nel TEST. App.js importa
URL e chiave da quel client anche per le chiamate HTTP dirette: nessun fallback
alla chiave del `.env`. Nei profili originali vengono utilizzati gli stessi
valori e le stesse opzioni di prima.

Non rimuovere questi gate, non utilizzare --local né un progetto nativo già
generato per aggirarli, non attivare debug/trace che stampino variabili o header.
Nessun invio viene abilitato configurando la chiave. Una build futura e
provisioning, deploy, migrazioni e attivazione richiedono autorizzazioni distinte.

## Verifiche eseguite

Test automatici di isolamento con sole chiavi sintetiche, inclusi confronto
con i profili originali e client originale, errori, fallback e gateway simulato.
Schema e risoluzione EAS verificati con @expo/eas-json 24.13.0. Config dinamica
valutata con @expo/config 12.0.14 (SDK 54), senza eseguire plugin/prebuild nativi.
Sorgenti apple-targets 4.0.6, dev-client 6.0.21 e WatchConnectivity 2.0.0 verificati.
I pacchetti di verifica sono fuori dal repository: nessuna nuova dipendenza
applicativa. Non sono stati interrogati il gateway Supabase, EAS o Apple con
credenziali durante queste verifiche. Provisioning e binario richiedono la
successiva prova autorizzata; non sono dichiarati verificati localmente.
