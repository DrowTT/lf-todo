---
date: '2026-04-16'
task_type: feature
change_scope: heuristic-update
verdict: PARTIAL
title: '搜索浮层类需求要把焦点留存、Esc 语义和壳层快捷键冲突一起验收'
---

## 任务概况

用户要求以 multi-agent 方式评估并开发 LF-Todo 的全局搜索，同时允许按整体交互一致性调整分类内搜索。实际执行中使用了 `code_mapper`、`reviewer`、`docs_researcher`、`implementation_worker`、`verifier`，主链路覆盖了数据库搜索、IPC / preload、renderer 弹窗、分类内搜索 UI、快捷键切换等。初始主验证命令为 `pnpm verify:agent:full` 并通过；之后围绕真实使用反馈，又继续修复了旧热键迁移、确认弹窗 `Esc`、全局搜索弹窗点击后的 `Esc` 与“缩小到托盘”冲突等后续问题，补充验证使用了 `pnpm verify:agent:fast`。

## 表现评估

这次 reader-first 路由整体是顺的。`code_mapper` 很快把数据层、热键入口和 UI 承载面梳理清楚；`reviewer` 和 `docs_researcher` 也提前指出了 overlay、focus、combobox/listbox 语义、`Esc` 收口这些高风险点。问题不在“有没有找到方向”，而在“这些风险没有全部进入硬验收清单”。结果就是主功能一次性交付后，真实使用又连续暴露出同一簇问题：旧热键配置迁移不完整、确认弹窗和全局搜索弹窗在特定焦点状态下会把 `Esc` 放给窗口级逻辑、弹层内部点击后焦点会掉回 `body`。

## 根因分析

这类“全局搜索 / 命令面板 / 浮层搜索”需求虽然主要落在 renderer，但本质上是边界敏感任务：

1. 它们同时触碰热键、焦点、浮层、结果跳转、窗口级快捷键和历史配置迁移。
2. 即使核心实现文件只在 renderer，真实风险也会跨到 app shell 语义层。
3. 如果验收只覆盖“默认状态下能搜、能跳、能关”，就容易漏掉真实用户最容易碰到的两类状态：
   - 点击浮层内部非交互区域后的焦点漂移
   - 已存在本地配置或旧版本配置下的热键迁移与优先级冲突

## 本次调整

这次不改角色 prompt，也不改 playbook，只做 `heuristics` 收紧。原因是：

1. 角色组合本身没有选错；
2. verifier 层也确实参与了独立验证；
3. 真正缺的是 coordinator 在同类任务上的默认“验收心智模型”，适合放到轻量 heuristics，而不是重写整个多 agent 工作流。

## 后续规则

> 下次遇到 LF-Todo 里“搜索浮层 / 命令面板 / 热键拆分”这类任务时，必须把 `Esc` 语义、焦点留存与恢复、窗口级快捷键冲突、旧配置迁移一起列入验收清单，而不是只验主交互链路。

## 相关文件

- `.agents/skills/multi-agent-evolve/state/heuristics.md`
- `.agents/skills/multi-agent-evolve/lessons/2026-04-15-global-search-command-palette.md`
- `.agents/skills/multi-agent-evolve/lessons/2026-04-16-search-hotkey-migration.md`
- `src/renderer/src/components/GlobalSearchDialog.vue`
- `src/renderer/src/components/ConfirmDialog.vue`
- `src/renderer/src/composables/useHotkeys.ts`
- `src/renderer/src/App.vue`
