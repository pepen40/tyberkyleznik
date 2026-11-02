import { assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';

Deno.test('login loads the caller profile through the authenticated Edge Function, not direct table access', async () => {
  const source = await Deno.readTextFile(new URL('../../../script.js', import.meta.url));
  const start = source.indexOf('async function finishAuthLogin(user)');
  const end = source.indexOf('\nasync function restoreAuthSession()', start);
  const login = source.slice(start, end);
  assert(login.includes("functions.invoke('award-coins'"));
  assert(login.includes("action: 'get_player_profile'"));
  assert(login.includes('profileResponse?.profile'));
  assert(!login.includes(".from('players')"));
});

Deno.test('profile Edge action derives identity from the validated JWT and returns an allowlisted projection', async () => {
  const source = await Deno.readTextFile(new URL('../award-coins/index.ts', import.meta.url));
  assert(source.includes('supabaseAdmin.auth.getUser(tokenMatch[1])'));
  assert(source.includes(".eq('user_id', authData.user.id).single()"));
  assert(source.includes("'get_player_profile'"));
  const start = source.indexOf("if (action === 'get_player_profile')");
  const end = source.indexOf('const cooldowns:', start);
  const profile = source.slice(start, end);
  assert(profile.includes('profile: {'));
  assert(profile.includes('username: player.username'));
  assert(profile.includes('rpg_upgrades: player.rpg_upgrades'));
  assert(!profile.includes('user_id:'));
  assert(!profile.includes('email:'));
});
