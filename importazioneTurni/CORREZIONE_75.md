# Anteprima locale dopo build 75

La schermata usa `prospetto.ts` per un'anteprima senza persistenza. Non invoca
callback di conferma, letture del calendario o API remote, anche se passate come
props. Periodo e dipendente richiedono conferma. R/PR restano sigle senza tipo
finché l'utente non ne specifica il significato. Gli intervalli compatti vengono
interpretati soltanto in celle Servizio o dopo un giorno all'inizio di una riga.

Le righe senza intestazione richiedono almeno due giorni distinti nella stessa
colonna quando la geometria è disponibile. Questo riduce i falsi positivi ma un
prospetto di un solo giorno senza intestazione non viene riconosciuto. Le celle
vuote non diventano riposi. Le date impossibili restano da completare. I notturni
richiedono una data finale esplicita nell'editor.

La galleria/fotocamera offre il ritaglio del selettore nativo; File conserva il
PDF. La selezione a due angoli sullo schema del testo filtra le evidenze prima
della geometria, senza reintrodurre il testo esterno nel fallback. Il documento
originale non viene modificato. La rilettura sostituisce l'anteprima, come indicato
nella schermata: selezionare regione e periodo prima delle correzioni manuali.

Il modulo iOS usa PDFKit e passa a Vision per pagine vuote, ruotate o con meno
di due intervalli riconoscibili. Confronta gli intervalli estratti e sceglie UNA
rappresentazione per pagina. È una euristica, non una certificazione della qualità
del testo: PDF misti con almeno due intervalli nel livello testuale possono
ancora richiedere una foto/immagine del prospetto. Non vengono unite liste PDF e
OCR, evitando doppie voci dovute alla fusione delle estrazioni.

## Verifica automatica

Eseguire `node --test` sui seguenti script:
- scripts/test-prospetto-turni.cjs
- scripts/test-acquisizione-documenti.cjs
- scripts/test-lettura-ios.cjs
- scripts/test-interpretazione-documenti.cjs
- scripts/test-lettura-turni.cjs
- scripts/test-importazione-turni.cjs
- scripts/test-importa-turni-calendario.cjs

Eseguire anche `npx tsc --noEmit`. Il test di collegamento legge App.js ma non
lo modifica. Il codice Swift non è compilato da questi controlli.

## Collaudo richiesto su iPhone con documenti reali anonimizzati

Nessun file reale è incluso e nessuna accuratezza OCR è attestata dai test JS.
Servono foto/screenshot completi e ritagliati dei giorni 16–31, PDF testuali,
scansioni e PDF misti, oltre a tabelle con intestazioni, matrici multipersona,
celle unite e nomi su più righe. Confrontare ogni campo con una trascrizione
manuale attesa, verificando assenza di falsi turni dalla cornice, omissioni e
associazioni a persona/postazione errate. Provare rotazioni, inclinazione, sfocato,
servizi multipli e notturni, riposi e sigle senza legenda. Verificare su dispositivo
anche il ritaglio nativo, la selezione sullo schema, prestazioni e memoria.

I layout con celle unite, intestazioni distribuite e prospetti molto inclinati
restano casi da collaudare e possono richiedere ritaglio/correzione. Non è stata
eseguita alcuna build, submit o distribuzione nell'attività di correzione.
