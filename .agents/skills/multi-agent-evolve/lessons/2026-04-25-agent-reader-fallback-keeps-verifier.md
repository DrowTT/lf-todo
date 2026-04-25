---
date: '2026-04-25'
task_type: feature
change_scope: lesson-only
verdict: PASS
title: '读者 Agent 失败时降级内联侦察但保留独立验证'
---

## 任务概况

用户要求用多 Agent 改造任务视图信息架构：先在 `docs/` 输出完整方案，再收敛侧边栏系统入口，并把未完成、高优先级、排序等能力下沉到主内容区。初始启动了 `code_mapper`、`reviewer`、`docs_researcher`，三个读者 Agent 均因 429 失败；协调者改为内联完成侦察、文档和实现，最后启动独立 `verifier`。

## 表现评估

读者优先的路由选择是正确的，但外部容量错误导致读者阶段不可用。协调者没有停在失败状态，而是继续做本地文件映射和最小范围实现，避免用户等待。最终 `verifier` 成功独立复核，并运行 `pnpm verify:agent:standard`，结果为 PASS。

## 根因分析

这不是角色分工错误，而是 Agent 调用资源失败。此类失败如果发生在读者阶段，最容易造成流程卡死；但只要任务边界仍能通过本地代码和文档确定，协调者可以接管侦察与实现，同时把独立验证作为质量闸门保留下来。

## 本次调整

仅记录 lesson，不修改 `heuristics.md` 或角色提示词。当前证据属于一次容量故障，不足以改变标准路由；但它说明多 Agent 流程需要在读者不可用时保持可恢复。

## 后续规则

> 多 Agent 读者阶段因容量错误失败时，协调者应内联完成必要侦察并继续推进，但非平凡改动仍要尽量保留独立 `verifier`。

## 相关文件

- `docs/TASK_VIEW_INFORMATION_ARCHITECTURE_REDESIGN.md`
- `src/renderer/src/components/CategoryList.vue`
- `src/renderer/src/components/TodoList.vue`
- `.agents/skills/multi-agent-evolve/lessons/2026-04-25-agent-reader-fallback-keeps-verifier.md`
