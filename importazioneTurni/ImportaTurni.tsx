import React, { useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, Text as NativeText, TextInput, View } from 'react-native';
import { creaAcquisitoreNativo } from './acquisizioneNativa';
import { creaLettoreNativo } from './letturaNativa';
import { creaRegistroRevisioni } from './revisione';
import type { RicevutaRevisione } from './revisione';
import type { Bozza, Confronto, Dipendente } from './modello';
import type { CanaleAcquisizione } from './acquisizione';
import type { DocumentoLetto } from './lettura';
import type { EstrazioneIOS } from './geometriaIOS';
import { strutturaPaginaIOS } from './geometriaIOS';
import { leggiProspetto, nellaRegione } from './prospetto';
import type { Contesto, Regione, RigaAnteprima } from './prospetto';
import { interpretaDocumento } from './interpretazione';
import { problemiDati } from './modello';
import { PALETTE_ORIGINALE } from '../temi';
import { normalizzaData } from './documenti';
interface PropsComuni {
  palette?: typeof PALETTE_ORIGINALE | null;
  /** Matricola aziendale, se nota: non passare automaticamente codice_gpg. */
  identita?: Dipendente;
}
export type ImportaTurniProps = PropsComuni & ({
  /** Blocco 2E: nessuna conferma finale, lettura calendario o callback di salvataggio. */
  modalitaVerifica: true;
  registro?: ReturnType<typeof creaRegistroRevisioni>;
  leggiEsistenti?: never;
  onBozzaConfermata?: never;
} | {
  modalitaVerifica?: false;
  registro: ReturnType<typeof creaRegistroRevisioni>;
  /** Deve restituire record aggiornati e normalizzati dello stesso utente. Nessuna scrittura. */
  leggiEsistenti(): Promise<readonly Confronto[]>;
  /** Evento di sola revisione. Questo componente non importa e non salva turni. */
  onBozzaConfermata(bozza: Bozza, ricevuta: RicevutaRevisione): void;
});
const mesi = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const pad = (n: number) => String(n).padStart(2, '0');
const sequenza = (n: number, da = 0) => Array.from({ length: n }, (_, i) => String(i + da));
const chiaveGiorno = (r: RigaAnteprima) => r.data || `giorno-${Number(r.giorno)}`;
function dataLeggibile(r: RigaAnteprima) {
  if (!r.data || !normalizzaData(r.data).valore) return `Giorno ${Number(r.giorno)} · data da completare`;
  const [a, m, g] = r.data.split('-').map(Number);
  return `${g} ${mesi[m - 1]} ${a}`;
}
const vuoto: Dipendente = { nome: null, cognome: null, matricola: null };

const Text = ({ colori, style, ...resto }: React.ComponentProps<typeof NativeText> & { colori: typeof PALETTE_ORIGINALE }) => <NativeText {...resto} style={[{ color: colori.text, fontSize: 16 }, style]} />;
const Button = ({ colori, title, onPress, disabled = false }: { colori: typeof PALETTE_ORIGINALE; title: string; onPress?: () => void; disabled?: boolean }) =>
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({ minHeight: 48, maxWidth: '100%', justifyContent: 'center', padding: 12, marginVertical: 4, borderRadius: 16,
        borderWidth: 1, borderColor: colori.border, backgroundColor: colori.surfaceRaised, opacity: disabled ? .55 : pressed ? .75 : 1 })}>
      <Text colori={colori} style={{ color: disabled ? colori.textMuted : colori.text, fontWeight: '700', textAlign: 'center' }}>{title}</Text>
    </Pressable>;

