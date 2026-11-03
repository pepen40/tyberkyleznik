import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { getPvpErrorResponse } from './pvp-errors.ts';

Deno.test('PvP preserves domain conflicts from plain PostgREST objects and Error instances', () => {
  const messages = [
    'Stale match version', 'Not your turn', 'Match is not active', 'Match timed out',
    'User is not a participant', 'Not enough mana', 'Item is not owned',
    'Item is not supported in PvP', 'Item action is unavailable',
    'Idempotency key reused with different command', 'Match is unavailable',
    'Only the match host can cancel this room', 'Only a waiting PvP room can be cancelled',
  ];
  for (const message of messages) {
    for (const error of [new Error(message), { message, code: 'P0001', details: 'private' }]) {
      assertEquals(getPvpErrorResponse(error), { status: 409, error: message });
    }
  }
});

Deno.test('PvP maps room authorization failure to a safe forbidden response', () => {
  for (const error of [
    new Error('User is not an authorized RPG room participant'),
    { message: 'User is not an authorized RPG room participant', code: 'P0001' },
    new Error('Match not found for participant'),
    { message: 'Match not found for participant', code: 'P0001', details: 'private' },
  ]) {
    assertEquals(getPvpErrorResponse(error), { status: 403, error: 'Ты не состоишь в этой PvP-комнате.' });
  }
});

Deno.test('PvP hides unexpected database messages and malformed errors', () => {
  for (const error of [
    null, undefined, 42, 'Stale match version', {}, { message: 42 },
    { message: null }, { message: 'Stale match version: private table details' },
    { message: 'duplicate key violates secret_table_key', code: '23505', details: 'private' },
    new Error('SUPABASE_SERVICE_ROLE_KEY missing'),
  ]) {
    assertEquals(getPvpErrorResponse(error), { status: 500, error: 'Внутренняя ошибка сервера.' });
  }
});
