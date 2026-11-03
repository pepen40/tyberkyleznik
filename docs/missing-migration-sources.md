# Missing original migration sources — owner recovery checklist

This list is derived from the existing `migration-inventory.json`, not a new
production inspection. The earlier snapshot recorded these applied identities;
the original SQL and original production hashes are unavailable. None is replaced
by a fixture, an empty migration or a current-schema snapshot.

## Exact missing sources (25)

| Exact applied identity / filename | Found | Original applied provenance confirmed | Original SHA-256 | Required owner source |
| --- | --- | --- | --- | --- |
| `20261031105609_security_phase1_restrict_public_player_writes.sql` | No — BLOCKED | No | Unavailable | R1 for this exact version |
| `20261031110553_lock_down_player_table_access.sql` | No — BLOCKED | No | Unavailable | R1 for this exact version |
| `20261031110649_create_legacy_player_sessions.sql` | No — BLOCKED | No | Unavailable | R1 for this exact version |
| `20261031113256_grant_service_role_player_sessions.sql` | No — BLOCKED | No | Unavailable | R1 for this exact version |
| `20261031113540_restore_public_players_read_for_leaderboard.sql` | No — BLOCKED | No | Unavailable | R1 for this exact version |
| `20261101042150_rollback_chatgpt_player_marketplace_lockdown.sql` | No — BLOCKED | No | Unavailable | R1 for this exact version |
| `20261101044820_remove_assistant_player_auth_sessions.sql` | No — BLOCKED | No | Unavailable | R1 for this exact version |
| `20261101130046_auth_profile_foundation.sql` | No — BLOCKED | No | Unavailable | R2 for this exact version |
| `20261101135723_revoke_excess_public_table_privileges.sql` | No — BLOCKED | No | Unavailable | R1 for this exact version |
| `20261101140242_add_server_reward_budget_guardrails.sql` | No — BLOCKED | No | Unavailable | R3 for this exact version |
| `20261101140601_atomic_marketplace_transactions.sql` | No — BLOCKED | No | Unavailable | R3 for this exact version |
| `20261101140755_atomic_pvp_and_floor_updates.sql` | No — BLOCKED | No | Unavailable | R3 for this exact version |
| `20261101141214_atomic_case_inventory_and_upgrade_transactions.sql` | No — BLOCKED | No | Unavailable | R3 for this exact version |
| `20261101141227_atomic_rpg_gear_transactions.sql` | No — BLOCKED | No | Unavailable | R3 for this exact version |
| `20261101141242_atomic_rpg_claims_and_battle_rewards.sql` | No — BLOCKED | No | Unavailable | R3 for this exact version |
| `20261101141311_fix_atomic_rpg_economy_variable_collisions.sql` | No — BLOCKED | No | Unavailable | R3 for this exact version |
| `20261101141333_atomic_arcade_rewards_and_daily_state.sql` | No — BLOCKED | No | Unavailable | R3 for this exact version |
| `20261101141445_preserve_empty_case_drop_behavior.sql` | No — BLOCKED | No | Unavailable | R3 for this exact version |
| `20261101141756_require_auth_for_private_realtime_channels.sql` | No — BLOCKED | No | Unavailable | R4 for this exact version |
| `20261101141838_scope_realtime_authorization_to_app_topics.sql` | No — BLOCKED | No | Unavailable | R4 for this exact version |
| `20261101142346_bind_rpg_floor_progress_to_win_transaction.sql` | No — BLOCKED | No | Unavailable | R3 for this exact version |
| `20261101142808_optimize_realtime_rls_auth_checks.sql` | No — BLOCKED | No | Unavailable | R4 for this exact version |
| `20261101142918_preserve_game_progress_after_reward_caps.sql` | No — BLOCKED | No | Unavailable | R3 for this exact version |
| `20261101143029_restore_compatible_atomic_game_rpc_overloads.sql` | No — BLOCKED | No | Unavailable | R3 for this exact version |
| `20261101143139_order_marketplace_player_locks_to_avoid_deadlocks.sql` | No — BLOCKED | No | Unavailable | R3 for this exact version |

## Scoped recovery result at HEAD ddb76da

**Confirmed originals: 0/25. Remaining: 25/25 BLOCKED. Initial baseline: not found.**
Starting working copy was clean on `audit/site-completion-20261103`; previous
commits were preserved. No Supabase connection, production SQL, credential
extraction, PR, deployment or runtime installation was attempted.

