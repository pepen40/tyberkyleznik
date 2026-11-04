# Draft PR — not submitted

Current intended launch: ordinary GitHub Pages with the existing Supabase project.
The new common server economy gate pauses unverified awards/claims/purchases/item
issuance for normal clients too, while retaining gameplay and Auth. VPS/SSH/closed
test hosting is optional internal tooling, not a public launch prerequisite.
Current production readiness and required permissions are in public-playtest.md.
The old historical validation narrative below is retained for provenance; full
isolated browser E2E has since passed, but deployed Pages/backend sign-off has not.

Suggested title: Harden game lifecycle and invitations; add isolated verification gates

This branch closes spoofable invitation/client-reward paths in source, preserves
game state across reconnect/account changes and adds isolated runtime verification.
It is not ready for production: historical SQL sources and full authenticated
browser E2E remain missing. No merge, deploy, production SQL or reward enablement
has occurred.

Changes include server-owned invitation identity/preferences/lifecycle, private
inboxes, authoritative PvP admission/action/deadline handling, callback ownership,
chess move/message recovery and native browser timer invocation. The existing
Windows98 style and game mechanics are retained. See audit-progress.md for earlier
commits and the full scope.

CI uses separate source, PvP fixture, invitation fixture, DOM smoke and complete
bootstrap jobs. No synthetic migration baseline is committed. Original timestamps
are unchanged; the incomplete historical bootstrap fails explicitly as BLOCKED.
Exact pending rollout migrations and the missing-history prerequisite are listed
in rpg-pvp-production-rollout.md and missing-migration-sources.md.

Validation: completed run https://github.com/pepen40/tyberkyleznik/actions/runs/41621630675
on b027f4a passed real Node/PowerShell/Python/actionlint/Deno checks, ten pgTAP suites
(150 PvP + 31 invitation planned assertions), both multi-connection SQL harnesses,
Auth/Realtime/Edge integrations and sandboxed two-context DOM smoke. Full bootstrap
was BLOCKED; full authenticated online chess/RPG browser E2E was not run. Final
documentation commits do not change the tested source.

Production gates: recover/review the 25 original migration sources plus initial
schema, refresh deployed-schema/function correspondence, pass clean full bootstrap
and full two-account browser E2E, then obtain separate rollout approval. Existing
component fixture passes cannot authorize deployment or enable game rewards.
