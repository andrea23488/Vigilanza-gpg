# Vigilanza GPG Beta — preparazione locale isolata

Questa cartella non cambia entry, configurazioni o profili dell’app ufficiale.
Bundle: `com.vigilanzagpg.app.beta`. Nome: **Vigilanza GPG Beta**.
Scheme: `vigilanzagpg-beta`. Profilo: `ios-beta`, ad hoc, Release, senza dev client.
OTA disabilitato, nessuna capability condivisa (push, Watch, App Group, Keychain).

## Interfaccia

Riusa i componenti reali HomeScreen, SocialScreen, TurniCondivisiView, ColleghiSocialScreen,
SettingsScreen, AspettoColoriScreen e tutti i componenti dei temi.
Dati coerenti generati all’avvio, due omonime distinguibili, date locali e
selezione di oggi. Le preferenze colori usano il sistema originale, su storage
con prefisso Beta e nel sandbox iOS distinto. L’anteprima a schermo intero
mantiene i controlli operativi disabilitati dal componente originale.

Non è una prova dei servizi reali. Editor manuale, account/biometria, invii,
richieste, condivisioni, documenti/link esterni e servizi online sono disabilitati
esplicitamente. Chat mostra solo un elenco sintetico. Strumenti offre i percorsi
locali sicuri (Calendario, riepilogo ore, tavolozza); gli altri strumenti che
richiedono servizi non sono caricati. Il riepilogo economico è solo dimostrativo:
nessuna modifica al motore stipendiale. Importa turni non viene incluso.

Il Calendario usa la variante locale `betaIos/CalendarScreen.js` e il modello
transazionale `betaIos/rapidOperations.js`; il pianificatore `turniRapidiAnteprima.js`
e i calcoli esistenti restano riutilizzati. Un giorno libero inserisce subito il
turno; una giornata già occupata apre i dettagli e richiede una scelta esplicita
se non c’è sovrapposizione. Duplicati e conflitti sono bloccati. Elimina apre il
servizio, o una lista se ci sono più turni, e richiede una sola conferma finale.
Annulla ultima operazione ripristina lo snapshot solo se i dati non sono cambiati.
Le proposte sono applicate esclusivamente ai fixture in memoria della Beta.
`commitRapidWithAdapter` verifica una risposta positiva prima di pubblicare una
modifica; per l’eventuale app ufficiale l’adapter può chiamare il coordinatore
esistente di inserimento/eliminazione senza duplicare il planner.

La schermata conserva le frecce e la gesture orizzontale sul calendario, non
cattura scroll verticali, tap o pressioni lunghe, e usa la safe area già lasciata
libera dal banner Beta. I comandi rapidi restano compatti sopra la griglia.

## Controlli

Dal worktree: `node --test betaIos/test-*.cjs scripts/test-*.cjs homePreview/test-*.cjs`,
`node_modules/.bin/tsc --noEmit -p betaIos/tsconfig.json`.
`node betaIos/prepare.cjs` crea in /tmp una copia esterna con i soli sorgenti
ammessi, compresi quelli non tracciati. Non usa Git per selezionare un vecchio
commit e non installa né avvia servizi. SOURCE-MANIFEST.json contiene gli SHA256.
L’archivio va rigenerato dopo ogni modifica ai sorgenti. Non usare il vecchio
preparatore offline-test o la configurazione EAS della root ufficiale.

Il resolver ammette solo i componenti UI/puri elencati in policy.cjs e sostituisce
il solo helper puro usato dal modello Turni condivisi, senza caricare la sua API.
Blocca SDK cloud, file download, browser, notifiche, Watch e credenziali native.
Il bootstrap controlla Bundle Identifier nativo e manifest prima della UI e poi
blocca fetch, XHR, WebSocket e EventSource. Linking e immagini URI remote sono
neutralizzati anche a livello React Native. Nessuna sessione reale viene creata.

## Progetto EAS Beta collegato (5G)

- Nome: @celest16/vigilanza-gpg-beta
- Project ID: 6cf2c4f8-45bc-488e-ba7e-49501be2f3f8
- Account: celest16
- Configurazione persistente: project.json, incluso dal preparatore nella copia.

Il progetto è stato creato separatamente dall’ufficiale. Nessuna build, firma,
registrazione dispositivo o modifica a Supabase è stata eseguita.
Il profilo ios-beta è validato con lo schema reale EAS. Nessuna variabile
Supabase è necessaria. Il guard rifiuta variabili di servizio e l’UUID ufficiale.
BETA_EAS_PROJECT_ID è facoltativo; se impostato deve coincidere esattamente con
project.json. Non può cambiare implicitamente il progetto di destinazione.

La CLI 25.3.0 è già nella cache npm del Codespace. Per validare lo schema nei
test in altri ambienti si può impostare BETA_EAS_CLI_ROOT al pacchetto installato.

## Prossimi comandi, SOLO dopo autorizzazione

Preparare una nuova copia dal worktree (nessuna operazione remota):

```bash
cd /workspaces/vigilanza-gpg-home
node -e 'const p=require("./betaIos/prepare.cjs").prepare(); console.log(p.destination)'
```

Entrare nella directory /tmp stampata, quindi impostare:

```bash
export BETA_EAS_CLI='/home/codespace/.npm/_npx/6bc7bae5c2059953/node_modules/eas-cli/bin/run'
export APP_VARIANT=isolated-beta
export EXPO_NO_DOTENV=1
export EAS_NO_VCS=1
export EAS_PROJECT_ROOT="$PWD"
export BETA_EAS_PROJECT_ID='6cf2c4f8-45bc-488e-ba7e-49501be2f3f8'
```

