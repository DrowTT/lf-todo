---
date: '2026-04-11'
category: pattern
tags: [hotkeys, todo-search, vue, component-ref, event-bridge]
severity: minor
title: 'Hotkeys should request search focus through the view-owned component instead of poking DOM directly'
---

## 问题描述

给待办页补 `Ctrl+F` 聚焦分类内搜索框时，热键逻辑在全局 `useHotkeys` 里，而搜索框的展开、延迟聚焦和选中文本都封装在 `TodoSearchBar` 组件内部。

## 根因分析

这类交互跨了两层边界：

- 热键系统知道“用户想搜索”，但不知道搜索框当前是否展开、是否需要等动画后再聚焦。
- 搜索组件知道怎么正确展开并聚焦自己，但不应该被全局热键逻辑直接依赖内部 DOM 结构。

如果在热键里直接 `querySelector('.todo-search__input')` 或点击按钮类名，后续只要搜索组件结构、动画时机或可见性条件一变，快捷键就容易悄悄失效。

## 解决方案

保留“热键发起请求，视图执行聚焦”的职责划分：

- 在 `useHotkeys` 里新增 `focusSearch` 动作，默认绑定 `Ctrl+F`。
- 触发动作时只切回任务视图并派发一个搜索聚焦事件。
- 由 `TodoList` 监听这个事件，并通过模板 ref 调用 `TodoSearchBar` 暴露的 `focusSearch()`。
- 由 `TodoSearchBar` 统一处理展开、延迟聚焦和选中文本。

## 经验教训

> 全局快捷键命中的是“意图”，真正的 DOM 聚焦和展开动作应该交给拥有该输入框的视图或组件来完成。

- 只要一个输入组件有自己的展开/收起状态，就优先暴露显式方法，而不是从外部硬查 DOM。
- 全局 composable 需要驱动局部 UI 时，用事件桥接或显式 action，比依赖类名和结构更耐改。
- 这类做法还能顺手保留组件内部已有的动画和选中逻辑，避免出现“聚焦到了，但视觉状态没同步”的问题。

## 相关文件

- `src/renderer/src/composables/useHotkeys.ts`
- `src/renderer/src/components/TodoList.vue`
- `src/renderer/src/components/TodoSearchBar.vue`
