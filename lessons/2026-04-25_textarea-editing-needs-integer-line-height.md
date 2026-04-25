---
date: '2026-04-25'
category: bug-fix
tags: [vue, css, textarea, subpixel]
severity: minor
title: '普通文本和 textarea 切换要统一整数行高避免半像素抖动'
---

## 问题描述

待办描述从普通态切换到编辑态时，当前卡片下方的其他待办 meta 与描述文字会出现约 0.5 像素的视觉上移。现象不是内容挤压，而是列表重新布局后的亚像素渲染差异。

## 根因分析

普通态使用 `div`，编辑态使用 `textarea`，两者虽然字号一致，但 `line-height: 1.65` 会产生小数行高；`textarea` 自动高度又依赖整数 `scrollHeight`。切换元素后当前卡片高度发生小数级变化，后续卡片在滚动容器中重新落到不同像素栅格，导致文字抗锯齿和 baseline 看起来轻微位移。

## 解决方案

将描述普通态和编辑态统一为明确的 `22px` 行高与 `22px` 最小高度，并补齐 `textarea` 的 `margin: 0` 和 `appearance: none`，让两种状态拥有更一致的盒模型。

## 经验教训

> 文本展示态和 textarea 编辑态需要使用同一套整数像素盒模型，否则自动高度和小数行高会造成邻近内容的亚像素抖动。

- 出现 0.5px 级视觉位移时，优先检查行高小数、`scrollHeight` 取整和不同元素默认样式。
- 自动高度 textarea 不应只对齐字体，还要对齐 `line-height`、`min-height`、`margin`、`padding` 与 `box-sizing`。
- 如果抖动仍存在，再考虑减少负 margin 或改为 grid 布局。

## 相关文件

- `src/renderer/src/components/TodoItem.vue`
- `src/renderer/src/composables/useAutoHeight.ts`
