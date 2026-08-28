import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import NapoletanaCard from './NapoletanaCard';

const SEMI = [
  { key: 'denari', nome: 'Denari' },
  { key: 'coppe', nome: 'Coppe' },
  { key: 'spade', nome: 'Spade' },
  { key: 'bastoni', nome: 'Bastoni' },
];

const NOMI = {
  1: 'Asso',
  2: 'Due',
  3: 'Tre',
  4: 'Quattro',
  5: 'Cinque',
  6: 'Sei',
  7: 'Sette',
  8: 'Fante',
  9: 'Cavallo',
  10: 'Re',
};

const PRIMIERA = {
  7: 21,
  6: 18,
  1: 16,
  5: 15,
  4: 14,
  3: 13,
  2: 12,
  8: 10,
  9: 10,
  10: 10,
};

function creaMazzo() {
  return SEMI.flatMap((seme) =>
    Array.from({ length: 10 }, (_, i) => {
      const valore = i + 1;

      return {
        id: `${seme.key}-${valore}`,
        seme: seme.key,
        semeNome: seme.nome,
        valore,
        numero: valore,
        nome: NOMI[valore],
        forza: valore,
        punti: 0,
      };
    })
  );
}

function mescola(array) {
  const a = [...array];

  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }

  return a;
}

