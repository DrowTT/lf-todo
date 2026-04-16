---
name: "multi-agent-evolve"
description: "Continuously improve LF-Todo's repository-local multi-agent workflow after non-trivial multi-agent runs. Use whenever a multi-agent task finishes, fails verification, exposes bad routing, shows prompt friction, or produces a notably good coordination pattern worth preserving."
---

# Multi-Agent Evolve

Use this skill after meaningful multi-agent work in LF-Todo. Its job is to turn actual runs into better prompts, better routing, and better verifier defaults for this repository.

This skill is allowed to update the repository-local multi-agent system. It is not a generic project diary.

## Goal

Build a closed feedback loop for LF-Todo's multi-agent workflow:

- summarize what happened
- judge whether the routing and prompts were good
- record reusable lessons
- make small, evidence-based updates to the repository-local prompts or routing rules

## When To Trigger

Trigger this skill when any of these are true:

- a non-trivial multi-agent task completed
- verification failed or was weaker than it should have been
- the wrong readers or writer shape were chosen
- a prompt was too vague, too broad, or created avoidable back-and-forth
- a routing or verification choice worked especially well and should be preserved

Do not trigger for tiny one-file edits, trivial reviews, or sessions with no meaningful coordination signal.

## Inputs

Before making any change, capture the run context in scratch reasoning:

- user goal
- task type
- agents used
- files changed
- verification command and result
- what went well
- what went poorly
- whether the issue is one-off or likely reusable

## Read Order

1. Read [state/heuristics.md](./state/heuristics.md)
2. Scan recent files under [lessons/](./lessons/)
3. Read [references/adaptation-targets.md](./references/adaptation-targets.md)
4. Only then decide whether to patch prompts or routing

## Evaluation Rubric

Judge the run on these dimensions:

- routing accuracy
- delegation balance
- writer scope clarity
- verifier adequacy
- user friction
- rework caused by unclear prompts

## Adaptation Policy

Use the smallest change that captures the lesson.

1. `Lesson only`
Record the observation in `lessons/` when the signal is useful but not yet strong enough to change prompts or routing.

2. `Heuristic update`
Update `state/heuristics.md` when the pattern is likely reusable for this repository.

3. `Prompt or routing update`
Patch the repository-local system only when at least one of these is true:
- the miss was severe
- the same pattern has happened more than once
- the evidence clearly points to one narrow improvement

## Allowed Edit Targets

This skill may update only these repository-local files unless the user asks for more:

- `AGENTS.md`
- `.agents/skills/multi-agent-dev/SKILL.md`
- `.agents/skills/multi-agent-dev/references/playbooks.md`
- `.codex/agents/code_mapper.md`
- `.codex/agents/reviewer.md`
- `.codex/agents/docs_researcher.md`
- `.codex/agents/implementation_worker.md`
- `.codex/agents/verifier.md`
- `.agents/skills/multi-agent-evolve/state/heuristics.md`
- files under `.agents/skills/multi-agent-evolve/lessons/`

## Guardrails

- Do not widen trigger conditions aggressively based on one anecdote.
- Do not add new roles unless repeated evidence shows the current roles are insufficient.
- Do not remove independent verification for non-trivial work.
- Prefer tightening prompts and routing over creating more agents.
- Keep all changes repository-local and explain why they were justified.

## Lesson File Format

Create lesson files in `lessons/` using:

- filename: `YYYY-MM-DD_short-slug.md`
- template: [lessons/_TEMPLATE.md](./lessons/_TEMPLATE.md)

## Required Output

When this skill runs, report:

1. what happened in the run
2. the lesson extracted
3. whether you updated only lessons, heuristics, or prompts/routing
4. exact files changed
5. what future multi-agent runs should do differently
