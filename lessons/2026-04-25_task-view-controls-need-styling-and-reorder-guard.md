---
date: '2026-04-25'
category: pattern
tags: [vue, task-list, ui-controls]
severity: minor
title: '主内容区筛选排序控件需要同时处理样式和重排保护'
---

## 问题描述

任务视图信息架构改造把未完成、高优先级、排序等能力下沉到主内容区后，第一版功能逻辑可用，但下拉框仍呈现浏览器原生样式，和 LF-Todo 的浅色 Arctic Blue、轻玻璃界面不一致。

## 根因分析

这类改造不只是数据筛选逻辑迁移，还会在主列表标题区新增长期可见控件。如果只补模板和计算属性，原生 `select` 会破坏产品质感；同时筛选/排序后的列表如果仍进入 `draggable` 分支，用户可能在派生视图中误改真实顺序。

## 解决方案

在 `TodoList.vue` 中把状态筛选、优先级筛选和排序统一放入轻玻璃工具条，使用自定义圆角、背景、箭头和 focus 样式覆盖原生外观；并通过 `canDragSortTasks` 只在无搜索、无筛选、默认排序且非系统视图时启用拖拽排序。

## 经验教训

> 把侧边栏系统视图下沉为主内容区控件时，要把视觉整合和拖拽重排保护作为同一批验收条件。

- 新增常驻筛选控件时，优先检查是否还残留浏览器原生控件样式。
- 任何搜索、筛选或排序生成的派生列表，都不应复用真实顺序的拖拽分支。
- LF-Todo 的 hover 规则仍然禁止位移，只允许颜色、背景、边框、阴影等原位反馈。

## 相关文件

- `src/renderer/src/components/TodoList.vue`
- `src/renderer/src/components/CategoryList.vue`
- `docs/TASK_VIEW_INFORMATION_ARCHITECTURE_REDESIGN.md`
