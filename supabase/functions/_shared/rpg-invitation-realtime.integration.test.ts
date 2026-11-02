import { assert, assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createClient, type RealtimeChannel, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';

const apiUrl = Deno.env.get('RPG_TEST_API_URL');
const anonKey = Deno.env.get('RPG_TEST_ANON_KEY');
const serviceRoleKey = Deno.env.get('RPG_TEST_SERVICE_ROLE_KEY');

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing local test setting: ${name}`);
  return value;
}

function waitForSubscription(channel: RealtimeChannel, timeoutMs = 15_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for Realtime subscription status.')), timeoutMs);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer);
        resolve(status);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        clearTimeout(timer);
        resolve(status);
      }
    });
  });
}

function waitForPayload<T>(promise: Promise<T>, errorMessage: string, timeoutMs = 10_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }, (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function signedInClient(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(required(apiUrl, 'API_URL'), required(anonKey, 'ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error('Could not create authenticated local test session.');
  await client.realtime.setAuth(data.session.access_token);
  return client;
}

async function serverBroadcast(
  admin: SupabaseClient,
  topic: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const channel = admin.channel(topic, { config: { private: true, broadcast: { self: false } } });
  try {
    const status = await waitForSubscription(channel);
    assertEquals(status, 'SUBSCRIBED', `server broadcaster could not subscribe to ${topic}`);
    const result = await channel.send({ type: 'broadcast', event, payload });
    assertEquals(result, 'ok', `server broadcast failed for ${event}`);
  } finally {
    await admin.removeChannel(channel);
  }
}

Deno.test('two authenticated users receive only server-broadcast messages on their own private RPG inboxes', async () => {
  const admin = createClient(required(apiUrl, 'API_URL'), required(serviceRoleKey, 'SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const suffix = crypto.randomUUID();
  const password = `Local-only-${crypto.randomUUID()}!`;
  const credentials = [
    { email: `rpg-host-${suffix}@example.test`, username: 'host' },
    { email: `rpg-guest-${suffix}@example.test`, username: 'guest' },
  ];
  const userIds: string[] = [];
  const clients: SupabaseClient[] = [];
  const channels: RealtimeChannel[] = [];

  try {
    for (const user of credentials) {
      const { data, error } = await admin.auth.admin.createUser({
        email: user.email,
        password,
        email_confirm: true,
      });
      if (error || !data.user) throw new Error('Could not create disposable local Auth user.');
      userIds.push(data.user.id);
      clients.push(await signedInClient(user.email, password));
    }

    const [hostId, guestId] = userIds;
    const hostClient = clients[0];
    const guestClient = clients[1];
    const hostTopic = `rpg-invitations:${hostId}`;
    const guestTopic = `rpg-invitations:${guestId}`;
    const hostInbox = hostClient.channel(hostTopic, { config: { private: true } });
    const guestInbox = guestClient.channel(guestTopic, { config: { private: true } });
    channels.push(hostInbox, guestInbox);

    let receivedChallenge: Record<string, unknown> | undefined;
    let receivedResponse: Record<string, unknown> | undefined;
    let resolveChallenge!: (payload: Record<string, unknown>) => void;
    let resolveResponse!: (payload: Record<string, unknown>) => void;
    const challengeReceived = new Promise<Record<string, unknown>>((resolve) => { resolveChallenge = resolve; });
    const responseReceived = new Promise<Record<string, unknown>>((resolve) => { resolveResponse = resolve; });
    guestInbox.on('broadcast', { event: 'challenge' }, ({ payload }) => {
      receivedChallenge = payload as Record<string, unknown>;
      resolveChallenge(receivedChallenge);
    });
    hostInbox.on('broadcast', { event: 'challenge_response' }, ({ payload }) => {
      receivedResponse = payload as Record<string, unknown>;
      resolveResponse(receivedResponse);
    });

    assertEquals(await waitForSubscription(hostInbox), 'SUBSCRIBED', 'host did not subscribe to its own inbox');
    assertEquals(await waitForSubscription(guestInbox), 'SUBSCRIBED', 'guest did not subscribe to its own inbox');

    const outsiderChannel = hostClient.channel(guestTopic, { config: { private: true } });
    channels.push(outsiderChannel);
    const outsiderStatus = await waitForSubscription(outsiderChannel);
    assertNotEquals(outsiderStatus, 'SUBSCRIBED', 'host unexpectedly subscribed to guest private inbox');

    const roomId = `room_${crypto.randomUUID().replaceAll('-', '').slice(0, 9)}`;
    await serverBroadcast(admin, guestTopic, 'challenge', {
      roomId,
      targetUserId: guestId,
      hostUserId: hostId,
    });
    const challenge = await waitForPayload(challengeReceived, 'Guest inbox did not receive challenge.');
    assertEquals(challenge.roomId, roomId);
    assertEquals(challenge.targetUserId, guestId);

    await serverBroadcast(admin, hostTopic, 'challenge_response', {
      roomId,
      fromUserId: guestId,
      status: 'accepted',
    });
    const response = await waitForPayload(responseReceived, 'Host inbox did not receive challenge response.');
    assertEquals(response.roomId, roomId, 'acceptance response did not preserve the invitation room ID');
    assertEquals(response.fromUserId, guestId);
    assertEquals(response.status, 'accepted');
    assert(receivedChallenge && receivedResponse);
  } finally {
    await Promise.allSettled(channels.map((channel) => channel.unsubscribe()));
    await Promise.allSettled(clients.map((client) => client.auth.signOut()));
    await Promise.allSettled(userIds.map((userId) => admin.auth.admin.deleteUser(userId)));
  }
});
