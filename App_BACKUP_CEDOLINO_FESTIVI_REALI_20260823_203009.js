import {
  Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Linking,
  Keyboard,
  Share,
} from 'react-native';
import LoginScreen from './LoginScreen';
import {
  caricaMessaggi,
  inviaMessaggio,
  mioUserId,
  eliminaMessaggio,
  eliminaConversazione,
  colleghiConConversazione,
  caricaRiepilogoConversazioni,
  segnaMessaggiComeLetti,
} from './chatApi';
import { caricaTurniUtente, creaTurnoUtente, aggiornaTurnoUtente, eliminaTurnoUtente } from './turniApi';
import { supabase } from './supabase';
import { caricaProfiloUtente, salvaProfiloUtente, caricaFotoProfilo, eliminaFotoProfiloCloud } from './profiliApi';
import { caricaColleghi, aggiungiCollega, rimuoviCollega, accettaCollega, rifiutaCollega } from './colleghiApi';
import { caricaColleghiInServizio } from './servizioApi';
import React, { useRef, useEffect, useMemo, useState } from 'react';
import * as Clipboard from 'expo-clipboard';

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


function KeyboardDoneOverlay() {
  const [keyboardInfo, setKeyboardInfo] =
    React.useState({
      visible: false,
      height: 0,
    });

  React.useEffect(() => {
    const show = Keyboard.addListener(
      'keyboardWillShow',
      (event) => {
        setKeyboardInfo({
          visible: true,
          height:
            event?.endCoordinates?.height || 0,
        });
      }
    );

    const hide = Keyboard.addListener(
      'keyboardWillHide',
      () => {
        setKeyboardInfo({
          visible: false,
          height: 0,
        });
      }
    );

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (!keyboardInfo.visible) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: keyboardInfo.height,
        zIndex: 99999,
      }}
    >
      <View
        style={{
          minHeight: 46,

          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',

          paddingHorizontal: 14,
          paddingVertical: 5,

          backgroundColor:
            'rgba(10,21,39,0.97)',

          borderTopWidth: 1,
          borderTopColor:
            'rgba(89,211,255,0.24)',
        }}
      >
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => Keyboard.dismiss()}
          style={{
            minWidth: 92,
            height: 36,

            paddingHorizontal: 14,

            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',

            borderRadius: 12,

            backgroundColor:
              'rgba(20,136,176,0.98)',

            borderWidth: 1,
            borderColor:
              'rgba(106,232,255,0.68)',

            shadowColor: '#58DFFF',
            shadowOpacity: 0.18,
            shadowRadius: 8,
          }}
        >
          <Ionicons
            name="checkmark"
            size={17}
            color="#FFFFFF"
          />

          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 10,
              fontWeight: '900',
              letterSpacing: 0.7,
              marginLeft: 5,
            }}
          >
            FINE
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}


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
  const chatScrollRef = useRef(null);

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

    /* ===== LIVE LISTA CHAT ===== */
  useEffect(() => {
    if (screen !== 'listaChat') return;

    let attivo = true;

    const aggiornaListaChat = async () => {
      try {
        const [riepilogo, idsConversazioni] = await Promise.all([
          caricaRiepilogoConversazioni(),
          colleghiConConversazione(),
        ]);

        if (!attivo) return;

        setRiepilogoChat(riepilogo || {});
        setChatColleghiIds(idsConversazioni || []);
      } catch (error) {
        console.log('Errore aggiornamento live chat:', error);
      }
    };

    aggiornaListaChat();

    const timer = setInterval(() => {
      aggiornaListaChat();
    }, 4000);

    return () => {
      attivo = false;
      clearInterval(timer);
    };
  }, [screen]);

useEffect(() => {
    if (screen !== 'chatCollega') return;

    const timer = setTimeout(() => {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    }, 120);

    return () => clearTimeout(timer);
  }, [screen, chatMessaggi.length]);

  useEffect(() => {
    if (screen !== 'chatCollega') return;

    const destinatarioId = collegaSelezionato?.altro_user_id;

    if (!destinatarioId) return;

    segnaMessaggiComeLetti(destinatarioId)
      .catch((error) => {
        console.log('Errore lettura messaggi:', error);
      });


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

  /* ===== POSTAZIONI / CONSEGNE SITO ===== */
  const [postazioniSalvate, setPostazioniSalvate] = useState([]);
  const [postazioneSelezionata, setPostazioneSelezionata] = useState(null);

  const [postazioneNomeDraft, setPostazioneNomeDraft] = useState('');
  const [postazioneZonaDraft, setPostazioneZonaDraft] = useState('');
  const [postazioneAttivitaDraft, setPostazioneAttivitaDraft] = useState('');

  const [postazioneTimelineDraft, setPostazioneTimelineDraft] =
    useState([]);

  const [postazioneOraNuova, setPostazioneOraNuova] =
    useState('');

  const [postazioneAttivitaNuova, setPostazioneAttivitaNuova] =
    useState('');

  const normalizzaOraPostazione = (valore) => {
    const raw = String(valore || '')
      .trim()
      .replace('.', ':');

    const m = raw.match(/^(\d{1,2}):(\d{2})$/);

    if (!m) return null;

    const h = Number(m[1]);
    const min = Number(m[2]);

    if (
      h < 0 ||
      h > 23 ||
      min < 0 ||
      min > 59
    ) {
      return null;
    }

    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  };

  const ordinaTimelinePostazione = (lista) => {
    return [...lista].sort((a, b) => {
      const oa = normalizzaOraPostazione(a?.ora) || '99:99';
      const ob = normalizzaOraPostazione(b?.ora) || '99:99';

      return oa.localeCompare(ob);
    });
  };

  const aggiungiAttivitaPostazione = () => {
    const ora =
      normalizzaOraPostazione(
        postazioneOraNuova
      );

    const testo =
      postazioneAttivitaNuova.trim();

    if (!ora) {
      Alert.alert(
        'Ora non valida',
        'Inserisci un orario nel formato HH:MM, ad esempio 18:30.'
      );
      return;
    }

    if (!testo) {
      Alert.alert(
        'Attività mancante',
        'Scrivi cosa deve essere fatto a quell’orario.'
      );
      return;
    }

    const nuova = {
      id: `attivita_${Date.now()}`,
      ora,
      testo,
    };

    setPostazioneTimelineDraft(
      ordinaTimelinePostazione([
        ...postazioneTimelineDraft,
        nuova,
      ])
    );

    setPostazioneOraNuova('');
    setPostazioneAttivitaNuova('');
  };

  const eliminaAttivitaPostazione = (id) => {
    setPostazioneTimelineDraft(
      postazioneTimelineDraft.filter(
        (x) => x.id !== id
      )
    );
  };

  const [postazioneChiaviDraft, setPostazioneChiaviDraft] = useState('');
  const [postazioneNoteDraft, setPostazioneNoteDraft] = useState('');
  const [postazioneContattiDraft, setPostazioneContattiDraft] = useState('');

  const [
    postazioneResponsabileDraft,
    setPostazioneResponsabileDraft
  ] = useState('');

  const [
    postazioneTelefonoDraft,
    setPostazioneTelefonoDraft
  ] = useState('');

  const [
    postazioneTelefonoResponsabileDraft,
    setPostazioneTelefonoResponsabileDraft
  ] = useState('');


  const [postazioneFotoDraft, setPostazioneFotoDraft] =
    useState(null);

  const copiaFotoPostazione = async (
    uri,
    nomeOriginale
  ) => {
    if (!uri) return null;

    const cartella =
      FileSystem.documentDirectory +
      'postazioni_vigilanza/';

    const info =
      await FileSystem.getInfoAsync(
        cartella
      );

    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(
        cartella,
        { intermediates: true }
      );
    }

    const estensione =
      String(nomeOriginale || '')
        .split('.')
        .pop()
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase() ||
      'jpg';

    const destinazione =
      cartella +
      `postazione_${Date.now()}.${estensione}`;

    await FileSystem.copyAsync({
      from: uri,
      to: destinazione,
    });

    return destinazione;
  };

  const scegliFotoPostazione = async () => {
    try {
      const permesso =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permesso.granted) {
        Alert.alert(
          'Permesso necessario',
          'Consenti l’accesso alle foto per scegliere l’immagine della postazione.'
        );
        return;
      }

      const risultato =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [16, 9],
          quality: 0.85,
        });

      if (
        risultato.canceled ||
        !risultato.assets?.[0]
      ) {
        return;
      }

      const asset =
        risultato.assets[0];

      const foto =
        await copiaFotoPostazione(
          asset.uri,
          asset.fileName ||
            `postazione_${Date.now()}.jpg`
        );

      setPostazioneFotoDraft(foto);

    } catch (e) {
      console.log(
        'Errore scelta foto postazione:',
        e
      );

      Alert.alert(
        'Errore',
        'Non è stato possibile scegliere la fotografia.'
      );
    }
  };

  const scattaFotoPostazione = async () => {
    try {
      const permesso =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permesso.granted) {
        Alert.alert(
          'Permesso necessario',
          'Consenti l’accesso alla fotocamera per fotografare la postazione.'
        );
        return;
      }

      const risultato =
        await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [16, 9],
          quality: 0.85,
        });

      if (
        risultato.canceled ||
        !risultato.assets?.[0]
      ) {
        return;
      }

      const asset =
        risultato.assets[0];

      const foto =
        await copiaFotoPostazione(
          asset.uri,
          asset.fileName ||
            `postazione_${Date.now()}.jpg`
        );

      setPostazioneFotoDraft(foto);

    } catch (e) {
      console.log(
        'Errore fotocamera postazione:',
        e
      );

      Alert.alert(
        'Errore',
        'Non è stato possibile scattare la fotografia.'
      );
    }
  };

  const rimuoviFotoPostazione = () => {
    Alert.alert(
      'Rimuovi foto',
      'Vuoi rimuovere la foto della postazione?',
      [
        {
          text: 'Annulla',
          style: 'cancel',
        },
        {
          text: 'Rimuovi',
          style: 'destructive',
          onPress: () =>
            setPostazioneFotoDraft(null),
        },
      ]
    );
  };


  useEffect(() => {
    let attivo = true;

    (async () => {
      try {
        const dati = await AsyncStorage.getItem(
          'vigilanza_postazioni'
        );

        if (attivo && dati) {
          const parsed = JSON.parse(dati);

          if (Array.isArray(parsed)) {
            setPostazioniSalvate(parsed);
          }
        }
      } catch (e) {
        console.log(
          'Errore caricamento postazioni:',
          e
        );
      }
    })();

    return () => {
      attivo = false;
    };
  }, []);

  const nuovaPostazione = () => {
    setPostazioneSelezionata(null);

    setPostazioneNomeDraft('');
    setPostazioneZonaDraft('');
    setPostazioneAttivitaDraft('');
    setPostazioneTimelineDraft([]);
    setPostazioneOraNuova('');
    setPostazioneAttivitaNuova('');
    setPostazioneChiaviDraft('');
    setPostazioneNoteDraft('');
    setPostazioneContattiDraft('');
    setPostazioneResponsabileDraft('');
    setPostazioneTelefonoDraft('');
    setPostazioneTelefonoResponsabileDraft('');
    setPostazioneFotoDraft(null);

    setScreen('postazioneDettaglio');
  };

  const apriPostazione = (postazione) => {
    setPostazioneSelezionata(postazione);

    setPostazioneNomeDraft(
      postazione?.nome || ''
    );

    setPostazioneZonaDraft(
      postazione?.zona || ''
    );

    setPostazioneAttivitaDraft(
      postazione?.attivita || ''
    );

    setPostazioneTimelineDraft(
      Array.isArray(postazione?.timeline)
        ? ordinaTimelinePostazione(postazione.timeline)
        : []
    );

    setPostazioneOraNuova('');
    setPostazioneAttivitaNuova('');

    setPostazioneChiaviDraft(
      postazione?.chiavi || ''
    );

    setPostazioneNoteDraft(
      postazione?.note || ''
    );

    setPostazioneContattiDraft(
      postazione?.contatti || ''
    );

    setPostazioneResponsabileDraft(
      postazione?.responsabile || ''
    );

    setPostazioneTelefonoDraft(
      postazione?.telefono || ''
    );

    setPostazioneTelefonoResponsabileDraft(
      postazione?.telefonoResponsabile || ''
    );

    setPostazioneFotoDraft(
      postazione?.foto || null
    );

    setScreen('postazioneDettaglio');
  };

  const salvaPostazione = async () => {
    const nome =
      postazioneNomeDraft.trim();

    if (!nome) {
      Alert.alert(
        'Nome mancante',
        'Inserisci il nome della postazione.'
      );
      return;
    }

    const id =
      postazioneSelezionata?.id ||
      `postazione_${Date.now()}`;

    const nuova = {
      id,
      nome,
      zona: postazioneZonaDraft.trim(),
      attivita: postazioneAttivitaDraft.trim(),
      timeline: ordinaTimelinePostazione(
        postazioneTimelineDraft
      ),
      chiavi: postazioneChiaviDraft.trim(),
      note: postazioneNoteDraft.trim(),
      contatti: postazioneContattiDraft.trim(),
      responsabile:
        postazioneResponsabileDraft.trim(),
      telefono:
        postazioneTelefonoDraft.trim(),
      telefonoResponsabile:
        postazioneTelefonoResponsabileDraft.trim(),
      foto: postazioneFotoDraft || null,
      aggiornatoIl: new Date().toISOString(),
    };

    const nuove = postazioniSalvate.some(
      (x) => x.id === id
    )
      ? postazioniSalvate.map(
          (x) => x.id === id ? nuova : x
        )
      : [nuova, ...postazioniSalvate];

    setPostazioniSalvate(nuove);
    setPostazioneSelezionata(nuova);

    try {
      await AsyncStorage.setItem(
        'vigilanza_postazioni',
        JSON.stringify(nuove)
      );

      Alert.alert(
        'Postazione salvata',
        'Le consegne sono state memorizzate.'
      );
    } catch (e) {
      console.log(
        'Errore salvataggio postazione:',
        e
      );

      Alert.alert(
        'Errore',
        'Non è stato possibile salvare la postazione.'
      );
    }
  };

  const eliminaPostazione = () => {
    if (!postazioneSelezionata?.id) return;

    Alert.alert(
      'Elimina postazione',
      'Vuoi eliminare definitivamente questa postazione?',
      [
        {
          text: 'Annulla',
          style: 'cancel',
        },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            const nuove =
              postazioniSalvate.filter(
                (x) =>
                  x.id !==
                  postazioneSelezionata.id
              );

            setPostazioniSalvate(nuove);

            try {
              await AsyncStorage.setItem(
                'vigilanza_postazioni',
                JSON.stringify(nuove)
              );
            } catch (e) {
              console.log(
                'Errore eliminazione postazione:',
                e
              );
            }

            setPostazioneSelezionata(null);
            setScreen('postazioni');
          },
        },
      ]
    );
  };



  /* ===== DETTAGLIO EMERGENZA ===== */
  const [emergenzaSelezionata, setEmergenzaSelezionata] =
    useState(null);



  /* ===== DOCUMENTI PERSONALI ===== */
  const [documentiPersonali, setDocumentiPersonali] = useState({});
  const [documentoSelezionato, setDocumentoSelezionato] = useState(null);

  const [documentoNomeDraft, setDocumentoNomeDraft] = useState('');
  const [documentoNumeroDraft, setDocumentoNumeroDraft] = useState('');
  const [documentoRilascioDraft, setDocumentoRilascioDraft] = useState('');
  const [documentoScadenzaDraft, setDocumentoScadenzaDraft] = useState('');
  const [documentoNoteDraft, setDocumentoNoteDraft] = useState('');

  const [documentoAllegatoDraft, setDocumentoAllegatoDraft] =
    useState(null);

  const copiaAllegatoDocumento = async (
    uri,
    nomeOriginale,
    tipo
  ) => {
    if (!uri) return null;

    const cartella =
      FileSystem.documentDirectory +
      'documenti_vigilanza/';

    const infoCartella =
      await FileSystem.getInfoAsync(cartella);

    if (!infoCartella.exists) {
      await FileSystem.makeDirectoryAsync(
        cartella,
        { intermediates: true }
      );
    }

    const estensione =
      String(nomeOriginale || '')
        .split('.')
        .pop()
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase() ||
      (tipo === 'immagine' ? 'jpg' : 'pdf');

    const nomeFile =
      `doc_${Date.now()}.${estensione}`;

    const destinazione =
      cartella + nomeFile;

    await FileSystem.copyAsync({
      from: uri,
      to: destinazione,
    });

    return {
      uri: destinazione,
      nome:
        nomeOriginale ||
        nomeFile,
      tipo,
    };
  };

  const scegliFotoDocumento = async () => {
    try {
      const permesso =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permesso.granted) {
        Alert.alert(
          'Permesso necessario',
          'Consenti l’accesso alle foto per allegare un documento.'
        );
        return;
      }

      const risultato =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.9,
        });

      if (
        risultato.canceled ||
        !risultato.assets?.[0]
      ) {
        return;
      }

      const asset = risultato.assets[0];

      const allegato =
        await copiaAllegatoDocumento(
          asset.uri,
          asset.fileName ||
            `documento_${Date.now()}.jpg`,
          'immagine'
        );

      setDocumentoAllegatoDraft(allegato);
    } catch (e) {
      console.log(
        'Errore selezione foto documento:',
        e
      );

      Alert.alert(
        'Errore',
        'Non è stato possibile allegare la fotografia.'
      );
    }
  };


  const scattaFotoDocumento = async () => {
    try {
      const permesso =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permesso.granted) {
        Alert.alert(
          'Permesso necessario',
          'Consenti l’accesso alla fotocamera per fotografare il documento.'
        );
        return;
      }

      const risultato =
        await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.9,
        });

      if (
        risultato.canceled ||
        !risultato.assets?.[0]
      ) {
        return;
      }

      const asset = risultato.assets[0];

      const allegato =
        await copiaAllegatoDocumento(
          asset.uri,
          asset.fileName ||
            `documento_${Date.now()}.jpg`,
          'immagine'
        );

      setDocumentoAllegatoDraft(allegato);

    } catch (e) {
      console.log(
        'Errore fotocamera documento:',
        e
      );

      Alert.alert(
        'Errore',
        'Non è stato possibile scattare la fotografia.'
      );
    }
  };

  const scegliFileDocumento = async () => {
    try {
      const risultato =
        await DocumentPicker.getDocumentAsync({
          type: [
            'application/pdf',
            'image/*',
          ],
          copyToCacheDirectory: true,
          multiple: false,
        });

      if (
        risultato.canceled ||
        !risultato.assets?.[0]
      ) {
        return;
      }

      const asset = risultato.assets[0];

      const isImage =
        String(asset.mimeType || '')
          .toLowerCase()
          .startsWith('image/');

      const allegato =
        await copiaAllegatoDocumento(
          asset.uri,
          asset.name ||
            `documento_${Date.now()}`,
          isImage
            ? 'immagine'
            : 'pdf'
        );

      setDocumentoAllegatoDraft(allegato);
    } catch (e) {
      console.log(
        'Errore selezione file documento:',
        e
      );

      Alert.alert(
        'Errore',
        'Non è stato possibile allegare il file.'
      );
    }
  };

  const apriAllegatoDocumento = async () => {
    const allegato =
      documentoAllegatoDraft;

    if (!allegato?.uri) {
      Alert.alert(
        'Nessun allegato',
        'Non è presente alcun file.'
      );
      return;
    }

    try {
      if (allegato.tipo === 'immagine') {
        return;
      }

      const disponibile =
        await Sharing.isAvailableAsync();

      if (!disponibile) {
        Alert.alert(
          'Apertura non disponibile',
          'Questo dispositivo non permette di aprire il file in questo modo.'
        );
        return;
      }

      await Sharing.shareAsync(
        allegato.uri,
        {
          mimeType: 'application/pdf',
          dialogTitle: 'Apri documento',
        }
      );
    } catch (e) {
      console.log(
        'Errore apertura allegato:',
        e
      );

      Alert.alert(
        'Errore',
        'Non è stato possibile aprire il documento.'
      );
    }
  };

  const rimuoviAllegatoDocumento = () => {
    Alert.alert(
      'Rimuovi allegato',
      'Vuoi rimuovere il file da questo documento?',
      [
        {
          text: 'Annulla',
          style: 'cancel',
        },
        {
          text: 'Rimuovi',
          style: 'destructive',
          onPress: () =>
            setDocumentoAllegatoDraft(null),
        },
      ]
    );
  };


  useEffect(() => {
    let attivo = true;

    (async () => {
      try {
        const dati = await AsyncStorage.getItem(
          'vigilanza_documenti_personali'
        );

        if (attivo && dati) {
          const parsed = JSON.parse(dati);

          if (
            parsed &&
            typeof parsed === 'object' &&
            !Array.isArray(parsed)
          ) {
            setDocumentiPersonali(parsed);
          }
        }
      } catch (e) {
        console.log(
          'Errore caricamento documenti personali:',
          e
        );
      }
    })();

    return () => {
      attivo = false;
    };
  }, []);

  const apriDocumentoPersonale = (doc) => {
    const salvato =
      documentiPersonali?.[doc.id] || {};

    setDocumentoSelezionato(doc);

    setDocumentoNomeDraft(
      salvato.nome ||
      doc.titolo ||
      ''
    );

    setDocumentoNumeroDraft(
      salvato.numero || ''
    );

    setDocumentoRilascioDraft(
      salvato.rilascio || ''
    );

    setDocumentoScadenzaDraft(
      salvato.scadenza || ''
    );

    setDocumentoNoteDraft(
      salvato.note || ''
    );

    setDocumentoAllegatoDraft(
      salvato.allegato || null
    );

    setScreen('documentoDettaglio');
  };

  const salvaDocumentoPersonale = async () => {
    if (!documentoSelezionato?.id) return;

    const nuovoDocumento = {
      nome:
        documentoNomeDraft.trim() ||
        documentoSelezionato.titolo,

      numero: documentoNumeroDraft.trim(),
      rilascio: documentoRilascioDraft.trim(),
      scadenza: documentoScadenzaDraft.trim(),
      note: documentoNoteDraft.trim(),
      allegato:
        documentoAllegatoDraft || null,
      aggiornatoIl: new Date().toISOString(),
    };

    const nuovi = {
      ...documentiPersonali,
      [documentoSelezionato.id]:
        nuovoDocumento,
    };

    setDocumentiPersonali(nuovi);

    try {
      await AsyncStorage.setItem(
        'vigilanza_documenti_personali',
        JSON.stringify(nuovi)
      );

      Alert.alert(
        'Documento salvato',
        'I dati sono stati salvati su questo dispositivo.'
      );
    } catch (e) {
      console.log(
        'Errore salvataggio documento:',
        e
      );

      Alert.alert(
        'Errore',
        'Non è stato possibile salvare il documento.'
      );
    }
  };

  const dataDocumentoDaTesto = (valore) => {
    const testo = String(valore || '').trim();

    if (!testo) return null;

    const parti = testo.split('/');

    if (parti.length !== 3) return null;

    const giorno = Number(parti[0]);
    const mese = Number(parti[1]);
    const anno = Number(parti[2]);

    if (
      !Number.isFinite(giorno) ||
      !Number.isFinite(mese) ||
      !Number.isFinite(anno)
    ) {
      return null;
    }

    const data = new Date(
      anno,
      mese - 1,
      giorno,
      23,
      59,
      59,
      999
    );

    if (
      data.getFullYear() !== anno ||
      data.getMonth() !== mese - 1 ||
      data.getDate() !== giorno
    ) {
      return null;
    }

    return data;
  };

  const statoDocumentoPersonale = (doc) => {
    if (!doc) {
      return {
        testo: 'DA INSERIRE',
        colore: '#7894AE',
      };
    }

    if (!doc.scadenza) {
      return {
        testo: 'SALVATO',
        colore: '#67E7FF',
      };
    }

    const scadenza =
      dataDocumentoDaTesto(doc.scadenza);

    if (!scadenza) {
      return {
        testo: 'CONTROLLA DATA',
        colore: '#FFB06C',
      };
    }

    const oggi = new Date();

    oggi.setHours(0, 0, 0, 0);

    const giorni = Math.ceil(
      (scadenza.getTime() - oggi.getTime()) /
      86400000
    );

    if (giorni < 0) {
      return {
        testo: 'SCADUTO',
        colore: '#FF727C',
      };
    }

    if (giorni <= 30) {
      return {
        testo: 'IN SCADENZA',
        colore: '#FFB45F',
      };
    }

    return {
      testo: 'VALIDO',
      colore: '#62E2B8',
    };
  };


  /* ===== METEO SERVIZIO ===== */
  const [meteoServizio, setMeteoServizio] = useState(null);
  const [meteoLoading, setMeteoLoading] = useState(false);
  const [meteoErrore, setMeteoErrore] = useState('');
  const [localitaMeteo, setLocalitaMeteo] = useState('');

  /* ===== LUOGO METEO ASSOCIATO AI TURNI ===== */
  const [luoghiTurniMeteo, setLuoghiTurniMeteo] = useState({});

  useEffect(() => {
    let attivo = true;

    (async () => {
      try {
        const dati = await AsyncStorage.getItem(
          'vigilanza_luoghi_turni_meteo'
        );

        if (attivo && dati) {
          const parsed = JSON.parse(dati);

          if (
            parsed &&
            typeof parsed === 'object' &&
            !Array.isArray(parsed)
          ) {
            setLuoghiTurniMeteo(parsed);
          }
        }
      } catch (e) {
        console.log(
          'Errore caricamento luoghi turni meteo:',
          e
        );
      }
    })();

    return () => {
      attivo = false;
    };
  }, []);

  const salvaLuogoTurnoMeteo = async (chiave, luogo) => {
    const pulito = String(luogo || '').trim();

    if (!chiave || !pulito) {
      Alert.alert(
        'Località mancante',
        'Inserisci prima la località del servizio.'
      );
      return;
    }

    const nuovi = {
      ...luoghiTurniMeteo,
      [chiave]: pulito,
    };

    setLuoghiTurniMeteo(nuovi);
    setLocalitaMeteo(pulito);

    try {
      await AsyncStorage.setItem(
        'vigilanza_luoghi_turni_meteo',
        JSON.stringify(nuovi)
      );

      Alert.alert(
        'Località associata',
        `${pulito} è stata associata a questo turno.`
      );
    } catch (e) {
      console.log(
        'Errore salvataggio luogo turno:',
        e
      );

      Alert.alert(
        'Errore',
        'Non è stato possibile salvare la località.'
      );
    }
  };


  const [recentiMeteo, setRecentiMeteo] = useState([]);
  const [meteoPreferenzeCaricate, setMeteoPreferenzeCaricate] =
    useState(false);

  /* ===== LOCALITÀ METEO RECENTI ===== */
  useEffect(() => {
    let attivo = true;

    const caricaPreferenzeMeteo = async () => {
      try {
        const dati = await AsyncStorage.getItem(
          'vigilanza_meteo_localita'
        );

        if (attivo && dati) {
          const parsed = JSON.parse(dati);

          if (Array.isArray(parsed?.recenti)) {
            setRecentiMeteo(parsed.recenti.slice(0, 5));
          }

          if (
            typeof parsed?.ultima === 'string' &&
            parsed.ultima.trim()
          ) {
            setLocalitaMeteo(parsed.ultima.trim());
          }
        }
      } catch (e) {
        console.log(
          'Errore caricamento località meteo:',
          e
        );
      } finally {
        if (attivo) {
          setMeteoPreferenzeCaricate(true);
        }
      }
    };

    caricaPreferenzeMeteo();

    return () => {
      attivo = false;
    };
  }, []);

  const salvaLocalitaMeteo = async (localita) => {
    const pulita = String(localita || '').trim();

    if (!pulita) return;

    const nuoveRecenti = [
      pulita,
      ...recentiMeteo.filter(
        (x) =>
          String(x).toLowerCase() !==
          pulita.toLowerCase()
      ),
    ].slice(0, 5);

    setRecentiMeteo(nuoveRecenti);
    setLocalitaMeteo(pulita);

    try {
      await AsyncStorage.setItem(
        'vigilanza_meteo_localita',
        JSON.stringify({
          ultima: pulita,
          recenti: nuoveRecenti,
        })
      );
    } catch (e) {
      console.log(
        'Errore salvataggio località meteo:',
        e
      );
    }
  };


  const caricaMeteoServizio = async (zona) => {
    const luogo = String(zona || '').trim();

    if (!luogo) {
      setMeteoErrore(
        'Inserisci una località per caricare il meteo.'
      );
      setMeteoServizio(null);
      return;
    }

    setMeteoLoading(true);
    setMeteoErrore('');

    try {
      // 1. CERCA LA LOCALITÀ
      const geoUrl =
        'https://geocoding-api.open-meteo.com/v1/search?name=' +
        encodeURIComponent(luogo) +
        '&count=1&language=it&format=json';

      console.log(
        '🌍 METEO - ricerca località:',
        luogo
      );

      const geoResponse = await fetch(geoUrl);

      if (!geoResponse.ok) {
        throw new Error(
          `Geocoding HTTP ${geoResponse.status}`
        );
      }

      const geoData = await geoResponse.json();

      if (
        !geoData?.results ||
        !Array.isArray(geoData.results) ||
        geoData.results.length === 0
      ) {
        throw new Error(
          `Località "${luogo}" non trovata`
        );
      }

      const luogoTrovato = geoData.results[0];

      const lat = Number(luogoTrovato.latitude);
      const lon = Number(luogoTrovato.longitude);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon)
      ) {
        throw new Error(
          'Coordinate della località non valide'
        );
      }

      console.log(
        '✅ METEO - località trovata:',
        luogoTrovato.name,
        lat,
        lon
      );

      // 2. CARICA LE PREVISIONI
      const meteoUrl =
        'https://api.open-meteo.com/v1/forecast' +
        `?latitude=${lat}` +
        `&longitude=${lon}` +
        '&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m' +
        '&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m' +
        '&forecast_days=7' +
        '&timezone=auto';

      const response = await fetch(meteoUrl);

      if (!response.ok) {
        throw new Error(
          `Meteo HTTP ${response.status}`
        );
      }

      const data = await response.json();

      if (
        !data ||
        !data.current ||
        data.current.temperature_2m === undefined
      ) {
        throw new Error(
          'Il servizio meteo non ha restituito i dati correnti'
        );
      }

      console.log(
        '✅ METEO - temperatura:',
        data.current.temperature_2m
      );

      // 3. MOSTRA SUBITO IL METEO
      setMeteoServizio({
        ...data,
        luogo: luogoTrovato,
      });

      setMeteoErrore('');

      // 4. SALVA LA LOCALITÀ SEPARATAMENTE.
      // Un eventuale errore qui NON cancella il meteo.
      try {
        await salvaLocalitaMeteo(luogo);
      } catch (salvaErrore) {
        console.log(
          '⚠️ Meteo caricato ma località non salvata:',
          salvaErrore
        );
      }

    } catch (e) {
      console.log(
        '❌ ERRORE METEO:',
        e
      );

      setMeteoServizio(null);

      setMeteoErrore(
        e?.message ||
        'Non riesco a recuperare il meteo per questa zona.'
      );
    } finally {
      setMeteoLoading(false);
    }
  };


  /* ===== CONTATTI PERSONALI NUMERI UTILI ===== */
  const [numeriUtiliPersonali, setNumeriUtiliPersonali] = useState({
    salaOperativa: '',
    responsabile: '',
    referenteSito: '',
    altro: '',
  });

  const [numeriUtiliPronti, setNumeriUtiliPronti] = useState(false);

  useEffect(() => {
    let attivo = true;

    const caricaNumeriUtili = async () => {
      try {
        const dati = await AsyncStorage.getItem(
          'vigilanza_contatti_lavoro'
        );

        if (attivo && dati) {
          const parsed = JSON.parse(dati);

          setNumeriUtiliPersonali((prev) => ({
            ...prev,
            ...parsed,
          }));
        }
      } catch (e) {
        console.log('Errore caricamento contatti lavoro:', e);
      } finally {
        if (attivo) {
          setNumeriUtiliPronti(true);
        }
      }
    };

    caricaNumeriUtili();

    return () => {
      attivo = false;
    };
  }, []);

  useEffect(() => {
    if (!numeriUtiliPronti) return;

    AsyncStorage.setItem(
      'vigilanza_contatti_lavoro',
      JSON.stringify(numeriUtiliPersonali)
    ).catch((e) => {
      console.log('Errore salvataggio contatti lavoro:', e);
    });
  }, [numeriUtiliPersonali, numeriUtiliPronti]);

  const chiamaNumeroUtile = async (numero) => {
    const pulito = String(numero || '')
      .trim()
      .replace(/[^\d+]/g, '');

    if (!pulito) {
      Alert.alert(
        'Numero mancante',
        'Inserisci prima il numero di telefono.'
      );
      return;
    }

    try {
      await Linking.openURL(`tel:${pulito}`);
    } catch (e) {
      Alert.alert(
        'Chiamata non disponibile',
        'Non è stato possibile aprire il telefono.'
      );
    }
  };

  const [fotoCollegaAperta, setFotoCollegaAperta] = useState(false);

  // ===== CONTROLLO CEDOLINO =====
  const [cedolinoOre, setCedolinoOre] = useState('');
  const [cedolinoExtra, setCedolinoExtra] = useState('');
  const [cedolinoDomenicali, setCedolinoDomenicali] = useState('');
  const [cedolinoRiposo, setCedolinoRiposo] = useState('');
  const [cedolinoNotturno, setCedolinoNotturno] = useState('');


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

  const [matricolaDraft, setMatricolaDraft] = useState('');


  const [
    inServizioDalDraft,
    setInServizioDalDraft,
  ] = useState(
    PROFILO_DEFAULT.in_servizio_dal || ''
  );

    /* SYNC MATRICOLA SAFE */
  useEffect(() => {
    setMatricolaDraft(
      profilo?.codice_gpg
        ? String(profilo.codice_gpg)
        : ''
    );
  }, [profilo?.codice_gpg]);

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
    setInServizioDalDraft(
      nuovoProfilo.in_servizio_dal
        ? String(nuovoProfilo.in_servizio_dal)
        : ''
    );
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

  // ===== ORE NOTTURNE REALI: FASCIA 21:00 - 05:00 =====
  function calcolaOreNotturneTurno(start, end) {
    if (!start || !end) return 0;

    const parseMinuti = (orario) => {
      const [h, m] = String(orario).split(':').map(Number);

      if (Number.isNaN(h) || Number.isNaN(m)) {
        return null;
      }

      return h * 60 + m;
    };

    let inizioMin = parseMinuti(start);
    let fineMin = parseMinuti(end);

    if (inizioMin === null || fineMin === null) {
      return 0;
    }

    // Turno che supera la mezzanotte
    if (fineMin <= inizioMin) {
      fineMin += 24 * 60;
    }

    const sovrapposizione = (a1, a2, b1, b2) =>
      Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));

    // Fascia notte del giorno iniziale: 21:00 -> 24:00
    let minutiNotte = sovrapposizione(
      inizioMin,
      fineMin,
      21 * 60,
      24 * 60
    );

    // Fascia notte del giorno iniziale: 00:00 -> 05:00
    minutiNotte += sovrapposizione(
      inizioMin,
      fineMin,
      0,
      5 * 60
    );

    // Fascia notte del giorno successivo per i turni oltre mezzanotte
    minutiNotte += sovrapposizione(
      inizioMin,
      fineMin,
      24 * 60,
      29 * 60
    );

    return minutiNotte / 60;
  }

  const oreNotturneMese = giornateStipendioMese.reduce(
    (totale, turno) =>
      totale +
      calcolaOreNotturneTurno(
        turno.inizio,
        turno.fine
      ),
    0
  );


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
      codice_gpg: matricolaDraft.trim(),
      in_servizio_dal:
        inServizioDalDraft.trim() === ''
          ? null
          : Number(inServizioDalDraft.trim()),
      };

      const salvato = await salvaProfiloUtente(profiloDaSalvare);

      const nuovoProfilo = {
        nome: salvato.nome || "",
        cognome: salvato.cognome || "",
        azienda: salvato.azienda || "",
        ruolo: salvato.ruolo || "",
        sede: salvato.sede || "",
      in_servizio_dal:
        salvato.in_servizio_dal ?? null,
            codice_gpg:
        salvato.codice_gpg ||
        profilo?.codice_gpg ||
        "",
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
            style={{
          backgroundColor: 'rgba(32, 30, 92, 0.96)',

          borderRadius: 30,

          paddingHorizontal: 19,
          paddingVertical: 18,

          marginHorizontal: 2,
          marginBottom: 17,

          borderWidth: 1.5,
          borderColor: '#5BE7FF',

          shadowColor: '#55E6FF',
          shadowOpacity: 0.62,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 7 },

          elevation: 11,
        }}
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

        {/* ===== CONTROLLO CEDOLINO ENTRY ===== */}
        <TouchableOpacity
          activeOpacity={0.84}
          onPress={() => setScreen('controlloCedolino')}
          style={{
            marginTop: 4,
            marginBottom: 16,
            paddingVertical: 16,
            paddingHorizontal: 17,
            borderRadius: 22,

            flexDirection: 'row',
            alignItems: 'center',

            backgroundColor: 'rgba(15,42,79,0.96)',
            borderWidth: 1,
            borderColor: 'rgba(89,225,255,0.48)',

            shadowColor: '#50E4FF',
            shadowOpacity: 0.20,
            shadowRadius: 15,
            shadowOffset: { width: 0, height: 6 },
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 13,
              backgroundColor: 'rgba(74,207,255,0.14)',
              borderWidth: 1,
              borderColor: 'rgba(103,231,255,0.36)',
            }}
          >
            <Ionicons
              name="document-text-outline"
              size={25}
              color="#74ECFF"
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 15,
                fontWeight: '900',
                letterSpacing: 0.2,
              }}
            >
              CONTROLLA LA MIA BUSTA PAGA
            </Text>

            <Text
              style={{
                color: '#9DB9D5',
                fontSize: 11,
                fontWeight: '700',
                marginTop: 4,
                lineHeight: 15,
              }}
            >
              Confronta il cedolino con i turni registrati
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={22}
            color="#78E8FF"
          />
        </TouchableOpacity>



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

  
  if (screen === 'controlloCedolino') {
    return (
      <Screen>
        <Back onPress={() => setScreen('stipendio')} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: 40,
          }}
        >
          <View
            style={{
              marginTop: 10,
              padding: 22,
              borderRadius: 28,
              backgroundColor: 'rgba(12,31,68,0.97)',
              borderWidth: 1,
              borderColor: 'rgba(102,226,255,0.45)',
              shadowColor: '#59E3FF',
              shadowOpacity: 0.24,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 8 },
            }}
          >
            <Text
              style={{
                color: '#79ECFF',
                fontSize: 10,
                fontWeight: '900',
                letterSpacing: 1.3,
              }}
            >
              CONTROLLO CEDOLINO
            </Text>

            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 29,
                lineHeight: 33,
                fontWeight: '900',
                marginTop: 6,
              }}
            >
              Controlla la tua busta paga
            </Text>

            <Text
              style={{
                color: '#A9C0D9',
                fontSize: 13,
                lineHeight: 19,
                fontWeight: '700',
                marginTop: 8,
              }}
            >
              Confronteremo ciò che hai realmente registrato nell'app con le voci presenti nel cedolino.
            </Text>
          </View>

          
          {/* ===== CONFRONTO CEDOLINO V2 ===== */}
          
          {/* ===== VERDETTO CEDOLINO ===== */}
          {(() => {
            const righeControllo = [
              {
                app: Number(oreStipendioMese || 0),
                ced: cedolinoOre,
                tariffa: null,
              },
              {
                app: Number(extraStipendioMese || 0),
                ced: cedolinoExtra,
                tariffa: tariffaStraordinario30,
              },
              {
                app: Number(oreDomenicaliMese || 0),
                ced: cedolinoDomenicali,
                tariffa: tariffaDomenicale,
              },
              {
                app: giornateStipendioMese.reduce(
                  (tot, t) =>
                    t.riposo_lavorato === true
                      ? tot + Math.max(0, Number(t.ore || 0) - Number(t.extra || 0))
                      : tot,
                  0
                ),
                ced: cedolinoRiposo,
                tariffa: tariffaRiposoLavorato,
              },
              {
                app: Number(oreNotturneMese || 0),
                ced: cedolinoNotturno,
                tariffa: tariffaPiantonamentoNotturno,
              },
            ];

            const compilate = righeControllo.filter(
              (r) => String(r.ced || '').trim() !== ''
            );

            const differenze = compilate.map((r) => {
              const ced = Number(String(r.ced).replace(',', '.'));
              return Number.isNaN(ced) ? null : ced - r.app;
            }).filter((v) => v !== null);

            const vociDiverse = differenze.filter(
              (d) => Math.abs(d) >= 0.11
            ).length;

            const tutteCompilate =
              compilate.length === righeControllo.length;

            const totaleScarto = differenze.reduce(
              (tot, d) => tot + Math.abs(d),
              0
            );

            const totaleEconomicoMancante = righeControllo.reduce(
              (tot, r) => {
                if (!r.tariffa || String(r.ced || '').trim() === '') {
                  return tot;
                }

                const ced = Number(String(r.ced).replace(',', '.'));

                if (Number.isNaN(ced)) {
                  return tot;
                }

                const oreMancanti = Math.max(0, r.app - ced);

                return tot + oreMancanti * r.tariffa;
              },
              0
            );

            const tuttoOk =
              tutteCompilate &&
              vociDiverse === 0;

            const nessunDato =
              compilate.length === 0;

            const colore =
              tuttoOk
                ? '#69E9BF'
                : vociDiverse > 0
                ? '#FFD06A'
                : '#76DFFF';

            const bordo =
              tuttoOk
                ? 'rgba(105,233,191,0.42)'
                : vociDiverse > 0
                ? 'rgba(255,208,106,0.42)'
                : 'rgba(118,223,255,0.34)';

            const sfondo =
              tuttoOk
                ? 'rgba(21,70,61,0.48)'
                : vociDiverse > 0
                ? 'rgba(76,55,20,0.48)'
                : 'rgba(17,55,86,0.52)';

            const icona =
              tuttoOk
                ? 'shield-checkmark-outline'
                : vociDiverse > 0
                ? 'alert-circle-outline'
                : 'document-text-outline';

            const titolo =
              nessunDato
                ? 'INSERISCI I DATI DEL CEDOLINO'
                : tuttoOk
                ? 'CEDOLINO COERENTE'
                : vociDiverse > 0
                ? `${vociDiverse} ${vociDiverse === 1 ? 'VOCE DA VERIFICARE' : 'VOCI DA VERIFICARE'}`
                : 'CONTROLLO IN CORSO';

            const testo =
              nessunDato
                ? 'Compila i valori riportati sul cedolino per iniziare il confronto.'
                : tuttoOk
                ? 'Le voci inserite coincidono con quanto registrato dall’app.'
                : vociDiverse > 0
                ? `Scarto complessivo rilevato: ${totaleScarto.toFixed(1)} ore.${totaleEconomicoMancante > 0 ? ` Possibile importo non riconosciuto: circa € ${totaleEconomicoMancante.toFixed(2)}.` : ''} Controlla le righe evidenziate.`
                : `${compilate.length} di ${righeControllo.length} voci controllate. Completa il cedolino per il verdetto finale.`;

            return (
              <View
                style={{
                  marginTop: 16,
                  marginBottom: 2,
                  padding: 17,
                  borderRadius: 22,
                  backgroundColor: sfondo,
                  borderWidth: 1,
                  borderColor: bordo,

                  shadowColor: colore,
                  shadowOpacity: 0.16,
                  shadowRadius: 14,
                  shadowOffset: { width: 0, height: 5 },
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 15,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(5,19,38,0.38)',
                      borderWidth: 1,
                      borderColor: bordo,
                      marginRight: 12,
                    }}
                  >
                    <Ionicons
                      name={icona}
                      size={23}
                      color={colore}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colore,
                        fontSize: 10,
                        fontWeight: '900',
                        letterSpacing: 0.9,
                      }}
                    >
                      VERDETTO CEDOLINO
                    </Text>

                    <Text
                      style={{
                        color: '#FFFFFF',
                        fontSize: 18,
                        fontWeight: '900',
                        marginTop: 3,
                      }}
                    >
                      {titolo}
                    </Text>
                  </View>
                </View>

                <Text
                  style={{
                    color: '#B3C6D9',
                    fontSize: 11,
                    lineHeight: 17,
                    fontWeight: '700',
                    marginTop: 11,
                  }}
                >
                  {testo}
                </Text>
              </View>
            );
          })()}

