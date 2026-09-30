import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  PROMEMORIA_RAPIDI_MINUTI,
  normalizzaPromemoria,
} from './agendaPersonale';
import { etichettaPromemoria } from './promemoriaPersonali';

const VIOLA = '#B68CFF';
const VIOLA_CHIARO = '#DCC8FF';
const SFONDO = '#081326';

const pad2 = (n) => String(n).padStart(2, '0');
const dataTesto = (anno, mese, giorno) => `${pad2(giorno)}/${pad2(mese)}/${anno}`;

function parseData(testo) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(testo || '').trim());
  if (!match) return null;
  const giorno = Number(match[1]);
  const mese = Number(match[2]);
  const anno = Number(match[3]);
  const data = new Date(anno, mese - 1, giorno, 12, 0, 0);
  if (data.getFullYear() !== anno || data.getMonth() !== mese - 1 || data.getDate() !== giorno) return null;
  return { anno, mese, giorno };
}

function Campo({ label, value, onChangeText, placeholder, multiline = false, keyboardType }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: '#8FA5CC', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginBottom: 7 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#5E7595"
        multiline={multiline}
        keyboardType={keyboardType}
        style={{
          minHeight: multiline ? 88 : 50,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: 'rgba(182,140,255,0.34)',
          backgroundColor: 'rgba(19,31,55,0.92)',
          color: '#FFFFFF',
          paddingHorizontal: 14,
          paddingVertical: multiline ? 12 : 0,
          textAlignVertical: multiline ? 'top' : 'center',
          fontSize: 15,
          fontWeight: '700',
        }}
      />
    </View>
  );
}

