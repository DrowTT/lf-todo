---
date: '2026-04-10'
category: pattern
tags: [todo-search, header-layout, flexbox, vue, toolbar]
severity: minor
title: 'Header inline search should flex within remaining space instead of using a fixed expanded width'
---

## 问题描述

待办页头部的分类标题、分类内搜索和右侧统计/清理操作在同一行展示。搜索框展开时使用固定宽度，窗口较窄或右侧操作较多时，搜索框会继续向右扩张，视觉上遮住右侧元素。

## 根因分析

这个问题不是搜索框本身的交互 bug，而是头部横向布局约束不完整：

- 搜索框展开宽度是固定值，不会根据同一行剩余空间自动收缩。
- 标题默认不参与收缩，导致紧张空间下没有合适的让位顺序。
- 结果就是中间区域内容溢出到右侧操作区，看起来像“覆盖”，本质上是 flex 子项没有正确共享剩余宽度。

## 解决方案

将搜索框改为“收起时固定宽度，展开时占用剩余空间但受最大宽度限制”的 flex 子项：

- 收起态保持 36px 的固定按钮尺寸。
- 展开态切换为 `flex: 1 1 0`，只吃掉标题右侧的剩余空间。
- 同时给搜索框设置默认最大宽度，避免在宽窗口下无限拉长。
- 让标题可收缩并使用省略号，这样空间不足时优先在标题和搜索框之间协调，而不是挤到右侧操作区。

## 经验教训

> 头部、工具栏、筛选条里的内联输入组件，不要只写“展开宽度”，要写“最大宽度 + 剩余空间适配”。

- 只要输入框左边和右边都有兄弟元素，就优先把它建模成 flex item，而不是一个视觉上会变宽的独立块。
- 遇到“元素遮住右边按钮”这类问题，先检查 flex-grow、flex-shrink、flex-basis 和 sibling 的 `min-width` / `overflow`，通常不需要上 JS 测量。
- 标题、搜索、操作区同排时，要提前定义谁能收缩、谁不能收缩，以及收缩后的兜底表现（比如省略号）。

## 相关文件

- `src/renderer/src/components/TodoList.vue`
- `src/renderer/src/components/TodoSearchBar.vue`
