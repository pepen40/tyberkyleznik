# Prepared two-client E2E — NOT EXECUTED

`tests/e2e/local-online.cjs` is a prepared Playwright library runner. Only its
JavaScript syntax compiled in V8. Node, Playwright and the backend/browser flow
have not been executed here.

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
npm install --prefix .runtime/e2e --save-exact playwright
node .runtime/e2e/node_modules/playwright/cli.js install chromium
node .runtime/e2e/node_modules/playwright/cli.js --version
node --check tests/e2e/local-online.cjs
node tests/e2e/local-online.cjs
```

Installation stays in ignored `.runtime`, outside frontend dependencies/global
PATH. It records a resolved version and lock file there; review/preserve them in
test infrastructure and use `npm ci --prefix .runtime/e2e` to reproduce that set.
No package/version was installed or tested here. Installation pattern reference:
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
