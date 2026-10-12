# Auth A/B Safari — solo progetto TEST

Strumento di collaudo separato dall'app. Non viene importato dall'app, non
registra dispositivi push e non modifica Supabase. Solo dati sintetici.
Destinazione unica: https://ilmhjsrxhnishnbocrnm.supabase.co.

## Apertura nel Codespace

Dalla root del repository aggiornato:

```sh
python3 tools/auth-ab-safari/server.py
```

Il server imposta la porta 8765 privata tramite GitHub CLI, ne verifica lo stato
prima di ascoltare e prima di ogni richiesta statica. Un monitor controlla la
visibilità ogni dieci secondi e ferma il server se non è verificabile.
Se la porta non esiste, aggiungerla dal pannello Porte con visibilità Privata
prima di riprovare. Se gh non ha accesso al Codespace, il server non parte:
non disabilitare il controllo. Non è necessario un token Supabase nel terminale.
Aprire 8765 dal pannello Porte, attraverso l'URL HTTPS autenticato di GitHub.
Non usare URL pubblici, tunnel esterni o server alternativi.

Python 3 e gh sono richiesti sul Codespace. Nessuna dipendenza da installare.
La verifica gh deve poter leggere e restringere la porta del proprio Codespace;
il permesso effettivo del Codespace utente non è stato verificato qui.
Il caricamento pagina non avvia richieste Supabase: serve un click esplicito.

## Collaudo futuro autorizzato

1. Confermare progetto TEST, assenza di registrazioni/strumenti di cattura,
   e porta privata. Inserire solo chiave pubblicabile ed email/password sintetiche
   TEST nei campi Safari. Non inserirle in chat, argomenti o file.
2. Login A/B: la pagina verifica ES256, issuer, audience, ruolo, exp/iat/nbf,
   sub e session_id. Controllare A/B distinti, stesso proprietario.
3. Copiare la query SELECT mostrata e usarla soltanto nel SQL Editor TEST.
   Annotare entrambe le righe, proprietario, not_after e orario DB; un errore
   non significa assenza. Non usare una transazione con snapshot precedente.
4. Refresh A: stesso session_id, JWT nuovo verificato. Logout locale A:
   query fresca, A assente e B presente, not_after valido. Annotare orario.
5. Premere il ricontrollo JWT A: deve essere ancora valido dopo l'osservazione
   della revoca. JWT scaduto, errore o dati ambigui => prova inconcludente.
   Non rinnovare A dopo logout. Refresh B deve mantenere sessione/proprietario.
6. Cleanup A/B, poi verifica finale SQL: sessioni terminate. HTTP positivo non
   sostituisce la lettura Auth. La pagina non certifica automaticamente revoca.

La query visualizza solo identificativi sintetici e tempi, nessun token.
La pagina non esegue SQL né legge auth.sessions con credenziali privilegiate.
La riga esistente non dimostra tutte le condizioni di validità Auth.
La presenza, proprietario e not_after sono osservazioni da confrontare con
JWT ancora valido, logout e successivo refresh della distinta sessione B.

## Sicurezza e limiti

Input svuotati prima delle richieste. Token e credenziali solo nella memoria
browser; nessuno storage, logging, telemetria, script esterno o uso clipboard
automatico. Le richieste Auth vanno direttamente al solo progetto TEST, non
al Codespace. Redirect vietati; algoritmo diverso da ES256 rifiutato.
CSP connect-src vieta invii ad altri host e al server locale. Server statico
solo loopback, nessun access log, POST e query string rifiutati.
Errori mostrati generici, mai risposte Auth complete o token.

Il processo conserva separatamente A/B. Cleanup su comando esplicito interrompe
l'azione pendente e la attende prima di revocare le sessioni note. Risposta login
parziale con bearer consente solo un tentativo cleanup; risposta persa senza
bearer lascia esito sconosciuto. Verificare manualmente le sessioni sintetiche
residue e revocarle tramite procedura Auth autorizzata; non cancellare righe Auth.
Chiusura tab, Safari sospeso, perdita rete/crash non garantiscono cleanup.
Il browser può ignorare beforeunload. Arrestare il server con Ctrl-C a fine prova.

I controlli non garantiscono riservatezza su dispositivo compromesso, schermo
registrato, password manager, estensioni o Codespace alterato. Autocomplete off
è una richiesta: rifiutare salvataggi/autofill. La memoria JS non può essere
azzerata con garanzia crittografica. La privacy Codespaces è controllata ma il
proprietario può cambiare la porta dopo una lettura: non modificarla durante
la prova, non condividere il Codespace. Il monitor non è una garanzia atomica
contro modifiche concorrenti alla visibilità GitHub.
Non generare HAR o trace di rete. I log interni Auth Supabase restano gestiti
 dal servizio: non vengono scaricati o prodotti dal programma.

## Controlli locali

```sh
node --test tools/auth-ab-safari/core.test.mjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tools/auth-ab-safari -p test_server.py
```

Trasporti simulati, nessun socket o richiesta Auth reale. I test Node verificano
Web Crypto ES256 e casi malformati, expiry, timeout, redirect, cleanup e sessioni
indipendenti. Non sostituiscono prova Safari reale, CORS/gh remoto o revoca Auth.
Nessun test preesistente dell'app è ripetuto: l'app rimane invariata.
