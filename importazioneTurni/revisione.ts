import { interpretaDocumento } from './interpretazione';
import type { CandidatoDipendente, OpzioniInterpretazione } from './interpretazione';
import type { DocumentoLetto } from './lettura';
import type { Bozza, Confronto, DatiVoce, Dipendente } from './modello';
import { confermaBozza, confermaDipendente, confermaVoce, confrontaVoci, creaBozza, escludiVoce, riepilogaBozza } from './modello';

const normalizza = (s: string | null) => s?.trim().replace(/\s+/g, ' ').toLocaleUpperCase('it-IT') ?? '';
const nomeCompleto = (d: Dipendente) => [normalizza(d.nome), normalizza(d.cognome)].filter(Boolean).join(' ');
/** Solo suggerimenti; zeri iniziali preservati, nessun confronto con codice_gpg. */
export function suggerisciDipendenti(candidati: readonly CandidatoDipendente[], identita: Dipendente) {
  return candidati.map(c => {
    const d: Dipendente = { nome: c.rilevati.nome.valore, cognome: c.rilevati.cognome.valore, matricola: c.rilevati.matricola.valore };
    const matricola = !!normalizza(identita.matricola) && normalizza(identita.matricola) === normalizza(d.matricola);
    const nome = !!nomeCompleto(identita) && nomeCompleto(identita) === nomeCompleto(d);
    const discordanza = !!normalizza(identita.matricola) && !!normalizza(d.matricola) && !matricola;
    return { id: c.id, corrispondenza: matricola ? 'matricola' : nome ? 'nome' : null, discordanza };
  }).filter(c => c.corrispondenza !== null);
}
export interface RicevutaRevisione {
  impronta: string;
  dipendente: Dipendente;
  revisione: number;
  stato: 'bozza_confermata';
  letturaParzialeAccettata: boolean;
}
function congela<T>(v: T): T {
  if (v && typeof v === 'object') { Object.values(v).forEach(congela); Object.freeze(v); }
  return v;
}
const copia = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const chiaveDocumento = (impronta: string, d: Dipendente) => JSON.stringify([impronta,
  // Con matricola, correzioni ortografiche al nome non eludono il filtro.
  normalizza(d.matricola) ? ['matricola', normalizza(d.matricola)] : ['nome', nomeCompleto(d)]]);
