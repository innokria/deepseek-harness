# Agent Note：补全桌面端运行时部署闭包

Status: implemented

[English](2026-08-14-desktop-deploy-closure-complete.md) | 中文

## 问题

桌面壳（`apps/desktop`）打包 harness 的方式是：用 `pnpm deploy --legacy --prod --config.auto-install-peers=false` 部署 `@deepseek-ai/dsh` 的闭包，再把它拷进 `resources/harness`。这个闭包在三处不完整：peer 依赖不会被自动安装；被 `link:` override 的工作区包（`@deepseek-ai/cosmokit`、`@deepseek-ai/schemastery`）会被物化成指回构建检出目录的软链接；legacy deploy 还会把一部分直接依赖（bundle 与 shell 包）落在源目录而不是目标目录。结果是打包应用里的受监管 `dsh web` 子进程因 `ERR_MODULE_NOT_FOUND`（先是 `@deepseek-ai/cordis-plugin-group`）崩溃，永远停在连接页。README 里只说该闭包「靠真实安装验证」，没有门禁，于是这次遗漏在无人察觉的情况下随版本发布。

## 决策

`apps/cli`（`@deepseek-ai/dsh`）是桌面端的 deploy 根；其 `dependencies` 现在列出依赖图中每一个非可选 workspace peer，镜像 Python SDK 的 `dsh-jsonrpc-agent-pkg` 叶子清单。`apps/desktop/scripts/prepare-runtime.mjs` 移植了 `scripts/build-exe-for-python-sdk.ts` 已经具备的两步后处理：`restoreLegacyHoists` 把 legacy deploy 漏掉的每个直接依赖从 `apps/cli/node_modules` 拷回，并去掉其包内 `node_modules`；`materializeStagedLinks` 把剩下的每个软链接替换成解引用后的文件副本，并删除 `.bin` 垫片。`scripts/verify-runtime-closure.ts` 默认同时校验两个 deploy 根（`python/sdk-runtime` 与 `apps/cli`），于是漏掉一个 peer 会让 `pnpm run hygiene` 失败，而不是等到首次安装才暴露。

## 备选方案

**开启自动安装 peer（`--config.auto-install-peers=true`）。** 被否：deploy 旗标是刻意固定的，目的是让闭包恰好等于清单声明的集合，未声明的 peer 反而会把它撑大。叶子清单加显式 peer 的做法正是 Python SDK 已经确立并经过度量的模式。

**为桌面端另建一个专用叶子清单，而不是用 `apps/cli`。** 被否：`apps/cli` 本来就是 deploy 根，`lib/bin.js` 就是入口；另建清单只会重复校验门禁现在拥有的那份 peer 列表。

**保留 `link:` 软链接。** 被否：它们指向构建机的检出目录，打包应用在别的机器上会在模块解析阶段失败。

**跳过门禁、只记录差距。** 被否：这次差距之所以能随版本发布，恰恰因为它只被记录、没有被强制执行。

## 影响

桌面安装器内置的 harness 能到达就绪（`dsh web: http://127.0.0.1:<port>`），已通过运行 `prepare-runtime.mjs` 并用内置 Node 启动分阶段闭包验证。给运行时图新增一个 workspace peer 而不写进 `apps/cli`，现在会让 `verify-runtime-closure` 失败；两步后处理让打包载荷无软链接且保持单一 Cordis 实例。deploy 仍只走 `--legacy`；若 `build-exe-for-python-sdk.ts` 的 deploy 旗标将来变化，restore 与 materialize 两步必须与之同步。
