// Local source preparation only: never runs EAS, installs dependencies or builds native code.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { NATIVE_EXCLUSIONS, validateStage } = require('../offlineTest/buildSafety.cjs');

function excluded(file) {
  return file.split('/').some((part) => /^(?:\.env.*|\.git|\.aws|\.codex|\.agents|\.claude|\.vscode|\.devcontainer|node_modules|ios|android|targets|supabase|dist|web-build|\.expo)$/i.test(part)) ||
    /\.(?:p8|p12|pem|key|jks|mobileprovision|ipa|apk|aab)$/i.test(file) ||
    /(?:credentials|service-account|google-services\.json|GoogleService-Info\.plist)/i.test(path.basename(file)) ||
    /(?:BACKUP|ROTTO|STABILE|PRIMA)/i.test(path.basename(file));
}

function prepareStage(root) {
  const sourceNativeConfig = require(path.join(root, 'react-native.config.js'));
  const nativeConfig = JSON.parse(JSON.stringify(sourceNativeConfig));
  nativeConfig.dependencies = { ...nativeConfig.dependencies };
  for (const name of NATIVE_EXCLUSIONS) {
    const existing = nativeConfig.dependencies[name];
    nativeConfig.dependencies[name] = { ...existing, platforms: { ...existing?.platforms, ios: null } };
  }
  const tracked = execFileSync('git', ['ls-files', '-z', '--cached'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const untracked = execFileSync('git', ['ls-files', '-z', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const authorized = (file) => ['.easignore', 'app.config.js', 'metro.config.js', 'runtimeMode.js',
    'scripts/test-offline-mode.cjs', 'scripts/prepare-offline-stage.cjs', 'scripts/test-offline-safety.cjs'].includes(file) || file.startsWith('offlineTest/');
  const files = [...new Set([...tracked, ...untracked.filter(authorized)])].filter((file) => !excluded(file));
  // Validate all paths before creating the destination; never follow source symlinks.
  for (const file of files) {
    const absolute = path.resolve(root, file);
    if (!absolute.startsWith(root + path.sep) || !fs.lstatSync(absolute).isFile()) {
      throw new Error('Sorgente non regolare nella copia Test: preparazione bloccata.');
    }
  }
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'vigilanza-offline-stage-'));
  if (destination.startsWith(root + path.sep)) throw new Error('La copia Test deve essere esterna al repository.');
  for (const file of files) {
    const output = path.join(destination, file);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.copyFileSync(path.join(root, file), output);
  }
  const pkgPath = path.join(destination, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.vigilanzaOfflineTest = true;
  pkg.expo = { ...pkg.expo, autolinking: { ...pkg.expo?.autolinking,
    ios: { ...pkg.expo?.autolinking?.ios,
      exclude: [...new Set([...(pkg.expo?.autolinking?.ios?.exclude || []), ...NATIVE_EXCLUSIONS])] } } };
  validateStage(pkg);
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  // Also disable React Native discovery/codegen, including its fallback without generated autolinking output.
  fs.writeFileSync(path.join(destination, 'react-native.config.js'), 'module.exports = ' +
    JSON.stringify(nativeConfig, null, 2) + ';\n');
  // This file exists only in the external Test source tree; official uploads keep their rules.
  fs.writeFileSync(path.join(destination, '.easignore'), fs.readFileSync(path.join(root, '.gitignore'), 'utf8') +
    '\n# Test-only upload exclusions\n.env*\n**/.env*\n.aws/\n.codex/\n.agents/\n.git/\n/targets/\n/supabase/\n*.ipa\n*.apk\n*.aab\n');
  // Keep only the dedicated profile in this copy, so no official build can be selected here.
  const easPath = path.join(destination, 'eas.json');
  const eas = JSON.parse(fs.readFileSync(easPath, 'utf8'));
  eas.build = { 'offline-test': eas.build['offline-test'] };
  delete eas.submit;
  fs.writeFileSync(easPath, JSON.stringify(eas, null, 2) + '\n');
  return destination;
}

if (require.main === module) console.log(prepareStage(path.resolve(__dirname, '..')));
module.exports = { excluded, prepareStage };
