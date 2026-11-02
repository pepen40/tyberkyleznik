# Security and rewards readiness inventory

Snapshot reviewed: 2026-11-02. This is an engineering status map, not a statement that all site behavior is secure or production-ready. Production observations below came from read-only Supabase metadata, RPC-definition, migration-history, function-list, and ACL queries. No production data was changed.

## Site and trust boundaries

| Area | Current architecture | Main trust boundary / status |
| --- | --- | --- |
| Site shell and interface | One main page in `index.html`; browser code and game state live primarily in `script.js`; Windows 98 visual style | DOM-XSS review found no confirmed exploitable HTML sink in the reviewed user-controlled paths. Chat output uses text nodes; profile and item output is escaped; image filenames are allowlisted. |
| Auth and player profile | Supabase Auth session; `award-coins` validates bearer JWT using Auth and derives the player from `authData.user.id` | Production ACL denies client table access to `players`. PR #12 changes login to an authenticated `get_player_profile` Edge action with an allowlisted projection. Deploy that Edge version before publishing the matching client. |
| Public profile and leaderboard | Client reads `player_public_profiles`; public profile fields are rendered with escaping/numeric bounds | Production has RLS-enabled public profile reads. The projection omits private account fields. |
| Online lobby, invitations, and rooms | Realtime presence/broadcast plus `realtime_room_access` RPC/Edge checks | Private invitation inbox requires migration `20261102130000...` and the current invitation routes in `award-coins`; production read-only inspection found both absent from deployed state. Runtime CI covers the SQL policy but not two real users. |
| Global/game chat | Client submits messages through `award-coins`; Edge validates message size/content and game-room membership; rendering uses text nodes | No script injection found. A participant in a private online chess room can spoof the displayed `from` label for that room; this is a presentation issue, not an authorization or reward path found in the audit. |
| Economy and inventory | Client UI calls `award-coins`; Edge uses JWT-derived user ID; PostgreSQL SECURITY DEFINER RPCs perform purchases, listing transfers, and inventory updates | Production RPC ACL inspection showed the reviewed economy RPCs executable by `service_role` only. Local repository migrations do not contain most of those RPC definitions or marketplace policies, so local CI cannot prove their current production behavior. |
| CI and delivery | Auth/invitation and PostgreSQL/PvP test workflows | Workflows test code and disposable databases. No workflow in `.github/workflows` deploys SQL migrations, Edge Functions, or the website. |

## Game outcome and reward map

| Game or reward | Client currently reports | Server validation and payout gate | Readiness |
| --- | --- | --- | --- |
| RPG PvP | New protocol sends action intent, action ID, and expected match version | `rpg-pvp` validates the JWT and participant, derives fighter builds, locks match state, checks turn/version/idempotency, computes combat, updates inventory, and determines terminal result atomically. Client-declared `pvp_result` is not accepted; legacy payout RPC is revoked by the PR migration. | Server implementation and PostgreSQL runtime CI pass in PR #12. Production inbox and PvP migrations/functions are absent; two-user production smoke test is outstanding. PvP coins/rating remain disabled. |
| RPG PvE battle rewards | Browser reports `floorMain`, `floorSub`, and character after its local combat loop | `award-coins` fail-closes `rpg_win`. Victory-derived daily/achievement claims are closed by an allowlist. | Not eligible for win/boss rewards until PvE actions and terminal result are server-authoritative. |
| RPG spend contract (`daily:spend500`) | Browser sends only `kind` and `id` to claim | Production RPC source inspected read-only: only server purchase RPCs increment `rpgDaily.spent`; claim locks the player row, checks progress, writes the claimed ID, and credits coins atomically. Direct RPC execute is service-role-only. | Server-backed claim remains available. The RPC definitions are not tracked locally and have no repository pgTAP coverage; this needs source restoration and CI tests before broad rewards readiness. |
| Chess bot reward | Browser reports bot level after client-side game | `award-coins` fail-closes `chess_reward`; inspected production payout RPC pays by level but is service-role-only. No server chess session/outcome validator exists. | Not eligible for rewards. |
| Online chess result | Browser clients exchange moves over Realtime and determine outcome locally | No trusted server adjudication was found. The generic chess reward action is fail-closed. | No result-based rewards. |
| Simon | Browser reports completed rounds | `award-coins` fail-closes `score`; the underlying score RPC is service-role-only but accepts a client-supplied round count. | Not eligible for rewards until the round sequence is validated server-side. |
| Roach game | Browser reports a clear | `award-coins` fail-closes `roach_clear`; inspected production RPC adds a fixed clear increment and coins but is service-role-only. | Not eligible for rewards until the session/result is validated server-side. |
| Daily/achievement win claims | Browser sends a claim kind and ID; display progress is held in RPG profile state | Edge now permits only `daily:spend500`; all win/boss claims, mismatched kinds, and unknown/future IDs fail closed before privileged RPC invocation. | Fail-closed pending server-verified game outcomes. |

