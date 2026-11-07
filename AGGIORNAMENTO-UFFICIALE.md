# Aggiornamento coordinato Vigilanza GPG

Base: repository ufficiale `andrea23488/Vigilanza-gpg`, `main` commit `9aa8984`.
Ramo di lavoro: `fix/aggiornamento-ufficiale-gpg`.
Identità mantenuta: `com.vigilanzagpg.app`, progetto EAS `3f83a3a9-df1a-4dcc-beaf-8c390f52eca2`.
Nessuna app Beta, nuova identità EAS, migrazione SQL o pubblicazione Store.

## Modifiche operative

- Recuperati modelli, controllo conflitti e coordinatore dei turni rapidi dalle copie locali. Operatività facoltativa, come nel salvataggio standard: valore predefinito `Servizio`. Nome e orari validi obbligatori nella gestione modelli.
- Il calendario ufficiale usa le API Supabase autenticate originali. POST con risposta del record, successiva GET obbligatoria prima di confermare il successo, aggiornamento dello stato condiviso da ore, extra e stipendio. Conflitti anche oltre mezzanotte, niente upsert o sostituzione di servizi esistenti. Esiti incerti bloccano il reinvio automatico.
- Eliminazione nel calendario con selezione esplicita dei servizi e una sola conferma. DELETE vincolata a proprietario, ID e snapshot selezionato, risposta del record e GET di verifica. Anche l’eliminazione originale richiede conferma del backend. Risposte vuote, permessi negati o rete non vengono presentati come cancellazioni riuscite.
- Space Patrol: campo responsive senza scroll, trascinamento relativo continuo, animazione con requestAnimationFrame, sparo automatico, collisioni e limiti coerenti con il campo, nemici SVG. Pausa quando l’app va in background.
- Briscola: tavolo, briscola, punteggio e mano su un unico schermo, mantenendo le regole originali. Scopa: tappeto compatto con bordo, carte disposte a griglia e paginazione in caso di tavolo affollato; prese, scelta tra combinazioni e punteggi originali mantenuti.
- Profilo → Aiutaci a migliorare: testo e apertura `mailto:` verso l’indirizzo già ufficiale `vigilanzagpg.app@gmail.com`; fallback se il compositore non si apre, senza dichiarare l’invio.
- Conservati autenticazione, profili, chat, colleghi e configurazione Watch ufficiali. Non è stata copiata in blocco l’app privata che disabilitava Watch e aveva un bundle ID diverso.

## GPG 2.0: lavoro recuperato e blocco reale

I sorgenti recuperati sono in `experimental/gpg-v2`: classificazione, adattatore calendario, economia lorda con regole esplicite, profili e coordinamento. La voce ufficiale “Confronto GPG 2.0 · sperimentale” chiama ora quel coordinatore sui record dell’account e rende espliciti i dati mancanti. Il motore stipendiale operativo resta quello ufficiale precedente.

La precedente schermata privata caricava un catalogo vuoto (`profiles: []`) e non generava un nuovo netto. Il nucleo recuperato è ora esteso da `core/fiscalita.cjs` e `core/retribuzione.cjs`: fiscalità ordinaria 2025–2026, natura delle singole voci, contributi con aliquota esplicita, IRPEF, detrazioni e cuneo. Questa implementazione non è ancora validata su un profilo GPG reale e resta esclusa dal motore operativo. I rapporti precedenti dei Blocchi 5 e 6 confermano l’assenza di un profilo contrattuale reale approvato e di validazione contributiva/fiscale. Non esiste quindi nei materiali disponibili una versione netta 2.0 validata da promuovere.

Il caso agosto 2026 non è risolto: differenza competenze €339,69 e differenza netta €232,82. Nessun importo fisso è stato aggiunto. I totali del cedolino non consentono di ricostruire da soli maggiorazioni, indennità, imponibili e fiscalità. Servono righe originali anonimizzate con quantità/unità/tariffe, spettanze e arretrati, azienda/CCNL/decorrenza/livello, regole di competenza e cumulo, imponibili, contributi, IRPEF, detrazioni, addizionali e conguagli. La precisione €20–30 resta non validata. Il netto legacy usa ancora un coefficiente semplificato e non è un nuovo calcolo fiscale.

## Verifiche essenziali

- TypeScript e suite esistenti: ore/turni, stipendio, regole carte, profilo, privacy/chat ed economia Fiduciari superate.
- Test di integrazione HTTP locale con archivio su file: inserimento con modello predefinito, rilettura da nuova istanza, servizi multipli, duplicati, sovrapposizione notturna, DELETE selettiva, isolamento utenti, 403 e risposta POST senza record persistito. Verificata anche l’apertura email e il fallback con testo conservato. Questo server locale non è Supabase di produzione.
- Componenti reali dei layout renderizzati in Chromium a 390×844 e 375×667, con spazio riservato alle safe area: carte visibili e cliccabili. Verifica web, non prova nativa iPhone.
- Bundle JavaScript/Hermes esportati per iOS e Android. Un export non è una IPA firmata né un collaudo delle dipendenze native.
- Nessuna prova con account reale o dati di produzione: credenziali non presenti/verificate nella sessione. Nessuna IPA generata. Email nativa, fluidità touch, autenticazione e persistenza dopo chiusura dell’app richiedono il collaudo iPhone.

## Unica build ufficiale da avviare dopo le verifiche delle credenziali

Dalla cartella del repository:

```bash
npm ci
npm run preflight:ios:official
npx eas-cli project:info
npx eas-cli credentials --platform ios
npx eas-cli build --platform ios --profile production
```

Prima del preflight, configurare nell’ambiente locale e nell’ambiente EAS `production` le variabili `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Non inserire segreti nel codice. L’URL deve essere `https://wzdwmiewinsbvqgtmwei.supabase.co`. Il preflight verifica che la chiave pubblica sia accettata da quel backend. La configurazione blocca identità private/offline e backend errati.

Verificare in EAS progetto, account, Team Apple, certificato e provisioning della app ufficiale prima della build. `production` produce l’artefatto Store per il successivo collaudo tramite TestFlight; nessun `--auto-submit`. Verificare anche la versione commerciale richiesta in App Store Connect; il numero build è incrementato da EAS. Questi comandi di build/credenziali non sono stati avviati in questa sessione.

Collaudo indispensabile su iPhone: login esistente; aggiunta rapida e secondo servizio; chiusura forzata e riapertura con ricaricamento; eliminazione del solo servizio selezionato e nuova riapertura; ore/extra/stipendio coerenti; giochi; apertura e annullamento del compositore email.
