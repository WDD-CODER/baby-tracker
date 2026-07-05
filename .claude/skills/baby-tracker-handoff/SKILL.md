---
name: baby-tracker-handoff
description: Mandatory end-of-milestone and post-commit handoff for Baby Tracker (Cursor Contractor). Invoke ALWAYS when a milestone finishes (success, partial, review stop, or 3-strike block) OR immediately after a successful git commit the human requested. Writes to AgentMemory first, falls back to sessions/ files. Never skip even if the execution prompt does not mention handoff. Commits use safe-commit-push (worktree-aware). When not on primary main, include Worktree context — see baby-tracker-parallel-worktree pointer.
---

# Baby Tracker — Handoff (Contractor)

You are Cursor, the Contractor. Before you stop working, you **must** hand off context so the Reviewer and human can pick up without re-reading the whole session.

**AgentMemory project slug (always use):** `baby-tracker`

**Standing rule:** This skill applies even when the human did not ask for a summary. Commits are human-only, but **handoff happens immediately when you stop** — milestone end or right after commit — not deferred until review.

---

## When to invoke

| Trigger | Procedure |
|---------|-----------|
| Milestone succeeded or stopped per plan for review | [Milestone handoff](#milestone-handoff-success-or-review-stop) |
| Milestone hit 3-strike limit | [Blocked milestone handoff](#milestone-handoff-3-strike-blocked) |
| Human explicitly asked for a commit and `git commit` succeeded | [Post-commit handoff](#post-commit-handoff) |
| Bug fixes completed via `baby-tracker-fix-bugs` skill | [Bug-fix handoff](#bug-fix-handoff) — same as milestone success template; reference bug file path instead of plan milestone |

Run **both** milestone handoff and post-commit handoff when a milestone ends with a commit in the same session (milestone first, then commit).

---

## AgentMemory write (primary path)

Use MCP server `user-agentmemory`, tool `memory_save`.

```
content:    [full structured summary — see templates below]
type:       workflow
project:    baby-tracker
concepts:   [comma-separated — e.g. milestone,handoff,wave2,M3 or commit,handoff]
files:      [comma-separated paths touched]
```

If `memory_save` fails, errors, or AgentMemory is unreachable → use the file fallback for that handoff type. State clearly in your final message which path you used (`AgentMemory` or `sessions/YYYY-MM-DD.md`).

---

## Milestone handoff (success or review stop)

### Required summary fields

1. **Plan:** `plans/[name]_v1.md` + milestone number + title
2. **Status:** complete / partial / blocked-on-human
3. **Files touched:** list every path changed
4. **What changed:** concise bullet list of behavior/code changes
5. **Verification:** `npm run lint` / `npm run build` / manual — pass or fail with error excerpt
6. **Visual check:** where in the app to look, what changed visually (before → after); or explicit "no visible change yet" for types-only milestones
7. **Next:** what the human or next milestone should do
8. **Worktree context** (if not primary `baby-tracker/` on `main`): path, branch, vs `main`, whether `localhost:3000` shows changes yet — see `baby-tracker-parallel-worktree` pointer; commit flow is `safe-commit-push`

### Steps

1. Build the summary using the template below.
2. Call `memory_save` (primary).
3. Append the same summary to `sessions/YYYY-MM-DD.md` (create or append; use today's date in `YYYY-MM-DD`). Use one `## Milestone N — [title]` section per milestone.
4. **Plan write-off (only when human has approved):** If the human confirmed the milestone passed review in this turn (`milestone N approved`, `mark M[N] complete`, etc.), update `plans/[active].md` and source-audit `DONE` markers per `.cursor/rules/core.mdc`. Do **not** write off the plan at execution-only handoff.
5. Tell the user: handoff destination, one-line status, and repeat the **👀 Visual check** block from the handoff (human-facing — do not bury it only in AgentMemory).

### Template (AgentMemory `content` and session file body)

```markdown
## Milestone [N] — [title]

**Plan:** `plans/[file]_v1.md`
**Status:** [complete | partial | blocked-on-human]

### Files touched
- `path/to/file`

### What changed
- ...

### Visual check
1. [Where to go in the app]
2. Look at: [specific element]
3. Before → Now: [concrete difference, or "no visible change — types only until Mx"]

### Verification
| Check | Result |
|-------|--------|
| npm run lint | Pass / Fail — [detail] |
| npm run build | Pass / Fail / N/A |

### Next
- ...

### Worktree context
*(omit this section when working in primary `baby-tracker/` on `main`)*
| Field | Value |
|-------|-------|
| Path | … |
| Branch | … |
| vs main | ahead N / synced / behind |
| On localhost:3000 yet? | No until merged to main \| Yes (primary) |
```

---

## Milestone handoff (3-strike blocked)

Do **not** attempt a 4th fix. Stop and report.

1. Create `bugs/bug_<short-id>.md` (`short-id` = lowercase slug, e.g. `m4-session-cookie-lint`).
2. Bug report must include: milestone, plan file, what you tried (3 attempts), exact error/symptom, files touched, why this is structural (not a one-line syntax fix).
3. Write a **short pointer** via `memory_save`:
   - `content`: `Milestone [N] blocked — see bugs/bug_<short-id>.md. Plan: plans/[file]_v1.md.`
   - `type`: `bug`
   - `concepts`: `milestone,blocked,3-strike`
4. Append the same pointer + link to `sessions/YYYY-MM-DD.md` under `## Milestone [N] — BLOCKED`.
5. Tell the user the bug file path and that you stopped at 3 strikes.

### Bug file template

```markdown
# Bug: [short title]

**ID:** bug_<short-id>
**Status:** OPEN
**Milestone:** [N] — [title]
**Plan:** `plans/[file]_v1.md`
**Date:** YYYY-MM-DD

## Symptom
[exact error message or behavior]

## What was tried (3 attempts)
1. ...
2. ...
3. ...

## Files touched
- ...

## Why structural
[why this is not a trivial syntax fix — architecture, missing dep, ambiguous spec, etc.]
```

---

## Bug-fix handoff

After `baby-tracker-fix-bugs` closes a bug file (status `DONE` written to the file):

1. Use the [milestone handoff template](#milestone-handoff-success-or-review-stop) with **Plan:** set to the bug file path (e.g. `bugs/2026-07-04-wave2-review-fixes.md`).
2. **Status:** `complete` unless verification failed or human-only items remain.
3. **Next:** note remaining OPEN count in `bugs/` (ideal: 0).

The bug file must already be marked `DONE` before handoff — handoff does not replace Step 5 of the fix-bugs skill.

---

## Post-commit handoff

**Only after** the human explicitly requested a commit and `git commit` completed successfully.

1. Gather: `git log -1 --format=%H` (full hash), `git log -1 --format=%s` (subject), `git show --stat --oneline -1` (files changed).
2. Build commit summary (template below).
3. Call `memory_save`:
   - `type`: `workflow`
   - `concepts`: `commit,handoff,[branch-or-milestone-if-known]`
   - `files`: comma-separated paths from the commit stat
4. Append a `## Commit — [short-hash]` section to `sessions/YYYY-MM-DD.md` with the same content.
5. Tell the user the commit was recorded in AgentMemory (or session file fallback).

### Commit summary template

```markdown
## Commit — [7-char hash]

**Message:** [commit subject line]
**Hash:** [full hash]
**Branch:** [current branch if known]
**Worktree:** [primary `baby-tracker/` | parallel path — if applicable]

### Files in commit
- [from git show --stat]

### Summary
[2–5 sentences: what this commit contains, which milestone/plan it relates to if any, and why it was made]

### Verification at commit time
- lint/build status if run before commit
```

Post-commit handoff is **in addition to** milestone handoff when both occur in one session. Commits do not replace milestone handoff.

---

## File fallback rules

- Path: `sessions/YYYY-MM-DD.md` only for milestone and commit entries (do not create separate `handoff-*-session-close.md` files for routine milestone work).
- Always **append** if the file exists for today.
- Session file content must match AgentMemory content for that handoff.

---

## Final message checklist

Before stopping, confirm in your last reply:

- [ ] Milestone handoff done (or 3-strike bug filed + pointer written)
- [ ] **👀 Visual check** block in final message (specific screen/element + before/after, or "no visible change yet")
- [ ] Post-commit handoff done (if a commit was made this session)
- [ ] Stated whether each handoff went to **AgentMemory** or **sessions/YYYY-MM-DD.md**
