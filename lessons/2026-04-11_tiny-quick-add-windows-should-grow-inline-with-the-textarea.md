---
date: '2026-04-11'
category: pattern
tags: [quick-add, electron, textarea, auto-resize, small-window, ui]
severity: major
title: 'Tiny quick-add windows should grow inline with the textarea instead of adding extra chrome'
---

## 问题描述

这次 quick add 已经改成了前置 `#分类` 的输入语法，但弹窗看起来仍然偏重：顶部标题、辅助文案、底部按钮和较厚的卡片样式占掉了迷你窗口里最宝贵的高度，导致真正的输入区反而不够直接。

## 根因分析

问题不只是视觉风格，而是微型窗口里的空间分配模型不对：

- 小窗里最应该稳定可见的是“当前上下文 + 输入内容”，不是额外的标题区、操作区和说明区。
- textarea 如果默认就做成较高的块，再叠加 helper / footer，会让单行输入场景显得很笨重。
- 当输入支持多行时，真正合理的做法不是预留一大块固定高度，而是让输入框和窗口跟着内容一起增长。

## 解决方案

这次落地改成了更贴合微型输入器的结构：

- 只保留顶部条和一个输入容器，去掉独立标题、底部按钮和匹配列表。
- textarea 默认 `rows="1"`，保持单行起步。
- 用户输入多行后，先通过 `useAutoHeight` 增长 textarea，再通过 `window:resize-quick-add` 让 Electron 窗口同步增高。
- 已确认的分类不再放在外部区域，而是作为输入容器内部的 inline chip 展示；取消分类时恢复成 `#分类 ` 前缀继续编辑。

## 经验教训

> 在迷你输入窗口里，优先把空间留给“正在输入的东西”，而不是提前铺满说明、按钮和装饰；如果内容会增长，就让输入框和窗口一起增长。

- 微型工具窗的第一原则是减 chrome，而不是在有限空间里继续堆完整页面组件。
- 如果主操作本质上是文本输入，状态提示和上下文最好都内联到同一个输入容器里。
- 固定高度 + 富交互面板通常会让迷你窗口显得更重；auto-grow 更符合这种场景的真实使用节奏。

## 相关文件

- `src/renderer/src/QuickAddApp.vue`
- `src/renderer/src/composables/useQuickAddComposer.ts`
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/preload/index.d.ts`
