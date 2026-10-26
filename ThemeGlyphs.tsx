import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
// Vector artwork reused from the approved preview; no images, fonts or remote assets.
export default function ThemeGlyph({id,width,height,secondary,background}:{id:string;width:number;height:number;secondary:string;background:string}) {
 const scale=1, palette={background};
 let size=[6,6], art:React.ReactNode=<Circle cx="3" cy="3" r="2" fill="#F2FBFF"/>;
 switch(id) {
case "theme-art-military-radar": size=[120,120]; art=<><Circle cx="60" cy="60" r="55" fill="none" stroke="#99C77E" strokeWidth="1"/><Circle cx="60" cy="60" r="36" fill="none" stroke="#99C77E" opacity=".55"/><Circle cx="60" cy="60" r="17" fill="none" stroke="#99C77E" opacity=".35"/><Path d="M60 5v110M5 60h110" stroke="#99C77E" opacity=".4"/><Path d="M60 60V5A55 55 0 0 1 108 33Z" fill="#A9DA82" opacity=".25"/><Path d="M60 60V5" stroke="#CDE8AE" strokeWidth="2"/><Circle cx="82" cy="34" r="2" fill="#D9F4B3"/></>;break;
case "theme-art-halloween-mist": size=[540,150]; art=<>{[0,1,2,3].map(i=><Ellipse key={i} cx={80+i*120} cy={75+(i%2)*12} rx="140" ry={25+i*7} fill="#B7A2D3" opacity=".12"/>)}</>;break;
case "theme-art-christmas-tree": size=[40,52]; art=<>
        <Path d="M20 2 10 15h6L6 27h9l-4 8h8v14h6V35h8l-4-8h9L24 15h6Z" fill="#237D56" stroke="#90E6B0" strokeWidth="1.2"/><Path d="m20 2 2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4Z" fill="#FFD779"/><Circle cx="17" cy="22" r="2" fill="#F66C78"/><Circle cx="25" cy="30" r="2" fill="#F5D064"/><Circle cx="19" cy="38" r="1.7" fill="#86E5EF"/>
      </>; break;
case "theme-art-christmas-lights": size=[49,34]; art=<>
        <Path d="M2 7Q14 22 26 8T47 10" stroke="#D7C877" strokeWidth="1.3" fill="none"/><Circle cx="9" cy="14" r="3" fill="#E75364"/><Circle cx="24" cy="12" r="3" fill="#65D9A2"/><Circle cx="39" cy="12" r="3" fill="#F2D06C"/><Circle cx="9" cy="14" r="1" fill="#FFF4C4"/><Circle cx="24" cy="12" r="1" fill="#D8FFF0"/><Circle cx="39" cy="12" r="1" fill="#FFF4C4"/>
      </>; break;
case "theme-art-christmas-star": size=[20,20]; art=<><Path d="m10 1 2.2 6.2L19 10l-6.8 2.8L10 19l-2.2-6.2L1 10l6.8-2.8Z" fill="#F8D878"/><Circle cx="10" cy="10" r="2" fill="#FFF6D2"/></>; break;
case "theme-art-halloween-web": size=[58,58]; art=<>
        <Path d="M2 2Q30 12 56 2M2 2Q14 30 2 56M2 2Q33 29 56 56M4 12Q17 17 18 4M7 24Q24 30 30 7M11 38Q32 44 43 13" stroke="#A98CD2" strokeWidth="1.2" opacity=".8" fill="none"/><Circle cx="7" cy="8" r="2.2" fill="#C8B5E1"/>
      </>; break;
case "theme-art-halloween-pumpkin": size=[54,48]; art=<>
        <Ellipse cx="27" cy="27" rx="22" ry="18" fill="#F08028" stroke="#FFB04D" strokeWidth="1.5"/><Path d="M27 8q-4 10 0 36M16 13q7 12 0 27M38 13q-7 12 0 27" stroke="#C7591C" strokeWidth="1.5" fill="none"/><Path d="M25 9q-1-7 5-8l3 2-4 7" fill="#71A54A"/><Path d="m18 22 4 4 4-4M29 22l4 4 4-4M20 34q7 5 14 0" stroke="#31182F" strokeWidth="2.3" strokeLinecap="round" fill="none"/>
      </>; break;
case "theme-art-halloween-ghost": size=[34,42]; art=<>
        <Path d="M17 2C8 2 4 10 4 19v19l7-5 6 5 6-5 7 5V19C30 10 26 2 17 2Z" fill="#D8D3E5" opacity=".82"/><Circle cx="12" cy="18" r="2" fill="#33223D"/><Circle cx="22" cy="18" r="2" fill="#33223D"/><Path d="M14 26q3 3 6 0" stroke="#33223D" strokeWidth="1.7" fill="none"/>
      </>; break;
case "theme-art-halloween-zombie": size=[30,45]; art=<>
        <Circle cx="15" cy="8" r="6" fill="#8C9B68"/><Path d="M9 7 5 3M20 8l5-3M12 7l2 1m5-2-2 2M12 13l-3 14 5 2 2-8 3 8 5-2-4-14ZM9 16 3 25l3 2 6-7m9-4 7 7-3 3-7-6" fill="#667751" stroke="#9CAC76" strokeWidth="1.2" strokeLinejoin="round"/><Path d="m12 30-2 12m10-11 3 11" stroke="#91A272" strokeWidth="2.3" strokeLinecap="round"/><Circle cx="13" cy="8" r="1" fill="#DAE59B"/><Circle cx="18" cy="8" r="1" fill="#DAE59B"/>
      </>; break;
case "theme-art-cartoon-rainbow": size=[115,70]; art=<>
        <Path d="M5 65a52 52 0 0 1 104 0" stroke="#FF5CA8" strokeWidth="8" fill="none"/><Path d="M15 65a42 42 0 0 1 84 0" stroke="#FFE66D" strokeWidth="7" fill="none"/><Path d="M25 65a32 32 0 0 1 64 0" stroke="#6DEBFF" strokeWidth="7" fill="none"/><Path d="M35 65a22 22 0 0 1 44 0" stroke="#8E76FF" strokeWidth="7" fill="none"/>
        <Ellipse cx="10" cy="61" rx="12" ry="7" fill="#E7F7FF"/><Ellipse cx="105" cy="61" rx="12" ry="7" fill="#E7F7FF"/>
      </>; break;
case "theme-art-cartoon-castle": size=[74,64]; art=<>
        <Rect x="17" y="24" width="41" height="38" rx="2" fill="#9B83F4" stroke="#C8B7FF" strokeWidth="1.3"/><Path d="M7 27V8h13v19M55 27V8h13v19M24 24V5h11v19M41 24V5h11v19" fill="#F5A4D3" stroke="#FAD4F0" strokeWidth="1.2"/><Path d="m6 8 7-7 7 7M54 8l7-7 7 7M23 5l6-5 6 5M40 5l6-5 6 5" fill="#FFE66D"/><Rect x="32" y="42" width="12" height="20" rx="6" fill="#FFE7A6"/><Circle cx="37" cy="32" r="3" fill="#6DEBFF"/>
      </>; break;
case "theme-art-cartoon-stars": size=[42,38]; art=<><Path d="m11 2 2.5 7.5L21 12l-7.5 2.5L11 22l-2.5-7.5L1 12l7.5-2.5Z" fill="#FFE66D"/><Path d="m32 17 1.8 5.2L39 24l-5.2 1.8L32 31l-1.8-5.2L25 24l5.2-1.8Z" fill="#FF8BCC"/></>; break;
case "theme-art-military-camo": size=[82,62]; art=<>
        <Path d="M0 10q18-18 32 2t32 0q15-10 18 1v19q-16 6-27-1T27 35Q12 29 0 41Z" fill="#718052" opacity=".48"/><Path d="M0 40q14-12 27-3t26 1q18-10 29 2v18H0Z" fill="#B2A078" opacity=".4"/><Ellipse cx="58" cy="15" rx="13" ry="7" fill="#394630" opacity=".65"/><Ellipse cx="18" cy="25" rx="11" ry="8" fill="#3C4B30" opacity=".56"/>
      </>; break;
case "theme-art-military-compass": size=[58,58]; art=<>
        <Circle cx="29" cy="29" r="24" fill="#19261B" fillOpacity=".66" stroke="#C4B68D" strokeWidth="1.5"/><Circle cx="29" cy="29" r="18" fill="none" stroke="#8CA276" strokeWidth="1"/><Path d="m29 8 5 20-5 22-5-22Z" fill="#D5C38D"/><Path d="m29 8-5 20 5-5 5 5Z" fill="#9B4D3C"/><Circle cx="29" cy="29" r="2.5" fill="#F1DFA8"/><Path d="M29 1v5M29 52v5M1 29h5M52 29h5" stroke="#C9BD9D" strokeWidth="1.5"/><TextCompass />
      </>; break;
case "theme-art-military-topography": size=[78,44]; art=<>
        <Path d="M2 40q5-18 22-12t20-13q8-15 30-11M0 30q11-17 24-7t22-16q10-10 28-3M8 43q11-5 18 0t21-8q11-8 25-5" stroke="#A5B58A" strokeWidth="1.2" opacity=".8" fill="none"/><Circle cx="46" cy="15" r="2" fill="#D5C38D"/>
      </>; break;
case "theme-art-galaxy-planet": size=[67,62]; art=<>
        <Ellipse cx="34" cy="33" rx="30" ry="10" fill="none" stroke="#72DCF5" strokeWidth="2.5" transform="rotate(-22 34 33)"/><Circle cx="34" cy="31" r="19" fill="#7656C5" stroke="#B49CFF" strokeWidth="1.5"/><Path d="M18 27q16-11 31 1M18 35q15 10 31-1" stroke="#C3A9FF" strokeWidth="3" opacity=".45" fill="none"/><Circle cx="27" cy="24" r="4" fill="#A38DE8" opacity=".7"/>
      </>; break;
case "theme-art-galaxy-stars": size=[76,55]; art=<>
        <Path d="m9 12 20 15 17-19 20 26" stroke="#7866B9" strokeWidth="1" opacity=".6" fill="none"/>{[[9,12],[29,27],[46,8],[66,34],[20,48],[55,50]].map(([cx,cy],i)=><Path key={i} d={`M${cx} ${cy-4} ${cx+1.2} ${cy-1} ${cx+4} ${cy} ${cx+1.2} ${cy+1} ${cx} ${cy+4} ${cx-1} ${cy+1} ${cx-4} ${cy} ${cx-1} ${cy-1}Z`} fill={i%2?secondary:'#FFF3B1'}/>)}
      </>; break;
case "theme-art-galaxy-moon": size=[30,30]; art=<><Circle cx="15" cy="15" r="11" fill="#D9D1FF" opacity=".82"/><Circle cx="20" cy="11" r="10" fill={palette.background}/><Circle cx="9" cy="18" r="1.2" fill="#A68BFF"/></>; break;
case "theme-art-cyberpunk-circuit": size=[112,22]; art=<><G transform="translate(0,22) rotate(-90)">
        <Path d="M3 4v21h15v15H4v20h14v15H7v18h13" stroke="#00E5FF" strokeWidth="2" opacity=".8" fill="none"/><Path d="M19 7h-7v18H5v15" stroke="#FF2E93" strokeWidth="1.7" opacity=".76" fill="none"/><Circle cx="3" cy="4" r="2" fill="#00E5FF"/><Circle cx="20" cy="93" r="2" fill="#FF2E93"/><Circle cx="5" cy="40" r="2" fill="#B7FF3C"/>
      </G></>; break;
case "theme-art-cyberpunk-traces": size=[72,20]; art=<><G transform="translate(0,20) rotate(-90)">
        <Path d="M2 2h13v18H4v16h13v17H5v17" stroke="#FF2E93" strokeWidth="1.6" fill="none"/><Circle cx="15" cy="2" r="2.2" fill="#00E5FF"/><Circle cx="4" cy="36" r="2.2" fill="#B7FF3C"/>
      </G></>; break;
case "theme-art-winter-frost": size=[65,58]; art=<>
        <Path d="M0 4Q18 11 28 0M0 13Q22 20 40 4M0 23Q18 31 52 10M3 0v26M12 6v25M22 11v23" stroke="#D8F5FF" strokeWidth="1.5" opacity=".76" fill="none"/><Snowflake color="#B8E8FF" x={30} y={20} size={25}/>
      </>; break;
case "theme-art-winter-crystal": size=[57,57]; art=<><Snowflake color="#9DDCFF" size={52 * scale}/><Circle cx={26 * scale} cy={26 * scale} r={3 * scale} fill="#F3FCFF"/></>; break;
case "theme-art-gold-filigree": size=[54,63]; art=<>
        <Path d="M1 1h28q22 0 22 22v39M1 9h22q16 0 16 16v37M1 17h16q9 0 9 9v36" stroke="#D9B45B" strokeWidth="1.2" opacity=".8" fill="none"/><Circle cx="29" cy="1" r="2" fill="#FFF0BC"/><Circle cx="39" cy="25" r="2" fill="#E7C46F"/>
      </>; break;
case "theme-art-gold-medallion": size=[56,56]; art=<>
        <Circle cx="28" cy="28" r="23" fill="#302512" fillOpacity=".72" stroke="#D9B45B" strokeWidth="1.5"/><Circle cx="28" cy="28" r="17" fill="none" stroke="#F0D38A" strokeWidth=".8"/><Path d="m28 11 4.5 11.5L45 28l-12.5 5.5L28 45l-4.5-11.5L11 28l12.5-5.5Z" fill="#D9B45B"/><Circle cx="28" cy="28" r="4" fill="#FFF0BC"/>
      </>; break;
case "theme-art-cartoon-cloud": size=[50,31]; art=<><Path d="M8 26a8 8 0 0 1 0-16 12 12 0 0 1 23-2 9 9 0 0 1 9 18Z" fill="#D7F4FF" stroke="#83DDF4" strokeWidth="1.5"/><Path d="m24 12 1.8 4.5 4.8 1.7-4.8 1.8-1.8 4.7-1.7-4.7-4.8-1.8 4.8-1.7Z" fill="#FFE66D"/></>; break;
case "theme-art-galaxy-twinkle": size=[18,18]; art=<><Path d="m9 0 2.1 6 6 3-6 2.1L9 17l-2.1-5.9L1 9l5.9-3Z" fill="#FFF2BE"/></>; break;
case "theme-art-cyberpunk-scan": size=[25,25]; art=<><Circle cx="12.5" cy="12.5" r="6" fill="#00E5FF" fillOpacity=".18" stroke="#00E5FF" strokeWidth="1.3"/><Circle cx="12.5" cy="12.5" r="2.2" fill="#E7FFFF"/></>; break;
case "theme-winter-particle": size=[13,13]; art=<><Path d="M6.5 0v13M1 3.2l11 6.6M1 9.8l11-6.6" stroke="#DDF6FF" strokeWidth="1"/></>; break;
case "theme-art-gold-shimmer": size=[28,28]; art=<><Path d="m14 1 3.2 9.8L27 14l-9.8 3.2L14 27l-3.2-9.8L1 14l9.8-3.2Z" fill="#FFF0BC"/></>; break;
case "theme-bat": size=[48,28]; art=<><Path d="M24 12 20 7 15 3 14 10 8 5 8 13 2 9 4 19 11 23 18 21 24 26 30 21 37 23 44 19 46 9 40 13 40 5 34 10 33 3 28 7Z" fill="#AB78E8"/><Circle cx="20" cy="15" r="1" fill="#FFF1B8"/><Circle cx="28" cy="15" r="1" fill="#FFF1B8"/></>; break;
case "theme-art-galaxy-nebula": size=[90,36]; art=<><Ellipse cx="40" cy="18" rx="39" ry="16" fill="#7656C5" opacity=".24"/><Ellipse cx="50" cy="18" rx="29" ry="10" fill="#38D4F5" opacity=".18"/></>; break;
case "theme-art-halloween-glow": size=[90,36]; art=<><Ellipse cx="25" cy="18" rx="24" ry="16" fill="#FF7A24" opacity=".2"/><Ellipse cx="65" cy="18" rx="24" ry="16" fill="#9A57FF" opacity=".2"/></>; break;
case "theme-art-gold-sparkles": size=[60,24]; art=<><Path d="m10 2 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z M34 8l2 4 4 2-4 2-2 4-2-4-4-2 4-2Z M52 1l1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" fill="#FFF0BC"/></>; break;
}
 return <Svg width={width} height={height} viewBox={`0 0 ${size[0]} ${size[1]}`} accessible={false}>{art}</Svg>;
}
function Snowflake({ color, x = 0, y = 0, size = 34 }: { color: string; x?: number; y?: number; size?: number }) {
  return <Svg x={x} y={y} width={size} height={size} viewBox="0 0 40 40"><Path d="M20 2v36M4.4 11l31.2 18M4.4 29 35.6 11M15 6l5 4 5-4M15 34l5-4 5 4M6 16l6-1 1-6M34 24l-6 1-1 6M6 24l6 1 1 6M34 16l-6-1-1-6" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none"/></Svg>;
}

function TextCompass() { return <Path d="M29 4v4M29 50v4M4 29h4M50 29h4" stroke="#D5C38D" strokeWidth="1.2"/>; }
