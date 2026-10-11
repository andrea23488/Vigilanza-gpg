export type TipoEvento = 'messaggio_privato' | 'richiesta_collegamento';
export interface Evento { id: string; tipo: TipoEvento; sorgenteId: string; mittenteId: string; destinatarioId: string; creatoAt: number; scadeAt: number }
export interface Dispositivo { id: string; utenteId: string; piattaforma: 'ios' | 'android'; attivo: boolean; bindingVersion: number }
export interface Contesto { mittenteVerificatoId: string; destinatarioVerificatoId: string; sorgenteEsiste: boolean; collegamentoAccettato: boolean; bloccoMittente: boolean; bloccoDestinatario: boolean; messaggioLetto: boolean; richiestaStato: 'in_attesa' | 'accettato' | 'rifiutato'; chatEnabled: boolean; collegamentiEnabled: boolean }
export interface Consegna { chiave: string; eventoId: string; dispositivoId: string; utenteId: string; bindingVersion: number }
const idValido = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(v);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export const tempoValido = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
export function eventoValido(v: unknown): v is Evento {
  if (!record(v)) return false;
  // La coda logica non ammette contenuti privati o campi extra.
  if (Object.keys(v).some(k => !['id','tipo','sorgenteId','mittenteId','destinatarioId','creatoAt','scadeAt'].includes(k))) return false;
  return ['id','sorgenteId','mittenteId','destinatarioId'].every(k => idValido(v[k])) && v.mittenteId !== v.destinatarioId
    && typeof v.tipo === 'string' && (v.tipo === 'messaggio_privato' || v.tipo === 'richiesta_collegamento')
    && tempoValido(v.creatoAt) && tempoValido(v.scadeAt) && v.scadeAt > v.creatoAt;
}
export function dispositivoValido(v: unknown): v is Dispositivo {
  return record(v) && Object.keys(v).every(k => ['id','utenteId','piattaforma','attivo','bindingVersion'].includes(k))
    && idValido(v.id) && idValido(v.utenteId) && ['ios','android'].includes(String(v.piattaforma)) && typeof v.attivo === 'boolean'
    && typeof v.bindingVersion === 'number' && Number.isSafeInteger(v.bindingVersion) && v.bindingVersion > 0;
}
export function contestoValido(v: unknown): v is Contesto {
  return record(v) && idValido(v.mittenteVerificatoId) && idValido(v.destinatarioVerificatoId)
    && ['sorgenteEsiste','collegamentoAccettato','bloccoMittente','bloccoDestinatario','messaggioLetto','chatEnabled','collegamentiEnabled'].every(k => typeof v[k] === 'boolean')
    && ['in_attesa','accettato','rifiutato'].includes(String(v.richiestaStato));
}
export function chiaveConsegna(eventoId: string, dispositivoId: string): string { return JSON.stringify([eventoId, dispositivoId]); }
export function consegnaValida(v: unknown): v is Consegna {
  return record(v) && ['eventoId','dispositivoId','utenteId'].every(k => idValido(v[k]))
    && v.chiave === chiaveConsegna(String(v.eventoId),String(v.dispositivoId))
    && typeof v.bindingVersion === 'number' && Number.isSafeInteger(v.bindingVersion) && v.bindingVersion > 0;
}
