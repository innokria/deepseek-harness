# Agent Note: prune the desktop runtime bundle to a single-arch Node and a lean harness closure

Status: implemented

English | [中文](2026-08-14-prune-desktop-runtime-bundle.zh.md)

## Problem

An installed `DeepSeek Harness.app` measured ~976 MB: Electron's `Electron Framework.framework` (~274 MB), two complete Node runtimes under `resources/runtime/` (`darwin-arm64` 177 MB and `darwin-x64` 180 MB), and the deployed `@deepseek-ai/dsh` closure (~328 MB). The app runs one Node binary and one platform's native modules, so one whole runtime and a slice of the closure were content no install ever loads.

## Decision

`prepare-runtime.mjs` stages a single Node runtime — the build host's architecture (`process.arch`, overridable via `DSH_DESKTOP_ARCH`) — and prunes artifacts the packaged app never loads:

- The Node distribution's `include/` C/C++ headers are dropped after extraction; they exist only to compile native addons, which the bundled runtime never does.
- `node-pty` prebuilds are reduced to the target platform's directory. node-pty ships every platform in one tarball, but its `loadNativeModule` builds only `prebuilds/${process.platform}-${process.arch}/pty.node`, so foreign-platform directories (`darwin-x64`, `win32-arm64`, `win32-x64` on an arm64 mac) are removed.
- `@mistralai/mistralai` source trees (`src/`, `examples/`, `tests/`, `packages/`) are removed wherever the package is nested — currently under `@earendil-works/pi-ai`, whose conflicting version keeps it un-hoisted; only the compiled `esm/` entry its `default` export points at is imported at runtime.

The arm64 `.app` drops to ~680 MB: Electron is unchanged, `resources/runtime/` falls from ~358 MB to ~124 MB (one arch, no headers), and the closure falls from ~328 MB to ~263 MB.

## Alternatives considered

**Keep both macOS architectures in one installer.** Rejected: the arm64 runner publishes only an arm64 `.dmg`, so the `darwin-x64` runtime it staged was never used by any install; a macOS x64 installer remains deferred (see [the desktop release workflow note](2026-08-13-desktop-release-workflow.md)).

**Prune at the dependency level instead of a post-deploy pass.** Rejected: node-pty's all-platform tarball and mistralai's published source tree are upstream packaging choices; a post-deploy prune keeps the harness's dependency declarations intact and locates nested packages with a directory walk instead of hard-coded paths.

**Leave the headers and foreign prebuilds in place.** Rejected: they are ~110 MB of content no packaged app can exercise, and the prune is deterministic.

## Consequences

- **~300 MB of installer content is gone with no capability removed.** The pruned Node still runs the harness child; the pruned closure still loads the target platform's node-pty native module and mistralai's `esm/` entry.
- **`DSH_DESKTOP_ARCH` is the cross-build escape hatch.** A future native x64 job sets it to stage a `darwin-x64` runtime; single-arch staging is what makes that correct, replacing the previous always-both behavior.
- **The prune runs after every `pnpm deploy` and is idempotent.** `rmSync(..., { force: true })` tolerates paths an upstream version later stops shipping.
