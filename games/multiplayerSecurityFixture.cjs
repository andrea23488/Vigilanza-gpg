// Solely synthetic fixture for deterministic policy tests; not production data.
const USER_A = 'synthetic-player-a';
const USER_B = 'synthetic-player-b';
const SESSION_A = 'synthetic-session-a';
const SESSION_B = 'synthetic-session-b';
const GAME_ID = 'synthetic-game-1';
const NOW_MS = 1_800_000_000_000;

function createSyntheticMultiplayerFixture(gameType = 'scopa') {
  if (!['scopa', 'briscola'].includes(gameType)) throw new TypeError('Gioco sintetico non valido');

  const match = {
    id: GAME_ID,
    gameType,
    status: 'in_progress',
    challengerId: USER_A,
    challengedId: USER_B,
    turnUserId: USER_A,
    version: 4,
    winnerId: null,
  };

  const serverState = {
    type: gameType,
    initialized: true,
    players: [USER_A, USER_B],
    hands: {
      [USER_A]: [{ id: 'synthetic-card-a1', value: 1, suit: 'coppe' }],
      [USER_B]: [{ id: 'synthetic-card-b1', value: 2, suit: 'denari' }],
    },
    deck: [
      { id: 'synthetic-hidden-deck-card-1' },
      { id: 'synthetic-hidden-deck-card-2' },
    ],
    table: [{ id: 'synthetic-table-card', value: 3, suit: 'bastoni' }],
    captured: { [USER_A]: [], [USER_B]: [] },
    sweeps: { [USER_A]: 0, [USER_B]: 0 },
    score: { [USER_A]: 0, [USER_B]: 0 },
    winner: null,
  };

  const sessions = [
    { userId: USER_A, gameId: GAME_ID, sessionId: SESSION_A },
    { userId: USER_B, gameId: GAME_ID, sessionId: SESSION_B },
  ];

  return { match, serverState, sessions };
}

module.exports = {
  GAME_ID,
  NOW_MS,
  SESSION_A,
  SESSION_B,
  USER_A,
  USER_B,
  createSyntheticMultiplayerFixture,
};
