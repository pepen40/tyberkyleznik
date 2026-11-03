# Database baseline recovery — 2026-11-03

## Result

The CI follow-up does not repeat this historical inventory. It reuses the recorded
JSON and adds [the exact missing-source checklist](missing-migration-sources.md)
and [dependency/scope map](ci-verification.md). Three excluded aliases are checked
against their kept source blob identities by the new Python regression suite.
No historical timestamp, SQL content or migration-history record was changed.

The later hosted [CI run](https://github.com/pepen40/tyberkyleznik/actions/runs/41621630675)
really applied 16 unchanged originals across two explicit component fixtures and
passed their ten pgTAP suites plus concurrency/Auth/Realtime/Edge tests. These
fixtures are not production history. The separate full-bootstrap check remained
BLOCKED and applied no SQL; this result does not recover the other three tracked
migrations' foundation or the 25 missing original sources.

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

## Scoped original-source search

This follow-up started at clean HEAD `ddb76da9976bc78f119e72f1f86ebe0a40eba1ca`
on the existing audit branch. It did not repeat the site audit, install tools,
connect to Supabase, read credential stores or execute SQL. Only documentation
changes result; all 25 original applied sources and initial bootstrap stay BLOCKED.

| Source checked | Observed result | Next step |
| --- | --- | --- |
| Existing audit Git SQL/document objects | Reused known SQL hashes; no missing applied identity found | Original sources R0–R4 from owner |
| `C:/Users/user/Documents/tyberkyleznik` local/security refs | 21 commits absent from the audit reachable history; four commits change only the differently versioned Auth draft | Candidate provenance below; do not relabel as an applied migration |
| All advertised GitHub refs | 14 branch heads, 12 pull head refs, no tags; every tip already present in one of the two local stores | No fetch, checkout, history rewrite or PR creation needed |
| Documents repository object recovery | Read-only fsck: 9 unreachable blobs, 8 trees, no unreachable commits; no new SQL/DDL candidate; no stashes | No original SQL recovered |
| Historical SQL/document content | 90 additional unique text blobs checked; candidates are Auth drafts, later PvP/invitation revisions and explicit CI fixtures | None proves initial schema or any missing applied version |
| Linked `pvp-mainline-integration` worktree | 26 SQL paths checked; only known later migrations, tests, fixtures and archived draft | Existing modified Edge/reward-test files left untouched |
| Downloads project ZIPs | 80 ZIPs / 315 entries; all 173 source/text entries scanned, no SQL member, target DDL or exact missing filename | Owner needs a different original backup/export |
| Loose project source/text copies | 60 files across Downloads and its project snapshot/rollback folders; no target DDL or missing filename | No original source recovered |

ZIP directory checks also found no nested ZIP/JSON/database export member. UTF16/
UTF32 BOM checks found no missed encoded source candidates. Archives were read in
memory, never extracted/executed. Player/marketplace CSV rows, unrelated software
archives, credentials and application-session logs were not read. No archive/source
file contents or secrets are copied into this report.

### Confirmed Git provenance of rejected draft candidates

Every row below refers to the complete Git blob at the exact historical path
`supabase/migrations/20261101000100_auth_profile_access.sql`. These are original
Git revisions of a **draft**, not confirmed originals of any of the 25 applied
identities. Both raw-byte SHA-256 and canonical Git blob identity were verified.
The complete bytes remain accessible with `git show COMMIT:PATH`; no reconstructed
SQL or executable migration copy is supplied.

| Candidate | Commit storing exact blob | Git blob SHA-1 | Raw SQL SHA-256 | Assessment / next step |
| --- | --- | --- | --- | --- |
| D1, 2947 bytes | `dcfa6ce181c971ac6522216efb9c977d924435a2` | `6a253ed21cd35f12d1b810f09845491bf758eada` | `356faa3c5a5424376d0cf482890c8ad2cf3f74d96bd9757db3917ef1ab2ebc18` | Cooldown draft; players already assumed. Owner must supply R0/R2, not rename this source |
| D2, 6236 bytes | `22d46972f4102b6e0c8cba0109b790f37fc1df26` | `8c7b1058f219c6f4558f694f76ed9208511313e2` | `7fac3513d16c7e50f9e29dfe82668e93f259b5ea6f4ea5332d990f4bff1388e7` | Profile table/trigger + cooldown draft; no applied-version correspondence |
| D3, 6028 bytes | `1f5ff75fabbbb1627bba2ee422b6458018e8ce9f` | `9b16bc37d998034a28e1d88a3532affe17756452` | `5aba36a1c3ebad1929a162bcb4f8b7f7538de9ff802fdc6653e25f0e6bd589e0` | Prior unattributed blob now mapped to a real Git revision; still a draft, requires R2 |
| D4, 1568 bytes | `2c867695d49b30956737b6709d2f3e3eb0868676` | `0ee18fa8f5797efadcd0901eddba2b8e2a42781c` | `3582c081222dd55eea3ea6ee76ba84b3e412afa2d91a27417821c882ca124fc2` | Prior unattributed ACL draft now has provenance; does not create the initial tables |

All four start from altering an existing players table. None creates players or
marketplace. This newly confirmed provenance does not invalidate the recorded
unapplied-draft status or establish what production applied under another name.
The original production SQL hashes for all 25 identities remain unavailable.

### Initial-schema coverage and remaining blockers

| Required component | Found original initial source? | Provenance/hash status | Owner action |
| --- | --- | --- | --- |
| players creation, defaults, constraints and sequences | No; only later test fixture creations | No original hash | R0: original creation SQL and sequence/default grants |
| marketplace creation and initial transaction foundations | No | No original hash | R0 and exact R3 files |
| public profiles and synchronization trigger | Draft D2/D3 only; initial/applied definition not confirmed | Git provenance/hashes above, not an applied baseline hash | R2: applied Auth foundation and original trigger dependencies |
| cooldown table/check function | Draft D1/D2/D3 only | Candidate hashes above; applied definition unknown | Original creation source plus relevant R1/R2/R3 statements |
| reward guardrails/budget creation | No original source | No original hash | R3: exact `20261101140242` source and prerequisites |
| atomic economy/PvP/floor/case/gear/claim RPCs and overload corrections | Missing applied versions not recovered; later PvP source is already known | No hashes for missing originals | Complete R3 ordered statements |
| initial grants, ACL changes and sequences | Draft ACLs and later tracked grants only | Candidate/later provenance does not prove initial state | R0/R1 plus original role/default privilege changes |
| initial Realtime policies/publication setup | Later tracked room/inbox definitions only | No original hash for the missing initial policies | R4 and any pre-migration publication/policy creation source |

R0–R4 are defined with the exact 25-row status table in
[missing-migration-sources.md](missing-migration-sources.md). The three historical
timestamp aliases still have the recorded identical blobs and remain excluded;
none of the candidates maps to them. No alias or Auth draft is promoted to a
missing production version. No inventory status or bootstrap-ready flag changed.

Full bootstrap remains blocked by (1) all 25 original SQL sources, (2) original
pre-security schema/ordered creation semantics and (3) unverified correspondence
to applied history. After owner-supplied originals are reviewed, the isolated full
job must actually apply the complete sequence and pass tests before readiness can
change. Production access/export is outside this stage's authorization.

### Checks actually run in this follow-up

- Git status/HEAD/log, ref/object-set comparison, read-only ls-remote and fsck;
  complete existing history was preserved in both repositories.
- Existing bundled Python standard library: ZIP/source metadata/content-pattern
  search, BOM/coverage checks, Git-blob/raw SHA-256 verification and table consistency.
- `git diff --check` and documentary-only scope checks before committing.

Application suites, PostgreSQL/pgTAP, Deno and browser tests were not rerun: no
application code or original migration was added/changed. Full CI bootstrap was
not rerun and is not passing; earlier component CI results remain historical
evidence only. No push/PR, merge, deployment, production action or reward change
is part of this documentary recovery result.
