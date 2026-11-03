import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

Deno.test('submit_action uses a single atomic RPC for expiry and exact retries', async () => {
  const source = await Deno.readTextFile(new URL('../rpg-pvp/index.ts', import.meta.url));
  const start = source.indexOf("} else if (action === 'submit_action') {");
  const end = source.indexOf("} else if (action === 'get_match')", start);
  if (start < 0 || end < 0) throw new Error('Missing submit_action boundary');
  const body = source.slice(start + "} else if (action === 'submit_action') {".length, end);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const submit = new AsyncFunction('admin', 'data', 'userId', 'json', 'let result;\n' + body + '\nreturn result;');
  const data = { room_topic: 'room_route0001', action_id: '20000000-0000-4000-8000-000000000001', expected_version: 1, action_kind: 'defend' };
  for (const expected of [
    { success: true, duplicate: true, version: 2 },
    { success: true, timed_out: true, status: 'completed', winner_side: 'guest', version: 2 },
  ]) {
    const calls: string[] = [];
    const admin = { rpc: async (name: string) => {
      calls.push(name);
      return { data: expected, error: null };
    } };
    const actual = await submit(admin, data, 'user-id', () => { throw new Error('Unexpected validation rejection'); });
    assertEquals(calls, ['apply_rpg_pvp_action']);
    assertEquals(actual, expected);
  }
});
