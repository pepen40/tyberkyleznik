import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { isServerVerifiedRpgRewardClaim } from './reward-policy.ts';

Deno.test('only the server-accounted spend contract is eligible for an RPG reward claim', () => {
  assertEquals(isServerVerifiedRpgRewardClaim('daily', 'spend500'), true);
  assertEquals(isServerVerifiedRpgRewardClaim('daily', 'wins3'), false);
  assertEquals(isServerVerifiedRpgRewardClaim('daily', 'boss1'), false);
  assertEquals(isServerVerifiedRpgRewardClaim('achievement', 'first_win'), false);
  assertEquals(isServerVerifiedRpgRewardClaim('achievement', 'ten_wins'), false);
  assertEquals(isServerVerifiedRpgRewardClaim('achievement', 'fifty_wins'), false);
  assertEquals(isServerVerifiedRpgRewardClaim('achievement', 'first_boss'), false);
  assertEquals(isServerVerifiedRpgRewardClaim('achievement', 'ten_bosses'), false);
});

Deno.test('unknown and malformed reward claims fail closed', () => {
  assertEquals(isServerVerifiedRpgRewardClaim('daily', 'future_reward'), false);
  assertEquals(isServerVerifiedRpgRewardClaim('achievement', 'spend500'), false);
  assertEquals(isServerVerifiedRpgRewardClaim('unknown', 'spend500'), false);
  assertEquals(isServerVerifiedRpgRewardClaim('', ''), false);
});

Deno.test('Edge Function gates claim RPC calls through the allowlist', async () => {
  const source = await Deno.readTextFile(new URL('../award-coins/index.ts', import.meta.url));
  const guard = source.indexOf('if (!isServerVerifiedRpgRewardClaim(kind, id))');
  const claimRpc = source.indexOf("rpc('claim_rpg_reward_atomic'");
  assertEquals(guard >= 0, true);
  assertEquals(claimRpc > guard, true);
});
