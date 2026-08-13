# Agent Note: Electron desktop client for macOS and Windows

Status: proposed

English | [中文](2026-08-13-electron-desktop-client.zh.md)

## Problem

The product ships as a CLI (`dsh`) and a Web GUI served by `dsh web` on loopback. A user who wants a desktop experience — dock presence, a tray, native notifications, launch at login, file and deep-link handling, and managed upgrades — must keep a terminal or browser open and run the host themselves. The Web GUI is already a complete client, decoupled from its Node host over loopback HTTP and WebSocket, so the missing piece is a thin native shell, not a second client.

## Proposal

Add an Electron desktop app under `apps/desktop` for macOS and Windows. The renderer is Chromium and loads the loopback origin the harness serves, so the existing React shell, the `window.__DSH_BOOT__` injection, and the `/api` transport run unchanged. The main process runs the harness as a child process and owns the native surface.

The desktop app is a shell, not a reimplementation. It reuses the shipped web host profile — the static frontend, the `/api` bridge, and the client-module graph that injects `window.__DSH_BOOT__` ([client-modules](../../../../docs/subsystems/client-modules.md)). The browser carrier over loopback HTTP POST and the `events.mux`/`events.host` WebSocket downlinks ([connection](../../../../packages/client/connection/README.md)) stays the transport; no new wire protocol is introduced.

### Process model

The Electron main process spawns the harness as a child process and supervises it: start on app launch, restart on unexpected exit under a bounded backoff, graceful shutdown on quit, and stdout/stderr capture to a log file. One app instance holds one harness child; single-instance locking prevents a second app from starting a second host.

The `BrowserWindow` loads `http://127.0.0.1:<port>` only after the child reports readiness, and shows a connecting state before then. The port is the host profile's configured web port (default 3080).

### Why a child process

The harness runs out-of-process on a pinned Node runtime. That removes two couplings at once:

- The repository's Node engine floor is `^22.19 || >=24`. Electron bundles its own Node, and whether a given release satisfies that floor is a per-release fact to re-verify. Bundling a Node 22.19+ (or 24) binary to spawn the child removes that dependency on Electron's internal Node version.
- A crashing host cannot take the Electron main process down; the supervisor restarts it and the window reconnects.

### Native surface

The main process owns the tray menu, application menu, native notifications, launch-at-login, file and deep-link handling, and auto-update. The preload exposes a narrow bridge for only these capabilities, with `contextIsolation: true` and `nodeIntegration: false`. The preload must not re-expose the privileged host methods that the `/api` loopback fence already pins ([connection fence](../../../../packages/client/connection/README.md)); the renderer reaches the host through the same HTTP/WebSocket path as today.

### Node runtime bundling

The app ships a per-platform Node runtime that satisfies the engine floor (macOS arm64/x64, Windows x64) alongside the packaged harness. The child is spawned with that binary, never `process.execPath`.

### Packaging and update

electron-builder produces a signed, notarized `.dmg` for macOS and a signed NSIS installer for Windows. Auto-update uses electron-updater against a release feed. The bundled harness and Node runtime are one atomic app payload; the harness's own upgrade path is subsumed by the app update for desktop users.

### Platform sandbox

The product's code sandbox (landlock) is Linux-only. The desktop app adds no code sandbox on macOS or Windows: macOS relies on the hardened runtime and, where the harness runs untrusted code, the app sandbox; Windows relies on OS policy. This is a stated gap, not something Electron closes.

### Development

Development mode points the window at the Vite dev server (`pnpm run dev:web`) for HMR; production loads the packaged loopback origin. The existing snapshot and browser test suites keep running unchanged against the web host; the Electron shell adds its own smoke test for spawn, supervise, and reconnect.

## Alternatives considered

**Tauri (v2).** Rejected. Its benefit is a small Rust core, but the harness is Node, so a sidecar Node runtime ships either way; the app would maintain Rust and Node toolchains together, and the GUI is developed and tested against Chromium while Tauri renders through the system webview.

**NW.js.** Rejected. Same Chromium-plus-Node model as Electron with a weaker packaging, signing, and update ecosystem.

**PWA plus `dsh web`.** Rejected. It is the current product and provides no tray, login launch, file/deep-link association, or managed upgrade — the capabilities a desktop shell exists to add.

**In-process harness in the Electron main process.** Rejected. It couples the harness to Electron's bundled Node version, which may sit below the `^22.19` floor, and a harness crash would take the window down with it.

**Native UI reimplementation (Swift/WinUI) or a new protocol.** Rejected. The Web GUI is already complete and the transport is already defined; a second client duplicates both with no user-visible gain.

## Acceptance criteria

- A signed macOS `.dmg` and a Windows installer each launch the app, spawn the harness child, and open the existing Web GUI at the loopback origin with no code change to the web host or client shell.
- Quit stops the child cleanly; an unexpected child exit restarts it and the window reconnects after readiness; a second app launch is refused.
- The preload bridge exposes only the enumerated native capabilities; `nodeIntegration` is off, and no privileged host method is reachable outside the existing `/api` loopback fence.
- Native notifications, tray, launch-at-login, and deep-link handling work on both platforms; auto-update delivers a newer app together with its bundled harness and Node runtime.
- The app bundles a Node runtime that satisfies `^22.19 || >=24`, independent of Electron's internal Node version.

## Risks

The desktop shell ships a second Node runtime and a Chromium; install size and resident memory grow versus the CLI. This is the accepted cost of Electron, not a correctness risk.

macOS and Windows gain no code sandbox from the shell. Untrusted model-driven code execution on these platforms stays protected only by OS sandboxing and the existing policy layers, not by landlock.

The preload bridge is a second privileged surface. Keeping it closed to the enumerated capabilities, and routing all host access through the existing `/api` fence, is a security invariant to hold in review.

Auto-update replaces the harness's own upgrade story on desktop. The update feed must treat the bundled harness and Node runtime as one atomic payload; otherwise a user could hold a newer harness inside an older app.
