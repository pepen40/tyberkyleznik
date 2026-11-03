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

## Online chess lifecycle stage — limited fixes

After SQL commit `b4f36ec`, fixed remote resignation so it sets the game's actual
terminal flag, clears selection/legal targets and uses the known opponent label.
Old channel callbacks are ignored. Repeated SUBSCRIBED on the same channel no
longer reconstructs the board; a failed startup can retry on later subscription.
Three actual-source cases passed with V8 fixtures (foreign room ignored,
resignation ends logical play, reconnect/removed-channel startup). JavaScript
compiled and diff whitespace checks passed. The Node runner is wired into CI;
Node and two-browser Realtime tests were not executed. Preserving the board
does not recover moves missed while disconnected: ACK/replay/resynchronization,
invitation expiry/settings, startup races and full chess rules tests remain open.

## Chess delivery/recovery and PvP callback stage — 2026-11-03

Continued from clean commit `74c4e9a`, using one primary agent and no subagents.
Added `chess-delivery.js` before the main script. Updated peers exchange their
accepted UCI history, compare common prefixes, and replay only one missing legal
opponent move through the existing chess engine. No accepted prefix is replaced.
Conflicts and unavailable peers block further local moves until synchronization.
Reconnect retains the board; new-room/account callbacks are rejected after both
membership lookup and asynchronous chess-library loading.

Private-room chat and resignation now have application receipt ACKs, stable IDs,
bounded retries and duplicate suppression. A transport `ok` is not a receipt.
Delivery status has its own accessible chat element so periodic synchronization
does not erase it. A resignation made while disconnected remains queued and is
sent after reconnect. Session reset/account changes dispose timers and channels.

Chess invitations reserve the outgoing slot before registration, expire even if
registration hangs, retry the same ID and distinguish receipt from acceptance.
The receiver validates room membership, caches its reply, replays answers when
delivery repeats, rejects busy/disabled requests and expires pending dialogs.
Disabling invitations answers an existing request. Unknown/surprising replies,
wrong expected names and duplicate terminal replies cannot start another match.

RPG PvP submit callbacks are now bound to the original room, match, account and
pending command. Late success/error/finally cannot overwrite a replacement match
or unlock its action. Uncertain transport failures retain the same action ID.

Observed in functions.exec V8: **21 cases passed**: seven protocol cases, six
invitation cases, four online-chess lifecycle cases and four PvP callback cases.
Fixtures execute the actual protocol or extracted application functions with
controlled packets, deferred RPCs and timers. They cover dropped moves/ACKs,
reconnect, divergent histories, duplicate chat/resign/invites, unavailable peers,
account changes, hanging registration and stable action retry identities. Main
JavaScript compiled and `git diff --check` passed. Runners are wired into CI.

Not executed: Node runners, real chess.js rules/CDN loading, live Realtime,
browser E2E, Deno, PostgreSQL/pgTAP or remote CI. No claim of whole-site gameplay
coverage or production readiness is made. Important protocol limits:

- Both peers must load this updated client; old protocol clients do not complete
  the new handshake. Mixed versions block moves instead of accepting unchecked state.
- Recovery covers network reconnect with in-memory histories. Reload/loss of both
  histories, durable server storage and multi-device recovery remain unimplemented.
- Invitation expiry currently uses browser timestamps (30 seconds, with a small
  skew allowance). A trusted server invitation lifecycle is still needed.
- The shared invitation bus is not a signed proof of sender identity. Name/ID
  checks and server room admission do not authenticate arbitrary bus ACK payloads.
  Room delivery relies on existing private-channel membership RLS, unverified live.
- Delivery expiry means receipt is unknown, not proof that a message was never
  displayed. Explicit manual resending can produce a new message.
- Chess results remain peer/client-adjudicated and ineligible for trusted rewards.
- Other combat/arcade timers, RPG inbox expiry and cross-tab Auth behavior need
  their own remaining checks; the PvP callback tests cover only the submit path.

## Outstanding release checks

- SQL source corrections and regression harness are present; run PostgreSQL
  race/deadline tests and review runtime results before rollout.
- Production was missing seven PvP migrations at the read-only snapshot; two
  additional corrective versions are now pending. There are also 25 historical versions
  absent from tracked files. Economy baseline and full local runtime proof remain missing.
- Gameplay: review remaining RPG combat/arcade timers and PvP callbacks; verify
  chess delivery with real peers, durable recovery and server-mediated invitations.
- Browser checks: real Web Audio, mobile rendering, pointer capture, CDN/library
  availability, two-account chess and RPG flows remain unverified.
- Complete the whole-site feature inventory and remaining game/economy/Auth tests.
- Deployed Edge source cannot currently be retrieved; source fail-closed checks
  do not prove production rewards are disabled. Keep all unverified payouts closed.

No merge, deployment, production migration, data deletion or reward enablement
was performed. Those actions still require separate user confirmation.
