# Multi-Agent Playbooks

This file defines the repository-standard operating procedure for the `multi-agent-dev` skill.

## Shared Intake

For every task, the coordinator should first capture:

- objective
- done definition
- non-goals
- constraints
- risk level
- preferred verification

## Team Roles

- `code_mapper`: map files, entry points, data flow, shared types, and likely conflict boundaries
- `reviewer`: find correctness, regression, security, and missing-test risks
- `docs_researcher`: verify framework or API behavior from primary sources
- `implementation_worker`: make bounded code changes inside an explicit write scope
- `verifier`: independently validate the final state and return `PASS`, `PARTIAL`, or `FAIL`

## Common Verification

- Renderer-only UI or copy tweak: targeted visual or logic validation, plus `pnpm verify:agent:fast` when code changes
- Most code changes: `pnpm verify:agent:standard`
- Renderer/main/preload/shared-type changes: at least `pnpm verify:agent:standard`
- Build pipeline, packaging, preload bridge, storage contract, or risky cross-layer work: `pnpm verify:agent:full`
- If the exact check does not exist, state the gap and run the closest honest validation

## Routing Matrix

### Review

Use when the user wants a code review, ship-readiness audit, PR check, or risk assessment.

Launch:

- `code_mapper`
- `reviewer`
- `docs_researcher` only if external APIs, framework behavior, or standards matter

Stop after synthesis unless the user explicitly asks for fixes.

### Bugfix

Use when there is a failing behavior, regression, runtime error, broken build, or user-visible defect.

Launch:

- `code_mapper`
- `reviewer`
- `docs_researcher` if framework, library, browser, Electron, or API behavior may be involved

After recon:

- synthesize the likely root cause
- define the minimum write scope
- assign one `implementation_worker`
- run `verifier`

### Feature

Use when the user wants new behavior, a new view, a new interaction flow, or a material enhancement.

Launch:

- `code_mapper`
- `docs_researcher`
- `reviewer` when compatibility, security, or regression risk is non-trivial

After recon:

- produce a concise implementation plan
- keep a single writer unless file ownership is obviously disjoint
- run `verifier`

### Refactor

Use when the goal is structure, maintainability, or cleanup without intentionally changing behavior.

Launch:

- `code_mapper`
- `reviewer`

Add `docs_researcher` only if the refactor depends on framework conventions or toolchain behavior.

After recon:

- preserve behavior
- favor one writer
- run `verifier`

### Incident

Use when the system is unstable, the failure surface is unclear, or multiple layers may be involved.

Launch:

- `code_mapper`
- `reviewer`
- `docs_researcher` if external systems, protocols, or platform behavior matter

Do not start writing until the incident surface is narrowed enough to define a bounded fix.

## Prompt Frame For Every Subagent

Every subagent prompt should include:

- what the user wants
- why this subtask matters
- what is already known
- exact files or directories in scope, if known
- what to return and in what format

Avoid lazy delegation. The coordinator must understand the problem before issuing a write task.

## Writer Rules

- Default to one writer.
- Only use multiple writers when their write sets are disjoint.
- Shared configs, schemas, build files, tests, and public interfaces count as conflict zones.
- If the task is risky and worktree isolation is available, prefer it.

## Verification Rules

The verifier should be independent from the implementation worker.

The verifier should:

- rerun relevant checks
- spot-check the intended behavior
- confirm the done definition was met
- report `PASS`, `PARTIAL`, or `FAIL`

If verification returns `FAIL`, fix the issue and rerun verification before closing the task.

## Final Report Template

The coordinator should close with:

1. Task type
2. Root cause or design summary
3. Change summary
4. Verification summary
5. Remaining risks or follow-ups

After the final report is ready for a non-trivial multi-agent task, invoke the repository-local `$multi-agent-evolve` skill to capture lessons and refine prompts or routing when evidence supports a change.
