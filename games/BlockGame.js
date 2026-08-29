import React, { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Dimensions,
  Vibration,
} from 'react-native';

const ROWS = 20;
const COLS = 10;

const SHAPES = {
  I: [[1,1,1,1]],
  J: [[1,0,0],[1,1,1]],
  L: [[0,0,1],[1,1,1]],
  O: [[1,1],[1,1]],
  S: [[0,1,1],[1,1,0]],
  T: [[0,1,0],[1,1,1]],
  Z: [[1,1,0],[0,1,1]],
};

const COLORS = {
  I: '#59E3FF',
  J: '#5D7CFF',
  L: '#FF9F43',
  O: '#FFD93D',
  S: '#55E57D',
  T: '#C66BFF',
  Z: '#FF5E6C',
};

const TYPES = Object.keys(SHAPES);

const emptyBoard = () =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(null));

const randomPiece = () => {
  const type = TYPES[Math.floor(Math.random() * TYPES.length)];
  const shape = SHAPES[type].map(row => [...row]);

  return {
    type,
    shape,
    row: 0,
    col: Math.floor((COLS - shape[0].length) / 2),
  };
};

const rotate = shape =>
  shape[0].map((_, i) => shape.map(row => row[i]).reverse());

const collides = (board, piece, dr = 0, dc = 0, shape = piece.shape) => {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;

      const nr = piece.row + r + dr;
      const nc = piece.col + c + dc;

      if (nc < 0 || nc >= COLS || nr >= ROWS) return true;
      if (nr >= 0 && board[nr][nc]) return true;
    }
  }

  return false;
};

const mergePiece = (board, piece) => {
  const next = board.map(row => [...row]);

  piece.shape.forEach((row, r) => {
    row.forEach((value, c) => {
      if (!value) return;

      const rr = piece.row + r;
      const cc = piece.col + c;

      if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) {
        next[rr][cc] = piece.type;
      }
    });
  });

  return next;
};

const getFullRows = board =>
  board.reduce((rows, row, index) => {
    if (row.every(Boolean)) {
      rows.push(index);
    }
    return rows;
  }, []);

const clearLines = board => {
  const remaining = board.filter(row => row.some(cell => !cell));
  const cleared = ROWS - remaining.length;

  while (remaining.length < ROWS) {
    remaining.unshift(Array(COLS).fill(null));
  }

  return { board: remaining, cleared };
};