<View
            style={{
              marginTop: 16,
              padding: 17,
              borderRadius: 24,
              backgroundColor: 'rgba(10,31,62,0.96)',
              borderWidth: 1,
              borderColor: 'rgba(89,211,255,0.30)',
            }}
          >
            <Text
              style={{
                color: '#79ECFF',
                fontSize: 10,
                fontWeight: '900',
                letterSpacing: 1.1,
                marginBottom: 5,
              }}
            >
              CONFRONTO DEL MESE
            </Text>

            <Text
              style={{
                color: '#8EA9C5',
                fontSize: 11,
                lineHeight: 16,
                fontWeight: '700',
                marginBottom: 15,
              }}
            >
              A sinistra trovi i dati registrati dall'app. Inserisci a destra quelli riportati sul cedolino.
            </Text>

            {[
              {
                label: 'ORE LAVORATE',
                app: Number(oreStipendioMese || 0),
                value: cedolinoOre,
                setValue: setCedolinoOre,
                tariffa: null,
              },
              {
                label: 'STRAORDINARIO',
                app: Number(extraStipendioMese || 0),
                value: cedolinoExtra,
                setValue: setCedolinoExtra,
                tariffa: tariffaStraordinario30,
              },
              {
                label: 'DOMENICALI',
                app: Number(oreDomenicaliMese || 0),
                value: cedolinoDomenicali,
                setValue: setCedolinoDomenicali,
                tariffa: tariffaDomenicale,
              },
              {
                label: 'RIPOSO LAVORATO',
                app: giornateStipendioMese.reduce(
                  (tot, t) =>
                    t.riposo_lavorato === true
                      ? tot + Math.max(0, Number(t.ore || 0) - Number(t.extra || 0))
                      : tot,
                  0
                ),
                value: cedolinoRiposo,
                setValue: setCedolinoRiposo,
                tariffa: tariffaRiposoLavorato,
              },
              {
                label: 'NOTTURNO',
                app: Number(oreNotturneMese || 0),
                value: cedolinoNotturno,
                setValue: setCedolinoNotturno,
                tariffa: tariffaPiantonamentoNotturno,
              },
            ].map((riga) => {
              const ced = Number(String(riga.value || '').replace(',', '.'));
              const compilato =
                String(riga.value || '').trim() !== '' &&
                !Number.isNaN(ced);

              const diff = compilato ? ced - riga.app : null;
              const ok = compilato && Math.abs(diff) < 0.11;

              const oreMancanti =
                compilato && diff < -0.10
                  ? Math.abs(diff)
                  : 0;

              const euroMancanti =
                riga.tariffa && oreMancanti > 0
                  ? oreMancanti * riga.tariffa
                  : 0;

              return (
                <View
                  key={riga.label}
                  style={{
                    marginBottom: 7,
                    paddingVertical: 11,
                    paddingHorizontal: 13,
                    borderRadius: 17,
                    backgroundColor: 'rgba(18,45,82,0.82)',
                    borderWidth: 1,
                    borderColor:
                      !compilato
                        ? 'rgba(91,159,210,0.20)'
                        : ok
                        ? 'rgba(83,232,188,0.42)'
                        : 'rgba(255,187,84,0.42)',
                  }}
                >
                  <Text
                    style={{
                      color: '#A7C0D9',
                      fontSize: 9,
                      fontWeight: '900',
                      letterSpacing: 0.8,
                      marginBottom: 9,
                    }}
                  >
                    {riga.label}
                  </Text>

                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: '#6F93B7',
                          fontSize: 8,
                          fontWeight: '900',
                        }}
                      >
                        REGISTRATO
                      </Text>

                      <Text
                        style={{
                          color: '#FFFFFF',
                          fontSize: 17,
                          fontWeight: '900',
                          marginTop: 2,
                          letterSpacing: -0.2,
                        }}
                      >
                        {riga.app.toFixed(1)} h
                      </Text>
                    </View>

                    <View style={{ width: 116 }}>
                      <Text
                        style={{
                          color: '#6F93B7',
                          fontSize: 8,
                          fontWeight: '900',
                          marginBottom: 4,
                        }}
                      >
                        CEDOLINO
                      </Text>

                      <TextInput
                        value={riga.value}
                        onChangeText={riga.setValue}
                        keyboardType="decimal-pad"
                        placeholder="0,0"
                        placeholderTextColor="#52708E"
                        style={{
                          height: 37,
                          borderRadius: 11,
                          paddingHorizontal: 10,
                          color: '#FFFFFF',
                          fontSize: 15,
                          fontWeight: '900',
                          backgroundColor: 'rgba(3,16,35,0.76)',
                          borderWidth: 1,
                          borderColor: 'rgba(97,211,255,0.28)',
                        }}
                      />
                    </View>
                  </View>

                  {compilato ? (
                    <View
                      style={{
                        marginTop: 7,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <Ionicons
                        name={ok ? 'checkmark-circle' : 'alert-circle'}
                        size={16}
                        color={ok ? '#61E7BC' : '#FFD06A'}
                      />

                      <Text
                        style={{
                          marginLeft: 6,
                          color: ok ? '#78EDC7' : '#FFD785',
                          fontSize: 10,
                          fontWeight: '900',
                        }}
                      >
                        {ok
                          ? 'COINCIDE'
                          : `DIFFERENZA ${diff > 0 ? '+' : ''}${diff.toFixed(1)} h`}
                      </Text>

                      {euroMancanti > 0 ? (
                        <Text
                          style={{
                            color: '#FFD785',
                            fontSize: 10,
                            fontWeight: '800',
                            marginTop: 5,
                          }}
                        >
                          STIMA ECONOMICA: circa € {euroMancanti.toFixed(2)}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}

            
          {/* ===== MINI CARD NOTTURNO FESTIVI ===== */}
          <View
            style={{
              flexDirection: 'row',
              gap: 9,
              marginTop: 12,
              marginBottom: 14,
            }}
          >
            <View
              style={{
                flex: 1,
                minHeight: 105,
                padding: 13,
                borderRadius: 19,

                backgroundColor: 'rgba(29,35,78,0.86)',
                borderWidth: 1,
                borderColor: 'rgba(128,118,255,0.34)',

                shadowColor: '#8D7CFF',
                shadowOpacity: 0.13,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(128,118,255,0.14)',
                  borderWidth: 1,
                  borderColor: 'rgba(159,150,255,0.25)',
                  marginBottom: 9,
                }}
              >
                <Ionicons
                  name="moon-outline"
                  size={18}
                  color="#B4AAFF"
                />
              </View>

              <Text
                style={{
                  color: '#AAA0FF',
                  fontSize: 9,
                  fontWeight: '900',
                  letterSpacing: 0.8,
                }}
              >
                NOTTURNO
              </Text>

              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 19,
                  fontWeight: '900',
                  marginTop: 3,
                }}
              >
                {oreNotturneMese.toFixed(1)} h
              </Text>

              <Text
                style={{
                  color: '#849AB5',
                  fontSize: 9,
                  lineHeight: 13,
                  fontWeight: '700',
                  marginTop: 5,
                }}
              >
                Confronto cedolino attivo
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                minHeight: 105,
                padding: 13,
                borderRadius: 19,

                backgroundColor: 'rgba(18,49,70,0.84)',
                borderWidth: 1,
                borderColor: 'rgba(85,216,236,0.30)',

                shadowColor: '#5EE5F7',
                shadowOpacity: 0.11,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(76,211,226,0.12)',
                  borderWidth: 1,
                  borderColor: 'rgba(91,224,239,0.23)',
                  marginBottom: 9,
                }}
              >
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color="#72E7F3"
                />
              </View>

              <Text
                style={{
                  color: '#72DDEA',
                  fontSize: 9,
                  fontWeight: '900',
                  letterSpacing: 0.8,
                }}
              >
                FESTIVI
              </Text>

              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 15,
                  fontWeight: '900',
                  marginTop: 4,
                }}
              >
                In arrivo
              </Text>

              <Text
                style={{
                  color: '#849AB5',
                  fontSize: 9,
                  lineHeight: 13,
                  fontWeight: '700',
                  marginTop: 6,
                }}
              >
                Controllo separato dei festivi
              </Text>
            </View>
          </View>

<View
              style={{
              display: 'none',
                marginTop: 4,
                padding: 13,
                borderRadius: 17,
                backgroundColor: 'rgba(65,48,103,0.38)',
                borderWidth: 1,
                borderColor: 'rgba(172,137,255,0.20)',
              }}
            >
              <Text
                style={{
                  color: '#C7B9F6',
                  fontSize: 11,
                  lineHeight: 17,
                  fontWeight: '700',
                }}
              >
                🌙 Turni notturni registrati: {statistiche.notti}. Il confronto delle ore notturne verrà attivato dopo il calcolo preciso delle ore di fascia.
              </Text>

              <Text
                style={{
                  color: '#C7B9F6',
                  fontSize: 11,
                  lineHeight: 17,
                  fontWeight: '700',
                  marginTop: 7,
                }}
              >
                🎉 Festivi: il motore attuale non li calcola ancora separatamente. Non vengono quindi stimati per evitare confronti errati.
              </Text>
            </View>
          </View>


          <View
            style={{
              marginTop: 14,
              padding: 16,
              borderRadius: 18,
              backgroundColor: 'rgba(43,33,75,0.56)',
              borderWidth: 1,
              borderColor: 'rgba(171,132,255,0.22)',
            }}
          >
            <Text
              style={{
                color: '#C8B9FF',
                fontSize: 12,
                lineHeight: 18,
                fontWeight: '700',
              }}
            >
              Nel prossimo passaggio collegheremo automaticamente i dati del mese registrati nell'app e inseriremo i valori del cedolino da confrontare.
            </Text>
          </View>
        </ScrollView>
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
          backgroundColor: '#1B2058',

          borderRadius: 28,
          paddingHorizontal: 18,
          paddingVertical: 17,
          marginBottom: 16,

          borderWidth: 1.15,
          borderColor: '#6CDFF4',

          shadowColor: '#53DFF7',
          shadowOpacity: 0.42,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 7 },

          elevation: 9,
        }}
            >
        {/* CONTENUTO CHAT CARD DEFINITIVO */}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          {/* AVATAR */}
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: '#203D78',
              borderWidth: 1.4,
              borderColor: '#6DEAFF',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 13,

              shadowColor: '#59E8FF',
              shadowOpacity: 0.55,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 3 },
            }}
          >
            <Text
              style={{
                color: '#ECFDFF',
                fontSize: 14,
                fontWeight: '900',
                letterSpacing: 0.6,

                textShadowColor: '#5DEBFF',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 7,
              }}
            >
              {`${c.profilo?.nome?.charAt(0) || ''}${c.profilo?.cognome?.charAt(0) || ''}`.toUpperCase() || 'GPG'}
            </Text>
          </View>

          {/* NOME + AZIENDA */}
          <View
            style={{
              flex: 1,
              minWidth: 0,
              justifyContent: 'center',
            }}
          >
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                color: '#FFFFFF',
                fontSize: 18,
                fontWeight: '900',
                letterSpacing: -0.35,

                textShadowColor: 'rgba(92,235,255,0.25)',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 8,
              }}
            >
              {c.profilo?.nome || 'Collega'} {c.profilo?.cognome || ''}
            </Text>

            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                color: '#9CC7E4',
                fontSize: 10.5,
                fontWeight: '700',
                marginTop: 3,
              }}
            >
              {[c.profilo?.azienda, c.profilo?.codice_gpg]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>

          {/* ORARIO */}
          <Text
            style={{
              color: '#A9DDEB',
              fontSize: 9.5,
              fontWeight: '800',
              marginLeft: 10,
              alignSelf: 'center',
              opacity: 0.92,
            }}
          >
            {riepilogoChat[c.altro_user_id]?.created_at
              ? new Date(
                  riepilogoChat[c.altro_user_id].created_at
                ).toLocaleTimeString('it-IT', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : ''}
          </Text>
        </View>

        {/* ULTIMO MESSAGGIO */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            width: '100%',
            marginTop: 12,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: 'rgba(108,223,244,0.14)',
          }}
        >
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{
              flex: 1,
              minWidth: 0,

              color:
                (riepilogoChat[c.altro_user_id]?.nonLetti || 0) > 0
                  ? '#F4FDFF'
                  : '#A7BAD0',

              fontSize: 12.5,

              fontWeight:
                (riepilogoChat[c.altro_user_id]?.nonLetti || 0) > 0
                  ? '800'
                  : '500',
            }}
          >
            {riepilogoChat[c.altro_user_id]?.ultimoMessaggio ||
              'Nessun messaggio recente'}
          </Text>

          {(riepilogoChat[c.altro_user_id]?.nonLetti || 0) > 0 ? (
            <View
              style={{
                minWidth: 22,
                height: 22,
                borderRadius: 11,
                paddingHorizontal: 6,
                marginLeft: 10,

                backgroundColor: '#5CEAFF',
                borderWidth: 1,
                borderColor: '#D2FBFF',

                alignItems: 'center',
                justifyContent: 'center',

                shadowColor: '#5CEAFF',
                shadowOpacity: 0.75,
                shadowRadius: 8,
              }}
            >
              <Text
                style={{
                  color: '#082239',
                  fontSize: 10,
                  fontWeight: '900',
                }}
              >
                {Math.min(
                  riepilogoChat[c.altro_user_id]?.nonLetti || 0,
                  99
                )}
              </Text>
            </View>
          ) : null}
        </View>

      </TouchableOpacity>
          ))
        )}
      </Screen>
    );
  }


  if (screen === 'listaChat') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#080D22' }}>
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
        backgroundColor: 'rgba(44,38,108,0.72)',
        borderRadius: 30,
        paddingHorizontal: 21,
        paddingVertical: 20,
        marginBottom: 22,

        borderWidth: 1.2,
        borderColor: 'rgba(133,119,255,0.90)',

        shadowColor: '#776BFF',
        shadowOpacity: 0.62,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 7 },

        elevation: 12,
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
              fontSize: 27,
              fontWeight: '900',
              letterSpacing: -0.8,

              textShadowColor: '#5DE8FF',
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 16,
            }}
        >
          Le tue conversazioni
        </Text>

            {/* STATISTICHE HEADER CHAT */}
            <Text
              style={{
                color: '#AEEAFF',
                fontSize: 11.5,
                fontWeight: '800',
                marginTop: 7,
                letterSpacing: 0.35,

                textShadowColor: 'rgba(83,216,255,0.22)',
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 7,
              }}
            >
              {`${chatColleghiIds.length} ${
                chatColleghiIds.length === 1
                  ? 'conversazione'
                  : 'conversazioni'
              } · ${Object.values(riepilogoChat || {}).reduce(
                (tot, chat) => tot + (chat?.nonLetti || 0),
                0
              )} non ${
                Object.values(riepilogoChat || {}).reduce(
                  (tot, chat) => tot + (chat?.nonLetti || 0),
                  0
                ) === 1
                  ? 'letto'
                  : 'letti'
              }`}
            </Text>


        <Text
          style={{
              color: '#8192A6',
              fontSize: 12,
              fontWeight: '500',
              marginTop: 5,
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
    .sort((a, b) => {
      const dataA = riepilogoChat[a.altro_user_id]?.created_at
        ? new Date(riepilogoChat[a.altro_user_id].created_at).getTime()
        : 0;

      const dataB = riepilogoChat[b.altro_user_id]?.created_at
        ? new Date(riepilogoChat[b.altro_user_id].created_at).getTime()
        : 0;

      return dataB - dataA;
    })
              .map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => {
                  setCollegaSelezionato(c);
                  setChatMessaggio('');
                  setScreen('chatCollega');
                }}
                style={{
          backgroundColor: '#FF00AA',
          borderRadius: 34,
          paddingHorizontal: 20,
          paddingVertical: 20,
          marginBottom: 18,
          borderWidth: 4,
          borderColor: '#00FFFF',
          shadowColor: '#00FFFF',
          shadowOpacity: 1,
          shadowRadius: 25,
          shadowOffset: { width: 0, height: 0 },
          elevation: 15,
        }}
              >
                {/* AVATAR CONVERSAZIONE */}
        <View
          style={{
              width: 50,
              height: 50,
              borderRadius: 25,

              backgroundColor:
                (riepilogoChat[c.altro_user_id]?.nonLetti || 0) > 0
                  ? 'rgba(37,112,154,0.90)'
                  : 'rgba(69,60,142,0.86)',

              borderWidth: 1.4,

              borderColor:
                (riepilogoChat[c.altro_user_id]?.nonLetti || 0) > 0
                  ? '#82F3FF'
                  : '#A296FF',

              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,

              shadowColor:
                (riepilogoChat[c.altro_user_id]?.nonLetti || 0) > 0
                  ? '#5DEBFF'
                  : '#8C7CFF',

              shadowOpacity: 0.78,
              shadowRadius: 15,
              shadowOffset: { width: 0, height: 4 },

              elevation: 10,
            }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: '#102A46',
              borderWidth: 1,
              borderColor: '#2A6C91',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 18,
                fontWeight: '900',
                letterSpacing: -0.35,

                textShadowColor:
                  (riepilogoChat[c.altro_user_id]?.nonLetti || 0) > 0
                    ? 'rgba(93,235,255,0.40)'
                    : 'rgba(140,124,255,0.24)',

                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 10,
              }}
            >
              {`${c.profilo?.nome?.charAt(0) || ''}${c.profilo?.cognome?.charAt(0) || ''}`.toUpperCase() || 'GPG'}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{
                color: '#FFFFFF',
                fontSize: 16.5,
                fontWeight: '900',
                letterSpacing: -0.25,
              }}
            >
              {c.profilo?.nome || 'Collega'} {c.profilo?.cognome || ''}
            </Text>
          </View>
        </View>

                <Text
                  style={{
            color: '#9CCDE9',
            fontSize: 10.5,
            fontWeight: '600',
            marginTop: 4,
            letterSpacing: 0.2,
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
                    marginTop: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      color:
                        r.nonLetti > 0
                          ? '#F4FDFF'
                          : '#A4B7C9',

                      fontSize: 13,

                      fontWeight:
                        r.nonLetti > 0
                          ? '700'
                          : '500',

                      marginRight: 8,
                      marginTop: 3,
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
                    

                    {r.nonLetti > 0 ? (
                      <View
                        style={{
                          minWidth: 22,
                          height: 22,
                          borderRadius: 11,
                          paddingHorizontal: 6,
                          backgroundColor: '#5CEAFF',
                          borderWidth: 1,
                          borderColor: '#C6FAFF',
                          alignItems: 'center',
                          justifyContent: 'center',

                          shadowColor: '#5CEAFF',
                          shadowOpacity: 0.70,
                          shadowRadius: 9,
                        }}
                      >
                        <Text
                          style={{
                            color: '#062033',
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
                      fontSize: 12.5
                    }}
                  >
                    📍 {c.profilo.sede}
                  </Text>
                ) : null}
              

        {/* SEPARATORE CONVERSAZIONE */}
        <View
          style={{
            height: 1,
            backgroundColor: '#315378',
            marginLeft: 54,
            marginRight: 4,
            opacity: 0.35,
          }}
        />
</TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'chatCollega') {
    const mioFallback = false;

    const c = collegaSelezionato;
    const p = c?.profilo || {};

    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <Screen>
        {/* BACK CHAT PREMIUM */}
      <View
        style={{
          alignSelf: 'flex-start',
          backgroundColor: '#0B1E2D',
          borderRadius: 15,
          borderWidth: 1,
          borderColor: '#315276',
          shadowColor: '#42CFFF',
          shadowOpacity: 0.12,
          shadowRadius: 9,
          marginBottom: 12,
        }}
      >
        <Back onPress={() => setScreen('listaChat')} />
      </View>

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

          <View style={{
        backgroundColor: '#0D1728',
        borderRadius: 22,
        padding: 16,
        marginBottom: 18,
        borderWidth: 1.2,
        borderColor: '#29435F',
        shadowColor: '#1B6FFF',
        shadowOpacity: 0.04,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
      }}>
            {/* AVATAR CHAT INTERNA */}
        <View
          style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: '#102A46',
              borderWidth: 1.2,
              borderColor: '#53D8FF',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
              shadowColor: '#53D8FF',
              shadowOpacity: 0.22,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
            }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: '#183554',
              borderWidth: 1,
              borderColor: '#315B80',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 13,
            }}
          >
            <Text
              style={{
                color: '#A9ECFF',
                fontSize: 13,
                fontWeight: '900',
                letterSpacing: 0.5,
              }}
            >
              {`${p.nome?.charAt(0) || ''}${p.cognome?.charAt(0) || ''}`.toUpperCase() || 'GPG'}
            </Text>
          </View>

          <View style={{
        backgroundColor: 'transparent',
        borderRadius: 0,
        paddingHorizontal: 2,
        paddingVertical: 8,
        marginBottom: 8,
        borderWidth: 0,
        shadowOpacity: 0,
      }}>
            <Text
              numberOfLines={1}
              style={{
                color: '#F6F8FB',
                fontSize: 18.5,
                fontWeight: '900',
                letterSpacing: -0.3,
              }}
            >
              {p.nome || 'Collega'} {p.cognome || ''}
            </Text>
          </View>
        </View>

          {/* NOME CHAT FORZATO */}
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              minWidth: 0,
              marginLeft: 0,
            }}
          >
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                color: '#FFFFFF',
                fontSize: 17,
                fontWeight: '900',
                letterSpacing: -0.25,
              }}
            >
              {`${p.nome || 'Collega'} ${p.cognome || ''}`.trim()}
            </Text>

            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                color: '#83B9DD',
                fontSize: 10,
                fontWeight: '600',
                marginTop: 2,
              }}
            >
              {[p.azienda, p.sede].filter(Boolean).join(' · ')}
            </Text>
          </View>


            {/* BADGE COLLEGATO CHAT */}
            


            <Text style={{
              color: '#9BAFC4',
              fontSize: 12,
              fontWeight: '700',
              marginTop: 4,
            }}>
              {[p.azienda, p.sede].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>

        
      {/* LINEA NEON HEADER CHAT */}
      <View
        style={{
          height: 1,
          backgroundColor: '#53D8FF',
          opacity: 0.24,
          marginHorizontal: 4,
          marginBottom: 8,
          shadowColor: '#53D8FF',
          shadowOpacity: 0.25,
          shadowRadius: 6,
        }}
      />
<ScrollView
          style={{
          flex: 1,
          backgroundColor: '#10283A',
          borderRadius: 14,
          marginBottom: 10,
          borderWidth: 0,
          shadowOpacity: 0,
          overflow: 'hidden',
        }}
          contentContainerStyle={{
          paddingHorizontal: 10,
          paddingTop: 14,
          paddingBottom: 18,
        }}
        
        ref={chatScrollRef}
        onContentSizeChange={() => {
          chatScrollRef.current?.scrollToEnd({ animated: true });
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
                color: mioFallback ? '#BFD4F2' : '#73869A',
                fontSize: 8.5,
                marginTop: 5,
                alignSelf: 'flex-end',
                fontWeight: '600',
                letterSpacing: 0.2,
              }}>
                Nessun messaggio. Scrivi il primo.
              </Text>
            </View>
          ) : (
            chatMessaggi.map((m, index) => {
              const mio = m.mittente_id === chatMioId;

              return (<React.Fragment key={m.id}>
              {/* SEPARATORE DATA CHAT */}
              {(() => {
                const d = new Date(m.created_at);

                const prev = index > 0
                  ? new Date(chatMessaggi[index - 1]?.created_at)
                  : null;

                const stessaGiornata =
                  prev &&
                  d.getDate() === prev.getDate() &&
                  d.getMonth() === prev.getMonth() &&
                  d.getFullYear() === prev.getFullYear();

                if (stessaGiornata) return null;

                const oggi = new Date();
                const ieri = new Date();
                ieri.setDate(ieri.getDate() - 1);

                const eOggi =
                  d.getDate() === oggi.getDate() &&
                  d.getMonth() === oggi.getMonth() &&
                  d.getFullYear() === oggi.getFullYear();

                const eIeri =
                  d.getDate() === ieri.getDate() &&
                  d.getMonth() === ieri.getMonth() &&
                  d.getFullYear() === ieri.getFullYear();

                const etichetta = eOggi
                  ? 'OGGI'
                  : eIeri
                  ? 'IERI'
                  : d.toLocaleDateString('it-IT', {
                      day: '2-digit',
                      month: 'short',
                    }).toUpperCase();

                return (
                  <View
                    style={{
                      alignSelf: 'center',
                      marginTop: 10,
                      marginBottom: 14,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 0,
                      backgroundColor: 'transparent',
                      borderWidth: 0,
                    }}
                  >
                    <Text
                      style={{
                        color: '#61778D',
                        fontSize: 8.5,
                        fontWeight: '800',
                        letterSpacing: 1.0,
                      }}
                    >
                      {etichetta}
                    </Text>
                  </View>
                );
              })()}

              
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
              backgroundColor: mio ? '#1D6FD8' : '#152230',
              borderRadius: 19,
              borderTopRightRadius: mio ? 6 : 19,
              borderTopLeftRadius: mio ? 19 : 6,
              paddingHorizontal: 13,
              paddingVertical: 10,
              marginBottom: 12,
              maxWidth: '76%',
              borderWidth: 1,
              borderColor: mio ? '#347ED9' : '#26394B',
              shadowColor: '#000000',
              shadowOpacity: 0.05,
              shadowRadius: 5,
              shadowOffset: { width: 0, height: 2 },
            }}
                >
                  <Text style={{
                color: '#F2F6FA',
                fontSize: 14,
                lineHeight: 19,
                fontWeight: '500',
                letterSpacing: 0.05,
              }}>
                    {m.testo}
                  </Text>

                  <Text style={{
                color: mio ? '#D2E2F2' : '#8798AA',
                fontSize: 9,
                marginTop: 5,
                alignSelf: 'flex-end',
                fontWeight: '700',
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
              
              </React.Fragment>);
            })
          )}
        </ScrollView>

        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: 'transparent',
          borderRadius: 0,
          paddingHorizontal: 0,
          paddingTop: 6,
          paddingBottom: 2,
          marginTop: 2,
          borderWidth: 0,
          shadowOpacity: 0,
        }}>
          <TextInput
            value={chatMessaggio}
            onChangeText={setChatMessaggio}
            placeholder="Scrivi un messaggio..."
            placeholderTextColor="#7184aa"
            style={{
            flex: 1,
            minHeight: 46,
            maxHeight: 105,
            backgroundColor: '#111C29',
            color: '#F5F7FA',
            borderRadius: 22,
            borderWidth: 1,
            borderColor: '#23384B',
            paddingHorizontal: 16,
            paddingVertical: 11,
            fontSize: 14,
            fontWeight: '500',
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
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: '#1769E0',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 0,
              shadowColor: '#1769E0',
              shadowOpacity: 0.10,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 3 },
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

  
  /* =====================================================
     STRUMENTI - CENTRO OPERATIVO
     ===================================================== */
  if (screen === 'rapportoServizio') {
    return (
      <RapportoServizioScreen
        onBack={() => setScreen('strumenti')}
        postazioni={postazioniSalvate}
      />
    );
  }

  if (screen === 'consegneServizio') {
    return (
      <ConsegneServizioScreen
        onBack={() => setScreen('strumenti')}
        postazioni={postazioniSalvate}
        colleghi={colleghi}
      />
    );
  }

  if (screen === 'strumenti') {
    const strumentiCards = [
      {
        id: 'meteoServizio',
        icon: 'partly-sunny-outline',
        titolo: 'Meteo servizio',
        testo: 'Previsioni nella zona del prossimo turno',
        colore: '#59DFFF',
      },
      {
        id: 'documentiServizio',
        icon: 'id-card-outline',
        titolo: 'Documenti',
        testo: 'Documenti professionali e relative scadenze',
        colore: '#7FA6FF',
      },
      {
        id: 'emergenzeServizio',
        icon: 'warning-outline',
        titolo: 'Emergenze',
        testo: 'Procedure rapide nelle situazioni di pericolo',
        colore: '#FF9C72',
      },
      {
        id: 'numeriUtili',
        icon: 'call-outline',
        titolo: 'Numeri utili',
        testo: 'Emergenze, Sala Operativa e contatti di lavoro',
        colore: '#60E6B1',
      },
      {
        id: 'postazioni',
        icon: 'location-outline',
        titolo: 'Postazioni',
        testo: 'Consegne, orari, chiavi e informazioni del sito',
        colore: '#56E0C5',
      },
      {
        id: 'rapportoServizio',
        icon: 'document-text-outline',
        titolo: 'Rapporto di servizio',
        testo: 'Compila e genera un rapporto operativo ordinato',
        colore: '#79A8FF',
      },
      {
        id: 'consegneServizio',
        icon: 'clipboard-outline',
        titolo: 'Consegne di servizio',
        testo: 'Passaggio informazioni al collega del turno successivo',
        colore: '#64E2C4',
      },
      {
        id: 'regoleGiuramento',
        icon: 'book-outline',
        titolo: 'Regole & Giuramento',
        testo: 'Giuramento, regole e riferimenti professionali',
        colore: '#B596FF',
      },
    ];

    return (
      <Screen>
        <Back onPress={() => setScreen('home')} />

        <View
          style={{
            marginTop: 7,
            marginBottom: 22,
            padding: 20,
            borderRadius: 26,

            backgroundColor: 'rgba(23,31,85,0.92)',

            borderWidth: 1,
            borderColor: 'rgba(100,199,255,0.42)',

            shadowColor: '#5CDFFF',
            shadowOpacity: 0.17,
            shadowRadius: 17,
            shadowOffset: { width: 0, height: 7 },
          }}
        >
          <Text
            style={{
              color: '#70DEFF',
              fontSize: 10,
              fontWeight: '900',
              letterSpacing: 1.4,
            }}
          >
            CENTRO OPERATIVO
          </Text>

          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 27,
              fontWeight: '900',
              marginTop: 6,
              letterSpacing: -0.4,
            }}
          >
            Strumenti
          </Text>

          <Text
            style={{
              color: '#A9C0DD',
              fontSize: 13,
              fontWeight: '600',
              lineHeight: 19,
              marginTop: 6,
            }}
          >
            Tutto ciò che può servirti prima e durante il servizio.
          </Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
          }}
        >
          {strumentiCards.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.83}
              onPress={() => setScreen(item.id)}
              style={{
                width: '48.5%',
                minHeight: 154,
                marginBottom: 12,
                padding: 15,

                borderRadius: 23,

                backgroundColor: 'rgba(10,29,61,0.94)',

                borderWidth: 1,
                borderColor: `${item.colore}70`,

                shadowColor: item.colore,
                shadowOpacity: 0.12,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 5 },

                elevation: 5,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 15,

                  alignItems: 'center',
                  justifyContent: 'center',

                  backgroundColor: 'rgba(32,55,98,0.85)',

                  borderWidth: 1,
                  borderColor: `${item.colore}80`,
                }}
              >
                <Ionicons
                  name={item.icon}
                  size={23}
                  color={item.colore}
                />
              </View>

              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 15,
                  fontWeight: '900',
                  marginTop: 13,
                }}
              >
                {item.titolo}
              </Text>

              <Text
                style={{
                  color: '#8EA8C5',
                  fontSize: 10.5,
                  fontWeight: '600',
                  lineHeight: 15,
                  marginTop: 5,
                }}
              >
                {item.testo}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View
          style={{
            marginTop: 5,
            paddingHorizontal: 15,
            paddingVertical: 13,

            flexDirection: 'row',
            alignItems: 'center',

            borderRadius: 18,

            backgroundColor: 'rgba(18,37,65,0.72)',

            borderWidth: 1,
            borderColor: 'rgba(76,126,171,0.28)',
          }}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={19}
            color="#69D8FF"
          />

          <Text
            style={{
              flex: 1,
              color: '#819CB7',
              fontSize: 10,
              lineHeight: 15,
              fontWeight: '700',
              marginLeft: 10,
            }}
          >
            Le informazioni personali e i documenti saranno gestiti
            separatamente dal profilo pubblico.
          </Text>
        </View>
      </Screen>
    );
  }


  /* =====================================================
     DETTAGLIO DOCUMENTO
     ===================================================== */
  if (screen === 'documentoDettaglio') {

    const docSalvato =
      documentoSelezionato?.id
        ? documentiPersonali[
            documentoSelezionato.id
          ]
        : null;

    const statoDoc =
      statoDocumentoPersonale(
        documentoScadenzaDraft
          ? {
              ...docSalvato,
              scadenza:
                documentoScadenzaDraft,
            }
          : docSalvato
      );

    return (
      <Screen>
        <Back
          onPress={() => {
            setDocumentoSelezionato(null);
            setScreen('documentiServizio');
          }}
        />

        <View
          style={{
            marginTop: 8,
            marginBottom: 18,
            padding: 20,
            borderRadius: 27,

            backgroundColor:
              'rgba(15,31,70,0.95)',

            borderWidth: 1,
            borderColor:
              'rgba(101,213,255,0.34)',

            shadowColor: '#57DFFF',
            shadowOpacity: 0.14,
            shadowRadius: 16,
            shadowOffset: {
              width: 0,
              height: 6,
            },
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 17,

                alignItems: 'center',
                justifyContent: 'center',

                backgroundColor:
                  'rgba(48,172,219,0.15)',

                borderWidth: 1,
                borderColor:
                  'rgba(100,225,255,0.36)',
              }}
            >
              <Ionicons
                name={
                  documentoSelezionato?.icona ||
                  'document-text-outline'
                }
                size={25}
                color={
                  documentoSelezionato?.colore ||
                  '#70E5FF'
                }
              />
            </View>

            <View
              style={{
                flex: 1,
                marginLeft: 13,
              }}
            >
              <Text
                style={{
                  color: '#7ADFFF',
                  fontSize: 9,
                  fontWeight: '900',
                  letterSpacing: 1,
                }}
              >
                DOCUMENTO PERSONALE
              </Text>

              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 21,
                  fontWeight: '900',
                  marginTop: 3,
                }}
              >
                {documentoNomeDraft ||
                  documentoSelezionato?.titolo ||
                  'Documento'}
              </Text>
            </View>
          </View>

          <View
            style={{
              alignSelf: 'flex-start',

              marginTop: 15,
              paddingHorizontal: 10,
              paddingVertical: 6,

              borderRadius: 11,

              backgroundColor:
                `${statoDoc.colore}18`,

              borderWidth: 1,
              borderColor:
                `${statoDoc.colore}55`,
            }}
          >
            <Text
              style={{
                color: statoDoc.colore,
                fontSize: 8.5,
                fontWeight: '900',
                letterSpacing: 0.65,
              }}
            >
              {statoDoc.testo}
            </Text>
          </View>
        </View>

        {documentoSelezionato?.id ===
        'altroDocumento' ? (
          <View
            style={{
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                color: '#809BB6',
                fontSize: 9,
                fontWeight: '900',
                letterSpacing: 0.8,
                marginBottom: 7,
              }}
            >
              NOME DOCUMENTO
            </Text>

            <TextInput
              value={documentoNomeDraft}
              onChangeText={
                setDocumentoNomeDraft
              }
              placeholder="Es. Certificato medico"
              placeholderTextColor="#607A96"
              style={{
                minHeight: 50,
                color: '#FFFFFF',

                paddingHorizontal: 14,
                paddingVertical: 11,

                borderRadius: 17,

                backgroundColor:
                  'rgba(7,22,48,0.92)',

                borderWidth: 1,
                borderColor:
                  'rgba(88,154,206,0.32)',

                fontSize: 13,
                fontWeight: '800',
              }}
            />
          </View>
        ) : null}

        {[
          {
            label: 'NUMERO / RIFERIMENTO',
            value: documentoNumeroDraft,
            setValue: setDocumentoNumeroDraft,
            placeholder:
              'Inserisci numero o riferimento',
            keyboard: 'default',
          },
          {
            label: 'DATA RILASCIO',
            value: documentoRilascioDraft,
            setValue:
              setDocumentoRilascioDraft,
            placeholder: 'GG/MM/AAAA',
            keyboard: 'numbers-and-punctuation',
          },
          {
            label: 'DATA SCADENZA',
            value:
              documentoScadenzaDraft,
            setValue:
              setDocumentoScadenzaDraft,
            placeholder: 'GG/MM/AAAA',
            keyboard: 'numbers-and-punctuation',
          },
        ].map((campo) => (
          <View
            key={campo.label}
            style={{
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                color: '#809BB6',
                fontSize: 9,
                fontWeight: '900',
                letterSpacing: 0.8,
                marginBottom: 7,
              }}
            >
              {campo.label}
            </Text>

            <TextInput
              value={campo.value}
              onChangeText={campo.setValue}
              placeholder={campo.placeholder}
              placeholderTextColor="#607A96"
              keyboardType={campo.keyboard}
              style={{
                minHeight: 50,

                color: '#FFFFFF',

                paddingHorizontal: 14,
                paddingVertical: 11,

                borderRadius: 17,

                backgroundColor:
                  'rgba(7,22,48,0.92)',

                borderWidth: 1,
                borderColor:
                  'rgba(88,154,206,0.32)',

                fontSize: 13,
                fontWeight: '800',
              }}
            />
          </View>
        ))}

        <View
          style={{
            marginBottom: 15,
          }}
        >
          <Text
            style={{
              color: '#809BB6',
              fontSize: 9,
              fontWeight: '900',
              letterSpacing: 0.8,
              marginBottom: 7,
            }}
          >
            NOTE
          </Text>

          <TextInput
            value={documentoNoteDraft}
            onChangeText={
              setDocumentoNoteDraft
            }
            placeholder="Aggiungi eventuali note..."
            placeholderTextColor="#607A96"
            multiline
            textAlignVertical="top"
            style={{
              minHeight: 100,

              color: '#FFFFFF',

              paddingHorizontal: 14,
              paddingVertical: 13,

              borderRadius: 18,

              backgroundColor:
                'rgba(7,22,48,0.92)',

              borderWidth: 1,
              borderColor:
                'rgba(88,154,206,0.32)',

              fontSize: 12.5,
              fontWeight: '700',
            }}
          />
        </View>


        {/* ===== ALLEGATO DOCUMENTO ===== */}
        <View
          style={{
            marginBottom: 15,
            padding: 15,
            borderRadius: 21,

            backgroundColor:
              'rgba(8,24,51,0.88)',

            borderWidth: 1,
            borderColor:
              'rgba(91,163,211,0.26)',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 13,

                alignItems: 'center',
                justifyContent: 'center',

                backgroundColor:
                  'rgba(50,158,200,0.13)',

                borderWidth: 1,
                borderColor:
                  'rgba(97,218,255,0.28)',
              }}
            >
              <Ionicons
                name="attach-outline"
                size={19}
                color="#6DDEFF"
              />
            </View>

            <View
              style={{
                flex: 1,
                marginLeft: 10,
              }}
            >
              <Text
                style={{
                  color: '#E5F3FF',
                  fontSize: 11,
                  fontWeight: '900',
                  letterSpacing: 0.4,
                }}
              >
                ALLEGATO
              </Text>

              <Text
                style={{
                  color: '#718BA3',
                  fontSize: 8.5,
                  fontWeight: '700',
                  marginTop: 2,
                }}
              >
                Fotografia, scansione o PDF
              </Text>
            </View>
          </View>

          {documentoAllegatoDraft ? (
            <>
              {documentoAllegatoDraft.tipo ===
              'immagine' ? (
                <View
                  style={{
                    overflow: 'hidden',
                    borderRadius: 17,
                    marginBottom: 11,

                    backgroundColor: '#07172E',

                    borderWidth: 1,
                    borderColor:
                      'rgba(99,214,255,0.28)',
                  }}
                >
                  <Image
                    source={{
                      uri:
                        documentoAllegatoDraft.uri,
                    }}
                    resizeMode="cover"
                    style={{
                      width: '100%',
                      height: 190,
                    }}
                  />
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.82}
                  onPress={apriAllegatoDocumento}
                  style={{
                    minHeight: 72,
                    marginBottom: 11,
                    paddingHorizontal: 14,

                    borderRadius: 17,

                    flexDirection: 'row',
                    alignItems: 'center',

                    backgroundColor:
                      'rgba(15,42,72,0.76)',

                    borderWidth: 1,
                    borderColor:
                      'rgba(116,154,237,0.30)',
                  }}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={27}
                    color="#9BACFF"
                  />

                  <View
                    style={{
                      flex: 1,
                      marginLeft: 11,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        color: '#FFFFFF',
                        fontSize: 11,
                        fontWeight: '900',
                      }}
                    >
                      {documentoAllegatoDraft.nome ||
                        'Documento PDF'}
                    </Text>

                    <Text
                      style={{
                        color: '#7D95AE',
                        fontSize: 8.5,
                        fontWeight: '700',
                        marginTop: 3,
                      }}
                    >
                      Tocca per aprire
                    </Text>
                  </View>

                  <Ionicons
                    name="open-outline"
                    size={18}
                    color="#849DFF"
                  />
                </TouchableOpacity>
              )}

              <View
                style={{
                  flexDirection: 'row',
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={
                    documentoAllegatoDraft.tipo ===
                    'pdf'
                      ? apriAllegatoDocumento
                      : scegliFotoDocumento
                  }
                  style={{
                    flex: 1,
                    minHeight: 43,

                    alignItems: 'center',
                    justifyContent: 'center',

                    borderRadius: 14,

                    backgroundColor:
                      'rgba(26,78,99,0.62)',

                    borderWidth: 1,
                    borderColor:
                      'rgba(88,213,220,0.27)',
                  }}
                >
                  <Text
                    style={{
                      color: '#CFFAFF',
                      fontSize: 9,
                      fontWeight: '900',
                    }}
                  >
                    {documentoAllegatoDraft.tipo ===
                    'pdf'
                      ? 'APRI'
                      : 'CAMBIA FOTO'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={
                    rimuoviAllegatoDocumento
                  }
                  style={{
                    flex: 1,
                    minHeight: 43,
                    marginLeft: 8,

                    alignItems: 'center',
                    justifyContent: 'center',

                    borderRadius: 14,

                    backgroundColor:
                      'rgba(86,35,43,0.50)',

                    borderWidth: 1,
                    borderColor:
                      'rgba(255,105,118,0.25)',
                  }}
                >
                  <Text
                    style={{
                      color: '#FF9DA7',
                      fontSize: 9,
                      fontWeight: '900',
                    }}
                  >
                    RIMUOVI
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View>
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={scattaFotoDocumento}
                style={{
                  minHeight: 56,
                  marginBottom: 8,

                  flexDirection: 'row',
                  alignItems: 'center',

                  paddingHorizontal: 15,

                  borderRadius: 17,

                  backgroundColor:
                    'rgba(18,78,92,0.68)',

                  borderWidth: 1,
                  borderColor:
                    'rgba(88,224,219,0.31)',
                }}
              >
                <View
                  style={{
                    width: 35,
                    height: 35,
                    borderRadius: 12,

                    alignItems: 'center',
                    justifyContent: 'center',

                    backgroundColor:
                      'rgba(69,213,205,0.12)',
                  }}
                >
                  <Ionicons
                    name="camera-outline"
                    size={20}
                    color="#66E2D2"
                  />
                </View>

                <Text
                  style={{
                    flex: 1,
                    color: '#E0FFFB',
                    fontSize: 10,
                    fontWeight: '900',
                    marginLeft: 11,
                  }}
                >
                  SCATTA FOTO
                </Text>

                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color="#649D9A"
                />
              </TouchableOpacity>

              <View
                style={{
                  flexDirection: 'row',
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.82}
                  onPress={scegliFotoDocumento}
                  style={{
                    flex: 1,
                    minHeight: 72,
                    marginRight: 5,

                    alignItems: 'center',
                    justifyContent: 'center',

                    borderRadius: 17,

                    backgroundColor:
                      'rgba(16,54,76,0.62)',

                    borderWidth: 1,
                    borderColor:
                      'rgba(94,215,255,0.28)',
                  }}
                >
                  <Ionicons
                    name="images-outline"
                    size={22}
                    color="#70E1FF"
                  />

                  <Text
                    style={{
                      color: '#D8F8FF',
                      fontSize: 8.5,
                      fontWeight: '900',
                      marginTop: 6,
                    }}
                  >
                    GALLERIA
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.82}
                  onPress={scegliFileDocumento}
                  style={{
                    flex: 1,
                    minHeight: 72,
                    marginLeft: 5,

                    alignItems: 'center',
                    justifyContent: 'center',

                    borderRadius: 17,

                    backgroundColor:
                      'rgba(31,42,81,0.62)',

                    borderWidth: 1,
                    borderColor:
                      'rgba(139,157,255,0.28)',
                  }}
                >
                  <Ionicons
                    name="document-outline"
                    size={22}
                    color="#A7B4FF"
                  />

                  <Text
                    style={{
                      color: '#E4E8FF',
                      fontSize: 8.5,
                      fontWeight: '900',
                      marginTop: 6,
                    }}
                  >
                    PDF / FILE
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity
          activeOpacity={0.82}
          onPress={salvaDocumentoPersonale}
          style={{
            minHeight: 56,

            alignItems: 'center',
            justifyContent: 'center',

            flexDirection: 'row',

            borderRadius: 19,

            backgroundColor:
              'rgba(20,136,171,0.96)',

            borderWidth: 1,
            borderColor: '#6CE5FF',

            shadowColor: '#55DFFF',
            shadowOpacity: 0.22,
            shadowRadius: 11,
            shadowOffset: {
              width: 0,
              height: 5,
            },
          }}
        >
          <Ionicons
            name="save-outline"
            size={19}
            color="#FFFFFF"
          />

          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 11,
              fontWeight: '900',
              letterSpacing: 0.7,
              marginLeft: 7,
            }}
          >
            SALVA DOCUMENTO
          </Text>
        </TouchableOpacity>

        <View
          style={{
            marginTop: 14,
            marginBottom: 15,

            padding: 12,

            flexDirection: 'row',

            borderRadius: 17,

            backgroundColor:
              'rgba(11,28,50,0.55)',

            borderWidth: 1,
            borderColor:
              'rgba(75,112,146,0.16)',
          }}
        >
          <Ionicons
            name="lock-closed-outline"
            size={16}
            color="#719DBE"
          />

          <Text
            style={{
              flex: 1,
              marginLeft: 8,

              color: '#6F899F',
              fontSize: 9,
              lineHeight: 14,
              fontWeight: '600',
            }}
          >
            Questi dati restano privati e non
            vengono mostrati agli altri utenti.
          </Text>
        </View>
      </Screen>
    );
  }


  
  /* =====================================================
     DETTAGLIO EMERGENZA
     ===================================================== */
  if (screen === 'emergenzaDettaglio') {

    const emergenza = emergenzaSelezionata;

    if (!emergenza) {
      return (
        <Screen>
          <Back
            onPress={() =>
              setScreen('emergenzeServizio')
            }
          />

          <View
            style={{
              marginTop: 20,
              padding: 18,
              borderRadius: 22,
              backgroundColor:
                'rgba(12,30,60,0.92)',
            }}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 15,
                fontWeight: '900',
              }}
            >
              Nessuna procedura selezionata
            </Text>
          </View>
        </Screen>
      );
    }

    return (
      <Screen>
        <Back
          onPress={() => {
            setEmergenzaSelezionata(null);
            setScreen('emergenzeServizio');
          }}
        />

        {/* HERO */}
        <View
          style={{
            marginTop: 8,
            marginBottom: 18,
            padding: 20,
            borderRadius: 27,

            backgroundColor:
              'rgba(34,25,57,0.95)',

            borderWidth: 1,
            borderColor:
              `${emergenza.colore}55`,

            shadowColor:
              emergenza.colore,
            shadowOpacity: 0.13,
            shadowRadius: 15,
            shadowOffset: {
              width: 0,
              height: 6,
            },
          }}
        >
          <View
            style={{
              width: 51,
              height: 51,
              borderRadius: 17,

              alignItems: 'center',
              justifyContent: 'center',

              backgroundColor:
                `${emergenza.colore}18`,

              borderWidth: 1,
              borderColor:
                `${emergenza.colore}50`,
            }}
          >
            <Ionicons
              name={emergenza.icona}
              size={26}
              color={emergenza.colore}
            />
          </View>

          <Text
            style={{
              color: emergenza.colore,
              fontSize: 9.5,
              fontWeight: '900',
              letterSpacing: 1.2,
              marginTop: 15,
            }}
          >
            PROCEDURA RAPIDA
          </Text>

          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 26,
              fontWeight: '900',
              marginTop: 4,
            }}
          >
            {emergenza.titolo}
          </Text>

          <Text
            style={{
              color: '#A9B8C9',
              fontSize: 11.5,
              lineHeight: 17,
              fontWeight: '600',
              marginTop: 5,
            }}
          >
            {emergenza.sottotitolo}
          </Text>
        </View>

        {/* PRIORITÀ */}
        <View
          style={{
            marginBottom: 17,
            padding: 14,
            borderRadius: 20,

            flexDirection: 'row',
            alignItems: 'center',

            backgroundColor:
              'rgba(51,37,28,0.68)',

            borderWidth: 1,
            borderColor:
              'rgba(255,181,92,0.26)',
          }}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={20}
            color="#FFB763"
          />

          <Text
            style={{
              flex: 1,
              color: '#E7D2B8',
              fontSize: 9.5,
              lineHeight: 15,
              fontWeight: '800',
              marginLeft: 9,
            }}
          >
            Priorità: sicurezza delle persone,
            chiamata dei soccorsi e rispetto
            delle procedure del sito.
          </Text>
        </View>

        <Text
          style={{
            color: '#8DA4BC',
            fontSize: 9,
            fontWeight: '900',
            letterSpacing: 1.1,
            marginBottom: 10,
          }}
        >
          COSA FARE
        </Text>

        {/* PASSAGGI */}
        {emergenza.passaggi.map(
          (passaggio, index) => (
            <View
              key={`${emergenza.id}_${index}`}
              style={{
                marginBottom: 10,
                padding: 14,
                borderRadius: 20,

                flexDirection: 'row',

                backgroundColor:
                  'rgba(9,27,56,0.94)',

                borderWidth: 1,
                borderColor:
                  'rgba(87,137,179,0.20)',
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 11,

                  alignItems: 'center',
                  justifyContent: 'center',

                  backgroundColor:
                    `${emergenza.colore}18`,

                  borderWidth: 1,
                  borderColor:
                    `${emergenza.colore}45`,
                }}
              >
                <Text
                  style={{
                    color:
                      emergenza.colore,
                    fontSize: 12,
                    fontWeight: '900',
                  }}
                >
                  {index + 1}
                </Text>
              </View>

              <Text
                style={{
                  flex: 1,
                  marginLeft: 11,

                  color: '#EAF2FA',
                  fontSize: 11,
                  lineHeight: 17,
                  fontWeight: '700',
                }}
              >
                {passaggio}
              </Text>
            </View>
          )
        )}

        {/* AZIONI RAPIDE */}
        <Text
          style={{
            color: '#8DA4BC',
            fontSize: 9,
            fontWeight: '900',
            letterSpacing: 1.1,
            marginTop: 8,
            marginBottom: 10,
          }}
        >
          AZIONI RAPIDE
        </Text>

        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() =>
            setScreen('numeriUtili')
          }
          style={{
            minHeight: 56,
            marginBottom: 10,

            flexDirection: 'row',
            alignItems: 'center',

            paddingHorizontal: 15,

            borderRadius: 18,

            backgroundColor:
              'rgba(80,29,39,0.82)',

            borderWidth: 1,
            borderColor:
              'rgba(255,107,122,0.34)',

            shadowColor: '#FF6F7D',
            shadowOpacity: 0.11,
            shadowRadius: 9,
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 13,

              alignItems: 'center',
              justifyContent: 'center',

              backgroundColor:
                'rgba(255,104,119,0.12)',
            }}
          >
            <Ionicons
              name="call"
              size={19}
              color="#FF8590"
            />
          </View>

          <View
            style={{
              flex: 1,
              marginLeft: 10,
            }}
          >
            <Text
              style={{
                color: '#FF9FA8',
                fontSize: 8,
                fontWeight: '900',
                letterSpacing: 0.8,
              }}
            >
              EMERGENZA
            </Text>

            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: '900',
                marginTop: 2,
              }}
            >
              Numeri utili · 112
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={18}
            color="#C27A83"
          />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() =>
            setScreen('numeriUtili')
          }
          style={{
            minHeight: 56,

            flexDirection: 'row',
            alignItems: 'center',

            paddingHorizontal: 15,

            borderRadius: 18,

            backgroundColor:
              'rgba(17,51,72,0.74)',

            borderWidth: 1,
            borderColor:
              'rgba(91,207,225,0.25)',
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 13,

              alignItems: 'center',
              justifyContent: 'center',

              backgroundColor:
                'rgba(82,202,219,0.11)',
            }}
          >
            <Ionicons
              name="headset-outline"
              size={19}
              color="#68DCEB"
            />
          </View>

          <View
            style={{
              flex: 1,
              marginLeft: 10,
            }}
          >
            <Text
              style={{
                color: '#70BECB',
                fontSize: 8,
                fontWeight: '900',
                letterSpacing: 0.8,
              }}
            >
              SERVIZIO
            </Text>

            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: '900',
                marginTop: 2,
              }}
            >
              Sala Operativa
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={18}
            color="#608D9A"
          />
        </TouchableOpacity>

        <View
          style={{
            marginTop: 15,
            marginBottom: 15,

            padding: 12,

            flexDirection: 'row',

            borderRadius: 17,

            backgroundColor:
              'rgba(10,26,47,0.55)',

            borderWidth: 1,
            borderColor:
              'rgba(76,111,144,0.15)',
          }}
        >
          <Ionicons
            name="information-circle-outline"
            size={16}
            color="#7397B6"
          />

          <Text
            style={{
              flex: 1,
              marginLeft: 8,

              color: '#70869C',
              fontSize: 8.5,
              lineHeight: 14,
              fontWeight: '600',
            }}
          >
            Indicazioni generali: fanno sempre
            fede formazione, procedure aziendali
            e disposizioni delle autorità competenti.
          </Text>
        </View>
      </Screen>
    );
  }



  /* =====================================================
     GPG VS FIDUCIARIO - V1
     ===================================================== */
  if (screen === 'gpgVsFiduciario') {

    const confronto = [
      {
        titolo: 'Qualifica',
        gpg:
          'Guardia Particolare Giurata riconosciuta nell’ambito della vigilanza privata autorizzata.',
        fiduciario:
          'Operatore addetto a servizi fiduciari, accoglienza, controllo accessi e attività analoghe previste dall’incarico.',
      },
      {
        titolo: 'Servizio armato',
        gpg:
          'Può svolgere servizi armati quando previsto dalle autorizzazioni, dal servizio e dalla normativa applicabile.',
        fiduciario:
          'Il servizio fiduciario non attribuisce una qualifica per svolgere vigilanza armata.',
      },
      {
        titolo: 'Vigilanza',
        gpg:
          'Può essere impiegata nei servizi di vigilanza privata autorizzati, come vigilanza fissa o ispettiva.',
        fiduciario:
          'Svolge attività di supporto, reception, portierato, gestione accessi e controllo secondo le consegne, senza essere equiparato alla GPG.',
      },
      {
        titolo: 'Controllo accessi',
        gpg:
          'Può essere previsto come parte del servizio di vigilanza, anche con verifica dei titoli di accesso.',
        fiduciario:
          'Può svolgere controllo accessi e attività organizzative nei limiti dell’incarico e delle procedure del sito.',
      },
      {
        titolo: 'In caso di reato',
        gpg:
          'Deve attenersi alle proprie attribuzioni, alle procedure di servizio e richiedere l’intervento delle Forze dell’Ordine quando necessario.',
        fiduciario:
          'Deve evitare iniziative che presuppongano poteri non posseduti e allertare responsabili, Sala Operativa o Forze dell’Ordine secondo la situazione.',
      },
      {
        titolo: 'Regola fondamentale',
        gpg:
          'Essere GPG non significa avere gli stessi poteri delle Forze di Polizia.',
        fiduciario:
          'Essere fiduciario non significa essere una Guardia Particolare Giurata.',
      },
    ];

    return (
      <Screen>
        <Back
          onPress={() =>
            setScreen('regoleGiuramento')
          }
        />

        <View
          style={{
            marginTop: 8,
            marginBottom: 18,
            padding: 20,

            borderRadius: 27,

            backgroundColor:
              'rgba(45,35,24,0.93)',

            borderWidth: 1,
            borderColor:
              'rgba(255,181,107,0.34)',

            shadowColor: '#FFB66B',
            shadowOpacity: 0.11,
            shadowRadius: 14,
            shadowOffset: {
              width: 0,
              height: 6,
            },
          }}
        >
          <View
            style={{
              width: 49,
              height: 49,
              borderRadius: 16,

              alignItems: 'center',
              justifyContent: 'center',

              backgroundColor:
                'rgba(255,181,107,0.12)',

              borderWidth: 1,
              borderColor:
                'rgba(255,190,121,0.30)',
            }}
          >
            <Ionicons
              name="git-compare-outline"
              size={25}
              color="#FFBB73"
            />
          </View>

          <Text
            style={{
              color: '#FFBD78',
              fontSize: 9.5,
              fontWeight: '900',
              letterSpacing: 1.15,
              marginTop: 15,
            }}
          >
            CONFRONTO RAPIDO
          </Text>

          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 27,
              fontWeight: '900',
              marginTop: 4,
            }}
          >
            GPG vs Fiduciario
          </Text>

          <Text
            style={{
              color: '#B7AA99',
              fontSize: 11.5,
              lineHeight: 18,
              fontWeight: '600',
              marginTop: 6,
            }}
          >
            Due ruoli diversi che possono lavorare nello
            stesso ambiente, ma con funzioni e limiti differenti.
          </Text>
        </View>

        {confronto.map((item, index) => (
          <View
            key={`confronto_${index}`}
            style={{
              marginBottom: 12,
              padding: 15,

              borderRadius: 21,

              backgroundColor:
                'rgba(9,27,56,0.94)',

              borderWidth: 1,
              borderColor:
                'rgba(92,132,169,0.20)',
            }}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: '900',
                marginBottom: 11,
              }}
            >
              {item.titolo}
            </Text>

            <View
              style={{
                padding: 12,
                borderRadius: 16,

                backgroundColor:
                  'rgba(42,52,92,0.62)',

                borderWidth: 1,
                borderColor:
                  'rgba(131,154,255,0.20)',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={16}
                  color="#95AAFF"
                />

                <Text
                  style={{
                    color: '#9DAFFF',
                    fontSize: 8.5,
                    fontWeight: '900',
                    letterSpacing: 0.8,
                    marginLeft: 6,
                  }}
                >
                  GPG
                </Text>
              </View>

              <Text
                style={{
                  color: '#E7ECFF',
                  fontSize: 10,
                  lineHeight: 16,
                  fontWeight: '700',
                }}
              >
                {item.gpg}
              </Text>
            </View>

            <View
              style={{
                marginTop: 8,
                padding: 12,
                borderRadius: 16,

                backgroundColor:
                  'rgba(23,66,61,0.52)',

                borderWidth: 1,
                borderColor:
                  'rgba(93,219,185,0.18)',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <Ionicons
                  name="person-outline"
                  size={16}
                  color="#6FDFBE"
                />

                <Text
                  style={{
                    color: '#76DFBF',
                    fontSize: 8.5,
                    fontWeight: '900',
                    letterSpacing: 0.8,
                    marginLeft: 6,
                  }}
                >
                  FIDUCIARIO
                </Text>
              </View>

              <Text
                style={{
                  color: '#DDF4EC',
                  fontSize: 10,
                  lineHeight: 16,
                  fontWeight: '700',
                }}
              >
                {item.fiduciario}
              </Text>
            </View>
          </View>
        ))}

        <View
          style={{
            marginTop: 5,
            marginBottom: 15,

            padding: 14,

            flexDirection: 'row',

            borderRadius: 19,

            backgroundColor:
              'rgba(46,37,24,0.58)',

            borderWidth: 1,
            borderColor:
              'rgba(255,181,107,0.18)',
          }}
        >
          <Ionicons
            name="information-circle-outline"
            size={18}
            color="#D6A66B"
          />

          <Text
            style={{
              flex: 1,
              marginLeft: 9,

              color: '#A99882',
              fontSize: 8.7,
              lineHeight: 14,
              fontWeight: '600',
            }}
          >
            Le funzioni concrete dipendono dal tipo di
            servizio, dalle autorizzazioni applicabili,
            dalle consegne e dalla normativa vigente.
          </Text>
        </View>
      </Screen>
    );
  }



  /* =====================================================
     POSTAZIONI - V1
     ===================================================== */
  if (screen === 'postazioni') {

    return (
      <Screen>
        <Back onPress={() => setScreen('strumenti')} />

        <View
          style={{
            marginTop: 8,
            marginBottom: 18,
            padding: 20,

            borderRadius: 27,

            backgroundColor:
              'rgba(13,41,62,0.95)',

            borderWidth: 1,
            borderColor:
              'rgba(85,224,196,0.32)',

            shadowColor: '#56E0C5',
            shadowOpacity: 0.12,
            shadowRadius: 15,
            shadowOffset: {
              width: 0,
              height: 6,
            },
          }}
        >
          <View
            style={{
              width: 49,
              height: 49,
              borderRadius: 16,

              alignItems: 'center',
              justifyContent: 'center',

              backgroundColor:
                'rgba(76,210,186,0.12)',

              borderWidth: 1,
              borderColor:
                'rgba(92,229,206,0.30)',
            }}
          >
            <Ionicons
              name="location-outline"
              size={25}
              color="#68E5CD"
            />
          </View>

          <Text
            style={{
              color: '#67E1C8',
              fontSize: 9.5,
              fontWeight: '900',
              letterSpacing: 1.2,
              marginTop: 15,
            }}
          >
            CONSEGNE DEL SITO
          </Text>

          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 28,
              fontWeight: '900',
              marginTop: 4,
            }}
          >
            Postazioni
          </Text>

          <Text
            style={{
              color: '#9FB8C3',
              fontSize: 11.5,
              lineHeight: 18,
              fontWeight: '600',
              marginTop: 6,
            }}
          >
            Salva una volta orari, attività e informazioni
            utili di ogni luogo dove presti servizio.
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.82}
          onPress={nuovaPostazione}
          style={{
            minHeight: 55,
            marginBottom: 18,

            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',

            borderRadius: 19,

            backgroundColor:
              'rgba(22,133,116,0.94)',

            borderWidth: 1,
            borderColor: '#67E3CA',

            shadowColor: '#56E0C5',
            shadowOpacity: 0.17,
            shadowRadius: 10,
          }}
        >
          <Ionicons
            name="add-circle-outline"
            size={20}
            color="#FFFFFF"
          />

          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 11,
              fontWeight: '900',
              letterSpacing: 0.6,
              marginLeft: 7,
            }}
          >
            NUOVA POSTAZIONE
          </Text>
        </TouchableOpacity>

        <Text
          style={{
            color: '#829CB2',
            fontSize: 9,
            fontWeight: '900',
            letterSpacing: 1.1,
            marginBottom: 10,
          }}
        >
          POSTAZIONI SALVATE
        </Text>

        {postazioniSalvate.length === 0 ? (
          <View
            style={{
              padding: 18,
              borderRadius: 21,

              backgroundColor:
                'rgba(10,27,52,0.78)',

              borderWidth: 1,
              borderColor:
                'rgba(86,131,165,0.18)',
            }}
          >
            <Ionicons
              name="location-outline"
              size={25}
              color="#607F98"
            />

            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: '900',
                marginTop: 10,
              }}
            >
              Nessuna postazione salvata
            </Text>

            <Text
              style={{
                color: '#70899F',
                fontSize: 9.5,
                lineHeight: 15,
                marginTop: 5,
              }}
            >
              Crea la prima scheda con le consegne
              del luogo dove lavori.
            </Text>
          </View>
        ) : (
          postazioniSalvate.map(
            (postazione) => (
              <TouchableOpacity
                key={postazione.id}
                activeOpacity={0.82}
                onPress={() =>
                  apriPostazione(postazione)
                }
                style={{
                  minHeight: 82,
                  marginBottom: 10,

                  paddingHorizontal: 14,
                  paddingVertical: 13,

                  flexDirection: 'row',
                  alignItems: 'center',

                  borderRadius: 22,

                  backgroundColor:
                    'rgba(9,28,58,0.94)',

                  borderWidth: 1,
                  borderColor:
                    'rgba(83,199,184,0.24)',
                }}
              >
                {postazione.foto ? (
                  <Image
                    source={{
                      uri: postazione.foto,
                    }}
                    resizeMode="cover"
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 16,

                      borderWidth: 1,
                      borderColor:
                        'rgba(93,224,205,0.34)',
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 45,
                      height: 45,
                      borderRadius: 15,

                      alignItems: 'center',
                      justifyContent: 'center',

                      backgroundColor:
                        'rgba(57,176,158,0.12)',
                    }}
                  >
                    <Ionicons
                      name="business-outline"
                      size={21}
                      color="#64DDC6"
                    />
                  </View>
                )}

                <View
                  style={{
                    flex: 1,
                    marginLeft: 12,
                  }}
                >
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 13.5,
                      fontWeight: '900',
                    }}
                  >
                    {postazione.nome}
                  </Text>

                  <Text
                    numberOfLines={1}
                    style={{
                      color: '#7C98AD',
                      fontSize: 9,
                      fontWeight: '700',
                      marginTop: 4,
                    }}
                  >
                    {postazione.zona ||
                      'Zona non indicata'}
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#55768A"
                />
              </TouchableOpacity>
            )
          )
        )}
      </Screen>
    );
  }

  /* =====================================================
     DETTAGLIO POSTAZIONE
     ===================================================== */
  if (screen === 'postazioneDettaglio') {

    return (
      <Screen>
        <Back
          onPress={() =>
            setScreen('postazioni')
          }
        />

        <View
          style={{
            marginTop: 8,
            marginBottom: 18,
            padding: 19,

            borderRadius: 26,

            backgroundColor:
              'rgba(13,39,63,0.95)',

            borderWidth: 1,
            borderColor:
              'rgba(86,218,197,0.30)',
          }}
        >
          <Text
            style={{
              color: '#68E1CA',
              fontSize: 10.5,
              fontWeight: '900',
              letterSpacing: 1.15,
            }}
          >
            SCHEDA POSTAZIONE
          </Text>

          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 29,
              fontWeight: '900',
              marginTop: 5,
            }}
          >
            {postazioneNomeDraft ||
              'Nuova postazione'}
          </Text>

          <Text
            style={{
              color: '#829EAF',
              fontSize: 11.5,
              fontWeight: '700',
              lineHeight: 17,
              marginTop: 5,
            }}
          >
            Tutto ciò che serve per ricordare
            come gestire questo luogo.
          </Text>
        </View>


        {/* ===== FOTO POSTAZIONE ===== */}
        <View
          style={{
            marginBottom: 16,
            padding: 16,

            borderRadius: 22,

            backgroundColor:
              'rgba(8,25,49,0.84)',

            borderWidth: 1,
            borderColor:
              'rgba(83,182,191,0.22)',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 11,
            }}
          >
            <Ionicons
              name="camera-outline"
              size={18}
              color="#65E1CA"
            />

            <View
              style={{
                flex: 1,
                marginLeft: 8,
              }}
            >
              <Text
                style={{
                  color: '#DDF9F4',
                  fontSize: 11.5,
                  fontWeight: '900',
                  letterSpacing: 0.6,
                }}
              >
                FOTO POSTAZIONE
              </Text>

              <Text
                style={{
                  color: '#718E9C',
                  fontSize: 10,
                  fontWeight: '700',
                  marginTop: 2,
                }}
              >
                Ingresso, edificio o punto di riferimento
              </Text>
            </View>
          </View>

          {postazioneFotoDraft ? (
            <>
              <View
                style={{
                  overflow: 'hidden',

                  borderRadius: 18,

                  backgroundColor: '#06172A',

                  borderWidth: 1,
                  borderColor:
                    'rgba(89,219,201,0.28)',
                }}
              >
                <Image
                  source={{
                    uri: postazioneFotoDraft,
                  }}
                  resizeMode="cover"
                  style={{
                    width: '100%',
                    height: 190,
                  }}
                />
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  marginTop: 9,
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.82}
                  onPress={scegliFotoPostazione}
                  style={{
                    flex: 1,
                    minHeight: 43,
                    marginRight: 4,

                    alignItems: 'center',
                    justifyContent: 'center',

                    borderRadius: 14,

                    backgroundColor:
                      'rgba(20,72,82,0.66)',

                    borderWidth: 1,
                    borderColor:
                      'rgba(86,207,194,0.24)',
                  }}
                >
                  <Text
                    style={{
                      color: '#D7FFF7',
                      fontSize: 8.5,
                      fontWeight: '900',
                    }}
                  >
                    CAMBIA FOTO
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.82}
                  onPress={rimuoviFotoPostazione}
                  style={{
                    flex: 1,
                    minHeight: 43,
                    marginLeft: 4,

                    alignItems: 'center',
                    justifyContent: 'center',

                    borderRadius: 14,

                    backgroundColor:
                      'rgba(76,29,37,0.52)',

                    borderWidth: 1,
                    borderColor:
                      'rgba(255,105,119,0.22)',
                  }}
                >
                  <Text
                    style={{
                      color: '#FF949E',
                      fontSize: 8.5,
                      fontWeight: '900',
                    }}
                  >
                    RIMUOVI
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={scattaFotoPostazione}
                style={{
                  minHeight: 60,
                  marginBottom: 9,

                  flexDirection: 'row',
                  alignItems: 'center',

                  paddingHorizontal: 14,

                  borderRadius: 16,

                  backgroundColor:
                    'rgba(18,78,88,0.66)',

                  borderWidth: 1,
                  borderColor:
                    'rgba(84,220,202,0.28)',
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,

                    alignItems: 'center',
                    justifyContent: 'center',

                    backgroundColor:
                      'rgba(74,213,194,0.12)',
                  }}
                >
                  <Ionicons
                    name="camera-outline"
                    size={20}
                    color="#65E1CA"
                  />
                </View>

                <Text
                  style={{
                    flex: 1,
                    marginLeft: 10,

                    color: '#E3FFFA',
                    fontSize: 11.5,
                    fontWeight: '900',
                  }}
                >
                  SCATTA FOTO
                </Text>

                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color="#669D94"
                />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.82}
                onPress={scegliFotoPostazione}
                style={{
                  minHeight: 60,

                  flexDirection: 'row',
                  alignItems: 'center',

                  paddingHorizontal: 14,

                  borderRadius: 16,

                  backgroundColor:
                    'rgba(18,53,76,0.62)',

                  borderWidth: 1,
                  borderColor:
                    'rgba(90,180,220,0.24)',
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,

                    alignItems: 'center',
                    justifyContent: 'center',

                    backgroundColor:
                      'rgba(82,170,211,0.11)',
                  }}
                >
                  <Ionicons
                    name="images-outline"
                    size={20}
                    color="#76CFFF"
                  />
                </View>

                <Text
                  style={{
                    flex: 1,
                    marginLeft: 10,

                    color: '#E0F5FF',
                    fontSize: 11.5,
                    fontWeight: '900',
                  }}
                >
                  SCEGLI DALLA GALLERIA
                </Text>

                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color="#6285A0"
                />
              </TouchableOpacity>
            </>
          )}
        </View>


        {/* ===== TIMELINE ATTIVITÀ ===== */}
        <View
          style={{
            marginBottom: 16,
            padding: 17,

            borderRadius: 23,

            backgroundColor:
              'rgba(8,26,52,0.88)',

            borderWidth: 1,
            borderColor:
              'rgba(91,170,220,0.25)',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <View
              style={{
                width: 39,
                height: 39,
                borderRadius: 13,

                alignItems: 'center',
                justifyContent: 'center',

                backgroundColor:
                  'rgba(74,177,223,0.12)',
              }}
            >
              <Ionicons
                name="time-outline"
                size={20}
                color="#70DFFF"
              />
            </View>

            <View
              style={{
                flex: 1,
                marginLeft: 10,
              }}
            >
              <Text
                style={{
                  color: '#DFF8FF',
                  fontSize: 13.5,
                  fontWeight: '900',
                  letterSpacing: 0.7,
                }}
              >
                ORARI E ATTIVITÀ
              </Text>

              <Text
                style={{
                  color: '#728DA4',
                  fontSize: 10,
                  fontWeight: '700',
                  marginTop: 3,
                }}
              >
                Crea la sequenza operativa della postazione
              </Text>
            </View>
          </View>

          {postazioneTimelineDraft.length > 0 ? (
            <View
              style={{
                marginBottom: 12,
              }}
            >
              {/* ===== TIMELINE VISIVA PREMIUM ===== */}
              {postazioneTimelineDraft.map(
                (item, index) => {
                  const ultimo =
                    index ===
                    postazioneTimelineDraft.length - 1;

                  return (
                    <View
                      key={item.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'stretch',
                        marginBottom: ultimo ? 0 : 4,
                      }}
                    >
                      {/* COLONNA ORA */}
                      <View
                        style={{
                          width: 78,
                          alignItems: 'center',
                        }}
                      >
                        <View
                          style={{
                            minWidth: 64,

                            paddingHorizontal: 9,
                            paddingVertical: 8,

                            alignItems: 'center',
                            justifyContent: 'center',

                            borderRadius: 13,

                            backgroundColor:
                              'rgba(50,157,205,0.16)',

                            borderWidth: 1,
                            borderColor:
                              'rgba(110,225,255,0.34)',

                            shadowColor: '#5EDFFF',
                            shadowOpacity: 0.08,
                            shadowRadius: 7,
                          }}
                        >
                          <Text
                            style={{
                              color: '#7BE6FF',
                              fontSize: 14,
                              fontWeight: '900',
                              letterSpacing: 0.2,
                            }}
                          >
                            {item.ora}
                          </Text>
                        </View>

                        {!ultimo ? (
                          <View
                            style={{
                              flex: 1,
                              width: 2,
                              minHeight: 34,
                              marginTop: 5,
                              marginBottom: 2,

                              backgroundColor:
                                'rgba(91,198,232,0.24)',
                            }}
                          />
                        ) : null}
                      </View>

                      {/* PALLINO + CARD */}
                      <View
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'flex-start',
                        }}
                      >
                        <View
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            marginTop: 15,
                            marginRight: 9,

                            backgroundColor: '#66E5FF',

                            borderWidth: 2,
                            borderColor:
                              'rgba(153,240,255,0.65)',

                            shadowColor: '#64E3FF',
                            shadowOpacity: 0.35,
                            shadowRadius: 7,
                          }}
                        />

                        <View
                          style={{
                            flex: 1,
                            minHeight: 64,

                            marginBottom: ultimo ? 0 : 10,
                            paddingHorizontal: 13,
                            paddingVertical: 12,

                            borderRadius: 18,

                            backgroundColor:
                              'rgba(12,38,70,0.88)',

                            borderWidth: 1,
                            borderColor:
                              'rgba(88,167,215,0.22)',
                          }}
                        >
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'flex-start',
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text
                                style={{
                                  color: '#FFFFFF',
                                  fontSize: 12.5,
                                  lineHeight: 18,
                                  fontWeight: '900',
                                }}
                              >
                                {item.testo}
                              </Text>

                              <Text
                                style={{
                                  color: '#65839B',
                                  fontSize: 8.5,
                                  fontWeight: '900',
                                  letterSpacing: 0.7,
                                  marginTop: 5,
                                }}
                              >
                                ATTIVITÀ {index + 1}
                              </Text>
                            </View>

                            <TouchableOpacity
                              activeOpacity={0.78}
                              onPress={() =>
                                eliminaAttivitaPostazione(
                                  item.id
                                )
                              }
                              style={{
                                width: 36,
                                height: 36,
                                marginLeft: 8,

                                alignItems: 'center',
                                justifyContent: 'center',

                                borderRadius: 12,

                                backgroundColor:
                                  'rgba(91,32,42,0.48)',

                                borderWidth: 1,
                                borderColor:
                                  'rgba(255,115,129,0.16)',
                              }}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={16}
                                color="#FF8F9A"
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                }
              )}
            </View>
          ) : (
            <View
              style={{
                marginBottom: 12,
                padding: 12,

                borderRadius: 15,

                backgroundColor:
                  'rgba(11,31,56,0.58)',
              }}
            >
              <Text
                style={{
                  color: '#69869E',
                  fontSize: 10.5,
                  lineHeight: 16,
                  fontWeight: '700',
                }}
              >
                Nessuna attività inserita.
                Aggiungi il primo orario qui sotto.
              </Text>
            </View>
          )}

          <View
            style={{
              flexDirection: 'row',
              marginBottom: 8,
            }}
          >
            <View
              style={{
                width: 100,
                marginRight: 9,
              }}
            >
              <Text
                style={{
                  color: '#728DA4',
                  fontSize: 10,
                  fontWeight: '900',
                  letterSpacing: 0.6,
                  marginBottom: 6,
                }}
              >
                ORA
              </Text>

              <TextInput
                value={postazioneOraNuova}
                onChangeText={setPostazioneOraNuova}
                placeholder="18:30"
                placeholderTextColor="#557087"
                keyboardType="numbers-and-punctuation"
                returnKeyType="done"
                onSubmitEditing={() =>
                  Keyboard.dismiss()
                }
                style={{
                  minHeight: 52,

                  color: '#FFFFFF',

                  paddingHorizontal: 11,

                  borderRadius: 15,

                  backgroundColor:
                    'rgba(6,21,45,0.94)',

                  borderWidth: 1,
                  borderColor:
                    'rgba(83,151,188,0.29)',

                  fontSize: 12,
                  fontWeight: '900',
                }}
              />
            </View>

            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={{
                  color: '#728DA4',
                  fontSize: 10,
                  fontWeight: '900',
                  letterSpacing: 0.6,
                  marginBottom: 6,
                }}
              >
                COSA FARE
              </Text>

              <TextInput
                value={postazioneAttivitaNuova}
                onChangeText={
                  setPostazioneAttivitaNuova
                }
                placeholder="Es. Giro perimetrale"
                placeholderTextColor="#557087"
                returnKeyType="done"
                onSubmitEditing={
                  aggiungiAttivitaPostazione
                }
                style={{
                  minHeight: 52,

                  color: '#FFFFFF',

                  paddingHorizontal: 11,

                  borderRadius: 15,

                  backgroundColor:
                    'rgba(6,21,45,0.94)',

                  borderWidth: 1,
                  borderColor:
                    'rgba(83,151,188,0.29)',

                  fontSize: 12.5,
                  fontWeight: '800',
                }}
              />
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.82}
            onPress={aggiungiAttivitaPostazione}
            style={{
              minHeight: 54,

              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',

              borderRadius: 18,

              backgroundColor:
                'rgba(18,126,165,0.94)',

              borderWidth: 1,
              borderColor:
                'rgba(101,220,255,0.48)',
            }}
          >
            <Ionicons
              name="add-circle-outline"
              size={18}
              color="#FFFFFF"
            />

            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 11,
                fontWeight: '900',
                letterSpacing: 0.5,
                marginLeft: 6,
              }}
            >
              AGGIUNGI ATTIVITÀ
            </Text>
          </TouchableOpacity>

          {postazioneAttivitaDraft ? (
            <View
              style={{
                marginTop: 11,
                padding: 10,

                borderRadius: 14,

                backgroundColor:
                  'rgba(54,43,20,0.38)',

                borderWidth: 1,
                borderColor:
                  'rgba(213,171,86,0.15)',
              }}
            >
              <Text
                style={{
                  color: '#B6A275',
                  fontSize: 8,
                  lineHeight: 13,
                  fontWeight: '700',
                }}
              >
                Vecchie note attività conservate:
                {'\n'}
                {postazioneAttivitaDraft}
              </Text>
            </View>
          ) : null}
        </View>

        {[
          {
            label: 'NOME POSTAZIONE',
            value: postazioneNomeDraft,
            setValue: setPostazioneNomeDraft,
            placeholder:
              'Es. Poste Italiane Fiumicino',
            multiline: false,
          },
          {
            label: 'ZONA / INDIRIZZO',
            value: postazioneZonaDraft,
            setValue: setPostazioneZonaDraft,
            placeholder:
              'Es. Fiumicino · Via...',
            multiline: false,
          },
          {
            label: 'CHIAVI · PORTE · CANCELLI',
            value: postazioneChiaviDraft,
            setValue:
              setPostazioneChiaviDraft,
            placeholder:
              'Chiave cancello: armadio sala vigilanza, gancio 4...',
            multiline: true,
          },
          {
            label: 'RESPONSABILE DEL SITO',
            value:
              postazioneResponsabileDraft,
            setValue:
              setPostazioneResponsabileDraft,
            placeholder:
              'Es. Mario Rossi',
            multiline: false,
          },
          {
            label: 'TELEFONO POSTAZIONE',
            value:
              postazioneTelefonoDraft,
            setValue:
              setPostazioneTelefonoDraft,
            placeholder:
              'Es. 06 12345678',
            multiline: false,
          },
          {
            label: 'TELEFONO RESPONSABILE',
            value:
              postazioneTelefonoResponsabileDraft,
            setValue:
              setPostazioneTelefonoResponsabileDraft,
            placeholder:
              'Es. 333 1234567',
            multiline: false,
          },
          {
            label: 'CONTATTI DEL SITO',
            value:
              postazioneContattiDraft,
            setValue:
              setPostazioneContattiDraft,
            placeholder:
              'Referente, manutenzione, responsabile...',
            multiline: true,
          },
          {
            label: 'NOTE OPERATIVE',
            value: postazioneNoteDraft,
            setValue:
              setPostazioneNoteDraft,
            placeholder:
              'Annotazioni utili da ricordare...',
            multiline: true,
          },
        ].map((campo) => (
          <View
            key={campo.label}
            style={{
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                color: '#7F9AAD',
                fontSize: 10.5,
                fontWeight: '900',
                letterSpacing: 0.8,
                marginBottom: 7,
              }}
            >
              {campo.label}
            </Text>

            <TextInput
              value={campo.value}
              onChangeText={campo.setValue}
              placeholder={campo.placeholder}
              placeholderTextColor="#577288"
              multiline={campo.multiline} 
              returnKeyType={
                campo.multiline
                  ? 'default'
                  : 'done'
              }
              blurOnSubmit={
                !campo.multiline
              }
              submitBehavior={
                campo.multiline
                  ? 'newline'
                  : 'blurAndSubmit'
              }
              textAlignVertical={
                campo.multiline
                  ? 'top'
                  : 'center'
              }
              style={{
                minHeight:
                  campo.multiline
                    ? 118
                    : 54,

                color: '#FFFFFF',

                paddingHorizontal: 14,
                paddingVertical:
                  campo.multiline
                    ? 13
                    : 10,

                borderRadius: 18,

                backgroundColor:
                  'rgba(6,21,45,0.92)',

                borderWidth: 1,
                borderColor:
                  'rgba(80,150,185,0.29)',

                fontSize: 13.5,
                lineHeight: 20,
                fontWeight: '700',
              }}
            />
          </View>
        ))}

        <View
          style={{
            marginBottom: 15,
            padding: 12,

            flexDirection: 'row',

            borderRadius: 17,

            backgroundColor:
              'rgba(56,43,21,0.47)',

            borderWidth: 1,
            borderColor:
              'rgba(238,177,89,0.17)',
          }}
        >
          <Ionicons
            name="lock-closed-outline"
            size={16}
            color="#D6A65E"
          />

          <Text
            style={{
              flex: 1,
              marginLeft: 8,

              color: '#9E8A69',
              fontSize: 8.5,
              lineHeight: 14,
              fontWeight: '600',
            }}
          >
            Evita di salvare PIN, password,
            combinazioni di allarme o altre
            credenziali sensibili.
          </Text>
        </View>


        


        

        <TouchableOpacity
          activeOpacity={0.82}
          onPress={salvaPostazione}
          style={{
            minHeight: 60,

            alignItems: 'center',
            justifyContent: 'center',

            flexDirection: 'row',

            borderRadius: 19,

            backgroundColor:
              'rgba(20,134,117,0.96)',

            borderWidth: 1,
            borderColor: '#68E2CA',

            shadowColor: '#56E0C5',
            shadowOpacity: 0.18,
            shadowRadius: 10,
          }}
        >
          <Ionicons
            name="save-outline"
            size={19}
            color="#FFFFFF"
          />

          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 12.5,
              fontWeight: '900',
              letterSpacing: 0.6,
              marginLeft: 7,
            }}
          >
            SALVA POSTAZIONE
          </Text>
        </TouchableOpacity>

        {postazioneSelezionata ? (
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={eliminaPostazione}
            style={{
              minHeight: 48,
              marginTop: 10,
              marginBottom: 15,

              alignItems: 'center',
              justifyContent: 'center',

              borderRadius: 17,

              backgroundColor:
                'rgba(72,28,37,0.54)',

              borderWidth: 1,
              borderColor:
                'rgba(255,103,118,0.22)',
            }}
          >
            <Text
              style={{
                color: '#FF929C',
                fontSize: 9.5,
                fontWeight: '900',
                letterSpacing: 0.5,
              }}
            >
              ELIMINA POSTAZIONE
            </Text>
          </TouchableOpacity>
        ) : null}
      </Screen>
    );
  }


