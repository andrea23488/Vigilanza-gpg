import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  PanResponder,
} from 'react-native';

const FIELD_W = 320;
const FIELD_H = 440;

const PADDLE_W = 10;
const PADDLE_H = 86;

const BALL = 12;

const PLAYER_X = 18;
const CPU_X = FIELD_W - 18 - PADDLE_W;

const START_SPEED_X = 185;
const START_SPEED_Y = 115;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export default function PongGame({ onBack }) {
  const [playerY, setPlayerY] = useState((FIELD_H - PADDLE_H) / 2);
  const [cpuY, setCpuY] = useState((FIELD_H - PADDLE_H) / 2);

  const [ball, setBall] = useState({
    x: (FIELD_W - BALL) / 2,
    y: (FIELD_H - BALL) / 2,
  });

  const [scorePlayer, setScorePlayer] = useState(0);
  const [scoreCpu, setScoreCpu] = useState(0);

  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);

  const playerYRef = useRef(playerY);
  const cpuYRef = useRef(cpuY);

  const ballRef = useRef({
    x: (FIELD_W - BALL) / 2,
    y: (FIELD_H - BALL) / 2,
  });

  const velocityRef = useRef({
    x: START_SPEED_X,
    y: START_SPEED_Y,
  });

  const runningRef = useRef(running);
  const gameOverRef = useRef(gameOver);

  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);

  useEffect(() => {
    playerYRef.current = playerY;
  }, [playerY]);

  useEffect(() => {
    cpuYRef.current = cpuY;
  }, [cpuY]);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);

  const resetBall = direction => {
    const next = {
      x: (FIELD_W - BALL) / 2,
      y: (FIELD_H - BALL) / 2,
    };

    ballRef.current = next;
    setBall(next);

    velocityRef.current = {
      x: START_SPEED_X * direction,
      y:
        START_SPEED_Y *
        (Math.random() > 0.5 ? 1 : -1),
    };
  };

  const endPoint = who => {
    setRunning(false);
    setGameOver(true);
    setWinner(who);
  };

  const addPointPlayer = () => {
    setScorePlayer(prev => {
      const next = prev + 1;

      if (next >= 5) {
        endPoint('TU');
      } else {
        resetBall(-1);
      }

      return next;
    });
  };

  const addPointCpu = () => {
    setScoreCpu(prev => {
      const next = prev + 1;

      if (next >= 5) {
        endPoint('CPU');
      } else {
        resetBall(1);
      }

      return next;
    });
  };

  const gameLoop = time => {
    if (!runningRef.current || gameOverRef.current) {
      lastTimeRef.current = time;
      rafRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    if (lastTimeRef.current == null) {
      lastTimeRef.current = time;
      rafRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    let dt = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;

    dt = Math.min(dt, 0.032);

    const pos = ballRef.current;
    const vel = velocityRef.current;

    let x = pos.x + vel.x * dt;
    let y = pos.y + vel.y * dt;

    let vx = vel.x;
    let vy = vel.y;

    if (y <= 0) {
      y = 0;
      vy = Math.abs(vy);
    }

    if (y + BALL >= FIELD_H) {
      y = FIELD_H - BALL;
      vy = -Math.abs(vy);
    }

    if (
      vx < 0 &&
      x <= PLAYER_X + PADDLE_W &&
      x + BALL >= PLAYER_X &&
      y + BALL >= playerYRef.current &&
      y <= playerYRef.current + PADDLE_H
    ) {
      x = PLAYER_X + PADDLE_W;

      const paddleCenter =
        playerYRef.current + PADDLE_H / 2;

      const ballCenter =
        y + BALL / 2;

      const impact =
        (ballCenter - paddleCenter) /
        (PADDLE_H / 2);

      vx = Math.abs(vx) * 1.035;
      vy += impact * 145;
    }

    if (
      vx > 0 &&
      x + BALL >= CPU_X &&
      x <= CPU_X + PADDLE_W &&
      y + BALL >= cpuYRef.current &&
      y <= cpuYRef.current + PADDLE_H
    ) {
      x = CPU_X - BALL;

      const paddleCenter =
        cpuYRef.current + PADDLE_H / 2;

      const ballCenter =
        y + BALL / 2;

      const impact =
        (ballCenter - paddleCenter) /
        (PADDLE_H / 2);

      vx = -Math.abs(vx) * 1.035;
      vy += impact * 125;
    }

    if (x + BALL < 0) {
      addPointCpu();
      rafRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    if (x > FIELD_W) {
      addPointPlayer();
      rafRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const ballCenterY = y + BALL / 2;
    const cpuCenterY = cpuYRef.current + PADDLE_H / 2;

    const cpuTarget =
      ballCenterY - PADDLE_H / 2;

    const cpuSpeed = 220;

    let nextCpu = cpuYRef.current;

    if (Math.abs(ballCenterY - cpuCenterY) > 7) {
      const dir = cpuTarget > nextCpu ? 1 : -1;
      nextCpu += dir * cpuSpeed * dt;
    }

    nextCpu = clamp(
      nextCpu,
      0,
      FIELD_H - PADDLE_H
    );

    cpuYRef.current = nextCpu;

    const nextBall = { x, y };

    ballRef.current = nextBall;
    velocityRef.current = { x: vx, y: vy };

    setBall(nextBall);
    setCpuY(nextCpu);

    rafRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    rafRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const movePlayerToTouch = y => {
    const next = clamp(
      y - PADDLE_H / 2,
      0,
      FIELD_H - PADDLE_H
    );

    playerYRef.current = next;
    setPlayerY(next);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,

      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: evt => {
        movePlayerToTouch(evt.nativeEvent.locationY);

        if (!gameOverRef.current) {
          setRunning(true);
        }
      },

      onPanResponderMove: evt => {
        movePlayerToTouch(evt.nativeEvent.locationY);
      },
    })
  ).current;

  const newGame = () => {
    const middle = (FIELD_H - PADDLE_H) / 2;

    setScorePlayer(0);
    setScoreCpu(0);

    setWinner(null);
    setGameOver(false);

    playerYRef.current = middle;
    cpuYRef.current = middle;

    setPlayerY(middle);
    setCpuY(middle);

    resetBall(Math.random() > 0.5 ? 1 : -1);

    lastTimeRef.current = null;

    setRunning(true);
  };

  const screenWidth = Dimensions.get('window').width;
  const scale = Math.min(
    1,
    (screenWidth - 28) / FIELD_W
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.back}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.titleWrap}>
          <Text style={styles.title}>PONG</Text>
          <Text style={styles.subtitle}>
            PLAYER VS CPU
          </Text>
        </View>

        <View style={{ width: 44 }} />
      </View>

      <View style={styles.scoreRow}>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>TU</Text>
          <Text style={styles.scoreValue}>
            {scorePlayer}
          </Text>
        </View>

        <Text style={styles.scoreDivider}>:</Text>

        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>CPU</Text>
          <Text style={styles.scoreValue}>
            {scoreCpu}
          </Text>
        </View>
      </View>

      <View style={styles.fieldOuter}>
        <View
          {...panResponder.panHandlers}
          style={[
            styles.field,
            {
              width: FIELD_W,
              height: FIELD_H,
              transform: [{ scale }],
            },
          ]}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.centerLine,
                {
                  top: i * 39 + 5,
                },
              ]}
            />
          ))}

          <View
            style={[
              styles.playerPaddle,
              {
                left: PLAYER_X,
                top: playerY,
              },
            ]}
          />

          <View
            style={[
              styles.cpuPaddle,
              {
                left: CPU_X,
                top: cpuY,
              },
            ]}
          />

          <View
            style={[
              styles.ball,
              {
                left: ball.x,
                top: ball.y,
              },
            ]}
          />

          {!running && !gameOver && (
            <View
              pointerEvents="none"
              style={styles.messageOverlay}
            >
              <Text style={styles.messageTitle}>
                TOCCA E GIOCA
              </Text>

              <Text style={styles.messageText}>
                Trascina il dito per muovere la racchetta
              </Text>
            </View>
          )}

          {gameOver && (
            <View style={styles.gameOverOverlay}>
              <Text style={styles.gameOverSmall}>
                PARTITA TERMINATA
              </Text>

              <Text
                style={[
                  styles.gameOverTitle,
                  winner === 'TU' && styles.winTitle,
                ]}
              >
                {winner === 'TU'
                  ? 'HAI VINTO!'
                  : 'CPU VINCE'}
              </Text>

              <Text style={styles.finalScore}>
                {scorePlayer} - {scoreCpu}
              </Text>

              <TouchableOpacity
                style={styles.retry}
                onPress={newGame}
              >
                <Text style={styles.retryText}>
                  ↻ RIGIOCA
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          disabled={gameOver}
          onPress={() =>
            setRunning(prev => !prev)
          }
          style={[
            styles.actionButton,
            gameOver && styles.disabled,
          ]}
        >
          <Text style={styles.actionText}>
            {running ? 'Ⅱ  PAUSA' : '▶  RIPRENDI'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={newGame}
          style={[
            styles.actionButton,
            styles.newGame,
          ]}
        >
          <Text style={styles.newGameText}>
            ↻ NUOVA PARTITA
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.tip}>
        Il campo cattura il movimento del dito:
        la pagina non deve scorrere mentre giochi.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#030B14',
    paddingHorizontal: 14,
    paddingTop: 42,
    paddingBottom: 12,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },

  back: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  backText: {
    color: '#FFFFFF',
    fontSize: 36,
    marginTop: -3,
  },

  titleWrap: {
    alignItems: 'center',
  },

  title: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: 4,
  },

  subtitle: {
    color: '#FFD45A',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 2,
  },

  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    marginBottom: 10,
  },

  scoreBox: {
    width: 80,
    minHeight: 54,
    borderRadius: 15,
    backgroundColor: '#0C1A25',
    borderWidth: 1,
    borderColor: 'rgba(255,212,90,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  scoreLabel: {
    color: '#8798A5',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  scoreValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },

  scoreDivider: {
    color: '#FFD45A',
    fontSize: 22,
    fontWeight: '900',
  },

  fieldOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  field: {
    position: 'relative',
    backgroundColor: '#030B1C',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,212,90,0.46)',
  },

  centerLine: {
    position: 'absolute',
    width: 2,
    height: 18,
    left: FIELD_W / 2 - 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },

  playerPaddle: {
    position: 'absolute',
    width: PADDLE_W,
    height: PADDLE_H,
    borderRadius: 6,
    backgroundColor: '#FFD45A',
  },

  cpuPaddle: {
    position: 'absolute',
    width: PADDLE_W,
    height: PADDLE_H,
    borderRadius: 6,
    backgroundColor: '#FF6B6B',
  },

  ball: {
    position: 'absolute',
    width: BALL,
    height: BALL,
    borderRadius: BALL / 2,
    backgroundColor: '#FFFFFF',
  },

  messageOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(3,11,28,0.38)',
  },

  messageTitle: {
    color: '#FFD45A',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 2,
  },

  messageText: {
    color: '#B8C5CF',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 30,
  },

  gameOverOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2,8,18,0.88)',
  },

  gameOverSmall: {
    color: '#8597A6',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 2,
  },

  gameOverTitle: {
    color: '#FF6B6B',
    fontSize: 27,
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: 2,
  },

  winTitle: {
    color: '#63E4A5',
  },

  finalScore: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    marginTop: 8,
  },

  retry: {
    marginTop: 14,
    minWidth: 150,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(99,228,165,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(99,228,165,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  retryText: {
    color: '#63E4A5',
    fontSize: 11,
    fontWeight: '900',
  },

  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 11,
  },

  actionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#102230',
    alignItems: 'center',
    justifyContent: 'center',
  },

  newGame: {
    backgroundColor: 'rgba(255,212,90,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,212,90,0.34)',
  },

  actionText: {
    color: '#D4DFE6',
    fontSize: 11,
    fontWeight: '900',
  },

  newGameText: {
    color: '#FFD45A',
    fontSize: 11,
    fontWeight: '900',
  },

  disabled: {
    opacity: 0.35,
  },

  tip: {
    color: '#718593',
    fontSize: 9,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '700',
  },
});
