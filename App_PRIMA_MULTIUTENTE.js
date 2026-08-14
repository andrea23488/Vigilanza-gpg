import LoginScreen from './LoginScreen';
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
  Image,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';

import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL;

const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const PROFILE_STORAGE_KEY =
  '@vigilanza_gpg_profile';

const PHOTO_STORAGE_KEY =
  '@vigilanza_gpg_profile_photo';

const COLORS = {
  bg: '#07111F',
  card: '#101C2D',
  border: '#203550',
  white: '#FFFFFF',
  muted: '#91A3BA',
  blue: '#168BFF',
  lightBlue: '#55B8FF',
  red: '#FF6B6B',
  green: '#50D89F',
  orange: '#FFAE57',
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

const PROFILO_DEFAULT = {
  nome: 'Andrea',
  cognome: 'Ischiboni',
  azienda: 'Italpol',
  ruolo: 'Guardia Particolare Giurata',
  sede: 'Roma',
};

export default function App() {
 const [accessoTest, setAccessoTest] = useState(false);
  const [screen, setScreen] =
    useState('home');

  const [mese, setMese] =
    useState(7);

  const [anno, setAnno] =
    useState(2026);

  const [turni, setTurni] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [editingId, setEditingId] =
    useState(null);

  const [giorno, setGiorno] =
    useState(1);

  const [tipo, setTipo] =
    useState('turno');

  const [inizio, setInizio] =
    useState('06:00');

  const [fine, setFine] =
    useState('14:00');

  const [luogo, setLuogo] =
    useState('Fiumicino');

  const [extra, setExtra] =
    useState('1');

  const [
    riposoLavorato,
    setRiposoLavorato,
  ] = useState(false);

  const [profilo, setProfilo] =
    useState(PROFILO_DEFAULT);

  const [
    fotoProfilo,
    setFotoProfilo,
  ] = useState(null);

  const [
    nomeDraft,
    setNomeDraft,
  ] = useState(
    PROFILO_DEFAULT.nome
  );

  const [
    cognomeDraft,
    setCognomeDraft,
  ] = useState(
    PROFILO_DEFAULT.cognome
  );

  const [
    aziendaDraft,
    setAziendaDraft,
  ] = useState(
    PROFILO_DEFAULT.azienda
  );

  const [
    ruoloDraft,
    setRuoloDraft,
  ] = useState(
    PROFILO_DEFAULT.ruolo
  );

  const [
    sedeDraft,
    setSedeDraft,
  ] = useState(
    PROFILO_DEFAULT.sede
  );

  useEffect(() => {
    inizializzaApp();
  }, []);

  async function inizializzaApp() {
    try {
      setLoading(true);

      await caricaProfiloLocale();

      await caricaTurni(false);
    } catch (error) {
      console.log(
        'ERRORE INIZIALIZZAZIONE:',
        error
      );
    } finally {
      setLoading(false);
    }
  }

  async function caricaProfiloLocale() {
    try {
      const [
        profiloSalvato,
        fotoSalvata,
      ] = await Promise.all([
        AsyncStorage.getItem(
          PROFILE_STORAGE_KEY
        ),

        AsyncStorage.getItem(
          PHOTO_STORAGE_KEY
        ),
      ]);

      if (profiloSalvato) {
        const dati =
          JSON.parse(profiloSalvato);

        const nuovoProfilo = {
          ...PROFILO_DEFAULT,
          ...dati,
        };

        setProfilo(
          nuovoProfilo
        );

        setNomeDraft(
          nuovoProfilo.nome
        );

        setCognomeDraft(
          nuovoProfilo.cognome
        );

        setAziendaDraft(
          nuovoProfilo.azienda
        );

        setRuoloDraft(
          nuovoProfilo.ruolo
        );

        setSedeDraft(
          nuovoProfilo.sede
        );
      }

      if (fotoSalvata) {
        setFotoProfilo(
          fotoSalvata
        );
      }
    } catch (error) {
      console.log(
        'ERRORE PROFILO LOCALE:',
        error
      );
    }
  }

  function headersJSON() {
    return {
      apikey:
        SUPABASE_KEY,

      'Content-Type':
        'application/json',
    };
  }

  async function caricaTurni(
    mostraLoading = true
  ) {
    try {
      if (mostraLoading) {
        setLoading(true);
      }

      const response =
        await fetch(
          `${SUPABASE_URL}/rest/v1/turni?select=*&order=anno.asc,mese.asc,giorno.asc`,
          {
            method: 'GET',

            headers: {
              apikey:
                SUPABASE_KEY,
            },
          }
        );

      const testo =
        await response.text();

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${testo}`
        );
      }

      const dati =
        testo
          ? JSON.parse(testo)
          : [];

      const lista =
        Array.isArray(dati)
          ? dati
          : [];

      setTurni(lista);

      return lista;
    } catch (error) {
      console.log(
        'ERRORE LETTURA:',
        error
      );

      Alert.alert(
        'Errore database',
        error.message ||
          'Impossibile leggere i turni.'
      );

      return [];
    } finally {
      if (mostraLoading) {
        setLoading(false);
      }
    }
  }

  const turniMese =
    useMemo(() => {
      return turni.filter(
        (t) =>
          Number(t.mese) ===
            mese + 1 &&
          Number(t.anno) ===
            anno
      );
    }, [
      turni,
      mese,
      anno,
    ]);

  const statistiche =
    useMemo(() => {
      let ore = 0;
      let extraOre = 0;
      let notti = 0;
      let giorni = 0;

      turniMese.forEach(
        (t) => {
          if (
            t.tipo ===
            'turno'
          ) {
            ore += Number(
              t.ore || 0
            );

            extraOre +=
              Number(
                t.extra || 0
              );

            giorni += 1;

            if (
              t.fascia ===
              'Notte'
            ) {
              notti += 1;
            }
          }
        }
      );

      return {
        ore,
        extraOre,
        notti,
        giorni,
      };
    }, [turniMese]);

  const iniziali =
    useMemo(() => {
      const n =
        profilo.nome
          ?.trim()
          ?.charAt(0) || '';

      const c =
        profilo.cognome
          ?.trim()
          ?.charAt(0) || '';

      return (
        `${n}${c}`.toUpperCase() ||
        'GPG'
      );
    }, [profilo]);

  function calcolaOre(
    start,
    end
  ) {
    if (
      !start ||
      !end
    ) {
      return 0;
    }

    const [h1, m1] =
      start
        .split(':')
        .map(Number);

    const [h2, m2] =
      end
        .split(':')
        .map(Number);

    if (
      [
        h1,
        m1,
        h2,
        m2,
      ].some(Number.isNaN)
    ) {
      return 0;
    }

    let a =
      h1 * 60 + m1;

    let b =
      h2 * 60 + m2;

    if (b <= a) {
      b += 1440;
    }

    return (
      (b - a) / 60
    );
  }

  function fasciaTurno(
    orario
  ) {
    if (!orario) {
      return null;
    }

    const h =
      Number(
        orario
          .split(':')[0]
      );

    if (
      h >= 21 ||
      h < 5
    ) {
      return 'Notte';
    }

    if (
      h >= 5 &&
      h < 13
    ) {
      return 'Mattina';
    }

    return 'Pomeriggio';
  }

  function turnoRapido(
    start,
    end
  ) {
    setInizio(start);
    setFine(end);

    const ore =
      calcolaOre(
        start,
        end
      );

    setExtra(
      String(
        Math.max(
          0,
          ore - 7
        )
      )
    );
  }

  function nuovoGiorno(
    g
  ) {
    setEditingId(null);

    setGiorno(
      Number(g)
    );

    setTipo('turno');

    setInizio(
      '06:00'
    );

    setFine(
      '14:00'
    );

    setLuogo(
      'Fiumicino'
    );

    setExtra('1');

    setRiposoLavorato(
      false
    );

    setScreen('edit');
  }

  function modificaGiorno(
    record
  ) {
    if (
      !record ||
      record.id ===
        undefined ||
      record.id === null
    ) {
      return;
    }

    setEditingId(
      record.id
    );

    setGiorno(
      Number(
        record.giorno
      )
    );

    setTipo(
      record.tipo ||
        'turno'
    );

    setInizio(
      record.inizio ||
        '06:00'
    );

    setFine(
      record.fine ||
        '14:00'
    );

    setLuogo(
      record.luogo ||
        ''
    );

    setExtra(
      String(
        record.extra ||
          0
      )
    );

    setRiposoLavorato(
      record.riposo_lavorato ===
        true
    );

    setScreen('edit');
  }

  function creaPayload() {
    const ore =
      tipo === 'turno'
        ? calcolaOre(
            inizio,
            fine
          )
        : 0;

    const extraNumero =
      Number(
        String(extra)
          .replace(
            ',',
            '.'
          )
      );

    return {
      giorno:
        Number(giorno),

      mese:
        mese + 1,

      anno:
        Number(anno),

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
          ? luogo ||
            'Servizio'
          : null,

      ore,

      extra:
        tipo === 'turno' &&
        !Number.isNaN(
          extraNumero
        )
          ? extraNumero
          : 0,

      fascia:
        tipo === 'turno'
          ? fasciaTurno(
              inizio
            )
          : null,

      riposo_lavorato:
        tipo === 'turno'
          ? riposoLavorato
          : false,
    };
  }

  async function inserisciTurno(
    payload
  ) {
    const response =
      await fetch(
        `${SUPABASE_URL}/rest/v1/turni`,
        {
          method:
            'POST',

          headers: {
            ...headersJSON(),

            Prefer:
              'return=representation',
          },

          body:
            JSON.stringify(
              payload
            ),
        }
      );

    const testo =
      await response.text();

    console.log(
      'POST STATUS:',
      response.status
    );

    if (
      !response.ok
    ) {
      throw new Error(
        `HTTP ${response.status}: ${
          testo ||
          'Errore POST'
        }`
      );
    }

    const righe =
      testo
        ? JSON.parse(
            testo
          )
        : [];

    if (
      !Array.isArray(
        righe
      ) ||
      righe.length ===
        0
    ) {
      throw new Error(
        'Supabase non ha restituito la nuova giornata.'
      );
    }

    return righe[0];
  }

  async function aggiornaTurno(
    id,
    payload
  ) {
    const response =
      await fetch(
        `${SUPABASE_URL}/rest/v1/turni?id=eq.${id}`,
        {
          method:
            'PATCH',

          headers: {
            ...headersJSON(),

            Prefer:
              'return=representation',
          },

          body:
            JSON.stringify(
              payload
            ),
        }
      );

    const testo =
      await response.text();

    if (
      !response.ok
    ) {
      throw new Error(
        `HTTP ${response.status}: ${
          testo ||
          'Errore PATCH'
        }`
      );
    }

    const righe =
      testo
        ? JSON.parse(
            testo
          )
        : [];

    if (
      !Array.isArray(
        righe
      ) ||
      righe.length ===
        0
    ) {
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

      const payload =
        creaPayload();

      if (
        tipo ===
          'turno' &&
        Number(
          payload.ore
        ) <= 0
      ) {
        Alert.alert(
          'Controlla il turno',
          'Gli orari inseriti non sono validi.'
        );

        return;
      }

      let salvato =
        null;

      if (
        editingId ===
          null ||
        editingId ===
          undefined
      ) {
        salvato =
          await inserisciTurno(
            payload
          );
      } else {
        salvato =
          await aggiornaTurno(
            editingId,
            payload
          );
      }

      if (
        !salvato ||
        salvato.id ===
          undefined
      ) {
        throw new Error(
          'La giornata non è stata restituita correttamente dal database.'
        );
      }

      setTurni(
        (
          precedenti
        ) => {
          const senza =
            precedenti.filter(
              (t) =>
                Number(
                  t.id
                ) !==
                Number(
                  salvato.id
                )
            );

          return [
            ...senza,
            salvato,
          ];
        }
      );

      await caricaTurni(
        false
      );

      setEditingId(
        null
      );

      Alert.alert(
        'Salvato ✅',
        'La giornata è stata salvata nel database.',
        [
          {
            text: 'OK',

            onPress:
              () => {
                setScreen(
                  'calendar'
                );
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
      editingId ===
        null ||
      editingId ===
        undefined
    ) {
      return;
    }

    Alert.alert(
      'Elimina giornata',
      'Vuoi davvero eliminare questa giornata?',
      [
        {
          text:
            'Annulla',

          style:
            'cancel',
        },

        {
          text:
            'Elimina',

          style:
            'destructive',

          onPress:
            eliminaGiornata,
        },
      ]
    );
  }

  async function eliminaGiornata() {
    if (
      editingId ===
        null ||
      editingId ===
        undefined
    ) {
      return;
    }

    try {
      setSaving(true);

      const id =
        editingId;

      const response =
        await fetch(
          `${SUPABASE_URL}/rest/v1/turni?id=eq.${id}`,
          {
            method:
              'DELETE',

            headers: {
              apikey:
                SUPABASE_KEY,
            },
          }
        );

      const testo =
        await response.text();

      if (
        !response.ok
      ) {
        throw new Error(
          `HTTP ${response.status}: ${
            testo ||
            'Errore DELETE'
          }`
        );
      }

      setTurni(
        (
          precedenti
        ) =>
          precedenti.filter(
            (t) =>
              Number(
                t.id
              ) !==
              Number(id)
          )
      );

      setEditingId(
        null
      );

      await caricaTurni(
        false
      );

      setScreen(
        'calendar'
      );
    } catch (error) {
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

    if (
      mese === 0
    ) {
      setMese(11);

      setAnno(
        (a) =>
          a - 1
      );
    } else {
      setMese(
        (m) =>
          m - 1
      );
    }
  }

  function meseSuccessivo() {
    setEditingId(null);

    if (
      mese === 11
    ) {
      setMese(0);

      setAnno(
        (a) =>
          a + 1
      );
    } else {
      setMese(
        (m) =>
          m + 1
      );
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

  function apriProfilo() {
    setNomeDraft(
      profilo.nome
    );

    setCognomeDraft(
      profilo.cognome
    );

    setAziendaDraft(
      profilo.azienda
    );

    setRuoloDraft(
      profilo.ruolo
    );

    setSedeDraft(
      profilo.sede
    );

    setScreen(
      'profile'
    );
  }

  async function salvaProfilo() {
    try {
      const nuovoProfilo = {
        nome:
          nomeDraft.trim() ||
          'Utente',

        cognome:
          cognomeDraft.trim(),

        azienda:
          aziendaDraft.trim() ||
          'Azienda non indicata',

        ruolo:
          ruoloDraft.trim() ||
          'Operatore',

        sede:
          sedeDraft.trim(),
      };

      await AsyncStorage.setItem(
        PROFILE_STORAGE_KEY,
        JSON.stringify(
          nuovoProfilo
        )
      );

      if (fotoProfilo) {
        await AsyncStorage.setItem(
          PHOTO_STORAGE_KEY,
          fotoProfilo
        );
      } else {
        await AsyncStorage.removeItem(
          PHOTO_STORAGE_KEY
        );
      }

      setProfilo(
        nuovoProfilo
      );

      Alert.alert(
        'Profilo salvato ✅',
        'Il profilo resterà memorizzato anche dopo la chiusura dell’app.',
        [
          {
            text: 'OK',

            onPress:
              () =>
                setScreen(
                  'home'
                ),
          },
        ]
      );
    } catch (error) {
      console.log(
        'ERRORE SALVATAGGIO PROFILO:',
        error
      );

      Alert.alert(
        'Errore',
        'Non sono riuscito a salvare il profilo sul dispositivo.'
      );
    }
  }

  async function scegliFotoProfilo() {
    try {
      const permesso =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (
        !permesso.granted
      ) {
        Alert.alert(
          'Permesso necessario',
          'Per scegliere una foto devi consentire l’accesso alla libreria fotografica.'
        );

        return;
      }

      const risultato =
        await ImagePicker.launchImageLibraryAsync(
          {
            mediaTypes: [
              'images',
            ],

            allowsEditing:
              true,

            aspect: [
              1,
              1,
            ],

            quality:
              0.8,
          }
        );

      if (
        !risultato.canceled
      ) {
        const uri =
          risultato
            .assets?.[0]
            ?.uri;

        if (uri) {
          setFotoProfilo(
            uri
          );

          await AsyncStorage.setItem(
            PHOTO_STORAGE_KEY,
            uri
          );
        }
      }
    } catch (error) {
      console.log(
        'ERRORE FOTO:',
        error
      );

      Alert.alert(
        'Errore',
        'Non sono riuscito ad aprire la libreria fotografica.'
      );
    }
  }

  function rimuoviFotoProfilo() {
    Alert.alert(
      'Rimuovi foto',
      'Vuoi tornare alle iniziali?',
      [
        {
          text:
            'Annulla',

          style:
            'cancel',
        },

        {
          text:
            'Rimuovi',

          style:
            'destructive',

          onPress:
            async () => {
              setFotoProfilo(
                null
              );

              await AsyncStorage.removeItem(
                PHOTO_STORAGE_KEY
              );
            },
        },
      ]
    );
  }

 if (!accessoTest) return<LoginScreen onEnterTest={() => setAccessoTest(true)} />;
  if (loading) {
    return (
      <SafeAreaView
        style={
          styles.loading
        }
      >
        <ActivityIndicator
          size="large"
          color={
            COLORS.blue
          }
        />

        <Text
          style={
            styles.loadingText
          }
        >
          Caricamento Vigilanza GPG...
        </Text>
      </SafeAreaView>
    );
  }

  if (
    screen ===
    'profile'
  ) {
    return (
      <Screen>
        <Back
          onPress={() =>
            setScreen(
              'home'
            )
          }
        />

        <Text
          style={
            styles.title
          }
        >
          Il mio profilo
        </Text>

        <Text
          style={
            styles.subtitle
          }
        >
          Identità professionale
        </Text>

        <View
          style={
            styles.profileHero
          }
        >
          <TouchableOpacity
            style={
              styles.profileAvatar
            }
            onPress={
              scegliFotoProfilo
            }
          >
            {fotoProfilo ? (
              <Image
                source={{
                  uri:
                    fotoProfilo,
                }}
                style={
                  styles.profileAvatarImage
                }
              />
            ) : (
              <Text
                style={
                  styles.profileAvatarText
                }
              >
                {iniziali}
              </Text>
            )}

            <View
              style={
                styles.cameraBadge
              }
            >
              <Text
                style={
                  styles.cameraBadgeText
                }
              >
                📷
              </Text>
            </View>
          </TouchableOpacity>

          <Text
            style={
              styles.photoHint
            }
          >
            Tocca per scegliere la foto
          </Text>

          <Text
            style={
              styles.profileName
            }
          >
            {profilo.nome}{' '}
            {profilo.cognome}
          </Text>

          <Text
            style={
              styles.profileRole
            }
          >
            {profilo.ruolo}
          </Text>

          <View
            style={
              styles.companyBadge
            }
          >
            <Text
              style={
                styles.companyBadgeText
              }
            >
              {profilo.azienda}
            </Text>
          </View>
        </View>

        <Text
          style={
            styles.profileSectionTitle
          }
        >
          DATI PERSONALI
        </Text>

        <Field
          label="NOME"
          value={
            nomeDraft
          }
          onChange={
            setNomeDraft
          }
        />

        <Field
          label="COGNOME"
          value={
            cognomeDraft
          }
          onChange={
            setCognomeDraft
          }
        />

        <Text
          style={
            styles.profileSectionTitle
          }
        >
          AZIENDA
        </Text>

        <Field
          label="AZIENDA"
          value={
            aziendaDraft
          }
          onChange={
            setAziendaDraft
          }
        />

        <Text
          style={
            styles.profileSectionTitle
          }
        >
          RUOLO
        </Text>

        <View
          style={
            styles.roleRow
          }
        >
          <TouchableOpacity
            style={[
              styles.roleButton,

              ruoloDraft ===
                'Guardia Particolare Giurata' &&
                styles.roleButtonActive,
            ]}
            onPress={() =>
              setRuoloDraft(
                'Guardia Particolare Giurata'
              )
            }
          >
            <Text
              style={[
                styles.roleButtonText,

                ruoloDraft ===
                  'Guardia Particolare Giurata' &&
                  styles.roleButtonTextActive,
              ]}
            >
              👮🏻‍♂️ GPG
            </Text>

            <Text
              style={
                styles.roleDescription
              }
            >
              Guardia Particolare Giurata
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.roleButton,

              ruoloDraft ===
                'Operatore Fiduciario' &&
                styles.roleButtonActive,
            ]}
            onPress={() =>
              setRuoloDraft(
                'Operatore Fiduciario'
              )
            }
          >
            <Text
              style={[
                styles.roleButtonText,

                ruoloDraft ===
                  'Operatore Fiduciario' &&
                  styles.roleButtonTextActive,
              ]}
            >
              🛡️ Fiduciario
            </Text>

            <Text
              style={
                styles.roleDescription
              }
            >
              Servizi fiduciari
            </Text>
          </TouchableOpacity>
        </View>

        <Field
          label="SEDE / ZONA"
          value={
            sedeDraft
          }
          onChange={
            setSedeDraft
          }
        />

        <TouchableOpacity
          style={
            styles.saveButton
          }
          onPress={
            salvaProfilo
          }
        >
          <Text
            style={
              styles.saveText
            }
          >
            SALVA PROFILO
          </Text>
        </TouchableOpacity>

        {fotoProfilo && (
          <TouchableOpacity
            style={
              styles.removePhotoButton
            }
            onPress={
              rimuoviFotoProfilo
            }
          >
            <Text
              style={
                styles.removePhotoText
              }
            >
              Rimuovi foto profilo
            </Text>
          </TouchableOpacity>
        )}

        <View
          style={
            styles.savedBox
          }
        >
          <Text
            style={
              styles.savedBoxTitle
            }
          >
            ✓ Profilo locale
          </Text>

          <Text
            style={
              styles.savedBoxText
            }
          >
            Nome, azienda, ruolo, sede e foto vengono memorizzati sul dispositivo.
          </Text>
        </View>
      </Screen>
    );
  }

  if (
    screen ===
    'calendar'
  ) {
    return (
      <Screen>
        <Back
          onPress={
            tornaHome
          }
        />

        <Text
          style={
            styles.title
          }
        >
          Calendario
        </Text>

        <Text
          style={
            styles.subtitle
          }
        >
          Tocca un giorno per inserire il servizio
        </Text>

        <View
          style={
            styles.monthBox
          }
        >
          <TouchableOpacity
            onPress={
              mesePrecedente
            }
          >
            <Text
              style={
                styles.arrow
              }
            >
              ‹
            </Text>
          </TouchableOpacity>

          <View>
            <Text
              style={
                styles.month
              }
            >
              {MESI[mese]}
            </Text>

            <Text
              style={
                styles.year
              }
            >
              {anno}
            </Text>
          </View>

          <TouchableOpacity
            onPress={
              meseSuccessivo
            }
          >
            <Text
              style={
                styles.arrow
              }
            >
              ›
            </Text>
          </TouchableOpacity>
        </View>

        <Calendar
          anno={
            anno
          }
          mese={
            mese
          }
          records={
            turniMese
          }
          onPress={(
            g,
            record
          ) => {
            if (
              record &&
              record.id !==
                undefined &&
              record.id !==
                null
            ) {
              modificaGiorno(
                record
              );
            } else {
              nuovoGiorno(
                g
              );
            }
          }}
        />

        <View
          style={
            styles.stats
          }
        >
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
          style={
            styles.syncButton
          }
          onPress={() =>
            caricaTurni()
          }
        >
          <Text
            style={
              styles.syncText
            }
          >
            ↻ Aggiorna calendario
          </Text>
        </TouchableOpacity>
      </Screen>
    );
  }

  if (
    screen ===
    'edit'
  ) {
    const modifica =
      editingId !==
        null &&
      editingId !==
        undefined;

    return (
      <Screen>
        <Back
          onPress={
            tornaCalendario
          }
        />

        <Text
          style={
            styles.title
          }
        >
          {modifica
            ? 'Modifica giornata'
            : 'Nuova giornata'}
        </Text>

        <Text
          style={
            styles.subtitle
          }
        >
          {giorno}{' '}
          {MESI[mese]}{' '}
          {anno}
        </Text>

        <View
          style={[
            styles.modeBadge,

            modifica
              ? styles.modeBadgeEdit
              : styles.modeBadgeNew,
          ]}
        >
          <Text
            style={
              styles.modeBadgeText
            }
          >
            {modifica
              ? 'MODIFICA TURNO ESISTENTE'
              : 'NUOVO TURNO'}
          </Text>
        </View>

        <Text
          style={
            styles.label
          }
        >
          TIPO GIORNATA
        </Text>

        <View
          style={
            styles.types
          }
        >
          {[
            [
              'turno',
              'Turno',
            ],

            [
              'riposo',
              'Riposo',
            ],

            [
              'ferie',
              'Ferie',
            ],

            [
              'malattia',
              'Malattia',
            ],

            [
              'permesso',
              'Permesso',
            ],
          ].map(
            ([
              id,
              nome,
            ]) => (
              <TouchableOpacity
                key={
                  id
                }
                style={[
                  styles.type,

                  tipo ===
                    id &&
                    styles.typeSelected,
                ]}
                onPress={() =>
                  setTipo(
                    id
                  )
                }
              >
                <Text
                  style={[
                    styles.typeText,

                    tipo ===
                      id &&
                      styles.typeTextSelected,
                  ]}
                >
                  {nome}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>

        {tipo ===
          'turno' && (
          <>
            <Text
              style={
                styles.label
              }
            >
              TURNO RAPIDO
            </Text>

            <View
              style={
                styles.quickRow
              }
            >
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

            <View
              style={
                styles.row
              }
            >
              <View
                style={
                  styles.half
                }
              >
                <Field
                  label="INIZIO"
                  value={
                    inizio
                  }
                  onChange={
                    setInizio
                  }
                />
              </View>

              <View
                style={{
                  width:
                    10,
                }}
              />

              <View
                style={
                  styles.half
                }
              >
                <Field
                  label="FINE"
                  value={
                    fine
                  }
                  onChange={
                    setFine
                  }
                />
              </View>
            </View>

            <Field
              label="POSTAZIONE"
              value={
                luogo
              }
              onChange={
                setLuogo
              }
            />

            <Field
              label="ORE STRAORDINARIE"
              value={
                extra
              }
              onChange={
                setExtra
              }
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
              <Text
                style={
                  styles.restText
                }
              >
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
          onPress={
            salvaGiornata
          }
          disabled={
            saving
          }
        >
          {saving ? (
            <ActivityIndicator
              color="#FFFFFF"
            />
          ) : (
            <Text
              style={
                styles.saveText
              }
            >
              {modifica
                ? 'SALVA MODIFICHE'
                : 'SALVA NUOVA GIORNATA'}
            </Text>
          )}
        </TouchableOpacity>

        {modifica && (
          <TouchableOpacity
            style={
              styles.deleteButton
            }
            onPress={
              confermaEliminazione
            }
          >
            <Text
              style={
                styles.deleteText
              }
            >
              Elimina giornata
            </Text>
          </TouchableOpacity>
        )}
      </Screen>
    );
  }

  if (
    screen ===
    'turni'
  ) {
    const ordinati =
      [
        ...turniMese,
      ].sort(
        (a, b) =>
          Number(
            a.giorno
          ) -
          Number(
            b.giorno
          )
      );

    return (
      <Screen>
        <Back
          onPress={
            tornaHome
          }
        />

        <Text
          style={
            styles.title
          }
        >
          I miei turni
        </Text>

        <Text
          style={
            styles.subtitle
          }
        >
          {MESI[mese]}{' '}
          {anno}
        </Text>

        {ordinati.length ===
        0 ? (
          <View
            style={
              styles.empty
            }
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              Nessun turno inserito
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Inserisci la prima giornata dal calendario.
            </Text>
          </View>
        ) : (
          ordinati.map(
            (t) => (
              <TouchableOpacity
                key={String(
                  t.id
                )}
                style={
                  styles.turnCard
                }
                onPress={() =>
                  modificaGiorno(
                    t
                  )
                }
              >
                <View
                  style={
                    styles.dayBadge
                  }
                >
                  <Text
                    style={
                      styles.dayBig
                    }
                  >
                    {t.giorno}
                  </Text>
                </View>

                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Text
                    style={
                      styles.turnTitle
                    }
                  >
                    {t.tipo ===
                    'turno'
                      ? `${formattaOra(
                          t.inizio
                        )} — ${formattaOra(
                          t.fine
                        )}`
                      : nomeTipo(
                          t.tipo
                        )}
                  </Text>

                  <Text
                    style={
                      styles.turnSub
                    }
                  >
                    {t.tipo ===
                    'turno'
                      ? `${t.fascia || ''} • ${t.luogo || ''}`
                      : 'Giornata non lavorata'}
                  </Text>
                </View>
              </TouchableOpacity>
            )
          )
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <View
        style={
          styles.header
        }
      >
        <TouchableOpacity
          style={{
            flex: 1,
          }}
          onPress={
            apriProfilo
          }
        >
          <Text
            style={
              styles.welcome
            }
          >
            Buon servizio,{' '}
            {profilo.nome} 👋
          </Text>

          <Text
            style={
              styles.company
            }
          >
            {profilo.azienda}{' '}
            •{' '}
            {profilo.ruolo}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={
            styles.avatar
          }
          onPress={
            apriProfilo
          }
        >
          {fotoProfilo ? (
            <Image
              source={{
                uri:
                  fotoProfilo,
              }}
              style={
                styles.avatarImage
              }
            />
          ) : (
            <Text
              style={
                styles.avatarText
              }
            >
              {iniziali}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View
        style={
          styles.hero
        }
      >
        <Text
          style={
            styles.heroSmall
          }
        >
          QUESTO MESE
        </Text>

        <Text
          style={
            styles.heroMonth
          }
        >
          {MESI[mese]}{' '}
          {anno}
        </Text>

        <View
          style={
            styles.heroStats
          }
        >
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

      <Text
        style={
          styles.section
        }
      >
        Il tuo servizio
      </Text>

      <Menu
        icon="📅"
        title="I miei turni"
        subtitle="Elenco servizi e riposi"
        onPress={() => {
          setEditingId(
            null
          );

          setScreen(
            'turni'
          );
        }}
      />

      <Menu
        icon="🗓️"
        title="Calendario"
        subtitle="Inserisci e modifica le giornate"
        onPress={() => {
          setEditingId(
            null
          );

          setScreen(
            'calendar'
          );
        }}
      />

      <Menu
        icon="👤"
        title="Il mio profilo"
        subtitle={`${profilo.azienda} • ${profilo.sede}`}
        onPress={
          apriProfilo
        }
      />

      <TouchableOpacity
        style={
          styles.saveButton
        }
        onPress={() => {
          setEditingId(
            null
          );

          setScreen(
            'calendar'
          );
        }}
      >
        <Text
          style={
            styles.saveText
          }
        >
          ＋ INSERISCI GIORNATA
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={
          styles.syncButton
        }
        onPress={() =>
          caricaTurni()
        }
      >
        <Text
          style={
            styles.syncText
          }
        >
          ↻ Sincronizza database
        </Text>
      </TouchableOpacity>

      <Text
        style={
          styles.footer
        }
      >
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
  const giorni =
    new Date(
      anno,
      mese + 1,
      0
    ).getDate();

  let primo =
    new Date(
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
    <View
      style={
        styles.calendar
      }
    >
      <View
        style={
          styles.week
        }
      >
        {[
          'L',
          'M',
          'M',
          'G',
          'V',
          'S',
          'D',
        ].map(
          (
            d,
            index
          ) => (
            <Text
              key={`week-${index}`}
              style={
                styles.weekText
              }
            >
              {d}
            </Text>
          )
        )}
      </View>

      <View
        style={
          styles.grid
        }
      >
        {celle.map(
          (
            day,
            index
          ) => {
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
                  Number(
                    day
                  )
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
                    record ||
                      null
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
                  <Text
                    style={
                      styles.code
                    }
                  >
                    {record.tipo ===
                    'turno'
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
                          .slice(
                            0,
                            3
                          )
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

function Screen({
  children,
}) {
  return (
    <SafeAreaView
      style={
        styles.safe
      }
    >
      <ScrollView
        style={
          styles.screen
        }
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

function Back({
  onPress,
}) {
  return (
    <TouchableOpacity
      style={
        styles.back
      }
      onPress={
        onPress
      }
    >
      <Text
        style={
          styles.backText
        }
      >
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
      style={
        styles.menu
      }
      onPress={
        onPress
      }
    >
      <Text
        style={
          styles.menuIcon
        }
      >
        {icon}
      </Text>

      <View
        style={{
          flex: 1,
        }}
      >
        <Text
          style={
            styles.menuTitle
          }
        >
          {title}
        </Text>

        <Text
          style={
            styles.menuSub
          }
        >
          {subtitle}
        </Text>
      </View>

      <Text
        style={
          styles.chevron
        }
      >
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
      style={
        styles.quick
      }
      onPress={
        onPress
      }
    >
      <Text
        style={
          styles.quickText
        }
      >
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
    <View
      style={
        styles.fieldWrap
      }
    >
      <Text
        style={
          styles.label
        }
      >
        {label}
      </Text>

      <TextInput
        style={
          styles.input
        }
        value={
          value
        }
        onChangeText={
          onChange
        }
        keyboardType={
          keyboardType
        }
        autoCorrect={
          false
        }
      />
    </View>
  );
}

function Stat({
  label,
  value,
}) {
  return (
    <View
      style={
        styles.stat
      }
    >
      <Text
        style={
          styles.statValue
        }
      >
        {value}
      </Text>

      <Text
        style={
          styles.statLabel
        }
      >
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
      <Text
        style={
          styles.homeValue
        }
      >
        {value}
      </Text>

      <Text
        style={
          styles.homeLabel
        }
      >
        {label}
      </Text>
    </View>
  );
}

function nomeTipo(
  tipo
) {
  if (
    tipo ===
    'riposo'
  ) {
    return 'Riposo';
  }

  if (
    tipo ===
    'ferie'
  ) {
    return 'Ferie';
  }

  if (
    tipo ===
    'malattia'
  ) {
    return 'Malattia';
  }

  if (
    tipo ===
    'permesso'
  ) {
    return 'Permesso';
  }

  return 'Turno';
}

function formattaOra(
  valore
) {
  if (!valore) {
    return '--:--';
  }

  return String(
    valore
  ).slice(
    0,
    5
  );
}

const styles =
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor:
        COLORS.bg,
    },

    screen: {
      flex: 1,
      backgroundColor:
        COLORS.bg,
    },

    content: {
      padding: 20,
      paddingBottom: 60,
    },

    loading: {
      flex: 1,
      backgroundColor:
        COLORS.bg,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    loadingText: {
      color:
        COLORS.muted,
      marginTop: 12,
    },

    disabled: {
      opacity: 0.6,
    },

    header: {
      flexDirection:
        'row',
      alignItems:
        'center',
      marginBottom: 24,
    },

    welcome: {
      color:
        COLORS.white,
      fontSize: 23,
      fontWeight:
        '900',
    },

    company: {
      color:
        COLORS.muted,
      fontSize: 11,
      marginTop: 5,
    },

    avatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor:
        COLORS.blue,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginLeft: 10,
      overflow:
        'hidden',
    },

    avatarText: {
      color:
        COLORS.white,
      fontWeight:
        '900',
    },

    avatarImage: {
      width: '100%',
      height: '100%',
    },

    hero: {
      backgroundColor:
        '#10304B',
      borderRadius: 24,
      padding: 22,
      marginBottom: 26,
    },

    heroSmall: {
      color:
        COLORS.lightBlue,
      fontSize: 11,
      fontWeight:
        '900',
    },

    heroMonth: {
      color:
        COLORS.white,
      fontSize: 28,
      fontWeight:
        '900',
      marginTop: 5,
    },

    heroStats: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      marginTop: 22,
    },

    homeValue: {
      color:
        COLORS.white,
      fontSize: 20,
      fontWeight:
        '900',
    },

    homeLabel: {
      color:
        COLORS.muted,
      fontSize: 11,
    },

    section: {
      color:
        COLORS.white,
      fontSize: 20,
      fontWeight:
        '900',
      marginBottom: 14,
    },

    menu: {
      backgroundColor:
        COLORS.card,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 18,
      padding: 15,
      flexDirection:
        'row',
      alignItems:
        'center',
      marginBottom: 10,
    },

    menuIcon: {
      fontSize: 24,
      marginRight: 14,
    },

    menuTitle: {
      color:
        COLORS.white,
      fontWeight:
        '900',
      fontSize: 16,
    },

    menuSub: {
      color:
        COLORS.muted,
      fontSize: 11,
      marginTop: 4,
    },

    chevron: {
      color:
        COLORS.muted,
      fontSize: 28,
    },

    saveButton: {
      backgroundColor:
        COLORS.blue,
      borderRadius: 17,
      padding: 17,
      alignItems:
        'center',
      marginTop: 12,
    },

    saveText: {
      color:
        COLORS.white,
      fontWeight:
        '900',
    },

    syncButton: {
      padding: 16,
      alignItems:
        'center',
    },

    syncText: {
      color:
        COLORS.lightBlue,
      fontWeight:
        '800',
    },

    footer: {
      color:
        '#586D85',
      textAlign:
        'center',
      fontSize: 10,
      marginTop: 10,
    },

    back: {
      width: 44,
      height: 44,
      backgroundColor:
        COLORS.card,
      borderRadius: 14,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginBottom: 18,
    },

    backText: {
      color:
        COLORS.white,
      fontSize: 34,
    },

    title: {
      color:
        COLORS.white,
      fontSize: 29,
      fontWeight:
        '900',
    },

    subtitle: {
      color:
        COLORS.muted,
      marginTop: 5,
      marginBottom: 14,
    },

    modeBadge: {
      borderRadius: 12,
      paddingVertical: 9,
      paddingHorizontal: 12,
      alignSelf:
        'flex-start',
      marginBottom: 20,
    },

    modeBadgeNew: {
      backgroundColor:
        '#123B30',
    },

    modeBadgeEdit: {
      backgroundColor:
        '#3B2D18',
    },

    modeBadgeText: {
      color:
        COLORS.white,
      fontWeight:
        '900',
      fontSize: 10,
    },

    monthBox: {
      backgroundColor:
        COLORS.card,
      borderRadius: 18,
      padding: 12,
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
      marginBottom: 14,
    },

    arrow: {
      color:
        COLORS.white,
      fontSize: 34,
      paddingHorizontal: 15,
    },

    month: {
      color:
        COLORS.white,
      fontWeight:
        '900',
      fontSize: 20,
      textAlign:
        'center',
    },

    year: {
      color:
        COLORS.muted,
      textAlign:
        'center',
    },

    calendar: {
      backgroundColor:
        COLORS.card,
      borderRadius: 20,
      padding: 10,
    },

    week: {
      flexDirection:
        'row',
    },

    weekText: {
      width:
        '14.285%',
      textAlign:
        'center',
      color:
        COLORS.muted,
      fontWeight:
        '900',
      paddingVertical: 7,
    },

    grid: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
    },

    calendarDay: {
      width:
        '14.285%',
      height: 62,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    calendarDayActive: {
      backgroundColor:
        '#173C5D',
      borderRadius: 12,
    },

    calendarNumber: {
      color:
        COLORS.muted,
    },

    calendarNumberActive: {
      color:
        COLORS.white,
      fontWeight:
        '900',
    },

    code: {
      color:
        COLORS.lightBlue,
      fontSize: 9,
      fontWeight:
        '900',
      marginTop: 3,
    },

    stats: {
      flexDirection:
        'row',
      marginTop: 14,
    },

    stat: {
      flex: 1,
      backgroundColor:
        COLORS.card,
      marginHorizontal: 4,
      padding: 13,
      borderRadius: 14,
      alignItems:
        'center',
    },

    statValue: {
      color:
        COLORS.white,
      fontWeight:
        '900',
      fontSize: 18,
    },

    statLabel: {
      color:
        COLORS.muted,
      fontSize: 9,
    },

    label: {
      color:
        COLORS.muted,
      fontSize: 10,
      fontWeight:
        '900',
      marginBottom: 7,
    },

    types: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      marginBottom: 18,
    },

    type: {
      backgroundColor:
        COLORS.card,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      marginRight: 6,
      marginBottom: 7,
    },

    typeSelected: {
      backgroundColor:
        COLORS.blue,
    },

    typeText: {
      color:
        COLORS.muted,
      fontWeight:
        '800',
    },

    typeTextSelected: {
      color:
        COLORS.white,
    },

    quickRow: {
      flexDirection:
        'row',
      marginBottom: 18,
    },

    quick: {
      flex: 1,
      backgroundColor:
        '#19334F',
      padding: 13,
      marginHorizontal: 3,
      borderRadius: 13,
      alignItems:
        'center',
    },

    quickText: {
      color:
        COLORS.white,
      fontWeight:
        '900',
    },

    row: {
      flexDirection:
        'row',
    },

    half: {
      flex: 1,
    },

    fieldWrap: {
      marginBottom: 16,
    },

    input: {
      backgroundColor:
        COLORS.card,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 14,
      padding: 15,
      color:
        COLORS.white,
    },

    restButton: {
      backgroundColor:
        COLORS.card,
      borderRadius: 14,
      padding: 15,
      marginBottom: 10,
    },

    restButtonOn: {
      backgroundColor:
        '#173C5D',
    },

    restText: {
      color:
        COLORS.white,
      fontWeight:
        '800',
    },

    deleteButton: {
      padding: 17,
      alignItems:
        'center',
    },

    deleteText: {
      color:
        COLORS.red,
    },

    empty: {
      backgroundColor:
        COLORS.card,
      borderRadius: 18,
      padding: 24,
      alignItems:
        'center',
    },

    emptyTitle: {
      color:
        COLORS.white,
      fontWeight:
        '900',
      fontSize: 17,
    },

    emptyText: {
      color:
        COLORS.muted,
      marginTop: 5,
      textAlign:
        'center',
    },

    turnCard: {
      backgroundColor:
        COLORS.card,
      borderRadius: 17,
      padding: 13,
      marginBottom: 9,
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    dayBadge: {
      width: 50,
      height: 50,
      borderRadius: 14,
      backgroundColor:
        '#193653',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 12,
    },

    dayBig: {
      color:
        COLORS.white,
      fontSize: 20,
      fontWeight:
        '900',
    },

    turnTitle: {
      color:
        COLORS.white,
      fontWeight:
        '900',
      fontSize: 16,
    },

    turnSub: {
      color:
        COLORS.muted,
      fontSize: 11,
      marginTop: 4,
    },

    profileHero: {
      backgroundColor:
        '#10304B',
      borderRadius: 24,
      padding: 24,
      alignItems:
        'center',
      marginBottom: 24,
    },

    profileAvatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor:
        COLORS.blue,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    profileAvatarImage: {
      width: 100,
      height: 100,
      borderRadius: 50,
    },

    profileAvatarText: {
      color:
        COLORS.white,
      fontSize: 30,
      fontWeight:
        '900',
    },

    cameraBadge: {
      position:
        'absolute',
      right: -3,
      bottom: 1,
      width: 31,
      height: 31,
      borderRadius: 16,
      backgroundColor:
        COLORS.card,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderWidth: 2,
      borderColor:
        '#10304B',
    },

    cameraBadgeText: {
      fontSize: 14,
    },

    photoHint: {
      color:
        COLORS.muted,
      fontSize: 10,
      marginTop: 9,
    },

    profileName: {
      color:
        COLORS.white,
      fontWeight:
        '900',
      fontSize: 23,
      marginTop: 12,
      textAlign:
        'center',
    },

    profileRole: {
      color:
        COLORS.muted,
      marginTop: 5,
      textAlign:
        'center',
    },

    companyBadge: {
      backgroundColor:
        '#173F61',
      borderRadius: 13,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginTop: 14,
    },

    companyBadgeText: {
      color:
        COLORS.lightBlue,
      fontWeight:
        '900',
    },

    profileSectionTitle: {
      color:
        COLORS.lightBlue,
      fontSize: 11,
      fontWeight:
        '900',
      marginTop: 6,
      marginBottom: 12,
    },

    roleRow: {
      flexDirection:
        'row',
      marginBottom: 18,
    },

    roleButton: {
      flex: 1,
      minHeight: 86,
      backgroundColor:
        COLORS.card,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 15,
      padding: 12,
      marginHorizontal: 4,
      justifyContent:
        'center',
      alignItems:
        'center',
    },

    roleButtonActive: {
      backgroundColor:
        '#123D60',
      borderColor:
        COLORS.blue,
      borderWidth: 2,
    },

    roleButtonText: {
      color:
        COLORS.muted,
      fontWeight:
        '900',
      fontSize: 12,
      textAlign:
        'center',
    },

    roleButtonTextActive: {
      color:
        COLORS.white,
    },

    roleDescription: {
      color:
        COLORS.muted,
      fontSize: 9,
      marginTop: 5,
      textAlign:
        'center',
    },

    removePhotoButton: {
      padding: 15,
      alignItems:
        'center',
    },

    removePhotoText: {
      color:
        COLORS.red,
      fontSize: 12,
    },

    savedBox: {
      backgroundColor:
        '#102A24',
      borderRadius: 15,
      padding: 14,
      marginTop: 15,
    },

    savedBoxTitle: {
      color:
        COLORS.green,
      fontWeight:
        '900',
      fontSize: 12,
    },

    savedBoxText: {
      color:
        COLORS.muted,
      fontSize: 10,
      marginTop: 5,
      lineHeight: 15,
    },
  });