# Handoff for Planner — Baby Tracker — 2026-06-30

> **Purpose:** Give this file to the Architect / Claude Code Reviewer so they can write the **next Plan Contract** in `plans/` for Cursor to execute.  
> **Executor after plan:** Cursor (Contractor) — one milestone at a time, then stop for human review.

---

## 1. What this project is

**מעקב תינוק (Baby Tracker)** — Hebrew-first, RTL baby medical tracker for two parents (shared household).  
Stack: **React 19 + Vite 6 + Express + TypeScript + Firestore + Tailwind v4 + Motion**.  
Hosting: **Google AI Studio → Cloud Run**. Local dev: `npm run dev` (port 3000). Lint: `npm run lint` (`tsc --noEmit`).

**Repo:** `https://github.com/WDD-CODER/baby-tracker`  
**AI Studio app:** https://ai.studio/apps/8dc56127-6e5c-4f0c-8534-b1f528c48c4f

**Architecture:** Single-component frontend (`src/App.tsx`, ~5,200 lines). All Firestore access via `server/db.ts` only. Express API in `server.ts`.

---

## 2. Git / sync state (critical)

| Item | State |
|------|--------|
| **GitHub `main` HEAD** | `c7f58a3` — *feat: migrate to Firebase Client SDK* (AI Studio push) |
| **Local `main`** | Same commit + **uncommitted wave1 changes** (human tested — works) |
| **Not on GitHub yet** | wave1 code + `plans/` + `_shared/agent-guide.md` + full `sessions/2026-06-30.md` |

**Sync rule (human confirmed):** Before editing in **either** AI Studio or Cursor → `git pull origin main`. After a chunk of work → commit + push. Small, frequent pushes avoid painful merges.

**Note:** AI Studio commit `c7f58a3` **deleted** workflow files that existed locally (`.cursorrules`, `CLAUDE.md`, `README_WORKFLOW.md`, `_shared/tech-stack.md`, etc.). Local copies may exist as untracked files — planner should not assume they are on `main`.

---

## 3. Just completed — Wave 1 data model (`plans/wave1_data_model_v1.md`)

**Status:** Implemented locally on top of `c7f58a3`, **human smoke-tested OK**, **not committed/pushed**.

| Gap | What was added |
|-----|----------------|
| **GAP-01** | `SleepPayload.loggedByStart` / `loggedByEnd`; server `/api/sleep/toggle` sets them from `activeParent` |
| **GAP-02** | `NutritionPayload.topUp` + breast-feed edit UI ("תוסף בקבוק") + timeline badge |
| **GAP-03** | `UserSettings.babyProfile` + Settings UI ("פרטי תינוק") |
| **BUG-01** | `getTodayNutritionSummary` uses `Asia/Jerusalem` not UTC |

**Files touched:** `src/types.ts`, `server.ts`, `server/db.ts`, `src/App.tsx`  
**Verification:** `npm install` + `npm run lint` → exit 0  
**Detail log:** `sessions/2026-06-30.md` (section "RE-APPLIED after GitHub sync")

**Human action pending:** commit + push wave1 when ready (not done by Cursor unless explicitly asked).

---

## 4. Current upstream baseline features (post–AI Studio)

Beyond original import, `c7f58a3` adds (wave1 was merged *onto* this, not replacing it):

- Firebase **Client SDK** in `server/db.ts` (not `@google-cloud/firestore`)
- New event types: **PUMPING**, **VOMITING**
- `NutritionPayload.swallowingNoises`, `BabyEvent.quickRecorded`
- 6 AM **baby-day** logic (`getBabyDayEvents`), sleep cycle analysis, quick sleep toggle, expanded dashboards
- `firebase-applet-config.json` committed to repo (web config — API key is public by design)

---

## 5. Security finding — needs a plan (high priority)

**Firestore rules are wide open** (`firestore.rules`):

```
allow read, write: if true;
```

Anyone with the public Firebase web config can read/write/delete all household + event data. The **API key in `firebase-applet-config.json` is NOT the secret** — the missing access control is.

**Planner should:** Draft a Plan Contract (e.g. `plans/wave2_firestore_auth_v1.md`) covering:

- Minimum viable lock-down appropriate for a **two-parent household app** on **Firebase free tier**
- Options to evaluate: Firebase Auth (email/password or anonymous + custom claims), shared household PIN, or server-only writes (Express holds credentials — may conflict with current Client SDK in `server/db.ts`)
- Updated `firestore.rules` + how local dev / AI Studio / Cloud Run authenticate
- **No breaking** the current no-login UX unless human accepts a login step
- Out of scope: full multi-tenant, OAuth providers, etc. unless human asks

Reference: PRD gap analysis mentions delete-without-auth (`GAP-09`) but not rules — this is a **new explicit security gap** discovered 2026-06-30.

---

## 6. Backlog for future plans (after security or in parallel)

Full list: `plans/prd-gap-analysis.md` (16 gaps, 5 waves).

**Wave 2 candidates (P1):**

| Gap | Summary |
|-----|---------|
| GAP-06 | Undo toast after log |
| GAP-07 | Hebrew empty states |
| GAP-08 | Poll-on-focus for concurrent sleep |
| GAP-09 | Delete confirmation + optional soft-delete |
| GAP-11 | Export date-range picker UI |
| GAP-12 | 12h sleep "still sleeping?" warning |

**Wave 3+:** Semantic Icon System (GAP-04), PWA (GAP-05), design tokens (GAP-10), interactive dashboards (GAP-14), etc.

---

## 7. Planner deliverable checklist

When writing the next plan, include:

1. **Immutable Plan Contract** in `plans/[name]_v1.md` — milestones, affected files, acceptance tests, verify commands
2. **Milestone isolation** — one milestone per Cursor run, then STOP
3. **Stack constraints:** React 19, Firestore via `server/db.ts`, Tailwind v4 (no `tailwind.config.js`), `motion/react`, no new sub-components (JSX stays in `App.tsx`), no `any`, Hebrew UI strings
4. **Do not modify** workflow files unless human asks to restore them to `main`
5. Point Cursor to read `_shared/agent-guide.md` (local, may be untracked) for API/data model reference

---

## 8. Suggested immediate sequence (human to confirm)

1. **Commit + push wave1** to `main` (human or Cursor on request)
2. **Planner writes** `wave2_firestore_auth_v1.md` (or similar)
3. **Human approves** plan → Cursor executes Milestone 1 only
4. **Claude Code reviews** → human approves next milestone
5. Continue with Wave 2 UX gaps from PRD analysis

---

## 9. Key file map

| Path | Role |
|------|------|
| `src/types.ts` | Data model source of truth |
| `src/App.tsx` | Entire UI |
| `server.ts` | Express routes |
| `server/db.ts` | Firestore (Client SDK) |
| `firestore.rules` | **Currently open — fix in next plan** |
| `firebase-applet-config.json` | Firebase web config (public identifiers) |
| `plans/prd-gap-analysis.md` | Full gap backlog |
| `plans/wave1_data_model_v1.md` | Completed plan (reference) |
| `sessions/2026-06-30.md` | Execution + review log |

---

*End of handoff — 2026-06-30*
