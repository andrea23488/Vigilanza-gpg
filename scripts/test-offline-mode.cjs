const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const root = path.resolve(__dirname, '..');
const { TEST_BUNDLE_ID, TEST_SCHEME, isOfflineIdentity } = require('../offlineTest/identity.cjs');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const parse = (source) => parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
function load(file, mocks = {}, globals = {}) {
  const code = babel.transformSync(read(file), { babelrc: false, configFile: false,
    plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'] }).code;
  const module = { exports: {} };
  const requireMock = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (file === 'app.config.js' && name === './app.json') return { expo: JSON.parse(read('app.json')).expo };
    if (name === './package.json') return JSON.parse(read('package.json'));
    if (name.endsWith('buildSafety.cjs')) return require('../offlineTest/buildSafety.cjs');
    if (name.endsWith('identity.cjs')) return require('../offlineTest/identity.cjs');
    throw new Error('Unexpected dependency: ' + name);
  };
  vm.runInNewContext('(function(require,module,exports){' + code + '\n})', globals)(requireMock, module, module.exports);
  return module.exports;
}
const clone = (x) => JSON.parse(JSON.stringify(x));

async function main() {
  const base = JSON.parse(read('app.json')).expo;
  const testConfig = { extra: { offlineTest: true }, ios: { bundleIdentifier: TEST_BUNDLE_ID }, scheme: TEST_SCHEME };
  assert.equal(isOfflineIdentity(base, base.ios.bundleIdentifier, 'ios'), false);
  assert.equal(isOfflineIdentity(testConfig, TEST_BUNDLE_ID, 'ios'), true);
  for (const args of [[testConfig, base.ios.bundleIdentifier, 'ios'], [base, TEST_BUNDLE_ID, 'ios'],
    [testConfig, TEST_BUNDLE_ID, 'android'], [{ ...testConfig, scheme: base.scheme }, TEST_BUNDLE_ID, 'ios']]) {
    assert.throws(() => isOfflineIdentity(...args));
  }
  assert.equal(load('runtimeMode.js', {
    'expo-constants': { expoConfig: testConfig }, 'react-native': { Platform: { OS: 'ios' } },
    'expo-modules-core': { requireOptionalNativeModule: () => ({ applicationId: TEST_BUNDLE_ID }) },
  }).OFFLINE_TEST, true);
  console.log('PASS identity: offline requires dedicated native iOS identity + matching manifest.');

  const config = (env, pkg = JSON.parse(read('package.json'))) => load('app.config.js', { './package.json': pkg }, { process: { env } })();
  assert.deepEqual(clone(config({})), base);
  for (const profile of ['production', 'preview', 'development']) {
    assert.deepEqual(clone(config({ EAS_BUILD_PROFILE: profile })), base);
  }
  const env = { APP_VARIANT: 'offline-test', EXPO_NO_DOTENV: '1' };
  const cfg = config(env);
  assert.equal(cfg.name, 'Vigilanza GPG Test');
  assert.equal(cfg.ios.bundleIdentifier, TEST_BUNDLE_ID);
  assert.equal(cfg.scheme, TEST_SCHEME);
  assert.deepEqual(clone(cfg.ios.entitlements), {});
  assert.equal(cfg.extra.eas, undefined);
  assert.equal(cfg.updates.enabled, false);
  for (const plugin of cfg.plugins) assert(!['@bacons/apple-targets', 'expo-notifications', 'expo-local-authentication'].includes(Array.isArray(plugin) ? plugin[0] : plugin));
  for (const bad of [{ APP_VARIANT: 'typo' }, { APP_VARIANT: 'offline-test' },
    { ...env, EXPO_PUBLIC_SUPABASE_URL: 'https://forbidden.invalid' },
    { ...env, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'fake-forbidden-value' },
    { ...env, EAS_BUILD_PLATFORM: 'android' }, { ...env, EAS_BUILD_PROFILE: 'production' }, { ...env, EAS_BUILD_PROFILE: 'offline-test' },
    { ...env, EXPO_USE_COMMUNITY_AUTOLINKING: '1' },
    { ...env, OFFLINE_EAS_PROJECT_ID: base.extra.eas.projectId }]) assert.throws(() => config(bad));
  const distinct = '11111111-2222-4333-8444-555555555555';
  const stagedPkg = { ...JSON.parse(read('package.json')), vigilanzaOfflineTest: true,
    expo: { autolinking: { ios: { exclude: ['expo-notifications', 'react-native-watch-connectivity'] } } } };
  for (const variant of [undefined, '', 'typo']) {
    assert.throws(() => config({ EAS_BUILD_PROFILE: 'offline-test', APP_VARIANT: variant }));
    assert.throws(() => config({ APP_VARIANT: variant }, stagedPkg));
  }
  assert.throws(() => config({ ...env, EAS_BUILD_PROFILE: 'offline-test', OFFLINE_EAS_PROJECT_ID: distinct }));
  assert.equal(config({ ...env, EAS_BUILD_PROFILE: 'offline-test', OFFLINE_EAS_PROJECT_ID: distinct }, stagedPkg).extra.eas.projectId, distinct);
  const eas = JSON.parse(read('eas.json'));
  assert.equal(eas.build['offline-test'].developmentClient, false);
  assert.equal(eas.build['offline-test'].distribution, 'internal');
  assert.equal(eas.build['offline-test'].env.EXPO_NO_DOTENV, '1');
  assert.equal(Object.hasOwn(eas.build['offline-test'].env, 'EXPO_PUBLIC_SUPABASE_URL'), false);
  assert.equal(Object.hasOwn(eas.build['offline-test'].env, 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), false);
  console.log('PASS config: production manifest unchanged; test identity isolated; credentials and production EAS fallback refused.');

  const mods = {};
  const handled = [];
  const plugin = load('offlineTest/withOfflineIos.cjs', {
    'expo/config-plugins': {
      createRunOncePlugin: (fn, name) => (value) => { handled.push(name); return fn(value); },
      withEntitlementsPlist: (value, action) => { mods.entitlements = action; return value; },
      withInfoPlist: (value, action) => { mods.info = action; return value; },
    },
  });
  assert.throws(() => plugin(base));
  plugin(clone(cfg));
  assert(handled.includes('expo-notifications'));
  assert(handled.includes('expo-local-authentication'));
  const stripped = mods.entitlements({ modResults: {
    'aps-environment': 'production', 'com.apple.security.application-groups': ['forbidden-group'],
    'keychain-access-groups': ['forbidden-keychain'],
  } });
  assert.deepEqual(clone(stripped.modResults), {});
  assert.deepEqual(clone(mods.info({ modResults: { UIBackgroundModes: ['remote-notification'],
    WKCompanionAppBundleIdentifier: 'forbidden-companion' } }).modResults), {});
  console.log('PASS iOS plugin actions: push, shared groups, background modes and companion references removed.');


  function metro(env) {
    return load('metro.config.js', { path, 'expo/metro-config': { getDefaultConfig: () => ({ resolver: {} }) } }, { __dirname: root, process: { env } });
  }
  assert.equal(metro({}).resolver.resolveRequest, undefined);
  assert.throws(() => metro({ EAS_BUILD_PROFILE: 'offline-test' }));
  assert.throws(() => metro({ ...env, EXPO_PUBLIC_SUPABASE_URL: 'https://forbidden.invalid' }));
  const resolver = metro(env).resolver.resolveRequest;
  const context = { originModulePath: root + '/App.js', resolveRequest: (_, name) => ({ original: name }) };
  for (const name of ['./supabase', './supabase.js', './turniApi', './pushNotifications',
    'react-native-watch-connectivity', 'expo-notifications', '@supabase/supabase-js', './offlineTest/resolverCheck']) {
    assert.equal(resolver(context, name, 'ios').filePath, root + '/offlineTest/services.js');
  }
  assert.equal(resolver({ ...context, originModulePath: root + '/games/Example.js' }, '../supabase', 'ios').filePath, root + '/offlineTest/services.js');
  for (const name of ['./TipoGiornataSection', './TurniRapidiSection', './chatApi']) assert.equal(resolver(context, name, 'ios').original, name);
  console.log('PASS Metro: real sections retained; cloud, REST, Watch and notification imports redirected only in Test.');

  let reachedNetwork = 0;
  const target = { fetch: () => reachedNetwork++, XMLHttpRequest: class { constructor() { reachedNetwork++; } }, WebSocket: class { constructor() { reachedNetwork++; } } };
  const guard = load('offlineTest/networkGuard.js');
  guard.installOfflineNetworkGuard(target);
  await assert.rejects(target.fetch('https://forbidden.invalid', { method: 'POST' }), /TEST OFFLINE/);
  for (const name of ['XMLHttpRequest', 'WebSocket', 'EventSource']) assert.throws(() => new target[name]('https://forbidden.invalid'), /TEST OFFLINE/);
  assert.equal(Reflect.set(target, 'fetch', () => reachedNetwork++), false);
  assert.equal(reachedNetwork, 0);
  assert.equal(guard.getBlockedOfflineRequests().length, 4);
  assert(read('index.js').indexOf('installOfflineNetworkGuard();') < read('index.js').indexOf("require('./App')"));
  console.log('PASS transport: fetch/XHR/WebSocket/EventSource never reach original implementation; guard precedes App load.');

  for (const [offline, isolated] of [[true, true], [true, false], [false, false]]) {
    const order = [];
    const appModule = Object.defineProperty({}, 'default', { get() { order.push('app'); return 'App'; } });
    const marker = Object.defineProperty({}, 'OFFLINE_RESOLVER', { get() { order.push('marker'); return isolated; } });
    const mocks = {
      expo: { registerRootComponent() { order.push('register'); } },
      'react-native-safe-area-context': { SafeAreaProvider: 'Provider' },
      './runtimeMode': { OFFLINE_TEST: offline },
      './offlineTest/networkGuard': { installOfflineNetworkGuard() { order.push('guard'); } },
      './offlineTest/resolverCheck': marker, './App': appModule,
    };
    if (offline && !isolated) {
      assert.throws(() => load('index.js', mocks), /bundle non isolato/);
      assert.deepEqual(order, ['guard', 'marker']);
    } else {
      load('index.js', mocks);
      assert.deepEqual(order, offline ? ['guard', 'marker', 'app', 'register'] : ['app', 'register']);
    }
  }
  console.log('PASS bootstrap: wrong resolver fails before App imports; official startup installs no guard.');


  assert.throws(() => load('offlineTest/services.js', { '../runtimeMode': { OFFLINE_TEST: false } }));
  const svc = load('offlineTest/services.js', { '../runtimeMode': { OFFLINE_TEST: true } });
  assert.equal(svc.OFFLINE_RESOLVER, true);
  assert.equal(load('offlineTest/resolverCheck.js').OFFLINE_RESOLVER, false);
  assert(read('index.js').indexOf("require('./offlineTest/resolverCheck')") < read('index.js').indexOf("require('./App')"));
  assert.equal((await svc.supabase.auth.getSession()).data.session, null);
  assert.deepEqual(clone(await svc.caricaTurniUtente()), []);
  assert.deepEqual(clone((await svc.supabase.from('turni').select('*').eq('user_id', 'demo')).data), []);
  for (const method of ['insert', 'upsert', 'update', 'delete']) assert.throws(() => svc.supabase.from('turni')[method]({}), /TEST OFFLINE/);
  for (const call of [() => svc.supabase.rpc('registra_push_token'), () => svc.supabase.functions.invoke('send-push'),
    () => svc.supabase.auth.signInWithPassword({}), () => svc.supabase.auth.signUp({}),
    () => svc.supabase.auth.setSession({}), () => svc.supabase.auth.resetPasswordForEmail('demo@example.invalid'),
    () => svc.supabase.storage.from('profili').upload('file', ''), () => svc.creaTurnoUtente({}),
    () => svc.aggiornaTurnoUtente('demo', {}), () => svc.eliminaTurnoUtente('demo'),
    () => svc.scheduleNotificationAsync({}), () => svc.getExpoPushTokenAsync()]) await assert.rejects(call(), /TEST OFFLINE/);
  assert.equal((await svc.requestPermissionsAsync()).granted, false);
  assert.equal(await svc.registraPushDispositivo(), null);
  assert.equal(await svc.getIsPaired(), false);
  console.log('PASS services: no sessions; auth, writes, push, storage and turn persistence denied, never reported as success.');

  const app = parse(read('App.js'));
  let mount = 0;
  traverse(app, { JSXOpeningElement(p) {
    if (p.node.name.name === 'ConsegneServizioScreen') {
      mount++;
      const attr = p.node.attributes.find((x) => x.name?.name === 'paletteHome');
      assert(attr && p.scope.getBinding(attr.value.expression.name));
    }
  } });
  assert.equal(mount, 1);
  const handover = app.program.body.find((n) => n.type === 'FunctionDeclaration' && n.id.name === 'ConsegneServizioScreen');
  const screenFn = app.program.body.find((n) => n.type === 'FunctionDeclaration' && n.id.name === 'Screen');
  const original = process.argv[2] ? parse(fs.readFileSync(process.argv[2], 'utf8')) : null;
  if (original) {
    function official(ast) {
      ast = structuredClone(ast);
      traverse(ast, { ImportDeclaration(p) {
        if (['./runtimeMode', './offlineTest/fixtures'].includes(p.node.source.value)) p.remove();
      }, ReferencedIdentifier(p) { if (p.node.name === 'OFFLINE_TEST') p.replaceWith({ type: 'BooleanLiteral', value: false }); } });
      traverse(ast, { LogicalExpression: { exit(p) {
        const n = p.node;
        if (n.left.type === 'BooleanLiteral') p.replaceWith(n.operator === '||' ? (n.left.value ? n.left : n.right) : (n.left.value ? n.right : n.left));
      } }, IfStatement: { exit(p) { if (p.node.test.type === 'BooleanLiteral' && !p.node.test.value) p.remove(); } }, JSXExpressionContainer: { exit(p) { if (p.node.expression.type === 'BooleanLiteral' && !p.node.expression.value) p.remove(); } } });
      function clean(n) {
        if (Array.isArray(n)) return n.map(clean).filter((x) => x !== null);
        if (!n || typeof n !== 'object') return n;
        if (n.type === 'JSXText') { const v = n.value.split('\n').map((x) => x.trim()).filter(Boolean).join(' '); return v ? { type: 'JSXText', value: v } : null; }
        return Object.fromEntries(Object.entries(n).filter(([k]) => !['start', 'end', 'loc', 'extra', 'comments', 'leadingComments', 'trailingComments', 'innerComments'].includes(k)).map(([k, v]) => [k, clean(v)]));
      }
      return clean(ast);
    }
    assert.deepEqual(official(app), official(original));
    console.log('PASS production: complete App AST equivalent to baseline when OFFLINE_TEST=false.');
  }
  for (const offline of [false, true]) {
    const source = generate(handover).code;
    const ctx = { React: { useState: (v) => [v, () => {}], useEffect() {}, createElement: (type, props, ...children) => ({ type, props, children }) },
      OFFLINE_TEST: offline, Screen: 'Screen', Back: 'Back', View: 'View', Text: 'Text', TextInput: 'TextInput', TouchableOpacity: 'TouchableOpacity', Ionicons: 'Ionicons' };
    vm.createContext(ctx);
    vm.runInContext(babel.transformSync(source, { babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-react-jsx'] }).code, ctx);
    for (const palette of [undefined, null, { background: '#07111F' }]) {
      const tree = ctx.ConsegneServizioScreen({ paletteHome: palette, onBack() {}, postazioni: [], colleghi: [] });
      assert.equal(tree.props.homePalette, palette ?? null);
    }
  }
  console.log('PASS real handover render: missing/null/present palette, both variants, no effects or backend.');

  let cloudCalls = 0;
  const alerts = [];
  const blockedHandlerNames = new Set(['salvaGiornata', 'applicaTurnoRapidoAlPeriodo']);
  const handlers = [];
  traverse(app, {
    FunctionDeclaration(p) { if (blockedHandlerNames.has(p.node.id.name)) handlers.push(p.node); },
    VariableDeclarator(p) { if (p.node.id.name === 'inviaConsegnaACollega') handlers.push({ type: 'VariableDeclaration', kind: 'const', declarations: [p.node] }); },
  });
  const handlerContext = { OFFLINE_TEST: true, Alert: { alert: (...args) => alerts.push(args) },
    inserisciTurno: () => cloudCalls++, aggiornaTurno: () => cloudCalls++, inviaConsegna: () => cloudCalls++ };
  vm.createContext(handlerContext);
  vm.runInContext(handlers.map((n) => generate(n).code).join('\n') +
    '\nglobalThis.sendOffline = inviaConsegnaACollega;', handlerContext);
  await handlerContext.salvaGiornata();
  await handlerContext.applicaTurnoRapidoAlPeriodo();
  await handlerContext.sendOffline({ altro_user_id: 'demo' });
  assert.equal(cloudCalls, 0);
  assert.equal(alerts.length, 3);
  assert(alerts.every((item) => item[0] === 'TEST OFFLINE'));
  console.log('PASS real handlers: save day, apply period and send handover stop before cloud; explicit alerts, no fake success.');

  assert(screenFn);
}
main().catch((error) => { console.error(error.message.slice(0, 3000)); process.exitCode = 1; });
