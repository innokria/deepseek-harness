# @deepseek-ai/dsh-client-ui-update

English | [中文](README.zh.md)

Web desktop-auto-update feature owner: contributes one entry to `sidebar.footer.action` — the footer list directly above the Settings trigger — that surfaces the Electron shell's update status. The status arrives through the preload bridge (`window.dshDesktop.updates`) exposed by the [desktop shell](../../../apps/desktop/README.md); this package issues no RPC and holds no state beyond that bridge subscription.

The badge renders only while an update is in flight: `available` (found, about to download), `downloading` (with a percentage), and `downloaded` (ready to install). A downloaded badge is one action — clicking it quits and installs; otherwise the same install runs on the next ordinary quit, which the shell's quit path already performs. Every other phase, including the absent bridge of a plain `dsh web` browser, renders nothing, so the browser surface never grows a control for a capability it does not have.

Styling uses tokens only; copy goes through the package's own `update` locale namespace. The behavior is specified by the [desktop auto-update Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-desktop-auto-update.md).

## Model Experience

None, as this package renders the shell's update state for a human and touches no prompt, message, schema, stream, or tool result.

#### KV Cache effect

None; the package never assembles or sends provider requests.

## Known Limitations and Deferred Work

- **The bridge is desktop-only** — a plain `dsh web` browser has no `window.dshDesktop`, so there is no in-browser update surface and no fallback check path for non-desktop runs.
- **The badge is informational before install** — it surfaces status and offers "install now", but there is no per-update release-note or progress detail beyond the percentage; a richer panel would be a later feature.
