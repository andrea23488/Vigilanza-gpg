import React, { useEffect, useMemo, useState } from 'react';

import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const COLORS = {
  bg: '#07111F',
  card: '#101C2D',
  border: '#203550',
  white: '#FFFFFF',
  muted: '#91A3BA',
  blue: '#168BFF',
  lightBlue: '#55B8FF',
  red: '#FF6B6B',
};

const MESI = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
];

export default function App() {
  const [screen, setScreen] = useState('home');

  const [mese, setMese] = useState(7);
  const [anno, setAnno] = useState(2026);

  const [turni, setTurni] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState(null);

  const [giorno, setGiorno] = useState(1);
  const [tipo, setTipo] = useState('turno');

  const [inizio, setInizio] = useState('06:00');
  const [fine, setFine] = useState('14:00');

  const [luogo, setLuogo] = useState('Fiumicino');
  const [extra, setExtra] = useState('1');

  const [riposoLavorato, setRiposoLavorato] = useState(false);

  useEffect(() => {
    caricaTurni();
  }, []);

  function headersJSON() {
    return {
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
    };
  }

  async function caricaTurni() {
    try {
      setLoading(true);

      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/turni?select=*&order=anno.asc,mese.asc,giorno.asc`,
        {
          method: 'GET',
          headers: {
            apikey: SUPABASE_KEY,
          },
        }
      );

      const testo = await response.text();

      console.log('GET STATUS:', response.status);
      console.log('GET RESPONSE:', testo);

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${testo}`
        );
      }

      const dati = testo ? JSON.parse(testo) : [];

      setTurni(Array.isArray(dati) ? dati : []);

      return Array.isArray(dati) ? dati : [];
    } catch (error) {
      console.log('ERRORE LETTURA:', error);

      Alert.alert(
        'Errore database',
        error.message || 'Impossibile leggere i turni.'
      );

      return [];
    } finally {
      setLoading(false);
    }
  }

  const turniMese = useMemo(() => {
    return turni.filter(
      (t) =>
        Number(t.mese) === mese + 1 &&
        Number(t.anno) === anno
    );
  }, [turni, mese, anno]);

  const statistiche = useMemo(() => {
    let ore = 0;
    let extraOre = 0;
    let notti = 0;
    let giorniLavorati = 0;

    turniMese.forEach((t) => {
      if (t.tipo === 'turno') {
        ore += Number(t.ore || 0);
        extraOre += Number(t.extra || 0);
        giorniLavorati += 1;

        if (t.fascia === 'Notte') {
          notti += 1;
        }
      }
    });

    return {
      ore,
      extraOre,
      notti,
      giorni: giorniLavorati,
    };
  }, [turniMese]);

  function calcolaOre(start, end) {
    if (!start || !end) {
      return 0;
    }

    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);

    if ([h1, m1, h2, m2].some(Number.isNaN)) {
      return 0;
    }

    let a = h1 * 60 + m1;
    let b = h2 * 60 + m2;

    if (b <= a) {
      b += 1440;
    }

    return (b - a) / 60;
  }

  function fasciaTurno(orario) {
    if (!orario) {
      return null;
    }

    const h = Number(orario.split(':')[0]);

    if (h >= 21 || h < 5) {
      return 'Notte';
    }

    if (h >= 5 && h < 13) {
      return 'Mattina';
    }

    return 'Pomeriggio';
  }

  function turnoRapido(start, end) {
    setInizio(start);
    setFine(end);

    const ore = calcolaOre(start, end);

    setExtra(
      String(Math.max(0, ore - 7))
    );
  }

  function nuovoGiorno(g) {
    console.log('APERTURA NUOVO GIORNO:', g);

    setEditingId(null);

    setGiorno(Number(g));
    setTipo('turno');

    setInizio('06:00');
    setFine('14:00');

    setLuogo('Fiumicino');
    setExtra('1');

    setRiposoLavorato(false);

    setScreen('edit');
  }

  function modificaGiorno(record) {
    console.log('APERTURA MODIFICA:', record);

    if (!record || record.id === undefined || record.id === null) {
      return;
    }

    setEditingId(record.id);

    setGiorno(Number(record.giorno));

    setTipo(record.tipo || 'turno');

    setInizio(record.inizio || '06:00');
    setFine(record.fine || '14:00');

    setLuogo(record.luogo || '');

    setExtra(
      String(record.extra || 0)
    );

    setRiposoLavorato(
      record.riposo_lavorato === true
    );

    setScreen('edit');
  }

  function creaPayload() {
    const ore =
      tipo === 'turno'
        ? calcolaOre(inizio, fine)
        : 0;

    const extraNumero = Number(
      String(extra).replace(',', '.')
    );

    return {
      giorno: Number(giorno),
      mese: mese + 1,
      anno: Number(anno),

      tipo,

      inizio:
        tipo === 'turno'
          ? inizio
          : null,

      fine:
        tipo === 'turno'
          ? fine
          : null,

      luogo:
        tipo === 'turno'
          ? luogo || 'Servizio'
          : null,

      ore,

      extra:
        tipo === 'turno' &&
        !Number.isNaN(extraNumero)
          ? extraNumero
          : 0,

      fascia:
        tipo === 'turno'
          ? fasciaTurno(inizio)
          : null,

      riposo_lavorato:
        tipo === 'turno'
          ? riposoLavorato
          : false,
    };
  }

  async function inserisciTurno(payload) {
    console.log('INVIO POST:', payload);

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/turni`,
      {
        method: 'POST',

        headers: {
          ...headersJSON(),
          Prefer: 'return=representation',
        },

        body: JSON.stringify(payload),
      }
    );

    const testo = await response.text();

    console.log('POST STATUS:', response.status);
    console.log('POST RESPONSE:', testo);

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${testo || 'Errore POST'}`
      );
    }

    const righe = testo ? JSON.parse(testo) : [];

    if (!Array.isArray(righe) || righe.length === 0) {
      throw new Error(
        'Supabase non ha restituito la nuova giornata.'
      );
    }

    return righe[0];
  }

  async function aggiornaTurno(id, payload) {
    console.log('INVIO PATCH ID:', id);
    console.log('PAYLOAD PATCH:', payload);

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/turni?id=eq.${id}`,
      {
        method: 'PATCH',

        headers: {
          ...headersJSON(),
          Prefer: 'return=representation',
        },

        body: JSON.stringify(payload),
      }
    );

    const testo = await response.text();

    console.log('PATCH STATUS:', response.status);
    console.log('PATCH RESPONSE:', testo);

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${testo || 'Errore PATCH'}`
      );
    }

    const righe = testo ? JSON.parse(testo) : [];

    if (!Array.isArray(righe) || righe.length === 0) {
      throw new Error(
        'Supabase non ha restituito la giornata modificata.'
      );
    }

    return righe[0];
  }

  async function salvaGiornata() {
    if (saving) {
      return;
    }

    try {
      setSaving(true);

      const payload = creaPayload();

      if (
        tipo === 'turno' &&
        Number(payload.ore) <= 0
      ) {
        Alert.alert(
          'Controlla il turno',
          'Gli orari inseriti non sono validi.'
        );

        return;
      }

      let salvato = null;

      /*
        REGOLA FONDAMENTALE:

        editingId NULL = POST
        editingId presente = PATCH

        Non cerchiamo più automaticamente un turno
        dello stesso giorno durante il salvataggio.
      */

      if (
        editingId === null ||
        editingId === undefined
      ) {
        console.log('MODALITA SALVATAGGIO: NUOVO / POST');

        salvato = await inserisciTurno(payload);
      } else {
        console.log(
          'MODALITA SALVATAGGIO: MODIFICA / PATCH',
          editingId
        );

        salvato = await aggiornaTurno(
          editingId,
          payload
        );
      }

      if (!salvato || salvato.id === undefined) {
        throw new Error(
          'La giornata non è stata restituita correttamente dal database.'
        );
      }

      /*
        Aggiornamento immediato locale.
        Serve per mostrare subito il turno.
      */

      setTurni((precedenti) => {
        const senzaRiga = precedenti.filter(
          (t) =>
            Number(t.id) !==
            Number(salvato.id)
        );

        return [
          ...senzaRiga,
          salvato,
        ];
      });

      /*
        Ora facciamo anche una lettura REALE del database.
      */

      const aggiornati = await caricaTurni();

      const trovato = aggiornati.find(
        (t) =>
          Number(t.giorno) ===
            Number(payload.giorno) &&
          Number(t.mese) ===
            Number(payload.mese) &&
          Number(t.anno) ===
            Number(payload.anno)
      );

      console.log(
        'VERIFICA DOPO SALVATAGGIO:',
        trovato
      );

      if (!trovato) {
        throw new Error(
          `Il ${payload.giorno}/${payload.mese}/${payload.anno} non risulta nel database dopo il salvataggio.`
        );
      }

      /*
        Importantissimo:
        azzeriamo editingId PRIMA di tornare al calendario.
      */

      setEditingId(null);

      Alert.alert(
        'Salvato ✅',
        'La giornata è stata salvata nel database.',
        [
          {
            text: 'OK',
            onPress: () => {
              setScreen('calendar');
            },
          },
        ]
      );
    } catch (error) {
      console.log(
        'ERRORE SALVATAGGIO:',
        error
      );

      Alert.alert(
        'Errore database',
        error.message ||
          'Salvataggio non riuscito.'
      );
    } finally {
      setSaving(false);
    }
  }

  function confermaEliminazione() {
    if (
      editingId === null ||
      editingId === undefined
    ) {
      return;
    }

    Alert.alert(
      'Elimina giornata',
      'Vuoi davvero eliminare questa giornata?',
      [
        {
          text: 'Annulla',
          style: 'cancel',
        },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: eliminaGiornata,
        },
      ]
    );
  }

  async function eliminaGiornata() {
    if (
      editingId === null ||
      editingId === undefined
    ) {
      return;
    }

    try {
      setSaving(true);

      const idDaEliminare = editingId;

      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/turni?id=eq.${idDaEliminare}`,
        {
          method: 'DELETE',

          headers: {
            apikey: SUPABASE_KEY,
          },
        }
      );

      const testo = await response.text();

      console.log(
        'DELETE STATUS:',
        response.status
      );

      console.log(
        'DELETE RESPONSE:',
        testo
      );

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${testo || 'Errore DELETE'}`
        );
      }

      setTurni((precedenti) =>
        precedenti.filter(
          (t) =>
            Number(t.id) !==
            Number(idDaEliminare)
        )
      );

      setEditingId(null);

      await caricaTurni();

      setScreen('calendar');
    } catch (error) {
      console.log(
        'ERRORE ELIMINAZIONE:',
        error
      );

      Alert.alert(
        'Errore',
        error.message ||
          'Eliminazione non riuscita.'
      );
    } finally {
      setSaving(false);
    }
  }

  function mesePrecedente() {
    setEditingId(null);

    if (mese === 0) {
      setMese(11);
      setAnno((a) => a - 1);
    } else {
      setMese((m) => m - 1);
    }
  }

  function meseSuccessivo() {
    setEditingId(null);

    if (mese === 11) {
      setMese(0);
      setAnno((a) => a + 1);
    } else {
      setMese((m) => m + 1);
    }
  }

  function tornaHome() {
    setEditingId(null);
    setScreen('home');
  }

  function tornaCalendario() {
    setEditingId(null);
    setScreen('calendar');
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator
          size="large"
          color={COLORS.blue}
        />

        <Text style={styles.loadingText}>
          Collegamento al database...
        </Text>
      </SafeAreaView>
    );
  }

  if (screen === 'calendar') {
    return (
      <Screen>
        <Back onPress={tornaHome} />

        <Text style={styles.title}>
          Calendario
        </Text>

        <Text style={styles.subtitle}>
          Tocca un giorno per inserire il servizio
        </Text>

        <View style={styles.monthBox}>
          <TouchableOpacity
            onPress={mesePrecedente}
          >
            <Text style={styles.arrow}>
              ‹
            </Text>
          </TouchableOpacity>

          <View>
            <Text style={styles.month}>
              {MESI[mese]}
            </Text>

            <Text style={styles.year}>
              {anno}
            </Text>
          </View>

          <TouchableOpacity
            onPress={meseSuccessivo}
          >
            <Text style={styles.arrow}>
              ›
            </Text>
          </TouchableOpacity>
        </View>

        <Calendar
          anno={anno}
          mese={mese}
          records={turniMese}
          onPress={(g, record) => {
            if (
              record &&
              record.id !== undefined &&
              record.id !== null
            ) {
              modificaGiorno(record);
            } else {
              nuovoGiorno(g);
            }
          }}
        />

        <View style={styles.stats}>
          <Stat
            label="ORE"
            value={`${statistiche.ore}h`}
          />

          <Stat
            label="EXTRA"
            value={`${statistiche.extraOre}h`}
          />

          <Stat
            label="NOTTI"
            value={`${statistiche.notti}`}
          />
        </View>

        <TouchableOpacity
          style={styles.syncButton}
          onPress={caricaTurni}
        >
          <Text style={styles.syncText}>
            ↻ Aggiorna calendario
          </Text>
        </TouchableOpacity>
      </Screen>
    );
  }

  if (screen === 'edit') {
    const modalitaModifica =
      editingId !== null &&
      editingId !== undefined;

    return (
      <Screen>
        <Back onPress={tornaCalendario} />

        <Text style={styles.title}>
          {modalitaModifica
            ? 'Modifica giornata'
            : 'Nuova giornata'}
        </Text>

        <Text style={styles.subtitle}>
          {giorno} {MESI[mese]} {anno}
        </Text>

        <View
          style={[
            styles.modeBadge,
            modalitaModifica
              ? styles.modeBadgeEdit
              : styles.modeBadgeNew,
          ]}
        >
          <Text style={styles.modeBadgeText}>
            {modalitaModifica
              ? 'MODIFICA TURNO ESISTENTE'
              : 'NUOVO TURNO'}
          </Text>
        </View>

        <Text style={styles.label}>
          TIPO GIORNATA
        </Text>

        <View style={styles.types}>
          {[
            ['turno', 'Turno'],
            ['riposo', 'Riposo'],
            ['ferie', 'Ferie'],
            ['malattia', 'Malattia'],
            ['permesso', 'Permesso'],
          ].map(([id, nome]) => (
            <TouchableOpacity
              key={id}
              style={[
                styles.type,
                tipo === id &&
                  styles.typeSelected,
              ]}
              onPress={() =>
                setTipo(id)
              }
            >
              <Text
                style={[
                  styles.typeText,
                  tipo === id &&
                    styles.typeTextSelected,
                ]}
              >
                {nome}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tipo === 'turno' && (
          <>
            <Text style={styles.label}>
              TURNO RAPIDO
            </Text>

            <View style={styles.quickRow}>
              <Quick
                title="06–14"
                onPress={() =>
                  turnoRapido(
                    '06:00',
                    '14:00'
                  )
                }
              />

              <Quick
                title="14–22"
                onPress={() =>
                  turnoRapido(
                    '14:00',
                    '22:00'
                  )
                }
              />

              <Quick
                title="22–06"
                onPress={() =>
                  turnoRapido(
                    '22:00',
                    '06:00'
                  )
                }
              />
            </View>

            <View style={styles.row}>
              <View style={styles.half}>
                <Field
                  label="INIZIO"
                  value={inizio}
                  onChange={setInizio}
                />
              </View>

              <View
                style={{ width: 10 }}
              />

              <View style={styles.half}>
                <Field
                  label="FINE"
                  value={fine}
                  onChange={setFine}
                />
              </View>
            </View>

            <Field
              label="POSTAZIONE"
              value={luogo}
              onChange={setLuogo}
            />

            <Field
              label="ORE STRAORDINARIE"
              value={extra}
              onChange={setExtra}
              keyboardType="decimal-pad"
            />

            <TouchableOpacity
              style={[
                styles.restButton,
                riposoLavorato &&
                  styles.restButtonOn,
              ]}
              onPress={() =>
                setRiposoLavorato(
                  !riposoLavorato
                )
              }
            >
              <Text style={styles.restText}>
                {riposoLavorato
                  ? '✓ '
                  : '○ '}
                Riposo lavorato
              </Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={[
            styles.saveButton,
            saving &&
              styles.disabled,
          ]}
          onPress={salvaGiornata}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator
              color="#FFFFFF"
            />
          ) : (
            <Text style={styles.saveText}>
              {modalitaModifica
                ? 'SALVA MODIFICHE'
                : 'SALVA NUOVA GIORNATA'}
            </Text>
          )}
        </TouchableOpacity>

        {modalitaModifica && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={
              confermaEliminazione
            }
          >
            <Text style={styles.deleteText}>
              Elimina giornata
            </Text>
          </TouchableOpacity>
        )}
      </Screen>
    );
  }

  if (screen === 'turni') {
    const ordinati = [
      ...turniMese,
    ].sort(
      (a, b) =>
        Number(a.giorno) -
        Number(b.giorno)
    );

    return (
      <Screen>
        <Back onPress={tornaHome} />

        <Text style={styles.title}>
          I miei turni
        </Text>

        <Text style={styles.subtitle}>
          {MESI[mese]} {anno}
        </Text>

        {ordinati.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              Nessun turno inserito
            </Text>

            <Text style={styles.emptyText}>
              Inserisci la prima giornata dal calendario.
            </Text>
          </View>
        ) : (
          ordinati.map((t) => (
            <TouchableOpacity
              key={String(t.id)}
              style={styles.turnCard}
              onPress={() =>
                modificaGiorno(t)
              }
            >
              <View style={styles.dayBadge}>
                <Text style={styles.dayBig}>
                  {t.giorno}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.turnTitle}>
                  {t.tipo === 'turno'
                    ? `${formattaOra(
                        t.inizio
                      )} — ${formattaOra(
                        t.fine
                      )}`
                    : nomeTipo(t.tipo)}
                </Text>

                <Text style={styles.turnSub}>
                  {t.tipo === 'turno'
                    ? `${t.fascia || ''} • ${
                        t.luogo || ''
                      }`
                    : 'Giornata non lavorata'}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcome}>
            Buon servizio, Andrea 👋
          </Text>

          <Text style={styles.company}>
            ITALPOL • Guardia Particolare Giurata
          </Text>
        </View>

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            AI
          </Text>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroSmall}>
          QUESTO MESE
        </Text>

        <Text style={styles.heroMonth}>
          {MESI[mese]} {anno}
        </Text>

        <View style={styles.heroStats}>
          <HomeStat
            label="Ore"
            value={`${statistiche.ore}h`}
          />

          <HomeStat
            label="Extra"
            value={`${statistiche.extraOre}h`}
          />

          <HomeStat
            label="Giorni"
            value={`${statistiche.giorni}`}
          />
        </View>
      </View>

      <Text style={styles.section}>
        Il tuo servizio
      </Text>

      <Menu
        icon="📅"
        title="I miei turni"
        subtitle="Elenco servizi e riposi"
        onPress={() => {
          setEditingId(null);
          setScreen('turni');
        }}
      />

      <Menu
        icon="🗓️"
        title="Calendario"
        subtitle="Inserisci e modifica le giornate"
        onPress={() => {
          setEditingId(null);
          setScreen('calendar');
        }}
      />

      <TouchableOpacity
        style={styles.saveButton}
        onPress={() => {
          setEditingId(null);
          setScreen('calendar');
        }}
      >
        <Text style={styles.saveText}>
          ＋ INSERISCI GIORNATA
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.syncButton}
        onPress={caricaTurni}
      >
        <Text style={styles.syncText}>
          ↻ Sincronizza database
        </Text>
      </TouchableOpacity>

      <Text style={styles.footer}>
        VIGILANZA GPG • DATABASE ONLINE
      </Text>
    </Screen>
  );
}

