---
date: '2026-04-23'
category: pattern
tags: [context-menu, overlay, teleport, viewport, scroll, vue, electron]
severity: major
title: 'Context menus should measure real size and teleport to body before viewport clamping'
---

## 问题描述

任务右键菜单在窗口底部或边缘附近打开时，会被窗口边界直接裁掉。原实现虽然做了坐标修正，但只按固定宽高估算菜单尺寸，菜单项一多就会失准，最终仍然出现内容不可见。

## 根因分析

问题有两个层面：

- 菜单定位依赖硬编码的预估尺寸，而不是渲染后的真实 `getBoundingClientRect()`。
- 菜单挂在局部视图树里，叠加层天然更容易受到父级布局和裁剪环境影响。

只做“鼠标点坐标的简单 `min()` 截断”不够，因为菜单真正的宽高取决于动态内容，尤其是这种“按分类数生成菜单项”的场景。

## 解决方案

把右键菜单抽到统一的 `useContextMenu` 里处理：

- 打开菜单时先记录锚点坐标，等菜单真实渲染后再测量实际尺寸。
- 根据视口上下左右剩余空间重新决定最终 `x / y`，必要时改为向上展开。
- 当真实高度仍然超过可用空间时，为菜单设置 `max-height`，并打开 `overflow-y: auto`。
- 菜单节点使用 `Teleport` 挂到 `body`，把叠加层从局部容器里剥离出来。

## 经验教训

> 右键菜单、下拉菜单、浮层这类 overlay 组件，不能靠“猜测尺寸”做边界处理，必须先脱离局部容器，再基于真实尺寸做视口内重排。

- 只要菜单项数量是动态的，就默认采用“渲染后测量 + 二次定位”。
- overlay 一旦可能跨容器边界显示，优先 `Teleport to="body"`，不要依赖父容器的布局环境。
- 当视口空间不足时，优先保留完整交互能力，用内部滚动解决，而不是让内容被裁剪。

## 相关文件

- `src/renderer/src/composables/useContextMenu.ts`
- `src/renderer/src/components/TodoList.vue`
- `src/renderer/src/components/CategoryList.vue`
