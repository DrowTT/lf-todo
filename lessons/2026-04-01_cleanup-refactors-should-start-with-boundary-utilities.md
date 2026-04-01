---
date: '2026-04-01'
category: pattern
tags: [refactor, vue, pinia, runtime, local-storage, robustness]
severity: major
title: 'Cleanup refactors become safer when boundary utilities are unified before touching feature logic'
---

## 问题描述

这轮整理的目标不是修单点 bug，而是清理连续优化后留下的补丁式代码、兜底逻辑和编码噪音。最容易失控的风险是还没统一边界层，就直接深入各个 store 和组件做“顺手重构”，最后把同一类问题在多个文件里重复改一遍。

## 根因分析

根因通常不在业务逻辑本身，而在几个基础边界没有被抽象清楚：

- `localStorage` 读写散落在多个 store，解析、兜底、序列化方式不一致
- 无 Electron API 场景的 runtime/repository fallback 用重复空实现拼出来，lint 和类型系统很难协助收口
- Undo 文案和注册逻辑散落在 facade 调用点，导致动作恢复流程不够稳定也不够统一

如果先改具体功能，再回头整理这些边界，往往会二次返工。

## 解决方案

先统一边界工具，再收束功能层：

- 抽出 `src/renderer/src/utils/localStorage.ts`，统一 number / json 的读取和写入
- 用可复用的 unavailable action builder 收口 runtime 中的 fallback repository
- 用 facade 级 `registerUndo()` 统一 destructive action 的撤销注册入口
- 最后再用格式化、lint、typecheck 做全量收尾，验证结构改造没有破坏行为

## 经验教训

> 当项目进入“清理补丁代码”的阶段，最先该抽的不是业务组件，而是所有反复出现的边界操作。

- 看到多个 store 都在直接碰 `localStorage`、`window.api`、兜底空实现时，优先抽基础工具
- 如果一个重构目标包含“优雅、连贯、鲁棒”，就不要只改 UI 层，先让运行时边界变得一致
- 在 cleanup 类任务里，`lint + typecheck + format` 不是收尾附属品，而是确认结构整理是否真正闭环的必要步骤

## 相关文件

- `src/renderer/src/utils/localStorage.ts`
- `src/renderer/src/app/runtime.ts`
- `src/renderer/src/app/facade/useAppFacade.ts`
- `src/renderer/src/store/category.ts`
- `src/renderer/src/store/appSession.ts`
- `src/renderer/src/store/subtask.ts`
