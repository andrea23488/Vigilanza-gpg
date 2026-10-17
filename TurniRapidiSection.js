import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TurniRapidiSection({
  styles,
  Quick,
  Field,
  gestisciTurniRapidi,
  setGestisciTurniRapidi,
  turniRapidi,
  turnoRapido,
  modificaTurnoRapido,
  turnoRapidoInModifica,
  confermaEliminazioneTurnoRapido,
  turnoRapidoNome,
  setTurnoRapidoNome,
  turnoRapidoInizio,
  setTurnoRapidoInizio,
  turnoRapidoFine,
  setTurnoRapidoFine,
  turnoRapidoOperativita,
  setTurnoRapidoOperativita,
  turnoRapidoPostazione,
  setTurnoRapidoPostazione,
  salvaTurnoRapidoPersonalizzato,
  azzeraEditorTurnoRapido,
  turnoRapidoPeriodoId,
  setTurnoRapidoPeriodoId,
  turnoRapidoDalGiorno,
  setTurnoRapidoDalGiorno,
  turnoRapidoAlGiorno,
  setTurnoRapidoAlGiorno,
  turnoRapidoGiorniSettimana,
  alternaGiornoSettimanaTurnoRapido,
  salvataggioTurniPeriodo,
  applicaTurnoRapidoAlPeriodo,
  confermaRipristinoTurniRapidi,
}) {
  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <Text
          style={[
            styles.label,
            { marginBottom: 0 },
          ]}
        >
          TURNO RAPIDO
        </Text>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() =>
            setGestisciTurniRapidi((v) => !v)
          }
          style={{
            paddingVertical: 6,
            paddingHorizontal: 9,
            borderRadius: 11,
            borderWidth: 1,
            borderColor: 'rgba(105,223,255,0.34)',
            backgroundColor: '#10213A',
          }}
        >
          <Text
            style={{
              color: '#8EDFFF',
              fontSize: 9,
              fontWeight: '900',
            }}
          >
            {gestisciTurniRapidi ? 'CHIUDI' : 'PERSONALIZZA'}
          </Text>
        </TouchableOpacity>
      </View>

      <View
        style={
          styles.quickRow
        }
      >
        {turniRapidi.map((voce) => (
          <Quick
            key={voce.id}
            title={voce.nome}
            onPress={() =>
              turnoRapido(
                voce.inizio,
                voce.fine,
                voce.operativita,
                voce.postazione
              )
            }
          />
        ))}
      </View>

      {gestisciTurniRapidi && (
        <View
          style={{
            marginTop: -4,
            marginBottom: 18,
            padding: 14,
            borderRadius: 18,
            backgroundColor: '#0B1930',
            borderWidth: 1,
            borderColor: 'rgba(105,223,255,0.28)',
          }}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: '900',
              marginBottom: 4,
            }}
          >
            I miei turni rapidi
          </Text>

          <Text
            style={{
              color: '#8FA5CC',
              fontSize: 10,
              lineHeight: 15,
              marginBottom: 12,
            }}
          >
            Tocca un turno per modificarlo. Puoi salvare anche operatività e postazione: verranno compilate insieme agli orari.
          </Text>

          {turniRapidi.map((voce) => (
            <View
              key={`gestisci_${voce.id}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 7,
              }}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => modificaTurnoRapido(voce)}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 13,
                  paddingHorizontal: 12,
                  justifyContent: 'center',
                  backgroundColor:
                    turnoRapidoInModifica === voce.id
                      ? 'rgba(49,84,255,0.22)'
                      : '#10213A',
                  borderWidth: 1,
                  borderColor:
                    turnoRapidoInModifica === voce.id
                      ? '#69DFFF'
                      : '#294B70',
                }}
              >
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 11,
                    fontWeight: '900',
                  }}
                >
                  {voce.nome} · {voce.inizio}–{voce.fine}
                </Text>

                {!!voce.operativita && (
                  <Text
                    numberOfLines={1}
                    style={{
                      color: '#8FA5CC',
                      fontSize: 8.5,
                      marginTop: 2,
                    }}
                  >
                    {voce.operativita}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => confermaEliminazioneTurnoRapido(voce)}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 7,
                  backgroundColor: 'rgba(255,91,116,0.09)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,110,132,0.24)',
                }}
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color="#FF98A9"
                />
              </TouchableOpacity>
            </View>
          ))}

          <Text
            style={{
              color: '#8EDFFF',
              fontSize: 9,
              fontWeight: '900',
              letterSpacing: 0.8,
              marginTop: 8,
              marginBottom: 7,
            }}
          >
            {turnoRapidoInModifica ? 'MODIFICA TURNO' : 'NUOVO TURNO RAPIDO'}
          </Text>

          <Field
            label="NOME"
            value={turnoRapidoNome}
            onChange={setTurnoRapidoNome}
          />

          <View style={styles.row}>
            <View style={styles.half}>
              <Field
                label="INIZIO"
                value={turnoRapidoInizio}
                onChange={setTurnoRapidoInizio}
              />
            </View>

            <View style={{ width: 10 }} />

            <View style={styles.half}>
              <Field
                label="FINE"
                value={turnoRapidoFine}
                onChange={setTurnoRapidoFine}
              />
            </View>
          </View>

          <Field
            label="OPERATIVITÀ (FACOLTATIVA)"
            value={turnoRapidoOperativita}
            onChange={setTurnoRapidoOperativita}
          />

          <Field
            label="POSTAZIONE / INDIRIZZO (FACOLTATIVO)"
            value={turnoRapidoPostazione}
            onChange={setTurnoRapidoPostazione}
          />

          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              marginTop: 2,
            }}
          >
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={salvaTurnoRapidoPersonalizzato}
              style={{
                flex: 1,
                minHeight: 45,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#3154FF',
              }}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 10,
                  fontWeight: '900',
                }}
              >
                {turnoRapidoInModifica ? 'SALVA MODIFICA' : 'AGGIUNGI'}
              </Text>
            </TouchableOpacity>

            {turnoRapidoInModifica && (
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={azzeraEditorTurnoRapido}
                style={{
                  minWidth: 88,
                  minHeight: 45,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#10213A',
                  borderWidth: 1,
                  borderColor: '#315276',
                }}
              >
                <Text
                  style={{
                    color: '#DDF7FF',
                    fontSize: 10,
                    fontWeight: '900',
                  }}
                >
                  ANNULLA
                </Text>
              </TouchableOpacity>
            )}
          </View>


          <View
            style={{
              height: 1,
              backgroundColor: '#294B70',
              marginTop: 16,
              marginBottom: 14,
            }}
          />

          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: '900',
            }}
          >
            Applica a più giorni
          </Text>

          <Text
            style={{
              color: '#8FA5CC',
              fontSize: 10,
              lineHeight: 15,
              marginTop: 4,
              marginBottom: 11,
            }}
          >
            Scegli un turno modello, il periodo del mese e i giorni della settimana. I turni già presenti che si sovrappongono non verranno modificati.
          </Text>

          <Text
            style={{
              color: '#8EDFFF',
              fontSize: 9,
              fontWeight: '900',
              letterSpacing: 0.7,
              marginBottom: 7,
            }}
          >
            TURNO MODELLO
          </Text>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              marginBottom: 10,
            }}
          >
            {turniRapidi.map((voce) => {
              const selezionato =
                turnoRapidoPeriodoId === voce.id;

              return (
                <TouchableOpacity
                  key={`periodo_${voce.id}`}
                  activeOpacity={0.82}
                  onPress={() =>
                    setTurnoRapidoPeriodoId(voce.id)
                  }
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    marginRight: 7,
                    marginBottom: 7,
                    borderRadius: 12,
                    backgroundColor: selezionato
                      ? '#3154FF'
                      : '#10213A',
                    borderWidth: 1,
                    borderColor: selezionato
                      ? '#69DFFF'
                      : '#294B70',
                  }}
                >
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 9.5,
                      fontWeight: '900',
                    }}
                  >
                    {voce.nome}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.row}>
            <View style={styles.half}>
              <Field
                label="DAL GIORNO"
                value={turnoRapidoDalGiorno}
                onChange={setTurnoRapidoDalGiorno}
                keyboardType="number-pad"
              />
            </View>

            <View style={{ width: 10 }} />

            <View style={styles.half}>
              <Field
                label="AL GIORNO"
                value={turnoRapidoAlGiorno}
                onChange={setTurnoRapidoAlGiorno}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <Text
            style={{
              color: '#8EDFFF',
              fontSize: 9,
              fontWeight: '900',
              letterSpacing: 0.7,
              marginBottom: 7,
            }}
          >
            GIORNI DELLA SETTIMANA
          </Text>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              marginBottom: 10,
            }}
          >
            {[
              [1, 'L'],
              [2, 'M'],
              [3, 'M'],
              [4, 'G'],
              [5, 'V'],
              [6, 'S'],
              [0, 'D'],
            ].map(([indice, etichetta], posizione) => {
              const attivo =
                turnoRapidoGiorniSettimana.includes(indice);

              return (
                <TouchableOpacity
                  key={`weekday_${indice}`}
                  activeOpacity={0.82}
                  onPress={() =>
                    alternaGiornoSettimanaTurnoRapido(indice)
                  }
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: posizione === 6 ? 0 : 6,
                    marginBottom: 6,
                    backgroundColor: attivo
                      ? '#3154FF'
                      : '#10213A',
                    borderWidth: 1,
                    borderColor: attivo
                      ? '#69DFFF'
                      : '#294B70',
                  }}
                >
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 11,
                      fontWeight: '900',
                    }}
                  >
                    {etichetta}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            activeOpacity={0.84}
            disabled={salvataggioTurniPeriodo}
            onPress={applicaTurnoRapidoAlPeriodo}
            style={{
              minHeight: 47,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#3154FF',
              opacity: salvataggioTurniPeriodo ? 0.55 : 1,
            }}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 10.5,
                fontWeight: '900',
              }}
            >
              {salvataggioTurniPeriodo
                ? 'SALVATAGGIO...'
                : 'APPLICA AL PERIODO'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={confermaRipristinoTurniRapidi}
            style={{
              alignSelf: 'center',
              paddingVertical: 9,
              paddingHorizontal: 12,
              marginTop: 10,
            }}
          >
            <Text
              style={{
                color: '#8FA5CC',
                fontSize: 9,
                fontWeight: '800',
              }}
            >
              Ripristina turni predefiniti
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}