/** Registro in memoria delle revisioni confermate, non prova di salvataggio nel calendario. */
export function creaRegistroRevisioni(iniziali: readonly RicevutaRevisione[] = []) {
  const chiavi = new Set(iniziali.map(r => chiaveDocumento(r.impronta, r.dipendente)));
  return {
    contiene(impronta: string, d: Dipendente) { return chiavi.has(chiaveDocumento(impronta, d)); },
    registra(r: RicevutaRevisione) {
      const key = chiaveDocumento(r.impronta, r.dipendente);
      if (chiavi.has(key)) throw new Error('DOCUMENTO_GIA_CONFERMATO');
      chiavi.add(key);
    },
  };
}
/** Nessuna funzione di salvataggio. Il chiamante fornisce gli esistenti dello stesso utente. */
export function creaRevisioneImportazione(input: DocumentoLetto, registro: ReturnType<typeof creaRegistroRevisioni>) {
  const originale = congela(copia(input));
  let documento = copia(input.documento);
  let opzioni: OpzioniInterpretazione = {};
  let esito = interpretaDocumento(documento, opzioni);
  let bozza = esito.bozza;
  let letturaParzialeAccettata = false;
  const mappature = new Map<string, readonly (string | null)[]>();
  const riparti = () => {
    esito = interpretaDocumento(documento, opzioni);
    bozza = esito.bozza;
    // Nei campi mappati dall'utente, l'evidenza resta la riga sorgente, non il testo corretto.
    if (bozza && mappature.size) {
      const evidenza = <T extends Record<string, any>>(campi: T): T => Object.fromEntries(Object.entries(campi).map(([k, c]) => {
        const p = originale.documento.pagine.find(p => p.numero === c.provenienza.pagina);
        const r = p?.righe?.find(r => c.provenienza.riferimento === r.id || c.provenienza.riferimento?.startsWith(`${r.id}/`));
        const manuale = p && r && mappature.has(`${p.id}/${r.id}`);
        return [k, manuale ? { ...c, testoOriginale: r.testo ?? r.celle?.map(c => c.testo ?? '').join(' | ') ?? '', affidabilita: null } : c];
      })) as T;
      const voci = bozza.voci.map(v => ({ id: v.id, rilevati: evidenza(v.rilevati) }));
      bozza = creaBozza({ ...bozza, dipendente: evidenza(bozza.dipendente.rilevati), voci });
    }
    letturaParzialeAccettata = false;
  };
  const cambiaOpzioni = (nuove: OpzioniInterpretazione) => {
    const precedenti = opzioni;
    opzioni = nuove;
    try { riparti(); } catch (e) { opzioni = precedenti; throw e; }
  };
  const richiedi = (): Bozza => { if (!bozza) throw new Error('NESSUNA_BOZZA'); return bozza; };
  return {
    anteprima() {
      return congela(copia({ originale, documento, esito, bozza,
        mappature: [...mappature].map(([riga, celle]) => ({ riga, celle })),
        letturaParzialeAccettata, riepilogo: bozza ? riepilogaBozza(bozza) : null }));
    },
    ordineDate(ordine: 'DMY' | 'MDY' | null) { cambiaOpzioni({ ...opzioni, ordineDate: ordine }); },
    scegliDipendente(id: string) { cambiaOpzioni({ ordineDate: opzioni.ordineDate, dipendenteId: id }); },
    selezionaRighe(righe: readonly string[]) {
      cambiaOpzioni({ ordineDate: opzioni.ordineDate, righeManuali: [...righe] });
    },
    accettaLetturaParziale(esplicita: boolean) {
      if (esplicita !== true) throw new Error('ACCETTAZIONE_PARZIALE_OBBLIGATORIA');
      letturaParzialeAccettata = true;
    },
    intestazioneManuale(paginaId: string, celle: readonly string[]) {
      if (!documento.pagine.some(p => p.id === paginaId) || celle.length < 1 || celle.length > 100 || celle.some(c => typeof c !== 'string' || c.length > 100)) throw new Error('INTESTAZIONE_NON_VALIDA');
      documento = { ...documento, pagine: documento.pagine.map(p => p.id !== paginaId ? p : { ...p, righe: [
        { id: 'intestazione-manuale-2d', testo: null, confidenza: null, rettangolo: null,
          celle: celle.map((testo, i) => ({ id: `c-${i}`, testo, confidenza: null, rettangolo: null })) },
        ...(p.righe ?? []).filter(r => r.id !== 'intestazione-manuale-2d'),
      ] }) };
      mappature.set(`${paginaId}/intestazione-manuale-2d`, [...celle]);
      opzioni = { ordineDate: opzioni.ordineDate }; riparti();
    },
    /** Correzione strutturale esplicita. Array con null per celle vuote, mai split su spazi. */
    mappaRiga(paginaId: string, rigaId: string, celle: readonly (string | null)[]) {
      if (celle.length < 1 || celle.length > 100 || celle.some(c => c !== null && (typeof c !== 'string' || c.length > 10_000))) throw new Error('MAPPATURA_NON_VALIDA');
      const riga = documento.pagine.find(p => p.id === paginaId)?.righe?.find(r => r.id === rigaId);
      if (!riga) throw new Error('RIGA_NON_PRESENTE');
      const aggiornate = celle.map((testo, i) => ({ id: `manuale-${i + 1}`, testo, confidenza: null, rettangolo: null }));
      documento = { ...documento, pagine: documento.pagine.map(p => p.id !== paginaId ? p : { ...p,
        righe: p.righe!.map(r => r.id !== rigaId ? r : { ...r, celle: aggiornate }) }) };
      mappature.set(`${paginaId}/${rigaId}`, [...celle]);
      // Candidati e ID possono essere cambiati: nessuna selezione precedente sopravvive.
      opzioni = { ordineDate: opzioni.ordineDate }; riparti();
    },
    correggiDipendente(d: Dipendente) { bozza = confermaDipendente(richiedi(), d); },
    correggiVoce(id: string, d: DatiVoce) { bozza = confermaVoce(richiedi(), id, d); },
    escludi(id: string, esclusa: boolean) { bozza = escludiVoce(richiedi(), id, esclusa); },
    conflitti(esistenti: readonly Confronto[]) { return confrontaVoci(richiedi(), esistenti); },
    conferma(esplicita: boolean, esistenti: readonly Confronto[]) {
      // Nessun default []: il chiamante deve fornire consapevolmente lo snapshot del calendario.
      if (!Array.isArray(esistenti)) throw new Error('ESISTENTI_OBBLIGATORI');
      if (esito.stato !== 'completo' && !letturaParzialeAccettata) throw new Error('LETTURA_PARZIALE_DA_ACCETTARE');
      const b = richiedi(), d = b.dipendente.confermati;
      if (d && registro.contiene(originale.impronta, d)) throw new Error('DOCUMENTO_GIA_CONFERMATO');
      const confermata = confermaBozza(b, esplicita, esistenti);
      const ricevuta = congela(copia({ impronta: originale.impronta, dipendente: confermata.dipendente.confermati!,
        revisione: confermata.revisione, stato: 'bozza_confermata' as const, letturaParzialeAccettata }));
      registro.registra(ricevuta);
      bozza = confermata;
      return congela({ bozza: confermata, ricevuta });
    },
  };
}
