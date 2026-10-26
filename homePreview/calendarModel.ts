export type QuickShift = { id: string; label: string; start: string; end: string; type: 'turno' | 'riposo' | 'ferie'; color: string };
export type QuickDraft = Omit<QuickShift, 'id'>;
export const SHIFT_COLORS = ['#67CDFF', '#B296FF', '#EF9CFF', '#6BE1B4', '#FFBA78', '#F58EAC'] as const;
export type AgendaEntry = Omit<QuickShift,'type'> & { type: QuickShift['type'] | 'personal'; entryId: string; origin: 'quick' | 'existing' | 'personal' };
export type AgendaPending = { key: string; mode: 'insert' | 'delete'; candidate: QuickShift | null; reason: string };
export type AgendaState = { year: number; month: number; templates: QuickShift[]; days: Record<string, AgendaEntry[]>; panel: boolean; selected: string | null; selectedDate: string | null; pending: AgendaPending | null; lastApplied: string | null; announcement: string; nextId: number; nextEntryId: number };
export type AgendaAction = { type: 'month'; delta: number } | { type: 'focus'; key: string } | { type: 'panel'; open: boolean } | { type: 'select'; id: string } | { type: 'apply'; key: string } | { type: 'resolve'; choice: 'cancel' | 'append' | 'replace' | 'delete'; entryId?: string } | { type: 'save'; draft: QuickDraft; id?: string } | { type: 'remove'; id: string } | { type: 'move'; id: string; delta: number };
// Gesture recognition is shared by touch release and tests; arrows dispatch the same month action.
export function swipeMonth(dx: number, dy: number) { return Math.abs(dx) >= 64 && Math.abs(dx) > Math.abs(dy) * 1.5 ? (dx < 0 ? 1 : -1) : 0; }
export function horizontalDrag(dx: number, dy: number) { return Math.abs(dx) >= 18 && Math.abs(dx) > Math.abs(dy) * 1.5; }
export function entriesOn(state: AgendaState, key: string): AgendaEntry[] {
  const raw = state.days[key];
  if (Array.isArray(raw)) return raw;
  // Preserve a pre-existing in-memory one-shift demo snapshot after Fast Refresh.
  return raw ? [{...(raw as unknown as QuickShift),entryId:`legacy-${key}`,origin:'existing'}] : [];
}
function nextEntry(state: AgendaState) {
  const used=new Set(Object.keys(state.days).flatMap(key=>entriesOn(state,key).map(e=>e.entryId)));
  let number=state.nextEntryId||1;
  while(used.has(`entry-${number}`))number++;
  return {entryId:`entry-${number}`,nextEntryId:number+1};
}
function interval(key: string, shift: QuickShift | AgendaEntry) {
  const [y,m,d]=key.split('-').map(Number);
  const start=new Date(y,m-1,d),end=new Date(y,m-1,d+1);
  if(shift.type==='turno') {
    const [h,a]=shift.start.split(':').map(Number),[j,b]=shift.end.split(':').map(Number);
    start.setHours(h,a,0,0);end.setTime(new Date(y,m-1,d,j,b).getTime());
    if(end<=start)end.setDate(end.getDate()+1);
  }
  return [start.getTime(),end.getTime()];
}
export function insertionIssue(state: AgendaState, key: string, candidate: QuickShift, excluding?: string): string | null {
  const [start,end]=interval(key,candidate);
  for(const day of Object.keys(state.days))for(const entry of entriesOn(state,day)) {
    if(entry.entryId===excluding || entry.type==='personal' || entry.origin==='personal')continue;
    if(day===key && entry.type===candidate.type && entry.start===candidate.start && entry.end===candidate.end)return 'Turno già presente: nessun duplicato inserito.';
    const [a,b]=interval(day,entry);
    if(start<b && a<end)return 'Sovrapposizione con un turno o un riposo, anche oltre mezzanotte. Nessun inserimento.';
  }
  return null;
}
export function dateKey(year: number, month: number, day: number) { return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }
export function monthCells(year: number, month: number) {
  const count = new Date(year, month + 1, 0).getDate();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const length = Math.ceil((count + offset) / 7) * 7;
  return Array.from({ length }, (_, i) => i >= offset && i < offset + count ? i - offset + 1 : null);
}
export function validateDraft(draft: QuickDraft): string | null {
  if (!draft.label.trim() || draft.label.trim().length > 24) return 'Inserisci un’etichetta da 1 a 24 caratteri.';
  if (!['turno', 'riposo', 'ferie'].includes(draft.type)) return 'Scegli un tipo valido.';
  if (!/^#[0-9a-f]{6}$/i.test(draft.color)) return 'Scegli un colore valido.';
  const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (draft.type === 'turno' && (!validTime(draft.start) || !validTime(draft.end) || draft.start === draft.end)) return 'Usa orari HH:MM validi e diversi; i turni notturni sono consentiti.';
  return null;
}
export function shiftCaption(shift: QuickShift) { return shift.type === 'turno' ? `${shift.start.slice(0, 2)}–${shift.end.slice(0, 2)}` : shift.label; }
export function createAgenda(now = new Date()): AgendaState {
  const templates: QuickShift[] = [
    { id: 'morning', label: '06–14', start: '06:00', end: '14:00', type: 'turno', color: SHIFT_COLORS[0] },
    { id: 'afternoon', label: '14–22', start: '14:00', end: '22:00', type: 'turno', color: SHIFT_COLORS[1] },
    { id: 'night', label: '22–06', start: '22:00', end: '06:00', type: 'turno', color: SHIFT_COLORS[2] },
    { id: 'rest', label: 'RIP', start: '', end: '', type: 'riposo', color: SHIFT_COLORS[3] },
  ];
  return { year: now.getFullYear(), month: now.getMonth(), templates, days: {}, panel: false, selected: null, selectedDate: dateKey(now.getFullYear(),now.getMonth(),now.getDate()),pending:null,lastApplied: null, announcement: '', nextId: 1, nextEntryId:1 };
}
export function agendaReducer(state: AgendaState, action: AgendaAction): AgendaState {
  switch (action.type) {
    case 'month': {
      const date = new Date(state.year, state.month + action.delta, 1);
      return { ...state, year: date.getFullYear(), month: date.getMonth(), selectedDate:dateKey(date.getFullYear(),date.getMonth(),1),pending:null,lastApplied: null, announcement: '' };
    }
    case 'focus': return {...state,selectedDate:action.key};
    case 'panel': return { ...state, panel: action.open, pending:null, selected: action.open ? state.selected : null, lastApplied: null, announcement: '' };
    case 'select': return action.id === 'delete' || state.templates.some(t => t.id === action.id) ? { ...state, panel: true,pending:null,selected: action.id, announcement: action.id === 'delete' ? 'Elimina attivo: tocca le date.' : 'Turno selezionato: tocca una o più date.' } : state;
    case 'apply': {
      if (!state.panel || !state.selected) return {...state,announcement:'Seleziona un modello: nessun inserimento automatico.'};
      const valid=monthCells(state.year,state.month).some(day=>day!==null&&dateKey(state.year,state.month,day)===action.key);
      if(!valid)return state;
      const existing=entriesOn(state,action.key),candidate=state.templates.find(t=>t.id===state.selected)||null;
      if(state.selected==='delete') {
        if(!existing.some(e=>e.type!=='personal'&&e.origin!=='personal'))return {...state,selectedDate:action.key,announcement:'Nessun turno eliminabile; eventi personali invariati.'};
        return {...state,selectedDate:action.key,pending:{key:action.key,mode:'delete',candidate:null,reason:'Scegli il singolo turno da eliminare dalla DEMO.'}};
      }
      if(!candidate)return state;
      const issue=insertionIssue(state,action.key,candidate);
      if(issue||existing.length)return {...state,selectedDate:action.key,pending:{key:action.key,mode:'insert',candidate:{...candidate},reason:issue||'Data occupata: scegli esplicitamente come procedere.'}};
      const next=nextEntry(state),entry:AgendaEntry={...candidate,entryId:next.entryId,origin:'quick'};
      return {...state,days:{...state.days,[action.key]:[entry]},selectedDate:action.key,lastApplied:action.key,nextEntryId:next.nextEntryId,announcement:`Applicato · ${action.key} · DEMO`};
    }
    case 'resolve': {
      const pending=state.pending;
      if(!pending)return state;
      if(action.choice==='cancel')return {...state,pending:null,announcement:'Operazione annullata; dati invariati.'};
      const existing=entriesOn(state,pending.key),target=existing.find(e=>e.entryId===action.entryId);
      if(action.entryId&&existing.filter(e=>e.entryId===action.entryId).length!==1)return {...state,pending:{...pending,reason:'Identificativo ambiguo: nessun turno modificato.'}};
      if(action.choice==='delete') {
        if(pending.mode!=='delete'||!target||target.type==='personal'||target.origin==='personal')return state;
        const remaining=existing.filter(e=>e.entryId!==target.entryId),days={...state.days};
        if(remaining.length)days[pending.key]=remaining;else delete days[pending.key];
        return {...state,days,pending:null,lastApplied:pending.key,announcement:`Rimosso solo ${target.label} · DEMO`};
      }
      if(pending.mode!=='insert'||!pending.candidate)return state;
      if(action.choice==='replace'&&(!target||target.type==='personal'||target.origin==='personal'))return state;
      const issue=insertionIssue(state,pending.key,pending.candidate,action.choice==='replace'?target?.entryId:undefined);
      if(issue)return {...state,pending:{...pending,reason:issue}};
      const next=nextEntry(state),entry:AgendaEntry={...pending.candidate,entryId:next.entryId,origin:'quick'};
      const remaining=action.choice==='replace'?existing.filter(e=>e.entryId!==target!.entryId):existing;
      return {...state,days:{...state.days,[pending.key]:[...remaining,entry]},pending:null,lastApplied:pending.key,nextEntryId:next.nextEntryId,announcement:`Applicato con scelta esplicita · DEMO`};
    }
    case 'save': {
      if (validateDraft(action.draft) || (action.id && !state.templates.some(t => t.id === action.id))) return state;
      const template = { ...action.draft, label: action.draft.label.trim(), start: action.draft.type === 'turno' ? action.draft.start : '', end: action.draft.type === 'turno' ? action.draft.end : '', id: action.id || `quick-${state.nextId}` };
      return { ...state, templates: action.id ? state.templates.map(t => t.id === action.id ? template : t) : [...state.templates, template], nextId: action.id ? state.nextId : state.nextId + 1 };
    }
    case 'remove': return { ...state, templates: state.templates.filter(t => t.id !== action.id), selected: state.selected === action.id ? null : state.selected };
    case 'move': {
      const from = state.templates.findIndex(t => t.id === action.id), to = from + action.delta;
      if (from < 0 || to < 0 || to >= state.templates.length) return state;
      const templates = [...state.templates]; [templates[from], templates[to]] = [templates[to], templates[from]];
      return { ...state, templates };
    }
  }
}
