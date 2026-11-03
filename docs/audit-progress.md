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

## Remaining release blockers / next areas

- SQL: serialize cross-role create/join per participant and enforce timeout in
  the same transaction/lock as action application; add actual PostgreSQL race tests.
- Production has seven missing PvP migrations and 25 applied historical versions
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
