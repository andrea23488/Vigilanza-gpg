import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Button, ScrollView, Text, TextInput, View } from 'react-native';
import { creaAcquisitoreNativo } from './acquisizioneNativa';
import { creaLettoreNativo } from './letturaNativa';
import { creaRegistroRevisioni, creaRevisioneImportazione, suggerisciDipendenti } from './revisione';
import type { RicevutaRevisione } from './revisione';
import type { CanaleAcquisizione } from './acquisizione';
import { datiEffettivi, statoVoce } from './modello';
import type { Bozza, Confronto, DatiVoce, Dipendente, Voce } from './modello';

type Revisione = ReturnType<typeof creaRevisioneImportazione>;
type Anteprima = ReturnType<Revisione['anteprima']>;
export interface ImportaTurniProps {
  /** Matricola aziendale, se nota: non passare automaticamente codice_gpg. */
  identita?: Dipendente;
  registro: ReturnType<typeof creaRegistroRevisioni>;
  /** Deve restituire record aggiornati e normalizzati dello stesso utente. Nessuna scrittura. */
  leggiEsistenti(): Promise<readonly Confronto[]>;
  /** Evento di sola revisione. Questo componente non importa e non salva turni. */
  onBozzaConfermata(bozza: Bozza, ricevuta: RicevutaRevisione): void;
}
const campo = { borderWidth: 1, borderColor: '#777', padding: 8, marginVertical: 4 };
const identitaVuota: Dipendente = { nome: null, cognome: null, matricola: null };

function EditorVoce({ voce, aggiorna, escludi, modificata }: {
  voce: Voce; aggiorna(d: DatiVoce): void; escludi(v: boolean): void; modificata(): void;
}) {
  const [dati, setDati] = useState(() => datiEffettivi(voce));
  const versione = JSON.stringify(voce);
  useEffect(() => { setDati(datiEffettivi(voce)); }, [versione]);
  const edit = (k: keyof DatiVoce, valore: unknown) => { modificata(); setDati(d => ({ ...d, [k]: valore })); };
  return <View style={{ padding: 12, borderWidth: 1, marginVertical: 8 }}>
    <Text>{voce.id} — {statoVoce(voce)}</Text>
    {Object.entries(voce.rilevati).filter(([, c]) => c.testoOriginale).map(([k, c]) =>
      <Text key={k}>{k}: «{c.testoOriginale}» (pagina {c.provenienza.pagina ?? '?'}, {c.provenienza.riferimento ?? '?'})
        {c.alternative.length ? ` — alternative: ${JSON.stringify(c.alternative)}` : ''}</Text>)}
    {(['data', 'dataFine', 'inizio', 'fine', 'postazione'] as const).map(k => <View key={k}>
      <Text>{k}{k.startsWith('data') ? ' (AAAA-MM-GG)' : ''}</Text>
      <TextInput accessibilityLabel={k} style={campo} value={dati[k] ?? ''} editable={!voce.esclusa}
        onChangeText={s => edit(k, s || null)} />
    </View>)}
    <Text>Tipo di voce</Text>
    {(['turno', 'riposo', 'assenza', 'causale'] as const).map(tipo => <Button key={tipo} title={`${dati.tipo === tipo ? '✓ ' : ''}${tipo}`}
      disabled={voce.esclusa} onPress={() => { modificata(); setDati(d => tipo === 'turno' ? { ...d, tipo, causale: null } : {
        ...d, tipo, inizio: null, fine: null, dataFine: null,
        causale: tipo === 'riposo' ? null : d.causale ?? { codice: '', descrizione: null, associazioneConfermata: null },
      }); }} />)}
    {(dati.tipo === 'assenza' || dati.tipo === 'causale') && <>
      <Text>Codice originale</Text>
      <TextInput style={campo} value={dati.causale?.codice ?? ''} onChangeText={s => edit('causale', {
        ...dati.causale, codice: s, descrizione: dati.causale?.descrizione ?? null,
        associazioneConfermata: dati.causale?.associazioneConfermata ?? null,
      })} />
      <Text>Associazione semantica da verificare (nessun trattamento economico)</Text>
      <TextInput style={campo} value={dati.causale?.associazioneConfermata ?? ''} onChangeText={s => edit('causale', {
        codice: dati.causale?.codice ?? '', descrizione: dati.causale?.descrizione ?? null, associazioneConfermata: s || null,
      })} />
    </>}
    <Button title="Conferma questa voce" disabled={voce.esclusa} onPress={() => aggiorna(dati)} />
    <Button title={voce.esclusa ? 'Includi voce' : 'Escludi voce'} onPress={() => escludi(!voce.esclusa)} />
  </View>;
}

