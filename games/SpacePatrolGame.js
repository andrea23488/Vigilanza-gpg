import React, { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Ellipse, Rect } from 'react-native-svg';
import { advanceGame, clampShip, createGame, ENEMY, SHIP } from './spacePatrolEngine';
const text = { color: '#FFF', fontWeight: '700' };
function EnemySprite() { return <Svg width={28} height={28} viewBox="0 0 28 28"><Path d="M3 4L10 9H18L25 4L23 18L18 24L16 18H12L10 24L5 18Z" fill="#CB416F" stroke="#FF9DB9" strokeWidth="1.4"/><Ellipse cx="14" cy="12" rx="5" ry="4" fill="#60E4E9"/><Path d="M6 15H10M18 15H22" stroke="#FFDD77" strokeWidth="2"/></Svg>; }
export default function SpacePatrolGame({ onBack }) {
  const [size, setSize] = useState({ width: 300, height: 400 });
  const [game, setGame] = useState(() => createGame(300));
  const [running, setRunning] = useState(true);
  const gameRef = useRef(game), target = useRef(game.shipX), drag = useRef(null);
  useEffect(() => { const subscription = AppState.addEventListener('change', status => { if (status !== 'active') { setRunning(false); drag.current = null; } }); return () => subscription.remove(); }, []);
  useEffect(() => {
    if (!running || game.lives <= 0) return;
    let frame, previous;
    const tick = time => {
      const dt = previous == null ? 0 : (time - previous) / 1000; previous = time;
      gameRef.current = advanceGame(gameRef.current, dt, size.width, size.height, target.current);
      setGame(gameRef.current);
      if (gameRef.current.lives > 0) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, size.width, size.height, game.lives <= 0]);
  const restart = () => { const fresh = createGame(size.width); gameRef.current = fresh; target.current = fresh.shipX; setGame(fresh); setRunning(true); };
  const move = event => { if (drag.current && running) target.current = clampShip(drag.current.shipX + event.nativeEvent.pageX - drag.current.pageX, size.width); };
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#050E21' }}><View style={{ flex: 1, padding: 12, gap: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Pressable accessibilityLabel="Indietro" onPress={onBack} style={{ minHeight: 44, justifyContent: 'center', padding: 8 }}><Text style={text}>‹ Sala giochi</Text></Pressable><Text style={text}>SPACE PATROL</Text><Pressable onPress={() => setRunning(v => !v)} style={{ minHeight: 44, justifyContent: 'center', padding: 8 }}><Text style={text}>{running ? 'Pausa' : 'Riprendi'}</Text></Pressable></View>
    <Text style={[text, { textAlign: 'center' }]}>PUNTI {game.score}     VITE {'♥'.repeat(game.lives)}</Text>
    <View accessibilityLabel="Campo Space Patrol: trascina per muovere la navicella" onLayout={({ nativeEvent: { layout } }) => setSize({ width: layout.width, height: layout.height })}
      onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderTerminationRequest={() => false}
      onResponderGrant={event => { drag.current = { pageX: event.nativeEvent.pageX, shipX: target.current }; }} onResponderMove={move}
      onResponderRelease={() => { drag.current = null; }} onResponderTerminate={() => { drag.current = null; }}
      style={{ flex: 1, minHeight: 180, maxWidth: 520, width: '100%', alignSelf: 'center', overflow: 'hidden', backgroundColor: '#03091B', borderRadius: 18, borderWidth: 1, borderColor: '#6558A6', touchAction: 'none' }}>
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: 24 }, (_, i) => <View key={`star${i}`} style={{ position: 'absolute', width: 2, height: 2, backgroundColor: '#9BB1D2', left: `${(i * 37) % 97}%`, top: `${(i * 23) % 97}%` }} />)}
        {game.enemies.map(e => <View key={e.id} style={{ position: 'absolute', left: e.x, top: e.y, ...ENEMY }}><EnemySprite /></View>)}
        {game.bullets.map(b => <View key={b.id} style={{ position: 'absolute', left: b.x, top: b.y, width: 4, height: 14, borderRadius: 2, backgroundColor: '#6EF5F1' }} />)}
        <View style={{ position: 'absolute', left: clampShip(game.shipX, size.width), top: size.height - SHIP.height - 10, ...SHIP }}><Svg width={36} height={34} viewBox="0 0 36 34"><Path d="M18 2L26 20L34 27L22 26L18 32L14 26L2 27L10 20Z" fill="#76B8FC" stroke="#D8F6FF" strokeWidth="1.4"/><Rect x="15" y="12" width="6" height="10" rx="3" fill="#173A74" /></Svg></View>
      </View>
      {(!running || game.lives <= 0) && <View style={{ position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#03091BCC' }}><Text style={[text, { fontSize: 24 }]}>{game.lives <= 0 ? 'Partita terminata' : 'Pausa'}</Text></View>}
    </View>
    <Text style={[text, { fontSize: 12, textAlign: 'center' }]}>Trascina sul campo. La navicella spara automaticamente.</Text>
    <Pressable onPress={restart} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: '#18325A', borderRadius: 12 }}><Text style={text}>Nuova partita</Text></Pressable>
  </View></SafeAreaView>;
}
