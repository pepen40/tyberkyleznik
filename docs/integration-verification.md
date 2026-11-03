# Runtime verification — 2026-11-03

## Observed environment

### Latest recovery attempt

See [baseline recovery](database-baseline-recovery.md) and the exact
[version inventory](migration-inventory.json). Fresh MCP metadata reads failed
with OAuth refresh parsing errors. No production SQL was used instead. The old
34-name snapshot is not a fresh schema comparison.

Download probes actually attempted Node's official checksum URL, Deno's release
URL and the pinned Supabase CLI release URL; all failed to connect. No matching
offline installers were found. No installer ran; system PATH/virtualization was
not changed. Docker's named pipe was absent. WSL returned usage/error output
instead of a usable distribution list. No production credential was used locally.

Both new PowerShell files have zero parser errors. Executing their files was
rejected by the host's script execution policy, which was not bypassed/changed.
Their test cases are not passing observations. Inline native metadata checks
found 44 entries, 19 local SQL files with matching Git blob provenance, 25 missing
original SQL files, zero duplicate versions and bootstrap_ready=false. These are
not database checks.

A hidden headless Chrome probe used a fresh workspace profile and local HTML.
DOM output was empty; logs ended in `GPU process isn't usable`. Browser execution
and E2E are not verified. No browser sandbox was disabled.

`Get-Command node,deno,psql,docker,supabase,gh` found none on PATH. Common Node,
Deno, PostgreSQL 17, Docker and Supabase binary locations were checked too.
Chrome is installed, but no local test backend/test accounts or connected browser
automation is available. GitHub network access failed in previous stages;
remote CI results were not retrieved. No production SQL was executed.

### Commands attempted during baseline/environment recovery

These were actually issued; failed availability probes do not count as tests:

```powershell
git status --short
git branch --show-current
git log -5 --oneline
git log --all --format= --name-only -- '*.sql'
Get-Command node,deno,psql,docker,supabase,gh -ErrorAction SilentlyContinue
wsl --list --quiet
Invoke-WebRequest -UseBasicParsing -Uri https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt
Invoke-WebRequest -UseBasicParsing -Method Head -Uri https://github.com/denoland/deno/releases/latest
Invoke-WebRequest -UseBasicParsing -Method Head -Uri https://github.com/supabase/cli/releases/tag/v2.84.2
./scripts/verify-migration-inventory.ps1
./tests/migration-inventory.tests.ps1
git diff --check
```

All three HTTP probes failed to connect. Both `.ps1` invocations were rejected
by execution policy. The syntax-only PowerShell check used
`[System.Management.Automation.Language.Parser]::ParseFile`; no script content
was evaluated to bypass that policy. The prepared E2E compiled with V8
`new Function(source)`, not `node --check`.

The previous stage results below are retained history; unchanged test suites
were not rerun during this recovery attempt.

## Executed in previous stages

- functions.exec V8: 43 affected fixture cases passed. These execute actual source
  with controlled RPC/timer/channel fixtures. They are unit-style checks only.
- Twenty-two callback/preference baseline failures were individually observed
  before their corrections. Frozen shared-bus acceptance spoof also reproduced.
- Main JavaScript and the protocol compiled in V8.
- `bash -n .github/pvp-schema-test/concurrency.sh` passed.
- `bash -n .github/pvp-schema-test/admission-race.sh` passed.
- `git diff --check` passed.

## Reproducible commands in a prepared test environment

Node 22+, from repository root (no application dependencies required):

```sh
node --check script.js
node --check chess-delivery.js
node tests/run-server-invitations.cjs
node tests/run-game-timers.cjs
node tests/run-account-callbacks.cjs
node tests/run-async-room-lifecycle.cjs
node tests/run-invitation-preferences.cjs
node tests/run-chess-invitations.cjs
```

Deno 2 with network access for the existing pinned imports:

```sh
deno check supabase/functions/award-coins/index.ts supabase/functions/rpg-pvp/index.ts
deno test --allow-read=script.js,supabase/functions/award-coins/index.ts supabase/functions/_shared/rpg-invitations.test.ts supabase/functions/_shared/profile-access.test.ts supabase/functions/_shared/reward-policy.test.ts supabase/functions/_shared/marketplace-policy.test.ts
deno test supabase/functions/_shared/pvp-errors.test.ts
deno test --allow-read=supabase/functions/rpg-pvp/index.ts supabase/functions/_shared/pvp-action-routing.test.ts
```

After this branch is published and an operator has GitHub CLI access, the existing
manual workflows provision disposable PostgreSQL 17/Supabase/Auth/Realtime stacks:

```sh
gh workflow run rpg-invitation-runtime.yml --ref audit/site-completion-20261103
gh workflow run pvp-schema-runtime.yml --ref audit/site-completion-20261103
gh run list --branch audit/site-completion-20261103
```

Read each run's actual result/logs. The invitation workflow copies the new
`20261103170000` migration and 22-assertion security suite. Its actual local Edge
integration tests use disposable Auth identities. The PvP workflow runs both
multi-connection harnesses and pgTAP. Do not substitute a linked production URL.
These commands have **not** been executed here and are not evidence of success.

## Two-browser E2E gate — not executed

A test-only local server and two-context runner are now prepared:
`tests/e2e/local-online.cjs`. See [scenario and exact commands](browser-e2e-local.md).
Only its syntax compiled in V8; it was not executed in Node/a browser. A complete
local backend and fixture identities remain prerequisites.

There is no runtime-verified full frontend E2E harness yet. The repository's historical
database bootstrap is incomplete; the narrow CI fixtures cannot be represented
as a complete production-like frontend environment. Before testing two browsers,
restore the baseline into a disposable project, apply the reviewed migrations,
serve the matching Edge code and point a local frontend copy at that local project
using only its public client key. Create two test identities in that disposable
project. Never expose a service-role key to either browser.

Required assertions: sender identity cannot be forged by injected shared-channel
packets; unrelated account cannot read/accept; blocked and cancelled invitations
never join; repeated acceptance joins once; dropped move/ACK and reconnect recover
without duplication; account/room switches reject late callbacks. Real mobile
layout, modal/tab closure, sound and Worker ordering also need browser evidence.
Prepared commands are in browser-e2e-local.md; no passing E2E result is claimed.
Actual execution remains an explicit release blocker.
