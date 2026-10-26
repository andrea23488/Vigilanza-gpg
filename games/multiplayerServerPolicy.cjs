const GAME_TYPES = new Set(['scopa', 'briscola']);

function validId(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateChallenge(input) {
  const { actorId, recipientId, gameType } = input || {};
  if (!validId(actorId) || !validId(recipientId) || actorId === recipientId) {
    return { ok: false, reason: 'invalid_participants' };
  }
  if (!GAME_TYPES.has(gameType)) return { ok: false, reason: 'invalid_game' };
  if (input.acceptedColleague !== true) return { ok: false, reason: 'not_accepted_colleague' };
  if (input.blockedEitherWay === true) return { ok: false, reason: 'blocked' };
  if (input.rateLimited === true) return { ok: false, reason: 'rate_limited' };
  return { ok: true };
}

/**
 * Validates the operation envelope against server-loaded row/state.
 * This is deliberately not a substitute for the authoritative rules engine.
 */
function validateMoveEnvelope(input) {
  const { match, actorId, expectedVersion, action, serverState } = input || {};
  if (!match || !validId(actorId) || !validId(match.id)) return { ok: false, reason: 'invalid_match' };
  if (!GAME_TYPES.has(match.gameType)) return { ok: false, reason: 'invalid_game' };
  if (match.status !== 'in_progress') return { ok: false, reason: 'match_not_in_progress' };
  if (actorId !== match.challengerId && actorId !== match.challengedId) return { ok: false, reason: 'not_participant' };
  if (match.turnUserId !== actorId) return { ok: false, reason: 'not_your_turn' };
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion !== match.version) return { ok: false, reason: 'stale_version' };
  if (!action || action.type !== 'play_card' || !validId(action.cardId)) return { ok: false, reason: 'invalid_action' };

  const hand = serverState?.hands?.[actorId];
  if (!Array.isArray(hand) || !hand.some((card) => card?.id === action.cardId)) {
    return { ok: false, reason: 'card_not_in_server_hand' };
  }
  if (match.gameType === 'scopa') {
    if (!Array.isArray(action.captureIds) || new Set(action.captureIds).size !== action.captureIds.length) {
      return { ok: false, reason: 'invalid_capture_selection' };
    }
  } else if (action.captureIds !== undefined) {
    return { ok: false, reason: 'unexpected_capture_selection' };
  }

  return { ok: true, requiresAuthoritativeRulesCheck: true };
}

/** Safe read projection for planning/tests; never returns opponent hand or deck order. */
function projectGameStateForPlayer(serverState, userId) {
  if (!serverState || !validId(userId) || !Array.isArray(serverState.players) || !serverState.players.includes(userId)) {
    return null;
  }
  const publicFields = [
    'type', 'initialized', 'players', 'table', 'captured', 'sweeps', 'score',
    'lastMove', 'briscola', 'opensUserId', 'lastCaptureUserId', 'winner',
  ];
  const view = {};
  for (const key of publicFields) {
    if (Object.prototype.hasOwnProperty.call(serverState, key)) view[key] = serverState[key];
  }
  view.hand = Array.isArray(serverState.hands?.[userId]) ? serverState.hands[userId] : [];
  view.remainingDeckCount = Array.isArray(serverState.deck) ? serverState.deck.length : 0;
  return view;
}

module.exports = { projectGameStateForPlayer, validateChallenge, validateMoveEnvelope };
