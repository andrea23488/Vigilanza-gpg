import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NapoletanaCard from './NapoletanaCard';


const SEMI = [
  { id: 'denari', nome: 'Denari' },
  { id: 'coppe', nome: 'Coppe' },
  { id: 'spade', nome: 'Spade' },
  { id: 'bastoni', nome: 'Bastoni' },
];

const VALORI = [
  { valore: 1, nome: 'Asso', punti: 11, forza: 10 },
  { valore: 2, nome: 'Due', punti: 0, forza: 1 },
  { valore: 3, nome: 'Tre', punti: 10, forza: 9 },
  { valore: 4, nome: 'Quattro', punti: 0, forza: 2 },
  { valore: 5, nome: 'Cinque', punti: 0, forza: 3 },
  { valore: 6, nome: 'Sei', punti: 0, forza: 4 },
  { valore: 7, nome: 'Sette', punti: 0, forza: 5 },
  { valore: 8, nome: 'Fante', punti: 2, forza: 6 },
  { valore: 9, nome: 'Cavallo', punti: 3, forza: 7 },
  { valore: 10, nome: 'Re', punti: 4, forza: 8 },
];


function creaMazzo() {
  const mazzo = [];

  SEMI.forEach((seme) => {
    VALORI.forEach((valore) => {
      mazzo.push({
        ...valore,
        seme: seme.id,
        semeNome: seme.nome,
        id: `${seme.id}-${valore.valore}`,
      });
    });
  });

  return mazzo;
}


function mescola(array) {
  const copia = [...array];

  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }

  return copia;
}


function cartaVincente(prima, seconda, semeBriscola) {
  if (prima.seme === seconda.seme) {
    return prima.forza > seconda.forza
      ? prima
      : seconda;
  }

  if (
    prima.seme === semeBriscola &&
    seconda.seme !== semeBriscola
  ) {
    return prima;
  }

  if (
    seconda.seme === semeBriscola &&
    prima.seme !== semeBriscola
  ) {
    return seconda;
  }

  // Se i semi sono diversi e nessuna è briscola,
  // vince chi ha giocato per primo.
  return prima;
}


