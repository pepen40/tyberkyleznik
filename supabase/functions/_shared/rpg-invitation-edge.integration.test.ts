import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createClient, type RealtimeChannel, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';

const apiUrl = Deno.env.get('RPG_TEST_API_URL');
const anonKey = Deno.env.get('RPG_TEST_ANON_KEY');
const serviceRoleKey = Deno.env.get('RPG_TEST_SERVICE_ROLE_KEY');

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing local test setting: ${name}`);
  return value;
}

type InviteEvent = { event: 'challenge' | 'challenge_response'; payload: Record<string, unknown> };

class Inbox {
  readonly channel: RealtimeChannel;
  private readonly buffered: InviteEvent[] = [];
  private readonly waiters: Array<{
    event: InviteEvent['event'];
    resolve: (value: Record<string, unknown>) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];

  constructor(client: SupabaseClient, userId: string) {
    this.channel = client.channel(`rpg-invitations:${userId}`, { config: { private: true } });
    for (const event of ['challenge', 'challenge_response'] as const) {
      this.channel.on('broadcast', { event }, ({ payload }) => this.publish(event, payload as Record<string, unknown>));
    }
  }

  private publish(event: InviteEvent['event'], payload: Record<string, unknown>): void {
    const waitingIndex = this.waiters.findIndex((waiter) => waiter.event === event);
    if (waitingIndex < 0) {
      this.buffered.push({ event, payload });
      return;
    }
    const waiter = this.waiters.splice(waitingIndex, 1)[0];
    clearTimeout(waiter.timer);
    waiter.resolve(payload);
  }

  next(event: InviteEvent['event'], timeoutMs = 5_000): Promise<Record<string, unknown>> {
    const bufferedIndex = this.buffered.findIndex((message) => message.event === event);
    if (bufferedIndex >= 0) return Promise.resolve(this.buffered.splice(bufferedIndex, 1)[0].payload);
    return new Promise((resolve, reject) => {
      const waiter = {
        event,
        resolve,
        reject,
        timer: setTimeout(() => {
          const index = this.waiters.indexOf(waiter);
          if (index >= 0) this.waiters.splice(index, 1);
          reject(new Error(`Timed out waiting for RPG inbox event ${event}.`));
        }, timeoutMs),
      };
      this.waiters.push(waiter);
    });
  }

  async expectNoResponse(timeoutMs = 300): Promise<void> {
    try {
      await this.next('challenge_response', timeoutMs);
      throw new Error('Unexpected response was delivered to the host.');
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith('Timed out waiting')) throw error;
    }
  }
}

type TestUser = { id: string; username: string; client: SupabaseClient };

Deno.test('RPG invitations use Auth-verified Edge actions for delivery, receipt, acceptance, decline and retry', async () => {
  const admin = createClient(required(apiUrl, 'API_URL'), required(serviceRoleKey, 'SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const createdIds: string[] = [];
  const clients: SupabaseClient[] = [];
  const inboxes: Inbox[] = [];
  const suffix = crypto.randomUUID().replaceAll('-', '');
  const password = `Local-only-${crypto.randomUUID()}!`;

  const createUser = async (label: string): Promise<TestUser> => {
    const email = `rpg-edge-${label}-${suffix}@example.test`;
    const username = `edge_${label}_${suffix.slice(0, 8)}`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError || !created.user) throw new Error(`Could not create local ${label} user.`);
    createdIds.push(created.user.id);

    const { error: profileError } = await admin.from('players').insert({ user_id: created.user.id, username });
    if (profileError) throw new Error(`Could not create local ${label} profile.`);

    const client = createClient(required(apiUrl, 'API_URL'), required(anonKey, 'ANON_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: session, error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError || !session.session) throw new Error(`Could not sign in local ${label} user.`);
    await client.realtime.setAuth(session.session.access_token);
    clients.push(client);
    return { id: created.user.id, username, client };
  };

  const listen = async (user: TestUser): Promise<Inbox> => {
    const inbox = new Inbox(user.client, user.id);
    inboxes.push(inbox);
    const status = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out subscribing to local private RPG inbox.')), 10_000);
      inbox.channel.subscribe((value) => {
        if (value === 'SUBSCRIBED') {
          clearTimeout(timer);
          resolve(value);
        } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(value)) {
          clearTimeout(timer);
          reject(new Error(`Private RPG inbox subscription failed: ${value}`));
        }
      });
    });
    assertEquals(status, 'SUBSCRIBED');
    return inbox;
  };

  const invoke = async (user: TestUser, action: string, data: Record<string, unknown>) => {
    return await user.client.functions.invoke('award-coins', { body: { action, data } });
  };

  const success = async (user: TestUser, action: string, data: Record<string, unknown>) => {
    const { data: result, error } = await invoke(user, action, data);
    if (error) throw new Error(`Local Edge action ${action} failed: ${error.message}`);
    assertEquals(result?.success, true, `Local Edge action ${action} did not succeed.`);
    return result as Record<string, unknown>;
  };

  const roomId = () => `room_${crypto.randomUUID().replaceAll('-', '').slice(0, 9)}`;
  const registerAndDeliver = async (host: TestUser, guest: TestUser, topic: string) => {
    const registered = await success(host, 'register_rpg_invitation', { topic, inviteeUsername: guest.username });
    assertEquals(registered.topic, topic);
    await success(host, 'deliver_rpg_invitation', { roomId: topic });
  };

  try {
    const host = await createUser('host');
    const guest = await createUser('guest');
    const outsider = await createUser('outsider');
    const hostInbox = await listen(host);
    const guestInbox = await listen(guest);
    const acceptedRoom = roomId();
    const { error: unauthorizedError } = await createClient(required(apiUrl, 'API_URL'), required(anonKey, 'ANON_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    }).functions.invoke('award-coins', { body: { action: 'register_rpg_invitation', data: { topic: acceptedRoom } } });
    assert(unauthorizedError, 'anonymous caller unexpectedly invoked the invitation Edge Function.');

    const registered = await success(host, 'register_rpg_invitation', {
      topic: acceptedRoom,
      inviteeUsername: guest.username,
      user_id: guest.id,
    });
    assertEquals(registered.topic, acceptedRoom, 'client-supplied user_id must not override the JWT identity');
    const { error: foreignResponseError } = await invoke(outsider, 'respond_rpg_invitation', {
      roomId: acceptedRoom,
      status: 'accepted',
    });
    assert(foreignResponseError, 'a nonparticipant responded to another userвЂ™s invitation.');
    await success(host, 'deliver_rpg_invitation', { roomId: acceptedRoom });
    const challenge = await guestInbox.next('challenge');
    assertEquals(challenge.roomId, acceptedRoom);
    assertEquals(challenge.targetUserId, guest.id);

    const validation = await success(guest, 'validate_room_invitation', { topic: acceptedRoom, kind: 'rpg' });
    assertEquals(validation.hostUsername, host.username);
    await success(guest, 'respond_rpg_invitation', { roomId: acceptedRoom, status: 'received' });
    const receipt = await hostInbox.next('challenge_response');
    assertEquals(receipt.status, 'received');
    assertEquals(receipt.roomId, acceptedRoom);

    await success(guest, 'respond_rpg_invitation', { roomId: acceptedRoom, status: 'accepted' });
    const accepted = await hostInbox.next('challenge_response');
    assertEquals(accepted.status, 'accepted');
    assertEquals(accepted.roomId, acceptedRoom, 'host and guest must acknowledge the same room ID');

    for (const status of ['declined', 'disabled', 'busy'] as const) {
      const pairHost = await createUser(`host_${status}`);
      const pairGuest = await createUser(`guest_${status}`);
      const pairHostInbox = await listen(pairHost);
      const pairGuestInbox = await listen(pairGuest);
      const topic = roomId();
      await registerAndDeliver(pairHost, pairGuest, topic);
      assertEquals((await pairGuestInbox.next('challenge')).roomId, topic);
      await success(pairGuest, 'respond_rpg_invitation', { roomId: topic, status: 'received' });
      assertEquals((await pairHostInbox.next('challenge_response')).status, 'received');
      await success(pairGuest, 'respond_rpg_invitation', { roomId: topic, status });
      assertEquals((await pairHostInbox.next('challenge_response')).status, status);

      const { data: expired, error: validationError } = await invoke(pairGuest, 'validate_room_invitation', {
        topic,
        kind: 'rpg',
      });
      assert(validationError || expired?.success !== true, `${status} invitation remained joinable.`);
    }

    // No guest inbox is subscribed: an Edge broadcast is not treated as proof of receipt.
    const retryHost = await createUser('retry_host');
    const offlineGuest = await createUser('offline_guest');
    const retryHostInbox = await listen(retryHost);
    const timedOutRoom = roomId();
    await registerAndDeliver(retryHost, offlineGuest, timedOutRoom);
    await retryHostInbox.expectNoResponse();
    await success(retryHost, 'close_rpg_invitation', { roomId: timedOutRoom });
    const { data: timedOutValidation, error: timedOutError } = await invoke(
      offlineGuest,
      'validate_room_invitation',
      { topic: timedOutRoom, kind: 'rpg' },
    );
    assert(timedOutError || timedOutValidation?.success !== true, 'closed timeout invitation remained joinable.');

    // A failed/expired challenge can be retried with a new room once the per-action cooldown elapses.
    const retryGuestInbox = await listen(offlineGuest);
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    const retryRoom = roomId();
    await success(retryHost, 'register_rpg_invitation', { topic: retryRoom, inviteeUsername: offlineGuest.username });
    await success(retryHost, 'deliver_rpg_invitation', { roomId: retryRoom });
    assertEquals((await retryGuestInbox.next('challenge')).roomId, retryRoom);
  } finally {
    await Promise.allSettled(inboxes.map((inbox) => inbox.channel.unsubscribe()));
    await Promise.allSettled(clients.map((client) => client.auth.signOut()));
    await Promise.allSettled(
      createdIds.map(async (userId) => {
        await admin.from('players').delete().eq('user_id', userId);
        await admin.auth.admin.deleteUser(userId);
      }),
    );
  }
});
