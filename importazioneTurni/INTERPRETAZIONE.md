# Interpretazione documenti — blocco 2B

`documenti.ts` definisce l'input estratto; `interpretazione.ts` contiene solo
funzioni pure. Non si leggono PDF, foto o file reali e non si eseguono OCR,
rete, salvataggi, operazioni sul calendario o calcoli stipendiali.
Il modello e i test del blocco 1 restano invariati.

## Input e geometria

`DocumentoEstratto` conserva tipo sorgente, testo originale nullable, pagine
ricevute e numero di pagine attese nullable. Le pagine contengono righe e celle
nell'ordine fornito dall'estrattore. IDs tecnici di documento, pagina, riga e
cella sono obbligatori; il numero di pagina visibile può essere sconosciuto.
Non si generano pagine o righe mancanti. Una cella vuota deve occupare la sua
posizione con testo null: una colonna omessa nel mezzo non è ricostruibile.

Testo, confidenza e coordinate possono mancare. I punteggi noti devono essere
0–1 e vengono conservati, non stimati né mediati. Le coordinate sono pixel o
rettangoli normalizzati, con origine in alto a sinistra. La rotazione descrive
quanto le coordinate d'ingresso sono ruotate in senso orario rispetto alla
pagina leggibile. Il normalizzatore applica l'inversa per 0/90/180/270 gradi.
Senza dimensioni necessarie o orientamento verificabile restituisce null;
le coordinate originali rimangono nel documento restituito.

Il testo libero senza righe non viene segmentato automaticamente. Le righe
con separatori `|`, `;` o tab possono essere interpretate come segmenti testuali:
non si aggiungono celle all'input e non si attribuiscono loro rettangoli fittizi.
Gli IDs prodotti per voci e candidati sono riferimenti tecnici derivati dagli
IDs forniti, non numeri di pagina o matricole inventati.

## Strutture supportate

- Tabella con intestazioni Data/Giorno, Inizio/Entrata, Fine/Uscita oppure
  Servizio/Orario; eventuali Nome, Cognome, Matricola/Badge e Postazione/Sede.
- Matrice con dipendenti sulle righe e date complete nelle intestazioni.
- Intestazioni ripetute nelle singole pagine; nessuna eredità implicita tra pagine.
- Più servizi in una cella se separati da `+` e tutti completamente interpretabili.

Le etichette sono generiche; non si cercano nomi aziendali né layout Italpol.
Colonne sconosciute o intestazioni duplicate sono segnalate, non riassegnate.
Il testo non interpretato resta sempre nella copia completa del documento.

## Interpretazione e ambiguità

Date ISO o numeriche con anno a quattro cifre. `03/04/2026` conserva due
alternative e valore null, salvo ordine DMY/MDY esplicitamente dichiarato dal
chiamante. Non si aggiungono anno, mese o giorno da data corrente o nome file.
Orari `H:mm`/`H.mm` diventano `HH:mm`, preservando la cella originale. Non si
correggono automaticamente O/0, I/1, orari abbreviati o testo residuo.

Per orari diurni crescenti sulla data indicata, la fine nella medesima giornata
è una derivazione deterministica esplicitamente segnalata: conserva riferimento
alla data sorgente, ma confidenza null. Non è una conferma utente.
Per 22:00–06:00 senza data finale: valore null, giorno successivo proposto come
alternativa, avviso e nessuna ora nel totale. La data finale esplicita, nella
colonna Data fine o nella dicitura `del/al <data completa>`, consente di calcolare
la durata nominale. Orari uguali rimangono ambigui.

Riposo è riconosciuto solo dalle diciture estese. Ferie/malattia/permesso/assenza
sono assenze da confermare. Ogni altro codice, incluso MF e le abbreviazioni
non documentate, è una causale sconosciuta: nessuna percentuale, trattamento
stipendiale o associazione confermata viene applicata.

## Dipendente e bozza

L'identità rilevata è un candidato formato da nome/cognome/matricola, senza
scindere automaticamente un nome completo o eliminare zeri dalla matricola.
Più candidati richiedono `dipendenteId`; la prima elaborazione restituisce
candidati e bozza null. Il chiamante può rieseguire selezionando un altro ID.
Identità identiche sono raggruppate come candidato: senza matricola non è
possibile distinguere omonimi perfettamente identici. Si segnala questa
limitazione; la revisione manuale dei record resta necessaria.

Un solo candidato può precompilare la bozza, sempre con conferme null. Le righe
prive di identità non vengono associate automaticamente al dipendente scelto.
Senza identità rilevata la bozza mantiene tutti i campi dipendente null.
Le correzioni e conferme spettano alle funzioni del modello del blocco 1.

`stato` completo/parziale descrive la copertura strutturale, non la correttezza
semantica o l'autorizzazione al salvataggio. Le segnalazioni possono contenere
più problemi per riga. Codici irrisolti e date ambigue restano tali anche quando
tutte le righe sono state lette. Nessuna bozza viene creata in assenza di voci.

Se il testo originale globale è null, il campo stringa obbligatorio del modello
riceve stringa vuota, con segnalazione esplicita; l'input restituito conserva null.
Non vengono concatenati frammenti fingendo che siano il documento originale.

## Limiti e test

Non si ricostruisce una tabella dalle sole coordinate né da testo libero;
non sono gestiti celle unite, OCR di immagini, diciture di notte con solo il
numero del giorno, assenze parziali o formati locali arbitrari. Nessuna lettura
realistica su dispositivo è stata validata in questo blocco.

Con Node 24:

```sh
node scripts/test-interpretazione-documenti.cjs
node scripts/test-importazione-turni.cjs
npm run typecheck
```

Node può emettere MODULE_TYPELESS_PACKAGE_JSON caricando TypeScript con import
ESM: è un avviso, non un fallimento dei test. Non si cambia il tipo moduli
dell'intera app per sopprimerlo.

Il test usa registerHooks di Node 24 per risolvere gli import locali senza
estensione; il codice app segue gli import ordinari di Expo/TypeScript.
