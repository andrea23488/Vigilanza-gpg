import { nomeCompletoCarta } from './mazzoItaliano';
import { risolviAssetCarta } from './cartePiacentine';

export function combinazioniSomma(carte, target) {
  const risultati = [];

  function cerca(indice, corrente, somma) {
    if (somma === target) {
      risultati.push([...corrente]);
      return;
    }
    if (somma > target) return;

    for (let i = indice; i < carte.length; i += 1) {
      cerca(
        i + 1,
        [...corrente, carte[i]],
        somma + carte[i].valore
      );
    }
  }

  cerca(0, [], 0);
  return risultati;
}

export function trovaPresePossibili(carta, tavolo) {
  const uguali = tavolo.filter((elemento) =>
    elemento.valore === carta.valore
  );
  if (uguali.length > 0) return uguali.map((elemento) => [elemento]);
  return combinazioniSomma(tavolo, carta.valore);
}

export function preparaOpzioniPresaScopa(cartaGiocata, tavolo) {
  return trovaPresePossibili(cartaGiocata, tavolo).filter((presa) =>
    validaPresaScopa({ cartaGiocata, tavolo, presa }).valida
  );
}

export function chiavePresaScopa(presa) {
  return presa.map((carta) => carta.id).join('|');
}

export function testoPresaScopa(presa) {
  return presa
    .map((carta) => `${carta.valore} ${carta.semeNome}`)
    .join(' + ');
}

export function validaPresaScopa({ cartaGiocata, tavolo, presa }) {
  const ids = presa.map((carta) => carta.id);
  const idsUnici = new Set(ids);
  const tavoloPerId = new Map(tavolo.map((carta) => [carta.id, carta]));
  const carteReali = ids.map((id) => tavoloPerId.get(id));
  const identitaCoerente = carteReali.every((reale, indice) =>
    reale &&
    reale.seme === presa[indice].seme &&
    reale.valore === presa[indice].valore
  );
  const ugualiSulTavolo = tavolo.filter((carta) =>
    carta.valore === cartaGiocata.valore
  );
  const somma = carteReali.reduce(
    (totale, carta) => totale + Number(carta?.valore || 0),
    0
  );
  const regolaValida = ugualiSulTavolo.length > 0
    ? carteReali.length === 1 && carteReali[0]?.valore === cartaGiocata.valore
    : somma === cartaGiocata.valore;

  return {
    valida:
      ids.length > 0 &&
      idsUnici.size === ids.length &&
      carteReali.every(Boolean) &&
      identitaCoerente &&
      regolaValida,
    idsUnici: idsUnici.size === ids.length,
    tutteSulTavolo: carteReali.every(Boolean),
    identitaCoerente,
    somma,
    regolaValida,
    carteReali: carteReali.filter(Boolean),
  };
}

export function rimuoviPresaDalTavolo(tavolo, presa) {
  const ids = new Set(presa.map((carta) => carta.id));
  return tavolo.filter((carta) => !ids.has(carta.id));
}

export function diagnosticaOpzioniScopa({ cartaGiocata, tavolo, opzioni }) {
  return {
    cartaGiocata: descriviCarta(cartaGiocata),
    tavolo: tavolo.map(descriviCarta),
    opzioni: opzioni.map((presa) => ({
      chiave: chiavePresaScopa(presa),
      testo: testoPresaScopa(presa),
      carte: presa.map(descriviCarta),
      verifica: validaPresaScopa({ cartaGiocata, tavolo, presa }),
    })),
  };
}

function descriviCarta(carta) {
  return {
    id: carta?.id || null,
    seme: carta?.seme || null,
    valore: Number(carta?.valore),
    nomeVisualizzato: nomeCompletoCarta(carta),
    asset: risolviAssetCarta(carta),
  };
}
