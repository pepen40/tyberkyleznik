import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { getRewardPauseReason } from './reward-policy.ts';

Deno.test('client-reported game results stay paused regardless of claimed outcome fields', () => {
  for (const action of ['chess_reward', 'score', 'roach_clear', 'rpg_win', 'pvp_result']) {
    assertEquals(getRewardPauseReason(action, { won: true, win: true, score: 100000, floor: 500 }), 'client-result');
  }
});

Deno.test('win-derived RPG claims stay paused while spending-based contract remains available', () => {
  for (const id of ['wins3', 'boss1', 'first_win', 'ten_wins', 'fifty_wins', 'first_boss', 'ten_bosses']) {
    assertEquals(getRewardPauseReason('claim_rpg_reward', id), 'win-based-rpg-claim');
  }
  assertEquals(getRewardPauseReason('claim_rpg_reward', 'spend500'), null);
});

Deno.test('unknown actions and malformed claim identifiers do not match a reward pause rule', () => {
  assertEquals(getRewardPauseReason('buy_upgrade', { win: true }), null);
  assertEquals(getRewardPauseReason('claim_rpg_reward', { id: 'first_win' }), null);
  assertEquals(getRewardPauseReason(null, 'first_win'), null);
});

Deno.test('Edge Function checks the reward pause before profile reads, cooldowns, and writes', async () => {
  const source = await Deno.readTextFile(new URL('../award-coins/index.ts', import.meta.url));
  const guard = source.indexOf('getRewardPauseReason(action, data?.id)');
  assertEquals(guard >= 0, true);
  assertEquals(guard < source.indexOf(".from('players')"), true);
  assertEquals(guard < source.indexOf("rpc('check_action_cooldown'"), true);
  assertEquals(guard < source.indexOf("rpc('apply_pvp_result'"), true);
  assertEquals(guard < source.indexOf("rpc('record_rpg_win_atomic'"), true);
});
