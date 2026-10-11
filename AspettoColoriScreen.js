import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, ScrollView, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PRESET_TEMI, generaPalette, personalizzaAspetto, ripristinaAspetto } from './temi';
import { creaArchivioAspetto } from './preferenzeAspetto';

export const SFONDI_ASPETTO = Object.freeze(['#07111F', '#151A20', '#171426', '#082329', '#182230', '#241522', '#FFFFFF', '#E8EDF3']);
export const ACCENTI_ASPETTO = Object.freeze(['#168BFF', '#5EEBFF', '#5EEAD4', '#C4B5FD', '#FCD34D', '#93C5FD', '#FDA4AF', '#50D89F']);

// Controllore condiviso dalla schermata e dai test: nessuna scrittura implicita.
export function creaControlloreAspetto(archivio = creaArchivioAspetto()) {
  let pronto = false;
  let occupato = false;
  let draft = ripristinaAspetto();
  let salvata = ripristinaAspetto();
  const stato = () => ({ pronto, occupato, draft: { ...draft },
    modificato: JSON.stringify(draft) !== JSON.stringify(salvata) });
  return {
    stato,
    async carica() {
      if (occupato) return { ok: false };
      occupato = true;
      try {
        const r = await archivio.carica();
        if (r.ok) { draft = r.preferenza; salvata = { ...draft }; pronto = true; }
        return r;
      } finally { occupato = false; }
    },
    selezionaPreset(id) {
      if (!pronto || occupato) return false;
      // Riutilizza la validazione centrale, inclusa quella del preset.
      draft = personalizzaAspetto({ ...ripristinaAspetto(), preset: id }, {});
      return true;
    },
    personalizza(colori) {
      if (!pronto || occupato) return false;
      draft = personalizzaAspetto(draft, colori); return true;
    },
    ripristina() {
      if (!pronto || occupato) return false;
      draft = ripristinaAspetto(); return true;
    },
    async salva() {
      if (!pronto || occupato) return { ok: false, errore: 'non_pronto' };
      occupato = true;
      try {
        const r = await archivio.salva(draft);
        if (r.ok) salvata = { ...r.preferenza };
        return r;
      } finally { occupato = false; }
    },
  };
}

