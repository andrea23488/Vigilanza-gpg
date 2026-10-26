import { ThemeEffectsPreview, useThemeEffects } from './ThemeEffects';
import { SafeAreaView as PreviewSafeAreaView } from 'react-native-safe-area-context';
import { stiliConTema } from './temaSchermate';
import AppearanceScreen from './AppearanceScreen';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, ScrollView, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, BackHandler, Platform, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PRESET_TEMI, generaPalette, personalizzaAspetto, ripristinaAspetto, paletteHomeDaPreferenza, testoTema } from './temi';
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
    salvata: { ...salvata }, modificato: JSON.stringify(draft) !== JSON.stringify(salvata) });
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

function Scelta({ label, selezionato, disabled, onPress, colori, paletteAttuale = null }) {
  const stiliScelta = useMemo(() => stiliConTema({ scelta: styles.scelta, selezionata: styles.selezionata, testo: styles.testo }, paletteAttuale, StyleSheet.flatten), [paletteAttuale]);
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ selected: selezionato, disabled }} disabled={disabled} onPress={onPress}
    style={[stiliScelta.scelta, selezionato && stiliScelta.selezionata, disabled && { opacity: 0.5 }]}>
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {colori.map((colore, i) => <View key={i} style={{ backgroundColor: colore, width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#91A3BA' }} />)}
    </View>
    <Text style={stiliScelta.testo}>{selezionato ? '✓ ' : ''}{label}</Text>
  </TouchableOpacity>;
}

function Anteprima({ palette: p }) {
  const card = {
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
  };

  const servizi = [
    {
      titolo: 'CALENDARIO',
      sottotitolo: 'Vista mensile turni',
      icona: 'calendar-number-outline',
    },
    {
      titolo: 'STRUMENTI',
      sottotitolo: 'Utilità operative',
      icona: 'briefcase-outline',
    },
    {
      titolo: 'STIPENDIO',
      sottotitolo: 'Riepilogo e stima',
      icona: 'wallet-outline',
    },
    {
      titolo: 'COLLEGHI',
      sottotitolo: 'Turni condivisi',
      icona: 'people-outline',
    },
  ];

  return (
    <View
      accessibilityLabel="Anteprima Home con dati dimostrativi"
      style={[
        styles.preview,
        {
          backgroundColor: p.background,
          borderColor: p.border,
        },
      ]}
    >
      {/* Header simile alla Home reale */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: p.text,
              fontSize: 20,
              fontWeight: '900',
            }}
          >
            Ciao Andrea 👋
          </Text>

          <Text
            style={{
              color: p.textMuted,
              fontSize: 10.5,
              fontWeight: '700',
              marginTop: 3,
            }}
          >
            Vigilanza Demo · Guardia Particolare Giurata
          </Text>

          <View
            style={{
              alignSelf: 'flex-start',
              marginTop: 8,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 14,
              backgroundColor: p.surface,
              borderWidth: 1,
              borderColor: p.border,
            }}
          >
            <Text
              style={{
                color: testoTema(p, p.accent),
                fontSize: 9,
                fontWeight: '900',
              }}
            >
              ○ FUORI SERVIZIO
            </Text>
          </View>
        </View>

        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            ...card,
          }}
        >
          <Ionicons
            name="person"
            size={20}
            color={p.text}
          />
        </View>
      </View>

      {/* Nucleo turno, ispirato al vero Digital Core */}
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          marginVertical: 18,
        }}
      >
        <View
          style={{
            width: 206,
            height: 206,
            borderRadius: 103,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2.5,
            borderColor: p.homeAccent,
            backgroundColor: p.surface,
            shadowColor: p.homeAccent,
            shadowOpacity: 0.28,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 0 },
          }}
        >
          <View
            style={{
              position: 'absolute',
              width: 184,
              height: 184,
              borderRadius: 92,
              borderWidth: 1.3,
              borderColor: p.border,
            }}
          />

          <Ionicons
            name="shield-checkmark-outline"
            size={26}
            color={p.homeAccent}
          />

          <Text
            style={{
              color: testoTema(p, p.homeAccent),
              fontSize: 8.5,
              fontWeight: '900',
              letterSpacing: 1.1,
              marginTop: 8,
            }}
          >
            TURNO DI OGGI
          </Text>

          <Text
            style={{
              color: p.text,
              fontSize: 27,
              fontWeight: '900',
              marginTop: 6,
            }}
          >
            06:00 – 14:00
          </Text>

          <Text
            style={{
              color: p.textMuted,
              fontSize: 10.5,
              fontWeight: '700',
              marginTop: 4,
            }}
          >
            Fiumicino · Terminal 1
          </Text>

          <View
            style={{
              width: '55%',
              height: 1,
              backgroundColor: p.border,
              marginVertical: 9,
            }}
          />

          <Text
            style={{
              color: testoTema(p, p.homeAccent),
              fontSize: 8.5,
              fontWeight: '900',
              letterSpacing: 0.8,
            }}
          >
            INIZIO TRA
          </Text>

          <Text
            style={{
              color: p.text,
              fontSize: 15,
              fontWeight: '900',
              marginTop: 2,
            }}
          >
            1h 24m
          </Text>
        </View>
      </View>

      {/* Mini riepilogo mese */}
      <View
        style={[
          card,
          {
            borderRadius: 17,
            padding: 11,
            marginBottom: 12,
          },
        ]}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <Text
            style={{
              color: p.text,
              fontSize: 10.5,
              fontWeight: '900',
            }}
          >
            OTTOBRE 2026
          </Text>

          <Text
            style={{
              color: p.text,
              fontSize: 10,
              fontWeight: '900',
            }}
          >
            AVANZ. 55%
          </Text>
        </View>

        <View
          style={{
            height: 5,
            borderRadius: 10,
            backgroundColor: p.surfaceRaised,
            marginTop: 7,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: '55%',
              borderRadius: 10,
              backgroundColor: p.accent,
            }}
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            marginTop: 9,
          }}
        >
          {[
            ['128h', 'LAVORATE'],
            ['22h', 'EXTRA'],
            ['16', 'GIORNI'],
          ].map(([valore, etichetta], indice) => (
            <View
              key={etichetta}
              style={{
                flex: 1,
                alignItems: 'center',
                borderLeftWidth: indice === 0 ? 0 : 1,
                borderLeftColor: p.border,
              }}
            >
              <Text
                style={{
                  color: p.text,
                  fontSize: 14,
                  fontWeight: '900',
                }}
              >
                {valore}
              </Text>

              <Text
                style={{
                  color: p.textMuted,
                  fontSize: 7.5,
                  fontWeight: '800',
                  marginTop: 1,
                }}
              >
                {etichetta}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Stessa logica visiva del Centro Operativo */}
      <Text
        style={{
          color: p.textMuted,
          fontSize: 8.5,
          fontWeight: '900',
          letterSpacing: 1,
          marginBottom: 7,
        }}
      >
        CENTRO OPERATIVO
      </Text>

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          rowGap: 8,
        }}
      >
        {servizi.map((item) => (
          <View
            key={item.titolo}
            style={[
              card,
              {
                width: '48.7%',
                minHeight: 82,
                borderRadius: 17,
                padding: 11,
                justifyContent: 'space-between',
              },
            ]}
          >
            <View
              style={{
                width: 31,
                height: 31,
                borderRadius: 10,
                backgroundColor: p.surfaceRaised,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name={item.icona}
                size={17}
                color={p.accent}
              />
            </View>

            <View style={{ marginTop: 10 }}>
              <Text
                style={{
                  color: p.text,
                  fontSize: 10.5,
                  fontWeight: '900',
                }}
              >
                {item.titolo}
              </Text>

              <Text
                numberOfLines={1}
                style={{
                  color: p.textMuted,
                  fontSize: 7.5,
                  fontWeight: '700',
                  marginTop: 2,
                }}
              >
                {item.sottotitolo}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View
        style={{
          marginTop: 12,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 15,
          backgroundColor: p.accent,
        }}
      >
        <Text
          style={{
            color: p.onAccent,
            fontSize: 10.5,
            fontWeight: '900',
            textAlign: 'center',
          }}
        >
          ANTEPRIMA HOME
        </Text>
      </View>
    </View>
  );
}

export default function AspettoColoriScreen({ onBack, archivio, onSalvato, paletteAttuale = null, backLabel = 'Profilo', classica = false, renderAnteprima = null }) {
  const scrollRef = useRef(null);
  const [mostraTornaSu, setMostraTornaSu] = useState(false);
  const controllore = useRef(null);
  if (!controllore.current) controllore.current = creaControlloreAspetto(archivio);
  const [stato, setStato] = useState(() => controllore.current.stato());
  const [messaggio, setMessaggio] = useState('');
  const [anteprimaAperta, setAnteprimaAperta] = useState(false);
  const effettiTema = useThemeEffects();
  useEffect(() => () => effettiTema.setPreview(false), [effettiTema.setPreview]);
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
  const palette = useMemo(() => paletteHomeDaPreferenza(stato.draft) || generaPalette(stato.draft), [stato.draft]);
  const disabled = !stato.pronto || stato.occupato;
  const stiliClassici = useMemo(() => stiliConTema(styles, paletteAttuale, StyleSheet.flatten), [paletteAttuale]);
  function cambia(azione) { azione(); aggiorna(); setMessaggio('Modifiche in anteprima. Premi Salva colori per conservarle.'); }
  async function salva() {
    const pending = controllore.current.salva(); aggiorna();
    const r = await pending;
    if (r.ok && onSalvato) onSalvato(r.preferenza);
    if (!montato.current) return;
    aggiorna(); setMessaggio(r.ok ? 'Colori salvati sul dispositivo e applicati all’app.'
      : 'Salvataggio non riuscito. La selezione è ancora disponibile: riprova.');
  }
  function indietro() {
    if (stato.occupato) return;
    if (stato.modificato) Alert.alert('Modifiche non salvate', 'Vuoi uscire senza salvare i colori?', [
      { text: 'Resta', style: 'cancel' }, { text: 'Esci senza salvare', onPress: onBack },
    ]); else onBack();
  }
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (anteprimaAperta) { effettiTema.setPreview(false); setAnteprimaAperta(false); } else indietro(); return true; });
    return () => sub.remove();
  }, [stato.occupato, stato.modificato, onBack, anteprimaAperta]);
  if (!classica) return <>
    <AppearanceScreen draft={stato.draft} saved={stato.salvata} disabled={disabled} message={messaggio} backLabel={backLabel}
      onDraft={input => cambia(() => {
        controllore.current.selezionaPreset(input.preset);
        controllore.current.personalizza({ background: input.background, accent: input.accent });
      })}
      onSave={salva} onReset={() => cambia(() => controllore.current.ripristina())}
      energy={effettiTema.energy} energyReady={effettiTema.ready && !effettiTema.busy}
      onEnergy={async value => { if (!(await effettiTema.setEnergy(value)) && montato.current) setMessaggio('Impossibile salvare il risparmio energia. Riprova.'); }}
      onPreview={() => { effettiTema.setPreview(true); setAnteprimaAperta(true); }} onBack={indietro} />
    <Modal visible={anteprimaAperta} animationType="none" onRequestClose={() => { effettiTema.setPreview(false); setAnteprimaAperta(false); }}>
      <ThemeEffectsPreview preference={stato.draft}>
        <View style={{ flex: 1 }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {anteprimaAperta && renderAnteprima ? renderAnteprima(palette, stato.draft) : null}
        </View>
        <PreviewSafeAreaView edges={['bottom']} style={{ backgroundColor: palette.surface }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Torna a Aspetto e colori" onPress={() => { effettiTema.setPreview(false); setAnteprimaAperta(false); }}
          style={{ minHeight: 60, padding: 18, backgroundColor: palette.surface, borderTopWidth: 1, borderColor: palette.border }}>
          <Text style={{ color: palette.text, textAlign: 'center', fontWeight: '800' }}>Anteprima · Torna a Aspetto e colori</Text>
        </Pressable>
        </PreviewSafeAreaView>
      </ThemeEffectsPreview>
    </Modal>
  </>;
  return <SafeAreaView style={[stiliClassici.safe, paletteAttuale && { backgroundColor: paletteAttuale.background }]}>
    <ScrollView
      ref={scrollRef}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={(event) => {
        setMostraTornaSu(
          event.nativeEvent.contentOffset.y > 350
        );
      }}
      contentContainerStyle={[stiliClassici.content, { paddingBottom: 90 }]}
    >
      <TouchableOpacity accessibilityRole="button" disabled={stato.occupato} onPress={indietro} style={stiliClassici.button}>
        <Text style={stiliClassici.testo}>‹ Torna a {backLabel}</Text>
      </TouchableOpacity>
      <Text style={[stiliClassici.title, paletteAttuale && { color: paletteAttuale.text }]}>Aspetto e colori</Text>
      <Text style={[stiliClassici.secondario, paletteAttuale && { color: paletteAttuale.textMuted }]}>Personalizza l’anteprima. Salva per applicare i colori a tutta l’app.</Text>
      {stato.occupato && <ActivityIndicator color="#55B8FF" accessibilityLabel="Operazione in corso" />}
      {!!messaggio && <Text accessibilityLiveRegion="polite" style={stiliClassici.secondario}>{messaggio}</Text>}
      {!stato.pronto && !stato.occupato && <TouchableOpacity onPress={carica} accessibilityRole="button" style={stiliClassici.button}><Text style={stiliClassici.testo}>Riprova caricamento</Text></TouchableOpacity>}
      <Text style={stiliClassici.heading}>Temi preimpostati</Text>
      <View style={stiliClassici.griglia}>{PRESET_TEMI.map(p => <Scelta paletteAttuale={paletteAttuale} key={p.id} label={p.nome} disabled={disabled}
        colori={[p.background, p.accent]} selezionato={stato.draft.preset === p.id && stato.draft.background === null && stato.draft.accent === null}
        onPress={() => cambia(() => controllore.current.selezionaPreset(p.id))} />)}</View>
      <Text style={stiliClassici.heading}>Sfondo</Text>
      <View style={stiliClassici.griglia}>{SFONDI_ASPETTO.map(colore => <Scelta paletteAttuale={paletteAttuale} key={colore} label={`Sfondo ${colore}`} disabled={disabled}
        colori={[colore]} selezionato={palette.background === colore} onPress={() => cambia(() => controllore.current.personalizza({ background: colore }))} />)}</View>
      <Text style={stiliClassici.heading}>Cerchio ed evidenze</Text>
      <View style={stiliClassici.griglia}>{ACCENTI_ASPETTO.map(colore => <Scelta paletteAttuale={paletteAttuale} key={colore} label={`Accento ${colore}`} disabled={disabled}
        colori={[colore]} selezionato={palette.homeAccent === colore} onPress={() => cambia(() => controllore.current.personalizza({ accent: colore }))} />)}</View>
      <Text style={[stiliClassici.heading, paletteAttuale && { color: paletteAttuale.text }]}>Anteprima app</Text>
      <Anteprima palette={palette} />
      <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={() => cambia(() => controllore.current.ripristina())} style={stiliClassici.button}>
        <Text style={stiliClassici.testo}>Ripristina colori originali</Text>
      </TouchableOpacity>
      <Text style={stiliClassici.secondario}>Il ripristino modifica l’anteprima. Premi Salva colori per confermarlo.</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={salva}
        style={[stiliClassici.button, { backgroundColor: '#168BFF', opacity: disabled ? 0.5 : 1 }]}>
        <Text style={{ color: '#07111F', fontWeight: '900' }}>Salva colori</Text>
      </TouchableOpacity>
    </ScrollView>

    {mostraTornaSu && (
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() =>
          scrollRef.current?.scrollTo({
            y: 0,
            animated: true,
          })
        }
        style={{
          position: 'absolute',
          right: 18,
          bottom: 24,
          width: 46,
          height: 46,
          borderRadius: 23,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: paletteAttuale?.surface || 'rgba(20,45,85,0.96)',
          borderWidth: 1,
          borderColor: paletteAttuale?.accent || 'rgba(141,184,255,0.55)',
          zIndex: 50,
          elevation: 8,
          shadowColor: paletteAttuale?.accent || '#8DB8FF',
          shadowOpacity: 0.22,
          shadowRadius: 9,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <Ionicons
          name="arrow-up"
          size={22}
          color={paletteAttuale?.text || '#FFFFFF'}
        />
      </TouchableOpacity>
    )}
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
