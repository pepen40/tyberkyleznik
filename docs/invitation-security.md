# Invitation security review — 2026-11-03

Scope: current branch from `18f28dc`; static RPC/Edge/RLS review plus local V8
fixtures. No production SQL, deployment, Auth user creation or data deletion.

## Confirmed source issues and corrections

- P2: the shared chess channel allowed authenticated clients to publish arbitrary
  `from/target/accepted` fields. A frozen actual handler from `18f28dc` starts a
  room when given a forged acceptance. It does not prove an economic exploit.
  The current UI no longer subscribes to that bus. Its adapter reads only the
  authenticated server's actor-filtered ledger; the migration denies all browser
  access to the obsolete bus even if permissive legacy policies remain.
- P2: the common bus exposed invitation participant names and room IDs to other
  authenticated users. The new ledger has RLS and no browser/table grants;
  service-only commands project only invitations involving the verified actor.
- P2: room admission previously did not require a persisted acceptance, and
  invitation blocking/expiry lived primarily in the browser. A new command
  persists server deadlines, terminal replies and blocking preferences. Room
  kind and both actors come from the registered room. Third parties cannot read,
  answer or cancel another pair's invitation; the host cannot forge acceptance.
  Acceptance and membership commit together, under room-then-ledger locks.
- RPG delivery already used Auth-derived Edge identities and server-only private
  inbox broadcasting. It now shares the persistent lifecycle and preference
  checks; cancel notifications also use a server-only private inbox. A restrictive
  policy explicitly denies browser INSERT into those inbox topics.

## Reproducible evidence

`node tests/run-server-invitations.cjs`: five V8-equivalent cases observed passing,
including reproduction of the frozen old handler's spoof and execution of the
actual current Edge command branch with a forged `data.user_id` ignored.
`node tests/run-chess-invitations.cjs`: six affected UI cases observed passing in
V8. Actual Node execution was unavailable. The new SQL suite has 20 assertions
for actor/type binding, ACL, blocked, duplicate, cancelled and expired states;
it is included in the isolated PostgreSQL/Auth/Realtime/Edge CI workflow. The
follow-up review extends the suite to 22 assertions for pending-invitation
blocking and denial of legacy public RPG invitation events.
PostgreSQL/pgTAP and live Auth/Realtime/Edge checks have not run in this environment.

The older inbox test now distinguishes a permissive grant policy from the new
restrictive denial policy. This is a change to policy interpretation, not a
removal of the no-client-send requirement. The new suite checks the explicit deny.

## Rollout constraints

Apply no commands from this document to production without separate approval.
Restore the missing historical migration baseline and pass runtime tests first.
The additive migration is `20261103170000_authoritative_game_invitations.sql`.
Deploy the matching Edge code after the migration and publish the matching
client last. Old chess clients lose the common bus by design; old RPG clients
cannot bypass ledger acceptance via room join. All clients need updating.
Keep the deny policy and ledger guards on rollback; reverting only their function
definitions would restore the source vulnerabilities. No destructive down path.

Remaining proof: actual RLS/Realtime behavior, concurrent acceptance/cancellation,
two-browser tests, preference changes across tabs, host disconnect around the
acceptance deadline, recovery after a full page reload and missing historical
schema compatibility. None of this is a production-readiness sign-off.
