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
  if (!validId(match.challengerId) || !validId(match.challengedId) || match.challengerId === match.challengedId) {
    return { ok: false, reason: 'invalid_match_participants' };
  }
  if (!Number.isSafeInteger(match.version) || match.version < 0) return { ok: false, reason: 'invalid_match_version' };
  if (actorId !== match.challengerId && actorId !== match.challengedId) return { ok: false, reason: 'not_participant' };
  if (match.turnUserId !== actorId) return { ok: false, reason: 'not_your_turn' };
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion !== match.version) return { ok: false, reason: 'stale_version' };
  if (!action || action.type !== 'play_card' || !validId(action.cardId)) return { ok: false, reason: 'invalid_action' };
  if (Object.keys(action).some((key) => !['type', 'cardId', 'captureIds', 'operationId'].includes(key))) {
    return { ok: false, reason: 'client_supplied_result_or_unknown_field' };
  }
  if (action.operationId !== undefined && !validId(action.operationId)) return { ok: false, reason: 'invalid_operation_id' };

  const players = serverState?.players;
  if (!Array.isArray(players) || players.length !== 2 ||
      !players.includes(match.challengerId) || !players.includes(match.challengedId) ||
      serverState.type !== match.gameType) {
    return { ok: false, reason: 'server_state_mismatch' };
  }

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

/**
 * Checks consistency of a result calculated by the trusted rules engine.
 * Callers must never use this to accept a result submitted by a client.
 */
function validateCalculatedResult(input) {
  const { players, scores, winnerId } = input || {};
  if (!Array.isArray(players) || players.length !== 2 ||
      !players.every(validId) || players[0] === players[1] ||
      !scores || typeof scores !== 'object' || Array.isArray(scores)) {
    return { ok: false, reason: 'invalid_result' };
  }
  const [a, b] = players;
  const scoreA = scores[a];
  const scoreB = scores[b];
  if (![scoreA, scoreB].every((score) => Number.isSafeInteger(score) && score >= 0) ||
      Object.keys(scores).some((id) => !players.includes(id))) {
    return { ok: false, reason: 'invalid_scores' };
  }
  const expectedWinnerId = scoreA === scoreB ? null : scoreA > scoreB ? a : b;
  if (winnerId !== expectedWinnerId) return { ok: false, reason: 'winner_score_mismatch' };
  return { ok: true, expectedWinnerId };
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

module.exports = {
  projectGameStateForPlayer,
  validateCalculatedResult,
  validateChallenge,
  validateMoveEnvelope,
};
