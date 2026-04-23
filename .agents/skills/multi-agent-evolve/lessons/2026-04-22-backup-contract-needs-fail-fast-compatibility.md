---
date: "2026-04-22"
task_type: feature
change_scope: heuristic-update
verdict: PARTIAL
title: "备份合同改动除了 full 构建，还要补 contract 场景验证"
---

## 任务概况

用户要求继续确认并补完 LF-Todo 的导入/导出功能，并强调字段演进后不能轻易把导入导出做坏。本次按标准多 agent 流程启用了 `code_mapper`、`reviewer`、`docs_researcher`、`implementation_worker`、`verifier`。实际改动落在 `src/shared/types/backup.ts`、`src/shared/contracts/backup.ts`、`src/main/index.ts`、`src/main/db/database.ts`、`src/preload/*`、`src/renderer/src/store/settings.ts`、`src/renderer/src/services/repositories/electron/electronSettingsRepository.ts`、`src/renderer/src/components/SettingsPanel.vue`。验证最终使用了 `pnpm verify:agent:full`，并在 verifier 的 contract 级复核后通过。

## 表现评估

读者分工是有效的：`code_mapper` 很快确认了导入导出主链路已经打通，`reviewer` 提前发现了跨集合 ID 冲突和 Undo 污染新数据集的问题，`docs_researcher` 明确了 Electron 边界和“严格写出、宽容读取”的方向。单写手范围也控制得比较好。真正暴露问题的是验证阶段：虽然 `pnpm verify:agent:full` 一次通过，但 verifier 补做 contract 场景时发现 envelope 缺失 `compatibility` 仍会被静默接受，导致本轮还需要再补一刀 fail-fast。

## 根因分析

这次不是路由错了，而是“full 构建通过”被误当成了“版本化合同验证已足够”。备份导入导出这种任务同时涉及 shared contract、主进程文件 IO、数据库快照和 renderer 消费，构建级验证只能证明代码能编译、能打包，不能证明兼容契约真的按要求 fail-fast。尤其当 parser 里同时存在 legacy 兜底和 envelope 严格模式时，最容易漏掉“某个关键头字段仍在偷偷默认”的情况。

## 本次调整

更新了 `.agents/skills/multi-agent-evolve/state/heuristics.md`，在 Verification 下补充一条窄规则：备份导入导出或其他版本化合同任务，verifier 不能只停在 build 成功，还要额外跑一组 legacy 样本、一组前向兼容样本和一组 malformed envelope 的 fail-fast 样本。除此之外，再记录本 lesson，不改动其他 prompts 或 routing。

## 后续规则

> 下次遇到备份导入导出或版本化 contract 任务时，除了 `pnpm verify:agent:full`，还要让 verifier 补做最少三组 contract 场景：legacy、forward-compatible、malformed fail-fast。

## 相关文件

- `.agents/skills/multi-agent-evolve/state/heuristics.md`
- `.agents/skills/multi-agent-evolve/lessons/2026-04-22-backup-contract-needs-fail-fast-compatibility.md`
- `src/shared/contracts/backup.ts`