function Calendar({
  anno,
  mese,
  records,
  onPress,
}) {
  const giorni = new Date(
    anno,
    mese + 1,
    0
  ).getDate();

  let primo = new Date(
    anno,
    mese,
    1
  ).getDay();

  primo =
    primo === 0
      ? 6
      : primo - 1;

  const celle = [];

  for (
    let i = 0;
    i < primo;
    i++
  ) {
    celle.push(null);
  }

  for (
    let i = 1;
    i <= giorni;
    i++
  ) {
    celle.push(i);
  }

  return (
    <View style={styles.calendar}>
      <View style={styles.week}>
        {[
          'L',
          'M',
          'M',
          'G',
          'V',
          'S',
          'D',
        ].map((d, index) => (
          <Text
            key={`week-${index}`}
            style={styles.weekText}
          >
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {celle.map(
          (day, index) => {
            if (!day) {
              return (
                <View
                  key={`vuoto-${index}`}
                  style={
                    styles.calendarDay
                  }
                />
              );
            }

            const record =
              records.find(
                (r) =>
                  Number(
                    r.giorno
                  ) ===
                  Number(day)
              );

            return (
              <TouchableOpacity
                key={`giorno-${day}`}
                style={[
                  styles.calendarDay,
                  record &&
                    styles.calendarDayActive,
                ]}
                onPress={() =>
                  onPress(
                    day,
                    record || null
                  )
                }
              >
                <Text
                  style={[
                    styles.calendarNumber,
                    record &&
                      styles.calendarNumberActive,
                  ]}
                >
                  {day}
                </Text>

                {record && (
                  <Text style={styles.code}>
                    {record.tipo === 'turno'
                      ? `${formattaOra(
                          record.inizio
                        ).slice(
                          0,
                          2
                        )}-${formattaOra(
                          record.fine
                        ).slice(
                          0,
                          2
                        )}`
                      : String(
                          record.tipo
                        )
                          .slice(0, 3)
                          .toUpperCase()}
                  </Text>
                )}
              </TouchableOpacity>
            );
          }
        )}
      </View>
    </View>
  );
}

function Screen({ children }) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function Back({ onPress }) {
  return (
    <TouchableOpacity
      style={styles.back}
      onPress={onPress}
    >
      <Text style={styles.backText}>
        ‹
      </Text>
    </TouchableOpacity>
  );
}

function Menu({
  icon,
  title,
  subtitle,
  onPress,
}) {
  return (
    <TouchableOpacity
      style={styles.menu}
      onPress={onPress}
    >
      <Text style={styles.menuIcon}>
        {icon}
      </Text>

      <View style={{ flex: 1 }}>
        <Text style={styles.menuTitle}>
          {title}
        </Text>

        <Text style={styles.menuSub}>
          {subtitle}
        </Text>
      </View>

      <Text style={styles.chevron}>
        ›
      </Text>
    </TouchableOpacity>
  );
}

function Quick({
  title,
  onPress,
}) {
  return (
    <TouchableOpacity
      style={styles.quick}
      onPress={onPress}
    >
      <Text style={styles.quickText}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboardType,
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>
        {label}
      </Text>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        autoCorrect={false}
      />
    </View>
  );
}

function Stat({
  label,
  value,
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>
        {value}
      </Text>

      <Text style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

function HomeStat({
  label,
  value,
}) {
  return (
    <View>
      <Text style={styles.homeValue}>
        {value}
      </Text>

      <Text style={styles.homeLabel}>
        {label}
      </Text>
    </View>
  );
}

function nomeTipo(tipo) {
  if (tipo === 'riposo') {
    return 'Riposo';
  }

  if (tipo === 'ferie') {
    return 'Ferie';
  }

  if (tipo === 'malattia') {
    return 'Malattia';
  }

  if (tipo === 'permesso') {
    return 'Permesso';
  }

  return 'Turno';
}

function formattaOra(valore) {
  if (!valore) {
    return '--:--';
  }

  return String(valore).slice(0, 5);
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  content: {
    padding: 20,
    paddingBottom: 60,
  },

  loading: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: COLORS.muted,
    marginTop: 12,
  },

  disabled: {
    opacity: 0.6,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },

  welcome: {
    color: COLORS.white,
    fontSize: 23,
    fontWeight: '900',
  },

  company: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 5,
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    color: COLORS.white,
    fontWeight: '900',
  },

  hero: {
    backgroundColor: '#10304B',
    borderRadius: 24,
    padding: 22,
    marginBottom: 26,
  },

  heroSmall: {
    color: COLORS.lightBlue,
    fontSize: 11,
    fontWeight: '900',
  },

  heroMonth: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 5,
  },

  heroStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 22,
  },

  homeValue: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '900',
  },

  homeLabel: {
    color: COLORS.muted,
    fontSize: 11,
  },

  section: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 14,
  },

  menu: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  menuIcon: {
    fontSize: 24,
    marginRight: 14,
  },

  menuTitle: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 16,
  },

  menuSub: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 4,
  },

  chevron: {
    color: COLORS.muted,
    fontSize: 28,
  },

  saveButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 17,
    padding: 17,
    alignItems: 'center',
    marginTop: 12,
  },

  saveText: {
    color: COLORS.white,
    fontWeight: '900',
  },

  syncButton: {
    padding: 16,
    alignItems: 'center',
  },

  syncText: {
    color: COLORS.lightBlue,
    fontWeight: '800',
  },

  footer: {
    color: '#586D85',
    textAlign: 'center',
    fontSize: 10,
    marginTop: 10,
  },

  back: {
    width: 44,
    height: 44,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  backText: {
    color: COLORS.white,
    fontSize: 34,
  },

  title: {
    color: COLORS.white,
    fontSize: 29,
    fontWeight: '900',
  },

  subtitle: {
    color: COLORS.muted,
    marginTop: 5,
    marginBottom: 14,
  },

  modeBadge: {
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },

  modeBadgeNew: {
    backgroundColor: '#123B30',
  },

  modeBadgeEdit: {
    backgroundColor: '#3B2D18',
  },

  modeBadgeText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 10,
  },

  monthBox: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },

  arrow: {
    color: COLORS.white,
    fontSize: 34,
    paddingHorizontal: 15,
  },

  month: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 20,
    textAlign: 'center',
  },

  year: {
    color: COLORS.muted,
    textAlign: 'center',
  },

  calendar: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 10,
  },

  week: {
    flexDirection: 'row',
  },

  weekText: {
    width: '14.285%',
    textAlign: 'center',
    color: COLORS.muted,
    fontWeight: '900',
    paddingVertical: 7,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  calendarDay: {
    width: '14.285%',
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },

  calendarDayActive: {
    backgroundColor: '#173C5D',
    borderRadius: 12,
  },

  calendarNumber: {
    color: COLORS.muted,
  },

  calendarNumberActive: {
    color: COLORS.white,
    fontWeight: '900',
  },

  code: {
    color: COLORS.lightBlue,
    fontSize: 9,
    fontWeight: '900',
    marginTop: 3,
  },

  stats: {
    flexDirection: 'row',
    marginTop: 14,
  },

  stat: {
    flex: 1,
    backgroundColor: COLORS.card,
    marginHorizontal: 4,
    padding: 13,
    borderRadius: 14,
    alignItems: 'center',
  },

  statValue: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 18,
  },

  statLabel: {
    color: COLORS.muted,
    fontSize: 9,
  },

  label: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 7,
  },

  types: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 18,
  },

  type: {
    backgroundColor: COLORS.card,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 7,
  },

  typeSelected: {
    backgroundColor: COLORS.blue,
  },

  typeText: {
    color: COLORS.muted,
    fontWeight: '800',
  },

  typeTextSelected: {
    color: COLORS.white,
  },

  quickRow: {
    flexDirection: 'row',
    marginBottom: 18,
  },

  quick: {
    flex: 1,
    backgroundColor: '#19334F',
    padding: 13,
    marginHorizontal: 3,
    borderRadius: 13,
    alignItems: 'center',
  },

  quickText: {
    color: COLORS.white,
    fontWeight: '900',
  },

  row: {
    flexDirection: 'row',
  },

  half: {
    flex: 1,
  },

  fieldWrap: {
    marginBottom: 16,
  },

  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 15,
    color: COLORS.white,
  },

  restButton: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 15,
    marginBottom: 10,
  },

  restButtonOn: {
    backgroundColor: '#173C5D',
  },

  restText: {
    color: COLORS.white,
    fontWeight: '800',
  },

  deleteButton: {
    padding: 17,
    alignItems: 'center',
  },

  deleteText: {
    color: COLORS.red,
  },

  empty: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
  },

  emptyTitle: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 17,
  },

  emptyText: {
    color: COLORS.muted,
    marginTop: 5,
    textAlign: 'center',
  },

  turnCard: {
    backgroundColor: COLORS.card,
    borderRadius: 17,
    padding: 13,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },

  dayBadge: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#193653',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  dayBig: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '900',
  },

  turnTitle: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 16,
  },

  turnSub: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 4,
  },
});