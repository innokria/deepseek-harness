# Agent Note: 桌面壳从托盘与连接中卡顿打开日志

Status: implemented

[English](2026-08-18-desktop-open-log-on-connecting-stall.md) | 中文

## Problem

桌面壳（`apps/desktop`）在受监督的 harness 子进程打印就绪行之前，会显示一段写死的中文「连接中」占位页。当子进程始终没有报告就绪时，用户没有任何方式看到原因：唯一能反映失败的位置是 `harness.log`，而监督器把它写到 `%APPDATA%/dsh-desktop/logs/`（macOS 在 `~/Library/Logs/dsh-desktop/`）下；托盘菜单也没有入口能打开这份文件。连接中页面本身也是写死中文——所以即便 Electron 区域是 `en-*`，用户看到的中文页面里也没有任何入口可以从当前可见窗口打开日志。

## Decision

两项改动共用同一个 IPC 通道（`dsh:open-log`）与同一个 `revealLogFile` 分派器：

- `apps/desktop/src/connecting-page.ts` 用一个纯函数 `renderConnectingPage({ locale, timedOut })` 渲染连接中占位页。区域在 `boot()` 中由 `detectConnectingLocale(app.getLocale())` 一次性决定——以 `zh` 开头为 `zh`，其余都是 `en`。文案与可选按钮放在同一个 `.stack` 里，让居中网格只有一个子节点。`body` 保留 `-webkit-app-region: drag`，无边框的 Windows 窗口在连接中仍可拖动；按钮用 `no-drag`，点击才能到达 IPC。
- `apps/desktop/src/log.ts` 拥有「打开日志」的决策。`planLogReveal(logFile, fileExists)` 在文件存在时返回 `show-item-in-folder`，文件缺失时返回 `open-path` 到 `dirname(logFile)`——永远不预先创建空日志文件，磁盘上的时间戳始终反映 harness 真实输出。`revealLogFile` 接受注入的 `LogRevealShell`，单元测试完全不会触碰 `shell.showItemInFolder` 或系统文件管理器。
- `apps/desktop/src/main.ts` 在 `buildTrayMenu()` 的「Open Window」正下方新增「Open log」托盘项（开机自启与通知仍在分隔线以下），注册 `ipcMain.handle('dsh:open-log', () => handleOpenLog())`，并在 `showConnecting()` 中按窗口启动连接中计时器。`loadWindow` 切到真实源时清掉计时器；每次重新渲染连接中页（首次挂载与每一次 `restart`）都重新启动——慢速重启也能拿到完整的新窗口期。`ready` 仍走 `loadWindow`。超时回调在切换文案前会再看一次 `supervisor.url`：就绪行如果在定时器已触发、回调尚未执行时到达，卡住占位页不得盖住已经加载的 GUI。超时只切换页面文案，永远不会终止子进程。
- `preload.cjs` 暴露 `openLog()`，返回 `{ kind: 'file' | 'directory', error }`。该桥只暴露配置好的 `harness.log`；日志路径不会暴露给渲染层。既有的窗口控制、偏好、深链与更新桥保持不变。
- `DesktopEnv.connectingTimeoutMs` 默认为 15_000，可由 `DSH_DESKTOP_CONNECTING_TIMEOUT_MS` 覆盖，解析走与 `DSH_DESKTOP_UPDATE_INTERVAL_MS` 相同的既有 `positiveInt` 辅助函数。

## Alternatives considered

**托盘加「Restart harness」而不是「Open log」。** 否决：首次启动就卡住时，重启通常会撞同一个 bug；用户先得看日志才知道「卡在哪」。「Open log」解决的是诊断那一半；想重启走 Quit + 重新打开即可。

**超时后杀掉子进程并弹结构化错误对话框。** 否决：harness 就绪行在慢盘或首次模型加载时合理可能超过 15s，监督器也已经带指数退避自动重启。强制杀进程会丢掉一次本来会成功的启动。

**每次都先写一个空 `harness.log` 再 `showItemInFolder`。** 否决：开机就出现空日志文件会误导任何扫一眼该目录的人——「harness 是没输出，还是没启动？」。打开父目录才是诚实的状态：目录是监督器创建的，文件缺失是因为子进程确实什么都没写。

**把「打开日志」逻辑塞进 `HarnessSupervisor`。** 否决：监督器是 harness 范畴（一个子进程、它的就绪行、它的生命周期）；「打开日志」是桌面壳范畴（托盘、连接中页、IPC、区域）。分开与已有的 `window-lifecycle.ts` 切分一致，也允许在没有真实子进程的情况下测试。

**用 `dialog.showMessageBox` 在窗口里内嵌显示日志。** 否决：用户希望在系统文件管理器里看真正的 `harness.log`——可以 tail、grep、交给支持人员。托盘在连接中窗口隐藏时仍可触达；按钮无论窗口是否隐藏都可用；内嵌对话框则不得不和活跃的渲染器争抢焦点。

**让连接中页保持挂载，靠 IPC 改文案而不是重渲染。** 否决：现有模式（`loadURL('data:text/html;...')`）正是 `restart` 走的路径；走 IPC 改文案会和它分叉，并引入一条新的 renderer↔main 通道来承载唯一会变化的状态。重渲染是有界的，计时器是一次性的，代价仅是 15s 之后一次 `loadURL`。

## Consequences

连接中页变成中英双语，并在 15s 内未收到就绪行时显示「打开日志」按钮。「Open log」托盘项始终可用，因此连接中窗口隐藏的用户也能找到日志。监督器本身没有改动：意外退出时仍发 `restart`，连接中计时器在每次 `restart` 时重置——慢速重启也能拿到完整的窗口期。迟到的超时不会覆盖已经加载的源。揭示处理器从不读日志内容，也从不接受渲染层的任意路径；渲染层唯一能让主进程做的就是打开配置好的 `harness.log`（缺失时打开父目录）。`DSH_DESKTOP_CONNECTING_TIMEOUT_MS` 允许集成方为已知的快启动 harness 缩短占位页到按钮的等待时间，不必重新构建壳。
