import { creaBozza, datoEstratto, problemiDati, datiEffettivi } from './modello';
import type { Bozza, CampiEstratti, Causale, DatiVoce, Dipendente, TipoVoce, Voce } from './modello';
import { normalizzaData, normalizzaOra, normalizzaRettangolo } from './documenti';
import type { DocumentoEstratto, EvidenzaDocumento, PaginaDocumento, RigaDocumento, SegnalazioneDocumento } from './documenti';

type Token = EvidenzaDocumento & { originale?: string | null; riferimento: string; pagina: PaginaDocumento; riga: RigaDocumento };
type Ruolo = 'data' | 'dataFine' | 'inizio' | 'fine' | 'contenuto' | 'postazione' | 'nome' | 'cognome' | 'matricola';
type Colonne = Partial<Record<Ruolo, number>>;
export interface CandidatoDipendente {
  id: string;
  rilevati: CampiEstratti<Dipendente>;
  riferimenti: readonly string[];
}
export interface EsitoInterpretazione {
  /** Copia integra dell'input, inclusi testo e metadati non interpretati. */
  documento: DocumentoEstratto;
  stato: 'completo' | 'parziale' | 'illeggibile' | 'non_supportato';
  candidati: readonly CandidatoDipendente[];
  selezioneRichiesta: boolean;
  bozza: Bozza | null;
  segnalazioni: readonly SegnalazioneDocumento[];
}
export interface OpzioniInterpretazione {
  ordineDate?: 'DMY' | 'MDY' | null;
  /** Scelta del chiamante, mai una conferma utente registrata nel modello. */
  dipendenteId?: string;
}
const etichette: Record<string, Ruolo> = {
  data: 'data', giorno: 'data', date: 'data', 'data fine': 'dataFine',
  inizio: 'inizio', entrata: 'inizio', dalle: 'inizio', fine: 'fine', uscita: 'fine', alle: 'fine',
  servizio: 'contenuto', turno: 'contenuto', orario: 'contenuto', causale: 'contenuto', assenza: 'contenuto',
  postazione: 'postazione', sede: 'postazione', posto: 'postazione',
  nome: 'nome', dipendente: 'nome', cognome: 'cognome', matricola: 'matricola', badge: 'matricola',
};
const pulisci = (s: string | null | undefined) => s?.trim().toLocaleLowerCase('it-IT').replace(/\s+/g, ' ') ?? '';
const copia = <T>(v: T): T => JSON.parse(JSON.stringify(v));
function congela<T>(v: T): T {
  if (v && typeof v === 'object') { Object.values(v).forEach(congela); Object.freeze(v); }
  return v;
}
function celle(r: RigaDocumento, p: PaginaDocumento): Token[] {
  if (r.celle !== null) return r.celle.map(c => ({ ...c, riferimento: `${r.id}/${c.id}`, pagina: p, riga: r }));
  // Segmenti testuali derivati: non si fabbricano celle o coordinate nell'input.
  if (!r.testo || !/[|;\t]/.test(r.testo)) return [];
  return r.testo.split(/[|;\t]/).map(testo => ({ testo, confidenza: r.confidenza,
    rettangolo: null, riferimento: r.id, pagina: p, riga: r }));
}
export function interpretaDocumento(input: DocumentoEstratto, opzioni: OpzioniInterpretazione = {}): EsitoInterpretazione {
  const doc = copia(input), problemi: SegnalazioneDocumento[] = [];
  const segnala = (codice: string, t?: Token, campo: string | null = null, pagina?: PaginaDocumento) => {
    problemi.push({ codice, paginaId: t?.pagina.id ?? pagina?.id ?? null, rigaId: t?.riga.id ?? null, campo });
  };
  if (!doc.id || !['pdf', 'immagine', 'screenshot'].includes(doc.tipo)) throw new Error('Documento non valido.');
  if (doc.pagineAttese !== null && (!Number.isInteger(doc.pagineAttese) || doc.pagineAttese < 0)) throw new Error('Numero pagine attese invalido.');
  const idPagine = new Set<string>(), idRighe = new Set<string>();
  for (const p of doc.pagine) {
    if (!p.id || idPagine.has(p.id)) throw new Error('ID pagina mancante o duplicato.');
    idPagine.add(p.id);
    if (p.numero !== null && (!Number.isInteger(p.numero) || p.numero < 1)) throw new Error('Numero pagina invalido.');
    for (const r of p.righe ?? []) {
      const id = `${p.id}/${r.id}`;
      if (!r.id || idRighe.has(id)) throw new Error('ID riga mancante o duplicato.');
      idRighe.add(id);
      const ids = new Set<string>();
      for (const c of r.celle ?? []) {
        if (!c.id || ids.has(c.id)) throw new Error('ID cella mancante o duplicato.');
        ids.add(c.id);
      }
      for (const e of [r, ...(r.celle ?? [])]) {
        if (e.confidenza !== null && (!Number.isFinite(e.confidenza) || e.confidenza < 0 || e.confidenza > 1)) throw new Error('Confidenza invalida.');
      }
    }
  }
  if (doc.pagineAttese !== null && doc.pagineAttese !== doc.pagine.length) segnala('pagine_incomplete_o_incoerenti');
  const dato = <T>(valore: T | null, t?: Token, alternative: readonly T[] = []) => {
    const rettangolo = t ? normalizzaRettangolo(t, t.pagina) : null;
    if (t?.rettangolo && !rettangolo) segnala('coordinate_non_verificabili', t);
    return datoEstratto<T>(valore, t?.originale ?? t?.testo ?? '', { sorgenteId: doc.id,
      pagina: t?.pagina.numero ?? null, riferimento: t?.riferimento ?? null, rettangolo },
      t?.confidenza ?? null, alternative);
  };
  const candidati = new Map<string, CandidatoDipendente>();
  const voci: { voce: { id: string; rilevati: CampiEstratti<DatiVoce> }; candidato: string | null }[] = [];
  const identita = (ts: Token[], c: Colonne): string | null => {
    const token = (k: Ruolo) => c[k] === undefined ? undefined : ts[c[k]!];
    const n = token('nome'), co = token('cognome'), ma = token('matricola');
    const valore = (t?: Token) => t?.testo?.trim() || null;
    const d: Dipendente = { nome: valore(n), cognome: valore(co), matricola: valore(ma) };
    if (!Object.values(d).some(Boolean)) return null;
    const id = JSON.stringify([pulisci(d.nome), pulisci(d.cognome), pulisci(d.matricola)]);
    const riferimento = `${ts[0]?.pagina.id}/${ts[0]?.riga.id}`;
    const precedente = candidati.get(id);
    if (precedente) {
      candidati.set(id, { ...precedente, riferimenti: [...new Set([...precedente.riferimenti, riferimento])] });
    } else candidati.set(id, { id, rilevati: { nome: dato(d.nome, n), cognome: dato(d.cognome, co), matricola: dato(d.matricola, ma) }, riferimenti: [riferimento] });
    return id;
  };
  const leggiVoce = (ts: Token[], c: Colonne, dataToken: Token | undefined, contenuto: Token | undefined, candidato: string | null, suffisso: string) => {
    const token = (k: Ruolo) => c[k] === undefined ? undefined : ts[c[k]!];
    const base = dataToken ?? contenuto ?? ts[0];
    if (!base) return;
    const data = normalizzaData(dataToken?.testo ?? null, opzioni.ordineDate ?? null);
    if (data.problema) segnala(data.problema, base, 'data');
    const testo = contenuto?.testo?.trim() ?? '';
    let tipo: TipoVoce | null = null, causale: Causale | null = null;
    let ti = token('inizio'), tf = token('fine'), td = token('dataFine');
    const frammento = (originale: Token, testo: string): Token => ({ ...originale, originale: originale.originale ?? originale.testo, testo });
    // Celle orario intere, con eventuale data finale esplicita. Nessun testo ignorato.
    const pattern = /^(\d{1,2}[:.]\d{2})\s*[-–—/]\s*(\d{1,2}[:.]\d{2})(?:\s+(?:del|al)\s+(\d{4}-\d{2}-\d{2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4}))?$/;
    const pezzi = contenuto ? testo.split(/\s*\+\s*/) : [];
    if (pezzi.length > 1 && pezzi.every(s => pattern.test(s))) {
      for (let i = 0; i < pezzi.length; i++) leggiVoce(ts, c, dataToken, frammento(contenuto!, pezzi[i]), candidato, `${suffisso}/servizio-${i + 1}`);
      return;
    }
    const intervallo = pattern.exec(testo);
    if (intervallo && contenuto) {
      if (ti?.testo?.trim() || tf?.testo?.trim()) segnala('orari_concorrenti_da_verificare', contenuto);
      else {
        ti = frammento(contenuto, intervallo[1]); tf = frammento(contenuto, intervallo[2]);
        if (intervallo[3]) td = frammento(contenuto, intervallo[3]);
      }
      tipo = 'turno';
    } else if (ti?.testo?.trim() || tf?.testo?.trim()) {
      tipo = 'turno';
      if (testo) segnala('contenuto_e_orari_da_verificare', contenuto);
    } else if (testo) {
      const s = pulisci(testo);
      if (['riposo', 'riposo settimanale'].includes(s)) tipo = 'riposo';
      else {
        tipo = ['ferie', 'malattia', 'permesso', 'assenza'].includes(s) ? 'assenza' : 'causale';
        causale = { codice: testo, descrizione: null, associazioneConfermata: null };
        segnala(tipo === 'assenza' ? 'assenza_da_confermare' : 'codice_sconosciuto', contenuto, 'causale');
      }
    } else segnala('contenuto_mancante', base);
    const inizio = normalizzaOra(ti?.testo ?? null), fine = normalizzaOra(tf?.testo ?? null);
    let dataFine = td ? normalizzaData(td.testo, opzioni.ordineDate ?? null) : null;
    if (tipo === 'turno') {
      if (inizio.problema) segnala(inizio.problema, ti ?? base, 'inizio');
      if (fine.problema) segnala(fine.problema, tf ?? base, 'fine');
      if (!td && data.valore && inizio.valore && fine.valore) {
        if (fine.valore > inizio.valore) {
          // Conseguenza deterministica degli orari nella data indicata, mai conferma.
          dataFine = { ...data, originale: null };
          segnala('data_fine_derivata_stessa_giornata', base, 'dataFine');
        } else segnala(fine.valore === inizio.valore ? 'durata_ambigua' : 'notte_data_fine_da_verificare', base, 'dataFine');
      }
      if (dataFine?.problema) segnala(dataFine.problema, td ?? base, 'dataFine');
    }
    const notteProposta = tipo === 'turno' && !td && data.valore && inizio.valore && fine.valore && fine.valore < inizio.valore
      ? new Date(Date.parse(`${data.valore}T00:00:00Z`) + 86400000).toISOString().slice(0, 10) : null;
    const p = token('postazione');
    const rilevati: CampiEstratti<DatiVoce> = {
      data: dato(data.valore, dataToken, data.alternative), tipo: dato(tipo, contenuto ?? ti),
      inizio: dato(tipo === 'turno' ? inizio.valore : null, ti), fine: dato(tipo === 'turno' ? fine.valore : null, tf),
      dataFine: dato(tipo === 'turno' ? dataFine?.valore ?? null : null, td ?? (dataFine?.valore && dataToken ? { ...dataToken, confidenza: null } : undefined), notteProposta ? [notteProposta] : dataFine?.alternative ?? []),
      postazione: dato(p?.testo?.trim() || null, p), causale: dato(causale, contenuto),
    };
    if (tipo === 'turno' && dataFine?.valore && data.valore && dataFine.valore !== data.valore) segnala('attraversamento_mezzanotte', base);
    const id = `${ts[0].pagina.id}/${ts[0].riga.id}/${suffisso}`;
    const voce = { id, rilevati };
    problemiDati(datiEffettivi({ ...voce, confermati: null, esclusa: false } as Voce), true).forEach(codice => segnala(codice, base));
    voci.push({ voce, candidato });
  };
  for (const p of doc.pagine) {
    if (p.errore) segnala('errore_estrazione_pagina', undefined, null, p);
    if (!p.righe?.length) { segnala(p.testo?.trim() ? 'testo_senza_struttura' : 'pagina_senza_testo', undefined, null, p); continue; }
    let colonne: Colonne | null = null;
    let dateMatrice: { indice: number; t: Token }[] = [];
    for (const r of p.righe) {
      const ts = celle(r, p);
      if (!ts.length) { segnala('riga_senza_struttura', undefined, null, p); continue; }
      const ruoli: Colonne = {}, duplicati = new Set<Ruolo>();
      ts.forEach((t, i) => { const ruolo = etichette[pulisci(t.testo)]; if (ruolo) { if (ruoli[ruolo] !== undefined) duplicati.add(ruolo); ruoli[ruolo] = i; } });
      const date = ts.map((t, indice) => ({ indice, t })).filter(({ t }) => {
        const n = normalizzaData(t.testo, opzioni.ordineDate ?? null); return n.valore !== null || n.alternative.length > 0 || /^\d{1,4}[/.\-]\d{1,2}(?:[/.\-]\d{1,4})?$/.test(t.testo?.trim() ?? '');
      });
      const identitaHeader = ruoli.nome !== undefined || ruoli.cognome !== undefined || ruoli.matricola !== undefined;
      if ((ruoli.data !== undefined && (ruoli.contenuto !== undefined || ruoli.inizio !== undefined || ruoli.fine !== undefined)) || (identitaHeader && date.length > 0)) {
        if (duplicati.size) { colonne = null; dateMatrice = []; segnala('intestazione_ambigua', ts[0]); continue; }
        colonne = ruoli; dateMatrice = ruoli.data === undefined ? date : [];
        ts.forEach((t, i) => {
          if (!Object.values(ruoli).includes(i) && !dateMatrice.some(d => d.indice === i)) segnala('colonna_senza_ruolo', t);
        });
        continue;
      }
      if (!colonne) { segnala('intestazione_non_riconosciuta', ts[0]); continue; }
      const candidato = identita(ts, colonne);
      if (!candidato) segnala('dipendente_non_identificato', ts[0]);
      if (dateMatrice.length) {
        for (const d of dateMatrice) leggiVoce(ts, colonne, d.t, ts[d.indice], candidato, `colonna-${d.indice}`);
      } else leggiVoce(ts, colonne, colonne.data === undefined ? undefined : ts[colonne.data],
        colonne.contenuto === undefined ? undefined : ts[colonne.contenuto], candidato, 'voce');
    }
  }
  const elenco = [...candidati.values()];
  for (const c of elenco) {
    const omonimi = elenco.filter(a => a.id !== c.id &&
      pulisci(a.rilevati.nome.valore) === pulisci(c.rilevati.nome.valore) &&
      pulisci(a.rilevati.cognome.valore) === pulisci(c.rilevati.cognome.valore) &&
      !!(c.rilevati.nome.valore || c.rilevati.cognome.valore));
    if (omonimi.length) segnala('omonimi_selezione_obbligatoria');
    if (!c.rilevati.matricola.valore) segnala('identita_senza_matricola_da_verificare');
  }
  const scelto = opzioni.dipendenteId ? candidati.get(opzioni.dipendenteId) : elenco.length === 1 ? elenco[0] : null;
  if (opzioni.dipendenteId && !scelto) throw new Error('Dipendente selezionato non presente.');
  const selezioneRichiesta = elenco.length > 1 && !scelto;
  if (selezioneRichiesta) segnala('selezione_dipendente_obbligatoria');
  const incluse = selezioneRichiesta ? [] : voci.filter(v => scelto ? v.candidato === scelto.id : v.candidato === null);
  if (scelto && voci.some(v => v.candidato === null)) segnala('voci_senza_dipendente_non_associate');
  const ignoto: CampiEstratti<Dipendente> = { nome: dato<string>(null), cognome: dato<string>(null), matricola: dato<string>(null) };
  if (doc.testoOriginale === null) segnala('testo_originale_documento_non_disponibile');
  const bozza = incluse.length ? creaBozza({ id: doc.id, sorgenti: [{ id: doc.id, tipo: doc.tipo, testoOriginale: doc.testoOriginale ?? '' }],
    dipendente: scelto?.rilevati ?? ignoto, voci: incluse.map(v => v.voce) }) : null;
  const strutturali = new Set(['errore_estrazione_pagina', 'pagina_senza_testo', 'testo_senza_struttura', 'riga_senza_struttura',
    'intestazione_non_riconosciuta', 'intestazione_ambigua', 'colonna_senza_ruolo', 'pagine_incomplete_o_incoerenti', 'voci_senza_dipendente_non_associate']);
  const testoPresente = doc.testoOriginale?.trim() || doc.pagine.some(p => p.testo?.trim() || p.righe?.some(r => r.testo?.trim() || r.celle?.some(c => c.testo?.trim())));
  const stato = voci.length ? problemi.some(p => strutturali.has(p.codice)) ? 'parziale' : 'completo' : testoPresente ? 'non_supportato' : 'illeggibile';
  return congela({ documento: doc, stato, candidati: elenco, selezioneRichiesta, bozza, segnalazioni: problemi });
}
