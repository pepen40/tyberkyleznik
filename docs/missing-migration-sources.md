# Missing original migration sources — owner recovery checklist

This list is derived from the existing `migration-inventory.json`, not a new
production inspection. The earlier snapshot recorded these applied identities;
the original SQL and original production hashes are unavailable. None is replaced
by a fixture, an empty migration or a current-schema snapshot.

## Exact missing sources (25)

```text
20261031105609_security_phase1_restrict_public_player_writes.sql
20261031110553_lock_down_player_table_access.sql
20261031110649_create_legacy_player_sessions.sql
20261031113256_grant_service_role_player_sessions.sql
20261031113540_restore_public_players_read_for_leaderboard.sql
20261101042150_rollback_chatgpt_player_marketplace_lockdown.sql
20261101044820_remove_assistant_player_auth_sessions.sql
20261101130046_auth_profile_foundation.sql
20261101135723_revoke_excess_public_table_privileges.sql
20261101140242_add_server_reward_budget_guardrails.sql
20261101140601_atomic_marketplace_transactions.sql
20261101140755_atomic_pvp_and_floor_updates.sql
20261101141214_atomic_case_inventory_and_upgrade_transactions.sql
20261101141227_atomic_rpg_gear_transactions.sql
20261101141242_atomic_rpg_claims_and_battle_rewards.sql
20261101141311_fix_atomic_rpg_economy_variable_collisions.sql
20261101141333_atomic_arcade_rewards_and_daily_state.sql
20261101141445_preserve_empty_case_drop_behavior.sql
20261101141756_require_auth_for_private_realtime_channels.sql
20261101141838_scope_realtime_authorization_to_app_topics.sql
20261101142346_bind_rpg_floor_progress_to_win_transaction.sql
20261101142808_optimize_realtime_rls_auth_checks.sql
20261101142918_preserve_game_progress_after_reward_caps.sql
20261101143029_restore_compatible_atomic_game_rpc_overloads.sql
20261101143139_order_marketplace_player_locks_to_avoid_deadlocks.sql
```

## Required from the repository/project owner

1. Recover the original ordered statements for each identity from original Git
   sources, private exports/backups or Supabase migration-history statements.
   Names alone do not suffice. Any production catalog export requires separate
   approval; no production SQL was issued for this task.
2. Recover the creation source for the pre-security schema, including players,
   marketplace, profile projection/triggers, cooldowns/reward guardrails, functions,
   sequences, grants and Realtime policies. It may predate this migration list.
3. Supply provenance (version/name/source/hash), privately remove secrets or
   personal literals, and review ordered data transformations/overloads/ACL changes.
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