## Economy controls verified in production

The following function definitions and ACLs were inspected read-only on 2026-11-02. They are evidence about that production snapshot only and are not automatically recreated by the local migration history:

- `marketplace_sell_item` locks the caller's player row, selects the item by ID from server inventory, bounds the price to 1-100000, removes the owned item and inserts the listing in the same transaction.
- `marketplace_buy_listing` checks price and seller, locks buyer/seller in deterministic order, locks/rechecks the listing, then deletes it and atomically transfers coins and inventory.
- `marketplace_remove_listing` locks the caller and listing, checks seller ownership, removes the listing, and returns the item in the same transaction.
- `open_player_case` is service-role-only. The Edge Function accepts only case prices 250/390, chooses an item from fixed server-side loot tables using cryptographic randomness, and passes that result to the RPC.
- `consume_player_item`, `buy_rpg_upgrade`, `purchase_rpg_gear`, and `set_rpg_gear` are service-role-only and derive the player row from the Edge-supplied Auth UUID. Purchases lock the profile and validate current balance/ownership before updates.
- The marketplace has RLS enabled, an authenticated read policy, and no client write policy in the inspected production metadata. `players` has no table ACL for `anon` or `authenticated` in production.

The Edge Function now also validates marketplace item ID shape and price integer/range before the sale RPC. This is defense in depth; SQL ownership validation remains authoritative.

## Confirmed blockers and remaining proof

1. **P1 — RPG PvP invitations are not live in production.** The private inbox migration and updated `award-coins` routes were absent from the inspected deployment; `rpg-pvp` was not deployed. PR #12 contains the code and isolated tests. Follow `docs/rpg-pvp-production-rollout.md` only after approval, then test with two separate users.
2. **P1 — general game outcome rewards are not safe to enable.** RPG PvE, chess, Simon, roach, and PvP outcomes are not all independently server-adjudicated. Their result-based payout actions remain disabled. Do not treat UI success or a green CI run as proof of two-user production delivery.
3. **P2 — economy SQL source-of-truth gap.** Most `award-coins` RPC definitions and marketplace RLS schema are absent from tracked migrations/tests. Production ACL and function bodies were checked read-only, but CI cannot detect future drift. Add those definitions and isolated PostgreSQL tests in a separately reviewed change.
4. **P2 — deployment is manual and untracked.** There is no repo deployment workflow. Migration and Edge Function versions must be verified explicitly; publish the client last.

## Required gates before enabling all rewards

- Restore tracked SQL definitions and tests for reward budget, purchase, marketplace, inventory, and contract RPCs; assert effective ACL and transaction/idempotency behavior.
- Implement server-authoritative sessions and terminal result validation for each game that will pay rewards; the current client result values must not be trusted.
- Use an authenticated server identity, match/session binding, unique result/reward ledger keys, and a single atomic result-plus-payout transaction.
- Keep a game disabled for payout if its outcome cannot be reproduced/validated by the server.
- Complete the approved PvP database/function rollout and real two-user invite/acceptance/action smoke test; keep PvP payout disabled until a separate approved reward design passes equivalent tests.
