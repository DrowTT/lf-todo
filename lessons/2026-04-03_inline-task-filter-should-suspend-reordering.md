---
date: '2026-04-03'
category: pattern
tags: [todo-search, draggable, vue, list-filtering]
severity: minor
title: 'Inline task filtering should suspend reordering interactions'
---

## 问题描述

在待办列表里加入分类内搜索后，列表会变成当前分类任务的一个过滤视图，而不再是完整顺序视图。

## 根因分析

拖拽排序依赖完整列表顺序。过滤后的结果如果继续复用 `vuedraggable`，用户拖动的只是子集，保存顺序时会和真实列表顺序语义冲突，容易产生误排序或难以理解的结果。

## 解决方案

搜索激活时切换到普通列表渲染，只保留过滤展示；只有在未搜索时才启用 `vuedraggable` 和排序保存。

## 经验教训

> 对列表做页内过滤时，要先判断当前视图还是不是“可重排的完整视图”。

- 如果展示的是过滤后的子集，就不要直接复用排序、批量选择一类依赖全量集合的交互。
- 这类功能更适合在容器组件里同时决定“数据来源”和“允许的交互能力”。

## 相关文件

- `src/renderer/src/components/TodoList.vue`
- `src/renderer/src/components/TodoSearchBar.vue`
