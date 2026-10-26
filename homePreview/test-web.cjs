const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { getConfig } = require('@expo/config');
const { launchPlan } = require('./start.cjs');
const root = __dirname;

test('web usa dipendenze presenti, porta dedicata e indirizzo Codespaces HTTPS senza tunnel ngrok', () => {
  const plan=launchPlan({ CODESPACE_NAME:'demo-space',GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:'app.github.dev',EXPO_PUBLIC_SUPABASE_URL:'demo-segreto' },{web:true});
  assert.ok(plan.args.includes('--web'));assert.ok(plan.args.includes('8083'));assert.ok(plan.args.includes('lan'));
  assert.ok(!plan.args.includes('--tunnel'));assert.ok(!plan.args.includes('--go'));
  assert.equal(plan.webUrl,'https://demo-space-8083.app.github.dev/');
  assert.equal(plan.env.EXPO_PUBLIC_SUPABASE_URL,undefined);assert.equal(plan.env.EXPO_NO_DOTENV,'1');
  assert.equal(plan.env.BROWSER,'none');
  const config=getConfig(root);assert.ok(config.exp.platforms.includes('web'));assert.equal(config.exp.web.bundler,'metro');assert.equal(config.exp.web.output,'single');
});

function viewportFixture(withVisual=true) {
  const handlers = new Map(), visualHandlers = new Map(), writes = [], head = [];
  const visual = { height: 650, scale: 1, addEventListener: (name,fn)=>visualHandlers.set(name,fn), removeEventListener: name=>visualHandlers.delete(name) };
  const win = { innerHeight: 740, visualViewport: withVisual?visual:undefined,
    addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name) };
  const doc = { querySelector:()=>null,createElement:()=>({}),head:{appendChild:node=>head.push(node)},documentElement:{style:{setProperty:(key,value)=>writes.push([key,value])}} };
  const source=fs.readFileSync(path.join(root,'webLayout.web.js'),'utf8').replace(/^import .*;\n/m,'').replaceAll('export function ','function ');
  const context={};vm.createContext(context);vm.runInContext(source,context);
  const cleanup=context.installPreviewViewport(win,doc);
  return {win,visual,handlers,visualHandlers,writes,head,cleanup};
}
test('Safari: viewport-fit=cover, altezza utile aggiornata con barre browser e orientamento', () => {
  const r=viewportFixture();
  assert.ok(r.head[0].content.includes('viewport-fit=cover'));assert.ok(!r.head[0].content.includes('user-scalable=no'));
  assert.equal(r.writes.at(-1)[1],'650px');
  r.visual.height=720;r.visualHandlers.get('resize')();assert.equal(r.writes.at(-1)[1],'720px');
  r.visual.height=360;r.handlers.get('orientationchange')();assert.equal(r.writes.at(-1)[1],'360px');
  const count=r.writes.length;r.handlers.get('resize')();assert.equal(r.writes.length,count);
  r.cleanup();assert.equal(r.handlers.size,0);assert.equal(r.visualHandlers.size,0);
});
test('lo zoom resta consentito e non comprime la Home; fallback senza VisualViewport', () => {
  const r=viewportFixture();const count=r.writes.length;r.visual.scale=2;r.visual.height=320;r.visualHandlers.get('resize')();assert.equal(r.writes.length,count);
  const fallback=viewportFixture(false);assert.equal(fallback.writes.at(-1)[1],'740px');
  fallback.win.innerHeight=600;fallback.handlers.get('resize')();assert.equal(fallback.writes.at(-1)[1],'600px');
});
test('il documento non scorre, le safe area restano al provider reale e il layout nativo è invariato', () => {
  const css=fs.readFileSync(path.join(root,'preview.css'),'utf8');
  assert.match(css,/overflow:\s*hidden/);assert.match(css,/height:\s*100dvh/);assert.match(css,/var\(--preview-height/);
  assert.ok(!css.includes('padding: env('));
  assert.ok(fs.readFileSync(path.join(root,'index.js'),'utf8').includes("import './webLayout'"));
  assert.ok(!fs.readFileSync(path.join(root,'webLayout.js'),'utf8').includes('document.'));
});
