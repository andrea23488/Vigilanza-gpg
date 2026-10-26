# Anteprima isolata della Home — Expo Go SDK 54

Questa cartella è un progetto Expo distinto. Importa direttamente i componenti reali
`../HomeScreen.js`, `../HomeArtwork.js`, `../ElectricConnections.js`, `../homeElectric.js`, `../homeModel.js`
e il sistema di temi `../temi.js`. Non contiene una copia grafica della Home.

## Safari su iPhone tramite Codespaces

```bash
cd /workspaces/vigilanza-gpg-home/homePreview
npm run start:web
```

In Codespaces inoltrare la porta **8083** dalla scheda **Porte / Ports**, se non
compare automaticamente. Mantenere la porta privata e accedere con lo stesso
account GitHub su Safari. Aprire l'indirizzo HTTPS stampato dal launcher, nel formato:

`https://<CODESPACE_NAME>-8083.app.github.dev/`

`npm run check:web` mostra l'indirizzo del Codespace corrente senza avviare server.
La web preview non usa Expo Go, QR, Hermes nativo o tunnel ngrok. Non è un deploy.
React DOM e React Native Web sono già disponibili nella cartella node_modules del
worktree; non sono stati installati nuovi pacchetti.

La grafica, il cerchio, le statistiche e le connessioni sono gli stessi componenti
reali. Sul browser Animated usa il driver JavaScript di React Native Web: gli
impulsi percorrono comunque i tracciati. Preferenze di movimento ridotto e scheda
in background continuano a fermare gli effetti.

Il viewport abilita `viewport-fit=cover`, il provider reale gestisce gli inset e
l'altezza segue VisualViewport/100dvh quando la barra di Safari cambia. Il documento
non scorre; i menu possono scorrere. Lo zoom resta consentito. I messaggi della demo
usano un dialogo web perché Alert.alert di React Native Web non è implementato.
Questi adattamenti riguardano esclusivamente questa directory.

Controlli senza avviare server:

```bash
npm run check:web
npm run typecheck
npm test
```

Il primo caricamento tramite porta inoltrata, la resa su Safari, VoiceOver e la
fluidità effettiva richiedono una verifica dopo l'avvio autorizzato del server.
La versione web non certifica il comportamento dei componenti nativi iOS.

## Avvio su iPhone

Expo Go deve essere compatibile con SDK 54. Le dipendenze vengono riutilizzate da
`../node_modules`: non serve eseguire `npm install` in questa cartella.

```bash
cd /workspaces/vigilanza-gpg-home/homePreview
npm run start:tunnel
```

Il comando usa la CLI Expo già installata con `--go --tunnel --port 8082`.
Non utilizza EAS né cambia l'entry point del progetto principale. Aprire il QR in
Expo Go. La porta 8082 distingue questa anteprima da un eventuale server sulla 8081.
La raggiungibilità del tunnel e il caricamento sul telefono vanno verificati al
primo avvio autorizzato; non sono dimostrabili dal solo controllo della config.

Controlli senza avviare server:

```bash
npm run check
npm run typecheck
npm test
```

## Cosa mostra

Profilo e statistiche fittizi; un servizio iniziato circa un'ora fa e con circa tre
ore rimanenti. Il countdown usa lo stesso calcolo e timer della Home reale.
Da Calendario → Aggiungi turno si può rigenerare il servizio demo.
Impostazioni → Aspetto e colori usa il catalogo temi condiviso (`temi.js`), con 12 temi standard e 8 speciali. Bozza e salvataggio restano in memoria: non vengono scritte preferenze reali. La Home di anteprima riceve la bozza solo finché la schermata di anteprima è aperta.
Le scariche elettriche sono quelle reali, con driver nativo, movimento e scia.
Se non si muovono, controllare Riduci movimento su iOS e Risparmio energia nel menu
Impostazioni della Home. Le animazioni si fermano anche nei menu e in background.

