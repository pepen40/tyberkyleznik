# Security and rewards readiness inventory

Snapshot reviewed: 2026-11-02. This is an engineering status map, not a statement that all site behavior is secure or production-ready. Production observations below came from read-only Supabase metadata, RPC-definition, migration-history, function-list, and ACL queries. No production data was changed.

## Site and trust boundaries

| Area | Current architecture | Main trust boundary / status |
| --- | --- | --- |
| Site shell and interface | One main page in `index.html`; browser code and game state live primarily in `script.js`; Windows 98 visual style | DOM-XSS review found no confirmed exploitable HTML sink in the reviewed user-controlled paths. Chat output uses text nodes; profile and item output is escaped; image filenames are allowlisted. |
| Auth and player profile | Supabase Auth session; `award-coins` validates bearer JWT using Auth and derives the player from `authData.user.id` | Production ACL denies client table access to `players`. PR #12 changes login to an authenticated `get_player_profile` Edge action with an allowlisted projection. Deploy that Edge version before publishing the matching client. |
| Public profile and leaderboard | Client reads `player_public_profiles`; public profile fields are rendered with escaping/numeric bounds | Production has RLS-enabled public profile reads. The projection omits private account fields. |
| Online lobby, invitations, and rooms | Realtime presence/broadcast plus `realtime_room_access` RPC/Edge checks | Private inbox policy is absent in production until migration `20261102130000...` is applied. Current CI creates disposable Auth users, verifies own-topic access/foreign-topic denial, and invokes the local `award-coins` Edge Function through the invitation register, delivery, receipt, accept, decline, disabled, busy, close/timeout, and retry paths. It does not exercise the browser UI, the deployed Edge Function, the `rpg-pvp` match join in two browsers, or production. |
| Global/game chat | Client submits messages through `award-coins`; Edge validates message size/content and game-room membership; rendering uses text nodes | No script injection found. A participant in a private online chess room can spoof the displayed `from` label for that room; this is a presentation issue, not an authorization or reward path found in the audit. |
| Economy and inventory | Client UI calls `award-coins`; Edge uses JWT-derived user ID; PostgreSQL SECURITY DEFINER RPCs perform purchases, listing transfers, and inventory updates | Production RPC ACL inspection showed the reviewed economy RPCs executable by `service_role` only. Local repository migrations do not contain most of those RPC definitions or marketplace policies, so local CI cannot prove their current production behavior. |
| CI and delivery | Auth/invitation and PostgreSQL/PvP test workflows | Workflows test code and disposable databases. No workflow in `.github/workflows` deploys SQL migrations, Edge Functions, or the website. |

## Game outcome and reward map

| Game or reward | Client currently reports | Server validation and payout gate | Readiness |
| --- | --- | --- | --- |
| RPG PvP | New protocol sends action intent, action ID, and expected match version | Local PR source has `rpg-pvp` validate JWT and participant, derive builds, lock match state, check turn/version/idempotency, compute combat, update inventory, and determine terminal result atomically. Local `award-coins` rejects `pvp_result`; deployed production `award-coins` v50 still accepts it with client `win: true`. | Server implementation and disposable PostgreSQL runtime CI pass in PR #12. Production inbox/PvP migrations and `rpg-pvp` are absent; rollout is required. Two-user production UI smoke is outstanding. PvP coins/rating remain disabled in the PR. |
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

1. **P1 вЂ” Production result payouts accept client claims.** Read-only retrieval of deployed `award-coins` v50 confirmed that it accepts `pvp_result` and passes `data.win === true` to `apply_pvp_result`; it also exposes client-reported RPG win, chess, Simon, and roach result actions. The deployed function does not include this PR's fail-closed guards. Deploy the reviewed fail-closed Edge Function as a separately approved first step; no production change was made here.
2. **P1 вЂ” RPG PvP invitations are not live in production.** Current migration history ends at `20261101160151`; the private inbox migration is absent, only `award-coins` is deployed, and `rpg-pvp` is absent. PR #12 contains the code plus isolated two-user Auth/Realtime and local Edge invitation lifecycle tests. Follow `docs/rpg-pvp-production-rollout.md` after approval, then run the full browser smoke with two accounts.
3. **P1 вЂ” Game result rewards are not safe to enable for all players.** RPG PvE, chess, Simon, roach, and PvP outcomes are not all independently server-adjudicated. The PR source fail-closes result payout actions, but production remains exposed until the approved Edge deployment. Green CI is not production proof.
4. **P2 вЂ” Economy SQL source-of-truth gap.** Most `award-coins` RPC definitions and marketplace RLS schema are absent from tracked migrations/tests. Production ACL and function bodies were checked read-only, but CI cannot detect future drift. Add those definitions and isolated PostgreSQL tests in a separately reviewed change.
5. **P2 вЂ” Deployment is manual and untracked.** There is no repo deployment workflow. Migration and Edge Function versions must be verified explicitly; publish the client last.
## Required gates before enabling all rewards

- Restore tracked SQL definitions and tests for reward budget, purchase, marketplace, inventory, and contract RPCs; assert effective ACL and transaction/idempotency behavior.
- Implement server-authoritative sessions and terminal result validation for each game that will pay rewards; the current client result values must not be trusted.
- Use an authenticated server identity, match/session binding, unique result/reward ledger keys, and a single atomic result-plus-payout transaction.
- Keep a game disabled for payout if its outcome cannot be reproduced/validated by the server.
- Complete the approved PvP database/function rollout and real two-user invite/acceptance/action smoke test; keep PvP payout disabled until a separate approved reward design passes equivalent tests.
