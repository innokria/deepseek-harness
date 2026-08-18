# Agent Note: Close behavior preference — window close can quit instead of hiding to tray

Status: implemented

English | [中文](2026-08-16-close-behavior-preference.zh.md)

## Problem

The desktop shell's `onWindowClose` always hides the window to the tray and keeps the Host alive; there is no supported way to make closing the window quit the application. A plugin (or user) that wants the shell to exit when its main window closes has no preference to set and no bridge to call. Hard-coding quit-on-close would break the historical tray default for everyone else.

## Decision

A `closeBehavior: 'tray' | 'quit'` preference joins the shell's existing `DesktopPreferences` (default `'tray'`, preserving current behavior). `normalizePreferences` coerces invalid values back to the default, matching the existing per-field coercion for booleans.

The lifecycle owns the decision, kept Electron-free and unit-testable: `createDesktopLifecycle` accepts an optional `readCloseBehavior: () => CloseBehavior` option; `onWindowClose` calls the full quit sequence when it resolves to `'quit'` and otherwise keeps the historical `preventDefault()` + `hide()` path. Absent the option, closes hide to the tray.

The preference is exposed to renderer plugins through the existing preference IPC pair and preload bridge, mirroring `launch-at-login` and `notifications` exactly:

- `ipcMain.handle('dsh:close-behavior-get')` / `dsh:close-behavior-set`
- `window.dshDesktop.getCloseBehavior()` / `setCloseBehavior(behavior)` in `preload.cjs`

A plugin (for example a settings page) calls `setCloseBehavior('quit')` and the shell persists the value under `userData` and honors it on the next window close — no restart required.

## Consequences

- The default is unchanged: closing the window still hides to the tray until a plugin or user opts into quit.
- The quit path reuses `requestQuit()`, so Host disposal and quit release are identical to tray-menu quit; a quit-on-close during an in-flight teardown is coalesced by the existing `pendingQuit` single-flight.
- Renderer plugins gain a first-class, symmetric API instead of reading shell state out of band.
- The web client's General settings now exposes a "When closing window" row (Keep running / Quit) that drives the preference through `window.dshDesktop.getCloseBehavior()/setCloseBehavior()`, mirroring the launch-at-login and notifications rows added by the earlier desktop-features PR.

## Alternatives considered

**Read a plugin-specific file (e.g. `~/.dsh/qol-prefs.json`) in the shell** — rejected. The shell must not know another project's file layout; the preference store is the shell's own contract, and the bridge is the plugin surface.

**A bare boolean `quitOnClose`** — rejected. An explicit two-value preference matches the existing `DesktopPreferences` normalization style, is self-documenting in the persisted JSON, and leaves room for future behaviors without a migration.
