# Stabilize site widgets, PvP error handling and offline RPG lifecycle

Base: `integration/pvp-authoritative-mainline` at
`f639cb6dd39cf7817b4b0cc12d1aba6cc4bb5907`.
Target branch: `audit/site-completion-20261103`.
Remote PR state and target freshness could not be verified in this environment.

The FPS monitor had multiple sampling loops; hiding it did not stop all work.
Clock audio/settings, Aura layer stopping, compressor rescanning and small-screen
modal sizing have been corrected while retaining the existing visual style.

PvP expected PostgREST errors now retain safe 403/409 responses instead of
incorrect generic 500s. Unknown database messages stay hidden. Offline RPG win
and item callbacks now check the original battle/account so a delayed response
cannot advance an escaped battle, heal a replacement fighter or overwrite a
different account's inventory. Successful item consumption still reconciles the
same account's inventory after leaving a battle.

Observed verification: six widget cases, eight inline script compilations,
eight RPG lifecycle cases and script.js compilation passed in functions.exec V8.
The Edge worker observed three test bodies / 38 assertions passing in V8 with
imports/type annotation removed. The security reviewer observed 11 extracted
reward-guard checks passing. Diff whitespace checks passed. Tests use actual
source with mocks; none constitute browser E2E or deployed Edge integration.
Node/Deno runners and typechecks are configured in CI but not observed running.

No SQL migration was added in these stages. The rollout runbook explicitly blocks
database rollout pending recovery and testing of missing historical migrations.
Cross-role PvP create/join races, atomic timeout enforcement, online chess flows,
remaining game callbacks and whole-site verification remain open. Source payout
guards remain fail-closed; deployed Edge source has not been reverified.

No merge, deployment, production migration, data deletion or reward enablement
was performed. This is not a production-ready sign-off.
