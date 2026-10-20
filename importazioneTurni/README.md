# Bozza Importa turni — blocco 1

Modulo TypeScript puro, senza dipendenze, import dal calendario, OCR, rete,
Supabase, notifiche o calcolo economico. Non contiene funzioni di salvataggio.

## Contratto

- Sorgenti: `pdf`, `immagine`, `screenshot`, ciascuna con ID e testo originale.
- Ogni campo rilevato conserva valore nullable, testo originale, affidabilità
  nullable nell'intervallo 0–1, alternative e provenienza (sorgente, pagina,
  riferimento descrittivo, rettangolo opzionale).
- I rettangoli, quando disponibili, sono `[x, y, larghezza, altezza]` in
  coordinate normalizzate alla pagina. Il produttore deve rispettare questa
  convenzione; questo blocco non effettua trasformazioni geometriche.
- Dipendente: nome, cognome e matricola nullable. Non si assume che la matricola
  aziendale coincida con il codice GPG del calendario. Un identificatore
  parziale è rappresentabile, ma richiede comunque conferma manuale.
- Voci: turno, riposo, assenza o causale non ancora mappata. Ogni servizio ha
  un ID indipendente, anche quando più servizi hanno la stessa data.
- Le date sono ISO `YYYY-MM-DD`, gli orari `HH:mm`. `dataFine` è esplicita:
  22/10 22:00–23/10 06:00 è valido; il giorno successivo non viene dedotto.
  Sono accettati intervalli positivi inferiori a 24 ore. Durate maggiori o
  uguali richiedono chiarimento fuori da questo blocco.
- Le date rappresentano il tempo nominale scritto sul documento. Non sono
  istanti reali: non si applicano fusi, cambio d'ora o regole retributive.
- La postazione è testo, senza associazione automatica agli archivi esistenti.
  È necessaria per confermare un servizio in questo primo contratto.
- Riposi e causali non generano ore lavorative. Le assenze sono giornaliere:
  le assenze parziali richiederanno un'estensione esplicita del contratto.

## Revisione

`creaBozza` ignora qualsiasi pretesa conferma e inizializza soltanto dati
rilevati. Le associazioni causali non possono arrivare già confermate
nell'estrazione. I risultati sono copie profondamente congelate degli input.

`statoVoce` distingue `rilevata`, `da_verificare`, `confermata`, `esclusa`.
Alternative, dati obbligatori mancanti o affidabilità inferiore a 0,9 (o
sconosciuta per un valore presente) indicano necessità di verifica.
La soglia è una convenzione prudenziale di questo modello, non una misura
calibrata dell'accuratezza di un futuro OCR. Anche una voce affidabile non
è mai confermata automaticamente.

`confermaVoce` registra separatamente i dati revisionati, preservando i campi
rilevati. Per `MF` non esistono mapping predefiniti, percentuali o trattamenti:
serve un'associazione semantica esplicita oppure l'esclusione della voce.
La correttezza aziendale di un mapping resta da verificare dal futuro chiamante.

`confermaDipendente` conserva l'identità rilevata e invalida tutte le conferme
individuali: dopo la correzione occorre verificare nuovamente i servizi.

`confermaBozza(bozza, true, esistenti)` richiede dipendente confermato, almeno
una voce inclusa, tutte le voci incluse confermate e assenza di conflitti.
Ogni correzione o inclusione/esclusione incrementa la revisione e invalida
la conferma finale. Le esclusioni restano registrate: non eliminano dati.

## Duplicati e riepilogo

`confrontaVoci` accetta record esterni già normalizzati e appartenenti allo
stesso dipendente; non li legge né modifica. Segnala duplicati, sovrapposizioni
e incompatibilità con riposi/assenze, anche nella giornata successiva a una
notte. Due servizi adiacenti o separati sono ammessi. Il confronto testuale
normalizza solo spazi esterni e maiuscole: non applica somiglianza o deduzioni.

Il riepilogo conta giorni distinti, servizi, minuti nominali e voci escluse.
Intervalli mancanti, invalidi o con alternative temporali non sono sommati e
compaiono in `intervalliNonQuantificabili`. I totali sui dati rilevati sono
sempre provvisori e non indicano importazione completata o stipendio maturato.

`prontaPerFuturoSalvataggio` verifica conferma, revisione e conflitti forniti.
È un controllo di dominio, non un'autorizzazione server. Un futuro salvataggio
dovrà ricaricare e ricontrollare i dati esistenti e gestire concorrenza e
idempotenza. Nessun payload per le API esistenti viene prodotto qui.

## Verifica

Con Node.js 24 (supporto TypeScript nativo):

```sh
node scripts/test-importazione-turni.cjs
npm run typecheck
```

La fixture sintetica non contiene identità reali. Italpol 19–25/10/2026:
7 giorni, 5 servizi, 2340 minuti / 39 ore; MF resta irrisolta. Escluderla
esplicitamente rende l'importazione parziale, preservando il documento e la voce.

Il blocco aggiunge soltanto nuovi file; per annullarlo dopo revisione basta
rimuovere i quattro file aggiunti. Non richiede migrazioni né dipendenze nuove.
