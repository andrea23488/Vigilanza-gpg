import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import NapoletanaCard from './NapoletanaCard';
import {
  annullaSfidaGioco,
  caricaPartitaGioco,
  caricaPartiteGioco,
  creaSfidaGioco,
  inizializzaStatoPartitaGioco,
  mioUserIdGioco,
  rispondiSfidaGioco,
  salvaStatoPartitaGioco,
  sottoscriviPartitaGioco,
} from '../giochiMultiplayerApi';
import {
  creaStatoBriscolaOnline,
  creaStatoScopaOnline,
  giocaBriscolaOnline,
  giocaScopaOnline,
  opzioniScopaOnline,
} from './giochiOnlineEngine';

function nomeCollega(c) {
  const p = c?.profilo || {};
  return (
    [p.nome, p.cognome].filter(Boolean).join(' ') ||
    c?.nome_completo ||
    c?.nome ||
    'Collega'
  );
}

function altroId(partita, mioId) {
  if (!partita || !mioId) return null;
  return String(partita.sfidante_id) === String(mioId)
    ? partita.sfidato_id
    : partita.sfidante_id;
}

export default function GiocoColleghiScreen({
  gioco,
  colleghi = [],
  onBack,
  partitaInizialeId = null,
}) {
  const [mioId, setMioId] = useState(null);
  const [partite, setPartite] = useState([]);
  const [partita, setPartita] = useState(null);
  const [loading, setLoading] = useState(true);
  const [azione, setAzione] = useState(false);
  const [cartaScopa, setCartaScopa] = useState(null);
  const [opzioniScopa, setOpzioniScopa] = useState([]);

  const titolo = gioco === 'scopa' ? 'Scopa' : 'Briscola';
  const colore = gioco === 'scopa' ? '#7BE0A3' : '#79B7FF';

  const colleghiDisponibili = useMemo(
    () =>
      (Array.isArray(colleghi) ? colleghi : []).filter(
        (c) => c?.stato === 'accettato' && c?.altro_user_id
      ),
    [colleghi]
  );

  async function aggiornaPartite(apriId = null) {
    const lista = await caricaPartiteGioco();
    setPartite(lista.filter((p) => p.gioco === gioco));

    const idDaAprire = apriId || partita?.id;
    if (idDaAprire) {
      const aggiornata =
        lista.find((p) => String(p.id) === String(idDaAprire)) ||
        (await caricaPartitaGioco(idDaAprire));
      if (aggiornata) setPartita(aggiornata);
    }
  }

  useEffect(() => {
    let vivo = true;

    (async () => {
      try {
        const id = await mioUserIdGioco();
        if (!vivo) return;
        setMioId(id);
        const lista = await caricaPartiteGioco();
        if (!vivo) return;
        const filtrate = lista.filter((p) => p.gioco === gioco);
        setPartite(filtrate);

        if (partitaInizialeId) {
          const iniziale =
            filtrate.find(
              (p) => String(p.id) === String(partitaInizialeId)
            ) || (await caricaPartitaGioco(partitaInizialeId));

          if (vivo && iniziale?.gioco === gioco) {
            setPartita(iniziale);
          }
        }
      } catch (e) {
        Alert.alert(
          'Multiplayer non disponibile',
          e?.message || 'Impossibile caricare le partite.'
        );
      } finally {
        if (vivo) setLoading(false);
      }
    })();

    return () => {
      vivo = false;
    };
  }, [gioco, partitaInizialeId]);

  useEffect(() => {
    if (!partita?.id) return undefined;

    return sottoscriviPartitaGioco(
      partita.id,
      (nuova) => {
        setPartita(nuova);
        setPartite((prev) =>
          prev.some((p) => p.id === nuova.id)
            ? prev.map((p) => (p.id === nuova.id ? nuova : p))
            : [nuova, ...prev]
        );
      },
      () => {}
    );
  }, [partita?.id]);

  useEffect(() => {
    if (
      !partita ||
      partita.stato !== 'in_corso' ||
      partita.stato_partita?.inizializzato ||
      !mioId ||
      String(partita.turno_user_id) !== String(mioId) ||
      String(partita.sfidante_id) !== String(mioId)
    ) {
      return;
    }

    let annullato = false;

    (async () => {
      try {
        const stato =
          gioco === 'scopa'
            ? creaStatoScopaOnline(
                partita.sfidante_id,
                partita.sfidato_id
              )
            : creaStatoBriscolaOnline(
                partita.sfidante_id,
                partita.sfidato_id
              );

        const nuova = await inizializzaStatoPartitaGioco({
          partitaId: partita.id,
          versione: partita.versione,
          statoPartita: stato,
          turnoUserId: partita.sfidante_id,
        });

        if (!annullato) setPartita(nuova);
      } catch (e) {
        if (!annullato) {
          await aggiornaPartite(partita.id).catch(() => {});
        }
      }
    })();

    return () => {
      annullato = true;
    };
  }, [
    partita?.id,
    partita?.stato,
    partita?.versione,
    partita?.stato_partita?.inizializzato,
    mioId,
    gioco,
  ]);

  const avversario = useMemo(() => {
    const id = altroId(partita, mioId);
    return (
      colleghiDisponibili.find(
        (c) => String(c.altro_user_id) === String(id)
      ) || null
    );
  }, [partita, mioId, colleghiDisponibili]);

  const stato = partita?.stato_partita || {};
  const eMioTurno =
    partita?.stato === 'in_corso' &&
    String(partita?.turno_user_id) === String(mioId);

  async function sfida(collega) {
    try {
      setAzione(true);
      const nuova = await creaSfidaGioco(
        gioco,
        collega.altro_user_id
      );
      setPartita(nuova);
      await aggiornaPartite(nuova.id);
    } catch (e) {
      Alert.alert('Sfida non inviata', e?.message || 'Riprova.');
    } finally {
      setAzione(false);
    }
  }

  async function rispondi(accetta) {
    try {
      setAzione(true);
      const nuova = await rispondiSfidaGioco(partita.id, accetta);
      setPartita(nuova);
      await aggiornaPartite(nuova.id);
    } catch (e) {
      Alert.alert('Operazione non riuscita', e?.message || 'Riprova.');
    } finally {
      setAzione(false);
    }
  }

  async function annulla() {
    try {
      setAzione(true);
      const nuova = await annullaSfidaGioco(partita.id);
      setPartita(nuova);
      await aggiornaPartite(nuova.id);
    } catch (e) {
      Alert.alert('Sfida non annullata', e?.message || 'Riprova.');
    } finally {
      setAzione(false);
    }
  }

  async function salvaMossa(risultato) {
    try {
      setAzione(true);
      const nuova = await salvaStatoPartitaGioco({
        partitaId: partita.id,
        versione: partita.versione,
        statoPartita: risultato.stato,
        prossimoTurnoUserId: risultato.prossimoTurnoUserId,
        finita: risultato.finita,
        vincitoreId: risultato.vincitoreId,
      });
      setPartita(nuova);
      setCartaScopa(null);
      setOpzioniScopa([]);
    } catch (e) {
      await aggiornaPartite(partita.id).catch(() => {});
      Alert.alert(
        'Partita aggiornata',
        e?.message ||
          'La partita è cambiata su un altro dispositivo. Riprova la mossa.'
      );
    } finally {
      setAzione(false);
    }
  }

  async function giocaCarta(carta) {
    if (!eMioTurno || azione) return;

    if (gioco === 'briscola') {
      try {
        await salvaMossa(
          giocaBriscolaOnline(stato, mioId, carta.id)
        );
      } catch (e) {
        Alert.alert('Mossa non valida', e?.message || 'Riprova.');
      }
      return;
    }

    try {
      const opzioni = opzioniScopaOnline(stato, mioId, carta.id);

      if (opzioni.length > 1) {
        setCartaScopa(carta);
        setOpzioniScopa(opzioni);
        return;
      }

      await salvaMossa(
        giocaScopaOnline(stato, mioId, carta.id)
      );
    } catch (e) {
      Alert.alert('Mossa non valida', e?.message || 'Riprova.');
    }
  }

  async function scegliPresa(presa) {
    if (!cartaScopa) return;

    try {
      await salvaMossa(
        giocaScopaOnline(
          stato,
          mioId,
          cartaScopa.id,
          presa.map((c) => c.id)
        )
      );
    } catch (e) {
      Alert.alert('Presa non valida', e?.message || 'Riprova.');
    }
  }

  function tornaLobby() {
    setPartita(null);
    setCartaScopa(null);
    setOpzioniScopa([]);
    aggiornaPartite().catch(() => {});
  }

  if (loading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: '#071426',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colore} />
        <Text style={{ color: '#FFFFFF', marginTop: 12, fontWeight: '800' }}>
          Caricamento partite...
        </Text>
      </SafeAreaView>
    );
  }

  if (!partita) {
    const attive = partite.filter((p) =>
      ['in_attesa', 'in_corso'].includes(p.stato)
    );

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#071426' }}>
        <ScrollView
          contentContainerStyle={{ padding: 18, paddingBottom: 60 }}
        >
          <TouchableOpacity
            onPress={onBack}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.08)',
              marginBottom: 14,
            }}
          >
            <Ionicons name="chevron-back" size={25} color="#FFFFFF" />
          </TouchableOpacity>

          <Text
            style={{
              color: colore,
              fontSize: 11,
              fontWeight: '900',
              letterSpacing: 1.2,
            }}
          >
            MULTIPLAYER ASINCRONO
          </Text>
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 29,
              fontWeight: '900',
              marginTop: 4,
            }}
          >
            {titolo} con colleghi
          </Text>
          <Text
            style={{
              color: '#93A8C2',
              fontSize: 12,
              lineHeight: 18,
              marginTop: 6,
              marginBottom: 18,
            }}
          >
            Non dovete essere online insieme: fai la tua mossa e il collega riceve una notifica quando tocca a lui.
          </Text>

          {attive.length > 0 && (
            <>
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: '900',
                  marginBottom: 9,
                }}
              >
                PARTITE E SFIDE
              </Text>

              {attive.map((p) => {
                const idAltro = altroId(p, mioId);
                const c = colleghiDisponibili.find(
                  (x) => String(x.altro_user_id) === String(idAltro)
                );
                const incoming =
                  p.stato === 'in_attesa' &&
                  String(p.sfidato_id) === String(mioId);

                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setPartita(p)}
                    style={{
                      padding: 14,
                      borderRadius: 17,
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      borderWidth: 1,
                      borderColor: incoming
                        ? 'rgba(255,190,90,0.55)'
                        : 'rgba(120,170,255,0.25)',
                      marginBottom: 9,
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>
                      {nomeCollega(c)}
                    </Text>
                    <Text
                      style={{
                        color: incoming ? '#FFC66D' : '#94A8C3',
                        fontSize: 10,
                        marginTop: 4,
                        fontWeight: '800',
                      }}
                    >
                      {p.stato === 'in_attesa'
                        ? incoming
                          ? 'Ti ha sfidato'
                          : 'Sfida inviata'
                        : String(p.turno_user_id) === String(mioId)
                        ? 'Tocca a te'
                        : 'In attesa della mossa del collega'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 12,
              fontWeight: '900',
              marginTop: 12,
              marginBottom: 9,
            }}
          >
            SFIDA UN COLLEGA
          </Text>

          {colleghiDisponibili.length === 0 ? (
            <Text style={{ color: '#93A8C2', fontSize: 12 }}>
              Non hai ancora colleghi accettati disponibili.
            </Text>
          ) : (
            colleghiDisponibili.map((c) => (
              <TouchableOpacity
                key={c.altro_user_id}
                disabled={azione}
                onPress={() => sfida(c)}
                style={{
                  minHeight: 54,
                  borderRadius: 17,
                  paddingHorizontal: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(38,74,126,0.65)',
                  borderWidth: 1,
                  borderColor: 'rgba(120,180,255,0.28)',
                  marginBottom: 8,
                }}
              >
                <Ionicons
                  name="person-outline"
                  size={19}
                  color={colore}
                />
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 12,
                    fontWeight: '900',
                    marginLeft: 10,
                    flex: 1,
                  }}
                >
                  {nomeCollega(c)}
                </Text>
                <Text style={{ color: colore, fontWeight: '900', fontSize: 10 }}>
                  SFIDA
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const incoming =
    partita.stato === 'in_attesa' &&
    String(partita.sfidato_id) === String(mioId);
  const outgoing =
    partita.stato === 'in_attesa' &&
    String(partita.sfidante_id) === String(mioId);

  if (partita.stato === 'in_attesa') {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: '#071426',
          padding: 18,
        }}
      >
        <TouchableOpacity onPress={tornaLobby}>
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <View
          style={{
            marginTop: 30,
            padding: 22,
            borderRadius: 24,
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderWidth: 1,
            borderColor: 'rgba(120,170,255,0.25)',
          }}
        >
          <Text style={{ color: colore, fontSize: 11, fontWeight: '900' }}>
            SFIDA A {titolo.toUpperCase()}
          </Text>
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 24,
              fontWeight: '900',
              marginTop: 6,
            }}
          >
            {nomeCollega(avversario)}
          </Text>

          {incoming ? (
            <View style={{ marginTop: 22 }}>
              <TouchableOpacity
                disabled={azione}
                onPress={() => rispondi(true)}
                style={{
                  minHeight: 52,
                  borderRadius: 17,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#24784C',
                  marginBottom: 9,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>
                  ACCETTA SFIDA
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={azione}
                onPress={() => rispondi(false)}
                style={{
                  minHeight: 52,
                  borderRadius: 17,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(170,55,72,0.65)',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>
                  RIFIUTA
                </Text>
              </TouchableOpacity>
            </View>
          ) : outgoing ? (
            <>
              <Text
                style={{
                  color: '#9DB0C4',
                  fontSize: 12,
                  lineHeight: 18,
                  marginTop: 12,
                }}
              >
                Aspettiamo che il collega accetti. Puoi chiudere l'app: la partita resterà qui.
              </Text>
              <TouchableOpacity
                disabled={azione}
                onPress={annulla}
                style={{
                  minHeight: 50,
                  borderRadius: 17,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(170,55,72,0.55)',
                  marginTop: 18,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>
                  ANNULLA SFIDA
                </Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  if (['rifiutata', 'annullata'].includes(partita.stato)) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: '#071426',
          padding: 18,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '900' }}>
          Sfida {partita.stato}
        </Text>
        <TouchableOpacity onPress={tornaLobby} style={{ marginTop: 20 }}>
          <Text style={{ color: colore, fontWeight: '900' }}>
            TORNA ALLE PARTITE
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!stato?.inizializzato && partita.stato === 'in_corso') {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: '#071426',
          padding: 18,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colore} />
        <Text
          style={{
            color: '#FFFFFF',
            fontWeight: '900',
            marginTop: 13,
            textAlign: 'center',
          }}
        >
          Preparazione partita...
        </Text>
        <Text
          style={{
            color: '#94A8C3',
            fontSize: 11,
            marginTop: 7,
            textAlign: 'center',
          }}
        >
          {String(partita.sfidante_id) === String(mioId)
            ? 'Sto distribuendo le carte.'
            : 'Il collega deve aprire la partita per distribuire le carte.'}
        </Text>
      </SafeAreaView>
    );
  }

  const miaMano = stato?.mani?.[mioId] || [];
  const idAvversario = altroId(partita, mioId);
  const manoAvversario = stato?.mani?.[idAvversario] || [];
  const finita = partita.stato === 'finita';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#071426' }}>
      <ScrollView
        contentContainerStyle={{
          padding: 14,
          paddingBottom: 50,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <TouchableOpacity
            onPress={tornaLobby}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={{ marginLeft: 11, flex: 1 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '900' }}>
              {titolo} · {nomeCollega(avversario)}
            </Text>
            <Text
              style={{
                color: finita
                  ? '#FFD36A'
                  : eMioTurno
                  ? '#6FEA9A'
                  : '#93A8C2',
                fontSize: 10,
                fontWeight: '900',
                marginTop: 3,
              }}
            >
              {finita
                ? 'PARTITA CONCLUSA'
                : eMioTurno
                ? 'TOCCA A TE'
                : 'IN ATTESA DEL COLLEGA'}
            </Text>
          </View>
        </View>

        {finita && (
          <View
            style={{
              padding: 17,
              borderRadius: 20,
              backgroundColor: 'rgba(255,205,90,0.09)',
              borderWidth: 1,
              borderColor: 'rgba(255,205,90,0.30)',
              marginBottom: 14,
            }}
          >
            <Text
              style={{
                color: '#FFD36A',
                fontSize: 18,
                fontWeight: '900',
                textAlign: 'center',
              }}
            >
              {partita.vincitore_id
                ? String(partita.vincitore_id) === String(mioId)
                  ? '🏆 HAI VINTO'
                  : 'Partita vinta dal collega'
                : 'PAREGGIO'}
            </Text>
          </View>
        )}

        <Text
          style={{
            color: '#8EA2BB',
            fontSize: 9,
            fontWeight: '900',
            marginBottom: 7,
          }}
        >
          CARTE DEL COLLEGA · {manoAvversario.length}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            marginBottom: 18,
          }}
        >
          {manoAvversario.map((c, i) => (
            <NapoletanaCard
              key={`opp-${c.id}-${i}`}
              carta={c}
              coperta
              piccola
            />
          ))}
        </View>

        {gioco === 'scopa' ? (
          <>
            <View
              style={{
                minHeight: 160,
                borderRadius: 22,
                padding: 12,
                backgroundColor: 'rgba(20,80,53,0.52)',
                borderWidth: 1,
                borderColor: 'rgba(100,220,150,0.22)',
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  color: '#84A996',
                  fontSize: 9,
                  fontWeight: '900',
                  textAlign: 'center',
                  marginBottom: 9,
                }}
              >
                TAVOLO
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                }}
              >
                {(stato.tavolo || []).map((c) => (
                  <NapoletanaCard key={c.id} carta={c} piccola />
                ))}
              </View>
            </View>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <Text style={{ color: '#C8D5DF', fontWeight: '800' }}>
                Scope tue: {stato.scope?.[mioId] || 0}
              </Text>
              <Text style={{ color: '#C8D5DF', fontWeight: '800' }}>
                Scope collega: {stato.scope?.[idAvversario] || 0}
              </Text>
            </View>
          </>
        ) : (
          <>
            <View
              style={{
                padding: 12,
                borderRadius: 19,
                backgroundColor: 'rgba(255,255,255,0.05)',
                marginBottom: 14,
              }}
            >
              <Text
                style={{
                  color: '#90A7BE',
                  fontSize: 9,
                  fontWeight: '900',
                  marginBottom: 7,
                }}
              >
                BRISCOLA
              </Text>
              {stato.briscola ? (
                <NapoletanaCard carta={stato.briscola} piccola />
              ) : null}
            </View>

            <View
              style={{
                minHeight: 150,
                borderRadius: 22,
                padding: 13,
                backgroundColor: 'rgba(18,73,47,0.55)',
                borderWidth: 1,
                borderColor: 'rgba(83,213,133,0.25)',
                marginBottom: 14,
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
                PRESA IN CORSO
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                }}
              >
                {(stato.tavolo || []).map((g) => (
                  <View
                    key={`${g.userId}-${g.carta.id}`}
                    style={{ alignItems: 'center', marginHorizontal: 8 }}
                  >
                    <Text
                      style={{
                        color: '#B6C4D2',
                        fontSize: 9,
                        fontWeight: '900',
                        marginBottom: 5,
                      }}
                    >
                      {String(g.userId) === String(mioId) ? 'TU' : 'COLLEGA'}
                    </Text>
                    <NapoletanaCard carta={g.carta} piccola />
                  </View>
                ))}
              </View>
            </View>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <Text style={{ color: '#C8D5DF', fontWeight: '800' }}>
                Tu: {stato.punti?.[mioId] || 0}
              </Text>
              <Text style={{ color: '#C8D5DF', fontWeight: '800' }}>
                Collega: {stato.punti?.[idAvversario] || 0}
              </Text>
            </View>
          </>
        )}

        {opzioniScopa.length > 1 && cartaScopa ? (
          <View
            style={{
              padding: 14,
              borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderWidth: 1,
              borderColor: 'rgba(120,220,160,0.30)',
              marginBottom: 15,
            }}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 14,
                fontWeight: '900',
                textAlign: 'center',
                marginBottom: 10,
              }}
            >
              Scegli la presa
            </Text>
            {opzioniScopa.map((presa, idx) => (
              <TouchableOpacity
                key={`presa-${idx}`}
                disabled={azione}
                onPress={() => scegliPresa(presa)}
                style={{
                  padding: 10,
                  borderRadius: 15,
                  backgroundColor: '#FFFFFF',
                  marginBottom: 8,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  {presa.map((c) => (
                    <NapoletanaCard key={c.id} carta={c} piccola />
                  ))}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 11,
            fontWeight: '900',
            marginBottom: 9,
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
          {miaMano.map((carta) => (
            <NapoletanaCard
              key={carta.id}
              carta={carta}
              disabled={!eMioTurno || finita || azione}
              onPress={() => giocaCarta(carta)}
            />
          ))}
        </View>

        {!finita && !eMioTurno && (
          <Text
            style={{
              color: '#91A5BC',
              fontSize: 11,
              textAlign: 'center',
              lineHeight: 17,
              marginTop: 18,
            }}
          >
            Puoi chiudere l'app. Riceverai una notifica quando il collega avrà giocato.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
