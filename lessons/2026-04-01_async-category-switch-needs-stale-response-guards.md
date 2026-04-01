---
date: '2026-04-01'
category: bug-fix
tags: [category-switch, async-race, pinia, task-store, subtask-store]
severity: major
title: '分类切换的异步加载必须拦截过期响应，否则旧请求会覆盖新视图'
---

## 问题描述

快速切换分类时，旧分类的 `fetchTasks` / `fetchSubTasks` 可能比新分类更晚返回。若没有过期响应保护，旧请求返回的数据会直接写入 store，导致右侧短暂显示错误分类的任务或子任务。

## 根因分析

问题不只是 facade 层“await 之后再判断”这么简单。真正的风险在于 store 内部会在 `await repository` 返回后立刻写入:

- `taskStore.fetchTasks()` 直接覆盖 `tasks`
- `subTaskStore.fetchSubTasks()` 直接覆盖 `subTasksMap`

如果过期判断只放在 facade 外层，旧响应依然会先把 store 写脏，检查已经来不及了。

## 解决方案

把 stale-response guard 下沉到 store 内部:

- `taskStore.fetchTasks()` 用自增 request id，只有最新请求才能写入 `tasks` 和结束 loading
- `subTaskStore.reset()` / `loadExpandedForCategory()` 递增子任务请求代号
- `subTaskStore.fetchSubTasks()` 在写入 `subTasksMap` 前确认请求仍然有效

facade 层保留一层 category 校验，作为额外保险。

## 经验教训

> 处理列表切换竞态时，过期响应保护必须放在真正写 store 的那一层，而不是只放在调用方外面。

- 只在 facade/composable 外层判断“当前还是不是这个分类”通常不够，因为 store 可能已经先被旧响应写坏。
- 对所有“切换上下文 + 异步拉取”的功能，都要问一句: 旧响应回来时会不会写入共享状态？
- loading 状态也要跟着 request id 走，否则旧请求结束时可能把新请求的 loading 提前关掉。

## 相关文件

- `src/renderer/src/app/facade/useAppFacade.ts`
- `src/renderer/src/store/task.ts`
- `src/renderer/src/store/subtask.ts`
