# Ricostruzione grafica dal riferimento — fase 2

Il riferimento è `../HOME_DESIGN_RIFERIMENTO.jpeg` (462×1643). La Home ora usa
anelli concentrici SVG con profondità, gradienti blu/viola/magenta e tacche luminose;
quattro dischi con archi e targhette, schede con icone e nastri curvi multicolore.
La barra inferiore è stata rimossa: i collegamenti restano nei menu della Home.
La navigazione principale definitiva resta da concordare prima dell’integrazione.

Il contenuto centrale è fermo e separato dagli anelli. L’anello interno ruota in
senso orario ogni 30 secondi; la scia esterna ha un ciclo indipendente di 22 secondi
e l’alone una pulsazione di 7 secondi. I livelli hanno dimensioni identiche sui due
assi, rapporto 1:1 e nessun restringimento flex o trasformazione di scala.

Gli elementi sono renderizzati separatamente. Il JPEG completo non è importato
nel rendering e non viene usato come sfondo dell'interfaccia.

## Risorse e differenze aperte

- La foto non viene inventata o sostituita con un'altra scena. `HomeScreen` espone
  la prop opzionale `backgroundPhoto`, lasciata vuota. Il livello `home-photo-slot`
  è predisposto nella parte inferiore, dietro la grafica. Serve una foto pulita della
  guardia e dell'aeroporto per completare la somiglianza.
- Non è stato creato un avatar fotografico fittizio: si conserva fotoProfilo o il
  segnaposto. La demo mostra Francesco, 37,5 ore, 4,5 extra e 2 notti.
- La dicitura del periodo resta coerente con i dati ricevuti; il mese non viene
  rietichettato come "questa settimana". Il countdown è reale sul turno demo.
- Il formato del riferimento è molto allungato. Su iPhone più corti si comprimono
  spazi e altezze; non si deforma l'interfaccia per adattare l'intero JPEG.
- La resa di bagliori e materiali usa gradienti e tratti sovrapposti, senza filtri
  di sfocatura pesanti o un motore 3D. Non è ancora un'identità pixel per pixel.
- I controlli grigi del visualizzatore presenti sul JPEG non sono stati riprodotti.

## Verifica visiva

Se Metro era già in esecuzione, riavviarlo per caricare l'allowlist aggiornata con
il nuovo componente `HomeArtwork.js`. Nessun server viene avviato dai test.

```bash
cd /workspaces/vigilanza-gpg-home/homePreview
npm run start:web
```

La demo mantiene callback simulate, isolamento delle API e persistenza locale
separata. La navigazione della Home reale usa i callback già esistenti. Reduce
Motion, risparmio energia e background fermano gli effetti.

Resta necessario confrontare il risultato visivo su Safari e su dispositivo
nativo, soprattutto con caratteri grandi. I test di geometria verificano gli
spazi dei controlli e un margine proporzionale fra cerchio e pulsanti
(6 punti su una composizione di 280 punti). Su spazi molto ridotti il cerchio si ridimensiona: leggibilità, resa
e prestazioni effettive restano da verificare su Safari e iPhone fisici.

## Perfezionamento delle proporzioni e delle scie

La composizione resta quadrata e si riduce uniformemente allo spazio disponibile.
Il centro cresce di circa il 21% rispetto alla fase precedente; i quattro pulsanti
restano fermi sulla circonferenza, leggermente più esterna. Il margine sotto le
statistiche è ridotto a 4/8 punti. La circonferenza esterna non ruota: le scie la
percorrono continuamente in 12 secondi, con posizioni e intensità coincidenti
alla giunzione del ciclo. Il ciclo interno di 30 secondi resta separato dal testo.

Gli anelli ricevono i colori già derivati dalla tavolozza dell’app, senza nuove
preferenze. Non è presente una foto originale separata della guardia davanti
all’aeroporto: la prop `backgroundPhoto` resta opzionale, ora con dissolvenza
verticale. Non sono state aggiunte immagini esterne né ritagli del JPEG completo.

I test verificano geometria, traiettorie, chiusura dei cicli, preferenze di movimento,
callback e isolamento. Non sostituiscono prove visive e misure di consumo su Safari
e dispositivi fisici, soprattutto con ingrandimenti del testo elevati.
