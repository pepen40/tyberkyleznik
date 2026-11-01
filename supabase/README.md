# Supabase security and migration notes

Project: `zfvinbamwavibnhmfwnz`

## Current deployment

- Edge Function: `award-coins`
- Active version at the latest security pass: `47`
- JWT verification: enabled
- Browser client uses only the publishable key. The service-role key must remain exclusively in Edge Function secrets.

## Security model

- Browser roles can read the public profile projection and read marketplace listings when authenticated.
- Browser roles cannot directly write to player balances, inventory, marketplace listings, action cooldowns, reward guardrails, or room membership records.
- Economy and account mutations are routed through the JWT-verifying Edge Function and service-role-only SQL functions.
- Room membership is server-managed; Realtime room policies check the authenticated user's membership.
- Global and private-room chat sends are routed through the Edge Function. Direct client broadcasts for `site_message` and `chat_message` are denied by the Realtime INSERT policy.
- Game-result rewards that are not verified by a server-authoritative game engine remain deliberately paused.

## Migration history caveat

The live Supabase database has historical applied migration versions from the earlier security work that are not all represented by SQL files in this repository. The current `supabase/migrations` directory contains the newer tracked migrations, but it is not a complete fresh-project bootstrap.

Do not reset the production database or assume that a fresh project can be reconstructed by applying only the files currently in this directory. Recover or create a reviewed baseline snapshot of the live schema before attempting a clean rebuild.

One old, unapplied draft was moved out of `supabase/migrations` into `supabase/archive` because its SQL no longer matched the live schema.

## Manual dashboard settings still required

1. Realtime Settings: turn **Allow public access to channels** off so private-channel RLS is enforced.
2. Auth / Email: enable **Secure password change** and **Require current password when updating** where compatible with the recovery flow.
3. Auth / Email: **Prevent use of leaked passwords** remains unavailable on the current Supabase plan; this requires a plan that supports the feature.

## Known limitations

- Server-authoritative validation for Simon, RPG combat, roach clears, chess results, and PvP outcomes is not implemented yet. Reward actions remain paused until those game engines are validated on the server.
- Legacy player rows without an Auth user remain unlinked. They are not automatically claimable because the old credential proof was removed; do not attach them to new accounts based on username alone.
- No code audit can guarantee the absence of every vulnerability. Re-test the live game flows after dashboard settings are changed.
