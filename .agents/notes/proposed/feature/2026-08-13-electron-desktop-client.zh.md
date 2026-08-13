# Agent Note: macOS 与 Windows 的 Electron 桌面客户端

Status: proposed

[English](2026-08-13-electron-desktop-client.md) | 中文

## 问题

产品以 CLI（`dsh`）和由 `dsh web` 在 loopback 上提供的 Web GUI 形式发布。想要桌面体验的用户——Dock 常驻、托盘、原生通知、登录自启、文件与深链处理、受管的升级——必须自己保持一个终端或浏览器打开并运行宿主。Web GUI 已经是一个完整的客户端，通过 loopback HTTP 与 WebSocket 与其 Node 宿主解耦，因此缺失的只是一层薄原生壳，而非第二个客户端。

## 提案

为 macOS 与 Windows 在 `apps/desktop` 下新增一个 Electron 桌面应用。渲染层是 Chromium，加载宿主提供的 loopback 源，因此现有的 React 壳、`window.__DSH_BOOT__` 注入与 `/api` 传输原样运行。主进程以子进程方式运行 harness，并拥有原生能力。

桌面应用是一层壳，不是重实现。它复用已发布的 Web 宿主 profile——静态前端、`/api` 桥接，以及注入 `window.__DSH_BOOT__` 的 client-module 图（[client-modules](../../../../docs/subsystems/client-modules.md)）。经 loopback HTTP POST 与 `events.mux`/`events.host` WebSocket 下行流的浏览器载体（[connection](../../../../packages/client/connection/README.md)）仍是传输层；不引入新的线上协议。

### 进程模型

Electron 主进程以子进程方式拉起 harness 并监督它：应用启动时启动、异常退出时在有限退避内重启、退出时优雅关停，并把 stdout/stderr 捕获到日志文件。一个应用实例持有一个 harness 子进程；单实例锁阻止第二个应用再启动第二个宿主。

`BrowserWindow` 仅在子进程报告就绪后才加载 `http://127.0.0.1:<port>`，此前显示连接中状态。端口是宿主 profile 配置的 Web 端口（默认 3080）。

### 为何用子进程

harness 在固定的 Node 运行时上以进程外方式运行。这同时消除了两个耦合：

- 仓库的 Node 引擎下限是 `^22.19 || >=24`。Electron 自带一份 Node，某个发行版是否满足该下限是一个需要逐版复核的事实。捆绑一个满足下限的 Node 22.19+（或 24）二进制来拉起子进程，就消除了对 Electron 内部 Node 版本的依赖。
- 崩溃的宿主无法拖垮 Electron 主进程；监督器重启它，窗口重新连接。

### 原生能力

主进程拥有托盘菜单、应用菜单、原生通知、登录自启、文件与深链处理以及自动更新。preload 仅为这些能力暴露一个窄桥接，并设置 `contextIsolation: true` 与 `nodeIntegration: false`。preload 不得重新暴露 `/api` loopback 围栏已钉死的特权宿主方法（[connection 围栏](../../../../packages/client/connection/README.md)）；渲染层通过与此前相同的 HTTP/WebSocket 路径访问宿主。

### Node 运行时打包

应用随打包的 harness 一起分发满足引擎下限的按平台 Node 运行时（macOS arm64/x64、Windows x64）。子进程用该二进制拉起，绝不用 `process.execPath`。

### 打包与更新

electron-builder 为 macOS 产出已签名、已公证的 `.dmg`，为 Windows 产出已签名的 NSIS 安装器。自动更新使用 electron-updater 对接发布源。捆绑的 harness 与 Node 运行时是一个原子的应用载荷；对桌面用户而言，harness 自身的升级路径被应用更新取代。

### 平台沙箱

产品的代码沙箱（landlock）仅限 Linux。桌面应用不在 macOS 或 Windows 上增加代码沙箱：macOS 依赖 hardened runtime，并在 harness 运行不可信代码时依赖 app sandbox；Windows 依赖操作系统策略。这是一个明确的缺口，Electron 不会弥补它。

### 开发

开发模式把窗口指向 Vite 开发服务器（`pnpm run dev:web`）以获得 HMR；生产模式加载打包后的 loopback 源。现有的快照与浏览器测试套件继续原样针对 Web 宿主运行；Electron 壳为 spawn、监督与重连增加自己的冒烟测试。

## 考虑过的替代方案

**Tauri（v2）。** 否决。其优势是小的 Rust 核心，但 harness 是 Node，无论如何都要随包分发 sidecar Node 运行时；应用将同时维护 Rust 与 Node 两套工具链，而且 GUI 是针对 Chromium 开发与测试的，Tauri 却通过系统 webview 渲染。

**NW.js。** 否决。与 Electron 同属 Chromium+Node 模型，但打包、签名与更新生态更弱。

**PWA 加 `dsh web`。** 否决。它是当前产品，且不提供托盘、登录启动、文件/深链关联或受管升级——而这些正是桌面壳存在的意义。

**在 Electron 主进程内运行 harness。** 否决。它把 harness 耦合到 Electron 自带的 Node 版本上（可能低于 `^22.19` 下限），且 harness 崩溃会把窗口一起拖垮。

**原生 UI 重实现（Swift/WinUI）或新协议。** 否决。Web GUI 已完整，传输层已定义；第二个客户端会重复这两者而没有用户可见的收益。

## 验收标准

- 已签名的 macOS `.dmg` 与 Windows 安装器都能启动应用、拉起 harness 子进程，并在 loopback 源上打开现有 Web GUI，而无需改动 Web 宿主或客户端壳的代码。
- 退出时干净停止子进程；子进程异常退出时重启它，窗口在就绪后重连；第二次应用启动被拒绝。
- preload 桥接只暴露上述原生能力；`nodeIntegration` 关闭，且没有任何特权宿主方法能在现有 `/api` loopback 围栏之外被触达。
- 原生通知、托盘、登录自启与深链处理在两个平台都工作；自动更新连同捆绑的 harness 与 Node 运行时一起交付新版本。
- 应用捆绑的 Node 运行时满足 `^22.19 || >=24`，与 Electron 内部 Node 版本无关。

## 风险

桌面壳随包分发第二份 Node 运行时和一份 Chromium；与 CLI 相比安装体积与常驻内存增大。这是 Electron 被接受的成本，而非正确性风险。

macOS 与 Windows 不会从壳获得代码沙箱。这些平台上不可信的模型驱动代码执行仍只受操作系统沙箱与现有策略层保护，而非 landlock。

preload 桥接是第二个特权面。让它仅对上述能力开放，并把所有宿主访问都经现有 `/api` 围栏路由，是评审中必须守住的安全不变量。

自动更新在桌面上取代了 harness 自身的升级路径。更新源必须把捆绑的 harness 与 Node 运行时视为一个原子载荷；否则用户可能在新应用里运行旧 harness。
