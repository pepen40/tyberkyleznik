import { assert, assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { deliverRpgInvitation, respondToRpgInvitation, type RpgInvitationDependencies } from './rpg-invitations.ts';

const hostId = '11111111-1111-4111-8111-111111111111';
const guestId = '22222222-2222-4222-8222-222222222222';
const roomId = 'room_abc123xyz';

function fakeDependencies(overrides: Partial<RpgInvitationDependencies> = {}) {
  const sent: Array<{ topic: string; event: string; payload: Record<string, unknown> }> = [];
  const joins: Array<{ userId: string; roomId: string }> = [];
  const closes: Array<{ userId: string; roomId: string; role: 'host' | 'invitee' }> = [];
  const deps: RpgInvitationDependencies = {
    getPeer: async (userId, _roomId, role) => ({
      success: true,
      peerUserId: role === 'host' ? guestId : hostId,
      peerUsername: role === 'host' ? 'Guest' : 'Host',
    }),
    joinRoom: async (userId, id) => { joins.push({ userId, roomId: id }); return true; },
    closeInvitation: async (userId, id, role) => { closes.push({ userId, roomId: id, role }); return true; },
    broadcast: async (topic, event, payload) => { sent.push({ topic, event, payload }); },
    ...overrides,
  };
  return { deps, sent, joins, closes };
}

Deno.test('delivery targets only the invitee private inbox and preserves the registered room id', async () => {
  const { deps, sent } = fakeDependencies();
  await deliverRpgInvitation(hostId, roomId, 'Host', deps);
  assertEquals(sent.length, 1);
  assertEquals(sent[0].topic, `rpg-invitations:${guestId}`);
  assertEquals(sent[0].event, 'challenge');
  assertEquals(sent[0].payload.roomId, roomId);
  assertEquals(sent[0].payload.targetUserId, guestId);
});

Deno.test('unregistered, expired, or unrelated room cannot be delivered', async () => {
  const { sent, deps } = fakeDependencies({ getPeer: async () => ({ success: false, error: 'unavailable' }) });
  await assertRejects(() => deliverRpgInvitation(hostId, roomId, 'Host', deps));
  await assertRejects(() => deliverRpgInvitation(hostId, 'room_bad', 'Host', deps));
  assertEquals(sent.length, 0);
});

Deno.test('received acknowledgement is addressed to the authenticated host inbox', async () => {
  const { deps, sent, joins } = fakeDependencies();
  await respondToRpgInvitation(guestId, 'Guest', roomId, 'received', deps);
  assertEquals(sent[0].topic, `rpg-invitations:${hostId}`);
  assertEquals(sent[0].event, 'challenge_response');
  assertEquals(sent[0].payload.roomId, roomId);
  assertEquals(sent[0].payload.fromUserId, guestId);
  assertEquals(sent[0].payload.status, 'received');
  assertEquals(joins.length, 0);
});

Deno.test('acceptance joins the same room before acknowledging it', async () => {
  const { deps, sent, joins } = fakeDependencies();
  await respondToRpgInvitation(guestId, 'Guest', roomId, 'accepted', deps);
  assertEquals(joins, [{ userId: guestId, roomId }]);
  assertEquals(sent[0].payload.roomId, joins[0].roomId);
  assertEquals(sent[0].payload.status, 'accepted');
});

Deno.test('decline, disabled and busy are distinct authenticated responses', async () => {
  for (const status of ['declined', 'disabled', 'busy']) {
    const { deps, sent, joins, closes } = fakeDependencies();
    await respondToRpgInvitation(guestId, 'Guest', roomId, status, deps);
    assertEquals(sent[0].payload.status, status);
    assertEquals(joins.length, 0);
    assertEquals(closes, [{ userId: guestId, roomId, role: 'invitee' }]);
  }
});

Deno.test('failed acceptance and failed realtime send are reported, not acknowledged', async () => {
  const deniedJoin = fakeDependencies({ joinRoom: async () => false });
  await assertRejects(() => respondToRpgInvitation(guestId, 'Guest', roomId, 'accepted', deniedJoin.deps));
  assertEquals(deniedJoin.sent.length, 0);

  const failedBroadcast = fakeDependencies({ broadcast: async () => { throw new Error('timeout'); } });
  await assertRejects(() => respondToRpgInvitation(guestId, 'Guest', roomId, 'received', failedBroadcast.deps));
});

Deno.test('browser binds the recipient inbox to auth.uid and subscribes before handling invites', async () => {
  const source = await Deno.readTextFile(new URL('../../../script.js', import.meta.url));
  assert(source.includes('supabaseClient.channel(`rpg-invitations:${userId}`'));
  assert(source.includes('if (rpgInvitationChannel !== channel) return;'));
  assert(source.includes('data.targetUserId !== currentAuthUserId'));
  assert(source.includes('listenForChallenges(channel);'));
  assert(source.includes('channel.subscribe(status => {'));
});

Deno.test('browser opens the incoming window before sending the received acknowledgement', async () => {
  const source = await Deno.readTextFile(new URL('../../../script.js', import.meta.url));
  const handlerStart = source.indexOf("channel.on('broadcast', { event: 'challenge' }");
  const handlerEnd = source.indexOf("channel.on('broadcast', { event: 'challenge_response' }", handlerStart);
  const handler = source.slice(handlerStart, handlerEnd);
  assert(handler.indexOf("classList.remove('hidden')") < handler.indexOf("sendRpgInvitationResponse(data.roomId, 'received')"));
});

Deno.test('browser deduplicates room invitations and joins the same room id on acceptance', async () => {
  const source = await Deno.readTextFile(new URL('../../../script.js', import.meta.url));
  assert(source.includes('pendingChallengeRoomId === data.roomId || processingIncomingChallengeRoomId === data.roomId'));
  assert(source.includes('await joinPvpRoom(roomId, charType);'));
  assert(source.includes("sendRpgInvitationResponse(roomId, 'accepted')"));
  assert(source.includes('RPG_INVITATION_TIMEOUT_MS = 30000'));
  assert(source.includes("action: 'close_rpg_invitation'"));
});

Deno.test('acceptance waits for the subscribed room to deliver start_game before acknowledging the host', async () => {
  const source = await Deno.readTextFile(new URL('../../../script.js', import.meta.url));
  const joinStart = source.indexOf('async function joinPvpRoom(roomId, charType)');
  const joinEnd = source.indexOf('\nfunction startPvpBattle(', joinStart);
  const joinRoom = source.slice(joinStart, joinEnd);
  const acceptStart = source.indexOf('async function executeAcceptChallenge()');
  const acceptEnd = source.indexOf('\nasync function getPvpBuildSnapshot(', acceptStart);
  const accept = source.slice(acceptStart, acceptEnd);
  assert(joinRoom.includes("channel.on('broadcast', { event: 'start_game' }"));
  assert(joinRoom.includes('await startGamePromise'));
  assert(joinRoom.includes('setTimeout(() => finishStartGame(false), 15000)'));
  assert(joinRoom.includes("if (sent !== 'ok') finishStartGame(false)"));
  assert(joinRoom.includes('if (!startResult)'));
  assert(joinRoom.includes('if (myRoomId === roomId) myRoomId = null'));
  assert(accept.indexOf('await joinPvpRoom(roomId, charType)') < accept.indexOf("sendRpgInvitationResponse(roomId, 'accepted')"));
  assert(accept.includes("classList.remove('hidden')"));
});

Deno.test('host invitation timeout stays active until the invitee confirms start_game', async () => {
  const source = await Deno.readTextFile(new URL('../../../script.js', import.meta.url));
  const challengeStart = source.indexOf('async function executeChallenge()');
  const challengeEnd = source.indexOf('\nfunction listenForChallenges(', challengeStart);
  const challenge = source.slice(challengeStart, challengeEnd);
  const joinHandlerStart = challenge.indexOf("roomChannel.on('broadcast', { event: 'join_request' }");
  const joinHandlerEnd = challenge.indexOf("roomChannel.on('broadcast', { event: 'enemy_action' }", joinHandlerStart);
  const joinHandler = challenge.slice(joinHandlerStart, joinHandlerEnd);
  assert(joinHandler.includes("event: 'start_game'"));
  assert(joinHandler.includes('hostJoinHandled'));
  assert(!joinHandler.includes('clearTimeout(pendingOutgoingChallenge.timer)'));
  const responseStart = source.indexOf("if (data.status === 'accepted')");
  const responseEnd = source.indexOf('const statuses = {', responseStart);
  assert(source.slice(responseStart, responseEnd).includes('clearTimeout(pending.timer)'));
});

Deno.test('delivery timeout clears host state and exposes retry instead of leaving an endless wait', async () => {
  const source = await Deno.readTextFile(new URL('../../../script.js', import.meta.url));
  const clearStart = source.indexOf('async function clearOutgoingRpgChallenge(message)');
  const clearEnd = source.indexOf('\nconst soundCache', clearStart);
  const clear = source.slice(clearStart, clearEnd);
  const executeStart = source.indexOf('async function executeChallenge()');
  const executeEnd = source.indexOf('\nfunction listenForChallenges(', executeStart);
  const execute = source.slice(executeStart, executeEnd);
  assert(source.includes('const RPG_INVITATION_TIMEOUT_MS = 30000'));
  assert(clear.includes('pendingOutgoingChallenge = null'));
  assert(clear.includes('myRoomId = null'));
  assert(clear.includes('close_rpg_invitation'));
  assert(execute.includes('pendingOutgoingChallenge.timer = setTimeout('));
  assert(execute.includes('Можно повторить вызов'));
});

Deno.test('RPG changes keep shared chat and chess invitation channels intact', async () => {
  const source = await Deno.readTextFile(new URL('../../../script.js', import.meta.url));
  assert(source.includes("supabaseClient.channel('chess-invitations'"));
  assert(source.includes("event: 'chess_invite'"));
  assert(source.includes("event: 'site_message'"));
});
