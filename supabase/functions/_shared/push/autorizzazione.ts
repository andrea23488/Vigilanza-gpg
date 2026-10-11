import { eventoValido, contestoValido, tempoValido } from './modello.ts';
export function autorizzaEvento(evento: unknown, contesto: unknown, adesso: number): boolean {
  if (!eventoValido(evento) || !contestoValido(contesto) || !tempoValido(adesso)) return false;
  if (evento.creatoAt > adesso || evento.scadeAt <= adesso || !contesto.sorgenteEsiste
    || contesto.mittenteVerificatoId !== evento.mittenteId || contesto.destinatarioVerificatoId !== evento.destinatarioId
    || contesto.bloccoMittente || contesto.bloccoDestinatario) return false;
  if (evento.tipo === 'messaggio_privato') {
    return contesto.chatEnabled && contesto.collegamentoAccettato && !contesto.messaggioLetto;
  }
  if (evento.tipo === 'richiesta_collegamento') {
    return contesto.collegamentiEnabled && contesto.richiestaStato === 'in_attesa' && !contesto.collegamentoAccettato;
  }
  return false;
}
