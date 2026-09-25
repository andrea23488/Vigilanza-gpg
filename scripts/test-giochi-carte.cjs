const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function caricaModulo(percorso, nomi, dipendenze = {}, trasforma = (s) => s) {
  let sorgente = fs.readFileSync(percorso, 'utf8');
  sorgente = trasforma(sorgente)
    .replace(/^import .*?;\n/gms, '')
    .replaceAll('export function ', 'function ')
    .replaceAll('export const ', 'const ');
  sorgente += `\nmodule.exports = { ${nomi.join(', ')} };`;
  const sandbox = {
    module: { exports: {} }, exports: {}, console, Set, Map,
    ...dipendenze,
  };
  vm.runInNewContext(sorgente, sandbox, { filename: percorso });
  return sandbox.module.exports;
}

const mazzo = caricaModulo('games/mazzoItaliano.js', [
  'SEMI_ITALIANI', 'VALORI_ITALIANI', 'nomeCompletoCarta',
  'creaMazzoItaliano',
]);

const asset = caricaModulo(
  'games/cartePiacentine.js',
  ['CARTE_PIACENTINE', 'IDENTITA_GRAFICA_CARTE_PIACENTINE', 'risolviAssetCarta'],
  { require: (percorso) => percorso }
);

const scopa = caricaModulo(
  'games/scopaRegole.js',
  [
    'combinazioniSomma', 'trovaPresePossibili', 'preparaOpzioniPresaScopa',
    'chiavePresaScopa',
    'testoPresaScopa', 'validaPresaScopa', 'rimuoviPresaDalTavolo',
    'diagnosticaOpzioniScopa',
  ],
  {
    nomeCompletoCarta: mazzo.nomeCompletoCarta,
    risolviAssetCarta: asset.risolviAssetCarta,
  }
);

const briscola = caricaModulo(
  'games/briscolaRegole.js',
  ['REGOLE_BRISCOLA', 'creaMazzoBriscola', 'cartaVincenteBriscola'],
  { creaMazzoItaliano: mazzo.creaMazzoItaliano }
);

const NOMI_VALORI = [
  'Asso', 'Due', 'Tre', 'Quattro', 'Cinque',
  'Sei', 'Sette', 'Fante', 'Cavallo', 'Re',
];

function carta(deck, seme, valore) {
  return deck.find((elemento) =>
    elemento.seme === seme && elemento.valore === valore
  );
}

