# @deepseek-ai/dsh-client-ui-update

[English](README.md) | 中文

Web 桌面自动更新功能所有者：向 `sidebar.footer.action`——设置触发器正上方的页脚列表——贡献一项，用来呈现 Electron 壳的更新状态。状态经 preload 桥（`window.dshDesktop.updates`）到达，该桥由[桌面壳](../../../apps/desktop/README.md)暴露；本包不发起任何 RPC，除桥订阅外也不持有状态。

徽标只在有更新进行时渲染：`available`（已发现、即将下载）、`downloading`（带百分比）与 `downloaded`（可安装）。已下载的徽标是一个动作——点击即退出并安装；否则同样的安装会在下一次普通退出时进行，这正是壳退出路径已经完成的动作。其余所有阶段，包括普通 `dsh web` 浏览器中缺失的桥，都渲染为空，因此浏览器表面永远不会为一个它不具备的能力多出一个控件。

样式只使用 token；文案走本包自己的 `update` locale 命名空间。行为由[桌面自动更新 Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-desktop-auto-update.md) 规定。

## Model Experience

无，因为本包为人类呈现壳的更新状态，不触碰任何 prompt、消息、schema、流或工具结果。

#### KV Cache effect

无；本包从不组装或发送 provider 请求。

## Known Limitations and Deferred Work

- **桥仅限桌面** — 普通 `dsh web` 浏览器没有 `window.dshDesktop`，因此非桌面运行既没有浏览器内更新表面，也没有回退检查路径。
- **徽标在安装前仅是提示** — 它呈现状态并提供「立即安装」，但没有每个版本的发布说明或超出百分比的进度细节；更丰富的面板留待后续特性。
