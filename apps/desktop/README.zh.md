# DeepSeek Harness Desktop

[English](README.md) | 中文

<p align="center">
  <img src="build/icon.png" width="96" alt="DeepSeek Harness logo" />
</p>

<p align="center">
  <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> 的桌面壳：以受监督的子进程方式运行 harness，并原样承载现有的 Web GUI。
</p>

<p align="center">
  <a href="../../LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-171513.svg" /></a>
  <img alt="macOS" src="https://img.shields.io/badge/macOS-Apple%20Silicon-171513.svg" />
  <img alt="Windows" src="https://img.shields.io/badge/Windows-x64-171513.svg" />
</p>

<p align="center">
  <img src="docs/images/deepseek-harness-desktop.png" width="900" alt="DeepSeek Harness desktop window" />
</p>

这个壳是一层薄封装：它拉起 `dsh web`，等待就绪行，在所提供的 loopback 源处打开一个 `BrowserWindow`，并负责关停与崩溃重启。渲染层是加载该源的 Chromium，因此 `window.__DSH_BOOT__` 注入与 `/api` 传输和 `dsh web` 下完全一致。没有重新实现任何 UI。

> [!NOTE]
> DeepSeek Harness 目前处于开发者预览阶段，会有破坏兼容性的变更，本壳也随之跟进。macOS 安装包已签名并公证；Windows 安装包尚未签名，因此 Windows SmartScreen 首次打开时会提示。

## 下载

