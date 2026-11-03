const conflictMessages = new Set([
  'Stale match version',
  'Not your turn',
  'Match is not active',
  'Match timed out',
  'User is not a participant',
  'Not enough mana',
  'Item is not owned',
  'Item is not supported in PvP',
  'Item action is unavailable',
  'Idempotency key reused with different command',
  'Match is unavailable',
  'Only the match host can cancel this room',
  'Only a waiting PvP room can be cancelled',
]);

// PostgREST errors are plain objects, not necessarily Error instances.
// Only known domain messages may cross the HTTP boundary.
export function getPvpErrorResponse(error: unknown) {
  const message = error !== null && typeof error === 'object' &&
      'message' in error && typeof error.message === 'string'
    ? error.message
    : '';
  if (message === 'User is not an authorized RPG room participant') {
    return { status: 403, error: 'Ты не состоишь в этой PvP-комнате.' };
  }
  if (conflictMessages.has(message)) {
    return { status: 409, error: message };
  }
  return { status: 500, error: 'Внутренняя ошибка сервера.' };
}
