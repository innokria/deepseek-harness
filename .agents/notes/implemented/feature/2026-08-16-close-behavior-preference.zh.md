# Agent Note：关闭行为偏好——关闭窗口可以退出而不是隐藏到托盘

Status: implemented

[English](2026-08-16-close-behavior-preference.md) | 中文

## 问题

桌面壳的 `onWindowClose` 总是把窗口隐藏到托盘并保持 Host 存活；没有任何受支持的方式让关闭窗口退出应用。想要在关闭主窗口时退出壳的插件（或用户）既没有可设置的偏好，也没有可调用的桥接。把「关闭即退出」硬编码则会破坏所有人既有的托盘默认行为。

## 决策

一个 `closeBehavior: 'tray' | 'quit'` 偏好加入壳已有的 `DesktopPreferences`（默认 `'tray'`，保持现有行为）。`normalizePreferences` 把无效值强制回默认值，与既有的布尔字段逐字段强制方式一致。

生命周期拥有这个决策，保持无 Electron 依赖、可单元测试：`createDesktopLifecycle` 接受可选的 `readCloseBehavior: () => CloseBehavior` 选项；当它解析为 `'quit'` 时，`onWindowClose` 调用完整的退出序列，否则保留历史的 `preventDefault()` + `hide()` 路径。未提供该选项时，关闭窗口仍是隐藏到托盘。

该偏好通过既有的偏好 IPC 对与 preload 桥接暴露给渲染层插件，与 `launch-at-login` 和 `notifications` 完全对称：

- `ipcMain.handle('dsh:close-behavior-get')` / `dsh:close-behavior-set`
- `preload.cjs` 中的 `window.dshDesktop.getCloseBehavior()` / `setCloseBehavior(behavior)`

插件（例如某个设置页）调用 `setCloseBehavior('quit')`，壳把值持久化到 `userData` 并在下一次关闭窗口时生效——无需重启。

## 后果

- 默认行为不变：在插件或用户选择退出之前，关闭窗口仍然隐藏到托盘。
- 退出路径复用 `requestQuit()`，因此 Host 处置与退出释放与托盘菜单退出完全一致；关闭即退出发生在进行中的拆除期间时，由既有的 `pendingQuit` 单飞机制合并。
- 渲染层插件获得了一等公民、对称的 API，而不再越界读取壳的状态。

## 备选方案

**在壳里读取插件专属文件（例如 `~/.dsh/qol-prefs.json`）**——已拒绝。壳不得知道另一个项目的文件布局；偏好存储是壳自己的契约，桥接才是插件表面。

**裸布尔 `quitOnClose`**——已拒绝。显式的双值偏好与既有 `DesktopPreferences` 的归一化风格一致，在持久化 JSON 中自解释，并为未来行为留出空间而无需迁移。
