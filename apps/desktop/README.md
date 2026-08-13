# @deepseek-ai/dsh-desktop

English | [中文](README.zh.md)

Electron desktop shell for DeepSeek Harness. It runs the harness as a supervised child process and hosts the existing Web GUI unchanged — the renderer is Chromium and loads the loopback origin the harness serves, so `window.__DSH_BOOT__` injection and the `/api` transport work exactly as under `dsh web`.

The shell is a thin layer: it spawns `dsh web`, waits for the readiness line, opens one `BrowserWindow` at the served origin, and owns shutdown and crash-restart. No UI is reimplemented.

## Prerequisites

- Node `^22.19 || >=24` for the harness child.
- Development: a `dsh` launcher on `PATH`, or `DSH_DESKTOP_DSH_BIN` pointing at one.
- Packaging: the repository built (`pnpm run build`), so the deployed CLI carries its `lib/` artifacts and the frontend dist.

## Run

```sh
pnpm --filter @deepseek-ai/dsh-desktop build
pnpm --filter @deepseek-ai/dsh-desktop start
```

`dev` runs both steps. The window shows a connecting page until the harness reports ready, then loads the served origin.

## Self-contained runtime

A packaged app does not rely on a `PATH` `dsh`. `prepare:runtime` stages two bundles under `vendor/`:

- `vendor/runtime/<platform>-<arch>/` — a portable Node `v22.19.0` binary per shipped target (macOS arm64/x64, Windows x64), downloaded from nodejs.org.
- `vendor/harness/` — the `@deepseek-ai/dsh` closure produced by `pnpm deploy`, with `lib/bin.js` as the entry.

electron-builder copies both into `resources/` via `extraResources`. At launch the shell prefers the bundled Node + `dsh` bin and falls back to `PATH` only when the bundle is absent (development).

```sh
pnpm run build                                  # repo-wide; builds the CLI and frontend
pnpm --filter @deepseek-ai/dsh-desktop dist     # download runtime + deploy harness + package
pnpm --filter @deepseek-ai/dsh-desktop dist:mac # macOS .dmg
pnpm --filter @deepseek-ai/dsh-desktop dist:win # Windows NSIS installer
```

## Release

A tag-triggered GitHub Actions workflow (`.github/workflows/desktop-release.yml`) builds and publishes the installers. Push a `dsh-v*` tag — the desktop app shares the dsh family's version and tag — and the workflow builds a macOS arm64 `.dmg` and a Windows x64 NSIS installer, then attaches both to a GitHub Release titled `DeepSeek Harness Desktop <version>`. A manual dispatch with `publish: false` rehearses the build without creating a release. The macOS installer is signed with a Developer ID Application identity and notarized; the Windows installer is unsigned until an Authenticode certificate is added. A macOS x64 installer is deferred until the harness's native dependencies are built for x64.

## Environment

| Variable | Default | Effect |
|---|---|---|
| `DSH_DESKTOP_DSH_BIN` | `dsh` | Development fallback launcher when the bundle is absent. |
| `DSH_DESKTOP_PORT` | `0` | `dsh web --port` value; `0` lets the OS pick a free port. |
| `DSH_DESKTOP_LOG_DIR` | platform log dir | Directory for the child's combined `harness.log`. |
| `DSH_DESKTOP_NODE_VERSION` | `v22.19.0` | Node version `prepare:runtime` downloads. |

The child's stdout/stderr go to `harness.log`; the readiness line (`dsh web: http://127.0.0.1:<port>`) is what the supervisor waits for.

## Security posture

`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. The preload (`preload.cjs`) exposes only `platform`, the Electron version, and a deep-link subscription. Host access stays on the existing loopback `/api` fence; the preload re-exposes no privileged host method.

## Known Limitations and Deferred Work

- The `pnpm deploy` closure must include the frontend dist (`@deepseek-ai/dsh-web-frontend/dist`); this is verified against a real install, not yet asserted by a gate.
- Tray, native notifications, launch-at-login, and auto-update are unimplemented; deep-link forwarding is wired end to end.
- The macOS installers are signed and notarized; the Windows installer is unsigned (no Authenticode certificate yet) and the auto-update feed is not configured.
