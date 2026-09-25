export const SEMI_ITALIANI = [
  { id: 'denari', nome: 'Denari' },
  { id: 'coppe', nome: 'Coppe' },
  { id: 'spade', nome: 'Spade' },
  { id: 'bastoni', nome: 'Bastoni' },
];

export const VALORI_ITALIANI = [
  { valore: 1, nome: 'Asso' },
  { valore: 2, nome: 'Due' },
  { valore: 3, nome: 'Tre' },
  { valore: 4, nome: 'Quattro' },
  { valore: 5, nome: 'Cinque' },
  { valore: 6, nome: 'Sei' },
  { valore: 7, nome: 'Sette' },
  { valore: 8, nome: 'Fante' },
  { valore: 9, nome: 'Cavallo' },
  { valore: 10, nome: 'Re' },
];

export function nomeCompletoCarta(carta) {
  if (!carta) return '';
  return `${carta.nome} di ${carta.semeNome}`;
}

export function creaMazzoItaliano(estendiCarta) {
  return SEMI_ITALIANI.flatMap((seme) =>
    VALORI_ITALIANI.map((valore) => {
      const carta = {
        id: `${seme.id}-${valore.valore}`,
        seme: seme.id,
        semeNome: seme.nome,
        valore: valore.valore,
        numero: valore.valore,
        nome: valore.nome,
      };

      return typeof estendiCarta === 'function'
        ? { ...carta, ...estendiCarta(carta) }
        : carta;
    })
  );
}
