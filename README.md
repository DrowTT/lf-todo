# 极简待办 (LF-Todo)

> 🧊 轻量级本地桌面待办事项管理工具，基于 Electron + Vue 3

当前版本：`v1.4.0 Stable`

`v1.4.0 Stable` 是 LF-Todo 的个人使用封版稳定版。项目后续进入低维护模式，优先保障数据安全、启动安装、备份恢复和严重阻断问题，不再默认扩张大型新功能。

## 📦 下载安装

**[👉 点击下载最新版](https://github.com/DrowTT/lf-todo/releases/latest)**

> 下载 `lf-todo-x.x.x-setup.exe` 运行安装即可。应用内置自动更新，后续新版本会自动提醒。

## ✨ 功能特性

- 📝 待办增删改查，支持子任务、优先级、截止时间
- 🧭 系统视图与多分类管理：全部 / 暂存区 / 已归档
- 🔎 分类内搜索 + 全局搜索，支持结果跳转
- ⚡ Quick Add 悬浮录入，支持 `#分类名`
- 🍅 番茄钟与任务绑定专注
- 🔀 任务 / 子任务拖拽排序
- ⌨️ 本地快捷键 + 全局快捷键，自定义绑定
- 🔄 应用内自动更新
- 💾 窗口大小/位置自动记忆，系统托盘常驻，支持开机自启
- 🗃️ 已完成任务自动归档，支持归档恢复
- 📤 数据备份导出 / 覆盖恢复 / 合并导入

## 🎨 界面预览

Arctic Blue 主题 · 无边框窗口 · 玻璃态设计

## 💾 数据与备份

- LF-Todo 是本地优先应用，不需要注册登录，不上传待办数据。
- 主数据库保存在系统用户数据目录下，数据库文件名为 `lite-todo.db`。
- 推荐在迁移到新电脑前，通过设置页的“导出备份”生成 JSON 备份文件。
- “恢复备份”会覆盖当前待办、分类和归档数据；“合并导入”会保留当前数据，但可能产生重复任务。

## Codex MCP

项目内置本地 MCP Server，便于 Codex 读取和整理待办。MCP 不直接操作数据库，所有读写都会通过正在运行的 LF-Todo App 主进程桥接完成。

```bash
# 源码仓库内启动 MCP stdio server
pnpm mcp:lf-todo

# 本地冒烟验证
pnpm mcp:lf-todo:smoke
```

- App 默认使用系统用户数据目录下的 `lite-todo.db`，MCP 只连接 App 桥接服务。
- 使用 MCP 前必须先启动 LF-Todo App。
- App 会在用户数据目录写入 `mcp-bridge.json`，MCP 通过该文件连接本机 `127.0.0.1` 桥接服务。
- 如需调试非默认位置，可用 `LF_TODO_MCP_BRIDGE_PATH=/path/to/mcp-bridge.json` 指定桥接文件。
- MCP 进程需要 Node.js 22.12+。
- 写入类批量操作默认 `dryRun=true`，显式传 `dryRun=false` 才会执行。
- 真实写入默认会通过 App 在用户数据目录下生成 `codex-backups/` 备份，并通知界面刷新。
- 当前 Codex 线程通常不会热加载新增 MCP 配置；修改 `.codex/config.toml` 后建议重启 Codex 或开启新线程。

面向普通用户分发时，MCP Server 会作为 `lf-todo-mcp` npm 包发布，Codex 配置可写为：

```toml
[mcp_servers.lf_todo]
command = "npx"
args = ["-y", "lf-todo-mcp"]
startup_timeout_sec = 60
```

## 📌 Stable 维护策略

`v1.4.0 Stable` 后，仅优先维护以下事项：

- 数据丢失、备份失败、恢复失败
- 应用无法启动、安装或打包失败
- 托盘、置顶、关闭到托盘等严重系统集成问题
- 自动更新阻断
- 明显 UI 阻断或文案乱码
- 依赖安全升级

封版计划见 `docs/FINAL_RELEASE_PLAN.md`，发布说明见 `docs/RELEASE_NOTES_v1.4.0.md`。

## 开发

```bash
# 安装依赖
pnpm install

# 开发
pnpm dev

# 标准验证
pnpm verify:agent:standard

# 发版前完整验证
pnpm verify:agent:full

# 打包
pnpm build:win
```
