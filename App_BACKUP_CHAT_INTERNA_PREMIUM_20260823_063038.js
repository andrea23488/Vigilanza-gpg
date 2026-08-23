import { Ionicons } from '@expo/vector-icons';
import LoginScreen from './LoginScreen';
import {
  caricaMessaggi,
  inviaMessaggio,
  mioUserId,
  eliminaMessaggio,
  eliminaConversazione,
  colleghiConConversazione,
  caricaRiepilogoConversazioni,
} from './chatApi';
import { caricaTurniUtente, creaTurnoUtente, aggiornaTurnoUtente, eliminaTurnoUtente } from './turniApi';
import { supabase } from './supabase';
import { caricaProfiloUtente, salvaProfiloUtente, caricaFotoProfilo, eliminaFotoProfiloCloud } from './profiliApi';
import { caricaColleghi, aggiungiCollega, rimuoviCollega, accettaCollega, rifiutaCollega } from './colleghiApi';
import { caricaColleghiInServizio } from './servizioApi';
import React, { useEffect, useMemo, useState } from 'react';

import {
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
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
  const giorniSettimana = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
 const [accessoTest, setAccessoTest] = useState(false);
  const [screen, setScreen] = useState("home");
  const [stipendioCCNL, setStipendioCCNL] = useState('Vigilanza Privata e Servizi di Sicurezza');
  const [stipendioLivello, setStipendioLivello] = useState('');
  const [stipendioOreSettimanali, setStipendioOreSettimanali] = useState('40');
  const [stipendioNettoBase, setStipendioNettoBase] = useState('');
  const [stipendioIndennita20724, setStipendioIndennita20724] = useState('103.64');
  const [chatMessaggio, setChatMessaggio] = useState('');
  const [chatMessaggi, setChatMessaggi] = useState([]);
  const [chatMioId, setChatMioId] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    if (screen !== 'listaChat') return;

    let attivo = true;

    const caricaRiepilogo = async () => {
      try {
        const dati = await caricaRiepilogoConversazioni();

        if (attivo) {
          setRiepilogoChat(dati || {});
        }
      } catch (error) {
        console.log('Errore riepilogo chat:', error);
      }
    };

    caricaRiepilogo();

    return () => {
      attivo = false;
    };
  }, [screen]);

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
  const [chatColleghiIds, setChatColleghiIds] = useState([]);
  const [riepilogoChat, setRiepilogoChat] = useState({});
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

  // STIPENDIO: usa SEMPRE e SOLO il mese/anno selezionato
  const turniStipendioMese = turni.filter(
    (t) =>
      Number(t.mese) === Number(mese + 1) &&
      Number(t.anno) === Number(anno)
  );

  const giornateStipendioMese = turniStipendioMese.filter(
    (t) => t.tipo === 'turno'
  );

  const oreStipendioMese = giornateStipendioMese.reduce(
    (tot, t) => tot + Number(t.ore || 0),
    0
  );

  const extraStipendioMese = giornateStipendioMese.reduce(
    (tot, t) => tot + Number(t.extra || 0),
    0
  );

  // Ore ordinarie reali:
  // un turno effettuato durante il riposo resta lavorato,
  // ma le sue ore base non vengono conteggiate come ordinarie.
  const oreOrdinarieStipendioMese = giornateStipendioMese.reduce(
    (tot, t) => {
      if (t.riposo_lavorato === true) {
        return tot;
      }

      return (
        tot +
        Math.max(
          0,
          Number(t.ore || 0) - Number(t.extra || 0)
        )
      );
    },
    0
  );

  const oreRiposoLavoratoMese = giornateStipendioMese.reduce(
    (tot, t) =>
      t.riposo_lavorato === true
        ? tot + Number(t.ore || 0)
        : tot,
    0
  );

  

const mediaOreGiornata =
    giornateStipendioMese.length > 0
      ? oreStipendioMese / giornateStipendioMese.length
      : 0;

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
      console.log(
      '🔎 TURNI CARICATI DAL DATABASE:',
      lista.map(t => ({
        id: t.id,
        giorno: t.giorno,
        mese: t.mese,
        anno: t.anno,
        ore: t.ore,
        extra: t.extra,
        tipo: t.tipo
      }))
    );
const debugLuglio = lista
      .filter(t => Number(t.mese) === 7 && Number(t.anno) === 2026)
      .sort((a, b) => Number(a.giorno) - Number(b.giorno));

    console.log('\n========== LUGLIO 2026 ==========');

    debugLuglio.forEach(t => {
      const g = String(t.giorno).padStart(2, '0');
      const fascia = t.tipo === 'turno'
        ? `${t.inizio || '--'}-${t.fine || '--'}`
        : 'RIPOSO';

      console.log(
        `${g} | ${fascia.padEnd(13)} | ore ${String(t.ore || 0).padStart(4)} | extra ${String(t.extra || 0).padStart(4)} | ${t.tipo}`
      );
    });

    const lavorati = debugLuglio.filter(t => t.tipo === 'turno');
    const totaleOre = lavorati.reduce((s, t) => s + Number(t.ore || 0), 0);
    const totaleExtra = lavorati.reduce((s, t) => s + Number(t.extra || 0), 0);

    console.log('---------------------------------');
    console.log('GIORNI LAVORATI:', lavorati.length);
    console.log('ORE TOTALI:', totaleOre);
    console.log('EXTRA TOTALI:', totaleExtra);
    console.log('ORDINARIE APP:', totaleOre - totaleExtra);
    console.log('=================================\n');
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

  // STIPENDIO: usa SEMPRE e SOLO il mese/anno selezionato
  const turniStipendioMese = turni.filter(
    (t) =>
      Number(t.mese) === Number(mese + 1) &&
      Number(t.anno) === Number(anno)
  );

  const giornateStipendioMese = turniStipendioMese.filter(
    (t) => t.tipo === 'turno'
  );

  const oreDomenicaliMese = giornateStipendioMese.reduce((tot, t) => {
  if (!t.inizio || !t.fine) return tot;

  const giorno = Number(t.giorno);
  const meseTurno = Number(t.mese);
  const annoTurno = Number(t.anno);

  const [hi, mi] = t.inizio.split(':').map(Number);
  const [hf, mf] = t.fine.split(':').map(Number);

  const start = new Date(annoTurno, meseTurno - 1, giorno, hi, mi, 0);
  let end = new Date(annoTurno, meseTurno - 1, giorno, hf, mf, 0);

  if (end <= start) {
    end.setDate(end.getDate() + 1);
  }

  let cursor = new Date(start);
  let minutiDomenicali = 0;

  while (cursor < end) {
    const prossimo = new Date(cursor);
    prossimo.setMinutes(prossimo.getMinutes() + 30);

    const limite = prossimo > end ? end : prossimo;
    const minuti = (limite - cursor) / 60000;

    if (cursor.getDay() === 0) {
      minutiDomenicali += minuti;
    }

    cursor = limite;
  }

  return tot + minutiDomenicali / 60;
}, 0);

const oreStipendioMese = giornateStipendioMese.reduce(
    (tot, t) => tot + Number(t.ore || 0),
    0
  );

  const extraStipendioMese = giornateStipendioMese.reduce(
    (tot, t) => tot + Number(t.extra || 0),
    0
  );

  const mediaOreGiornata =
    giornateStipendioMese.length > 0
      ? oreStipendioMese / giornateStipendioMese.length
      : 0;


  const tabellaLordoGPG = {
    '1': 1992.60,
    '2': 1860.38,
    '3': 1651.31,
    '4': 1468.88,
    '5': 1393.87,
    '6': 1293.87,
  };

  const lordoBaseLivello =
    tabellaLordoGPG[String(stipendioLivello)] || 0;

  
// ===== MOTORE ECONOMICO GPG =====

// Tutti i servizi effettivamente lavorati, compreso il riposo lavorato
const serviziPiantonamentoMese = turniStipendioMese.filter(
  (t) => t.tipo === 'turno'
);

// Turni che attraversano la mezzanotte
const serviziNotturniMese = serviziPiantonamentoMese.filter((t) => {
  if (!t.inizio || !t.fine) return false;

  const [hi, mi] = t.inizio.split(':').map(Number);
  const [hf, mf] = t.fine.split(':').map(Number);

  const start = hi * 60 + mi;
  const end = hf * 60 + mf;

  return end <= start;
}).length;

const serviziDiurniMese =
  Math.max(0, serviziPiantonamentoMese.length - serviziNotturniMese);

const oreRiposoLavoratoMese = turniStipendioMese.reduce(
  (tot, t) =>
    t.riposo_lavorato === true
      ? tot + Number(t.ore || 0)
      : tot,
  0
);

// Tariffe ricavate dal cedolino reale livello 4
const tariffaStraordinario30 = 11.03783;
const tariffaDomenicale = 0.71;
const tariffaPiantonamentoDiurno = 0.65;
const tariffaIndennitaCompensativa = 1.86;
const tariffaPiantonamentoNotturno = 4.18;
const tariffaRiposoLavorato = 11.8869;

const extraPagateMese = giornateStipendioMese.reduce(
  (tot, t) =>
    t.riposo_lavorato === true
      ? tot
      : tot + Number(t.extra || 0),
  0
);

const importoStraordinarioMese =
  extraPagateMese * tariffaStraordinario30;

const importoDomenicaleMese =
  oreDomenicaliMese * tariffaDomenicale;

const importoPiantonamentoDiurnoMese =
  serviziDiurniMese * tariffaPiantonamentoDiurno;

const importoIndennitaCompensativaMese =
  serviziDiurniMese * tariffaIndennitaCompensativa;

const importoPiantonamentoNotturnoMese =
  serviziNotturniMese * tariffaPiantonamentoNotturno;

const importoRiposoLavoratoMese =
  oreRiposoLavoratoMese * tariffaRiposoLavorato;

const indennita20724Numero =
  Number(String(stipendioIndennita20724 || '0').replace(',', '.')) || 0;

const totaleCompetenzeStimate =
  lordoBaseLivello +
  importoStraordinarioMese +
  importoDomenicaleMese +
  importoPiantonamentoDiurnoMese +
  importoIndennitaCompensativaMese +
  importoPiantonamentoNotturnoMese +
  importoRiposoLavoratoMese +
  indennita20724Numero;

console.log('💰 MOTORE STIPENDIO', {
  lordoBaseLivello,
  straordinario: importoStraordinarioMese,
  domenicale: importoDomenicaleMese,
  piantonamentiDiurni: serviziDiurniMese,
  piantonamentiNotturni: serviziNotturniMese,
  riposoLavoratoOre: oreRiposoLavoratoMese,
  totaleCompetenzeStimate
});

// ===== FINE MOTORE ECONOMICO GPG =====

