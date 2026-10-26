const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const semver = require('semver');

function launchPlan(inherited = process.env, options = {}) {
  const root = __dirname, pkg = require('./package.json');
  const expoRoot = path.dirname(require.resolve('expo/package.json', { paths: [root] }));
  const bundled = JSON.parse(fs.readFileSync(path.join(expoRoot, 'bundledNativeModules.json'), 'utf8'));
  for (const [name, requested] of Object.entries(pkg.dependencies)) {
    const installed = require(require.resolve(name + '/package.json', { paths: [root] })).version;
    if (!semver.satisfies(installed, requested) || (bundled[name] && !semver.satisfies(installed, bundled[name]))) {
      throw new Error(`Dipendenza non compatibile con l’anteprima SDK 54: ${name} (${installed}).`);
    }
  }
  const env = { ...inherited, EXPO_NO_DOTENV: '1', EXPO_USE_METRO_WORKSPACE_ROOT: '0' };
  for (const key of Object.keys(env)) if (key.startsWith('EXPO_PUBLIC_') || key.startsWith('EAS_') || key === 'APP_VARIANT') delete env[key];
  if (env.EXPO_PACKAGER_PROXY_URL && !/^https?:\/\//.test(env.EXPO_PACKAGER_PROXY_URL)) {
    throw new Error('EXPO_PACKAGER_PROXY_URL deve essere un URL HTTP/HTTPS valido.');
  }
  if (options.web) env.BROWSER = 'none';
  const args = [path.join(expoRoot, 'bin/cli'), 'start', root,
    ...(options.web ? ['--web', '--host', 'lan', '--port', '8083'] : ['--go', '--tunnel', '--port', '8082'])];
  const webUrl = inherited.CODESPACE_NAME && inherited.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
    ? `https://${inherited.CODESPACE_NAME}-8083.${inherited.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}/` : 'http://localhost:8083/';
  return { command: process.execPath, args, cwd: root, env, webUrl };
}
if (require.main === module) {
  try {
    const web = process.argv.includes('--web');
    const plan = launchPlan(process.env, { web });
    if (process.argv.includes('--check')) {
      console.log(web ? 'Anteprima Expo Web: dipendenze compatibili; entry index.js; porta 8083.' : 'Anteprima SDK 54: dipendenze compatibili; entry index.js; porta 8082.');
      if (web) console.log('Safari (dopo avvio e inoltro porta): ' + plan.webUrl);
      console.log('Controllo completato. Nessun server avviato.');
    } else {
      if (web) console.log('Safari: ' + plan.webUrl);
      const child = spawn(plan.command, plan.args, { cwd: plan.cwd, env: plan.env, stdio: 'inherit' });
      child.on('error', error => { console.error(error.message); process.exitCode = 1; });
      child.on('exit', code => { process.exitCode = code ?? 1; });
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { launchPlan };
