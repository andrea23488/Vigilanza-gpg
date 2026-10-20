# Blocco 2D — lettura locale e revisione controllata

Implementazione parziale per incompatibilità Android verificata nei pacchetti.
Non è un'importazione completa già disponibile nel calendario.

## Componenti

- `lettura.ts`: flusso iniettabile di decodifica PDF per pagina e OCR immagini;
  conserva testo, frammenti, pagine fallite e risultati parziali. Non esegue rete.
- `letturaNativa.ts`: adattatore reale **solo iOS**, con import differiti e blocco
  esplicito se i moduli non sono presenti nel binario.
- `revisione.ts`: sessione di revisione; suggerimenti per nome completo o matricola,
  scelta candidato, selezione manuale alternativa delle righe, mappatura manuale
  delle celle, intestazioni manuali e controllo duplicati prima della conferma.
- `ImportaTurni.tsx`: schermata autonoma per acquisizione e anteprima modificabile.
  **Non montata in App.js**: nessun punto d'ingresso o logica calendario modificato.
  Le proprietà obbligatorie sono registro revisioni, lettura aggiornata degli
  esistenti normalizzati dello stesso utente e callback di bozza confermata.
  Il componente non contiene una funzione di salvataggio.
- `interpretazione.ts`: estensione opzionale `righeManuali` (`paginaId/rigaId`).
  Recupera le voci delle righe scelte anche con identità assente o errata, conserva
  tutti i servizi della riga e lascia l'identità non confermata. La semantica
  precedente rimane invariata quando l'opzione non è fornita.

## Verifica delle dipendenze

Consultata prima di scrivere codice la documentazione richiesta:
https://docs.expo.dev/versions/v57.0.0/ . Il progetto resta su **Expo 54.0.37**,
React Native 0.81.5, React 19.1.0, ExpoModulesCore 3.0.30.

Versioni fissate nel manifest e nel lockfile:

| Pacchetto | Versione | Verifica |
| --- | --- | --- |
| expo-pdf-text-extract | 1.1.0 | Peer Expo >=49, RN >=0.72, React >=18; iOS PDFKit, iOS >=15.1, Swift 5.9 |
| expo-text-extractor | 2.0.0 | Sviluppato con Expo ^54.0.33 e RN 0.81.5; iOS Vision, iOS >=15.1, Swift 5.9 |

Ispezionati i pacchetti effettivamente installati, non soltanto i README:
entrambi i Gradle Android richiamano
`expo-modules-core/ExpoModulesCorePlugin.gradle`, **assente** in 3.0.30.
L'OCR Android usa inoltre la variante Play Services con modello scaricabile.
Non è stata introdotta alcuna patch Gradle, modifica ai requisiti OS o workaround.
Entrambi sono esclusi tramite `expo.autolinking.android.exclude` in package.json.
L'adattatore rifiuta Android prima di importare i decoder.

Il resolver Expo installato è stato eseguito senza compilare: nessuno dei due
decoder è collegato su Android, entrambi sono individuati su Apple. I sorgenti iOS
usano le API ExpoModulesCore presenti nell'installazione. Il typecheck passa.
**Queste sono verifiche statiche, non un collaudo nativo**: occorre una futura build
iOS autorizzata e una prova su dispositivo prima di dichiarare operativo l'OCR.
Expo Go o un binario precedente restituiscono `DECODER_LOCALE_NON_DISPONIBILE`.

Fonti dei pacchetti:
https://github.com/gr8pathik/expo-pdf-text-extract
https://github.com/pchalupa/expo-text-extractor

## Cosa legge e cosa richiede intervento manuale

L'adattatore chiama realmente `getPageCount`/`extractTextFromPage` sul file PDF
locale e `extractTextFromImage` sulle fotografie/screenshot locali. Non simula
risultati quando manca un decoder. Gli screenshot sono dichiarati dal chiamante.

Il parser automatico richiede righe/celle con separatori espliciti: tab, `|` o `;`.
Supporta le tabelle e matrici del blocco 2B, più dipendenti e più servizi per data.
**Molti PDF e i frammenti OCR non conservano questi separatori**: in quel caso
si restituiscono righe originali non strutturate, da mappare manualmente nella UI.
Non si promette riconoscimento automatico di tabelle fotografiche arbitrarie.
Gli spazi multipli non diventano colonne; separatori misti restano ambigui.
Le celle vuote occupano la loro posizione. Una mappatura registra separatamente
le celle inserite dall'utente e conserva la riga originale come evidenza dei campi.
Si può aggiungere un'intestazione manuale senza sacrificare una riga del documento.

