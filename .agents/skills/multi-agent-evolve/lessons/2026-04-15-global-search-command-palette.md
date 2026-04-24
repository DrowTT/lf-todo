---
date: '2026-04-15'
task_type: feature
change_scope: lesson-only
verdict: PARTIAL
title: '全局搜索这类跨层命令面板功能要优先盯住 Esc、焦点和 writer 失效接管'
---

## 任务概况

用户要求用多 agent 评估并开发 LF-Todo 的全局搜索，同时允许在必要时重做原来的“分类内搜索”UI。
本次使用了 `code_mapper`、`reviewer`、`docs_researcher`、`implementation_worker`、`verifier`。改动横跨 `src/main/db/database.ts`、`src/main/ipc.ts`、`src/preload/index.ts`、`src/shared/contracts/db.ts`、`src/renderer/src/components/GlobalSearchDialog.vue`、`src/renderer/src/store/globalSearch.ts`、`src/renderer/src/components/TodoSearchBar.vue`、`src/renderer/src/composables/useHotkeys.ts`、`src/renderer/src/components/TodoList.vue`、`src/renderer/src/components/TodoItem.vue` 等文件。最终验证命令为 `pnpm verify:agent:full`，结果通过。

## 表现评估

这次 reader-first 路由是有效的。`code_mapper` 很快确认现有实现只是当前分类内的本地过滤，不适合作为全局搜索基座；`reviewer` 提前指出了 `Esc`、焦点和结果跳转风险；`docs_researcher` 也给出了 `Teleport + overlay + combobox/listbox` 的正确方向。

问题出在 writer 阶段。`implementation_worker` 没有稳定完成实现，并在执行中以 `400 Bad Request` 结束，导致 coordinator 后续需要接手收尾。与此同时，虽然主链路做通了，但 verifier 和 reviewer 都再次指出了命令面板类 UI 很容易遗漏的细节：`Esc` 关闭不该只绑在输入框上，`Tab` 不该让焦点跑出面板，系统分类下“当前分类搜索”的文案也不能和真实查询范围脱节。

## 根因分析

这类“全局搜索 / 命令面板”功能天然是一个跨层 feature：数据层要补搜索能力，renderer 还要处理快捷键、浮层、焦点恢复、作用域切换和结果跳转。reader 已经把结构风险找出来了，但 writer prompt 没有把“必须同时完成搜索主链路 + 焦点/Esc 收口”明确列成验收项；当 writer 直接失败时，coordinator 也应该更快切回主代理接管，而不是继续等待子任务自然收敛。

## 本次调整

这次只记录 lesson，不改 heuristics 或 prompts。原因是：

1. reader-first 选型本身是正确的；
2. `pnpm verify:agent:full` 的选择也正确；
3. writer 失败更像一次执行层异常，加上命令面板的交互细节遗漏，信号足够有价值，但还不够说明仓库级 prompt 一定要立刻改。

## 后续规则

> 下次遇到 LF-Todo 这类跨层搜索或命令面板功能时，coordinator 要把 `Esc`、焦点约束、快捷键冲突、作用域语义一致性列进验收项；如果 writer 出现结构化失败或工具错误，应尽快由主代理接管收尾并继续独立验证。

## 相关文件

- `.agents/skills/multi-agent-evolve/lessons/2026-04-15-global-search-command-palette.md`
- `src/renderer/src/components/GlobalSearchDialog.vue`
- `src/renderer/src/components/TodoSearchBar.vue`
- `src/renderer/src/composables/useHotkeys.ts`
- `src/renderer/src/components/TodoList.vue`
- `src/renderer/src/components/TodoItem.vue`
