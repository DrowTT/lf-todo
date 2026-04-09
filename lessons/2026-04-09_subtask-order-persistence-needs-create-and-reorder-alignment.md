---
date: '2026-04-09'
category: pattern
tags: [subtask, drag-sort, order-index, persistence, sqlite]
severity: major
title: 'Subtask drag sorting needs create-time order persistence and a dedicated ascending reorder path'
---

## Problem Description

Adding drag sorting for subtasks is not just a UI concern. In this project, top-level tasks sort by `order_index DESC`, while subtasks sort by `order_index ASC`. Reusing the top-level reorder persistence as-is would invert subtask order after reload, and newly created subtasks would jump to the top once a custom subtask order existed.

## Root Cause Analysis

The data model uses one `tasks` table for both top-level tasks and subtasks, but the two list types are read with different SQL ordering rules. That means reorder persistence cannot be shared blindly. On top of that, `createSubTask` previously inserted `order_index = 0`, which only looked correct before any explicit ordering had been saved.

## Solution

Add a dedicated `reorderSubTasks` persistence path that writes ascending `order_index` values, while keeping the existing descending logic for top-level tasks. Also update `createSubTask` so a new subtask gets `MAX(order_index) + 1` within its parent, ensuring new items append to the end consistently even after drag sorting.

## Lesson Learned

> When one table backs multiple list views with different SQL sort directions, drag-and-drop persistence must be aligned with each query path, and create-time defaults must preserve that same ordering contract.

- Check the read query (`ORDER BY`) before reusing any reorder persistence helper.
- If a list becomes user-sortable, create-time `order_index` defaults become part of the feature, not an implementation detail.
- For optimistic drag sorting, keep rollback logic in the store so the UI can recover cleanly if persistence fails.

## Related Files

- `src/main/db/database.ts`
- `src/main/ipc.ts`
- `src/preload/index.ts`
- `src/renderer/src/store/subtask.ts`
- `src/renderer/src/components/TodoItem.vue`