The follow-up checked the separate Documents repository/security refs, its linked
worktree, 14 advertised GitHub branch heads and 12 pull-request head refs (read
only; no PR created), 80 project ZIPs and 60 loose project source/text files.
Ninety additional unique SQL/document blobs were inspected while reusing the
already-recorded hashes for known migration sources. No exact missing filename
or applied-version SQL body was recovered. Detailed scope, candidate provenance
and hash verification are in [baseline recovery](database-baseline-recovery.md#scoped-original-source-search).

Four historical Auth-draft variants now have confirmed Git provenance/hashes.
They belong to `20261101000100_auth_profile_access.sql`, not to any identity in
the table. A related name, table definition or timestamp is insufficient to
assign them to `20261101130046_auth_profile_foundation.sql` or another applied
version. They remain excluded; no SQL was added to the migration runner.

## Meaning of the required owner sources

- **R0 — initial creation:** original schema source/previously saved export from
  before the first security migration, especially players and marketplace, their
  constraints/defaults/sequences, original grants/policies and initial functions.
- **R1 — security/session originals:** complete ordered statements associated with
  each exact listed version/name, including grants, session creation/removal and
  rollbacks. Current final ACLs cannot recover the sequence.
- **R2 — applied Auth/profile foundation:** original
  `20261101130046_auth_profile_foundation.sql` and its creation prerequisites.
  The four differently versioned Auth drafts are not proof of what was applied.
- **R3 — economy/reward originals:** exact per-version transaction definitions,
  overloads, data transformations, cooldown/budget rules and corrections. Later
  Edge RPC calls or a current schema dump cannot recover this history.
- **R4 — initial Realtime originals:** exact applied policies/grants and subsequent
  optimization statements for each listed version; later room/inbox migrations
  do not prove the initial private-channel authorization state.

Supply these from original Git sources, owner-held archives/backups or an already
saved migration-history export containing **version, name and full ordered
statements**, with source provenance and hashes. If production is the only source,
a separately authorized read-only export must be arranged first; this stage did
not connect to it. Do not send service-role keys, passwords, player-row CSVs or
other personal data. If a source contains sensitive literals, review it privately;
any redacted derivative needs a different hash and must not be passed off as the
unaltered original.

## Required from the repository/project owner

1. Recover the original ordered statements for each identity from original Git
   sources, private exports/backups or Supabase migration-history statements.
   Names alone do not suffice. Any production catalog export requires separate
   approval; no production SQL was issued for this task.
2. Recover the creation source for the pre-security schema, including players,
   marketplace, profile projection/triggers, cooldowns/reward guardrails, functions,
   sequences, grants and Realtime policies. It may predate this migration list.
3. Supply provenance (version/name/source/hash) and privately review any sensitive
   literals plus ordered data transformations/overloads/ACL changes. Preserve the
   original hash; do not substitute a redacted derivative as the original source.
   Do not supply production service-role credentials for CI.
4. Restore only verified originals at their original versions. Update the inventory
   with reviewed provenance and reconcile fresh read-only production metadata.
   Keep `bootstrap_ready=false` until the history and initial schema are reviewed.
5. Run the isolated full-bootstrap job and inspect every migration/test result.
   A green fixture job cannot approve this recovery.

## Historical duplicates — keep excluded

| Excluded alias | Kept original | Identical Git blob |
| --- | --- | --- |
| 20261101150000 | 20261101145407 | dd8b25ea519b8b1cb399b08acaf33c78c1134c50 |
| 20261101150100 | 20261101145936 | e766f242bcfd8cbf0b8c9d9605f196818959922b |
| 20261101153200 | 20261101153137 | 7596391659223f4c06074436f1c5689ee450cbfa |

The scope/configuration regression suite checks that these aliases stay absent and
their recorded blobs match the kept sources. It does not re-fetch production SQL.
The transient 20261101161000 grant and archived unapplied Auth draft also remain
excluded for the reasons recorded in [baseline recovery](database-baseline-recovery.md).

If exact history cannot be recovered, propose a separately reviewed functional
baseline with explicit lost semantics and compatibility tests. Do not present it
as the historical migration sequence or repair production history to match it.
