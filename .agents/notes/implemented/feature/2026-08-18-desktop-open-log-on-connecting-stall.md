# Agent Note: Desktop open log from tray and connecting stall

Status: implemented

English | [中文](2026-08-18-desktop-open-log-on-connecting-stall.zh.md)

## Problem

The desktop shell (`apps/desktop`) shows a static Chinese-only "connecting" placeholder while the supervised harness child prints its readiness line. When the child never reports ready, the user has no way to see why: the only place the failure shows up is `harness.log`, which the supervisor writes to under `%APPDATA%/dsh-desktop/logs/` (or `~/Library/Logs/dsh-desktop/`), and the tray menu had no entry that revealed that file. The connecting page itself was also hardcoded Chinese, so a fresh install under an `en-*` Electron locale still saw 中文 with no way to open the log from the visible window.

## Decision

Two changes that share a single IPC channel (`dsh:open-log`) and a single `revealLogFile` dispatcher:

- `apps/desktop/src/connecting-page.ts` renders the connecting placeholder from one pure function (`renderConnectingPage({ locale, timedOut })`). Locale is decided once in `boot()` via `detectConnectingLocale(app.getLocale())` — anything starting with `zh` is `zh`, everything else is `en`. Copy and the optional button sit in a single `.stack` so the page's centered grid has one child. The body keeps `-webkit-app-region: drag` so a frameless Windows window remains movable while connecting; the button uses `no-drag` so a click reaches IPC.
- `apps/desktop/src/log.ts` owns the log-reveal decision. `planLogReveal(logFile, fileExists)` returns `show-item-in-folder` when the file is present, `open-path` on `dirname(logFile)` when it is not — the empty log file is never synthesised, so the timestamp on disk always reflects real harness output. `revealLogFile` takes an injected `LogRevealShell` so the unit test never touches `shell.showItemInFolder` or the OS file manager.
- `apps/desktop/src/main.ts` adds the "Open log" tray item in `buildTrayMenu()` immediately below "Open Window" (launch-at-login and notifications stay below the separator), wires `ipcMain.handle('dsh:open-log', () => handleOpenLog())`, and arms a per-window connecting timer inside `showConnecting()`. The timer is cancelled whenever `loadWindow` switches to the real origin and re-armed every time the connecting page re-renders (initial mount and every `restart`), so a slow restart gets a fresh full timeout rather than inheriting a stale one. `ready` short-circuits to `loadWindow`. The timeout callback re-checks `supervisor.url` before swapping copy: if readiness arrived after the timer fired but before the callback ran, the stalled placeholder must not overlay the GUI. The timeout only changes the page's copy; it never stops the child.
- `preload.cjs` exposes `openLog()` which returns `{ kind: 'file' | 'directory', error }`. The bridge only reveals the configured `harness.log`; the renderer's view of the log path is not exposed. Existing window-control, preference, deep-link, and update bridges are unchanged.
- `DesktopEnv.connectingTimeoutMs` defaults to 15_000 and is overridable through `DSH_DESKTOP_CONNECTING_TIMEOUT_MS`, parsed with the existing `positiveInt` helper used by `DSH_DESKTOP_UPDATE_INTERVAL_MS`.

## Alternatives considered

**Add a "Restart harness" tray item instead of "Open log".** Rejected: when the child is stuck on its first start, restarting usually hits the same bug; the user needs the log first to see *why* it is stuck. "Open log" addresses the diagnostic half; restart is already reachable through Quit + relaunch.

**Kill the child and surface a structured error dialog after the timeout.** Rejected: the harness readiness line can legitimately take longer than 15s on slow disks or first-run model loads, and the supervisor already restarts on crash with exponential backoff. A forced kill would discard a perfectly good start.

**Write an empty `harness.log` and `showItemInFolder` on every reveal.** Rejected: an empty log file at boot would mislead anyone glancing at the directory — "is the harness producing no output, or has it not started?". Opening the parent directory is honest about the state: the directory exists because the supervisor created it, the file is missing because the child never produced anything.

**Move the log-reveal logic into `HarnessSupervisor`.** Rejected: the supervisor is harness-scoped (one child, its readiness line, its lifecycle); the reveal is a desktop-shell concern (tray, connecting page, IPC, locale). Keeping them separate matches the existing `window-lifecycle.ts` split and lets the reveal be tested without a real child process.

**Use `dialog.showMessageBox` to display the log inline.** Rejected: the user wanted to see the *real* `harness.log` in their OS file manager so they can tail it, grep it, and hand it to support. The tray is also reachable when the connecting window is hidden, and the button on the page is reachable in both states — the inline dialog would have to compete with the active renderer.

**Make the connecting page a long-lived document and update its text via IPC instead of reloading.** Rejected: the existing pattern (`loadURL('data:text/html;...')`) is what `restart` already uses; an IPC text-update path would diverge from that and add a fresh renderer↔main channel for the only state that changes. Re-rendering is bounded, the timer is a one-shot, and the cost is one `loadURL` after 15s of waiting.

## Consequences

The connecting page becomes bilingual (zh / en) and offers the "Open log" button once 15s have passed without a readiness line. The "Open log" tray item is always present, so a user whose connecting window is hidden can still find the log. The supervisor is unchanged: it still emits `restart` on unexpected exit, and the connecting timer resets on every `restart` so a slow restart still gets its full window. A late timeout cannot replace an already-loaded origin. The reveal handler never reads the log content and never takes an arbitrary path from the renderer; the only thing the renderer can ask the main process to do is open the configured `harness.log` (or its parent directory when the file is missing). `DSH_DESKTOP_CONNECTING_TIMEOUT_MS` lets an integrator shorten the placeholder-to-button delay for a known-fast harness without rebuilding the shell.
