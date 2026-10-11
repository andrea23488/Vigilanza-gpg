const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const app = fs.readFileSync('App.js', 'utf8');
const ctx = {};
vm.createContext(ctx);
for (const f of ['turniCalcoli.js', 'straordinariManuali.js', 'straordinariGpg.js', 'stipendioCalcoli.js']) {
  vm.runInContext(fs.readFileSync(f, 'utf8').replace(/^import .*;\n/gm, '').replaceAll('export function ', 'function '), ctx);
}
vm.runInContext(app.slice(app.indexOf('function calcolaStraordinariConfigurati('), app.indexOf('export default function App()')), ctx);
vm.runInContext(app.slice(app.indexOf('  function creaPayload()'), app.indexOf('  async function inserisciTurno')), ctx);
const record = (id, giorno, ore = 12, override = null, mese = 10) => ({ id, giorno, mese, anno: 2026,
  tipo: 'turno', inizio: '06:00', fine: '18:00', ore, straordinario_manuale_minuti: override });
const options = { modalita: 'giornaliero', sogliaGiornaliera: 7, sogliaSettimanale: 40 };
function total(turni, giornateMese = turni, modalita = 'giornaliero') {
  return ctx.calcolaStraordinariConfigurati({ tuttiTurni: turni, giornateMese,
    ...options, modalita, meseTarget: 10, annoTarget: 2026 });
}
function setup() {
  Object.assign(ctx, { tipo: 'turno', inizio: '06:00', fine: '18:00', minutiAggiuntiviRetribuiti: '0',
    extra: '5', isFiduciario: false, modalitaExtraGpg: 'manuale', oreExtraGpg: '4', minutiExtraGpg: '45',
    giorno: 5, mese: 9, anno: 2026, luogo: '', indirizzoServizio: '', localitaMeteoTurno: '',
    oreOrdinarieGiornaliereNumero: 7, fasciaTurno: () => 'diurno', riposoLavorato: false });
}

test('payload reale, round trip JSON e riapertura: 285, zero e ritorno automatico', () => {
  setup();
  const payload = ctx.creaPayload();
  assert.equal(payload.straordinario_manuale_minuti, 285);
  assert.equal(payload.extra, 4.75);
  const loaded = JSON.parse(JSON.stringify(payload));
  const state = ctx.riapriManualeGpg(loaded);
  assert.equal(state.modalita, 'manuale'); assert.equal(state.ore, '4'); assert.equal(state.minuti, '45');
  ctx.oreExtraGpg = '0'; ctx.minutiExtraGpg = '0';
  assert.equal(ctx.creaPayload().straordinario_manuale_minuti, 0);
  ctx.modalitaExtraGpg = 'automatico';
  assert.equal(ctx.creaPayload().straordinario_manuale_minuti, null);
  assert.equal(ctx.creaPayload().extra, 5);
  ctx.isFiduciario = true;
  assert.equal('straordinario_manuale_minuti' in ctx.creaPayload(), false);
});

test('modifica quantità e validazione senza clamp', () => {
  setup(); ctx.minutiExtraGpg = '30'; assert.equal(ctx.creaPayload().straordinario_manuale_minuti, 270);
  for (const value of ['60', '-1', '4.5', '', 'abc']) {
    ctx.minutiExtraGpg = value; assert.throws(() => ctx.creaPayload());
  }
  ctx.minutiExtraGpg = '0'; ctx.oreExtraGpg = '13'; assert.throws(() => ctx.creaPayload());
});

