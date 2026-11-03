# Browser verification

The NEW isolated closed-test profile now has actual partial authenticated two-player
evidence and its own workflow. See [current results](closed-test-verification.md)
and [private launch procedure](../closed-test/README.md). Historical full-schema
E2E remains BLOCKED; it is distinct from the new profile. The sections below
preserve the earlier DOM-only observation and full-production-schema prerequisites.

## Separate CI DOM smoke

`browser-smoke.yml` installed test-only Playwright 1.58.2 and Chromium on the
Ubuntu22.04 hosted runner. Its [actual passing run](https://github.com/pepen40/tyberkyleznik/actions/runs/41621630675)
tested `b027f4a`. `tests/e2e/browser-smoke.cjs` opens independent desktop/mobile contexts,
blocks backend access and verifies tabs, persisted background/FPS, chess setup
controls and Simon start/tab cancellation. It exposes the main DOM for testing
without assigning an Auth identity. This is UI smoke, not a successful login or
online game simulation. External widgets/media are blocked.

The existing online runner and smoke share `local-server.cjs`; backend rewriting
remains in memory. Full online E2E is separately BLOCKED until full historical
schema and disposable user fixtures are recovered. RPG invitation UI, live
account switches, stale callbacks and full mini-game behavior are not established
by a DOM smoke pass. See [CI scopes and status](ci-verification.md).

Ubuntu24.04 originally rejected Chromium sandbox startup through AppArmor. No
`--no-sandbox` or global security relaxation was used. The 22.04 smoke then exposed
native timer receiver errors, now fixed and covered by two regression cases.

## Full online runner — not executed

`tests/e2e/local-online.cjs` remains a prepared Playwright library runner. Its
Node syntax check passed in CI; its authenticated backend/browser flow has not
been executed. Passing DOM smoke is not a substitute.

## Preconditions

Use a disposable local Supabase project with the recovered full schema, reviewed
migrations and matching Edge functions. Narrow CI preflights do not provide that
whole schema. Provide two existing test users/profiles with distinct usernames
and no unrelated active matches. The runner does not delete users/data.
It enables both fixture accounts' invitation settings before testing a block.
For the optional timeout, use balanced fighters that survive the first attack.

Required environment variables, injected by the isolated test environment:

| Variable | Meaning |
| --- | --- |
| `E2E_DISPOSABLE_LOCAL=true` | Explicit assertion that the project is disposable |
| `SUPABASE_TEST_URL` | Loopback API URL, e.g. `http://127.0.0.1:54321` |
| `SUPABASE_TEST_PUBLIC_KEY` | Local anon JWT/publishable key; service-role is rejected |
| `E2E_USER_A`, `E2E_PASS_A` | First local fixture identity |
| `E2E_USER_B`, `E2E_PASS_B` | Second local fixture identity |
| `E2E_RUN_REAL_TIMEOUT=true` | Include the real three-minute deadline; otherwise reported skipped |

Do not commit or echo credentials. The runner never reads a service-role variable.
URLs must be loopback and have no embedded credentials.

## Commands for a network-enabled Node 22+ test runner

From repository root:

```sh
node -e "const f=require('node:fs');f.mkdirSync('.runtime/e2e',{recursive:true});if(!f.existsSync('.runtime/e2e/package.json'))f.writeFileSync('.runtime/e2e/package.json',JSON.stringify({private:true}));"
npm install --prefix .runtime/e2e --save-exact playwright@1.58.2
node .runtime/e2e/node_modules/playwright/cli.js install chromium
node .runtime/e2e/node_modules/playwright/cli.js --version
node --check tests/e2e/local-online.cjs
node tests/e2e/local-online.cjs
```

Installation stays in ignored `.runtime`, outside frontend dependencies/global
PATH. It records a resolved version and lock file there; review/preserve them in
test infrastructure and use `npm ci --prefix .runtime/e2e` to reproduce that set.
The pinned package was installed/tested for hosted DOM smoke; it was not installed
in the restricted local workspace. Installation pattern reference:
[Playwright library](https://playwright.dev/docs/library).

## Exact scenario

1. Serve a local copy with URL/public-key replacement only in memory. Private
   directories are not served; remaining production Supabase URLs cause failure.
2. Launch Chromium with sandbox enabled and two independent contexts. Permit only
   local endpoints and static GETs from the script CDNs. No traces, screenshots
   or Auth/network headers are exported.
3. Log both users in; send a chess invite; try to forge acceptance as its host
   through the actual Edge API and require rejection. Accept as the recipient.
4. Play two moves; disconnect the second client; play a missed move; reconnect
   and compare actual histories. Send chat and verify one displayed copy.
5. Resign; verify the other board's terminal status. Test server-blocked invitations.
6. Smoke-check the main tabs and FPS toggle.
7. Create/join public RPG PvP; submit and replay the exact action; assert duplicate
   response and unchanged currency. Optionally observe the real turn timeout.
8. Close contexts/server, retaining local test data.

Selectors and assertions require actual execution. This is not a passing E2E.
Full RPG invitation UI, third-user browser privacy, mid-request Auth replacement,
every mini-game/modal and responsive layout remain additional release gates.