const nettoBaseNumero =
    lordoBaseLivello * 0.78;
  const pagaOrariaStimata = nettoBaseNumero > 0 ? nettoBaseNumero / 173 : 0;
  const maturatoMese = totaleCompetenzeStimate;

// Netto stimato calibrato sul cedolino reale di luglio 2026:
// 1992,00 / 2577,16 = circa 0,7729
const coefficienteNettoStimato = 1992.00 / 2577.16;
const nettoStimatoMese = maturatoMese * coefficienteNettoStimato;
  const mediaNettaGiornata = giornateStipendioMese.length > 0 ? maturatoMese / giornateStipendioMese.length : 0;
  const giorniNelMese = new Date(anno, mese + 1, 0).getDate();
  const previsioneFineMese = giornateStipendioMese.length > 0 ? mediaNettaGiornata * Math.min(giorniNelMese, 26) : nettoBaseNumero;

  const turnoOggi = turniMese.find(
    (t) =>
      Number(t.giorno) === oggi.getDate() &&
      Number(t.mese) === oggi.getMonth() + 1 &&
      Number(t.anno) === oggi.getFullYear()
  );

  const turnoInCorso = turni.find((t) => {
    if (t.tipo !== 'turno' || !t.inizio || !t.fine) return false;

    const giorno = Number(t.giorno);
    const meseTurno = Number(t.mese);
    const annoTurno = Number(t.anno);

    const [hi, mi] = String(t.inizio).split(':').map(Number);
    const [hf, mf] = String(t.fine).split(':').map(Number);

    const inizioTurno = new Date(
      annoTurno,
      meseTurno - 1,
      giorno,
      hi,
      mi,
      0
    );

    const fineTurno = new Date(
      annoTurno,
      meseTurno - 1,
      giorno,
      hf,
      mf,
      0
    );

    // Se finisce dopo mezzanotte, la fine appartiene al giorno successivo
    if (fineTurno <= inizioTurno) {
      fineTurno.setDate(fineTurno.getDate() + 1);
    }

    return oggi >= inizioTurno && oggi < fineTurno;
  });

  const [countdownTurno, setCountdownTurno] = useState('--h --m');
  const [countdownLabel, setCountdownLabel] = useState('FINE TRA');

  useEffect(() => {
    const aggiornaCountdownTurno = () => {
      if (
        !turnoOggi ||
        turnoOggi.tipo !== 'turno' ||
        !turnoOggi.inizio ||
        !turnoOggi.fine
      ) {
        setCountdownLabel(
          turnoOggi?.tipo === 'riposo' ? 'RIPOSO' : 'NESSUN TURNO'
        );
        setCountdownTurno('--h --m');
        return;
      }

      const adesso = new Date();

      const [hInizio, mInizio] = String(turnoOggi.inizio)
        .split(':')
        .map(Number);

      const [hFine, mFine] = String(turnoOggi.fine)
        .split(':')
        .map(Number);

      const inizioTurno = new Date(
        adesso.getFullYear(),
        adesso.getMonth(),
        adesso.getDate(),
        hInizio,
        mInizio,
        0
      );

      const fineTurno = new Date(
        adesso.getFullYear(),
        adesso.getMonth(),
        adesso.getDate(),
        hFine,
        mFine,
        0
      );

      if (fineTurno <= inizioTurno) {
        fineTurno.setDate(fineTurno.getDate() + 1);
      }

      let destinazione;
      let etichetta;

      if (adesso < inizioTurno) {
        destinazione = inizioTurno;
        etichetta = 'INIZIA TRA';
      } else if (adesso < fineTurno) {
        destinazione = fineTurno;
        etichetta = 'FINE TRA';
      } else {
        const prossimoTurno = turni
          .filter((t) =>
            t &&
            t.tipo === 'turno' &&
            t.anno &&
            t.mese &&
            t.giorno &&
            t.inizio
          )
          .map((t) => {
            const [h, m] = String(t.inizio).split(':').map(Number);

            const data = new Date(
              Number(t.anno),
              Number(t.mese) - 1,
              Number(t.giorno),
              h || 0,
              m || 0,
              0
            );

            return { ...t, data };
          })
          .filter((t) => t.data > adesso)
          .sort((a, b) => a.data - b.data)[0];

        if (!prossimoTurno) {
          setCountdownLabel('NESSUN TURNO');
          setCountdownTurno('--h --m');
          return;
        }

        destinazione = prossimoTurno.data;
        etichetta = 'PROSSIMO TURNO';
      }

      const diff = destinazione.getTime() - adesso.getTime();

      const ore = Math.floor(diff / 3600000);
      const minuti = Math.floor((diff % 3600000) / 60000);

      setCountdownLabel(etichetta);
      setCountdownTurno(
        `${String(ore).padStart(2, '0')}h ${String(minuti).padStart(2, '0')}m`
      );
    };

    aggiornaCountdownTurno();

    const timerCountdown = setInterval(aggiornaCountdownTurno, 30000);

    return () => clearInterval(timerCountdown);
  }, [turnoOggi]);


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

            if (t.inizio && t.fine) {
  const [hi, mi] = t.inizio.split(':').map(Number);
  const [hf, mf] = t.fine.split(':').map(Number);

  const inizioMinuti = hi * 60 + mi;
  const fineMinuti = hf * 60 + mf;

  if (fineMinuti <= inizioMinuti) {
    notti += 1;
  }
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

          <View
        style={{
          backgroundColor: '#171F55',
          borderRadius: 24,
          padding: 20,
          marginBottom: 22,
          borderWidth: 1.3,
          borderColor: '#7180FF',
          shadowColor: '#6174FF',
          shadowOpacity: 0.24,
          shadowRadius: 17,
          shadowOffset: { width: 0, height: 8 },
        }}
      >
        <Text
          style={{
            color: '#84DFFF',
            fontSize: 10,
            fontWeight: '900',
            letterSpacing: 1.5,
            marginBottom: 5,
          }}
        >
          RETE OPERATIVA
        </Text>

        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 30,
            fontWeight: '900',
            letterSpacing: -0.5,
          }}
        >
          I miei colleghi
        </Text>

        <Text
          style={{
            color: '#C8D7F4',
            fontSize: 13,
            fontWeight: '700',
            marginTop: 6,
          }}
        >
          Colleghi e contatti di servizio
        </Text>
      </View>

          <View
            style={{
        backgroundColor: '#09182C',
        borderRadius: 21,
        padding: 17,
        marginBottom: 22,
        borderWidth: 1,
        borderColor: '#2D5278',
        shadowColor: '#48D6FF',
        shadowOpacity: 0.10,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },
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
          backgroundColor: '#0D2038',
          color: '#FFFFFF',
          borderWidth: 1.2,
          borderColor: '#37658E',
          borderRadius: 15,
          paddingVertical: 14,
          paddingHorizontal: 15,
          marginBottom: 12,
          fontWeight: '700',
          shadowColor: '#48D6FF',
          shadowOpacity: 0.06,
          shadowRadius: 8,
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
          backgroundColor: '#1368E8',
          paddingVertical: 15,
          paddingHorizontal: 16,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1.2,
          borderColor: '#58DFFF',
          shadowColor: '#42CFFF',
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
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
            <Text style={{ color: '#45E36F', fontWeight: '700' }}>
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
                backgroundColor: '#0B1930',
                borderRadius: 20,
                padding: 17,
                marginBottom: 13,
                borderWidth: 1.2,
                borderColor: '#375A82',
                shadowColor: '#4A7CFF',
                shadowOpacity: 0.13,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
              }}
                      >
                        <Text
                          style={{
                  color: '#FFFFFF',
                  fontWeight: '900',
                  fontSize: 19,
                  letterSpacing: -0.2,
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
                backgroundColor: '#176C47',
                paddingVertical: 12,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: '#55E894',
                shadowColor: '#55E894',
                shadowOpacity: 0.16,
                shadowRadius: 8,
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
                backgroundColor: '#4A2029',
                paddingVertical: 12,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: '#D45E72',
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
                    backgroundColor: '#07101F',
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
                backgroundColor: '#111B49',
                borderRadius: 22,
                padding: 18,
                marginBottom: 14,
                borderWidth: 1.5,
                borderColor: '#7180FF',
                shadowColor: '#6174FF',
                shadowOpacity: 0.28,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 7 },
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

                      <View
              style={{
                flexDirection: 'row',
                gap: 8,
                marginTop: 14,
                marginBottom: 8,
              }}
            >
              {/* PROFILO COLLEGA */}
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => {
                  setCollegaSelezionato(c);
                  setScreen('profiloCollega');
                }}
                style={{
                  flex: 1,
                  backgroundColor: '#192B55',
                  borderRadius: 16,
                  paddingVertical: 13,
                  paddingHorizontal: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.2,
                  borderColor: '#7180FF',
                }}
              >
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontWeight: '900',
                    fontSize: 13,
                  }}
                >
                  👤 PROFILO
                </Text>
              </TouchableOpacity>

              {/* CHAT PRIVATA */}
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => {
                  setCollegaSelezionato(c);
                  setChatMessaggio('');
                  setScreen('chatCollega');
                }}
                style={{
                  flex: 1,
                  backgroundColor: '#0D7FA3',
                  borderRadius: 16,
                  paddingVertical: 13,
                  paddingHorizontal: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.2,
                  borderColor: '#72E7FF',
                  shadowColor: '#45DFFF',
                  shadowOpacity: 0.20,
                  shadowRadius: 9,
                }}
              >
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontWeight: '900',
                    fontSize: 13,
                  }}
                >
                  💬 CHAT
                </Text>
              </TouchableOpacity>
            </View>

                  <TouchableOpacity
                        onPress={async () => {
                          try {
                            await rimuoviCollega(c.id);
                            await aggiornaColleghi();
                          } catch (error) {
                            Alert.alert('Errore', error.message);
                          }
                        }}
                        style={{
                marginTop: 7,
                alignSelf: 'flex-start',
                paddingVertical: 7,
                paddingHorizontal: 11,
                borderRadius: 11,
                backgroundColor: '#2A151D',
                borderWidth: 1,
                borderColor: '#713443',
              }}
                      >
                        <Text
                          style={{
                  color: '#FF8FA3',
                  fontWeight: '900',
                  fontSize: 13,
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

  if (screen === 'stipendio') {
    return (
      <Screen>
        <Back onPress={() => setScreen('home')} />

        <Text
          style={{
        color: '#73DFFF',
        fontSize: 13,
        fontWeight: '900',
        marginBottom: 10,
        letterSpacing: 1.2,
      }}
        >
          STIPENDIO
        </Text>

        <View
          style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
          padding: 8,
          borderRadius: 20,
          backgroundColor: '#09172B',
          borderWidth: 1,
          borderColor: '#29496E',
          shadowColor: '#49CFFF',
          shadowOpacity: 0.10,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 5 },
        }}
        >
          <TouchableOpacity
            onPress={mesePrecedente}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: '#07101F',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: '#5a8cff',
                fontSize: 30,
                fontWeight: '900',
                marginTop: -3,
              }}
            >
              ‹
            </Text>
          </TouchableOpacity>

          <Text
            style={{
              color: 'white',
              fontSize: 28,
              fontWeight: '900',
              textAlign: 'center',
              flex: 1,
            }}
          >
            {MESI[mese]} {anno}
          </Text>

          <TouchableOpacity
            onPress={meseSuccessivo}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: '#07101F',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: '#5a8cff',
                fontSize: 30,
                fontWeight: '900',
                marginTop: -3,
              }}
            >
              ›
            </Text>
          </TouchableOpacity>
        </View>

        <Text
          style={{
            color: '#9fb2d9',
            fontSize: 14,
            marginBottom: 22,
          }}
        >
          Calcolo riferito esclusivamente al mese selezionato
        </Text>

        <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 9,
            paddingVertical: 12,
            paddingHorizontal: 13,
            borderRadius: 15,
            backgroundColor: '#102719',
            borderWidth: 1,
            borderColor: '#3E9B58',
          }}>
  <Text style={{ color: '#dfe6ff', fontSize: 14 }}>
    🛌 Riposo lavorato
  </Text>
  <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '900' }}>
    {giornateStipendioMese
      .filter((t) => t.riposo_lavorato === true)
      .reduce((tot, t) => tot + Number(t.ore || 0), 0)
      .toFixed(1)} h
  </Text>
