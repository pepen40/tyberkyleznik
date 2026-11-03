'use strict';
// DOM smoke only: no Auth identity, database, rewards or mocked online success.
const path = require('node:path'), assert = require('node:assert/strict');
const { startLocalSite } = require('./local-server.cjs');
async function run() {
  const { chromium } = require(path.resolve(__dirname, '../../.runtime/e2e/node_modules/playwright'));
  const { server, frontend } = await startLocalSite(new URL('http://127.0.0.1:9'), 'sb_publishable_isolated_smoke');
  let browser;
  const contexts = [], errors = [], productionAttempts = [], passed = [];
  try {
    browser = await chromium.launch({ headless: true, chromiumSandbox: true });
    for (const viewport of [{width:1366,height:900}, {width:390,height:844}]) {
      const context = await browser.newContext({ viewport }); contexts.push(context);
      await context.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (url.hostname.endsWith('.supabase.co')) productionAttempts.push(url.hostname);
        const local = url.origin === frontend;
        const cdnScript = request.method() === 'GET' && request.resourceType() === 'script' && ['cdn.jsdelivr.net','esm.sh'].includes(url.hostname);
        return local || cdnScript ? route.continue() : route.abort();
      });
      await context.routeWebSocket('**/*', socket => socket.close());
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.stack || error.message));
      page.on('dialog', dialog => dialog.dismiss());
      await page.goto(frontend, {waitUntil:'load'});
      assert(await page.locator('#auth-screen').isVisible(), 'Login screen missing');
      assert(await page.evaluate(() => currentAuthUserId === null), 'Smoke acquired an Auth identity');
      // Expose the existing UI solely for DOM smoke; no login/profile is fabricated.
      await page.evaluate(() => {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-screen').classList.remove('hidden');
      });
      for (const tab of ['minigames','game','chess','rpg','cases','inventory','market','leaderboard','howto','settings']) {
        await page.evaluate(name => switchTab(name), tab);
        assert(await page.locator('#tab-' + tab).isVisible(), 'Invisible tab: ' + tab);
      }
      await page.locator('#site-background-select').selectOption('black');
      await page.locator('#fps-overlay-toggle').setChecked(false);
      assert(await page.evaluate(() => document.getElementById('performance-overlay').hidden));
      await page.reload({waitUntil:'load'});
      assert(await page.evaluate(() => localStorage.getItem('pepen-site-background') === 'black' && document.getElementById('performance-overlay').hidden), 'Preferences did not survive reload');
      await page.evaluate(() => {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-screen').classList.remove('hidden');
        switchTab('chess');
      });
      assert.equal(await page.locator('#chess-bot-grid .chess-bot-card').count(), 5);
      await page.locator('#chess-color').selectOption('b');
      assert.equal(await page.locator('#chess-color').inputValue(), 'b');
      await page.evaluate(() => switchTab('game'));
      await page.locator('#status').click();
      await page.waitForFunction(() => gameStarted && simonTimers.size > 0);
      await page.evaluate(() => switchTab('settings'));
      assert(await page.evaluate(() => !gameStarted && simonTimers.size === 0), 'Simon timers survived tab exit');
      passed.push({viewport, checks:['tabs','persisted background/FPS','five chess levels and color control','Simon start/tab cancellation']});
    }
    assert.equal(await contexts[1].pages()[0].evaluate(() => currentAuthUserId), null);
    // Independent localStorage must not cross browser contexts.
    await contexts[0].pages()[0].evaluate(() => localStorage.setItem('smoke-context-only','A'));
    assert.equal(await contexts[1].pages()[0].evaluate(() => localStorage.getItem('smoke-context-only')), null);
    assert.deepEqual(productionAttempts, [], 'Application attempted a production backend request');
    assert.deepEqual(errors, [], 'Browser page errors');
    return {status:'PASSED',scope:'DOM smoke only',passed,onlineE2E:'BLOCKED by historical baseline and missing full-schema fixtures'};
  } finally {
    await Promise.allSettled(contexts.map(context => context.close()));
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
run().then(result => console.log(JSON.stringify(result,null,2))).catch(error => { console.error(error.message); process.exitCode = 1; });
