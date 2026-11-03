# Audit progress — 2026-11-03

Working branch: `audit/site-completion-20261103`. Base: integration branch
`f639cb6dd39cf7817b4b0cc12d1aba6cc4bb5907`. This clone preserves the original
Documents checkout and its uncommitted reward changes. Remote freshness and PR
status cannot be verified: GitHub connections fail in this environment.

## Completed source changes: widgets and Edge errors

See `frontend-audit.md` for widget scope and limitations. Removed the duplicate
script.js FPS loop. Added a Node runner and CI invocation for the widget tests.
PostgREST plain-object errors now preserve the intended PvP 403/409 responses;
unexpected messages remain generic 500 responses. New tests are wired into CI.
The rollout runbook now blocks database rollout until missing migration history
is recovered and tested; it distinguishes earlier deployment observations from
current metadata.

Observed checks: six widget cases passed in the functions.exec V8 runtime;
eight inline scripts and script.js compiled. The Edge worker executed three test
bodies / 38 assertions in V8 after removing imports and the single `unknown`
annotation. The independent security reviewer executed 11 reward guard checks
in V8 and found no new confirmed vulnerability in this stage. `git diff --check`
passed. V8 checks are not Deno typechecks, Node execution, browser E2E, or Edge
integration tests. Node, Deno, Supabase CLI, Docker and PostgreSQL were unavailable
on PATH; remote CI was not observed running.

Agents used before the latest single-agent instruction: github_history,
supabase_audit, gameplay_audit, frontend_fixes, ui_resume, edge_errors,
security_stage_review and stage_qa. The first frontend/gameplay turns and the
last QA turn hit usage limits; their incomplete reviews are not sign-off.
The security and Supabase reviewers returned completed read-only reports.

## Completed source changes: offline RPG asynchronous lifecycle

Commit preceding this stage: `1d66c4f` (widgets, Edge errors and rollout notes).
Win responses and next-floor timers are bound to the original fighter, enemy and
authenticated account. Item responses reconcile successful consumption for the
same account, but do not apply effects or unlock turns in a different battle.
Late responses from another account cannot overwrite its profile/inventory.

`tests/rpg-lifecycle.js` executes the actual extracted game functions with deferred
RPC and timer fixtures. Eight cases passed in functions.exec V8. The old win
function reproduced the escaped-battle floor mutation when run with the new
capture helper supplied solely to keep the fixture compatible; the old game
function itself was unchanged. Tests cover successful current-battle progression
and healing as well as stale success, failure, timer and account-change cases.
`script.js` compiled in V8 and `git diff --check` passed. The Node runner is wired
into CI but was not executed locally because Node is unavailable. This does not
verify live reward validation, online PvP callbacks or every other combat timer.

## SQL admission and deadline stage — source complete, database runtime unverified

Added corrective migrations `20261103150000` and `20261103160000` without editing
historical migration files. Create/join acquire a transaction advisory lock keyed
by the participant before room/match locks, so the existing cross-role live-match
check is serialized under the service API's READ COMMITTED transactions. Hash
collisions only serialize unrelated participants; they cannot bypass the check.

Action application retains its match row lock while checking expiry. Wall time
is read after acquiring that lock rather than using transaction start time.
Timeout completion is returned and committed, not raised and rolled back. Exact
ledger replays still precede expiry; outsiders cannot trigger expiry. The Edge
submit path uses one action RPC and requires the new deadline migration. No
reward path has been enabled.

Added 12 pgTAP assertions for direct late actions, wall time within an older
transaction, persisted terminal state, inventory/ledger preservation, replay,
outsider rejection and browser ACL. Added a local-only two-connection harness:
uncommitted host creation versus guest admission by the same actor, followed by
an action waiting on a row lock until its deadline passes. These fixtures run
only in the disposable CI stack and do not delete existing data. Both migrations
and tests are included in the existing PostgreSQL workflow.

Observed: Bash syntax check passed; the real extracted Edge submit branch passed
two V8 cases / four assertions (duplicate replay and terminal timeout, one RPC
each); diff whitespace checks passed. PostgreSQL/pgTAP, the two-connection runtime
test, Supabase CLI/Docker, Deno typecheck and remote CI were **not run** because
the required tools/network are unavailable. SQL interleavings are statically
identified; no claim is made that database race tests passed. Database runtime
and the missing baseline remain release blockers.

## Remaining release blockers / next areas

- SQL source corrections and regression harness are present; run PostgreSQL
  race/deadline tests and review runtime results before rollout.
- Production was missing seven PvP migrations at the read-only snapshot; two
  additional corrective versions are now pending. There are also 25 historical versions
  absent from tracked files. Economy baseline and full local runtime proof remain missing.
- Gameplay: review other RPG combat and online PvP callbacks; repair online chess reconnect,
  resignation, delivery/synchronization and invitation timeout/settings handling.
- Browser checks: real Web Audio, mobile rendering, pointer capture, CDN/library
  availability, two-account chess and RPG flows remain unverified.
- Complete the whole-site feature inventory and remaining game/economy/Auth tests.
- Deployed Edge source cannot currently be retrieved; source fail-closed checks
  do not prove production rewards are disabled. Keep all unverified payouts closed.

No merge, deployment, production migration, data deletion or reward enablement
was performed. Those actions still require separate user confirmation.
