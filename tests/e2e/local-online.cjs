// Optional integration runner, NOT executed in the restricted audit environment.
// Requires a complete disposable local backend and two existing test users.
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const required = name => { const value = process.env[name]; if (!value) throw new Error('Missing ' + name); return value; };

async function run() {
  const closedTest = process.env.E2E_CLOSED_TEST === 'true';
  assert.equal(required('E2E_DISPOSABLE_LOCAL'), 'true', 'A disposable local project must be explicitly selected');
  const backend = new URL(required('SUPABASE_TEST_URL'));
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(backend.hostname), 'Only loopback backend URLs are allowed');
  assert(['http:', 'https:'].includes(backend.protocol) && !backend.username && !backend.password, 'Invalid local backend URL');
  const publicKey = required('SUPABASE_TEST_PUBLIC_KEY');
  if (!publicKey.startsWith('sb_publishable_')) {
    const claims = JSON.parse(Buffer.from(publicKey.split('.')[1] || '', 'base64url').toString());
    assert.equal(claims.role, 'anon', 'Only an anon or publishable key may enter the browser');
  }
  const users = [
    { u: required('E2E_USER_A'), p: required('E2E_PASS_A') },
    { u: required('E2E_USER_B'), p: required('E2E_PASS_B') },
  ];
  assert.notEqual(users[0].u, users[1].u, 'Two independent identities are required');
  // Service-role credentials are deliberately not read by this process.
  const { chromium } = require(path.join(root, '.runtime/e2e/node_modules/playwright'));
  const { server, frontend } = await require('./local-server.cjs').startLocalSite(backend, publicKey, { closedTest });
  let browser;
  const contexts = [];
  const pageErrors = [];
  const passed = [], skipped = [];
  const stage = text => console.log('SCENARIO: ' + text);
  const bounded = (promise, label) => new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Timed out: '+label)),60000);
    promise.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
  });
  try {
    browser = await chromium.launch({ headless: true, chromiumSandbox: true });
    const pages = [];
    for (const user of users) {
      stage('real tester login');
      const context = await browser.newContext(); contexts.push(context);
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        const local = url.origin === frontend || url.origin === backend.origin;
        const staticCdn = route.request().method() === 'GET' && ['cdn.jsdelivr.net', 'esm.sh'].includes(url.hostname);
        return local || staticCdn ? route.continue() : route.abort();
      });
      const page = await context.newPage(); pages.push(page);
      page.on('pageerror', error => pageErrors.push(String(error.stack || error.message)));
      page.on('dialog', dialog => dialog.dismiss());
      await page.goto(frontend, { waitUntil: 'domcontentloaded' });
      await page.evaluate(async credentials => {
        document.getElementById('username').value = credentials.u;
        document.getElementById('password').value = credentials.p;
        await login();
      }, user);
      const loginState=await page.evaluate(()=>({user:currentUser,hasAuth:!!currentAuthUserId,error:document.getElementById('auth-msg').textContent,inbox:rpgInvitationChannelStatus}));
      assert.equal(loginState.user,user.u,'Real login failed: '+JSON.stringify(loginState));
      await page.waitForFunction(name => currentUser === name && !!currentAuthUserId, user.u);
      assert(await page.evaluate(async () => {
        document.getElementById('rpg-invites-toggle').checked = true;
        document.getElementById('chess-invites-toggle').checked = true;
        return window.syncServerInviteSettings(true);
      }), 'Could not initialize local fixture invitation settings');
    }
    const [a, b] = pages;
    stage('closed-test authorization');
    if (closedTest) {
      const denied = await a.evaluate(async () => {
        const results=[];
        for (const action of ['pvp_result','rpg_win','score','chess_reward','claim_rpg_reward','open_case','buy_upgrade']) {
          const result=await supabaseClient.functions.invoke('award-coins',{body:{action,data:{win:true,coins:999999,kind:'daily',id:'spend500'}}});
          results.push(!result.error && result.data?.success===false && result.data?.rewardPaused===true);
        }
        return results.every(Boolean);
      });
      assert(denied,'Closed-test reward/economy path was open');
      const outsider = await browser.newContext(); contexts.push(outsider);
      const outsiderPage = await outsider.newPage();
      await outsiderPage.goto(frontend,{waitUntil:'domcontentloaded'});
      const rejected=await outsiderPage.evaluate(async credentials=>{
        const login=await supabaseClient.auth.signInWithPassword({email:usernameAuthEmail(credentials.u),password:credentials.p});
        if(login.error) throw Error('Outsider Auth fixture could not log in');
        const result=await supabaseClient.functions.invoke('award-coins',{body:{action:'get_player_profile',data:{}}});
        const pvp=await supabaseClient.functions.invoke('rpg-pvp',{body:{action:'get_match',data:{room_topic:'room_abc123xyz'}}});
        return result.error?.context?.status===403 && pvp.error?.context?.status===403;
      },{u:required('E2E_USER_OUT'),p:required('E2E_PASS_OUT')});
      assert(rejected,'An Auth account without a test invitation gained access');
      await outsider.close();contexts.pop();
      passed.push('server closed-test membership and all reward/economy gates');
    }
    stage('two-player presence');
    for (const page of pages) await page.waitForFunction(() => onlineChannel && Object.keys(onlineChannel.presenceState()).length >= 2);
    if (closedTest) {
      await a.locator('#site-global-chat-input').fill('closed-chat-<b>literal</b>');
      await a.locator('#site-global-chat-send').click();
      await b.waitForFunction(()=>document.getElementById('site-global-chat-messages').textContent.includes('closed-chat-<b>literal</b>'));
      assert.equal(await b.locator('#site-global-chat-messages b').count(),0,'Chat interpreted user HTML');
      passed.push('authenticated global chat with literal user content');
    }
    const openChessPlayers = async page => {
      await page.evaluate(() => switchTab('chess'));
      await page.locator('#chess-multiplayer-open').click();
    };
    stage('chess invitation and acceptance');
    await openChessPlayers(a);
    await a.locator('#chess-online-players .pvp-room-item').filter({ hasText: users[1].u }).getByRole('button').click();
    await b.locator('#chess-invite-modal').waitFor({ state: 'visible' });
    const hostSpoofDenied = await a.evaluate(async () => {
      const result = await supabaseClient.functions.invoke('award-coins', { body: { action: 'game_invitation', data: { op: 'list' } } });
      const invite = result.data?.invitations?.find(row => row.kind === 'chess' && ['pending','received'].includes(row.status));
      if (!invite) throw new Error('Missing canonical pending invitation');
      const forged = await supabaseClient.functions.invoke('award-coins', { body: { action: 'game_invitation', data: { op: 'reply', topic: invite.topic, value: 'accepted', user_id: invite.invitee_id } } });
      // A network/Auth failure is not evidence of invitation authorization.
      if (forged.error?.context?.status !== 400) return false;
      const rejection = await forged.error.context.json();
      return rejection.success === false && rejection.error === 'Приглашение недоступно или действие запрещено.';
    });
    assert(hostSpoofDenied, 'Host forged guest acceptance');
    await b.locator('#chess-invite-accept').click();
    for (const page of pages) await page.waitForFunction(() => window.onlineChessDelivery?.canPlay());
    stage('chess moves and reconnect');
    const move = async (page, from, to) => { await page.locator('#chess-board [aria-label="' + from + '"]').click(); await page.locator('#chess-board [aria-label="' + to + '"]').click(); };
    const waitHistory = (page, length) => page.waitForFunction(n => window.getOnlineChessHistory?.().length === n, length, { timeout: 30000 });
    await move(a, 'e2', 'e4'); await waitHistory(b, 1);
    await move(b, 'e7', 'e5'); await waitHistory(a, 2);
    await a.waitForFunction(() => window.onlineChessDelivery?.canPlay());
    await contexts[1].setOffline(true);
    await b.evaluate(() => supabaseClient.realtime.disconnect());
    await move(a, 'g1', 'f3');
    await contexts[1].setOffline(false);
    await b.evaluate(() => supabaseClient.realtime.connect());
    await waitHistory(b, 3);
    assert.deepEqual(await a.evaluate(() => window.getOnlineChessHistory()), await b.evaluate(() => window.getOnlineChessHistory()));
    passed.push('two-user chess moves, forged acceptance denial and reconnect recovery');
    stage('chess chat, resignation and blocking');
    await a.waitForFunction(() => window.onlineChessDelivery?.canPlay());
    await a.locator('#chess-chat-input').fill('isolated-e2e-chat');
    await a.locator('#chess-chat-send').click();
    await b.waitForFunction(() => document.getElementById('chess-chat-messages').textContent.includes('isolated-e2e-chat'));
    assert.equal(await b.evaluate(() => document.getElementById('chess-chat-messages').textContent.split('isolated-e2e-chat').length - 1), 1);
    await b.locator('#chess-resign').click();
    await a.waitForFunction(() => document.getElementById('chess-engine-status').textContent === 'ПАРТИЯ ЗАВЕРШЕНА');
    passed.push('chat receipt and remote resignation');
    for (const page of pages) await page.locator('#chess-new').click();
    assert(await b.evaluate(async () => { document.getElementById('chess-invites-toggle').checked = false; return window.syncServerInviteSettings(true); }));
    await openChessPlayers(a);
    await a.locator('#chess-online-players .pvp-room-item').filter({ hasText: users[1].u }).getByRole('button').click();
    await a.waitForFunction(() => document.getElementById('chess-outgoing-status').textContent.includes('отключил'));
    assert(await b.locator('#chess-invite-modal').isHidden());
    passed.push('server-blocked chess invitation');
    for (const tab of ['minigames','game','settings','inventory',...(closedTest?[]:['market']),'leaderboard','howto']) {
      await a.evaluate(name => switchTab(name), tab);
      assert(await a.locator('#tab-' + tab).isVisible(), 'Main tab is not visible: ' + tab);
    }
    await a.evaluate(() => switchTab('settings'));
    const fpsBefore = await a.locator('#fps-overlay-toggle').isChecked();
    await a.locator('#fps-overlay-toggle').setChecked(false);
    assert(await a.evaluate(() => document.getElementById('performance-overlay').hidden));
    await a.locator('#fps-overlay-toggle').setChecked(fpsBefore);
    passed.push('main tabs and FPS setting smoke');
    stage('RPG battle and invitation');
    if (closedTest) {
      // Play a real PvE fight; hold its actual denied reward response across a
      // character switch. No HP, random roll, result or server clock is mocked.
      let capturedResolve, releaseResponse;
      const captured=new Promise(resolve=>{capturedResolve=resolve;});
      const release=new Promise(resolve=>{releaseResponse=resolve;});
      let held=false;
      const hold=async route=>{
        if(route.request().postDataJSON()?.action!=='rpg_win' || held)return route.continue();
        held=true;const response=await route.fetch();capturedResolve();await release;await route.fulfill({response});
      };
      await a.route('**/functions/v1/award-coins',hold);
      await a.evaluate(()=>{window.__testOriginalWin=winRpg;winRpg=function(){return window.__testWinPromise=window.__testOriginalWin();};switchTab('rpg');selectChar('ashab');});
      for(let turn=0;turn<20;turn++) {
        await a.waitForFunction(()=>isPlayerTurn || rpgEnemy.hp<=0 || rpgChar.hp<=0);
        const state=await a.evaluate(()=>({won:rpgEnemy.hp<=0,dead:rpgChar.hp<=0}));
        assert(!state.dead,'The real PvE fixture lost; investigate the encounter instead of forging a win');
        if(state.won)break;
        await a.evaluate(()=>rpgAttack());
      }
      await bounded(captured,'real PvE victory request');
      await a.evaluate(()=>selectChar('mee'));
      releaseResponse();await a.evaluate(async()=>{await window.__testWinPromise;winRpg=window.__testOriginalWin;});
      assert(await a.evaluate(()=>currentCharType==='mee' && rpgFloorMain===1 && rpgFloorSub===1),'Old victory changed the replacement character');
      await a.unroute('**/functions/v1/award-coins',hold);
      passed.push('real PvE fight and stale victory response rejected after character switch');
      await a.evaluate(name=>challengePlayer(name),users[1].u);
      await a.locator('#pvp-challenge-modal button[onclick="executeChallenge()"]') .click();
      await b.locator('#pvp-receive-modal').waitFor({state:'visible'});
      await b.locator('#pvp-receive-char-select').selectOption('apostol');
      await b.locator('#pvp-receive-modal button[onclick="executeAcceptChallenge()"]') .click();
    } else {
      await a.evaluate(() => createPvpRoom());
      await a.waitForFunction(() => !!myRoomId && !!pvpMatchId);
      const room = await a.evaluate(() => myRoomId);
      assert(await b.evaluate(topic => joinPvpRoom(topic, 'apostol'), room));
    }
    await a.waitForFunction(() => pvpBattleStarted && pvpGameState.isMyTurn);
    await b.waitForFunction(()=>pvpBattleStarted);
    if(closedTest) {
      assert.equal(await a.evaluate(()=>myRoomId),await b.evaluate(()=>myRoomId));
      assert.equal(await a.evaluate(()=>pvpMatchId),await b.evaluate(()=>pvpMatchId));
      assert(await a.locator('#rpg-battle-screen').isHidden(),'Offline battle remains visible during PvP');
      passed.push('RPG invitation and acceptance join the same authoritative match');
    }
    const balances = () => Promise.all(pages.map(page => page.evaluate(async () => {
      const result = await supabaseClient.functions.invoke('award-coins', { body: { action: 'get_player_profile', data: {} } });
      if (result.error || !result.data?.success) throw new Error('Cannot read fixture server balances');
      return { coins: result.data.profile.coins, rating: result.data.profile.pvp_pts };
    })));
    const beforeBalances = await balances();
    stage('authoritative PvP action replay');
    const requestPromise = a.waitForRequest(request => request.url().endsWith('/functions/v1/rpg-pvp') && request.postDataJSON()?.action === 'submit_action');
    await a.evaluate(() => pvpAttack());
    const afterActionVersion = await a.evaluate(() => pvpMatchVersion);
    const command = (await requestPromise).postDataJSON();
    const duplicate = await a.evaluate(async body => { const result = await supabaseClient.functions.invoke('rpg-pvp', { body }); return result.data; }, command);
    assert.equal(duplicate?.duplicate, true);
    assert.equal(Number(duplicate.version), afterActionVersion, 'Replay changed the action version');
    assert.deepEqual(await balances(), beforeBalances, 'Unverified PvP reward was enabled');
    passed.push('two-user RPG PvP action replay and unchanged currency');
    if(closedTest) {
      const observer=await browser.newContext();contexts.push(observer);
      const page=await observer.newPage();await page.goto(frontend,{waitUntil:'domcontentloaded'});
      const room=await a.evaluate(()=>myRoomId);
      assert(await page.evaluate(async fixture=>{
        const auth=await supabaseClient.auth.signInWithPassword({email:usernameAuthEmail(fixture.user),password:fixture.password});
        if(auth.error)throw Error('Observer fixture login failed');
        const match=await supabaseClient.functions.invoke('rpg-pvp',{body:{action:'get_match',data:{room_topic:fixture.room,user_id:fixture.host}}});
        const inbox=await supabaseClient.functions.invoke('award-coins',{body:{action:'game_invitation',data:{op:'read',topic:fixture.room,user_id:fixture.host}}});
        return match.error?.context?.status===403 && inbox.error?.context?.status===400;
      },{user:required('E2E_USER_OBSERVER'),password:required('E2E_PASS_OBSERVER'),room,host:await a.evaluate(()=>currentAuthUserId)}),'Unrelated allowed tester read another match/invitation');
      await observer.close();contexts.pop();
      const refresh=await a.evaluate(async()=>!(await supabaseClient.auth.refreshSession()).error);assert(refresh,'Real session refresh failed');
      passed.push('allowed outsider cannot impersonate a participant; real Auth refresh succeeds');
      // Actual account switch while a get_match response is in flight. The old
      // document/request must not populate the new account's room or inventory.
      let caughtResolve, releaseOld;
      const caught=new Promise(resolve=>{caughtResolve=resolve;});
      const released=new Promise(resolve=>{releaseOld=resolve;});let delayed=false;
      const delay=async route=>{if(route.request().postDataJSON()?.action!=='get_match'||delayed)return route.continue();delayed=true;const response=await route.fetch();caughtResolve();await released;try{await route.fulfill({response});}catch(_){}};
      await b.route('**/functions/v1/rpg-pvp',delay);
      await b.evaluate(()=>{void syncPvpMatch();});await bounded(caught,'in-flight match response');
      await b.evaluate(async()=>{await supabaseClient.auth.signOut();});
      await b.reload({waitUntil:'domcontentloaded'});
      await b.evaluate(async credentials=>{document.getElementById('username').value=credentials.user;document.getElementById('password').value=credentials.password;await login();},{user:required('E2E_USER_OBSERVER'),password:required('E2E_PASS_OBSERVER')});
      await b.waitForFunction(name=>currentUser===name,required('E2E_USER_OBSERVER'));
      releaseOld();await b.unroute('**/functions/v1/rpg-pvp',delay);
      assert(await b.evaluate(()=>myRoomId===null && pvpMatchId===null),'Stale match populated the new account');
      passed.push('account switch discards an in-flight previous-session match response');
    }
    if (process.env.E2E_RUN_REAL_TIMEOUT === 'true') {
      stage('real three-minute server timeout');
      assert(await a.evaluate(() => pvpBattleStarted && !pvpBattleFinished), 'Timeout fixture must survive the first attack');
      await a.waitForFunction(() => document.getElementById('pvp-log').textContent.includes('Сервер подтвердил победу'), null, { timeout: 205000 });
      passed.push('real three-minute PvP timeout');
    } else skipped.push('real timeout (set E2E_RUN_REAL_TIMEOUT=true)');
    assert.equal(pageErrors.length, 0, 'Browser page errors: ' + pageErrors.join('; '));
    return { passed, skipped, productionTouched: false };
  } finally {
    await Promise.allSettled(contexts.map(context => context.close()));
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    // Test users/data are intentionally retained in the disposable project.
  }
}

run().then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
  let message = String(error.stack || error.message || error);
  for (const name of Object.keys(process.env).filter(name=>name.startsWith('E2E_PASS_') || name==='SUPABASE_TEST_PUBLIC_KEY')) {
    if (process.env[name]) message = message.split(process.env[name]).join('[redacted]');
  }
  message = message.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted JWT]');
  console.error('Local E2E failed: ' + message);
  process.exitCode = 1;
});
