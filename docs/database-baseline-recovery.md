# Database baseline recovery — 2026-11-03

## Result

The CI follow-up does not repeat this historical inventory. It reuses the recorded
JSON and adds [the exact missing-source checklist](missing-migration-sources.md)
and [dependency/scope map](ci-verification.md). Three excluded aliases are checked
against their kept source blob identities by the new Python regression suite.
No historical timestamp, SQL content or migration-history record was changed.

**Full historical bootstrap is not recovered and cannot be declared safe.** No
SQL was executed against production, no snapshot baseline was invented, and no
historical runner file was added, renamed, removed or repaired.

`migration-inventory.json` records every version from the earlier applied-name
inventory and every current local migration, with local Git blob provenance.
It is a source inventory, not a production schema dump or byte comparison.

| Evidence | Result |
| --- | --- |
| Earlier read-only applied inventory | 34 names/versions, ending at `20261101160151` |
| Current executable SQL files | 19, no duplicate version prefixes |
| Recorded-applied versions present locally | 9; original production SQL hashes are unavailable |
| Recorded-applied versions whose original SQL is missing | 25; exact identities are in the JSON inventory |
| Local versions absent from that earlier snapshot | 10; this is not a fresh assertion of production state |
| Fresh MCP migration/table reads | Both failed: `OAuth token refresh failed: Failed to parse server response` |

The connector failure prevents a fresh comparison of tables, RLS, triggers,
functions, indexes, extensions, publication and deployed versions. Metadata from
earlier stages must not be silently treated as current. Production SQL is still
outside this task's authorization, including catalog SELECT queries.

## Sources examined and exclusions

All locally reachable Git SQL paths and commit history were inspected. Git fsck
also exposed unreachable commits; their SQL paths contain only the old Auth
draft. Small unreachable blobs were checked without printing their contents:
`0ee18fa8f5797efadcd0901eddba2b8e2a42781c` and
`9b16bc37d998034a28e1d88a3532affe17756452` contain policy/cooldown draft variants,
not original players/marketplace/economy foundation definitions. They have no
verified applied-version correspondence. Recent accessible messages from the
earlier security task did not expose original migration execution statements.
No relevant standalone SQL or runtime installer was found in Downloads.

Three historical misnamed migrations are exact content duplicates:

| Excluded timestamp | Kept timestamp | Git blob (identical) |
| --- | --- | --- |
| `20261101150000` | `20261101145407` | `dd8b25ea519b8b1cb399b08acaf33c78c1134c50` |
| `20261101150100` | `20261101145936` | `e766f242bcfd8cbf0b8c9d9605f196818959922b` |
| `20261101153200` | `20261101153137` | `7596391659223f4c06074436f1c5689ee450cbfa` |

Their additions/removals are preserved in Git; restoring them would invent extra
history entries and rerun DDL. The transient `20261101161000` grant was added in
`3575b03` and intentionally removed in `9e7909c` once room checks used a restricted
RPC. It must not be restored as a missing foundation.

The archived `20261101000100_auth_profile_access.sql.txt` explicitly was not an
applied migration (archive commits `7b8009d`, `a361f14`). It starts by altering an
already existing `players` table, includes obsolete client grants and assumes
historical object types. Its DROP VIEW would conflict with a current table of
the same name. It neither creates the original players/marketplace schema nor
recovers the later atomic economy functions. Applying it would change semantics.

## Exact dependency gaps

The 25 missing original SQL entries include player-table ACL changes and their
rollback, legacy sessions and their removal, Auth/profile foundation, reward
budgets/cooldowns, atomic marketplace/PvP/floor/case/inventory/upgrades/gear/
claims/arcade procedures, Realtime policy changes, RPC overload compatibility and
deadlock-order corrections. Final function bodies do not recover those ordered
data transformations or intermediate access rules.

Even the original pre-security schema may have been created manually: the first
recorded security migration predates the tracked foundation draft. Current
runner files do not create `players` or `marketplace`, yet reference them.
Their original columns/defaults/constraints/sequences and data semantics must be
recovered rather than guessed from current client property names.

| Tracked group | Prerequisites unavailable in a clean application schema |
| --- | --- |
| Realtime membership/security | Supabase-managed Auth/Realtime schemas, roles and publication; players Auth UUID/username foundation |
| Username uniqueness/public projection | Players table and historical username normalization; public profile table and trigger foundation |
| Economy and reward Edge actions | Original atomic purchase/transfer/claim/cooldown/budget RPCs, overloads, grants and related tables |
| PvP build/actions | Players upgrades/inventory/item-points columns; later PvP storage and function order |
| Private invitation ledger | Existing room functions, players usernames/Auth IDs, Auth/Realtime roles and schemas |

The isolated CI preflights deliberately supply minimal fixtures for selected
features. They are not recovered production history and do not establish that
applying the whole migration directory from scratch works.

CI now keeps those fixtures outside the migration runner, applies each preflight
before staging original migrations and uses `migration up --local` on a fresh
stack. The prior invitation preflight timestamp sorted after its dependencies.
Sixteen of 19 originals are selected for component scopes; username normalization,
public-profile projection and historical foreign keys still require the missing
foundation. The full job fails explicitly as BLOCKED with all missing filenames
instead of passing a synthetic schema as historical bootstrap.

## Safe recovery options

1. Recover original statements from Supabase migration-history exports and the
   original source/backup which created the pre-security schema. Record the
   version/name, full ordered statements, originating source and hashes. Review
   privately for credentials or personal literals before committing SQL.
2. If the source exists only in migration-history database records, a separately
   approved read-only export is needed. This task did not issue that SQL. Check
   available history columns first; export statements as well as names, not only
   a current schema dump. Restoring MCP access alone may still expose names only.
3. A historical backup/PITR clone in an isolated project can establish an earlier
   state for comparison. It does not justify applying SQL to production or
   automatically treating a later schema snapshot as the original migration.
4. If exact history is irretrievable, propose a new, explicitly reviewed
   functional-baseline strategy with documented lost history and compatibility
   tests. Keep it separate from the old applied versions; do not backfill empty
   files, fabricate timestamp mappings, use migration repair, or reset production.

Until a reviewed option is completed, maintain the full-bootstrap gate as false.
Do not enable rewards or publish a client dependent on unverified schema.

## Source-only verification commands

On a test runner where PowerShell script execution is permitted:

```powershell
./tests/migration-inventory.tests.ps1
./scripts/verify-migration-inventory.ps1 -RequireBootstrap
```

The second command is expected to fail while history is missing. Neither command
connects to a database or applies migrations. Both file invocations were blocked
by this host's execution policy; only their parser/metadata checks were observed.
