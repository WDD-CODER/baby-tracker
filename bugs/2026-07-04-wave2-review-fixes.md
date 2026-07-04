# Bug Report — Wave 2 Review Fixes
> Filed by: Reviewer (Claude Code)  
> Date: 2026-07-04  
> **Status:** DONE  
> **Closed:** 2026-07-04  
> **Verified:** lint pass, build pass — delete confirm strip implemented per spec  
> Commit reviewed: `9902c83`  
> Priority: Low (no blocking bugs — these are minor cleanup items)

---

## Fix 1 — Add explanatory comment to `deleteEvent` in `server/db.ts`

**File:** `server/db.ts` — `deleteEvent()` function (around line 153)  
**Issue:** The function uses `docRef.update()` instead of `set()`. The rest of the db layer uses `set()` for all writes. Without a comment, a future Cursor session may "fix" this to `set()` and accidentally overwrite the entire document with only `{ deletedAt }`.  
**Required change:** Add a single-line comment above the `update()` call explaining the intent.

```typescript
// update() is intentional here — we want to stamp only deletedAt, not overwrite the full document
await docRef.update({ deletedAt: new Date().toISOString() });
```

---

## Fix 2 — Replace native `confirm()` with a Hebrew confirm modal in `App.tsx`

**File:** `src/App.tsx` — `handleDeleteEvent()` function (around line 1507)  
**Issue:** Uses `window.confirm()` which renders in the OS locale, breaks RTL, and is visually inconsistent with the app's bottom-sheet design language.

```typescript
// Current (replace this):
if (!confirm('האם למחוק את האירוע הזה?')) return;
```

**Required change:** Replace with a small inline confirmation state. Pattern to use:
1. Add `const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)` to state.
2. Instead of calling `confirm()`, call `setPendingDeleteId(id)`.
3. Render a small confirmation bottom-strip or modal when `pendingDeleteId` is set:
   - Text: `"האם למחוק את האירוע הזה?"`
   - Two buttons: `"מחק"` (destructive, calls the actual DELETE fetch) and `"ביטול"` (calls `setPendingDeleteId(null)`)
4. On confirm, run the existing fetch logic and reset `setPendingDeleteId(null)`.

**Constraint:** Keep the confirm UI simple — do NOT build a new generic modal component. Inline JSX in App.tsx only.

---

## Not for Cursor — human decisions required

These items from the review require human input before Cursor can act:

1. **Plan file backfill** — there is no `plans/wave2_ux_v1.md`. Human must decide whether to have the Architect write one retroactively, or accept that this wave was executed from `plans/prd-gap-analysis.md` informally.

2. **Self-chaining policy** — Cursor executed M4 + 6 UX gaps in one session instead of one per session (agent-guide §13). Human must decide whether to accept this batch and clarify the policy for future sessions.

---

## Acceptance criteria for Fix 1 and Fix 2

- [x] `npm run lint` passes with zero errors
- [x] `npm run build` completes without errors
- [x] Delete an event → confirm modal appears in Hebrew → confirm → event is gone from timeline
- [x] Delete an event → confirm modal → cancel → event stays
- [x] Undo toast still appears for create/log actions (no regression)

---

## Resolution

**Closed by:** Cursor (Contractor)  
**Date:** 2026-07-04  
**Files touched:**
- `server/db.ts`
- `src/App.tsx`

**What changed:**
- Added intentional `update()` comment on `deleteEvent` soft-delete path.
- Replaced `window.confirm()` with `pendingDeleteId` state and a Hebrew bottom confirm strip (מחק / ביטול).
