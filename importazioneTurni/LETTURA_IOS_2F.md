# BLOCCO 2F — lettura iOS locale con geometria

Condizioni iniziali rispettate: `feature/importa-turni-recupero`, HEAD `ec94c4b`,
working tree pulito. Consultata la documentazione Expo v57 indicata in AGENTS.md;
il codice usa le API effettivamente installate di Expo 54.0.37 / ExpoModulesCore
3.0.30, React Native 0.81.5. Nessun aggiornamento delle dipendenze.

## Codice di produzione

Il modulo Expo locale `modules/importazione-turni-ios` espone il bridge
`TurniDocumentiIOS`, versione contratto 1, soltanto su Apple/iOS. Usa framework di
sistema, senza modelli da scaricare, servizi a pagamento o invio documenti:

- **PDFKit**: apre il PDF locale, verifica protezione e numero pagine, estrae
  `PDFPage.string`, parole e coordinate con `selection(for:)`.
- **Vision**: riconoscimento `.accurate` in italiano/inglese, con correzione
  linguistica disattivata per non correggere nomi, matricole o orari arbitrariamente.
  Conserva righe originali e confidenza della riga; ricava le coordinate delle parole
  mediante `boundingBox(for:)`. La confidenza della singola parola resta null.
- **ImageIO**: controlla le dimensioni, crea una thumbnail in memoria con lato
  massimo 4096 e trasformazione EXIF. Non crea file intermedi o copie permanenti.

Accetta solo file diretti nelle cartelle DocumentPicker/ImagePicker della cache
dell'app, verificando percorso canonicalizzato, file regolare e dimensione. Il
chiamante ricontrolla MD5/dimensione prima e dopo la lettura, come nel blocco 2D.
Il lavoro nativo usa una coda seriale dedicata, senza bloccare il thread JS/UI.
Limiti: 20 MiB, 30 pagine PDF, 500.000 caratteri nativi, 20.000 parole,
5.000 righe strutturate; immagini originali fino a 40 megapixel. Il limite byte
non garantisce da solo un limite alla memoria interna di PDFKit/Vision.

**Non esiste un decoder simulato in produzione.** `letturaNativa.ios.ts` risolve
il modulo con `requireOptionalNativeModule`; se manca o ha un contratto diverso,
restituisce il blocco di lettura già gestito dalla schermata. Non ritorna fixture.

## Struttura dei prospetti

`geometriaIOS.ts` raggruppa parole allineate in righe e usa le posizioni delle
intestazioni riconosciute per assegnare le colonne. Supporta tabelle Data/orari,
Nome/Cognome/Matricola/Postazione e matrici dipendenti/date complete. Le celle
vuote rimangono nella propria colonna. Le intestazioni devono ricomparire su ogni
pagina: non vengono ereditate senza evidenza.

Le coordinate sono normalizzate con origine in alto a sinistra. Le celle composte
contengono parole ricomposte con spazi e gli ID dei token sorgente: sono una
ricostruzione, non una copia esatta della spaziatura originale. Il payload nativo
completo resta in `evidenzeIOS` nel risultato e nella copia originale della sessione;
testo PDF e righe Vision autentiche rimangono consultabili in tale payload.

La struttura ricostruita è sempre segnalata come da verificare, senza attribuire
una confidenza artificiale. Coordinate mancanti, righe ambiguamente allineate o
parole a cavallo delle colonne fanno tornare **l'intera pagina** al testo PDF o
alle righe Vision originali per mappatura manuale, senza perdere le righe dubbie.
Senza intestazioni supportate il documento resta da interpretare manualmente.

Le funzioni esistenti mantengono nome/matricola come suggerimenti, scelta manuale
di candidato/righe, correzione dell'identità, zeri iniziali, servizi multipli,
data finale esplicita delle notti, alternative e conferme obbligatorie. Nessuna
associazione automatica con codice GPG, account o trattamenti economici.

Il collegamento del blocco 2E resta in `modalitaVerifica: true`: identità e singole
voci sono revisionabili, ma conferma finale e **salvataggio nel calendario restano
disabilitati**. Non cambiano App.js, stipendi, chat, notifiche o Supabase.

## Compatibilità e configurazione controllate

- Pod locale: iOS **15.1**, Swift **5.9**, dipendenza `ExpoModulesCore` e soli
  framework Apple PDFKit/Vision/ImageIO, disponibili su questo deployment target.
  Le API Expo impiegate sono presenti nei sorgenti installati di 3.0.30.