</View>

<View
          style={{
          backgroundColor: '#152E70',
          borderRadius: 24,
          padding: 20,
          marginBottom: 16,
          borderWidth: 1.3,
          borderColor: '#667CFF',
          shadowColor: '#536BFF',
          shadowOpacity: 0.30,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
        }}
        >
          <Text
            style={{
              color: '#5a8cff',
              fontSize: 11,
              fontWeight: '900',
            }}
          >
            ORE LAVORATE
          </Text>

          <Text
            style={{
              color: 'white',
              fontSize: 28,
              fontWeight: '900',
              marginTop: 5,
            }}
          >
            {oreStipendioMese.toFixed(1)} h
          </Text>

          <Text
            style={{
              color: '#9fb2d9',
              fontSize: 13,
              marginTop: 8,
            }}
          >
            Extra: {giornateStipendioMese.reduce(
  (tot, t) =>
    t.riposo_lavorato === true
      ? tot
      : tot + Number(t.extra || 0),
  0
).toFixed(1)} h · Giorni lavorati: {giornateStipendioMese.filter(
  (t) => t.riposo_lavorato !== true
).length}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: '#284cff',
            borderRadius: 20,
            padding: 18,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              color: '#dfe6ff',
              fontSize: 11,
              fontWeight: '900',
            }}
          >
            MATURATO DEL MESE
          </Text>

          <Text
            style={{
              color: 'white',
              fontSize: 30,
              fontWeight: '900',
              marginTop: 5,
            }}
          >
            € {maturatoMese.toFixed(2)}
          </Text>

    <Text
      style={{
        color: '#9fb2d9',
        fontSize: 13,
        fontWeight: '700',
        marginTop: 8,
      }}
    >
      Netto stimato
    </Text>

    <Text
      style={{
        color: '#43ed63',
        fontSize: 22,
        fontWeight: '900',
        marginTop: 2,
      }}
    >
      € {nettoStimatoMese.toFixed(2)}
    </Text>
        </View>

        <View
          style={{
          backgroundColor: '#09182C',
          borderRadius: 20,
          padding: 17,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: '#2E5A83',
          shadowColor: '#40D7FF',
          shadowOpacity: 0.12,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 5 },
        }}
        >
          <Text
            style={{
              color: '#5a8cff',
              fontSize: 11,
              fontWeight: '900',
            }}
          >
            PREVISIONE FINE MESE
          </Text>

          <Text
            style={{
              color: '#35e58b',
              fontSize: 27,
              fontWeight: '900',
              marginTop: 5,
            }}
          >
            € {previsioneFineMese.toFixed(2)}
          </Text>

          <Text
            style={{
              color: '#9fb2d9',
              fontSize: 12,
              marginTop: 7,
            }}
          >
            Media maturata: € {mediaNettaGiornata.toFixed(2)} per giornata
          </Text>
        </View>


        <View
          style={{
          backgroundColor: '#09182C',
          borderRadius: 22,
          padding: 18,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: '#2E537C',
          shadowColor: '#43D5FF',
          shadowOpacity: 0.10,
          shadowRadius: 13,
          shadowOffset: { width: 0, height: 5 },
        }}
        >
          <Text
            style={{
              color: '#5a8cff',
              fontSize: 11,
              fontWeight: '900',
              marginBottom: 14,
            }}
          >
            DETTAGLIO ORE · {MESI[mese].toUpperCase()} {anno}
          </Text>

          <View
            style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 9,
            paddingVertical: 12,
            paddingHorizontal: 13,
            borderRadius: 15,
            backgroundColor: '#0D2038',
            borderWidth: 1,
            borderColor: '#31506F',
          }}
          >
            <Text style={{ color: '#dfe6ff', fontSize: 14 }}>
              🕐 Ore totali
            </Text>
            <Text style={{ color: 'white', fontSize: 15, fontWeight: '900' }}>
              {oreStipendioMese.toFixed(1)} h
            </Text>
          </View>

          <View
            style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 9,
            paddingVertical: 12,
            paddingHorizontal: 13,
            borderRadius: 15,
            backgroundColor: '#0C1D34',
            borderWidth: 1,
            borderColor: '#2B4663',
          }}
          >
            <Text style={{ color: '#dfe6ff', fontSize: 14 }}>
              ○ Ore ordinarie
            </Text>
            <Text style={{ color: 'white', fontSize: 15, fontWeight: '900' }}>
              {Math.max(
  0,
  oreStipendioMese -
  extraStipendioMese -
  giornateStipendioMese.reduce(
    (tot, t) =>
      t.riposo_lavorato === true
        ? tot + Math.max(0, Number(t.ore || 0) - Number(t.extra || 0))
        : tot,
    0
  )
).toFixed(1)} h
            </Text>
          </View>

          <View
            style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 9,
            paddingVertical: 12,
            paddingHorizontal: 13,
            borderRadius: 15,
            backgroundColor: '#2A2111',
            borderWidth: 1,
            borderColor: '#B67A22',
          }}
          >
            <Text style={{ color: '#dfe6ff', fontSize: 14 }}>
              ⭐ Straordinari
            </Text>
            <Text style={{ color: '#ffd54a', fontSize: 15, fontWeight: '900' }}>
              {giornateStipendioMese.reduce(
  (tot, t) =>
    t.riposo_lavorato === true
      ? tot
      : tot + Number(t.extra || 0),
  0
).toFixed(1)} h
            </Text>
          </View>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Text style={{ color: '#dfe6ff', fontSize: 14 }}>
              🌙 Turni notturni
            </Text>
            <Text style={{ color: '#c7b8ff', fontSize: 15, fontWeight: '900' }}>
              {statistiche.notti}
            </Text>
          </View>

<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
  <Text style={{ color: '#dfe6ff', fontSize: 14 }}>
    ☀️ Ore domenicali
  </Text>
  <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '900' }}>
    {oreDomenicaliMese.toFixed(1)} h
  </Text>
