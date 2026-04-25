---
date: '2026-04-25'
category: pattern
tags: [ui, design-system, vue, sass, tailwind]
severity: tip
title: 'UI 重构应先统一设计令牌和层级语义'
---

## 问题描述

LF-Todo 的界面已经从早期极简待办扩展到分类、全局搜索、Quick Add、番茄钟、归档、设置和更新等多模块。继续直接改单个组件容易导致颜色、阴影、层级、动效和按钮语义继续分叉。

## 根因分析

现有 Sass 变量只覆盖了基础色彩、字号和间距，Tailwind 主题为空，弹层层级散落在多个组件里，例如确认框、全局搜索、右键菜单、日期选择器和 Toast 各自使用数字层级。UI 复杂度提高后，缺少统一设计令牌会让局部优化互相冲突。

## 解决方案

先沉淀 `docs/UI_UX_REFACTOR_PLAN.md`，再补齐 Sass 与 Tailwind 的设计令牌，包含 Arctic Blue 色彩、字号、圆角、阴影、弹层阴影、过渡和 `z-index` 语义。首轮只做低风险样式收敛：替换魔法层级值、统一弹层阴影、缩短局部搜索焦点延迟、提高任务卡片操作按钮可发现性。

## 经验教训

> UI/UX 重构不要从单个页面视觉细节开始，应先建立设计令牌、层级语义和可复查文档。

- 修改多个 UI 组件前，先确认全局 token 是否足够表达目标风格。
- 弹层类组件应使用语义层级变量，避免 `9999` 这类难维护数字。
- 高密度桌面应用可以保留紧凑布局，但关键操作不能完全依赖 hover 才显现。
- 方案文档如果放在被忽略目录下，需要同步调整 `.gitignore`，否则后续无法复查或提交。

## 相关文件

- `docs/UI_UX_REFACTOR_PLAN.md`
- `src/renderer/src/styles/variables.scss`
- `tailwind.config.js`
- `src/renderer/src/components/TodoItem.vue`
- `src/renderer/src/components/TodoSearchBar.vue`
