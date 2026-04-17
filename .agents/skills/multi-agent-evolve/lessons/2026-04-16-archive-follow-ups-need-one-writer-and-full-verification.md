---
date: "2026-04-16"
task_type: bugfix
change_scope: lesson-only
verdict: PASS
title: "归档功能后续修正里，只要补真实单项归档链路，就应保持单写手并升级到 full 验证"
---

## 任务概况

用户在归档功能首版落地后，继续提出 9 个后续问题。表面看主要是 UI 修正，包括：

- 分类 badge 样式回退
- 归档入口位置、文案、图标和颜色调整
- 归档卡片 hover / 恢复按钮 / checkbox 细节修正

但其中还夹着一个真实能力缺口：当前并没有“单个归档”链路，只有“批量归档已完成”。本次 multi-agent 角色包括 `code_mapper`、`reviewer`、`implementation_worker`、`verifier`，最终以 `pnpm verify:agent:full` 通过收尾。

## 表现评估

- 读者阶段表现有效：两个只读 agent 很快对齐了关键事实，即“单个归档按钮缺失”不是 UI 问题，而是跨层能力没做
- 单写手策略是正确的：一旦补单项归档，就会同时触碰 renderer、repository、preload、ipc、db，继续拆多个 writer 只会扩大冲突面
- 验证策略需要升级：如果只按“renderer UI 小修”走 standard，很容易低估跨层风险；这次升级到 full 是正确选择

## 根因分析

这类任务容易被误判的原因是：用户反馈以视觉问题为主，协调者很容易先入为主地把整轮任务归类成 renderer-only polish。实际上只要需求里出现“没找到单个归档按钮”，就必须先确认它到底是：

- 样式没显出来
- 交互被条件隐藏
- 还是能力链路根本不存在

本次真正的风险不在 CSS，而在误路由。

## 本次调整

本次只记录 lesson，不更新 heuristics 和 prompts。

## 后续规则

> 当后续反馈看起来像归档功能的 UI polish，但其中包含“单条动作缺失”时，先确认是不是跨层能力缺口；一旦答案是“是”，就保持单写手并直接用 full 验证。

## 相关文件

- `src/renderer/src/components/CategoryList.vue`
- `src/renderer/src/components/ArchivedTodoItem.vue`
- `src/renderer/src/components/TodoItem.vue`
- `src/renderer/src/app/facade/useAppFacade.ts`
- `src/renderer/src/store/task.ts`
- `src/preload/index.ts`
- `src/main/ipc.ts`
- `src/main/db/database.ts`
