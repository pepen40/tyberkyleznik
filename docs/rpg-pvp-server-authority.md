# RPG PvP server authority

## Server/client boundary

The browser sends only `action_kind`, optional owned `item_id`, a UUID `action_id`, the room topic, and the expected match version. `rpg-pvp` resolves the caller with `auth.getUser`; it ignores a browser-supplied `user_id`. PostgreSQL locks the match row, checks participant, membership, status, turn, version, and idempotency, computes the outcome, updates state and inventory, and writes the action ledger in one transaction.

The browser renders snapshots returned by `get_match` or `submit_action`. It polls the participant-only snapshot RPC to reconcile after a reconnect. PvP combat state is no longer sent over Realtime Broadcast. Realtime remains for invitations and room chat.

## Mechanics mapping

| Current mechanic | Server implementation | Automated test |
| --- | --- | --- |
| Host room creation and fighter selection | Edge Function validates `realtime_room_access`; `create_rpg_pvp_match` derives the fighter from `players` | `rpg_pvp_gameplay_test.sql`, `rpg_pvp_server_build_test.sql` |
| Guest join and room membership | Edge Function requires the authenticated `guest_user_id`; `join_rpg_pvp_match` locks the waiting match and derives the guest build | `rpg_pvp_gameplay_test.sql`, `rpg_pvp_match_lifecycle_test.sql` |
| Participant identity, turn, status and state version | JWT identity comes from Auth; atomic action RPC locks the match and checks all preconditions | `rpg_pvp_gameplay_test.sql`, `rpg_pvp_combat_rules_test.sql` |
| Retry/idempotency | `(match_id, action_id)` is unique; the stored command binds actor, kind, item and expected version; only the original actor and command receive the original result | `rpg_pvp_gameplay_test.sql` |
| Normal attack, random range, critical multiplier, armor and mana gain | Server uses the persisted fighter build and server-side `random()` | `rpg_pvp_combat_rules_test.sql` |
| Defense, mana cost and two bonus attacks | Server state transition in `apply_rpg_pvp_action` | `rpg_pvp_combat_rules_test.sql` |
| Ashab, Apostol and Mee skills | Server calculates damage roll, upgrade bonus, crit, healing and mana | `rpg_pvp_combat_rules_test.sql` |
| All 10 current items, including healing, potato buff, damage items, koala, Boris, syringe, shaver, bad luck and Parashnik | Item ID must be present in the locked `players.inventory`; effect, inventory removal and item-point deduction commit with the match transition | `rpg_pvp_items_test.sql`, `rpg_pvp_gameplay_test.sql` |
| Boris, Parashnik, poison, defense and armor interactions | Persisted in match state and resolved server-side with each turn | `rpg_pvp_items_test.sql`, `rpg_pvp_combat_rules_test.sql` |
| Surrender | `leave` is a participant action and does not require the actor to own the current turn; server selects the winner | `rpg_pvp_combat_rules_test.sql` |
| Waiting room cancellation | Host-only RPC can cancel a waiting room | `rpg_pvp_match_lifecycle_test.sql` |
| Inactivity/disconnect | A three-minute server-side turn deadline completes an inactive match for the other side; reconnect retrieves the terminal result | `rpg_pvp_gameplay_test.sql`, `rpg_pvp_match_lifecycle_test.sql` |
| Winner/result and PvP points | Winner comes from server HP or surrender/timeout. The legacy `pvp_result` Edge action is removed, and its RPC is revoked if present. Rating/rewards remain disabled | `rpg_pvp_atomic_actions_test.sql` |

## Security and operations

- Match tables have RLS enabled, no client policies, no `anon`/`authenticated` table grants, and are excluded from Realtime publication.
- Match RPCs use `SECURITY DEFINER`, empty `search_path`, schema-qualified references, and `EXECUTE` for `service_role` only.
- Match actions and player inventory/item-points update in the same PostgreSQL transaction. A failed action rolls back all writes.
- Match history survives Auth user deletion through `ON DELETE SET NULL`; actions reference the match with `ON DELETE RESTRICT`.
- Server build, state format, and ruleset versions are persisted on each match.
- No currency, PvP points, or other match reward is issued by this change.

## Runtime verification

`.github/workflows/pvp-schema-runtime.yml` creates a disposable Supabase stack with PostgreSQL 17, applies only the PvP test harness and PvP migrations, and runs the pgTAP suite. The same workflow checks JavaScript syntax and type-checks both relevant Edge Functions. It does not bootstrap the repository's incomplete full migration set or contact a configured project.

The timeout is a new fixed three-minute server turn deadline based on server `last_action_at`; it is shown here explicitly because it adjudicates stalled matches. Product owners should review that duration before enabling PvP. Rewards remain paused regardless of match completion.
