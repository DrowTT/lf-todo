---
date: '2026-04-16'
category: architecture
tags: [archive, sqlite, electron, vue, task, restore, pomodoro]
severity: major
title: 'Task archive should use separate storage and preserve ids on restore'
---

## 问题描述

这次给待办模块新增“归档”能力时，需求同时要求：

- 主列表必须彻底干净，归档任务不能继续污染活动查询
- 归档恢复后仍保持已完成状态
- 番茄统计继续按原 `taskId` 关联
- 分类被删除后，归档历史仍然要能回看并尽量恢复回原分类

如果继续沿用现有“清空已完成 = 直接删除”或“删除后重建”的模型，这几个目标会彼此冲突。

## 根因分析

真正的冲突点有两个：

- 如果把归档态继续塞在 `tasks` 表里，就必须把所有活动查询、搜索、计数、提醒、批量操作都补上归档过滤；这种污染面非常大，漏一个查询就会把归档数据重新暴露回工作区。
- 如果恢复归档时走“重新 createTask / createSubTask”，任务和子任务都会拿到新的 `id`，而番茄记录是按 `taskId` 聚合的，历史统计会直接断链。

另外，`tasks.category_id` 现有外键是 `ON DELETE CASCADE`，只要归档数据还依附在活动分类外键上，删除分类就会把历史一起删掉。

## 解决方案

- 把数据层改成“活动 `tasks` + 独立 `archived_tasks`”双表结构。
- 活动表只保留当前工作区任务；归档表承接历史任务和子任务，避免活动查询到处补 `is_archived` 条件。
- 归档时把父任务和全部子任务原样复制到 `archived_tasks`，并保留原 `id`、`completed_at`、`priority` 等字段，再从 `tasks` 删除父任务，让活动链路保持干净。
- 恢复时把归档数据按原 `id` 插回 `tasks`，并写入 `last_restored_at`，不再走重建实体的路径。
- 在归档表里保留 `archived_category_name` 快照；恢复时按“原分类 id 命中 -> 同名分类命中 -> 新建分类 -> 系统分类兜底”的顺序落分类。
- 自动归档基准从 `created_at` 改成 `COALESCE(last_restored_at, completed_at)`，保证“恢复后仍已完成，但不会在下次启动立刻再次被自动归档”。

## 经验教训

> 当需求同时要求“活动视图纯净”和“历史恢复保留身份”时，归档更适合做成独立存储，而不是给活动实体硬塞一个状态位。

- 只要历史数据和活动数据共享一张核心表，就要默认警惕查询污染问题；除非改动面很小，否则应优先考虑存储分层。
- 任何和外部统计、引用、关联记录绑定的实体，一旦存在“恢复”需求，就要尽量保住原主键，避免重建。
- 涉及分类、标签这类可删除外键时，历史数据必须显式保留快照字段，否则“可回看”只是表面成立。

## 相关文件

- `src/main/db/database.ts`
- `src/main/index.ts`
- `src/main/ipc.ts`
- `src/preload/index.ts`
- `src/shared/types/models.ts`
- `src/shared/contracts/entities.ts`
- `src/renderer/src/app/facade/useAppFacade.ts`
- `src/renderer/src/store/task.ts`
- `src/renderer/src/store/archive.ts`
