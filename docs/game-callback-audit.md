# Callback audit — 2026-11-03

| Area | Source result | Verification limit |
| --- | --- | --- |
| RPG combat | Enemy-turn/unlock/death timers retain fighter, enemy and account identity; prior win/item guards retained. | Death-timer regression failed before and passed after. Real browser combat is unverified. |
| PvP | Polling, create/join, channel callbacks/removal and end-screen timeout cannot mutate another room/account. | Seven room/chess cases and the auto-exit timer case failed before, passed after. |
| Simon | Owned timers cancel on reset/new game/tab exit; generation/account checks guard queued sequences and score responses. False per-round coin promises removed. | Reset regression failed before, passed after. Real pad/audio interaction remains unverified. |
| Chess bots | Delayed move checks game object/account as well as FEN; old reward status cannot overwrite a new game. | Same-FEN and reward regressions passed after correction. Real UCI output ordering/CDN/rules remain unverified. |
| Economy and roach reward | Ten response handlers bind to the requesting account, including contract load/claim, gear, upgrades, cases and market. Wave generation changes on spawn/stop. | Ten before-failures, ten after-passes and ten positive current-account cases. SQL correctness is not covered by these fixtures. |
| Sheep and visual cleanup | Stop clears interval, descent and walk handles; visual cleanup uses captured elements. | Targeted source inspection only; no visual test claim. |
| Widgets/audio/quotes | Earlier widget stage retained. | Unchanged behavior was not retested. |

The 22 new callback/preference regressions (4 timers, 10 stale account results,
7 room/chess lifecycles, 1 preference migration) were observed failing on the
pre-stage source and then passing on corrected source. The frozen `18f28dc`
shared-bus handler separately reproduces forged acceptance. Final affected-suite
run: 43 cases passed in functions.exec V8, including positive account behavior,
server boundary fixtures and existing affected invitation cases.

These are source fixtures, not Node, browser, database or live service executions.
Real modal/tab interaction, full page reload recovery, cross-tab Auth restoration,
simultaneous browser actions and real Worker message ordering remain unverified.
This is not a statement that every callback and all game rules are proven correct.