/* ===== PAGINE STRUMENTI - BASE ===== */

  
  /* =====================================================
     NUMERI UTILI - SAFE V1
     ===================================================== */
  if (screen === 'numeriUtili') {
    const numeriEmergenza = [
      {
        numero: '112',
        titolo: 'Emergenza unica',
        testo: 'Numero Unico Europeo di Emergenza',
        icona: 'shield-checkmark-outline',
        colore: '#63E6FF',
      },
      {
        numero: '113',
        titolo: 'Polizia di Stato',
        testo: 'Soccorso pubblico di polizia',
        icona: 'shield-outline',
        colore: '#8DAAFF',
      },
      {
        numero: '115',
        titolo: 'Vigili del Fuoco',
        testo: 'Incendi e soccorso tecnico urgente',
        icona: 'flame-outline',
        colore: '#FF9A70',
      },
      {
        numero: '118',
        titolo: 'Emergenza sanitaria',
        testo: 'Soccorso sanitario',
        icona: 'medkit-outline',
        colore: '#62E7B0',
      },
    ];

    return (
      <Screen>
        <Back onPress={() => setScreen('strumenti')} />

        <View
          style={{
            marginTop: 8,
            marginBottom: 22,
            padding: 20,
            borderRadius: 27,
            backgroundColor: 'rgba(16,32,71,0.95)',
            borderWidth: 1,
            borderColor: 'rgba(94,224,255,0.42)',
            shadowColor: '#54E1FF',
            shadowOpacity: 0.16,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(55,185,220,0.14)',
              borderWidth: 1,
              borderColor: 'rgba(102,230,255,0.38)',
            }}
          >
            <Ionicons
              name="call-outline"
              size={25}
              color="#6DE8FF"
            />
          </View>

          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 27,
              fontWeight: '900',
              marginTop: 14,
            }}
          >
            Numeri utili
          </Text>

          <Text
            style={{
              color: '#9CB7D1',
              fontSize: 12.5,
              fontWeight: '600',
              lineHeight: 18,
              marginTop: 6,
            }}
          >
            Numeri di emergenza e contatti di servizio sempre a portata di mano.
          </Text>
        </View>

        <Text
          style={{
            color: '#74E4FF',
            fontSize: 10,
            fontWeight: '900',
            letterSpacing: 1.15,
            marginBottom: 10,
          }}
        >
          EMERGENZE
        </Text>

        {numeriEmergenza.map((item) => (
          <TouchableOpacity
            key={item.numero}
            activeOpacity={0.82}
            onPress={() => chiamaNumeroUtile(item.numero)}
            style={{
              minHeight: 78,
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 11,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 21,
              backgroundColor:
                item.numero === '112'
                  ? 'rgba(15,59,88,0.96)'
                  : 'rgba(11,29,61,0.94)',
              borderWidth: item.numero === '112' ? 1.4 : 1,
              borderColor: `${item.colore}70`,
              shadowColor: item.colore,
              shadowOpacity: item.numero === '112' ? 0.22 : 0.08,
              shadowRadius: item.numero === '112' ? 13 : 8,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            <View
              style={{
                width: 45,
                height: 45,
                borderRadius: 15,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(34,58,97,0.84)',
                borderWidth: 1,
                borderColor: `${item.colore}70`,
              }}
            >
              <Ionicons
                name={item.icona}
                size={22}
                color={item.colore}
              />
            </View>

            <View
              style={{
                flex: 1,
                marginLeft: 12,
              }}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: '900',
                }}
              >
                {item.titolo}
              </Text>

              <Text
                style={{
                  color: '#849FB9',
                  fontSize: 9.5,
                  fontWeight: '600',
                  marginTop: 3,
                }}
              >
                {item.testo}
              </Text>
            </View>

            <View
              style={{
                alignItems: 'flex-end',
              }}
            >
              <Text
                style={{
                  color: item.colore,
                  fontSize: 20,
                  fontWeight: '900',
                }}
              >
                {item.numero}
              </Text>

              <Text
                style={{
                  color: '#718AA5',
                  fontSize: 8,
                  fontWeight: '900',
                  letterSpacing: 0.7,
                  marginTop: 2,
                }}
              >
                CHIAMA
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        
        <Text
          style={{
            color: '#91A7FF',
            fontSize: 10,
            fontWeight: '900',
            letterSpacing: 1.15,
            marginTop: 12,
            marginBottom: 10,
          }}
        >
          CONTATTI DI LAVORO
        </Text>

        {[
          {
            key: 'salaOperativa',
            titolo: 'Sala Operativa',
            icona: 'headset-outline',
          },
          {
            key: 'responsabile',
            titolo: 'Responsabile',
            icona: 'person-outline',
          },
          {
            key: 'referenteSito',
            titolo: 'Referente sito',
            icona: 'business-outline',
          },
          {
            key: 'altro',
            titolo: 'Altro contatto',
            icona: 'add-circle-outline',
          },
        ].map((contatto) => (
          <View
            key={contatto.key}
            style={{
              marginBottom: 11,
              padding: 14,
              borderRadius: 21,

              backgroundColor: 'rgba(13,29,63,0.93)',

              borderWidth: 1,
              borderColor: 'rgba(91,116,207,0.35)',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <Ionicons
                name={contatto.icona}
                size={18}
                color="#8BA9FF"
              />

              <Text
                style={{
                  color: '#DDE7FF',
                  fontSize: 11,
                  fontWeight: '900',
                  marginLeft: 8,
                  letterSpacing: 0.35,
                }}
              >
                {contatto.titolo}
              </Text>
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <TextInput
                value={numeriUtiliPersonali[contatto.key]}
                onChangeText={(testo) =>
                  setNumeriUtiliPersonali((prev) => ({
                    ...prev,
                    [contatto.key]: testo,
                  }))
                }
                keyboardType="phone-pad"
                placeholder="Inserisci numero"
                placeholderTextColor="#607B98"
                style={{
                  flex: 1,
                  minHeight: 48,

                  color: '#FFFFFF',

                  paddingHorizontal: 13,
                  paddingVertical: 11,

                  borderRadius: 16,

                  backgroundColor: 'rgba(5,18,42,0.92)',

                  borderWidth: 1,
                  borderColor: 'rgba(77,133,196,0.42)',

                  fontSize: 14,
                  fontWeight: '700',
                }}
              />

              <TouchableOpacity
                activeOpacity={0.80}
                onPress={() =>
                  chiamaNumeroUtile(
                    numeriUtiliPersonali[contatto.key]
                  )
                }
                style={{
                  width: 48,
                  height: 48,
                  marginLeft: 9,

                  borderRadius: 16,

                  alignItems: 'center',
                  justifyContent: 'center',

                  backgroundColor:
                    numeriUtiliPersonali[contatto.key]
                      ? 'rgba(22,132,157,0.94)'
                      : 'rgba(45,67,89,0.50)',

                  borderWidth: 1,

                  borderColor:
                    numeriUtiliPersonali[contatto.key]
                      ? '#66E5FF'
                      : 'rgba(92,120,145,0.30)',
                }}
              >
                <Ionicons
                  name="call"
                  size={19}
                  color={
                    numeriUtiliPersonali[contatto.key]
                      ? '#FFFFFF'
                      : '#647E94'
                  }
                />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View
          style={{
            marginTop: 5,
            marginBottom: 14,
            padding: 12,
            borderRadius: 17,

            flexDirection: 'row',
            alignItems: 'center',

            backgroundColor: 'rgba(20,38,67,0.65)',

            borderWidth: 1,
            borderColor: 'rgba(83,125,166,0.24)',
          }}
        >
          <Ionicons
            name="phone-portrait-outline"
            size={17}
            color="#72DFFF"
          />

          <Text
            style={{
              flex: 1,
              color: '#809AB4',
              fontSize: 9.5,
              lineHeight: 14,
              fontWeight: '600',
              marginLeft: 9,
            }}
          >
            I contatti personali vengono salvati automaticamente
            su questo dispositivo.
          </Text>
        </View>

      </Screen>
    );
  }



  /* =====================================================
     METEO SERVIZIO - V1
     ===================================================== */
  if (screen === 'meteoServizio') {

    const zonaMeteo =
      localitaMeteo.trim() ||
      profilo?.sede ||
      sedeDraft ||
      '';

    const codiceMeteo = meteoServizio?.current?.weather_code;

    const descrizioneMeteo = (codice) => {
      if (codice === 0) return 'Sereno';
      if ([1, 2].includes(codice)) return 'Poco nuvoloso';
      if (codice === 3) return 'Nuvoloso';
      if ([45, 48].includes(codice)) return 'Nebbia';
      if ([51, 53, 55, 56, 57].includes(codice)) return 'Pioviggine';
      if ([61, 63, 65, 66, 67].includes(codice)) return 'Pioggia';
      if ([71, 73, 75, 77].includes(codice)) return 'Neve';
      if ([80, 81, 82].includes(codice)) return 'Rovesci';
      if ([85, 86].includes(codice)) return 'Rovesci di neve';
      if ([95, 96, 99].includes(codice)) return 'Temporale';
      return 'Condizioni variabili';
    };

    const iconaMeteo = (codice) => {
      if (codice === 0) return 'sunny-outline';
      if ([1, 2].includes(codice)) return 'partly-sunny-outline';
      if ([3, 45, 48].includes(codice)) return 'cloud-outline';
      if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(codice))
        return 'rainy-outline';
      if ([71,73,75,77,85,86].includes(codice))
        return 'snow-outline';
      if ([95,96,99].includes(codice))
        return 'thunderstorm-outline';
      return 'partly-sunny-outline';
    };


    /* ===== PREVISIONE PROSSIMO SERVIZIO ===== */

    const adessoServizio = new Date();

    const prossimiServiziMeteo = (turniMese || [])
      .filter((r) =>
        r?.tipo === 'turno' &&
        r?.inizio &&
        r?.giorno
      )
      .map((r) => {
        const [hi, mi] = String(r.inizio)
          .split(':')
          .map(Number);

        const [hf, mf] = String(r.fine || r.inizio)
          .split(':')
          .map(Number);

        let inizioTurno = new Date(
          adessoServizio.getFullYear(),
          adessoServizio.getMonth(),
          Number(r.giorno),
          Number.isFinite(hi) ? hi : 0,
          Number.isFinite(mi) ? mi : 0,
          0,
          0
        );

        /*
          Se il record possiede una data completa, la preferiamo.
          Così la funzione resta compatibile anche con eventuali
          turni salvati con data ISO.
        */
        if (r.data) {
          const dataRecord = new Date(r.data);

          if (!Number.isNaN(dataRecord.getTime())) {
            inizioTurno = new Date(
              dataRecord.getFullYear(),
              dataRecord.getMonth(),
              dataRecord.getDate(),
              Number.isFinite(hi) ? hi : 0,
              Number.isFinite(mi) ? mi : 0,
              0,
              0
            );
          }
        }

        const fineTurno = new Date(inizioTurno);

        fineTurno.setHours(
          Number.isFinite(hf) ? hf : 0,
          Number.isFinite(mf) ? mf : 0,
          0,
          0
        );

        /*
          Turno notturno:
          23:30 → 05:30 = giorno successivo.
        */
        if (fineTurno <= inizioTurno) {
          fineTurno.setDate(fineTurno.getDate() + 1);
        }

        return {
          turno: r,
          inizio: inizioTurno,
          fine: fineTurno,
        };
      })
      .filter((x) => x.fine >= adessoServizio)
      .sort((a, b) => a.inizio - b.inizio);

    const prossimoServizioMeteo =
      prossimiServiziMeteo.length > 0
        ? prossimiServiziMeteo[0]
        : null;

    /*
      Il turno possiede già il campo "luogo".
      Se è valorizzato lo usiamo direttamente per il Meteo.
    */
    const luogoRealeProssimoTurno =
      prossimoServizioMeteo?.turno?.luogo &&
      String(prossimoServizioMeteo.turno.luogo).trim() &&
      String(prossimoServizioMeteo.turno.luogo).trim().toLowerCase() !==
        'servizio'
        ? String(prossimoServizioMeteo.turno.luogo).trim()
        : '';

    const zonaMeteoEffettiva =
      luogoRealeProssimoTurno ||
      localitaMeteo.trim() ||
      zonaMeteo;


    const chiaveProssimoServizioMeteo =
      prossimoServizioMeteo
        ? [
            prossimoServizioMeteo.inizio
              .getFullYear(),
            String(
              prossimoServizioMeteo.inizio.getMonth() + 1
            ).padStart(2, '0'),
            String(
              prossimoServizioMeteo.inizio.getDate()
            ).padStart(2, '0'),
            prossimoServizioMeteo.turno.inizio || '',
            prossimoServizioMeteo.turno.fine || '',
          ].join('_')
        : '';

    const luogoAssociatoProssimoTurno =
      chiaveProssimoServizioMeteo
        ? luoghiTurniMeteo[
            chiaveProssimoServizioMeteo
          ] || ''
        : '';




    const formattaDataServizio = (data) => {
      if (!data) return '';

      try {
        return data.toLocaleDateString('it-IT', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        });
      } catch {
        return '';
      }
    };

    const orePrevisioneServizio = (() => {
      if (
        !prossimoServizioMeteo ||
        !meteoServizio?.hourly?.time
      ) {
        return [];
      }

      const tempi = meteoServizio.hourly.time || [];

      return tempi
        .map((tempo, index) => ({
          tempo: new Date(tempo),

          temperatura:
            meteoServizio.hourly.temperature_2m?.[index],

          percepita:
            meteoServizio.hourly.apparent_temperature?.[index],

          pioggia:
            meteoServizio.hourly
              .precipitation_probability?.[index],

          precipitazioni:
            meteoServizio.hourly.precipitation?.[index],

          vento:
            meteoServizio.hourly.wind_speed_10m?.[index],

          codice:
            meteoServizio.hourly.weather_code?.[index],
        }))
        .filter((x) =>
          !Number.isNaN(x.tempo.getTime()) &&
          x.tempo >= prossimoServizioMeteo.inizio &&
          x.tempo <= prossimoServizioMeteo.fine
        );
    })();

    const previsioneTurno = (() => {
      if (!orePrevisioneServizio.length) {
        return null;
      }

      const primo = orePrevisioneServizio[0];
      const ultimo =
        orePrevisioneServizio[
          orePrevisioneServizio.length - 1
        ];

      const pioggiaMax = Math.max(
        ...orePrevisioneServizio.map(
          (x) => Number(x.pioggia) || 0
        )
      );

      const ventoMax = Math.max(
        ...orePrevisioneServizio.map(
          (x) => Number(x.vento) || 0
        )
      );

      const precipitazioniMax = Math.max(
        ...orePrevisioneServizio.map(
          (x) => Number(x.precipitazioni) || 0
        )
      );

      const oraPioggia = orePrevisioneServizio.find(
        (x) => Number(x.pioggia) >= 50
      );

      let avviso = 'Condizioni regolari previste durante il servizio.';

      if (pioggiaMax >= 70) {
        avviso = oraPioggia
          ? `Pioggia probabile dalle ${String(
              oraPioggia.tempo.getHours()
            ).padStart(2, '0')}:00`
          : 'Pioggia probabile durante il servizio.';
      } else if (pioggiaMax >= 40) {
        avviso =
          'Possibili precipitazioni durante il servizio.';
      }

      if (ventoMax >= 40) {
        avviso =
          'Attenzione: vento sostenuto previsto durante il servizio.';
      }

      return {
        temperaturaInizio:
          Number.isFinite(Number(primo.temperatura))
            ? Math.round(Number(primo.temperatura))
            : null,

        temperaturaFine:
          Number.isFinite(Number(ultimo.temperatura))
            ? Math.round(Number(ultimo.temperatura))
            : null,

        percepita:
          Number.isFinite(Number(primo.percepita))
            ? Math.round(Number(primo.percepita))
            : null,

        pioggiaMax: Math.round(pioggiaMax),

        ventoMax: Math.round(ventoMax),

        precipitazioniMax,

        codice: primo.codice,

        avviso,
      };
    })();

    return (
      <Screen>
        <Back onPress={() => setScreen('strumenti')} />

        <View
          style={{
            marginTop: 8,
            paddingHorizontal: 22,
            paddingVertical: 22,
            shadowColor: '#63E6FF',
          shadowOpacity: 0.28,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 10 },

          borderRadius: 30,
            marginBottom: 18,

            backgroundColor: 'rgba(12,28,66,0.98)',

            borderWidth: 1,
            borderColor: 'rgba(105,231,255,0.58)',

            shadowColor: '#4CDFFF',
            shadowOpacity: 0.30,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 10 },
          
          elevation: 10,
        }}
        >
          <Text
            style={{
              color: '#6EE6FF',
              fontSize: 11,
              fontWeight: '900',
              letterSpacing: 1.3,
            }}
          >
            METEO DEL SERVIZIO
          </Text>

          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 31,
              lineHeight: 34,
              letterSpacing: -0.6,
              textShadowColor: 'rgba(113,230,255,0.38)',
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 12,
              fontWeight: '900',
              marginTop: 6,
            }}
          >
            Condizioni operative
          </Text>

          
        {/* ===== METEO LIVE HERO ===== */}
        {meteoServizio?.current ? (
          <View
            style={{
              marginTop: 18,
              marginBottom: 7,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16,

                backgroundColor: 'rgba(74,203,255,0.13)',
                borderWidth: 1,
                borderColor: 'rgba(111,235,255,0.55)',

                shadowColor: '#64E9FF',
                shadowOpacity: 0.42,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 5 },
              }}
            >
              <Ionicons
                name={iconaMeteo(codiceMeteo)}
                size={39}
                color="#C9FAFF"
              />
            </View>

            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                }}
              >
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 58,
                    lineHeight: 61,
                    fontWeight: '900',
                    letterSpacing: -2,

                    textShadowColor: 'rgba(89,227,255,0.50)',
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 16,
                  }}
                >
                  {Math.round(meteoServizio.current.temperature_2m)}
                </Text>

                <Text
                  style={{
                    color: '#A9F2FF',
                    fontSize: 22,
                    fontWeight: '900',
                    marginTop: 7,
                    marginLeft: 2,
                  }}
                >
                  °
                </Text>
              </View>

              <Text
                style={{
                  color: '#E6FAFF',
                  fontSize: 15,
                  fontWeight: '900',
                  marginTop: -3,
                }}
              >
                {descrizioneMeteo(codiceMeteo)}
              </Text>
            </View>
          </View>
        ) : null}

