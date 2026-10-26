const GAME_EVENT_TYPES = new Set(['challenge', 'turn']);
const PRESENCE_STATES = new Set(['foreground', 'background', 'disconnected', 'left']);
const DEFAULT_PRESENCE_TTL_MS = 45_000;
const DEFAULT_ACK_GRACE_MS = 3_000;

function id(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${label} non valido`);
  }
  return value.trim();
}

function safeInteger(value, label, min = 0) {
  if (!Number.isSafeInteger(value) || value < min) {
    throw new TypeError(`${label} non valido`);
  }
  return value;
}

function createGameEventId(event) {
  if (!event || !GAME_EVENT_TYPES.has(event.type)) {
    throw new TypeError('Tipo evento non valido');
  }
  const gameId = encodeURIComponent(id(event.gameId, 'gameId'));
  const recipientId = encodeURIComponent(id(event.recipientId, 'recipientId'));
  const version = safeInteger(event.version, 'version');
  return `game-push:${event.type}:${gameId}:v${version}:${recipientId}`;
}

function createPresenceLease(input, options = {}) {
  if (!input) throw new TypeError('Presenza mancante');
  const userId = id(input.userId, 'userId');
  const gameId = id(input.gameId, 'gameId');
  const sessionId = id(input.sessionId, 'sessionId');
  const nowMs = safeInteger(options.nowMs, 'nowMs');
  const ttlMs = safeInteger(options.ttlMs ?? DEFAULT_PRESENCE_TTL_MS, 'ttlMs', 1);
  const acknowledgedVersion = safeInteger(input.acknowledgedVersion ?? 0, 'acknowledgedVersion');
  const appState = PRESENCE_STATES.has(input.appState) ? input.appState : 'disconnected';
  const routeVisible = appState === 'foreground' && input.routeVisible === true;
  return {
    userId,
    gameId,
    sessionId,
    appState,
    routeVisible,
    acknowledgedVersion,
    leaseExpiresAtMs: nowMs + ttlMs,
  };
}

function refreshPresenceLease(previous, update, options = {}) {
  if (!previous) throw new TypeError('Presenza precedente mancante');
  const nowMs = safeInteger(options.nowMs, 'nowMs');
  const ttlMs = safeInteger(options.ttlMs ?? DEFAULT_PRESENCE_TTL_MS, 'ttlMs', 1);
  const acknowledgedVersion = safeInteger(update.acknowledgedVersion ?? previous.acknowledgedVersion, 'acknowledgedVersion');
  const requestedState = update.appState ?? previous.appState;
  const appState = PRESENCE_STATES.has(requestedState) ? requestedState : 'disconnected';
  const requestedVisibility = update.routeVisible ?? previous.routeVisible;
  return {
    ...previous,
    appState,
    routeVisible: appState === 'foreground' && requestedVisibility === true,
    // Le conferme non possono tornare indietro se arrivano callback fuori ordine.
    acknowledgedVersion: Math.max(previous.acknowledgedVersion, acknowledgedVersion),
    leaseExpiresAtMs: nowMs + ttlMs,
  };
}

function isLiveGamePresence(presence, event, nowMs) {
  return Boolean(
    presence && event &&
    presence.userId === event.recipientId &&
    presence.gameId === event.gameId &&
    presence.appState === 'foreground' &&
    presence.routeVisible === true &&
    Number.isSafeInteger(presence.leaseExpiresAtMs) &&
    presence.leaseExpiresAtMs > nowMs
  );
}

function containsEvent(seenEventIds, eventId) {
  if (seenEventIds instanceof Set) return seenEventIds.has(eventId);
  return Array.isArray(seenEventIds) && seenEventIds.includes(eventId);
}

/**
 * Deterministic policy model for an eventual server worker. It has no network,
 * storage, Expo, or Supabase side effects and is not wired to production code.
 */
function decideGamePush(input) {
  const event = input?.event;
  const nowMs = safeInteger(input?.nowMs, 'nowMs');
  const eventId = createGameEventId(event);
  if (containsEvent(input.seenEventIds, eventId)) {
    return { decision: 'suppress', reason: 'duplicate', eventId };
  }
  if (input.preferenceEnabled === false) {
    return { decision: 'suppress', reason: 'preference_disabled', eventId };
  }
  if (input.permissionGranted === false) {
    return { decision: 'suppress', reason: 'permission_denied', eventId };
  }
  if (!Number.isSafeInteger(input.eligibleDeviceCount) || input.eligibleDeviceCount < 1) {
    return { decision: 'suppress', reason: 'no_eligible_device', eventId };
  }
  if (event.type !== 'turn') {
    return { decision: 'send', reason: 'not_a_gameplay_turn', eventId };
  }

  const active = (input.presences || []).filter((presence) =>
    isLiveGamePresence(presence, event, nowMs)
  );
  if (active.some((presence) => presence.acknowledgedVersion >= event.version)) {
    return { decision: 'suppress', reason: 'version_already_visible', eventId };
  }

  const graceMs = safeInteger(input.ackGraceMs ?? DEFAULT_ACK_GRACE_MS, 'ackGraceMs');
  const createdAtMs = safeInteger(event.createdAtMs, 'createdAtMs');
  const ackDeadlineMs = createdAtMs + graceMs;
  if (active.length > 0 && nowMs < ackDeadlineMs) {
    return { decision: 'defer', reason: 'waiting_for_realtime_ack', eventId, retryAtMs: ackDeadlineMs };
  }

  return { decision: 'send', reason: active.length ? 'ack_timeout' : 'not_viewing_game', eventId };
}

/**
 * Transition guard for the legacy direct sender and a future durable outbox.
 * When the outbox owns game notifications, direct/client paths may enqueue or
 * observe an event but may never dispatch it themselves.
 */
function coordinateGamePush(input) {
  const eventId = createGameEventId(input?.event);
  const source = input?.source;
  const outboxAuthoritative = input?.outboxAuthoritative === true;
  const outboxEventIds = input?.outboxEventIds;

  if (containsEvent(outboxEventIds, eventId) && source !== 'outbox_worker') {
    return { decision: 'suppress', reason: 'already_owned_by_outbox', eventId };
  }

  if (outboxAuthoritative) {
    if (source === 'legacy_direct') {
      return { decision: 'suppress', reason: 'outbox_is_single_dispatcher', eventId };
    }
    if (source === 'client_enqueue') {
      return { decision: 'enqueue_only', reason: 'outbox_is_single_dispatcher', eventId };
    }
    if (source !== 'outbox_worker') {
      throw new TypeError('Sorgente notifica non valida');
    }
  } else if (source !== 'legacy_direct' && source !== 'outbox_worker') {
    throw new TypeError('Sorgente notifica non valida');
  }

  return decideGamePush(input);
}

module.exports = {
  DEFAULT_ACK_GRACE_MS,
  DEFAULT_PRESENCE_TTL_MS,
  createGameEventId,
  createPresenceLease,
  coordinateGamePush,
  decideGamePush,
  isLiveGamePresence,
  refreshPresenceLease,
};
