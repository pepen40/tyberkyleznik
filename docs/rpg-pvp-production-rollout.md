# RPG PvP production rollout runbook

This runbook is for a separately approved production change. No command below has been run against production. Do not merge or publish the client before the database and Edge Function steps are verified.

## Current production blockers

An earlier read-only inspection of project `zfvinbamwavibnhmfwnz` found migration history ending at `20261101160151`, without the PvP storage, private invitation inbox or server match migrations. That snapshot found only `award-coins` v50 and no deployed `rpg-pvp`. Its source lacked the RPG invitation/profile actions and accepted `pvp_result` with the caller's `win: true`, plus other client-result reward actions that the reviewed local source now fails closed. Treat that observation as an unresolved payout risk, not a fresh attestation of the current deployment.

The latest migration/table metadata requests failed with an OAuth refresh parsing
error. No production SQL was executed as a fallback. Refresh read-only metadata
and deployed source before approving any rollout. The exact source gaps and safe
recovery options are in [baseline recovery](database-baseline-recovery.md) and
[the version inventory](migration-inventory.json).

The repository has CI workflows for the invitation migration and PvP schema, but no workflow deploys migrations, Edge Functions, or the site.

## Preconditions

1. Review the exact PR head intended for rollout and verify its Auth and PostgreSQL runtime workflows are green.
2. Create/verify a recoverable Supabase backup and a separate maintenance window.
3. Have an operator with Supabase project access run the commands below only after explicit approval.
4. Do not use `supabase db reset`, `supabase migration repair`, `--include-all`, or a general deployment workflow for this rollout.

## Close current client-result payout endpoints first

After reviewing the exact PR head, refreshing the deployed-source comparison and confirming its auth/runtime CI, deploy the reviewed, fail-closed `award-coins` function before applying schema migrations. This is the first proposed production action because the earlier deployed source accepted client-declared results. The function change disables client-result payouts while retaining only the locally allowlisted RPG spending claim.

From the reviewed repository checkout, after separate approval:

```sh
supabase login
supabase link --project-ref zfvinbamwavibnhmfwnz
supabase functions deploy award-coins --project-ref zfvinbamwavibnhmfwnz
supabase functions list --project-ref zfvinbamwavibnhmfwnz
```

Verify a test account's direct attempts to claim `pvp_result`, `rpg_win`, `chess_reward`, `score`, and `roach_clear` return a paused/denied result and leave coins/rating unchanged. Also verify an unknown RPG claim ID is rejected. Do not restore the previously observed v50 if later steps fail; keep the fail-closed function active and pause client publication.

## Migration dry run and apply

### Migration history prerequisite (read-only audit, 2026-11-03)

The earlier production metadata snapshot listed 34 applied versions ending at `20261101160151`.
Only nine of those applied migrations are present in this repository; 25 older
versions, including the economy foundation, are missing. The ten pending game
migrations below do not provide a complete bootstrap.

**Block database rollout until the original missing migration SQL has been
recovered and reviewed against the applied history.** Do not create empty history
files, rewrite existing versions, run migration repair, or reset production.
Then verify the recovered baseline in a disposable database, run the economy and
PvP tests, and confirm the exact pending list with a linked dry run. Until these
steps pass, the commands below are a conditional plan, not a verified rollout.

The current audit could not retrieve deployed Edge Function source. The v50
source observations above belong to the earlier audit and must be rechecked
before deployment; they are not a fresh attestation of the deployed version.

From the reviewed repository checkout:

```sh
supabase login
supabase link --project-ref zfvinbamwavibnhmfwnz
supabase migration list --linked
supabase db push --linked --dry-run
```

The dry run must show exactly these unapplied migrations, in order, and no others:

```text
20261102120000_create_pvp_match_storage.sql
20261102130000_add_private_rpg_invitation_inbox.sql
20261103100000_add_rpg_pvp_server_build.sql
20261103110000_rpg_pvp_match_lifecycle.sql
20261103120000_rpg_pvp_atomic_actions.sql
20261103130000_rpg_pvp_waiting_cancel.sql
20261103140000_rpg_pvp_turn_timeout.sql
20261103150000_serialize_rpg_pvp_admission.sql
20261103160000_atomic_rpg_pvp_deadline.sql
20261103170000_authoritative_game_invitations.sql
```

Stop if the pending list differs. Save the dry-run output for review. After approval, apply only the reviewed migration set:

```sh
supabase db push --linked
supabase migration list --linked
```

Verify all ten target migration versions are recorded. The migration set is additive; rollback means keeping the fail-closed `award-coins` active, disabling the client/PvP feature, and pausing rollout. Do not restore deployed v50 or any Edge Function source that accepts client results. Do not drop tables or rewrite migration history as a rollback.

Before deploying the matching `rpg-pvp` Edge version, verify the admission-race
and deadline tests pass on PostgreSQL 17. Its action path now delegates expiry to
the atomic SQL action RPC and therefore requires migration `20261103160000`.
Keep the corrective lock/deadline definitions on application rollback: restoring
their older definitions would reopen the races. A function-only reversal must
be a separately reviewed change; no destructive down migration is supplied.

## Server-function rollout

After the schema check succeeds, deploy the PvP server function. `award-coins` should already be on the fail-closed version from the first step; redeploy it only if the reviewed commit or function source changed after that deployment:

```sh
supabase functions deploy rpg-pvp --project-ref zfvinbamwavibnhmfwnz
```

Verify the deployed function list and versions. Confirm `award-coins` still has the fail-closed reward policy plus caller-profile/invitation actions, and that `rpg-pvp` verifies the JWT with Auth. Do not deploy service-role credentials to the browser.

## Two-user smoke test

Use two separate, authenticated test accounts and record the outcome for each case:

1. Both clients reach `SUBSCRIBED` on their own `rpg-invitations:<auth.uid>` private inbox.
2. Host sends an invite; recipient sees the incoming dialog and sends a receipt acknowledgement.
3. Recipient accepts; both clients display the same server match ID and room ID.
4. Repeat with decline, disabled invitations, offline recipient, occupied recipient, network timeout, and retry after timeout.
5. Submit one PvP action, retry the same `action_id`, and confirm no duplicate turn; try an outsider and stale version and confirm rejection.
6. Confirm winner and state come from `rpg-pvp`, and that no PvP coins or rating are awarded.
7. Confirm the regular global chat and chess invitation flows still work.

Only after the smoke test passes may the client be published. Keep all general game rewards disabled until each game's outcome verification and payout tests are separately approved.

## Client publication and rollback

There is no deployment workflow in this repository. Publish the reviewed frontend through the site's configured hosting process only after the database, Edge Function, and two-user checks pass.

For rollback, republish the previous frontend and disable PvP server-function use while keeping the fail-closed `award-coins` active. Leave the additive PvP tables and migration history in place; do not delete match or invitation data. Only redeploy a function version after verifying it retains the client-result reward denylist.

Supabase CLI references: [database migrations](https://supabase.com/docs/reference/cli/supabase-db-push) and [deploy Edge Functions](https://supabase.com/docs/guides/functions/deploy).
