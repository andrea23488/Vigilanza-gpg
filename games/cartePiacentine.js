export const CARTE_PIACENTINE = {
  denari: {
    1: require('../assets/carte-piacentine/denari_1.png'),
    2: require('../assets/carte-piacentine/denari_2.png'),
    3: require('../assets/carte-piacentine/denari_3.png'),
    4: require('../assets/carte-piacentine/denari_4.png'),
    5: require('../assets/carte-piacentine/denari_5.png'),
    6: require('../assets/carte-piacentine/denari_6.png'),
    7: require('../assets/carte-piacentine/denari_7.png'),
    8: require('../assets/carte-piacentine/denari_8.png'),
    9: require('../assets/carte-piacentine/denari_9.png'),
    10: require('../assets/carte-piacentine/denari_10.png'),
  },
  coppe: {
    1: require('../assets/carte-piacentine/coppe_1.png'),
    2: require('../assets/carte-piacentine/coppe_2.png'),
    3: require('../assets/carte-piacentine/coppe_3.png'),
    4: require('../assets/carte-piacentine/coppe_4.png'),
    5: require('../assets/carte-piacentine/coppe_5.png'),
    6: require('../assets/carte-piacentine/coppe_6.png'),
    7: require('../assets/carte-piacentine/coppe_7.png'),
    8: require('../assets/carte-piacentine/coppe_8.png'),
    9: require('../assets/carte-piacentine/coppe_9.png'),
    10: require('../assets/carte-piacentine/coppe_10.png'),
  },
  spade: {
    1: require('../assets/carte-piacentine/bastoni_1.png'),
    2: require('../assets/carte-piacentine/bastoni_2.png'),
    3: require('../assets/carte-piacentine/bastoni_3.png'),
    4: require('../assets/carte-piacentine/bastoni_4.png'),
    5: require('../assets/carte-piacentine/bastoni_5.png'),
    6: require('../assets/carte-piacentine/bastoni_6.png'),
    7: require('../assets/carte-piacentine/bastoni_7.png'),
    8: require('../assets/carte-piacentine/bastoni_8.png'),
    9: require('../assets/carte-piacentine/bastoni_9.png'),
    10: require('../assets/carte-piacentine/bastoni_10.png'),
  },
  bastoni: {
    1: require('../assets/carte-piacentine/spade_1.png'),
    2: require('../assets/carte-piacentine/spade_2.png'),
    3: require('../assets/carte-piacentine/spade_3.png'),
    4: require('../assets/carte-piacentine/spade_4.png'),
    5: require('../assets/carte-piacentine/spade_5.png'),
    6: require('../assets/carte-piacentine/spade_6.png'),
    7: require('../assets/carte-piacentine/spade_7.png'),
    8: require('../assets/carte-piacentine/spade_8.png'),
    9: require('../assets/carte-piacentine/spade_9.png'),
    10: require('../assets/carte-piacentine/spade_10.png'),
  },
};

// I file ricevuti originariamente hanno i nomi fisici Spade/Bastoni invertiti:
// bastoni_X.png contiene graficamente le Spade e spade_X.png i Bastoni.
// Questa compensazione è intenzionale e non va rimossa senza sostituire gli asset.
export const IDENTITA_GRAFICA_CARTE_PIACENTINE = {
  denari: { prefissoFile: 'denari', semeDisegnato: 'denari' },
  coppe: { prefissoFile: 'coppe', semeDisegnato: 'coppe' },
  spade: { prefissoFile: 'bastoni', semeDisegnato: 'spade' },
  bastoni: { prefissoFile: 'spade', semeDisegnato: 'bastoni' },
};

export function risolviAssetCarta(carta) {
  const seme = String(carta?.seme || '').toLowerCase();
  const valore = Number(carta?.valore);
  return CARTE_PIACENTINE?.[seme]?.[valore] || null;
}
