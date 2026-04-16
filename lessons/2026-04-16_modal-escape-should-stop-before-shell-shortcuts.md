---
date: '2026-04-16'
category: pattern
tags: [vue, modal, command-palette, keyboard, escape, focus, propagation]
severity: minor
title: 'Overlay keyboard handlers should keep focus inside before shell shortcuts'
---

## 问题描述

确认弹窗和全局搜索这类浮层打开时，用户按下 `Esc` 本应只关闭当前浮层，但实际表现会在某些焦点状态下继续触发窗口级的 `Esc` 逻辑，最终把主窗口最小化到托盘。

## 根因分析

这里有两种常见失效路径：

- 浮层内部已经监听了 `Esc` 和 `Enter`，但只处理了业务回调，没有阻止事件继续冒泡。这样在局部状态被同步清空后，事件继续冒泡到 `window`，就会误命中壳层快捷键。
- 浮层里的输入框初始会自动聚焦，但如果用户点击了非交互空白区域，而容器本身又不可聚焦，浏览器会把焦点丢回 `body`。这时再按 `Esc`，事件甚至不会经过浮层自身，而是直接落到全局窗口监听。

## 解决方案

修复需要两层同时做：

- 在浮层容器上直接为 `keydown.enter` 和 `keydown.escape` 加上 `stop.prevent`，让浮层在完成确认/取消后同时消费掉这次键盘事件。
- 让浮层容器可聚焦，并在点击非交互区域时把焦点留在浮层内部，避免焦点掉回 `body`。
- 对窗口级 `Esc` 隐藏逻辑补一层“当前浮层已打开”的门禁，作为最后保险。

## 经验教训

> 当 modal、drawer、command palette 等浮层拥有自己的快捷键语义时，不只要处理按键动作，还要保证焦点留在浮层内部，并阻止事件继续冒泡到 app shell。

- 只在全局热键入口里判断“当前有没有弹窗”还不够，因为局部处理可能会先同步改掉这份状态，或者焦点已经丢出浮层。
- 对 `Esc`、`Enter` 这类高频语义键，优先在拥有焦点的浮层边界完成 `preventDefault()` 和 `stopPropagation()`。
- 浮层如果允许点击内部空白区域，就要让容器本身可聚焦，或者把焦点重新收回到浮层内部。
- 如果一个 bug 表现为“局部交互生效了，但全局行为也跟着触发”，优先排查事件传播顺序，而不是只看条件分支。

## 相关文件

- `src/renderer/src/components/ConfirmDialog.vue`
- `src/renderer/src/App.vue`
- `src/renderer/src/composables/useConfirm.ts`
