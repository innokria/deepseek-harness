# Agent Note: 把桌面运行时捆绑包精简为单一架构 Node 与精简的 harness 闭包

Status: implemented

[English](2026-08-14-prune-desktop-runtime-bundle.md) | 中文

## Problem

一个已安装的 `DeepSeek Harness.app` 实测约 976 MB：Electron 的 `Electron Framework.framework`（约 274 MB）、`resources/runtime/` 下两份完整 Node 运行时（`darwin-arm64` 177 MB 与 `darwin-x64` 180 MB），以及部署的 `@deepseek-ai/dsh` 闭包（约 328 MB）。应用只运行一个 Node 二进制与一个平台的原生模块，因此整整一份运行时与闭包的一小片，都是任何安装都不会加载的内容。

## Decision

`prepare-runtime.mjs` 现在只暂存单一 Node 运行时——构建宿主机的架构（`process.arch`，可用 `DSH_DESKTOP_ARCH` 覆盖）——并裁剪打包应用从不加载的构件：

- 解压后丢弃 Node 发行版的 `include/` C/C++ 头文件；它们只用于编译原生插件，而捆绑的运行时从不编译。
- `node-pty` 预编译二进制削减到目标平台目录。node-pty 把每个平台都打进一个 tarball，但它的 `loadNativeModule` 只构造 `prebuilds/${process.platform}-${process.arch}/pty.node`，因此其他平台目录（arm64 mac 上的 `darwin-x64`、`win32-arm64`、`win32-x64`）被移除。
- `@mistralai/mistralai` 源码树（`src/`、`examples/`、`tests/`、`packages/`）在任何嵌套位置都被移除——目前位于 `@earendil-works/pi-ai` 之下（其冲突版本使它无法提升）；运行时只导入其 `default` 导出所指向的编译后 `esm/` 入口。

arm64 的 `.app` 降到约 680 MB：Electron 不变，`resources/runtime/` 从约 358 MB 降到约 124 MB（单一架构、无头文件），闭包从约 328 MB 降到约 263 MB。

## Alternatives considered

**在一个安装包里保留两个 macOS 架构。** 不采用：arm64 runner 只发布 arm64 的 `.dmg`，它暂存的 `darwin-x64` 运行时从未被任何安装使用；macOS x64 安装包仍被延后（见[桌面发布工作流 note](2026-08-13-desktop-release-workflow.md)）。

**在依赖层面裁剪，而不是部署后再裁剪。** 不采用：node-pty 的全平台 tarball 与 mistralai 发布的源码树是上游打包选择；部署后再裁剪能保持 harness 的依赖声明不变，并用目录遍历定位嵌套包，而非硬编码路径。

**保留头文件与外来平台预编译二进制。** 不采用：它们是约 110 MB 任何打包应用都无法用到的内容，且裁剪是确定性的。

## Consequences

- **约 300 MB 安装包内容被移除，且未损失任何能力。** 精简后的 Node 仍能运行 harness 子进程；精简后的闭包仍能加载目标平台的 node-pty 原生模块与 mistralai 的 `esm/` 入口。
- **`DSH_DESKTOP_ARCH` 是交叉构建的逃生通道。** 未来的原生 x64 作业可设置它来暂存 `darwin-x64` 运行时；单一架构暂存正是使其正确的关键，取代了先前「始终双份」的行为。
- **裁剪在每次 `pnpm deploy` 之后运行且幂等。** `rmSync(..., { force: true })` 能容忍上游版本日后不再发布的路径。