function combinazioniSomma(carte, target) {
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

function trovaPresePossibili(carta, tavolo) {
  // Nella Scopa, se sul tavolo esiste una carta dello stesso
  // valore di quella giocata, bisogna prendere una di quelle
  // e non è possibile scegliere una combinazione alternativa.
  const uguali = tavolo.filter((c) => c.valore === carta.valore);

  if (uguali.length > 0) {
    return uguali.map((c) => [c]);
  }

  return combinazioniSomma(tavolo, carta.valore);
}

function scegliMigliorePresaCpu(carta, tavolo) {
  const opzioni = trovaPresePossibili(carta, tavolo);

  if (!opzioni.length) return [];

  const valutate = opzioni.map((presa) => {
    let valore = presa.length * 10;

    if (
      presa.some(
        (c) => c.seme === 'denari' && c.valore === 7
      )
    ) {
      valore += 100;
    }

    valore += presa.filter(
      (c) => c.seme === 'denari'
    ).length * 5;

    if (presa.length === tavolo.length) {
      valore += 50;
    }

    valore += presa.reduce(
      (tot, c) => tot + (PRIMIERA[c.valore] || 0),
      0
    );

    return { presa, valore };
  });

  valutate.sort((a, b) => b.valore - a.valore);

  return valutate[0].presa;
}

function valorePrimiera(carte) {
  let totale = 0;

  for (const seme of SEMI) {
    const delSeme = carte.filter((c) => c.seme === seme.key);

    // Senza almeno una carta di ogni seme
    // la primiera non è valida.
    if (!delSeme.length) {
      return null;
    }

    const migliore = Math.max(
      ...delSeme.map((c) => PRIMIERA[c.valore] || 0)
    );

    totale += migliore;
  }

  return totale;
}

function calcolaPunti(preseGiocatore, preseCpu, scopeGiocatore, scopeCpu) {
  let giocatore = scopeGiocatore;
  let cpu = scopeCpu;

  const carteG = preseGiocatore.length;
  const carteC = preseCpu.length;

  const denariG = preseGiocatore.filter(
    (c) => c.seme === 'denari'
  ).length;

  const denariC = preseCpu.filter(
    (c) => c.seme === 'denari'
  ).length;

  const settebelloG = preseGiocatore.some(
    (c) => c.seme === 'denari' && c.valore === 7
  );

  const settebelloC = preseCpu.some(
    (c) => c.seme === 'denari' && c.valore === 7
  );

  const primieraG = valorePrimiera(preseGiocatore);
  const primieraC = valorePrimiera(preseCpu);

  let puntoCarte = null;
  let puntoDenari = null;
  let puntoPrimiera = null;

  // PIÙ CARTE
  if (carteG > carteC) {
    giocatore += 1;
    puntoCarte = 'giocatore';
  } else if (carteC > carteG) {
    cpu += 1;
    puntoCarte = 'cpu';
  }

  // PIÙ DENARI
  if (denariG > denariC) {
    giocatore += 1;
    puntoDenari = 'giocatore';
  } else if (denariC > denariG) {
    cpu += 1;
    puntoDenari = 'cpu';
  }

  // SETTEBELLO
  if (settebelloG) giocatore += 1;
  if (settebelloC) cpu += 1;

  // PRIMIERA
  if (primieraG !== null && primieraC === null) {
    giocatore += 1;
    puntoPrimiera = 'giocatore';
  } else if (primieraC !== null && primieraG === null) {
    cpu += 1;
    puntoPrimiera = 'cpu';
  } else if (
    primieraG !== null &&
    primieraC !== null
  ) {
    if (primieraG > primieraC) {
      giocatore += 1;
      puntoPrimiera = 'giocatore';
    } else if (primieraC > primieraG) {
      cpu += 1;
      puntoPrimiera = 'cpu';
    }
  }

  return {
    giocatore,
    cpu,
    carteG,
    carteC,
    denariG,
    denariC,
    settebelloG,
    settebelloC,
    primieraG,
    primieraC,
    puntoCarte,
    puntoDenari,
    puntoPrimiera,
  };
}

export default function ScopaGame({ onBack }) {
  const [manoGiocatore, setManoGiocatore] = useState([]);
  const [manoCpu, setManoCpu] = useState([]);
  const [tavolo, setTavolo] = useState([]);
  const [mazzo, setMazzo] = useState([]);
  const [preseGiocatore, setPreseGiocatore] = useState([]);
  const [preseCpu, setPreseCpu] = useState([]);
  const [scopeGiocatore, setScopeGiocatore] = useState(0);
  const [scopeCpu, setScopeCpu] = useState(0);
  const [ultimoAPrendere, setUltimoAPrendere] = useState(null);
  const [messaggio, setMessaggio] = useState('Premi NUOVA PARTITA');
  const [bloccato, setBloccato] = useState(false);
  const [fine, setFine] = useState(false);
  const [puntiPartitaGiocatore, setPuntiPartitaGiocatore] = useState(0);
  const [puntiPartitaCpu, setPuntiPartitaCpu] = useState(0);
  const [riepilogoMano, setRiepilogoMano] = useState(null);
  const [partitaFinita, setPartitaFinita] = useState(false);
  const [cpuIniziaProssima, setCpuIniziaProssima] = useState(false);
  const [flashScopa, setFlashScopa] = useState(null);
  const [cartaDaGiocare, setCartaDaGiocare] = useState(null);
  const [opzioniPresa, setOpzioniPresa] = useState([]);

  const risultato = useMemo(
    () =>
      calcolaPunti(
        preseGiocatore,
        preseCpu,
        scopeGiocatore,
        scopeCpu
      ),
    [preseGiocatore, preseCpu, scopeGiocatore, scopeCpu]
  );

  function nuovaPartita() {
    const nuovoMazzo = mescola(creaMazzo());

    const tavoloIniziale = nuovoMazzo.slice(0, 4);
    const manoG = nuovoMazzo.slice(4, 7);
    const manoC = nuovoMazzo.slice(7, 10);
    const resto = nuovoMazzo.slice(10);

    setTavolo(tavoloIniziale);
    setManoGiocatore(manoG);
    setManoCpu(manoC);
    setMazzo(resto);
    setPreseGiocatore([]);
    setPreseCpu([]);
    setScopeGiocatore(0);
    setScopeCpu(0);
    setUltimoAPrendere(null);
    setFine(false);
    setCartaDaGiocare(null);
    setOpzioniPresa([]);
    setRiepilogoMano(null);

    const parteCpu = cpuIniziaProssima;
    setCpuIniziaProssima(!cpuIniziaProssima);

    if (parteCpu) {
      setMessaggio('Inizia la CPU');
      setBloccato(true);

      setTimeout(() => {
        turnoCpu(
          manoG,
          manoC,
          tavoloIniziale,
          resto,
          [],
          [],
          0,
          0,
          null
        );
      }, 700);
    } else {
      setMessaggio('Tocca una carta per giocare');
      setBloccato(false);
    }
  }

  function nuovaPartitaCompleta() {
    setPuntiPartitaGiocatore(0);
    setPuntiPartitaCpu(0);
    setPartitaFinita(false);
    setRiepilogoMano(null);
    setCpuIniziaProssima(false);
    nuovaPartita();
  }

  function distribuisciSeServe(
    manoG,
    manoC,
    mazzoCorrente,
    tavoloCorrente,
    preseG,
    preseC,
    scopeG,
    scopeC,
    ultimo
  ) {
    if (manoG.length || manoC.length) return;

    if (mazzoCorrente.length > 0) {
      const nuoveG = mazzoCorrente.slice(0, 3);
      const nuoveC = mazzoCorrente.slice(3, 6);
      const nuovoMazzo = mazzoCorrente.slice(6);

      setManoGiocatore(nuoveG);
      setManoCpu(nuoveC);
      setMazzo(nuovoMazzo);
      setMessaggio('Nuove carte distribuite');
      setBloccato(false);
      return;
    }

    // Ultime carte sul tavolo a chi ha effettuato l'ultima presa
    let finaliG = [...preseG];
    let finaliC = [...preseC];

    if (tavoloCorrente.length) {
      if (ultimo === 'giocatore') {
        finaliG = [...finaliG, ...tavoloCorrente];
      } else if (ultimo === 'cpu') {
        finaliC = [...finaliC, ...tavoloCorrente];
      }
    }

    setPreseGiocatore(finaliG);
    setPreseCpu(finaliC);
    setTavolo([]);

    const punti = calcolaPunti(
      finaliG,
      finaliC,
      scopeG,
      scopeC
    );

    setFine(true);
    setBloccato(false);
    setRiepilogoMano(punti);

    const totaleG =
      puntiPartitaGiocatore + punti.giocatore;

    const totaleC =
      puntiPartitaCpu + punti.cpu;

    setPuntiPartitaGiocatore(totaleG);
    setPuntiPartitaCpu(totaleC);

    const partitaConclusa =
      (totaleG >= 11 || totaleC >= 11) &&
      totaleG !== totaleC;

    if (partitaConclusa) {
      setPartitaFinita(true);

      if (totaleG > totaleC) {
        setMessaggio(
          `🏆 HAI VINTO LA PARTITA ${totaleG} - ${totaleC}`
        );
      } else {
        setMessaggio(
          `CPU VINCE LA PARTITA ${totaleC} - ${totaleG}`
        );
      }
    } else if (punti.giocatore > punti.cpu) {
      setMessaggio(
        `Smazzata tua: +${punti.giocatore} punti`
      );
    } else if (punti.cpu > punti.giocatore) {
      setMessaggio(
        `Smazzata CPU: +${punti.cpu} punti`
      );
    } else {
      setMessaggio(
        `Smazzata pari: ${punti.giocatore} - ${punti.cpu}`
      );
    }
  }

  function mostraScopa(chi) {
    setFlashScopa(chi);

    setTimeout(() => {
      setFlashScopa(null);
    }, 1100);
  }

  function completaGiocataGiocatore(carta, presa) {
    const nuovaMano = manoGiocatore.filter(
      (c) => c.id !== carta.id
    );

    let nuovoTavolo;
    let nuovePrese = [...preseGiocatore];
    let nuoveScope = scopeGiocatore;
    let nuovoUltimo = ultimoAPrendere;

    if (presa.length) {
      const ids = new Set(presa.map((c) => c.id));

      nuovoTavolo = tavolo.filter((c) => !ids.has(c.id));
      nuovePrese = [...nuovePrese, carta, ...presa];
      nuovoUltimo = 'giocatore';

      const ultimaGiocataDellaSmazzata =
        mazzo.length === 0 &&
        nuovaMano.length === 0 &&
        manoCpu.length === 0;

      if (
        nuovoTavolo.length === 0 &&
        !ultimaGiocataDellaSmazzata
      ) {
        nuoveScope += 1;
        setMessaggio('🧹 SCOPA!');
        mostraScopa('TU');
      } else if (
        nuovoTavolo.length === 0 &&
        ultimaGiocataDellaSmazzata
      ) {
        setMessaggio('Ultima presa');
      } else {
        setMessaggio(`Hai preso ${presa.length} carta/e`);
      }
    } else {
      nuovoTavolo = [...tavolo, carta];
      setMessaggio('Carta sul tavolo');
    }

    setCartaDaGiocare(null);
    setOpzioniPresa([]);

    setManoGiocatore(nuovaMano);
    setTavolo(nuovoTavolo);
    setPreseGiocatore(nuovePrese);
    setScopeGiocatore(nuoveScope);
    setUltimoAPrendere(nuovoUltimo);

    setTimeout(() => {
      turnoCpu(
        nuovaMano,
        manoCpu,
        nuovoTavolo,
        mazzo,
        nuovePrese,
        preseCpu,
        nuoveScope,
        scopeCpu,
        nuovoUltimo
      );
    }, 650);
  }

  function giocaCartaGiocatore(carta) {
    if (bloccato || fine) return;

    const opzioni = trovaPresePossibili(carta, tavolo);

    console.log(
      'SCOPA - carta giocata:',
      carta.valore,
      'opzioni:',
      opzioni.map((presa) =>
        presa.map((c) => `${c.valore}-${c.seme}`).join('+')
      )
    );

    if (opzioni.length > 1) {
      setCartaDaGiocare(carta);
      setOpzioniPresa(opzioni);
      setBloccato(true);
      setMessaggio(
        `Scegli una delle ${opzioni.length} prese possibili`
      );
      return;
    }

    setBloccato(true);

    completaGiocataGiocatore(
      carta,
      opzioni.length === 1 ? opzioni[0] : []
    );
  }

  function scegliPresaGiocatore(presa) {
    if (!cartaDaGiocare) return;

    completaGiocataGiocatore(
      cartaDaGiocare,
      presa
    );
  }

  function scegliCartaCpu(mano, tavoloCorrente) {
    const valutate = mano.map((carta) => {
      const presa = scegliMigliorePresaCpu(
        carta,
        tavoloCorrente
      );

      let valore = 0;

      if (presa.length) {
        // Preferisce prendere più carte
        valore += presa.length * 20;

        // Settebello: priorità assoluta
        if (
          presa.some(
            (c) =>
              c.seme === 'denari' &&
              c.valore === 7
          )
        ) {
          valore += 500;
        }

        // Denari
        valore +=
          presa.filter((c) => c.seme === 'denari').length * 30;

        // Sette utili per la primiera
        valore +=
          presa.filter((c) => c.valore === 7).length * 25;

        // Sei e assi importanti per primiera
        valore +=
          presa.filter((c) => c.valore === 6).length * 15;

        valore +=
          presa.filter((c) => c.valore === 1).length * 10;

        // Scopa
        if (presa.length === tavoloCorrente.length) {
          valore += 180;
        }
      } else {
        // Quando deve scartare, cerca di NON regalare
        // carte preziose all'avversario.
        valore -= carta.valore;

        if (
          carta.seme === 'denari' &&
          carta.valore === 7
        ) {
          valore -= 500;
        } else if (carta.valore === 7) {
          valore -= 100;
        }

        if (carta.seme === 'denari') {
          valore -= 60;
        }

        if (carta.valore === 6) {
          valore -= 35;
        }

        if (carta.valore === 1) {
          valore -= 20;
        }

        // Se possibile preferisce liberarsi di figure
        // meno importanti per la primiera.
        if (carta.valore >= 8) {
          valore += 25;
        }
      }

      return {
        carta,
        presa,
        valore,
      };
    });

    valutate.sort((a, b) => b.valore - a.valore);

    return valutate[0];
  }

  function turnoCpu(
    manoG,
    manoC,
    tavoloCorrente,
    mazzoCorrente,
    preseG,
    preseC,
    scopeG,
    scopeC,
    ultimo
  ) {
    if (!manoC.length) {
      distribuisciSeServe(
        manoG,
        manoC,
        mazzoCorrente,
        tavoloCorrente,
        preseG,
        preseC,
        scopeG,
        scopeC,
        ultimo
      );
      return;
    }

    const scelta = scegliCartaCpu(manoC, tavoloCorrente);
    const carta = scelta.carta;
    const presa = scelta.presa;

    const nuovaManoCpu = manoC.filter(
      (c) => c.id !== carta.id
    );

    let nuovoTavolo;
    let nuovePreseCpu = [...preseC];
    let nuoveScopeCpu = scopeC;
    let nuovoUltimo = ultimo;

    if (presa.length) {
      const ids = new Set(presa.map((c) => c.id));

      nuovoTavolo = tavoloCorrente.filter(
        (c) => !ids.has(c.id)
      );

      nuovePreseCpu = [...nuovePreseCpu, carta, ...presa];
      nuovoUltimo = 'cpu';

      const ultimaGiocataDellaSmazzata =
        mazzoCorrente.length === 0 &&
        manoG.length === 0 &&
        nuovaManoCpu.length === 0;

      if (
        nuovoTavolo.length === 0 &&
        !ultimaGiocataDellaSmazzata
      ) {
        nuoveScopeCpu += 1;
        setMessaggio('CPU fa SCOPA 🧹');
        mostraScopa('CPU');
      } else if (
        nuovoTavolo.length === 0 &&
        ultimaGiocataDellaSmazzata
      ) {
        setMessaggio('Ultima presa CPU');
      } else {
        setMessaggio('CPU ha preso');
      }
    } else {
      nuovoTavolo = [...tavoloCorrente, carta];
      setMessaggio('CPU ha giocato');
    }

    setManoCpu(nuovaManoCpu);
    setTavolo(nuovoTavolo);
    setPreseCpu(nuovePreseCpu);
    setScopeCpu(nuoveScopeCpu);
    setUltimoAPrendere(nuovoUltimo);

    setTimeout(() => {
      distribuisciSeServe(
        manoG,
        nuovaManoCpu,
        mazzoCorrente,
        nuovoTavolo,
        preseG,
        nuovePreseCpu,
        scopeG,
        nuoveScopeCpu,
        nuovoUltimo
      );

      if (manoG.length || nuovaManoCpu.length) {
        setBloccato(false);
      }
    }, 450);
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#071A12',
        paddingTop: 12,
      }}
    >
      <Modal
        visible={opzioniPresa.length > 1 && !!cartaDaGiocare}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.72)',
            justifyContent: 'center',
            paddingHorizontal: 22,
          }}
        >
          <View
            style={{
              backgroundColor: '#103C2A',
              borderRadius: 24,
              padding: 18,
              borderWidth: 2,
              borderColor: 'rgba(255,255,255,0.30)',
            }}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 23,
                fontWeight: '900',
                textAlign: 'center',
                marginBottom: 6,
              }}
            >
              SCEGLI LA PRESA
            </Text>

            <Text
              style={{
                color: '#D9E9DF',
                fontSize: 14,
                fontWeight: '700',
                textAlign: 'center',
                marginBottom: 16,
              }}
            >
              {`Hai ${opzioniPresa.length} possibilità`}
            </Text>

            {opzioniPresa.map((presa, index) => (
              <TouchableOpacity
                key={`modal-presa-${index}`}
                onPress={() => scegliPresaGiocatore(presa)}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                  marginBottom: 10,
                }}
              >
                <Text
                  style={{
                    color: '#071A12',
                    fontWeight: '900',
                    textAlign: 'center',
                    fontSize: 16,
                  }}
                >
                  {presa
                    .map((c) => `${c.valore} ${c.semeNome}`)
                    .join(' + ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {flashScopa && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 125,
            left: 32,
            right: 32,
            zIndex: 100,
            backgroundColor: '#FFFFFF',
            borderRadius: 20,
            paddingVertical: 14,
            paddingHorizontal: 18,
            borderWidth: 2,
            borderColor: '#071A12',
          }}
        >
          <Text
            style={{
              color: '#071A12',
              fontSize: 28,
              fontWeight: '900',
              textAlign: 'center',
            }}
          >
            🧹 SCOPA!
          </Text>

          <Text
            style={{
              color: '#071A12',
              fontSize: 15,
              fontWeight: '900',
              textAlign: 'center',
              marginTop: 3,
            }}
          >
            {flashScopa === 'TU' ? 'PUNTO PER TE' : 'PUNTO CPU'}
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 14,
          paddingBottom: 30,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <TouchableOpacity
            onPress={onBack}
            style={{
              backgroundColor: 'rgba(255,255,255,0.12)',
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 14,
            }}
          >
            <Text style={{ color: '#FFF', fontWeight: '800' }}>
              ← Indietro
            </Text>
          </TouchableOpacity>

          <View style={{ alignItems: 'center' }}>
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 29,
                fontWeight: '900',
              }}
            >
              SCOPA
            </Text>

            <Text
              style={{
                color: 'rgba(255,255,255,0.65)',
                fontSize: 10,
                fontWeight: '800',
                marginTop: 1,
              }}
            >
              PRIMA A 11
            </Text>
          </View>

          <View style={{ width: 82 }} />
        </View>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#0E4A37',
            borderRadius: 22,
            paddingVertical: 14,
            paddingHorizontal: 22,
            marginBottom: 16,
            borderWidth: 2,
            borderColor: '#1D6E52',
          }}
        >
          <View style={{ alignItems: 'center' }}>
            <Text
              style={{
                color: '#D8E7DE',
                fontSize: 12,
                fontWeight: '800',
              }}
            >
              TU
            </Text>

            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 36,
                fontWeight: '900',
              }}
            >
              {puntiPartitaGiocatore}
            </Text>
          </View>

          <View style={{ alignItems: 'center' }}>
            <Text
              style={{
                color: '#D8E7DE',
                fontSize: 11,
                fontWeight: '800',
              }}
            >
              PARTITA A
            </Text>

            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 19,
                fontWeight: '900',
              }}
            >
              11
            </Text>
          </View>

          <View style={{ alignItems: 'center' }}>
            <Text
              style={{
                color: '#D8E7DE',
                fontSize: 12,
                fontWeight: '800',
              }}
            >
              CPU
            </Text>

            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 36,
                fontWeight: '900',
              }}
            >
              {puntiPartitaCpu}
            </Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderRadius: 18,
            padding: 12,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 16,
              fontWeight: '900',
              textAlign: 'center',
            }}
          >
            {messaggio}
          </Text>
        </View>

        <Text
          style={{
            color: '#D8E7DE',
            fontSize: 14,
            fontWeight: '800',
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          CPU · {manoCpu.length} carte · Prese {preseCpu.length} · Scope {scopeCpu}
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
              retroLabel="SCOPA"
              piccola
            />
          ))}
        </View>

        <Text
          style={{
            color: '#FFFFFF',
            fontWeight: '900',
            fontSize: 15,
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          TAVOLO
        </Text>

        {opzioniPresa.length > 1 && (
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              paddingVertical: 10,
              paddingHorizontal: 12,
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                color: '#071A12',
                fontSize: 17,
                fontWeight: '900',
                textAlign: 'center',
              }}
            >
              {`HAI ${opzioniPresa.length} PRESE POSSIBILI`}
            </Text>
          </View>
        )}

        <View
          style={{
            minHeight: 150,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.18)',
            backgroundColor: 'rgba(16,86,52,0.45)',
            paddingVertical: 10,
            paddingHorizontal: 6,
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          {tavolo.length === 0 ? (
            <Text
              style={{
                color: 'rgba(255,255,255,0.55)',
                fontWeight: '800',
              }}
            >
              Tavolo vuoto
            </Text>
          ) : (
            tavolo.map((carta) => (
              <View
                key={carta.id}
                style={
                  carta.seme === 'denari' && carta.valore === 7
                    ? {
                        borderWidth: 3,
                        borderColor: '#FFFFFF',
                        borderRadius: 12,
                        margin: 2,
                        padding: 1,
                      }
                    : {}
                }
              >
                <NapoletanaCard
                  carta={carta}
                  piccola
                />
              </View>
            ))
          )}
        </View>

        {opzioniPresa.length > 1 && cartaDaGiocare && (
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.09)',
              borderRadius: 18,
              padding: 12,
              marginBottom: 15,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.16)',
            }}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontWeight: '900',
                fontSize: 16,
                textAlign: 'center',
                marginBottom: 10,
              }}
            >
              SCEGLI LA PRESA
            </Text>

            {opzioniPresa.map((presa, index) => (
              <TouchableOpacity
                key={`presa-${index}`}
                onPress={() => scegliPresaGiocatore(presa)}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderRadius: 13,
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontWeight: '800',
                    textAlign: 'center',
                  }}
                >
                  {`Prendi: ${presa
                    .map((c) => `${c.valore} ${c.semeNome}`)
                    .join(' + ')}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text
          style={{
            color: '#D8E7DE',
            fontSize: 14,
            fontWeight: '800',
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          TU · Prese {preseGiocatore.length} · Scope {scopeGiocatore}
        </Text>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            marginBottom: 30,
          }}
        >
          {manoGiocatore.map((carta) => (
            <View
              key={carta.id}
              style={
                carta.seme === 'denari' && carta.valore === 7
                  ? {
                      borderWidth: 3,
                      borderColor: '#FFFFFF',
                      borderRadius: 14,
                      margin: 2,
                      padding: 1,
                    }
                  : {}
              }
            >
              <NapoletanaCard
                carta={carta}
                onPress={() => giocaCartaGiocatore(carta)}
                disabled={bloccato}
              />
            </View>
          ))}
        </View>

        {fine && riepilogoMano && (
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.07)',
              borderRadius: 24,
              padding: 18,
              marginBottom: 18,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.12)',
            }}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 22,
                fontWeight: '900',
                textAlign: 'center',
                marginBottom: 14,
              }}
            >
              RISULTATO SMAZZATA
            </Text>

            {[
              {
                nome: 'CARTE',
                dettaglio: `${riepilogoMano.carteG} - ${riepilogoMano.carteC}`,
                vincitore:
                  riepilogoMano.puntoCarte === 'giocatore'
                    ? 'TU'
                    : riepilogoMano.puntoCarte === 'cpu'
                    ? 'CPU'
                    : 'PARI',
              },
              {
                nome: 'DENARI',
                dettaglio: `${riepilogoMano.denariG} - ${riepilogoMano.denariC}`,
                vincitore:
                  riepilogoMano.puntoDenari === 'giocatore'
                    ? 'TU'
                    : riepilogoMano.puntoDenari === 'cpu'
                    ? 'CPU'
                    : 'PARI',
              },
              {
                nome: 'SETTEBELLO',
                dettaglio: '7 di Denari',
                vincitore: riepilogoMano.settebelloG ? 'TU' : 'CPU',
              },
              {
                nome: 'PRIMIERA',
                dettaglio: `${riepilogoMano.primieraG ?? '—'} - ${riepilogoMano.primieraC ?? '—'}`,
                vincitore:
                  riepilogoMano.puntoPrimiera === 'giocatore'
                    ? 'TU'
                    : riepilogoMano.puntoPrimiera === 'cpu'
                    ? 'CPU'
                    : 'PARI',
              },
            ].map((voce) => (
              <View
                key={voce.nome}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 9,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255,255,255,0.10)',
                }}
              >
                <View>
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontWeight: '900',
                      fontSize: 14,
                    }}
                  >
                    {voce.nome}
                  </Text>

                  <Text
                    style={{
                      color: '#BFD2C5',
                      fontWeight: '700',
                      fontSize: 12,
                      marginTop: 2,
                    }}
                  >
                    {voce.dettaglio}
                  </Text>
                </View>

                <View
                  style={{
                    minWidth: 64,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 12,
                    backgroundColor:
                      voce.vincitore === 'TU'
                        ? 'rgba(255,255,255,0.20)'
                        : voce.vincitore === 'CPU'
                        ? 'rgba(255,255,255,0.10)'
                        : 'rgba(255,255,255,0.06)',
                  }}
                >
                  <Text
                    style={{
                      color: '#FFFFFF',
                      textAlign: 'center',
                      fontWeight: '900',
                    }}
                  >
                    {voce.vincitore}
                  </Text>
                </View>
              </View>
            ))}

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(255,255,255,0.10)',
              }}
            >
              <View>
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontWeight: '900',
                    fontSize: 14,
                  }}
                >
                  SCOPE
                </Text>

                <Text
                  style={{
                    color: '#BFD2C5',
                    fontWeight: '700',
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  Ogni scopa vale 1 punto
                </Text>
              </View>

              <Text
                style={{
                  color: '#FFFFFF',
                  fontWeight: '900',
                  fontSize: 17,
                }}
              >
                {scopeGiocatore} - {scopeCpu}
              </Text>
            </View>

            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderRadius: 16,
                paddingVertical: 12,
                paddingHorizontal: 14,
                marginTop: 14,
              }}
            >
              <Text
                style={{
                  color: '#D8E7DE',
                  textAlign: 'center',
                  fontWeight: '800',
                  fontSize: 12,
                }}
              >
                PUNTI DELLA SMAZZATA
              </Text>

              <Text
                style={{
                  color: '#FFFFFF',
                  textAlign: 'center',
                  fontSize: 25,
                  fontWeight: '900',
                  marginTop: 3,
                }}
              >
                +{riepilogoMano.giocatore}  -  +{riepilogoMano.cpu}
              </Text>
            </View>

            <View
              style={{
                marginTop: 12,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: '#D8E7DE',
                  fontSize: 12,
                  fontWeight: '800',
                }}
              >
                TOTALE PARTITA
              </Text>

              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 30,
                  fontWeight: '900',
                  marginTop: 2,
                }}
              >
                {puntiPartitaGiocatore} - {puntiPartitaCpu}
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          onPress={
            partitaFinita
              ? nuovaPartitaCompleta
              : nuovaPartita
          }
          style={{
            backgroundColor: '#FFFFFF',
            paddingVertical: 16,
            borderRadius: 18,
            alignItems: 'center',
            marginTop: 4,
            marginHorizontal: 6,
          }}
        >
          <Text
            style={{
              color: '#071A12',
              fontWeight: '900',
              fontSize: 16,
            }}
          >
            {partitaFinita
              ? 'NUOVA PARTITA'
              : fine
              ? 'NUOVA SMAZZATA'
              : 'INIZIA / RICOMINCIA'}
          </Text>
        </TouchableOpacity>


      </ScrollView>
    </View>
  );
}
