---
date: '2026-04-11'
category: architecture
tags: [electron, quick-add, global-shortcut, ipc, multi-window, vue]
severity: major
title: 'Electron quick-add flows need sender-aware window IPC, a separate renderer mode, and explicit main-window refresh hooks'
---

## 问题描述

这次需求不是单纯加一个输入框，而是把“关闭到托盘后的全局快捷键新增待办”做成独立迷你窗口。表面上是 UI 需求，实际会同时牵涉主进程窗口管理、预加载桥接、渲染入口拆分，以及主窗口与迷你窗口之间的数据同步。

## 根因分析

最容易低估的点有三个：

1. 现有 `window:close` / `window:minimize` / `window:toggle-maximize` IPC 默认都是围绕主窗口写的，一旦第二个 `BrowserWindow` 复用这些通道，就必须按 `event.sender` 解析“到底是谁发来的”。
2. 迷你新增窗和主窗口的职责完全不同，如果硬塞进主应用根组件，会把启动流程、热键逻辑和视图结构搅在一起；更稳妥的是给它一个单独的 renderer mode。
3. 迷你窗口直接写库以后，隐藏中的主窗口并不会自动知道分类或任务已经变化，必须由主进程显式广播一个“quick add committed”事件，主窗口再决定如何刷新。

## 解决方案

这次落地采用了三段式拆分：

- 主进程新增 `quickAddWindow`，并让 `Ctrl+Alt+N` 在主窗口可见时保持“聚焦主输入框”，在主窗口隐藏到托盘时改为弹出迷你快速新增窗。
- 预加载层新增 `quickAdd.submit`、`window:focus-quick-add-input` 和 `window:quick-add-committed`，把迷你窗的输入聚焦与提交结果都走显式桥接。
- 渲染层通过 `?mode=quick-add` 切成独立入口，使用单独的 `QuickAddApp.vue` 和 `useQuickAddComposer.ts`，只处理一件事：输入待办、通过 `#` 选择或创建分类、提交后关闭。
- 主窗口侧监听 `window:quick-add-committed`，统一调用 `app.fetchCategories()`，保证托盘场景下重新打开主窗口时数据已经是最新的。

## 经验教训

> 只要 Electron 需求里出现“全局快捷键 + 第二窗口 + 直接写数据”，就不要只盯着 UI；先梳理 sender-aware IPC、独立 renderer mode 和主窗口回刷链路。

- 如果一个窗口 IPC 未来可能被第二个窗口复用，第一版就应该按 sender 归属来写，而不是默认绑定到唯一主窗口。
- 迷你工具窗往往不需要整个主应用壳层；单独的 renderer mode 比在主根组件里堆条件分支更稳。
- 数据不是通过共享 store 自动同步的；跨窗口写库后，要么广播刷新事件，要么建立更明确的同步协议。
- 这种需求适合先画职责边界：主进程负责窗口和广播，预加载负责桥接，迷你窗负责输入体验，主窗口负责自己的数据刷新。

## 相关文件

- `src/main/index.ts`
- `src/main/ipc.ts`
- `src/preload/index.ts`
- `src/preload/index.d.ts`
- `src/renderer/src/main.ts`
- `src/renderer/src/App.vue`
- `src/renderer/src/QuickAddApp.vue`
- `src/renderer/src/composables/useQuickAddComposer.ts`
- `src/shared/contracts/db.ts`
- `src/shared/contracts/entities.ts`
- `src/shared/types/models.ts`