</View>

          <View
            style={{
              height: 1,
              backgroundColor: '#284cff',
              marginVertical: 4,
              marginBottom: 12,
            }}
          />

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#dfe6ff', fontSize: 14 }}>
              📅 Giorni lavorati
            </Text>
            <Text style={{ color: '#35e58b', fontSize: 15, fontWeight: '900' }}>
              {giornateStipendioMese.filter(
  (t) => t.riposo_lavorato !== true
).length}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setScreen('configuraStipendio')}
          style={{
            backgroundColor: '#284cff',
            borderRadius: 14,
            padding: 14,
            marginTop: 8,
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
      </Screen>
    );
  }

  if (screen === 'configuraStipendio') {
    return (
      <Screen>
        <Back onPress={() => setScreen('stipendio')} />

        <Text
          style={{
            color: '#5a8cff',
            fontSize: 12,
            fontWeight: '900',
            marginBottom: 8,
          }}
        >
          CONFIGURAZIONE
        </Text>

        <Text
          style={{
            color: 'white',
            fontSize: 28,
            fontWeight: '900',
            marginBottom: 6,
          }}
        >
          Configura stipendio
        </Text>

        <Text
          style={{
            color: '#9fb2d9',
            fontSize: 14,
            marginBottom: 22,
          }}
        >
          Indica livello e orario contrattuale. Al resto pensa Vigilanza GPG.
        </Text>

        <View
          style={{
            backgroundColor: '#07101F',
            borderRadius: 20,
            padding: 18,
            gap: 14,
          }}
        >
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
            <Text
              style={{
                color: 'white',
                fontSize: 15,
                fontWeight: '700',
              }}
            >
              Vigilanza Privata e Servizi di Sicurezza
            </Text>

            <Text
              style={{
                color: '#5a8cff',
                fontSize: 12,
                marginTop: 5,
              }}
            >
              Calcolo automatico da contratto
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={async () => {
            try {
              await AsyncStorage.setItem(
                '@vigilanza_gpg_stipendio',
                JSON.stringify({
                  ccnl: stipendioCCNL,
                  livello: stipendioLivello,
                  oreSettimanali: stipendioOreSettimanali,
                  nettoBase: stipendioNettoBase,
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
            marginTop: 18,
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
            SALVA CONFIGURAZIONE
          </Text>
        </TouchableOpacity>
      </Screen>
    );
  }

  if (screen === 'listaChat') {
    return (
      <Screen>
        <Back onPress={() => setScreen('home')} />

        <Text style={{
          color: 'white',
          fontSize: 30,
          fontWeight: '900',
          marginBottom: 6
        }}>
          💬 Chat
        </Text>

        <Text style={{
          color: '#9fb2d9',
          fontSize: 15,
          marginBottom: 22
        }}>
          Messaggi con i tuoi colleghi
        </Text>

        {colleghi.length === 0 ? (
          <Text style={{ color: '#9fb2d9', fontSize: 16 }}>
            Nessun collega disponibile
          </Text>
        ) : (
          colleghi.map((c) => (
            <TouchableOpacity
              key={c.id}
              onPress={() => {
                setCollegaSelezionato(c);
                setChatMessaggio('');
                setScreen('chatCollega');
              }}
              onLongPress={() => {
                Alert.alert(
                  'Elimina conversazione',
                  'Vuoi eliminare definitivamente tutti i messaggi di questa conversazione?',
                  [
                    { text: 'Annulla', style: 'cancel' },
                    {
                      text: 'Elimina',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await eliminaConversazione(c.altro_user_id);
                          setChatColleghiIds(prev => prev.filter(id => id !== c.altro_user_id));
                          setChatMessaggi([]);
                          Alert.alert('Conversazione eliminata');
                        } catch (e) {
                          Alert.alert(
                            'Errore',
                            e?.message || 'Non è stato possibile eliminare la conversazione.'
                          );
                        }
                      },
                    },
                  ]
                );

              }}
              style={{
                backgroundColor: '#102968',
                borderRadius: 16,
                padding: 16,
                marginBottom: 12
              }}
            >
              <Text style={{
                color: 'white',
                fontSize: 18,
                fontWeight: '800'
              }}>
                👤 {c.profilo?.nome || ''} {c.profilo?.cognome || ''}
              </Text>

              <Text style={{
                color: '#9fb2d9',
                marginTop: 5
              }}>
                {c.profilo?.azienda || 'Collega'}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </Screen>
    );
  }


  if (screen === 'listaChat') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#07142f' }}>
        <ScrollView
          contentContainerStyle={{
            padding: 22,
            paddingBottom: 50
          }}
        >
          <TouchableOpacity
            onPress={() => setScreen('home')}
            style={{ marginBottom: 20 }}
          >
            <Text style={{ color: 'white', fontSize: 28 }}>‹</Text>
          </TouchableOpacity>

          <Text
            style={{
              color: 'white',
              fontSize: 30,
              fontWeight: '800',
              marginBottom: 4
            }}
          >
            💬 Chat
          </Text>

          <View
        style={{
          backgroundColor: '#171F55',
          borderRadius: 24,
          padding: 20,
          marginBottom: 20,
          borderWidth: 1.3,
          borderColor: '#7180FF',
          shadowColor: '#6174FF',
          shadowOpacity: 0.24,
          shadowRadius: 17,
          shadowOffset: { width: 0, height: 8 },
        }}
      >
        <Text
          style={{
            color: '#84DFFF',
            fontSize: 10,
            fontWeight: '900',
            letterSpacing: 1.5,
            marginBottom: 5,
          }}
        >
          MESSAGGI
        </Text>

        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 29,
            fontWeight: '900',
            letterSpacing: -0.5,
          }}
        >
          Le tue conversazioni
        </Text>

        <Text
          style={{
            color: '#C8D7F4',
            fontSize: 13,
            fontWeight: '700',
            marginTop: 6,
          }}
        >
          Conversazioni con i tuoi colleghi
        </Text>
      </View>

          {colleghi.length === 0 ? (
            <Text style={{ color: '#9fb2d9', fontSize: 16 }}>
              Nessun collega disponibile.
            </Text>
          ) : (
            colleghi
              .filter((c) => chatColleghiIds.includes(c.altro_user_id))
              .map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => {
                  setCollegaSelezionato(c);
                  setChatMessaggio('');
                  setScreen('chatCollega');
                }}
                style={{
              backgroundColor: '#101D3F',
              borderRadius: 19,
              padding: 17,
              marginBottom: 12,
              borderWidth: 1.2,
              borderColor: '#385B86',
              shadowColor: '#4D79FF',
              shadowOpacity: 0.13,
              shadowRadius: 11,
              shadowOffset: { width: 0, height: 5 },
            }}
              >
                <Text
                  style={{
                color: '#FFFFFF',
                fontSize: 19,
                fontWeight: '900',
                letterSpacing: -0.2,
              }}
                >
                  👤 {c.profilo?.nome || ''} {c.profilo?.cognome || ''}
                </Text>

                <Text
                  style={{
                color: '#9FC3E8',
                marginTop: 6,
                fontSize: 12,
                fontWeight: '700',
              }}
                >
                  {[c.profilo?.azienda, c.profilo?.codice_gpg]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>

            {(() => {
              const r = riepilogoChat[c.altro_user_id];

              if (!r) {
                return (
                  <Text
                    style={{
                      color: '#6F89A9',
                      fontSize: 12,
                      marginTop: 9,
                    }}
                  >
                    Nessun messaggio recente
                  </Text>
                );
              }

              const ora = r.created_at
                ? new Date(r.created_at).toLocaleTimeString('it-IT', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '';

              return (
                <View
                  style={{
                    marginTop: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      color: r.nonLetti > 0 ? '#FFFFFF' : '#A9BAD1',
                      fontSize: 13,
                      fontWeight: r.nonLetti > 0 ? '900' : '600',
                      marginRight: 10,
                    }}
                  >
                    {r.ultimoMessaggio || 'Messaggio'}
                  </Text>

                  <View
                    style={{
                      alignItems: 'flex-end',
                      gap: 5,
                    }}
                  >
                    <Text
                      style={{
                        color: '#8EA5C2',
                        fontSize: 10,
                        fontWeight: '800',
                      }}
                    >
                      {ora}
                    </Text>

                    {r.nonLetti > 0 ? (
                      <View
                        style={{
                          minWidth: 20,
                          height: 20,
                          borderRadius: 10,
                          paddingHorizontal: 6,
                          backgroundColor: '#4FE3A1',
                          alignItems: 'center',
                          justifyContent: 'center',
                          shadowColor: '#4FE3A1',
                          shadowOpacity: 0.35,
                          shadowRadius: 8,
                        }}
                      >
                        <Text
                          style={{
                            color: '#061A12',
                            fontSize: 10,
                            fontWeight: '900',
                          }}
                        >
                          {r.nonLetti}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })()}


                {c.profilo?.sede ? (
                  <Text
                    style={{
                      color: '#9fb2d9',
                      marginTop: 3,
                      fontSize: 13
                    }}
                  >
                    📍 {c.profilo.sede}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'chatCollega') {
    const c = collegaSelezionato;
    const p = c?.profilo || {};

    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <Screen>
        <Back onPress={() => setScreen('listaChat')} />

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
                <TouchableOpacity
                  key={m.id}
            activeOpacity={0.85}
            onLongPress={() => {
              if (!mio) return;
              Alert.alert(
                'Elimina messaggio',
                'Vuoi eliminare definitivamente questo messaggio?',
                [
                  { text: 'Annulla', style: 'cancel' },
                  {
                    text: 'Elimina',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await eliminaMessaggio(m.id);
                        setChatMessaggi(prev => prev.filter(msg => msg.id !== m.id));
                      } catch (e) {
                        Alert.alert('Errore', 'Non è stato possibile eliminare il messaggio.');
                      }
                    },
                  },
                ]
              );
            }}
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
                </TouchableOpacity>
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
              backgroundColor: '#07101F',
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
      </KeyboardAvoidingView>
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
            backgroundColor: '#07101F',
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
            backgroundColor: '#07101F',
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
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#09172A',
          borderWidth: 1,
          borderColor: '#1D3558',
          borderRadius: 18,
          paddingVertical: 10,
          paddingHorizontal: 10,
          marginTop: 10,
          marginBottom: 14,
        }}
      >
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Ionicons name="sunny" size={16} color="#20EDF2" />
          <Text style={{
            color: '#AFC0D7',
            fontSize: 8,
            fontWeight: '800',
            marginTop: 3
          }}>
            Mattina
          </Text>
        </View>

        <View style={{ alignItems: 'center', flex: 1 }}>
          <Ionicons name="sunny-outline" size={16} color="#FF9D3D" />
          <Text style={{
            color: '#AFC0D7',
            fontSize: 8,
            fontWeight: '800',
            marginTop: 3
          }}>
            Serale
          </Text>
        </View>

        <View style={{ alignItems: 'center', flex: 1 }}>
          <Ionicons name="moon" size={15} color="#A77CFF" />
          <Text style={{
            color: '#AFC0D7',
            fontSize: 8,
            fontWeight: '800',
            marginTop: 3
          }}>
            Notturno
          </Text>
        </View>

        <View style={{ alignItems: 'center', flex: 1 }}>
          <View style={{
            backgroundColor: '#2B3B57',
            borderRadius: 8,
            paddingHorizontal: 5,
            paddingVertical: 2,
          }}>
            <Text style={{
              color: '#D0DCF0',
              fontSize: 8,
              fontWeight: '900'
            }}>
              RIP
            </Text>
          </View>

          <Text style={{
            color: '#AFC0D7',
            fontSize: 8,
            fontWeight: '800',
            marginTop: 3
          }}>
            Riposo
          </Text>
        </View>
      </View>



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
            () => { setEditingId(null); setScreen("turni"); }
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
              ? 'DETTAGLIO TURNO'
              : 'NUOVO TURNO'}
          </Text>
        </View>

        
      {/* RIEPILOGO DETTAGLIO TURNO */}
      {modifica && (
        <View
          style={{
            backgroundColor: '#0B1930',
            borderRadius: 22,
            padding: 17,
            marginBottom: 18,
            borderWidth: 1.3,
            borderColor: '#4E72FF',
            shadowColor: '#536BFF',
            shadowOpacity: 0.22,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 7 },
          }}
        >
          <Text
            style={{
              color: '#79DFFF',
              fontSize: 10,
              fontWeight: '900',
              letterSpacing: 1.2,
            }}
          >
            RIEPILOGO TURNO
          </Text>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              marginTop: 10,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 27,
                  fontWeight: '900',
                }}
              >
                {inizio || '--:--'} - {fine || '--:--'}
              </Text>

              <Text
                style={{
                  color: '#B9C8DF',
                  fontSize: 13,
                  fontWeight: '700',
                  marginTop: 5,
                }}
              >
                📍 {luogo || 'Luogo non indicato'}
              </Text>
            </View>

            {(() => {
              const [hi, mi] = String(inizio || '00:00')
                .split(':')
                .map(Number);

              const [hf, mf] = String(fine || '00:00')
                .split(':')
                .map(Number);

              let minuti = (hf * 60 + mf) - (hi * 60 + mi);

              if (minuti <= 0) {
                minuti += 24 * 60;
              }

              const oreDurata = Math.floor(minuti / 60);
              const minDurata = minuti % 60;

              return (
                <View
                  style={{
                    paddingHorizontal: 11,
                    paddingVertical: 8,
                    borderRadius: 14,
                    backgroundColor: 'rgba(69,215,255,0.09)',
                    borderWidth: 1,
                    borderColor: '#45D7FF',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: '#78E7FF',
                      fontSize: 9,
                      fontWeight: '900',
                    }}
                  >
                    DURATA
                  </Text>

                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 17,
                      fontWeight: '900',
                      marginTop: 2,
                    }}
                  >
                    {minDurata === 0
                      ? `${oreDurata}h`
                      : `${oreDurata}h ${minDurata}m`}
                  </Text>
                </View>
              );
            })()}
          </View>

          <View
            style={{
              flexDirection: 'row',
              marginTop: 14,
              gap: 8,
            }}
          >
            <View
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 13,
                backgroundColor: '#10213A',
              }}
            >
              <Text
                style={{
                  color: '#8399B8',
                  fontSize: 9,
                  fontWeight: '900',
                }}
              >
                GIORNO
              </Text>

              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 15,
                  fontWeight: '900',
                  marginTop: 3,
                }}
              >
                {String(giorno).padStart(2, '0')} {MESI[mese].toUpperCase()}
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 13,
                backgroundColor: '#10213A',
              }}
            >
              <Text
                style={{
                  color: '#8399B8',
                  fontSize: 9,
                  fontWeight: '900',
                }}
              >
                EXTRA
              </Text>

              <Text
                style={{
                  color: Number(extra || 0) > 0 ? '#FFD166' : '#FFFFFF',
                  fontSize: 15,
                  fontWeight: '900',
                  marginTop: 3,
                }}
              >
                {Number(extra || 0) > 0 ? `${extra}h` : '0h'}
              </Text>
            </View>
          </View>
        </View>
      )}

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

    const turniLavorati = ordinati.filter(t =>
  t.tipo === "turno" &&
  Number(t.mese) === mese + 1 &&
  Number(t.anno) === anno
);
    const minutiTotali = turniLavorati.reduce((tot, t) => {
      if (!t.inizio || !t.fine) return tot;
      const [hi, mi] = t.inizio.split(":").map(Number);
      const [hf, mf] = t.fine.split(":").map(Number);
      let minuti = (hf * 60 + mf) - (hi * 60 + mi);
      if (minuti < 0) minuti += 24 * 60;
      return tot + minuti;
    }, 0);
    const oreTotali = Math.round(minutiTotali / 60);
    const minutiStraordinari = turniLavorati.reduce((tot, t) => {
      if (!t.inizio || !t.fine) return tot;
      const [hi, mi] = t.inizio.split(":").map(Number);
      const [hf, mf] = t.fine.split(":").map(Number);
      let minuti = (hf * 60 + mf) - (hi * 60 + mi);
      if (minuti < 0) minuti += 24 * 60;
      return tot + Math.max(0, minuti - 480);
    }, 0);
    const oreStraordinari = Math.round(minutiStraordinari / 60);
    const turniNotte = turniLavorati.filter(t => {
      if (!t.inizio || !t.fine) return false;

      const [hi, mi] = t.inizio.split(':').map(Number);
      const [hf, mf] = t.fine.split(':').map(Number);

      const inizioMinuti = hi * 60 + mi;
      const fineMinuti = hf * 60 + mf;

      // Per il cedolino consideriamo notturno il turno
      // che prosegue oltre la mezzanotte.
      return fineMinuti <= inizioMinuti;
    }).length;
    return (
      <Screen
      showScrollTop
      contentOffset={{
        x: 0,
        y: (() => {
          const adesso = new Date();

          if (
            Number(mese) !== adesso.getMonth() ||
            Number(anno) !== adesso.getFullYear()
          ) {
            return 0;
          }

          const indice = ordinati.findIndex(
            (t) => Number(t.giorno) === adesso.getDate()
          );

          if (indice < 0) return 0;

          return Math.max(0, 170 + indice * 126);
        })(),
      }}
    >
        <Back
          onPress={
            tornaHome
          }
        />

        <View style={{
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 18,
        padding: 20,
        borderRadius: 24,
        backgroundColor: '#171F55',
        borderWidth: 1.3,
        borderColor: '#7180FF',
        shadowColor: '#6174FF',
        shadowOpacity: 0.28,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        overflow: 'hidden',
      }}>
          <Text style={{
        color: '#84DFFF',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1.5,
        marginBottom: 5,
      }}>
            AREA PERSONALE
          </Text>

          <Text style={{
        color: '#FFFFFF',
        fontSize: 30,
        fontWeight: '900',
        letterSpacing: -0.5,
        paddingRight: 100,
      }}>
            I miei turni
          </Text>

      {/* BADGE TURNI HEADER */}
      <View
        style={{
          position: 'absolute',
          top: 20,
          right: 18,
          paddingHorizontal: 11,
          paddingVertical: 7,
          borderRadius: 14,
          backgroundColor: 'rgba(89,222,255,0.11)',
          borderWidth: 1,
          borderColor: '#55DFFF',
          shadowColor: '#55DFFF',
          shadowOpacity: 0.24,
          shadowRadius: 9,
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            color: '#9AECFF',
            fontSize: 9,
            fontWeight: '900',
            letterSpacing: 0.8,
          }}
        >
          TURNI
        </Text>

        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 17,
            fontWeight: '900',
            marginTop: 1,
          }}
        >
          {turniLavorati.length}
        </Text>
      </View>


          <Text style={{
        color: '#C8D7F4',
        fontSize: 13,
        fontWeight: '700',
        marginTop: 6,
      }}>
            {MESI[mese]} {anno} · riepilogo attività
          </Text>
        </View>

        <Text
          style={
            styles.subtitle
          }
        >
          {MESI[mese]}{' '}
          {anno}
        </Text>
        <View style={{ backgroundColor: "#07152E", borderRadius: 16, borderWidth: 1, borderColor: "rgba(72,132,255,0.30)", marginTop: 14, marginBottom: 16, paddingVertical: 16, paddingHorizontal: 8 }}>
          <View style={{
        flexDirection: 'row',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        gap: 5,

        backgroundColor: '#09172D',
        borderRadius: 20,
        borderWidth: 1.2,
        borderColor: '#3D5F8E',

        marginTop: 12,
        marginBottom: 14,

        paddingVertical: 7,
        paddingHorizontal: 6,

        shadowColor: '#45CFFF',
        shadowOpacity: 0.10,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      }}>
            <View style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 8,
          marginHorizontal: 2,
          borderRadius: 14,
          backgroundColor: 'rgba(43,73,125,0.22)',
        }}>
              <Ionicons name="calendar-outline" size={23} color="#5EDBFF" />
              <Text style={{ color: "#8997B2", fontSize: 10, marginTop: 6 }}>GIORNI LAVORATI</Text>
              <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800", marginTop: 2 }}>{turniLavorati.length}</Text>
            </View>
            <View style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 8,
          marginHorizontal: 2,
          borderRadius: 14,
          backgroundColor: 'rgba(43,73,125,0.22)',
        }}>
              <Ionicons name="time-outline" size={23} color="#79E4FF" />
              <Text style={{ color: "#8997B2", fontSize: 10, marginTop: 6 }}>ORE TOTALI</Text>
              <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800", marginTop: 2 }}>{oreTotali}h</Text>
            </View>
            <View style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 8,
          marginHorizontal: 2,
          borderRadius: 14,
          backgroundColor: 'rgba(43,73,125,0.22)',
        }}>
              <Ionicons name="star" size={22} color="#AFC8F5" />
              <Text style={{ color: "#8997B2", fontSize: 10, marginTop: 6 }}>STRAORD.</Text>
              <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800", marginTop: 2 }}>{oreStraordinari}h</Text>
            </View>
            <View style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 8,
          marginHorizontal: 2,
          borderRadius: 14,
          backgroundColor: 'rgba(43,73,125,0.22)',
        }}>
              <Ionicons name="moon-outline" size={23} color="#A98BFF" />
              <Text style={{ color: "#8997B2", fontSize: 10, marginTop: 6 }}>NOTTI</Text>
              <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800", marginTop: 2 }}>{giornateStipendioMese.filter((t) => {
  if (!t.inizio || !t.fine) return false;

  const [hi, mi] = t.inizio.split(':').map(Number);
  const [hf, mf] = t.fine.split(':').map(Number);

  const start = hi * 60 + mi;
  const end = hf * 60 + mf;

  return end <= start;
}).length}</Text>
            </View>
          </View>
        </View>

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
            (t) => (<React.Fragment key={String(t.id)}>
                {/* SEPARATORE DA OGGI V1 */}
                {(() => {
                  const adessoSep = new Date();

                  const eOggiSep =
                    Number(t.giorno) === adessoSep.getDate() &&
                    Number(mese) === adessoSep.getMonth() &&
                    Number(anno) === adessoSep.getFullYear();

                  if (!eOggiSep) return null;

                  return (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginTop: 12,
                        marginBottom: 12,
                        gap: 9,
                      }}
                    >
                      <View
                        style={{
                          flex: 1,
                          height: 1,
                          backgroundColor: '#315A78',
                        }}
                      />

                      <View
                        style={{
                          paddingHorizontal: 11,
                          paddingVertical: 5,
                          borderRadius: 11,
                          backgroundColor: 'rgba(77,216,255,0.10)',
                          borderWidth: 1,
                          borderColor: '#45D7FF',
                        }}
                      >
                        <Text
                          style={{
                            color: '#7BE7FF',
                            fontSize: 9.5,
                            fontWeight: '900',
                            letterSpacing: 1,
                          }}
                        >
                          DA OGGI IN POI
                        </Text>
                      </View>

                      <View
                        style={{
                          flex: 1,
                          height: 1,
                          backgroundColor: '#315A78',
                        }}
                      />
                    </View>
                  );
                })()}

                
              <TouchableOpacity
          key={String(t.id)}
          style={[
                    styles.turnCard,

                    t.tipo !== 'turno' && {
                      backgroundColor: '#0B3823',
                      borderColor: '#52E487',
                      borderWidth: 1.5,
                    },

                    t.tipo === 'turno' &&
                      (() => {
                        const ora = Number(
                          String(t.inizio || '00:00').split(':')[0]
                        );

                        const [h1, m1] = String(t.inizio || '00:00')
                          .split(':')
                          .map(Number);

                        const [h2, m2] = String(t.fine || '00:00')
                          .split(':')
                          .map(Number);

                        const startMin = h1 * 60 + m1;
                        const endMin = h2 * 60 + m2;

                        const notte =
                          ora >= 20 ||
                          ora < 5 ||
                          endMin <= startMin;

                        if (notte) {
                          return {
                            backgroundColor: '#21194A',
                            borderColor: '#8066FF',
                            borderWidth: 1.5,
                          };
                        }

                        if (ora < 12) {
                          return {
                            backgroundColor: '#0B3040',
                            borderColor: '#43DFFF',
                            borderWidth: 1.5,
                          };
                        }

                        return {
                          backgroundColor: '#3A2618',
                          borderColor: '#FFA24A',
                          borderWidth: 1.5,
                        };
                      })(),
                  ]}
          onPress={() => modificaGiorno(t)}
        >
          
                
                {/* BADGE OGGI PROSSIMO V3 */}
                {(() => {
                  const adesso = new Date();

                  const giornoCard = Number(t.giorno);

                  const eOggi =
                    giornoCard === adesso.getDate() &&
                    Number(mese) === adesso.getMonth() &&
                    Number(anno) === adesso.getFullYear();

                  const futuri = ordinati
                    .filter((x) => {
                      if (!x || x.tipo !== 'turno') return false;

                      const [hh, mm] = String(x.inizio || '00:00')
                        .split(':')
                        .map(Number);

                      const dataX = new Date(
                        Number(anno),
                        Number(mese),
                        Number(x.giorno),
                        hh || 0,
                        mm || 0,
                        0
                      );

                      return dataX > adesso;
                    })
                    .sort((a, b) => {
                      const [ha, ma] = String(a.inizio || '00:00')
                        .split(':')
                        .map(Number);

                      const [hb, mb] = String(b.inizio || '00:00')
                        .split(':')
                        .map(Number);

                      const da = new Date(
                        Number(anno),
                        Number(mese),
                        Number(a.giorno),
                        ha || 0,
                        ma || 0
                      );

                      const db = new Date(
                        Number(anno),
                        Number(mese),
                        Number(b.giorno),
                        hb || 0,
                        mb || 0
                      );

                      return da - db;
                    });

                  const prossimo = futuri[0];

                  const eProssimo =
                    !eOggi &&
                    prossimo &&
                    Number(t.giorno) === Number(prossimo.giorno) &&
                    String(t.inizio || '') === String(prossimo.inizio || '');

                  if (!eOggi && !eProssimo) return null;

                  return (
                    <View
                      style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        zIndex: 99,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 11,
                        backgroundColor: eOggi
                          ? '#59F28B'
                          : '#FFD166',
                        borderWidth: 1.2,
                        borderColor: eOggi
                          ? '#B8FFD0'
                          : '#FFE49C',
                        shadowColor: eOggi
                          ? '#59F28B'
                          : '#FFD166',
                        shadowOpacity: 0.45,
                        shadowRadius: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: '#06121C',
                          fontSize: 9.5,
                          fontWeight: '900',
                          letterSpacing: 0.7,
                        }}
                      >
                        {eOggi ? 'OGGI' : 'PROSSIMO'}
                      </Text>
                    </View>
                  );
                })()}

