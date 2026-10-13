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

app.config.js verifica soltanto URL, marker TEST, dotenv disabilitato, flag push
false e progetto EAS. Non legge né valida la chiave dedicata durante i metadati,
anche con EAS_BUILD=true. EAS può leggere projectId e risolvere i plugin prima
e dopo il caricamento delle Sensitive. Questo NON autorizza compilazione.
La funzione validateEnvironment usata dal preflight richiede sempre la chiave:
non esiste più un parametro configOnly che possa saltare il controllo.

Il hook eas-build-pre-install verifica tutto prima di installazione/prebuild:
chiave obbligatoria, profilo, identificativi e assenza di cartelle ios/android
pregenerate. Il hook rifiuta --offline: la verifica online non può essere saltata nella build.
La verifica online usa soltanto GET sul gateway REST del progetto
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
valutata con @expo/config 12.0.14 (SDK 54) e comando Expo CLI reale, con plugin
risolti ma senza prebuild o compilazione nativa.
Sorgenti apple-targets 4.0.6, dev-client 6.0.21 e WatchConnectivity 2.0.0 verificati.
I pacchetti di verifica sono fuori dal repository: nessuna nuova dipendenza
applicativa. Non sono stati interrogati il gateway Supabase, EAS o Apple con
credenziali durante queste verifiche. Provisioning e binario richiedono la
successiva prova autorizzata; non sono dichiarati verificati localmente.

## Diagnostica senza credenziali

I guard emettono soltanto codici fissi, mai valori, header o risposte Auth.
SDK54 config --json silenzia console.error: il guard dei metadati scrive soltanto
il codice su stderr, mentre il preflight riporta lo stesso codice senza dettagli:

- PUSH_TEST_KEY_MISSING: configurare la variabile dedicata Sensitive su EAS.
- PUSH_TEST_KEY_FORMAT / KEY_ROLE_INVALID / KEY_PROJECT_MISMATCH / KEY_EXPIRED
  (tutti con prefisso PUSH_TEST_): chiave non ammissibile per il TEST.
- PUSH_TEST_KEY_UNCONFIRMED: verifica gateway TEST fallita o indisponibile;
  compilazione bloccata, senza fallback.
- PUSH_TEST_URL_MISMATCH / DOTENV_ENABLED / FALLBACK_KEY / PUSH_ENABLED
  (prefisso PUSH_TEST_): configurazione di isolamento non rispettata.
- PUSH_TEST_PROFILE_MISMATCH / MARKER_INVALID / PLATFORM_INVALID /
  EAS_PROJECT_MISMATCH (prefisso PUSH_TEST_): selezione profilo/progetto errata.
- PUSH_TEST_NATIVE_DIR_PRESENT / NATIVE_ISOLATION: isolamento nativo non valido.
- PUSH_TEST_INTERNAL: errore inatteso; nessun messaggio esterno viene riportato.

Controllo automatico del comando Expo reale e dei plugin, senza prebuild:
`node scripts/test-push-test-expo.cjs`. Richiede dipendenze del lockfile già
installate, senza scaricarle automaticamente. Il test usa un fixture temporaneo
senza .env, sole chiavi sintetiche e blocco delle connessioni di rete; verifica
sia TEST sia produzione. Non dimostra il provisioning o una build EAS riuscita.

## Formato Publishable opaco

Il preflight tratta sb_publishable_ separatamente dai JWT legacy: suffisso
non vuoto, solo ASCII stampabile senza whitespace/controlli (0x21–0x7E),
lunghezza totale massima 4096. Non presume un alfabeto Base64 né una lunghezza
minima del suffisso. Non corregge o tronca valori. Chiavi sb_secret_ e JWT
legacy privilegiati restano rifiutati. Il controllo locale non dimostra che
una chiave sia autentica: conferma gateway TEST sempre obbligatoria nel hook,
con timeout 15 secondi, redirect vietati e compilazione bloccata su errore.
