# AI Agent Guidebook — Baby Tracker

**This file is for Claude Code (Reviewer).** Cursor uses `.cursor/rules/*.mdc` instead — those files are auto-loaded by file context and do not need to be read manually.

---

## 1. Roles

| Agent | Role | Primary Files |
|-------|------|---------------|
| **Cursor** (Contractor) | Executes milestones. One milestone at a time. | `src/`, `server/`, `server.ts` |
| **Claude Code** (Reviewer) | Validates output. Files bugs. Never silently fixes. | `sessions/`, `bugs/`, `plans/` |
| **Human** | Approves milestones. Makes stack decisions. | Everything |

Never skip human approval between milestones.

---

## 2. Project Overview

**מעקב תינוק** — Hebrew-first RTL baby tracker for Israeli parents. Google AI Studio / Cloud Run.

Stack: React 19 + Vite + TypeScript + Express + Firestore (Admin SDK). Tailwind v4. PWA. No automated test framework.

---

## 3. Project Structure

```
src/App.tsx        ← ENTIRE frontend (~2000 lines, one App() function, no sub-components)
src/types.ts       ← ALL TypeScript types (source of truth)
src/index.css      ← Global CSS + Tailwind v4 @theme blocks
server/db.ts       ← ALL Firestore operations
server.ts          ← ALL Express routes + Vite dev middleware
firestore.rules    ← Firestore security rules
_shared/           ← Agent guides
plans/             ← Implementation plans (one per feature wave)
bugs/              ← Review handoffs OPEN → DONE
sessions/          ← Milestone handoff summaries
.cursor/rules/     ← Cursor rules (.mdc, auto-loaded by file context)
```

---

## 4. Reviewer Workflow Rules

- **Never silently fix code.** Surface issues, recommend. Fix belongs to Cursor or human.
- **Read handoffs** from AgentMemory (`memory_recall`) first, then `sessions/YYYY-MM-DD.md`.
- **Check for secrets leakage and scope creep** in every review.
- **Write Cursor handoff** to `bugs/YYYY-MM-DD-<slug>-review.md` for all actionable issues.
- **Append review findings** to `sessions/YYYY-MM-DD.md`.
- **Escalate structural problems** — wrong architecture, ambiguous plan, unapproved dependency → recommend Architect revision. Do not ask Cursor to patch around a structural issue.
- **Session-end handoff (MANDATORY):** Before ending any session, call `memory_save` with `type: "handoff"`, summarising commits made (hash + summary), work done, pending items, and working-tree state. Fallback: append `## Session End — [date]` to `sessions/YYYY-MM-DD.md`.

---

## 5. Key Constraints to Check in Every Review

- No `any` (except `'sleep' as any` in `activeSheet` — known pattern, do not flag)
- All user-facing strings in Hebrew; code and comments in English
- No new files under `src/` unless the milestone explicitly called for it
- No unapproved npm packages (forbidden: Redux, Zustand, axios, react-query, react-router, chart.js, recharts, moment, lodash)
- All Firestore in `server/db.ts` — none in `server.ts` or `src/`
- No hardcoded secrets; sensitive values via `process.env.*`; sensitive files in `.gitignore`
- `motion/react` not `framer-motion`; Lucide React icons only; native `fetch()` only
- Soft-delete: `deleteEvent()` uses `update({ deletedAt })` intentionally — do not flag as `set()` violation

---

## 6. Known Bugs / Quirks

1. **`sleep as any`:** `openAddSheet('sleep' as any)` — type gap, known, do not flag.
2. **Daily nutrition UTC bug:** `getTodayNutritionSummary()` uses UTC date client-side; Israel events after midnight UTC land in wrong day. Low priority.
3. **Consumed can exceed offered** if user lowers `amountOfferedMl` after setting consumed. Low priority.
4. **`getOpenSleepSession` full scan** — fetches all SLEEP events, filters in-memory. Future optimization.

---

## 7. Workflow Policy

### Cursor (Contractor)
- ONE milestone per session. No self-chaining.
- Bug fixes: `baby-tracker-fix-bugs` skill. One OPEN bug per session.
- 3-strike rule: max 3 fix attempts, then `bugs/bug_<id>.md`, stop.
- Mandatory handoff always: `baby-tracker-handoff` skill → AgentMemory first, `sessions/` fallback.
- **Visual check in every milestone reply:** Cursor gives the human a short "where to look + before/after" (or "no visible change yet") — see `.cursor/rules/testing.mdc`.
- **Commit / push / merge:** `safe-commit-push` skill — worktree detection, merge-back from primary folder.
- **Worktree handoff fields:** `baby-tracker-parallel-worktree` pointer (paths only).

### Plan Execution Snippet (include in every plan's Cursor instructions)

```
Execute ONLY Milestone [N] from plans/[plan]_v1.md.
- Follow .cursor/rules/core.mdc and load other rules as needed by file context.
- Do NOT mark the milestone complete in the plan file at end of execution — wait for human approval after review.
- When human confirms milestone passed review (`milestone N approved` / `mark M[N] complete`): update plans/[plan]_v1.md status + audit bug DONE markers.
- Do NOT start the next milestone. One milestone, then STOP.
- 3-strike rule: max 3 fix attempts in scoped files, then bugs/bug_<id>.md, stop.
- BEFORE STOPPING: invoke baby-tracker-handoff skill.
- If human requests a commit and it succeeds: run post-commit handoff from the same skill.
```
