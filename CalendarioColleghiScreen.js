import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { coloreHome, PALETTE_ORIGINALE } from './temi';
import { caricaTurniUtente } from './turniApi';
import { caricaColleghi } from './colleghiApi';
import { caricaTurniCondivisiRicevuti, condividiTurniConColleghi, rimuoviCondivisioneTurni, caricaMieCondivisioni } from './turniCondivisiApi';
import TurniCondivisiView from './TurniCondivisiView';
import { aggiungiGiorni, lunediDellaSettimana, dataTurno, nomeProfilo, formattaBreve, creaElementiCondivisi } from './turniCondivisiModel';

export default function CalendarioColleghiScreen({ onBack, onHome, onGestioneColleghi, backLabel = 'Social', palette = null, profilo = null, fotoProfilo = null }) {
  const colors = palette || PALETTE_ORIGINALE;
  // A single selected date opens on today and retains its weekday across week changes.
  const [giornoSelezionato, setGiornoSelezionato] = useState(() => new Date());
  const [adesso, setAdesso] = useState(() => new Date());
  const inizioSettimana = useMemo(() => lunediDellaSettimana(giornoSelezionato), [giornoSelezionato]);
  const fineSettimana = useMemo(() => aggiungiGiorni(inizioSettimana, 6), [inizioSettimana]);
  const [mieiTurni, setMieiTurni] = useState([]);
  const [ricevuti, setRicevuti] = useState([]);
  const [colleghi, setColleghi] = useState([]);
  const [mieCondivisioni, setMieCondivisioni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState('');
  const [modalCondivisione, setModalCondivisione] = useState(false);
  const [selezionati, setSelezionati] = useState([]);
  const [livello, setLivello] = useState('orari_luogo');
  const [salvataggio, setSalvataggio] = useState(false);
  const mounted = useRef(false), caricamento = useRef(0), salvataggioRef = useRef(false), modalRef = useRef(false);
  modalRef.current = modalCondivisione;

  const caricaTutto = useCallback(async () => {
    if (!mounted.current) return;
    const id = ++caricamento.current;
    setLoading(true); setErrore('');
    // Hide the previous authorization snapshot while it is being revalidated.
    setRicevuti([]); setColleghi([]); setMieCondivisioni([]);
    try {
      const [turni, turniRicevuti, relazioni, condivisioni] = await Promise.all([
        caricaTurniUtente(), caricaTurniCondivisiRicevuti(), caricaColleghi(), caricaMieCondivisioni(),
      ]);
      if (!mounted.current || id !== caricamento.current) return;
      setMieiTurni(Array.isArray(turni) ? turni : []);
      setRicevuti(Array.isArray(turniRicevuti) ? turniRicevuti : []);
      setColleghi((Array.isArray(relazioni) ? relazioni : []).filter(c => c?.stato === 'accettato'));
      setMieCondivisioni(Array.isArray(condivisioni) ? condivisioni : []);
    } catch (e) {
      if (!mounted.current || id !== caricamento.current) return;
      setMieiTurni([]); setRicevuti([]); setColleghi([]); setMieCondivisioni([]);
      setErrore(e?.message || 'Errore durante il caricamento.');
    } finally {
      if (mounted.current && id === caricamento.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    caricaTutto();
    const clock = setInterval(() => { if (AppState.currentState === 'active') setAdesso(new Date()); }, 15000);
    // Existing read APIs only: no realtime subscriptions or changes to access policies.
    const refresh = setInterval(() => {
      if (AppState.currentState === 'active' && !modalRef.current && !salvataggioRef.current) caricaTutto();
    }, 60000);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') { setAdesso(new Date()); caricaTutto(); }
      else { ++caricamento.current; setRicevuti([]); setColleghi([]); setMieCondivisioni([]); setLoading(true); }
    });
    return () => { mounted.current = false; ++caricamento.current; clearInterval(clock); clearInterval(refresh); sub.remove(); };
  }, [caricaTutto]);

  const mieiTurniSettimana = useMemo(() => mieiTurni.filter(turno => {
    const d = dataTurno(turno);
    return d && d >= inizioSettimana && d <= fineSettimana;
  }), [mieiTurni, inizioSettimana, fineSettimana]);
  const elementi = useMemo(() => creaElementiCondivisi({ mieiTurni, ricevuti, colleghi, profilo, fotoProfilo }),
    [mieiTurni, ricevuti, colleghi, profilo, fotoProfilo]);
  const cambiaSettimana = delta => { setGiornoSelezionato(prev => aggiungiGiorni(prev, delta * 7)); caricaTutto(); };

  const apriCondivisione = () => {
    const idsTurni = new Set(
      mieiTurniSettimana
        .map(t => String(t?.id || ''))
        .filter(Boolean)
    );

    const condivisioniSettimana =
      mieCondivisioni.filter(c =>
        idsTurni.has(String(c?.turno_id))
      );

    const destinatari = Array.from(
      new Set(
        condivisioniSettimana
          .map(c => c?.destinatario_id)
          .filter(Boolean)
      )
    );

    setSelezionati(destinatari);

    if (condivisioniSettimana[0]?.livello) {
      setLivello(condivisioniSettimana[0].livello);
    } else {
      setLivello('orari_luogo');
    }

    setModalCondivisione(true);
  };

  const toggleCollega = id => {
    setSelezionati(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );
  };

  const selezionaTutti = () => {
    const tutti = colleghi
      .map(c => c?.altro_user_id)
      .filter(Boolean);

    if (
      tutti.length > 0 &&
      tutti.every(id => selezionati.includes(id))
    ) {
      setSelezionati([]);
    } else {
      setSelezionati(tutti);
    }
  };

  const salvaCondivisione = async () => {
    if (salvataggioRef.current) return;
    const turnoIds = mieiTurniSettimana
      .map(t => t?.id)
      .filter(Boolean)
      .map(String);

    if (turnoIds.length === 0) {
      Alert.alert(
        'Nessun turno',
        'Non hai turni inseriti in questa settimana.'
      );
      return;
    }

    try {
      salvataggioRef.current = true;
      setSalvataggio(true);

      // La selezione del popup diventa la configurazione
      // effettiva della settimana.
      await rimuoviCondivisioneTurni({
        turnoIds,
        collegaIds: [],
      });

      if (selezionati.length > 0) {
        await condividiTurniConColleghi({
          turnoIds,
          collegaIds: selezionati,
          livello,
        });
      }

      await caricaTutto();

      if (!mounted.current) return;
      setModalCondivisione(false);

      Alert.alert(
        'Condivisione aggiornata',
        selezionati.length === 0
          ? 'La settimana non è più condivisa.'
          : `Settimana condivisa con ${selezionati.length} ${
              selezionati.length === 1
                ? 'collega'
                : 'colleghi'
            }.`
      );
    } catch (e) {
      if (!mounted.current) return;
      await caricaTutto();
      Alert.alert(
        'Errore',
        e?.message ||
          'Non è stato possibile aggiornare la condivisione.'
      );
    } finally {
      salvataggioRef.current = false;
      if (mounted.current) setSalvataggio(false);
    }
  };


  const tuttiSelezionati = colleghi.length > 0 && colleghi.every(c => selezionati.includes(c?.altro_user_id));
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <TurniCondivisiView palette={colors} elementi={elementi} adesso={adesso}
      giornoSelezionato={giornoSelezionato} inizioSettimana={inizioSettimana}
      onGiorno={setGiornoSelezionato} onSettimana={cambiaSettimana}
      backLabel={backLabel} onBack={onBack} onHome={onHome} onGestioneColleghi={onGestioneColleghi}
      onCondividi={apriCondivisione} onRefresh={caricaTutto} loading={loading} errore={errore} />
      <Modal
        visible={modalCondivisione}
        transparent
        animationType="slide"
        onRequestClose={() =>
          !salvataggioRef.current && setModalCondivisione(false)
        }
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.70)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: coloreHome(palette, 'surface', '#0B1629'),
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              maxHeight: '85%',
              paddingTop: 20,
              paddingHorizontal: 18,
              paddingBottom: 34,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 18,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 21,
                    fontWeight: '900',
                  }}
                >
                  Condividi settimana
                </Text>

                <Text
                  style={{
                    color: coloreHome(palette, 'textMuted', '#8190AD'),
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  {formattaBreve(inizioSettimana)}
                  {' – '}
                  {formattaBreve(fineSettimana)}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  !salvataggioRef.current && setModalCondivisione(false)
                }
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor:
                    'rgba(255,255,255,0.06)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name="close"
                  size={23}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 14,
                  fontWeight: '900',
                  marginBottom: 10,
                }}
              >
                Cosa possono vedere?
              </Text>

              <View
                style={{
                  flexDirection: 'row',
                  marginBottom: 22,
                }}
              >
                <TouchableOpacity
                  onPress={() =>
                    setLivello('solo_orari')
                  }
                  style={{
                    flex: 1,
                    padding: 13,
                    borderRadius: 14,
                    marginRight: 6,
                    backgroundColor:
                      livello === 'solo_orari'
                        ? colors.accent
                        : colors.surfaceRaised,
                    borderWidth: 1,
                    borderColor:
                      livello === 'solo_orari'
                        ? colors.homeAccent
                        : 'rgba(130,160,255,0.18)',
                  }}
                >
                  <Text
                    style={{
                      color: livello === 'solo_orari' ? colors.onAccent : colors.text,
                      fontWeight: '900',
                      textAlign: 'center',
                    }}
                  >
                    Solo orari
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() =>
                    setLivello('orari_luogo')
                  }
                  style={{
                    flex: 1,
                    padding: 13,
                    borderRadius: 14,
                    marginLeft: 6,
                    backgroundColor:
                      livello === 'orari_luogo'
                        ? colors.accent
                        : colors.surfaceRaised,
                    borderWidth: 1,
                    borderColor:
                      livello === 'orari_luogo'
                        ? colors.homeAccent
                        : 'rgba(130,160,255,0.18)',
                  }}
                >
                  <Text
                    style={{
                      color: livello === 'orari_luogo' ? colors.onAccent : colors.text,
                      fontWeight: '900',
                      textAlign: 'center',
                    }}
                  >
                    Orari + luogo
                  </Text>
                </TouchableOpacity>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    color: colors.text,
                    fontSize: 14,
                    fontWeight: '900',
                  }}
                >
                  Scegli i colleghi
                </Text>

                {colleghi.length > 0 && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={tuttiSelezionati ? 'Deseleziona tutti' : 'Seleziona tutti'}
                    onPress={selezionaTutti}
                  >
                    <Text
                      style={{
                        color: coloreHome(palette, 'accent', '#8DB8FF'),
                        fontSize: 12,
                        fontWeight: '900',
                      }}
                    >
                      {tuttiSelezionati
                        ? 'Deseleziona tutti'
                        : 'Seleziona tutti'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {colleghi.length === 0 ? (
                <View
                  style={{
                    padding: 20,
                    backgroundColor: coloreHome(palette, 'surface', '#101B34'),
                    borderRadius: 16,
                  }}
                >
                  <Text
                    style={{
                      color: coloreHome(palette, 'textMuted', '#8997B5'),
                      textAlign: 'center',
                    }}
                  >
                    Non hai ancora colleghi accettati.
                  </Text>
                </View>
              ) : (
                colleghi.map(collega => {
                  const id =
                    collega?.altro_user_id;

                  const selezionato =
                    selezionati.includes(id);

                  return (
                    <TouchableOpacity
                      key={
                        collega.id ||
                        id
                      }
                      accessibilityRole="checkbox"
                      accessibilityLabel={nomeProfilo(collega.profilo)}
                      accessibilityState={{ checked: selezionato }}
                      onPress={() =>
                        toggleCollega(id)
                      }
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: coloreHome(palette, 'surface', '#101B34'),
                        borderRadius: 15,
                        padding: 13,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: selezionato
                          ? colors.homeAccent
                          : 'rgba(130,160,255,0.15)',
                      }}
                    >
                      <Ionicons
                        name={
                          selezionato
                            ? 'checkbox'
                            : 'square-outline'
                        }
                        size={23}
                        color={
                          selezionato
                            ? colors.homeAccent
                            : colors.textMuted
                        }
                      />

                      <View
                        style={{
                          flex: 1,
                          marginLeft: 10,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.text,
                            fontSize: 14,
                            fontWeight: '900',
                          }}
                        >
                          {nomeProfilo(
                            collega.profilo
                          )}
                        </Text>

                        {!!collega?.profilo
                          ?.azienda && (
                          <Text
                            style={{
                              color: coloreHome(palette, 'textMuted', '#8190AD'),
                              fontSize: 11,
                              marginTop: 3,
                            }}
                          >
                            {
                              collega.profilo
                                .azienda
                            }
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}

              <View
                style={{
                  marginTop: 15,
                  marginBottom: 18,
                  padding: 13,
                  borderRadius: 14,
                  backgroundColor:
                    'rgba(141,184,255,0.08)',
                }}
              >
                <Text
                  style={{
                    color: colors.textMuted,
                    fontSize: 11,
                    lineHeight: 17,
                  }}
                >
                  I turni restano privati per tutti gli
                  altri utenti. Solo i colleghi selezionati
                  potranno vedere questa settimana.
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              disabled={salvataggio}
              accessibilityRole="button"
              accessibilityLabel="Salva condivisione"
              onPress={salvaCondivisione}
              style={{
                backgroundColor: coloreHome(palette, 'accent', '#3158A8'),
                borderRadius: 16,
                minHeight: 54,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                opacity: salvataggio ? 0.6 : 1,
              }}
            >
              {salvataggio ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <>
                  <Ionicons
                    name="people-outline"
                    size={21}
                    color={colors.onAccent}
                  />

                  <Text
                    style={{
                      color: colors.onAccent,
                      fontSize: 15,
                      fontWeight: '900',
                      marginLeft: 8,
                    }}
                  >
                    Salva condivisione
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
  </View>;
}
