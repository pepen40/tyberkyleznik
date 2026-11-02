export type RpgInvitationPeer = {
  success: boolean;
  peerUserId?: string;
  peerUsername?: string;
  error?: string;
};

export type RpgInvitationDependencies = {
  getPeer: (userId: string, roomId: string, role: 'host' | 'invitee') => Promise<RpgInvitationPeer>;
  joinRoom: (userId: string, roomId: string) => Promise<boolean>;
  closeInvitation: (userId: string, roomId: string, role: 'host' | 'invitee') => Promise<boolean>;
  broadcast: (topic: string, event: string, payload: Record<string, any>) => Promise<void>;
};

export function rpgInvitationTopic(userId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('Invalid recipient.');
  return `rpg-invitations:${userId}`;
}

export async function deliverRpgInvitation(
  actorId: string,
  roomId: string,
  hostUsername: string,
  deps: RpgInvitationDependencies,
): Promise<void> {
  if (!/^room_[a-z0-9]{9}$/.test(roomId)) throw new Error('Invalid RPG invitation.');
  const peer = await deps.getPeer(actorId, roomId, 'host');
  if (!peer.success || !peer.peerUserId || !peer.peerUsername) throw new Error(peer.error || 'RPG invitation is unavailable.');
  await deps.broadcast(rpgInvitationTopic(peer.peerUserId), 'challenge', {
    roomId,
    targetUserId: peer.peerUserId,
    target: peer.peerUsername,
    host: hostUsername,
  });
}

export async function respondToRpgInvitation(
  actorId: string,
  actorUsername: string,
  roomId: string,
  status: string,
  deps: RpgInvitationDependencies,
): Promise<void> {
  const supportedStatuses = new Set(['received', 'accepted', 'declined', 'disabled', 'busy']);
  if (!supportedStatuses.has(status)) throw new Error('Unsupported invitation response.');
  if (!/^room_[a-z0-9]{9}$/.test(roomId)) throw new Error('Invalid RPG invitation.');
  const peer = await deps.getPeer(actorId, roomId, 'invitee');
  if (!peer.success || !peer.peerUserId || !peer.peerUsername) throw new Error(peer.error || 'RPG invitation is unavailable.');
  if (status === 'accepted' && !await deps.joinRoom(actorId, roomId)) throw new Error('Could not join RPG room.');
  if (['declined', 'disabled', 'busy'].includes(status) && !await deps.closeInvitation(actorId, roomId, 'invitee')) {
    throw new Error('RPG invitation is no longer active.');
  }
  await deps.broadcast(rpgInvitationTopic(peer.peerUserId), 'challenge_response', {
    roomId,
    fromUserId: actorId,
    from: actorUsername,
    targetUserId: peer.peerUserId,
    status,
  });
}
