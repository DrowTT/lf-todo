---
date: '2026-04-14'
category: pattern
tags: [electron, vue, keyboard, escape, tray, window-runtime]
severity: minor
title: 'Escape-to-tray should be shell-owned and gated by non-interactive focus'
---

## 问题描述

为主窗口增加 `Esc` 隐藏到托盘时，应用里已经存在多种 `Esc` 语义：
- 设置页用 `Esc` 返回任务页
- 搜索框用 `Esc` 清空或收起
- 确认弹窗用 `Esc` 取消
- 快捷录入窗口用 `Esc` 关闭

如果把“按 `Esc` 隐藏窗口”直接塞进局部热键逻辑，或者只判断“不是 input”，就很容易把这些已有行为一起截走。

## 根因分析

这类交互横跨了两个边界：
- “隐藏主窗口到托盘”是应用壳能力，应该由主进程窗口桥接统一提供，而不是让渲染层直接复刻关闭逻辑。
- `Esc` 是否应该命中这个全局行为，取决于当前焦点是不是还在某个局部交互里，不能只看输入框，还要排除按钮、下拉、带角色或 `tabindex` 的可交互元素。

另外，窗口级 `keydown` 监听和视图级 `keydown` 监听可能注册在同一目标上；如果不先在应用壳层做视图门禁，就不能假设后注册的局部监听一定来得及拦截。

## 解决方案

- 在主进程新增显式的 `window:hide-to-tray` 通道，统一复用主窗口持久化与托盘隐藏逻辑。
- 在 preload/runtime window service 中暴露 `hideToTray()`，让渲染层通过既有窗口服务调用，而不是写死 IPC 细节。
- 在 `App.vue` 统一监听 `Esc`，并只在以下条件都成立时触发：
  - 当前没有确认弹窗
  - 当前不在设置页这类已有 `Esc` 语义的视图
  - 事件没有被别处提前消费
  - 当前焦点和事件目标都不在交互元素上
- 对设置页自己的 `Esc` 处理补上 `preventDefault()` 和 `stopPropagation()`，明确声明其优先级。

## 经验教训

> 全局 `Esc` 更像“窗口壳层命令”，不是普通局部热键；它应该由 app shell 接管，并且必须做非交互焦点门禁。

- 只排除 `input/textarea` 往往不够，按钮、选择器、可编辑区、带 `role` 或 `tabindex` 的元素同样属于局部交互上下文。
- 当一个键已经在多个视图里有既有语义时，先盘点这些语义，再决定全局行为的落点和优先级。
- Electron 窗口行为尽量通过 runtime/window bridge 暴露成能力接口，避免渲染层散落着多个“近似关闭逻辑”。

## 相关文件

- `src/main/index.ts`
- `src/preload/index.ts`
- `src/preload/index.d.ts`
- `src/renderer/src/App.vue`
- `src/renderer/src/components/SettingsPanel.vue`
- `src/renderer/src/services/repositories/electron/electronSettingsRepository.ts`
- `src/renderer/src/services/repositories/settingsRepository.ts`
