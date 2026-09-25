import { creaMazzoItaliano } from './mazzoItaliano';

export const REGOLE_BRISCOLA = {
  1: { punti: 11, forza: 10 },
  2: { punti: 0, forza: 1 },
  3: { punti: 10, forza: 9 },
  4: { punti: 0, forza: 2 },
  5: { punti: 0, forza: 3 },
  6: { punti: 0, forza: 4 },
  7: { punti: 0, forza: 5 },
  8: { punti: 2, forza: 6 },
  9: { punti: 3, forza: 7 },
  10: { punti: 4, forza: 8 },
};

export function creaMazzoBriscola() {
  return creaMazzoItaliano((carta) => REGOLE_BRISCOLA[carta.valore]);
}

export function cartaVincenteBriscola(prima, seconda, semeBriscola) {
  if (prima.seme === seconda.seme) {
    return prima.forza > seconda.forza ? prima : seconda;
  }
  if (prima.seme === semeBriscola && seconda.seme !== semeBriscola) {
    return prima;
  }
  if (seconda.seme === semeBriscola && prima.seme !== semeBriscola) {
    return seconda;
  }
  return prima;
}
