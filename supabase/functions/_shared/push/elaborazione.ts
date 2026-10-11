import { autorizzaEvento } from './autorizzazione.ts';
import { eventoValido, dispositivoValido, consegnaValida } from './modello.ts';
import { trasportoDisabilitato } from './trasportoDisabilitato.ts';
export function elaboraConsegna(consegna: unknown, evento: unknown, dispositivo: unknown, contesto: unknown, adesso: number) {
  if (!consegnaValida(consegna) || !eventoValido(evento) || !dispositivoValido(dispositivo)
    || !autorizzaEvento(evento,contesto,adesso) || !dispositivo.attivo
    || consegna.eventoId !== evento.id || consegna.dispositivoId !== dispositivo.id
    || consegna.utenteId !== evento.destinatarioId || dispositivo.utenteId !== evento.destinatarioId
    || consegna.bindingVersion !== dispositivo.bindingVersion) return { stato: 'rifiutata', inviata: false } as const;
  return trasportoDisabilitato();
}
export type ErroreSimulato = 'transitorio' | 'token_non_valido' | 'credenziali_non_valide' | 'permanente';
// Simulazione separata: non effettua consegne né modifica dispositivi reali.
export function simulaTentativo(errore: ErroreSimulato, tentativi: number, adesso: number, scadeAt: number) {
  if (!['transitorio','token_non_valido','credenziali_non_valide','permanente'].includes(errore)
    || !Number.isSafeInteger(tentativi) || tentativi < 0 || !Number.isSafeInteger(adesso) || adesso < 0
    || !Number.isSafeInteger(scadeAt) || scadeAt <= adesso) return { stato: 'rifiutata', inviata: false } as const;
  if (errore === 'token_non_valido') return { stato: 'token_da_disattivare_simulato', inviata: false } as const;
  if (errore === 'credenziali_non_valide') return { stato: 'sospesa_simulata', inviata: false } as const;
  const prossimo = adesso + 1000 * 2 ** Math.min(tentativi,5);
  if (errore === 'permanente' || tentativi >= 4 || prossimo >= scadeAt) return { stato: 'conclusa_simulata', inviata: false } as const;
  return { stato: 'retry_simulato', inviata: false, tentativi: tentativi + 1, prossimoAt: prossimo } as const;
}