function Scelta({ label, selezionato, disabled, onPress, colori }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ selected: selezionato, disabled }} disabled={disabled} onPress={onPress}
    style={[styles.scelta, selezionato && styles.selezionata, disabled && { opacity: 0.5 }]}>
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {colori.map((colore, i) => <View key={i} style={{ backgroundColor: colore, width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#91A3BA' }} />)}
    </View>
    <Text style={styles.testo}>{selezionato ? '✓ ' : ''}{label}</Text>
  </TouchableOpacity>;
}

function Anteprima({ palette: p }) {
  // Riprende la gerarchia reale: saluto, nucleo circolare, schede servizi.
  // Esempio dichiarato e statico: nessun dato utente o azione operativa.
  return <View accessibilityLabel="Anteprima Home con dati dimostrativi" style={[styles.preview, { backgroundColor: p.background, borderColor: p.border }]}>
    <Text style={{ color: p.text, fontSize: 22, fontWeight: '900' }}>Ciao 👋</Text>
    <Text style={{ color: p.textMuted, marginTop: 4 }}>Vigilanza · Anteprima dimostrativa</Text>
    <View style={{ alignItems: 'center', marginVertical: 20 }}>
      <View style={{ width: 190, minHeight: 190, borderRadius: 95, borderWidth: 3, borderColor: p.homeAccent,
        backgroundColor: p.surface, alignItems: 'center', justifyContent: 'center', padding: 18 }}>
        <Ionicons name="shield-checkmark-outline" size={28} color={p.homeAccent} />
        <Text style={{ color: p.textMuted, marginTop: 10 }}>PROSSIMO TURNO</Text>
        <Text style={{ color: p.text, fontWeight: '900', fontSize: 25 }}>06:00 — 14:00</Text>
        <Text style={{ color: p.textMuted, marginTop: 6 }}>Servizio di esempio</Text>
      </View>
    </View>
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {['Turni', 'Stipendio'].map(label => <View key={label} style={{ flex: 1, padding: 14, borderRadius: 16,
        backgroundColor: p.surfaceRaised, borderWidth: 1, borderColor: p.border }}>
        <Text style={{ color: p.text, fontWeight: '800' }}>{label}</Text>
      </View>)}
    </View>
    <View style={{ backgroundColor: p.accent, borderRadius: 12, padding: 12, marginTop: 12 }}>
      <Text style={{ color: p.onAccent, fontWeight: '800', textAlign: 'center' }}>Apri il servizio · Anteprima</Text>
    </View>
  </View>;
}

export default function AspettoColoriScreen({ onBack, archivio, onSalvato }) {
  const controllore = useRef(null);
  if (!controllore.current) controllore.current = creaControlloreAspetto(archivio);
  const [stato, setStato] = useState(() => controllore.current.stato());
  const [messaggio, setMessaggio] = useState('');
  const montato = useRef(true);
  const aggiorna = () => { if (montato.current) setStato(controllore.current.stato()); };
  async function carica() {
    const pending = controllore.current.carica(); aggiorna();
    const r = await pending;
    if (!montato.current) return;
    aggiorna();
    setMessaggio(!r.ok ? 'Impossibile leggere i colori salvati. Riprova prima di modificarli.'
      : r.recuperata ? 'Preferenza non valida: caricati i colori originali. Nessun dato è stato riscritto.' : '');
  }
  useEffect(() => { montato.current = true; carica(); return () => { montato.current = false; }; }, []);
  const palette = useMemo(() => generaPalette(stato.draft), [stato.draft]);
  const disabled = !stato.pronto || stato.occupato;
  function cambia(azione) { azione(); aggiorna(); setMessaggio('Modifiche in anteprima. Premi Salva colori per conservarle.'); }
  async function salva() {
    const pending = controllore.current.salva(); aggiorna();
    const r = await pending;
    if (r.ok && onSalvato) onSalvato(r.preferenza);
    if (!montato.current) return;
    aggiorna(); setMessaggio(r.ok ? 'Colori salvati sul dispositivo e applicati alla Home.'
      : 'Salvataggio non riuscito. La selezione è ancora disponibile: riprova.');
  }
  function indietro() {
    if (stato.occupato) return;
    if (stato.modificato) Alert.alert('Modifiche non salvate', 'Vuoi uscire senza salvare i colori?', [
      { text: 'Resta', style: 'cancel' }, { text: 'Esci senza salvare', onPress: onBack },
    ]); else onBack();
  }
  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content}>
      <TouchableOpacity accessibilityRole="button" disabled={stato.occupato} onPress={indietro} style={styles.button}>
        <Text style={styles.testo}>‹ Torna al Profilo</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Aspetto e colori</Text>
      <Text style={styles.secondario}>Personalizza l’anteprima. Salva per applicare i colori alla Home.</Text>
      {stato.occupato && <ActivityIndicator color="#55B8FF" accessibilityLabel="Operazione in corso" />}
      {!!messaggio && <Text accessibilityLiveRegion="polite" style={styles.secondario}>{messaggio}</Text>}
      {!stato.pronto && !stato.occupato && <TouchableOpacity onPress={carica} accessibilityRole="button" style={styles.button}><Text style={styles.testo}>Riprova caricamento</Text></TouchableOpacity>}
      <Text style={styles.heading}>Temi preimpostati</Text>
      <View style={styles.griglia}>{PRESET_TEMI.map(p => <Scelta key={p.id} label={p.nome} disabled={disabled}
        colori={[p.background, p.accent]} selezionato={stato.draft.preset === p.id && stato.draft.background === null && stato.draft.accent === null}
        onPress={() => cambia(() => controllore.current.selezionaPreset(p.id))} />)}</View>
      <Text style={styles.heading}>Sfondo</Text>
      <View style={styles.griglia}>{SFONDI_ASPETTO.map(colore => <Scelta key={colore} label={`Sfondo ${colore}`} disabled={disabled}
        colori={[colore]} selezionato={palette.background === colore} onPress={() => cambia(() => controllore.current.personalizza({ background: colore }))} />)}</View>
      <Text style={styles.heading}>Cerchio ed evidenze</Text>
      <View style={styles.griglia}>{ACCENTI_ASPETTO.map(colore => <Scelta key={colore} label={`Accento ${colore}`} disabled={disabled}
        colori={[colore]} selezionato={palette.homeAccent === colore} onPress={() => cambia(() => controllore.current.personalizza({ accent: colore }))} />)}</View>
      <Text style={styles.heading}>Anteprima Home</Text>
      <Anteprima palette={palette} />
      <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={() => cambia(() => controllore.current.ripristina())} style={styles.button}>
        <Text style={styles.testo}>Ripristina colori originali</Text>
      </TouchableOpacity>
      <Text style={styles.secondario}>Il ripristino modifica l’anteprima. Premi Salva colori per confermarlo.</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={salva}
        style={[styles.button, { backgroundColor: '#168BFF', opacity: disabled ? 0.5 : 1 }]}>
        <Text style={{ color: '#07111F', fontWeight: '900' }}>Salva colori</Text>
      </TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07111F' }, content: { padding: 20, paddingBottom: 50 },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', marginVertical: 14 },
  heading: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 22, marginBottom: 12 },
  testo: { color: '#FFFFFF', fontWeight: '700' }, secondario: { color: '#91A3BA', marginVertical: 10, lineHeight: 22 },
  griglia: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  scelta: { padding: 12, minHeight: 48, borderRadius: 14, borderWidth: 2, borderColor: '#203550', gap: 8, backgroundColor: '#101C2D' },
  selezionata: { borderColor: '#55B8FF' }, preview: { padding: 18, borderRadius: 22, borderWidth: 1 },
  button: { padding: 15, minHeight: 48, borderRadius: 12, backgroundColor: '#101C2D', marginTop: 14 },
});
