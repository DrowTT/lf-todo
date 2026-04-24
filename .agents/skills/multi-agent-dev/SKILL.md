---
name: 'multi-agent-dev'
description: 'Run the repository-standard multi-agent delivery workflow when the user explicitly asks for multi-agent collaboration, agent-team delivery, parallel investigation, or the standard multi-agent process.'
---

# Multi-Agent Dev

Use this skill only when the user explicitly asks for multi-agent execution. For tiny edits or close-steered changes, stay inline as a single agent.

This repository-local skill is the source of truth for LF-Todo, even if a global skill with the same name exists.

## Goal

Coordinate a standard reader-first team workflow for this repository so the user can opt into multi-agent delivery with one instruction.

## Intake

Before spawning anything, capture a compact brief in scratch reasoning:

- objective
- done definition
- non-goals
- hard constraints
- risk level
- task type: `review`, `bugfix`, `feature`, `refactor`, or `incident`

If `.agents/skills/multi-agent-evolve/state/heuristics.md` exists and the task is non-trivial, read it before choosing a route.

Then load [references/playbooks.md](./references/playbooks.md) and choose the matching route.

## Team Shape

Prefer repo-local custom agents when available:

- `code_mapper`
- `reviewer`
- `docs_researcher`
- `implementation_worker`
- `verifier`

Default topology:

- many readers
- one coordinator
- one writer
- one independent verifier

## Operating Rules

1. Recon first.
   Launch the read-only agents in parallel. Do not write code until you can explain the likely root cause or implementation plan yourself.

2. Never delegate understanding.
   Read the investigation results, synthesize them, and then issue a precise task. Do not paste raw findings to a writer and say "fix it."

3. Prefer many readers, one writer.
   Use a single `implementation_worker` by default. Only use multiple writers when write scopes are clearly disjoint and shared configs, build files, tests, schemas, or public interfaces are not at risk.

4. Give bounded ownership.
   Every writer prompt must include:

- the user goal
- why this subtask matters
- what is already known
- exact files or directories in scope
- acceptance criteria
- verification to run or avoid
- a reminder not to revert unrelated changes

5. Keep verification independent.
   Run `verifier` after implementation. The verifier should rerun checks, spot-check behavior, and report `PASS`, `PARTIAL`, or `FAIL`. If verification fails, fix and rerun before reporting success.

6. Keep the user informed.
   When agents are launched, briefly tell the user which roles are running and what each one is checking. Do not predict outcomes before they return.

7. Close the loop.
   After any non-trivial multi-agent task, or whenever routing / delegation / verification quality was notably good or bad, invoke the repository-local `$multi-agent-evolve` skill so the workflow can record lessons and update prompts or routing rules when warranted.

## Repository Defaults

- Language for user-facing communication: Chinese.
- Package manager: `pnpm`.
- Preferred verification commands:
  - `pnpm verify:agent:fast`
  - `pnpm verify:agent:standard`
  - `pnpm verify:agent:full`
- Default to `pnpm verify:agent:standard`.
- Use `pnpm verify:agent:full` for cross-layer, storage-contract, preload bridge, packaging, or risky refactor work.
- Do not invent absent scripts such as `pnpm test`.
- For Vue files, prefer Composition API with `<script setup>` and TypeScript.

## Stop And Realign

Pause before wide changes when any of these are true:

- schema or migration changes
- auth, permissions, billing, or security-sensitive logic
- destructive operations
- unclear acceptance criteria
- hidden write conflicts between workers
- required verification is unavailable or obviously insufficient

## Final Output

Close every multi-agent run with:

1. task type
2. root cause or design summary
3. files changed or proposed changes
4. verification result
5. remaining risks or follow-ups
