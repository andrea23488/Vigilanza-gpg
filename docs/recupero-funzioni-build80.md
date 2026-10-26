# Recupero funzioni operative build 80 — revisione locale

Baseline: 1355e443923ca394e02f6ccab92e06d62d40d3be.
Candidata iniziale: 99e1dd9feb40f7849605c1055e3b44556a3ebe1d, branch feature/release-candidate-completa, worktree inizialmente pulito.

## Diagnosi dei componenti effettivi

| Operazione | Build 80 | Candidata iniziale | Recupero |
| --- | --- | --- | --- |
| Lista turni Home | TouchableOpacity nel blocco Home di App.js, setScreen('turni'); lista reale nel ramo turni | HomeScreen: voce soltanto nei menu calendar/more, saltati dai callback effettivi onCalendar/onSettings | Lista turni nei pannelli raggiungibili del riepilogo mensile e del nucleo servizio, stessi componenti e dati originali |
| Agenda | Home originale e nucleo verso screen calendar; Calendar originale dentro App.js | HomeScreen.onCalendar verso CalendarScreen con dati reali | Collegamento diretto conservato; nessun cambiamento alla griglia o al tap normale |
| Indietro | tornaHome, tornaCalendario, Back, onBack dei componenti | Nuove destinazioni Social; Lista turni prevedeva soltanto ritorno Home | Origine Home/Agenda esplicita per Lista turni, usata da Back e Android; editor e altri ritorni originali preservati |
| Operazioni calendario | apriSceltaAgenda e SceltaAgendaModal; ImpegnoPersonaleModal e editor originale | Timeline e modali reali presenti; CONFIGURA TURNI RAPIDI apre elenco di sola lettura | Menu Agenda apre scelta turno/impegno ed editor originale dei modelli; accesso aggiuntivo a Lista turni |
| Turni reali | nuovoGiorno, modificaGiorno, salvaGiornata, confermaEliminazione, turniApi, turniRapidi | Stesse API; coordinatore rapido reale aggiuntivo | Nessuna modifica alle API o alle procedure di salvataggio, payload, conflitti e multi-turno |
| Percorso servizio | turnoInCorso || turnoOggi || prossimoServizioMeteo.turno | Nuova Home sceglie solo il turno visualizzato | Ripristinata la selezione originale del percorso, senza cambiare il servizio ETA |
| Torna su condivisi | Pulsante introdotto da 0ca5743 | Assente in TurniCondivisiView | Comando contestuale dopo 350 px, colori del tema e senza animazione forzata |

## Grafica e isolamento

Il layout iniziale della Home, le quattro azioni, le geometrie, le animazioni, i temi e il calendario diretto restano invariati. Cambiano le voci dei pannelli già esistenti e il menu Agenda. Nessun componente Beta o homePreview viene importato nell'app ufficiale. Nessun servizio reale è sostituito da una simulazione.

La configurazione dei modelli apre un nuovo editor non salvato sul giorno selezionato: si apre la gestione dei modelli e si usano i controlli originali di TurniRapidiSection, senza chiamate di scrittura all'apertura. La chiusura usa tornaCalendario. Il tap normale della griglia continua ad aprire nuovo/modifica/multipli; la scelta turno/impegno è disponibile anche dal menu e dalla timeline. Non si ripristina la vecchia interazione a doppio tap, per conservare quella attuale.

## Parti ferme

Annulla ed eliminazione rapida restano disabilitati: manca un servizio atomico removeIfUnchanged. Nessuna cancellazione simulata, nessuna nuova API. La gestione originale del singolo turno rimane operativa.

Chat personale e migrazione multiplayer v2 non sono integrate né applicate. L'errore EAS delle variabili offline vuote, già corretto nel commit esterno 9715731, resta fuori da questo recupero di navigazione: eas.json non viene modificato. Importa turni da PDF/foto/screenshot resta escluso.

## Verifica e limiti

Test locali con servizi fittizi confinati agli harness: callback reali Home/Agenda, ritorni iOS/Android tramite onPress/onRequestClose e BackHandler, indicazioni per servizio futuro, modelli rapidi, dati multi-turno, persistenza e regressioni. Nessuna richiesta a Supabase, APNs, Watch o servizi di produzione durante i test.

Le dipendenze già installate sono risolte tramite un collegamento node_modules locale temporaneo, rimosso al termine delle verifiche; nessuna installazione o modifica alle dipendenze condivise. Typecheck senza emissione né cache incrementale. Il collaudo nativo su dispositivi resta necessario; non vengono eseguite build o deploy.


Esito finale: tutti i 28 file di test selezionati sono passati (navigazione Home/Agenda, calendario, modelli rapidi, agenda personale, calcoli GPG/Fiduciari, impostazioni/sessione, Social/privacy/chat, profilo, postazioni, giochi, Watch, temi e animazioni). Passati anche `node node_modules/typescript/bin/tsc --noEmit --incremental false` e `git diff --check`. Gli stili di HomeScreen sono identici a HEAD iniziale; procedure di biometria, logout ed eliminazione account identiche alla build 80. HEAD resta 99e1dd9, nessun commit.
