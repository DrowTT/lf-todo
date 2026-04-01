---
date: '2026-04-01'
category: pattern
tags: [vue, script-setup, facade, ref, typecheck, runtime]
severity: major
title: 'Vue facade 返回多个 ref 时，组件里要尽早解构为顶层绑定'
---

## 问题描述

P1 重构后，`useAppFacade()` 把 `categories`、`tasks`、`currentCategoryId`、`pendingCounts` 等响应式值统一收口返回。运行时行为本身没问题，但在 `CategoryList.vue` 和 `TodoList.vue` 里直接使用 `app.categories`、`app.currentCategoryId` 参与 `v-for`、索引访问和长度判断时，`vue-tsc` 出现了错误联合类型和索引类型报错。

## 根因分析

根因不是 store 或 facade 类型定义错误，而是 Vue 模板对“对象属性上的 ref”自动解包并不总能给出稳定的类型推断结果：

- `v-for="category in app.categories"` 这类写法会让模板推断绕过顶层 ref 解包，出现奇怪的联合类型。
- `app.pendingCounts[app.currentCategoryId]` 这种“ref 套 ref”的索引访问也容易让 TypeScript 认为索引仍然是 `Ref<number | null>`。
- facade 越成功地把状态收口到一个对象里，这类模板推断问题越容易集中出现。

## 解决方案

在组件脚本顶部尽早把 facade 里的 ref 解构成顶层绑定，再让模板直接消费这些顶层绑定：

- `const { categories, currentCategoryId, pendingCounts, tasks, isLoading } = app`
- 计算属性里用 `categories.value`、`tasks.value`
- 模板里用 `categories`、`currentCategoryId`、`pendingCounts`

这样既保留了 facade 统一入口，也让 Vue 模板回到最稳定的“顶层 ref 自动解包”路径。

## 经验教训

> 在 Vue 3 + `<script setup>` 里，facade 很适合收口跨 store 能力，但模板真正消费的 ref 最好尽快解构成组件顶层变量。

- 如果 `vue-tsc` 报出 `Property 'id' does not exist on type 'true | T[]'` 这类诡异错误，优先检查是不是在模板里直接遍历了 `facade.someRef`。
- facade 负责组织能力，组件顶层绑定负责给模板提供稳定类型，这两个职责不要混在一起。
- 做 runtime / facade 改造时，最后一定要跑一次 `pnpm typecheck:web`，这类问题通常只会在模板类型检查阶段暴露。

## 相关文件

- `src/renderer/src/app/facade/useAppFacade.ts`
- `src/renderer/src/components/CategoryList.vue`
- `src/renderer/src/components/TodoList.vue`
