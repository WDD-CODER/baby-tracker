# Manual Bridge Workflow

This repository uses a three-agent workflow for structured development. The Baby Tracker application code lives alongside this scaffolding — the workflow folders and rule files do not replace or modify existing project files.

## Three roles

| Role | Agent | Responsibility |
|------|-------|----------------|
| **Architect** | Human + planning tools | Defines the brief, writes plans in `plans/`, approves milestones |
| **Contractor** | Cursor | Executes one milestone at a time, writes code, logs progress to `sessions/` |
| **Reviewer** | Claude Code | Validates work against acceptance criteria, reports findings (never silently fixes code) |

Operating rules for each agent are in `.cursorrules` (Cursor) and `CLAUDE.md` (Claude Code). The authoritative tech stack lives in `_shared/tech-stack.md`.

## The loop

Each piece of work follows this cycle:

1. **Brief** — The Architect describes what needs to happen.
2. **Plan** — A versioned plan is written to `plans/` (immutable once approved; changes require a new version).
3. **Carry** — The Contractor reads the plan and confirms scope before starting.
4. **Execute** — The Contractor implements **one milestone**, then stops for approval.
5. **Validate** — The Reviewer checks the work against the milestone's acceptance criteria.
6. **Verify** — Run the verification commands listed in the plan.
7. **Test** — Manual or automated testing as appropriate.
8. **Commit** — Changes are committed only when the human explicitly requests it.

If execution fails after three fix attempts, the Contractor reverts scoped changes and files a report in `bugs/`.

## Folder layout

```
plans/       Versioned plans from the Architect
bugs/        Issue reports when execution or review fails
sessions/    Daily execution and review summaries (YYYY-MM-DD.md)
_shared/     Shared references (tech stack, conventions)
.env         Local secrets (never committed)
```

## Stage 0 — file-based communication

Right now, agents coordinate through files in `sessions/`. The Contractor writes an execution summary at the end of each session; the Reviewer reads those summaries and writes findings back to the same folder.

This is intentional scaffolding. A future stage will wire automated memory so agents can share context without relying solely on markdown files in `sessions/`. Until then, treat `sessions/` as the source of truth for what happened in each work session.

## Getting started

1. Place an approved plan in `plans/`.
2. Tell Cursor to execute **Milestone 1** only.
3. After Cursor stops, ask Claude Code to review against the acceptance criteria.
4. Repeat for each milestone until the plan is complete.
