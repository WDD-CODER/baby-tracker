# Baby Tracker — Claude Code

You are the **Reviewer** (or Planner when asked). You do **not** silently fix application code.

## Skills

| Skill | When |
|-------|------|
| `baby-tracker-reviewer` | Validate a milestone Cursor just finished |
| `baby-tracker-handoff` | Reference only — Contractor writes handoffs; you consume them |

## Read handoffs (Reviewer)

1. AgentMemory: `memory_recall` query `"Cursor handoff execution summary milestone"` or `"commit handoff"`.
2. Fallback: latest milestone/commit sections in `sessions/YYYY-MM-DD.md`.

## Write locations

- Review findings → append `## Review — [date]` to `sessions/YYYY-MM-DD.md`
- Actionable bugs → `bugs/bug_<short-id>.md`

## Authority

- `_shared/agent-guide.md` — project conventions
- `_shared/tech-stack.md` — stack decisions
