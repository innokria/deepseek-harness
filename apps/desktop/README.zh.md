# @deepseek-ai/dsh-desktop

[English](README.md) | 中文

DeepSeek Harness 的 Electron 桌面壳。它以受监督的子进程方式运行 harness，并原样承载现有的 Web GUI——渲染层是 Chromium，加载 harness 提供的 loopback 源，因此 `window.__DSH_BOOT__` 注入与 `/api` 传输与在 `dsh web` 下完全一致地工作。

这个壳是一层薄封装：它拉起 `dsh web`，等待就绪行，在所提供的源处打开一个 `BrowserWindow`，并负责关停与崩溃重启。没有重新实现任何 UI。

## 前置条件

- 用于 harness 子进程的 Node `^22.19 || >=24`。
- 开发：`PATH` 上的一个 `dsh` 启动器，或指向它的 `DSH_DESKTOP_DSH_BIN`。
- 打包：仓库已构建（`pnpm run build`），使部署的 CLI 携带其 `lib/` 产物与前端 dist。

## 运行

```sh
pnpm --filter @deepseek-ai/dsh-desktop build
pnpm --filter @deepseek-ai/dsh-desktop start
```

`dev` 会运行这两步。窗口先显示连接中页面，直到 harness 报告就绪，然后加载所提供的源。

## 自包含运行时

打包后的应用不依赖 `PATH` 上的 `dsh`。`prepare:runtime` 在 `vendor/` 下暂存两个捆绑包：

- `vendor/runtime/<platform>-<arch>/`——每个发布目标（macOS arm64/x64、Windows x64）一个可移植的 Node `v22.19.0` 二进制，从 nodejs.org 下载。
- `vendor/harness/`——由 `pnpm deploy` 产出的 `@deepseek-ai/dsh` 闭包，以 `lib/bin.js` 为入口。

electron-builder 通过 `extraResources` 把两者复制进 `resources/`。启动时，这个壳优先使用捆绑的 Node + `dsh` 二进制，仅在捆绑包缺失（开发场景）时才回退到 `PATH`。

```sh
pnpm run build                                  # repo-wide; builds the CLI and frontend
pnpm --filter @deepseek-ai/dsh-desktop dist     # download runtime + deploy harness + package
pnpm --filter @deepseek-ai/dsh-desktop dist:mac # macOS .dmg
pnpm --filter @deepseek-ai/dsh-desktop dist:win # Windows NSIS installer
```

## 发布

一个由 tag 触发的 GitHub Actions 工作流（`.github/workflows/desktop-release.yml`）负责构建并发布安装包。推送一个 `dsh-v*` tag——桌面应用与 dsh 族共享版本与 tag——工作流就会构建 macOS 各架构（arm64/x64）的 `.dmg` 与 Windows x64 的 NSIS 安装包，并把两者作为附件挂到一个标题为 `DeepSeek Harness Desktop <version>` 的 GitHub Release 上。以 `publish: false` 手动触发可只排练构建而不创建 Release。代码签名与公证尚未纳入发布流程。

## 环境变量

| 变量 | 默认值 | 作用 |
|---|---|---|
| `DSH_DESKTOP_DSH_BIN` | `dsh` | 捆绑包缺失时的开发回退启动器。 |
| `DSH_DESKTOP_PORT` | `0` | `dsh web --port` 的值；`0` 让操作系统挑选空闲端口。 |
| `DSH_DESKTOP_LOG_DIR` | 平台日志目录 | 子进程合并的 `harness.log` 所在目录。 |
| `DSH_DESKTOP_NODE_VERSION` | `v22.19.0` | `prepare:runtime` 下载的 Node 版本。 |

子进程的 stdout/stderr 写入 `harness.log`；就绪行（`dsh web: http://127.0.0.1:<port>`）正是监督器所等待的内容。

## 安全态势

`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`。preload（`preload.cjs`）只暴露 `platform`、Electron 版本与一个深链订阅。宿主访问仍走既有的 loopback `/api` 围栏；preload 不重新暴露任何特权宿主方法。

## 已知限制与后续工作

- `pnpm deploy` 闭包必须包含前端 dist（`@deepseek-ai/dsh-web-frontend/dist`）；目前靠真实安装验证，尚未由门禁断言。
- 托盘、原生通知、登录自启与自动更新尚未实现；深链转发已端到端接通。
- 代码签名、公证与更新源尚未配置，因此发布工作流产出的是未签名安装包。
