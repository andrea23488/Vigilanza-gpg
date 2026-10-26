import { creaAnteprimaRapidi } from './turniRapidiAnteprima';
import { rilevaSovrapposizioniGiornaliere } from './turniCalcoli';

export const LIMITE_ELIMINAZIONE_RAPIDA = 'Annulla ed eliminazione rapida non disponibili: non è possibile escludere modifiche da un altro dispositivo. Usa la gestione originale del singolo turno.';
const copy = value => JSON.parse(JSON.stringify(value));
const fingerprint = row => JSON.stringify(Object.keys(row).sort().map(k => [k, row[k]]));
const idValido = id => (typeof id === 'string' && !!id.trim()) || (typeof id === 'number' && Number.isFinite(id));
const corrisponde = (row, payload) => row && ['anno','mese','giorno','ore','extra','minuti_aggiuntivi_retribuiti'].every(k => Number(row[k]) === Number(payload[k])) &&
  row.tipo === payload.tipo && (payload.tipo !== 'turno' || ['inizio','fine'].every(k => String(row[k] || '').slice(0,5) === payload[k])) &&
  ['luogo','indirizzo_servizio','localita_meteo','fascia'].every(k => String(row[k] ?? '').trim() === String(payload[k] ?? '').trim()) &&
  row.riposo_lavorato === payload.riposo_lavorato &&
  (!Object.prototype.hasOwnProperty.call(payload,'straordinario_manuale_minuti') ||
    (payload.straordinario_manuale_minuti == null ? row.straordinario_manuale_minuti == null : Number(row.straordinario_manuale_minuti) === Number(payload.straordinario_manuale_minuti)));