test('giornaliero, settimanale e maturato usano lo stesso override', () => {
  const turni = [record(1, 5), record(2, 6), record(3, 7), record(4, 8, 12, 285), record(5, 9, 8)];
  assert.equal(total(turni, [turni[3]]), 4.75);
  assert.equal(total(turni, turni, 'settimanale'), 12.75);
  assert.equal(total(turni, turni.slice(0, 4), 'settimanale'), 4.75);
  assert.equal(total(turni, [turni[4]], 'settimanale'), 8);
  const rows = ctx.classificaTurniGpg(turni, { ...options, modalita: 'settimanale' });
  assert.equal(rows[3].cumulatoOre, 48); assert.equal(rows[4].cumulatoOre, 56);
  for (const r of rows) assert.equal(r.ordinarie + r.straordinarie, r.ore);
});

test('automatici storici, decimali e turni multipli invariati', () => {
  const turni = [record(1, 5, 3.123), record(2, 5, 8), record(3, 6, 12), record(4, 7, 12), record(5, 8, 12)];
  assert.equal(total(turni), 19.123);
  const automatico = total(turni, turni, 'settimanale');
  assert.ok(Math.abs(automatico - 7.123) < 1e-12);
  assert.equal(ctx.leggiManualeGpg('automatico', '', '', 3.123), null);
  assert.throws(() => ctx.leggiManualeGpg('manuale', '1', '0', 3.123));
  const multipli = [record(1, 5, 5), { ...record(2, 5, 5, 30), inizio: '14:00' }];
  assert.equal(total(multipli), 0.5);
});

test('notturno/festivo e settimana a cavallo del mese: nessuna duplicazione', () => {
  const turni = [record(1, 28, 36, null, 9), { ...record(2, 1, 12, 285), inizio: '22:00', fine: '10:00' }];
  assert.equal(total(turni, [turni[1]], 'settimanale'), 4.75);
  assert.equal(total([{ ...record(1, 25, 12, 285, 12) }]), 4.75);
  assert.equal(ctx.formattaOreGpg(4.75), '4 h 45 min');
});

test('tariffe automatiche e personalizzate ricevono 4.75, senza correzioni monetarie', () => {
  const ore = total([record(1, 5, 12, 285)]);
  for (const tariffa of [ctx.tariffaStraordinario30DaBase(1468.88), 10]) {
    assert.equal(ctx.calcolaVociGpg({ oreStraordinario: ore, tariffaStraordinario: tariffa }).straordinario, 4.75 * tariffa);
  }
});

test('confronto automatico con commit precedente, incluse soglie e durate storiche', () => {
  const precedente = require('node:child_process').execFileSync('git', ['show',
    'ff6fb3c447720c03d04b069d9c5957da3351a531:App.js'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  const old = { aggregaTurniPerGiorno: ctx.aggregaTurniPerGiorno };
  vm.createContext(old);
  vm.runInContext(precedente.slice(precedente.indexOf('function calcolaStraordinariConfigurati('),
    precedente.indexOf('export default function App()')), old);
  for (let seed = 0; seed < 20; seed++) {
    const turni = Array.from({ length: 12 }, (_, i) => ({ ...record(i, 1 + i % 6, 3 + ((seed + i * 13) % 600) / 60),
      minuti_aggiuntivi_retribuiti: i % 2 ? 15 : 0, riposo_lavorato: i === 3 }));
    for (const modalita of ['giornaliero', 'settimanale']) {
      const args = { tuttiTurni: turni, giornateMese: turni, ...options, modalita,
        meseTarget: 10, annoTarget: 2026 };
      assert.equal(ctx.calcolaStraordinariConfigurati(args), old.calcolaStraordinariConfigurati(args));
      const righe = ctx.classificaTurniGpg(turni, { ...options, modalita });
      assert.ok(Math.abs(righe.reduce((n, r) => n + r.straordinarie, 0) - old.calcolaStraordinariConfigurati(args)) < 1e-10);
    }
  }
});

test('POST/PATCH/GET reali con trasporto simulato: quantità conservata ed errori propagati', async () => {
  setup();
  let stored; let fail = false; const richieste = [];
  const api = { process: { env: { EXPO_PUBLIC_SUPABASE_URL: 'https://test.invalid',
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test' } },
    supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: 'test' }, access_token: 'test' } } }) } },
    creaErroreBackendTurni: () => new Error('backend rifiutato'),
    eseguiRichiestaTurni: async ({ opzioni }) => {
      richieste.push(opzioni);
      if (fail) return { response: { ok: false, status: 400 }, testo: 'errore simulato' };
      if (opzioni.body) stored = { ...stored, ...JSON.parse(opzioni.body), id: 1 };
      return { response: { ok: true }, testo: JSON.stringify([stored]) };
    },
  };
  vm.createContext(api);
  vm.runInContext(fs.readFileSync('turniApi.js', 'utf8').replace(/import[\s\S]*?;\n/g, '')
    .replaceAll('export async function ', 'async function '), api);
  const saved = await api.creaTurnoUtente(ctx.creaPayload());
  assert.equal(saved.straordinario_manuale_minuti, 285);
  const [loaded] = await api.caricaTurniUtente();
  assert.equal(ctx.riapriManualeGpg(loaded).minuti, '45');
  ctx.minutiExtraGpg = '30';
  assert.equal((await api.aggiornaTurnoUtente(1, ctx.creaPayload())).straordinario_manuale_minuti, 270);
  ctx.modalitaExtraGpg = 'automatico';
  assert.equal((await api.aggiornaTurnoUtente(1, ctx.creaPayload())).straordinario_manuale_minuti, null);
  assert.deepEqual(richieste.map(r => r.method), ['POST', 'GET', 'PATCH', 'PATCH']);
  fail = true;
  await assert.rejects(() => api.aggiornaTurnoUtente(1, ctx.creaPayload()), /backend rifiutato/);
});


