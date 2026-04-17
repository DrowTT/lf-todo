---
date: "2026-04-16"
task_type: refactor
change_scope: lesson-only
verdict: PASS
title: "全项目架构审查应先落地低风险结构清理，再评估高风险重构"
---

## 任务概况

用户要求对 LF-Todo 做全项目架构审查，评估巨型组件、冗余内容、未使用函数/文件、可提炼公共部分，并在本轮直接做优化。协调器按标准流程先启动 `code_mapper` 和 `reviewer` 做只读勘察，再交给单一 `implementation_worker` 落地一组低风险高收益改动，最后由独立 `verifier` 运行 `pnpm verify:agent:standard`，结果通过。

本轮实际修改集中在：
- `src/renderer/src/components/SettingsPanel.vue`
- `src/renderer/src/composables/useHotkeyRecorder.ts`
- `src/shared/contracts/taskFields.ts`
- `src/shared/contracts/db.ts`
- `src/shared/contracts/entities.ts`
- `src/main/db/database.ts`
- `src/main/ipc.ts`
- `src/preload/index.ts`
- `src/preload/index.d.ts`
- `src/renderer/src/app/runtime.ts`
- `src/renderer/src/services/repositories/taskRepository.ts`
- `src/renderer/src/services/repositories/electron/electronTaskRepository.ts`
- `src/renderer/src/utils/taskPriority.ts`

## 表现评估

这次 reader-first 路由效果很好。`code_mapper` 很快把真正的结构热点收敛到 `main/index.ts`、`SettingsPanel.vue`、`TodoItem.vue`、任务域 store/facade 与 shared contracts；`reviewer` 进一步补上了“主进程 createWindow 幂等性风险”“快捷键双份定义漂移风险”“跨层死接口成本偏高”等更偏回归面的判断。两者合并后，协调器可以明确区分：

- 适合本轮落地的低风险项：抽 composable、抽共享解析器、删未消费 API 表面
- 不适合在同一轮顺手大改的高风险项：`main/index.ts` 神文件拆分、`task/subtask` store 双向耦合重构

单 writer 的边界也足够清晰，没有发生“在同一轮审查里顺手去动高风险主进程和领域状态”的过度写入。独立 verifier 复跑标准验证后给出 `PASS`，说明这次收敛范围是合适的。

## 根因分析

这类“全项目架构审查 + 直接优化”任务最容易失控的点，不是读者不够，而是 writer scope 过大。只要不先把“本轮修结构债”和“下轮再动高风险核心模块”切开，writer 很容易同时去碰：

- 主进程上帝文件
- renderer 巨型组件
- shared contracts
- store/facade 领域边界

这会把一次健康的体检任务变成跨层大重构，验证成本暴涨，回归面也失真。相反，这次之所以顺，是因为 readers 先帮协调器把风险区圈出来，协调器再把 writer 的目标压到“公共提炼 + 冗余收口 + 无行为变化”的组合。

## 本次调整

仅记录 lesson，没有修改 `heuristics.md` 或角色 prompt。原因是这次结论很有价值，但更像一条协调器执行层面的经验：同类任务应优先落地低风险结构清理，而不是基于一次成功案例去改全局路由规则。另一个现实因素是 `.agents/skills/multi-agent-evolve/state/heuristics.md` 当前已有非本轮改动，避免在此基础上叠加额外修改更稳妥。

## 后续规则

> 当用户要求“全项目架构审查并顺手优化”时，先让 readers 把高风险结构债和低风险清理项分层，再把 writer 严格限定在公共提炼、冗余删除、组件内逻辑抽离这类可独立验证的收敛改动上。

## 相关文件

- `.agents/skills/multi-agent-dev/SKILL.md`
- `.agents/skills/multi-agent-evolve/state/heuristics.md`
- `src/main/index.ts`
- `src/renderer/src/components/SettingsPanel.vue`
- `src/shared/contracts/taskFields.ts`