export default function BriscolaGame({ onBack }) {
  const [mazzo, setMazzo] = React.useState([]);
  const [manoGiocatore, setManoGiocatore] = React.useState([]);
  const [manoCpu, setManoCpu] = React.useState([]);

  const [briscola, setBriscola] = React.useState(null);

  const [cartaGiocatore, setCartaGiocatore] = React.useState(null);
  const [cartaCpu, setCartaCpu] = React.useState(null);

  const [puntiGiocatore, setPuntiGiocatore] = React.useState(0);
  const [puntiCpu, setPuntiCpu] = React.useState(0);

  const [chiApre, setChiApre] = React.useState('giocatore');
  const [fase, setFase] = React.useState('giocatore');

  const [messaggio, setMessaggio] = React.useState(
    'Tocca una carta per giocare.'
  );

  const timeoutRef = React.useRef(null);

  const puntiGiocatoreRef = React.useRef(0);
  const puntiCpuRef = React.useRef(0);


  const pulisciTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };


  React.useEffect(() => {
    return () => {
      pulisciTimeout();
    };
  }, []);


  const nuovaPartita = React.useCallback(() => {
    pulisciTimeout();

    const nuovoMazzo = mescola(creaMazzo());

    const manoG = nuovoMazzo.splice(0, 3);
    const manoC = nuovoMazzo.splice(0, 3);

    // La carta di briscola resta nel mazzo ed è l'ultima.
    const cartaBriscola =
      nuovoMazzo[nuovoMazzo.length - 1];

    setMazzo(nuovoMazzo);
    setManoGiocatore(manoG);
    setManoCpu(manoC);

    setBriscola(cartaBriscola);

    setCartaGiocatore(null);
    setCartaCpu(null);

    puntiGiocatoreRef.current = 0;
    puntiCpuRef.current = 0;

    setPuntiGiocatore(0);
    setPuntiCpu(0);

    setChiApre('giocatore');
    setFase('giocatore');

    setMessaggio(
      'Tocca una carta per giocare.'
    );
  }, []);


  React.useEffect(() => {
    nuovaPartita();
  }, [nuovaPartita]);


  const scegliCartaCpu = (
    mano,
    cartaAvversario = null
  ) => {
    if (!mano.length) {
      return null;
    }

    const semeBriscola =
      briscola?.seme;

    // CPU apre la mano:
    // cerca di scartare una carta poco preziosa.
    if (!cartaAvversario) {
      const nonBriscole = mano.filter(
        (carta) =>
          carta.seme !== semeBriscola
      );

      const disponibili =
        nonBriscole.length
          ? nonBriscole
          : mano;

      return [...disponibili].sort(
        (a, b) =>
          a.punti - b.punti ||
          a.forza - b.forza
      )[0];
    }

    // CPU risponde:
    // se può vincere, usa la carta vincente meno costosa.
    const vincenti = mano.filter((carta) => {
      const vincente = cartaVincente(
        cartaAvversario,
        carta,
        semeBriscola
      );

      return vincente.id === carta.id;
    });

    if (vincenti.length) {
      return [...vincenti].sort(
        (a, b) =>
          a.punti - b.punti ||
          a.forza - b.forza
      )[0];
    }

    // Altrimenti scarta la carta meno preziosa.
    return [...mano].sort(
      (a, b) =>
        a.punti - b.punti ||
        a.forza - b.forza
    )[0];
  };


  const controllaFine = (
    manoG,
    manoC,
    mazzoCorrente
  ) => {
    if (
      mazzoCorrente.length === 0 &&
      manoG.length === 0 &&
      manoC.length === 0
    ) {
      setFase('fine');

      if (
        puntiGiocatoreRef.current >
        puntiCpuRef.current
      ) {
        setMessaggio('Hai vinto la partita!');
      } else if (
        puntiCpuRef.current >
        puntiGiocatoreRef.current
      ) {
        setMessaggio('Ha vinto il computer.');
      } else {
        setMessaggio('Pareggio: 60 a 60.');
      }

      return true;
    }

    return false;
  };


  const pescaDopoPresa = (
    vincitore,
    manoG,
    manoC,
    mazzoCorrente
  ) => {
    const nuovoMazzo = [...mazzoCorrente];
    const nuovaManoG = [...manoG];
    const nuovaManoC = [...manoC];

    // Chi prende pesca per primo.
    if (nuovoMazzo.length > 0) {
      if (vincitore === 'giocatore') {
        const prima = nuovoMazzo.shift();

        if (prima) {
          nuovaManoG.push(prima);
        }

        const seconda = nuovoMazzo.shift();

        if (seconda) {
          nuovaManoC.push(seconda);
        }
      } else {
        const prima = nuovoMazzo.shift();

        if (prima) {
          nuovaManoC.push(prima);
        }

        const seconda = nuovoMazzo.shift();

        if (seconda) {
          nuovaManoG.push(seconda);
        }
      }
    }

    setMazzo(nuovoMazzo);
    setManoGiocatore(nuovaManoG);
    setManoCpu(nuovaManoC);

    return {
      nuovoMazzo,
      nuovaManoG,
      nuovaManoC,
    };
  };


  const cpuApreLaMano = (
    manoG,
    manoC,
    mazzoCorrente
  ) => {
    if (!manoC.length) {
      controllaFine(
        manoG,
        manoC,
        mazzoCorrente
      );
      return;
    }

    setFase('cpu');
    setMessaggio(
      'Il computer sta giocando...'
    );

    timeoutRef.current = setTimeout(() => {
      const scelta =
        scegliCartaCpu(manoC);

      if (!scelta) {
        return;
      }

      const nuovaManoC =
        manoC.filter(
          (carta) =>
            carta.id !== scelta.id
        );

      setManoCpu(nuovaManoC);
      setCartaCpu(scelta);

      setChiApre('cpu');
      setFase('giocatore');

      setMessaggio(
        'La CPU ha giocato. Tocca una tua carta.'
      );
    }, 650);
  };


  const risolviPresa = (
    prima,
    seconda,
    giocatoreCheHaAperto,
    manoG,
    manoC,
    mazzoCorrente
  ) => {
    const vincente = cartaVincente(
      prima,
      seconda,
      briscola.seme
    );

    const vincitore =
      vincente.id === prima.id
        ? giocatoreCheHaAperto
        : giocatoreCheHaAperto === 'giocatore'
        ? 'cpu'
        : 'giocatore';

    const puntiPresa =
      Number(prima.punti || 0) + Number(seconda.punti || 0);

    console.log(
      '🃏 PRESA BRISCOLA:',
      prima.nome,
      prima.semeNome,
      prima.punti,
      '+',
      seconda.nome,
      seconda.semeNome,
      seconda.punti,
      '=',
      puntiPresa,
      '| vincitore:',
      vincitore
    );

    if (vincitore === 'giocatore') {
      puntiGiocatoreRef.current += puntiPresa;

      setPuntiGiocatore(
        puntiGiocatoreRef.current
      );

      setMessaggio(
        `Presa tua · ${prima.nome} (${prima.punti}) + ${seconda.nome} (${seconda.punti}) = +${puntiPresa}`
      );
    } else {
      puntiCpuRef.current += puntiPresa;

      setPuntiCpu(
        puntiCpuRef.current
      );

      setMessaggio(
        `Presa CPU · ${prima.nome} (${prima.punti}) + ${seconda.nome} (${seconda.punti}) = +${puntiPresa}`
      );
    }

    setFase('risoluzione');

    timeoutRef.current = setTimeout(() => {
      setCartaGiocatore(null);
      setCartaCpu(null);

      const risultato = pescaDopoPresa(
        vincitore,
        manoG,
        manoC,
        mazzoCorrente
      );

      setChiApre(vincitore);

      if (
        controllaFine(
          risultato.nuovaManoG,
          risultato.nuovaManoC,
          risultato.nuovoMazzo
        )
      ) {
        return;
      }

      if (vincitore === 'giocatore') {
        setFase('giocatore');

        setMessaggio(
          'Hai preso. Tocca una carta.'
        );
      } else {
        setMessaggio(
          'Ha preso la CPU.'
        );

        cpuApreLaMano(
          risultato.nuovaManoG,
          risultato.nuovaManoC,
          risultato.nuovoMazzo
        );
      }
    }, 950);
  };


  const giocaCartaGiocatore = (carta) => {
    if (fase !== 'giocatore') {
      return;
    }

    const nuovaManoG =
      manoGiocatore.filter(
        (item) =>
          item.id !== carta.id
      );

    setManoGiocatore(
      nuovaManoG
    );

    setCartaGiocatore(
      carta
    );

    // La CPU aveva aperto.
    if (
      chiApre === 'cpu' &&
      cartaCpu
    ) {
      setFase('risoluzione');

      risolviPresa(
        cartaCpu,
        carta,
        'cpu',
        nuovaManoG,
        manoCpu,
        mazzo
      );

      return;
    }

    // Il giocatore apre, la CPU deve rispondere.
    setChiApre('giocatore');
    setFase('cpu');

    setMessaggio(
      'Il computer sta pensando...'
    );

    timeoutRef.current = setTimeout(() => {
      const sceltaCpu =
        scegliCartaCpu(
          manoCpu,
          carta
        );

      if (!sceltaCpu) {
        return;
      }

      const nuovaManoC =
        manoCpu.filter(
          (item) =>
            item.id !== sceltaCpu.id
        );

      setManoCpu(
        nuovaManoC
      );

      setCartaCpu(
        sceltaCpu
      );

      timeoutRef.current = setTimeout(() => {
        risolviPresa(
          carta,
          sceltaCpu,
          'giocatore',
          nuovaManoG,
          nuovaManoC,
          mazzo
        );
      }, 450);
    }, 600);
  };


  const testoRisultato = () => {
    if (
      puntiGiocatore >
      puntiCpu
    ) {
      return 'HAI VINTO';
    }

    if (
      puntiCpu >
      puntiGiocatore
    ) {
      return 'VINCE LA CPU';
    }

    return 'PAREGGIO';
  };


  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: '#07142F',
      }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: 18,
          paddingBottom: 60,
        }}
      >

        <TouchableOpacity
          onPress={onBack}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor:
              'rgba(255,255,255,0.08)',
            marginBottom: 15,
          }}
        >
          <Ionicons
            name="chevron-back"
            size={25}
            color="#FFFFFF"
          />
        </TouchableOpacity>


        <View
          style={{
            padding: 18,
            borderRadius: 24,
            backgroundColor: '#195436',
            borderWidth: 1,
            borderColor:
              'rgba(101,228,154,0.45)',
            marginBottom: 14,
          }}
        >
          <Text
            style={{
              color: '#75E8A6',
              fontSize: 10,
              fontWeight: '900',
              letterSpacing: 1.4,
            }}
          >
            CARTE NAPOLETANE
          </Text>

          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 30,
              fontWeight: '900',
              marginTop: 3,
            }}
          >
            Briscola
          </Text>

          <Text
            style={{
              color: '#B1D4BD',
              fontSize: 12,
              marginTop: 5,
            }}
          >
            Tu contro il computer
          </Text>
        </View>


        <View
          style={{
            flexDirection: 'row',
            marginBottom: 13,
          }}
        >
          <View
            style={{
              flex: 1,
              marginRight: 6,
              padding: 11,
              borderRadius: 16,
              alignItems: 'center',
              backgroundColor:
                'rgba(255,255,255,0.055)',
            }}
          >
            <Text
              style={{
                color: '#94A7BD',
                fontSize: 9,
                fontWeight: '900',
              }}
            >
              TU
            </Text>

            <Text
              style={{
                color: '#65E49A',
                fontSize: 22,
                fontWeight: '900',
              }}
            >
              {puntiGiocatore}
            </Text>
          </View>


          <View
            style={{
              flex: 1,
              marginLeft: 6,
              padding: 11,
              borderRadius: 16,
              alignItems: 'center',
              backgroundColor:
                'rgba(255,255,255,0.055)',
            }}
          >
            <Text
              style={{
                color: '#94A7BD',
                fontSize: 9,
                fontWeight: '900',
              }}
            >
              CPU
            </Text>

            <Text
              style={{
                color: '#85B9FF',
                fontSize: 22,
                fontWeight: '900',
              }}
            >
              {puntiCpu}
            </Text>
          </View>
        </View>


        {briscola && (
          <View
            style={{
              padding: 13,
              borderRadius: 19,
              backgroundColor:
                'rgba(255,255,255,0.05)',
              marginBottom: 15,
              borderWidth: 1,
              borderColor:
                'rgba(255,255,255,0.09)',
            }}
          >
            <Text
              style={{
                color: '#93A8BF',
                fontSize: 9,
                fontWeight: '900',
                marginBottom: 9,
              }}
            >
              BRISCOLA · {briscola.semeNome.toUpperCase()}
            </Text>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <NapoletanaCard
                carta={briscola}
                piccola
              />

              <View
                style={{
                  flex: 1,
                  marginLeft: 13,
                }}
              >
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 17,
                    fontWeight: '900',
                  }}
                >
                  {briscola.semeNome}
                </Text>

                <Text
                  style={{
                    color: '#91A4B7',
                    fontSize: 11,
                    marginTop: 4,
                  }}
                >
                  Mazzo: {mazzo.length} carte
                </Text>

                <Text
                  style={{
                    color: '#B8C6D4',
                    fontSize: 10,
                    lineHeight: 15,
                    marginTop: 6,
                  }}
                >
                  {messaggio}
                </Text>
              </View>
            </View>
          </View>
        )}


        {fase === 'fine' ? (
          <View
            style={{
              padding: 24,
              borderRadius: 24,
              alignItems: 'center',
              backgroundColor:
                'rgba(255,255,255,0.055)',
              borderWidth: 1,
              borderColor:
                'rgba(101,228,154,0.30)',
            }}
          >
            <Ionicons
              name="trophy-outline"
              size={50}
              color="#65E49A"
            />

            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 24,
                fontWeight: '900',
                marginTop: 12,
              }}
            >
              {testoRisultato()}
            </Text>

            <Text
              style={{
                color: '#65E49A',
                fontSize: 37,
                fontWeight: '900',
                marginTop: 7,
              }}
            >
              {puntiGiocatore}
              {' - '}
              {puntiCpu}
            </Text>

            <Text
              style={{
                color: '#9DB0C3',
                fontSize: 11,
                marginTop: 6,
              }}
            >
              Totale: {puntiGiocatore + puntiCpu} / 120 punti
            </Text>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={nuovaPartita}
              style={{
                width: '100%',
                minHeight: 50,
                marginTop: 20,
                borderRadius: 17,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#187847',
              }}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: '900',
                }}
              >
                NUOVA PARTITA
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>

            <Text
              style={{
                color: '#9AAEC3',
                fontSize: 10,
                fontWeight: '900',
                marginBottom: 8,
              }}
            >
              COMPUTER
            </Text>


            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              {manoCpu.map((carta) => (
                <NapoletanaCard
                  key={carta.id}
                  carta={carta}
                  coperta
                  piccola
                />
              ))}
            </View>


            <View
              style={{
                minHeight: 165,
                borderRadius: 24,
                backgroundColor:
                  'rgba(18,73,47,0.55)',
                borderWidth: 1,
                borderColor:
                  'rgba(83,213,133,0.25)',
                padding: 14,
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  color: '#78A188',
                  fontSize: 9,
                  fontWeight: '900',
                  textAlign: 'center',
                  marginBottom: 10,
                }}
              >
                TAVOLO
              </Text>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-around',
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: '#9CB0BE',
                      fontSize: 9,
                      fontWeight: '900',
                      marginBottom: 6,
                    }}
                  >
                    CPU
                  </Text>

                  {cartaCpu ? (
                    <NapoletanaCard
                      carta={cartaCpu}
                      piccola
                    />
                  ) : (
                    <View
                      style={{
                        width: 68,
                        height: 104,
                        borderRadius: 13,
                        borderWidth: 1,
                        borderStyle: 'dashed',
                        borderColor:
                          'rgba(255,255,255,0.16)',
                      }}
                    />
                  )}
                </View>


                <Text
                  style={{
                    color: '#6F9A80',
                    fontSize: 17,
                    fontWeight: '900',
                  }}
                >
                  VS
                </Text>


                <View
                  style={{
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: '#9CB0BE',
                      fontSize: 9,
                      fontWeight: '900',
                      marginBottom: 6,
                    }}
                  >
                    TU
                  </Text>

                  {cartaGiocatore ? (
                    <NapoletanaCard
                      carta={cartaGiocatore}
                      piccola
                    />
                  ) : (
                    <View
                      style={{
                        width: 68,
                        height: 104,
                        borderRadius: 13,
                        borderWidth: 1,
                        borderStyle: 'dashed',
                        borderColor:
                          'rgba(255,255,255,0.16)',
                      }}
                    />
                  )}
                </View>
              </View>
            </View>


            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 11,
                fontWeight: '900',
                marginBottom: 10,
              }}
            >
              LE TUE CARTE
            </Text>


            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              {manoGiocatore.map((carta) => (
                <NapoletanaCard
                  key={carta.id}
                  carta={carta}
                  onPress={() =>
                    giocaCartaGiocatore(carta)
                  }
                  disabled={
                    fase !== 'giocatore'
                  }
                />
              ))}
            </View>


            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                Alert.alert(
                  'Nuova partita',
                  'Vuoi abbandonare la partita e ricominciare?',
                  [
                    {
                      text: 'Annulla',
                      style: 'cancel',
                    },
                    {
                      text: 'Ricomincia',
                      style: 'destructive',
                      onPress: nuovaPartita,
                    },
                  ]
                );
              }}
              style={{
                minHeight: 47,
                borderRadius: 17,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor:
                  'rgba(255,255,255,0.07)',
                borderWidth: 1,
                borderColor:
                  'rgba(255,255,255,0.10)',
                marginTop: 23,
              }}
            >
              <Text
                style={{
                  color: '#B9C5D1',
                  fontSize: 11,
                  fontWeight: '900',
                }}
              >
                RICOMINCIA PARTITA
              </Text>
            </TouchableOpacity>

          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}
