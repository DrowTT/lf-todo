---
date: "2026-04-21"
task_type: feature
change_scope: lesson-only
verdict: PARTIAL
title: "备份导入导出要单独走 backup contract，并按 storage boundary 提前安排 full 验证"
---

## 任务概况

用户要为 LF-Todo 增加导入功能，并把现有较早期的导出升级成能兼容后续字段演进的备份格式。本次使用了 `code_mapper`、`reviewer`、`docs_researcher`、`implementation_worker`，实际改动落在 `src/main/db/database.ts`、`src/main/index.ts`、`src/preload/*`、`src/renderer/src/store/settings.ts`、`src/renderer/src/components/SettingsPanel.vue`，以及新建的 `src/shared/types/backup.ts`、`src/shared/contracts/backup.ts`。`pnpm verify:agent:standard` 通过，`pnpm verify:agent:full` 两次超时未完成。

## 表现评估

读者分工是有效的：`code_mapper` 很快锁定了导出链路和最小写入范围，`reviewer` 把“不能做增量合并、必须保证单一系统分类和主键关系”这些高风险点提前暴露出来，`docs_researcher` 明确了导入应该继续走 `renderer -> preload -> main` 的窄接口模式。问题出在 writer 阶段，`implementation_worker` 只完成了 shared backup contract，没有在合理时间内把 main/preload/renderer 闭环接完，导致协调者需要接手收尾。

## 根因分析

这类“备份格式 + 导入事务 + 跨进程接口 + 设置页入口”的任务虽然适合单一 writer，但 writer prompt 仍然需要更明确地区分“先搭共享协议层”和“必须完成主链路闭环”两个完成标准。另一个问题是验证策略虽然在 heuristics 里已经写明 storage boundary 应偏向 `verify:agent:full`，但协调者初次验证仍先跑了 `standard`，后续才补跑 `full` 并发现超时。

## 本次调整

本次只记录 lesson，不改 heuristics 或 agent prompt。现有 heuristics 对 storage boundary 的验证要求已经足够准确，当前信号更像是一次执行层面的提醒，而不是规则缺失。

## 后续规则

> 下次遇到备份导入导出这类跨 `database/main/preload/shared contracts/renderer` 的任务时，先单独建 backup contract，再要求 writer 以“主链路闭环 + full 验证结果”作为完成标准，若 full 超时则在最终结果里明确记录尝试次数和超时事实。

## 相关文件

- `src/shared/types/backup.ts`
- `src/shared/contracts/backup.ts`
- `src/main/db/database.ts`
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/preload/index.d.ts`
- `src/renderer/src/store/settings.ts`
- `src/renderer/src/components/SettingsPanel.vue`