安装包发布在 [Releases](https://github.com/salathleizhang/deepseek-harness-desktop/releases) 页，文件名携带 dsh 版本（`DeepSeek Harness-<version>-<arch>`）。

| 平台 | 安装包 | 下载 |
| --- | --- | --- |
| macOS Apple Silicon | DMG 安装包（arm64） | [Releases](https://github.com/salathleizhang/deepseek-harness-desktop/releases) |
| Windows x64 | NSIS 安装包 | [Releases](https://github.com/salathleizhang/deepseek-harness-desktop/releases) |

macOS Intel（x64）要等 harness 的原生依赖完成 x64 构建后再补上；不支持 Windows ARM64。

## 为什么存在这个项目

DeepSeek Harness 已经提供完整的 agent 运行时与 Web GUI。这个壳不重新实现 Harness，只补充桌面产品所需的宿主能力：

- 无需手动启动 CLI 或管理本地端口即可运行。
- 在一处监督 harness 子进程——就绪、日志、关停与崩溃重启。
- 捆绑可移植的 Node 运行时与 harness 闭包，使打包后的应用不依赖 `PATH` 上的 `dsh`，升级也不影响用户数据。
- 用 Electron 的隔离选项加固渲染层。

## 特性

- 直接打开 harness 的 Web GUI，在子进程报告就绪前显示连接中页面。
- 持有单实例锁；第二次启动会聚焦已有窗口。
- 在意外退出后以指数退避重启 harness。
- 退出时优雅关闭子进程（先 SIGTERM，超时后 SIGKILL）。
- 将 `dsh://` 深链转发给渲染层。
- 只监听随机的 `127.0.0.1` 端口（默认 `--port 0`）。
- 在窗口、macOS Dock 与打包的 `.icns`/`.ico` 中使用 DSH 品牌图标。

## 快速开始

### 前置条件

- 用于 harness 子进程的 Node `^22.19 || >=24`。
- 开发：仓库已构建（`pnpm run build`），或 `DSH_DESKTOP_DSH_BIN` 指向一个 `dsh` 启动器。
- 打包：仓库已构建，使部署的 CLI 携带其 `lib/` 产物与前端 dist。

### 本地开发

```sh
pnpm --filter @deepseek-ai/dsh-desktop dev
```

`dev` 会构建这个壳并启动 Electron；`build` 与 `start` 则分两步运行。窗口先显示连接中页面，直到 harness 报告就绪，然后加载所提供的源。

### 打包

```sh
pnpm run build                                  # repo-wide; builds the CLI and frontend
pnpm --filter @deepseek-ai/dsh-desktop dist:mac # macOS .dmg
pnpm --filter @deepseek-ai/dsh-desktop dist:win # Windows x64 NSIS installer
```

`dist` 构建这个壳、暂存自包含运行时，并针对当前平台打包；`dist:mac` 与 `dist:win` 固定目标平台。由于 harness 带架构相关的原生模块，需在各自的系统上构建安装包：`dist:mac` 在 macOS 上，`dist:win` 在 Windows 上。

## 运行时架构

```text
DSH Desktop (Electron main)
├── HarnessSupervisor — child lifecycle, readiness, logs, crash-restart
├── Single-instance lock and dsh:// deep-link forwarding
└── Hardened BrowserWindow
     └── http://127.0.0.1:<random>  DeepSeek Harness Web UI

Electron resources (packaged)
├── runtime/<platform>-<arch>/  bundled Node v22.19.0
└── harness/                    deployed @deepseek-ai/dsh closure
```

## 自包含运行时

打包后的应用不依赖 `PATH` 上的 `dsh`。`prepare:runtime` 在 `vendor/` 下暂存两个捆绑包，并裁剪打包应用从不加载的内容：

- `vendor/runtime/<platform>-<arch>/`——一个匹配构建宿主机架构的可移植 Node `v22.19.0` 二进制（macOS arm64 或 x64、Windows x64），从 nodejs.org 下载，并移除 `include/` 头文件。
- `vendor/harness/`——由 `pnpm deploy` 产出的 `@deepseek-ai/dsh` 闭包，以 `lib/bin.js` 为入口，并移除其他平台的 `node-pty` 预编译二进制与 `@mistralai/mistralai` 源码树。

electron-builder 通过 `extraResources` 把两者复制进 `resources/`。启动时这个壳优先使用捆绑的 Node + `dsh` 二进制，仅在捆绑包缺失（开发场景）时才依次回退到 `DSH_DESKTOP_DSH_BIN`、仓库已构建的 CLI。

## 发布

一个由 tag 触发的 workflow（[desktop-release.yml](../../.github/workflows/desktop-release.yml)）负责构建并发布安装包。推送 `dsh-v*` tag——桌面应用与 dsh 族共享版本与 tag——就会构建 macOS arm64 的 `.dmg` 与 Windows x64 的 NSIS 安装包，并把两者作为附件挂到标题为 `DeepSeek Harness Desktop <version>` 的 GitHub Release 上。以 `publish: false` 手动触发可只排练构建而不创建 Release。

- macOS：使用 Developer ID Application 身份签名并已公证。
- Windows：在加入 Authenticode 证书之前仍为未签名。
- macOS x64：要等 harness 的原生依赖完成 x64 构建后再补上。

## 环境变量

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `DSH_DESKTOP_DSH_BIN` | 未设置 | 捆绑包缺失时的开发启动器；回退到仓库已构建的 CLI。 |
| `DSH_DESKTOP_PORT` | `0` | `dsh web --port` 的值；`0` 让操作系统挑选空闲端口。 |
| `DSH_DESKTOP_LOG_DIR` | 平台日志目录 | 子进程合并的 `harness.log` 所在目录。 |
| `DSH_DESKTOP_NODE_VERSION` | `v22.19.0` | `prepare:runtime` 下载的 Node 版本。 |
| `DSH_DESKTOP_ARCH` | `process.arch` | `prepare:runtime` 暂存的 Node 运行时架构；跨架构构建时覆盖宿主机架构。 |

子进程的 stdout/stderr 写入 `harness.log`；就绪行（`dsh web: http://127.0.0.1:<port>`）正是监督器所等待的内容。

## 安全态势

`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`。preload（`preload.cjs`）只暴露 `platform`、Electron 版本与一个深链订阅。宿主访问仍走既有的 loopback `/api` 围栏；preload 不重新暴露任何特权宿主方法。

## 已知限制

- `pnpm deploy` 闭包必须包含前端 dist（`@deepseek-ai/dsh-web-frontend/dist`）；目前靠真实安装验证，尚未由门禁断言。
- 托盘、原生通知、登录自启与自动更新尚未实现；深链转发已端到端接通。
- macOS 安装包已签名并公证；Windows 安装包仍为未签名，自动更新源亦未配置。
