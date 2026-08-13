# Agent Note: 以 tag 触发的桌面发布工作流构建 Electron 安装包

Status: implemented

[English](2026-08-13-desktop-release-workflow.md) | 中文

## Problem

[Electron 桌面壳](../../proposed/feature/2026-08-13-electron-desktop-client.md)交付时带上了 `electron-builder` 打包（`dist:mac` → `.dmg`、`dist:win` → NSIS 安装包），但没有 CI：它的 README 写着「专用的打包/CI 任务是后续事项」。因此桌面发布只能在开发机上构建并手工上传，任何 tag 都无法复现一次发布的安装包。

有两个平台事实塑造了工作流。其一，桌面应用是 `dsh` 发布族（[npm 发布序列](2026-08-10-npm-release-sequences.md)）的成员：它共享该族的单一版本与 `dsh-v*` tag，所以桌面发布复用同一个 tag，而不是再造一条版本线。其二，`prepare-runtime` 用 `unzip` 解压 Windows 的 Node zip，而 Windows runner 上不存在这个二进制，因此 Windows CI 构建无法暂存它正在打包的自包含运行时。

## Decision

`.github/workflows/desktop-release.yml` 在两个托管 runner 上构建安装包，并把它们发布为 GitHub Release：

- **macOS**（`macos-14`）：`dist:mac` 暂存自包含运行时并构建宿主架构（arm64）的 `.dmg`；第二次 `electron-builder --mac --x64` 复用已暂存的运行时构建 x64 的 `.dmg`。
- **Windows**（`windows-2025`）：`dist:win` 在原生 `pwsh` 下构建 x64 NSIS 安装包。
- **Release**（`ubuntu-latest`）：由 `dsh-v*` tag 推送触发，或在该 tag 上以 `publish: true` 手动触发，通过 `gh release create` 把两个安装包挂到标题为 `DeepSeek Harness Desktop <version>` 的 GitHub Release。

electron-builder.yml 设置了带架构后缀的 `artifactName`，让发布页上的两个 macOS `.dmg` 与 Windows 安装包一目了然。

`prepare-runtime` 现在统一用 `tar -xf` 解压每个归档。bsdtar——macOS 与 Windows 上的 `tar`——既能读 tarball 也能读 zip 归档，因此 Windows runner 缺少的 `unzip` 依赖不复存在。

发布产出的是未签名安装包：代码签名、公证与更新源仍被延后。

## Alternatives considered

**用 `softprops/action-gh-release` 做发布步骤。** 不采用，改用 `gh release create`：托管 Ubuntu runner 上本就装了该 CLI，无需引入新的第三方 action，而且创建发布只是一条命令，不是一份需要维护的依赖。

**在 macOS runner 上交叉构建 Windows 安装包。** 不采用：在非 Windows 主机上，electron-builder 需要借助 wine 运行生成的 NSIS 安装包以抽取卸载器，所以 macOS 构建仍需 wine；原生 Windows runner 则完全绕开它。

**在 Windows runner 上用 Chocolatey 安装 `unzip`，而不是改 `prepare-runtime`。** 不采用：那只是掩盖脚本里潜伏的跨平台 bug，还多一个又慢又易失败的安装步骤；改用 `tar -xf` 能让任何打包该应用的机器都正确工作。

**用一个共享构建作业把产物喂给两个平台作业。** 首个版本不采用：打包需要先构建仓库（`pnpm run build`），`prepare-runtime` 才能部署 harness 闭包，而把整个已构建工作区作为 artifact 共享，比两个并行原生构建有更多活动部件。

## Consequences

- **桌面发布可由 tag 复现。** 推送 `dsh-v0.1.0-rc.5` 即可得到两个 macOS `.dmg` 与 Windows 安装包，并挂到 GitHub Release，全程不需要开发机。
- **每个平台作业都要跑一次完整仓库构建。** 这比一次共享构建慢，但能让打包按平台原生进行，也与 `prepare-runtime` 从已构建工作区部署 harness 闭包的方式一致。
- **`prepare-runtime` 现在假定 bsdtar。** Linux 不是打包目标，所以 GNU tar 缺少 zip 支持不在范围之内；这一改动也让 Windows 上的本地 `dist:win` 能正确暂存运行时。
- **在签名落地之前，发布是未签名的。** 下载安装包的用户仍会看到 macOS Gatekeeper 与 Windows SmartScreen 的警告，这是已知的、被延后的状态，而非回归。
