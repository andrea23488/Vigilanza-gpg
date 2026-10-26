const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const c = {}; vm.createContext(c);
for (const file of ['homeElectric.js', 'homeModel.js', 'temi.js']) vm.runInContext(fs.readFileSync(file, 'utf8').replaceAll('export function ', 'function ').replaceAll('export const ', 'var '), c);
const interpolate = (t, input, output) => {
  for (let i = 1; i < input.length; i++) if (t <= input[i]) return output[i-1] + (output[i] - output[i-1]) * (t - input[i-1]) / (input[i] - input[i-1]);
  return output.at(-1);
};
const distanceToSegment = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x-a.x)*dx + (p.y-a.y)*dy) / (dx*dx+dy*dy)));
  return Math.hypot(p.x-a.x-t*dx, p.y-a.y-t*dy);
};
const fixtures = [[296,310,2],[296,350,1],[336,420,1.5],[366,510,1],[576,680,1]];

test('scie continue lungo la circonferenza: tre elementi per ciascuno dei quattro colori',()=>{
 for(const [w,h,scale] of fixtures) {
  const g=c.geometriaHome(w,h,scale);
  for(let index=0;index<4;index++) {
   const route=c.percorsoElettrico(w,h,g.button,g.diameter,index);
   assert.ok(route.d.includes(' A '));assert.ok(route.ribbonD.endsWith(' Z'));
   for(let tail=0;tail<3;tail++) {
    const f=c.fotogrammiImpulso(route,index,tail);
    for(const range of [f.inputRange,f.opacityInput]) {
     assert.equal(range[0],0);assert.equal(range.at(-1),1);
     assert.ok(range.every((t,i)=>i===0||t>range[i-1]));
    }
    assert.equal(f.x[0],f.x.at(-1));assert.equal(f.y[0],f.y.at(-1));
    assert.equal(f.opacityOutput[0],f.opacityOutput.at(-1));
    assert.ok(Math.min(...f.opacityOutput)>0);
    for(let i=0;i<f.x.length;i++) assert.ok(Math.abs(Math.hypot(f.x[i]-route.cx,f.y[i]-route.cy)-route.radius)<1e-9);
    // Chord interpolation deviates by less than a third of a point, including on desktop.
    for(let i=0;i<1000;i++) {
     const t=i/1000,p={x:interpolate(t,f.inputRange,f.x),y:interpolate(t,f.inputRange,f.y)};
     assert.ok(Math.abs(Math.hypot(p.x-route.cx,p.y-route.cy)-route.radius)<0.3);
    }
   }
  }
 }
});
test('intensità delicata, code più deboli e velocità costante anche alla giunzione del loop',()=>{
 const route=c.percorsoElettrico(366,510,76,300,0);
 const head=c.fotogrammiImpulso(route,0),tail=c.fotogrammiImpulso(route,0,2);
 assert.ok(Math.max(...head.opacityOutput)-Math.min(...head.opacityOutput)<=0.25);
 assert.ok(Math.max(...tail.opacityOutput)<Math.min(...head.opacityOutput));
 const lengths=head.x.slice(1).map((x,i)=>Math.hypot(x-head.x[i],head.y[i+1]-head.y[i]));
 assert.ok(Math.max(...lengths)-Math.min(...lengths)<1e-9);
 assert.equal(c.ELECTRIC_CYCLE_MS,12000);
 const source=fs.readFileSync('ElectricConnections.js','utf8');
 assert.doesNotMatch(source,/rotate|scaleX|scaleY/);
 assert.match(source,/if\(!enabled\)return undefined/);
 assert.match(source,/loop.stop\(\)/);
});
test('tinte valide e coordinate ai temi originali, preset e colori personalizzati',()=>{
  const palettes=[c.PALETTE_ORIGINALE];
  for(const preset of c.PRESET_TEMI) palettes.push(c.paletteHomeDaPreferenza({version:1,preset:preset.id,background:null,accent:null})||c.PALETTE_ORIGINALE);
  for(const background of ['#FFFFFF','#07111F','#777777']) palettes.push(c.paletteHomeDaPreferenza({version:1,preset:'originale',background,accent:'#FDA4AF'}));
  for(const palette of palettes) {
    const colors=c.coloriCircuiti(palette);assert.equal(colors.length,4);
    assert.equal(new Set(colors).size,4);
    if(palette===c.PALETTE_ORIGINALE)assert.equal(colors[0],'#23B5FF');
    for(const color of colors) assert.match(color,/^#[0-9a-f]{6}$/i);
  }
});
test('nessun percorso degenerato con area nulla',()=>{
  assert.equal(c.percorsoElettrico(0,0,0,0,0),null);
});

// iPhone portrait, landscape, narrow browser and enlarged-text remaining stage areas.
test('orbita circolare 1:1, concentrica al core e ai pulsanti su viewport iPhone',()=>{
 for(const [vw,vh] of [[320,568],[375,667],[375,812],[390,844],[393,852],[430,932],[844,390]]) {
  for(const font of [1,1.5,2]) {
   const w=vw-40,h=Math.max(80,vh-230-(font-1)*48),size=Math.min(w,h);
   const g=c.geometriaHome(w,h,font),cx=w/2,cy=size/2,r=size*.442;
   assert.equal(g.panelHeight,size);
   assert.ok(Math.abs(g.left+g.diameter/2-cx)<1e-9);
   assert.ok(Math.abs(g.top+g.diameter/2-cy)<1e-9);
   for(const p of g.buttons) assert.ok(Math.abs(Math.hypot(p.left+g.button/2-cx,p.top+g.button/2-cy)-r)<1e-9);
   const points=[];
   for(let i=0;i<4;i++) {
    const route=c.percorsoElettrico(w,h,g.button,g.diameter,i);
    for(const p of route.points) {
     assert.ok(Math.abs(Math.hypot(p.x-size/2,p.y-size/2)-r)<1e-9);
     points.push(p);
    }
   }
   const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
   assert.ok(Math.abs((Math.max(...xs)-Math.min(...xs))-(Math.max(...ys)-Math.min(...ys)))<1e-9);
   assert.ok(size<=w&&size<=h);
  }
 }
});
test('SVG esterno quadrato, meet e nessuna trasformazione anisotropa',()=>{
 const source=fs.readFileSync('ElectricConnections.js','utf8');
 assert.match(source,/viewBox=\{`0 0 \$\{size\} \$\{size\}`\}/);
 assert.match(source,/preserveAspectRatio="xMidYMid meet"/);
 assert.match(source,/width:size,height:size,aspectRatio:1/);
 assert.doesNotMatch(source,/scaleX|scaleY/);
});

test('centro ingrandito del 20–25% senza intersecare i pulsanti su iPhone',()=>{
 for(const [w,h] of [[280,250],[335,437],[350,614],[390,702]]) {
  const g=c.geometriaHome(w,h),size=Math.min(w,h),button=size*.22;
  const oldOffset=size*.4/Math.SQRT2;
  const previous=2*(Math.hypot(oldOffset-button/2,oldOffset-button*.66)-6*size/280);
  assert.ok(g.diameter/previous>=1.2&&g.diameter/previous<=1.25);
  for(const p of g.buttons) {
   const cx=g.left+g.diameter/2,cy=g.top+g.diameter/2;
   const dx=Math.max(p.left-cx,0,cx-p.left-g.button),dy=Math.max(p.top-cy,0,cy-p.top-g.button*1.16);
   assert.ok(Math.hypot(dx,dy)>g.diameter/2);
  }
 }
});
