---
date: '2026-04-01'
category: architecture
tags: [vue, pinia, repository, ipc, task-cleanup]
severity: major
title: '清空已完成应使用按分类收口的专用仓储操作，而不是复用通用批量删除'
---

## 问题描述

P1 将 renderer 改为经由 runtime + repository 调用 IPC 后，“清空已完成”仍然复用通用 `deleteTasks(ids)`。这条链路表面可用，但删除范围依赖前端当前列表快照，出错时很难判断是 UI 状态、repository 还是 IPC 协议哪一层失配。

## 根因分析

“清空已完成”本质上是一个业务语义明确的动作：删除当前分类下所有已完成的顶级任务。把它降级成“把当前列表里推导出的若干 id 扔给通用批量删除”后，P1 新引入的 repository/contract 边界并没有真正表达业务意图，导致:

- 删除范围没有在主进程收口
- 前端快照与数据库真实状态可能出现偏差
- 出错时只能看到通用删除失败，缺少针对性的校验信号

## 解决方案

新增专用链路 `clearCompletedTasks(categoryId)`，由主进程按 `category_id + parent_id IS NULL + is_completed = 1` 执行删除，并返回删除数量。renderer 侧继续保留 optimistic update，但在 repository 返回的删除数量与本地快照不一致时主动抛错并回滚。

## 经验教训

> 经过 runtime/repository 重构后，像“清空已完成”这种有明确业务边界的动作，应该升级为专用仓储能力，而不是继续复用通用 CRUD 接口。

- P1/P2 阶段排查回归时，优先检查“动作语义”有没有在 repository 和 IPC 层被完整表达。
- 如果一个操作需要从前端先推导 id 集合，再交给通用删除接口执行，通常就是边界设计还不够稳。
- 对 destructive action，主进程最好返回可校验的结果，如删除数量或受影响记录数，方便 renderer 做一致性校验和回滚。

## 相关文件

- `src/renderer/src/store/task.ts`
- `src/renderer/src/app/facade/useAppFacade.ts`
- `src/renderer/src/services/repositories/taskRepository.ts`
- `src/renderer/src/services/repositories/electron/electronTaskRepository.ts`
- `src/preload/index.ts`
- `src/main/ipc.ts`
- `src/main/db/database.ts`
