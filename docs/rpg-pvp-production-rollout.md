# RPG PvP production rollout runbook

This runbook is for a separately approved production change. No command below has been run against production. Do not merge or publish the client before the database and Edge Function steps are verified.

## Current production blockers

Read-only inspection of project `zfvinbamwavibnhmfwnz` found migration history ending at `20261101160151`. Production does not list the PvP storage, private invitation inbox, or server match migrations. The only active Edge Function found was the older `award-coins`; `rpg-pvp` was not deployed. The deployed `award-coins` source did not contain the RPG invitation actions or the profile action needed by the current client.

The repository has CI workflows for the invitation migration and PvP schema, but no workflow deploys migrations, Edge Functions, or the site.

## Preconditions

1. Review the exact PR head intended for rollout and verify its Auth and PostgreSQL runtime workflows are green.
2. Create/verify a recoverable Supabase backup and a separate maintenance window.
3. Have an operator with Supabase project access run the commands below only after explicit approval.
4. Do not use `supabase db reset`, `supabase migration repair`, `--include-all`, or a general deployment workflow for this rollout.

## Migration dry run and apply

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
```

Stop if the pending list differs. Save the dry-run output for review. After approval, apply only the reviewed migration set:

```sh
supabase db push --linked
supabase migration list --linked
```

Verify all seven target migration versions are recorded. The migration set is additive; rollback means disabling the client/Edge feature and restoring the prior Edge Function source. Do not drop tables or rewrite migration history as a rollback.

## Edge Function rollout

After the schema check succeeds, deploy the reviewed functions individually:

```sh
supabase functions deploy award-coins --project-ref zfvinbamwavibnhmfwnz
supabase functions deploy rpg-pvp --project-ref zfvinbamwavibnhmfwnz
```

Verify the deployed function list and versions. Confirm `award-coins` includes the caller-profile projection and invitation actions, and that `rpg-pvp` verifies the JWT with Auth. Do not deploy service-role credentials to the browser.

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

For rollback, republish the previous frontend and redeploy the previously saved `award-coins` version. Leave the additive PvP tables and migration history in place; do not delete match or invitation data.

Supabase CLI references: [database migrations](https://supabase.com/docs/reference/cli/supabase-db-push) and [deploy Edge Functions](https://supabase.com/docs/guides/functions/deploy).
