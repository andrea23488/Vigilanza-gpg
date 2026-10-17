import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Compare display labels only; stored times and callbacks remain untouched.
function nomeDescriveOrario(voce) {
  const parti = String(voce.nome).trim().match(
    /^(\d{1,2})(?:[.:]([0-5]\d))?\s*[-–—−]\s*(\d{1,2})(?:[.:]([0-5]\d))?$/
  );
  if (!parti) return false;
  const inizio = `${String(Number(parti[1])).padStart(2, '0')}:${parti[2] || '00'}`;
  const fine = `${String(Number(parti[3])).padStart(2, '0')}:${parti[4] || '00'}`;
  return inizio === voce.inizio && fine === voce.fine;
}

function EtichettaModello({ voce }) {
  const soloOrario = nomeDescriveOrario(voce);
  return (
    <View style={localStyles.modelLabel}>
      {!soloOrario && <Text style={localStyles.modelName}>{voce.nome}</Text>}
      <Text style={soloOrario ? localStyles.modelTimePrimary : localStyles.modelTime}>
        {voce.inizio}–{voce.fine}
      </Text>
    </View>
  );
}

export default function TurniRapidiSection({
  styles,
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
  const [periodoAperto, setPeriodoAperto] = useState(false);
  const [larghezzaGriglia, setLarghezzaGriglia] = useState(0);
  const { fontScale } = useWindowDimensions();
  const dueColonne = larghezzaGriglia >= 2 * 210 * Math.max(1, fontScale) + 8;
  const larghezzaCard = dueColonne ? (larghezzaGriglia - 8) / 2 : '100%';

  return (
    <View style={[styles.type, localStyles.section]}>
      <View style={localStyles.headingRow}>
        <View style={localStyles.iconBadge}>
          <Ionicons name="flash-outline" size={22} color="#D8C5FF" accessible={false} />
        </View>
        <View style={localStyles.headingText}>
          <Text style={localStyles.title}>Turni rapidi</Text>
          <Text style={localStyles.subtitle}>Scegli un modello per compilare il turno.</Text>
        </View>
      </View>

      <View
        style={[styles.quickRow, localStyles.grid]}
        onLayout={({ nativeEvent }) => setLarghezzaGriglia(nativeEvent.layout.width)}
      >
        {turniRapidi.map((voce) => (
          <View key={voce.id} style={[localStyles.modelCard, { width: larghezzaCard }]}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={nomeDescriveOrario(voce)
                ? `Applica turno ${voce.inizio}–${voce.fine}`
                : `Applica ${voce.nome}, ${voce.inizio}–${voce.fine}`}
              activeOpacity={0.8}
              style={localStyles.applyArea}
              onPress={() =>
                turnoRapido(voce.inizio, voce.fine, voce.operativita, voce.postazione)
              }
            >
              <EtichettaModello voce={voce} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Modifica ${voce.nome}`}
              activeOpacity={0.8}
              onPress={() => {
                setGestisciTurniRapidi(true);
                modificaTurnoRapido(voce);
              }}
              style={localStyles.editButton}
            >
              <Ionicons name="create-outline" size={20} color="#D8C5FF" accessible={false} />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Gestisci modelli"
        accessibilityState={{ expanded: gestisciTurniRapidi }}
        activeOpacity={0.8}
        onPress={() => setGestisciTurniRapidi((aperto) => !aperto)}
        style={localStyles.disclosure}
      >
        <Ionicons name="options-outline" size={20} color="#D8C5FF" accessible={false} />
        <View style={localStyles.headingText}>
          <Text style={localStyles.disclosureTitle}>Gestisci modelli</Text>
          <Text style={localStyles.subtitle}>Crea, modifica o ripristina i tuoi turni</Text>
        </View>
        <Ionicons name={gestisciTurniRapidi ? 'chevron-up' : 'chevron-down'} size={18} color="#D8C5FF" accessible={false} />
      </TouchableOpacity>

      {gestisciTurniRapidi && (
        <View
          style={{
            marginTop: 8,
            marginBottom: 0,
            padding: 10,
            borderRadius: 18,
            backgroundColor: '#0B1930',
            borderWidth: 1,
            borderColor: '#665080',
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
              color: '#BDC9DE',
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
                accessibilityRole="button"
                accessibilityLabel={`Modifica ${voce.nome}`}
                accessibilityState={{ selected: turnoRapidoInModifica === voce.id }}
                onPress={() => modificaTurnoRapido(voce)}
                style={{
                  flex: 1,
                  minHeight: 48,
                  minWidth: 0,
                  paddingVertical: 10,
                  borderRadius: 13,
                  paddingHorizontal: 12,
                  justifyContent: 'center',
                  backgroundColor:
                    turnoRapidoInModifica === voce.id
                      ? '#38294D'
                      : '#10213A',
                  borderWidth: 1,
                  borderColor:
                    turnoRapidoInModifica === voce.id
                      ? '#D8C5FF'
                      : '#294B70',
                }}
              >
                <EtichettaModello voce={voce} />

                {!!voce.operativita && (
                  <Text
                    style={{
                      color: '#BDC9DE',
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
                accessibilityRole="button"
                accessibilityLabel={`Elimina ${voce.nome}`}
                onPress={() => confermaEliminazioneTurnoRapido(voce)}
                style={{
                  width: 48,
                  height: 48,
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
              color: '#D8C5FF',
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
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 2,
            }}
          >
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={salvaTurnoRapidoPersonalizzato}
              style={{
                flexGrow: 1,
                flexBasis: 130,
                minHeight: 48,
                padding: 10,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#6941A5',
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
                  minHeight: 48,
                  padding: 10,
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


          <TouchableOpacity
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Ripristina turni predefiniti"
            onPress={confermaRipristinoTurniRapidi}
            style={{
              minHeight: 48,
              justifyContent: 'center',
              alignSelf: 'center',
              paddingVertical: 9,
              paddingHorizontal: 12,
              marginTop: 10,
            }}
          >
            <Text
              style={{
                color: '#BDC9DE',
                fontSize: 9,
                fontWeight: '800',
              }}
            >
              Ripristina turni predefiniti
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Applica a più giorni"
        accessibilityState={{ expanded: periodoAperto }}
        activeOpacity={0.8}
        onPress={() => setPeriodoAperto((aperto) => !aperto)}
        style={localStyles.disclosure}
      >
        <Ionicons name="calendar-outline" size={20} color="#D8C5FF" accessible={false} />
        <View style={localStyles.headingText}>
          <Text style={localStyles.disclosureTitle}>Applica a più giorni</Text>
          <Text style={localStyles.subtitle}>Scegli modello, periodo e giorni</Text>
        </View>
        <Ionicons name={periodoAperto ? 'chevron-up' : 'chevron-down'} size={18} color="#D8C5FF" accessible={false} />
      </TouchableOpacity>

      {periodoAperto && (
        <View style={localStyles.panel}>
          <Text
            style={{
              color: '#BDC9DE',
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
              color: '#D8C5FF',
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
                  accessibilityRole="button"
                  accessibilityLabel={`Usa ${voce.nome} per il periodo`}
                  accessibilityState={{ selected: selezionato }}
                  onPress={() =>
                    setTurnoRapidoPeriodoId(voce.id)
                  }
                  style={{
                    minHeight: 48,
                    maxWidth: '100%',
                    flexShrink: 1,
                    justifyContent: 'center',
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    marginRight: 7,
                    marginBottom: 7,
                    borderRadius: 12,
                    backgroundColor: selezionato
                      ? '#6941A5'
                      : '#10213A',
                    borderWidth: 1,
                    borderColor: selezionato
                      ? '#D8C5FF'
                      : '#294B70',
                  }}
                >
                  <EtichettaModello voce={voce} />
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
              color: '#D8C5FF',
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
                  accessibilityRole="button"
                  accessibilityLabel={['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'][indice]}
                  accessibilityState={{ selected: attivo }}
                  onPress={() =>
                    alternaGiornoSettimanaTurnoRapido(indice)
                  }
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    padding: 8,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: posizione === 6 ? 0 : 6,
                    marginBottom: 6,
                    backgroundColor: attivo
                      ? '#6941A5'
                      : '#10213A',
                    borderWidth: 1,
                    borderColor: attivo
                      ? '#D8C5FF'
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
            accessibilityRole="button"
            accessibilityState={{ disabled: salvataggioTurniPeriodo, busy: salvataggioTurniPeriodo }}
            disabled={salvataggioTurniPeriodo}
            onPress={applicaTurnoRapidoAlPeriodo}
            style={{
              minHeight: 47,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#6941A5',
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

        </View>
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
  section: {
    alignItems: 'stretch',
    backgroundColor: '#19162D',
    borderColor: '#756099',
    borderRadius: 20,
    padding: 12,
    marginRight: 0,
    marginBottom: 18,
  },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  iconBadge: {
    width: 48, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#302443',
  },
  headingText: { flex: 1, minWidth: 0 },
  title: { color: '#F5EFFF', fontSize: 16, fontWeight: '900' },
  subtitle: { color: '#C8BEDB', fontSize: 11, lineHeight: 16, marginTop: 3 },
  grid: { gap: 8, marginBottom: 4 },
  modelCard: {
    flexDirection: 'row', alignItems: 'stretch', flexShrink: 1,
    minWidth: 0, maxWidth: '100%', padding: 4, borderRadius: 16,
    backgroundColor: '#241D38', borderWidth: 1, borderColor: '#665080',
  },
  applyArea: {
    flex: 1, minWidth: 0, minHeight: 52, padding: 10,
    justifyContent: 'center', borderRadius: 12, backgroundColor: '#302443',
  },
  modelLabel: { minWidth: 0, flexShrink: 1, alignSelf: 'stretch' },
  modelName: { color: '#F5EFFF', fontSize: 13, fontWeight: '800', flexShrink: 1 },
  modelTimePrimary: { color: '#F5EFFF', fontSize: 15, fontWeight: '900', flexShrink: 1 },
  modelTime: { color: '#D8C5FF', fontSize: 12, fontWeight: '600', marginTop: 4, flexShrink: 1 },
  editButton: {
    width: 48, minHeight: 48, marginLeft: 4, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#38294D',
  },
  disclosure: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 58,
    padding: 10, marginTop: 8, borderRadius: 14,
    backgroundColor: '#302443', borderWidth: 1, borderColor: '#665080',
  },
  disclosureTitle: { color: '#F5EFFF', fontSize: 12, fontWeight: '900' },
  panel: {
    marginTop: 8, padding: 10, borderRadius: 14,
    backgroundColor: '#0B1930', borderWidth: 1, borderColor: '#665080',
  },
});