L'OCR non fornisce coordinate/confidenze: restano null. I frammenti non vengono
concatenati fingendo un testo globale originale. Le righe restano riferibili alla
pagina e al frammento ricevuto; l'ordine OCR deve essere verificato dall'utente.
Raddrizzamento prospettico, celle unite e ricostruzione geometrica non implementati.
Le immagini HEIC non sono supportate dall'acquisizione salvo conversione JPEG/PNG
effettuata dal selettore di sistema. La rotazione delle fotografie va collaudata.

I PDF scannerizzati senza testo incorporato sono segnalati esplicitamente:
**rendering PDF + OCR non implementati**. PDF protetti bloccati senza richiedere
o memorizzare password. Pagine fallite non spariscono; per confermare un risultato
parziale serve un'accettazione distinta, registrata nella ricevuta.

Date con anno mancante, ore come `O6:00` e codici sconosciuti non vengono inventati.
Notte senza data finale: giorno successivo soltanto come alternativa, nessuna ora
certa finché l'utente non corregge/conferma. I servizi multipli mantengono ID distinti.
Nessun mapping automatico di MF o delle causali verso trattamenti economici.

## Conferme e duplicati

Suggerimenti tramite nome o matricola senza conferme automatiche. Il nome completo
non viene separato arbitrariamente; gli zeri della matricola restano significativi.
Non viene effettuata alcuna associazione con `codice_gpg` o account Supabase.
Scelta manuale disponibile anche con un candidato unico, più candidati o nessuno.

Identità, singole voci ed esclusioni vengono revisionate tramite il modello
esistente. Le modifiche invalidano la conferma finale; cambiare dipendente invalida
le conferme delle voci. Nella UI, modifiche locali non ancora confermate impediscono
la conferma finale. La callback è emessa soltanto dal pulsante di conferma esplicita.

Due controlli separati:

1. Impronta **MD5 + dimensione dei byte**, verificata prima e dopo la lettura:
   filtro per copie identiche con nomi/URI diversi, distinto per dipendente.
   MD5 non certifica autenticità e non protegge da collisioni intenzionali.
2. Duplicati e sovrapposizioni delle voci, confrontati con gli esistenti forniti
   obbligatoriamente al momento della conferma, compresa la notte precedente.

Il registro è in memoria o ricostruito da ricevute fornite dal chiamante. Una
ricevuta significa **bozza confermata**, non importazione eseguita. Non si scrive
un registro persistente, non si chiamano API e non si modificano record esistenti.
Il filtro per documento è conservativo: una conferma parziale consuma la revisione
di quel documento/dipendente nel registro corrente. Non certifica identità aziendali.
Riesportazioni o ricodifiche cambiano l'impronta: servono comunque i confronti delle
voci. Senza un futuro salvataggio atomico/idempotente lato server non è garantita
la deduplicazione tra dispositivi o dopo riavvio; quel salvataggio è fuori ambito.

## Ciclo di vita e limiti

Il componente rilascia l'acquisizione in `finally` anche dopo errore o smontaggio.
L'anteprima conserva soltanto testo e strutture in memoria, non il file binario:
non è un visualizzatore PDF/immagini. Pulizia fallita esplicita con possibilità
di retry. Un crash può lasciare residui nella cache, come nel blocco 2C.
Limiti: 20 MiB acquisiti, 30 pagine, 500.000 caratteri, 5.000 righe complessive.
La UI mostra progressivamente righe/voci a gruppi di 50. Il limite byte non
garantisce un limite alla memoria usata internamente dal decoder nativo.

Non modificati: App.js, logiche calendario, API Supabase, motore stipendiale,
straordinari, indennità, chat e notifiche. Nessun servizio remoto o invio documenti.
Le ore dell'anteprima sono nominali e provvisorie, non una stima stipendiale.

## Test

Con Node 24:

```sh
node scripts/test-importazione-turni.cjs
node scripts/test-interpretazione-documenti.cjs
node scripts/test-acquisizione-documenti.cjs
node scripts/test-lettura-turni.cjs
npm run typecheck
```

I nuovi test verificano orchestration e revisione con decoder simulati. Non sono
prove di decodifica binaria PDF/OCR reali. Coprono servizi multipli, notti esplicite
e ambigue, errori pagina, limiti, selezione manuale, evidenza originale, duplicati,
lettura parziale e assenza di scritture/rete nel flusso. Nessuna build/deploy eseguita.
