---
date: '2026-04-10'
category: pattern
tags: [settings, layout, scroll-container, max-width, vue, electron]
severity: minor
title: 'Settings scroll containers should stay full width while an inner shell handles centering and max width'
---

## 问题描述

设置页在窗口变宽后出现“内容列贴在左侧、右边大片留白、滚动条也挤在内容旁边”的观感问题。页面本身没有溢出报错，但视觉上像是布局被截断了。

## 根因分析

问题不在设置卡片本身，而在滚动容器承担了两个职责：

- `settings-view__body` 同时负责纵向滚动和内容限宽。
- 当 `max-width` 直接写在滚动容器上时，整个可滚动区域会被压缩成窄列。
- 结果就是内容、滚动条、交互焦点都停留在左侧，而不是让页面主体在大屏中居中显示。

## 解决方案

把“滚动层”和“内容层”拆开：

- 外层滚动容器始终保持 `width: 100%`，只负责 `overflow-y: auto` 和页面内边距。
- 新增一个内层 shell，负责 `max-width`、居中和分组间距。
- 标题区和正文区都使用同一条 shell 宽度，让页面在宽屏下保持统一的内容轴线。

## 经验教训

> 需要限宽的不是滚动容器，而是滚动容器里的内容壳。

- 只要页面需要“宽屏居中 + 独立滚动”，就优先使用“outer scroll / inner shell”两层结构。
- 如果滚动条出现在内容列旁边而不是窗口边缘，先检查是不是把 `max-width` 加在了 scroll container 上。
- 页面标题、正文、工具栏如果都要对齐，最好共享同一个内容宽度约束，不要分别写各自的 `max-width`。

## 相关文件

- `src/renderer/src/components/SettingsPanel.vue`