export default function BlockGame({ onBack }) {
  const [board, setBoard] = useState(emptyBoard);
  const [piece, setPiece] = useState(randomPiece);
  const [nextPiece, setNextPiece] = useState(randomPiece);

  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [record, setRecord] = useState(0);

  const [flashLines, setFlashLines] = useState([]);
  const [levelUpVisible, setLevelUpVisible] = useState(false);

  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const boardRef = useRef(board);
  const pieceRef = useRef(piece);
  const runningRef = useRef(running);
  const gameOverRef = useRef(gameOver);

  const holdDelayRef = useRef(null);
  const holdIntervalRef = useRef(null);

  useEffect(() => {
    AsyncStorage.getItem('block_record_v1')
      .then(value => {
        if (value) {
          setRecord(Number(value) || 0);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    pieceRef.current = piece;
  }, [piece]);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);

  const aggiornaRecord = useCallback((nuovoPunteggio) => {
    setRecord(prev => {
      if (nuovoPunteggio > prev) {
        AsyncStorage
          .setItem('block_record_v1', String(nuovoPunteggio))
          .catch(() => {});

        return nuovoPunteggio;
      }

      return prev;
    });
  }, []);

  const spawnNext = useCallback((newBoard) => {
    const incoming = {
      ...nextPiece,
      row: 0,
      col: Math.floor(
        (COLS - nextPiece.shape[0].length) / 2
      ),
    };

    const following = randomPiece();

    if (collides(newBoard, incoming)) {
      setRunning(false);
      setGameOver(true);

      Vibration.vibrate(90);

      return;
    }

    setPiece(incoming);
    setNextPiece(following);
  }, [nextPiece]);

  const lockPiece = useCallback(() => {
    const currentBoard = boardRef.current;
    const currentPiece = pieceRef.current;

    let merged = mergePiece(currentBoard, currentPiece);

    const righeComplete = getFullRows(merged);
    const result = clearLines(merged);

    merged = result.board;

    if (result.cleared > 0) {
      const table = [0, 100, 300, 500, 800];
      const gained = table[result.cleared] * level;

      setFlashLines(righeComplete);

      Vibration.vibrate(35);

      setTimeout(() => {
        setFlashLines([]);
      }, 220);

      setScore(value => {
        const nuovo = value + gained;
        aggiornaRecord(nuovo);
        return nuovo;
      });

      setLines(value => {
        const total = value + result.cleared;
        const nuovoLivello = Math.floor(total / 10) + 1;

        if (nuovoLivello > level) {
          setLevelUpVisible(true);

          Vibration.vibrate([0, 40, 45, 70]);

          setTimeout(() => {
            setLevelUpVisible(false);
          }, 900);
        }

        setLevel(nuovoLivello);
        return total;
      });
    }

    boardRef.current = merged;
    setBoard(merged);
    spawnNext(merged);
  }, [level, spawnNext]);

  const stepDown = useCallback(() => {
    if (!runningRef.current || gameOverRef.current) return;

    const currentBoard = boardRef.current;
    const currentPiece = pieceRef.current;

    if (!collides(currentBoard, currentPiece, 1, 0)) {
      setPiece(p => ({ ...p, row: p.row + 1 }));
    } else {
      lockPiece();
    }
  }, [lockPiece]);

  useEffect(() => {
    if (!running || gameOver) return;

    const speed = Math.max(90, 620 - (level - 1) * 48);

    const timer = setInterval(() => {
      stepDown();
    }, speed);

    return () => clearInterval(timer);
  }, [running, gameOver, level, stepDown]);

  const move = direction => {
    if (!running || gameOver) return;

    const current = pieceRef.current;

    if (!collides(boardRef.current, current, 0, direction)) {
      setPiece(p => ({ ...p, col: p.col + direction }));
    }
  };

  const stopHold = () => {
    if (holdDelayRef.current) {
      clearTimeout(holdDelayRef.current);
      holdDelayRef.current = null;
    }

    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  const startHorizontalHold = direction => {
    stopHold();

    move(direction);

    holdDelayRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(() => {
        move(direction);
      }, 65);
    }, 170);
  };

  const startDownHold = () => {
    stopHold();

    softDrop();

    holdDelayRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(() => {
        softDrop();
      }, 55);
    }, 130);
  };

  useEffect(() => {
    return () => stopHold();
  }, []);

  const rotatePiece = () => {
    if (!running || gameOver) return;

    const current = pieceRef.current;
    const rotated = rotate(current.shape);

    if (!collides(boardRef.current, current, 0, 0, rotated)) {
      setPiece(p => ({ ...p, shape: rotated }));
      return;
    }

    if (!collides(boardRef.current, current, 0, -1, rotated)) {
      setPiece(p => ({
        ...p,
        col: p.col - 1,
        shape: rotated,
      }));
      return;
    }

    if (!collides(boardRef.current, current, 0, 1, rotated)) {
      setPiece(p => ({
        ...p,
        col: p.col + 1,
        shape: rotated,
      }));
    }
  };

  const softDrop = () => {
    if (!running || gameOver) return;

    const current = pieceRef.current;

    if (!collides(boardRef.current, current, 1, 0)) {
      setPiece(p => ({ ...p, row: p.row + 1 }));
      setScore(v => {
        const nuovo = v + 1;
        aggiornaRecord(nuovo);
        return nuovo;
      });
    } else {
      lockPiece();
    }
  };

  const hardDrop = () => {
    if (!running || gameOver) return;

    const current = pieceRef.current;
    let distance = 0;

    while (
      !collides(
        boardRef.current,
        current,
        distance + 1,
        0
      )
    ) {
      distance++;
    }

    const dropped = {
      ...current,
      row: current.row + distance,
    };

    pieceRef.current = dropped;
    setPiece(dropped);
    setScore(v => {
      const nuovo = v + distance * 2;
      aggiornaRecord(nuovo);
      return nuovo;
    });

    const merged = mergePiece(boardRef.current, dropped);

    const righeComplete = getFullRows(merged);
    const result = clearLines(merged);

    let finalBoard = result.board;

    if (result.cleared > 0) {
      const table = [0, 100, 300, 500, 800];

      setFlashLines(righeComplete);

      Vibration.vibrate(35);

      setTimeout(() => {
        setFlashLines([]);
      }, 220);

      setScore(v => {
        const nuovo = v + table[result.cleared] * level;
        aggiornaRecord(nuovo);
        return nuovo;
      });

      setLines(v => {
        const total = v + result.cleared;
        const nuovoLivello = Math.floor(total / 10) + 1;

        if (nuovoLivello > level) {
          setLevelUpVisible(true);

          Vibration.vibrate([0, 40, 45, 70]);

          setTimeout(() => {
            setLevelUpVisible(false);
          }, 900);
        }

        setLevel(nuovoLivello);
        return total;
      });
    }

    boardRef.current = finalBoard;
    setBoard(finalBoard);
    spawnNext(finalBoard);
  };

  const newGame = () => {
    const freshBoard = emptyBoard();
    const first = randomPiece();
    const second = randomPiece();

    boardRef.current = freshBoard;
    pieceRef.current = first;

    setBoard(freshBoard);
    setPiece(first);
    setNextPiece(second);

    setScore(0);
    setLines(0);
    setLevel(1);

    setGameOver(false);
    setRunning(true);
  };

  let ghostDistance = 0;

  if (piece) {
    while (
      !collides(
        board,
        piece,
        ghostDistance + 1,
        0
      )
    ) {
      ghostDistance++;
    }
  }

  const ghostCells = new Set();

  if (piece && ghostDistance > 0) {
    piece.shape.forEach((row, r) => {
      row.forEach((value, c) => {
        if (!value) return;

        const rr = piece.row + r + ghostDistance;
        const cc = piece.col + c;

        if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) {
          ghostCells.add(`${rr}-${cc}`);
        }
      });
    });
  }

  const displayBoard = board.map(row => [...row]);

  if (piece) {
    piece.shape.forEach((row, r) => {
      row.forEach((value, c) => {
        if (!value) return;

        const rr = piece.row + r;
        const cc = piece.col + c;

        if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) {
          displayBoard[rr][cc] = piece.type;
        }
      });
    });
  }

  const screenWidth = Dimensions.get('window').width;
  const cellSize = Math.min(
    25,
    Math.floor((screenWidth - 54) / COLS)
  );

  const ControlButton = ({
    children,
    onPress,
    onHoldStart,
    wide = false,
  }) => (
    <Pressable
      onPress={onHoldStart ? undefined : onPress}
      onPressIn={onHoldStart}
      onPressOut={onHoldStart ? stopHold : undefined}
      style={({ pressed }) => [
        styles.control,
        wide && styles.controlWide,
        pressed && styles.controlPressed,
      ]}
    >
      <Text style={styles.controlText}>{children}</Text>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <TouchableOpacity onPress={onBack} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <View>
          <Text style={styles.title}>BLOCK</Text>
          <Text style={styles.subtitle}>ARCADE</Text>
        </View>

        <View style={{ width: 45 }} />
      </View>

      <View style={styles.hud}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>PUNTI</Text>
          <Text style={styles.statValue}>{score}</Text>
        </View>

        <View style={styles.stat}>
          <Text style={styles.statLabel}>LINEE</Text>
          <Text style={styles.statValue}>{lines}</Text>
        </View>

        <View style={styles.stat}>
          <Text style={styles.statLabel}>LIVELLO</Text>
          <Text style={styles.statValue}>{level}</Text>
        </View>

        <View style={styles.stat}>
          <Text style={styles.statLabel}>RECORD</Text>
          <Text style={styles.statValue}>{record}</Text>
        </View>
      </View>

      <View style={styles.gameArea}>
        <View
          style={[
            styles.board,
            {
              width: cellSize * COLS + 4,
              height: cellSize * ROWS + 4,
            },
          ]}
        >
          {displayBoard.map((row, r) =>
            row.map((cell, c) => (
              <View
                key={`${r}-${c}`}
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: cell
                    ? COLORS[cell]
                    : ghostCells.has(`${r}-${c}`)
                    ? 'rgba(255,255,255,0.12)'
                    : '#07131D',

                  borderWidth: ghostCells.has(`${r}-${c}`) && !cell
                    ? 1
                    : 0.5,

                  borderColor:
                    ghostCells.has(`${r}-${c}`) && !cell
                      ? 'rgba(255,255,255,0.30)'
                      : 'rgba(255,255,255,0.055)',

                  borderRadius:
                    cell || ghostCells.has(`${r}-${c}`)
                      ? 3
                      : 0,
                }}
              />
            ))
          )}

          {!running && !gameOver && (
            <View style={styles.overlay}>
              <Text style={styles.overlayTitle}>BLOCK</Text>
              <Text style={styles.overlayText}>
                Premi NUOVA PARTITA
              </Text>
            </View>
          )}

          {flashLines.map(rowIndex => (
            <View
              key={`flash-${rowIndex}`}
              pointerEvents="none"
              style={[
                styles.clearedRowFlash,
                {
                  top: 2 + rowIndex * cellSize,
                  height: cellSize,
                },
              ]}
            />
          ))}

          {levelUpVisible && (
            <View
              pointerEvents="none"
              style={styles.levelUpBox}
            >
              <Text style={styles.levelUpText}>
                LEVEL {level}
              </Text>
            </View>
          )}

          {gameOver && (
            <View style={styles.overlay}>
              <View style={styles.gameOverCard}>
                <Text style={styles.gameOverSmall}>
                  FINE PARTITA
                </Text>

                <Text style={styles.gameOver}>
                  GAME OVER
                </Text>

                {score > 0 && score >= record && (
                  <View style={styles.recordBadge}>
                    <Text style={styles.recordBadgeText}>
                      ★ NUOVO RECORD
                    </Text>
                  </View>
                )}

                <View style={styles.gameOverStats}>
                  <View style={styles.gameOverStat}>
                    <Text style={styles.gameOverStatLabel}>
                      PUNTI
                    </Text>
                    <Text style={styles.gameOverStatValue}>
                      {score}
                    </Text>
                  </View>

                  <View style={styles.gameOverStat}>
                    <Text style={styles.gameOverStatLabel}>
                      LINEE
                    </Text>
                    <Text style={styles.gameOverStatValue}>
                      {lines}
                    </Text>
                  </View>

                  <View style={styles.gameOverStat}>
                    <Text style={styles.gameOverStatLabel}>
                      RECORD
                    </Text>
                    <Text style={styles.gameOverStatValue}>
                      {record}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={newGame}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryButtonText}>
                    ↻  RIGIOCA
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!running && !gameOver && score > 0 && (
            <View style={styles.overlay}>
              <Text style={styles.overlayTitle}>PAUSA</Text>
            </View>
          )}
        </View>

        <View style={styles.nextPanel}>
          <Text style={styles.nextLabel}>PROSSIMO</Text>

          <View style={styles.preview}>
            {nextPiece.shape.map((row, r) => (
              <View key={r} style={{ flexDirection: 'row' }}>
                {row.map((value, c) => (
                  <View
                    key={c}
                    style={{
                      width: 15,
                      height: 15,
                      margin: 1,
                      borderRadius: 2,
                      backgroundColor: value
                        ? COLORS[nextPiece.type]
                        : 'transparent',
                    }}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.controlRow}>
          <ControlButton
            onHoldStart={() => startHorizontalHold(-1)}
          >
            ←
          </ControlButton>

          <ControlButton onPress={rotatePiece}>
            ↻
          </ControlButton>

          <ControlButton
            onHoldStart={() => startHorizontalHold(1)}
          >
            →
          </ControlButton>
        </View>

        <View style={styles.controlRow}>
          <ControlButton onHoldStart={startDownHold}>
            ↓
          </ControlButton>

          <ControlButton wide onPress={hardDrop}>
            DROP
          </ControlButton>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            if (gameOver) return;
            setRunning(v => !v);
          }}
        >
          <Text style={styles.actionText}>
            {running ? 'Ⅱ  PAUSA' : '▶  RIPRENDI'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.newButton]}
          onPress={newGame}
        >
          <Text style={styles.newText}>↻ NUOVA PARTITA</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#030A12',
    paddingTop: 12,
    paddingHorizontal: 14,
  },

  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  back: {
    width: 45,
    height: 45,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  backText: {
    color: '#FFFFFF',
    fontSize: 34,
    marginTop: -4,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
  },

  subtitle: {
    color: '#6FEAFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
  },

  hud: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 9,
  },

  stat: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#0B1824',
    borderWidth: 1,
    borderColor: 'rgba(111,234,255,0.20)',
    borderRadius: 13,
    paddingVertical: 7,
    paddingHorizontal: 2,
    alignItems: 'center',
  },

  statLabel: {
    color: '#7990A2',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  statValue: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 1,
  },

  gameArea: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 9,
  },

  board: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#07131D',
    borderWidth: 2,
    borderColor: '#3C6076',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 8,
    shadowColor: '#6FEAFF',
    shadowOpacity: 0.20,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 7,
  },

  nextPanel: {
    width: 78,
    backgroundColor: '#0B1824',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(111,234,255,0.20)',
    paddingVertical: 10,
    alignItems: 'center',
  },

  nextLabel: {
    color: '#7D93A4',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },

  preview: {
    minHeight: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,8,13,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  overlayTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 3,
  },

  overlayText: {
    color: '#9DB1C0',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 7,
  },

  gameOver: {
    color: '#FF5E6C',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
  },

  gameOverCard: {
    width: '88%',
    backgroundColor: '#08151F',
    borderWidth: 1.5,
    borderColor: 'rgba(255,94,108,0.55)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },

  gameOverSmall: {
    color: '#7D93A4',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 2.5,
    marginBottom: 5,
  },

  recordBadge: {
    marginTop: 9,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,216,90,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,216,90,0.42)',
  },

  recordBadgeText: {
    color: '#FFD85A',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  gameOverStats: {
    width: '100%',
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
  },

  gameOverStat: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#0D202D',
    borderRadius: 10,
    paddingVertical: 7,
    alignItems: 'center',
  },

  gameOverStatLabel: {
    color: '#71899A',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1,
  },

  gameOverStatValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },

  retryButton: {
    marginTop: 14,
    width: '100%',
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(99,228,165,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99,228,165,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  retryButtonText: {
    color: '#63E4A5',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },

  clearedRowFlash: {
    position: 'absolute',
    left: 2,
    right: 2,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#FFFFFF',
  },

  levelUpBox: {
    position: 'absolute',
    top: '42%',
    left: 20,
    right: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(3,10,18,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(111,234,255,0.55)',
    borderRadius: 12,
    paddingVertical: 10,
  },

  levelUpText: {
    color: '#6FEAFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
  },

  controls: {
    marginTop: 12,
    gap: 9,
  },

  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
  },

  control: {
    width: 68,
    height: 51,
    borderRadius: 15,
    backgroundColor: '#102230',
    borderWidth: 1,
    borderColor: '#29485B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  controlWide: {
    width: 112,
  },

  controlPressed: {
    opacity: 0.62,
    transform: [{ scale: 0.95 }],
  },

  controlText: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '900',
  },

  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 11,
  },

  actionButton: {
    flex: 1,
    minHeight: 45,
    borderRadius: 14,
    backgroundColor: '#102230',
    alignItems: 'center',
    justifyContent: 'center',
  },

  newButton: {
    backgroundColor: 'rgba(99,228,165,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(99,228,165,0.35)',
  },

  actionText: {
    color: '#C9D7E1',
    fontSize: 11,
    fontWeight: '900',
  },

  newText: {
    color: '#63E4A5',
    fontSize: 11,
    fontWeight: '900',
  },
});