/** Solo anteprima locale: nessun percorso di conferma/salvataggio definitivo. */
export default function ImportaTurni(props: ImportaTurniProps) {
  const colori = props.palette ?? PALETTE_ORIGINALE;
  const campo = { borderWidth: 1, borderColor: colori.border, backgroundColor: colori.surfaceRaised,
    color: colori.text, padding: 14, marginVertical: 6, borderRadius: 16, minHeight: 48, fontSize: 16 };
  const scheda = { padding: 16, borderRadius: 22, backgroundColor: colori.surface, borderWidth: 1, borderColor: colori.border, marginVertical: 6 };
  const [aperta, setAperta] = useState<string | null>(null);
  const [mostraContesto, setMostraContesto] = useState(false);
  const [mostraSorgente, setMostraSorgente] = useState(false);
  const [modificate, setModificate] = useState<string[]>([]);
  const [erroreVoce, setErroreVoce] = useState('');
  const [scelta, setScelta] = useState<{ titolo: string; valori: { label: string; value: string }[]; seleziona(v: string): void } | null>(null);
  const manuale = React.useRef(0);
  function scegli(titolo: string, valori: string[], seleziona: (v: string) => void, etichette?: string[]) {
    setScelta({ titolo, valori: valori.map((value, i) => ({ value, label: etichette?.[i] ?? value })), seleziona });
  }
  const [acquisitore] = useState(creaAcquisitoreNativo);
  const [lettore] = useState(creaLettoreNativo);
  const montato = React.useRef(true), inCorso = React.useRef(false);
  React.useEffect(() => { montato.current = true; return () => { montato.current = false; }; }, []);
  const larghezzaSchema = React.useRef(1);
  const [originale, setOriginale] = useState<DocumentoLetto | null>(null);
  const [contesto, setContesto] = useState<Contesto>({ mese: '', anno: '', dipendente: props.identita ?? vuoto, confermato: false });
  const [righe, setRighe] = useState<RigaAnteprima[]>([]);
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState('');
  const [pulizia, setPulizia] = useState(false);
  const [regione, setRegione] = useState<Regione>();
  const [seleziona, setSeleziona] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [angolo, setAngolo] = useState<{x: number; y: number} | null>(null);
  const candidati = originale ? interpretaDocumento(originale.documento).candidati : [];
  const raw = (originale as (DocumentoLetto & { evidenzeIOS?: EstrazioneIOS }) | null)?.evidenzeIOS;
  function riconosci(o: DocumentoLetto, c: Contesto, r?: Regione) {
    const evidenze = (o as DocumentoLetto & { evidenzeIOS?: EstrazioneIOS }).evidenzeIOS;
    const documento = evidenze ? { ...o.documento, pagine: evidenze.pagine.filter(p => !r || p.numero === r.pagina).map(p =>
      strutturaPaginaIOS({ ...p, elementi: p.elementi.filter(t => nellaRegione(t.rettangolo, p.numero, r)),
        // In regione il fallback non deve reintrodurre testo esterno.
        testo: r ? null : p.testo, righeOriginali: p.righeOriginali.filter(t => nellaRegione(t.rettangolo, p.numero, r)) }).pagina) } : o.documento;
    const prossime = leggiProspetto(documento, r ? { ...c, candidatoId: undefined } : c);
    setAperta(null); setScelta(null); setErroreVoce(''); setModificate([]); setRighe(prossime);
    if (__DEV__) console.debug('[Importa turni]', { pagine: documento.pagine.length, voci: prossime.length, avvisi: o.avvisi });
  }
  async function acquisisci(canale: CanaleAcquisizione) {
    if (inCorso.current || pulizia) return;
    inCorso.current = true;
    setBusy(true); setErrore('');
    try {
      const r = await acquisitore.acquisisci({ canale });
      if (!montato.current) { if (r.stato === 'pronto') await r.rilascia(); return; }
      if (r.stato === 'annullato') return;
      if (r.stato !== 'pronto') { setPulizia(!r.puliziaRiuscita); setErrore('Non è stato possibile aprire il documento. Scegli un PDF o un’immagine leggibile.'); return; }
      try {
        setOriginale(null); setRighe([]); setRegione(undefined); setAngolo(null); setSeleziona(false); setPagina(1);
        const esito = await lettore.leggi(r.documento);
        if (!montato.current) return;
        if (esito.stato !== 'letto') {
          setErrore(esito.codice === 'PDF_PROTETTO' ? 'Il PDF è protetto da password. Scegli una copia non protetta.' :
            esito.codice === 'DECODER_LOCALE_NON_DISPONIBILE' ? Platform.OS === 'android' ? 'La lettura non è ancora disponibile su Android.' : 'La lettura richiede una versione iOS aggiornata con i moduli di riconoscimento inclusi.' :
            'Non riusciamo a leggere il documento. Prova un altro file o una foto più nitida.'); return;
        }
        const c = { ...contesto, candidatoId: undefined, confermato: false };
        setContesto(c); setOriginale(esito.risultato); riconosci(esito.risultato, c);
      } finally { const esito = await r.rilascia(); if (montato.current) setPulizia(!esito.riuscita); }
    } catch { if (montato.current) setErrore('Lettura non riuscita. Prova di nuovo o scegli un altro documento.'); }
    finally { inCorso.current = false; if (montato.current) setBusy(false); }
  }
  const modifica = (id: string, patch: Partial<RigaAnteprima>) => {
    setErroreVoce(''); setModificate(ids => ids.includes(id) ? ids : [...ids, id]);
    setRighe(rs => rs.map(r => r.id === id ? { ...r, ...patch, verificata: false } : r));
  };
  const gruppi = [...righe.reduce((m, r) => {
    const k = chiaveGiorno(r); m.set(k, [...(m.get(k) ?? []), r]); return m;
  }, new Map<string, RigaAnteprima[]>())].map(([id, voci]) => ({ id, voci })).sort((a, b) => {
    if (a.voci[0].data && b.voci[0].data) return a.voci[0].data.localeCompare(b.voci[0].data);
    return Number(a.voci[0].giorno) - Number(b.voci[0].giorno);
  });
  // Il pannello conserva gli ID, anche quando una correzione sposta la data della voce.
  const [idsAperti, setIdsAperti] = useState<string[]>([]);
  const vociAperte = righe.filter(r => idsAperti.includes(r.id));
  function avvisi(r: RigaAnteprima): string[] {
    const problemi = problemiDati(r, true);
    return [
      !r.data ? 'Completa la data' : '',
      !r.tipo ? r.sigla ? `Conferma il significato di ${r.sigla}` : 'Scegli la tipologia' : '',
      problemi.includes('intervallo_mancante_o_ambiguo') ? 'Controlla l’orario e la data di fine' : '',
      problemi.includes('postazione_mancante') ? 'Verifica la postazione' : '',
      problemi.includes('causale_irrisolta') ? `Conferma il significato di ${r.sigla || r.causale?.codice || 'questa causale'}` : '',
      problemi.includes('data_mancante_o_invalida') && r.data ? 'Controlla la data' : '',
      problemi.some(p => ['causale_su_turno_da_verificare', 'orari_su_non_turno', 'causale_su_riposo_da_verificare'].includes(p)) ? 'Controlla tipologia e dati della voce' : '',
    ].filter(Boolean);
  }
  function dataEditor(r: RigaAnteprima, k: 'data' | 'dataFine') {
    const parti = (r[k] ?? '').split('-');
    const valori = r[k] === null
      ? [contesto.confermato ? contesto.anno : '', contesto.confermato ? pad(+contesto.mese) : '', k === 'data' ? pad(+r.giorno) : '']
      : [parti[0] ?? '', parti[1] ?? '', parti[2] ?? ''];
    return <View><Text colori={colori}>{k === 'data' ? 'Data' : 'Data fine servizio'}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {['Anno', 'Mese', 'Giorno'].map((label, i) => i === 0 ? <View key={label}><Text colori={colori}>Anno</Text><TextInput accessibilityLabel={`Anno ${k}`} keyboardType="number-pad" style={campo} value={valori[0]} onChangeText={v => { const nuova = [...valori]; nuova[0] = v; modifica(r.id, { [k]: nuova.join('-') }); }} /></View> : <Button colori={colori} key={label} title={`${label}: ${i === 1 && valori[i] ? mesi[+valori[i] - 1] : valori[i] || 'Da indicare'}`}
          onPress={() => scegli(`${label} ${k === 'data' ? 'servizio' : 'fine servizio'}`, i === 1 ? sequenza(12, 1) : sequenza(31, 1), v => {
            const nuova = [...valori]; nuova[i] = pad(+v);
            modifica(r.id, { [k]: nuova.join('-') });
          }, i === 1 ? mesi : undefined)} />)}
      </View>
      {k === 'dataFine' && <Button colori={colori} title="Usa la stessa data di inizio" disabled={!r.data} onPress={() => modifica(r.id, { dataFine: r.data })} />}
    </View>;
  }
  function oraEditor(r: RigaAnteprima, k: 'inizio' | 'fine') {
    const valori = (r[k] ?? '').split(':');
    return <View style={{ marginVertical: 8 }}><Text colori={colori}>{k === 'inizio' ? 'Inizio' : 'Fine'}: {r[k] || 'Da indicare'}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button colori={colori} title={`Ora ${k}: ${valori[0] || '—'}`} onPress={() => scegli(`Ora ${k}`, sequenza(24).map(v => pad(+v)), v => modifica(r.id, { [k]: `${v}:${valori[1] || ''}` }))} />
        <Button colori={colori} title={`Minuti ${k}: ${valori[1] || '—'}`} onPress={() => scegli(`Minuti ${k}`, sequenza(60).map(v => pad(+v)), v => modifica(r.id, { [k]: `${valori[0] || ''}:${v}` }))} />
      </View>
    </View>;
  }
  function chiudi() { setAperta(null); setScelta(null); setErroreVoce(''); }
  const intestazione = <View>
    <Text colori={colori} accessibilityRole="header" style={{ fontSize: 26, fontWeight: '900', marginBottom: 6 }}>Importa turni</Text>
    <Text colori={colori} style={{ color: colori.textMuted }}>Controlla i turni riconosciuti</Text>
    <Text colori={colori} style={{ color: colori.textMuted, marginVertical: 8 }}>Solo anteprima modificabile. Il salvataggio definitivo è disabilitato.</Text>
    {originale && <View style={scheda}>
      <Text colori={colori} style={{ fontWeight: '800' }}>{Object.values(contesto.dipendente).filter(Boolean).join(' ') || 'Dipendente da indicare'}</Text>
      <Text colori={colori}>{contesto.confermato ? `${mesi[+contesto.mese - 1]} ${contesto.anno}` : !contesto.mese ? 'Indica il mese del prospetto' : !contesto.anno ? 'Indica l’anno del prospetto' : 'Periodo e dipendente da confermare'}</Text>
      <Text colori={colori} style={{ marginTop: 8 }}>{gruppi.length} giornate · {righe.filter(r => r.tipo === 'turno').length} servizi</Text>
      <Text colori={colori}>{righe.filter(r => !contesto.confermato || !r.verificata || avvisi(r).length > 0).length} elementi da verificare</Text>
      <Button colori={colori} title={mostraContesto ? 'Chiudi periodo e dipendente' : contesto.confermato ? 'Modifica periodo e dipendente' : 'Conferma periodo e dipendente'} onPress={() => setMostraContesto(!mostraContesto)} />
    </View>}
    {originale && <Button colori={colori} title={mostraSorgente ? "Chiudi sorgente documento" : "Cambia documento o seleziona prospetto"} onPress={() => setMostraSorgente(!mostraSorgente)} />}
    {(!originale || mostraSorgente) && <View>
    <Button colori={colori} title="Scegli PDF o immagine" disabled={busy || pulizia} onPress={() => acquisisci('documento')} />
    <Button colori={colori} title="Scegli o ritaglia foto / screenshot" disabled={busy || pulizia} onPress={() => acquisisci('galleria')} />
    <Button colori={colori} title="Fotografa il prospetto" disabled={busy || pulizia} onPress={() => acquisisci('fotocamera')} />
    </View>}
    {busy && <ActivityIndicator accessibilityLabel="Lettura in corso" />}
    {!!errore && <Text colori={colori} accessibilityRole="alert">{errore}</Text>}
    {pulizia && <Button colori={colori} title="Riprova chiusura del documento" onPress={async () => { setPulizia(!(await acquisitore.riprovaPulizia()).riuscita); }} />}
    {originale && <>
      {mostraContesto && <View style={scheda}>
      <Text colori={colori} style={{ fontWeight: '700', marginTop: 16 }}>Conferma periodo e dipendente</Text>
      {candidati.map(c => <Button colori={colori} key={c.id} title={`Usa dipendente: ${[c.rilevati.nome.valore, c.rilevati.cognome.valore, c.rilevati.matricola.valore].filter(Boolean).join(' ')}`} onPress={() => {
        const prossimo = { ...contesto, candidatoId: c.id, confermato: false, dipendente: { nome: c.rilevati.nome.valore, cognome: c.rilevati.cognome.valore, matricola: c.rilevati.matricola.valore } };
        setContesto(prossimo); riconosci(originale, prossimo, regione);
      }} />)}
      <Text colori={colori}>Per i giorni senza data completa indica mese e anno. Le sigle richiedono una verifica separata.</Text>
      <Button colori={colori} title={`Mese: ${mesi[+contesto.mese - 1] || 'Da indicare'}`} onPress={() => scegli('Mese del prospetto', sequenza(12, 1), v => setContesto(c => ({ ...c, mese: v, confermato: false })), mesi)} />
      <Text colori={colori}>Anno del prospetto</Text><TextInput accessibilityLabel="anno" keyboardType="number-pad" style={campo} value={contesto.anno} onChangeText={v => setContesto(c => ({ ...c, anno: v, confermato: false }))} />
      {(['nome', 'cognome', 'matricola'] as const).map(k => <View key={k}><Text colori={colori}>{k}</Text>
        <TextInput accessibilityLabel={k} style={campo} value={contesto.dipendente[k] ?? ''}
          onChangeText={v => setContesto(c => ({ ...c, confermato: false, dipendente: { ...c.dipendente, [k]: v || null } }))} /></View>)}
      <Button colori={colori} title={contesto.confermato ? 'Periodo e dipendente confermati' : 'Conferma periodo e dipendente e rileggi'} disabled={busy}
        onPress={() => {
          if (!/^(?:[1-9]|1[0-2])$/.test(contesto.mese) || !/^[1-9]\d{3}$/.test(contesto.anno) || !Object.values(contesto.dipendente).some(v => v?.trim())) {
            setErrore('Indica un mese valido, l’anno e il dipendente.'); return;
          }
          const c = { ...contesto, confermato: true }; setContesto(c); setErrore(''); riconosci(originale, c, regione); setMostraContesto(false);
        }} />
      <Text colori={colori}>La rilettura sostituisce l’anteprima: completa prima la selezione e il periodo, poi modifica i turni.</Text>
      </View>}
      {raw && mostraSorgente && <>
        <Button colori={colori} title="Seleziona solo la regione del prospetto" onPress={() => { setSeleziona(!seleziona); setAngolo(null); }} />
        {seleziona && <>
          <Text colori={colori}>Schema del testo estratto: tocca l’angolo in alto a sinistra e poi quello in basso a destra del prospetto.</Text>
          {raw.pagine.map(p => <Button colori={colori} key={p.numero} title={`Pagina ${p.numero}`} onPress={() => { setPagina(p.numero); setAngolo(null); }} />)}
          <View onLayout={e => { larghezzaSchema.current = e.nativeEvent.layout.width; }}>
            <Pressable accessibilityLabel="Selezione regione del prospetto" style={{ height: 400, backgroundColor: colori.surfaceRaised, overflow: 'hidden' }} onPress={e => {
              const x = Math.max(0, Math.min(1, e.nativeEvent.locationX / larghezzaSchema.current));
              const y = Math.max(0, Math.min(1, e.nativeEvent.locationY / 400));
              if (!angolo) { setAngolo({ x, y }); return; }
              const r = { pagina, x: Math.min(x, angolo.x), y: Math.min(y, angolo.y), larghezza: Math.abs(x - angolo.x), altezza: Math.abs(y - angolo.y) };
              if (r.larghezza < .02 || r.altezza < .02) { setErrore('Seleziona una regione più ampia.'); setAngolo(null); return; }
              setRegione(r); setAngolo(null); setSeleziona(false); riconosci(originale, contesto, r);
            }}>
              {raw.pagine.find(p => p.numero === pagina)?.elementi.map(t => t.rettangolo && <Text colori={colori} pointerEvents="none" key={t.id}
                style={{ position: 'absolute', left: `${t.rettangolo[0] * 100}%`, top: `${t.rettangolo[1] * 100}%`, fontSize: 8 }}>{t.testo}</Text>)}
              {angolo && <View pointerEvents="none" style={{ position: 'absolute', left: `${angolo.x * 100}%`, top: `${angolo.y * 100}%`, width: 10, height: 10, backgroundColor: colori.accent }} />}
            </Pressable>
          </View>
        </>}
        {regione && <Button colori={colori} title="Usa di nuovo l’intero documento" onPress={() => { setRegione(undefined); riconosci(originale, contesto); }} />}
      </>}
      {!righe.length && <View><Text colori={colori}>Non riusciamo a riconoscere i turni. Seleziona solo il prospetto oppure prova il PDF originale o una foto più nitida. Per prospetti con più dipendenti seleziona la regione di una sola persona.</Text>
        <Button colori={colori} title="Riprova lettura" onPress={() => riconosci(originale, contesto, regione)} /></View>}
    </>}
    {originale && righe.length > 0 && <View style={[scheda, { padding: 12, backgroundColor: colori.surfaceRaised }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <Text colori={colori} accessible={false} accessibilityElementsHidden importantForAccessibility="no" style={{ fontWeight: '800' }}>ⓘ</Text>
        <Text colori={colori} accessibilityRole="header" style={{ flex: 1, fontWeight: '800' }}>Verifica sempre i turni importati</Text>
      </View>
      <Text colori={colori} style={{ marginTop: 8 }}>Il riconoscimento automatico è uno strumento di supporto che velocizza l’inserimento dei turni, ma può commettere errori o non rilevare alcune informazioni.</Text>
      <Text colori={colori} style={{ marginTop: 8 }}>Controlla sempre date, orari, riposi e postazioni confrontandoli con il prospetto originale. La responsabilità della verifica e della conferma dei dati inseriti resta all’utente.</Text>
    </View>}
  </View>;
  return <View style={{ flex: 1, backgroundColor: colori.background }}>
    <FlatList data={gruppi} keyExtractor={g => g.id} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }} ListHeaderComponent={intestazione}
      ListFooterComponent={<View style={{ marginTop: 12 }}><Button colori={colori} title="Salvataggio definitivo disabilitato" disabled /></View>}
      renderItem={({ item }) => {
        const daVerificare = !contesto.confermato || item.voci.some(r => !r.verificata || avvisi(r).length > 0);
        return <Pressable accessibilityRole="button" accessibilityLabel={`Apri giornata ${dataLeggibile(item.voci[0])}. ${item.voci.map(r => [r.tipo || 'Tipo mancante', r.sigla, r.inizio, r.fine, r.postazione, ...avvisi(r)].filter(Boolean).join(', ')).join('; ')}. ${daVerificare ? 'Da confermare' : 'Verificato'}`}
          accessibilityHint="Apre la modifica di tutti i servizi della giornata" onPress={() => { setIdsAperti(item.voci.map(r => r.id)); setAperta(item.id); setErroreVoce(''); }}
          style={({ pressed }) => [scheda, { paddingVertical: 12, opacity: pressed ? .75 : 1 }]}>
          <Text colori={colori} style={{ fontWeight: '800' }}>{dataLeggibile(item.voci[0])}</Text>
          {item.voci.map(r => <View key={r.id} style={{ marginTop: 5 }}>
            <Text colori={colori}>{r.tipo === 'turno' ? `Turno · ${r.inizio || 'Inizio mancante'}–${r.fine || 'Fine mancante'}` : r.tipo ? `${r.sigla ? `${r.sigla} · ` : ''}${r.tipo}` : r.sigla || 'Tipologia mancante'}{r.postazione ? ` · ${r.postazione}` : r.tipo === 'turno' ? ' · Postazione mancante' : ''}</Text>
            {r.dataFine && r.dataFine !== r.data && <Text colori={colori} style={{ color: colori.textMuted }}>Termina il {r.dataFine.split('-').reverse().join('/')}</Text>}
            {avvisi(r).length > 0 && <Text colori={colori} style={{ color: colori.textMuted }}>{avvisi(r)[0]}</Text>}
          </View>)}
          <Text colori={colori} style={{ color: colori.textMuted, marginTop: 6 }}>{daVerificare ? '○ Da confermare' : '✓ Verificato'} · Modifica ›</Text>
        </Pressable>;
      }} />
    <Modal visible={aperta !== null || scelta !== null} onDismiss={chiudi} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => scelta ? setScelta(null) : chiudi()}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colori.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={{ flex: 1 }}>
        {scelta ? <View style={{ flex: 1, padding: 16 }}>
          <Text colori={colori} accessibilityRole="header" style={{ fontSize: 22, fontWeight: '900' }}>{scelta.titolo}</Text>
          <Button colori={colori} title="Indietro" onPress={() => setScelta(null)} />
          <FlatList data={scelta.valori} keyExtractor={v => v.value} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 34 }}
            renderItem={({ item }) => <Button colori={colori} title={item.label} onPress={() => { scelta.seleziona(item.value); setScelta(null); }} />} />
        </View> : <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={{ padding: 18, paddingBottom: 44 }}>
          <Text colori={colori} accessibilityRole="header" style={{ fontSize: 22, fontWeight: '900' }}>Modifica giornata</Text>
          <Text colori={colori} style={{ color: colori.textMuted }}>Le modifiche restano nell’anteprima anche chiudendo il pannello.</Text>
          <Button colori={colori} title="Chiudi giornata" onPress={chiudi} />
          {!!erroreVoce && <Text colori={colori} accessibilityRole="alert">{erroreVoce}</Text>}
          {vociAperte.map((r, indice) => <View key={r.id} style={scheda}>
            <Text colori={colori} accessibilityRole="header" style={{ fontWeight: '800', fontSize: 18 }}>Voce {indice + 1} · {dataLeggibile(r)}</Text>
            <Text colori={colori} style={{ color: colori.textMuted }}>{r.verificata && contesto.confermato ? '✓ Verificata' : modificate.includes(r.id) ? 'Modificata · Da confermare' : 'Riconosciuta · Da confermare'}</Text>
            {avvisi(r).map(a => <Text colori={colori} key={a} style={{ marginVertical: 4 }}>{a}</Text>)}
            {dataEditor(r, 'data')}
            <Text colori={colori} style={{ marginTop: 10 }}>Tipo di giornata</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(['turno', 'riposo', 'assenza', 'causale'] as const).map(tipo => <Button colori={colori} key={tipo} title={`${r.tipo === tipo ? '✓ ' : ''}${tipo}`} onPress={() => modifica(r.id, {
                tipo, ...(tipo !== 'turno' ? { inizio: null, fine: null, dataFine: null } : {}),
                causale: tipo === 'assenza' || tipo === 'causale' ? r.causale ?? { codice: r.sigla ?? '', descrizione: null, associazioneConfermata: null } : null,
              })} />)}
            </View>
            {!!r.sigla && <Text colori={colori}>Sigla riconosciuta: {r.sigla}</Text>}
            {(r.tipo === 'assenza' || r.tipo === 'causale') && <>
              <Text colori={colori}>Sigla o causale</Text>
              <TextInput accessibilityLabel="Sigla o causale" style={campo} value={r.causale?.codice ?? ''} onChangeText={v => modifica(r.id, { causale: { codice: v, descrizione: r.causale?.descrizione ?? null, associazioneConfermata: null } })} />
              <Text colori={colori}>Significato della sigla</Text>
              <TextInput accessibilityLabel="Significato della sigla" style={campo} value={r.causale?.associazioneConfermata ?? ''} onChangeText={v => modifica(r.id, { causale: { codice: r.causale?.codice ?? r.sigla ?? '', descrizione: r.causale?.descrizione ?? null, associazioneConfermata: v || null } })} />
            </>}
            {r.tipo === 'turno' && <>
              {oraEditor(r, 'inizio')}{oraEditor(r, 'fine')}
              {dataEditor(r, 'dataFine')}
              {r.inizio && r.fine && r.fine <= r.inizio && !r.dataFine && <Text colori={colori}>Conferma la data di fine: il servizio può terminare il giorno successivo.</Text>}
            </>}
            <Text colori={colori}>Postazione</Text>
            {[...new Set(righe.map(v => v.postazione).filter((v): v is string => !!v))].length > 0 && <Button colori={colori} title="Scegli una postazione riconosciuta" onPress={() => scegli('Postazione', [...new Set(righe.map(v => v.postazione).filter((v): v is string => !!v))], v => modifica(r.id, { postazione: v }))} />}
            <TextInput accessibilityLabel={`postazione giorno ${r.giorno}`} multiline style={campo} value={r.postazione ?? ''} onChangeText={v => modifica(r.id, { postazione: v || null })} />
            <Button colori={colori} title="Verifica questa voce" onPress={() => {
              if (!contesto.confermato || problemiDati(r, true).length) { setErroreVoce(!contesto.confermato ? 'Conferma prima periodo e dipendente.' : avvisi(r).join('. ') || 'Controlla i dati della voce.'); return; }
              setErroreVoce(''); setRighe(rs => rs.map(v => v.id === r.id ? { ...v, verificata: true } : v));
            }} />
            <Button colori={colori} title="Aggiungi un servizio nello stesso giorno" onPress={() => {
              const id = `${r.id}/manuale-${++manuale.current}`;
              setRighe(rs => [...rs, { ...r, id, tipo: 'turno', inizio: null, fine: null, dataFine: null, sigla: null, causale: null, verificata: false }]);
              setIdsAperti(ids => [...ids, id]); setModificate(ids => [...ids, id]);
            }} />
            <Button colori={colori} title="Escludi questa voce" onPress={() => setRighe(rs => rs.filter(v => v.id !== r.id))} />
          </View>)}
          {!vociAperte.length && <Text colori={colori}>Tutte le voci di questa giornata sono state escluse.</Text>}
          <Button colori={colori} title="Chiudi giornata" onPress={chiudi} />
        </ScrollView>}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  </View>;
}
