---
date: '2026-04-01'
category: architecture
tags: [vue, pinia, undo, recovery, settings-panel, ui-state]
severity: major
title: 'Recovery-oriented features work better when UI state is owned by stores, not leaf components'
---

## 问题描述

这轮 P2 优化同时涉及撤销、草稿恢复、设置面板状态化和更新器状态同步。原实现里不少状态都散落在组件本地 `ref` 中，导致“删除后撤销”“切换分类后恢复草稿”“重新打开设置面板后保留状态”这些能力很难统一编排。

## 根因分析

根因不是单个功能缺失，而是 UI 状态生命周期分散：

- destructive action 的结果只停留在组件交互层，没有统一的撤销入口
- 草稿和面板开关只存在于组件实例里，组件卸载后状态也跟着丢失
- settings / updater 直接在组件里调 repository，缺少可复用的 loading / error / lastSyncedAt 状态模型

## 解决方案

把这类“跨组件、跨时刻、需要恢复”的状态上提到 Pinia：

- `undo` store 负责最近一次 destructive action 和 Toast 撤销入口
- `appSession` store 负责任务草稿、子任务草稿和设置面板开关的持久化
- `settings` / `updater` store 负责 repository 调用结果和异步生命周期状态
- facade 只负责把删除成功后的快照注册为可撤销操作

## 经验教训

> 只要一个前端能力需要“延迟恢复”或“跨界面继续”，它就不应该只存在于组件本地状态里。

- 遇到 Undo、Draft Recovery、Panel Resume 这类需求时，优先判断状态是否需要脱离组件实例存在。
- 如果组件既维护表单值，又直接维护异步请求状态，后续通常会很难接入恢复能力。
- facade 最适合串联“业务动作成功后注册恢复句柄”，而不是在组件里临时拼撤销逻辑。

## 相关文件

- `src/renderer/src/store/undo.ts`
- `src/renderer/src/store/appSession.ts`
- `src/renderer/src/store/settings.ts`
- `src/renderer/src/store/updater.ts`
- `src/renderer/src/app/facade/useAppFacade.ts`
