---
date: '2026-04-22'
task_type: feature
change_scope: lesson-only
verdict: PASS
title: '左栏把“全部”从 Inbox 语义中拆出来时，要把搜索、草稿、Quick Add 和 runtime stub 一起列进验收'
---

## 任务概况

用户要求用多 agent 方式重构 LF-Todo 左栏，让“收件箱”回归真实 system category，“全部”改成独立聚合视图，并同步调整左栏布局、任务面板、全局搜索、草稿隔离和 Quick Add 文案。  
本次使用了 `code_mapper`、`reviewer`、`docs_researcher`、`implementation_worker`，最终由 coordinator 收尾，并以 `pnpm verify:agent:full` 验证通过。  
关键改动集中在 `src/main/db/database.ts`、`src/main/ipc.ts`、`src/preload/index.ts`、`src/renderer/src/app/facade/useAppFacade.ts`、`src/renderer/src/components/CategoryList.vue`、`src/renderer/src/components/TodoList.vue`、`src/renderer/src/components/TodoInput.vue`、`src/renderer/src/components/TodoItem.vue`、`src/renderer/src/components/GlobalSearchDialog.vue`、`src/renderer/src/store/globalSearch.ts`、`src/renderer/src/composables/useQuickAddComposer.ts`、`src/renderer/src/QuickAddApp.vue`。

## 表现评估

reader-first 路线是有效的。`code_mapper` 和 `reviewer` 很快确认了问题不只是左栏文案，而是导航语义混叠：`is_system`、`currentCategoryId`、默认落点、搜索范围、pending badge、归档动作都耦合在一起；`docs_researcher` 也帮助稳定了 Vue / overlay 相关边界。  
问题出在 writer 阶段的收口速度。writer 能够快速改出左栏、列表和输入框的大方向，但在全局搜索、Quick Add 和细碎集成项上推进明显变慢，最后仍是 coordinator 接管收尾，并补上了 `src/renderer/src/app/runtime.ts` 的 unavailable repository stub。

## 根因分析

这类“把聚合视图从真实分类里剥离出来”的任务，表面像左栏 UI 改造，实际上是一个横切语义重构：

1. 左栏选中态不再只靠 `currentCategoryId`。
2. 任务输入草稿不能再按 categoryId 单维度持久化。
3. 全局搜索的 current scope 不能继续拿 system category 代指“全部”。
4. Quick Add 即使数据库保留 legacy 名称，也要统一展示 system alias。
5. 仓储接口一旦新增 `getAllTasks` / `archiveAllCompletedTasks`，runtime stub 也必须同步补齐，否则验证会被无关类型错误卡住。

如果 writer prompt 没把这些横切点显式列成验收项，writer 很容易先完成“看得见的左栏”，但把搜索、Quick Add 或 runtime stub 留到最后。

## 本次调整

这次只记录 lesson，不更新 heuristics 或 prompts。原因是 reader 路由和验收方向本身已经正确，问题更像一次典型的“横切 UI 语义任务收尾不完整”，信号有价值，但还不足以直接修改仓库级 prompt。

## 后续规则

> 下次遇到 LF-Todo 里把聚合视图与真实分类解耦的任务时，coordinator 要在 writer 验收中明确列出左栏选中态、搜索 scope、草稿 key、Quick Add alias 和 runtime stub，同步作为一组收口项验证。

## 相关文件

- `.agents/skills/multi-agent-evolve/lessons/2026-04-22-sidebar-navigation-semantic-split.md`
- `src/renderer/src/app/runtime.ts`
- `src/renderer/src/app/facade/useAppFacade.ts`
- `src/renderer/src/components/CategoryList.vue`
- `src/renderer/src/components/TodoList.vue`
- `src/renderer/src/components/TodoInput.vue`
- `src/renderer/src/components/TodoItem.vue`
- `src/renderer/src/components/GlobalSearchDialog.vue`
- `src/renderer/src/store/globalSearch.ts`
- `src/renderer/src/composables/useQuickAddComposer.ts`
- `src/renderer/src/QuickAddApp.vue`
