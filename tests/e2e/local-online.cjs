// Optional integration runner, NOT executed in the restricted audit environment.
// Requires a complete disposable local backend and two existing test users.
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const required = name => { const value = process.env[name]; if (!value) throw new Error('Missing ' + name); return value; };

async function run() {
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
  const { server, frontend } = await require('./local-server.cjs').startLocalSite(backend, publicKey);
  let browser;
  const contexts = [];
  const pageErrors = [];
  const passed = [], skipped = [];
  try {
    browser = await chromium.launch({ headless: true, chromiumSandbox: true });
    const pages = [];
    for (const user of users) {
      const context = await browser.newContext(); contexts.push(context);
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        const local = url.origin === frontend || url.origin === backend.origin;
        const staticCdn = route.request().method() === 'GET' && ['cdn.jsdelivr.net', 'esm.sh'].includes(url.hostname);
        return local || staticCdn ? route.continue() : route.abort();
      });
      const page = await context.newPage(); pages.push(page);
      page.on('pageerror', error => pageErrors.push(String(error.message)));
      page.on('dialog', dialog => dialog.dismiss());
      await page.goto(frontend, { waitUntil: 'domcontentloaded' });
      await page.evaluate(async credentials => {
        document.getElementById('username').value = credentials.u;
        document.getElementById('password').value = credentials.p;
        await login();
      }, user);
      await page.waitForFunction(name => currentUser === name && !!currentAuthUserId, user.u);
      assert(await page.evaluate(async () => {
        document.getElementById('rpg-invites-toggle').checked = true;
        document.getElementById('chess-invites-toggle').checked = true;
        return window.syncServerInviteSettings(true);
      }), 'Could not initialize local fixture invitation settings');
    }
    const [a, b] = pages;
    const openChessPlayers = async page => {
      await page.evaluate(() => switchTab('chess'));
      await page.locator('#chess-multiplayer-open').click();
    };
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
    for (const tab of ['minigames','game','settings','inventory','market','leaderboard','howto']) {
      await a.evaluate(name => switchTab(name), tab);
      assert(await a.locator('#tab-' + tab).isVisible(), 'Main tab is not visible: ' + tab);
    }
    await a.evaluate(() => switchTab('settings'));
    const fpsBefore = await a.locator('#fps-overlay-toggle').isChecked();
    await a.locator('#fps-overlay-toggle').setChecked(false);
    assert(await a.evaluate(() => document.getElementById('performance-overlay').hidden));
    await a.locator('#fps-overlay-toggle').setChecked(fpsBefore);
    passed.push('main tabs and FPS setting smoke');
    await a.evaluate(() => createPvpRoom());
    await a.waitForFunction(() => !!myRoomId && !!pvpMatchId);
    const room = await a.evaluate(() => myRoomId);
    assert(await b.evaluate(topic => joinPvpRoom(topic, 'apostol'), room));
    await a.waitForFunction(() => pvpBattleStarted && pvpGameState.isMyTurn);
    const balances = () => Promise.all(pages.map(page => page.evaluate(async () => {
      const result = await supabaseClient.functions.invoke('award-coins', { body: { action: 'get_player_profile', data: {} } });
      if (result.error || !result.data?.success) throw new Error('Cannot read fixture server balances');
      return { coins: result.data.profile.coins, rating: result.data.profile.pvp_pts };
    })));
    const beforeBalances = await balances();
    const requestPromise = a.waitForRequest(request => request.url().endsWith('/functions/v1/rpg-pvp') && request.postDataJSON()?.action === 'submit_action');
    await a.evaluate(() => pvpAttack());
    const afterActionVersion = await a.evaluate(() => pvpMatchVersion);
    const command = (await requestPromise).postDataJSON();
    const duplicate = await a.evaluate(async body => { const result = await supabaseClient.functions.invoke('rpg-pvp', { body }); return result.data; }, command);
    assert.equal(duplicate?.duplicate, true);
    assert.equal(Number(duplicate.version), afterActionVersion, 'Replay changed the action version');
    assert.deepEqual(await balances(), beforeBalances, 'Unverified PvP reward was enabled');
    passed.push('two-user RPG PvP action replay and unchanged currency');
    if (process.env.E2E_RUN_REAL_TIMEOUT === 'true') {
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
  let message = String(error.message || error);
  for (const name of ['E2E_PASS_A','E2E_PASS_B','SUPABASE_TEST_PUBLIC_KEY']) {
    if (process.env[name]) message = message.split(process.env[name]).join('[redacted]');
  }
  message = message.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted JWT]');
  console.error('Local E2E failed: ' + message);
  process.exitCode = 1;
});
