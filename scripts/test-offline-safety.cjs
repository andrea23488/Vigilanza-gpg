const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ignore = require('ignore');
const { prepareStage, excluded } = require('./prepare-offline-stage.cjs');
const { NATIVE_EXCLUSIONS, validateStage } = require('../offlineTest/buildSafety.cjs');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const originalPkg = read('package.json');
const originalApp = read('App.js');
const originalNativeConfig = read('react-native.config.js');
assert(!fs.existsSync(path.join(root, '.easignore')));
const officialRules = ignore().add(read('.gitignore'));
assert.equal(officialRules.ignores('.env.production'), false);
for (const file of ['.env.production', 'nested/.env.test', '.aws/config', 'ios/Info.plist',
  'targets/watch/Info.plist', 'credentials.json', 'cert.p12', 'build.ipa']) assert(excluded(file));

const stage = prepareStage(root);
const stagedPkg = JSON.parse(fs.readFileSync(path.join(stage, 'package.json'), 'utf8'));
validateStage(stagedPkg);
const nativeConfig = require(path.join(stage, 'react-native.config.js'));
assert.equal(nativeConfig.dependencies['react-native-watch-connectivity'].platforms.android, null);
const { findDisabledLibrariesByPlatform } = require(path.join(root,
  'node_modules/react-native/scripts/codegen/generate-artifacts-executor/utils.js'));
const disabledCodegen = findDisabledLibrariesByPlatform(nativeConfig, 'ios');
for (const name of NATIVE_EXCLUSIONS) assert(disabledCodegen.includes(name));
assert.throws(() => validateStage(JSON.parse(originalPkg)));
const stagedEas = JSON.parse(fs.readFileSync(path.join(stage, 'eas.json'), 'utf8'));
assert.deepEqual(Object.keys(stagedEas.build), ['offline-test']);
assert.equal(stagedEas.submit, undefined);
const stageRules = ignore().add(fs.readFileSync(path.join(stage, '.easignore'), 'utf8'));
for (const file of ['.env.production', 'nested/.env.test', '.aws/config', 'targets/watch/a.swift', 'cert.p12']) assert(stageRules.ignores(file));
for (const folder of ['targets', 'ios', 'android', '.git', 'supabase']) assert(!fs.existsSync(path.join(stage, folder)));
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else assert(!excluded(path.relative(stage, full).split(path.sep).join('/')));
  }
}
walk(stage);
assert.equal(fs.readFileSync(path.join(stage, 'App.js'), 'utf8'), originalApp);
for (const file of ['TipoGiornataSection.js', 'TurniRapidiSection.js']) {
  assert.equal(fs.readFileSync(path.join(stage, file), 'utf8'), read(file));
}
console.log('PASS upload: official ignore rules unchanged; Test source tree excludes env files, native folders, Watch targets and signing assets.');

const configCode = 'const c=require("./app.config.js")(); console.log(JSON.stringify({id:c.ios.bundleIdentifier,offline:c.extra.offlineTest===true}));';
const offlineEnv = { PATH: process.env.PATH, APP_VARIANT: 'offline-test', EXPO_NO_DOTENV: '1',
  EAS_BUILD_PROFILE: 'offline-test', OFFLINE_EAS_PROJECT_ID: '11111111-2222-4333-8444-555555555555' };
const configured = JSON.parse(execFileSync(process.execPath, ['-e', configCode], { cwd: stage, env: offlineEnv, encoding: 'utf8' }));
assert.deepEqual(configured, { id: 'com.vigilanzagpg.app.test', offline: true });
for (const variant of [undefined, '', 'invalid']) {
  const env = { ...offlineEnv };
  if (variant === undefined) delete env.APP_VARIANT;
  else env.APP_VARIANT = variant;
  assert.throws(() => execFileSync(process.execPath, ['-e', configCode], { cwd: stage, env, stdio: 'pipe' }));
  delete env.EAS_BUILD_PROFILE;
  assert.throws(() => execFileSync(process.execPath, ['-e', configCode], { cwd: stage, env, stdio: 'pipe' }));
}
assert.throws(() => execFileSync(process.execPath, ['-e', configCode], { cwd: root, env: offlineEnv, stdio: 'pipe' }));
console.log('PASS build intent: absent/empty/invalid variant rejected; root cannot prepare Test build; staged copy cannot fall back to official identity.');

// Reuse installed dependencies only for local resolution checks. No install, pods or prebuild.
const link = path.join(stage, 'node_modules');
fs.symlinkSync(path.join(root, 'node_modules'), link, 'dir');
try {
  const cli = path.join(root, 'node_modules/expo-modules-autolinking/bin/expo-modules-autolinking.js');
  const resolve = (directory, command, platform) => JSON.parse(execFileSync(process.execPath,
    [cli, command, '--platform', platform, '--project-root', directory, '--json'],
    { cwd: directory, env: { PATH: process.env.PATH, EXPO_NO_DOTENV: '1' }, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
  const originalExpo = resolve(root, 'resolve', 'apple');
  const testExpo = resolve(stage, 'resolve', 'apple');
  const originalRN = resolve(root, 'react-native-config', 'ios');
  const testRN = resolve(stage, 'react-native-config', 'ios');
  assert(originalExpo.modules.some((m) => m.packageName === 'expo-notifications'));
  assert(originalRN.dependencies['react-native-watch-connectivity']);
  for (const name of NATIVE_EXCLUSIONS) {
    assert(!testExpo.modules.some((m) => m.packageName === name));
    assert(!testRN.dependencies[name]);
  }
  assert(testExpo.modules.some((m) => m.packageName === 'expo-application'));
  assert(testRN.dependencies['@react-native-async-storage/async-storage']);
  console.log('PASS real installed autolinking/codegen exclusions: official Watch/push retained; Test Watch/push absent; ExpoApplication and AsyncStorage retained.');
} finally {
  fs.unlinkSync(link);
}
assert.equal(read('package.json'), originalPkg);
assert.equal(read('App.js'), originalApp);
assert.equal(read('react-native.config.js'), originalNativeConfig);
console.log('PASS source preservation: App and package.json unchanged. External Test source copy: ' + stage);
