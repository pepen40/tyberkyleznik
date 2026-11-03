import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { CLOSED_TEST_ACTIONS, closedTestAccess } from './closed-test-policy.ts';

Deno.test('closed test never enables economic or client-result actions', () => {
  for (const action of ['pvp_result','score','chess_reward','rpg_win','roach_clear','claim_rpg_reward','open_case','sell_item','buy_item','consume_item','buy_upgrade','daily_status']) {
    assertEquals(CLOSED_TEST_ACTIONS.has(action), false, action);
  }
  for (const action of ['get_player_profile','game_invitation','send_chat_message','register_rpg_invitation']) assertEquals(CLOSED_TEST_ACTIONS.has(action),true);
});
Deno.test('closed test authorization fails closed on missing membership and RPC errors', async () => {
  assertEquals(await closedTestAccess({rpc:()=>Promise.resolve({data:false,error:null})},'user'),false);
  assertEquals(await closedTestAccess({rpc:()=>Promise.resolve({data:true,error:{message:'unavailable'}})},'user'),false);
  assertEquals(await closedTestAccess({rpc:()=>Promise.resolve({data:true,error:null})},'user'),true);
});