- Expo 54 cerca già i moduli locali in `./modules`: non occorrono plugin aggiuntivi,
  modifiche a `app.json`, `app.config.js`, `eas.json`, manifest o lockfile.
- Il resolver Expo individua `TurniDocumentiIOSModule` / pod `TurniDocumentiIOS`
  su Apple. La sintassi Ruby del podspec è controllata; CocoaPods/Xcode non eseguiti.
- Il resolver Metro installato sceglie **`letturaNativa.ios.ts` su iOS** e lascia
  **`letturaNativa.ts` su Android**. Il nuovo modulo non compare nel resolver Android.
- Verificati anche i pacchetti già fissati: `expo-pdf-text-extract@1.1.0` e
  `expo-text-extractor@2.0.0`, pod iOS >=15.1 con ExpoModulesCore. Non sono rimossi
  né aggiornati e il nuovo adattatore iOS non li usa. Restano le precedenti
  esclusioni Android, senza patch o modifiche al loro comportamento.
- Camera e selezione foto conservano i permessi già configurati tramite
  `expo-image-picker` e Info.plist. Il riconoscimento locale Vision non richiede
  permessi aggiuntivi. La variante offline mantiene le proprie regole di isolamento.

Non sono emerse incompatibilità iOS dalle verifiche statiche. **Non è una prova
di compilazione o corretto funzionamento sul dispositivo.** Non è disponibile
una toolchain Xcode in questo ambiente e nessuna build è stata eseguita.

Riferimenti consultati:
- https://docs.expo.dev/versions/v57.0.0/
- https://docs.expo.dev/modules/module-api/
- https://developer.apple.com/documentation/pdfkit
- https://developer.apple.com/documentation/vision/vnrecognizedtext/boundingbox(for:)
- https://developer.apple.com/documentation/imageio

## Requisito di nuova build e collaudo ancora necessario

È necessaria **una nuova build nativa iOS**, da eseguire solo in un'attività futura
autorizzata, con autolinking e integrazione del pod locale. Un aggiornamento JS/OTA,
Expo Go o il binario precedente non possono aggiungere questo modulo. I file del
modulo locale devono essere inclusi nei sorgenti inviati alla build.

Da provare sul binario iOS risultante con documenti anonimizzati:

1. PDF testuale tabellare e matrice multipersona: allineamento, postazioni, nomi e
   matricole con zeri; intestazioni ripetute, celle vuote, token Unicode e simboli.
2. Foto e screenshot reali: qualità OCR, accenti, orientamenti EXIF, risoluzione e
   ricostruzione dei rettangoli. Il ridimensionamento può ridurre la leggibilità
   dei caratteri piccoli; non promette correzione prospettica o di foto sfocate.
3. Scelta/correzione manuale, servizi separati, notti e cambio mese, testo ambiguo,
   identificazione sbagliata, ritorno alla pagina originale e annullamento.
4. PDF protetti/corrotti, pagine senza testo, limiti, permessi negati, memoria e
   reattività, uscita durante elaborazione e pulizia effettiva dei temporanei.
5. Assenza di salvataggio definitivo e di effetti su calendario/stipendio.

I PDF scannerizzati restano **non supportati**: non si rasterizza il PDF per OCR.
Per PDF con rotazione diversa da zero si restituisce testo per revisione manuale,
con limite esplicito; non si inventano trasformazioni geometriche. Celle unite,
testo obliquo/prospettico e layout arbitrari richiedono selezione/mappatura manuale.

## Test automatici

```sh
node scripts/test-lettura-ios.cjs
node scripts/test-importazione-turni.cjs
node scripts/test-interpretazione-documenti.cjs
node scripts/test-acquisizione-documenti.cjs
node scripts/test-lettura-turni.cjs
node scripts/test-importa-turni-calendario.cjs
npm run typecheck
```

Il nuovo test esercita struttura geometrica, bridge, errori e revisione con
**payload nativi sintetici e modulo simulato soltanto nel test**; usa il resolver
Metro reale per verificare la separazione iOS/Android. Queste prove non eseguono
PDFKit/Vision e non attestano l'accuratezza OCR su file binari reali.

Nessun commit, push, build, deploy o modifica ad Android durante il blocco 2F.
