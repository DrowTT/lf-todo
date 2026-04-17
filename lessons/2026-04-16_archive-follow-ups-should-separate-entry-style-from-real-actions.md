---
date: '2026-04-16'
category: pattern
tags: [archive, ui, electron, vue, ipc, sqlite, task]
severity: major
title: 'Archive follow-ups should separate low-frequency entry styling from real archive actions'
---

## 问题描述

这轮表面上是一次归档功能的 UI 修正，但用户反馈里同时混入了两类问题：

- 归档入口放置、文案、颜色、badge 样式被一起牵动
- “单个归档按钮没找到”其实不是样式问题，而是功能链路本身缺失

如果把这两类问题都当成 renderer 小修来做，很容易一边修入口样式，一边漏掉单条归档的真实能力。

## 根因分析

真正的根因有两个：

- 低频系统视图入口复用了普通分类项的公共样式，导致归档入口的改动很容易误伤分类 badge、激活态和文字节奏
- “缺少单个归档按钮”被误读成可见性问题，但实际缺的是 `renderer -> repository -> preload -> ipc -> db` 的 scoped operation

也就是说，这不是单纯的“按钮长得不对”，而是“视觉入口耦合 + 真实能力缺口”同时存在。

## 解决方案

- 把分类栏里的“已归档待办”入口从 `.category-item` 体系中抽离，放到 footer 做独立样式
- 普通分类的未完成 badge 恢复成原来的 accent 小标，不再受归档入口样式牵连
- 为单个归档补一条专用 `archiveTask` 链路，数据库侧显式校验：
  - 只能归档主待办
  - 必须已完成
  - 不能存在未完成子待办
- 前端用 scoped optimistic remove 处理单个归档，成功后清理 subtask/expanded 状态，失败则回滚

## 经验教训

> 当一个“UI 小修”反馈里同时出现低频入口样式问题和“按钮根本没做成真功能”时，应该把入口解耦和能力补齐分开思考，而不是全部按 renderer 微调处理。

- 低频系统入口尽量不要复用高频业务项的公共样式，否则很容易把正常列表态一起带坏
- 凡是涉及“单条操作”和“批量操作”并存的功能，不能默认批量链路可以自然覆盖单条链路
- 一旦修正范围穿过 main / preload / db，就应该直接按跨层改动验收，而不是停留在 UI 视角

## 相关文件

- `src/renderer/src/components/CategoryList.vue`
- `src/renderer/src/components/TodoItem.vue`
- `src/renderer/src/app/facade/useAppFacade.ts`
- `src/renderer/src/store/task.ts`
- `src/preload/index.ts`
- `src/main/ipc.ts`
- `src/main/db/database.ts`