/** Schermata autonoma: da montare solo nel futuro punto d'ingresso autorizzato.
 * Nessun import da App.js, API calendario, Supabase o motore economico. */
export default function ImportaTurni(props: ImportaTurniProps) {
  const [acquisitore] = useState(creaAcquisitoreNativo);
  const [lettore] = useState(creaLettoreNativo);
  const sessione = useRef<Revisione | null>(null);
  const [anteprima, setAnteprima] = useState<Anteprima | null>(null);
  const [identita, setIdentita] = useState<Dipendente>(props.identita ?? identitaVuota);
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState('');
  const [puliziaFallita, setPuliziaFallita] = useState(false);
  const [righeScelte, setRigheScelte] = useState<string[]>([]);
  const [mappa, setMappa] = useState<Record<string, string>>({});
  const [pendenti, setPendenti] = useState<string[]>([]);
  const [identitaPendente, setIdentitaPendente] = useState(false);
  const [limiteRighe, setLimiteRighe] = useState(50);
  const [limiteVoci, setLimiteVoci] = useState(50);
  const [selezionePendente, setSelezionePendente] = useState(false);
  const montato = useRef(true), inCorso = useRef(false);
  useEffect(() => { montato.current = true; return () => { montato.current = false; }; }, []);
  const aggiorna = () => {
    if (!montato.current) return;
    const prossima = sessione.current?.anteprima() ?? null;
    setAnteprima(prossima);
    setPendenti(ids => ids.filter(id => prossima?.bozza?.voci.some(v => v.id === id)));
  };
  const strutturaPendente = selezionePendente || Object.values(mappa).some(t => t.trim().length > 0);
  const azione = (f: (s: Revisione) => void) => {
    try { setErrore(''); if (sessione.current) { f(sessione.current); aggiorna(); } }
    catch { setErrore('Operazione non valida: verifica selezione, campi obbligatori e causali.'); }
  };
  async function acquisisci(canale: CanaleAcquisizione, screenshot = false) {
    if (inCorso.current) return;
    inCorso.current = true; setBusy(true); setErrore('');
    try {
      const r = await acquisitore.acquisisci({ canale, tipoImmagine: screenshot ? 'screenshot' : 'immagine' });
      if (r.stato === 'errore') {
        if (montato.current) { setErrore(r.codice); setPuliziaFallita(!r.puliziaRiuscita); }
        return;
      }
      if (r.stato !== 'pronto') return;
      try {
        if (montato.current) { sessione.current = null; setAnteprima(null); }
        const esito = await lettore.leggi(r.documento);
        if (!montato.current) return;
        if (esito.stato === 'bloccato') { setErrore(esito.codice); return; }
        sessione.current = creaRevisioneImportazione(esito.risultato, props.registro);
        setMappa({}); setRigheScelte([]); setPendenti([]); setIdentitaPendente(false); setSelezionePendente(false); setLimiteRighe(50); setLimiteVoci(50);
        setIdentita(props.identita ?? identitaVuota); aggiorna();
      } finally {
        const pulizia = await r.rilascia();
        if (montato.current) setPuliziaFallita(!pulizia.riuscita);
      }
    } catch { if (montato.current) setErrore('LETTURA_FALLITA'); }
    finally { inCorso.current = false; if (montato.current) setBusy(false); }
  }
  async function conferma() {
    if (inCorso.current || !sessione.current || pendenti.length || identitaPendente || strutturaPendente) return;
    inCorso.current = true; setBusy(true); setErrore('');
    try {
      const esistenti = await props.leggiEsistenti();
      if (!montato.current) return;
      const risultato = sessione.current.conferma(true, esistenti);
      aggiorna();
      props.onBozzaConfermata(risultato.bozza, risultato.ricevuta);
    } catch { if (montato.current) setErrore('Conferma bloccata: verificare dipendente, voci, duplicati e conflitti con i turni esistenti.'); }
    finally { inCorso.current = false; if (montato.current) setBusy(false); }
  }
  const suggerimenti = anteprima && props.identita ? suggerisciDipendenti(anteprima.esito.candidati, props.identita) : [];
  return <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
    <Text accessibilityRole="header" style={{ fontSize: 22 }}>Importa turni — revisione</Text>
    <Text>La lettura locale richiede i moduli iOS. Android e PDF scannerizzati non sono supportati in questa versione.
      La conferma produce una bozza revisionata: nessun turno viene salvato nel calendario.</Text>
    <Button title="Scegli PDF o immagine" disabled={busy || puliziaFallita} onPress={() => acquisisci('documento')} />
    <Button title="Fotografia dalla galleria" disabled={busy || puliziaFallita} onPress={() => acquisisci('galleria')} />
    <Button title="Screenshot dalla galleria" disabled={busy || puliziaFallita} onPress={() => acquisisci('galleria', true)} />
    <Button title="Scatta fotografia" disabled={busy || puliziaFallita} onPress={() => acquisisci('fotocamera')} />
    {busy && <ActivityIndicator accessibilityLabel="Lettura o verifica in corso" />}
    {!!errore && <Text accessibilityRole="alert">{errore}</Text>}
    {puliziaFallita && <Button title="Riprova pulizia del file temporaneo" disabled={busy} onPress={async () => {
      const r = await acquisitore.riprovaPulizia(); if (montato.current) setPuliziaFallita(!r.riuscita);
    }} />}
    {anteprima && <View pointerEvents={busy || anteprima.bozza?.conferma ? 'none' : 'auto'}>
      <Text>{anteprima.originale.avvisi.join(' · ')}</Text>
      <Text>Copertura: {anteprima.esito.stato}</Text>
      {anteprima.esito.segnalazioni.map((s, i) => <Text key={i}>{s.codice} — {s.paginaId}/{s.rigaId}</Text>)}
      <Text>Ordine delle date numeriche</Text>
      <Button title="Giorno / mese / anno" onPress={() => azione(s => s.ordineDate('DMY'))} />
      <Button title="Mese / giorno / anno" onPress={() => azione(s => s.ordineDate('MDY'))} />
      <Text>Scegli il dipendente del prospetto</Text>
      {anteprima.esito.candidati.map(c => <Button key={c.id}
        title={[c.rilevati.nome.valore, c.rilevati.cognome.valore, c.rilevati.matricola.valore,
          suggerimenti.some(s => s.id === c.id) ? '(corrispondenza da verificare)' : ''].filter(Boolean).join(' ')}
        onPress={() => azione(s => { s.scegliDipendente(c.id); setIdentita({ nome: c.rilevati.nome.valore,
          cognome: c.rilevati.cognome.valore, matricola: c.rilevati.matricola.valore }); setIdentitaPendente(false); setPendenti([]);
          setRigheScelte([]); setSelezionePendente(false); })} />)}
      <Text>Alternativa manuale: scegli le righe e verifica la loro associazione al dipendente.
        Se mancano le colonne, mappa anche un’intestazione esistente. Usa | tra le celle; lascia vuote le celle mancanti.
        Esempio intestazione: Data|Nome|Matricola|Servizio|Postazione</Text>
      {anteprima.documento.pagine.map(p => <View key={p.id}>
        <Text>Pagina {p.numero ?? '?'}</Text>
        <TextInput style={campo} accessibilityLabel={`Intestazione manuale ${p.id}`} placeholder="Data|Nome|Matricola|Servizio|Postazione"
          value={mappa[`header:${p.id}`] ?? ''} onChangeText={t => setMappa(m => ({ ...m, [`header:${p.id}`]: t }))} />
        <Button title="Aggiungi intestazione manuale" disabled={!mappa[`header:${p.id}`]} onPress={() =>
          azione(s => { s.intestazioneManuale(p.id, mappa[`header:${p.id}`].split('|').map(t => t.trim()));
            setMappa(m => ({ ...m, [`header:${p.id}`]: '' })); setRigheScelte([]); setSelezionePendente(false); })} />
        {p.righe?.slice(0, limiteRighe).map(r => {
          const id = `${p.id}/${r.id}`;
          return <View key={id} style={{ marginVertical: 8 }}>
            <Text selectable>{id}: {r.testo ?? r.celle?.map(c => c.testo).join(' | ')}</Text>
            <Button title={righeScelte.includes(id) ? '✓ Riga selezionata' : 'Seleziona riga'} onPress={() => {
              setSelezionePendente(true); setRigheScelte(ids => ids.includes(id) ? ids.filter(v => v !== id) : [...ids, id]); }} />
            <TextInput accessibilityLabel={`Mappatura ${id}`} style={campo} placeholder="Celle separate da |"
              value={mappa[id] ?? ''} onChangeText={t => setMappa(m => ({ ...m, [id]: t }))} />
            <Button title="Applica mappatura manuale" disabled={!mappa[id]} onPress={() =>
              azione(s => { s.mappaRiga(p.id, r.id, mappa[id].split('|').map(t => t.trim() || null));
                setMappa(m => ({ ...m, [id]: '' })); setRigheScelte([]); setSelezionePendente(false); })} />
          </View>;
        })}
        {(p.righe?.length ?? 0) > limiteRighe && <Button title="Mostra altre 50 righe" onPress={() => setLimiteRighe(n => n + 50)} />}
      </View>)}
      <Button title="Usa le righe selezionate manualmente" disabled={!righeScelte.length}
        onPress={() => azione(s => { s.selezionaRighe(righeScelte); setSelezionePendente(false); })} />
      {(['nome', 'cognome', 'matricola'] as const).map(k => <View key={k}>
        <Text>{k} del dipendente da confermare</Text>
        <TextInput style={campo} value={identita[k] ?? ''} onChangeText={v => { setIdentitaPendente(true); setIdentita(d => ({ ...d, [k]: v || null })); }} />
      </View>)}
      <Button title="Conferma identità del dipendente" disabled={!anteprima.bozza} onPress={() => azione(s => {
        s.correggiDipendente(identita); setIdentitaPendente(false);
      })} />
      {anteprima.bozza?.voci.slice(0, limiteVoci).map(v => <EditorVoce key={v.id} voce={v}
        modificata={() => setPendenti(ids => ids.includes(v.id) ? ids : [...ids, v.id])}
        aggiorna={d => azione(s => { s.correggiVoce(v.id, d); setPendenti(ids => ids.filter(id => id !== v.id)); })}
        escludi={e => azione(s => { s.escludi(v.id, e); setPendenti(ids => ids.filter(id => id !== v.id)); })} />)}
      {(anteprima.bozza?.voci.length ?? 0) > limiteVoci && <Button title="Mostra altre 50 voci" onPress={() => setLimiteVoci(n => n + 50)} />}
      {anteprima.riepilogo && <Text>Giorni: {anteprima.riepilogo.giorni}; servizi: {anteprima.riepilogo.servizi};
        ore nominali provvisorie: {anteprima.riepilogo.oreProgrammate}; esclusi: {anteprima.riepilogo.esclusi};
        intervalli non quantificabili: {anteprima.riepilogo.intervalliNonQuantificabili}.</Text>}
      {anteprima.esito.stato !== 'completo' && <Button title={anteprima.letturaParzialeAccettata
        ? '✓ Lettura parziale accettata' : 'Accetto esplicitamente che pagine o righe non lette restino fuori dalla bozza'}
        onPress={() => azione(s => s.accettaLetturaParziale(true))} />}
      {!!(pendenti.length || identitaPendente || strutturaPendente) && <Text>Applica o svuota le modifiche in corso prima di confermare la bozza.</Text>}
      <Button title="Confermo esplicitamente la bozza e le esclusioni" disabled={!anteprima.bozza || busy || puliziaFallita || !!pendenti.length || identitaPendente || strutturaPendente}
        onPress={conferma} />
    </View>}
    {anteprima?.bozza?.conferma && <Text>Bozza confermata. Nessun turno salvato.</Text>}
  </ScrollView>;
}
