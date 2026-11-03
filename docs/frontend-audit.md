# Frontend widget stage — 2026-11-03

Scope: resume the interrupted index.html changes based on f639cb6; do not claim a completed whole-site or browser audit.

## Changes reviewed and retained

- Mobile viewport metadata; border-box panel/modal sizing prevents percentage widths plus padding from exceeding the viewport. Modal contents scroll within the viewport.
- Inline FPS monitor has one RAF loop and one simulation timer, cancelled while hidden or the tab is backgrounded. Repeated initialization is guarded. Storage exceptions do not break its toggle. Hardware temperatures remain explicitly labelled as simulation in the overlay title.
- Clock visibility and sound settings persist. Audio starts after a gesture, stops when hidden/muted or in the background, and resumes according to the saved settings. Missing controls now fail safely.
- Compass, clock and overlay stop dragging on lost pointer capture and clamp their positions after resize.
- Aura control values persist; playback remains gesture-driven. HMix uncheck stops its actual `hmix:manual` player. Disabling audio also stops the Windows sound.
- Compressor no longer rescans every media element after every document mutation; its play wrapper routes new media. Unconfigured cross-origin media is left unrouted to avoid silencing it.

## Observed verification

`tests/frontend-widgets.js` exports a dependency-free function by declaration:
`runFrontendWidgetTests(indexHtml)`. It executes actual inline source with DOM/timer mocks.
Executed in the functions.exec V8 runtime: **6 tests passed**, including compilation of **8 inline scripts**:

1. All inline scripts compile.
2. FPS starts exactly one RAF and simulation timer; repeated initialization and a frame iteration preserve that count.
3. FPS toggle/page visibility cancel and resume scheduled work.
4. FPS restores disabled state and tolerates inaccessible localStorage.
5. Clock does not autoplay; hiding, muting, backgrounding and foregrounding control playback correctly and save settings.
6. Clock restores hidden/muted settings.

`git diff --check`: exit 0 after the widget changes. Tests ran against the changed source, not the old base.

## Remaining verification

- This is mock-based JavaScript verification, not browser E2E, audible playback, actual rendering, accessibility certification, or visual/mobile smoke testing.
- Aura compressor Web Audio routing, HMix playback, slider selection, saved layer resumption and actual drag pointer capture need browser tests.
- The separate FPS implementation in script.js has been removed. The Node runner additionally rejects its reintroduction; the widget tests exercise the inline owner.
- Existing Aura decorative controls (for example hourly scheduling/info buttons) have not been proven operational in this stage.
- External chess/CDN loading and all game/server interactions belong to the separate gameplay/backend stages.
