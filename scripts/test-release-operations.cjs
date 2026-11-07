const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const babel = require('@babel/core');
function compile(file, requireModule, extra = {}) {
  const code = babel.transformSync(fs.readFileSync(file, 'utf8'), { babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'] }).code;
  const context = { exports: {}, require: requireModule, ...extra };
  vm.runInNewContext(code, context, { filename: file }); return context.exports;
}
const modules = {};
for (const name of ['turniCalcoli', 'turniRapidiAnteprima', 'turniRapidiOperazioni', 'games/spacePatrolEngine']) modules['./' + name] = compile(name + '.js', name => modules[name]);
const app = fs.readFileSync('App.js', 'utf8');
const ast = babel.parseSync(app, { babelrc: false, configFile: false, parserOpts: { plugins: ['jsx'] } });
const root = ast.program.body.find(n => n.type === 'ExportDefaultDeclaration').declaration;
const getFunction = name => { const n = root.body.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === name); return app.slice(n.start, n.end); };
function builder() {
  const context = { ...modules['./turniCalcoli'], oreOrdinarieGiornaliereNumero: 7 };
  vm.createContext(context); vm.runInContext(getFunction('fasciaTurno') + '\n' + getFunction('creaPayload'), context); return context.creaPayload;
}

test('HTTP: inserimento rapido, rilettura da nuovo coordinatore, multipli, duplicati, DELETE selettiva e permessi', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gpg-persistence-'));
  const file = path.join(directory, 'database.json');
  const initial = { id: 'existing-a', user_id: 'user-a', anno: 2026, mese: 8, giorno: 4, tipo: 'turno', inizio: '06:00', fine: '14:00', ore: 8, extra: 1, luogo: 'Già presente' };
  fs.writeFileSync(file, JSON.stringify([initial, { ...initial, id: 'other-user', user_id: 'user-b' }]));
  let deny = false, emptyDelete = false, dropPost = false, id = 0; const calls = [];
  const read = () => JSON.parse(fs.readFileSync(file));
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost'); calls.push(req.method);
    const rows = read(); const matches = row => [...url.searchParams].every(([key, value]) => ['select', 'order'].includes(key) || value === 'is.null' && row[key] === null || value.startsWith('eq.') && String(row[key]) === value.slice(3));
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'GET') { res.end(JSON.stringify(rows.filter(matches))); return; }
    if (req.method === 'POST') { let body = ''; for await (const chunk of req) body += chunk; const row = { ...JSON.parse(body), id: `new-${++id}` }; rows.push(row); if (!dropPost) fs.writeFileSync(file, JSON.stringify(rows)); res.end(JSON.stringify([row])); return; }
    if (deny) { res.statusCode = 403; res.end(JSON.stringify({ code: '42501' })); return; }
    if (emptyDelete) { res.end('[]'); return; }
    const deleted = rows.filter(matches); fs.writeFileSync(file, JSON.stringify(rows.filter(row => !matches(row)))); res.end(JSON.stringify(deleted));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.close(); fs.rmSync(directory, { recursive: true }); });
  const auth = { supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: 'user-a' }, access_token: 'fixture-token' } } }) } } };
  const requestModules = { './supabase': auth };
  const extra = { process: { env: { EXPO_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${server.address().port}`, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'fixture-public-key' } }, URLSearchParams, AbortController, setTimeout, clearTimeout, fetch };
  for (const name of ['turniRete', 'turniApi']) requestModules['./' + name] = compile(name + '.js', name => requestModules[name], extra);
  const api = requestModules['./turniApi'];
  let visible = []; const context = { userId: 'user-a', configKey: '7h', offline: false, saving: false };
  const createCoordinator = () => modules['./turniRapidiOperazioni'].creaCoordinatoreTurniRapidi({ context: () => context, read: api.caricaTurniUtente, create: api.creaTurnoUtente, build: builder(), publish: rows => { visible = rows; }, removeIfUnchanged: (id, expected, expectedUserId) => api.eliminaTurnoUtente(id, { expected, expectedUserId }) });
  const model = { id: 'default', nome: '14–22', inizio: '14:00', fine: '22:00', operativita: '', postazione: '' };
  let coordinator = createCoordinator();
  const added = await coordinator.inserisci(model, '2026-08-04');
  assert.equal(added.status, 'saved'); assert.equal(added.record.luogo, 'Servizio'); assert.equal(added.record.ore, 8); assert.equal(added.record.extra, 1);
  assert.equal(visible.length, 2); assert.equal(read().length, 3); assert.equal(read().find(t => t.id === 'existing-a').luogo, 'Già presente');
  // Nuova istanza e nuova lettura: lo stato in memoria precedente non è usato.
  coordinator = createCoordinator(); const reloaded = await api.caricaTurniUtente();
  assert.equal(reloaded.length, 2); assert.ok(reloaded.some(t => t.id === added.record.id));
  assert.equal((await coordinator.inserisci(model, '2026-08-04')).status, 'conflict'); assert.equal(calls.filter(x => x === 'POST').length, 1);
  deny = true; const rejected = await coordinator.eliminaSelezionati([added.record]); assert.equal(rejected.status, 'error'); assert.ok(read().some(t => t.id === added.record.id)); assert.ok(visible.some(t => t.id === added.record.id));
  deny = false; const deleted = await coordinator.eliminaSelezionati([added.record]); assert.equal(deleted.status, 'deleted');
  assert.equal((await api.caricaTurniUtente()).length, 1); assert.equal(visible.length, 1); assert.equal(read().length, 2); assert.ok(read().some(t => t.id === 'other-user'));
  // Anche il flusso originale rifiuta una DELETE 200 che non cancella alcuna riga.
  emptyDelete = true; await assert.rejects(api.eliminaTurnoUtente('existing-a'), /non ha confermato/); assert.equal(read().length, 2);
  emptyDelete = false; await api.eliminaTurnoUtente('existing-a'); assert.equal((await api.caricaTurniUtente()).length, 0); assert.equal(read()[0].user_id, 'user-b');
  const overnight = await coordinator.inserisci({...model,inizio:'22:00',fine:'06:00'}, '2026-08-05'); assert.equal(overnight.status,'saved');
  assert.equal((await coordinator.inserisci({...model,inizio:'04:00',fine:'12:00'}, '2026-08-06')).status,'conflict');
  await coordinator.eliminaSelezionati([overnight.record]);
  dropPost = true;
  assert.equal((await coordinator.inserisci(model,'2026-08-07')).status,'uncertain');
  assert.equal(visible.length,0); assert.equal((await api.caricaTurniUtente()).length,0);
  const postCount=calls.filter(x=>x==='POST').length;
  assert.equal((await coordinator.inserisci(model,'2026-08-07')).status,'uncertain');
  assert.equal(calls.filter(x=>x==='POST').length,postCount);

});

test('Space Patrol: limiti, collisione durante un frame lungo, un solo bersaglio per proiettile', () => {
  const { createGame, advanceGame, clampShip } = modules['./games/spacePatrolEngine'];
  assert.equal(clampShip(-20, 300), 0); assert.equal(clampShip(999, 300), 264);
  const game = { ...createGame(300), bullets: [{ id: 1, x: 100, y: 110 }], enemies: [{ id: 2, x: 95, y: 82 }, { id: 3, x: 95, y: 82 }] };
  const next = advanceGame(game, 1, 300, 400, 999, () => 0);
  assert.equal(next.shipX, 264); assert.equal(next.score, 10); assert.equal(next.enemies.length, 1); assert.equal(next.bullets.length, 0);
});

test('build ufficiale: identità invariata e rifiuto di backend non verificato', () => {
  const configure = require('../app.config.js'); const original = require('../app.json').expo;
  assert.equal(configure({ config: original }).ios.bundleIdentifier, 'com.vigilanzagpg.app');
  assert.throws(() => configure({ config: { ...original, extra: { ...original.extra, privateIosRealTest: true } } }), /privata/);
  const saved = process.env.EAS_BUILD; process.env.EAS_BUILD = 'true';
  try { assert.throws(() => configure({ config: original }), /backend/); } finally { if (saved === undefined) delete process.env.EAS_BUILD; else process.env.EAS_BUILD = saved; }
});

test('email: compositore ufficiale, testo conservato su errore e nessun falso invio', async () => {
  const states = [], calls = [], alerts = []; let cursor = 0, fail = false;
  const React = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), useState: initial => { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = value; }]; } };
  const components = { Text:'Text', TextInput:'TextInput', ScrollView:'ScrollView', Pressable:'Pressable', Alert:{alert:(...args)=>alerts.push(args)}, Linking:{openURL:async url=>{calls.push(url); if(fail)throw Error('No mail handler');}} };
  const module = compile('FeedbackScreen.js', name => name === 'react' ? React : name === 'react-native' ? components : {SafeAreaView:'SafeAreaView'});
  const render = () => { cursor=0; return module.default({onBack(){}}); };
  const find = (node,type) => { if(!node||typeof node!=='object')return null; if(node.type===type)return node; for(const child of (node.props?.children||[]).flat(Infinity)){const match=find(child,type);if(match)return match;}return null; };
  find(render(),'TextInput').props.onChangeText('Suggerimento: prova & verifica\nSeconda riga');
  const button = () => find(render(),'ScrollView').props.children.flat().find(node=>node?.type==='Pressable'&&node.props.accessibilityRole==='button');
  await button().props.onPress();
  assert.equal(calls.length,1); assert.ok(calls[0].startsWith('mailto:vigilanzagpg.app@gmail.com?'));
  assert.equal(new URL(calls[0]).searchParams.get('body'),states[0]); assert.equal(alerts.length,0);
  fail=true; await button().props.onPress(); assert.equal(alerts[0][0],'Email non disponibile'); assert.ok(states[0].includes('Seconda riga')); assert.equal(states[1],false);
});