test('riapertura editor reale ripristina stato, modifica e automatico', () => {
  setup();
  const stato = {};
  for (const nome of ['EditingId','Giorno','Tipo','Inizio','Fine','Luogo','LocalitaMeteoTurno',
    'IndirizzoServizio','Extra','MinutiAggiuntiviRetribuiti','RiposoLavorato','Screen',
    'ModalitaExtraGpg','OreExtraGpg','MinutiExtraGpg']) {
    ctx[`set${nome}`] = valore => { stato[nome] = valore; };
  }
  ctx.Alert = { alert: () => { throw new Error('alert inatteso'); } };
  vm.runInContext(app.slice(app.indexOf('  function modificaGiorno('), app.indexOf('  function creaPayload()')), ctx);
  ctx.modificaGiorno({ ...ctx.creaPayload(), id: 1 });
  assert.equal(stato.ModalitaExtraGpg, 'manuale');
  assert.equal(stato.OreExtraGpg, '4'); assert.equal(stato.MinutiExtraGpg, '45');
  assert.equal(stato.Screen, 'edit');
  ctx.modificaGiorno({ ...record(1, 5), straordinario_manuale_minuti: 0 });
  assert.equal(stato.ModalitaExtraGpg, 'manuale'); assert.equal(stato.OreExtraGpg, '0');
  ctx.modificaGiorno(record(1, 5));
  assert.equal(stato.ModalitaExtraGpg, 'automatico');
});

test('conversione rigorosa: 481 minuti e tutte le durate al minuto fino a 48 ore', () => {
  assert.equal(ctx.durataOreInMinuti(481 / 60), 481);
  for (let n = 0; n <= 2880; n++) assert.equal(ctx.durataOreInMinuti(n / 60), n);
  assert.equal(ctx.leggiManualeGpg('manuale', '1', '0', 481 / 60), 60);
  for (const ore of [3.123, (481 + 1e-7) / 60, -1e-16, Infinity, NaN, '8']) {
    assert.throws(() => ctx.durataOreInMinuti(ore));
  }
  const r = ctx.classificaTurniGpg([{ ...record(1, 5, 481 / 60, 60) }], options)[0];
  assert.equal(r.straordinarie, 1);
});

