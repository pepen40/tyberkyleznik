async function runPvpCallbackTests(source) {
  const start=source.indexOf('async function submitPvpIntent('),end=source.indexOf('function handlePvpEnemyAction(',start);
  if(start<0||end<0)throw new Error('Missing PvP callback boundary');
  const passed=[],assert=(v,m)=>{if(!v)throw new Error(m);};
  function fixture(){
    let resolve,reject;
    const request=new Promise((ok,no)=>{resolve=ok;reject=no;});
    const env={pvpMatchId:'match-a',pvpMatchVersion:1,myRoomId:'room-a',currentAuthUserId:'account-a',
      pvpPendingAction:null,pvpActionBusy:false,pvpBattleFinished:false,pvpGameState:{isMyTurn:true},
      currentInventory:['original'],currentItemPoints:1,newPvpActionId:()=> 'action-a',
      calls:[],logs:[],applied:[],syncs:0,disablePvpButtons(){},enablePvpButtons(){},updateUI(){},alert(){},
      invokeRpgPvp:(action,data)=>{env.calls.push({action,data});return request;},
      applyAuthoritativePvpMatch:result=>env.applied.push(result),logPvp:text=>env.logs.push(text),syncPvpMatch:()=>env.syncs++,
    };
    const submit=new Function('env','with(env){return ('+source.slice(start,end).trim()+');}')(env);
    return {env,submit,resolve,reject};
  }
  async function test(name,fn){await fn();passed.push(name);}
  await test('late PvP success does not mutate a replacement match',async()=>{
    const f=fixture(),pending=f.submit('use_item','item');
    f.env.myRoomId='room-b';f.env.pvpMatchId='match-b';f.env.pvpPendingAction={action_id:'new'};f.env.pvpActionBusy=true;
    f.resolve({success:true,inventory:[],item_points:0});await pending;
    assert(f.env.applied.length===0&&f.env.logs.length===0&&f.env.currentInventory.length===1,'Old match response applied');
    assert(f.env.pvpPendingAction.action_id==='new'&&f.env.pvpActionBusy,'Old finally unlocked new action');
  });
  await test('late PvP rejection after account change leaves current account untouched',async()=>{
    const f=fixture(),pending=f.submit('attack');f.env.currentAuthUserId='account-b';
    f.reject(new Error('Stale match version'));await pending;
    assert(f.env.logs.length===0&&f.env.syncs===0,'Old account error affected UI');
  });
  await test('unknown transport failure preserves action ID for a safe retry',async()=>{
    const f=fixture(),pending=f.submit('attack');f.reject(new Error('network'));await pending;
    assert(f.env.pvpPendingAction.action_id==='action-a'&&!f.env.pvpActionBusy,'Idempotency key lost on transport failure');
    await f.submit('attack');
    assert(f.env.calls.length===2&&f.env.calls[1].data.action_id===f.env.calls[0].data.action_id,'Retry changed action identity');
  });
  await test('current confirmed action applies and clears only its pending command',async()=>{
    const f=fixture(),pending=f.submit('attack');f.resolve({success:true,action:'attack',damage:5});await pending;
    assert(f.env.applied.length===1&&f.env.pvpPendingAction===null&&!f.env.pvpActionBusy,'Normal action broken');
  });
  return {passed:passed.length,tests:passed};
}
