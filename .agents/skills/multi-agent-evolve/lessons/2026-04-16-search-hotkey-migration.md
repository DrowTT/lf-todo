---
date: "2026-04-16"
task_type: bugfix
change_scope: lesson-only
verdict: PASS
title: "搜索交互拆分后，要把旧热键配置迁移和运行时优先级一起验收"
---

## 任务概况

上一轮 multi-agent 交付已经把 LF-Todo 的搜索交互拆成了“分类内内联搜索”和“全局搜索弹窗”，并完成了 `Ctrl+F` / `Ctrl+P` 的目标分工。但用户在真实使用里反馈 `Ctrl+F` 仍然会打开全局搜索弹窗。后续跟进定位到问题集中在 renderer 侧热键配置读取与迁移，核心文件是 `src/renderer/src/composables/useHotkeys.ts`，本轮验证命令为 `pnpm verify:agent:fast`，结果通过。

## 表现评估

前一轮 reader-first 的整体方向是对的，功能设计、列表高亮、全局搜索跳转都落下来了，真正漏掉的是“已有本地配置”的兼容性验收。也就是说，交互本身没设计错，但搜索热键从单一入口拆成两个动作后，只验证了默认值，没有验证用户本机残留配置是否会把新逻辑覆盖掉。

## 根因分析

这类“旧行为拆成两个新动作”的改造，风险不只在新 UI 和事件分发，还在持久化配置迁移。本次暴露出的具体问题有两个：

1. 旧配置里如果 `openGlobalSearch` 错误占用了 `Ctrl+F`，迁移逻辑会把它当作“目标键已被占用”，导致 `focusSearch` 不一定被补回 `Ctrl+F`。
2. 迁移结果只存在内存里，没有第一时间写回 `localStorage`，导致用户下次启动仍可能带着脏配置重进旧分支。

## 本次调整

这次只记录 lesson，不改 multi-agent prompt 或 heuristics。因为 reader / writer / verifier 的角色组合本身没有错，问题更像是一个很具体的验收盲点：凡是把一个旧快捷键拆成多个新动作的任务，都要把“历史配置迁移 + 运行时冲突优先级”列进收尾检查单。

## 后续规则

> 下次做 LF-Todo 这类快捷键重构时，除了验默认映射，还要显式验三件事：旧配置迁移后是否落盘、冲突键是否会被错误动作抢占、真实用户的历史配置是否还能把旧交互重新唤起。

## 相关文件

- `.agents/skills/multi-agent-evolve/lessons/2026-04-16-search-hotkey-migration.md`
- `src/renderer/src/composables/useHotkeys.ts`
