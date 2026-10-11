import { eventoValido, dispositivoValido, consegnaValida, contestoValido, chiaveConsegna } from './modello.ts';
import type { Evento, Dispositivo, Consegna, Contesto } from './modello.ts';

// Adattatori di forma, NON verifiche JWT, sessione, proprieta' o autorizzazione.
// Le righe devono provenire in futuro da letture server attendibili.
// Gli ID bigint vanno letti dal database come testo, prima della deserializzazione:
// un number gia' arrotondato non e' recuperabile e viene sempre rifiutato.
export type Esito<T> = { ok: true; valore: T } | { ok: false; codice: 'input_non_valido' };
const rifiuta = (): { ok: false; codice: 'input_non_valido' } => ({ ok: false, codice: 'input_non_valido' });
// Contiene soltanto le operazioni su input non attendibili. La logica del
// modello resta fuori dal catch, per non nascondere errori di programmazione.
const leggiRecord = (v: unknown): Record<string, unknown> | undefined => {
  try {
    if (v === null || typeof v !== 'object') return undefined;
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) return undefined;
    const descrittori = Object.getOwnPropertyDescriptors(v);
    const copia: Record<string, unknown> = Object.create(null);
    for (const chiave of Object.keys(descrittori)) {
      if (!('value' in descrittori[chiave])) return undefined;
      Object.defineProperty(copia, chiave, {value: Reflect.get(v, chiave), enumerable: descrittori[chiave].enumerable});
    }
    return copia;
  } catch { return undefined; }
};
const uuid = (v: unknown): v is string => typeof v === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  && v !== '00000000-0000-0000-0000-000000000000';
const normalizzaUuid = (v: string): string => v.toLowerCase();
export function bigintIdDaSql(v: unknown): Esito<string> {
  // Solo rappresentazioni canoniche non negative: coerenti con sorgenteId del motore.
  if (typeof v !== 'string' || !/^(0|[1-9][0-9]{0,18})$/.test(v) || BigInt(v) > 9223372036854775807n) return rifiuta();
  return { ok: true, valore: v };
}
export function versioneDaSql(v: unknown): Esito<number> {
  if (typeof v === 'number') return Number.isSafeInteger(v) && v > 0 ? { ok: true, valore: v } : rifiuta();
  if (typeof v !== 'string' || !/^[1-9][0-9]{0,15}$/.test(v) || BigInt(v) > BigInt(Number.MAX_SAFE_INTEGER)) return rifiuta();
  return { ok: true, valore: Number(v) };
}
export function dataPostgresInMillisecondi(v: unknown): Esito<number> {
  // timestamptz testuale, zona obbligatoria; rifiuta Date/number, infinity e BC.
  if (typeof v !== 'string') return rifiuta();
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}(?::?\d{2})?)$/.exec(v);
  if (!m) return rifiuta();
  const [anno,mese,giorno,ore,minuti,secondi] = m.slice(1,7).map(Number);
  if (anno < 1970 || mese < 1 || mese > 12 || giorno < 1 || ore > 23 || minuti > 59 || secondi > 59) return rifiuta();
  const bisestile = anno % 4 === 0 && (anno % 100 !== 0 || anno % 400 === 0);
  const giorni = [31,bisestile ? 29 : 28,31,30,31,30,31,31,30,31,30,31];
  if (giorno > giorni[mese-1]) return rifiuta();
  const zona = m[8]; let offset = 0;
  if (zona !== 'Z') {
    const z = zona.slice(1).replace(':',''); const h = Number(z.slice(0,2)), n = Number(z.slice(2) || '0');
    if (h > 14 || n > 59 || (h === 14 && n !== 0)) return rifiuta();
    offset = (h * 60 + n) * (zona[0] === '+' ? 1 : -1);
  }
  // Precisione del modello: millisecondi. Tronca soltanto le cifre submillisecondo
  // validate; non arrotonda in avanti. Il futuro invio richiede verifica SQL esatta.
  const ms = Number((m[7] || '').padEnd(3,'0').slice(0,3));
  const valore = Date.UTC(anno,mese-1,giorno,ore,minuti,secondi,ms) - offset * 60000;
  return Number.isSafeInteger(valore) && valore >= 0 ? { ok: true, valore } : rifiuta();
}
export function tipoEventoValido(v: unknown): v is Evento['tipo'] {
  return v === 'messaggio_privato' || v === 'richiesta_collegamento';
}
export function piattaformaValida(v: unknown): v is Dispositivo['piattaforma'] {
  return v === 'ios' || v === 'android';
}
export function statoRichiestaValido(v: unknown): v is Contesto['richiestaStato'] {
  return v === 'in_attesa' || v === 'accettato' || v === 'rifiutato';
}
export function adattaEvento(input: unknown): Esito<Evento> {
  const riga = leggiRecord(input);
  if (!riga || !uuid(riga.id) || !uuid(riga.mittente_id) || !uuid(riga.destinatario_id) || !tipoEventoValido(riga.tipo)) return rifiuta();
  const messaggio = riga.tipo === 'messaggio_privato';
  if ((messaggio ? riga.collegamento_id : riga.messaggio_id) !== null) return rifiuta();
  const id = bigintIdDaSql(messaggio ? riga.messaggio_id : riga.collegamento_id);
  const creato = dataPostgresInMillisecondi(riga.created_at), scade = dataPostgresInMillisecondi(riga.expires_at);
  if (!id.ok || !creato.ok || !scade.ok) return rifiuta();
  const valore: Evento = { id: normalizzaUuid(riga.id), tipo: riga.tipo, sorgenteId: id.valore,
    mittenteId: normalizzaUuid(riga.mittente_id), destinatarioId: normalizzaUuid(riga.destinatario_id), creatoAt: creato.valore, scadeAt: scade.valore };
  return eventoValido(valore) ? { ok: true, valore } : rifiuta();
}
export function adattaDispositivo(input: unknown): Esito<Dispositivo> {
  const riga = leggiRecord(input);
  if (!riga || !uuid(riga.id) || !uuid(riga.user_id) || !piattaformaValida(riga.piattaforma) || typeof riga.attivo !== 'boolean') return rifiuta();
  const versione = versioneDaSql(riga.binding_version); if (!versione.ok) return rifiuta();
  const valore: Dispositivo = {id:normalizzaUuid(riga.id),utenteId:normalizzaUuid(riga.user_id),piattaforma:riga.piattaforma,attivo:riga.attivo,bindingVersion:versione.valore};
  // Progetto, ambiente, scadenza, credenziale e sessione NON sono controllati qui:
  // l'oggetto logico non e' una prova di idoneita' all'invio.
  return dispositivoValido(valore) ? { ok: true, valore } : rifiuta();
}
export function adattaConsegna(input: unknown, inputEvento: unknown, inputDispositivo: unknown): Esito<Consegna> {
  const riga = leggiRecord(input), evento = leggiRecord(inputEvento), dispositivo = leggiRecord(inputDispositivo);
  if (!riga || !evento || !dispositivo || !piattaformaValida(dispositivo.piattaforma)
    || !eventoValido(evento) || !dispositivoValido(dispositivo) || !uuid(riga.evento_id) || !uuid(riga.dispositivo_id) || !uuid(riga.destinatario_id)) return rifiuta();
  const versione = versioneDaSql(riga.binding_version); if (!versione.ok) return rifiuta();
  const eventoId=normalizzaUuid(riga.evento_id), dispositivoId=normalizzaUuid(riga.dispositivo_id), utenteId=normalizzaUuid(riga.destinatario_id);
  if (eventoId !== evento.id || dispositivoId !== dispositivo.id || utenteId !== evento.destinatarioId
    || utenteId !== dispositivo.utenteId || versione.valore !== dispositivo.bindingVersion) return rifiuta();
  const valore: Consegna = {chiave:chiaveConsegna(eventoId,dispositivoId),eventoId,dispositivoId,utenteId,bindingVersion:versione.valore};
  return consegnaValida(valore) ? {ok:true,valore} : rifiuta();
}
export function adattaContesto(riga: unknown): Esito<Contesto> {
  // Input gia' assemblato da future letture server, NON dichiarazioni del client.
  const input = leggiRecord(riga);
  if (!input || !uuid(input.mittenteVerificatoId) || !uuid(input.destinatarioVerificatoId)
    || !statoRichiestaValido(input.richiestaStato)
    || !['sorgenteEsiste','collegamentoAccettato','bloccoMittente','bloccoDestinatario','messaggioLetto','chatEnabled','collegamentiEnabled'].every(k=>typeof input[k]==='boolean')) return rifiuta();
  const valore: Contesto = {
    mittenteVerificatoId:normalizzaUuid(input.mittenteVerificatoId),destinatarioVerificatoId:normalizzaUuid(input.destinatarioVerificatoId),
    sorgenteEsiste:input.sorgenteEsiste as boolean,collegamentoAccettato:input.collegamentoAccettato as boolean,
    bloccoMittente:input.bloccoMittente as boolean,bloccoDestinatario:input.bloccoDestinatario as boolean,
    messaggioLetto:input.messaggioLetto as boolean,richiestaStato:input.richiestaStato,
    chatEnabled:input.chatEnabled as boolean,collegamentiEnabled:input.collegamentiEnabled as boolean,
  };
  return contestoValido(valore) ? {ok:true,valore} : rifiuta();
}
