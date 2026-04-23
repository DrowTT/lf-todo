---
date: "2026-04-22"
task_type: feature
change_scope: heuristic-update
verdict: PASS
title: "合并导入除了看当前冲突，还要验后续 task 自增 ID 安全"
---

## 任务概况

用户在 LF-Todo 里继续推进备份能力，希望在现有“恢复备份（覆盖恢复）”之外，再新增一条安全的“合并导入”能力。本次按标准多 agent 流程启用了 `reviewer`、`docs_researcher`、`implementation_worker`、`verifier`。实际改动落在 `src/main/db/database.ts`、`src/main/index.ts`、`src/preload/*`、`src/renderer/src/services/repositories/*`、`src/renderer/src/store/settings.ts`、`src/renderer/src/components/SettingsPanel.vue`。最终验证命令为 `pnpm verify:agent:full`，并附加了 SQLite 语义检查。

## 表现评估

这次 reader-first 分工是有效的：`docs_researcher` 很快把“恢复快照”和“合并导入”分成两类语义，`reviewer` 明确指出在没有 stable id 的前提下只能做 append-only merge。实现阶段也保持了单写手，范围控制得比较稳。真正新增的高价值验证信号来自 verifier：除了 full build 通过外，还专门验证了 `tasks` / `archived_tasks` 双表并存时，后续新建 task 的自增 ID 是否会撞上 archived id。

## 根因分析

只检查“导入当下 active/archive 有没有冲突”是不够的。LF-Todo 的任务与归档任务分两张表维护，但后续业务操作仍默认它们处在一个逻辑上的全局 ID 空间里。只要备份导入或 merge 改变了这两个表的最大 ID 分布，就必须继续验证 `tasks` 自增序列是否被推进到全局上界之后。否则构建和类型都能通过，运行一段时间后才会在新建任务、归档、恢复时埋下冲突雷。

## 本次调整

更新了 `.agents/skills/multi-agent-evolve/state/heuristics.md`，在 Verification 下补充一条窄规则：凡是备份或 storage-boundary 工作同时触及 `tasks` 和 `archived_tasks`，verifier 都要显式验证导入/合并后的 ID 分配安全，而不能只看当前行是否冲突。除此之外，再记录本 lesson，不改其他 prompt 或 routing。

## 后续规则

> 下次遇到同时改动 `tasks` 和 `archived_tasks` 的备份/导入任务时，除了 full build，还要让 verifier 验证后续新建 task 的自增 ID 会不会撞上 archived id。

## 相关文件

- `.agents/skills/multi-agent-evolve/state/heuristics.md`
- `.agents/skills/multi-agent-evolve/lessons/2026-04-22-merge-import-must-verify-global-task-id-safety.md`
- `src/main/db/database.ts`
