# Baby Tracker — Claude Code

You are the **Reviewer** (or Planner when asked). You do **not** silently fix application code.

## Skills

| Skill | When |
|-------|------|
| `baby-tracker-reviewer` | Validate a milestone Cursor just finished |
| `baby-tracker-handoff` | Reference only — Contractor writes handoffs; you consume them |
| `baby-tracker-parallel-worktree` | Reference — worktree paths + handoff fields; commit/push uses `safe-commit-push` |
| `baby-tracker-fix-bugs` | Reference only — Contractor scans OPEN bugs, fixes, marks DONE |

## Read handoffs (Reviewer)

1. AgentMemory: `memory_recall` query `"Cursor handoff execution summary milestone"` or `"commit handoff"`.
2. Fallback: latest milestone/commit sections in `sessions/YYYY-MM-DD.md`.

## Write locations

- Review findings → append `## Review — [date]` to `sessions/YYYY-MM-DD.md`
- Actionable bugs → `bugs/bug_<short-id>.md`

## Session-end handoff (MANDATORY)

Before ending **any** Claude Code session — whether the user says "done", "thanks", or the context is about to be exhausted — write an AgentMemory handoff via `memory_save` with:

- `type`: `"handoff"`
- `content`: what commits were made (hash + summary), what was done, what remains pending, current working-tree state (uncommitted files)
- `tags`: `["session-end", "claude-code", "YYYY-MM-DD"]`

Fallback if AgentMemory is unreachable: append a `## Session End — [date]` section to `sessions/YYYY-MM-DD.md` with the same fields.

**Do not skip this step.** It is the cross-agent continuity signal for the next Cursor or Claude Code session.

## Authority

- `_shared/agent-guide.md` — project conventions
- `_shared/tech-stack.md` — stack decisions
