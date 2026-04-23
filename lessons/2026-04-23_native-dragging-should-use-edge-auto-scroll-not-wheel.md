---
date: '2026-04-23'
category: pattern
tags: [drag, auto-scroll, scroll, sortablejs, vue, electron]
severity: minor
title: 'Native dragging should use edge auto-scroll instead of wheel-driven scrolling'
---

## 问题描述

任务列表或分类列表较长时，用户拖拽待办过程中需要继续滚动列表去寻找目标位置。最初尝试用全局 `wheel` 监听在拖拽期间接管滚动，但实际在原生 HTML5 拖拽阶段并不会稳定收到滚轮输入。

## 根因分析

根因不在滚动容器，而在事件模型本身：原生拖拽期间，浏览器会压制普通设备输入事件，导致页面不能可靠依赖 `wheel` 来做拖拽中的滚动控制。

## 解决方案

改成边缘自动滚动：

- 在拖拽期间用全局 `dragover` 记录最新鼠标位置和最近一次命中的滚动容器。
- 用 `requestAnimationFrame` 持续检查光标是否靠近该容器的上边缘或下边缘。
- 越靠近边缘，自动滚动步长越大，从而让长列表在拖拽时仍然可达。

这样任务区和分类区都能复用同一套逻辑，也符合原生拖拽更稳定的交互路径。

## 经验教训

> 原生 HTML5 拖拽下，不要把“滚轮驱动滚动”当成可靠方案，优先使用边缘自动滚动。

- 拖拽中需要继续移动长列表时，先考虑基于 `dragover + requestAnimationFrame` 的自动滚动。
- 自动滚动逻辑适合抽成 composable，不要把它散落到多个列表组件里。
- 如果存在多个滚动区，优先做“最近可滚动祖先”查找，而不是写死某一个容器选择器。

## 相关文件

- `src/renderer/src/composables/useTaskDragAutoScroll.ts`
- `src/renderer/src/components/TodoList.vue`
