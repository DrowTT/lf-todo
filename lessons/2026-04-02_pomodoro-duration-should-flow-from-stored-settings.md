---
date: '2026-04-02'
category: architecture
tags: [pomodoro, settings, electron, renderer]
severity: major
title: 'Pomodoro duration should flow from stored settings instead of being rewritten at read time'
---

## 问题描述

番茄钟时长虽然已经存在 `settings.pomodoro.focusDurationSeconds`，但主进程读取设置时会把它强行覆盖回默认值，界面和通知里也还有写死的 `25 分钟` 文案。

## 根因分析

默认值、当前生效值和展示文案分别散落在 `main`、`renderer`、`preload` 等多处，导致“有存储字段”不等于“真正被统一使用”。只要有一个读取入口仍然回写默认值，后续设置页就无法真正生效。

## 解决方案

把番茄钟时间相关逻辑收口到 `src/shared/constants/pomodoro.ts`，统一默认值、时长标签和提示文案；主进程新增 `getStoredPomodoroData()` 负责归一化读取持久化数据；完成通知改为显式传入本次会话的 `durationSeconds`，避免再依赖写死文案。

## 经验教训

> 对“未来会变成设置项”的字段，不能只统一默认值，还要统一读取链路和展示链路，否则很容易在某个边界层被静默改回默认值。

- 如果字段已经进入持久化模型，`getAll` 之类的聚合读取接口必须优先返回“当前生效值”，而不是重新拼一个常量版本。
- 倒计时、按钮文案、toast、桌面通知要区分“当前默认时长”和“本次会话实际时长”。
- Electron 项目里这类设置通常会跨 `main` / `preload` / `renderer`，只改单层往往不够。

## 相关文件

- `src/shared/constants/pomodoro.ts`
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/renderer/src/store/pomodoro.ts`
