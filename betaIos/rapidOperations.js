import { creaAnteprimaRapidi, chiaveRecordRapido } from '../turniRapidiAnteprima';

const cloneRows = rows => rows.map(row => ({ ...row }));
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const equalRows = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const personal = record => record?.origin === 'personal' || record?.tipoAgenda === 'personale' || ['personal', 'personale', 'appuntamento', 'evento'].includes(record?.tipo);

// Pure Beta transaction proposal. It reuses the production planner, but commits
// only into the caller's local fixture store; no API or persistence is imported.
export function prepareRapidInsert(records, model, date, id, allowOccupied = false) {
  const before = cloneRows(records);
  const plan = creaAnteprimaRapidi({ mode: 'insert', model, dates: [date], records: before });
  const row = plan.rows[0];
  if (!row || row.blocked || !row.candidate) return { status: 'blocked', reason: row?.reason || 'Data o modello non validi.', conflicts: row?.conflicts || [], existing: row?.existing || [] };
  if (row.existing.length && !allowOccupied) return { status: 'choice', existing: row.existing, candidate: row.candidate };
  if (before.some(record => String(record.id) === String(id))) return { status: 'blocked', reason: 'Identificativo simulato già utilizzato.', existing: row.existing };
  const [anno, mese, giorno] = date.split('-').map(Number);
  const record = { anno, mese, giorno, ...row.candidate, luogo: model?.operativita || model?.luogo || row.candidate.luogo, id, extra: '0', minuti_aggiuntivi_retribuiti: '0', riposo_lavorato: false };
  return { status: 'inserted', before, records: [...before, record], record, existing: row.existing, action: { type: 'insert', record } };
}

export function prepareRapidDelete(records, key) {
  const before = cloneRows(records);
  const matches = before.filter(record => record.tipo === 'turno' && !personal(record) && chiaveRecordRapido(record) === key);
  if (matches.length !== 1) return { status: 'blocked', reason: matches.length ? 'Turno ambiguo: non è stata applicata alcuna eliminazione.' : 'Il turno selezionato non è più presente.' };
  const record = matches[0];
  return { status: 'deleted', before, records: before.filter(row => row !== record), record, action: { type: 'delete', record } };
}

// Compare-and-swap lets the eventual app adapter use its existing save/delete
// coordinator: publish the new list only after its operation confirms success.
export function commitRapidProposal(current, proposal) {
  if (!proposal || !['inserted', 'deleted'].includes(proposal.status)) return { status: proposal?.status || 'blocked', records: current };
  if (!equalRows(current, proposal.before)) return { status: 'stale', records: current, reason: 'I turni sono cambiati. Riprova sulla data aggiornata.' };
  const operation = { ...proposal.action, before: cloneRows(proposal.before), after: cloneRows(proposal.records) };
  return { status: proposal.status, records: cloneRows(proposal.records), operation };
}

export async function commitRapidWithAdapter(current, proposal, persist) {
  const prepared = commitRapidProposal(current, proposal);
  if (!['inserted', 'deleted'].includes(prepared.status)) return prepared;
  try {
    const result = await persist({ ...prepared.operation, before: cloneRows(prepared.operation.before), after: cloneRows(prepared.operation.after) });
    if (result?.ok !== true) return { status: 'failed', records: current, reason: result?.reason || 'Operazione non confermata; stato locale invariato.' };
    return { ...prepared, records: Array.isArray(result.records) ? cloneRows(result.records) : prepared.records, persisted: true };
  } catch { return { status: 'failed', records: current, reason: 'Operazione non confermata; stato locale invariato.' }; }
}

export function undoRapidOperation(current, operation) {
  if (!operation || !equalRows(current, operation.after)) return { status: 'stale', records: current, reason: 'La lista è cambiata: annullamento non applicato.' };
  return { status: 'undone', records: cloneRows(operation.before), operation: null };
}
