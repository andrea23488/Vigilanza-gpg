/** Modello puro: nessun accesso a file, rete, calendario o stipendi. */
export type TipoSorgente = 'pdf' | 'immagine' | 'screenshot';
export type TipoVoce = 'turno' | 'riposo' | 'assenza' | 'causale';
export interface Provenienza {
  sorgenteId: string;
  pagina: number | null;
  riferimento: string | null;
  rettangolo: readonly [number, number, number, number] | null;
}
export interface DatoEstratto<T> {
  valore: T | null;
  testoOriginale: string;
  affidabilita: number | null;
  alternative: readonly T[];
  provenienza: Provenienza;
}
export interface Dipendente {
  nome: string | null;
  cognome: string | null;
  matricola: string | null;
}
export interface Causale {
  codice: string;
  descrizione: string | null;
  /** Associazione semantica scelta dall'utente, mai una regola retributiva. */
  associazioneConfermata: string | null;
}
export interface DatiVoce {
  data: string | null;
  tipo: TipoVoce | null;
  inizio: string | null;
  fine: string | null;
  dataFine: string | null;
  postazione: string | null;
  causale: Causale | null;
}
export type CampiEstratti<T> = { readonly [K in keyof T]: DatoEstratto<T[K]> };
export interface Voce {
  readonly id: string;
  readonly rilevati: CampiEstratti<DatiVoce>;
  readonly confermati: DatiVoce | null;
  readonly esclusa: boolean;
}
export interface Bozza {
  readonly versione: 1;
  readonly id: string;
  readonly sorgenti: readonly { id: string; tipo: TipoSorgente; testoOriginale: string }[];
  readonly dipendente: {
    rilevati: CampiEstratti<Dipendente>;
    confermati: Dipendente | null;
  };
  readonly voci: readonly Voce[];
  readonly conferma: { esplicita: true; revisione: number } | null;
  readonly revisione: number;
}
export interface Problema { voceId: string | null; codice: string }
export interface Confronto { id: string; dati: DatiVoce }
export interface Conflitto {
  tipo: 'duplicato' | 'sovrapposizione' | 'giornata_incompatibile';
  voceId: string;
  altraId: string;
  origine: 'bozza' | 'esistente';
}

