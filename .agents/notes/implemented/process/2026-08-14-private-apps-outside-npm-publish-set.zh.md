# Agent Note: 私有应用共享 dsh 版本，但留在 npm 发布集之外

Status: implemented

[English](2026-08-14-private-apps-outside-npm-publish-set.md) | 中文

## Problem

`apps/desktop` 是一个 `private` 的 Electron 应用，以 GitHub Release 安装包形式分发，而不是 npm 包。由于它位于 `apps/` 下，dsh 发布家族（`patterns: packages/*/* + apps/*`，见 [2026-08-10-npm-release-sequences.md](2026-08-10-npm-release-sequences.md)）把它卷入了 npm 发布集。对它执行 `pnpm pack` 会带上它的 `lib/**` 构建产物（其中包含声明映射），发布负载策略随即拒绝了 `lib/*.d.ts.map`。工作区约束检查也把它标记为必须去掉 `private: true`、设置 `publishConfig.access` 并声明 `repository` 的发布成员。自桌面应用落地以来，每一次 `release(dsh)` master push 都因这第一个错误在 pack 步骤失败。

## Decision

发布成员分两类：

- **可发布（publishable）**——非 `private`；进入 pack 与 publish 集。
- **仅共享版本（version-only）**——`private: true`；共享家族版本与 tag，但在 npm 之外分发。

`ReleaseFamily.publishableMembers(members)` 是唯一的分界：它返回可发布子集（`manifest.private !== true`）。`bump` 仍推进每一个成员（包括仅共享版本者），因此 `apps/desktop` 保持在同一共享版本上；`verifyVersions` 仍要求整个家族共用一个版本；`pack`、`publish` 以及 `verify` 中的发布门只对可发布成员生效。工作区约束检查现在把发布目录下的 `private` 成员视为仅共享版本者——它必须保持 `private: true`，且不带任何可发布性字段——并且 `apps/*` 包只有在可发布时才需要发布 `files` 策略。

dsh 家族仍然把 `apps/cli` 与 `apps/web` 作为可发布成员打包；只有私有桌面应用被排除，因此安装产物探针与发布顺序对消费者安装的一切保持不变。

## Alternatives considered

- 把 `apps/desktop` 变成可发布的 npm 包（去掉 `private: true`，补上 `files`、`publishConfig.access` 与 `repository`）。否决：以安装包形式分发的 Electron 应用不是可消费的 npm 包，发布它还会把 Electron 与 electron-builder 的 devDependencies 拖给消费者。
- 给 `apps/desktop` 加 `files` 字段，让它留在发布集里但通过 pack。否决：pack 报错只是第一个失败——`private` 包仍会被 `npm publish` 拒绝，也仍无法通过工作区约束检查，这个补丁不能真正让序列可发布。

## Consequences

获得：dsh 的 pack 步骤重新通过，桌面应用继续通过 `bump` 与 `verifyVersions` 共享家族版本与 tag，而无需假装自己是 npm 包。代价：发布机制现在有两种成员，构建 pack 或 publish 集的调用方必须经由 `publishableMembers` 而不是 `members`。
