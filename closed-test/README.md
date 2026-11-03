# Isolated closed-test profile v1

This is a NEW disposable application schema, not recovered production history.
It combines an explicit minimal test foundation with the unchanged, reviewed
component migrations. The production historical bootstrap gate remains BLOCKED.
Do not apply these SQL files to a hosted/production project.

Status: implementation prepared; real two-player E2E results must be recorded
before claiming this profile ready for friends.

The server allows only issued test accounts while the 24-hour environment is
active. Auth signup is disabled. Private player rows use RLS; Realtime has a
restrictive participant policy. Rewards/rating/currency, purchases, cases, sales,
daily claims and offline item consumption are closed on the server, regardless
of client flags. RPG battles and online PvP remain playable without payouts;
PvE floor progress is session-only. A starter test item can be used by the actual
authoritative PvP engine. These accounts/data never belong to production.

## Start on a separate trusted Linux test host

Requirements: Docker, Node22+, psql and Supabase CLI 2.84.2. CI provisions these
on disposable GitHub-hosted runners. Do not use a shared production host or inject
hosted Supabase credentials. Use the audit checkout.

```sh
node closed-test/manage.cjs prepare
node closed-test/manage.cjs start
node closed-test/manage.cjs apply
```

Keep two private host terminals running:

```sh
node closed-test/manage.cjs functions
node closed-test/manage.cjs serve
```

In another private interactive terminal, issue a separate account per friend:

```sh
node closed-test/manage.cjs add-user .runtime/closed-test-stack friend_one
```

This generates/displays a new test password once. Send it privately yourself;
do not reuse production passwords or commit credentials. The marker, local keys
and synthetic users remain under ignored `.runtime` with private file modes.
The JWT signing secret is freshly random, not Supabase's published dev default.
The backend Docker network binds published ports to loopback.

## Private friend access

Only the frontend/proxy port 8080 needs access. It binds 127.0.0.1 and proxies
Auth/REST/Edge/Realtime to the local isolated backend without serving a service
role key or allowing Auth admin/signup routes. Keep DB/Auth/Realtime ports private.

Use authenticated SSH forwarding on the separate test host. A friend's SSH key
must be restricted to forwarding this one destination, without shell/admin access.
An administrator can install it in a dedicated forwarding account's authorized_keys:

```text
restrict,port-forwarding,permitopen="127.0.0.1:8080",command="/bin/false" ssh-ed25519 FRIEND_PUBLIC_KEY
```

The friend connects using their own SSH key, then opens localhost in the browser:

```sh
ssh -N -L 8080:127.0.0.1:8080 FORWARDING_USER@TEST_HOST
```

Open `http://127.0.0.1:8080`, log in using the issued test username/password.
Do not expose Supabase ports, Studio, Postgres or the host shell to testers. Do not
forward publicly through an anonymous tunnel. Host SSH setup is an operator task;
no remote host/accounts or public preview were provisioned by this code.

Stop access after the session (Ctrl-C frontend, then):

```sh
node closed-test/manage.cjs stop
```

No real account/data is deleted. Stopping the stack closes existing Realtime
connections too; use it for immediate revocation. Realtime can cache channel
authorization while a connection remains established. The frontend closes after
24 hours; server membership/environment checks also expire. Create a new isolated
directory/session rather than resetting, repairing or repurposing production.

## Real CI gate

`closed-test.yml` creates two allowed users and an Auth-only outsider, runs SQL
authorization tests and the actual two-player browser flow through the same-origin
proxy. Generated passwords/private signing data are never uploaded as artifacts.
Only sanitized test logs/statuses are retained. The schema is explicitly a new
test profile; success must never turn the historical production gate green.
