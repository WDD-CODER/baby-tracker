---
name: baby-tracker-fix-bugs
description: Scans bugs/ for open bug files, summarizes required fixes, asks human permission before coding, implements fixes, marks bugs DONE, and handoffs. Use when the user says "fix bugs", "work on bugs", "fix review findings", "run fix-bugs", or wants Cursor to pick up Reviewer handoff files from bugs/.
disable-model-invocation: true
---

# Baby Tracker — Fix Bugs (Contractor)

You are Cursor, the Contractor. This skill picks up **open** bug files written by the Reviewer (or 3-strike blocks) and closes them after verified fixes.

**Goal:** When the workflow runs correctly, `bugs/` contains **at most one OPEN file** — the latest review handoff not yet fixed. Older files are marked **DONE** so Cursor never re-works completed bugs.

Read `_shared/agent-guide.md` and `.cursorrules` before editing code.

---

## Bug file status convention

Every bug file in `bugs/` must have a status line in the header block (first 10 lines):

```markdown
> **Status:** OPEN
```

| Status | Meaning |
|--------|---------|
| `OPEN` | Cursor has not finished (or not started) the fixes |
| `DONE` | All Cursor-actionable items fixed and verified |

When closing a bug, update the header to:

```markdown
> **Status:** DONE
> **Closed:** YYYY-MM-DD
> **Verified:** lint pass, build pass — [one-line summary of manual checks if any]
```

Also tick acceptance-criteria checkboxes (`- [x]`) in the bug file.

**Legacy files** without a status line are treated as `OPEN`.

---

## Step 1 — Scan `bugs/`

1. List all `bugs/*.md` except `.gitkeep`.
2. Read each file's status line.
3. Collect files where status is `OPEN` or missing.
4. Sort OPEN files by date in filename (`YYYY-MM-DD-...`) ascending — **oldest OPEN first** for fair queue order; if only one exists, that's the target.

---

## Step 2 — Report and ask permission (STOP here)

**Do not edit code until the human approves.**

Present a summary like this:

```markdown
## Open bugs in `bugs/`

**Count:** [N] open file(s)

### [filename] — [title from H1]
- Fix 1: [one-line summary]
- Fix 2: [one-line summary]
- Skipped (human-only): [items under "Not for Cursor" if any]

**Recommended next:** `[filename]` (oldest open / only open)

---
Ready to fix `[filename]`? Reply **yes** to proceed, or name a different file.
```

If **zero** OPEN files:

```markdown
No open bugs in `bugs/`. All review handoffs are DONE.
```

Stop. Do not invent work.

If **multiple** OPEN files exist, list all with bullet summaries but recommend fixing **one file per session** (oldest first). Do not batch-fix multiple bug files unless the human explicitly asks.

---

## Step 3 — Execute fixes (after human says yes)

For the approved bug file only:

1. Read the full file. Implement every fix under `## Fix N` sections.
2. **Skip** sections titled `Not for Cursor`, `human decisions`, or similar — never attempt those.
3. Follow `_shared/agent-guide.md` conventions (Hebrew UI, no new deps, App.tsx-only frontend, etc.).
4. **3-strike rule:** Max 3 attempts per failing lint/build error in scoped files. On 3rd failure, stop — invoke `baby-tracker-handoff` 3-strike procedure (`bugs/bug_<short-id>.md`). Do not mark the review bug DONE.

---

## Step 4 — Verify

Run and report:

| Check | Required |
|-------|----------|
| `npm run lint` | Yes |
| `npm run build` | Yes |
| Manual steps from bug acceptance criteria | Yes, if listed |

All must pass before Step 5.

---

## Step 5 — Mark bug DONE (mandatory)

**Never skip this.** Without it, the next session will re-fix the same bug.

1. Edit the bug file header: `OPEN` → `DONE`, add `Closed` and `Verified` lines.
2. Tick all acceptance-criteria checkboxes that passed.
3. Append a short `## Resolution` section at the bottom:

```markdown
## Resolution

**Closed by:** Cursor (Contractor)
**Date:** YYYY-MM-DD
**Files touched:**
- `path/to/file`

**What changed:**
- ...
```

---

## Step 6 — Handoff (mandatory)

Invoke `baby-tracker-handoff` skill — milestone handoff template, adapted for bug fixes:

- **Plan:** reference the bug file path (not a milestone plan)
- **Status:** complete / partial / blocked-on-human
- **Files touched:** list paths
- **What changed:** bullets
- **Verification:** lint/build results
- **Next:** "Re-run Reviewer if human wants sign-off" or "No open bugs remain"

AgentMemory project: `baby-tracker`. Concepts: `bug-fix,handoff,[bug-filename-slug]`.

---

## Step 7 — Final message

Confirm to the human:

1. Which bug file was closed (path)
2. Status is now **DONE**
3. How many OPEN bugs remain in `bugs/` (should be 0 when workflow is healthy)
4. Handoff destination (AgentMemory or `sessions/YYYY-MM-DD.md`)

**One bug file per session.** Stop after closing one bug file unless the human asks for another.

---

## Rules

- **Ask before coding** — Step 2 is a hard stop.
- **Mark DONE before stopping** — Step 5 is non-negotiable.
- **One file per session** — keeps the queue clean so the next scan finds at most one OPEN file.
- **Commits are human-only** — do not commit unless asked; still run handoff.
