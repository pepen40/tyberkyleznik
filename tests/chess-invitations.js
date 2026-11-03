async function runChessInvitationTests(source) {
  const passed = [], assert = (v,m) => { if (!v) throw new Error(m); };
  const cut = (a,b) => { const i=source.indexOf(a),j=source.indexOf(b,i); if(i<0||j<0)throw new Error('Missing invitation boundary');return source.slice(i,j).trim(); };
  function fixture() {
    const timers=new Map(), sends=[], joins=[]; let now=1000, next=0;
    const env={currentAuthUserId:'account',currentUser:'me',outgoingInvite:null,incomingInvite:null,
      chessInviteReplies:new Map(),chessInviteLifetime:30000,EDGE_FUNCTION_NAME:'award-coins',
      Date:{now:()=>now},crypto:{randomUUID:()=> '10000000-0000-4000-8000-000000000001'},
      window:{joinChessRoom:async (...args)=>joins.push(args)},
      outgoingStatus:{},status:{},inviteFrom:{},inviteModal:{classList:{add(){},remove(){}}},
      localStorage:{getItem:()=>null},switchTab(){},
      setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id),
      chessInviteChannel:{send:async packet=>{sends.push(packet);return 'ok';}},
      supabaseClient:{functions:{invoke:async ()=>({data:{success:true,kind:'chess',hostUsername:'opponent'}})}},
    };
    const bind=text=>new Function('env','with(env){return ('+text+');}')(env);
    env.sendChessInviteReply=bind(cut('async function sendChessInviteReply(', 'window.disablePendingChessInvite'));
    env.sendChessInvite=bind(cut('async function sendChessInvite(', 'async function handleIncomingInvite('));
    env.handleIncomingInvite=bind(cut('async function handleIncomingInvite(', 'async function answerChessInvite('));
    env.answerChessInvite=bind(cut('async function answerChessInvite(', "openButton.addEventListener('click'"));
    const marker=".on('broadcast', { event: 'chess_invite_answer' }, payload => {";
    const begin=source.indexOf(marker),finish=source.indexOf('})',source.indexOf("window.joinChessRoom(data.id, 'w', target);",begin));
    if(begin<0||finish<0)throw new Error('Missing answer handler');
    env.receiveAnswer=new Function('env','payload','with(env){'+source.slice(begin+marker.length,finish)+'}').bind(null,env);
    const packet=()=>({payload:{id:'10000000-0000-4000-8000-000000000001',target:'me',expiresAt:now+30000}});
    return {env,sends,joins,timers,packet,advance:ms=>{now+=ms;}};
  }
  async function test(name,fn){await fn();passed.push(name);}
  await test('outgoing slot is reserved before registration and expires even if request hangs',async()=>{
    const f=fixture(); let resolve;
    f.env.supabaseClient.functions.invoke=()=>new Promise(r=>{resolve=r;});
    const first=f.env.sendChessInvite('opponent'); await f.env.sendChessInvite('other');
    assert(f.env.outgoingInvite.target==='opponent','Concurrent send replaced reservation');
    f.advance(31000); [...f.timers.values()][0]();
    assert(f.env.outgoingInvite===null,'Hung request never expired');
    resolve({data:{success:true}}); await first;assert(f.sends.length===0,'Expired registration sent stale invitation');
  });
  await test('duplicate invites reuse one dialog and replay final answer without joining twice',async()=>{
    const f=fixture();await f.env.handleIncomingInvite(f.packet()); const invite=f.env.incomingInvite;
    await f.env.handleIncomingInvite(f.packet());assert(f.env.incomingInvite===invite,'Duplicate replaced dialog');
    await f.env.answerChessInvite(true);await f.env.handleIncomingInvite(f.packet());
    assert(f.joins.length===1 && f.sends.at(-1).payload.reason==='accepted','Lost answer cannot replay safely');
  });
  await test('disabled invitations notify sender and never open a dialog',async()=>{
    const f=fixture();f.env.localStorage.getItem=()=> 'false';await f.env.handleIncomingInvite(f.packet());
    assert(f.env.incomingInvite===null && f.sends[0].payload.reason==='disabled','Disabled invite silent');
  });
  await test('turning invitations off answers and releases an existing dialog',async()=>{
    const f=fixture();await f.env.handleIncomingInvite(f.packet());await f.env.answerChessInvite(false,'disabled');
    assert(f.env.incomingInvite===null && f.sends.at(-1).payload.reason==='disabled','Pending invite not closed/notified');
  });
  await test('late validation cannot display an invitation on another account',async()=>{
    const f=fixture();let resolve;f.env.supabaseClient.functions.invoke=()=>new Promise(r=>{resolve=r;});
    const pending=f.env.handleIncomingInvite(f.packet());f.env.currentAuthUserId='other';
    resolve({data:{success:true,kind:'chess',hostUsername:'opponent'}});await pending;
    assert(f.env.incomingInvite===null&&f.sends.length===0,'Stale validation changed account');
  });
  await test('receipt is not acceptance; wrong senders and duplicate answers cannot start matches',async()=>{
    const f=fixture();await f.env.sendChessInvite('opponent');const invite=f.env.outgoingInvite;
    const answer=(from,reason)=>({payload:{id:invite.id,target:'me',from,reason,accepted:reason==='accepted'}});
    f.env.receiveAnswer(answer('outsider','accepted'));assert(f.joins.length===0,'Spoofed sender accepted');
    f.env.receiveAnswer(answer('opponent','received'));assert(f.env.outgoingInvite===invite&&invite.received&&f.joins.length===0,'Receipt started match');
    f.env.receiveAnswer(answer('opponent','accepted'));f.env.receiveAnswer(answer('opponent','accepted'));
    assert(f.joins.length===1&&f.env.outgoingInvite===null,'Duplicate answer joined twice');
  });
  return {passed:passed.length,tests:passed};
}