<View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 10,
            }}
          >
            <Ionicons
              name="location-outline"
              size={16}
              color="#78DFFF"
            />

            <Text
              style={{
                color: '#A7C0D9',
                fontSize: 13,
                fontWeight: '700',
                marginLeft: 5,
                flex: 1,
              }}
            >
              {zonaMeteo || 'Zona operativa non impostata'}
            </Text>
          </View>
        </View>


        {/* ===== PROSSIMO SERVIZIO ===== */}
        <View
          style={{
            marginBottom: 8,
            padding: 14,
            borderRadius: 22,

            backgroundColor: 'rgba(9,27,59,0.96)',

            borderWidth: 1,
            borderColor: 'rgba(90,205,255,0.25)',

            shadowColor: '#54DFFF',
            shadowOpacity: 0.14,
            shadowRadius: 11,
            shadowOffset: { width: 0, height: 5 },
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <View
              style={{
                width: 39,
                height: 39,
                borderRadius: 13,

                alignItems: 'center',
                justifyContent: 'center',

                backgroundColor: 'rgba(51,171,218,0.14)',

                borderWidth: 1,
                borderColor: 'rgba(94,222,255,0.32)',
              }}
            >
              <Ionicons
                name="calendar-outline"
                size={20}
                color="#6FE4FF"
              />
            </View>

            <View
              style={{
                flex: 1,
                marginLeft: 11,
              }}
            >
              <Text
                style={{
                  color: '#70DFFF',
                  fontSize: 9,
                  fontWeight: '900',
                  letterSpacing: 1.1,
                }}
              >
                PROSSIMO SERVIZIO
              </Text>

              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: '900',
                  marginTop: 3,
                  textTransform: 'capitalize',
                }}
              >
                {prossimoServizioMeteo
                  ? formattaDataServizio(
                      prossimoServizioMeteo.inizio
                    )
                  : 'Nessun turno futuro'}
              </Text>
            </View>
          </View>

          {prossimoServizioMeteo ? (
            <>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',

                  paddingVertical: 10,
                  paddingHorizontal: 12,

                  borderRadius: 16,

                  backgroundColor: 'rgba(4,18,40,0.72)',
                }}
              >
                <Ionicons
                  name="time-outline"
                  size={18}
                  color="#9DBBFF"
                />

                <Text
                  style={{
                    color: '#DDE8FF',
                    fontSize: 15,
                    fontWeight: '900',
                    marginLeft: 7,
                  }}
                >
                  {prossimoServizioMeteo.turno.inizio}
                  {'  →  '}
                  {prossimoServizioMeteo.turno.fine}
                </Text>

                <View style={{ flex: 1 }} />

                {prossimoServizioMeteo.fine.getDate() !==
                prossimoServizioMeteo.inizio.getDate() ? (
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 9,

                      backgroundColor:
                        'rgba(123,91,221,0.18)',

                      borderWidth: 1,
                      borderColor:
                        'rgba(169,139,255,0.32)',
                    }}
                  >
                    <Text
                      style={{
                        color: '#C4AEFF',
                        fontSize: 8,
                        fontWeight: '900',
                      }}
                    >
                      NOTTURNO
                    </Text>
                  </View>
                ) : null}
              </View>


              <View
                style={{
                  marginTop: 10,
                  padding: 12,
                  borderRadius: 16,

                  flexDirection: 'row',
                  alignItems: 'center',

                  backgroundColor:
                    luogoAssociatoProssimoTurno
                      ? 'rgba(19,72,83,0.56)'
                      : 'rgba(35,43,67,0.62)',

                  borderWidth: 1,

                  borderColor:
                    luogoAssociatoProssimoTurno
                      ? 'rgba(89,224,209,0.28)'
                      : 'rgba(93,116,148,0.20)',
                }}
              >
                <Ionicons
                  name="location-outline"
                  size={17}
                  color={
                    luogoAssociatoProssimoTurno
                      ? '#63E4CF'
                      : '#8299B4'
                  }
                />

                <View
                  style={{
                    flex: 1,
                    marginLeft: 8,
                  }}
                >
                  <Text
                    style={{
                      color: '#6F8DA8',
                      fontSize: 8,
                      fontWeight: '900',
                      letterSpacing: 0.8,
                    }}
                  >
                    LUOGO DEL SERVIZIO
                  </Text>

                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 11,
                      fontWeight: '900',
                      marginTop: 3,
                    }}
                  >
                    {luogoRealeProssimoTurno ||
                      luogoAssociatoProssimoTurno ||
                      'Non indicato nel turno'}
                  </Text>
                </View>
              </View>

              {previsioneTurno ? (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      marginTop: 12,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        padding: 13,
                        marginRight: 5,

                        borderRadius: 17,

                        backgroundColor:
                          'rgba(25,53,90,0.68)',
                      }}
                    >
                      <Text
                        style={{
                          color: '#7895B2',
                          fontSize: 8,
                          fontWeight: '900',
                        }}
                      >
                        TEMPERATURA
                      </Text>

                      <Text
                        style={{
                          color: '#FFFFFF',
                          fontSize: 20,
                          fontWeight: '900',
                          marginTop: 3,
                        }}
                      >
                        {previsioneTurno.temperaturaInizio ?? '—'}°
                        {' → '}
                        {previsioneTurno.temperaturaFine ?? '—'}°
                      </Text>
                    </View>

                    <View
                      style={{
                        flex: 1,
                        padding: 13,
                        marginLeft: 5,

                        borderRadius: 17,

                        backgroundColor:
                          'rgba(25,53,90,0.68)',
                      }}
                    >
                      <Text
                        style={{
                          color: '#7895B2',
                          fontSize: 8,
                          fontWeight: '900',
                        }}
                      >
                        PIOGGIA MAX
                      </Text>

                      <Text
                        style={{
                          color: '#6FE4FF',
                          fontSize: 20,
                          fontWeight: '900',
                          marginTop: 3,
                        }}
                      >
                        {previsioneTurno.pioggiaMax}%
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',

                      marginTop: 10,
                      padding: 13,

                      borderRadius: 17,

                      backgroundColor:
                        previsioneTurno.pioggiaMax >= 50 ||
                        previsioneTurno.ventoMax >= 40
                          ? 'rgba(70,48,27,0.65)'
                          : 'rgba(20,65,65,0.52)',

                      borderWidth: 1,

                      borderColor:
                        previsioneTurno.pioggiaMax >= 50 ||
                        previsioneTurno.ventoMax >= 40
                          ? 'rgba(255,184,91,0.30)'
                          : 'rgba(82,224,191,0.25)',
                    }}
                  >
                    <Ionicons
                      name={
                        previsioneTurno.pioggiaMax >= 50 ||
                        previsioneTurno.ventoMax >= 40
                          ? 'warning-outline'
                          : 'checkmark-circle-outline'
                      }
                      size={18}
                      color={
                        previsioneTurno.pioggiaMax >= 50 ||
                        previsioneTurno.ventoMax >= 40
                          ? '#FFBD6A'
                          : '#62E1B9'
                      }
                    />

                    <Text
                      style={{
                        flex: 1,
                        marginLeft: 8,

                        color: '#DDE7EE',
                        fontSize: 12,
                        fontWeight: '800',
                        lineHeight: 15,
                      }}
                    >
                      {previsioneTurno.avviso}
                    </Text>
                  </View>

                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',

                      marginTop: 11,
                    }}
                  >
                    <Ionicons
                      name="navigate-outline"
                      size={16}
                      color="#70CFC0"
                    />

                    <Text
                      style={{
                        color: '#7996AE',
                        fontSize: 10.5,
                        fontWeight: '700',
                        marginLeft: 5,
                      }}
                    >
                      Vento max {previsioneTurno.ventoMax} km/h
                    </Text>

                    <Text
                      style={{
                        color: '#48637A',
                        marginHorizontal: 7,
                      }}
                    >
                      •
                    </Text>

                    <Ionicons
                      name="thermometer-outline"
                      size={16}
                      color="#9EAFFF"
                    />

                    <Text
                      style={{
                        color: '#7996AE',
                        fontSize: 10.5,
                        fontWeight: '700',
                        marginLeft: 4,
                      }}
                    >
                      Percepita {previsioneTurno.percepita ?? '—'}°
                    </Text>
                  </View>
                </>
              ) : meteoServizio ? (
                <View
                  style={{
                    marginTop: 11,
                    padding: 12,
                    borderRadius: 16,

                    backgroundColor:
                      'rgba(44,47,71,0.65)',
                  }}
                >
                  <Text
                    style={{
                      color: '#96A8BC',
                      fontSize: 9.5,
                      fontWeight: '700',
                      lineHeight: 14,
                    }}
                  >
                    La previsione oraria di questo turno non è
                    ancora disponibile. Le previsioni dettagliate
                    vengono mostrate quando il servizio rientra
                    nell'intervallo disponibile.
                  </Text>
                </View>
              ) : (
                <Text
                  style={{
                    color: '#738DA8',
                    fontSize: 9.5,
                    fontWeight: '700',
                    lineHeight: 14,
                    marginTop: 11,
                  }}
                >
                  Carica il meteo per vedere la previsione
                  specifica durante le ore del turno.
                </Text>
              )}
            </>
          ) : (
            <Text
              style={{
                color: '#748DA6',
                fontSize: 12,
                lineHeight: 15,
                fontWeight: '700',
              }}
            >
              Non risultano turni futuri nel periodo attualmente
              caricato nell'app.
            </Text>
          )}
        </View>

        {!zonaMeteo ? (
          <View
            style={{
              padding: 18,
              borderRadius: 22,
              backgroundColor: 'rgba(66,45,20,0.75)',
              borderWidth: 1,
              borderColor: 'rgba(255,184,78,0.35)',
            }}
          >
            <Ionicons
              name="warning-outline"
              size={24}
              color="#FFBD65"
            />

            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 15,
                fontWeight: '900',
                marginTop: 9,
              }}
            >
              Zona mancante
            </Text>

            <Text
              style={{
                color: '#CDBA9A',
                fontSize: 11,
                lineHeight: 17,
                marginTop: 5,
              }}
            >
              Inserisci la tua zona operativa nel profilo per ricevere
              le previsioni meteo del servizio.
            </Text>
          </View>
        ) : (
          <>

            <View
              style={{
            display: 'none',

                marginBottom: 14,
                padding: meteoServizio ? 11 : 15,
                borderRadius: 22,
                backgroundColor: 'rgba(8,24,52,0.82)',
                borderWidth: 1,
                borderColor: 'rgba(82,170,220,0.22)',
              }}
            >
              <Text
                style={{
                  color: meteoServizio ? '#6D8CA7' : '#7EDFFF',
                  fontSize: 9,
                  fontWeight: '900',
                  letterSpacing: 1,
                  marginBottom: 7,
                }}
              >
                LOCALITÀ METEO
              </Text>


              {!meteoServizio && recentiMeteo.length > 0 ? (
                <View
                  style={{
                    marginBottom: 0,
                  }}
                >
                  <Text
                    style={{
                      color: '#6D8CA7',
                      fontSize: 8,
                      fontWeight: '900',
                      letterSpacing: 0.8,
                      marginBottom: 7,
                    }}
                  >
                    ULTIME LOCALITÀ
                  </Text>

                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                    }}
                  >
                    {recentiMeteo.map((localita) => (
                      <TouchableOpacity
                        key={localita}
                        activeOpacity={0.78}
                        onPress={() =>
                          setLocalitaMeteo(localita)
                        }
                        style={{
                          marginRight: 7,
                          marginBottom: 7,
                          paddingHorizontal: 11,
                          paddingVertical: 7,

                          borderRadius: 13,

                          flexDirection: 'row',
                          alignItems: 'center',

                          backgroundColor:
                            localitaMeteo
                              .trim()
                              .toLowerCase() ===
                            String(localita)
                              .trim()
                              .toLowerCase()
                              ? 'rgba(31,132,164,0.34)'
                              : 'rgba(17,41,73,0.82)',

                          borderWidth: 1,

                          borderColor:
                            localitaMeteo
                              .trim()
                              .toLowerCase() ===
                            String(localita)
                              .trim()
                              .toLowerCase()
                              ? 'rgba(100,226,255,0.64)'
                              : 'rgba(76,136,183,0.30)',
                        }}
                      >
                        <Ionicons
                          name="location-outline"
                          size={12}
                          color={
                            localitaMeteo
                              .trim()
                              .toLowerCase() ===
                            String(localita)
                              .trim()
                              .toLowerCase()
                              ? '#72E5FF'
                              : '#7697B3'
                          }
                        />

                        <Text
                          style={{
                            color:
                              localitaMeteo
                                .trim()
                                .toLowerCase() ===
                              String(localita)
                                .trim()
                                .toLowerCase()
                                ? '#E8FAFF'
                                : '#9CB2C6',

                            fontSize: 9.5,
                            fontWeight: '800',
                            marginLeft: 4,
                          }}
                        >
                          {localita}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}

              <TextInput
                value={localitaMeteo}
                onChangeText={setLocalitaMeteo}
                placeholder="Es. Fiumicino, Roma, Ciampino..."
                placeholderTextColor="#607B98"
                autoCapitalize="words"
                style={{
                  minHeight: meteoServizio ? 42 : 48,
                  color: '#FFFFFF',
                  paddingHorizontal: 14,
                  paddingVertical: meteoServizio ? 8 : 11,
                  borderRadius: 16,
                  backgroundColor: 'rgba(4,15,34,0.88)',
                  borderWidth: 1,
                  borderColor: 'rgba(91,169,214,0.26)',
                  fontSize: 14,
                  fontWeight: '800',
                }}
              />

              {!meteoServizio ? (
                <Text
                  style={{
                    color: '#6E879F',
                    fontSize: 8.5,
                    lineHeight: 13,
                    marginTop: 7,
                    fontWeight: '600',
                  }}
                >
                  Se la sede è un nome interno, inserisci qui la città
                  reale da usare per le previsioni.
                </Text>
              ) : null}
            </View>


            {prossimoServizioMeteo ? (
              <TouchableOpacity
                activeOpacity={0.80}
                onPress={() =>
                  salvaLuogoTurnoMeteo(
                    chiaveProssimoServizioMeteo,
                    localitaMeteo
                  )
                }
                style={{
            display: 'none',
                  minHeight: 44,
                  marginBottom: 0,

                  borderRadius: 16,

                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',

                  backgroundColor:
                    meteoServizio
                      ? 'rgba(16,43,55,0.38)'
                      : 'rgba(20,55,70,0.55)',

                  borderWidth: 1,
                  borderColor:
                    'rgba(83,201,191,0.24)',
                }}
              >
                <Ionicons
                  name="link-outline"
                  size={17}
                  color="#62E1CF"
                />

                <Text
                  style={{
                    color: '#DFFFFA',
                    fontSize: 12,
                    fontWeight: '900',
                    letterSpacing: 0.45,
                    marginLeft: 7,
                  }}
                >
                  ASSOCIA AL PROSSIMO TURNO
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => caricaMeteoServizio(zonaMeteoEffettiva)}
              disabled={meteoLoading}
              style={{
                minHeight: 48,
                borderRadius: 17,

                alignItems: 'center',
                justifyContent: 'center',

                backgroundColor: 'rgba(28,116,158,0.88)',

                borderWidth: 1,
                borderColor: 'rgba(105,225,255,0.55)',

                shadowColor: '#52DFFF',
                shadowOpacity: 0.16,
                shadowRadius: 9,
                shadowOffset: { width: 0, height: 5 },

                marginBottom: 11,
              }}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: '900',
                  letterSpacing: 0.5,
                }}
              >
                {meteoLoading
                  ? 'AGGIORNAMENTO...'
                  : meteoServizio
                    ? '↻ AGGIORNA METEO'
                    : '🌦 CARICA METEO'}
              </Text>
            </TouchableOpacity>

            {meteoErrore ? (
              <View
                style={{
                  padding: 14,
                  borderRadius: 18,
                  marginBottom: 14,
                  backgroundColor: 'rgba(77,34,39,0.70)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,102,113,0.35)',
                }}
              >
                <Text
                  style={{
                    color: '#FF9DA6',
                    fontSize: 11,
                    fontWeight: '800',
                  }}
                >
                  {meteoErrore}
                </Text>
              </View>
            ) : null}

            {meteoServizio?.current ? (
              <>
                <View
                  style={{
              display: 'none',
                    padding: 20,
                    borderRadius: 26,
                    marginBottom: 12,

                    backgroundColor: 'rgba(9,24,52,0.96)',
          shadowColor: '#52DFFF',
          shadowOpacity: 0.22,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },

                    borderWidth: 1,
                    borderColor: 'rgba(104,232,255,0.34)',
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 21,

                        alignItems: 'center',
                        justifyContent: 'center',

                        backgroundColor: 'rgba(50,171,219,0.15)',

                        borderWidth: 1,
                        borderColor: 'rgba(94,222,255,0.40)',
                      }}
                    >
                      <Ionicons
                        name={iconaMeteo(codiceMeteo)}
                        size={34}
                        color="#72E5FF"
                      />
                    </View>

                    <View
                      style={{
                        flex: 1,
                        marginLeft: 15,
                      }}
                    >
                      <Text
                        style={{
                          color: '#FFFFFF',
                          fontSize: 54,
              lineHeight: 56,
              letterSpacing: -1,
              textShadowColor: 'rgba(82,223,255,0.45)',
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 14,
                          fontWeight: '900',
                        }}
                      >
                        {Math.round(
                          meteoServizio.current.temperature_2m
                        )}°
                      </Text>

                      <Text
                        style={{
                          color: '#A8C3DA',
                          fontSize: 15,
                          fontWeight: '800',
                        }}
                      >
                        {descrizioneMeteo(codiceMeteo)}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={{
                      color: '#718EA9',
                      fontSize: 12,
                      fontWeight: '700',
                      marginTop: 8,
                    }}
                  >
                    {[
                      meteoServizio.luogo?.name,
                      meteoServizio.luogo?.admin1,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>

                <View
                  style={{
            display: 'none',
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
          marginTop: 12,
                  }}
                >
                  <View
                    style={{
                      width: '31.8%',
                      paddingVertical: 13,
              paddingHorizontal: 12,
                      borderRadius: 18,
                      marginBottom: 0,

                      backgroundColor: 'rgba(12,31,63,0.94)',
                      borderWidth: 1,
                      borderColor: 'rgba(111,142,214,0.30)',
                    }}
                  >
                    <Ionicons
                      name="thermometer-outline"
                      size={20}
                      color="#9CADFF"
                    />

                    <Text
                      style={{
                        color: '#8299B4',
                        fontSize: 9,
                        fontWeight: '900',
                        marginTop: 8,
                      }}
                    >
                      PERCEPITA
                    </Text>

                    <Text
                      style={{
                        color: '#FFFFFF',
                        fontSize: 19,
                        fontWeight: '900',
                        marginTop: 2,
                      }}
                    >
                      {Math.round(
                        meteoServizio.current.apparent_temperature
                      )}°
                    </Text>
                  </View>

                  <View
                    style={{
                      width: '31.8%',
                      paddingVertical: 13,
              paddingHorizontal: 12,
                      borderRadius: 18,
                      marginBottom: 0,

                      backgroundColor: 'rgba(12,31,63,0.94)',
                      borderWidth: 1,
                      borderColor: 'rgba(91,209,255,0.30)',
                    }}
                  >
                    <Ionicons
                      name="rainy-outline"
                      size={20}
                      color="#67DFFF"
                    />

                    <Text
                      style={{
                        color: '#8299B4',
                        fontSize: 9,
                        fontWeight: '900',
                        marginTop: 8,
                      }}
                    >
                      PRECIPITAZIONI
                    </Text>

                    <Text
                      style={{
                        color: '#FFFFFF',
                        fontSize: 19,
                        fontWeight: '900',
                        marginTop: 2,
                      }}
                    >
                      {meteoServizio.current.precipitation ?? 0} mm
                    </Text>
                  </View>

                  <View
                    style={{
                      width: '100%',
                      paddingVertical: 13,
              paddingHorizontal: 12,
                      borderRadius: 18,

                      backgroundColor: 'rgba(12,31,63,0.94)',
                      borderWidth: 1,
                      borderColor: 'rgba(102,211,194,0.30)',

                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons
                      name="navigate-outline"
                      size={21}
                      color="#69E2C0"
                    />

                    <View
                      style={{
                        marginLeft: 11,
                      }}
                    >
                      <Text
                        style={{
                          color: '#8299B4',
                          fontSize: 9,
                          fontWeight: '900',
                        }}
                      >
                        VENTO
                      </Text>

                      <Text
                        style={{
                          color: '#FFFFFF',
                          fontSize: 17,
                          fontWeight: '900',
                          marginTop: 2,
                        }}
                      >
                        {Math.round(
                          meteoServizio.current.wind_speed_10m
                        )} km/h
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            ) : null}
          </>
        )}

        <View
          style={{
            marginTop: 10,
            paddingHorizontal: 12,
            paddingVertical: 9,
            borderRadius: 14,

            flexDirection: 'row',

            backgroundColor: 'rgba(10,26,48,0.34)',
            borderWidth: 1,
            borderColor: 'rgba(91,169,214,0.14)',
          }}
        >
          <Ionicons
            name="information-circle-outline"
            size={17}
            color="#789BB9"
          />

          <Text
            style={{
              flex: 1,
              marginLeft: 8,

              color: '#768FA8',
              fontSize: 9,
              lineHeight: 14,
              fontWeight: '600',
            }}
          >
            Le previsioni meteo sono indicative. Per il servizio
            fai sempre riferimento alle procedure operative previste.
          </Text>
        </View>
      </Screen>
    );
  }



  /* =====================================================
     DOCUMENTI SERVIZIO - V1
     ===================================================== */
  if (screen === 'documentiServizio') {

    const documentiBase = [
      {
        id: 'portoArmi',
        titolo: "Porto d'armi",
        sottotitolo: 'Se previsto dal tuo ruolo',
        icona: 'card-outline',
        colore: '#67E7FF',
        stato: 'DA INSERIRE',
      },
      {
        id: 'decretoGpg',
        titolo: 'Decreto GPG',
        sottotitolo: 'Decreto di nomina / approvazione',
        icona: 'shield-checkmark-outline',
        colore: '#8DAAFF',
        stato: 'DA INSERIRE',
      },
      {
        id: 'tesserino',
        titolo: 'Tesserino',
        sottotitolo: 'Tesserino professionale o aziendale',
        icona: 'id-card-outline',
        colore: '#72E2C0',
        stato: 'DA INSERIRE',
      },
      {
        id: 'attestati',
        titolo: 'Attestati & corsi',
        sottotitolo: 'Formazione e abilitazioni',
        icona: 'ribbon-outline',
        colore: '#B89CFF',
        stato: 'DA INSERIRE',
      },
      {
        id: 'altroDocumento',
        titolo: 'Altro documento',
        sottotitolo: 'Aggiungi un documento personale',
        icona: 'document-attach-outline',
        colore: '#FFB06C',
        stato: 'AGGIUNGI',
      },
    ];


    /* ===== SCADENZIARIO DOCUMENTI ===== */
    const documentiConScadenza = Object.entries(
      documentiPersonali || {}
    )
      .map(([id, doc]) => {
        const data =
          dataDocumentoDaTesto(
            doc?.scadenza
          );

        if (!data) return null;

        const oggi = new Date();
        oggi.setHours(0, 0, 0, 0);

        const giorni = Math.ceil(
          (data.getTime() - oggi.getTime()) /
          86400000
        );

        const base =
          documentiBase.find(
            (x) => x.id === id
          );

        return {
          id,
          nome:
            doc?.nome ||
            base?.titolo ||
            'Documento',
          data,
          giorni,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.data - b.data);

    const prossimaScadenzaDocumento =
      documentiConScadenza.find(
        (x) => x.giorni >= 0
      ) || null;

    const documentiInScadenza =
      documentiConScadenza.filter(
        (x) =>
          x.giorni >= 0 &&
          x.giorni <= 30
      );

    const documentiScaduti =
      documentiConScadenza.filter(
        (x) => x.giorni < 0
      );

    const formattaScadenzaDocumento = (data) => {
      if (!data) return '—';

      return data.toLocaleDateString(
        'it-IT',
        {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }
      );
    };

    return (
      <Screen>
        <Back onPress={() => setScreen('strumenti')} />

        {/* HERO */}
        <View
          style={{
            marginTop: 8,
            marginBottom: 19,
            padding: 20,
            borderRadius: 27,

            backgroundColor: 'rgba(15,31,70,0.95)',

            borderWidth: 1,
            borderColor: 'rgba(104,208,255,0.34)',

            shadowColor: '#55DFFF',
            shadowOpacity: 0.14,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
          }}
        >
          <View
            style={{
              width: 49,
              height: 49,
              borderRadius: 16,

              alignItems: 'center',
              justifyContent: 'center',

              backgroundColor: 'rgba(61,177,223,0.14)',

              borderWidth: 1,
              borderColor: 'rgba(99,225,255,0.36)',
            }}
          >
            <Ionicons
              name="id-card-outline"
              size={26}
              color="#72E6FF"
            />
          </View>

          <Text
            style={{
              color: '#73E3FF',
              fontSize: 9.5,
              fontWeight: '900',
              letterSpacing: 1.25,
              marginTop: 15,
            }}
          >
            ARCHIVIO PERSONALE
          </Text>

          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 28,
              fontWeight: '900',
              marginTop: 4,
              letterSpacing: -0.35,
            }}
          >
            Documenti
          </Text>

          <Text
            style={{
              color: '#9DB5CE',
              fontSize: 12,
              fontWeight: '600',
              lineHeight: 18,
              marginTop: 6,
            }}
          >
            Tieni sotto controllo documenti professionali,
            attestati e relative scadenze.
          </Text>
        </View>

        {/* RIEPILOGO */}
        <View
          style={{
            flexDirection: 'row',
            marginBottom: 18,
          }}
        >
          <View
            style={{
              flex: 1,
              marginRight: 5,
              padding: 14,
              borderRadius: 20,

              backgroundColor: 'rgba(10,28,58,0.92)',

              borderWidth: 1,
              borderColor: 'rgba(92,218,255,0.22)',
            }}
          >
            <Text
              style={{
                color: '#7895B0',
                fontSize: 8,
                fontWeight: '900',
                letterSpacing: 0.8,
              }}
            >
              DOCUMENTI
            </Text>

            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 22,
                fontWeight: '900',
                marginTop: 3,
              }}
            >
              {Object.keys(documentiPersonali).length}
            </Text>

            <Text
              style={{
                color: '#6E879F',
                fontSize: 8.5,
                fontWeight: '700',
                marginTop: 2,
              }}
            >
              caricati
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              marginLeft: 5,
              padding: 14,
              borderRadius: 20,

              backgroundColor: 'rgba(10,28,58,0.92)',

              borderWidth: 1,
              borderColor: 'rgba(112,226,190,0.22)',
            }}
          >
            <Text
              style={{
                color: '#7895B0',
                fontSize: 8,
                fontWeight: '900',
                letterSpacing: 0.8,
              }}
            >
              SCADENZE
            </Text>

            <Text
              style={{
                color:
                  documentiScaduti.length > 0
                    ? '#FF737C'
                    : documentiInScadenza.length > 0
                      ? '#FFB45F'
                      : '#68E2BC',
                fontSize: 22,
                fontWeight: '900',
                marginTop: 3,
              }}
            >
              {documentiScaduti.length > 0
                ? documentiScaduti.length
                : documentiInScadenza.length > 0
                  ? documentiInScadenza.length
                  : '✓'}
            </Text>

            <Text
              style={{
                color: '#6E879F',
                fontSize: 8.5,
                fontWeight: '700',
                marginTop: 2,
              }}
            >
              {documentiScaduti.length > 0
                ? 'documenti scaduti'
                : documentiInScadenza.length > 0
                  ? 'entro 30 giorni'
                  : 'nessuna urgente'}
            </Text>
          </View>
        </View>



        {/* ===== AVVISI SCADENZE DOCUMENTI ===== */}
        {(documentiScaduti.length > 0 ||
          documentiInScadenza.length > 0) ? (
          <View
            style={{
              marginBottom: 16,
              padding: 15,
              borderRadius: 22,

              backgroundColor:
                documentiScaduti.length > 0
                  ? 'rgba(73,30,38,0.72)'
                  : 'rgba(71,49,24,0.70)',

              borderWidth: 1,

              borderColor:
                documentiScaduti.length > 0
                  ? 'rgba(255,105,118,0.32)'
                  : 'rgba(255,181,92,0.30)',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <View
                style={{
                  width: 39,
                  height: 39,
                  borderRadius: 13,

                  alignItems: 'center',
                  justifyContent: 'center',

                  backgroundColor:
                    documentiScaduti.length > 0
                      ? 'rgba(255,102,117,0.12)'
                      : 'rgba(255,176,82,0.12)',
                }}
              >
                <Ionicons
                  name={
                    documentiScaduti.length > 0
                      ? 'alert-circle-outline'
                      : 'time-outline'
                  }
                  size={20}
                  color={
                    documentiScaduti.length > 0
                      ? '#FF7D89'
                      : '#FFB45F'
                  }
                />
              </View>

              <View
                style={{
                  flex: 1,
                  marginLeft: 10,
                }}
              >
                <Text
                  style={{
                    color:
                      documentiScaduti.length > 0
                        ? '#FF9AA3'
                        : '#FFC27A',
                    fontSize: 9,
                    fontWeight: '900',
                    letterSpacing: 0.9,
                  }}
                >
                  {documentiScaduti.length > 0
                    ? 'ATTENZIONE'
                    : 'SCADENZE VICINE'}
                </Text>

                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 13,
                    fontWeight: '900',
                    marginTop: 3,
                  }}
                >
                  {documentiScaduti.length > 0
                    ? `${documentiScaduti.length} ${
                        documentiScaduti.length === 1
                          ? 'documento scaduto'
                          : 'documenti scaduti'
                      }`
                    : `${documentiInScadenza.length} ${
                        documentiInScadenza.length === 1
                          ? 'documento in scadenza'
                          : 'documenti in scadenza'
                      }`}
                </Text>
              </View>
            </View>

            {[
              ...documentiScaduti,
              ...documentiInScadenza,
            ]
              .slice(0, 4)
              .map((item) => (
                <View
                  key={`${item.id}_${item.giorni}`}
                  style={{
                    minHeight: 48,
                    marginTop: 7,
                    paddingHorizontal: 11,
                    paddingVertical: 9,

                    flexDirection: 'row',
                    alignItems: 'center',

                    borderRadius: 15,

                    backgroundColor:
                      'rgba(8,20,38,0.40)',
                  }}
                >
                  <Ionicons
                    name={
                      item.giorni < 0
                        ? 'close-circle-outline'
                        : 'calendar-outline'
                    }
                    size={16}
                    color={
                      item.giorni < 0
                        ? '#FF7D89'
                        : '#FFB45F'
                    }
                  />

                  <View
                    style={{
                      flex: 1,
                      marginLeft: 8,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        color: '#F6F8FB',
                        fontSize: 10.5,
                        fontWeight: '900',
                      }}
                    >
                      {item.nome}
                    </Text>

                    <Text
                      style={{
                        color: '#91A0AE',
                        fontSize: 8.5,
                        fontWeight: '700',
                        marginTop: 2,
                      }}
                    >
                      Scadenza{' '}
                      {formattaScadenzaDocumento(
                        item.data
                      )}
                    </Text>
                  </View>

                  <View
                    style={{
                      alignItems: 'flex-end',
                      marginLeft: 8,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          item.giorni < 0
                            ? '#FF7D89'
                            : '#FFB45F',
                        fontSize: 11,
                        fontWeight: '900',
                      }}
                    >
                      {item.giorni < 0
                        ? `${Math.abs(item.giorni)}g fa`
                        : `${item.giorni}g`}
                    </Text>

                    <Text
                      style={{
                        color: '#6E7F90',
                        fontSize: 7,
                        fontWeight: '900',
                        marginTop: 1,
                      }}
                    >
                      {item.giorni < 0
                        ? 'SCADUTO'
                        : 'RIMASTI'}
                    </Text>
                  </View>
                </View>
              ))}
          </View>
        ) : (
          Object.keys(documentiPersonali).length > 0 ? (
            <View
              style={{
                marginBottom: 16,
                paddingHorizontal: 14,
                paddingVertical: 12,

                flexDirection: 'row',
                alignItems: 'center',

                borderRadius: 18,

                backgroundColor:
                  'rgba(15,59,58,0.48)',

                borderWidth: 1,
                borderColor:
                  'rgba(89,221,187,0.22)',
              }}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={19}
                color="#64E0B9"
              />

              <Text
                style={{
                  flex: 1,
                  marginLeft: 8,

                  color: '#A8DCCB',
                  fontSize: 9.5,
                  lineHeight: 14,
                  fontWeight: '800',
                }}
              >
                Nessuna scadenza urgente nei prossimi 30 giorni.
              </Text>
            </View>
          ) : null
        )}

        {prossimaScadenzaDocumento ? (
          <View
            style={{
              marginBottom: 17,
              padding: 15,
              borderRadius: 21,

              flexDirection: 'row',
              alignItems: 'center',

              backgroundColor:
                prossimaScadenzaDocumento.giorni <= 30
                  ? 'rgba(66,45,24,0.68)'
                  : 'rgba(11,45,61,0.70)',

              borderWidth: 1,

              borderColor:
                prossimaScadenzaDocumento.giorni <= 30
                  ? 'rgba(255,181,92,0.30)'
                  : 'rgba(86,218,205,0.25)',
            }}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,

                alignItems: 'center',
                justifyContent: 'center',

                backgroundColor:
                  prossimaScadenzaDocumento.giorni <= 30
                    ? 'rgba(255,172,70,0.12)'
                    : 'rgba(74,206,191,0.12)',
              }}
            >
              <Ionicons
                name={
                  prossimaScadenzaDocumento.giorni <= 30
                    ? 'warning-outline'
                    : 'calendar-outline'
                }
                size={21}
                color={
                  prossimaScadenzaDocumento.giorni <= 30
                    ? '#FFB45F'
                    : '#65E1C8'
                }
              />
            </View>

            <View
              style={{
                flex: 1,
                marginLeft: 11,
              }}
            >
              <Text
                style={{
                  color: '#7F9AB3',
                  fontSize: 8,
                  fontWeight: '900',
                  letterSpacing: 0.8,
                }}
              >
                PROSSIMA SCADENZA
              </Text>

              <Text
                numberOfLines={1}
                style={{
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: '900',
                  marginTop: 3,
                }}
              >
                {prossimaScadenzaDocumento.nome}
              </Text>

              <Text
                style={{
                  color: '#819AB0',
                  fontSize: 9,
                  fontWeight: '700',
                  marginTop: 3,
                }}
              >
                {formattaScadenzaDocumento(
                  prossimaScadenzaDocumento.data
                )}
              </Text>
            </View>

            <View
              style={{
                alignItems: 'flex-end',
              }}
            >
              <Text
                style={{
                  color:
                    prossimaScadenzaDocumento.giorni <= 30
                      ? '#FFB45F'
                      : '#64DEC3',

                  fontSize: 18,
                  fontWeight: '900',
                }}
              >
                {prossimaScadenzaDocumento.giorni}
              </Text>

              <Text
                style={{
                  color: '#70899F',
                  fontSize: 7.5,
                  fontWeight: '900',
                  letterSpacing: 0.5,
                }}
              >
                GIORNI
              </Text>
            </View>
          </View>
        ) : null}

        <Text
          style={{
            color: '#8BA7C3',
            fontSize: 9,
            fontWeight: '900',
            letterSpacing: 1.1,
            marginBottom: 10,
          }}
        >
          I TUOI DOCUMENTI
        </Text>

        {/* DOCUMENTI */}
        {documentiBase.map((doc) => (
          <TouchableOpacity
            key={doc.id}
            activeOpacity={0.82}
            onPress={() =>
              apriDocumentoPersonale(doc)
            }
            style={{
              minHeight: 82,

              flexDirection: 'row',
              alignItems: 'center',

              marginBottom: 10,
              paddingHorizontal: 14,
              paddingVertical: 13,

              borderRadius: 22,

              backgroundColor: 'rgba(10,28,59,0.94)',

              borderWidth: 1,
              borderColor: `${doc.colore}42`,

              shadowColor: doc.colore,
              shadowOpacity: 0.06,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 15,

                alignItems: 'center',
                justifyContent: 'center',

                backgroundColor: 'rgba(31,54,91,0.76)',

                borderWidth: 1,
                borderColor: `${doc.colore}55`,
              }}
            >
              <Ionicons
                name={doc.icona}
                size={22}
                color={doc.colore}
              />
            </View>

            <View
              style={{
                flex: 1,
                marginLeft: 12,
              }}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 13.5,
                  fontWeight: '900',
                }}
              >
                {doc.titolo}
              </Text>

              <Text
                style={{
                  color: '#8099B2',
                  fontSize: 9,
                  fontWeight: '600',
                  marginTop: 3,
                }}
              >
                {doc.sottotitolo}
              </Text>
            </View>

            <View
              style={{
                alignItems: 'flex-end',
              }}
            >
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 5,

                  borderRadius: 10,

                  backgroundColor:
                    `${statoDocumentoPersonale(
                      documentiPersonali[doc.id]
                    ).colore}18`,

                  borderWidth: 1,

                  borderColor:
                    `${statoDocumentoPersonale(
                      documentiPersonali[doc.id]
                    ).colore}55`,
                }}
              >
                <Text
                  style={{
                    color:
                      statoDocumentoPersonale(
                        documentiPersonali[doc.id]
                      ).colore,

                    fontSize: 7.5,
                    fontWeight: '900',
                    letterSpacing: 0.45,
                  }}
                >
                  {statoDocumentoPersonale(
                    documentiPersonali[doc.id]
                  ).testo}
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={16}
                color="#526D87"
                style={{
                  marginTop: 6,
                }}
              />
            </View>
          </TouchableOpacity>
        ))}

        {/* PRIVACY */}
        <View
          style={{
            marginTop: 8,
            marginBottom: 15,

            paddingHorizontal: 14,
            paddingVertical: 12,

            flexDirection: 'row',
            alignItems: 'center',

            borderRadius: 18,

            backgroundColor: 'rgba(11,28,50,0.56)',

            borderWidth: 1,
            borderColor: 'rgba(75,112,146,0.16)',
          }}
        >
          <Ionicons
            name="lock-closed-outline"
            size={17}
            color="#72A5C9"
          />

          <Text
            style={{
              flex: 1,
              marginLeft: 9,

              color: '#718BA4',
              fontSize: 9,
              lineHeight: 14,
              fontWeight: '600',
            }}
          >
            I documenti personali non saranno visibili
            agli altri utenti dell'app.
          </Text>
        </View>
      </Screen>
    );
  }



  /* =====================================================
     EMERGENZE SERVIZIO - V1
     ===================================================== */
  if (screen === 'emergenzeServizio') {

    const procedureEmergenza = [
      {
        id: 'malore',
        titolo: 'Malore',
        sottotitolo: 'Persona che necessita assistenza',
        icona: 'medkit-outline',
        colore: '#61E2B4',
        passaggi: [
          'Verifica che l’area sia sicura prima di intervenire.',
          'Allerta il 112/118 e comunica posizione e condizioni della persona.',
          'Avvisa la Sala Operativa secondo le procedure previste.',
          'Non somministrare farmaci e non effettuare manovre per cui non sei formato.',
          'Resta disponibile per indirizzare i soccorritori sul posto.',
        ],
      },
      {
        id: 'incendio',
        titolo: 'Incendio',
        sottotitolo: 'Fumo, fiamme o principio d’incendio',
        icona: 'flame-outline',
        colore: '#FF9B70',
        passaggi: [
          'Dai immediatamente l’allarme secondo la procedura del sito.',
          'Chiama il 112/115 indicando con precisione luogo e situazione.',
          'Avvisa la Sala Operativa.',
          'Favorisci l’allontanamento delle persone verso una zona sicura.',
          'Usa mezzi antincendio solo se previsto dalla formazione ricevuta e senza esporti a rischi.',
        ],
      },
      {
        id: 'aggressione',
        titolo: 'Aggressione / Minaccia',
        sottotitolo: 'Situazione violenta o potenzialmente pericolosa',
        icona: 'warning-outline',
        colore: '#FFB45F',
        passaggi: [
          'Mantieni una distanza di sicurezza e non aumentare il livello di conflitto.',
          'Proteggi te stesso e le persone presenti, se possibile senza esporti.',
          'Allerta immediatamente il 112 e la Sala Operativa.',
          'Osserva e ricorda elementi utili senza inseguire o assumere rischi non necessari.',
          'Attieniti alle procedure aziendali e alle indicazioni delle Forze dell’Ordine.',
        ],
      },
      {
        id: 'oggetto',
        titolo: 'Oggetto sospetto',
        sottotitolo: 'Pacco, borsa o oggetto anomalo',
        icona: 'alert-circle-outline',
        colore: '#C4A0FF',
        passaggi: [
          'Non toccare, spostare o manipolare l’oggetto.',
          'Mantieni le persone a distanza e limita l’accesso all’area.',
          'Avvisa immediatamente la Sala Operativa.',
          'Chiama il 112 se previsto dalla procedura o se la situazione lo richiede.',
          'Attendi le indicazioni delle autorità competenti.',
        ],
      },
      {
        id: 'evacuazione',
        titolo: 'Evacuazione',
        sottotitolo: 'Abbandono dell’area per emergenza',
        icona: 'exit-outline',
        colore: '#68DFFF',
        passaggi: [
          'Segui il piano di emergenza e le indicazioni previste per il sito.',
          'Indirizza le persone verso le vie di esodo sicure.',
          'Non utilizzare ascensori se la procedura lo vieta.',
          'Raggiungi il punto di raccolta previsto.',
          'Segnala alla Sala Operativa eventuali criticità o persone rimaste nell’area.',
        ],
      },
      {
        id: 'rapina',
        titolo: 'Furto / Rapina',
        sottotitolo: 'Evento criminale in corso o appena avvenuto',
        icona: 'shield-outline',
        colore: '#8BA9FF',
        passaggi: [
          'Metti al primo posto l’incolumità delle persone.',
          'Allerta il 112 e la Sala Operativa appena è possibile farlo in sicurezza.',
          'Non inseguire persone in fuga se ciò comporta rischi.',
          'Evita di alterare o contaminare l’area interessata.',
          'Annota appena possibile orari, descrizioni e informazioni utili per le autorità.',
        ],
      },
    ];

    return (
      <Screen>
        <Back onPress={() => setScreen('strumenti')} />

        <View
          style={{
            marginTop: 8,
            marginBottom: 18,
            padding: 20,

            borderRadius: 27,

            backgroundColor: 'rgba(45,24,48,0.94)',

            borderWidth: 1,
            borderColor: 'rgba(255,118,133,0.34)',

            shadowColor: '#FF6F7E',
            shadowOpacity: 0.12,
            shadowRadius: 15,
            shadowOffset: { width: 0, height: 6 },
          }}
        >
          <View
            style={{
              width: 49,
              height: 49,
              borderRadius: 16,

              alignItems: 'center',
              justifyContent: 'center',

              backgroundColor: 'rgba(255,105,121,0.12)',

              borderWidth: 1,
              borderColor: 'rgba(255,126,141,0.30)',
            }}
          >
            <Ionicons
              name="warning-outline"
              size={26}
              color="#FF8691"
            />
          </View>

          <Text
            style={{
              color: '#FF98A2',
              fontSize: 9.5,
              fontWeight: '900',
              letterSpacing: 1.25,
              marginTop: 15,
            }}
          >
            GUIDA RAPIDA
          </Text>

          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 28,
              fontWeight: '900',
              marginTop: 4,
            }}
          >
            Emergenze
          </Text>

          <Text
            style={{
              color: '#B8A8B4',
              fontSize: 12,
              lineHeight: 18,
              fontWeight: '600',
              marginTop: 6,
            }}
          >
            Indicazioni essenziali da consultare rapidamente
            nelle situazioni critiche.
          </Text>
        </View>

        {/* 112 RAPIDO */}
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => setScreen('numeriUtili')}
          style={{
            marginBottom: 18,
            padding: 16,

            flexDirection: 'row',
            alignItems: 'center',

            borderRadius: 22,

            backgroundColor: 'rgba(56,27,39,0.82)',

            borderWidth: 1,
            borderColor: 'rgba(255,108,123,0.31)',
          }}
        >
          <View
            style={{
              width: 43,
              height: 43,
              borderRadius: 14,

              alignItems: 'center',
              justifyContent: 'center',

              backgroundColor: 'rgba(255,100,117,0.12)',
            }}
          >
            <Ionicons
              name="call-outline"
              size={21}
              color="#FF818D"
            />
          </View>

          <View
            style={{
              flex: 1,
              marginLeft: 11,
            }}
          >
            <Text
              style={{
                color: '#FF9EA7',
                fontSize: 8.5,
                fontWeight: '900',
                letterSpacing: 0.9,
              }}
            >
              EMERGENZA
            </Text>

            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 15,
                fontWeight: '900',
                marginTop: 2,
              }}
            >
              112
            </Text>

            <Text
              style={{
                color: '#9B858C',
                fontSize: 8.5,
                fontWeight: '700',
                marginTop: 2,
              }}
            >
              Tocca per aprire tutti i numeri utili
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={18}
            color="#BA747E"
          />
        </TouchableOpacity>

        <Text
          style={{
            color: '#8EA4BC',
            fontSize: 9,
            fontWeight: '900',
            letterSpacing: 1.1,
            marginBottom: 10,
          }}
        >
          COSA FARE
        </Text>

        {procedureEmergenza.map((item) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.82}
            onPress={() => {
              setEmergenzaSelezionata(item);
              setScreen('emergenzaDettaglio');
            }}
            style={{
              minHeight: 82,

              flexDirection: 'row',
              alignItems: 'center',

              marginBottom: 10,
              paddingHorizontal: 14,
              paddingVertical: 13,

              borderRadius: 22,

              backgroundColor: 'rgba(10,28,59,0.94)',

              borderWidth: 1,
              borderColor: `${item.colore}3D`,

              shadowColor: item.colore,
              shadowOpacity: 0.05,
              shadowRadius: 7,
            }}
          >
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 15,

                alignItems: 'center',
                justifyContent: 'center',

                backgroundColor: 'rgba(30,53,89,0.76)',

                borderWidth: 1,
                borderColor: `${item.colore}50`,
              }}
            >
              <Ionicons
                name={item.icona}
                size={22}
                color={item.colore}
              />
            </View>

            <View
              style={{
                flex: 1,
                marginLeft: 12,
              }}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 13.5,
                  fontWeight: '900',
                }}
              >
                {item.titolo}
              </Text>

              <Text
                style={{
                  color: '#8199B2',
                  fontSize: 9,
                  fontWeight: '600',
                  marginTop: 3,
                }}
              >
                {item.sottotitolo}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color="#536F89"
            />
          </TouchableOpacity>
        ))}

        <View
          style={{
            marginTop: 8,
            marginBottom: 15,

            padding: 13,

            flexDirection: 'row',

            borderRadius: 18,

            backgroundColor: 'rgba(11,27,49,0.58)',

            borderWidth: 1,
            borderColor: 'rgba(75,111,145,0.16)',
          }}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={17}
            color="#739FC1"
          />

          <Text
            style={{
              flex: 1,
              marginLeft: 9,

              color: '#7089A1',
              fontSize: 9,
              lineHeight: 14,
              fontWeight: '600',
            }}
          >
            Questa guida non sostituisce le procedure aziendali,
            la formazione ricevuta o le indicazioni delle autorità.
          </Text>
        </View>
      </Screen>
    );
  }



  /* =====================================================
     REGOLE E GIURAMENTO - V1
     ===================================================== */
  if (screen === 'regoleGiuramento') {

    const sezioniRegole = [
      {
        id: 'giuramentoGpg',
        titolo: 'Giuramento GPG',
        sottotitolo: 'Formula e significato professionale',
        icona: 'document-text-outline',
        colore: '#73DFFF',
      },
      {
        id: 'regoleGpg',
        titolo: 'Regole GPG',
        sottotitolo: 'Principi essenziali durante il servizio',
        icona: 'shield-checkmark-outline',
        colore: '#8EA9FF',
      },
      {
        id: 'regoleFiduciari',
        titolo: 'Regole Fiduciari',
        sottotitolo: 'Comportamento e limiti operativi',
        icona: 'people-outline',
        colore: '#67E1BB',
      },
      {
        id: 'gpgVsFiduciario',
        titolo: 'GPG vs Fiduciario',
        sottotitolo: 'Differenze, ruoli e limiti',
        icona: 'git-compare-outline',
        colore: '#FFB66B',
      },
    ];

    return (
      <Screen>
        <Back onPress={() => setScreen('strumenti')} />

        <View
          style={{
            marginTop: 8,
            marginBottom: 19,
            padding: 20,

            borderRadius: 27,

            backgroundColor: 'rgba(22,28,73,0.95)',

            borderWidth: 1,
            borderColor: 'rgba(133,158,255,0.34)',

            shadowColor: '#849CFF',
            shadowOpacity: 0.13,
            shadowRadius: 15,
            shadowOffset: { width: 0, height: 6 },
          }}
        >
          <View
            style={{
              width: 49,
              height: 49,
              borderRadius: 16,

              alignItems: 'center',
              justifyContent: 'center',

              backgroundColor: 'rgba(124,145,255,0.13)',

              borderWidth: 1,
              borderColor: 'rgba(145,164,255,0.32)',
            }}
          >
            <Ionicons
              name="book-outline"
              size={25}
              color="#A8B7FF"
            />
          </View>

          <Text
            style={{
              color: '#A5B4FF',
              fontSize: 9.5,
              fontWeight: '900',
              letterSpacing: 1.2,
              marginTop: 15,
            }}
          >
            CONSULTAZIONE RAPIDA
          </Text>

          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 27,
              fontWeight: '900',
              marginTop: 4,
            }}
          >
            Regole & Giuramento
          </Text>

          <Text
            style={{
              color: '#A5B2CC',
              fontSize: 12,
              lineHeight: 18,
              fontWeight: '600',
              marginTop: 6,
            }}
          >
            Una guida semplice da consultare durante
            la formazione o prima del servizio.
          </Text>
        </View>

        {sezioniRegole.map((item) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.82}
            onPress={() => setScreen(item.id)}
            style={{
              minHeight: 84,

              flexDirection: 'row',
              alignItems: 'center',

              marginBottom: 11,
              paddingHorizontal: 14,
              paddingVertical: 13,

              borderRadius: 22,

              backgroundColor: 'rgba(10,28,59,0.94)',

              borderWidth: 1,
              borderColor: `${item.colore}42`,

              shadowColor: item.colore,
              shadowOpacity: 0.05,
              shadowRadius: 7,
            }}
          >
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 15,

                alignItems: 'center',
                justifyContent: 'center',

                backgroundColor: 'rgba(31,54,91,0.76)',

                borderWidth: 1,
                borderColor: `${item.colore}50`,
              }}
            >
              <Ionicons
                name={item.icona}
                size={22}
                color={item.colore}
              />
            </View>

            <View
              style={{
                flex: 1,
                marginLeft: 12,
              }}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 13.5,
                  fontWeight: '900',
                }}
              >
                {item.titolo}
              </Text>

              <Text
                style={{
                  color: '#8098B2',
                  fontSize: 9,
                  fontWeight: '600',
                  marginTop: 3,
                }}
              >
                {item.sottotitolo}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color="#536F89"
            />
          </TouchableOpacity>
        ))}

        <View
          style={{
            marginTop: 10,
            marginBottom: 15,

            padding: 14,
            borderRadius: 19,

            backgroundColor: 'rgba(12,31,53,0.60)',

            borderWidth: 1,
            borderColor: 'rgba(78,113,146,0.18)',
          }}
        >
          <Text
            style={{
              color: '#89A4BF',
              fontSize: 9,
              fontWeight: '900',
              letterSpacing: 0.9,
              marginBottom: 7,
            }}
          >
            DA RICORDARE
          </Text>

          <Text
            style={{
              color: '#7D93A9',
              fontSize: 9.5,
              lineHeight: 15,
              fontWeight: '600',
            }}
          >
            Le indicazioni contenute nell’app sono di supporto.
            Fanno sempre fede legge, formazione ricevuta,
            ordini di servizio e procedure aziendali.
          </Text>
        </View>
      </Screen>
    );
  }

  /* =====================================================
     GIURAMENTO GPG
     ===================================================== */
  if (screen === 'giuramentoGpg') {
    return (
      <Screen>
        <Back onPress={() => setScreen('regoleGiuramento')} />

        <View
          style={{
            marginTop: 8,
            padding: 20,
            borderRadius: 27,

            backgroundColor: 'rgba(14,35,68,0.95)',

            borderWidth: 1,
            borderColor: 'rgba(99,218,255,0.32)',
          }}
        >
          <Ionicons
            name="document-text-outline"
            size={31}
            color="#73DFFF"
          />

          <Text
            style={{
              color: '#72DFFF',
              fontSize: 9.5,
              fontWeight: '900',
              letterSpacing: 1.1,
              marginTop: 15,
            }}
          >
            GUARDIA PARTICOLARE GIURATA
          </Text>

          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 26,
              fontWeight: '900',
              marginTop: 4,
            }}
          >
            Giuramento
          </Text>

          <View
            style={{
              marginTop: 18,
              padding: 17,

              borderRadius: 20,

              backgroundColor: 'rgba(6,21,45,0.84)',

              borderWidth: 1,
              borderColor: 'rgba(83,171,216,0.24)',
            }}
          >
            <Text
              style={{
                color: '#DDEBFA',
                fontSize: 12,
                lineHeight: 20,
                fontWeight: '700',
              }}
            >
              Giuro di osservare lealmente le leggi e le altre
              disposizioni vigenti nel territorio della Repubblica
              e di adempiere le funzioni affidatemi con coscienza
              e diligenza, nel rispetto dei diritti dei cittadini.
            </Text>
          </View>

          <View
            style={{
              marginTop: 12,
              paddingHorizontal: 13,
              paddingVertical: 11,
              borderRadius: 16,

              flexDirection: 'row',
              alignItems: 'center',

              backgroundColor: 'rgba(13,30,58,0.72)',

              borderWidth: 1,
              borderColor: 'rgba(102,161,204,0.20)',
            }}
          >
            <Ionicons
              name="information-circle-outline"
              size={17}
              color="#79BBD9"
            />

            <View
              style={{
                flex: 1,
                marginLeft: 8,
              }}
            >
              <Text
                style={{
                  color: '#91AFC6',
                  fontSize: 8,
                  fontWeight: '900',
                  letterSpacing: 0.7,
                }}
              >
                RIFERIMENTO NORMATIVO
              </Text>

              <Text
                style={{
                  color: '#D3E0EA',
                  fontSize: 9.5,
                  fontWeight: '700',
                  lineHeight: 14,
                  marginTop: 3,
                }}
              >
                Art. 250, comma 3, R.D. 6 maggio 1940 n. 635,
                come modificato dal D.P.R. 4 agosto 2008 n. 153.
              </Text>
            </View>
          </View>

          <View
            style={{
              marginTop: 13,
              padding: 13,

              borderRadius: 17,

              backgroundColor: 'rgba(14,45,55,0.52)',

              borderWidth: 1,
              borderColor: 'rgba(91,213,197,0.20)',
            }}
          >
            <Text
              style={{
                color: '#91CFC3',
                fontSize: 9.5,
                lineHeight: 15,
                fontWeight: '700',
              }}
            >
              Il giuramento rappresenta l’impegno a svolgere
              le proprie funzioni nel rispetto della legge
              e dei doveri connessi alla qualifica.

              Per particolari pubbliche funzioni o specifici servizi
              possono applicarsi disposizioni differenti: fanno sempre
              fede il decreto prefettizio e la normativa vigente.
            </Text>
          </View>
        </View>
      </Screen>
    );
  }

  /* =====================================================
     REGOLE GPG
     ===================================================== */
  if (screen === 'regoleGpg') {

    const regole = [
      'Rispettare le consegne, gli ordini di servizio e le procedure del posto.',
      'Mantenere comportamento professionale, corretto e proporzionato alla situazione.',
      'Segnalare tempestivamente anomalie, incidenti e situazioni rilevanti alla Sala Operativa.',
      'Non attribuirsi poteri o funzioni non previsti dalla propria qualifica.',
      'Proteggere informazioni, documenti e dati conosciuti durante il servizio.',
      'Collaborare con le Forze dell’Ordine e seguire le indicazioni ricevute dalle autorità competenti.',
      'Utilizzare dotazioni e strumenti di servizio secondo formazione e procedure aziendali.',
      'Redigere segnalazioni e rapporti in modo chiaro, preciso e aderente ai fatti.',
    ];

    return (
      <Screen>
        <Back onPress={() => setScreen('regoleGiuramento')} />

        <Text
          style={{
            color: '#8EA9FF',
            fontSize: 9.5,
            fontWeight: '900',
            letterSpacing: 1.1,
            marginTop: 10,
          }}
        >
          PRINCIPI ESSENZIALI
        </Text>

        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 26,
            fontWeight: '900',
            marginTop: 4,
            marginBottom: 17,
          }}
        >
          Regole GPG
        </Text>

        {regole.map((regola, index) => (
          <View
            key={`gpg_${index}`}
            style={{
              marginBottom: 10,
              padding: 14,

              flexDirection: 'row',

              borderRadius: 20,

              backgroundColor: 'rgba(10,28,59,0.94)',

              borderWidth: 1,
              borderColor: 'rgba(116,142,227,0.22)',
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 11,

                alignItems: 'center',
                justifyContent: 'center',

                backgroundColor: 'rgba(121,142,230,0.14)',
              }}
            >
              <Text
                style={{
                  color: '#9EAEFF',
                  fontSize: 11,
                  fontWeight: '900',
                }}
              >
                {index + 1}
              </Text>
            </View>

            <Text
              style={{
                flex: 1,
                marginLeft: 11,

                color: '#E7EEF8',
                fontSize: 10.5,
                lineHeight: 17,
                fontWeight: '700',
              }}
            >
              {regola}
            </Text>
          </View>
        ))}
      </Screen>
    );
  }

  /* =====================================================
     REGOLE FIDUCIARI
     ===================================================== */
  if (screen === 'regoleFiduciari') {

    const regole = [
      'Attenersi alle consegne del servizio e alle procedure definite dall’azienda e dal committente.',
      'Gestire accessi, informazioni e segnalazioni nei limiti dell’incarico affidato.',
      'Mantenere comportamento professionale e cortese con utenti, visitatori e personale.',
      'Non svolgere attività riservate a soggetti con qualifiche o autorizzazioni diverse.',
      'Segnalare tempestivamente situazioni anomale al responsabile o alla Sala Operativa.',
      'Rispettare riservatezza e tutela dei dati personali.',
      'In caso di emergenza, privilegiare la sicurezza delle persone e allertare i servizi competenti.',
      'Annotare fatti e consegne in modo preciso quando previsto dal servizio.',
    ];

    return (
      <Screen>
        <Back onPress={() => setScreen('regoleGiuramento')} />

        <Text
          style={{
            color: '#67E1BB',
            fontSize: 9.5,
            fontWeight: '900',
            letterSpacing: 1.1,
            marginTop: 10,
          }}
        >
          PRINCIPI ESSENZIALI
        </Text>

        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 26,
            fontWeight: '900',
            marginTop: 4,
            marginBottom: 17,
          }}
        >
          Regole Fiduciari
        </Text>

        {regole.map((regola, index) => (
          <View
            key={`fid_${index}`}
            style={{
              marginBottom: 10,
              padding: 14,

              flexDirection: 'row',

              borderRadius: 20,

              backgroundColor: 'rgba(10,28,59,0.94)',

              borderWidth: 1,
              borderColor: 'rgba(96,209,177,0.20)',
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 11,

                alignItems: 'center',
                justifyContent: 'center',

                backgroundColor: 'rgba(91,214,179,0.12)',
              }}
            >
              <Text
                style={{
                  color: '#70E0BD',
                  fontSize: 11,
                  fontWeight: '900',
                }}
              >
                {index + 1}
              </Text>
            </View>

            <Text
              style={{
                flex: 1,
                marginLeft: 11,

                color: '#E7F2EE',
                fontSize: 10.5,
                lineHeight: 17,
                fontWeight: '700',
              }}
            >
              {regola}
            </Text>
          </View>
        ))}
      </Screen>
    );
  }