export function SceltaAgendaModal({ visible, onClose, onTurno, onPersonale }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(2,8,18,0.72)', justifyContent: 'flex-end' }}>
        <TouchableOpacity activeOpacity={1} style={{ backgroundColor: '#09172B', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 18, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 34 : 22, borderWidth: 1, borderColor: 'rgba(111,232,255,0.18)' }}>
          <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: '#314766', alignSelf: 'center', marginBottom: 18 }} />
          <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '900' }}>Cosa vuoi aggiungere?</Text>
          <Text style={{ color: '#8198B8', fontSize: 12, marginTop: 5, marginBottom: 17 }}>Lavoro e vita personale, nello stesso calendario.</Text>

          <TouchableOpacity onPress={onTurno} activeOpacity={0.82} style={{ minHeight: 82, borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(21,78,104,0.55)', borderWidth: 1, borderColor: 'rgba(92,234,255,0.55)', marginBottom: 11 }}>
            <View style={{ width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(92,234,255,0.12)' }}><Text style={{ fontSize: 23 }}>🛡️</Text></View>
            <View style={{ flex: 1, marginLeft: 13 }}><Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900' }}>Turno di lavoro</Text><Text style={{ color: '#8CCCDD', fontSize: 11, marginTop: 4 }}>Usa l'inserimento turni già presente</Text></View>
            <Ionicons name="chevron-forward" size={20} color="#69E7FF" />
          </TouchableOpacity>

          <TouchableOpacity onPress={onPersonale} activeOpacity={0.82} style={{ minHeight: 82, borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(78,49,122,0.56)', borderWidth: 1, borderColor: 'rgba(182,140,255,0.62)' }}>
            <View style={{ width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(182,140,255,0.15)' }}><Text style={{ fontSize: 23 }}>📌</Text></View>
            <View style={{ flex: 1, marginLeft: 13 }}><Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900' }}>Impegno personale</Text><Text style={{ color: '#C6ACEF', fontSize: 11, marginTop: 4 }}>Appuntamenti, famiglia, vita privata</Text></View>
            <Ionicons name="chevron-forward" size={20} color={VIOLA_CHIARO} />
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export function ImpegnoPersonaleModal({ visible, evento, dataDefault, onClose, onSave, onDelete }) {
  const [titolo, setTitolo] = useState('');
  const [data, setData] = useState('');
  const [inizio, setInizio] = useState('09:00');
  const [fine, setFine] = useState('');
  const [tuttoIlGiorno, setTuttoIlGiorno] = useState(false);
  const [luogo, setLuogo] = useState('');
  const [note, setNote] = useState('');
  const [promemoria, setPromemoria] = useState([]);
  const [errore, setErrore] = useState('');

  useEffect(() => {
    if (!visible) return;
    const base = evento || dataDefault || {};
    setTitolo(evento?.titolo || '');
    setData(dataTesto(base.anno, base.mese, base.giorno));
    setInizio(evento?.inizio || '09:00');
    setFine(evento?.fine || '');
    setTuttoIlGiorno(evento?.tuttoIlGiorno === true);
    setLuogo(evento?.luogo || '');
    setNote(evento?.note || '');
    setPromemoria(normalizzaPromemoria(evento?.promemoria || []));
    setErrore('');
  }, [visible, evento, dataDefault]);

  const modifica = Boolean(evento?.id);
  const dataParsed = useMemo(() => parseData(data), [data]);

  const togglePromemoria = (minuti) => {
    setPromemoria((correnti) => {
      if (correnti.includes(minuti)) return correnti.filter((x) => x !== minuti);
      if (correnti.length >= 2) return [correnti[1], minuti];
      return normalizzaPromemoria([...correnti, minuti]);
    });
  };

  const salva = () => {
    if (!titolo.trim()) { setErrore('Inserisci un titolo.'); return; }
    if (!dataParsed) { setErrore('Inserisci una data valida in formato GG/MM/AAAA.'); return; }
    if (!tuttoIlGiorno && !/^([01]\d|2[0-3]):[0-5]\d$/.test(inizio)) { setErrore('Inserisci un orario di inizio valido.'); return; }
    if (!tuttoIlGiorno && fine && !/^([01]\d|2[0-3]):[0-5]\d$/.test(fine)) { setErrore('Inserisci un orario di fine valido.'); return; }
    onSave({
      ...(evento || {}),
      ...dataParsed,
      titolo: titolo.trim(),
      inizio,
      fine,
      tuttoIlGiorno,
      luogo,
      note,
      promemoria,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: SFONDO }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(182,140,255,0.18)', flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={onClose} style={{ width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#14223A' }}><Ionicons name="close" size={23} color="#D7E3F4" /></TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}><Text style={{ color: VIOLA, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }}>AGENDA PERSONALE</Text><Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginTop: 2 }}>{modifica ? 'Modifica impegno' : 'Nuovo impegno'}</Text></View>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18, paddingBottom: 44 }}>
          <View style={{ padding: 16, borderRadius: 24, backgroundColor: 'rgba(46,31,78,0.64)', borderWidth: 1, borderColor: 'rgba(182,140,255,0.36)', marginBottom: 18 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '900' }}>📌 Il tuo tempo, separato dal lavoro</Text>
            <Text style={{ color: '#AFA1C8', fontSize: 11, lineHeight: 16, marginTop: 5 }}>Gli impegni restano sul dispositivo e non vengono condivisi con colleghi o Centro Notifiche.</Text>
          </View>

          <Campo label="TITOLO *" value={titolo} onChangeText={setTitolo} placeholder="Es. Dentista" />
          <Campo label="DATA" value={data} onChangeText={setData} placeholder="GG/MM/AAAA" keyboardType="numbers-and-punctuation" />

          <View style={{ minHeight: 58, borderRadius: 17, paddingHorizontal: 14, marginBottom: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(19,31,55,0.92)', borderWidth: 1, borderColor: 'rgba(182,140,255,0.28)' }}>
            <View style={{ flex: 1 }}><Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '900' }}>Tutto il giorno</Text><Text style={{ color: '#7890AE', fontSize: 10, marginTop: 2 }}>Nasconde gli orari e usa le 09:00 come riferimento promemoria</Text></View>
            <Switch value={tuttoIlGiorno} onValueChange={setTuttoIlGiorno} trackColor={{ false: '#31435D', true: '#7655A9' }} thumbColor={tuttoIlGiorno ? VIOLA_CHIARO : '#D7E0EA'} />
          </View>

          {!tuttoIlGiorno && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Campo label="INIZIO" value={inizio} onChangeText={setInizio} placeholder="09:00" keyboardType="numbers-and-punctuation" /></View>
              <View style={{ flex: 1 }}><Campo label="FINE (FACOLTATIVA)" value={fine} onChangeText={setFine} placeholder="10:00" keyboardType="numbers-and-punctuation" /></View>
            </View>
          )}

          <Campo label="LUOGO (FACOLTATIVO)" value={luogo} onChangeText={setLuogo} placeholder="Es. EUR" />
          <Campo label="NOTE (FACOLTATIVE)" value={note} onChangeText={setNote} placeholder="Aggiungi una nota…" multiline />

          <Text style={{ color: '#8FA5CC', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginBottom: 8 }}>PROMEMORIA · MAX 2</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {PROMEMORIA_RAPIDI_MINUTI.map((minuti) => {
              const attivo = promemoria.includes(minuti);
              return (
                <TouchableOpacity key={minuti} onPress={() => togglePromemoria(minuti)} style={{ paddingHorizontal: 12, minHeight: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: attivo ? 'rgba(130,91,190,0.48)' : '#13223A', borderWidth: 1, borderColor: attivo ? VIOLA : '#2A3C57' }}>
                  <Text style={{ color: attivo ? '#FFFFFF' : '#9BAFC8', fontSize: 11, fontWeight: '800' }}>{etichettaPromemoria(minuti)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {!!errore && <Text style={{ color: '#FF8295', fontSize: 12, fontWeight: '800', marginBottom: 12 }}>{errore}</Text>}

          <TouchableOpacity onPress={salva} activeOpacity={0.84} style={{ minHeight: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6F4FA8', borderWidth: 1, borderColor: VIOLA, shadowColor: VIOLA, shadowOpacity: 0.28, shadowRadius: 12 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 }}>SALVA IMPEGNO</Text>
          </TouchableOpacity>

          {modifica && (
            <TouchableOpacity onPress={() => onDelete(evento)} style={{ minHeight: 50, marginTop: 12, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(115,31,53,0.28)', borderWidth: 1, borderColor: 'rgba(255,102,132,0.42)' }}>
              <Text style={{ color: '#FF8295', fontWeight: '900' }}>ELIMINA IMPEGNO</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
