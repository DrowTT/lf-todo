---
date: '2026-04-01'
category: architecture
tags: [runtime, dependency-injection, vue, electron, repository]
severity: major
title: '运行时容器一旦宣称可注入，就不应再静默回退到 window.api'
---

## 问题描述

P1 引入 `createAppRuntime(api?)` 后，表面上 runtime 已支持注入，但内部仍通过 `api ?? window.api` 创建 category/task repository。这样在测试、预览或未来非 Electron 场景里，即使调用方显式不传 `api`，代码仍会偷偷依赖全局对象。

## 根因分析

运行时容器同时承担了两种互相冲突的职责:

- 对外宣称“依赖可以注入替换”
- 对内继续把 `window.api` 当成隐式兜底

这会让注入边界失效。调用方以为自己拿到的是一个可替换 runtime，实际却仍然耦合在 Electron 全局环境上，问题通常只会在测试或特殊启动场景里暴露。

## 解决方案

去掉对 `window.api` 的静默回退。`createAppRuntime` 只接受显式传入的 `api`，有 `api` 时创建 Electron repository，没有时创建 unavailable repository，并抛出带能力名的明确错误。`settings/updater/window` 继续沿用已有的 graceful fallback。

## 经验教训

> 如果一个运行时容器说自己支持依赖注入，那它内部就不该再偷偷读全局单例作为兜底。

- “显式注入 + 明确降级”比“表面可注入 + 隐式全局回退”更容易排查问题。
- repository 边界要么真的可替换，要么就明确声明只支持 Electron；最危险的是介于两者之间的半抽象状态。
- 对非核心能力可以做 fallback，对核心数据仓储更适合提供 unavailable stub，这样失败更早、更可解释。

## 相关文件

- `src/renderer/src/app/runtime.ts`
- `src/renderer/src/main.ts`
- `src/renderer/src/services/repositories/electron/electronCategoryRepository.ts`
- `src/renderer/src/services/repositories/electron/electronTaskRepository.ts`
