---
date: '2026-04-14'
category: performance
tags: [electron, quick-add, browserwindow, global-shortcut, tray, positioning]
severity: major
title: 'Quick-add tool windows should be preloaded, reused, and reopened from a deliberate screen edge'
---

## 问题描述

这次 quick add 是一个由全局快捷键唤起的独立 Electron 小窗。实现上如果沿用“按下热键时再新建 `BrowserWindow` 并加载 renderer”的思路，用户会直接感受到 4 到 5 秒的唤起延迟；同时如果默认仍然走通用的窗口居中策略，也会让这种轻量输入窗打断当前注意力。

## 根因分析

真正拖慢体验的不是输入逻辑本身，而是窗口生命周期设计：

- 热键唤起走了完整的建窗 + 加载渲染入口链路，用户在等待的是 Electron renderer 冷启动。
- quick add 这种微型工具窗的默认落点不应该复用主窗口的居中策略，而应该有独立的空间语义。
- 一旦改成窗口复用，又必须补一个“每次打开新会话”的显式事件，否则上一次的输入状态会残留。

## 解决方案

最终采用了三步：

- 应用启动后预创建 hidden 的 `quickAddWindow`，后续只做 `show/hide`，不再为每次热键重新建窗。
- 每次显示前把窗口 bounds 重置到当前屏幕工作区的右下角，并恢复 quick add 的默认尺寸。
- 主进程额外广播 `window:quick-add-session-requested`，让渲染层在每次打开时清空草稿、刷新分类并重新聚焦输入框。

## 经验教训

> 对“全局热键 + 托盘态 + 微型输入窗”这类 Electron 需求，性能优化的第一手段通常不是压榨 Vue 组件，而是把窗口生命周期改成预热复用。

- 如果一个窗口的存在价值是“瞬时出现并立即可输入”，就不要把首次建窗放在用户按键之后。
- 工具窗的位置语义要单独设计，小窗默认居中通常会破坏“轻打扰”的目标。
- 只要窗口被复用，就要同步设计“新会话重置”事件，别把旧输入状态偷偷带到下一次打开。

## 相关文件

- `src/main/index.ts`
- `src/preload/index.ts`
- `src/preload/index.d.ts`
- `src/renderer/src/QuickAddApp.vue`
- `src/renderer/src/composables/useQuickAddComposer.ts`
