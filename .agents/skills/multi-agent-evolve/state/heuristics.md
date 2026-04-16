# Active Multi-Agent Heuristics

This file stores lightweight, reusable routing and prompt heuristics for LF-Todo's repository-local multi-agent workflow.

Update it conservatively. Prefer narrow, evidence-based guidance.

## Routing

- Touching `src/main`, `src/preload`, or `src/shared/contracts` usually means version-sensitive or boundary-sensitive work. Bias toward adding `docs_researcher` and use `pnpm verify:agent:full` when behavior changes cross process boundaries.
- Touching `package.json`, build config, preload bridge, database contracts, or updater flow counts as a conflict zone. Keep a single writer unless there is a very strong reason to split.
- Renderer-only component, composable, or style changes usually do not need multiple readers beyond `code_mapper` and `reviewer` unless browser or framework behavior is unclear.
- Requests for a fixed Inbox/default category should bias toward a real protected category, not a virtual sentinel view. LF-Todo currently assumes positive real `categoryId` values across store, IPC, preload, session drafts, and Quick Add.

## Verification

- Default verification is `pnpm verify:agent:standard`.
- Use `pnpm verify:agent:fast` only for narrow low-risk code changes where build output is not meaningfully affected.
- Use `pnpm verify:agent:full` for cross-layer changes, shared contracts, storage boundaries, packaging paths, or risky refactors.
- If `pnpm lint` produces warning-only noise, prefer `pnpm lint:errors` in verifier-facing flows.

## Evolution

- Record a lesson after meaningful multi-agent tasks, especially if routing or verification had to be corrected mid-run.
- Patch prompts or routing only when the evidence is severe or repeated.
- Prefer changing one file with one clear rationale over broad prompt rewrites.