function mescolaDeterministico(carte) {
  const copia = [...carte];
  for (let i = 0; i < copia.length; i += 1) {
    const j = (i * 17 + 11) % copia.length;
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function main() {
  const deck = mazzo.creaMazzoItaliano();

  // A-G: inventario completo e identità logica delle quaranta carte.
  assert.equal(deck.length, 40);
  assert.equal(new Set(deck.map((elemento) => elemento.id)).size, 40);
  assert.equal(
    new Set(deck.map((elemento) => `${elemento.seme}-${elemento.valore}`)).size,
    40
  );
  for (const seme of mazzo.SEMI_ITALIANI) {
    const carteSeme = deck.filter((elemento) => elemento.seme === seme.id);
    assert.equal(carteSeme.length, 10);
    assert.deepEqual(
      Array.from(carteSeme, (elemento) => elemento.valore).sort((a, b) => a - b),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    );
    for (const elemento of carteSeme) {
      assert.equal(elemento.id, `${seme.id}-${elemento.valore}`);
      assert.equal(elemento.nome, NOMI_VALORI[elemento.valore - 1]);
      assert.equal(
        mazzo.nomeCompletoCarta(elemento),
        `${NOMI_VALORI[elemento.valore - 1]} di ${seme.nome}`
      );
      assert.ok(asset.risolviAssetCarta(elemento));
    }
  }

  // H: l'inversione dei nomi fisici Spade/Bastoni è esplicita e compensata.
  assert.deepEqual(
    JSON.parse(JSON.stringify(asset.IDENTITA_GRAFICA_CARTE_PIACENTINE)),
    {
      denari: { prefissoFile: 'denari', semeDisegnato: 'denari' },
      coppe: { prefissoFile: 'coppe', semeDisegnato: 'coppe' },
      spade: { prefissoFile: 'bastoni', semeDisegnato: 'spade' },
      bastoni: { prefissoFile: 'spade', semeDisegnato: 'bastoni' },
    }
  );
  for (let valore = 1; valore <= 10; valore += 1) {
    assert.match(asset.risolviAssetCarta(carta(deck, 'spade', valore)),
      new RegExp(`bastoni_${valore}\\.png$`));
    assert.match(asset.risolviAssetCarta(carta(deck, 'bastoni', valore)),
      new RegExp(`spade_${valore}\\.png$`));
  }

  // I e Briscola: entrambi i giochi passano dalla fonte centrale.
  const scopaSource = fs.readFileSync('games/ScopaGame.js', 'utf8');
  const briscolaSource = fs.readFileSync('games/BriscolaGame.js', 'utf8');
  const briscolaRulesSource = fs.readFileSync('games/briscolaRegole.js', 'utf8');
  assert.match(scopaSource, /creaMazzoItaliano/);
  assert.match(briscolaRulesSource, /creaMazzoItaliano/);
  assert.match(briscolaSource, /creaMazzoBriscola/);
  assert.doesNotMatch(scopaSource + briscolaSource, /assets\/carte-piacentine/);
  const deckBriscola = briscola.creaMazzoBriscola();
  assert.equal(deckBriscola.length, 40);
  assert.deepEqual(
    Array.from(deckBriscola, (elemento) => elemento.id).sort(),
    Array.from(deck, (elemento) => elemento.id).sort()
  );
  assert.equal(deckBriscola.reduce((totale, elemento) => totale + elemento.punti, 0), 120);
  assert.equal(
    briscola.cartaVincenteBriscola(
      carta(deckBriscola, 'coppe', 1), carta(deckBriscola, 'coppe', 3), 'denari'
    ).id,
    'coppe-1'
  );
  assert.equal(
    briscola.cartaVincenteBriscola(
      carta(deckBriscola, 'coppe', 1), carta(deckBriscola, 'denari', 2), 'denari'
    ).id,
    'denari-2'
  );

  // J-N: il popup usa gli stessi oggetti del tavolo, ID unici e somme valide.
  const tavolo = [
    carta(deck, 'denari', 1), carta(deck, 'coppe', 4),
    carta(deck, 'spade', 2), carta(deck, 'bastoni', 3),
  ];
  const giocata = carta(deck, 'denari', 5);
  const opzioni = scopa.preparaOpzioniPresaScopa(giocata, tavolo);
  assert.ok(opzioni.length > 1);
  for (const presa of opzioni) {
    const verifica = scopa.validaPresaScopa({ cartaGiocata: giocata, tavolo, presa });
    assert.equal(verifica.valida, true);
    assert.equal(new Set(presa.map((elemento) => elemento.id)).size, presa.length);
    assert.equal(presa.reduce((totale, elemento) => totale + elemento.valore, 0), 5);
    assert.ok(presa.every((elemento) => tavolo.includes(elemento)));
    assert.equal(
      scopa.testoPresaScopa(presa),
      presa.map((elemento) => `${elemento.valore} ${elemento.semeNome}`).join(' + ')
    );
  }
  const primaPresa = opzioni[0].map((elemento) => ({ ...elemento }));
  const rimaste = scopa.rimuoviPresaDalTavolo(tavolo, primaPresa);
  assert.ok(primaPresa.every((elemento) => !rimaste.some((c) => c.id === elemento.id)));
  assert.equal(scopa.validaPresaScopa({
    cartaGiocata: giocata, tavolo, presa: [tavolo[0], tavolo[0]],
  }).valida, false);
  const diagnostica = scopa.diagnosticaOpzioniScopa({
    cartaGiocata: giocata, tavolo, opzioni,
  });
  assert.deepEqual(
    Array.from(diagnostica.opzioni, (opzione) => opzione.testo),
    Array.from(opzioni, scopa.testoPresaScopa)
  );
  assert.ok(diagnostica.opzioni.every((opzione) => opzione.verifica.valida));

  // O: una singola presa può coinvolgere tutti e quattro i semi.
  const giocataDieci = carta(deck, 'denari', 10);
  const quattroSemi = scopa.preparaOpzioniPresaScopa(giocataDieci, tavolo)
    .find((presa) => presa.length === 4);
  assert.ok(quattroSemi);
  assert.equal(new Set(quattroSemi.map((elemento) => elemento.seme)).size, 4);
  assert.equal(scopa.validaPresaScopa({
    cartaGiocata: giocataDieci, tavolo, presa: quattroSemi,
  }).valida, true);

  // P: ordine e mescolamento non modificano identità o asset.
  const identitaPrima = new Map(deck.map((elemento) => [
    elemento.id,
    `${elemento.seme}|${elemento.valore}|${asset.risolviAssetCarta(elemento)}`,
  ]));
  let mescolato = deck;
  for (let giro = 0; giro < 20; giro += 1) mescolato = mescolaDeterministico(mescolato);
  assert.equal(mescolato.length, 40);
  for (const elemento of mescolato) {
    assert.equal(
      `${elemento.seme}|${elemento.valore}|${asset.risolviAssetCarta(elemento)}`,
      identitaPrima.get(elemento.id)
    );
  }

  console.log('Test identita carte e regole giochi superati.');
}

main();
