import LoginScreen from './LoginScreen';
import {
  caricaMessaggi,
  inviaMessaggio,
  mioUserId,
  contaMessaggiNonLetti,
  segnaMessaggiComeLetti,
  ultimoMessaggioNonLetto,
  mittentiConMessaggiNonLetti,
} from './chatApi';
import { caricaTurniUtente, creaTurnoUtente, aggiornaTurnoUtente, eliminaTurnoUtente } from './turniApi';
import { supabase } from './supabase';
import { caricaProfiloUtente, salvaProfiloUtente, caricaFotoProfilo, eliminaFotoProfiloCloud } from './profiliApi';
import { caricaColleghi, aggiungiCollega, rimuoviCollega, accettaCollega, rifiutaCollega } from './colleghiApi';
import { caricaColleghiInServizio } from './servizioApi';
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
  const [screen, setScreen] = useState("home");
  const [stipendioCCNL, setStipendioCCNL] = useState('Vigilanza Privata e Servizi di Sicurezza');
  const [stipendioLivello, setStipendioLivello] = useState('');
  const [stipendioOreSettimanali, setStipendioOreSettimanali] = useState('40');
  const [stipendioNettoBase, setStipendioNettoBase] = useState('');
  const [chatMessaggio, setChatMessaggio] = useState('');
  const [chatMessaggi, setChatMessaggi] = useState([]);
  const [chatMioId, setChatMioId] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [messaggiNonLetti, setMessaggiNonLetti] = useState(0);
  const [mittentiNonLetti, setMittentiNonLetti] = useState([]);

  useEffect(() => {
    const controllaMessaggiNonLetti = async () => {
      try {
        const [quanti, ultimo] = await Promise.all([
          contaMessaggiNonLetti(),
          ultimoMessaggioNonLetto(),
        ]);

        setMessaggiNonLetti(quanti || 0);

        if (quanti > 0 && ultimo) {
          const anteprima =
            ultimo.testo.length > 70
              ? ultimo.testo.slice(0, 70) + '…'
              : ultimo.testo;

          Alert.alert(
            `💬 Nuovo messaggio da ${ultimo.nomeMittente}`,
            quanti > 1
              ? `${anteprima}\n\nHai ${quanti} messaggi non letti.`
              : anteprima
          );
        }
      } catch (error) {
        console.log(
          'Errore controllo messaggi non letti:',
          error
        );
      }
    };
    controllaMessaggiNonLetti();
  }, []);

  useEffect(() => {
    let attivo = true;

    const aggiornaBadgeMessaggi = async () => {
      try {
        const [quanti, mittenti] = await Promise.all([
          contaMessaggiNonLetti(),
          mittentiConMessaggiNonLetti(),
        ]);

        if (attivo) {
          setMessaggiNonLetti(quanti || 0);
          setMittentiNonLetti(mittenti || []);
        }
      } catch (error) {
        console.log('Errore aggiornamento badge messaggi:', error);
      }
    };

    aggiornaBadgeMessaggi();

    const timer = setInterval(
      aggiornaBadgeMessaggi,
      3000
    );

    return () => {
      attivo = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (screen !== 'chatCollega') return;

    const destinatarioId = collegaSelezionato?.altro_user_id;

    if (!destinatarioId) return;

    let attivo = true;

    const caricaChat = async () => {
      try {
        setChatLoading(true);

        const [id, messaggi] = await Promise.all([
          mioUserId(),
          caricaMessaggi(destinatarioId),
        ]);

        await segnaMessaggiComeLetti(destinatarioId);

        const [rimasti, mittentiRimasti] = await Promise.all([
          contaMessaggiNonLetti(),
          mittentiConMessaggiNonLetti(),
        ]);

        setMessaggiNonLetti(rimasti || 0);
        setMittentiNonLetti(mittentiRimasti || []);

        if (!attivo) return;

        setChatMioId(id);
        setChatMessaggi(messaggi);
      } catch (error) {
        Alert.alert(
          'Errore chat',
          error.message || 'Impossibile caricare i messaggi.'
        );
      } finally {
        if (attivo) {
          setChatLoading(false);
        }
      }
    };

    caricaChat();

    return () => {
      attivo = false;
    };
  }, [screen, collegaSelezionato?.altro_user_id]);

  useEffect(() => {
    const caricaConfigurazioneStipendio = async () => {
      try {
        const salvata = await AsyncStorage.getItem(
          '@vigilanza_gpg_stipendio'
        );

        if (!salvata) return;

        const dati = JSON.parse(salvata);

        if (dati.ccnl) {
          setStipendioCCNL(dati.ccnl);
        }

        if (dati.livello) {
          setStipendioLivello(String(dati.livello));
        }

        if (dati.oreSettimanali) {
          setStipendioOreSettimanali(
            String(dati.oreSettimanali)
          );
        }

        if (dati.nettoBase) {
          setStipendioNettoBase(
            String(dati.nettoBase)
          );
        }
      } catch (error) {
        console.log(
          'Errore caricamento configurazione stipendio:',
          error
        );
      }
    };

    caricaConfigurazioneStipendio();
  }, []);
  const [colleghi, setColleghi] = useState([]);
  const [colleghiInServizio, setColleghiInServizio] = useState([]);
  const [collegaSelezionato, setCollegaSelezionato] = useState(null);
  const [loadingServizio, setLoadingServizio] = useState(false);
  const [loadingColleghi, setLoadingColleghi] = useState(false);
  const [collegaIdDraft, setCollegaIdDraft] = useState("");

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

  async function aggiornaColleghiInServizioOggi() {
    try {
      setLoadingServizio(true);

      const oggi = new Date();
      const giornoOggi = oggi.getDate();
      const meseOggi = oggi.getMonth() + 1;
      const annoOggi = oggi.getFullYear();

      const lista = await caricaColleghiInServizio(
        giornoOggi,
        meseOggi,
        annoOggi
      );

      setColleghiInServizio(lista || []);
    } catch (error) {
      console.log("ERRORE COLLEGHI IN SERVIZIO:", error);
      setColleghiInServizio([]);
    } finally {
      setLoadingServizio(false);
    }
  }

  async function aggiornaColleghi() {
    try {
      setLoadingColleghi(true);
      const lista = await caricaColleghi();
      setColleghi(lista);
    } catch (error) {
      console.log("ERRORE COLLEGHI:", error);
    } finally {
      setLoadingColleghi(false);
    }
  }

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
      caricaProfiloLocale();
      aggiornaColleghiInServizioOggi();

    inizializzaApp();
  }, []);

  useEffect(() => {
    if (accessoTest) {
      caricaTurni(false);
      caricaProfiloLocale();
    }
  }, [accessoTest]);

  async function inizializzaApp() {
    try {
      setLoading(true);


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
      const profiloCloud = await caricaProfiloUtente();

      const nuovoProfilo = profiloCloud
        ? {
            nome: profiloCloud.nome || "",
            cognome: profiloCloud.cognome || "",
            azienda: profiloCloud.azienda || "",
            ruolo: profiloCloud.ruolo || "",
            sede: profiloCloud.sede || "",
            foto_url: profiloCloud.foto_url || null,
          }
        : {
            nome: "",
            cognome: "",
            azienda: "",
            ruolo: "",
            sede: "",
            foto_url: null,
          };

      setProfilo(nuovoProfilo);
      setNomeDraft(nuovoProfilo.nome);
      setCognomeDraft(nuovoProfilo.cognome);
      setAziendaDraft(nuovoProfilo.azienda);
      setRuoloDraft(nuovoProfilo.ruolo);
      setSedeDraft(nuovoProfilo.sede);
      setFotoProfilo(nuovoProfilo.foto_url);

      return nuovoProfilo;
    } catch (error) {
      console.log("ERRORE PROFILO CLOUD:", error);
    }
  }


  async function caricaTurni(mostraLoading = true) {
    try {
      if (mostraLoading) setLoading(true);
      const dati = await caricaTurniUtente();
      const lista = Array.isArray(dati) ? dati : [];
      setTurni(lista);
      return lista;
    } catch (error) {
      console.log("ERRORE LETTURA TURNI UTENTE:", error);
      if (error.message !== "Utente non autenticato.") {
        Alert.alert("Errore database", error.message || "Impossibile leggere i turni.");
      }
      setTurni([]);
      return [];
    } finally {
      if (mostraLoading) setLoading(false);
    }
  }
  const turniMese = useMemo(() => {
    return turni.filter(
      (t) =>
        Number(t.mese) === mese + 1 &&
        Number(t.anno) === anno
    );
  }, [
    turni,
    mese,
    anno,
  ]);

  const oggi = new Date();

  const turnoOggi = turniMese.find(
    (t) =>
      Number(t.giorno) === oggi.getDate() &&
      Number(t.mese) === oggi.getMonth() + 1 &&
      Number(t.anno) === oggi.getFullYear()
  );

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

  async function inserisciTurno(payload) {
    return await creaTurnoUtente(payload);
  }
  async function aggiornaTurno(id, payload) {
    return await aggiornaTurnoUtente(id, payload);
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
      undefined) {
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
    if (editingId === null || editingId === undefined) {
      return;
    }

    try {
      setSaving(true);
      const idDaEliminare = editingId;

      await eliminaTurnoUtente(idDaEliminare);

      setTurni((precedenti) =>
        precedenti.filter(
          (t) => Number(t.id) !== Number(idDaEliminare)
        )
      );

      setEditingId(null);
      await caricaTurni(false);
      setScreen("calendar");
    } catch (error) {
      console.log("ERRORE ELIMINAZIONE TURNO UTENTE:", error);
      Alert.alert(
        "Errore",
        error.message || "Eliminazione non riuscita."
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

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Errore", error.message);
      return;
    }
    setTurni([]);
    setAccessoTest(false);
    setScreen("home");
  }

  async function salvaProfilo() {
    try {
      const profiloDaSalvare = {
        nome: nomeDraft.trim(),
        cognome: cognomeDraft.trim(),
        azienda: aziendaDraft.trim(),
        ruolo: ruoloDraft.trim(),
        sede: sedeDraft.trim(),
      };

      const salvato = await salvaProfiloUtente(profiloDaSalvare);

      const nuovoProfilo = {
        nome: salvato.nome || "",
        cognome: salvato.cognome || "",
        azienda: salvato.azienda || "",
        ruolo: salvato.ruolo || "",
        sede: salvato.sede || "",
      };

      setProfilo(nuovoProfilo);
      setNomeDraft(nuovoProfilo.nome);
      setCognomeDraft(nuovoProfilo.cognome);
      setAziendaDraft(nuovoProfilo.azienda);
      setRuoloDraft(nuovoProfilo.ruolo);
      setSedeDraft(nuovoProfilo.sede);

      Alert.alert("Profilo salvato", "Il profilo è stato salvato sul tuo account.");
    } catch (error) {
      console.log("ERRORE SALVATAGGIO PROFILO CLOUD:", error);
      Alert.alert("Errore", error.message || "Impossibile salvare il profilo.");
    }
  }
  async function scegliFotoProfilo() {
    try {
      const permesso =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permesso.granted) {
        Alert.alert(
          "Permesso necessario",
          "Per scegliere una foto devi consentire l’accesso alla libreria fotografica."
        );
        return;
      }

      const risultato = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (risultato.canceled) {
        return;
      }

      const uriLocale = risultato.assets?.[0]?.uri;

      if (!uriLocale) {
        throw new Error("Foto non valida.");
      }

      setSaving(true);

      const fotoUrl = await caricaFotoProfilo(uriLocale);

      const profiloAggiornato = await salvaProfiloUtente({
        nome: nomeDraft.trim(),
        cognome: cognomeDraft.trim(),
        azienda: aziendaDraft.trim(),
        ruolo: ruoloDraft.trim(),
        sede: sedeDraft.trim(),
        foto_url: fotoUrl,
      });

      setFotoProfilo(fotoUrl);

      setProfilo((precedente) => ({
        ...precedente,
        foto_url: profiloAggiornato.foto_url || fotoUrl,
      }));

      Alert.alert(
        "Foto aggiornata",
        "La foto profilo è stata salvata sul tuo account."
      );
    } catch (error) {
      console.log("ERRORE FOTO PROFILO CLOUD:", error);
      Alert.alert(
        "Errore",
        error.message || "Impossibile salvare la foto profilo."
      );
    } finally {
      setSaving(false);
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

  if (screen === 'colleghi') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#07142f' }}>
        <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 50 }}>
          
          <TouchableOpacity
            onPress={() => setScreen('home')}
            style={{ marginBottom: 20 }}
          >
            <Text style={{ color: 'white', fontSize: 28 }}>‹</Text>
          </TouchableOpacity>

          <Text style={{ color: 'white', fontSize: 30, fontWeight: '800' }}>
            I miei colleghi
          </Text>

          <Text style={{ color: '#9fb2d9', marginTop: 6, marginBottom: 25 }}>
            Colleghi e contatti di servizio
          </Text>

          <View
            style={{
              backgroundColor: '#10234d',
              borderRadius: 18,
              padding: 16,
              marginBottom: 22,
            }}
          >
            <Text style={{ color: 'white', fontWeight: '700', marginBottom: 10 }}>
              Aggiungi collega
            </Text>

            <TextInput
              value={collegaIdDraft}
              onChangeText={setCollegaIdDraft}
              placeholder="ID collega"
              placeholderTextColor="#7184aa"
              autoCapitalize="none"
              style={{
                backgroundColor: '#091936',
                color: 'white',
                borderWidth: 1,
                borderColor: '#31538d',
                borderRadius: 12,
                padding: 14,
                marginBottom: 12,
              }}
            />

            <TouchableOpacity
              onPress={async () => {
                try {
                  await aggiungiCollega(collegaIdDraft.trim());
                  setCollegaIdDraft('');
                  await aggiornaColleghi();
                  Alert.alert('Collega aggiunto');
                } catch (error) {
                  Alert.alert('Errore', error.message || 'Impossibile aggiungere il collega');
                }
              }}
              style={{
                backgroundColor: '#2377ff',
                padding: 14,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: 'white', fontWeight: '800' }}>
                + AGGIUNGI COLLEGA
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={aggiornaColleghi}
            style={{ marginBottom: 18 }}
          >
            <Text style={{ color: '#52a2ff', fontWeight: '700' }}>
              ↻ Aggiorna elenco
            </Text>
          </TouchableOpacity>

          {loadingColleghi ? (
            <ActivityIndicator size="large" />
          ) : (
            <>
              {colleghi.filter(
                (c) => c.stato === 'in_attesa' && c.ricevuta
              ).length > 0 && (
                <>
                  <Text
                    style={{
                      color: 'white',
                      fontSize: 20,
                      fontWeight: '800',
                      marginBottom: 12,
                    }}
                  >
                    🔔 Richieste ricevute
                  </Text>

                  {colleghi
                    .filter(
                      (c) => c.stato === 'in_attesa' && c.ricevuta
                    )
                    .map((c) => (
                      <View
                        key={c.id}
                        style={{
                          backgroundColor: '#10234d',
                          borderRadius: 16,
                          padding: 16,
                          marginBottom: 12,
                    position: 'relative',
                        }}
                      >
                  {mittentiNonLetti.includes(c.altro_user_id) ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: '#ff3b30',
                      }}
                    />
                  ) : null}

                        <Text
                          style={{
                            color: 'white',
                            fontWeight: '800',
                            fontSize: 17,
                          }}
                        >
                          👤 {c.profilo?.nome || 'Collega'} {c.profilo?.cognome || ''}
                        </Text>

                        <Text
                          style={{
                            color: '#9fb2d9',
                            marginTop: 5,
                          }}
                        >
                          {[c.profilo?.azienda, c.profilo?.codice_gpg]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>

                        <View
                          style={{
                            flexDirection: 'row',
                            gap: 10,
                            marginTop: 15,
                          }}
                        >
                          <TouchableOpacity
                            onPress={async () => {
                              try {
                                await accettaCollega(c.id);
                                await aggiornaColleghi();
                              } catch (error) {
                                Alert.alert('Errore', error.message);
                              }
                            }}
                            style={{
                              flex: 1,
                              backgroundColor: '#1d9b55',
                              padding: 12,
                              borderRadius: 10,
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ color: 'white', fontWeight: '800' }}>
                              ✓ ACCETTA
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={async () => {
                              try {
                                await rifiutaCollega(c.id);
                                await aggiornaColleghi();
                              } catch (error) {
                                Alert.alert('Errore', error.message);
                              }
                            }}
                            style={{
                              flex: 1,
                              backgroundColor: '#b93646',
                              padding: 12,
                              borderRadius: 10,
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ color: 'white', fontWeight: '800' }}>
                              ✕ RIFIUTA
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                </>
              )}

              <Text
                style={{
                  color: 'white',
                  fontSize: 20,
                  fontWeight: '800',
                  marginTop: 8,
                  marginBottom: 12,
                }}
              >
                👥 I miei colleghi
              </Text>

              {colleghi.filter((c) => c.stato === 'accettato').length === 0 ? (
                <View
                  style={{
                    backgroundColor: '#10234d',
                    borderRadius: 18,
                    padding: 22,
                  }}
                >
                  <Text
                    style={{
                      color: 'white',
                      fontWeight: '700',
                      textAlign: 'center',
                    }}
                  >
                    Nessun collega collegato
                  </Text>
                </View>
              ) : (
                colleghi
                  .filter((c) => c.stato === 'accettato')
                  .map((c) => (
                    <View
                  
                      key={c.id}
                      style={{
                        backgroundColor: '#10234d',
                        borderRadius: 16,
                        padding: 16,
                        marginBottom: 12,
                      }}
                    >
                      <Text
                        style={{
                          color: 'white',
                          fontWeight: '800',
                          fontSize: 17,
                        }}
                      >
                        👤 {c.profilo?.nome || 'Collega'} {c.profilo?.cognome || ''}
                      </Text>

                      <Text
                        style={{
                          color: '#9fb2d9',
                          marginTop: 5,
                        }}
                      >
                        {[c.profilo?.azienda, c.profilo?.codice_gpg]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>

                      {c.profilo?.sede ? (
                        <Text
                          style={{
                            color: '#9fb2d9',
                            marginTop: 3,
                            fontSize: 12,
                          }}
                        >
                          📍 {c.profilo.sede}
                        </Text>
                      ) : null}

                      <TouchableOpacity
                    onPress={() => {
                      setCollegaSelezionato(c);
                      setChatMessaggio('');
                      setScreen('chatCollega');
                    }}
                    style={{
                      backgroundColor: '#284cff',
                      borderRadius: 12,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      alignItems: 'center',
                      marginTop: 12,
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: 'white',
                        fontWeight: '900',
                        fontSize: 14,
                      }}
                    >
                      💬 MESSAGGIO
                    </Text>
                    {/* APRI CHAT PRIVATA */}
                  </TouchableOpacity>

                  <TouchableOpacity
                        onPress={async () => {
                          try {
                            await rimuoviCollega(c.id);
                            await aggiornaColleghi();
                          } catch (error) {
                            Alert.alert('Errore', error.message);
                          }
                        }}
                        style={{ marginTop: 12 }}
                      >
                        <Text
                          style={{
                            color: '#ff6969',
                            fontWeight: '700',
                          }}
                        >
                          Rimuovi
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))
              )}
            </>
          )}

        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'configuraStipendio') {
    return (
      <Screen>
        <Back onPress={() => setScreen('stipendio')} />

        <Text style={{
          color: '#5a8cff',
          fontSize: 12,
          fontWeight: '900',
          marginBottom: 8,
        }}>
          CONFIGURAZIONE
        </Text>

        <Text style={{
          color: 'white',
          fontSize: 28,
          fontWeight: '900',
          marginBottom: 6,
        }}>
          Configura stipendio
        </Text>

        <Text style={{
          color: '#9fb2d9',
          fontSize: 14,
          marginBottom: 22,
        }}>
          Indica livello e orario contrattuale. Al resto pensa Vigilanza GPG.
        </Text>

        <View style={{
          backgroundColor: '#10234d',
          borderRadius: 20,
          padding: 18,
          gap: 14,
        }}>

          <Text style={{ color: 'white', fontWeight: '800' }}>
            Livello
          </Text>
          <TextInput
            placeholder="Es. 4"
            placeholderTextColor="#7184aa"
            value={stipendioLivello}
            onChangeText={setStipendioLivello}
            style={{
              backgroundColor: '#091936',
              color: 'white',
              borderRadius: 12,
              padding: 14,
            }}
          />

          <Text style={{ color: 'white', fontWeight: '800' }}>
            Ore settimanali
          </Text>
          <TextInput
            placeholder="Es. 40"
            placeholderTextColor="#7184aa"
            keyboardType="numeric"
            value={stipendioOreSettimanali}
            onChangeText={setStipendioOreSettimanali}
            style={{
              backgroundColor: '#091936',
              color: 'white',
              borderRadius: 12,
              padding: 14,
            }}
          />

          <Text style={{ color: 'white', fontWeight: '800' }}>
            CCNL
          </Text>

          <View
            style={{
              backgroundColor: '#091936',
              borderRadius: 12,
              padding: 14,
            }}
          >
            <Text style={{
              color: 'white',
              fontSize: 15,
              fontWeight: '700',
            }}>
              Vigilanza Privata e Servizi di Sicurezza
            </Text>

            <Text style={{
              color: '#5a8cff',
              fontSize: 12,
              marginTop: 5,
            }}>
              Calcolo automatico da contratto
            </Text>
          </View>

          <TouchableOpacity
            onPress={async () => {
              try {
                await AsyncStorage.setItem(
                  '@vigilanza_gpg_stipendio',
                  JSON.stringify({
                    ccnl: stipendioCCNL,
                    livello: stipendioLivello,
                    oreSettimanali:
                      stipendioOreSettimanali,
                    nettoBase:
                      stipendioNettoBase,
                  })
                );

                Alert.alert(
                  'Configurazione salvata ✅',
                  'I dati verranno ricordati automaticamente.'
                );

                setScreen('stipendio');
              } catch (error) {
                Alert.alert(
                  'Errore',
                  'Impossibile salvare la configurazione.'
                );
              }
            }}
            style={{
              backgroundColor: '#284cff',
              borderRadius: 14,
              padding: 15,
              alignItems: 'center',
              marginTop: 6,
            }}
          >
            <Text style={{
              color: 'white',
              fontWeight: '900',
            }}>
              SALVA CONFIGURAZIONE
            </Text>
          </TouchableOpacity>

        </View>
      
        {c?.stato === 'accettato' ? (
          <TouchableOpacity
            onPress={() => {
              setChatMessaggio('');
              setScreen('chatCollega');
            }}
            style={{
              backgroundColor: '#284cff',
              borderRadius: 16,
              padding: 16,
              alignItems: 'center',
              marginTop: 16,
              marginBottom: 12,
            }}
          >
            <Text style={{
              color: 'white',
              fontSize: 15,
              fontWeight: '900',
            }}>
              💬 MESSAGGIO
            </Text>
          </TouchableOpacity>
        ) : null}

        </Screen>
    );
  }

  if (screen === 'stipendio') {
    const tabelleGPG = {
      '1': 1992.60,
      '2': 1860.38,
      '3': 1651.31,
      '4': 1468.88,
      '5': 1393.87,
      '6': 1293.87,
    };

    const pagaMensileLorda =
      tabelleGPG[stipendioLivello] || 0;

    const pagaOrariaLorda =
      pagaMensileLorda > 0
        ? pagaMensileLorda / 173
        : 0;

    const oreTotali =
      Number(statistiche.ore) || 0;

    const oreExtra =
      Number(statistiche.extraOre) || 0;

    const oreOrdinarie =
      Math.max(0, oreTotali - oreExtra);

    const lordoOrdinarioMaturato =
      oreOrdinarie * pagaOrariaLorda;

    const lordoStraordinari =
      oreExtra * pagaOrariaLorda * 1.30;

    const lordoStimatoAdOggi =
      lordoOrdinarioMaturato + lordoStraordinari;

    // Prima stima del netto.
    // Verrà raffinata successivamente con contributi, IRPEF e detrazioni.
    const coefficienteNetto = 0.78;

    const nettoStimatoAdOggi =
      lordoStimatoAdOggi * coefficienteNetto;

    const nettoOrdinarioStimato =
      lordoOrdinarioMaturato * coefficienteNetto;

    const nettoStraordinariStimato =
      lordoStraordinari * coefficienteNetto;

    // Analisi automatica dei turni salvati
    const listaTurniCalcolo =
      (typeof turni !== 'undefined' && Array.isArray(turni))
        ? turni
        : [];

    const minutiOra = (ora) => {
      if (!ora || typeof ora !== 'string') return 0;
      const [h, m] = ora.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const calcolaOreNotturne = (inizio, fine) => {
      let start = minutiOra(inizio);
      let end = minutiOra(fine);

      if (!inizio || !fine) return 0;
      if (end <= start) end += 1440;

      let minutiNotte = 0;

      // Prima finestra notturna: 00:00 - 06:00
      const notteMattinaStart = 0;
      const notteMattinaEnd = 360;

      // Seconda finestra: 22:00 - 24:00
      const notteSeraStart = 1320;
      const notteSeraEnd = 1440;

      for (let minuto = start; minuto < end; minuto++) {
        const minutoGiorno = minuto % 1440;

        if (
          (minutoGiorno >= notteMattinaStart &&
            minutoGiorno < notteMattinaEnd) ||
          (minutoGiorno >= notteSeraStart &&
            minutoGiorno < notteSeraEnd)
        ) {
          minutiNotte++;
        }
      }

      return minutiNotte / 60;
    };

    const festivitaFisse = [
      '01-01',
      '01-06',
      '04-25',
      '05-01',
      '06-02',
      '08-15',
      '11-01',
      '12-08',
      '12-25',
      '12-26',
    ];

    const turnoFestivo = (giorno) => {
      if (!giorno) return false;

      const data = new Date(`${giorno}T12:00:00`);
      if (Number.isNaN(data.getTime())) return false;

      const mmdd =
        String(data.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(data.getDate()).padStart(2, '0');

      return festivitaFisse.includes(mmdd);
    };

    const turnoDomenicale = (giorno) => {
      if (!giorno) return false;

      const data = new Date(`${giorno}T12:00:00`);
      if (Number.isNaN(data.getTime())) return false;

      return data.getDay() === 0;
    };

    const calcolaOreTurno = (inizio, fine) => {
      if (!inizio || !fine) return 0;

      let start = minutiOra(inizio);
      let end = minutiOra(fine);

      if (end <= start) end += 1440;

      return (end - start) / 60;
    };

    const statisticheMaggiorazioni = listaTurniCalcolo.reduce(
      (acc, turno) => {
        if (turno?.tipo !== 'turno') return acc;

        const oreTurno = calcolaOreTurno(
          turno.inizio,
          turno.fine
        );

        acc.oreNotturne += calcolaOreNotturne(
          turno.inizio,
          turno.fine
        );

        if (turnoFestivo(turno.giorno)) {
          acc.turniFestivi += 1;
          acc.oreFestive += oreTurno;
        }

        if (turnoDomenicale(turno.giorno)) {
          acc.turniDomenicali += 1;
          acc.oreDomenicali += oreTurno;
        }

        if (turno.riposo_lavorato) {
          acc.riposiLavorati += 1;
          acc.oreRiposoLavorato += oreTurno;
        }

        return acc;
      },
      {
        oreNotturne: 0,
        turniFestivi: 0,
        oreFestive: 0,
        turniDomenicali: 0,
        oreDomenicali: 0,
        riposiLavorati: 0,
        oreRiposoLavorato: 0,
      }
    );

    // Maggiorazioni CCNL verificate
    const maggiorazioneFestiviLorda =
      statisticheMaggiorazioni.oreFestive *
      pagaOrariaLorda *
      0.35;

    const maggiorazioneRiposiLorda =
      statisticheMaggiorazioni.oreRiposoLavorato *
      pagaOrariaLorda *
      0.35;

    const indennitaDomenicaleLorda =
      statisticheMaggiorazioni.oreDomenicali *
      0.71;

    // Stima prudenziale: monetizziamo le ore notturne
    // con la maggiorazione contrattuale del 35%.
    const maggiorazioneNotturnaLorda =
      statisticheMaggiorazioni.oreNotturne *
      pagaOrariaLorda *
      0.35;

    const maggiorazioniLorde =
      maggiorazioneFestiviLorda +
      maggiorazioneRiposiLorda +
      indennitaDomenicaleLorda +
      maggiorazioneNotturnaLorda;

    const lordoTotaleConMaggiorazioni =
      lordoStimatoAdOggi +
      maggiorazioniLorde;

    const nettoTotaleConMaggiorazioni =
      lordoTotaleConMaggiorazioni *
      coefficienteNetto;

    // ===== GUADAGNATO AD OGGI / TURNI FUTURI =====
    const oggiStipendio = new Date();
    oggiStipendio.setHours(23, 59, 59, 999);

    const calcolaValoreTurno = (turno) => {
      if (!turno || turno.tipo !== 'turno') {
        return { lordo: 0, netto: 0, ore: 0 };
      }

      const oreTurno = calcolaOreTurno(
        turno.inizio,
        turno.fine
      );

      const extraTurno = Math.min(
        oreTurno,
        Math.max(0, Number(turno.extra) || 0)
      );

      const oreOrdinarieTurno =
        Math.max(0, oreTurno - extraTurno);

      let lordo =
        oreOrdinarieTurno * pagaOrariaLorda +
        extraTurno * pagaOrariaLorda * 1.30;

      if (turnoFestivo(turno.giorno)) {
        lordo += oreTurno * pagaOrariaLorda * 0.35;
      }

      if (turnoDomenicale(turno.giorno)) {
        lordo += oreTurno * 0.71;
      }

      if (turno.riposo_lavorato) {
        lordo += oreTurno * pagaOrariaLorda * 0.35;
      }

      return {
        lordo,
        netto: lordo * coefficienteNetto,
        ore: oreTurno,
      };
    };

    const riepilogoTemporale =
      listaTurniCalcolo.reduce(
        (acc, turno) => {
          if (!turno || turno.tipo !== 'turno') {
            return acc;
          }

          const valore = calcolaValoreTurno(turno);

          const dataTurno = turno.giorno
            ? new Date(`${turno.giorno}T12:00:00`)
            : null;

          const futuro =
            dataTurno &&
            !Number.isNaN(dataTurno.getTime()) &&
            dataTurno > oggiStipendio;

          if (futuro) {
            acc.futuroNetto += valore.netto;
            acc.futuroLordo += valore.lordo;
            acc.oreFuture += valore.ore;
          } else {
            acc.oggiNetto += valore.netto;
            acc.oggiLordo += valore.lordo;
            acc.oreMaturate += valore.ore;
          }

          return acc;
        },
        {
          oggiNetto: 0,
          oggiLordo: 0,
          futuroNetto: 0,
          futuroLordo: 0,
          oreMaturate: 0,
          oreFuture: 0,
        }
      );

    const previsioneNettoFineMese =
      riepilogoTemporale.oggiNetto +
      riepilogoTemporale.futuroNetto;

    // Divide i turni tra già lavorati e futuri
    const oggiCalcolo = new Date();
    oggiCalcolo.setHours(23, 59, 59, 999);

    const turnoGiaMaturato = (turno) => {
      if (!turno?.giorno) return true;

      const dataTurno = new Date(`${turno.giorno}T12:00:00`);
      if (Number.isNaN(dataTurno.getTime())) return true;

      return dataTurno <= oggiCalcolo;
    };

    const calcolaEconomiaTurni = (lista) => {
      return lista.reduce(
        (acc, turno) => {
          if (turno?.tipo !== 'turno') return acc;

          const oreTurno = calcolaOreTurno(
            turno.inizio,
            turno.fine
          );

          const extraTurno = Math.min(
            oreTurno,
            Math.max(0, Number(turno.extra) || 0)
          );

          const ordinarieTurno =
            Math.max(0, oreTurno - extraTurno);

          let lordoTurno =
            ordinarieTurno * pagaOrariaLorda +
            extraTurno * pagaOrariaLorda * 1.30;

          if (turnoFestivo(turno.giorno)) {
            lordoTurno +=
              oreTurno * pagaOrariaLorda * 0.35;
          }

          if (turnoDomenicale(turno.giorno)) {
            lordoTurno += oreTurno * 0.71;
          }

          if (turno.riposo_lavorato) {
            lordoTurno +=
              oreTurno * pagaOrariaLorda * 0.35;
          }

          acc.lordo += lordoTurno;
          acc.netto += lordoTurno * coefficienteNetto;
          acc.ore += oreTurno;

          return acc;
        },
        {
          lordo: 0,
          netto: 0,
          ore: 0,
        }
      );
    };

    const turniMaturati =
      listaTurniCalcolo.filter(turnoGiaMaturato);

    const turniFuturi =
      listaTurniCalcolo.filter(
        (turno) => !turnoGiaMaturato(turno)
      );

    const economiaAdOggi =
      calcolaEconomiaTurni(turniMaturati);

    const economiaFutura =
      calcolaEconomiaTurni(turniFuturi);

    const previsioneFineMese =
      economiaAdOggi.netto + economiaFutura.netto;

    // ===== PROIEZIONE INTELLIGENTE FINE MESE =====
    const adessoProiezione = new Date();

    const annoProiezione = adessoProiezione.getFullYear();
    const meseProiezione = adessoProiezione.getMonth();

    const giorniNelMese = new Date(
      annoProiezione,
      meseProiezione + 1,
      0
    ).getDate();

    const giornoAttuale = adessoProiezione.getDate();

    const giorniLavoratiMaturati =
      turniMaturati.filter(
        (t) => t?.tipo === 'turno'
      ).length;

    const mediaNettaGiornata =
      giorniLavoratiMaturati > 0
        ? economiaAdOggi.netto / giorniLavoratiMaturati
        : 0;

    const giorniRimanenti =
      Math.max(0, giorniNelMese - giornoAttuale);

    const oreSettimanaliContratto =
      Number(stipendioOreSettimanali) || 40;

    const giorniLavorativiSettimana = 6;

    const giorniLavoroStimatiRimanenti =
      Math.round(
        giorniRimanenti *
        (giorniLavorativiSettimana / 7)
      );

    const proiezioneIntelligente =
      economiaAdOggi.netto +
      mediaNettaGiornata *
        giorniLavoroStimatiRimanenti;

    return (
      <Screen>
        <Back onPress={() => setScreen('home')} />

        <Text
          style={{
            color: '#5a8cff',
            fontSize: 12,
            fontWeight: '900',
            marginBottom: 8,
          }}
        >
          STIPENDIO
        </Text>

        <Text
          style={{
            color: 'white',
            fontSize: 28,
            fontWeight: '900',
            marginBottom: 6,
          }}
        >
          Stipendio stimato
        </Text>

        <Text
          style={{
            color: '#9fb2d9',
            fontSize: 14,
            marginBottom: 22,
          }}
        >
          Riepilogo del mese in corso
        </Text>

        <View
          style={{
            backgroundColor: '#10234d',
            borderRadius: 20,
            padding: 18,
            marginBottom: 14,
          }}
        >
          <Text style={{ color: '#9fb2d9', fontSize: 12, fontWeight: '800' }}>
            ORE TOTALI
          </Text>

          <Text
            style={{
              color: 'white',
              fontSize: 30,
              fontWeight: '900',
              marginTop: 6,
            }}
          >
            {statistiche.ore}h
          </Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: '#10234d',
              borderRadius: 18,
              padding: 16,
            }}
          >
            <Text style={{ color: '#9fb2d9', fontSize: 11, fontWeight: '800' }}>
              STRAORDINARI
            </Text>
            <Text style={{ color: 'white', fontSize: 24, fontWeight: '900', marginTop: 6 }}>
              {statistiche.extraOre}h
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: '#10234d',
              borderRadius: 18,
              padding: 16,
            }}
          >
            <Text style={{ color: '#9fb2d9', fontSize: 11, fontWeight: '800' }}>
              GIORNI
            </Text>
            <Text style={{ color: 'white', fontSize: 24, fontWeight: '900', marginTop: 6 }}>
              {statistiche.giorni}
            </Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: '#10234d',
            borderRadius: 20,
            padding: 18,
          }}
        >
          <Text style={{ color: '#5a8cff', fontSize: 12, fontWeight: '900' }}>
            NETTO STIMATO
          </Text>

          <Text
            style={{
              color: 'white',
              fontSize: 27,
              fontWeight: '900',
              marginTop: 7,
            }}
          >
            {pagaMensileLorda > 0
              ? `€ ${nettoTotaleConMaggiorazioni.toFixed(2)}`
              : 'Configura il livello'}
          </Text>

          {pagaMensileLorda > 0 ? (
            <Text
              style={{
                color: '#35e58b',
                fontSize: 13,
                fontWeight: '800',
                marginTop: 7,
              }}
            >
              Netto stimato ad oggi
            </Text>
          ) : null}

          {pagaMensileLorda > 0 ? (
            <View
              style={{
                backgroundColor: '#091936',
                borderRadius: 16,
                padding: 16,
                marginTop: 18,
              }}
            >
              <Text style={{
                color: '#5a8cff',
                fontSize: 12,
                fontWeight: '900',
                marginBottom: 12,
              }}>
                RIEPILOGO DEL MESE
              </Text>

              <Text style={{ color: 'white', marginBottom: 8 }}>
                Ore lavorate: {oreTotali.toFixed(1)} h
              </Text>

              <Text style={{ color: 'white', marginBottom: 8 }}>
                Ore ordinarie: {oreOrdinarie.toFixed(1)} h
              </Text>

              <Text style={{ color: 'white', marginBottom: 8 }}>
                Straordinari: {oreExtra.toFixed(1)} h
              </Text>

              <Text style={{ color: '#9fb2d9', marginTop: 8 }}>
                🌙 Ore notturne: {statisticheMaggiorazioni.oreNotturne.toFixed(1)} h
              </Text>

              <Text style={{ color: '#9fb2d9', marginTop: 6 }}>
                🎉 Turni festivi/domenicali: {statisticheMaggiorazioni.turniFestivi}
              </Text>

              <Text style={{ color: '#9fb2d9', marginTop: 6 }}>
                🔄 Riposi lavorati: {statisticheMaggiorazioni.riposiLavorati}
              </Text>

              <Text style={{ color: '#9fb2d9', marginTop: 14 }}>
                🎉 Maggiorazione festivi: € {maggiorazioneFestiviLorda.toFixed(2)}
              </Text>

              <Text style={{ color: '#9fb2d9', marginTop: 6 }}>
                ☀️ Indennità domenicale: € {indennitaDomenicaleLorda.toFixed(2)}
              </Text>

              <Text style={{ color: '#9fb2d9', marginTop: 6 }}>
                🌙 Maggiorazione notturna: € {maggiorazioneNotturnaLorda.toFixed(2)}
              </Text>

              <Text style={{ color: '#9fb2d9', marginTop: 6 }}>
                🔄 Maggiorazione riposi: € {maggiorazioneRiposiLorda.toFixed(2)}
              </Text>

              <Text style={{ color: '#9fb2d9', marginTop: 8 }}>
                Quota ordinaria: € {nettoOrdinarioStimato.toFixed(2)}
              </Text>

              <Text style={{ color: '#9fb2d9', marginTop: 6 }}>
                Straordinari: € {nettoStraordinariStimato.toFixed(2)}
              </Text>

              <View
                style={{
                  height: 1,
                  backgroundColor: '#284cff',
                  marginVertical: 14,
                }}
              />

              <Text style={{
                color: 'white',
                fontSize: 16,
                fontWeight: '900',
              }}>
                Lordo maturato: € {lordoTotaleConMaggiorazioni.toFixed(2)}
              </Text>

              <Text style={{
                color: '#35e58b',
                fontSize: 20,
                fontWeight: '900',
                marginTop: 8,
              }}>
                Netto stimato: € {nettoTotaleConMaggiorazioni.toFixed(2)}
              </Text>

              <View
                style={{
                  height: 1,
                  backgroundColor: '#284cff',
                  marginVertical: 16,
                }}
              />

              <Text style={{
                color: '#5a8cff',
                fontSize: 11,
                fontWeight: '900',
              }}>
                GUADAGNATO AD OGGI
              </Text>

              <Text style={{
                color: '#35e58b',
                fontSize: 25,
                fontWeight: '900',
                marginTop: 5,
              }}>
                € {riepilogoTemporale.oggiNetto.toFixed(2)}
              </Text>

              <Text style={{
                color: '#9fb2d9',
                fontSize: 12,
                marginTop: 4,
              }}>
                {riepilogoTemporale.oreMaturate.toFixed(1)} ore già lavorate
              </Text>

              <Text style={{
                color: '#5a8cff',
                fontSize: 11,
                fontWeight: '900',
                marginTop: 18,
              }}>
                TURNI FUTURI GIÀ INSERITI
              </Text>

              <Text style={{
                color: 'white',
                fontSize: 20,
                fontWeight: '900',
                marginTop: 5,
              }}>
                € {riepilogoTemporale.futuroNetto.toFixed(2)}
              </Text>

              <Text style={{
                color: '#9fb2d9',
                fontSize: 12,
                marginTop: 4,
              }}>
                {riepilogoTemporale.oreFuture.toFixed(1)} ore programmate
              </Text>

              <View
                style={{
                  backgroundColor: '#162d67',
                  borderRadius: 16,
                  padding: 16,
                  marginTop: 18,
                }}
              >
                <Text style={{
                  color: '#9fb2d9',
                  fontSize: 11,
                  fontWeight: '900',
                }}>
                  PREVISIONE CON I TURNI INSERITI
                </Text>

                <Text style={{
                  color: 'white',
                  fontSize: 27,
                  fontWeight: '900',
                  marginTop: 5,
                }}>
                  € {previsioneNettoFineMese.toFixed(2)}
                </Text>
              </View>

              <View
                style={{
                  height: 1,
                  backgroundColor: '#284cff',
                  marginVertical: 16,
                }}
              />

              <Text style={{
                color: '#9fb2d9',
                fontSize: 12,
                fontWeight: '900',
              }}>
                GUADAGNATO AD OGGI
              </Text>

              <Text style={{
                color: '#35e58b',
                fontSize: 24,
                fontWeight: '900',
                marginTop: 5,
              }}>
                € {economiaAdOggi.netto.toFixed(2)}
              </Text>

              <Text style={{
                color: '#9fb2d9',
                fontSize: 12,
                fontWeight: '900',
                marginTop: 16,
              }}>
                TURNI FUTURI GIÀ INSERITI
              </Text>

              <Text style={{
                color: 'white',
                fontSize: 19,
                fontWeight: '800',
                marginTop: 5,
              }}>
                € {economiaFutura.netto.toFixed(2)}
              </Text>

              <View
                style={{
                  backgroundColor: '#10234d',
                  borderRadius: 14,
                  padding: 14,
                  marginTop: 18,
                }}
              >
                <Text style={{
                  color: '#5a8cff',
                  fontSize: 11,
                  fontWeight: '900',
                }}>
                  PREVISIONE FINE MESE
                </Text>

                <Text style={{
                  color: 'white',
                  fontSize: 26,
                  fontWeight: '900',
                  marginTop: 5,
                }}>
                  € {previsioneFineMese.toFixed(2)}
                </Text>

                <View
                  style={{
                    height: 1,
                    backgroundColor: '#284cff',
                    marginVertical: 14,
                  }}
                />

                <Text style={{
                  color: '#5a8cff',
                  fontSize: 11,
                  fontWeight: '900',
                }}>
                  STIMA INTELLIGENTE FINE MESE
                </Text>

                <Text style={{
                  color: '#35e58b',
                  fontSize: 27,
                  fontWeight: '900',
                  marginTop: 5,
                }}>
                  € {proiezioneIntelligente.toFixed(2)}
                </Text>

                <Text style={{
                  color: '#9fb2d9',
                  fontSize: 12,
                  marginTop: 7,
                }}>
                  Media maturata: € {mediaNettaGiornata.toFixed(2)} per giornata
                </Text>

                <Text style={{
                  color: '#9fb2d9',
                  fontSize: 12,
                  marginTop: 4,
                }}>
                  Proiezione basata sul ritmo di lavoro attuale
                </Text>
              </View>
            </View>
          ) : null}

          <Text
            style={{
              color: '#9fb2d9',
              fontSize: 13,
              marginTop: 7,
              lineHeight: 19,
            }}
          >
            Configura il tuo contratto per calcolare automaticamente la stima.
          </Text>

          <TouchableOpacity
            onPress={() => setScreen('configuraStipendio')}
            style={{
              backgroundColor: '#284cff',
              borderRadius: 14,
              padding: 14,
              marginTop: 16,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: 'white',
                fontSize: 14,
                fontWeight: '900',
              }}
            >
              ⚙️ CONFIGURA STIPENDIO
            </Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  if (screen === 'chatCollega') {
    const c = collegaSelezionato;
    const p = c?.profilo || {};

    return (
      <Screen>
        <Back onPress={() => setScreen('profiloCollega')} />

        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 20,
        }}>
          {p.foto_url ? (
            <Image
              source={{ uri: p.foto_url }}
              style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                marginRight: 12,
              }}
            />
          ) : (
            <View style={{
              width: 54,
              height: 54,
              borderRadius: 27,
              marginRight: 12,
              backgroundColor: '#284cff',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Text style={{
                color: 'white',
                fontWeight: '900',
                fontSize: 17,
              }}>
                {(p.nome?.[0] || '') + (p.cognome?.[0] || '')}
              </Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={{
              color: 'white',
              fontSize: 20,
              fontWeight: '900',
            }}>
              {p.nome || 'Collega'} {p.cognome || ''}
            </Text>

            <Text style={{
              color: '#9fb2d9',
              fontSize: 12,
              marginTop: 3,
            }}>
              {[p.azienda, p.sede].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>

        <ScrollView
          style={{
            flex: 1,
            backgroundColor: '#0b1938',
            borderRadius: 20,
            marginBottom: 14,
          }}
          contentContainerStyle={{
            padding: 14,
            flexGrow: 1,
          }}
        >
          {chatLoading ? (
            <ActivityIndicator />
          ) : chatMessaggi.length === 0 ? (
            <View style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingVertical: 40,
            }}>
              <Text style={{
                color: '#5a8cff',
                fontWeight: '900',
                fontSize: 12,
              }}>
                💬 CHAT PRIVATA
              </Text>

              <Text style={{
                color: '#7184aa',
                fontSize: 13,
                marginTop: 10,
                textAlign: 'center',
              }}>
                Nessun messaggio. Scrivi il primo.
              </Text>
            </View>
          ) : (
            chatMessaggi.map((m) => {
              const mio = m.mittente_id === chatMioId;

              return (
                <View
                  key={m.id}
                  style={{
                    alignSelf: mio ? 'flex-end' : 'flex-start',
                    backgroundColor: mio ? '#284cff' : '#10234d',
                    borderRadius: 16,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    marginBottom: 8,
                    maxWidth: '82%',
                  }}
                >
                  <Text style={{
                    color: 'white',
                    fontSize: 15,
                  }}>
                    {m.testo}
                  </Text>

                  <Text style={{
                    color: mio ? '#d8e0ff' : '#7184aa',
                    fontSize: 10,
                    marginTop: 5,
                    alignSelf: 'flex-end',
                  }}>
                    {new Date(m.created_at).toLocaleTimeString(
                      'it-IT',
                      {
                        hour: '2-digit',
                        minute: '2-digit',
                      }
                    )}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={{
          flexDirection: 'row',
          gap: 10,
          alignItems: 'center',
        }}>
          <TextInput
            value={chatMessaggio}
            onChangeText={setChatMessaggio}
            placeholder="Scrivi un messaggio..."
            placeholderTextColor="#7184aa"
            style={{
              flex: 1,
              backgroundColor: '#10234d',
              color: 'white',
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}
          />

          <TouchableOpacity
            onPress={async () => {
              const testo = chatMessaggio.trim();
              const destinatarioId =
                collegaSelezionato?.altro_user_id;

              if (!testo || !destinatarioId) return;

              try {
                const nuovo = await inviaMessaggio(
                  destinatarioId,
                  testo
                );

                setChatMessaggi((precedenti) => [
                  ...precedenti,
                  nuovo,
                ]);

                setChatMessaggio('');
              } catch (error) {
                Alert.alert(
                  'Messaggio non inviato',
                  error.message || 'Errore durante l’invio.'
                );
              }
            }}
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: '#284cff',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{
              color: 'white',
              fontSize: 21,
            }}>
              ➤
            </Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  if (screen === 'profiloCollega') {
    const c = collegaSelezionato;
    const p = c?.profilo || {};

    return (
      <Screen>
        <Back
          onPress={() => {
            setCollegaSelezionato(null);
            setScreen('home');
          }}
        />

        <Text
          style={{
            color: '#5a8cff',
            fontSize: 12,
            fontWeight: '900',
            marginBottom: 8,
          }}
        >
          PROFILO COLLEGA
        </Text>

        <View style={{ alignItems: 'center', marginBottom: 18 }}>
          {p.foto_url ? (
            <Image
              source={{ uri: p.foto_url }}
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
              }}
            />
          ) : (
            <View
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: '#153A70',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: 'white',
                  fontSize: 30,
                  fontWeight: '900',
                }}
              >
                {(p.nome?.[0] || 'C') + (p.cognome?.[0] || '')}
              </Text>
            </View>
          )}
        </View>

        <Text
          style={{
            color: 'white',
            fontSize: 28,
            fontWeight: '900',
            marginBottom: 6,
          }}
        >
          {p.nome || 'Collega'} {p.cognome || ''}
        </Text>

        <Text
          style={{
            color: '#9fb2d9',
            fontSize: 15,
            marginBottom: 22,
          }}
        >
          {[p.azienda, p.sede].filter(Boolean).join(' · ') || 'Informazioni non disponibili'}
        </Text>

        <View
          style={{
            backgroundColor: '#10234d',
            borderRadius: 20,
            padding: 18,
            marginBottom: 16,
          }}
        >
          <Text style={{ color: '#9fb2d9', fontSize: 11, fontWeight: '900' }}>
            IN SERVIZIO CON TE
          </Text>

          <Text
            style={{
              color: '#35e58b',
              fontSize: 18,
              fontWeight: '800',
              marginTop: 8,
            }}
          >
            {c?.insieme_da && c?.insieme_a
              ? `Dalle ${c.insieme_da} alle ${c.insieme_a}`
              : 'Nessuna sovrapposizione indicata'}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: '#10234d',
            borderRadius: 20,
            padding: 18,
          }}
        >
          <Text style={{ color: 'white', fontSize: 16, fontWeight: '800' }}>
            {p.ruolo || 'Guardia Particolare Giurata'}
          </Text>

          {p.codice_gpg ? (
            <Text style={{ color: '#9fb2d9', marginTop: 7 }}>
              Codice GPG: {p.codice_gpg}
            </Text>
          ) : null}
        </View>
      

        {p.codice_gpg ? (
          <TouchableOpacity
            onPress={async () => {
              try {
                await aggiungiCollega(p.codice_gpg);
                Alert.alert(
                  'Richiesta inviata ✅',
                  `Hai inviato una richiesta a ${p.nome || 'questo collega'}.`
                );
              } catch (error) {
                Alert.alert(
                  'Richiesta non inviata',
                  error?.message || 'Si è verificato un errore.'
                );
              }
            }}
            style={{
              backgroundColor: '#3153f5',
              borderRadius: 16,
              paddingVertical: 15,
              alignItems: 'center',
              marginTop: 18,
            }}
          >
            <Text
              style={{
                color: 'white',
                fontSize: 15,
                fontWeight: '900',
              }}
            >
              + AGGIUNGI COLLEGA
            </Text>
          </TouchableOpacity>
        ) : null}

</Screen>
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

          <TouchableOpacity
            style={{ backgroundColor: "#c62828", padding: 16, borderRadius: 12, marginTop: 14, alignItems: "center" }}
            onPress={logout}
          >
            <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
              ESCI DALL'ACCOUNT
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

      
          <View
            style={{
              backgroundColor: '#10234d',
              borderRadius: 20,
              padding: 18,
              marginBottom: 14,
            }}
          >
            <TouchableOpacity
  onPress={() => setScreen('stipendio')}
  style={{
    backgroundColor: '#10234d',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#284cff',
  }}
>
  <Text style={{
    color: '#5a8cff',
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 8,
  }}>
    💰 STIPENDIO
  </Text>

  <Text style={{
    color: 'white',
    fontSize: 21,
    fontWeight: '900',
  }}>
    Stipendio stimato
  </Text>

  <Text style={{
    color: '#9fb2d9',
    fontSize: 14,
    marginTop: 6,
  }}>
    Calcola quanto stai maturando questo mese →
  </Text>
</TouchableOpacity>

          <Text
              style={{
                color: '#52a2ff',
                fontSize: 11,
                fontWeight: '900',
                marginBottom: 8,
              }}
            >
              TURNO DI OGGI
            </Text>

            <Text
              style={{
                color: 'white',
                fontSize: 20,
                fontWeight: '800',
              }}
            >
              {turnoOggi
                ? `${turnoOggi.inizio || '--:--'} – ${turnoOggi.fine || '--:--'}`
                : 'Nessun turno oggi'}
            </Text>

            <Text
              style={{
                color: '#9fb2d9',
                fontSize: 13,
                marginTop: 6,
              }}
            >
              {turnoOggi
                ? `📍 ${turnoOggi.luogo || 'Luogo non indicato'}`
                : 'Giornata libera'}
            </Text>
        {turnoOggi && (
          <TouchableOpacity onPress={() => modificaGiorno(turnoOggi)} style={{ marginTop: 12 }}>
            <Text style={{ color: "#5a8cff", fontWeight: "800" }}>GESTISCI TURNO ›</Text>
          </TouchableOpacity>
        )}
          </View>

<View
        style={{
          backgroundColor: '#10234d',
          borderRadius: 20,
          padding: 18,
          marginBottom: 22,
        }}
      >
        <Text
          style={{
            color: '#52a2ff',
            fontSize: 11,
            fontWeight: '900',
            marginBottom: 8,
          }}
        >
          IN SERVIZIO CON TE
        </Text>

        {loadingServizio ? (
          <ActivityIndicator />
        ) : colleghiInServizio.length === 0 ? (
          <Text style={{ color: '#9fb2d9' }}>
            Nessun collega collegato in servizio oggi
          </Text>
        ) : (
          colleghiInServizio.map((c, index) => (
            <View
                onTouchEnd={() => {
                  setCollegaSelezionato(c);
                  setScreen('profiloCollega');
                }}
                key={`${c.altro_user_id}-${index}`}
              style={{
                paddingVertical: 8,
                borderBottomWidth:
                  index < colleghiInServizio.length - 1 ? 1 : 0,
                borderBottomColor: '#203b6a',
              }}
            >
              <Text
                style={{
                  color: 'white',
                  fontWeight: '800',
                  fontSize: 16,
                }}
              >
                👤 {c.profilo?.nome || 'Collega'} {c.profilo?.cognome || ''}
              </Text>

              <Text
                style={{
                  color: '#9fb2d9',
                  fontSize: 12,
                  marginTop: 3,
                }}
              >
                {[c.profilo?.azienda, c.profilo?.sede]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>

              {c.insieme_da && c.insieme_a && (
                <Text
                  style={{
                    color: '#35e58b',
                    fontWeight: '700',
                    fontSize: 12,
                    marginTop: 5,
                  }}
                >
                  🟢 Con te dalle {c.insieme_da} alle {c.insieme_a}
                </Text>
              )}
            </View>
          ))
        )}

        <TouchableOpacity
          onPress={aggiornaColleghiInServizioOggi}
          style={{ marginTop: 12 }}
        >
          <Text
            style={{
              color: '#52a2ff',
              fontWeight: '800',
              fontSize: 12,
            }}
          >
            ↻ Aggiorna
          </Text>
        </TouchableOpacity>
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
        subtitle={[profilo.azienda, profilo.sede].filter(Boolean).join(" • ")}
        onPress={
          apriProfilo
        }
      />

        <Menu
          icon="👥"
          title={
            messaggiNonLetti > 0
              ? "I miei colleghi 🔴"
              : "I miei colleghi"
          }
          subtitle="Colleghi e contatti di servizio"
          onPress={() => { setScreen("colleghi"); aggiornaColleghi(); }}
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