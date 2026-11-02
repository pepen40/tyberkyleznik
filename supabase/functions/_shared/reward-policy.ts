const CLIENT_REPORTED_RESULT_ACTIONS = new Set([
  'chess_reward',
  'score',
  'roach_clear',
  'rpg_win',
  'pvp_result',
]);

const WIN_BASED_RPG_CLAIMS = new Set([
  'wins3',
  'boss1',
  'first_win',
  'ten_wins',
  'fifty_wins',
  'first_boss',
  'ten_bosses',
]);

export type RewardPauseReason = 'client-result' | 'win-based-rpg-claim' | null;

/** Keep browser-reported game outcomes fail-closed until a server validates them. */
export function getRewardPauseReason(action: unknown, id?: unknown): RewardPauseReason {
  if (typeof action !== 'string') return null;
  if (CLIENT_REPORTED_RESULT_ACTIONS.has(action)) return 'client-result';
  if (action === 'claim_rpg_reward' && typeof id === 'string' && WIN_BASED_RPG_CLAIMS.has(id)) {
    return 'win-based-rpg-claim';
  }
  return null;
}
