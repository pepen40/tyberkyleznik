function runGameTimerTests(source, reportFailures = false) {
  const passed=[],failures=[],assert=(v,m)=>{if(!v)throw new Error(m);};
  const cut=(a,b)=>{const i=source.indexOf(a),j=source.indexOf(b,i);if(i<0||j<0)throw new Error('Missing timer boundary '+a);return source.slice(i,j).trim();};
  function fixture(){
    const timers=[], nodes=new Map();
    const noop=()=>{};
    const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:id==='rpg-char-select',textContent:'',style:{},pause:noop,classList:{add(){nodes.get(id).hidden=true;},remove(){nodes.get(id).hidden=false;}}});return nodes.get(id);};
    const env={currentAuthUserId:'account',rpgChar:{hp:1,maxHp:100},rpgEnemy:{hp:100,maxHp:100,atk:50,name:'enemy'},rpgFloorMain:1,
      rpgEnemyStunned:false,rpgPlayerBorisHp:0,rpgPlayerParashnikHp:0,rpgPlayerDefending:false,enemyIsCharging:false,currentCharType:'ashab',
      getGearBonuses:()=>({defense:0}),Math:Object.assign(Object.create(Math),{random:()=>0.99}),
      setTurnIndicator:noop,animateAttack:noop,triggerScreenShake:noop,flashRedScreen:noop,playSoundEffect:noop,
      addLog:noop,updateRpgUI:noop,checkButtons:noop,renderCharStats:noop,updateUI:noop,isPlayerTurn:false,
      document:{getElementById:node},setTimeout:(fn,delay)=>{timers.push({fn,delay});return timers.length;},clearTimeout:noop,clearInterval:noop,
      pvpBattleFinished:false,pvpSyncTimer:null,myRoomId:'old-room',pvpMatchId:'old-match',disablePvpButtons:noop,logPvp:noop,leaves:0,
      leavePvpRoom:()=>env.leaves++,
      simonGeneration:0,simonTimers:new Set(),gameSequence:['1'],playerSequence:[],level:1,maxPads:1,
      gameStarted:true,canClick:false,isPlayingSequence:false,pads:[],restartBtn:node('restart'),statusText:node('status'),updateActivePads:noop,sounds:0,playSound:()=>env.sounds++,
      onlineChessMode:false,engineBusy:false,ended:false,humanColor:'w',setStatus:noop,
    };
    env.window={setTimeout:env.setTimeout};
    const bind=text=>new Function('env','with(env){return ('+text+');}')(env);
    env.captureRpgBattle=bind(cut('function captureRpgBattle()', 'async function winRpg()'));
    if(source.includes('function scheduleRpgBattle('))env.scheduleRpgBattle=bind(cut('function scheduleRpgBattle(', 'function captureRpgBattle()'));
    if(source.includes('function cancelSimonGame(')){
      env.cancelSimonGame=bind(cut('function cancelSimonGame(', 'function scheduleSimon('));
      env.scheduleSimon=bind(cut('function scheduleSimon(', 'function playSound('));
    }
    return{env,timers,node,bind};
  }
  function test(name,fn){try {fn();passed.push(name);}catch(error){if(!reportFailures)throw error;failures.push({name,error:error.message});}}
  test('old RPG death timer cannot close a replacement battle',()=>{
    const f=fixture();
    f.bind(cut('function enemyTurn(', source.includes('function scheduleRpgBattle(')?'function scheduleRpgBattle(':'function captureRpgBattle()'))();
    const callback=f.timers.find(timer=>timer.delay===3000);assert(callback,'No death fixture callback');
    f.env.rpgChar={hp:100,maxHp:100};f.env.rpgEnemy={hp:100};callback.fn();
    assert(!f.node('rpg-battle-screen').hidden,'Old death callback closed replacement battle');
  });
  test('old PvP completion timer cannot leave a replacement room',()=>{
    const f=fixture();f.bind(cut('function finishPvpFromServer(', 'async function endPvpBattle('))(true,'completed');
    f.env.myRoomId='new-room';f.env.pvpMatchId='new-match';f.env.pvpBattleFinished=false;
    f.timers[0].fn();assert(f.env.leaves===0,'Old PvP timer left new room');
  });
  test('reset Simon invalidates already queued sequence callbacks',()=>{
    const f=fixture();f.bind(cut('function playSequence(', 'async function handlePadClick('))();
    const callbacks=f.timers.map(t=>t.fn);f.bind(cut('function resetGame(', 'function startSimonGame('))();
    callbacks.forEach(fn=>fn());assert(f.env.sounds===0,'Reset Simon played stale sequence');
  });
  test('same-FEN replacement chess game cannot receive an old bot callback',()=>{
    const f=fixture();let moves=0;
    f.env.game={fen:()=> 'same-fen',turn:()=> 'b'};
    f.bind(cut('function askEngineMove(', 'function capturePieceForAnimation('))();
    f.env.game={fen:()=> 'same-fen',turn:()=> 'b',moves:()=>{moves++;return[];}};
    f.timers[0].fn();assert(moves===0,'Old bot timer acted on new same-FEN game');
  });
  return{passed:passed.length,tests:passed,failures};
}
