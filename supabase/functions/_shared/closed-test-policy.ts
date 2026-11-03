export const CLOSED_TEST_ACTIONS = new Set([
  'get_player_profile', 'game_invitation', 'register_room_membership', 'join_room_membership',
  'validate_room_invitation', 'send_chat_message', 'register_rpg_invitation',
  'deliver_rpg_invitation', 'respond_rpg_invitation', 'close_rpg_invitation',
]);

export async function closedTestAccess(admin: { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{data: unknown; error: unknown}> }, userId: string): Promise<boolean> {
  const { data, error } = await admin.rpc('authorize_closed_test_user', { p_user_id: userId });
  return !error && data === true;
}
