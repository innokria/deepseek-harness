# Agent Note: Private apps share the dsh version but stay out of the npm publish set

Status: implemented

English | [中文](2026-08-14-private-apps-outside-npm-publish-set.zh.md)

## Problem

`apps/desktop` is a `private` Electron app distributed as GitHub Release installers, not an npm package. Because it lives under `apps/`, the dsh release family (`patterns: packages/*/* + apps/*`, see [2026-08-10-npm-release-sequences.md](2026-08-10-npm-release-sequences.md)) swept it into the npm publish set. Packing it with `pnpm pack` carried its `lib/**` build output, declaration maps included, and the publication payload policy rejected `lib/*.d.ts.map`. The workspace constraint check also flagged it as a release member that must drop `private: true`, set `publishConfig.access`, and declare a repository. Every `release(dsh)` master push since the desktop app landed failed the pack step on that first error.

## Decision

A release member is one of two kinds:

- **Publishable** — not `private`; it enters the pack and publish sets.
- **Version-only** — `private: true`; it shares the family version and tag but ships outside npm.

`ReleaseFamily.publishableMembers(members)` is the single boundary: it returns the publishable subset (`manifest.private !== true`). `bump` keeps advancing every member, version-only included, so `apps/desktop` stays on the shared version; `verifyVersions` keeps holding the whole family to one version; `pack`, `publish`, and the publish gate in `verify` operate only on the publishable members. The workspace constraint check now treats a `private` member under a release directory as version-only — it must keep `private: true` and carries none of the publishability fields — and an `apps/*` package needs a publication `files` policy only when it is publishable.

The dsh family still packs `apps/cli` and `apps/web` as publishable members; only the private desktop app is excluded, so the installed-artifact probe and the publish order are unchanged for everything a consumer installs.

## Alternatives considered

- Make `apps/desktop` a publishable npm package (drop `private: true`, add `files`, `publishConfig.access`, and `repository`). Rejected: an Electron app shipped as installers is not a consumable npm package, and publishing it would drag Electron and electron-builder devDependencies onto consumers.
- Add a `files` field to `apps/desktop` so its pack passes while it stays in the publish set. Rejected: the pack error was only the first failure — a `private` package is still refused by `npm publish` and still fails the workspace constraint check, so this shim would not make the sequence publish.

## Consequences

Bought: the dsh pack step passes again, and the desktop app keeps sharing the family version and tag through `bump` and `verifyVersions` without pretending to be an npm package. Cost: the release machinery now carries two member kinds, and callers that build a pack or publish set must route through `publishableMembers` rather than `members`.
