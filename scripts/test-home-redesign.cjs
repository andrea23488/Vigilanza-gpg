const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = { Date };
vm.createContext(context);
vm.runInContext(fs.readFileSync('homeModel.js', 'utf8').replaceAll('export function ', 'function '), context);
const { servizioHome, dateServizio, geometriaHome } = context;
const shift = (day, start, end, overrides = {}) => ({ giorno: day, mese: 10, anno: 2026, tipo: 'turno', inizio: start, fine: end, luogo: 'Postazione A', ...overrides });
const now = (day, hour, minute = 0) => new Date(2026, 9, day, hour, minute);

test('turno notturno iniziato ieri: countdown fino alla fine, anche a cambio mese', () => {
  const t = shift(24, '22:00', '06:00');
  const s = servizioHome([shift(25, '14:00', '22:00'), t], now(25, 2, 30));
  assert.equal(s.turno, t); assert.equal(s.attivo, true); assert.equal(s.countdown, '3h 30m');
  assert.equal(s.label, 'FINE TRA');
  const boundary = shift(30, '22:00', '06:00', { mese: 9 });
  assert.equal(servizioHome([boundary], now(1, 1)).countdown, '5h 00m');
});
test('turni multipli non ordinati: mostra il prossimo di oggi, poi quello in corso', () => {
  const a = shift(25, '06:00', '10:00'), b = shift(25, '14:00', '18:00');
  assert.equal(servizioHome([b, a], now(25, 11)).turno, b);
  assert.equal(servizioHome([b, a], now(25, 7)).turno, a);
  assert.equal(servizioHome([b, a], now(25, 14)).attivo, true);
  assert.equal(servizioHome([b, a], now(25, 18)).label, 'TURNO TERMINATO');
});
test('prima dell’inizio il countdown riguarda l’inizio dello stesso turno', () => {
  const s = servizioHome([shift(25, '14:00', '18:00')], now(25, 12));
  assert.equal(s.countdown, '2h 00m'); assert.equal(s.label, 'INIZIA TRA');
});
test('nessun turno, assenze e dati invalidi non producono countdown errati', () => {
  assert.equal(servizioHome([], now(25, 12)).countdown, '—');
  for (const tipo of ['riposo', 'ferie', 'malattia', 'permesso', 'congedo30', 'legge104']) {
    const s = servizioHome([shift(25, '', '', { tipo })], now(25, 12));
    assert.equal(s.label, tipo.toUpperCase()); assert.equal(s.attivo, false);
  }
  for (const t of [shift(25, '27:00', '06:00'), shift(32, '06:00', '10:00'), shift(25, '06:99', '10:00')]) assert.equal(dateServizio(t), null);
});
test('aggiornamento al cambio giorno e fine turno senza countdown negativo', () => {
  const turns = [shift(25, '22:00', '06:00'), shift(26, '14:00', '18:00')];
  assert.equal(servizioHome(turns, now(26, 5, 59)).countdown, '0h 01m');
  assert.equal(servizioHome(turns, now(26, 6)).turno, turns[1]);
  assert.equal(servizioHome(turns, now(27, 0)).turno, null);
});
test('selezione puramente visiva: non modifica array e record originali', () => {
  const a = Object.freeze(shift(25, '14:00', '18:00')), b = Object.freeze(shift(25, '06:00', '10:00'));
  const turns = Object.freeze([a, b]); servizioHome(turns, now(25, 7)); assert.equal(turns[0], a);
});
test('composizione orbitale senza intersezioni fra cerchio e rettangoli dei pulsanti',()=>{
 for(const [w,h] of [[280,250],[296,310],[336,420],[366,510],[422,1040],[576,680]]){
  for(const scale of [1,1.3,1.5,2]){
   const g=geometriaHome(w,h,scale);
   assert.ok(g.button>=48);assert.ok(g.diameter>0);
   assert.ok(g.left>=0&&g.left+g.diameter<=w);assert.ok(g.top>=0&&g.top+g.diameter<=h);
   for(const p of g.buttons){
    assert.ok(p.left>=0&&p.left+g.button<=w);assert.ok(p.top>=0&&p.top+g.button*1.16<=h);
    const cx=g.left+g.diameter/2,cy=g.top+g.diameter/2;
    const dx=Math.max(p.left-cx,0,cx-p.left-g.button),dy=Math.max(p.top-cy,0,cy-p.top-g.button*1.16);
    assert.ok(Math.hypot(dx,dy)>=g.diameter/2+6*g.panelHeight/280-1e-8);
   }
   assert.ok(g.buttons[0].left+g.button<g.buttons[1].left);
   assert.ok(g.buttons[0].top+g.button*1.16<g.buttons[2].top);
  }
 }
});
test('formattazione italiana solo visiva, senza reinterpretare le durate manuali',()=>{
 assert.equal(context.formattaValoreHome('37.5 h'),'37,5');assert.equal(context.formattaValoreHome('4.75 h'),'4,75');
 assert.equal(context.formattaValoreHome('4 h 45 min'),'4 h 45 min');assert.equal(context.formattaValoreHome(2),'2');
});


test('avanzamento del mese selezionato: passato, presente, futuro e febbraio bisestile', () => {
  const progress = context.avanzamentoMeseHome;
  assert.equal(progress(2026, 9, now(25, 12)), 81);
  assert.equal(progress(2026, 8, now(25, 12)), 100);
  assert.equal(progress(2026, 10, now(25, 12)), 0);
  assert.equal(progress(2024, 1, new Date(2024, 1, 29)), 100);
  assert.equal(progress(2026, 9, now(1, 0)), 3);
  assert.equal(progress(2026, 9, now(31, 23)), 100);
  assert.equal(progress(2026, 12, now(25, 12)), null);
});

test('fra due servizi conta fino al prossimo inizio e non altera un giorno senza servizio', () => {
  const turns = [shift(25, '06:00', '10:00'), shift(25, '14:00', '18:00')];
  const gap = servizioHome(turns, now(25, 12));
  assert.equal(gap.label, 'INIZIA TRA'); assert.equal(gap.countdown, '2h 00m');
  assert.equal(servizioHome(turns, now(25, 18)).countdown, '0h 00m');
  const dayOff = servizioHome([shift(26, '06:00', '14:00')], now(25, 12));
  assert.equal(dayOff.turno, null); assert.equal(dayOff.countdown, '—');
});
