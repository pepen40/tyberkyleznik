# Resume checkpoint — 2026-11-04

## CURRENT GOAL: ordinary GitHub Pages + existing Supabase

Owner explicitly cancelled Linux/VPS/SSH friend hosting. Do not provision a host,
recommend buying one, run host.sh or repeat migration recovery/game audits.
Starting HEAD: `8f3ca35663ba99e21bf99fdcd3a6e326b138962f`, clean/synced.
See public-playtest.md for current facts, capabilities and exact approval sequence.

Read-only public GET: Pages returned200; published JS uses existing hosted Supabase
and Auth, still sends client `pvp_result`, and lacks new caller-profile/authoritative
invitation/PvP adapter calls. It is not the verified audit client. Public main SHA
was `27fcc2ece27db3cba2c435c5c024c1bd7ab62f3b`; Pages source config is unverified.
Supabase list_migrations failed OAuth token refresh; no fallback SQL was executed.

Prepared common server-side economy gate for ordinary clients as well as test
clients: awards/claims/trade/cases/purchases pause before dispatch. Browser flags
cannot enable it. Gameplay, Auth, invitations/chat and existing item use remain.
This source is not deployed; existing production protection is unverified.

Economy source commit: `7204de7fbe5d69e258ed991daf9e681f00de7b33`.
Focused checks passed: public-economy source regression (failed before guard,
passed after), server invitations5, account callbacks10 stale+10 current, actual
TS policy under Node22 type stripping, workflow YAML parse, git diff --check.
New Deno cases wired into CI, not run locally. No production Auth/game tests,
SQL or deployment. Existing full E2E results were not rerun or reclassified.

Next step: owner restores Supabase connector through normal authorization and
confirms Settings/Pages publishing source. Read deployed source/schema metadata,
produce exact scoped backend/client rollout for separate permission. No production
SQL/migrations/RLS/Edge/Pages publication or merge without that permission.
Friends will use the existing URL and normal Auth; no extra computer/software.
Previous isolated E2E remains evidence for its SHA, not live-site sign-off.

### Previous stage (superseded host plan; preserve as history)

## New stage: operator-provided Linux host

Starting HEAD was `389ed0258c08db9156db32d86005b5674e7e4f3c`, clean and synced.
Prepared closed-test/HOST-RU.md and SSH-RU.md, workspace-only pinned tool installer,
host.sh launcher, host-check.cjs doctor/verify and sshd-friends.conf. No host has
been provided or provisioned. No cloud purchase/public endpoint/system SSH change.

New focused checks actually passed: run-closed-host (unit scope), existing proxy
contract run-closed-server, Node syntax, Bash -n for both new scripts, changed
workflow YAML parse and git diff --check. doctor actually rejected this Windows
machine as intended. Docker/sshd are unavailable here; actual Linux installation,
host preflight, manual account issuance and real restricted SSH tunnel remain
UNEXECUTED. CI now includes doctor and port8080 frontend/backend verification;
record its observed result separately, never assume it passed from configuration.

Next: owner supplies a separate Linux x86_64 host and follows HOST-RU.md, validates
effective sshd group policy, then runs the positive tunnel/login and negative
shell/other-port/reverse-forward tests in SSH-RU.md. No need to repeat the previous
game audit, migration recovery or completed two-player verification. Rewards and
economy remain disabled. Check final answer/git log for the launch-stage commit
and compare HEAD/upstream before continuing.

## Previous completed gameplay stage

- Branch: audit/site-completion-20261103. One agent. No production changes allowed.
- Current source: `3d32a59636482b0595bf069335deb24f3f73fc90`, pushed. Worktree was
  clean before this documentation update. Historical commits and original checkout preserved.
- Auth completed: `bd984f3`, `c988b27` invalidate actor/reload on SDK signout and
  reject late profile loads. Regressions failed before and passed after.
- Previous-session `2f0f8a2` was preserved and pushed. RPG inbox reconnect fixed
  in `bb6446f`, with failing-then-passing regression and actual browser verification.
- `3d32a59` corrects safe participant-denial HTTP status 500 to 403. No SQL/RLS
  protection was weakened. `de24e9a` updates Deno's stale timer expectation.
- All 17 local Node entrypoints pass; Python CI-plan seven tests passed. Latest
  source/Deno and DOM jobs pass. Full historical bootstrap remains BLOCKED by
  25 missing originals. Do not redo source recovery or install tools again.
- Final observed public run:
  https://github.com/pepen40/tyberkyleznik/actions/runs/41664446369,
  all five available jobs PASSED, including `closed-test / closed-test`.
  Two-player chess, reconnect/chat/resign/block, PvE character switch, RPG
  invitation/action replay/chat/item consumption, unrelated tester denial,
  Auth refresh/account switch with delayed response, real three-minute PvP
  timeout and zero page errors all passed. Historical bootstrap alone is BLOCKED.
- Next action: arrange a separate private Linux test host and issue synthetic
  accounts using closed-test/README.md. Do not repeat completed audits, recovery,
  or tests without a code change/new failure. No further code blocker was observed
  within the completed closed-test scenarios. Production and full economy remain
  outside this verified scope. Final documentation-only commit records results.
- Friend access procedure is closed-test/README.md: separate Linux host, random
  private signing keys, issued synthetic accounts, loopback backend, restricted
  SSH forwarding to frontend port 8080. No live host/URL or PR exists.
- Economy/rewards/rating disabled server-side; no production SQL/deploy/merge.
- Use native Git auth for push only. Never extract credential-helper tokens.
  Public GitHub REST provides status and sanitized failure annotations.