L’UUID è quello Beta già verificato; la variabile può anche essere omessa. Non impostare variabili
EXPO_PUBLIC/Supabase/OTA. Se presenti nell’ambiente, rimuoverle solo dalla
shell dedicata alla Beta, senza modificare credenziali o ambienti ufficiali.

Collegare/verificare il progetto (l’UUID è già fornito dalla configurazione):

```bash
node "$BETA_EAS_CLI" project:init --id "$BETA_EAS_PROJECT_ID" --no-icon --non-interactive
node "$BETA_EAS_CLI" project:info
node "$BETA_EAS_CLI" device:list --apple-team-id CAA4U7J8QJ --non-interactive
```

Confrontare l’UDID prima di registrare un altro dispositivo. Solo se necessario,
con autorizzazione alla registrazione:

```bash
node "$BETA_EAS_CLI" device:create
```

Aprire sull’iPhone il link/QR della procedura. Verificare successivamente che il
provisioning ad hoc della nuova app includa il dispositivo. Nessun certificato
va creato o revocato automaticamente senza approvazione.

Ispezione locale, da eseguire prima di autorizzare la build:

```bash
node "$BETA_EAS_CLI" build:inspect --platform ios --profile ios-beta --stage archive --output /tmp/vigilanza-beta-eas-inspect-prossima
```

Usare un percorso output nuovo. Solo dopo ULTERIORE autorizzazione:

```bash
node "$BETA_EAS_CLI" build --platform ios --profile ios-beta
```

Nessun auto-submit. Il profilo è ad hoc, non TestFlight. Installazione dal link
EAS sul dispositivo incluso nel provisioning. Una build nativa non è ancora
stata eseguita, quindi avvio e fluidità sull’iPhone restano da collaudare.

## Correzione bundling iOS

Il root della copia preparata contiene package.json; betaIos contiene soltanto
l’entry e i componenti Beta. Metro deve chiamare getDefaultConfig sulla radice
prima di ricavare qualsiasi impostazione, non correggere projectRoot dopo.

Expo CLI 54 imposta EXPO_PUBLIC_PROJECT_ROOT durante export:embed (metadata
locale per il runtime Metro). buildEnvironment.cjs accetta esclusivamente questa
chiave, solo se è un percorso assoluto che risolve alla radice Beta verificata.
Tutte le variabili di servizio, incluse altre EXPO_PUBLIC, Supabase e OTA,
restano vietate. La diagnostica indica solo i nomi, mai i valori.

Prima di un nuovo tentativo remoto verificare il bundling iOS nella NUOVA copia
preparata, usando export:embed con --platform ios e --dev false, oltre a test,
typecheck e build:inspect --stage archive. Non riutilizzare la copia fallita ETvlaP.
La sola ispezione archive controlla i file ma non esegue Metro.

Il preset Babel viene risolto attraverso il pacchetto Expo già installato, così
funziona sia con dipendenze hoisted sia annidate, senza nuovi pacchetti.

Il resolver riconosce soltanto il registro asset virtuale esatto creato da Expo
(`\0polyfill:assets-registry` per il modulo @react-native/assets-registry/registry).
Gli altri identificativi virtuali e tutti i moduli di servizio restano vietati.

Controllo ripetibile, senza build native/remote né installazioni:

```bash
cd /workspaces/vigilanza-gpg-home
node betaIos/check-bundle.cjs
```

Crea una copia nuova e un export iOS temporaneo con bundle e sourcemap; verifica
che API e SDK di produzione non siano inclusi e rimuove il solo link temporaneo
alle dipendenze locali. Non elimina variabili di servizio: se presenti, fallisce.
Il percorso stage stampato è la nuova copia da ispezionare con EAS.

## Dipendenze riproducibili e macOS Apple Silicon

Il lockfile canonico è betaIos/package-lock.json. È stato generato dal solo
manifest Beta in una directory vuota, senza node_modules né collegamenti al
worktree. Non deriva dal lockfile o dalle dipendenze dell’app ufficiale.

prepare.cjs valida la compatibilità darwin/arm64 e copia quel lockfile in ogni
nuova copia; nessun npm install o package-lock-only è necessario nella copia.
Il controllo rifiuta link e percorsi esterni, pacchetti ngrok/cloud esclusi,
versioni dirette diverse e pacchetti obbligatori incompatibili con macOS arm64.
I pacchetti specifici di altre piattaforme restano leciti solo se opzionali.
Un hook eas-build-pre-install ricontrolla struttura, lockfile e SHA256 prima di
npm ci. Il node_modules della copia non deve essere un link al worktree.

Preparare la prossima copia:

```bash
cd /workspaces/vigilanza-gpg-home
node betaIos/dependencies.cjs
node -e 'const p=require("./betaIos/prepare.cjs").prepare(); console.log(p.destination)'
```

Operare poi soltanto dalla directory stampata. Non copiarvi node_modules,
package-lock.json o altri file dall’app ufficiale; non rigenerare il lockfile
con il node_modules condiviso. EAS userà il lockfile Beta già incluso.
Per una verifica locale dell’installabilità, in una copia nuova senza link:

```bash
npm ci --include=dev --ignore-scripts --os=darwin --cpu=arm64 --no-audit --no-fund
```

Su Linux questa prova simula la selezione piattaforma di npm e non esegue
binari macOS né certifica compilazione nativa o firma. Per aggiornare in futuro
il lockfile, usare una directory vuota con il solo manifest Beta e
npm install --package-lock-only --ignore-scripts --os=darwin --cpu=arm64,
poi validare prima di sostituire il lockfile canonico. Non farlo sulla copia
con node_modules collegato per il controllo di bundling.