## Isolamento

- Nessun import dell'app principale, autenticazione, API turni o Supabase.
- Resolver con elenco esplicito dei soli sei file condivisi ammessi; moduli
  Watch, push e autenticazione bloccati nella sola anteprima.
- Nessun project ID EAS, bundle identifier produttivo, entitlement o plugin nativo.
- Il launcher disabilita dotenv e rimuove dal solo processo figlio le variabili
  `EXPO_PUBLIC_*`, `EAS_*` e `APP_VARIANT`. Preserva i proxy di rete dell'ambiente.
- Le preferenze della Home sono salvate con un prefisso dedicato alla demo.
- Nessun indirizzo reale o collegamento alle mappe; navigazione esterna simulata
  con messaggi. Il centro notifiche è dimostrativo e non registra push.

## Limiti

Questa è una revisione visiva e delle animazioni, non un collaudo delle funzioni
cloud. Non carica le schermate reali di calendario, chat, stipendio o profilo.
La Home non scorre; i menu reali possono scorrere. Nomi lunghi e caratteri grandi
mantengono gli stessi adattamenti e troncamenti del componente originale: vanno
controllati su iPhone piccolo, VoiceOver e, se necessario, Android.

La config non dichiara immagini per il manifest; le icone interne usano il font
Ionicons già disponibile. Non viene modificata la CLI per correggere il precedente
avviso sugli URL del manifest: se ricompare, acquisire stack e URL del bundle prima
di attribuirlo alle immagini o modificare pacchetti.

## Ricostruzione dal riferimento

Vedi [REFERENCE_REBUILD.md](REFERENCE_REBUILD.md) per gli elementi ricostruiti,
lo spazio fotografico predisposto e le differenze ancora aperte.

## Menu Social dimostrativo

Il pulsante Social apre una schermata dedicata con Turni condivisi, Chat, Profili
colleghi e Cerca nuovo collega. Ogni opzione apre un dettaglio marcato DEMO, senza
caricare o scrivere dati. Il ritorno alla Home è disponibile nel menu e nei dettagli.
La Home viene smontata mentre Social è aperto, sospendendo le animazioni.

`SocialScreen` espone `onSelect(SocialOptionId)` e `onBack`: l’integrazione futura
potrà associare questi identificativi ai callback esistenti, senza duplicare logica.
Turni condivisi corrisponde alla destinazione esistente `calendarioColleghi`, Chat
a `listaChat`; profili e ricerca andranno collegati ai rispettivi ingressi della
gestione colleghi. Questi collegamenti reali non sono implementati.

Il solo effetto animato è la pressione dei pulsanti, disabilitata con Reduce Motion
o app inattiva. Su schermi corti, in orizzontale o con testo molto ingrandito il
menu può scorrere per mantenere tutti i controlli accessibili. La Home è invariata
nella grafica. Nessun nuovo pacchetto è richiesto.

## Impostazioni DEMO

L’ingranaggio apre sei voci, nell’ordine: Aspetto e colori, Accesso biometrico,
Logout, Elimina account, Legale e assistenza, Aiutaci a migliorare. Ogni voce
apre un dettaglio DEMO con ritorno a Impostazioni e Home. Logout ed eliminazione
mostrano soltanto una conferma dimostrativa annullabile: nessuna azione viene eseguita.

I callback `onSelect(SettingsOptionId)` consentiranno un futuro adattatore ai flussi
esistenti: `aspettoColori`, gestione biometrica, `logout`, `eliminaAccount`, documenti
e assistenza. La destinazione dei suggerimenti resta da definire: non viene aggiunto
un servizio di invio. Non si duplicano tavolozza, autenticazione o logica account.

