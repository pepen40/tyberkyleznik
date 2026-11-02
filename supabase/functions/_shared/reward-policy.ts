const SERVER_VERIFIED_RPG_REWARD_CLAIMS = new Set(['daily:spend500']);

export function isServerVerifiedRpgRewardClaim(kind: string, id: string): boolean {
  return SERVER_VERIFIED_RPG_REWARD_CLAIMS.has(`${kind}:${id}`);
}
