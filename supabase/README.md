# Supabase security and migration notes

Project: `zfvinbamwavibnhmfwnz`

## Historical deployment observations (not current verification)

- Edge Function: `award-coins`
- One earlier security pass recorded version `48`; a later audit recorded `50`. Neither is a fresh deployment attestation.
- JWT verification: enabled
- Browser client uses only the publishable key. The service-role key must remain exclusively in Edge Function secrets.

## Security model

- Browser roles can read the public profile projection and read marketplace listings when authenticated.
- Browser roles cannot directly write to player balances, inventory, marketplace listings, action cooldowns, reward guardrails, or room membership records.
- Economy and account mutations are routed through the JWT-verifying Edge Function and service-role-only SQL functions.
- Room membership is server-managed; Realtime room policies check the authenticated user's membership.
- Global and private-room chat sends are routed through the Edge Function. The sender nickname is sourced from the authenticated profile; direct client broadcasts for `site_message` and `chat_message` are denied by the Realtime INSERT policy.
- Chat room admission is checked through the service-role-only `join_realtime_room` RPC; browser roles have no direct access to the membership table.
- Game-result rewards that are not verified by a server-authoritative game engine remain deliberately paused.

## Migration history caveat

The live Supabase database has historical applied migration versions from the earlier security work that are not all represented by SQL files in this repository. The current `supabase/migrations` directory contains the newer tracked migrations, but it is not a complete fresh-project bootstrap.

Do not reset production or assume that the runner can reconstruct a fresh project. Recover original ordered migration statements and any pre-migration schema source first. A current schema snapshot alone cannot be presented as recovered historical semantics. See [baseline recovery](../docs/database-baseline-recovery.md).

One old, unapplied draft was moved out of `supabase/migrations` into `supabase/archive` because its SQL no longer matched the live schema.

## Manual dashboard settings still required

1. Realtime Settings: turn **Allow public access to channels** off so private-channel RLS is enforced.
2. Auth / Email: enable **Secure password change** and **Require current password when updating** where compatible with the recovery flow.
3. Auth / Email: **Prevent use of leaked passwords** remains unavailable on the current Supabase plan; this requires a plan that supports the feature.

## Known limitations

- Local source implements an authoritative RPG PvP action engine; its production deployment and full runtime checks remain unverified. Simon, RPG PvE, roach and chess results still lack trusted outcome validation. Result rewards remain closed in local source; deployed gates require separate verification.
- Legacy player rows without an Auth user remain unlinked. They are not automatically claimable because the old credential proof was removed; do not attach them to new accounts based on username alone.
- No code audit can guarantee the absence of every vulnerability. Re-test the live game flows after dashboard settings are changed.
