# Agent Note: Complete the desktop runtime deploy closure

Status: implemented

English | [中文](2026-08-14-desktop-deploy-closure-complete.zh.md)

## Problem

The desktop shell (`apps/desktop`) packages the harness by deploying the `@deepseek-ai/dsh` closure with `pnpm deploy --legacy --prod --config.auto-install-peers=false` and copying it into `resources/harness`. That closure was incomplete in three ways: peer dependencies are not auto-installed, `link:`-overridden workspace packages (`@deepseek-ai/cosmokit`, `@deepseek-ai/schemastery`) are materialized as symlinks back to the build checkout, and the legacy deploy hoists some direct dependencies (bundle and shell packages) beside the source instead of into the target. The packaged app therefore crashed its supervised `dsh web` child with `ERR_MODULE_NOT_FOUND` on `@deepseek-ai/cordis-plugin-group` and hung forever on the connecting page. The closure was only "verified against a real install" in the README and had no gate, so the omission shipped undetected.

## Decision

`apps/cli` (`@deepseek-ai/dsh`) is the desktop deploy root; its `dependencies` now list every non-optional workspace peer in its dependency graph, mirroring the Python SDK's `dsh-jsonrpc-agent-pkg` leaf manifest. `apps/desktop/scripts/prepare-runtime.mjs` ports the two post-deploy steps `scripts/build-exe-for-python-sdk.ts` already performs: `restoreLegacyHoists` copies any direct dependency the legacy deploy omitted, from `apps/cli/node_modules` with the package-local `node_modules` dropped; `materializeStagedLinks` replaces every remaining symlink with a dereferenced file copy and removes `.bin` shims. `scripts/verify-runtime-closure.ts` checks both deploy roots by default (`python/sdk-runtime` and `apps/cli`), so a missing peer fails `pnpm run hygiene` instead of a first install.

## Alternatives considered

**Enable automatic peer installation (`--config.auto-install-peers=true`).** Rejected: the deploy flags are deliberately fixed to keep the closure to exactly what the manifest declares, and undeclared peers would expand it. The leaf-manifest-plus-explicit-peers approach is the measured pattern the Python SDK already owns.

**Deploy a dedicated leaf manifest instead of `apps/cli`.** Rejected: `apps/cli` is already the deploy root and its `lib/bin.js` is the entry; a second manifest would duplicate the peer list the verification gate now owns.

**Leave `link:` symlinks in place.** Rejected: they resolve to the build machine's checkout, so a packaged app fails at module resolution on any other machine.

**Skip the gate and document the gap.** Rejected: the gap already shipped once precisely because it was documented but not enforced.

## Consequences

The desktop installer's bundled harness reaches readiness (`dsh web: http://127.0.0.1:<port>`), verified by running `prepare-runtime.mjs` and booting the staged closure with the bundled Node. Adding a workspace peer to the runtime graph without listing it in `apps/cli` now fails `verify-runtime-closure`, and the two post-deploy steps keep the packaged payload symlink-free and single-instance. The deploy remains `--legacy`-only; the restore and materialize steps must stay in step with `build-exe-for-python-sdk.ts` if that script's deploy flags change.
