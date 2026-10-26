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

const event = { type: 'turn', gameId: 'game-1', recipientId: 'user-b', version: 8, createdAtMs: 10_000 };
const live = (acknowledgedVersion = 7) => createPresenceLease({
  userId: 'user-b', gameId: 'game-1', sessionId: 'session-1', appState: 'foreground',
  routeVisible: true, acknowledgedVersion,
}, { nowMs: 10_100, ttlMs: 45_000 });
const decide = (patch = {}) => decideGamePush({
  event, nowMs: 10_500, presences: [live()], eligibleDeviceCount: 1,
  permissionGranted: true, preferenceEnabled: true, ...patch,
});

test('event identity is stable and separates game, type, version and recipient', () => {
  const key = createGameEventId(event);
  assert.equal(key, createGameEventId({ ...event }));
  assert.notEqual(key, createGameEventId({ ...event, version: 9 }));
  assert.notEqual(key, createGameEventId({ ...event, recipientId: 'user-c' }));
  assert.notEqual(key, createGameEventId({ ...event, type: 'challenge' }));
});

test('invalid event identity is rejected', () => {
  assert.throws(() => createGameEventId({ ...event, gameId: '' }), /gameId/);
  assert.throws(() => createGameEventId({ ...event, version: -1 }), /version/);
  assert.throws(() => createGameEventId({ ...event, type: 'message' }), /Tipo evento/);
});

test('foreground visible match has a live lease until its server expiry', () => {
  const p = live();
  assert.equal(isLiveGamePresence(p, event, 10_500), true);
  assert.equal(isLiveGamePresence(p, event, p.leaseExpiresAtMs), false);
});

test('background, disconnected, left, hidden route and other match never suppress a push', () => {
  for (const patch of [
    { appState: 'background' }, { appState: 'disconnected' }, { appState: 'left' },
    { routeVisible: false }, { gameId: 'other-game' }, { userId: 'other-user' },
  ]) {
    const p = createPresenceLease({
      userId: 'user-b', gameId: 'game-1', sessionId: 'session-x', appState: 'foreground',
      routeVisible: true, acknowledgedVersion: 8, ...patch,
    }, { nowMs: 10_100, ttlMs: 45_000 });
    assert.equal(isLiveGamePresence(p, event, 10_500), false);
  }
});

test('an already acknowledged version suppresses the gameplay push', () => {
  assert.deepEqual(decide({ presences: [live(8)] }), {
    decision: 'suppress', reason: 'version_already_visible', eventId: createGameEventId(event),
  });
});

test('live presence without acknowledgement defers briefly, then falls back to push', () => {
  const first = decide({ nowMs: 10_500, ackGraceMs: 3_000 });
  assert.equal(first.decision, 'defer');
  assert.equal(first.reason, 'waiting_for_realtime_ack');
  assert.equal(first.retryAtMs, 13_000);
  const afterDeadline = decide({ nowMs: 13_000, ackGraceMs: 3_000 });
  assert.equal(afterDeadline.decision, 'send');
  assert.equal(afterDeadline.reason, 'ack_timeout');
});

test('no presence, expired presence, disconnect and background retain notifications', () => {
  assert.equal(decide({ presences: [] }).reason, 'not_viewing_game');
  assert.equal(decide({ nowMs: 60_000, presences: [live(7)] }).reason, 'not_viewing_game');
  const background = createPresenceLease({
    userId: 'user-b', gameId: 'game-1', sessionId: 's', appState: 'background', routeVisible: false,
  }, { nowMs: 10_100 });
  assert.equal(decide({ presences: [background] }).reason, 'not_viewing_game');
});

test('duplicate event keys never schedule a second push', () => {
  const key = createGameEventId(event);
  assert.equal(decide({ seenEventIds: new Set([key]) }).reason, 'duplicate');
  assert.equal(decide({ seenEventIds: [key] }).decision, 'suppress');
});

test('preference, permission and absent eligible devices suppress delivery', () => {
  assert.equal(decide({ preferenceEnabled: false }).reason, 'preference_disabled');
  assert.equal(decide({ permissionGranted: false }).reason, 'permission_denied');
  assert.equal(decide({ eligibleDeviceCount: 0 }).reason, 'no_eligible_device');
});

test('challenge events are delivered when eligible and are not mistaken for a turn acknowledgement', () => {
  const result = decide({ event: { ...event, type: 'challenge', version: 0 }, presences: [live(8)] });
  assert.equal(result.decision, 'send');
  assert.equal(result.reason, 'not_a_gameplay_turn');
});

test('background transition cannot suppress; reconnect renews lease without lowering ack', () => {
  const foreground = live(8);
  const background = refreshPresenceLease(foreground, {
    appState: 'background', routeVisible: false, acknowledgedVersion: 7,
  }, { nowMs: 11_000, ttlMs: 45_000 });
  assert.equal(isLiveGamePresence(background, event, 11_100), false);
  const reconnected = refreshPresenceLease(background, {
    appState: 'foreground', routeVisible: true, acknowledgedVersion: 6,
  }, { nowMs: 20_000, ttlMs: 45_000 });
  assert.equal(reconnected.acknowledgedVersion, 8);
  assert.equal(isLiveGamePresence(reconnected, event, 20_100), true);
});

test('legacy direct and outbox have one logical dispatcher during transition', () => {
  const common = {
    event,
    nowMs: 20_000,
    presences: [],
    eligibleDeviceCount: 1,
    permissionGranted: true,
    preferenceEnabled: true,
    outboxAuthoritative: true,
  };
  assert.deepEqual(coordinateGamePush({ ...common, source: 'client_enqueue' }), {
    decision: 'enqueue_only', reason: 'outbox_is_single_dispatcher', eventId: createGameEventId(event),
  });
  assert.equal(coordinateGamePush({ ...common, source: 'legacy_direct' }).reason, 'outbox_is_single_dispatcher');
  assert.equal(coordinateGamePush({
    ...common, source: 'legacy_direct', outboxEventIds: [createGameEventId(event)],
  }).reason, 'already_owned_by_outbox');
  assert.equal(coordinateGamePush({ ...common, source: 'outbox_worker' }).decision, 'send');
});
