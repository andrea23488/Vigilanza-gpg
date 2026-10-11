import { autorizzaEvento } from './autorizzazione.ts';
import { eventoValido, dispositivoValido, chiaveConsegna } from './modello.ts';
import type { Consegna, Dispositivo } from './modello.ts';
export function pianificaConsegne(evento: unknown, contesto: unknown, dispositivi: unknown, adesso: number, chiaviEsistenti: readonly string[] = []): Consegna[] {
  if (!eventoValido(evento) || !autorizzaEvento(evento,contesto,adesso) || !Array.isArray(dispositivi)
    || !Array.isArray(chiaviEsistenti) || chiaviEsistenti.some(k => typeof k !== 'string')) return [];
  // Dati ambigui o incompleti: non scegliere arbitrariamente una versione del dispositivo.
  const validati: Dispositivo[] = [];
  for (let i = 0; i < dispositivi.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(dispositivi, i)) return [];
    const d: unknown = dispositivi[i];
    if (!dispositivoValido(d)) return [];
    validati.push(d);
  }
  const versioni = new Map<string,string>();
  for (const d of validati) {
    const firma = JSON.stringify([d.utenteId,d.bindingVersion,d.attivo,d.piattaforma]);
    if (versioni.has(d.id) && versioni.get(d.id) !== firma) return [];
    versioni.set(d.id,firma);
  }
  const viste = new Set(chiaviEsistenti), risultato: Consegna[] = [];
  for (const d of validati) {
    const chiave = chiaveConsegna(evento.id,d.id);
    if (!d.attivo || d.utenteId !== evento.destinatarioId || viste.has(chiave)) continue;
    viste.add(chiave);
    risultato.push({chiave,eventoId:evento.id,dispositivoId:d.id,utenteId:d.utenteId,bindingVersion:d.bindingVersion});
  }
  return risultato;
}