if (
    screen === 'meteoServizio' ||
    screen === 'documentiServizio' ||
    screen === 'emergenzeServizio' ||
    screen === 'numeriUtili' ||
    screen === 'regoleGiuramento'
  ) {
    const dati = {
      meteoServizio: {
        icon: 'partly-sunny-outline',
        titolo: 'Meteo servizio',
        testo: 'Qui collegheremo il meteo alla zona e all’orario del prossimo turno.',
      },
      documentiServizio: {
        icon: 'id-card-outline',
        titolo: 'Documenti',
        testo: 'Qui gestiremo documenti professionali, fotografie, PDF e scadenze.',
      },
      emergenzeServizio: {
        icon: 'warning-outline',
        titolo: 'Emergenze',
        testo: 'Procedure rapide e indicazioni essenziali per le situazioni di emergenza.',
      },
      numeriUtili: {
        icon: 'call-outline',
        titolo: 'Numeri utili',
        testo: 'Emergenze nazionali, Sala Operativa e contatti personalizzabili.',
      },
      regoleGiuramento: {
        icon: 'book-outline',
        titolo: 'Regole & Giuramento',
        testo: 'Giuramento, regole professionali e materiale di consultazione.',
      },
    };

    const pagina = dati[screen];

    return (
      <Screen>
        <Back onPress={() => setScreen('strumenti')} />

        <View
          style={{
            marginTop: 10,
            padding: 22,
            borderRadius: 25,

            backgroundColor: 'rgba(15,34,69,0.94)',

            borderWidth: 1,
            borderColor: 'rgba(82,188,238,0.38)',
          }}
        >
          <Ionicons
            name={pagina.icon}
            size={33}
            color="#69E2FF"
          />

          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 25,
              fontWeight: '900',
              marginTop: 16,
            }}
          >
            {pagina.titolo}
          </Text>

          <Text
            style={{
              color: '#97B0CB',
              fontSize: 13,
              lineHeight: 19,
              fontWeight: '600',
              marginTop: 7,
            }}
          >
            {pagina.testo}
          </Text>

          <View
            style={{
              marginTop: 22,
              padding: 15,
              borderRadius: 18,
              backgroundColor: 'rgba(8,21,43,0.76)',
            }}
          >
            <Text
              style={{
                color: '#69E2FF',
                fontSize: 11,
                fontWeight: '900',
                letterSpacing: 0.8,
              }}
            >
              IN PREPARAZIONE
            </Text>

            <Text
              style={{
                color: '#8099B4',
                fontSize: 11,
                lineHeight: 17,
                marginTop: 5,
              }}
            >
              Adesso costruiamo questa funzione in modo completo.
            </Text>
          </View>
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
          PROFILO PROFESSIONALE
        </Text>

        <View style={{ alignItems: 'center', marginBottom: 18 }}>
          {p.foto_url ? (
            <TouchableOpacity
          activeOpacity={0.86}
          onPress={() => setFotoCollegaAperta(true)}
        >
          <Image
              source={{ uri: p.foto_url }}
              style={{
                width: 118,
              height: 118,
              borderRadius: 59,
              }}
            />
        </TouchableOpacity>
          ) : (
            <View
              style={{
                width: 118,
              height: 118,
              borderRadius: 59,
                backgroundColor: '#122C62',
              borderWidth: 2,
              borderColor: '#67E7FF',
              shadowColor: '#49DFFF',
              shadowOpacity: 0.50,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 5 },
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

        <View
        style={{
          alignSelf: 'center',
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 14,
          marginTop: 14,
          marginBottom: 5,
          backgroundColor: 'rgba(67, 105, 198, 0.18)',
          borderWidth: 1,
          borderColor: 'rgba(104, 232, 255, 0.35)',
        }}
      >
        <Text
          style={{
            color: '#86E7FF',
            fontSize: 9,
            fontWeight: '900',
            letterSpacing: 1.1,
          }}
        >
          IDENTITÀ OPERATIVA
        </Text>
      </View>

      <Text
          style={{
              color: '#FFFFFF',
              width: '100%',
              fontSize: 28,
              fontWeight: '900',
              textAlign: 'center',
              letterSpacing: -0.35,
              marginTop: 5,
              marginBottom: 7,
              textShadowColor: 'rgba(86,225,255,0.32)',
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 10,
            }}
        >
          {p.nome || 'Collega'} {p.cognome || ''}
        </Text>

        <Text
          style={{
              color: '#B3C7DF',
              width: '100%',
              fontSize: 14,
              fontWeight: '700',
              textAlign: 'center',
              lineHeight: 19,
              marginBottom: 24,
            }}
        >
          {[p.azienda, p.sede].filter(Boolean).join(' · ') || 'Informazioni non disponibili'}
        </Text>

        <View
        style={{
          backgroundColor: 'rgba(8, 38, 60, 0.92)',
          borderRadius: 24,
          padding: 17,
          marginBottom: 15,

          borderWidth: 1,
          borderColor: 'rgba(80, 230, 196, 0.42)',

          shadowColor: '#39E0C0',
          shadowOpacity: 0.14,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 5 },
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 9,
          }}
        >
          <View
            style={{
              width: 9,
              height: 9,
              borderRadius: 5,
              backgroundColor: '#58E9B5',
              marginRight: 8,

              shadowColor: '#58E9B5',
              shadowOpacity: 0.85,
              shadowRadius: 7,
              shadowOffset: { width: 0, height: 0 },
            }}
          />

          <Text
            style={{
              color: '#8BD8C6',
              fontSize: 10,
              fontWeight: '900',
              letterSpacing: 1,
            }}
          >
            STATO OPERATIVO
          </Text>
        </View>

        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 16,
            fontWeight: '900',
          }}
        >
          In servizio con te
        </Text>

        <Text
          style={{
            color: c?.insieme_da && c?.insieme_a
              ? '#67F0BB'
              : '#91A8BE',
            fontSize: 13,
            fontWeight: '700',
            marginTop: 5,
            lineHeight: 18,
          }}
        >
          {c?.insieme_da && c?.insieme_a
            ? `Dalle ${c.insieme_da} alle ${c.insieme_a}`
            : 'Nessuna sovrapposizione indicata'}
        </Text>
      </View>

        <View
        style={{
          marginBottom: 6,
        }}
      >
        <Text
          style={{
            color: '#7898B9',
            fontSize: 10,
            fontWeight: '900',
            letterSpacing: 1,
            marginBottom: 9,
          }}
        >
          DATI PROFESSIONALI
        </Text>

        <View
          style={{
            flexDirection: 'row',
            gap: 9,
          }}
        >
          {/* RUOLO */}
          <View
            style={{
              flex: 1,
              minHeight: 96,
              backgroundColor: 'rgba(13, 34, 72, 0.94)',
              borderRadius: 21,
              padding: 13,

              borderWidth: 1,
              borderColor: 'rgba(77, 191, 235, 0.38)',

              shadowColor: '#42CFFF',
              shadowOpacity: 0.11,
              shadowRadius: 9,
            }}
          >
            <Text style={{ fontSize: 18 }}>
              🛡️
            </Text>

            <Text
              style={{
                color: '#789DBD',
                fontSize: 8.5,
                fontWeight: '900',
                letterSpacing: 0.8,
                marginTop: 8,
              }}
            >
              RUOLO
            </Text>

            <Text
              numberOfLines={2}
              style={{
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: '900',
                marginTop: 4,
                lineHeight: 15,
              }}
            >
              {p.ruolo || 'Guardia Particolare Giurata'}
            </Text>
          </View>

          {/* MATRICOLA */}
          <View
            style={{
              flex: 1,
              minHeight: 96,
              backgroundColor: 'rgba(20, 31, 75, 0.94)',
              borderRadius: 21,
              padding: 13,

              borderWidth: 1,
              borderColor: 'rgba(111, 123, 239, 0.38)',

              shadowColor: '#6D74FF',
              shadowOpacity: 0.10,
              shadowRadius: 9,
            }}
          >
            <Text style={{ fontSize: 18 }}>
              🪪
            </Text>

            <Text
              style={{
                color: '#8994C4',
                fontSize: 8.5,
                fontWeight: '900',
                letterSpacing: 0.8,
                marginTop: 8,
              }}
            >
              MATRICOLA
            </Text>

            <Text
              numberOfLines={1}
              style={{
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: '900',
                marginTop: 4,
              }}
            >
              {p.codice_gpg || '—'}
            </Text>
          </View>
        </View>

        
        <View
          style={{
            marginTop: 10,
            minHeight: 72,

            flexDirection: 'row',
            alignItems: 'center',

            paddingHorizontal: 15,
            paddingVertical: 13,

            borderRadius: 21,

            backgroundColor: 'rgba(11, 40, 69, 0.90)',

            borderWidth: 1,
            borderColor: 'rgba(78, 204, 236, 0.40)',

            shadowColor: '#42D9FF',
            shadowOpacity: 0.12,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,

              alignItems: 'center',
              justifyContent: 'center',

              marginRight: 12,

              backgroundColor: 'rgba(54, 159, 207, 0.16)',

              borderWidth: 1,
              borderColor: 'rgba(96, 224, 255, 0.35)',
            }}
          >
            <Text style={{ fontSize: 19 }}>
              📍
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: '#7FA8C7',
                fontSize: 9,
                fontWeight: '900',
                letterSpacing: 1,
              }}
            >
              ZONA OPERATIVA
            </Text>

            <Text
              numberOfLines={2}
              style={{
                color: '#FFFFFF',
                fontSize: 14,
                fontWeight: '900',
                marginTop: 4,
                lineHeight: 18,
              }}
            >
              {p.sede || '—'}
            </Text>
          </View>
        </View>