<View style={styles.dayBadge}>
            <Text style={{ color: '#AFC8F5', fontSize: 11, fontWeight: '800' }}>
                {giorniSettimana[new Date(t.data).getDay()]?.toUpperCase() || "---"}
            </Text>

            <Text style={styles.dayBig}>
              {String(t.giorno).padStart(2, '0')}
            </Text>

            <Text style={{ color: '#AFC8F5', fontSize: 10, fontWeight: '700' }}>
              {MESI[mese].toUpperCase()}
            </Text>
          </View>

          
                {/* DURATA TURNO V1 */}
                {t.tipo === 'turno' && (() => {
                  const [hi, mi] = String(t.inizio || '00:00')
                    .split(':')
                    .map(Number);

                  const [hf, mf] = String(t.fine || '00:00')
                    .split(':')
                    .map(Number);

                  let minuti =
                    (hf * 60 + mf) -
                    (hi * 60 + mi);

                  if (minuti <= 0) {
                    minuti += 24 * 60;
                  }

                  const ore = Math.floor(minuti / 60);
                  const min = minuti % 60;

                  const durata =
                    min === 0
                      ? `${ore}h`
                      : `${ore}h ${String(min).padStart(2, '0')}m`;

                  const extra = Number(t.extra || 0);

                  return (
                    <View
                      style={{
                        position: 'absolute',
                        right: 10,
                        bottom: 10,
                        alignItems: 'flex-end',
                      }}
                    >
                      <Text
                        style={{
                          color: '#FFFFFF',
                          fontSize: 13,
                          fontWeight: '900',
                        }}
                      >
                        {durata}
                      </Text>

                      {extra > 0 && (
                        <Text
                          style={{
                            color: '#FFD166',
                            fontSize: 9,
                            fontWeight: '900',
                            marginTop: 2,
                          }}
                        >
                          +{extra}h EXTRA
                        </Text>
                      )}
                    </View>
                  );
                })()}