function congela<T>(valore: T): T {
  if (valore && typeof valore === 'object') {
    Object.values(valore).forEach(congela);
    Object.freeze(valore);
  }
  return valore;
}
function copia<T>(valore: T): T {
  // Il contratto è JSON: copie separate dall'input e serializzazione portabile.
  return JSON.parse(JSON.stringify(valore));
}
function testo(v: unknown): v is string { return typeof v === 'string' && v.trim().length > 0; }
function giorno(v: string | null): number | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const t = Date.parse(`${v}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v ? t : null;
}
function minuti(v: string | null): number | null {
  if (!v || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) return null;
  return Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
}

export function datoEstratto<T>(
  valore: T | null, testoOriginale: string, provenienza: Provenienza,
  affidabilita: number | null = null, alternative: readonly T[] = [],
): DatoEstratto<T> {
  if (affidabilita !== null && (!Number.isFinite(affidabilita) || affidabilita < 0 || affidabilita > 1)) {
    throw new Error('Affidabilità fuori intervallo 0–1.');
  }
  return congela(copia({ valore, testoOriginale, provenienza, affidabilita, alternative }));
}

export function valoriRilevati<T>(campi: CampiEstratti<T>): T {
  const risultato: Record<string, unknown> = {};
  for (const [chiave, campo] of Object.entries(campi) as [string, DatoEstratto<unknown>][]) {
    risultato[chiave] = campo.valore;
  }
  return copia(risultato) as T;
}
export function datiEffettivi(voce: Voce): DatiVoce {
  return voce.confermati ?? valoriRilevati(voce.rilevati);
}

/** Date nominali del prospetto, non timestamp reali: nessuna conversione di fuso/DST. */
export function intervalloVoce(d: DatiVoce): { inizio: number; fine: number } | null {
  const data = giorno(d.data), dataFine = giorno(d.dataFine);
  const inizio = minuti(d.inizio), fine = minuti(d.fine);
  if (d.tipo !== 'turno' || data === null || dataFine === null || inizio === null || fine === null) return null;
  const a = data + inizio * 60000, b = dataFine + fine * 60000;
  // Nessun giorno successivo implicito, nessun turno di 24 ore dedotto.
  return b > a && b - a < 86400000 ? { inizio: a, fine: b } : null;
}
export function problemiDati(d: DatiVoce, confermati = false): string[] {
  const errori: string[] = [];
  if (giorno(d.data) === null) errori.push('data_mancante_o_invalida');
  if (!['turno', 'riposo', 'assenza', 'causale'].includes(d.tipo ?? '')) errori.push('tipo_mancante_o_invalido');
  if (d.tipo === 'turno') {
    if (!intervalloVoce(d)) errori.push('intervallo_mancante_o_ambiguo');
    if (!testo(d.postazione)) errori.push('postazione_mancante');
    if (d.causale !== null) errori.push('causale_su_turno_da_verificare');
  } else if (d.tipo) {
    if (d.inizio !== null || d.fine !== null || d.dataFine !== null) errori.push('orari_su_non_turno');
    if (d.tipo === 'riposo' && d.causale !== null) errori.push('causale_su_riposo_da_verificare');
    if ((d.tipo === 'assenza' || d.tipo === 'causale') &&
        (!d.causale || !testo(d.causale.codice) || (confermati && !testo(d.causale.associazioneConfermata)))) {
      errori.push('causale_irrisolta');
    }
  }
  return errori;
}

export function creaBozza(input: {
  id: string; sorgenti: Bozza['sorgenti']; dipendente: CampiEstratti<Dipendente>;
  voci: readonly { id: string; rilevati: CampiEstratti<DatiVoce> }[];
}): Bozza {
  if (!testo(input.id) || !input.sorgenti.length || !input.voci.length) throw new Error('Bozza vuota o senza identificativo.');
  const sorgenti = new Set<string>();
  for (const s of input.sorgenti) {
    if (!testo(s.id) || sorgenti.has(s.id) || !['pdf', 'immagine', 'screenshot'].includes(s.tipo)) throw new Error('Sorgente invalida o duplicata.');
    sorgenti.add(s.id);
  }
  const ids = new Set<string>();
  for (const v of input.voci) {
    if (!testo(v.id) || ids.has(v.id)) throw new Error('Identificativo voce invalido o duplicato.');
    ids.add(v.id);
    if (v.rilevati.causale?.valore?.associazioneConfermata != null) throw new Error('Il dato estratto non può contenere un mapping confermato.');
  }
  for (const campi of [input.dipendente, ...input.voci.map(v => v.rilevati)]) {
    for (const c of Object.values(campi) as DatoEstratto<unknown>[]) {
      if (!sorgenti.has(c.provenienza.sorgenteId)) throw new Error('Provenienza sconosciuta.');
      if (c.affidabilita !== null && (!Number.isFinite(c.affidabilita) || c.affidabilita < 0 || c.affidabilita > 1)) throw new Error('Affidabilità invalida.');
      if (c.provenienza.pagina !== null && (!Number.isInteger(c.provenienza.pagina) || c.provenienza.pagina < 1)) throw new Error('Pagina invalida.');
    }
  }
  return congela(copia({ versione: 1, id: input.id, sorgenti: input.sorgenti,
    dipendente: { rilevati: input.dipendente, confermati: null },
    voci: input.voci.map(v => ({ ...v, confermati: null, esclusa: false })),
    revisione: 0, conferma: null }));
}
function revisiona(bozza: Bozza, modifiche: Partial<Bozza>): Bozza {
  return congela(copia({ ...bozza, ...modifiche, revisione: bozza.revisione + 1, conferma: null }));
}
export function confermaDipendente(bozza: Bozza, dipendente: Dipendente): Bozza {
  if (![dipendente.nome, dipendente.cognome, dipendente.matricola].some(testo)) throw new Error('Identità mancante.');
  return revisiona(bozza, { dipendente: { ...bozza.dipendente, confermati: dipendente },
    voci: bozza.voci.map(v => ({ ...v, confermati: null })) });
}
export function confermaVoce(bozza: Bozza, id: string, dati: DatiVoce): Bozza {
  if (!bozza.voci.some(v => v.id === id)) throw new Error('Voce sconosciuta.');
  if (problemiDati(dati, true).length) throw new Error('Voce incompleta o causale irrisolta.');
  return revisiona(bozza, { voci: bozza.voci.map(v => v.id === id ? { ...v, confermati: dati } : v) });
}
export function escludiVoce(bozza: Bozza, id: string, esclusa: boolean): Bozza {
  if (!bozza.voci.some(v => v.id === id)) throw new Error('Voce sconosciuta.');
  return revisiona(bozza, { voci: bozza.voci.map(v => v.id === id ? { ...v, esclusa } : v) });
}
export function statoVoce(voce: Voce): 'rilevata' | 'da_verificare' | 'confermata' | 'esclusa' {
  if (voce.esclusa) return 'esclusa';
  if (voce.confermati) return 'confermata';
  const incerti = Object.values(voce.rilevati).some(c =>
    c.alternative.length > 0 || (c.valore !== null && (c.affidabilita === null || c.affidabilita < 0.9)));
  return incerti || problemiDati(datiEffettivi(voce), true).length ? 'da_verificare' : 'rilevata';
}
function chiave(d: DatiVoce): string | null {
  if (problemiDati(d).length) return null;
  return JSON.stringify([d.data, d.tipo, d.inizio, d.fine, d.dataFine,
    d.postazione?.trim().toLocaleUpperCase('it-IT') ?? null,
    d.causale?.codice.trim().toLocaleUpperCase('it-IT') ?? null]);
}
/** Gli esistenti sono forniti dal chiamante, già limitati allo stesso dipendente. */
export function confrontaVoci(bozza: Bozza, esistenti: readonly Confronto[] = []): Conflitto[] {
  const risultato: Conflitto[] = [];
  const attive = bozza.voci.filter(v => !v.esclusa);
  const confronta = (v: Voce, altro: Confronto, origine: Conflitto['origine']) => {
    const a = datiEffettivi(v), b = altro.dati;
    const ka = chiave(a), kb = chiave(b);
    let tipo: Conflitto['tipo'] | null = null;
    if (ka && ka === kb) tipo = 'duplicato';
    else {
      const ia = intervalloVoce(a), ib = intervalloVoce(b);
      if (ia && ib && ia.inizio < ib.fine && ib.inizio < ia.fine) tipo = 'sovrapposizione';
      else {
        const giornoA = giorno(a.data), giornoB = giorno(b.data);
        const occupaGiorno = (i: { inizio: number; fine: number } | null, g: number | null) =>
          i !== null && g !== null && i.inizio < g + 86400000 && g < i.fine;
        if ((giornoA !== null && a.data === b.data && (a.tipo !== 'turno' || b.tipo !== 'turno')) ||
            (a.tipo !== 'turno' && occupaGiorno(ib, giornoA)) ||
            (b.tipo !== 'turno' && occupaGiorno(ia, giornoB))) tipo = 'giornata_incompatibile';
      }
    }
    if (tipo) risultato.push({ tipo, voceId: v.id, altraId: altro.id, origine });
  };
  attive.forEach((v, i) => {
    attive.slice(i + 1).forEach(a => confronta(v, { id: a.id, dati: datiEffettivi(a) }, 'bozza'));
    esistenti.forEach(a => confronta(v, a, 'esistente'));
  });
  return risultato;
}
export function riepilogaBozza(bozza: Bozza) {
  const attive = bozza.voci.filter(v => !v.esclusa);
  const dati = attive.map(datiEffettivi);
  const intervalli = attive.filter(v => datiEffettivi(v).tipo === 'turno').map(v => {
    const ambiguo = !v.confermati && ['data', 'inizio', 'fine', 'dataFine'].some(
      k => v.rilevati[k as keyof DatiVoce].alternative.length > 0);
    return ambiguo ? null : intervalloVoce(datiEffettivi(v));
  });
  const minutiProgrammati = intervalli.reduce((tot, i) => tot + (i ? (i.fine - i.inizio) / 60000 : 0), 0);
  return {
    giorni: new Set(dati.map(d => d.data).filter(d => giorno(d) !== null)).size,
    servizi: dati.filter(d => d.tipo === 'turno').length,
    minutiProgrammati, oreProgrammate: minutiProgrammati / 60,
    intervalliNonQuantificabili: intervalli.filter(i => !i).length,
    daVerificare: attive.filter(v => statoVoce(v) === 'da_verificare').length,
    esclusi: bozza.voci.length - attive.length,
  };
}
export function problemiConferma(bozza: Bozza, esistenti: readonly Confronto[] = []): Problema[] {
  const errori: Problema[] = [];
  if (!bozza.dipendente.confermati) errori.push({ voceId: null, codice: 'dipendente_non_confermato' });
  const attive = bozza.voci.filter(v => !v.esclusa);
  if (!attive.length) errori.push({ voceId: null, codice: 'nessuna_voce_inclusa' });
  for (const v of attive) {
    if (!v.confermati) errori.push({ voceId: v.id, codice: 'voce_non_confermata' });
    problemiDati(datiEffettivi(v), true).forEach(codice => errori.push({ voceId: v.id, codice }));
  }
  confrontaVoci(bozza, esistenti).forEach(c => errori.push({ voceId: c.voceId, codice: c.tipo }));
  return errori;
}
/** Attesta solo la revisione. Non produce payload e non salva alcun dato. */
export function confermaBozza(bozza: Bozza, esplicita: boolean, esistenti: readonly Confronto[] = []): Bozza {
  if (esplicita !== true) throw new Error('Conferma esplicita obbligatoria.');
  if (problemiConferma(bozza, esistenti).length) throw new Error('Risolvere o escludere le voci da verificare.');
  return congela(copia({ ...bozza, conferma: { esplicita: true, revisione: bozza.revisione } }));
}
export function prontaPerFuturoSalvataggio(bozza: Bozza, esistenti: readonly Confronto[] = []): boolean {
  return bozza.conferma?.esplicita === true && bozza.conferma.revisione === bozza.revisione &&
    problemiConferma(bozza, esistenti).length === 0;
}