{p.in_servizio_dal ? (
          <View
            style={{
              marginTop: 9,
              minHeight: 61,

              flexDirection: 'row',
              alignItems: 'center',

              paddingHorizontal: 14,
              paddingVertical: 11,

              borderRadius: 19,

              backgroundColor: 'rgba(12, 34, 62, 0.82)',

              borderWidth: 1,
              borderColor: 'rgba(72, 157, 211, 0.30)',
            }}
          >
            <Text
              style={{
                fontSize: 18,
                marginRight: 11,
              }}
            >
              📅
            </Text>

            <View>
              <Text
                style={{
                  color: '#7898B9',
                  fontSize: 8.5,
                  fontWeight: '900',
                  letterSpacing: 0.9,
                }}
              >
                IN SERVIZIO DAL
              </Text>

              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: '900',
                  marginTop: 3,
                }}
              >
                {String(p.in_servizio_dal)}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
      

        {c?.stato === 'accettato' ? (
        <TouchableOpacity
          onPress={() => {
            setCollegaSelezionato(c);
            setChatMessaggio('');
            setScreen('chatCollega');
          }}
          style={{
            backgroundColor: '#0D7FA3',
            borderRadius: 21,
            minHeight: 56,
            paddingVertical: 15,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 20,

            borderWidth: 1.2,
            borderColor: '#72E7FF',

            shadowColor: '#45D9FF',
            shadowOpacity: 0.38,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 7 },

            elevation: 9,
          }}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: '900',
              letterSpacing: 0.7,
            }}
          >
            💬  APRI CHAT
          </Text>
        </TouchableOpacity>

      ) : c?.stato === 'in_attesa' ? (

        <View
          style={{
            minHeight: 56,
            marginTop: 20,
            borderRadius: 21,

            alignItems: 'center',
            justifyContent: 'center',

            backgroundColor: 'rgba(47,71,112,0.58)',

            borderWidth: 1,
            borderColor: 'rgba(124,155,200,0.35)',
          }}
        >
          <Text
            style={{
              color: '#9EB5CE',
              fontSize: 13,
              fontWeight: '900',
              letterSpacing: 0.6,
            }}
          >
            ✓  RICHIESTA INVIATA
          </Text>
        </View>

      ) : p.codice_gpg ? (

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
            backgroundColor: '#176BE5',
            borderRadius: 21,
            minHeight: 56,
            paddingVertical: 15,

            alignItems: 'center',
            justifyContent: 'center',

            marginTop: 20,

            borderWidth: 1.2,
            borderColor: '#68E8FF',

            shadowColor: '#45D9FF',
            shadowOpacity: 0.38,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 7 },

            elevation: 9,
          }}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: '900',
              letterSpacing: 0.7,
            }}
          >
            +  AGGIUNGI COLLEGA
          </Text>
        </TouchableOpacity>

      ) : null}


      {fotoCollegaAperta && p.foto_url ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(1,6,16,0.96)',
            zIndex: 999,
            elevation: 30,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 18,
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setFotoCollegaAperta(false)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />

          <View
            style={{
              width: '100%',
              maxWidth: 390,
              zIndex: 1000,
              alignItems: 'center',
            }}
          >
            <TouchableOpacity
              onPress={() => setFotoCollegaAperta(false)}
              style={{
                alignSelf: 'flex-end',
                width: 42,
                height: 42,
                borderRadius: 21,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
                backgroundColor: 'rgba(15,29,55,0.94)',
                borderWidth: 1,
                borderColor: 'rgba(96,225,255,0.52)',
              }}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 24,
                  fontWeight: '800',
                }}
              >
                ×
              </Text>
            </TouchableOpacity>

            <View
              style={{
                width: '100%',
                aspectRatio: 1,
                borderRadius: 30,
                overflow: 'hidden',
                backgroundColor: '#071326',

                borderWidth: 1.5,
                borderColor: 'rgba(96,229,255,0.64)',

                shadowColor: '#55E4FF',
                shadowOpacity: 0.44,
                shadowRadius: 26,
                shadowOffset: { width: 0, height: 0 },

                elevation: 15,
              }}
            >
              <Image
                source={{ uri: p.foto_url }}
                resizeMode="cover"
                style={{
                  width: '100%',
                  height: '100%',
                }}
              />
            </View>

            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 18,
                fontWeight: '900',
                textAlign: 'center',
                marginTop: 17,
              }}
            >
              {[p.nome, p.cognome].filter(Boolean).join(' ') || 'Collega'}
            </Text>

            <Text
              style={{
                color: '#8EA8C5',
                fontSize: 11,
                fontWeight: '700',
                marginTop: 5,
              }}
            >
              Tocca fuori dalla foto per chiudere
            </Text>
          </View>
        </View>
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

        <Field profile
          label="NOME"
          value={
            nomeDraft
          }
          onChange={
            setNomeDraft
          }
        />

        <Field profile
          label="COGNOME"
          value={
            cognomeDraft
          }
          onChange={
            setCognomeDraft
          }
        />

        

        <Field profile
          label="AZIENDA"
          value={
            aziendaDraft
          }
          onChange={
            setAziendaDraft
          }
        />

      {/* MATRICOLA PROFILO */}
      <View style={styles.profileFieldWrap}>
        <Text style={styles.profileFieldLabel}>
          MATRICOLA
        </Text>

        <View
          style={[
            styles.profileFieldInput,
            {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            },
          ]}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <TextInput
              value={matricolaDraft}
              onChangeText={setMatricolaDraft}
              placeholder="Inserisci matricola"
              placeholderTextColor="#7899B8"
              autoCapitalize="characters"
              autoCorrect={false}
              style={{
                color: '#FFFFFF',
                fontSize: 15,
                fontWeight: '800',
                letterSpacing: 0.4,
                padding: 0,
                margin: 0,
              }}
            />

            <Text
              style={{
                color: '#7899B8',
                fontSize: 9,
                fontWeight: '600',
                marginTop: 3,
              }}
            >
              Matricola professionale
            </Text>
          </View>

          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: 'rgba(92,234,255,0.10)',
              borderWidth: 1,
              borderColor: 'rgba(92,234,255,0.45)',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#5CEAFF',
              shadowOpacity: 0.22,
              shadowRadius: 7,
            }}
          >
            <Text style={{ fontSize: 15 }}>🛡️</Text>
          </View>
        </View>
      </View>


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

        <Field profile
          label="SEDE / ZONA"
          value={
            sedeDraft
          }
          onChange={
            setSedeDraft
          }
        />

      <Field
        profile
        label="IN SERVIZIO DAL"
        value={inServizioDalDraft}
        onChange={(testo) => {
          const soloNumeri = testo.replace(/\D/g, '').slice(0, 4);
          setInServizioDalDraft(soloNumeri);
        }}
        keyboardType="number-pad"
      />


        
      {/* PANNELLO IDENTITA PROFESSIONALE */}
      <View
        style={{
          marginTop: 8,
          marginBottom: 8,
          padding: 16,
          borderRadius: 26,
          backgroundColor: 'rgba(22, 28, 74, 0.88)',
          borderWidth: 1.2,
          borderColor: 'rgba(111, 111, 255, 0.72)',

          shadowColor: '#706CFF',
          shadowOpacity: 0.25,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
        }}
      >
        <Text
          style={{
            color: '#8FE8FF',
            fontSize: 10,
            fontWeight: '900',
            letterSpacing: 1.25,
            marginBottom: 12,

            textShadowColor: 'rgba(92,235,255,0.30)',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 7,
          }}
        >
          IDENTITÀ PROFESSIONALE
        </Text>

        <View
          style={{
            flexDirection: 'row',
            gap: 8,
          }}
        >
          {/* CODICE */}
          <View
            style={{
              flex: 1,
              minHeight: 82,
              padding: 11,
              borderRadius: 19,
              backgroundColor: 'rgba(37, 49, 111, 0.78)',
              borderWidth: 1,
              borderColor: 'rgba(92,234,255,0.46)',

              shadowColor: '#5CEAFF',
              shadowOpacity: 0.15,
              shadowRadius: 8,
            }}
          >
            <Text style={{ fontSize: 16 }}>🛡️</Text>

            <Text
              style={{
                color: '#7FA5C2',
                fontSize: 8,
                fontWeight: '800',
                marginTop: 7,
                letterSpacing: 0.5,
              }}
            >
              MATRICOLA
            </Text>

            <Text
              numberOfLines={1}
              style={{
                color: '#FFFFFF',
                fontSize: 11,
                fontWeight: '900',
                marginTop: 3,
              }}
            >
              {profilo?.codice_gpg || '—'}
            </Text>
          </View>

          {/* SEDE */}
          <View
            style={{
              flex: 1,
              minHeight: 82,
              padding: 11,
              borderRadius: 19,
              backgroundColor: 'rgba(43, 38, 105, 0.78)',
              borderWidth: 1,
              borderColor: 'rgba(135,122,255,0.55)',

              shadowColor: '#8075FF',
              shadowOpacity: 0.14,
              shadowRadius: 8,
            }}
          >
            <Text style={{ fontSize: 16 }}>📍</Text>

            <Text
              style={{
                color: '#8C91C7',
                fontSize: 8,
                fontWeight: '800',
                marginTop: 7,
                letterSpacing: 0.5,
              }}
            >
              SEDE / ZONA
            </Text>

            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                color: '#FFFFFF',
                fontSize: 11,
                fontWeight: '900',
                marginTop: 3,
              }}
            >
              {sedeDraft || '—'}
            </Text>
          </View>

          {/* ANZIANITÀ */}
          <View
            style={{
              flex: 1,
              minHeight: 82,
              padding: 11,
              borderRadius: 19,
              backgroundColor: 'rgba(29, 58, 99, 0.78)',
              borderWidth: 1,
              borderColor: 'rgba(92,198,255,0.45)',

              shadowColor: '#5CCAFF',
              shadowOpacity: 0.14,
              shadowRadius: 8,
            }}
          >
            <Text style={{ fontSize: 16 }}>📅</Text>

            <Text
              style={{
                color: '#7CAAC8',
                fontSize: 8,
                fontWeight: '800',
                marginTop: 7,
                letterSpacing: 0.45,
              }}
            >
              IN SERVIZIO
            </Text>

            <Text
              numberOfLines={1}
              style={{
                color: '#FFFFFF',
                fontSize: 11,
                fontWeight: '900',
                marginTop: 3,
              }}
            >
              {inServizioDalDraft
                ? `Dal ${inServizioDalDraft}`
                : '—'}
            </Text>
          </View>
        </View>
      </View>

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
            style={{
          minHeight: 52,

          marginTop: 12,
          marginBottom: 8,

          paddingHorizontal: 16,
          paddingVertical: 13,

          borderRadius: 20,

          backgroundColor: 'rgba(67, 25, 43, 0.38)',

          borderWidth: 1,
          borderColor: 'rgba(255, 100, 126, 0.38)',

          alignItems: 'center',
          justifyContent: 'center',

          shadowColor: '#FF657E',
          shadowOpacity: 0.10,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        }}
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

            <View
        style={{
          marginTop: 4,
          marginBottom: 8,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 7,
          }}
        >
          <Ionicons
            name="location-outline"
            size={17}
            color="#69DFFF"
          />

          <View
            style={{
              marginLeft: 7,
              flex: 1,
            }}
          >
            <Text
              style={{
                color: '#DCEBFF',
                fontSize: 11,
                fontWeight: '900',
                letterSpacing: 0.45,
              }}
            >
              LUOGO DEL SERVIZIO
            </Text>

            <Text
              style={{
                color: '#718BA6',
                fontSize: 8.5,
                fontWeight: '700',
                marginTop: 2,
              }}
            >
              FACOLTATIVO · utile anche per il meteo
            </Text>
          </View>
        </View>

        <Field
          label="ES. FIUMICINO, ROMA, CIAMPINO..."
          value={luogo}
          onChange={setLuogo}
        />
      </View>

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

          <View style={{flexDirection:'row',marginTop:10,gap:8}}>
            <View style={{flex:1,backgroundColor:'#0B1638',borderRadius:15,padding:9}}>
              <Ionicons name="time-outline" size={24} color="#9FB1FF" />
              <Text style={{color:'white',fontSize:23,fontWeight:'900',marginTop:5}}>
                169,5h
              </Text>
              <Text style={{color:'#B8C1DA',fontSize:10,fontWeight:'800'}}>LAVORATE</Text>
            </View>

            <View style={{flex:1,backgroundColor:'#0B1638',borderRadius:15,padding:9}}>
              <Ionicons name="star-outline" size={24} color="#FFD24A" />
              <Text style={{color:'white',fontSize:23,fontWeight:'900',marginTop:5}}>
                38h
              </Text>
              <Text style={{color:'#B8C1DA',fontSize:10,fontWeight:'800'}}>EXTRA</Text>
            </View>

            <View style={{flex:1,backgroundColor:'#0B1638',borderRadius:15,padding:9}}>
              <Ionicons name="calendar-number-outline" size={24} color="#FFB7EA" />
              <Text style={{color:'white',fontSize:23,fontWeight:'900',marginTop:5}}>
                19
              </Text>
              <Text style={{color:'#B8C1DA',fontSize:10,fontWeight:'800'}}>GIORNI</Text>
            </View>
          </View>

          <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:10}}>
            <Text style={{color:'#AEB9D6',fontSize:11,fontWeight:'800'}}>AVANZAMENTO MESE</Text>
            <Text style={{color:'#FFFFFF',fontSize:12,fontWeight:'900'}}>
                {Math.round((new Date().getDate() / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()) * 100)}%
              </Text>
          </View>

          <View style={{height:6,borderRadius:10,backgroundColor:'#19264A',marginTop:4,overflow:'hidden'}}>
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

        
      {/* ===== HOME DOCUMENTI SCADENZE SAFE ===== */}
      {(() => {
        const oggiDocHome = new Date();
        oggiDocHome.setHours(0, 0, 0, 0);

        const avvisiDocHome = Object.entries(
          documentiPersonali || {}
        )
          .map(([id, doc]) => {
            const testo = String(
              doc?.scadenza || ''
            ).trim();

            const parti = testo.split('/');

            if (parti.length !== 3) {
              return null;
            }

            const giorno = Number(parti[0]);
            const mese = Number(parti[1]);
            const anno = Number(parti[2]);

            const data = new Date(
              anno,
              mese - 1,
              giorno,
              23,
              59,
              59,
              999
            );

            if (
              Number.isNaN(data.getTime()) ||
              data.getDate() !== giorno ||
              data.getMonth() !== mese - 1 ||
              data.getFullYear() !== anno
            ) {
              return null;
            }

            const giorni = Math.ceil(
              (data.getTime() -
                oggiDocHome.getTime()) /
                86400000
            );

            return {
              id,
              nome:
                doc?.nome ||
                'Documento',
              giorni,
            };
          })
          .filter(Boolean);

        const scaduti =
          avvisiDocHome.filter(
            (x) => x.giorni < 0
          );

        const inScadenza =
          avvisiDocHome.filter(
            (x) =>
              x.giorni >= 0 &&
              x.giorni <= 30
          );

        if (
          scaduti.length === 0 &&
          inScadenza.length === 0
        ) {
          return null;
        }

        const urgente =
          scaduti.length > 0;

        const quanti = urgente
          ? scaduti.length
          : inScadenza.length;

        return (
          <TouchableOpacity
            activeOpacity={0.84}
            onPress={() =>
              setScreen('documentiServizio')
            }
            style={{
              marginHorizontal: 16,
              marginBottom: 15,

              paddingHorizontal: 15,
              paddingVertical: 13,

              flexDirection: 'row',
              alignItems: 'center',

              borderRadius: 20,

              backgroundColor: urgente
                ? 'rgba(77,30,39,0.82)'
                : 'rgba(72,50,25,0.78)',

              borderWidth: 1,

              borderColor: urgente
                ? 'rgba(255,107,121,0.34)'
                : 'rgba(255,183,94,0.32)',

              shadowColor: urgente
                ? '#FF6F7D'
                : '#FFB55F',

              shadowOpacity: 0.10,
              shadowRadius: 9,
              shadowOffset: {
                width: 0,
                height: 4,
              },
            }}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,

                alignItems: 'center',
                justifyContent: 'center',

                backgroundColor: urgente
                  ? 'rgba(255,102,117,0.12)'
                  : 'rgba(255,178,85,0.12)',
              }}
            >
              <Ionicons
                name={
                  urgente
                    ? 'alert-circle-outline'
                    : 'time-outline'
                }
                size={21}
                color={
                  urgente
                    ? '#FF828E'
                    : '#FFB861'
                }
              />
            </View>

            <View
              style={{
                flex: 1,
                marginLeft: 11,
              }}
            >
              <Text
                style={{
                  color: urgente
                    ? '#FF9EA7'
                    : '#FFC47A',

                  fontSize: 8.5,
                  fontWeight: '900',
                  letterSpacing: 0.9,
                }}
              >
                DOCUMENTI
              </Text>

              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 12.5,
                  fontWeight: '900',
                  marginTop: 3,
                }}
              >
                {urgente
                  ? `${quanti} ${
                      quanti === 1
                        ? 'documento scaduto'
                        : 'documenti scaduti'
                    }`
                  : `${quanti} ${
                      quanti === 1
                        ? 'documento in scadenza'
                        : 'documenti in scadenza'
                    }`}
              </Text>

              <Text
                style={{
                  color: urgente
                    ? '#A88287'
                    : '#A58E73',

                  fontSize: 8.5,
                  fontWeight: '700',
                  marginTop: 3,
                }}
              >
                Tocca per controllare lo scadenziario
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={
                urgente
                  ? '#D9828A'
                  : '#C69B67'
              }
            />
          </TouchableOpacity>
        );
      })()}

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

  
      {/* ===== STRUMENTI HOME ALTO ===== */}
      <TouchableOpacity
        activeOpacity={0.84}
        onPress={() => setScreen('strumenti')}
        style={{
          marginHorizontal: 16,
          marginBottom: 15,
          minHeight: 64,
          paddingHorizontal: 17,
          paddingVertical: 13,

          flexDirection: 'row',
          alignItems: 'center',

          borderRadius: 20,

          backgroundColor: 'rgba(16,38,78,0.94)',

          borderWidth: 1,
          borderColor: 'rgba(91,218,255,0.45)',

          shadowColor: '#49DFFF',
          shadowOpacity: 0.16,
          shadowRadius: 12,
          shadowOffset: {
            width: 0,
            height: 5,
          },

          elevation: 6,
        }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',

            backgroundColor: 'rgba(73,183,255,0.15)',
            borderWidth: 1,
            borderColor: 'rgba(99,229,255,0.34)',
          }}
        >
          <Ionicons
            name="briefcase-outline"
            size={23}
            color="#72E7FF"
          />
        </View>

        <View
          style={{
            flex: 1,
            marginLeft: 13,
          }}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: '900',
              letterSpacing: 0.35,
            }}
          >
            STRUMENTI
          </Text>

          <Text
            style={{
              color: '#8FABC8',
              fontSize: 10.5,
              fontWeight: '700',
              marginTop: 3,
            }}
          >
            Meteo, documenti, emergenze e utility
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={19}
          color="#77BFD9"
        />
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
        
        {/* BADGE NON LETTI NAV CHAT */}
        {Object.values(riepilogoChat || {}).reduce(
          (totale, chat) => totale + (chat?.nonLetti || 0),
          0
        ) > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: 3,
              right: 7,
              minWidth: 19,
              height: 19,
              borderRadius: 10,
              paddingHorizontal: 5,
              backgroundColor: '#FF4D6D',
              borderWidth: 1.5,
              borderColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#FF4D6D',
              shadowOpacity: 0.45,
              shadowRadius: 7,
            }}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 9,
                lineHeight: 12,
                fontWeight: '900',
              }}
            >
              {Math.min(
                99,
                Object.values(riepilogoChat || {}).reduce(
                  (totale, chat) => totale + (chat?.nonLetti || 0),
                  0
                )
              )}
            </Text>
          </View>
        ) : null}

      </TouchableOpacity>

      </View>

        {/* ===== STRUMENTI / CENTRO OPERATIVO ===== */}
        {false && (
<TouchableOpacity
          onPress={() => setScreen('strumenti')}
          activeOpacity={0.84}
          style={{
            width: '100%',
            minHeight: 64,
            marginTop: -8,
            paddingHorizontal: 17,
            paddingVertical: 13,

            flexDirection: 'row',
            alignItems: 'center',

            borderRadius: 20,

            backgroundColor: 'rgba(16, 38, 78, 0.94)',

            borderWidth: 1,
            borderColor: 'rgba(91, 218, 255, 0.45)',

            shadowColor: '#49DFFF',
            shadowOpacity: 0.16,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 5 },

            elevation: 6,
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',

              backgroundColor: 'rgba(73, 183, 255, 0.15)',
              borderWidth: 1,
              borderColor: 'rgba(99, 229, 255, 0.34)',
            }}
          >
            <Ionicons
              name="briefcase-outline"
              size={23}
              color="#72E7FF"
            />
          </View>

          <View
            style={{
              flex: 1,
              marginLeft: 13,
            }}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 14,
                fontWeight: '900',
                letterSpacing: 0.35,
              }}
            >
              STRUMENTI
            </Text>

            <Text
              style={{
                color: '#8FABC8',
                fontSize: 10.5,
                fontWeight: '700',
                marginTop: 3,
              }}
            >
              Meteo, documenti, emergenze e utility
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={19}
            color="#77BFD9"
          />
        </TouchableOpacity>
)}

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


