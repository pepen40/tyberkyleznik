'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
async function run(){
  // Execute the real policy with only its TypeScript annotation removed.
  const policy=fs.readFileSync('supabase/functions/_shared/economy-policy.ts','utf8').replace('export function','function').replace('action: string): boolean','action)');
  const isEconomyPausedAction=new Function(policy+';return isEconomyPausedAction;')();
  const source=fs.readFileSync('supabase/functions/award-coins/index.ts','utf8');
  const start=source.indexOf('    if (isEconomyPausedAction(action))');
  assert(start>=0,'Missing normal-client server gate');
  assert(start<source.indexOf("rpc('game_invitation_command'"),'Gate must precede game/economy RPC dispatch');
  const block=source.slice(start,source.indexOf("    if (action === 'game_invitation')",start));
  const dispatch=new Function('action','isEconomyPausedAction','Response','corsHeaders',block+"; throw Error('No economic RPC should run');");
  for(const action of ['chess_reward','score','roach_clear','rpg_win','claim_rpg_reward','open_case','sell_item','remove_listing','buy_item','buy_gear','buy_upgrade']){
    assert(isEconomyPausedAction(action));
    const response=dispatch(action,isEconomyPausedAction,Response,{});
    const body=await response.json();assert.equal(body.success,false);assert.equal(body.rewardPaused,true);
  }
  for(const action of ['get_player_profile','game_invitation','register_rpg_invitation','join_room_membership','send_chat_message','equip_gear','consume_item','daily_status'])assert.equal(isEconomyPausedAction(action),false,action+' must remain outside the payout gate');
  console.log('PASS: ordinary clients cannot reach paused economic dispatch; profile/invitations/chat and gameplay item use remain available (source regression, no production calls)');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
