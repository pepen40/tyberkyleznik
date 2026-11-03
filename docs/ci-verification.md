# Isolated CI verification — observed hosted results

[Run 41621630675](https://github.com/pepen40/tyberkyleznik/actions/runs/41621630675)
on `b027f4a3825e27c517213adf9de638583e3a7640` completed with source, PvP,
invitation and browser DOM smoke jobs successful. The overall result is failure
because full historical bootstrap is explicitly BLOCKED. Exact steps and five
artifact IDs are in [ci-observed-results.json](ci-observed-results.json).

`site-verification.yml` is the entry point for PRs to main, pushes to main/the
audit branch, and manual runs. It calls the source, PvP, invitation and browser
workflows. Reusable workers also support manual runs; duplicate automatic worker
triggers were removed. No job links a hosted Supabase project, inherits secrets,
deploys, merges or enables rewards. Permissions are `contents: read`.

## Jobs and honest scope

| Job | Actual operations configured | Limit |
| --- | --- | --- |
| Source | Node 22: all `tests/run-*.cjs`, JS syntax; Deno 2 typecheck/policy tests; PowerShell provenance tests; Python CI configuration tests; pinned actionlint | Does not run a database/browser |
| PvP fixture | Supabase CLI 2.84.2, disposable PG17/Auth/Realtime, eight original migrations, eight pgTAP suites, both multi-connection shell harnesses | Minimal existing fixture, not historical bootstrap/full application schema |
| Invitation fixture | PG17/Auth/Realtime/Edge, eight original migrations, two pgTAP suites and both actual Deno Auth/Realtime/Edge integrations | Minimal existing player/cooldown fixture, not economy validation |
| Full bootstrap | Prerequisite gate, then clean stack + every original migration + all pgTAP suites if READY | Currently BLOCKED by 25 missing SQL files and unreviewed baseline/current correspondence |
| Browser DOM smoke | Ubuntu22.04, pinned Playwright 1.58.2, sandboxed Chromium, two independent desktop/mobile contexts | No Auth identity/backend; full online E2E remains BLOCKED |

The PostgreSQL server is the Supabase PG17 container; runners install the `psql`
client. Docker is provided by the GitHub-hosted Ubuntu runner. No local installation
was retried to build this CI.

GitHub has no custom BLOCKED job conclusion. The full-bootstrap job writes
`status: BLOCKED`, reasons and every missing filename to JSON/Markdown artifacts
and the job summary, then exits nonzero with an error annotation. It cannot be
green through `continue-on-error`, fixture substitution or a skipped bootstrap.
Other jobs are independent and continue providing component results.
READY means reviewed prerequisites, not a passing database test result.

## Fixture-order correction

The old invitation preflight was copied as `20261102125900_*`, after the
`20261101145407_*` room migration, which already needs `players`. Supabase's ordered
migration run therefore could encounter a missing prerequisite before the fixture.
Both narrow jobs now start with no application migrations, apply the explicit
external fixture via loopback-only `psql`, copy the selected originals unchanged,
then use `supabase migration up --local`. No reset, invented historical timestamp
or modified historical SQL is used. Fixtures remain in `.github`, outside history.

## Exact original migration scopes and dependencies

The machine-readable selection is `.github/ci/migration-scopes.json`.

| Original version(s) | Prerequisites and scope |
| --- | --- |
| 20261101145407 | Managed Auth/Realtime/roles plus fixture players identity; invitation room/RLS foundation |
| 20261101145936 | Previous room foundation/private schema; Edge membership and topic authorization |
| 20261101150657 | Room table; indexes, invitation scope |
| 20261101152421 | Existing public/private schemas and postgres role; default privileges, invitation scope |
| 20261101152713 | Room access + players usernames; invitation validation |
| 20261101155354 | Private topic-access helper + Realtime; chat send restrictions |
| 20261102130000 | Room membership + Auth/Realtime; private invitation inbox |
| 20261103170000 | Previous room helpers + players/Auth; authoritative invitation ledger/preferences |
| 20261102120000 | Managed Auth/Realtime and roles; PvP storage |
| 20261103100000 | Fixture players upgrades/inventory/item_points; authoritative build |
| 20261103110000 | Storage/build + fixture room access; match lifecycle |
| 20261103120000 | Match lifecycle/build/action ledger; atomic actions |
| 20261103130000, 20261103140000 | Existing lifecycle/actions; waiting cancellation and turn expiry |
| 20261103150000, 20261103160000 | Earlier functions/storage; admission serialization and atomic deadline corrections |
| 20261101152123 | **Full scope blocked**: real players/public-profile username/data semantics needed |
| 20261101153137 | **Full scope blocked**: original public profile table/trigger foundation and columns needed |
| 20261101160151 | **Full scope blocked**: original players/profiles/cooldowns/reward_guardrails and data quality needed |

Thus 16 of 19 originals are selected for explicit component fixture checks. This
is a dependency review, not evidence that those migrations have passed PostgreSQL.
All ten existing pgTAP files are selected exactly once across the two scopes.
See [missing originals and owner actions](missing-migration-sources.md).

## Artifacts and credentials

Commands run through `scripts/ci/run.cjs`; it records exit status, duration and
sanitized output in `.runtime/ci/safe`. Uploads include only that directory for
seven days. Redaction covers runtime secret environment values, JWTs, Supabase key
formats, connection credentials, session/password/header fields and email literals.
Generated local keys are masked before being written to `GITHUB_ENV`.
Failures also emit escaped, bounded, sanitized error annotations for diagnosis
through public check metadata without exposing a credential. No raw status dump,
`.env`, Auth/session response, browser trace/profile/screenshot,
Docker inspect or whole workspace/temp directory is uploaded.

The readiness probe uses local ephemeral Auth credentials. The CLI automatically
provides Edge container URL/keys; no host-loopback `SUPABASE_*` override is written.
Test stacks are stopped without touching hosted data. SQL fixture cleanups in the
existing concurrency harness are guarded by loopback-only database checks.

## Run and inspect

Publishing the audit branch triggers `site-verification.yml`. A new manual workflow
may need to exist on the repository default branch before GitHub exposes dispatch;
do not merge solely to enable this button. After publication, inspect the push run:

```sh
gh run list --workflow site-verification.yml --branch audit/site-completion-20261103
gh run view RUN_ID --log
gh run download RUN_ID --dir .runtime/downloaded-ci
```

GitHub CLI was unavailable, so these `gh` commands were not executed. Normal Git
push and public REST requests observed the hosted results above. Protected log/
artifact download was not authorized; no token was extracted from the credential
helper. The public metadata confirms upload success, not a local content review.
Missing baseline keeps the aggregate workflow red until recovery even when every
available narrow job passes.

References: [Supabase local CI](https://supabase.com/docs/guides/deployment/ci/testing),
[local migration up](https://supabase.com/docs/reference/cli/supabase-migration-up),
[reusable workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows),
[Playwright CI](https://playwright.dev/docs/ci).