/* =========================================================
   RAPPORTO SERVIZIO V1
   ========================================================= */
function RapportoServizioScreen({
  onBack,
  postazioni = [],
}) {
  const adesso = new Date();

  const dataIniziale = [
    String(adesso.getDate()).padStart(2, '0'),
    String(adesso.getMonth() + 1).padStart(2, '0'),
    adesso.getFullYear(),
  ].join('/');

  const oraIniziale =
    `${String(adesso.getHours()).padStart(2, '0')}:` +
    `${String(adesso.getMinutes()).padStart(2, '0')}`;

  const [rapportoData, setRapportoData] =
    React.useState(dataIniziale);

  const [rapportoOra, setRapportoOra] =
    React.useState(oraIniziale);

  const [rapportoLuogo, setRapportoLuogo] =
    React.useState('');

  const [rapportoEvento, setRapportoEvento] =
    React.useState('');

  const [rapportoPersone, setRapportoPersone] =
    React.useState('');

  const [rapportoIntervento, setRapportoIntervento] =
    React.useState('');

  const [rapportoAutorita, setRapportoAutorita] =
    React.useState('');

  const [rapportoNote, setRapportoNote] =
    React.useState('');

  const [rapportiArchivio, setRapportiArchivio] =
    React.useState([]);

  const [postazioniRapporto, setPostazioniRapporto] =
    React.useState([]);

  React.useEffect(() => {
    if (Array.isArray(postazioni)) {
      setPostazioniRapporto(postazioni);
    }
  }, [postazioni]);



  React.useEffect(() => {
    let attivo = true;

    (async () => {
      try {
        const dati = await AsyncStorage.getItem(
          'vigilanza_rapporti_servizio'
        );

        if (attivo && dati) {
          const parsed = JSON.parse(dati);

          if (Array.isArray(parsed)) {
            setRapportiArchivio(parsed);
          }
        }
      } catch (e) {
        console.log(
          'Errore caricamento archivio rapporti:',
          e
        );
      }
    })();

    return () => {
      attivo = false;
    };
  }, []);

  React.useEffect(() => {
    let attivo = true;

    (async () => {
      try {
        const chiaviPossibili = [
          'vigilanza_postazioni',
        ];

        let lista = null;

        for (const chiave of chiaviPossibili) {
          const raw = await AsyncStorage.getItem(
            chiave
          );

          if (!raw) continue;

          try {
            const parsed = JSON.parse(raw);

            if (Array.isArray(parsed)) {
              lista = parsed;
              break;
            }
          } catch (_) {}
        }

        if (
          attivo &&
          Array.isArray(lista)
        ) {
          setPostazioniRapporto(lista);
        }
      } catch (e) {
        console.log(
          'Errore caricamento postazioni nel rapporto:',
          e
        );
      }
    })();

    return () => {
      attivo = false;
    };
  }, []);




  const generaRapporto = () => {
    const parti = [];

    parti.push('RAPPORTO DI SERVIZIO');

    if (rapportoData.trim() || rapportoOra.trim()) {
      parti.push(
        `Data: ${rapportoData.trim() || '—'} - Ora: ${rapportoOra.trim() || '—'}`
      );
    }

    if (rapportoLuogo.trim()) {
      parti.push(`Luogo del servizio: ${rapportoLuogo.trim()}`);
    }

    if (rapportoEvento.trim()) {
      parti.push(
        `Evento riscontrato:\n${rapportoEvento.trim()}`
      );
    }

    if (rapportoPersone.trim()) {
      parti.push(
        `Persone coinvolte / presenti:\n${rapportoPersone.trim()}`
      );
    }

    if (rapportoIntervento.trim()) {
      parti.push(
        `Intervento effettuato:\n${rapportoIntervento.trim()}`
      );
    }

    if (rapportoAutorita.trim()) {
      parti.push(
        `Forze dell'Ordine / soccorsi / altri soggetti contattati:\n${rapportoAutorita.trim()}`
      );
    }

    if (rapportoNote.trim()) {
      parti.push(
        `Ulteriori annotazioni:\n${rapportoNote.trim()}`
      );
    }

    return parti.join('\n\n');
  };

  const testoRapporto = generaRapporto();


  const salvaRapportoArchivio = async () => {
    if (!rapportoEvento.trim()) {
      Alert.alert(
        'Rapporto incompleto',
        'Inserisci almeno la descrizione dell’evento.'
      );
      return;
    }

    const nuovo = {
      id: `rapporto_${Date.now()}`,
      data: rapportoData.trim(),
      ora: rapportoOra.trim(),
      luogo: rapportoLuogo.trim(),
      evento: rapportoEvento.trim(),
      persone: rapportoPersone.trim(),
      intervento: rapportoIntervento.trim(),
      autorita: rapportoAutorita.trim(),
      note: rapportoNote.trim(),
      testo: testoRapporto,
      creatoIl: new Date().toISOString(),
    };

    const nuovi = [
      nuovo,
      ...rapportiArchivio,
    ];

    try {
      await AsyncStorage.setItem(
        'vigilanza_rapporti_servizio',
        JSON.stringify(nuovi)
      );

      setRapportiArchivio(nuovi);

      Alert.alert(
        'Rapporto salvato',
        'Il rapporto è stato aggiunto all’archivio.'
      );
    } catch (e) {
      console.log(
        'Errore salvataggio rapporto:',
        e
      );

      Alert.alert(
        'Errore',
        'Non è stato possibile salvare il rapporto.'
      );
    }
  };

  const apriRapportoArchivio = (rapporto) => {
    setRapportoData(
      rapporto?.data || ''
    );

    setRapportoOra(
      rapporto?.ora || ''
    );

    setRapportoLuogo(
      rapporto?.luogo || ''
    );

    setRapportoEvento(
      rapporto?.evento || ''
    );

    setRapportoPersone(
      rapporto?.persone || ''
    );

    setRapportoIntervento(
      rapporto?.intervento || ''
    );

    setRapportoAutorita(
      rapporto?.autorita || ''
    );

    setRapportoNote(
      rapporto?.note || ''
    );
  };

  const eliminaRapportoArchivio = (id) => {
    Alert.alert(
      'Elimina rapporto',
      'Vuoi eliminare definitivamente questo rapporto?',
      [
        {
          text: 'Annulla',
          style: 'cancel',
        },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            const nuovi =
              rapportiArchivio.filter(
                (r) => r.id !== id
              );

            try {
              await AsyncStorage.setItem(
                'vigilanza_rapporti_servizio',
                JSON.stringify(nuovi)
              );

              setRapportiArchivio(nuovi);
            } catch (e) {
              console.log(
                'Errore eliminazione rapporto:',
                e
              );
            }
          },
        },
      ]
    );
  };


  const condividiRapporto = async () => {
    if (!rapportoEvento.trim()) {
      Alert.alert(
        'Rapporto incompleto',
        'Inserisci almeno la descrizione dell’evento.'
      );
      return;
    }

    try {
      await Share.share({
        title: 'Rapporto di servizio',
        message: testoRapporto,
      });
    } catch (e) {
      console.log(
        'Errore condivisione rapporto:',
        e
      );

      Alert.alert(
        'Errore',
        'Non è stato possibile condividere il rapporto.'
      );
    }
  };

  const copiaRapporto = async () => {
    if (!rapportoEvento.trim()) {
      Alert.alert(
        'Rapporto incompleto',
        'Inserisci almeno la descrizione dell’evento.'
      );
      return;
    }

    try {
      await Clipboard.setStringAsync(testoRapporto);

      Alert.alert(
        'Rapporto copiato',
        'Il testo è stato copiato negli appunti.'
      );
    } catch (e) {
      Alert.alert(
        'Errore',
        'Non è stato possibile copiare il rapporto.'
      );
    }
  };

  const pulisciRapporto = () => {
    Alert.alert(
      'Nuovo rapporto',
      'Vuoi cancellare i campi compilati?',
      [
        {
          text: 'Annulla',
          style: 'cancel',
        },
        {
          text: 'Cancella',
          style: 'destructive',
          onPress: () => {
            const ora = new Date();

            setRapportoData(
              [
                String(ora.getDate()).padStart(2, '0'),
                String(ora.getMonth() + 1).padStart(2, '0'),
                ora.getFullYear(),
              ].join('/')
            );

            setRapportoOra(
              `${String(ora.getHours()).padStart(2, '0')}:` +
              `${String(ora.getMinutes()).padStart(2, '0')}`
            );

            setRapportoLuogo('');
            setRapportoEvento('');
            setRapportoPersone('');
            setRapportoIntervento('');
            setRapportoAutorita('');
            setRapportoNote('');
          },
        },
      ]
    );
  };

  const campi = [
    {
      label: 'DATA',
      value: rapportoData,
      setValue: setRapportoData,
      placeholder: '23/08/2026',
      multiline: false,
    },
    {
      label: 'ORA',
      value: rapportoOra,
      setValue: setRapportoOra,
      placeholder: '18:30',
      multiline: false,
    },
    {
      label: 'LUOGO / POSTAZIONE',
      value: rapportoLuogo,
      setValue: setRapportoLuogo,
      placeholder: 'Es. Poste Italiane Fiumicino',
      multiline: false,
    },
    {
      label: 'EVENTO / COSA È SUCCESSO',
      value: rapportoEvento,
      setValue: setRapportoEvento,
      placeholder:
        'Descrivi in ordine cronologico ciò che hai osservato...',
      multiline: true,
    },
    {
      label: 'PERSONE COINVOLTE / PRESENTI',
      value: rapportoPersone,
      setValue: setRapportoPersone,
      placeholder:
        'Indica solamente le informazioni utili al rapporto...',
      multiline: true,
    },
    {
      label: 'INTERVENTO EFFETTUATO',
      value: rapportoIntervento,
      setValue: setRapportoIntervento,
      placeholder:
        'Descrivi cosa hai fatto e quali procedure hai seguito...',
      multiline: true,
    },
    {
      label: "FORZE DELL'ORDINE / SOCCORSI",
      value: rapportoAutorita,
      setValue: setRapportoAutorita,
      placeholder:
        'Es. Sala Operativa avvisata alle 21:15; Carabinieri intervenuti...',
      multiline: true,
    },
    {
      label: 'NOTE FINALI',
      value: rapportoNote,
      setValue: setRapportoNote,
      placeholder:
        'Eventuali ulteriori elementi rilevanti...',
      multiline: true,
    },
  ];

  return (
    <Screen>
      <Back onPress={onBack} />

      <View
        style={{
          marginTop: 8,
          marginBottom: 18,
          padding: 20,

          borderRadius: 27,

          backgroundColor:
            'rgba(17,35,72,0.95)',

          borderWidth: 1,
          borderColor:
            'rgba(115,166,255,0.34)',

          shadowColor: '#75A8FF',
          shadowOpacity: 0.12,
          shadowRadius: 14,
          shadowOffset: {
            width: 0,
            height: 6,
          },
        }}
      >
        <View
          style={{
            width: 50,
            height: 50,
            borderRadius: 16,

            alignItems: 'center',
            justifyContent: 'center',

            backgroundColor:
              'rgba(104,154,255,0.13)',

            borderWidth: 1,
            borderColor:
              'rgba(132,178,255,0.30)',
          }}
        >
          <Ionicons
            name="document-text-outline"
            size={25}
            color="#8EB7FF"
          />
        </View>

        <Text
          style={{
            color: '#91B8FF',
            fontSize: 10.5,
            fontWeight: '900',
            letterSpacing: 1.1,
            marginTop: 15,
          }}
        >
          COMPILAZIONE GUIDATA
        </Text>

        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 29,
            fontWeight: '900',
            marginTop: 4,
          }}
        >
          Rapporto di servizio
        </Text>

        <Text
          style={{
            color: '#9EAECA',
            fontSize: 11.5,
            lineHeight: 18,
            fontWeight: '700',
            marginTop: 7,
          }}
        >
          Inserisci i fatti in modo chiaro e cronologico.
          L’app prepara automaticamente il testo del rapporto.
        </Text>
      </View>


      {postazioniRapporto.length > 0 ? (
        <View
          style={{
            marginBottom: 16,
            padding: 15,

            borderRadius: 20,

            backgroundColor:
              'rgba(9,30,57,0.88)',

            borderWidth: 1,
            borderColor:
              'rgba(91,170,220,0.22)',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 11,
            }}
          >
            <Ionicons
              name="location-outline"
              size={19}
              color="#71DFFF"
            />

            <View
              style={{
                flex: 1,
                marginLeft: 8,
              }}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: '900',
                }}
              >
                Seleziona postazione
              </Text>

              <Text
                style={{
                  color: '#7891A7',
                  fontSize: 9.5,
                  fontWeight: '700',
                  marginTop: 2,
                }}
              >
                Tocca una postazione per compilare il luogo
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
            }}
          >
            {postazioniRapporto.map(
              (postazione) => {
                const nome =
                  postazione?.nome ||
                  postazione?.titolo ||
                  postazione?.zona ||
                  'Postazione';

                const zonaPostazione =
                  postazione?.zona ||
                  postazione?.indirizzo ||
                  '';

                const luogoCompleto =
                  [nome, zonaPostazione]
                    .filter(Boolean)
                    .join(' · ');

                const attiva =
                  rapportoLuogo.trim() ===
                  String(luogoCompleto).trim();

                return (
                  <TouchableOpacity
                    key={
                      postazione?.id ||
                      String(nome)
                    }
                    activeOpacity={0.82}
                    onPress={() =>
                      setRapportoLuogo(
                        String(luogoCompleto)
                      )
                    }
                    style={{
                      minHeight: 42,

                      flexDirection: 'row',
                      alignItems: 'center',

                      marginRight: 8,
                      marginBottom: 8,

                      paddingHorizontal: 11,

                      borderRadius: 14,

                      backgroundColor:
                        attiva
                          ? 'rgba(24,121,159,0.92)'
                          : 'rgba(15,43,72,0.78)',

                      borderWidth: 1,
                      borderColor:
                        attiva
                          ? 'rgba(112,228,255,0.72)'
                          : 'rgba(91,163,199,0.22)',
                    }}
                  >
                    <Ionicons
                      name={
                        attiva
                          ? 'checkmark-circle'
                          : 'location-outline'
                      }
                      size={16}
                      color={
                        attiva
                          ? '#FFFFFF'
                          : '#77CDEB'
                      }
                    />

                    <View
                      style={{
                        marginLeft: 6,
                        maxWidth: 180,
                      }}
                    >
                      <Text
                        style={{
                          color: '#FFFFFF',
                          fontSize: 10.5,
                          fontWeight: '900',
                        }}
                      >
                        {nome}
                      </Text>

                      {zonaPostazione ? (
                        <Text
                          numberOfLines={1}
                          style={{
                            color: attiva
                              ? '#D7F7FF'
                              : '#7799AE',
                            fontSize: 8.5,
                            fontWeight: '700',
                            marginTop: 2,
                          }}
                        >
                          {zonaPostazione}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              }
            )}
          </View>
        </View>
      ) : null}

      {campi.map((campo) => (
        <View
          key={campo.label}
          style={{
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              color: '#91A8C8',
              fontSize: 10.5,
              fontWeight: '900',
              letterSpacing: 0.7,
              marginBottom: 7,
            }}
          >
            {campo.label}
          </Text>

          <TextInput
            value={campo.value}
            onChangeText={campo.setValue}
            placeholder={campo.placeholder}
            placeholderTextColor="#5F748E"
            multiline={campo.multiline}
            textAlignVertical={
              campo.multiline
                ? 'top'
                : 'center'
            }
            returnKeyType={
              campo.multiline
                ? 'default'
                : 'done'
            }
            style={{
              minHeight:
                campo.multiline
                  ? 116
                  : 54,

              color: '#FFFFFF',

              paddingHorizontal: 14,
              paddingVertical:
                campo.multiline
                  ? 13
                  : 10,

              borderRadius: 18,

              backgroundColor:
                'rgba(7,22,47,0.94)',

              borderWidth: 1,
              borderColor:
                'rgba(93,146,201,0.29)',

              fontSize: 13,
              lineHeight: 20,
              fontWeight: '700',
            }}
          />
        </View>
      ))}

      <View
        style={{
          marginTop: 5,
          marginBottom: 16,
          padding: 17,

          borderRadius: 22,

          backgroundColor:
            'rgba(10,28,55,0.92)',

          borderWidth: 1,
          borderColor:
            'rgba(105,157,232,0.26)',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 13,
          }}
        >
          <Ionicons
            name="eye-outline"
            size={20}
            color="#8CB7FF"
          />

          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: '900',
              marginLeft: 8,
            }}
          >
            Anteprima rapporto
          </Text>
        </View>

        <Text
          selectable
          style={{
            color: '#DCE7F8',
            fontSize: 11.5,
            lineHeight: 18,
            fontWeight: '700',
          }}
        >
          {testoRapporto}
        </Text>
      </View>


      <TouchableOpacity
        activeOpacity={0.82}
        onPress={salvaRapportoArchivio}
        style={{
          minHeight: 60,
          marginBottom: 10,

          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',

          borderRadius: 19,

          backgroundColor:
            'rgba(20,132,115,0.96)',

          borderWidth: 1,
          borderColor: '#65E0C8',

          shadowColor: '#56E0C5',
          shadowOpacity: 0.16,
          shadowRadius: 10,
        }}
      >
        <Ionicons
          name="archive-outline"
          size={19}
          color="#FFFFFF"
        />

        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 12,
            fontWeight: '900',
            letterSpacing: 0.6,
            marginLeft: 7,
          }}
        >
          SALVA NELL'ARCHIVIO
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.82}
        onPress={copiaRapporto}
        style={{
          minHeight: 60,

          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',

          borderRadius: 19,

          backgroundColor:
            'rgba(36,111,215,0.96)',

          borderWidth: 1,
          borderColor: '#78B6FF',

          shadowColor: '#58AFFF',
          shadowOpacity: 0.18,
          shadowRadius: 10,
        }}
      >
        <Ionicons
          name="copy-outline"
          size={19}
          color="#FFFFFF"
        />

        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 12,
            fontWeight: '900',
            letterSpacing: 0.6,
            marginLeft: 7,
          }}
        >
          COPIA RAPPORTO
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.82}
        onPress={condividiRapporto}
        style={{
          minHeight: 60,
          marginTop: 10,

          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',

          borderRadius: 19,

          backgroundColor:
            'rgba(47,67,126,0.96)',

          borderWidth: 1,
          borderColor:
            'rgba(132,167,255,0.72)',

          shadowColor: '#789CFF',
          shadowOpacity: 0.14,
          shadowRadius: 9,
        }}
      >
        <Ionicons
          name="share-outline"
          size={20}
          color="#FFFFFF"
        />

        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 12,
            fontWeight: '900',
            letterSpacing: 0.6,
            marginLeft: 7,
          }}
        >
          CONDIVIDI RAPPORTO
        </Text>
      </TouchableOpacity>


      <TouchableOpacity
        activeOpacity={0.82}
        onPress={pulisciRapporto}
        style={{
          minHeight: 49,
          marginTop: 10,
          marginBottom: 18,

          alignItems: 'center',
          justifyContent: 'center',

          borderRadius: 17,

          backgroundColor:
            'rgba(51,61,83,0.48)',

          borderWidth: 1,
          borderColor:
            'rgba(126,145,174,0.20)',
        }}
      >
        <Text
          style={{
            color: '#AAB7C9',
            fontSize: 10,
            fontWeight: '900',
            letterSpacing: 0.5,
          }}
        >
          NUOVO RAPPORTO
        </Text>
      </TouchableOpacity>


      <View
        style={{
          marginTop: 8,
          marginBottom: 18,
          padding: 16,

          borderRadius: 22,

          backgroundColor:
            'rgba(9,27,53,0.90)',

          borderWidth: 1,
          borderColor:
            'rgba(96,145,215,0.22)',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 13,
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,

              alignItems: 'center',
              justifyContent: 'center',

              backgroundColor:
                'rgba(95,142,219,0.12)',
            }}
          >
            <Ionicons
              name="archive-outline"
              size={20}
              color="#8EB7FF"
            />
          </View>

          <View
            style={{
              flex: 1,
              marginLeft: 10,
            }}
          >
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: '900',
              }}
            >
              Archivio rapporti
            </Text>

            <Text
              style={{
                color: '#7E94B2',
                fontSize: 10,
                fontWeight: '700',
                marginTop: 2,
              }}
            >
              {rapportiArchivio.length}
              {' '}
              {rapportiArchivio.length === 1
                ? 'rapporto salvato'
                : 'rapporti salvati'}
            </Text>
          </View>
        </View>

        {rapportiArchivio.length === 0 ? (
          <View
            style={{
              padding: 13,

              borderRadius: 16,

              backgroundColor:
                'rgba(11,30,57,0.58)',
            }}
          >
            <Text
              style={{
                color: '#7188A4',
                fontSize: 10.5,
                lineHeight: 16,
                fontWeight: '700',
              }}
            >
              Nessun rapporto archiviato.
              Salva il primo rapporto per ritrovarlo qui.
            </Text>
          </View>
        ) : (
          rapportiArchivio.map(
            (rapporto) => (
              <TouchableOpacity
                key={rapporto.id}
                activeOpacity={0.82}
                onPress={() =>
                  apriRapportoArchivio(rapporto)
                }
                style={{
                  minHeight: 76,
                  marginBottom: 9,

                  paddingHorizontal: 13,
                  paddingVertical: 11,

                  flexDirection: 'row',
                  alignItems: 'center',

                  borderRadius: 18,

                  backgroundColor:
                    'rgba(12,37,70,0.84)',

                  borderWidth: 1,
                  borderColor:
                    'rgba(95,153,218,0.20)',
                }}
              >
                <View
                  style={{
                    width: 43,
                    height: 43,
                    borderRadius: 14,

                    alignItems: 'center',
                    justifyContent: 'center',

                    backgroundColor:
                      'rgba(84,141,214,0.12)',
                  }}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={20}
                    color="#87B5FF"
                  />
                </View>

                <View
                  style={{
                    flex: 1,
                    marginLeft: 11,
                  }}
                >
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 12,
                      fontWeight: '900',
                    }}
                  >
                    {rapporto.luogo ||
                      'Rapporto di servizio'}
                  </Text>

                  <Text
                    style={{
                      color: '#8BA0BA',
                      fontSize: 9.5,
                      fontWeight: '800',
                      marginTop: 4,
                    }}
                  >
                    {[
                      rapporto.data,
                      rapporto.ora,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>

                  <Text
                    numberOfLines={1}
                    style={{
                      color: '#607994',
                      fontSize: 9,
                      fontWeight: '700',
                      marginTop: 3,
                    }}
                  >
                    {rapporto.evento}
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.78}
                  onPress={() =>
                    eliminaRapportoArchivio(
                      rapporto.id
                    )
                  }
                  style={{
                    width: 37,
                    height: 37,

                    alignItems: 'center',
                    justifyContent: 'center',

                    borderRadius: 12,

                    backgroundColor:
                      'rgba(87,31,42,0.48)',
                  }}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color="#FF8D99"
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            )
          )
        )}
      </View>

      <View
        style={{
          marginBottom: 20,
          padding: 13,

          flexDirection: 'row',

          borderRadius: 17,

          backgroundColor:
            'rgba(45,38,22,0.46)',

          borderWidth: 1,
          borderColor:
            'rgba(220,177,92,0.16)',
        }}
      >
        <Ionicons
          name="information-circle-outline"
          size={17}
          color="#D2AA65"
        />

        <Text
          style={{
            flex: 1,
            marginLeft: 8,

            color: '#A39478',
            fontSize: 9,
            lineHeight: 15,
            fontWeight: '700',
          }}
        >
          Il rapporto deve descrivere fatti osservati e
          attività realmente svolte. Verifica sempre il testo
          prima dell’utilizzo e segui le procedure aziendali.
        </Text>
      </View>
    </Screen>
  );
}



