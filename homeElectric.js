// Presentation-only color roles and sampled curved ribbons. No API/payroll logic.
export const ELECTRIC_CYCLE_MS = 12000;
export const COLORI_NEON_HOME = Object.freeze(['#23B5FF', '#FFA45C', '#48E5A3', '#D255FF']);
export function miscelaNeon(a,b,amount) {
  const parse=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  const x=parse(a),y=parse(b);
  return '#'+x.map((value,i)=>Math.round(value*(1-amount)+y[i]*amount).toString(16).padStart(2,'0')).join('');
}
export function coloriCircuiti(palette) {
  if (Array.isArray(palette.circuitColors) && palette.circuitColors.length === 4) return palette.circuitColors;
  const original=palette.background.toUpperCase()==='#07111F' && palette.homeAccent.toUpperCase()==='#5EEBFF';
  return COLORI_NEON_HOME.map(color=>original?color:miscelaNeon(color,palette.homeAccent,0.16));
}

export function percorsoElettrico(width,height,button,diameter,index) {
  if(width<=0 || height<=0 || button<=0)return null;
  const size=Math.min(width,height),cx=size/2,cy=size/2,radius=size*0.442;
  // Exact circular quadrants, in button colour order: TL, TR, BL, BR.
  const start=[-135,-45,135,45][index]*Math.PI/180;
  if(!Number.isFinite(start))return null;
  const points=Array.from({length:33},(_,i)=>{
    const angle=start+i/32*Math.PI/2;
    return {x:cx+radius*Math.cos(angle),y:cy+radius*Math.sin(angle)};
  });
  const a=points[0],d=points[32];
  let total=0;
  const cumulative=points.map((p,i)=>{if(i)total+=Math.hypot(p.x-points[i-1].x,p.y-points[i-1].y);return total;});
  if(total<1)return null;
  const normals=points.map((p,i)=>{
    const q=points[Math.min(i+1,32)],r=points[Math.max(0,i-1)],distance=Math.hypot(q.x-r.x,q.y-r.y)||1;
    return {x:-(q.y-r.y)/distance,y:(q.x-r.x)/distance};
  });
  const edge=sign=>points.map((p,i)=>{
    const thickness=Math.sin(i/32*Math.PI)*(size*0.014)*(1+0.25*Math.sin(i*0.7));
    return {x:p.x+normals[i].x*thickness*sign,y:p.y+normals[i].y*thickness*sign};
  });
  const polygon=[...edge(1),...edge(-1).reverse()];
  return {cx,cy,radius,start,points,fractions:cumulative.map(v=>v/total),
    d:`M ${a.x} ${a.y} A ${radius} ${radius} 0 0 1 ${d.x} ${d.y}`,
    ribbonD:polygon.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' ')+' Z'};
}

// A closed full-circle trajectory avoids a visible reset at arc boundaries.
// The fixed coloured SVG quarters and the buttons never rotate.
export function fotogrammiImpulso(route,index,tail=0) {
  const inputRange=[],x=[],y=[];
  const start=route.start-tail*0.035;
  for(let i=0;i<=128;i++) {
    const angle=start+i/128*Math.PI*2;
    inputRange.push(i/128);
    x.push(route.cx+route.radius*Math.cos(angle));
    y.push(route.cy+route.radius*Math.sin(angle));
  }
  // Identical seam endpoints prevent floating point drift at loop restart.
  x[128]=x[0];y[128]=y[0];
  const strength=0.8-tail*0.2;
  return {inputRange,x,y,opacityInput:[0,0.25,0.5,0.75,1],
    opacityOutput:[strength*0.85,strength,strength*0.85,strength*0.7,strength*0.85]};
}