Il layout stima l’altezza utile considerando safe area e dimensione del testo. Le sei
righe compatte puntano a stare senza scorrimento su iPhone verticali con testo standard.
Uno ScrollView resta disponibile per viewport ridotte, browser con barre aperte e
caratteri grandi: la misura effettiva del testo può superare la stima. Servono prove
visive su Safari/iPhone; i test non sostituiscono il rendering del dispositivo.
Il solo lampo al tocco dura 260 ms, senza ritardare la navigazione, e si disattiva
con Reduce Motion o app inattiva. Nessun nuovo pacchetto, API o permesso.

## Agenda: modalità manuale e rapida DEMO

Il pulsante Calendario apre Agenda. Il chip Turni rapidi attiva una barra separata;
il menu a tre puntini contiene soltanto CONFIGURA TURNI RAPIDI. La configurazione
unificata crea, modifica, elimina e riordina i modelli, senza servizi esterni.

Con modalità rapida chiusa, un tap apre la destinazione manuale DEMO di sola lettura.
Non si replica il modulo di produzione: l’editor originale è inline in App.js,
schermata `edit` (da riga 27916 circa), con `nuovoGiorno`, `modificaGiorno`,
`creaPayload`, `salvaGiornata`; `giornoTurni` gestisce i record multipli. Queste
funzioni dipendono dallo stato dell’app, dalle API dei turni, dai promemoria e dai
calcoli economici e non vengono importate nell’anteprima. La prop opzionale
`onManualDate(key, entries)` definisce il punto di collegamento futuro. La futura
estrazione fedele dovrà mantenere tutti i campi e il salvataggio, nascondendo la
sezione TurniRapidiSection nel modulo manuale. Non è effettuata in questa fase.
Non è stato identificato un campo pausa dedicato nel payload esaminato: non viene
inventato un campo equivalente nell’anteprima.

Con barra aperta e nessun modello selezionato, il tap non inserisce nulla. Con un
modello selezionato si inserisce su date libere; date occupate aprono una scelta
esplicita: aggiungere un altro turno compatibile o sostituire un solo turno scelto.
Duplicati e sovrapposizioni sono bloccati, inclusi notturni sulla data adiacente e
riposi. Elimina richiede di scegliere un singolo turno: non cancella eventi personali
né altri turni. Conferme e calcoli temporali sono esclusivamente dimostrativi,
non sostituiscono le validazioni o il motore stipendiale di produzione.

Lo swipe è applicato soltanto alla griglia: acquisizione dopo 18 punti orizzontali,
cambio mese dopo 64 punti con prevalenza 1.5 rispetto alla componente verticale.
Le frecce usano la stessa azione. Il tap successivo a un trascinamento è soppresso
per 350 ms; la barra orizzontale dei modelli è esterna al riconoscitore. La selezione
della data passa al giorno 1, come mesePrecedente/meseSuccessivo nell’app originale.
La selezione del modello resta attiva fino al cambio o alla chiusura della modalità.

Date e assegnazioni sono separate per anno/mese. Le mini-card mostrano i dati DEMO
del mese disponibili, oppure un trattino per mesi senza riepilogo: non si inventano
straordinari o statistiche economiche dai soli modelli. Lo stato rimane in memoria,
si conserva navigando e si perde al ricaricamento. Il lettore compatibile dei vecchi
snapshot in memoria conserva anche assegnazioni precedenti con un solo turno.

La griglia mantiene settimane da lunedì e mesi bisestili. Su schermi corti o con
caratteri grandi è possibile scorrere. Servono prove su Safari/iOS e Android fisici
per fluidità dei gesti, cancellazione della pressione e accessibilità; i test usano
geometria/JSX e callback con i responder nativi simulati. Nessun server o build.

## Riorganizzazione riepiloghi Home / Agenda

La Home mostra un riepilogo mensile orizzontale dark con mese, avanzamento e
Lavorate/Extra/Giorni, al posto delle tre card. Nella demo i valori di riferimento
sono Ottobre 2026, 81%, 208.0h, 31h, 25. La prop opzionale `monthlySummary` permette
di fornire i valori in futuro senza introdurre nuovi calcoli stipendiali: in sua
assenza ore/extra/periodo restano quelli ricevuti e avanzamento/giorni sono ignoti.