<View style={{ flex: 1, paddingLeft: 4 }}>
            {t.tipo === 'turno' ? (
              <>
                <Text style={styles.turnTitle}>
                  {Number(t.inizio?.split(':')[0]) >= 20 || Number(t.inizio?.split(':')[0]) < 6 ? '🌙 ' : '☀️ '}
                  {`${formattaOra(t.inizio)} – ${formattaOra(t.fine)}`}
                </Text>

                <Text style={styles.turnSub}>
                  ◉ {t.fascia || 'Servizio'}
                </Text>

                <Text style={styles.turnSub}>
                  ♧ {t.luogo || 'Luogo non indicato'}
                </Text>

                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  marginTop: 7,
                  gap: 6,
                }}>
                  <View style={{
                    backgroundColor: 'rgba(63,93,170,0.25)',
                    borderWidth: 1,
                    borderColor: 'rgba(130,160,255,0.20)',
                    borderRadius: 8,
                    paddingHorizontal: 9,
                    paddingVertical: 4,
                  }}>
                    <Text style={{
                      color: '#EAF1FF',
                      fontSize: 11,
                      fontWeight: '800',
                    }}>
                      TURNO
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={{
                  color: '#55E47B',
                  fontSize: 18,
                  fontWeight: '900',
                }}>
                  🍃 RIPOSO
                </Text>

                <Text style={{
                  color: '#A7CDB2',
                  fontSize: 12,
                  fontWeight: '600',
                  marginTop: 5,
                }}>
                  ◉ Giornata non lavorata
                </Text>
              </>
            )}
          </View>
        </TouchableOpacity>
            
              </React.Fragment>)
          )
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >

        {/* HEADER WOW */}
        <View style={{paddingHorizontal:20,paddingTop:10,paddingBottom:18}}>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
            <TouchableOpacity onPress={apriProfilo} style={{flex:1}}>
              <Text style={{color:'#FFFFFF',fontSize:19,fontWeight:'700'}}>
                Buon servizio,
              </Text>
              <Text style={{color:'#FFFFFF',fontSize:32,fontWeight:'900',lineHeight:35}}>
                {profilo.nome} 👋
              </Text>
              <Text style={{color:'#AEB9D6',fontSize:13,fontWeight:'700',marginTop:5}}>
                {profilo.azienda}{' • '}{profilo.ruolo}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={apriProfilo}
              style={{
                width:64,height:64,borderRadius:32,
                borderWidth:2,borderColor:'#8DB8FF',
                alignItems:'center',justifyContent:'center',
                overflow:'hidden',backgroundColor:'#142044'
              }}
            >
              {fotoProfilo ? (
                <Image
                  source={{uri:fotoProfilo}}
                  style={{width:'100%',height:'100%'}}
                />
              ) : (
                <Ionicons name="person" size={30} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>

          <View style={{
            alignSelf:'flex-start',marginTop:13,
            backgroundColor:'rgba(41,255,102,0.10)',
            borderRadius:20,paddingHorizontal:12,paddingVertical:7
          }}>
            <Text style={{color:'#42F56C',fontWeight:'900',fontSize:12}}>
              {turnoInCorso ? '● IN SERVIZIO' : '🌿 FUORI SERVIZIO'}
            </Text>
          </View>
        </View>

        {/* MESE */}
        <View style={{
        marginHorizontal: 16,
        marginBottom: 17,
        padding: 18,
        borderRadius: 24,
        backgroundColor: '#101A3D',
        borderWidth: 1.2,
        borderColor: '#526BFF',
        shadowColor: '#526BFF',
        shadowOpacity: 0.25,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      }}>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
            <Text style={{color:'#FFFFFF',fontSize:18,fontWeight:'900'}}>
              AGOSTO 2026
            </Text>
            <Ionicons name="calendar-outline" size={23} color="#C9B6FF" />
          </View>

          <View style={{flexDirection:'row',marginTop:16,gap:8}}>
            <View style={{flex:1,backgroundColor:'#0B1638',borderRadius:15,padding:12}}>
              <Ionicons name="time-outline" size={24} color="#9FB1FF" />
              <Text style={{color:'white',fontSize:23,fontWeight:'900',marginTop:9}}>
                169,5h
              </Text>
              <Text style={{color:'#B8C1DA',fontSize:10,fontWeight:'800'}}>LAVORATE</Text>
            </View>

            <View style={{flex:1,backgroundColor:'#0B1638',borderRadius:15,padding:12}}>
              <Ionicons name="star-outline" size={24} color="#FFD24A" />
              <Text style={{color:'white',fontSize:23,fontWeight:'900',marginTop:9}}>
                38h
              </Text>
              <Text style={{color:'#B8C1DA',fontSize:10,fontWeight:'800'}}>EXTRA</Text>
            </View>

            <View style={{flex:1,backgroundColor:'#0B1638',borderRadius:15,padding:12}}>
              <Ionicons name="calendar-number-outline" size={24} color="#FFB7EA" />
              <Text style={{color:'white',fontSize:23,fontWeight:'900',marginTop:9}}>
                19
              </Text>
              <Text style={{color:'#B8C1DA',fontSize:10,fontWeight:'800'}}>GIORNI</Text>
            </View>
          </View>

          <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:16}}>
            <Text style={{color:'#AEB9D6',fontSize:11,fontWeight:'800'}}>AVANZAMENTO MESE</Text>
            <Text style={{color:'#FFFFFF',fontSize:12,fontWeight:'900'}}>
                {Math.round((new Date().getDate() / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()) * 100)}%
              </Text>
          </View>

          <View style={{height:6,borderRadius:10,backgroundColor:'#19264A',marginTop:7,overflow:'hidden'}}>
              <View style={{
                height:'100%',
                width:`${Math.round((new Date().getDate() / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()) * 100)}%`,
                borderRadius:10,
                backgroundColor:'#9CFF45'
              }}/>
            <View style={{width:'68%',height:'100%',borderRadius:10,backgroundColor:'#53E36D'}} />
          </View>
        </View>

        {/* TURNO OGGI */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setScreen('calendar')}
          style={{
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 18,
        borderRadius: 23,

        backgroundColor: turnoInCorso
          ? '#07160F'
          : '#09182C',

        borderWidth: 1.5,

        borderColor: turnoInCorso
          ? '#5AF47C'
          : '#42CFFF',

        shadowColor: turnoInCorso
          ? '#5AF47C'
          : '#42CFFF',

        shadowOpacity: turnoInCorso ? 0.32 : 0.18,
        shadowRadius: 17,
        shadowOffset: { width: 0, height: 7 },
      }}
        >
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-end'}}>
            <View style={{flex:1}}>
              <Text style={{color:'#4BE66B',fontSize:12,fontWeight:'900'}}>
                TURNO DI OGGI
              </Text>

        <Text style={{color:'#FFFFFF',fontSize:29,fontWeight:'900',marginTop:8}}>
          {turnoOggi
            ? (turnoOggi.tipo === 'turno'
                ? `${turnoOggi.inizio || '--:--'} - ${turnoOggi.fine || '--:--'}`
                : '🌿 RIPOSO')
            : '--:-- - --:--'}
        </Text>

        <Text style={{color:'#C8D0E0',fontSize:14,marginTop:6}}>
                📍 {turnoOggi ? (turnoOggi.luogo || 'Luogo non indicato') : 'Luogo non indicato'}
              </Text>
            </View>

            <View style={{
          minWidth: 108,
          paddingHorizontal: 11,
          paddingVertical: 9,
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor: turnoInCorso ? '#6BFF84' : '#58D7FF',
          backgroundColor: turnoInCorso
            ? 'rgba(70,255,105,0.10)'
            : 'rgba(70,200,255,0.08)',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: turnoInCorso ? '#6BFF84' : '#58D7FF',
          shadowOpacity: 0.25,
          shadowRadius: 10,
        }}>
          <Text style={{
            color: turnoInCorso ? '#8CFF9D' : '#83E4FF',
            fontSize: 9,
            fontWeight: '900',
            letterSpacing: 0.8,
          }}>
            {countdownLabel}
          </Text>

          <Text style={{
            color: '#FFFFFF',
            fontSize: 18,
            fontWeight: '900',
            marginTop: 4,
          }}>
            {countdownTurno}
          </Text>
        </View>
          </View>
        </TouchableOpacity>

        {/* STIPENDIO */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setScreen('stipendio')}
          style={{
        marginHorizontal: 16,
        marginBottom: 15,
        backgroundColor: '#0B1930',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#3B6EA5',
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#3FCFFF',
        shadowOpacity: 0.14,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
      }}
        >
          <Ionicons name="wallet-outline" size={25} color="#55E86E" />
          <View style={{flex:1,marginLeft:13}}>
            <Text style={{color:'#FFFFFF',fontSize:14,fontWeight:'900'}}>
              STIPENDIO
            </Text>
            <Text style={{color:'#AEB7CB',fontSize:11,marginTop:3}}>
              Calcola quanto stai maturando questo mese →
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        {/* COLLEGA */}
        <View style={{
        marginHorizontal: 16,
        marginBottom: 18,
        padding: 17,
        borderRadius: 21,
        backgroundColor: '#0C1728',
        borderWidth: 1,
        borderColor: '#2B4568',
        shadowColor: '#45CFFF',
        shadowOpacity: 0.09,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },
      }}>
          <Text style={{color:'#4BE66B',fontSize:12,fontWeight:'900',marginBottom:10}}>
            IN SERVIZIO CON TE
          </Text>

          <Text style={{color:'#FFFFFF',fontSize:14,fontWeight:'700'}}>
            Nessun collega collegato in servizio oggi
          </Text>

          <TouchableOpacity onPress={caricaTurni} style={{marginTop:10}}>
            <Text style={{color:'#4BE66B',fontSize:12,fontWeight:'900'}}>
              ↻ Aggiorna
            </Text>
          </TouchableOpacity>
        </View>

        {/* ACCESSI RAPIDI */}
      <View style={{
        marginHorizontal: 16,
        marginBottom: 20,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 24,
        backgroundColor: '#081426',
        borderWidth: 1,
        borderColor: '#365170',
        flexDirection: 'row',
        gap: 6,

        shadowColor: '#4E74FF',
        shadowOpacity: 0.18,
        shadowRadius: 17,
        shadowOffset: { width: 0, height: 6 },
      }}>

        <TouchableOpacity
          onPress={() => {
            setEditingId(null);
            setScreen('turni');
          }}
          style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 11,
        borderRadius: 17,
      }}
        >
          <Ionicons name="calendar-outline" size={26} color="#7FDBFF" />
          <Text style={{
          color: '#D9F5FF',
          fontSize: 9.5,
          fontWeight: '900',
          marginTop: 7,
          letterSpacing: 0.25,
        }}>TURNI</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setEditingId(null);
            setScreen('calendar');
          }}
          style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 11,
        borderRadius: 17,
      }}
        >
          <Ionicons name="calendar-number-outline" size={26} color="#7FDBFF" />
          <Text style={{
          color: '#D9F5FF',
          fontSize: 9.5,
          fontWeight: '900',
          marginTop: 7,
          letterSpacing: 0.25,
        }}>CALENDARIO</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setScreen('colleghi');
            aggiornaColleghi();
          }}
          style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 11,
        borderRadius: 17,
      }}
        >
          <Ionicons name="people-outline" size={26} color="#7FDBFF" />
          <Text style={{
          color: '#D9F5FF',
          fontSize: 9.5,
          fontWeight: '900',
          marginTop: 7,
          letterSpacing: 0.25,
        }}>COLLEGHI</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={async () => {
            try {
              await aggiornaColleghi();
              const ids = await colleghiConConversazione();
              setChatColleghiIds(ids);
              setScreen('listaChat');
            } catch (e) {
              Alert.alert('Errore', e?.message || 'Impossibile caricare le conversazioni.');
            }
          }}
          style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 11,
        borderRadius: 17,
      }}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={26} color="#7FDBFF" />
          <Text style={{
          color: '#D9F5FF',
          fontSize: 9.5,
          fontWeight: '900',
          marginTop: 7,
          letterSpacing: 0.25,
        }}>CHAT</Text>
        </TouchableOpacity>

      </View>
      </ScrollView>
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

            const tipoRiposo =
            !record ||
            record.tipo === 'riposo';

          const oraInizio =
            record?.inizio
              ? Number(String(record.inizio).split(':')[0])
              : null;

          const turnoNotte =
            record &&
            record.tipo === 'turno' &&
            oraInizio !== null &&
            (oraInizio >= 20 || oraInizio < 5);

          const turnoMattina =
            record &&
            record.tipo === 'turno' &&
            oraInizio !== null &&
            oraInizio >= 5 &&
            oraInizio < 13;

          const turnoSerale =
            record &&
            record.tipo === 'turno' &&
            !turnoNotte &&
            !turnoMattina;

          const colore =
            turnoNotte
              ? '#A77CFF'
              : turnoMattina
              ? '#20EDF2'
              : turnoSerale
              ? '#FF9D3D'
              : '#B8C7DF';

          const sfondo =
            turnoNotte
              ? '#1B1740'
              : turnoMattina
              ? '#07333D'
              : turnoSerale
              ? '#362318'
              : '#17243A';

          const bordo =
            turnoNotte
              ? '#6847E8'
              : turnoMattina
              ? '#0A8293'
              : turnoSerale
              ? '#915327'
              : '#30415F';

          const icona =
            turnoNotte
              ? 'moon'
              : turnoMattina
              ? 'sunny'
              : turnoSerale
              ? 'sunny-outline'
              : null;

          const oggiCalendario = new Date();

          const eOggi =
            Number(day) === oggiCalendario.getDate() &&
            Number(mese) === oggiCalendario.getMonth() &&
            Number(anno) === oggiCalendario.getFullYear();

          const prossimiTurni = records
            .filter((r) => {
              if (
                r.tipo !== 'turno' ||
                !r.inizio
              ) {
                return false;
              }

              const [h, m] = String(r.inizio)
                .split(':')
                .map(Number);

              const dataTurno = new Date(
                anno,
                mese,
                Number(r.giorno),
                h,
                m,
                0
              );

              return dataTurno > oggiCalendario;
            })
            .sort((a, b) => {
              const [ha, ma] = String(a.inizio).split(':').map(Number);
              const [hb, mb] = String(b.inizio).split(':').map(Number);

              const da = new Date(
                anno,
                mese,
                Number(a.giorno),
                ha,
                ma,
                0
              );

              const db = new Date(
                anno,
                mese,
                Number(b.giorno),
                hb,
                mb,
                0
              );

              return da - db;
            });

          const prossimoTurno =
            prossimiTurni.length > 0
              ? prossimiTurni[0]
              : null;

          const eProssimo =
            !eOggi &&
            prossimoTurno &&
            Number(day) === Number(prossimoTurno.giorno);

          return (
            <TouchableOpacity
              key={`giorno-${day}`}
              activeOpacity={0.72}
              onPress={() =>
                onPress(
                  day,
                  record || null
                )
              }
              style={{
                width: '14.285%',
                aspectRatio: 0.82,
                padding: 2.5,
              }}
            >
              <View
                style={{
                  flex: 1,
                  borderRadius: 14,
                  borderWidth:
                    eOggi
                      ? 2.5
                      : eProssimo
                      ? 2
                      : 1,
                  borderColor:
                    eOggi
                      ? '#6FE8FF'
                      : eProssimo
                      ? '#FFD166'
                      : record
                      ? bordo
                      : '#26354D',
                  backgroundColor:
                    eOggi
                      ? '#10395A'
                      : eProssimo
                      ? '#3A3018'
                      : record
                      ? sfondo
                      : '#111D32',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 2,

                  shadowColor:
                    eOggi
                      ? '#5EDBFF'
                      : eProssimo
                      ? '#FFD166'
                      : record
                      ? colore
                      : '#000000',
                  shadowOpacity:
                    eOggi
                      ? 0.75
                      : eProssimo
                      ? 0.50
                      : record
                      ? 0.20
                      : 0.04,
                  shadowRadius:
                    eOggi
                      ? 16
                      : eProssimo
                      ? 12
                      : record
                      ? 7
                      : 2,
                  shadowOffset: {
                    width: 0,
                    height: 3,
                  },
                }}
              >
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 15,
                    fontWeight: '900',
                    marginBottom:
                      record ? 4 : 0,
                  }}
                >
                  {day}
                </Text>

                {record && (
                  tipoRiposo ? (
                    <View
                      style={{
                        backgroundColor: '#2B3B57',
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 10,
                      }}
                    >
                      <Text
                        style={{
                          color: '#D0DCF0',
                          fontSize: 8,
                          fontWeight: '900',
                        }}
                      >
                        RIP
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(0,0,0,0.18)',
                        paddingHorizontal: 4,
                        paddingVertical: 2,
                        borderRadius: 10,
                      }}
                    >
                      <Ionicons
                        name={icona}
                        size={10}
                        color={colore}
                        style={{
                          marginRight: 2,
                        }}
                      />

                      <View
                        style={{
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            color: colore,
                            fontSize: 8.5,
                            fontWeight: '900',
                            lineHeight: 10,
                          }}
                        >
                          {formattaOra(record.inizio)}
                        </Text>

                        <Text
                          style={{
                            color: colore,
                            fontSize: 8,
                            fontWeight: '900',
                            lineHeight: 9,
                          }}
                        >
                          {formattaOra(record.fine)}
                        </Text>
                      </View>
                    </View>
                  )
                )}
              </View>
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
  contentOffset,
  showScrollTop = false,
}) {
  const screenScrollRef = React.useRef(null);
  const [mostraTornaSu, setMostraTornaSu] = React.useState(false);
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
      
      contentOffset={contentOffset}
    
      ref={screenScrollRef}
      onScroll={(event) => {
        if (!showScrollTop) return;

        const y = event.nativeEvent.contentOffset.y;
        setMostraTornaSu(y > 450);
      }}
      scrollEventThrottle={16}
    >
        {children}
      </ScrollView>
    
      {/* PULSANTE TORNA SU */}
      {showScrollTop && mostraTornaSu && (
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => {
            screenScrollRef.current?.scrollTo({
              y: 0,
              animated: true,
            });
          }}
          style={{
            position: 'absolute',
            right: 18,
            bottom: 24,
            zIndex: 999,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 13,
            paddingVertical: 10,
            borderRadius: 18,
            backgroundColor: '#10294A',
            borderWidth: 1.2,
            borderColor: '#58DFFF',
            shadowColor: '#58DFFF',
            shadowOpacity: 0.35,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
          }}
        >
          <Text
            style={{
              color: '#8CEBFF',
              fontSize: 17,
              fontWeight: '900',
              marginRight: 5,
            }}
          >
            ↑
          </Text>

          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 10,
              fontWeight: '900',
              letterSpacing: 0.7,
            }}
          >
            TORNA SU
          </Text>
        </TouchableOpacity>
      )}

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


