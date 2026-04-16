# Adaptation Targets

Use this guide to decide where a multi-agent lesson should land.

## Patch `AGENTS.md` when

- the repository-wide default changed
- the trigger rule for multi-agent mode should change
- the standard verification command changed
- a repo-wide constraint or coding rule should be made explicit

## Patch `multi-agent-dev/SKILL.md` when

- the coordinator workflow needs a new step
- intake, routing, or close-out behavior should change
- the skill should load additional repository-local guidance before acting

## Patch `playbooks.md` when

- task-type routing needs to improve
- verification guidance by task type should change
- the writer-count rule needs better task-specific wording

## Patch a custom agent prompt when

- one role repeatedly misses a responsibility
- the role is overreaching into another role's job
- the return format is too vague to be useful

## Patch `state/heuristics.md` when

- the pattern is likely reusable
- the evidence is good, but too local or too young for a hard prompt change
- you want the coordinator to consult a lightweight memory before routing

## Write only a lesson when

- the signal is interesting but weak
- the situation was highly specific
- the change would otherwise overfit one task