/* =========================================================
   CONSEGNE SERVIZIO V1
   ========================================================= */
function ConsegneServizioScreen({
  onBack,
  postazioni = [],
  colleghi = [],
}) {
  const oraCorrente = new Date();

  const formattaData = (d) =>
    [
      String(d.getDate()).padStart(2, '0'),
      String(d.getMonth() + 1).padStart(2, '0'),
      d.getFullYear(),
    ].join('/');

  const formattaOra = (d) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes()
    ).padStart(2, '0')}`;

  const [consegnaData, setConsegnaData] =
    React.useState(formattaData(oraCorrente));

  const [consegnaOra, setConsegnaOra] =
    React.useState(formattaOra(oraCorrente));

  const [consegnaPostazione, setConsegnaPostazione] =
    React.useState('');

  const [consegnaAccaduto, setConsegnaAccaduto] =
    React.useState('');

  const [consegnaDaFare, setConsegnaDaFare] =
    React.useState('');

  const [consegnaAnomalie, setConsegnaAnomalie] =
    React.useState('');

  const [consegnaChiavi, setConsegnaChiavi] =
    React.useState('');

  const [consegnaApparati, setConsegnaApparati] =
    React.useState('');

  const [consegnaNote, setConsegnaNote] =
    React.useState('');

  const [archivioConsegne, setArchivioConsegne] =
    React.useState([]);

  const [mostraColleghiConsegna, setMostraColleghiConsegna] =
    React.useState(false);

  const [invioConsegnaInCorso, setInvioConsegnaInCorso] =
    React.useState(false);

  const colleghiAccettatiConsegna =
    Array.isArray(colleghi)
      ? colleghi.filter(
          (c) => c?.stato === 'accettato'
        )
      : [];


  React.useEffect(() => {
    let attivo = true;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(
          'vigilanza_consegne_servizio'
        );

        if (!raw) return;

        const parsed = JSON.parse(raw);

        if (
          attivo &&
          Array.isArray(parsed)
        ) {
          setArchivioConsegne(parsed);
        }
      } catch (e) {
        console.log(
          'Errore caricamento consegne:',
          e
        );
      }
    })();

    return () => {
      attivo = false;
    };
  }, []);

  const testoConsegna = (() => {
    const parti = [];

    parti.push('CONSEGNE DI SERVIZIO');

    parti.push(
      `Data: ${consegnaData || '—'} - Ora: ${consegnaOra || '—'}`
    );

    if (consegnaPostazione.trim()) {
      parti.push(
        `Postazione: ${consegnaPostazione.trim()}`
      );
    }

    if (consegnaAccaduto.trim()) {
      parti.push(
        `EVENTI DEL TURNO\n${consegnaAccaduto.trim()}`
      );
    }

    if (consegnaDaFare.trim()) {
      parti.push(
        `ATTIVITÀ DA COMPLETARE\n${consegnaDaFare.trim()}`
      );
    }

    if (consegnaAnomalie.trim()) {
      parti.push(
        `ANOMALIE / PROBLEMI\n${consegnaAnomalie.trim()}`
      );
    }

    if (consegnaChiavi.trim()) {
      parti.push(
        `CHIAVI / MATERIALI\n${consegnaChiavi.trim()}`
      );
    }

    if (consegnaApparati.trim()) {
      parti.push(
        `MEZZI / APPARATI\n${consegnaApparati.trim()}`
      );
    }

    if (consegnaNote.trim()) {
      parti.push(
        `NOTE PER IL COLLEGA SUCCESSIVO\n${consegnaNote.trim()}`
      );
    }

    return parti.join('\n\n');
  })();

  const resetConsegna = () => {
    const ora = new Date();

    setConsegnaData(formattaData(ora));
    setConsegnaOra(formattaOra(ora));
    setConsegnaPostazione('');
    setConsegnaAccaduto('');
    setConsegnaDaFare('');
    setConsegnaAnomalie('');
    setConsegnaChiavi('');
    setConsegnaApparati('');
    setConsegnaNote('');
  };

  const salvaConsegna = async () => {
    if (
      !consegnaPostazione.trim() &&
      !consegnaAccaduto.trim() &&
      !consegnaDaFare.trim() &&
      !consegnaNote.trim()
    ) {
      Alert.alert(
        'Consegna vuota',
        'Inserisci almeno una informazione utile.'
      );
      return;
    }

    const nuova = {
      id: `consegna_${Date.now()}`,
      data: consegnaData,
      ora: consegnaOra,
      postazione: consegnaPostazione.trim(),
      accaduto: consegnaAccaduto.trim(),
      daFare: consegnaDaFare.trim(),
      anomalie: consegnaAnomalie.trim(),
      chiavi: consegnaChiavi.trim(),
      apparati: consegnaApparati.trim(),
      note: consegnaNote.trim(),
      testo: testoConsegna,
      creatoIl: new Date().toISOString(),
    };

    const nuove = [
      nuova,
      ...archivioConsegne,
    ];

    try {
      await AsyncStorage.setItem(
        'vigilanza_consegne_servizio',
        JSON.stringify(nuove)
      );

      setArchivioConsegne(nuove);

      Alert.alert(
        'Consegna salvata',
        'Le informazioni sono state archiviate.'
      );
    } catch (e) {
      Alert.alert(
        'Errore',
        'Non è stato possibile salvare la consegna.'
      );
    }
  };

  const apriConsegna = (c) => {
    setConsegnaData(c?.data || '');
    setConsegnaOra(c?.ora || '');
    setConsegnaPostazione(c?.postazione || '');
    setConsegnaAccaduto(c?.accaduto || '');
    setConsegnaDaFare(c?.daFare || '');
    setConsegnaAnomalie(c?.anomalie || '');
    setConsegnaChiavi(c?.chiavi || '');
    setConsegnaApparati(c?.apparati || '');
    setConsegnaNote(c?.note || '');
  };

  const eliminaConsegna = (id) => {
    Alert.alert(
      'Elimina consegna',
      'Vuoi eliminare definitivamente questa consegna?',
      [
        {
          text: 'Annulla',
          style: 'cancel',
        },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            const nuove =
              archivioConsegne.filter(
                (c) => c.id !== id
              );

            await AsyncStorage.setItem(
              'vigilanza_consegne_servizio',
              JSON.stringify(nuove)
            );

            setArchivioConsegne(nuove);
          },
        },
      ]
    );
  };

  const copiaConsegna = async () => {
    await Clipboard.setStringAsync(
      testoConsegna
    );

    Alert.alert(
      'Consegna copiata',
      'Il testo è stato copiato negli appunti.'
    );
  };

  const inviaConsegnaACollega = async (collega) => {
    const destinatarioId =
      collega?.altro_user_id;

    if (!destinatarioId) {
      Alert.alert(
        'Collega non disponibile',
        'Non è stato possibile identificare il destinatario.'
      );
      return;
    }

    if (
      !consegnaPostazione.trim() &&
      !consegnaAccaduto.trim() &&
      !consegnaDaFare.trim() &&
      !consegnaNote.trim()
    ) {
      Alert.alert(
        'Consegna vuota',
        'Inserisci almeno una informazione utile.'
      );
      return;
    }

    try {
      setInvioConsegnaInCorso(true);

      const messaggio =
        `📋 CONSEGNA DI SERVIZIO\n\n${testoConsegna}`;

      await inviaMessaggio(
        destinatarioId,
        messaggio
      );

      setMostraColleghiConsegna(false);

      Alert.alert(
        'Consegna inviata',
        'La consegna è stata inviata nella chat privata del collega.'
      );
    } catch (e) {
      console.log(
        'Errore invio consegna:',
        e
      );

      Alert.alert(
        'Errore',
        'Non è stato possibile inviare la consegna.'
      );
    } finally {
      setInvioConsegnaInCorso(false);
    }
  };

  const campi = [
    {
      label: 'EVENTI DEL TURNO',
      value: consegnaAccaduto,
      setValue: setConsegnaAccaduto,
      placeholder:
        'Cosa è successo durante il turno...',
    },
    {
      label: 'ATTIVITÀ DA COMPLETARE',
      value: consegnaDaFare,
      setValue: setConsegnaDaFare,
      placeholder:
        'Cosa deve ancora essere fatto...',
    },
    {
      label: 'ANOMALIE / PROBLEMI',
      value: consegnaAnomalie,
      setValue: setConsegnaAnomalie,
      placeholder:
        'Guasti, accessi, situazioni da controllare...',
    },
    {
      label: 'CHIAVI / MATERIALI',
      value: consegnaChiavi,
      setValue: setConsegnaChiavi,
      placeholder:
        'Chiavi, badge o materiali da riconsegnare...',
    },
    {
      label: 'MEZZI / APPARATI',
      value: consegnaApparati,
      setValue: setConsegnaApparati,
      placeholder:
        'Radio, telefono, veicolo o altri apparati...',
    },
    {
      label: 'NOTE PER IL COLLEGA SUCCESSIVO',
      value: consegnaNote,
      setValue: setConsegnaNote,
      placeholder:
        'Informazioni importanti da ricordare...',
    },
  ];

  return (
    <Screen>
      <Back onPress={onBack} />

      <View
        style={{
          marginTop: 8,
          marginBottom: 18,
          padding: 20,
          borderRadius: 27,

          backgroundColor:
            'rgba(13,49,62,0.94)',

          borderWidth: 1,
          borderColor:
            'rgba(93,229,200,0.38)',

          shadowColor: '#57E2C7',
          shadowOpacity: 0.12,
          shadowRadius: 14,
          shadowOffset: {
            width: 0,
            height: 6,
          },
        }}
      >
        <View
          style={{
            width: 50,
            height: 50,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor:
              'rgba(77,213,188,0.14)',
          }}
        >
          <Ionicons
            name="clipboard-outline"
            size={25}
            color="#72E8CF"
          />
        </View>

        <Text
          style={{
            color: '#71E5CC',
            fontSize: 10.5,
            fontWeight: '900',
            letterSpacing: 1.1,
            marginTop: 15,
          }}
        >
          PASSAGGIO CONSEGNE
        </Text>

        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 29,
            fontWeight: '900',
            marginTop: 4,
          }}
        >
          Consegne di servizio
        </Text>

        <Text
          style={{
            color: '#9CBDB7',
            fontSize: 11.5,
            lineHeight: 18,
            fontWeight: '700',
            marginTop: 7,
          }}
        >
          Lascia al collega successivo le informazioni
          realmente utili per proseguire il servizio.
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          marginBottom: 15,
        }}
      >
        <View
          style={{
            flex: 1,
            marginRight: 5,
          }}
        >
          <Text
            style={{
              color: '#91ADA8',
              fontSize: 10,
              fontWeight: '900',
              marginBottom: 6,
            }}
          >
            DATA
          </Text>

          <TextInput
            value={consegnaData}
            onChangeText={setConsegnaData}
            style={{
              minHeight: 54,
              color: '#FFFFFF',
              paddingHorizontal: 13,
              borderRadius: 17,
              backgroundColor:
                'rgba(7,29,45,0.94)',
              borderWidth: 1,
              borderColor:
                'rgba(83,184,173,0.27)',
              fontSize: 13,
              fontWeight: '800',
            }}
          />
        </View>

        <View
          style={{
            flex: 1,
            marginLeft: 5,
          }}
        >
          <Text
            style={{
              color: '#91ADA8',
              fontSize: 10,
              fontWeight: '900',
              marginBottom: 6,
            }}
          >
            ORA
          </Text>

          <TextInput
            value={consegnaOra}
            onChangeText={setConsegnaOra}
            style={{
              minHeight: 54,
              color: '#FFFFFF',
              paddingHorizontal: 13,
              borderRadius: 17,
              backgroundColor:
                'rgba(7,29,45,0.94)',
              borderWidth: 1,
              borderColor:
                'rgba(83,184,173,0.27)',
              fontSize: 13,
              fontWeight: '800',
            }}
          />
        </View>
      </View>

      {Array.isArray(postazioni) &&
      postazioni.length > 0 ? (
        <View
          style={{
            marginBottom: 16,
            padding: 15,
            borderRadius: 20,
            backgroundColor:
              'rgba(9,38,51,0.88)',
            borderWidth: 1,
            borderColor:
              'rgba(82,199,182,0.24)',
          }}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 12,
              fontWeight: '900',
              marginBottom: 10,
            }}
          >
            📍 Postazione
          </Text>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
            }}
          >
            {postazioni.map((p) => {
              const nome =
                p?.nome ||
                p?.titolo ||
                'Postazione';

              const zona =
                p?.zona ||
                p?.indirizzo ||
                '';

              const completo =
                [nome, zona]
                  .filter(Boolean)
                  .join(' · ');

              const attiva =
                consegnaPostazione === completo;

              return (
                <TouchableOpacity
                  key={p?.id || completo}
                  activeOpacity={0.82}
                  onPress={() =>
                    setConsegnaPostazione(
                      completo
                    )
                  }
                  style={{
                    minHeight: 43,
                    marginRight: 8,
                    marginBottom: 8,
                    paddingHorizontal: 12,
                    justifyContent: 'center',
                    borderRadius: 14,

                    backgroundColor:
                      attiva
                        ? 'rgba(23,137,120,0.94)'
                        : 'rgba(15,55,67,0.78)',

                    borderWidth: 1,
                    borderColor:
                      attiva
                        ? '#74E8D0'
                        : 'rgba(89,190,174,0.22)',
                  }}
                >
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 10.5,
                      fontWeight: '900',
                    }}
                  >
                    {nome}
                  </Text>

                  {zona ? (
                    <Text
                      style={{
                        color: '#8BB8B0',
                        fontSize: 8.5,
                        fontWeight: '700',
                        marginTop: 2,
                      }}
                    >
                      {zona}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      <View
        style={{
          marginBottom: 16,
        }}
      >
        <Text
          style={{
            color: '#91ADA8',
            fontSize: 10.5,
            fontWeight: '900',
            marginBottom: 7,
          }}
        >
          POSTAZIONE / LUOGO
        </Text>

        <TextInput
          value={consegnaPostazione}
          onChangeText={setConsegnaPostazione}
          placeholder="Es. Poste Italiane Fiumicino"
          placeholderTextColor="#607B80"
          style={{
            minHeight: 54,
            color: '#FFFFFF',
            paddingHorizontal: 14,
            borderRadius: 18,
            backgroundColor:
              'rgba(7,29,45,0.94)',
            borderWidth: 1,
            borderColor:
              'rgba(83,184,173,0.27)',
            fontSize: 13,
            fontWeight: '800',
          }}
        />
      </View>

      {campi.map((campo) => (
        <View
          key={campo.label}
          style={{
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              color: '#91ADA8',
              fontSize: 10.5,
              fontWeight: '900',
              letterSpacing: 0.6,
              marginBottom: 7,
            }}
          >
            {campo.label}
          </Text>

          <TextInput
            value={campo.value}
            onChangeText={campo.setValue}
            placeholder={campo.placeholder}
            placeholderTextColor="#607B80"
            multiline
            textAlignVertical="top"
            style={{
              minHeight: 110,
              color: '#FFFFFF',
              paddingHorizontal: 14,
              paddingVertical: 13,
              borderRadius: 18,
              backgroundColor:
                'rgba(7,29,45,0.94)',
              borderWidth: 1,
              borderColor:
                'rgba(83,184,173,0.27)',
              fontSize: 13,
              lineHeight: 20,
              fontWeight: '700',
            }}
          />
        </View>
      ))}

      <View
        style={{
          marginBottom: 16,
          padding: 17,
          borderRadius: 22,
          backgroundColor:
            'rgba(9,37,49,0.92)',
          borderWidth: 1,
          borderColor:
            'rgba(86,197,180,0.24)',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Ionicons
            name="eye-outline"
            size={20}
            color="#72E8CF"
          />

          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: '900',
              marginLeft: 8,
            }}
          >
            Anteprima consegna
          </Text>
        </View>

        <Text
          selectable
          style={{
            color: '#D8ECE8',
            fontSize: 11.5,
            lineHeight: 18,
            fontWeight: '700',
          }}
        >
          {testoConsegna}
        </Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.82}
        onPress={salvaConsegna}
        style={{
          minHeight: 60,
          marginBottom: 10,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 19,
          backgroundColor:
            'rgba(20,143,121,0.96)',
          borderWidth: 1,
          borderColor: '#71E6CF',
        }}
      >
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 12,
            fontWeight: '900',
          }}
        >
          💾 SALVA CONSEGNA
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.82}
        onPress={copiaConsegna}
        style={{
          minHeight: 56,
          marginBottom: 10,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 18,
          backgroundColor:
            'rgba(29,91,151,0.92)',
          borderWidth: 1,
          borderColor:
            'rgba(111,181,244,0.60)',
        }}
      >
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 11.5,
            fontWeight: '900',
          }}
        >
          📋 COPIA CONSEGNA
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => {
          if (colleghiAccettatiConsegna.length === 0) {
            Alert.alert(
              'Nessun collega disponibile',
              'Devi avere almeno un collega accettato per poter inviare una consegna.'
            );
            return;
          }

          setMostraColleghiConsegna(
            !mostraColleghiConsegna
          );
        }}
        style={{
          minHeight: 56,
          marginBottom: 10,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 18,
          backgroundColor:
            'rgba(53,67,129,0.92)',
          borderWidth: 1,
          borderColor:
            'rgba(135,158,255,0.56)',
        }}
      >
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 11.5,
            fontWeight: '900',
          }}
        >
          📨 INVIA A COLLEGA
        </Text>
      </TouchableOpacity>

      {mostraColleghiConsegna ? (
        <View
          style={{
            marginBottom: 16,
            padding: 14,
            borderRadius: 20,
            backgroundColor:
              'rgba(10,29,56,0.94)',
            borderWidth: 1,
            borderColor:
              'rgba(107,142,224,0.28)',
          }}
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 12,
              fontWeight: '900',
              marginBottom: 4,
            }}
          >
            Scegli il collega
          </Text>

          <Text
            style={{
              color: '#8294B5',
              fontSize: 9.5,
              fontWeight: '700',
              marginBottom: 12,
            }}
          >
            Sono mostrati solo i colleghi già accettati.
          </Text>

          {colleghiAccettatiConsegna.map(
            (c) => {
              const p = c?.profilo || {};

              const nome =
                [p?.nome, p?.cognome]
                  .filter(Boolean)
                  .join(' ') ||
                'Collega';

              return (
                <TouchableOpacity
                  key={
                    c?.id ||
                    c?.altro_user_id
                  }
                  activeOpacity={0.82}
                  disabled={invioConsegnaInCorso}
                  onPress={() =>
                    inviaConsegnaACollega(c)
                  }
                  style={{
                    minHeight: 58,
                    marginBottom: 8,
                    paddingHorizontal: 12,

                    flexDirection: 'row',
                    alignItems: 'center',

                    borderRadius: 17,

                    backgroundColor:
                      'rgba(18,43,80,0.88)',

                    borderWidth: 1,
                    borderColor:
                      'rgba(97,143,214,0.22)',
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,

                      alignItems: 'center',
                      justifyContent: 'center',

                      backgroundColor:
                        'rgba(87,146,220,0.15)',
                    }}
                  >
                    <Ionicons
                      name="person-outline"
                      size={18}
                      color="#8EC8FF"
                    />
                  </View>

                  <View
                    style={{
                      flex: 1,
                      marginLeft: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: '#FFFFFF',
                        fontSize: 11.5,
                        fontWeight: '900',
                      }}
                    >
                      {nome}
                    </Text>

                    <Text
                      style={{
                        color: '#7890AE',
                        fontSize: 9,
                        fontWeight: '700',
                        marginTop: 3,
                      }}
                    >
                      {[
                        p?.azienda,
                        p?.sede,
                      ]
                        .filter(Boolean)
                        .join(' · ') ||
                        'Collega collegato'}
                    </Text>
                  </View>

                  <Ionicons
                    name="send-outline"
                    size={18}
                    color="#78C8FF"
                  />
                </TouchableOpacity>
              );
            }
          )}
        </View>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.82}
        onPress={resetConsegna}
        style={{
          minHeight: 48,
          marginBottom: 19,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 17,
          backgroundColor:
            'rgba(55,67,77,0.48)',
          borderWidth: 1,
          borderColor:
            'rgba(130,151,158,0.20)',
        }}
      >
        <Text
          style={{
            color: '#ABC0BC',
            fontSize: 10,
            fontWeight: '900',
          }}
        >
          NUOVA CONSEGNA
        </Text>
      </TouchableOpacity>

      <View
        style={{
          marginBottom: 20,
          padding: 16,
          borderRadius: 22,
          backgroundColor:
            'rgba(8,31,43,0.90)',
          borderWidth: 1,
          borderColor:
            'rgba(85,185,171,0.20)',
        }}
      >
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: '900',
          }}
        >
          Archivio consegne
        </Text>

        <Text
          style={{
            color: '#789A94',
            fontSize: 10,
            fontWeight: '700',
            marginTop: 3,
            marginBottom: 12,
          }}
        >
          {archivioConsegne.length}
          {' '}
          {archivioConsegne.length === 1
            ? 'consegna salvata'
            : 'consegne salvate'}
        </Text>

        {archivioConsegne.length === 0 ? (
          <Text
            style={{
              color: '#718B87',
              fontSize: 10.5,
              lineHeight: 16,
              fontWeight: '700',
            }}
          >
            Nessuna consegna archiviata.
          </Text>
        ) : (
          archivioConsegne.map((c) => (
            <TouchableOpacity
              key={c.id}
              activeOpacity={0.82}
              onPress={() =>
                apriConsegna(c)
              }
              style={{
                minHeight: 70,
                marginBottom: 8,
                padding: 12,
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 17,
                backgroundColor:
                  'rgba(12,48,60,0.82)',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 11.5,
                    fontWeight: '900',
                  }}
                >
                  {c.postazione ||
                    'Consegna di servizio'}
                </Text>

                <Text
                  style={{
                    color: '#82A29D',
                    fontSize: 9,
                    fontWeight: '800',
                    marginTop: 4,
                  }}
                >
                  {[c.data, c.ora]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>

                <Text
                  numberOfLines={1}
                  style={{
                    color: '#65827D',
                    fontSize: 9,
                    fontWeight: '700',
                    marginTop: 3,
                  }}
                >
                  {c.note ||
                    c.daFare ||
                    c.accaduto ||
                    'Nessuna nota'}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.78}
                onPress={() =>
                  eliminaConsegna(c.id)
                }
                style={{
                  width: 37,
                  height: 37,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 12,
                  backgroundColor:
                    'rgba(88,31,41,0.50)',
                }}
              >
                <Ionicons
                  name="trash-outline"
                  size={16}
                  color="#FF8E99"
                />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View
        style={{
          marginBottom: 20,
          padding: 13,
          flexDirection: 'row',
          borderRadius: 17,
          backgroundColor:
            'rgba(45,38,22,0.46)',
          borderWidth: 1,
          borderColor:
            'rgba(220,177,92,0.16)',
        }}
      >
        <Ionicons
          name="lock-closed-outline"
          size={17}
          color="#D2AA65"
        />

        <Text
          style={{
            flex: 1,
            marginLeft: 8,
            color: '#A39478',
            fontSize: 9,
            lineHeight: 15,
            fontWeight: '700',
          }}
        >
          Evita di inserire PIN, password, codici di allarme
          o altre credenziali sensibili nelle consegne.
        </Text>
      </View>
    </Screen>
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
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={true}
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


      


      <KeyboardDoneOverlay />
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
  profile = false,
}) {
  return (
    <View
      style={[styles.fieldWrap, profile && styles.profileFieldWrap]}
    >
      <Text
        style={[styles.label, profile && styles.profileFieldLabel]}
      >
        {label}
      </Text>

      <TextInput
        style={[styles.input, profile && styles.profileFieldInput]}
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
    minHeight: 58,
    borderRadius: 22,

    marginTop: 24,
    marginBottom: 10,

    backgroundColor: '#1763D8',

    borderWidth: 1.5,
    borderColor: '#63E7FF',

    alignItems: 'center',
    justifyContent: 'center',

    shadowColor: '#54E4FF',
    shadowOpacity: 0.48,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 },

    elevation: 9,
  },

    saveText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',

    textShadowColor: 'rgba(93,235,255,0.50)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
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
    backgroundColor: 'rgba(30, 39, 104, 0.92)',
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: 'center',
    marginBottom: 24,

    borderWidth: 1.3,
    borderColor: '#756CFF',

    shadowColor: '#7367FF',
    shadowOpacity: 0.42,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 7 },

    elevation: 10,
    },

    profileAvatar: {
    width: 118,
    height: 118,
    borderRadius: 59,

    backgroundColor: '#17355A',

    borderWidth: 2.2,
    borderColor: '#62E8FF',

    alignItems: 'center',
    justifyContent: 'center',

    shadowColor: '#56E6FF',
    shadowOpacity: 0.70,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },

    elevation: 10,
    },

    profileAvatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    },

    profileAvatarText: {
    color: '#ECFDFF',
    fontSize: 31,
    fontWeight: '900',

    textShadowColor: '#59E8FF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    },

    cameraBadge: {
    position: 'absolute',
    right: -3,
    bottom: 2,

    width: 32,
    height: 32,
    borderRadius: 16,

    backgroundColor: '#262D70',

    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 1.5,
    borderColor: '#74EBFF',

    shadowColor: '#5DEAFF',
    shadowOpacity: 0.60,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
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
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 25,
    marginTop: 13,
    textAlign: 'center',
    letterSpacing: -0.5,

    textShadowColor: 'rgba(92,235,255,0.32)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    },

    profileRole: {
    color: '#B5CBE1',
    marginTop: 5,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.1,
    },

    companyBadge: {
    backgroundColor: 'rgba(58, 78, 174, 0.72)',

    borderRadius: 15,

    paddingHorizontal: 15,
    paddingVertical: 8,

    marginTop: 14,

    borderWidth: 1,
    borderColor: '#638FEF',

    shadowColor: '#5CEAFF',
    shadowOpacity: 0.16,
    shadowRadius: 8,
  },

    companyBadgeText: {
    color: '#BDEEFF',
    fontWeight: '900',
    letterSpacing: 0.25,
  },

    profileSectionTitle: {
    color: '#8FE8FF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.25,
    marginTop: 10,
    marginBottom: 13,

    textShadowColor: 'rgba(92,235,255,0.22)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },

    profileFieldWrap: {
    marginBottom: 18,
  },

  profileFieldLabel: {
    color: '#8FE8FF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.15,
    marginBottom: 8,

    textShadowColor: 'rgba(92,235,255,0.28)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 7,
  },

  profileFieldInput: {
    backgroundColor: 'rgba(25, 31, 78, 0.90)',

    borderWidth: 1.25,
    borderColor: '#65DFF5',

    borderRadius: 21,

    paddingVertical: 16,
    paddingHorizontal: 17,

    color: '#FFFFFF',

    fontSize: 15,
    fontWeight: '700',

    shadowColor: '#58E4FF',
    shadowOpacity: 0.18,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 4 },

    elevation: 4,
  },

  roleRow: {
      flexDirection:
        'row',
      marginBottom: 18,
    },

    roleButton: {
    flex: 1,
    minHeight: 82,

    backgroundColor: 'rgba(25, 29, 70, 0.82)',

    borderWidth: 1.15,
    borderColor: '#3A477D',

    borderRadius: 22,

    paddingVertical: 13,
    paddingHorizontal: 8,

    marginHorizontal: 5,

    justifyContent: 'center',
    alignItems: 'center',

    shadowColor: '#766CFF',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },

    roleButtonActive: {
    backgroundColor: '#21458B',

    borderColor: '#65E5FF',
    borderWidth: 1.6,

    shadowColor: '#5CEAFF',
    shadowOpacity: 0.48,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 5 },

    elevation: 7,
  },

    roleButtonText: {
    color: '#9AAFC8',
    fontWeight: '900',
    fontSize: 12,
    textAlign: 'center',
    letterSpacing: 0.15,
  },

    roleButtonTextActive: {
    color: '#FFFFFF',

    textShadowColor: '#62E8FF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 7,
  },

    roleDescription: {
    color: '#8097B0',
    fontSize: 9,
    marginTop: 5,
    textAlign: 'center',
    fontWeight: '600',
  },

    removePhotoButton: {
    alignSelf: 'center',

    marginTop: 18,
    marginBottom: 8,

    paddingVertical: 10,
    paddingHorizontal: 16,

    borderRadius: 16,

    backgroundColor: 'rgba(255, 91, 116, 0.07)',

    borderWidth: 1,
    borderColor: 'rgba(255, 110, 132, 0.24)',

    alignItems: 'center',
    justifyContent: 'center',
  },

    removePhotoText: {
    color: '#FF98A9',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.35,
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
