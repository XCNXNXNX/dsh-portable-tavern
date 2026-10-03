# DSH 兼容性验收 · v0.4.1

2026-10-03，按官方 npm Registry 的 `latest` 标签及之前两个未弃用发行版核对，
DSH Store 当前三版窗口为 `0.1.7-rc.2`、`0.2.0-rc.1`、`0.2.0-rc.2`。
这三版均通过插件发布包的一次性 Web Profile 验收。

| 官方 DSH | 安装 | 冷启动 | 真实浏览器酒馆按钮及面板 | 卸载 / 配置恢复 | 回滚 |
|---|---|---|---|---|---|
| 0.1.7-rc.2 | passed | passed | passed | passed | unknown |
| 0.2.0-rc.1 | passed | passed | passed | passed | unknown |
| 0.2.0-rc.2 | passed | passed | passed | passed | unknown |

测试系统为 Windows，浏览器为无头 Microsoft Edge；Node.js 测试版本及发布包运行文件摘要
记录在 [机器可读证据](compatibility-results.json)。Linux / macOS 尚未验证。

## 测试方式与范围

`scripts/test-dsh-profile.mjs` 直接执行对应版本官方 npm 包的 CLI：

1. 创建独立临时目录、`DSH_HOME`、Agents 目录、npm 配置和浏览器 Profile；
   不继承 Token / Secret / Password / API Key 环境变量。
2. 保存官方 Web Profile 初始配置；通过 `dsh plugin --profile web add` 安装
   `npm pack` 生成的插件包，禁用安装脚本和自动补装 peer。
3. 冷启动官方 Web UI，交换临时启动令牌为认证 Cookie；确认宿主页、模型列表和扩展目录返回 200。
4. 在真实 Edge 页面确认酒馆悬浮按钮出现，点击后打开面板，且没有未捕获的 JavaScript 异常。
5. 关闭本次启动的进程，通过官方 CLI 卸载插件，逐字比较完整配置是否恢复为安装前的内容。
6. 清理本次创建的临时目录。

这些结果证明安装、宿主路由、前端挂载和卸载兼容。没有请求付费模型、测试所有角色/RPG流程、
执行独立安全审计或验证商城事务回滚，因此不能把结果解释为完整功能或安全认证。
源码另通过当前官方 SDK 的 TypeScript 检查、构建及 40 项回归测试。

复现示例（路径按本机官方 DSH 安装位置调整）：

```powershell
New-Item -ItemType Directory -Force .tmp-compat
npm pack --pack-destination .tmp-compat
node scripts/test-dsh-profile.mjs <官方DSH/lib/bin.js> .tmp-compat/dsh-portable-tavern-0.4.1.tgz
```

## Node.js 与未测试版本

Node 范围为 `^22.18.0 || >=24.2.0`。这三版官方 CLI 使用 `import.meta.main`；
Node 22.13.0 实测执行 CLI 时无输出、未安装插件。该 API 从
[Node 22.18.0 / 24.2.0](https://nodejs.org/api/esm.html#importmetamain) 开始提供，
所以不能声明支持更早的 Node 或 Node 23。

[DSH Store Issue #1071](https://github.com/AI-Scarlett/DSH-Store/issues/1071)
创建时的窗口是 `0.1.7-alpha.1`、`0.1.7-alpha.2`、`0.1.7-rc.1`。
这三个历史版本未执行本次验收，在 manifest 中明确保留为 `unknown`；
当前三个已测版本单独声明 `compatible`，没有用宽泛范围推断未知版本的兼容性。

## 商城历史许可证记录

商城仍固定插件 v0.3.0、Commit `113199e9b690dd5bde0d4c4424e945eb14270188`，
并在 [目录详情](https://github.com/AI-Scarlett/DSH-Store/blob/main/registry/catalog/details/dsh-portable-tavern.json)
中记录 `BSD-3-Clause`。该历史 Commit 的
[package.json](https://github.com/XCNXNXNX/dsh-portable-tavern/blob/113199e9b690dd5bde0d4c4424e945eb14270188/package.json)
确实写了 BSD，但同一 Commit 的
[LICENSE](https://github.com/XCNXNXNX/dsh-portable-tavern/blob/113199e9b690dd5bde0d4c4424e945eb14270188/LICENSE)
已经是 MIT。当前 manifest 和 LICENSE 均为 MIT，保持与实际许可证一致。

商城 [自动更新脚本](https://github.com/AI-Scarlett/DSH-Store/blob/main/scripts/automate-catalog.mjs)
遇到 manifest 许可证与旧 Catalog 声明不同，会暂缓更新并报告
`the manifest license changed from the Catalog declaration`。
因此兼容性修复合入默认分支后，历史目录许可证仍可能需要商城维护者校正；
本仓库不能保证商城自动恢复上架，也不把目录通过解释为运行或安全认证。
