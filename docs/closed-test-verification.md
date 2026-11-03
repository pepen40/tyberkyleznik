# Isolated closed-test verification — resumed 2026-11-04

Current status: full two-player run is pending; do not claim the profile ready yet.
No live test host, production deployment or PR has been created. Work is single-agent.

## Scope and isolation

`closed-test/sql/010_foundation.sql` is explicitly a NEW disposable test schema,
outside the historical migration directory. Sixteen unchanged component migrations
are applied to it, followed by the test-only restrictive Realtime policy. This is
not recovery of the missing production baseline: all 25 missing originals remain
BLOCKED. None of their timestamps, contents or applied versions was altered.

Each stack has a random project ID and newly generated private JWT signing secret.
CLI status verifies the generated keys; Docker published-port metadata is checked
for loopback binding. The frontend exposes only a loopback HTTP/WebSocket proxy.
It refuses privileged keys, Auth admin/signup paths and private files. There is no
production link, key override, production query or production data import.

Server-owned participants and environment expiry gate both actual Edge Functions.
Private player rows are owner-only under RLS; public profiles omit Auth IDs,
inventory and currency. Signup is forbidden by Auth. Issued accounts expire with
the 24-hour test environment. Realtime adds a restrictive membership policy.

Currency, ratings, cases, purchases, sales, daily claims, PvE payouts and client
result rewards are denied server-side regardless of UI flags. Zero-currency and
zero-rating CHECK constraints add a database guard. Offline RPG progression is
session-only; real authoritative PvP can consume the issued disposable starter item.
Existing production Edge behavior has not been deployed or claimed verified.

## Observed results so far

Latest completed observation: [run 41634076402](https://github.com/pepen40/tyberkyleznik/actions/runs/41634076402)
on `8d8c813` passed the four existing source/backend/DOM jobs. The closed-test run
also passed reopened chess, blocked invitations, tabs and a real PvE fight with a
delayed victory response across character switching. It failed waiting for the
RPG invitation recipient dialog. PvP browser action/item/timeout checks therefore
were not reached. Detailed safe diagnostics were added in `bd984f3`.

After resumption, all 16 local Node entrypoints and seven Python CI-plan tests
passed. Auth signout and stale-profile regressions demonstrated failures before
the corrections and passed afterward (`bd984f3`, `c988b27`). The previous session's
three expiry/cancellation regressions are retained in `2f0f8a2`.

[Run 41632845528](https://github.com/pepen40/tyberkyleznik/actions/runs/41632845528)
on `f04d0ff` really started the isolated stack, applied the schema and migrations,
passed 12 pgTAP access assertions, authenticated all four issued fixture identities
and verified that Auth rejected public registration. Its sandboxed Chromium run
used independent browser contexts and the same proxy intended for friend access.

That browser run passed two real logins, server membership/reward denial checks,
outsider rejection, global chat, canonical chess invitation acceptance and forged
host-acceptance denial, e4/e5, an actually disconnected client missing Nf3 followed
by recovery, matching histories, private chat and remote resignation. It then failed
on reopening online chess: the new-game handler left the online entry hidden.
This is partial evidence, **not** a passing complete E2E run.

`02197ec` fixes that actual UI defect. A regression first failed on the old source,
then passed with the fix. The repeated browser run is pending.

Earlier real CI runs exposed the test stack's incorrect email-provider setting
(422 on password login) and Supabase worker network separation. These were fixed;
public signup remains disabled and is now checked by real Auth. A chat assertion
was corrected to inspect the untrusted message body separately from the deliberate
bold nickname, retaining exact literal-text, no-elements and no-duplicate checks.

Locally, portable official Node22.23.4 executed all 15 `tests/run-*.cjs` entrypoints
successfully before the latest invitation/menu regressions; those changed suites
were also rerun successfully afterward. Node checks are not PostgreSQL or E2E proof.
The local PowerShell script policy was not bypassed. PostgreSQL/Deno/browser runs
occur on disposable hosted CI, not on this Windows workstation.

## Additional confirmed source fixes

- PvP admission previously left an offline RPG battle and its callbacks active.
  Public create/join and private invitation now retire fighter/enemy identities,
  clear the pending timer and hide offline UI/item menu after successful admission.
  Two before-failing regressions now pass; denied admission preserves the fight.
- Late private RPG registration denial/network errors could clear another account's
  room. Guards bind every awaited setup phase to the initiating account and room;
  removed channels cannot write chat, and late delivery failures cannot cancel a
  replacement/accepted challenge. Two before-failing account-switch tests now pass.

## Run/access and limitations

Use [the exact separate-host and restricted SSH forwarding procedure](../closed-test/README.md).
Only issued synthetic accounts are allowed. Do not publish backend ports, use
production credentials, reuse real passwords or enable rewards. The organizer
must provision a trusted separate Linux test host; no live URL is supplied here.

Immediate revocation requires stopping the stack because established Realtime
channels can cache authorization until disconnect. This profile intentionally
does not certify production schema correspondence, full economic behavior, every
mini-game, all bot levels, Web Audio or real-device/mobile gameplay.
