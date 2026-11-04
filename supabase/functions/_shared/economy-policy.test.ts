import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { isEconomyPausedAction } from './economy-policy.ts';
Deno.test('ordinary public play cannot enable unverified rewards, purchases or item issuance', () => {
  for (const action of ['chess_reward','score','roach_clear','rpg_win','claim_rpg_reward','open_case','sell_item','remove_listing','buy_item','buy_gear','buy_upgrade']) assertEquals(isEconomyPausedAction(action), true);
  for (const action of ['get_player_profile','game_invitation','send_chat_message','equip_gear','consume_item','daily_status']) assertEquals(isEconomyPausedAction(action), false);
});
Deno.test('public economy gate runs before RPC dispatch without depending on a browser/test flag', async () => {
  const source = await Deno.readTextFile(new URL('../award-coins/index.ts', import.meta.url));
  const guard = source.indexOf('if (isEconomyPausedAction(action))');
  assertEquals(guard > 0 && guard < source.indexOf("rpc('game_invitation_command'"), true);
  const body = source.slice(guard, source.indexOf("if (action === 'game_invitation')", guard));
  assertEquals(body.includes('rewardPaused: true'), true);
  assertEquals(body.includes('closedTest'), false);
});