Ore totali / Extra / Notti sono ora tre card compatte sopra la griglia dell’Agenda.
Mostrano i valori dimostrativi 208.0h / 31h / 2 per il mese dei dati
demo; per altri mesi mostrano un trattino, senza inventare statistiche o cambiare
la logica dei turni rapidi. Ore ed extra DEMO sono allineati all’esempio mensile della Home.

Il quadrante interno passa da raggio SVG 42.8 a 43.6; lo spazio del contenuto
centrale passa dal 70% al 76% del diametro, con caratteri leggermente più grandi.
Cornici, circonferenza esterna, posizioni dei pulsanti e clock animati non cambiano.
Restano necessarie prove visive su iPhone con testo ingrandito, soprattutto con
barra Turni rapidi aperta: l’Agenda permette lo scorrimento quando necessario.

## Turni condivisi DEMO

La voce Social TURNI CONDIVISI apre una settimana centrata sul giorno corrente, con
strip dei sette giorni, box In servizio adesso e righe compatte. Scegliendo un altro
giorno la lista filtra la sola data selezionata; OGGI resta identificato nella barra.
L’ordine è: utente, turni che si sovrappongono al suo orario e poi ora iniziale.

Colleghi, orari, aziende e postazioni sono creati localmente per l’anteprima. Non si
leggono turni condivisi reali, profili, presenza o rete; la presenza dimostrativa è
calcolata all’apertura della schermata. Servono prove visive su iPhone/Android, in
particolare per lo scorrimento automatico del giorno selezionato e righe su schermi
stretti. La selezione per data rende la lista corta e non accumula sezioni settimanali.


## Aspetto e colori DEMO

La schermata usa lo stesso catalogo `PRESET_TEMI`, la stessa preferenza versione 1
(`preset`, `background`, `accent`) e gli helper `personalizzaAspetto` / `generaPalette`
che l’app già usa. Gli ID storici restano invariati. Sono disponibili 12 temi standard,
8 speciali con palette e quattro colori dedicati agli archi elettrici, e selezioni
manuali nominate senza codici colore visibili.

Le selezioni restano provvisorie finché non si preme Salva colori. Il salvataggio e il
ripristino confermato aggiornano solo lo stato in memoria della demo; non usano
AsyncStorage né l’archivio reale delle preferenze. Anteprima app monta il componente
Home reale con la bozza e torna alla configurazione dal pulsante Impostazioni o dal
back Android, senza perdere la selezione. I menu colori hanno griglia adattabile e
scroll disponibile per schermi stretti o testo ingrandito.

## Anteprima interattiva dei temi integrati (4B-4)

Aprire Impostazioni → Aspetto e colori → Anteprima. Il selettore orizzontale
permette di cambiare tutti gli otto temi senza riavviare. La Home è il componente
reale, con dati sintetici e tocchi operativi disabilitati. Il pulsante Colori
ritorna alla tavolozza; la bozza non modifica le preferenze dell’app.

Questa vista usa direttamente ThemeEffectsProvider, ThemeScene e ThemeGlyphs
dell’app. Disattiva le precedenti decorazioni del provider dimostrativo per
evitare sovrapposizioni. La fascia di 44–54 punti resta invariata. Dalla fase 4B-5 la Home riceve anche
ThemeScenery, lo stesso sfondo scenografico misurato e renderizzato nell’app:
nessun cambiamento alla geometria di cerchio, pulsanti o riepiloghi. Sulla Home
la fascia è statica; un solo ciclo muove gli elementi dello sfondo, fino a 19
livelli SVG. Neve, pipistrelli, nuvole e radar rispettano la policy condivisa. Il risparmio energia usa
lo stesso archivio separato della Home demo. Reduce Motion resta rispettato.
