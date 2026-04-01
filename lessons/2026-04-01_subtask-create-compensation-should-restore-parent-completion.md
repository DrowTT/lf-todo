---
date: '2026-04-01'
category: bug-fix
tags: [subtask, parent-task, compensation, optimistic-update, repository]
severity: major
title: '新增子任务若联动改动了父任务完成状态，补偿逻辑也必须恢复父任务'
---

## 问题描述

给“已完成”的父任务新增子任务时，执行链会先创建子任务，再把父任务从完成改回未完成。原有失败补偿只删除新建的子任务，没有把父任务完成状态一并补回。

## 根因分析

这仍然是多步写操作补偿不完整的问题。虽然 UI 只有在 `onSuccess` 才会更新父任务状态，但持久化层的第二步写入一旦发生过，补偿就必须覆盖父任务和子任务两个实体，否则数据库状态可能残留在“新增失败但父任务已被打开”的中间态。

## 解决方案

在 `subTaskStore.addSubTask` 的 `onError` 里，删除已创建子任务后，如果本次操作原本是从“父任务已完成”开始的，再显式调用 `setTaskCompleted(parentId, true)` 恢复父任务状态。

## 经验教训

> 当一次业务动作同时创建子实体并回写父实体时，补偿不能只删除子实体，必须把父实体联动字段一并恢复。

- 审查“新增子项会打开父项”这类链路时，要把创建和联动写入视为一个事务单元来检查。
- 即使 UI 没来得及展示成功态，也不代表数据库没有留下中间态。
- 补偿逻辑最好按“这次动作碰过哪些实体”逐个枚举，而不是只补最显眼的那一步。

## 相关文件

- `src/renderer/src/store/subtask.ts`
- `src/renderer/src/store/task.ts`
- `src/renderer/src/services/repositories/taskRepository.ts`
