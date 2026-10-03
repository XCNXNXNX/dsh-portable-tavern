# Issue #1071 许可证校正说明草稿

以下内容尚未发送到商城 Issue，供维护者审阅。

---

Issue #1071 的兼容性整改已准备在 [dsh-portable-tavern PR #5](https://github.com/XCNXNXNX/dsh-portable-tavern/pull/5)：
插件提升为 v0.4.1，在 `dsh.compatibility.dshReleases` 中明确声明当前窗口
`0.1.7-rc.2`、`0.2.0-rc.1`、`0.2.0-rc.2` 为 `compatible`。
三版均已在 Windows / Node 22.18.0 和 24.18.0 / Edge 的一次性 Web Profile 中通过
官方 CLI 安装、冷启动、认证宿主路由、真实酒馆面板加载及卸载后完整配置恢复。
Issue 创建时的三个历史版本及商城事务回滚保留为 `unknown`。详细证据在 PR 的
`docs/compatibility.md` 和 `docs/compatibility-results.json`。

另发现旧 Catalog 的历史许可证记录需要校正：

- [Catalog 详情](https://github.com/AI-Scarlett/DSH-Store/blob/main/registry/catalog/details/dsh-portable-tavern.json)
  固定 v0.3.0 / Commit `113199e9b690dd5bde0d4c4424e945eb14270188`，许可证记录为 BSD-3-Clause。
- [该 Commit 的 package.json](https://github.com/XCNXNXNX/dsh-portable-tavern/blob/113199e9b690dd5bde0d4c4424e945eb14270188/package.json)
  曾误填 BSD-3-Clause，但 [同一 Commit 的 LICENSE](https://github.com/XCNXNXNX/dsh-portable-tavern/blob/113199e9b690dd5bde0d4c4424e945eb14270188/LICENSE)
  已是 MIT；当前 manifest 和 LICENSE 已统一为 MIT。
- `scripts/automate-catalog.mjs` 遇到 manifest 与 Catalog 的许可证差异会暂缓更新，报告
  `the manifest license changed from the Catalog declaration`。

请按该固定 Commit 的实际 LICENSE 校正目录中的历史许可证记录，以便上游修复合入默认分支后
能够继续自动复检。这是历史 manifest 与目录声明不一致，现有 LICENSE 没有从 BSD 改成 MIT。
