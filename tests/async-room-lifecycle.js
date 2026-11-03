async function runAsyncRoomLifecycleTests(source, reportFailures = false) {
  const passed=[],failures=[];
  const cut=(a,b)=>{const i=source.indexOf(a),j=source.indexOf(b,i);if(i<0||j<0)throw new Error('Missing lifecycle boundary');return source.slice(i,j).trim();};
  async function test(name,fn){try{await fn();passed.push(name);}catch(error){if(!reportFailures)throw error;failures.push({name,error:error.message});}}
  await test('late PvP polling response cannot cross accounts',async()=>{
    let resolve,applied=0;
    const env={myRoomId:'room',pvpMatchId:'match',pvpSyncBusy:false,currentAuthUserId:'old',pvpBattleStarted:true,pvpBattleFinished:false,
      invokeRpgPvp:()=>new Promise(r=>{resolve=r;}),applyAuthoritativePvpMatch:()=>applied++,logPvp(){}};
    const run=new Function('env','with(env){return ('+cut('async function syncPvpMatch()', 'function startPvpMatchSync()')+');}')(env);
    const pending=run();env.currentAuthUserId='new';resolve({match_id:'match'});await pending;
    if(applied)throw new Error('Old polling response applied across accounts');
  });
  await test('incoming RPG dialog expires and releases the busy slot',async()=>{
    const handlers={},timers=[],node={hidden:false,textContent:'',classList:{add(){node.hidden=true;},remove(){node.hidden=false;}}};
    const channel={on(_type,filter,fn){handlers[filter.event]=fn;return channel;}};
    const env={rpgInvitationChannel:channel,currentAuthUserId:'user',pendingChallengeRoomId:null,pendingChallengeHost:null,pendingChallengeExpiryTimer:null,
      processingIncomingChallengeRoomId:null,myRoomId:null,pendingOutgoingChallenge:null,
      supabaseClient:{functions:{invoke:async()=>({data:{success:true,kind:'rpg',hostUsername:'trusted'}})}},EDGE_FUNCTION_NAME:'award-coins',
      localStorage:{getItem:()=>null},document:{getElementById:()=>node},sendRpgInvitationResponse:async()=>true,
      setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){}};
    new Function('env','with(env){return ('+cut('function listenForChallenges(', 'async function closeReceiveModal()')+');}')(env)(channel);
    await handlers.challenge({payload:{targetUserId:'user',roomId:'room_timer0001',remainingMs:10}});
    if(!timers.length)throw new Error('Incoming invitation has no local expiry');
    timers[0]();if(env.pendingChallengeRoomId!==null||!node.hidden)throw new Error('Expired dialog remains busy');
  });
  for (const name of ['createPvpRoom','joinPvpRoom']) await test(name+' ignores membership result after account change',async()=>{
    let resolve;
    const noop=()=>{};
    const env={currentAuthUserId:'old',myRoomId:null,pvpMatchId:null,pvpMatchVersion:null,isPvpHost:false,currentPvpChar:null,pvpBattleFinished:false,pvpPendingAction:null,pvpOpponentName:null,
      currentUser:'old',currentPvpPts:0,lobbyChannel:null,EDGE_FUNCTION_NAME:'award-coins',
      document:{getElementById:()=>({value:'ashab',classList:{add:noop,remove:noop}})},
      supabaseClient:{functions:{invoke:()=>new Promise(r=>{resolve=r;})}},invokeRpgPvp:async()=>({match_id:'old-match',version:0}),
      newPvpActionId:()=> 'id',alert:noop,closePvpLobby:noop,attachPvpRoomChannel:noop,switchTab:noop,startPvpMatchSync:noop};
    const end=name==='createPvpRoom'?'async function joinPvpRoom(':'async function leavePvpRoom(';
    const fn=new Function('env','with(env){return ('+cut('async function '+name+'(',end)+');}')(env);
    const pending=fn('room_old0001','ashab');env.currentAuthUserId='new';resolve({data:{success:true}});await pending;
    if(env.myRoomId!==null)throw new Error('Old membership result replaced new account room');
  });
  await test('late channel removal cannot reset a replacement PvP room',async()=>{
    let resolve;
    const env={currentAuthUserId:'old',myRoomId:'old-room',pvpMatchId:'old-match',pvpMatchVersion:1,isPvpHost:false,pendingOutgoingChallenge:null,
      pvpBattleFinished:false,pvpBattleStarted:false,pvpSyncTimer:null,roomChannel:{},lobbyChannel:null,
      supabaseClient:{removeChannel:()=>new Promise(r=>{resolve=r;})},document:{getElementById:()=>({classList:{add(){},remove(){}},pause(){}})},
      pvpActionBusy:false,pvpPendingAction:null,currentPvpChar:null,pvpOpponentName:null};
    const fn=new Function('env','with(env){return ('+cut('async function leavePvpRoom(', 'function updatePvpUI(')+');}')(env);
    const pending=fn(false);env.myRoomId='new-room';env.pvpMatchId='new-match';resolve();await pending;
    if(env.myRoomId!=='new-room')throw new Error('Late removal cleared replacement room');
  });
  for(const reject of [false,true]) await test('private RPG registration '+(reject?'failure':'denial')+' cannot clear another account room',async()=>{
    let resolve,rejectRequest;
    const noop=()=>{};
    const env={currentAuthUserId:'old',currentUser:'old',myRoomId:null,pendingChallengeTarget:'peer',pendingOutgoingChallenge:null,outgoingChallengeRegistrationInProgress:false,
      rpgInvitationChannelStatus:'SUBSCRIBED',onlinePlayers:['peer'],normalizeRpgUsername:x=>x,closeChallengeModal:noop,
      document:{getElementById:()=>({value:'ashab'})},currentUpgrades:{ashab:{hp:0,atk:0}},getGearBonuses:()=>({hp:0,atk:0}),
      crypto:{randomUUID:()=> '11111111-1111-4111-8111-111111111111'},EDGE_FUNCTION_NAME:'award-coins',alert:noop,
      supabaseClient:{functions:{invoke:()=>new Promise((ok,bad)=>{resolve=ok;rejectRequest=bad;})}}};
    const fn=new Function('env','with(env){return ('+cut('async function executeChallenge()', 'async function expireOutgoingRpgChallenge(')+');}')(env);
    const pending=fn();env.currentAuthUserId='new';env.myRoomId='new-account-room';
    if(reject)rejectRequest(Error('offline'));else resolve({data:{success:false}});
    await pending;
    if(env.myRoomId!=='new-account-room')throw Error('Late private registration cleared another account room');
  });
  for(const name of ['createPvpRoom','joinPvpRoom']) await test(name+' retires the previous offline battle only after admission',async()=>{
    const nodes=new Map(),cleared=[];
    const node=id=>{if(!nodes.has(id)){const classes=new Set();nodes.set(id,{value:'ashab',classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)}});}return nodes.get(id);};
    const noop=()=>{};
    const env={currentAuthUserId:'user',myRoomId:null,pvpMatchId:null,pvpMatchVersion:null,isPvpHost:false,currentPvpChar:null,pvpBattleFinished:false,pvpPendingAction:null,pvpOpponentName:null,
      currentUser:'user',currentPvpPts:0,lobbyChannel:null,EDGE_FUNCTION_NAME:'award-coins',document:{getElementById:node},
      rpgChar:{hp:100},rpgEnemy:{hp:50},isPlayerTurn:true,enemyTurnTimeout:42,clearTimeout:id=>cleared.push(id),
      supabaseClient:{functions:{invoke:async()=>({data:{success:true}})}},invokeRpgPvp:async()=>({match_id:'new-match',version:0}),
      newPvpActionId:()=> 'id',alert:noop,closePvpLobby:noop,attachPvpRoomChannel:noop,switchTab:noop,startPvpMatchSync:noop};
    const bind=text=>new Function('env','with(env){return ('+text+');}')(env);
    if(source.includes('function stopOfflineBattleForPvp()'))env.stopOfflineBattleForPvp=bind(cut('function stopOfflineBattleForPvp()', 'function changeBackground()'));
    const end=name==='createPvpRoom'?'async function joinPvpRoom(':'async function leavePvpRoom(';
    await bind(cut('async function '+name+'(',end))('room_new0001','ashab');
    if(!node('rpg-battle-screen').classList.contains('hidden')||env.rpgChar!==null||env.rpgEnemy!==null||env.isPlayerTurn||!cleared.includes(42))throw Error('Admitted PvP left the offline fight/timers active');
    // A denied room must preserve the offline game.
    env.myRoomId=null;env.pvpMatchId=null;env.rpgChar={hp:100};env.supabaseClient.functions.invoke=async()=>({data:{success:false}});
    await bind(cut('async function '+name+'(',end))('room_denied001','ashab');
    if(!env.rpgChar)throw Error('Denied admission cancelled the offline fight');
  });
  await test('removed PvP channel callbacks cannot render into current chat',()=>{
    let onMessage,onState,messages=0,syncs=0;
    const channel={on(_type,_filter,fn){onMessage=fn;return channel;},subscribe(fn){onState=fn;}};
    const env={roomChannel:null,currentAuthUserId:'old',myRoomId:'old-room',supabaseClient:{channel:()=>channel,removeChannel(){}},
      addPvpChatMessage:()=>messages++,syncPvpMatch:()=>syncs++,initPvpChat(){}};
    new Function('env','with(env){return ('+cut('function attachPvpRoomChannel(', 'async function createPvpRoom(')+');}')(env)('old-room');
    env.roomChannel={};env.currentAuthUserId='new';env.myRoomId='new-room';onMessage({payload:{nick:'old',text:'private'}});onState('SUBSCRIBED');
    if(messages||syncs)throw new Error('Removed channel affected new session');
  });
  await test('old chess reward response cannot overwrite a new game status',async()=>{
    let resolve,statusChanges=0;
    const env={game:{},currentAuthUserId:'user',currentUser:'user',onlineChessMode:false,chessRewardClaimed:false,level:1,EDGE_FUNCTION_NAME:'award-coins',
      supabaseClient:{functions:{invoke:()=>new Promise(r=>{resolve=r;})}},setStatus:()=>statusChanges++,updateUI(){},currentCoins:0};
    const fn=new Function('env','with(env){return ('+cut('async function awardOfflineChessCoins()', 'function updateGameStatus()')+');}')(env);
    const pending=fn();env.game={};env.chessRewardClaimed=false;resolve({data:{rewardPaused:true}});await pending;
    if(statusChanges)throw new Error('Old reward changed new game status');
  });
  return{passed:passed.length,tests:passed,failures};
}
