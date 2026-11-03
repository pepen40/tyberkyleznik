# Resume checkpoint — 2026-11-04

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
