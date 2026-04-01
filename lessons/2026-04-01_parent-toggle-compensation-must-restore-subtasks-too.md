---
date: '2026-04-01'
category: bug-fix
tags: [task, subtask, compensation, optimistic-update, pinia]
severity: major
title: '父任务联动完成子任务时，补偿逻辑必须同时恢复子任务持久化状态'
---

## 问题描述

勾选父任务完成时，前端会联动把已展开的子任务先乐观标记为完成，然后调用:

1. `setTaskCompleted(parent)`
2. `batchCompleteSubTasks(parent)`

如果第二步失败，UI 虽然会回滚，但原来的补偿逻辑只恢复父任务状态，没有恢复已经被持久化修改过的子任务状态。

## 根因分析

这是典型的“多步写操作补偿不完整”问题。执行链条修改了两个实体层级:

- 父任务
- 一组子任务

但补偿只覆盖了第一层，导致数据库可能出现“父任务未完成，子任务却已经完成”的漂移状态。下一次重新拉取数据后，UI 会和失败当下看到的回滚结果不一致。

## 解决方案

在 `task.toggleTask` 的 `onError` 中，除恢复父任务外，还根据 `previousSubTaskStates` 逐个调用 `setTaskCompleted(subTask.id, previousState)`，把被联动修改过的子任务状态一并补回。

## 经验教训

> 只要一次操作跨越了多个实体或多个持久化步骤，补偿逻辑就必须覆盖整条写入链，而不是只补第一步。

- 审查 optimistic update 时，不只看 UI rollback，也要看数据库补偿是否等价。
- “批量操作失败”最容易留下部分成功状态，尤其要检查后续步骤失败时前面已成功写入的记录是否被恢复。
- 如果回滚只发生在内存层而不发生在 repository 层，重载数据后往往会暴露真正的问题。

## 相关文件

- `src/renderer/src/store/task.ts`
- `src/renderer/src/store/subtask.ts`
- `src/renderer/src/services/repositories/taskRepository.ts`
