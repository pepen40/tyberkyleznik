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
