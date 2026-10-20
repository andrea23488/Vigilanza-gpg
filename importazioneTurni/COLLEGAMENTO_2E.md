# Blocco 2E — accesso dall'Agenda, solo verifica

Condizioni iniziali verificate: branch `feature/importa-turni-recupero`, HEAD
`52e2e86`, working tree pulito. Consultata la documentazione Expo v57 richiesta;
nessun aggiornamento delle dipendenze Expo 54 già installate.

## Flusso disponibile

In **Calendario / Agenda**, sopra la scelta del mese, il pulsante **Importa turni**
mostra **IN VERIFICA** e **Salvataggio disabilitato**. Apre la schermata già presente
nel progetto, con pulsante **Torna al calendario**. Mese, anno e turni restano
invariati. La schermata usa un solo ScrollView, senza annidarlo in quello dell'Agenda.

Sono disponibili selezione PDF/immagine, foto dalla galleria, screenshot dichiarato
e fotocamera. Per un documento riconosciuto restano utilizzabili anteprima,
selezione dipendente, selezione/mappatura manuale delle righe, modifica delle voci,
servizi multipli, correzione delle notti ambigue ed esclusioni del blocco 2D.
Nome e cognome del profilo sono suggerimenti: la matricola aziendale non viene
derivata dal codice GPG.

La nuova proprietà discriminata `modalitaVerifica: true`:

- non accetta callback di conferma o lettura dei turni esistenti;
- nasconde la conferma finale e blocca anche il relativo handler;
- mostra un pulsante di salvataggio sempre disabilitato e un avviso esplicito;
- mantiene la bozza soltanto nella schermata; uscendo viene scartata.

Le conferme di identità e singole voci riguardano soltanto l'anteprima in memoria.
Non viene registrata una conferma finale, non si chiamano API del calendario e non
viene prodotto alcun salvataggio. Nessuna modifica a Supabase, stipendio,
straordinari, indennità, notifiche o chat. Nessuna dipendenza aggiunta.

## Cosa si può provare su dispositivo

| Ambiente | Provabile | Limiti già presenti nel blocco 2D |
| --- | --- | --- |
| iOS con decoder inclusi nel binario | Apertura dall'Agenda, selettori, lettura PDF testuali e OCR foto/screenshot, anteprima e correzioni, ritorno | Riconoscimento nativo ancora da collaudare; tabelle senza separatori richiedono mappatura manuale; PDF scannerizzati non supportati |
| iOS senza decoder / Expo Go | Apertura, selettori, annullamento, messaggio di lettura non disponibile, ritorno | Nessuna anteprima riconosciuta: occorre un binario con i decoder |
| Android | Apertura, selettori, fotocamera/permesso, annullamento, messaggio di lettura non disponibile, ritorno | Decoder esclusi per incompatibilità Gradle; nessun OCR/lettura e nessuna anteprima riconosciuta |

Non sono stati aggiunti esempi fittizi al flusso del prodotto. Un decoder assente
non produce risultati simulati. La pulizia dei file temporanei conserva il
`finally` del blocco 2D, anche uscendo durante la lettura.

## Verifiche automatiche

```sh
node scripts/test-importazione-turni.cjs
node scripts/test-interpretazione-documenti.cjs
node scripts/test-acquisizione-documenti.cjs
node scripts/test-lettura-turni.cjs
node scripts/test-importa-turni-calendario.cjs
node scripts/test-agenda-personale.cjs
node scripts/test-turni-calcoli.cjs
node scripts/test-stipendio-calcoli.cjs
npm run typecheck
```

Il nuovo test analizza la navigazione JSX di App.js e aziona il componente con
hook, selettori e decoder simulati, mantenendo reale il modello di revisione.
Verifica scelta dei canali, anteprima modificabile anche dopo conferma delle voci,
assenza di conferma finale/callback, errori di piattaforma, annullamento, rilascio
dei temporanei e smontaggio. Non sostituisce prove native o visuali su telefono.

Nessun commit, push, build o deploy durante il blocco 2E.
