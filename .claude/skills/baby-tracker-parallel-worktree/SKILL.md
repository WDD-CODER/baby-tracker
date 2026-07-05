---
name: baby-tracker-parallel-worktree
description: >-
  Pointer only — Baby Tracker worktree paths and handoff fields. For commit,
  push, and merge-back always invoke safe-commit-push skill first (Step 0
  detects WORKTREE mode). Use when workspace is baby-tracker-parallel or
  handoff needs Worktree context.
---

# Baby Tracker — Worktree pointer

**Commit / push / merge:** invoke **`safe-commit-push`** — it handles worktree detection, localhost warning, and merge-back to `main`.

This file only records **project paths** and **handoff fields**.

## Paths

| Role | Folder | Branch | User's `:3000` dev server |
|------|--------|--------|---------------------------|
| Primary | `baby-tracker/` | `main` | Yes — changes appear here after merge |
| Worktree | `baby-tracker-parallel/` | `worktree/parallel` | No — until merged to `main` |

## Handoff fields (WORKTREE sessions)

Add to `baby-tracker-handoff` when not on primary `main`:

```markdown
### Worktree context
| Field | Value |
|-------|-------|
| Path | … |
| Branch | … |
| vs main | ahead N / behind N |
| On localhost:3000 yet? | No — merge to main required |
```

AgentMemory `concepts`: include `worktree,<branch-slug>`.
