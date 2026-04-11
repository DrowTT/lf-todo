---
date: '2026-04-10'
category: architecture
tags: [task-priority, todo, ux, drag-sort, vue, sqlite]
severity: major
title: "Task priority should stay as a triage signal instead of hijacking the user's manual order"
---

## 问题描述

给待办系统补“优先级”时，最容易顺手做成“按优先级自动重排列表”。但这个项目本身已经有拖拽排序、创建即置顶、截止日期提醒等一套成熟节奏，如果优先级再直接改展示顺序，就会让用户刚拖好的列表被系统重新洗牌，交互手感也会变得不稳定。

## 根因分析

这个问题的根因不是“优先级不好做”，而是两种排序语义天然冲突：

- 拖拽排序表达的是用户此刻的显式执行顺序。
- 优先级表达的是任务的重要程度或处理紧迫度。
- 如果把两者混成一个排序规则，用户会很难判断“为什么这条任务跑到了上面”。
- 在已有 `order_index` 持久化和拖拽回滚逻辑的前提下，再让 priority 介入排序，还会额外放大 optimistic update、撤销恢复和搜索态下排序一致性的复杂度。

## 解决方案

这次实现把优先级设计成“语义标记 + 轻量视觉提示”，而不是新的排序权重：

- 数据层为 `tasks` 增加 `priority` 字段，并默认落在 `medium`，保证新旧数据兼容。
- 输入层只提供一个低强调的轻量弹层，用户需要时才设置“先做 / 默认 / 稍后”。
- 列表层保持原有 `order_index` 和拖拽规则不变，不因为 priority 自动重排。
- 卡片层只对非默认优先级做持续显式展示，并给高/低优先级加轻微边缘信号，帮助扫读但不打断操作。
- 草稿态单独持久化优先级，这样用户切换分类或中断输入后不会丢掉选择。

## 经验教训

> 当一个新字段同时像“元数据”又像“排序条件”时，先默认它是元数据，只在用户明确要求时再让它接管列表顺序。

- 已经存在手动排序能力的列表里，新增优先级时优先考虑“标记”和“可视化”，不要默认做自动重排。
- 如果产品目标强调“丝滑”和“低认知负担”，优先级入口应该是按需出现、点击即生效，而不是强迫每次创建都做选择。
- 数据建模上要把 priority 当成一等字段一次性补齐到 `shared types -> contracts -> ipc/preload -> sqlite -> store -> draft`，否则前端体验做完后很容易在持久化链路上返工。
- 回头看类似需求时，先问自己一句：用户要的是“抢占执行顺序”，还是“给自己一个判断信号”。很多时候后者已经足够。

## 相关文件

- `src/shared/types/models.ts`
- `src/main/db/database.ts`
- `src/renderer/src/store/task.ts`
- `src/renderer/src/store/appSession.ts`
- `src/renderer/src/components/TodoInput.vue`
- `src/renderer/src/components/TodoItem.vue`
- `src/renderer/src/components/TaskPriorityPicker.vue`