// Nessun import di API/storage: tutti gli effetti sono servizi iniettati.
// L'istanza vive nell'App, così un ritorno alla Home non perde il blocco in corso.
export function creaCoordinatoreTurniRapidi(servizi) {
  let busy = false, uncertain = null, lastCreated = null;
  const confirmed = new Map(), listeners = new Set();
  let state = { status:'idle', busy:false, pendingDate:null, lastId:null, uncertain:false, message:'' };
  const canRemove = typeof servizi.removeIfUnchanged === 'function';
  const context = () => servizi.context();
  const sameUser = ctx => !!ctx?.userId && context()?.userId === ctx.userId;
  const sameContext = ctx => sameUser(ctx) && context().configKey === ctx.configKey;
  const emit = patch => {
    state = { ...state, ...patch, busy, lastId:lastCreated?.row.id ?? null, uncertain:!!uncertain };
    for (const listener of listeners) listener(getState());
  };
  function getState() {
    const ctx = {...context()};
    if (state.userId && state.userId !== ctx?.userId) return {status:'idle',busy,pendingDate:null,lastId:null,uncertain:false,message:'',canUndo:false,canDelete:canRemove,deleteReason:canRemove?'':LIMITE_ELIMINAZIONE_RAPIDA};
    return {...state, canUndo:canRemove && !!lastCreated && !busy && !uncertain,
      canDelete:canRemove, deleteReason:canRemove?'':LIMITE_ELIMINAZIONE_RAPIDA};
  }
  const start = ctx => {
    busy = true; servizi.onBusy?.(true);
    if (state.userId !== ctx.userId) { uncertain = null; lastCreated = null; confirmed.clear(); }
    emit({userId:ctx.userId});
  };
  const finish = () => { busy = false; servizi.onBusy?.(false); emit({pendingDate:null}); };
  const publish = (rows, ctx) => { if (sameUser(ctx)) servizi.publish(copy(rows), ctx.userId); };
  const read = async ctx => {
    const rows = await servizi.read();
    if (!Array.isArray(rows)) throw Error('Elenco turni non valido.');
    if (!sameUser(ctx)) throw Error('Sessione cambiata: operazione interrotta.');
    const merged = rows.map(copy);
    for (const [id, row] of confirmed) {
      if (rows.some(t => String(t.id) === id)) confirmed.delete(id);
      else merged.push(copy(row));
    }
    publish(merged, ctx);
    return merged;
  };
  const reconcile = async ctx => {
    emit({status:'checking',message:'Verifica dell’esito sul server…'});
    try {
      const rows = await read(ctx);
      if (uncertain && rows.some(t => corrisponde(t, uncertain.payload))) {
        uncertain = null; lastCreated = null;
        emit({status:'reconciled',message:'Elenco aggiornato: un turno corrispondente è presente. Nessun nuovo invio automatico; Annulla non disponibile per questa richiesta.'});
      } else emit({status:'uncertain',message:'Esito ancora incerto. Nessun nuovo inserimento rapido verrà inviato: aggiorna l’esito prima di proseguire.'});
    } catch {
      emit({status:'uncertain',message:'Esito da verificare: lettura non riuscita. Nessun nuovo invio automatico.'});
    }
    return {status:uncertain?'uncertain':'reconciled'};
  };
  async function verificaEsito() {
    if (busy) return {status:'busy'};
    const ctx = {...context()};
    if (!ctx?.userId || ctx.offline || !uncertain || state.userId !== ctx.userId) return {status:'blocked'};
    start(ctx);
    try { return await reconcile(ctx); } finally { finish(); }
  }
  async function inserisci(model, date) {
    if (busy) return {status:'busy'};
    const ctx = {...context()};
    if (!ctx?.userId || ctx.offline || ctx.saving) return {status:'blocked',message:'Accesso o salvataggio non disponibile.'};
    start(ctx); // Blocco sincrono, prima di qualsiasi await.
    try {
      if (uncertain) return await reconcile(ctx); // Mai POST durante la riconciliazione.
      const selected = copy(model || {});
      emit({status:'checking',pendingDate:date,message:'Controllo del turno…'});
      let rows;
      try { rows = await read(ctx); }
      catch { emit({status:'error',message:'Lettura non riuscita. Nessun turno è stato inviato.'}); return {status:'error'}; }
      if (!sameContext(ctx)) { emit({status:'blocked',message:'Configurazione o sessione cambiata. Tocca nuovamente la data dopo la verifica.'}); return {status:'blocked'}; }
      const preview = creaAnteprimaRapidi({mode:'insert',model:selected,dates:[date],records:rows});
      if (!preview.canConfirm) {
        const message = preview.rows[0]?.reason || 'Turno non inseribile.';
        emit({status:'conflict',message}); return {status:'conflict',message};
      }
      const [anno,mese,giorno] = date.split('-').map(Number);
      let payload;
      try {
        payload = servizi.build({anno,mese:mese-1,giorno,tipo:selected.tipo || 'turno',
          inizio:selected.inizio || '',fine:selected.fine || '',luogo:selected.operativita || '',
          indirizzoServizio:selected.postazione || '',localitaMeteoTurno:'',extra:'0',
          minutiAggiuntiviRetribuiti:'0',modalitaExtraGpg:'automatico',oreExtraGpg:'0',minutiExtraGpg:'0',riposoLavorato:false});
      } catch (error) { emit({status:'error',message:error.message || 'Dati non validi.'}); return {status:'error'}; }
      if (payload.tipo === 'turno' && (Number(payload.ore) <= 0 || rilevaSovrapposizioniGiornaliere([
        ...rows.filter(t=>t.tipo==='turno'), {...payload,id:'rapido-nuovo'},
      ]).length)) {
        emit({status:'conflict',message:'Turni sovrapposti o durata non valida: nessun inserimento.'});
        return {status:'conflict'};
      }
      if (!sameContext(ctx)) return {status:'blocked'};
      emit({status:'saving',message:'Salvataggio del turno…'});
      let saved;
      try {
        saved = await servizi.create(copy(payload));
        if (!sameUser(ctx) || !idValido(saved?.id) || !corrisponde(saved,payload) ||
            (saved.user_id != null && String(saved.user_id) !== String(ctx.userId)) || rows.some(t=>String(t.id)===String(saved.id))) {
          throw Error('Risposta di creazione non identificabile con certezza.');
        }
      } catch (error) {
        if (!sameUser(ctx)) return {status:'blocked'};
        const rejected = error?.codice === 'BACKEND' && error.status >= 400 && error.status < 500 && error.status !== 408;
        if (rejected) { emit({status:'error',message:'Il server ha rifiutato il turno. Nessun successo confermato.'}); return {status:'error'}; }
        uncertain = {payload:copy(payload)}; lastCreated = null;
        emit({status:'uncertain',message:'Esito da verificare. Nessun nuovo invio automatico.'});
        await reconcile(ctx);
        return {status:'uncertain'};
      }
      lastCreated = {row:copy(saved),userId:ctx.userId};
      confirmed.set(String(saved.id),copy(saved));
      publish([...rows,saved],ctx);
      let refreshed = true;
      try { await read(ctx); } catch { refreshed = false; }
      emit({status:'saved',message:refreshed?'Turno salvato.':'Turno salvato; aggiornamento elenco non riuscito. Il record confermato resta visibile.'});
      return {status:'saved',record:copy(saved)};
    } finally { finish(); }
  }
  async function remove(expectedRows, undo = false) {
    if (!canRemove) { emit({message:LIMITE_ELIMINAZIONE_RAPIDA}); return {status:'disabled'}; }
    if (busy) return {status:'busy'};
    const ctx = {...context()};
    if (!ctx?.userId || ctx.offline || ctx.saving || uncertain || !expectedRows.length) return {status:'blocked'};
    if (undo && lastCreated?.userId !== ctx.userId) return {status:'blocked'};
    start(ctx);
    const completed = [];
    try {
      let rows = await read(ctx);
      for (const expected of expectedRows) {
        const matches = rows.filter(t=>String(t.id)===String(expected.id));
        if (!idValido(expected.id) || expected.tipo !== 'turno' || (expected.user_id != null && String(expected.user_id) !== String(ctx.userId)) || matches.length !== 1 || fingerprint(matches[0]) !== fingerprint(expected) || !sameUser(ctx)) {
          emit({status:'blocked',message:'Turno assente o modificato: eliminazione interrotta.'});
          return {status:completed.length?'partial':'blocked',completed};
        }
        // Disponibile solo se il servizio offre confronto e cancellazione atomici.
        // Le API di produzione attuali NON vengono adattate a questa capacità.
        const result = await servizi.removeIfUnchanged(expected.id,copy(expected),ctx.userId);
        if (result?.deleted !== true) { emit({status:'blocked',message:'Turno modificato durante la verifica: nessuna cancellazione confermata.'}); return {status:completed.length?'partial':'blocked',completed}; }
        completed.push(expected.id); confirmed.delete(String(expected.id));
        rows = rows.filter(t=>String(t.id)!==String(expected.id)); publish(rows,ctx);
        if (String(lastCreated?.row.id)===String(expected.id)) lastCreated=null;
      }
      try { await read(ctx); } catch { /* I successi già confermati restano visibili. */ }
      emit({status:'deleted',message:undo?'Ultimo inserimento annullato.':'Turni selezionati eliminati.'});
      return {status:'deleted',completed};
    } catch {
      try { await read(ctx); } catch { /* Nessun nuovo tentativo automatico. */ }
      emit({status:'uncertain',message:'Esito eliminazione da verificare. Nessuna ripetizione automatica.'});
      return {status:completed.length?'partial':'uncertain',completed};
    } finally { finish(); }
  }
  return {
    inserisci, verificaEsito, getState,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    annulla() { return remove(lastCreated ? [copy(lastCreated.row)] : [],true); },
    eliminaSelezionati(rows) { return remove(copy(rows)); },
  };
}
