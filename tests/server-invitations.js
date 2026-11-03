async function runServerInvitationTests(protocolSource, beforeSource, edgeSource) {
  const passed=[],assert=(v,m)=>{if(!v)throw new Error(m);};
  async function test(name,fn){await fn();passed.push(name);}
  const create=new Function(protocolSource+'\nreturn createServerChessInvitations;')();
  const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
  await test('before: forged shared-bus acceptance starts a room in 18f28dc',()=>{
    let joins=0;
    const run=new Function(beforeSource+'\nreturn vulnerableChessInviteAnswer;')();
    run({outgoingInvite:{id:'known',target:'victim',account:'host-id',expiresAt:Date.now()+30000},currentUser:'host',currentAuthUserId:'host-id',
      outgoingStatus:{},clearTimeout(){},switchTab(){},window:{joinChessRoom(){joins++;}}},
      {payload:{id:'known',target:'host',from:'victim',reason:'accepted',accepted:true}});
    assert(joins===1,'Baseline exploit no longer reproduced by frozen handler');
  });
  function fixture(){
    const events=[],states=[],calls=[],timers=[];let account='host-id';
    const result={data:{success:true,server_now:new Date().toISOString(),invitations:[],invitation:{expires_at:new Date(Date.now()+30000).toISOString()}}};
    const opts={account:()=>account,username:()=> 'host',setTimer:fn=>{timers.push(fn);return timers.length;},clearTimer(){},
      invoke:async body=>{calls.push(body);return result;}};
    const api=create(opts);api.on('broadcast',{event:'chess_invite'},p=>events.push(p));api.on('broadcast',{event:'chess_invite_answer'},p=>events.push(p));
    return {api,opts,result,events,states,calls,timers,setAccount:id=>{account=id;}};
  }
  await test('after: no shared channel exists and replies are server commands without client identity',async()=>{
    const f=fixture();f.api.subscribe(s=>f.states.push(s));await flush();
    await f.api.send({event:'chess_invite_answer',payload:{id:'known',from:'victim',target:'elsewhere',accepted:true}});
    assert(f.events.length===0,'Client-controlled reply became a trusted event');
    const call=f.calls.at(-1);assert(call.action==='game_invitation'&&call.data.op==='reply'&&call.data.value==='accepted','Wrong command');
    assert(!('from' in call.data)&&!('target' in call.data)&&!('user_id' in call.data),'Client identity forwarded');
    f.api.stop();
  });
  await test('only canonical actor-scoped SQL records produce invitation answers',async()=>{
    const f=fixture();f.result.data.invitations=[{topic:'chess-room-known',kind:'chess',host_id:'host-id',invitee_id:'guest-id',host:'host',invitee:'trusted',status:'accepted'}];
    f.api.subscribe(()=>{});await flush();assert(f.events.length===1&&f.events[0].payload.from==='trusted','Canonical result not projected');f.api.stop();
  });
  await test('late polling result after account change produces no events',async()=>{
    const f=fixture();let resolve;f.opts.invoke=()=>new Promise(r=>{resolve=r;});f.api.subscribe(()=>{});
    f.setAccount('other');resolve(f.result);await flush();assert(f.events.length===0&&f.states.length===0,'Old account poll exposed data');f.api.stop();
  });
  await test('Edge command actor always comes from verified authData, ignoring body spoof',async()=>{
    const a=edgeSource.indexOf("if (action === 'game_invitation') {"),b=edgeSource.indexOf("    const { data: player, error }",a);
    if(a<0||b<0)throw new Error('Edge command boundary missing');
    const code=edgeSource.slice(a+"if (action === 'game_invitation') {".length,b).trim().replace(/}$/, '');
    const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
    let params;
    const run=new AsyncFunction('supabaseAdmin','authData','data','corsHeaders','Response',code);
    await run({rpc:async(_name,args)=>{params=args;return{data:{success:true},error:null};}},
      {user:{id:'verified-user'}},{op:'reply',topic:'topic',value:'accepted',user_id:'victim',from:'victim'},{},class{constructor(body,options){this.body=body;this.options=options;}});
    assert(params.p_user_id==='verified-user','JWT identity replaced by body');
    assert(edgeSource.indexOf('auth.getUser(')<a,'Command precedes JWT verification');
  });
  return{passed:passed.length,tests:passed};
}
