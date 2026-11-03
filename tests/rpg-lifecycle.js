// Execute real game functions with deferred RPC/timer fixtures; no live API calls.
async function runRpgLifecycleTests(source) {
  const passed = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const cut = (start, end) => {
    const from = source.indexOf(start), to = source.indexOf(end, from);
    if (from < 0 || to < 0) throw new Error('Missing game function boundary');
    return source.slice(from, to).trim();
  };
  function fixture() {
    let resolve, reject;
    const request = new Promise((ok, fail) => { resolve = ok; reject = fail; });
    const noop = () => {};
    const env = {
      rpgChar: { hp: 20, maxHp: 100 }, rpgEnemy: { hp: 50, maxHp: 100 },
      currentAuthUserId: 'user-a', currentUser: 'a', currentCharType: 'ashab',
      rpgFloorMain: 1, rpgFloorSub: 1, rpgMana: 0, rpgMaxMana: 100,
      currentCoins: 0, currentUpgrades: {}, currentMaxFloors: {},
      currentInventory: [{ id: 'item-a', name: 'хуйня' }], currentItemPoints: 1,
      isPlayerTurn: true, rpgBonusAttacks: 0, rpgItemUsed: false, enemyTurnTimeout: null,
      rpgEnemyParashnikHp: 0,
      EDGE_FUNCTION_NAME: 'award-coins', logs: [], timers: [], updates: 0, spawns: 0,
      supabaseClient: { functions: { invoke: () => request } },
      ensureRpgGear: () => ({ equipped: { ashab: {} } }),
      updateUI: () => env.updates++, addLog: text => env.logs.push(text),
      setTimeout: fn => { env.timers.push(fn); return env.timers.length; },
      spawnEnemy: () => env.spawns++, changeBackground: noop, checkButtons: noop,
      setTurnIndicator: noop, playSoundEffect: noop, animateItemUse: noop,
      closeItemMenu: noop, updateRpgUI: noop,
      percentOf: (value, percent) => Math.round(value * percent / 100),
    };
    const bind = text => new Function('env', 'with (env) { return (' + text + '); }')(env);
    env.captureRpgBattle = bind(cut('function captureRpgBattle()', 'async function winRpg()'));
    env.winRpg = bind(cut('async function winRpg()', '// === CS:GO-STYLE'));
    env.useItemInBattle = bind(cut('async function useItemInBattle(', 'function animateItemUse('));
    return { env, resolve, reject };
  }
  async function test(name, fn) { await fn(); passed.push(name); }
  await test('late win after flee does not advance floors or schedule enemies', async () => {
    const f = fixture(), result = f.env.winRpg();
    f.env.rpgChar = null; f.env.rpgEnemy = null;
    f.resolve({ data: { rewardPaused: true } }); await result;
    assert(f.env.rpgFloorSub === 1 && f.env.timers.length === 0 && f.env.logs.length === 0, 'Old win changed escaped battle');
  });
  await test('old win cannot apply profile rewards to another account', async () => {
    const f = fixture(), result = f.env.winRpg(); f.env.currentAuthUserId = 'user-b';
    f.resolve({ data: { success: true, newCoins: 500 } }); await result;
    assert(f.env.currentCoins === 0 && f.env.rpgFloorSub === 1, 'Old reward changed current account');
  });
  await test('current win advances locally with paused rewards and guards next-enemy timer', async () => {
    const f = fixture(), result = f.env.winRpg();
    f.resolve({ data: { rewardPaused: true } }); await result;
    assert(f.env.rpgFloorSub === 2 && f.env.rpgMana === 30 && f.env.timers.length === 1, 'Normal progression broken');
    f.env.rpgChar = { hp: 1, maxHp: 100 }; f.env.timers[0]();
    assert(f.env.spawns === 0, 'Old floor timer spawned into new battle');
  });
  await test('consumed inventory is reconciled after exit without applying battle effect', async () => {
    const f = fixture(), result = f.env.useItemInBattle('хуйня');
    f.env.rpgChar = null;
    f.resolve({ data: { success: true, newInventory: [], newItemPoints: 0 } }); await result;
    assert(f.env.currentInventory.length === 0 && f.env.timers.length === 0, 'Inventory not reconciled or stale effect scheduled');
  });
  await test('late item response cannot overwrite another account inventory', async () => {
    const f = fixture(), result = f.env.useItemInBattle('хуйня');
    f.env.currentAuthUserId = 'user-b';
    f.resolve({ data: { success: true, newInventory: [], newItemPoints: 0 } }); await result;
    assert(f.env.currentInventory.length === 1 && f.env.timers.length === 0, 'Another account inventory overwritten');
  });
  await test('delayed item animation cannot heal a replacement fighter', async () => {
    const f = fixture(), result = f.env.useItemInBattle('хуйня');
    f.resolve({ data: { success: true, newInventory: [], newItemPoints: 0 } }); await result;
    assert(f.env.timers.length === 1, 'Current item animation not scheduled');
    f.env.rpgChar = { hp: 1, maxHp: 100 }; f.env.timers[0]();
    assert(f.env.rpgChar.hp === 1, 'Old item healed replacement fighter');
  });
  await test('confirmed item still heals the current fighter and restores its turn', async () => {
    const f = fixture(), result = f.env.useItemInBattle('хуйня');
    f.resolve({ data: { success: true, newInventory: [], newItemPoints: 0 } }); await result;
    f.env.timers[0]();
    assert(f.env.rpgChar.hp === 35 && f.env.isPlayerTurn === true, 'Current fighter item effect broken');
  });
  await test('late item failure does not unlock a new battle turn', async () => {
    const f = fixture(), result = f.env.useItemInBattle('хуйня');
    f.env.rpgChar = { hp: 10, maxHp: 100 }; f.env.isPlayerTurn = false;
    f.reject(new Error('offline')); await result;
    assert(f.env.isPlayerTurn === false && f.env.logs.length === 0, 'Old error changed new battle');
  });
  return { passed: passed.length, tests: passed };
}
