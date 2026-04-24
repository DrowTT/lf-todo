---
date: '2026-04-15'
task_type: feature
change_scope: heuristic-update
verdict: PASS
title: '固定 Inbox 分类在 LF-Todo 中应优先建模为真实受保护分类'
---

## 任务概况

用户要求用多 agent 开发一个固定排在最前面的“全部”分类，不能改名、不能删除、不能被后续排序挤走，并作为 Inbox / 默认捕获入口。

本次使用了 `code_mapper`、`reviewer`、`implementation_worker`、`verifier`。实际改动集中在 `src/main/db/database.ts`、`src/renderer/src/components/CategoryList.vue`、`src/renderer/src/composables/useQuickAddComposer.ts`、`src/renderer/src/QuickAddApp.vue`，并补了共享 `Category.is_system` 字段。验证命令为 `pnpm verify:agent:full`，结果通过。

## 表现评估

读者分工有效。`code_mapper` 很快确认了分类是数据库真实实体，`reviewer` 明确指出虚拟 sentinel 会打穿 `categoryId` 链路，并提醒了 Quick Add、草稿持久化、拖拽与清空完成的语义风险。

写手执行不够稳定，只完成了共享层改动，主工作区最终由 coordinator 直接补完数据层与 renderer 收尾。这说明当前 writer prompt 在跨层 feature 上还需要 coordinator 更强地盯住“必须完成数据库迁移 + UI 保护 + Quick Add 默认捕获”这一整组验收点。

## 根因分析

这个仓库的 `currentCategoryId`、任务创建、IPC 合同、session 草稿、Quick Add 提交都默认“分类 = 正整数真实 ID”。因此“固定 Inbox”如果做成虚拟视图，会立刻引出两类问题：

1. 无法作为真正的默认捕获落点，因为任务没有“未分类”模型。
2. 会把 renderer/main/preload/shared contract 一整条链路改成支持 sentinel，改动面远大于需求本身。

因此在 LF-Todo 里，“固定默认分类”与“聚合全部任务视图”是两种完全不同的问题，前者应优先落为真实受保护分类。

## 本次调整

更新了 `state/heuristics.md`，加入一条路由启发：未来遇到固定 Inbox / 默认分类需求时，优先选择真实受保护分类，而不是虚拟 sentinel 视图。

## 后续规则

> 下次遇到 LF-Todo 的固定默认分类 / Inbox 需求，先按真实受保护分类建模，再验证 Quick Add 与当前分类草稿是否都能沿用真实 `categoryId`。

## 相关文件

- `.agents/skills/multi-agent-evolve/state/heuristics.md`
- `src/main/db/database.ts`
- `src/renderer/src/components/CategoryList.vue`
- `src/renderer/src/composables/useQuickAddComposer.ts`
- `src/renderer/src/QuickAddApp.vue`