function precedenteApp() {
  return require('node:child_process').execFileSync('git', ['show',
    'ff6fb3c447720c03d04b069d9c5957da3351a531:App.js'],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
}
function dettagli(source, env) {
  const a = source.indexOf('const dettaglioStraordinariMese =');
  const b = source.indexOf('\n  })();', a);
  return vm.runInContext(source.slice(a, b + '\n  })();'.length) + '\ndettaglioStraordinariMese;', vm.createContext({ ...env }));
}
function statistiche(source, env) {
  const a = source.indexOf('  const statistiche =');
  const b = source.indexOf('  const iniziali =', a);
  return vm.runInContext(source.slice(a, b) + '\nstatistiche;', vm.createContext({ ...env, useMemo: fn => fn() }));
}

test('riepiloghi automatici giornalieri/settimanali identici al commit precedente', () => {
  const old = precedenteApp();
  const turni = [record(1, 5), { ...record(2, 5, 4), inizio: '19:00', fine: '23:00' }, record(3, 6)];
  for (const modalita of ['giornaliero', 'settimanale']) {
    const env = { ...ctx, isFiduciario: false, haOverrideGpgMese: false, turni,
      turniMese: turni, giornateStipendioMese: turni, mese: 9, anno: 2026,
      stipendioCalcoloStraordinari: modalita, stipendioOreSettimanali: '40',
      oreOrdinarieGiornaliereNumero: 7 };
    assert.equal(JSON.stringify(dettagli(app, env)), JSON.stringify(dettagli(old, env)));
    assert.equal(JSON.stringify(statistiche(app, env)), JSON.stringify(statistiche(old, env)));
  }
  // Le espressioni effettive dei riepiloghi mantengono i vecchi formatter
  // se non vi sono override, compresa la home con toFixed(0).
  assert.ok(app.includes('!haOverrideGpgMese ? `${statistiche.extraOre}h`'));
  assert.ok(app.includes('!haOverrideGpgMese ? `${extraStipendioMese.toFixed(1)} h`'));
  assert.ok(app.includes('!haOverrideGpgMese ? `${Number(extraStipendioMese || 0).toFixed(0)}h`'));
  assert.ok(app.includes('manualeSchedaGpg ? t.straordinario_manuale_minuti / 60 : Number(t.extra || 0)'));
  assert.ok(app.includes('!manualeSchedaGpg ? `${extra}h` : formattaOreGpg(extra)'));
});

test('statistiche con override conservano semantica giornaliera, anche con stipendio settimanale', () => {
  const turni = [record(1, 5, 12, 285), record(2, 6)];
  const env = { ...ctx, turniMese: turni, haOverrideGpgMese: true, isFiduciario: false,
    oreOrdinarieGiornaliereNumero: 7, stipendioCalcoloStraordinari: 'settimanale' };
  assert.equal(statistiche(app, env).extraOre, 9.75);
});

test('Fiduciari: nessuna classificazione GPG anche con override invalido', () => {
  const turni = [record(1, 5, 12, -1)];
  const isolated = { ...ctx, classificaTurniGpg: () => { throw new Error('GPG eseguito per Fiduciari'); } };
  vm.createContext(isolated);
  vm.runInContext(app.slice(app.indexOf('function calcolaStraordinariConfigurati('),
    app.indexOf('export default function App()')), isolated);
  for (const modalita of ['giornaliero', 'settimanale']) {
    assert.equal(isolated.calcolaStraordinariConfigurati({ tuttiTurni: turni,
      giornateMese: turni, ...options, modalita, abilitaManuale: false,
      meseTarget: 10, annoTarget: 2026 }), modalita === 'giornaliero' ? 5 : 0);
  }
  // Tutti i tre chiamanti dell'app, incluso il maturato, disabilitano il ramo.
  assert.equal((app.match(/abilitaManuale: !isFiduciario/g) || []).length, 3);
});
