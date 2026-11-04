// These operations remain paused until their deployed RPCs and result validation
// have been verified. This gate applies to ordinary Pages clients too; no browser
// flag or client-supplied outcome can enable payouts or inventory issuance.
const pausedActions = new Set([
  'chess_reward', 'score', 'roach_clear', 'rpg_win', 'claim_rpg_reward',
  'open_case', 'sell_item', 'remove_listing', 'buy_item', 'buy_gear', 'buy_upgrade',
]);
export function isEconomyPausedAction(action: string): boolean {
  return pausedActions.has(action);
}
