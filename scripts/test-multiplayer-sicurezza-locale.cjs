const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createGameEventId,
  createPresenceLease,
  coordinateGamePush,
  decideGamePush,
  isLiveGamePresence,
  refreshPresenceLease,
} = require('../games/multiplayerPresencePolicy.cjs');
const {
  projectGameStateForPlayer,
  validateCalculatedResult,
  validateChallenge,
  validateMoveEnvelope,
} = require('../games/multiplayerServerPolicy.cjs');
const {
  GAME_ID,
  NOW_MS,
  SESSION_A,
  SESSION_B,
  USER_A,
  USER_B,
  createSyntheticMultiplayerFixture,
} = require('../games/multiplayerSecurityFixture.cjs');

const livePresence = (fixture, index, patch = {}) => createPresenceLease({
  ...fixture.sessions[index],
  appState: 'foreground',
  routeVisible: true,
  acknowledgedVersion: 3,
  ...patch,
}, { nowMs: NOW_MS, ttlMs: 100 });

test('fixture uses two synthetic users and independent sessions, never real identities', () => {
  const fixture = createSyntheticMultiplayerFixture();
  assert.deepEqual(fixture.sessions.map((s) => s.userId), [USER_A, USER_B]);
  assert.deepEqual(fixture.sessions.map((s) => s.sessionId), [SESSION_A, SESSION_B]);
  assert.notEqual(fixture.sessions[0].sessionId, fixture.sessions[1].sessionId);
  assert.ok(fixture.sessions.every((s) => s.gameId === GAME_ID && s.userId.startsWith('synthetic-')));
});

for (const gameType of ['scopa', 'briscola']) {
  test(`${gameType}: each player sees only their own hand and no deck order`, () => {
    const { serverState } = createSyntheticMultiplayerFixture(gameType);
    const a = projectGameStateForPlayer(serverState, USER_A);
    const b = projectGameStateForPlayer(serverState, USER_B);
    assert.deepEqual(a.hand, serverState.hands[USER_A]);
    assert.deepEqual(b.hand, serverState.hands[USER_B]);
    assert.equal(a.remainingDeckCount, 2);
    assert.equal('hands' in a, false);
    assert.equal('deck' in a, false);
    assert.equal('hands' in b, false);
    assert.equal('deck' in b, false);
    assert.equal(JSON.stringify(a).includes('synthetic-card-b1'), false);
    assert.equal(JSON.stringify(b).includes('synthetic-card-a1'), false);
    assert.equal(JSON.stringify(a).includes('synthetic-hidden-deck-card'), false);
    assert.equal(JSON.stringify(b).includes('synthetic-hidden-deck-card'), false);
    assert.equal(projectGameStateForPlayer(serverState, 'synthetic-intruder'), null);
  });

  test(`${gameType}: only participant on turn may submit a current action`, () => {
    const fixture = createSyntheticMultiplayerFixture(gameType);
    const { match, serverState } = fixture;
    const action = gameType === 'scopa'
      ? { type: 'play_card', cardId: 'synthetic-card-a1', captureIds: [] }
      : { type: 'play_card', cardId: 'synthetic-card-a1' };
    const base = { match, serverState, expectedVersion: match.version, action };
    assert.equal(validateMoveEnvelope({ ...base, actorId: USER_A }).ok, true);
    assert.equal(validateMoveEnvelope({ ...base, actorId: 'synthetic-intruder' }).reason, 'not_participant');
    assert.equal(validateMoveEnvelope({ ...base, actorId: USER_B }).reason, 'not_your_turn');
    assert.equal(validateMoveEnvelope({ ...base, actorId: USER_A, expectedVersion: match.version - 1 }).reason, 'stale_version');
    assert.equal(validateMoveEnvelope({ ...base, match: { ...match, status: 'finished' }, actorId: USER_A }).reason, 'match_not_in_progress');
    assert.equal(validateMoveEnvelope({ ...base, action: { ...action, cardId: 'synthetic-card-b1' }, actorId: USER_A }).reason, 'card_not_in_server_hand');
  });
}

test('rejected actions do not mutate fixture state, score or winner', () => {
  const { match, serverState } = createSyntheticMultiplayerFixture();
  const before = structuredClone({ match, serverState });
  validateMoveEnvelope({
    match: { ...match, turnUserId: USER_B }, actorId: USER_B,
    expectedVersion: match.version,
    action: { type: 'play_card', cardId: 'synthetic-card-a1', captureIds: [], winnerId: USER_B },
    serverState,
  });
  assert.deepEqual({ match, serverState }, before);
  assert.equal(validateCalculatedResult({
    players: [USER_A, USER_B], scores: { [USER_A]: 10, [USER_B]: 2 }, winnerId: USER_B,
  }).ok, false);
});

test('challenge policy requires accepted colleague and rejects a block in either direction', () => {
  const base = { actorId: USER_A, recipientId: USER_B, gameType: 'scopa', acceptedColleague: true };
  assert.equal(validateChallenge(base).ok, true);
  assert.equal(validateChallenge({ ...base, acceptedColleague: false }).reason, 'not_accepted_colleague');
  assert.equal(validateChallenge({ ...base, blockedEitherWay: true }).reason, 'blocked');
});

