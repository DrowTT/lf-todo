# lf-todo-mcp

LF-Todo 的本地 MCP Server，让 Codex 读取和整理极简待办。

MCP 不直接读写 SQLite。它会连接正在运行的 LF-Todo App，由 App 主进程执行实际读写并通知界面刷新。

## 使用方式

在 Codex 配置中添加：

```toml
[mcp_servers.lf_todo]
command = "npx"
args = ["-y", "lf-todo-mcp"]
startup_timeout_sec = 60
```

使用前需要先启动 LF-Todo App。App 启动后会在用户数据目录写入 `mcp-bridge.json`，MCP 会自动读取该文件。

如果需要调试非默认桥接文件位置，可以指定：

```toml
[mcp_servers.lf_todo.env]
LF_TODO_MCP_BRIDGE_PATH = "/path/to/mcp-bridge.json"
```

## 工具

- `get_lf_todo_context`：读取 App 桥接状态、备份目录和数据概览。
- `list_categories`：读取全部分类。
- `list_tasks`：按分类、完成状态、优先级、截止时间筛选待办。
- `search_tasks`：搜索待办、描述和子待办。
- `create_backup`：创建 SQLite 和 JSON 备份。
- `apply_task_operations`：批量整理待办。默认 `dryRun=true`，显式传 `dryRun=false` 才会写入。

## 桥接路径

默认桥接文件路径：

- macOS：`~/Library/Application Support/lf-todo/mcp-bridge.json`
- Windows：`%APPDATA%/lf-todo/mcp-bridge.json`
- Linux：`$XDG_CONFIG_HOME/lf-todo/mcp-bridge.json` 或 `~/.config/lf-todo/mcp-bridge.json`

真实写入前默认会通过 App 在用户数据目录的 `codex-backups/` 里创建备份。

## 要求

- Node.js 22.12+
- 本地已安装并正在运行 LF-Todo
