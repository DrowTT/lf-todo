---
date: '2026-04-11'
category: pattern
tags: [quick-add, interaction, category, electron, small-window, input-grammar]
severity: major
title: 'Quick-add category selection in tiny windows should prefer a prefix grammar over a floating picker'
---

## 问题描述

迷你快速新增窗最初用了“输入待办正文，再用末尾 `#分类` 唤起分类选择器”的方案。但在固定尺寸的小窗口里，浮层很容易被窗口边界压缩或裁切，交互也和用户预期不一致。

## 根因分析

这个问题不是简单的“弹层往上还是往下开”，而是交互模型本身和窗口约束冲突：

- 迷你窗没有足够的垂直空间稳定承载一个可滚动的分类选择浮层。
- 分类放在末尾输入，和“先定分类、再记内容”的心智顺序相反。
- 一旦分类选择依赖浮层，窗口尺寸、定位、可视区域和滚动裁切都会成为额外复杂度来源。

## 解决方案

把分类输入改成前缀语法：

- 用户先输入 `#分类名`
- 按一次空格，系统确认当前分类
- 分类锁定为一个 chip
- 后续输入全部视为待办正文

同时去掉浮动选择器，只保留轻量的输入匹配提示：

- 唯一匹配到已有分类时，提示“空格确认分类”
- 没有匹配时，提示“空格创建并使用分类”
- 匹配到多个分类时，不允许确认，提示继续输入更完整名称

## 经验教训

> 在固定尺寸的迷你输入窗里，分类/模式切换优先用前缀语法或行内状态，而不是依赖会脱离布局的浮层选择器。

- 如果一个交互需要稳定出现在小窗口里，优先设计成“输入即状态”，不要先假设有足够空间放浮层。
- 语法顺序要贴合用户任务顺序；这类场景通常是“先定上下文，再写正文”，而不是反过来。
- 只有在窗口空间充足、浮层可完全掌控时，分类选择器才值得保留为可见列表。

## 相关文件

- `src/renderer/src/QuickAddApp.vue`
- `src/renderer/src/composables/useQuickAddComposer.ts`
- `src/renderer/src/utils/quickAdd.ts`
