# Acquisizione documenti — blocco 2C

Moduli nuovi, nessun collegamento ad App.js o calendario:

- `acquisizione.ts`: flusso, metadati, verifica e ciclo di vita temporaneo.
- `acquisizioneExpo.ts`: adattatore iniettabile alle API locali Expo.
- `acquisizioneNativa.ts`: factory per i moduli nativi reali iOS/Android.
- `scripts/test-acquisizione-documenti.cjs`: test con file e selettori virtuali.

## Verifica delle librerie

Versioni nel lockfile, corrispondenti ai package.json effettivamente presenti
nell'installazione già disponibile del progetto:

| Libreria | Versione | API verificate nei tipi e sorgenti installati |
| --- | --- | --- |
| expo | 54.0.37 | Stack del progetto, senza aggiornamenti |
| expo-document-picker | 14.0.8 | getDocumentAsync, canceled/assets, MIME/size/URI |
| expo-image-picker | 17.0.11 | launchImageLibraryAsync, launchCameraAsync, requestCameraPermissionsAsync |
| expo-file-system | 19.0.24 | /legacy: cacheDirectory, getInfoAsync, readAsStringAsync, deleteAsync |

Il worktree non contiene una nuova installazione di node_modules. Le dipendenze
esistenti sono state lette senza modificarle. Nessuna libreria aggiunta.
Il contratto nativo è verificato staticamente con TypeScript contro quei tipi;
non sono state eseguite build o prove su telefoni.

## Uso e separazione dei livelli

La futura schermata crea un'istanza con `creaAcquisitoreNativo()` e chiama
`acquisisci({ canale: 'documento' })`, oppure galleria/fotocamera. Il tipo
screenshot va dichiarato con `tipoImmagine: 'screenshot'`: il nome del file non
basta a riconoscerlo. L'esito è pronto, annullato oppure errore con codice stabile.
Non si restituiscono messaggi nativi che possano contenere percorsi personali.

Un risultato pronto contiene URI locale temporaneo, nome e MIME originali
nullable, MIME ricavato dalla firma, formato, dimensione effettiva, dimensione
dichiarata e dimensioni immagine se disponibili. Non contiene testo OCR, pagine
inventate, turni o conferme. Il tipo sorgente usa il contratto del blocco 1.

Un futuro estrattore riceverà il descrittore in memoria, leggerà il file prima
del rilascio e produrrà le pagine reali del contratto `DocumentoEstratto` del
blocco 2B. Solo dopo potrà essere invocato `interpretaDocumento`. La selezione
non chiama nessuno di questi livelli e non salva nel calendario.

## Validazione

PDF, JPEG e PNG sono l'unico insieme ammesso. Non si supportano direttamente
HEIC/HEIF, GIF, WebP, video o live photo. Se il sistema restituisce effettivamente
un JPEG/PNG convertito, sono la firma e il MIME restituito a determinarne
l'accettazione; non viene effettuata alcuna conversione dal modulo.

Si controllano esistenza, file non directory, dimensione nota positiva entro
20 MiB (20 * 1024 * 1024), MIME e primi 16 byte. Nessuna lettura del testo o
base64 dell'immagine intera. MIME assente/octet-stream può essere determinato
dalla firma; un MIME dichiarato specifico diverso o incoerente viene rifiutato.
Il nome originale non decide il formato: una sua discordanza produce un avviso.

`verifica: 'firma_iniziale'` non significa decodifica o validazione completa:
un file corrotto dopo l'intestazione, un PDF protetto o un'immagine con dimensioni
non gestibili richiederanno controlli nell'estrattore. I test usano firme binarie
sintetiche, non documenti validati da un decoder PDF/immagini.

Il limite viene applicato dopo il selettore: il provider di sistema può avere
già copiato un file grande in cache. Il modulo lo scarta e tenta la pulizia
prima di leggerne la firma. I file custoditi soltanto da iCloud/Drive o da altre
app potrebbero richiedere un download del provider; questo modulo non apre
connessioni, non scarica URL e non invia documenti a server.

## Permessi e copie temporanee

DocumentPicker usa copyToCacheDirectory e selezione singola. Galleria e camera
usano solo immagini, niente modifica/crop, EXIF restituiti o base64 integrale.
Non si richiede un accesso generale alla galleria ai selettori moderni.
Per la fotocamera si verifica il permesso prima di aprirla. Un diniego viene
restituito senza procedere. EXIF false evita la restituzione dei metadati,
non garantisce che il file originale sia stato privato di ogni metadato.

Sono accettati solo file diretti nelle sottocartelle cache DocumentPicker o
ImagePicker, verificate anche nei sorgenti nativi installati. Il modulo non
legge né elimina URI remoti, content URI, percorsi permanenti o traversal.
Non si fanno copie aggiuntive e non si usa documentDirectory, storage locale,
database, Supabase, notifiche o log con documenti.

Le cancellazioni sono ristrette agli URI restituiti dalla stessa istanza dei
selettori. Non si svuotano cartelle condivise né altri file della cache.

**Obbligo del chiamante:** per ogni risultato pronto, invocare `rilascia()` in
un `finally`, anche se la futura estrazione fallisce. Dopo rilascio l'URI non
è più utilizzabile. L'operazione è idempotente e gestisce chiamate concorrenti.
In caso di file rifiutato il modulo tenta direttamente la cancellazione.

Un errore di pulizia è esplicito (`puliziaRiuscita`/`riuscita` false), resta
in memoria e può essere ritentato con `riprovaPulizia`; nuove acquisizioni si
bloccano se quei residui non sono eliminabili. Nessun registro viene scritto
su disco. Un crash o una terminazione del processo possono lasciare copie
nella cache del sistema: non si promette cancellazione immediata in quel caso.
Non vengono create copie permanenti o salvate immagini nella libreria foto.

## Test e collaudo successivo

```sh
node scripts/test-acquisizione-documenti.cjs
node scripts/test-importazione-turni.cjs
node scripts/test-interpretazione-documenti.cjs
npm run typecheck
```

I test usano Node 24 e porte locali simulate; nessun documento personale o
servizio esterno. Per typecheck si possono riutilizzare le dipendenze esistenti
tramite collegamento temporaneo, rimuovendolo dopo il controllo.

Da collaudare in una successiva build autorizzata: selettori Files/iCloud/Drive,
galleria, camera e diniego su iOS/Android fisici; URI cache restituiti, firma,
annullamento e pulizia effettiva. Web escluso da questo contratto.
