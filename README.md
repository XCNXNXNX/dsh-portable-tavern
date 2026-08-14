# dsh-portable-tavern

DSH Web GUI 的「便携酒馆」插件：RPG 式 SillyTavern V2/V3 角色卡生成器 + 酒馆角色扮演聊天一体。

- 可视化 RPG 属性面板（七大模块）生成 SillyTavern V2/V3 角色卡
- AI 聊天（与生成的角色对话，支持下拉切换模型）
- 对话前注入的全局系统提示词（类似 SillyTavern 的 System Prompt / Jailbreak）
- 角色卡 / 对话记录 / 世界书 / 设定本地持久化（localStorage 自动保存与恢复）
- 角色库：本地保存多个角色（含各自对话记录），一键载入 / 删除
- 自定义聊天角色头像（上传图片自动压缩，随角色卡 JSON 导出/导入）
- 世界书生成 / 补全（按人物卡）/ 导入
- 导出 / 导入角色卡（JSON 与 PNG 的 chara 内嵌数据）
- 面板宽度 / 主题色 / 背景图 / 本地音乐（文件夹顺序播放）
- 右侧悬浮标签可拖动，可贴左 / 贴右 / 浮动为圆角方形

独立插件，仅依赖官方 `@deepseek-ai/*` SDK。

## 架构

标准双面 DSH 插件：Node 半（`src/index.ts`）通过 `webServer` 注册 `/api/dsh-portable-tavern` 路由，
调用官方 `llm` 服务；浏览器半（`src/client/index.ts`）经 `dsh.client` 清单被发现，通过 `slots` 服务
挂载悬浮面板与设置页入口，纯 `fetch` 调用上述路由。

## 开发

```bash
pnpm install
pnpm build        # esbuild 打包（node 半 lib/index.js + 浏览器半 lib/client.js）+ tsc 声明
pnpm typecheck
```

`lib/` 提交进仓库（profile 安装无需再构建）。

## 挂载

本包 `cordis.patch.yml` 通过 `dsh.bundle.patch` 把插件行注入 web profile roster；
`package.json` 的 `dsh.client` 声明让浏览器半在 Web GUI 中加载。
