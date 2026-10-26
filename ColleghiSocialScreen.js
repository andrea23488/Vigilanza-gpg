import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PALETTE_ORIGINALE } from './temi';

export default function ColleghiSocialScreen({ paletteHome, ricerca, colleghi, loading, cerca, onBack, onProfile, onGestione }) {
  const palette = paletteHome || PALETTE_ORIGINALE;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const request = useRef(0);
  const back = () => preview ? setPreview(null) : onBack();
  useEffect(() => () => { request.current++; }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => sub.remove();
  }, [preview, onBack]);
  const search = async () => {
    const id = ++request.current;
    setBusy(true); setError(''); setResults([]); setPreview(null);
    try {
      const rows = await cerca(query);
      if (id === request.current) { setResults(rows); if (!rows.length) setError('Nessun collega trovato.'); }
    } catch (e) { if (id === request.current) setError(e.message || 'Ricerca non disponibile.'); }
    finally { if (id === request.current) setBusy(false); }
  };
  const button = { minHeight: 48, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, marginBottom: 12 };
  const text = { color: palette.text, fontSize: 16 };
  const profile = p => <>
    {p.foto_url ? <Image accessibilityLabel="Foto profilo" source={{ uri: p.foto_url }} style={{ width: 80, height: 80, borderRadius: 40 }} /> : null}
    <Text style={[text, { fontWeight: '800' }]}>{[p.nome, p.cognome].filter(Boolean).join(' ') || 'Collega'}</Text>
    <Text style={{ color: palette.textMuted }}>{[p.codice_gpg, p.azienda, p.sede].filter(Boolean).join(' · ')}</Text>
    <Text selectable style={{ color: palette.textMuted }}>ID: {p.user_id}</Text>
  </>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
    <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" accessibilityLabel={preview ? 'Torna ai risultati' : 'Torna a Social'} onPress={back} style={button}><Text style={text}>‹ {preview ? 'Risultati' : 'Social'}</Text></Pressable>
      <Text accessibilityRole="header" style={[text, { fontSize: 28, marginBottom: 20 }]}>{ricerca ? 'Cerca nuovo collega' : 'Profili colleghi'}</Text>
      {preview ? <View style={button}>{profile(preview)}<Text style={{ color: palette.textMuted, marginTop: 16 }}>Invio richiesta non disponibile in questa schermata. Puoi usare la gestione colleghi originale.</Text></View> : ricerca ? <>
        <TextInput accessibilityLabel="Nome, cognome, codice GPG o ID" placeholder="Nome, cognome, codice GPG o ID" placeholderTextColor={palette.textMuted} value={query}
          onChangeText={value => { request.current++; setQuery(value); setResults([]); setError(''); setBusy(false); }} onSubmitEditing={search} style={[button, text]} />
        <Pressable accessibilityRole="button" accessibilityLabel="Cerca" disabled={busy || !query.trim()} onPress={search} style={button}><Text style={text}>Cerca</Text></Pressable>
        {busy && <ActivityIndicator />}
        {!!error && <Text accessibilityRole="alert" style={text}>{error}</Text>}
        {results.map(p => <Pressable key={p.user_id} accessibilityRole="button" onPress={() => setPreview(p)} style={button}>{profile(p)}</Pressable>)}
        <Text style={{ color: palette.textMuted }}>Verifica codice GPG, azienda, sede e ID per distinguere gli omonimi. La ricerca non invia richieste.</Text>
      </> : <>
        {loading && <ActivityIndicator />}
        {colleghi.filter(c => c.stato === 'accettato').map(c => <Pressable key={c.id} accessibilityRole="button" onPress={() => onProfile(c)} style={button}>{profile(c.profilo || {})}</Pressable>)}
        {!loading && !colleghi.some(c => c.stato === 'accettato') && <Text style={text}>Nessun collega collegato</Text>}
      </>}
      <Pressable accessibilityRole="button" accessibilityLabel="Gestione colleghi originale" onPress={onGestione} style={[button, { marginTop: 20 }]}><Text style={text}>Gestione colleghi originale</Text></Pressable>
    </ScrollView>
  </SafeAreaView>;
}
