import { normalizzaPreferenzaAspetto, selezionaPreset } from './temi';

export const ENERGY_KEY = '@vigilanza_home_risparmio_v1';
export const DECORATED_SCREENS = Object.freeze([
  'home', 'calendar', 'social', 'calendarioColleghi', 'impostazioni', 'aspettoColori',
  'impostazioniBiometria', 'impostazioniLegale', 'impostazioniFeedback', 'strumenti', 'stipendio',
  'listaChat', 'chatCollega', 'profiloCollega', 'profiliSocial', 'cercaCollegaSocial', 'profile', 'colleghi',
]);
const motif = (id, width, height, motion = 'static', background = false) => ({ id, width, height, motion, background });
export const THEME_MOTIFS = Object.freeze({
  natale: [motif('theme-art-christmas-tree',40,52),motif('theme-art-christmas-lights',49,34,'twinkle'),motif('theme-art-christmas-star',20,20,'twinkle'),...Array.from({length:4},(_,i)=>motif(`snow-${i}`,6,6,'snow',true))],
  halloween: [motif('theme-art-halloween-web',58,58),motif('theme-bat',48,28,'bat'),motif('theme-art-halloween-pumpkin',54,48),motif('theme-art-halloween-ghost',34,42,'drift'),motif('theme-art-halloween-zombie',30,45),motif('theme-bat',48,28,'bat'),motif('theme-art-halloween-glow',90,36,'twinkle',true)],
  cartoon: [motif('theme-art-cartoon-rainbow',115,70),motif('theme-art-cartoon-castle',74,64),motif('theme-art-cartoon-cloud',50,31,'drift'),motif('theme-art-cartoon-stars',42,38,'twinkle')],
  militare: [motif('theme-art-military-camo',82,62),motif('theme-art-military-compass',58,58),motif('theme-art-military-topography',78,44)],
  galaxy: [motif('theme-art-galaxy-planet',67,62),motif('theme-art-galaxy-stars',76,55,'drift'),motif('theme-art-galaxy-twinkle',18,18,'twinkle'),motif('theme-art-galaxy-moon',30,30),motif('theme-art-galaxy-nebula',90,36,'drift',true)],
  cyberpunk: [motif('theme-art-cyberpunk-circuit',112,22),motif('theme-art-cyberpunk-traces',72,20),motif('theme-art-cyberpunk-scan',25,25,'pulse')],
  inverno: [motif('theme-art-winter-frost',65,58),motif('theme-art-winter-crystal',57,57),motif('theme-winter-particle',13,13,'drift'),motif('theme-winter-particle',13,13,'twinkle')],
  'gold-special': [motif('theme-art-gold-filigree',54,63),motif('theme-art-gold-medallion',56,56),motif('theme-art-gold-shimmer',28,28,'drift'),motif('theme-art-gold-sparkles',60,24,'twinkle')],
});
export function specialTheme(preference) {
  const preset = selezionaPreset(normalizzaPreferenzaAspetto(preference).preset);
  return preset.special ? preset : null;
}
export function decorationBandHeight(height) { return height < 600 ? 44 : 54; }
export function layoutMotifs(id, width, height) {
  const motifs = THEME_MOTIFS[id] || [];
  const foreground = motifs.filter(m => !m.background), slot = Math.max(1,width - 16) / Math.max(1,foreground.length);
  let index = 0, snow = 0;
  return motifs.map((m, i) => {
    if (m.background) {
      const x = m.motion === 'snow' ? width * [.12,.36,.64,.88][snow++] : width * .43;
      return { ...m, key: `${m.id}-${i}`, x, y: m.motion === 'snow' ? -8 : 5, drawWidth:m.width, drawHeight:Math.min(m.height,height-8) };
    }
    const scale = Math.min(1,Math.max(1,height-12)/m.height,Math.max(1,slot-12)/m.width);
    const drawWidth=m.width*scale,drawHeight=m.height*scale;
    return { ...m, key:`${m.id}-${i}`,x:8+index++*slot+(slot-drawWidth)/2,y:(height-drawHeight)/2,drawWidth,drawHeight };
  });
}
export function motionPermitted({ready,reduced,foreground,energy,interacting}) {
  return Boolean(ready && !reduced && foreground && !energy && !interacting);
}

// Full Home background: finite SVG layers, anchored to the measured viewport.
// Foreground content is a later sibling; no layout space or hit targets are added.
export function layoutScenery(id, width, height) {
  const s=Math.min(1.3,Math.max(.65,width/390)),out=[];
  const add=(glyph,x,y,w,h,motion='static',opacity=.55)=>out.push({id:glyph,key:`scenery-${out.length}`,x:x*width,y:y*height,drawWidth:w*s,drawHeight:h*s,motion,opacity,background:false});
  if(id==='natale') {
    add('theme-art-christmas-lights',0,0,190,90,'twinkle',.8);
    add('theme-art-christmas-lights',.6,.02,160,80,'twinkle',.7);
    add('theme-art-christmas-tree',.82,.76,66,92,'static',.65);
    add('theme-art-christmas-star',.02,.32,24,24,'twinkle',.6);
    add('theme-art-christmas-star',.91,.43,18,18,'twinkle',.55);
    for(let i=0;i<14;i++) add(`snow-${i}`,((i*37)%97)/100,-.02,3+i%3,3+i%3,'snow',.48);
  } else if(id==='halloween') {
    add('theme-art-halloween-mist',-.2,.56,540,150,'mist',.25);
    add('theme-art-halloween-web',-.02,0,110,110,'static',.45);
    add('theme-art-halloween-pumpkin',.81,.79,76,68,'pulse',.75);
    add('theme-art-halloween-glow',.67,.75,170,95,'pulse',.32);
    add('theme-art-halloween-ghost',.02,.72,40,56,'drift',.3);
    add('theme-bat',-.2,.24,45,27,'fly',.65);
    add('theme-bat',-.2,.48,30,18,'fly',.5);
  } else if(id==='cartoon') {
    add('theme-art-cartoon-rainbow',.57,-.02,180,112,'static',.6);
    add('theme-art-cartoon-cloud',-.04,.2,95,60,'cloud',.5);
    add('theme-art-cartoon-cloud',.78,.46,90,56,'cloud',.4);
    add('theme-art-cartoon-castle',.79,.78,82,84,'static',.62);
    add('theme-art-cartoon-stars',.02,.65,46,44,'twinkle',.65);
    add('theme-art-cartoon-stars',.8,.12,34,32,'twinkle',.55);
  } else if(id==='militare') {
    for(let i=0;i<4;i++)add('theme-art-military-camo',i%2?.63:-.15,.03+i*.24,220,170,'static',.21);
    add('theme-art-military-topography',-.04,.46,155,110,'static',.3);
    add('theme-art-military-compass',.84,.8,56,56,'static',.65);
    add('theme-art-military-radar',.68,.05,135,135,'radar',.32);
  } else {
    const source=(THEME_MOTIFS[id]||[]).filter(m=>!m.background);
    source.forEach((m,i)=>add(m.id,i%2?.78:-.04,.08+i*.2,m.width*1.4,m.height*1.4,m.motion,.42));
    if(id==='galaxy')add('theme-art-galaxy-nebula',-.12,.38,390,180,'mist',.25);
  }
  return out;
}
