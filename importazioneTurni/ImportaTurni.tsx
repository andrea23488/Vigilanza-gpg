import React, { useState } from 'react';
import { ActivityIndicator, Button, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
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
interface PropsComuni {
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
const campo = { borderWidth: 1, borderColor: '#94A3B8', padding: 10, marginVertical: 4, borderRadius: 6 };
const vuoto: Dipendente = { nome: null, cognome: null, matricola: null };

/** Solo anteprima locale: nessun percorso di conferma/salvataggio definitivo. */
export default function ImportaTurni(props: ImportaTurniProps) {
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
    setRighe(prossime);
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
  const modifica = (id: string, patch: Partial<RigaAnteprima>) => setRighe(rs => rs.map(r => r.id === id ? { ...r, ...patch, verificata: false } : r));
  return <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: '700' }}>Anteprima turni</Text>
    <Text>Controlla e modifica i dati riconosciuti. Il salvataggio definitivo è disabilitato.</Text>
    <Button title="Scegli PDF o immagine" disabled={busy || pulizia} onPress={() => acquisisci('documento')} />
    <Button title="Scegli o ritaglia foto / screenshot" disabled={busy || pulizia} onPress={() => acquisisci('galleria')} />
    <Button title="Fotografa il prospetto" disabled={busy || pulizia} onPress={() => acquisisci('fotocamera')} />
    {busy && <ActivityIndicator accessibilityLabel="Lettura in corso" />}
    {!!errore && <Text accessibilityRole="alert">{errore}</Text>}
    {pulizia && <Button title="Riprova chiusura del documento" onPress={async () => { setPulizia(!(await acquisitore.riprovaPulizia()).riuscita); }} />}
    {originale && <>
      <Text style={{ fontWeight: '700', marginTop: 16 }}>Conferma periodo e dipendente</Text>
      {candidati.map(c => <Button key={c.id} title={`Usa dipendente: ${[c.rilevati.nome.valore, c.rilevati.cognome.valore, c.rilevati.matricola.valore].filter(Boolean).join(' ')}`} onPress={() => {
        const prossimo = { ...contesto, candidatoId: c.id, confermato: false, dipendente: { nome: c.rilevati.nome.valore, cognome: c.rilevati.cognome.valore, matricola: c.rilevati.matricola.valore } };
        setContesto(prossimo); riconosci(originale, prossimo, regione);
      }} />)}
      <Text>Per i giorni senza data completa indica mese e anno. Le sigle richiedono una verifica separata.</Text>
      {(['mese', 'anno'] as const).map(k => <View key={k}><Text>{k === 'mese' ? 'Mese (1–12)' : 'Anno (4 cifre)'}</Text>
        <TextInput accessibilityLabel={k} style={campo} keyboardType="number-pad" value={contesto[k]}
          onChangeText={v => setContesto(c => ({ ...c, [k]: v, confermato: false }))} /></View>)}
      {(['nome', 'cognome', 'matricola'] as const).map(k => <View key={k}><Text>{k}</Text>
        <TextInput accessibilityLabel={k} style={campo} value={contesto.dipendente[k] ?? ''}
          onChangeText={v => setContesto(c => ({ ...c, confermato: false, dipendente: { ...c.dipendente, [k]: v || null } }))} /></View>)}
      <Button title={contesto.confermato ? 'Periodo e dipendente confermati' : 'Conferma periodo e dipendente e rileggi'} disabled={busy}
        onPress={() => {
          if (!/^(?:[1-9]|1[0-2])$/.test(contesto.mese) || !/^[1-9]\d{3}$/.test(contesto.anno) || !Object.values(contesto.dipendente).some(v => v?.trim())) {
            setErrore('Indica un mese valido, l’anno e il dipendente.'); return;
          }
          const c = { ...contesto, confermato: true }; setContesto(c); setErrore(''); riconosci(originale, c, regione);
        }} />
      <Text>La rilettura sostituisce l’anteprima: completa prima la selezione e il periodo, poi modifica i turni.</Text>
      {raw && <>
        <Button title="Seleziona solo la regione del prospetto" onPress={() => { setSeleziona(!seleziona); setAngolo(null); }} />
        {seleziona && <>
          <Text>Schema del testo estratto: tocca l’angolo in alto a sinistra e poi quello in basso a destra del prospetto.</Text>
          {raw.pagine.map(p => <Button key={p.numero} title={`Pagina ${p.numero}`} onPress={() => { setPagina(p.numero); setAngolo(null); }} />)}
          <View onLayout={e => { larghezzaSchema.current = e.nativeEvent.layout.width; }}>
            <Pressable accessibilityLabel="Selezione regione del prospetto" style={{ height: 400, backgroundColor: '#EDF2F7', overflow: 'hidden' }} onPress={e => {
              const x = Math.max(0, Math.min(1, e.nativeEvent.locationX / larghezzaSchema.current));
              const y = Math.max(0, Math.min(1, e.nativeEvent.locationY / 400));
              if (!angolo) { setAngolo({ x, y }); return; }
              const r = { pagina, x: Math.min(x, angolo.x), y: Math.min(y, angolo.y), larghezza: Math.abs(x - angolo.x), altezza: Math.abs(y - angolo.y) };
              if (r.larghezza < .02 || r.altezza < .02) { setErrore('Seleziona una regione più ampia.'); setAngolo(null); return; }
              setRegione(r); setAngolo(null); setSeleziona(false); riconosci(originale, contesto, r);
            }}>
              {raw.pagine.find(p => p.numero === pagina)?.elementi.map(t => t.rettangolo && <Text pointerEvents="none" key={t.id}
                style={{ position: 'absolute', left: `${t.rettangolo[0] * 100}%`, top: `${t.rettangolo[1] * 100}%`, fontSize: 8 }}>{t.testo}</Text>)}
              {angolo && <View pointerEvents="none" style={{ position: 'absolute', left: `${angolo.x * 100}%`, top: `${angolo.y * 100}%`, width: 10, height: 10, backgroundColor: '#2563EB' }} />}
            </Pressable>
          </View>
        </>}
        {regione && <Button title="Usa di nuovo l’intero documento" onPress={() => { setRegione(undefined); riconosci(originale, contesto); }} />}
      </>}
      {!righe.length && <View><Text>Non riusciamo a riconoscere i turni. Seleziona solo il prospetto oppure prova il PDF originale o una foto più nitida. Per prospetti con più dipendenti seleziona la regione di una sola persona.</Text>
        <Button title="Riprova lettura" onPress={() => riconosci(originale, contesto, regione)} /></View>}
      {righe.map(r => <View key={r.id} style={{ borderWidth: 1, borderColor: '#CBD5E1', padding: 12, marginVertical: 8 }}>
        <Text style={{ fontWeight: '700' }}>Giorno {r.giorno}{r.verificata ? ' · Verificato' : ' · Da verificare'}</Text>
        {!!r.sigla && <Text>Sigla «{r.sigla}»: scegli il significato corretto.</Text>}
        {(['data', 'inizio', 'fine', 'dataFine', 'postazione'] as const).map(k => <View key={k}>
          <Text>{{ data: 'Data (AAAA-MM-GG)', inizio: 'Inizio', fine: 'Fine', dataFine: 'Data fine (per turni notturni)', postazione: 'Postazione' }[k]}</Text>
          <TextInput accessibilityLabel={`${k} giorno ${r.giorno}`} style={campo} value={r[k] ?? ''} onChangeText={v => modifica(r.id, { [k]: v || null })} />
        </View>)}
        <Text>Tipo</Text>
        {(['turno', 'riposo', 'assenza', 'causale'] as const).map(tipo => <Button key={tipo} title={`${r.tipo === tipo ? '✓ ' : ''}${tipo}`} onPress={() => modifica(r.id, {
          tipo, ...(tipo !== 'turno' ? { inizio: null, fine: null, dataFine: null } : {}),
          causale: tipo === 'assenza' || tipo === 'causale' ? { codice: r.sigla ?? '', descrizione: null, associazioneConfermata: null } : null,
        })} />)}
        {(r.tipo === 'assenza' || r.tipo === 'causale') && <TextInput accessibilityLabel="Significato della sigla" placeholder="Conferma il significato della sigla" style={campo}
          value={r.causale?.associazioneConfermata ?? ''} onChangeText={v => modifica(r.id, { causale: { codice: r.sigla ?? r.causale?.codice ?? '', descrizione: null, associazioneConfermata: v || null } })} />}
        {r.tipo === 'turno' && r.inizio && r.fine && r.fine <= r.inizio && !r.dataFine && <Text>Verifica la data di fine: il servizio può terminare il giorno successivo.</Text>}
        <Button title="Verifica questa voce" onPress={() => {
          if (!contesto.confermato || problemiDati(r, true).length) { setErrore('Conferma periodo e dipendente, poi controlla data, tipo, orari, postazione e significato delle sigle.'); return; }
          setErrore(''); setRighe(rs => rs.map(v => v.id === r.id ? { ...v, verificata: true } : v));
        }} />
        <Button title="Aggiungi un servizio nello stesso giorno" onPress={() => setRighe(rs => [...rs, { ...r, id: `${r.id}/manuale-${Date.now()}`, tipo: 'turno', inizio: null, fine: null, dataFine: null, sigla: null, causale: null, verificata: false }])} />
        <Button title="Escludi questa voce" onPress={() => setRighe(rs => rs.filter(v => v.id !== r.id))} />
      </View>)}
    </>}
    <Button title="Salvataggio definitivo disabilitato" disabled />
  </ScrollView>;
}
