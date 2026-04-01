---
date: '2026-04-01'
category: pattern
tags: [async-action, runtime, pinia, toast, vue]
severity: major
title: '通用异步动作助手不应直接读取 runtime，而应由调用方显式注入副作用能力'
---

## 问题描述

`runAsyncAction` 被设计成通用异步动作包装器，但内部直接调用 `useAppRuntime()` 取得 toast。这样它虽然看起来像纯工具，实际上仍依赖 Vue 注入上下文和应用 runtime。

## 根因分析

问题不在 toast 本身，而在边界方向反了。`runAsyncAction` 本应只负责状态机流程:

- 建立 pending 状态
- 执行 optimistic update
- 失败时回滚
- 记录日志

一旦它自己去拿 runtime，就把“通用流程控制”和“应用级副作用来源”重新耦合在一起，后面在 store 外、测试里或更低层复用时都会再撞上注入上下文问题。

## 解决方案

给 `runAsyncAction` 增加可选 `notifyError(message)` 参数，由 task/subtask store 各自把 `toast.show` 包成局部 helper 传入。这样工具层只消费能力，不决定能力从哪里来。

## 经验教训

> 越通用的 helper，越不应该反向依赖应用 runtime；它应该接收能力，而不是自己寻找能力。

- 如果一个工具函数可以在 store/composable/测试中复用，就不要在内部直接调用 `useAppRuntime()`、`inject()` 或访问全局单例。
- 对 toast、confirm、tracking 这类副作用，优先传函数能力而不是传整个 runtime。
- 当某个 helper 名字听起来“像基础设施”，却还需要 Vue 上下文才能工作，通常就说明边界还没拆干净。

## 相关文件

- `src/renderer/src/services/runAsyncAction.ts`
- `src/renderer/src/store/task.ts`
- `src/renderer/src/store/subtask.ts`
