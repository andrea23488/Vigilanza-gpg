const test = require('node:test');
const assert = require('node:assert/strict');
const {
  projectGameStateForPlayer,
  validateChallenge,
  validateMoveEnvelope,
} = require('../games/multiplayerServerPolicy.cjs');

const match = {
  id: 'game-1', gameType: 'scopa', status: 'in_progress',
  challengerId: 'user-a', challengedId: 'user-b', turnUserId: 'user-a', version: 4,
};
const serverState = {
  type: 'scopa', initialized: true, players: ['user-a', 'user-b'],
  hands: { 'user-a': [{ id: 'a1' }], 'user-b': [{ id: 'secret-b1' }] },
  deck: [{ id: 'secret-deck1' }], table: [{ id: 'table-1' }], captured: {}, sweeps: {},
  lastMove: null,
};

test('challenge requires distinct users, supported game, accepted relationship and no block/rate limit', () => {
  assert.equal(validateChallenge({ actorId: 'a', recipientId: 'b', gameType: 'scopa', acceptedColleague: true }).ok, true);
  assert.equal(validateChallenge({ actorId: 'a', recipientId: 'a', gameType: 'scopa', acceptedColleague: true }).reason, 'invalid_participants');
  assert.equal(validateChallenge({ actorId: 'a', recipientId: 'b', gameType: 'poker', acceptedColleague: true }).reason, 'invalid_game');
  assert.equal(validateChallenge({ actorId: 'a', recipientId: 'b', gameType: 'briscola' }).reason, 'not_accepted_colleague');
  assert.equal(validateChallenge({ actorId: 'a', recipientId: 'b', gameType: 'briscola', acceptedColleague: true, blockedEitherWay: true }).reason, 'blocked');
  assert.equal(validateChallenge({ actorId: 'a', recipientId: 'b', gameType: 'scopa', acceptedColleague: true, rateLimited: true }).reason, 'rate_limited');
});

test('move envelope requires participant, active game, current turn and exact version', () => {
  const base = { match, actorId: 'user-a', expectedVersion: 4, action: { type: 'play_card', cardId: 'a1', captureIds: [] }, serverState };
  assert.equal(validateMoveEnvelope(base).ok, true);
  assert.equal(validateMoveEnvelope({ ...base, actorId: 'intruder' }).reason, 'not_participant');
  assert.equal(validateMoveEnvelope({ ...base, actorId: 'user-b' }).reason, 'not_your_turn');
  assert.equal(validateMoveEnvelope({ ...base, expectedVersion: 3 }).reason, 'stale_version');
  assert.equal(validateMoveEnvelope({ ...base, match: { ...match, status: 'finished' } }).reason, 'match_not_in_progress');
});

test('client cannot play a card absent from the server-loaded hand', () => {
  const result = validateMoveEnvelope({
    match, actorId: 'user-a', expectedVersion: 4,
    action: { type: 'play_card', cardId: 'secret-b1', captureIds: [] }, serverState,
  });
  assert.equal(result.reason, 'card_not_in_server_hand');
});

test('action envelope rejects malformed and duplicate capture selections', () => {
  const base = { match, actorId: 'user-a', expectedVersion: 4, serverState };
  assert.equal(validateMoveEnvelope({ ...base, action: { type: 'move', cardId: 'a1' } }).reason, 'invalid_action');
  assert.equal(validateMoveEnvelope({ ...base, action: { type: 'play_card', cardId: 'a1', captureIds: ['x', 'x'] } }).reason, 'invalid_capture_selection');
  assert.equal(validateMoveEnvelope({ ...base, match: { ...match, gameType: 'briscola' }, action: { type: 'play_card', cardId: 'a1', captureIds: [] } }).reason, 'unexpected_capture_selection');
});

test('player projection exposes own hand and public board but not opponent hand or deck order', () => {
  const view = projectGameStateForPlayer(serverState, 'user-a');
  assert.deepEqual(view.hand, [{ id: 'a1' }]);
  assert.deepEqual(view.table, [{ id: 'table-1' }]);
  assert.equal(view.remainingDeckCount, 1);
  assert.equal('hands' in view, false);
  assert.equal('deck' in view, false);
  assert.equal(JSON.stringify(view).includes('secret-b1'), false);
  assert.equal(projectGameStateForPlayer(serverState, 'intruder'), null);
});

test('successful envelope still requires the authoritative rules engine', () => {
  const result = validateMoveEnvelope({
    match, actorId: 'user-a', expectedVersion: 4,
    action: { type: 'play_card', cardId: 'a1', captureIds: [] }, serverState,
  });
  assert.equal(result.requiresAuthoritativeRulesCheck, true);
});
