import { creaMazzoItaliano, SEMI_ITALIANI } from './mazzoItaliano';
import { creaMazzoBriscola, cartaVincenteBriscola } from './briscolaRegole';
import {
  preparaOpzioniPresaScopa,
  rimuoviPresaDalTavolo,
} from './scopaRegole';

const PRIMIERA = {
  7: 21, 6: 18, 1: 16, 5: 15, 4: 14,
  3: 13, 2: 12, 8: 10, 9: 10, 10: 10,
};

function mescola(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function altroGiocatore(giocatori, userId) {
  return giocatori.find((id) => String(id) !== String(userId)) || null;
}

function valorePrimiera(carte) {
  let totale = 0;
  for (const seme of SEMI_ITALIANI) {
    const gruppo = carte.filter((c) => c.seme === seme.id);
    if (!gruppo.length) return null;
    totale += Math.max(...gruppo.map((c) => PRIMIERA[c.valore] || 0));
  }
  return totale;
}

function punteggioScopa(carteA, carteB, scopeA, scopeB) {
  let a = Number(scopeA || 0);
  let b = Number(scopeB || 0);

  const denariA = carteA.filter((c) => c.seme === 'denari').length;
  const denariB = carteB.filter((c) => c.seme === 'denari').length;

  if (carteA.length > carteB.length) a += 1;
  if (carteB.length > carteA.length) b += 1;

  if (denariA > denariB) a += 1;
  if (denariB > denariA) b += 1;

  if (carteA.some((c) => c.seme === 'denari' && c.valore === 7)) a += 1;
  if (carteB.some((c) => c.seme === 'denari' && c.valore === 7)) b += 1;

  const primieraA = valorePrimiera(carteA);
  const primieraB = valorePrimiera(carteB);

  if (primieraA !== null && primieraB === null) a += 1;
  else if (primieraB !== null && primieraA === null) b += 1;
  else if (primieraA !== null && primieraB !== null) {
    if (primieraA > primieraB) a += 1;
    if (primieraB > primieraA) b += 1;
  }

  return { a, b };
}

export function creaStatoScopaOnline(sfidanteId, sfidatoId) {
  const giocatori = [String(sfidanteId), String(sfidatoId)];
  const mazzo = mescola(creaMazzoItaliano());
  const tavolo = mazzo.slice(0, 4);

  return {
    tipo: 'scopa',
    inizializzato: true,
    giocatori,
    mani: {
      [giocatori[0]]: mazzo.slice(4, 7),
      [giocatori[1]]: mazzo.slice(7, 10),
    },
    mazzo: mazzo.slice(10),
    tavolo,
    prese: {
      [giocatori[0]]: [],
      [giocatori[1]]: [],
    },
    scope: {
      [giocatori[0]]: 0,
      [giocatori[1]]: 0,
    },
    ultimoPresaUserId: null,
    punteggio: null,
    ultimaMossa: null,
  };
}

export function opzioniScopaOnline(stato, userId, cartaId) {
  const carta = (stato?.mani?.[userId] || []).find((c) => c.id === cartaId);
  if (!carta) return [];
  return preparaOpzioniPresaScopa(carta, stato.tavolo || []);
}

export function giocaScopaOnline(stato, userId, cartaId, presaIds = null) {
  const giocatori = stato.giocatori || [];
  const avversarioId = altroGiocatore(giocatori, userId);
  const mano = [...(stato.mani?.[userId] || [])];
  const carta = mano.find((c) => c.id === cartaId);

  if (!carta || !avversarioId) {
    throw new Error('Mossa non valida.');
  }

  const opzioni = preparaOpzioniPresaScopa(carta, stato.tavolo || []);
  let presa = [];

  if (opzioni.length === 1) {
    presa = opzioni[0];
  } else if (opzioni.length > 1) {
    if (!Array.isArray(presaIds) || !presaIds.length) {
      return { richiedeScelta: true, opzioni };
    }
    const chiave = [...presaIds].sort().join('|');
    presa =
      opzioni.find((x) => x.map((c) => c.id).sort().join('|') === chiave) ||
      null;
    if (!presa) throw new Error('Presa non valida.');
  }

  const nuovaMano = mano.filter((c) => c.id !== carta.id);
  let nuovoTavolo = [...(stato.tavolo || [])];
  let prese = {
    ...stato.prese,
    [userId]: [...(stato.prese?.[userId] || [])],
    [avversarioId]: [...(stato.prese?.[avversarioId] || [])],
  };
  const scope = {
    ...stato.scope,
    [userId]: Number(stato.scope?.[userId] || 0),
    [avversarioId]: Number(stato.scope?.[avversarioId] || 0),
  };
  let ultimoPresaUserId = stato.ultimoPresaUserId || null;

  if (presa.length) {
    nuovoTavolo = rimuoviPresaDalTavolo(nuovoTavolo, presa);
    prese[userId] = [...prese[userId], carta, ...presa];
    ultimoPresaUserId = userId;

    const ultimaGiocata =
      (stato.mazzo || []).length === 0 &&
      nuovaMano.length === 0 &&
      (stato.mani?.[avversarioId] || []).length === 0;

    if (nuovoTavolo.length === 0 && !ultimaGiocata) {
      scope[userId] += 1;
    }
  } else {
    nuovoTavolo.push(carta);
  }

  let mazzo = [...(stato.mazzo || [])];
  let mani = {
    ...stato.mani,
    [userId]: nuovaMano,
    [avversarioId]: [...(stato.mani?.[avversarioId] || [])],
  };

  let finita = false;
  let vincitoreId = null;
  let punteggio = null;
  let prossimoTurnoUserId = avversarioId;

  if (mani[userId].length === 0 && mani[avversarioId].length === 0) {
    if (mazzo.length > 0) {
      mani = {
        ...mani,
        [giocatori[0]]: mazzo.slice(0, 3),
        [giocatori[1]]: mazzo.slice(3, 6),
      };
      mazzo = mazzo.slice(6);
    } else {
      if (nuovoTavolo.length && ultimoPresaUserId) {
        prese[ultimoPresaUserId] = [
          ...prese[ultimoPresaUserId],
          ...nuovoTavolo,
        ];
        nuovoTavolo = [];
      }

      const punti = punteggioScopa(
        prese[giocatori[0]],
        prese[giocatori[1]],
        scope[giocatori[0]],
        scope[giocatori[1]]
      );

      punteggio = {
        [giocatori[0]]: punti.a,
        [giocatori[1]]: punti.b,
      };
      finita = true;
      prossimoTurnoUserId = null;
      if (punti.a > punti.b) vincitoreId = giocatori[0];
      if (punti.b > punti.a) vincitoreId = giocatori[1];
    }
  }

  return {
    richiedeScelta: false,
    stato: {
      ...stato,
      mani,
      mazzo,
      tavolo: nuovoTavolo,
      prese,
      scope,
      ultimoPresaUserId,
      punteggio,
      ultimaMossa: {
        userId,
        carta,
        presaIds: presa.map((c) => c.id),
        at: new Date().toISOString(),
      },
    },
    prossimoTurnoUserId,
    finita,
    vincitoreId,
  };
}

export function creaStatoBriscolaOnline(sfidanteId, sfidatoId) {
  const giocatori = [String(sfidanteId), String(sfidatoId)];
  const carte = mescola(creaMazzoBriscola());
  const briscola = carte[6];
  const mazzo = [...carte.slice(7), briscola];

  return {
    tipo: 'briscola',
    inizializzato: true,
    giocatori,
    mani: {
      [giocatori[0]]: carte.slice(0, 3),
      [giocatori[1]]: carte.slice(3, 6),
    },
    mazzo,
    briscola,
    tavolo: [],
    apreUserId: giocatori[0],
    punti: {
      [giocatori[0]]: 0,
      [giocatori[1]]: 0,
    },
    ultimaPresa: null,
  };
}

export function giocaBriscolaOnline(stato, userId, cartaId) {
  const giocatori = stato.giocatori || [];
  const avversarioId = altroGiocatore(giocatori, userId);
  const mano = [...(stato.mani?.[userId] || [])];
  const carta = mano.find((c) => c.id === cartaId);

  if (!carta || !avversarioId) throw new Error('Mossa non valida.');

  let mani = {
    ...stato.mani,
    [userId]: mano.filter((c) => c.id !== cartaId),
    [avversarioId]: [...(stato.mani?.[avversarioId] || [])],
  };

  const tavoloCorrente = [...(stato.tavolo || [])];
  const nuovaGiocata = { userId, carta };
  let mazzo = [...(stato.mazzo || [])];
  let punti = {
    ...stato.punti,
    [userId]: Number(stato.punti?.[userId] || 0),
    [avversarioId]: Number(stato.punti?.[avversarioId] || 0),
  };
  let prossimoTurnoUserId;
  let tavolo;
  let apreUserId = stato.apreUserId || userId;
  let ultimaPresa = stato.ultimaPresa || null;
  let finita = false;
  let vincitoreId = null;

  if (tavoloCorrente.length === 0) {
    tavolo = [nuovaGiocata];
    apreUserId = userId;
    prossimoTurnoUserId = avversarioId;
  } else {
    const prima = tavoloCorrente[0];
    const vincente = cartaVincenteBriscola(
      prima.carta,
      carta,
      stato.briscola.seme
    );

    const vincitorePresaId =
      vincente.id === prima.carta.id ? prima.userId : userId;

    const perdenteId = altroGiocatore(giocatori, vincitorePresaId);
    const puntiPresa =
      Number(prima.carta.punti || 0) + Number(carta.punti || 0);

    punti[vincitorePresaId] =
      Number(punti[vincitorePresaId] || 0) + puntiPresa;

    if (mazzo.length > 0) {
      const pescaVincitore = mazzo.shift();
      if (pescaVincitore) {
        mani[vincitorePresaId] = [
          ...(mani[vincitorePresaId] || []),
          pescaVincitore,
        ];
      }

      const pescaPerdente = mazzo.shift();
      if (pescaPerdente) {
        mani[perdenteId] = [
          ...(mani[perdenteId] || []),
          pescaPerdente,
        ];
      }
    }

    ultimaPresa = {
      vincitoreUserId: vincitorePresaId,
      carte: [prima.carta, carta],
      punti: puntiPresa,
      at: new Date().toISOString(),
    };

    tavolo = [];
    apreUserId = vincitorePresaId;
    prossimoTurnoUserId = vincitorePresaId;

    const senzaCarte =
      mazzo.length === 0 &&
      (mani[giocatori[0]] || []).length === 0 &&
      (mani[giocatori[1]] || []).length === 0;

    if (senzaCarte) {
      finita = true;
      prossimoTurnoUserId = null;
      const a = punti[giocatori[0]] || 0;
      const b = punti[giocatori[1]] || 0;
      if (a > b) vincitoreId = giocatori[0];
      if (b > a) vincitoreId = giocatori[1];
    }
  }

  return {
    stato: {
      ...stato,
      mani,
      mazzo,
      tavolo,
      apreUserId,
      punti,
      ultimaPresa,
    },
    prossimoTurnoUserId,
    finita,
    vincitoreId,
  };
}
