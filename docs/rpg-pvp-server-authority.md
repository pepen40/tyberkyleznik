# RPG PvP server authority

## Implemented in this branch
- Server-only fighter build calculation from the caller's persisted profile.
- Match creation and joining derive both fighter builds from database state, not client-supplied stats.
- Participant-only snapshot RPC; match tables remain inaccessible to browser roles.
- Live-match uniqueness guards and serialized guest join.
- RPCs are service-role-only, SECURITY DEFINER, and pin an empty search_path.

## Not yet safe to enable
- Action transition engine is not yet implemented.
- Client combat is still locally calculated and Realtime still broadcasts untrusted action payloads.
- Item consumption is not yet atomic with combat action resolution.
- Disconnect adjudication and verified PvP rating rewards are not implemented.
- Do not deploy these migrations to production until complete integration and full runtime tests pass.