function HomeServiceCard({ icon, title, subtitle, onPress, wide = false }) {
  return (
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={onPress}
      style={{
        width: wide ? '100%' : '48.5%',
        minHeight: wide ? 88 : 138,
        backgroundColor: wide ? '#102B5B' : '#07172F',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: wide
          ? 'rgba(89, 166, 255, 0.90)'
          : 'rgba(77, 143, 255, 0.60)',
        padding: 15,
        marginBottom: 12,
        overflow: 'hidden',
        flexDirection: wide ? 'row' : 'column',
        alignItems: wide ? 'center' : 'flex-start',
        justifyContent: 'center',

        shadowColor: '#526CFF',
        shadowOffset: { width: 0, height: 7 },
        shadowOpacity: wide ? 0.28 : 0.16,
        shadowRadius: 14,
        elevation: 6,
      }}
    >

      {/* alone decorativo */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: wide ? 170 : 115,
          height: wide ? 170 : 115,
          borderRadius: 100,
          backgroundColor: wide
            ? 'rgba(42, 120, 255, 0.16)'
            : 'rgba(42, 120, 255, 0.11)',
          right: -45,
          top: -50,
        }}
      />

      {/* linea luminosa superiore */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 22,
          width: wide ? 120 : 55,
          height: 2,
          borderRadius: 2,
          backgroundColor: '#64B5FF',
          opacity: 0.85,
        }}
      />

      {/* icona */}
      <View
        style={{
          width: wide ? 48 : 46,
          height: wide ? 48 : 46,
          borderRadius: 15,
          backgroundColor: '#123B78',
          borderWidth: 1,
          borderColor: '#4C9CFF',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: wide ? 0 : 12,
          marginRight: wide ? 15 : 0,

          shadowColor: '#526CFF',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.50,
          shadowRadius: 9,
          elevation: 5,
        }}
      >
        <Ionicons
          name={icon}
          size={wide ? 25 : 24}
          color="#8CC8FF"
        />
      </View>

      {/* testi */}
      <View
        style={{
          flex: wide ? 1 : 0,
          width: wide ? undefined : '100%',
        }}
      >
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: wide ? 17 : 16,
            fontWeight: '900',
            marginBottom: 4,
            letterSpacing: -0.25,
          }}
        >
          {title}
        </Text>

        <Text
          numberOfLines={2}
          style={{
            color: '#A9BFE3',
            fontSize: 11.5,
            lineHeight: 15,
            paddingRight: wide ? 5 : 15,
            fontWeight: '500',
          }}
        >
          {subtitle}
        </Text>
      </View>

      {/* freccia */}
      <View
        style={{
          position: wide ? 'relative' : 'absolute',
          right: wide ? 0 : 14,
          top: wide ? 0 : 15,
          marginLeft: wide ? 10 : 0,
        }}
      >
        <Ionicons
          name="chevron-forward"
          size={wide ? 24 : 21}
          color="#82BCFF"
        />
      </View>

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
  const config =
    label === 'EXTRA'
      ? {
          icon: 'flash',
          color: '#20EDF2',
          border: '#147F91',
          bg: '#073646',
        }
      : label === 'NOTTI'
      ? {
          icon: 'moon',
          color: '#A77CFF',
          border: '#6547D8',
          bg: '#20184B',
        }
      : {
          icon: 'time-outline',
          color: '#34BFFF',
          border: '#245FDA',
          bg: '#0A2C64',
        };

  return (
    <View
      style={{
        flex: 1,
        minHeight: 112,
        marginHorizontal: 4,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: config.border,
        backgroundColor: config.bg,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        shadowColor: config.color,
        shadowOpacity: 0.22,
        shadowRadius: 14,
        shadowOffset: {
          width: 0,
          height: 7,
        },
      }}
    >
      <Ionicons
        name={config.icon}
        size={24}
        color={config.color}
        style={{
          marginBottom: 7,
        }}
      />

      <Text
        style={{
          color: '#FFFFFF',
          fontSize: 22,
          fontWeight: '900',
          textAlign: 'center',
        }}
      >
        {value}
      </Text>

      <Text
        style={{
          color: config.color,
          fontSize: 10,
          fontWeight: '900',
          letterSpacing: 0.8,
          marginTop: 5,
        }}
      >
        {label === 'ORE' ? 'ORE TOTALI' : label}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
    paddingHorizontal: 8,
    paddingTop: 14,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(111, 181, 255, 0.22)",
  },

    welcome: {
    color: COLORS.white,
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: -1.2,
    lineHeight: 32,
    textShadowColor: 'rgba(74, 144, 255, 0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    },

    company: {
    color: '#9FC5FF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
    letterSpacing: 0.35,
    opacity: 0.95,
    },

    avatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#173A75',
    borderWidth: 2,
    borderColor: '#67B5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 14,
    overflow: 'hidden',
    shadowColor: '#4C9BFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 10,
    elevation: 8,
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
      backgroundColor: '#1368E8',
      borderRadius: 18,
      paddingVertical: 17,
      paddingHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.3,
      borderColor: '#58DFFF',
      marginTop: 8,
      marginBottom: 10,
      shadowColor: '#42CFFF',
      shadowOpacity: 0.32,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 7 },
    },

    saveText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '900',
      letterSpacing: 0.7,
    },

    syncButton: {
    minHeight: 58,
    borderRadius: 20,
    marginTop: 15,
    marginBottom: 8,
    backgroundColor: '#173A86',
    borderWidth: 1.5,
    borderColor: '#44CFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#32C8FF',
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8,
  },

    syncText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.4,
    textAlign: 'center',
    textShadowColor: 'rgba(68, 207, 255, 0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
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
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#10213A',
      borderWidth: 1,
      borderColor: '#315276',
      shadowColor: '#42CFFF',
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      marginBottom: 14,
    },

    backText: {
      color: '#FFFFFF',
      fontSize: 25,
      fontWeight: '900',
      lineHeight: 27,
    },

    title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 3,
    textShadowColor: 'rgba(66, 140, 255, 0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,

    },

    subtitle: {
    color: '#8FA6C9',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 18,

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
    backgroundColor: '#101F38',
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#294E83',
    shadowColor: '#2E7DFF',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },

    },

    arrow: {
    color: '#5EDBFF',
    fontSize: 38,
    fontWeight: '900',
    paddingHorizontal: 16,
    textShadowColor: 'rgba(94, 219, 255, 0.65)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,

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
    backgroundColor: '#09172A',
    borderRadius: 24,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1D3558',
    shadowColor: '#246BFD',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },

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
      color: '#8EDFFF',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1,
      marginBottom: 8,
      marginTop: 4,
    },

    types: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
      marginBottom: 18,
    },

    type: {
      paddingVertical: 11,
      paddingHorizontal: 13,
      borderRadius: 14,
      backgroundColor: '#10213A',
      borderWidth: 1,
      borderColor: '#315276',
      marginRight: 6,
      marginBottom: 7,
      alignItems: 'center',
      justifyContent: 'center',
    },

    typeSelected: {
      backgroundColor:
        COLORS.blue,
    },

    typeText: {
      color: '#DFF7FF',
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.2,
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
      backgroundColor: '#10213A',
      paddingVertical: 13,
      paddingHorizontal: 8,
      marginHorizontal: 3,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#294B70',
      alignItems: 'center',
      justifyContent: 'center',
    },

    quickText: {
      color: '#DDF7FF',
      fontWeight: '900',
      fontSize: 12,
      letterSpacing: 0.2,
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
      backgroundColor: '#0B1930',
      borderWidth: 1.2,
      borderColor: '#315276',
      borderRadius: 16,
      paddingVertical: 15,
      paddingHorizontal: 16,
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
      shadowColor: '#42CFFF',
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },

    restButton: {
      backgroundColor: '#10213A',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#315276',
      paddingVertical: 15,
      paddingHorizontal: 14,
      marginBottom: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },

    restButtonOn: {
      backgroundColor: '#123A26',
      borderRadius: 16,
      borderWidth: 1.4,
      borderColor: '#54E887',
      shadowColor: '#54E887',
      shadowOpacity: 0.18,
      shadowRadius: 10,
    },

    restText: {
      color: '#FFFFFF',
      fontWeight: '900',
      fontSize: 13,
    },

    deleteButton: {
      paddingVertical: 15,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
      backgroundColor: '#29131A',
      borderWidth: 1,
      borderColor: '#7A3446',
      marginTop: 8,
      marginBottom: 16,
    },

    deleteText: {
      color: '#FF718D',
      fontWeight: '900',
      fontSize: 13,
      letterSpacing: 0.3,
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
    backgroundColor: '#101B36',
    borderRadius: 15,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 96,
    borderWidth: 1,
    borderColor: 'rgba(91,120,255,0.38)',
    shadowColor: '#315BFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },

  dayBadge: {
    width: 68,
    minHeight: 76,
    borderRadius: 12,
    backgroundColor: 'rgba(38,63,125,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(122,151,255,0.20)',
    paddingVertical: 5,
  },

  dayBig: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
  },

  turnTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 17,
    letterSpacing: 0.2,
  },

  turnSub: {
    color: '#AFC8F5',
    fontSize: 12,
    fontWeight: '600',
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

/* ===== TURNI PREMIUM ===== */
