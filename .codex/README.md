# Repo-Local Codex Config

这个目录存放 LF-Todo 仓库专属的 Codex 配置与 custom agents。

当前约定：

- `config.toml`：仓库级 Codex 配置
- `agents/`：`code_mapper`、`reviewer`、`docs_researcher`、`implementation_worker`、`verifier` 等角色模板

目录职责：

- 放 Codex 运行配置
- 放自定义 agent prompt
- 不放 skill 内容；skill 统一放在 `.agents/`