test('two sessions have independent leases; background and disconnect do not count as visible', () => {
  const fixture = createSyntheticMultiplayerFixture();
  const event = { type: 'turn', gameId: GAME_ID, recipientId: USER_B, version: 4, createdAtMs: NOW_MS };
  const sessionA = livePresence(fixture, 0);
  const sessionB = livePresence(fixture, 1);
  assert.equal(sessionA.sessionId, SESSION_A);
  assert.equal(sessionB.sessionId, SESSION_B);
  assert.equal(isLiveGamePresence(sessionB, event, NOW_MS + 1), true);

  const background = refreshPresenceLease(sessionB, {
    appState: 'background', routeVisible: false,
  }, { nowMs: NOW_MS + 10, ttlMs: 100 });
  assert.equal(isLiveGamePresence(background, event, NOW_MS + 11), false);

  const disconnected = refreshPresenceLease(sessionB, {
    appState: 'disconnected', routeVisible: false,
  }, { nowMs: NOW_MS + 20, ttlMs: 100 });
  assert.equal(isLiveGamePresence(disconnected, event, NOW_MS + 21), false);
  assert.equal(isLiveGamePresence(sessionA, event, NOW_MS + 21), false);
  assert.equal(isLiveGamePresence(sessionB, event, NOW_MS + 100), false, 'lease expires at boundary');
});

test('reconnect renews only that session and keeps acknowledgement monotonic', () => {
  const fixture = createSyntheticMultiplayerFixture();
  const event = { type: 'turn', gameId: GAME_ID, recipientId: USER_B, version: 4, createdAtMs: NOW_MS };
  const sessionA = livePresence(fixture, 0, { acknowledgedVersion: 0 });
  const backgroundB = refreshPresenceLease(livePresence(fixture, 1), {
    appState: 'background', routeVisible: false, acknowledgedVersion: 3,
  }, { nowMs: NOW_MS + 5, ttlMs: 100 });
  const reconnectedB = refreshPresenceLease(backgroundB, {
    appState: 'foreground', routeVisible: true, acknowledgedVersion: 2,
  }, { nowMs: NOW_MS + 20, ttlMs: 100 });
  assert.equal(reconnectedB.sessionId, SESSION_B);
  assert.equal(reconnectedB.acknowledgedVersion, 3);
  assert.equal(isLiveGamePresence(reconnectedB, event, NOW_MS + 21), true);
  assert.equal(sessionA.acknowledgedVersion, 0, 'session B update leaves A untouched');
});

test('push requires acknowledgement of this event version; absent presence falls back after grace', () => {
  const fixture = createSyntheticMultiplayerFixture();
  const event = { type: 'turn', gameId: GAME_ID, recipientId: USER_B, version: 4, createdAtMs: NOW_MS };
  const presence = livePresence(fixture, 1);
  const base = {
    event, nowMs: NOW_MS + 10, presences: [presence], eligibleDeviceCount: 1,
    preferenceEnabled: true, permissionGranted: true, ackGraceMs: 50,
  };
  assert.equal(decideGamePush(base).decision, 'defer');
  const acked = refreshPresenceLease(presence, { acknowledgedVersion: 4 }, { nowMs: NOW_MS + 20, ttlMs: 100 });
  assert.equal(decideGamePush({ ...base, presences: [acked], nowMs: NOW_MS + 21 }).reason, 'version_already_visible');
  assert.equal(decideGamePush({ ...base, presences: [], nowMs: NOW_MS + 60 }).reason, 'not_viewing_game');
});

test('event key deduplicates same turn but separates challenge and recipient', () => {
  const event = { type: 'turn', gameId: GAME_ID, recipientId: USER_B, version: 4, createdAtMs: NOW_MS };
  const id = createGameEventId(event);
  assert.equal(createGameEventId({ ...event }), id);
  assert.notEqual(createGameEventId({ ...event, recipientId: USER_A }), id);
  assert.notEqual(createGameEventId({ ...event, version: 5 }), id);
  assert.notEqual(createGameEventId({ ...event, type: 'challenge' }), id);
  assert.equal(decideGamePush({
    event, nowMs: NOW_MS + 60, presences: [], eligibleDeviceCount: 1,
    preferenceEnabled: true, permissionGranted: true, seenEventIds: new Set([id]),
  }).reason, 'duplicate');
});

test('legacy direct send cannot race an authoritative outbox for one event', () => {
  const event = { type: 'turn', gameId: GAME_ID, recipientId: USER_B, version: 4, createdAtMs: NOW_MS };
  const common = {
    event, nowMs: NOW_MS + 60, presences: [], eligibleDeviceCount: 1,
    preferenceEnabled: true, permissionGranted: true, outboxAuthoritative: true,
  };
  assert.equal(coordinateGamePush({ ...common, source: 'client_enqueue' }).decision, 'enqueue_only');
  assert.equal(coordinateGamePush({ ...common, source: 'legacy_direct' }).decision, 'suppress');
  assert.equal(coordinateGamePush({ ...common, source: 'legacy_direct', outboxEventIds: [createGameEventId(event)] }).reason, 'already_owned_by_outbox');
  assert.equal(coordinateGamePush({ ...common, source: 'outbox_worker' }).decision, 'send');
});
