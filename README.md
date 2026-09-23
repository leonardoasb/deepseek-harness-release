# DeepSeek Harness for macOS

[English](#english) · [中文](#中文)

## English

An unofficial macOS desktop distribution of DeepSeek Harness, packaged as an easy-to-install DMG for Apple Silicon Macs.

> Upstream project: [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)
>
> DSH is open-sourced and maintained by DeepSeek AI. This repository only provides an Electron desktop wrapper and an unofficial macOS distribution. It does not modify DSH's core functionality and is not an official DeepSeek AI release.

### Why this project exists

DeepSeek Harness (`dsh`) is currently distributed primarily through npm. Its Web UI can be started with:

```sh
npx @deepseek-ai/dsh web
```

That workflow is convenient for developers, but it requires macOS users to install a compatible Node.js version and launch DSH from a terminal. The upstream repository does not currently provide a downloadable macOS DMG release.

This project fills that distribution gap:

- Bundles the upstream `@deepseek-ai/dsh` package and its runtime, so Node.js is not required.
- Starts the DSH Web service and opens it in a native Electron window.
- Listens only on a random `127.0.0.1` port and is not exposed to the local network.
- Provides a ready-to-install DMG for Apple Silicon (`arm64`).

For DSH features, configuration, plugins, and development documentation, refer to the [official DeepSeek Harness repository](https://github.com/deepseek-ai/deepseek-harness).

### Download and install

Download the latest `DeepSeek-Harness-*-mac-arm64.dmg` from [Releases](https://github.com/leonardoasb/deepseek-harness-release/releases), open it, and drag the app into `Applications`.

The current releases are not signed or notarized with an Apple Developer ID because those capabilities require a paid Apple Developer Program membership. macOS may report that the app is damaged or cannot verify its developer.

### How to open the app

After moving the app into `Applications`, open Terminal and run:

```sh
xattr -dr com.apple.quarantine "/Applications/DeepSeek Harness.app"
open "/Applications/DeepSeek Harness.app"
```

This removes the download quarantine attribute only from this app. It does not disable Gatekeeper system-wide. Do not use this command for software you do not trust, and do not disable Gatekeeper globally with commands such as `spctl --master-disable`.

You may need to run `xattr` again after installing a newer, unnotarized release. App data is stored in the official DSH home directory, `~/.dsh` — the same location used by the upstream CLI (`npx @deepseek-ai/dsh web`), so sessions and settings are shared between both.

### Requirements

- Apple Silicon Mac (`arm64`)
- macOS 11 or later

The app icon combines the official upstream DeepSeek Harness fish and `deepseek` vector wordmark with the `HARNESS` label.

### Why is the app not signed and notarized?

Apple allows development and testing with a free Apple Account and Xcode, but Developer ID distribution and the Notary Service require Apple Developer Program membership. The program currently costs USD 99 per year, or the local equivalent. Eligible nonprofit, educational, and government organizations may request a fee waiver.

This project therefore distributes an unnotarized DMG with a SHA-256 checksum and the app-specific workaround above. Free, self-signed, and ad-hoc certificates are not trusted by Gatekeeper on other Macs and cannot replace official notarization.

### SHA-256 verification

For safety, download files only from this repository's Releases page. In Terminal, calculate the DMG checksum with:

```sh
cd ~/Downloads
shasum -a 256 DeepSeek-Harness-*-mac-arm64.dmg
```

Confirm that the result matches the value in `SHA256SUMS.txt` from the same release before installing the app.

### License and disclaimer

This project is licensed under the MIT License. DeepSeek Harness and its third-party dependencies remain subject to their respective licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

This project is not affiliated with or officially endorsed by DeepSeek AI. DeepSeek Harness is currently a developer preview and may introduce incompatible changes.

---

## 中文

DeepSeek Harness 的非官方 macOS 桌面发行版，为 Apple Silicon Mac 提供开箱即用的 DMG 安装包。

> 上游项目：[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)
>
> DSH 由 DeepSeek AI 开源和维护。本仓库只提供 Electron 桌面封装与非官方 macOS 发行版，不修改 DSH 的核心功能，也不是 DeepSeek AI 官方发行版。

### 为什么做这个项目

DeepSeek Harness（`dsh`）目前主要通过 npm 分发，Web UI 可以通过下面的命令启动：

```sh
npx @deepseek-ai/dsh web
```

这种方式适合开发者，但 macOS 用户需要预先安装合适版本的 Node.js，并通过终端启动 DSH。上游仓库目前也没有提供可直接下载的 macOS DMG Release。

本项目用于补上这个分发缺口：

- 将上游发布的 `@deepseek-ai/dsh` npm 包和运行时一起打包，用户无需安装 Node.js；
- 使用 Electron 启动 DSH Web 服务，并在原生桌面窗口中打开；
- 只监听随机的 `127.0.0.1` 本地端口，不向局域网暴露服务；
- 为 Apple Silicon（`arm64`）提供可直接安装的 DMG。

如果你要了解 DSH 的能力、配置、插件系统或参与其开发，请以 [DeepSeek Harness 官方仓库](https://github.com/deepseek-ai/deepseek-harness) 的文档为准。

### 下载与安装

前往本仓库的 [Releases](https://github.com/leonardoasb/deepseek-harness-release/releases) 下载最新的 `DeepSeek-Harness-*-mac-arm64.dmg`，打开后将应用拖入 `Applications`。

当前 Release 没有 Apple Developer ID 签名与公证，因为这两项能力需要付费加入 Apple Developer Program。macOS 可能因此提示“应用已损坏”或“无法验证开发者”。

### 安装后如何打开

将应用拖入 `Applications` 后，打开“终端”，复制并执行下面两行命令：

```sh
xattr -dr com.apple.quarantine "/Applications/DeepSeek Harness.app"
open "/Applications/DeepSeek Harness.app"
```

该命令只移除这个应用的下载隔离标记，不会关闭系统级 Gatekeeper。不要对不可信应用使用，也不要使用 `spctl --master-disable` 等命令全局关闭安全检查。

以后每次安装新的未公证版本，都可能需要重新执行一次 `xattr`。应用数据保存在 DSH 官方主目录 `~/.dsh`，与上游 CLI（`npx @deepseek-ai/dsh web`）共用同一份会话与配置。

### 系统要求

- Apple Silicon Mac（`arm64`）
- macOS 11 或更高版本

应用图标使用上游 DeepSeek Harness 的官方鱼形与 `deepseek` 矢量字标，并组合 `HARNESS` 标识。

### 为什么没有 Apple 签名与公证

Apple 允许使用免费 Apple Account 和 Xcode 开发、在自己的设备上测试应用；但面向其他用户分发时，Developer ID 和 Notary Service 只对 Apple Developer Program 会员开放。该计划目前为每年 99 美元或当地等值价格，符合条件的非营利、教育和政府机构可以申请费用减免。

本项目目前选择免费发布未公证 DMG，并提供 SHA-256 校验和及上面的单应用绕过方法。免费证书、自签名证书或 ad-hoc 签名都不会被其他 Mac 的 Gatekeeper 信任，无法替代正式公证。

### SHA-256 校验

安全起见，请只从本仓库的 Releases 下载。可在“终端”执行下面的命令计算 DMG 的 SHA-256：

```sh
cd ~/Downloads
shasum -a 256 DeepSeek-Harness-*-mac-arm64.dmg
```

确认输出与同一 Release 中 `SHA256SUMS.txt` 记录的值一致，再安装应用。

### 许可证与声明

本项目采用 MIT License。DeepSeek Harness 及其第三方依赖遵循各自的许可证，详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

本项目与 DeepSeek AI 没有隶属或官方合作关系。DeepSeek Harness 当前仍处于 developer preview，可能包含不兼容更新。
