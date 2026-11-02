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
  assert(source.includes('if (channel !== rpgInvitationChannel) return;'));
  assert(source.includes('data.targetUserId !== currentAuthUserId'));
  assert(source.includes('listenForChallenges(channel);'));
  assert(source.includes('channel.subscribe((status, error) => {'));
});

Deno.test('browser synchronizes the authenticated JWT before creating private inbox and reports Realtime failure details', async () => {
  const source = await Deno.readTextFile(new URL('../../../script.js', import.meta.url));
  const inboxStart = source.indexOf('async function initializeRpgInvitationInbox(userId)');
  const inboxEnd = source.indexOf('\nasync function clearOutgoingRpgChallenge(', inboxStart);
  const inbox = source.slice(inboxStart, inboxEnd);
  assert(inbox.indexOf('auth.getSession()') < inbox.indexOf('realtime.setAuth(session.access_token)'));
  assert(inbox.includes('realtime.setAuth(session.access_token)'));
  assert(inbox.indexOf('realtime.setAuth(session.access_token)') < inbox.indexOf('supabaseClient.channel(`rpg-invitations:${userId}`'));
  assert(inbox.indexOf('supabaseClient.channel(`rpg-invitations:${userId}`') < inbox.indexOf('channel.subscribe((status, error)'));
  assert(inbox.includes("if (status === 'SUBSCRIBED')"));
  assert(inbox.includes("console.warn('[RPG inbox] Realtime subscription status.'"));
  assert(inbox.includes("console.error('[RPG inbox] Realtime subscription failed.'"));
  assert(inbox.includes("status === 'CHANNEL_ERROR'"));
  assert(inbox.includes("failChannel('TIMED_OUT')"));
  assert(inbox.includes("status === 'CLOSED'"));
  assert(inbox.includes('removeChannel(channel)'));
  assert(inbox.includes('let readinessSettled = false'));
  assert(inbox.includes('let channelEnded = false'));
  assert(inbox.includes('if (rpgInvitationChannel !== channel || channelEnded) return;'));
  assert(inbox.includes('if (channelEnded || rpgInvitationChannel !== channel) return;'));
  assert(inbox.includes('rpgInvitationChannelStatus = status;'));
  assert(inbox.includes('rpgInvitationRemovalPromise = supabaseClient.removeChannel(channel)'));
  assert(inbox.indexOf('await rpgInvitationRemovalPromise;') < inbox.indexOf('supabaseClient.channel(`rpg-invitations:${userId}`'));
  assert(inbox.includes('getSafeRealtimeErrorMessage(error.details)'));

  const wrapperStart = source.indexOf('function initRpgInvitationInbox(userId)');
  const wrapperEnd = source.indexOf('\nfunction getSafeRealtimeErrorMessage(', wrapperStart);
  const wrapper = source.slice(wrapperStart, wrapperEnd);
  assert(wrapper.includes('if (rpgInvitationInitPromise) return rpgInvitationInitPromise'));
  assert(wrapper.includes('rpgInvitationInitPromise = null'));
  assert(wrapper.includes('initializeRpgInvitationInbox(userId)'));

  const loggerCalls = inbox.match(/console\.(?:info|warn|error)\([^;]+/gs) || [];
  assert(!loggerCalls.some(call => /access_token|session\.access_token|Bearer\s+\$\{|\btoken\s*[,}]/i.test(call)));
  assert(source.includes('.replace(/Bearer\\s+\\S+/gi, \'Bearer [redacted]\')'));
  const safeErrorStart = source.indexOf('function getSafeRealtimeErrorMessage(error)');
  const safeErrorEnd = source.indexOf('\nasync function initializeRpgInvitationInbox(', safeErrorStart);
  const safeError = source.slice(safeErrorStart, safeErrorEnd);
  assert(safeError.indexOf(".replace(/\\beyJ") < safeError.indexOf('.slice(0, 300)'));

  const finishAuthStart = source.indexOf('async function finishAuthLogin(user)');
  const finishAuthEnd = source.indexOf('\nasync function restoreAuthSession()', finishAuthStart);
  const finishAuth = source.slice(finishAuthStart, finishAuthEnd);
  assert(finishAuth.indexOf('await initRpgInvitationInbox(user.id)') < finishAuth.indexOf('initOnlineCounter()'));
  assert(finishAuth.includes('if (rpgInvitationInboxReady) initLobby()'));

  const lobbyStart = source.indexOf('async function openPvpLobby()');
  const lobbyEnd = source.indexOf('\nfunction closePvpLobby()', lobbyStart);
  const lobby = source.slice(lobbyStart, lobbyEnd);
  assert(lobby.indexOf('await initRpgInvitationInbox(currentAuthUserId)') < lobby.indexOf("classList.remove('hidden')"));
  assert(lobby.indexOf("rpgInvitationChannelStatus !== 'SUBSCRIBED'") < lobby.indexOf("classList.remove('hidden')"));
});

Deno.test('browser retries inbox before creating PvP room or registering an invite', async () => {
  const source = await Deno.readTextFile(new URL('../../../script.js', import.meta.url));
  const executeStart = source.indexOf('async function executeChallenge()');
  const executeEnd = source.indexOf('\nfunction listenForChallenges(', executeStart);
  const execute = source.slice(executeStart, executeEnd);
  assert(execute.includes('await initRpgInvitationInbox(currentAuthUserId)'));
  assert(execute.indexOf('await initRpgInvitationInbox(currentAuthUserId)') < execute.indexOf("action: 'register_rpg_invitation'"));
  assert(execute.indexOf('rpgInvitationChannelStatus !== \'SUBSCRIBED\'') < execute.indexOf("action: 'register_rpg_invitation'"));
  assert(execute.indexOf("action: 'register_rpg_invitation'") < execute.indexOf('supabaseClient.channel(roomId'));
  assert(execute.indexOf("action: 'register_rpg_invitation'") < execute.indexOf("invokeRpgPvp('create_match'"));
  assert(execute.indexOf("invokeRpgPvp('create_match'") < execute.indexOf('supabaseClient.channel(roomId'));
  assert(execute.indexOf('await waitForRpgRealtimeSubscription(roomChannel)') < execute.indexOf("action: 'deliver_rpg_invitation'"));
  assert(execute.includes('startPvpMatchSync();'));
});

Deno.test('browser invalidates a previously subscribed inbox and serializes same-topic retry cleanup', async () => {
  const source = await Deno.readTextFile(new URL('../../../script.js', import.meta.url));
  const inboxStart = source.indexOf('async function initializeRpgInvitationInbox(userId)');
  const inboxEnd = source.indexOf('\nasync function clearOutgoingRpgChallenge(', inboxStart);
  const inbox = source.slice(inboxStart, inboxEnd);
  const callbackStart = inbox.indexOf('channel.subscribe((status, error) => {');
  const callbackEnd = inbox.indexOf('\n        });', callbackStart);
  const callback = inbox.slice(callbackStart, callbackEnd);
  assert(callback.indexOf("if (status === 'SUBSCRIBED')") < callback.indexOf("status === 'CHANNEL_ERROR'"));
  assert(callback.includes('rpgInvitationChannelStatus = status;'));
  assert(!callback.includes('readinessSettled) return'));
  assert(inbox.includes('if (channelEnded || rpgInvitationChannel !== channel) return;'));
  assert(inbox.includes('rpgInvitationRemovalPromise = supabaseClient.removeChannel(channel)'));
  assert(inbox.indexOf('await rpgInvitationRemovalPromise;') < inbox.indexOf('const channel = supabaseClient.channel(`rpg-invitations:${userId}`'));
  assert(source.includes('if (rpgInvitationInitPromise) return rpgInvitationInitPromise'));
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

Deno.test('acceptance joins the authoritative match before acknowledging the invite', async () => {
  const source = await Deno.readTextFile(new URL('../../../script.js', import.meta.url));
  const joinStart = source.indexOf('async function joinPvpRoom(roomId, charType)');
  const joinEnd = source.indexOf('\nasync function leavePvpRoom(', joinStart);
  const joinRoom = source.slice(joinStart, joinEnd);
  const acceptStart = source.indexOf('async function executeAcceptChallenge()');
  const acceptEnd = source.indexOf('\nasync function getPvpBuildSnapshot(', acceptStart);
  const accept = source.slice(acceptStart, acceptEnd);
  assert(joinRoom.includes("action: 'join_room_membership'"));
  assert(joinRoom.includes("invokeRpgPvp('join_match', { room_topic: roomId, char_type: charType })"));
  assert(joinRoom.includes('myRoomId = roomId'));
  assert(joinRoom.includes('return true;'));
  assert(!joinRoom.includes("event: 'start_game'"));
  assert(accept.indexOf('await joinPvpRoom(roomId, charType)') < accept.indexOf("sendRpgInvitationResponse(roomId, 'accepted')"));
  assert(accept.includes('if (joined && myRoomId === roomId)'));
  assert(accept.includes("classList.remove('hidden')"));
});

Deno.test('host invitation timeout stays active until invitee confirms the shared server match', async () => {
  const source = await Deno.readTextFile(new URL('../../../script.js', import.meta.url));
  const challengeStart = source.indexOf('async function executeChallenge()');
  const challengeEnd = source.indexOf('\nfunction listenForChallenges(', challengeStart);
  const challenge = source.slice(challengeStart, challengeEnd);
  assert(challenge.includes("invokeRpgPvp('create_match'"));
  assert(challenge.includes("event: 'chat_message'"));
  assert(!challenge.includes("event: 'join_request'"));
  assert(!challenge.includes("event: 'start_game'"));
  assert(challenge.includes('pendingOutgoingChallenge.timer = setTimeout('));
  const responseStart = source.indexOf("if (data.status === 'accepted')");
  const responseEnd = source.indexOf('const statuses = {', responseStart);
  assert(source.slice(responseStart, responseEnd).includes('clearTimeout(pending.timer)'));
  assert(source.includes("invokeRpgPvp('get_match', { room_topic: roomTopic })"));
  const applyStart = source.indexOf('function applyAuthoritativePvpMatch(match)');
  const applyEnd = source.indexOf('\nasync function syncPvpMatch(', applyStart);
  const apply = source.slice(applyStart, applyEnd);
  assert(apply.includes("match.status === 'active' && pendingOutgoingChallenge?.roomId === myRoomId"));
  assert(apply.includes('clearTimeout(pendingOutgoingChallenge.timer)'));
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
  assert(clear.includes("invokeRpgPvp('cancel_match', { room_topic: pending.roomId })"));
  assert(clear.includes("invokeRpgPvp('get_match', { room_topic: pending.roomId })"));
  assert(clear.includes("['active', 'completed', 'cancelled', 'expired'].includes(match.status)"));
  assert(clear.includes('close_rpg_invitation'));
  assert(clear.indexOf("invokeRpgPvp('cancel_match'") < clear.indexOf('close_rpg_invitation'));
  const leaveStart = source.indexOf('async function leavePvpRoom(sendSignal = true)');
  const leaveEnd = source.indexOf('\nfunction updatePvpUI(', leaveStart);
  const leave = source.slice(leaveStart, leaveEnd);
  assert(leave.includes('isPvpHost && pendingOutgoingChallenge'));
  assert(leave.includes("clearOutgoingRpgChallenge('Вызов отменён.')"));
  assert(leave.includes('if (!cancelled && pvpBattleStarted) return submitPvpIntent(\'leave\')'));
  assert(execute.includes('pendingOutgoingChallenge.timer = setTimeout('));
  assert(execute.includes('Можно повторить вызов'));
});

Deno.test('authoritative PvP replaces duplicate and client-broadcast challenge implementations', async () => {
  const source = await Deno.readTextFile(new URL('../../../script.js', import.meta.url));
  assertEquals((source.match(/async function executeChallenge\(\)/g) || []).length, 1);
  assert(!source.includes("event: 'enemy_action', payload"));
  assert(!source.includes("event: 'start_game', payload"));
  assert(source.includes("invokeRpgPvp('create_match'"));
  assert(source.includes("invokeRpgPvp('join_match'"));
});

Deno.test('RPG changes keep shared chat and chess invitation channels intact', async () => {
  const source = await Deno.readTextFile(new URL('../../../script.js', import.meta.url));
  assert(source.includes("supabaseClient.channel('chess-invitations'"));
  assert(source.includes("event: 'chess_invite'"));
  assert(source.includes("event: 'site_message'"));
});
