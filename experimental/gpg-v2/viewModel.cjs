'use strict';

function formatCents(value) {
  if (value === null || value === undefined || typeof value !== 'string' || !/^-?\d+$/.test(value)) return 'Non disponibile';
  const negative = value.startsWith('-'), digits = value.replace('-', '').padStart(3, '0');
  return (negative ? '-€ ' : '€ ') + digits.slice(0, -2) + ',' + digits.slice(-2);
}
function formatHours(ms) {
  if (!Number.isSafeInteger(ms) || ms < 0) return 'Non disponibili';
  if (ms % 60000 !== 0) return String(ms) + ' ms (precisione subminuto)';
  const minutes = ms / 60000;
  return Math.floor(minutes / 60) + ' h ' + String(minutes % 60).padStart(2, '0') + ' min';
}
const LABELS = {
  ACCOUNT_SNAPSHOT_UNCONFIRMED: 'Il calendario non è confermato per l’account corrente; riaprire lo stipendio dopo il caricamento.',
  EXPERIMENT_DISABLED: 'Il confronto sperimentale è disattivato.',
  VERIFIED_GPG_PROFILE_MISSING: 'Manca un profilo GPG reale verificato.',
  VERIFIED_DOCUMENTARY_PROFILE_REQUIRED: 'Il profilo disponibile non è verificato su fonti contrattuali.',
  DOCUMENTARY_SOURCES_MISSING: 'Mancano le fonti delle regole economiche.',
  SOURCE_REFERENCES_REQUIRED: 'Una regola economica non ha una fonte documentata.',
  HOURLY_RATE_PRECISION_UNRESOLVED: 'La precisione della tariffa oraria deve essere documentata.',
  CATALOG_REVIEW_REQUIRED: 'Il catalogo deve essere revisionato prima del collaudo.',
  PROFILE_REVIEW_RECEIPT_MISSING: 'Manca la revisione del profilo per il criterio di competenza scelto.',
  INTRAMONTH_BASE_COORDINATION_REQUIRED: 'Cambio di livello o tariffa nel mese: occorre coordinare la base mensile.',
  PROFILE_NOT_FOUND: 'Nessun profilo copre azienda, livello, CCNL e periodo richiesti.',
  NONWORK_CAUSE_NOT_SUPPORTED: 'Congedi o altre assenze del periodo non sono ancora supportati dal motore 2.0.',
  SAVED_DURATION_MISMATCH: 'La durata salvata non coincide con gli orari: occorre verificarla.',
  UNLOCALIZED_PAID_EXTRA: 'I minuti retribuiti aggiuntivi non hanno un intervallo temporale.',
  INSUFFICIENT_CONTEXT_COVERAGE: 'Mancano giorni o settimane di contesto ai confini del mese.',
  CONTEXT_COMPLETENESS_REQUIRED: 'La completezza del calendario non è stata confermata.',
  CIVIL_TIME_REVIEW_REQUIRED: 'La base temporale, compreso il cambio di ora, richiede verifica.',
  HOLIDAY_CALENDAR_REVIEW_REQUIRED: 'Il calendario delle festività non è stato confermato.',
  UNKNOWN_RECORD_FIELD: 'Il formato del calendario contiene un campo ancora da verificare.',
  INVALID_OR_UNSUPPORTED_TIME: 'Un turno ha orari mancanti, non validi o non supportati.',
  RUNTIME_NOT_SUPPORTED: 'Il runtime non supera i controlli necessari.',
  PERIOD_MISMATCH: 'I risultati si riferiscono a periodi diversi e non sono confrontabili.',
  MONTHLY_BASE_CONTEXT_REQUIRED: 'La base del mese richiede una verifica delle rettifiche.',
  GPG_ONLY: 'Il confronto riguarda soltanto gli operatori GPG.',
};
function buildViewModel(result) {
  const r = result || {}, legacy = r.legacy || {};
  const showExperimental = r.status === 'readyForPrivateReview' && r.audience === 'privatePreview' && r.experimental?.available === true;
  const reasons = (r.issues || []).map(i => LABELS[i.code] || 'Un dato o una regola richiede verifica prima del confronto.');
  if (r.audience === 'syntheticHarness') reasons.push('Risultato sintetico di laboratorio: non utilizzabile come stipendio.');
  const hours = r.experimental?.hours;
  return { title: 'Confronto stipendio GPG', subtitle: 'Motore 2.0 sperimentale — il sistema attuale resta operativo',
    period: typeof legacy.period === 'string' && /^20\d{2}-(0[1-9]|1[0-2])$/.test(legacy.period) ? legacy.period : 'Periodo non disponibile',
    currentGross: formatCents(legacy.grossCents), currentNet: formatCents(legacy.netEstimateCents),
    newGross: showExperimental ? formatCents(r.experimental.grossCents) : 'Non disponibile',
    grossDifference: showExperimental ? formatCents(r.differences?.grossCents) : 'Non disponibile',
    newNet: 'Non disponibile: nessuna nuova previsione fiscale',
    worked: formatHours(hours?.workedMs), paid: formatHours(hours?.classifiableMs),
    ordinary: formatHours(hours?.ordinaryMs), overtime: formatHours(hours?.overtimeMs),
    reasons: [...new Set(reasons)], status: showExperimental ? 'Disponibile per revisione privata' : 'Calcolo 2.0 non disponibile',
    dataNotice: 'Nessun turno o parametro stipendiale viene modificato.' };
}
module.exports = { buildViewModel, formatCents, formatHours };
