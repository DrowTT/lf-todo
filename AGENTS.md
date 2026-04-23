# LF-Todo Codex Guide

## Repo Basics

- Use Chinese for user-facing communication, code comments, docs, and commit messages.
- Think and explain in natural Chinese first. Use English technical terms only when they are the clearest label.
- Stack: Electron + electron-vite + Vue 3 + TypeScript + TailwindCSS + Sass + better-sqlite3.
- Package manager: `pnpm` only.
- This file is the single source of truth for repository rules. It replaces the legacy `AGENT.md`.
- Repository-local AI assets are split by responsibility:
  - `.agents/` for repo-local skills
  - `.codex/` for Codex config and custom agents

## Commands

- Dev: `pnpm dev`
- Lint errors only: `pnpm lint:errors`
- Agent fast verification: `pnpm verify:agent:fast`
- Agent standard verification: `pnpm verify:agent:standard`
- Agent full verification: `pnpm verify:agent:full`
- Packaging: `pnpm build:win`
- Raw scripts still available: `pnpm lint`, `pnpm typecheck`, `pnpm build`
- Do not invent absent scripts such as `pnpm test`.

## Code Rules

- For Vue work, prefer Composition API with `<script setup>` and TypeScript.
- Preserve existing behavior unless the task explicitly changes product behavior.
- Do not revert unrelated user changes.
- Keep comments rare. When a comment is truly needed, write it in Chinese.
- Default UI direction for product work: 极简、浅色 Arctic Blue 风格、无边框窗口，延续现有 LF-Todo 的清爽蓝灰与轻玻璃质感，除非任务明确要求改风格。
- 所有 hover 效果都必须保持原位，禁止使用上浮、悬停抬升或 translate-on-hover 位移。

## Workflow

- For non-trivial work, think through the task before editing and self-review before closing.
- Use Chinese Conventional Commits when commits are requested, for example `fix(store): 修复任务排序回退`.
- Do not maintain a separate `DEVELOPMENT_LOG.md` by default. Repository-level learning for multi-agent work belongs in `.agents/skills/multi-agent-evolve/`.
- Consolidated project documentation and release workflow reference live in `docs/PROJECT_DOCS_SUMMARY.md`.

## Standard Multi-Agent Mode

When the user explicitly asks for multi-agent collaboration, agent-team delivery, parallel investigation, or the standard multi-agent workflow, invoke the repository-local `$multi-agent-dev` standard defined under `.agents/skills/multi-agent-dev/`.

If a global skill with the same name exists, the repository-local skill and the repository-local custom agents under `.codex/agents/` are the source of truth for this project.

In that mode:

1. Start with read-only recon. Launch `code_mapper` and `reviewer` first. Add `docs_researcher` when framework, API, browser, Electron, Vue, Vite, or toolchain behavior matters.
2. Do not start writing until the coordinator can state the likely root cause or implementation plan.
3. Default to one `implementation_worker`. Only add more writers when write scopes are clearly disjoint and shared configs, build files, tests, schemas, or public interfaces are not in the overlap.
4. Always run an independent `verifier` before reporting non-trivial work as complete.
5. The coordinator owns synthesis. Never forward raw subagent output as instructions to the writer.
6. Before routing a non-trivial task, read `.agents/skills/multi-agent-evolve/state/heuristics.md` if it exists and apply the active heuristics.
7. Default verification command is `pnpm verify:agent:standard`. Use `pnpm verify:agent:fast` only for very narrow low-risk changes. Use `pnpm verify:agent:full` for cross-layer, renderer/main/preload, packaging, database, shared contract, or risky refactor work.
8. After a non-trivial multi-agent run, or whenever routing/prompt quality was notably good or bad, invoke the repository-local `$multi-agent-evolve` skill to record lessons and update prompts or routing when justified by evidence.

## Task Routing

- `review`: findings first, no edits unless the user asks for fixes.
- `bugfix`: recon -> root cause -> single bounded writer -> independent verification.
- `feature`: recon -> concise plan -> single bounded writer by default -> independent verification.
- `refactor`: preserve behavior, keep the write scope narrow, verify that behavior did not drift.
- `incident`: narrow the blast radius before any writes.

## Team Boundaries

- `code_mapper`: map files, data flow, entry points, and conflict boundaries.
- `reviewer`: find correctness, regression, security, and missing-test risks.
- `docs_researcher`: verify uncertain framework, library, API, and platform behavior from primary sources.
- `implementation_worker`: edit only the files explicitly assigned.
- `verifier`: prefer `pnpm verify:agent:*`, rerun checks independently, and return `PASS`, `PARTIAL`, or `FAIL`.

## Standard Done Signal

A multi-agent task is only complete when the coordinator can report:

- task type
- root cause or final design summary
- files changed
- verification result
- remaining risks or follow-ups
