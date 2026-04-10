---
date: '2026-04-10'
category: tooling
tags: [electron, windows, autolaunch, login-item, appusermodelid, defaultapp]
severity: major
title: 'Windows 开机自启必须用同一组 path/args 回读，并且 defaultApp 运行时不能假装支持'
---

## 问题描述

设置页里的“开机自启”开关可以被打开，但系统登录项里没有对应注册项；界面和 `config.json` 却仍然可能显示为已开启，导致用户误以为功能生效。

## 根因分析

这次问题有三层根因叠在一起：

- 主进程写入登录项时使用了 `path + args(--hidden)`，但读取状态时却调用了不带查询参数的 `app.getLoginItemSettings()`，导致 Windows 回读并不总是匹配到刚才写入的那一项。
- 关闭开机自启时没有复用同一组 `args`，存在“写入的是 A，删除时查的是 B”的风险。
- Windows 下开发运行时是 `electron.exe` 的 `defaultApp` 模式，本身不应该被当作可交付应用去管理开机自启；如果继续允许它写配置，会让界面出现“设置成功但系统无变化”的假阳性。

## 解决方案

统一 Windows 开机自启配置读写：

- 抽出统一的 Windows 登录项查询配置，写入和回读都使用同一组 `path/args`。
- 在 Windows 上显式固定 `AppUserModelId`，并把登录项 `name` 也对齐到同一个标识。
- 对 `process.defaultApp` 运行时直接判定为“不支持管理开机自启”，返回 `false` 并记录日志，而不是继续写一个不会生效的本地状态。
- 前端保存后必须以主进程返回的“实际状态”为准，而不是只看请求是否成功返回。

## 经验教训

> 在 Windows 上，登录项是“按配置匹配”的系统资源；写入配置和读取配置不一致时，UI 很容易出现假状态。

- 只要 `setLoginItemSettings()` 写入时带了 `path/args`，`getLoginItemSettings()` 就也要用同一组参数回读。
- “调用没报错”不等于“系统已经注册成功”，前端展示必须依赖主进程回读后的实际结果。
- 对开发运行时、预览运行时、默认 Electron 容器这类非交付形态，要先明确支持边界，再决定是否暴露系统级能力。

## 相关文件

- `src/main/index.ts`
- `src/renderer/src/store/settings.ts`
