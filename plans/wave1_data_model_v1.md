# PLAN: wave1_data_model — v1
> Immutable once approved. Changes require a new version (v2, v3…).  
> Source: PRD v2.2 GAP-01 / GAP-02 / GAP-03 / BUG-01  
> Executor: Cursor (Contractor)  
> Reviewer: Claude Code CLI  
> Human approves each milestone before the next begins.

---

## Objective

Close four data-model gaps identified in the PRD gap analysis before more medical data accumulates:
1. **GAP-01** — SleepPayload needs `loggedByStart` / `loggedByEnd` for cross-parent session attribution
2. **GAP-02** — NutritionPayload needs optional `topUp` object for breastfeeding top-up bottle tracking
3. **GAP-03** — UserSettings needs optional `babyProfile` for export header (name, DOB, birth weight)
4. **BUG-01** — `getTodayNutritionSummary` in App.tsx uses UTC date instead of Asia/Jerusalem date

Each milestone is independently verifiable. Execute ONE, then STOP for review.

---

## Affected Files

| File | Action | Why |
|---|---|---|
| `src/types.ts` | modify | Add new type fields (all four gaps touch the type layer) |
| `server/db.ts` | modify | Persist new fields to Firestore on save; read them back on get |
| `server.ts` | modify | `/api/sleep/toggle` must accept and pass `loggedByStart`/`loggedByEnd` |
| `src/App.tsx` | modify | (a) pass `activeParent` on sleep toggle; (b) baby profile Settings UI; (c) timezone bug fix; (d) top-up UI on breast feed cards |

---

## Milestones

---

### Milestone 1 — Type layer: add all new fields to `src/types.ts`

**Changes — `src/types.ts` only:**

1. **SleepPayload** — add two optional fields after `startLocation`:
   - `loggedByStart?: ParentType` — the parent who pressed "start sleep"
   - `loggedByEnd?: ParentType` — the parent who pressed "end sleep" (absent until session closes)

2. **NutritionPayload** — add one optional field after `spitUp`:
   - `topUp?: TopUpPayload` where `TopUpPayload` is a new interface with:
     - `liquidType: 'EXPRESSED_MILK' | 'FORMULA'`
     - `consumedMl: number`
   
   Export `TopUpPayload` as a named interface so it can be used in App.tsx and server code.

3. **UserSettings** — add one optional field:
   - `babyProfile?: BabyProfile` where `BabyProfile` is a new interface with:
     - `name: string`
     - `dateOfBirth: string` (ISO date string, YYYY-MM-DD)
     - `birthWeightGrams: number`
   
   Export `BabyProfile` as a named interface.

All new fields are **optional** (`?`) so existing Firestore documents that lack them remain valid without any migration.

**Acceptance test:** Running `npm run lint` (which runs `tsc --noEmit`) completes with zero errors. No runtime changes yet — this milestone is type definitions only.

**Verify command:**
```powershell
npm run lint
```
Expected output: no errors, process exits 0.

---

### Milestone 2 — Backend: wire new fields through server layer

**Changes — `server/db.ts` and `server.ts`:**

#### `server/db.ts`

- `saveEvent()` — no changes needed here because it saves the entire `BabyEvent` object as-is to Firestore. The new optional fields in types.ts will simply be present or absent in the document. **Verify this is already the case** (generic spread/assign) and add a comment noting the optional fields are handled passively.

- `getOpenSleepSession()` — no changes needed (already returns the full event document).

#### `server.ts` — `/api/sleep/toggle` endpoint

Currently this endpoint receives a `location` field in the request body (when opening a session). Extend it to also receive `activeParent` from the request body:

- **When OPENING a new sleep session:** set `sleep.loggedByStart` to the value of `req.body.activeParent` (which is `'PARENT_A'` or `'PARENT_B'`). Validate that `activeParent` is one of those two values; if absent or invalid, default to `'PARENT_A'` silently (never throw for this field).

- **When CLOSING an existing sleep session:** set `sleep.loggedByEnd` to the value of `req.body.activeParent` on the existing sleep event document being updated. Use the existing `saveEvent()` or `updateEvent()` path — whichever is currently used to set `endAt` and `durationMinutes`.

No other endpoints need changes in this milestone.

**Acceptance test:**
1. Open a sleep session via POST to `/api/sleep/toggle` with body `{ "location": "CRIB", "activeParent": "PARENT_A" }`. 
2. GET `/api/sleep/open` — the returned event's `sleep` object must contain `loggedByStart: "PARENT_A"`.
3. Close the session via POST to `/api/sleep/toggle` with body `{ "activeParent": "PARENT_B" }`.
4. GET `/api/events` — the most recent SLEEP event's `sleep` object must contain both `loggedByStart: "PARENT_A"` and `loggedByEnd: "PARENT_B"`.

**Verify command:**
```powershell
npm run lint
```
Then manually test the toggle flow using the running dev server (`npm run dev`) and the browser or curl. Confirm the Firestore document has the new fields by checking the response JSON.

---

### Milestone 3 — Frontend: baby profile in Settings + timezone bug fix

**Changes — `src/App.tsx` only. Two independent sub-changes in one milestone.**

#### Sub-change A: Baby profile in Settings tab

In the Settings view (where `activeTab === 'settings'`):

Add a new "פרטי תינוק" (Baby Details) section below the existing parent name fields. The section contains:

1. **Name input** — a text input for the baby's name. Label: "שם התינוק". Controlled by a new state variable `babyNameInput: string` (initialized from `settings.babyProfile?.name ?? ''`).

2. **Date of birth input** — a date input (`type="date"`) for birth date. Label: "תאריך לידה". Controlled by a new state variable `babyDobInput: string` (initialized from `settings.babyProfile?.dateOfBirth ?? ''`).

3. **Birth weight input** — a number input for birth weight in grams. Label: "משקל לידה (גרם)". Use the existing Stepper pattern (+ / − buttons flanking a number, step 10g). Controlled by a new state variable `babyBirthWeightInput: number` (initialized from `settings.babyProfile?.birthWeightGrams ?? 0`).

4. **Save button** — uses the same "שמירה" pattern as the parent name save. On click, calls `PUT /api/settings` with the full updated settings object including `babyProfile: { name: babyNameInput, dateOfBirth: babyDobInput, birthWeightGrams: babyBirthWeightInput }`. Only saves `babyProfile` if `babyNameInput` is non-empty.

Use the same Tailwind classes and visual style already used in the parent name settings section so the UI is consistent.

#### Sub-change B: Timezone bug fix in getTodayNutritionSummary

Locate the function `getTodayNutritionSummary` in App.tsx (searches summary data and/or events to compute today's nutrition totals for the Now strip).

The bug: it determines "today" using UTC (`new Date().toISOString().split('T')[0]`), causing events logged after midnight Jerusalem time but before midnight UTC to appear in the wrong day.

Fix: replace the UTC today string with:
```
new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jerusalem' })
```
The `sv-SE` locale produces `YYYY-MM-DD` format, matching the existing string comparison format. Apply the same fix to any other place in App.tsx that derives a "today" date string for local display (search for `.toISOString().split('T')[0]` — fix each occurrence that is used for display bucketing, not for constructing UTC timestamps to send to the server).

**Acceptance test:**
1. Open Settings tab → confirm the "פרטי תינוק" section is visible.
2. Fill in baby name "אריאל", a date, birth weight 3200g → tap Save → reload the app → confirm the values persist (fetched from server on load).
3. Timezone bug: log a nutrition event. On the Log tab's Now strip, confirm the event appears in today's nutrition total. (Full verification of the timezone fix requires testing at midnight Israel time, so a code review of the fix is sufficient for sign-off.)

**Verify command:**
```powershell
npm run lint
```
Then test in browser: Settings → baby profile section visible, save works, reload persists.

---

### Milestone 4 — Frontend: sleep card cross-parent display + top-up UI on breast feed cards

**Changes — `src/App.tsx` only. Two visual additions.**

#### Sub-change A: Sleep timeline cards show loggedByStart and loggedByEnd

In the section of App.tsx that renders SLEEP event cards on the Timeline tab:

Currently, sleep cards show `loggedBy` (single parent). Update the card to show:
- If `event.sleep?.loggedByStart` is present and `event.sleep?.loggedByEnd` is present AND they are different: show "התחיל: [parentStart] · סיים: [parentEnd]" where `[parentStart]` and `[parentEnd]` are the display names from `settings.parentAName` / `settings.parentBName`.
- If they are the same parent (or only `loggedByStart` is set): show the single parent name as before.
- For in-progress sessions (endAt is null): show "מתחיל: [parentStart]" only.

Use `settings.parentAName` for `PARENT_A` and `settings.parentBName` for `PARENT_B`. The helper already exists in the file (the function that maps ParentType to display name).

Also update the sleep toggle call: when calling `POST /api/sleep/toggle`, include `activeParent` in the request body alongside the existing `location` field. The `activeParent` value is the current `activeParent` state variable already in scope.

#### Sub-change B: Top-up bottle UI on breast feed cards

**Where it appears:** In the edit bottom sheet for a BREAST feed event (when `activeSheet === 'edit'` and `editingEvent?.nutrition?.feedType === 'BREAST'`).

Add a collapsible "תוסף בקבוק" (Top-up bottle) section at the bottom of the breast feed edit sheet, above the Save button:

1. A toggle button labeled "+ תוסף בקבוק". Tapping it expands the section (controlled by a new boolean state `showTopUp: boolean`, reset to false when the edit sheet opens).

2. When expanded, show:
   - Liquid type toggle: "חלב שאוב" / "פורמולה" (same visual style as the bottle type toggle in the bottle sheet). Controlled by `topUpLiquidType: 'EXPRESSED_MILK' | 'FORMULA'` state, defaulting to `settings.defaultBottleType`.
   - Consumed ml stepper: "כמות שנאכלה: [− X +] מ"ל". Controlled by `topUpConsumedMl: number` state, defaulting to 30, step 10, min 0, max 300. Label must say "כמות שנאכלה" (amount consumed) — never "הוצע" (offered) because the medical question is what the baby actually took.

3. When the edit sheet saves (PUT /api/events/:id), include `topUp: { liquidType: topUpLiquidType, consumedMl: topUpConsumedMl }` inside the `nutrition` payload **only if** `showTopUp` is true AND `topUpConsumedMl > 0`. If `showTopUp` is false, send `topUp: null` to clear any existing top-up.

4. When opening the edit sheet for a breast event that already has a `topUp`, pre-populate: set `showTopUp = true`, `topUpLiquidType = event.nutrition.topUp.liquidType`, `topUpConsumedMl = event.nutrition.topUp.consumedMl`.

On the timeline card for a BREAST event that has `topUp`: add a small badge below the main feed info showing "+[N] מ"ל" (the topUpConsumedMl). Use a muted style — it's secondary to the main breast feed card.

**Acceptance test:**
1. Log a breast feed event.
2. Tap that card to open the edit sheet. Confirm "+ תוסף בקבוק" button is visible.
3. Tap it — expand — set liquid type and consumed ml (e.g. 40).
4. Save. The timeline card for that event now shows "+40 מ"ל".
5. Re-open the edit sheet — confirm the top-up values are pre-populated.
6. Sleep test: in Timeline, tap a completed SLEEP event that was started by PARENT_A and ended by PARENT_B — confirm the card shows both parent names.

**Verify command:**
```powershell
npm run lint
```
Then test all four scenarios above in the browser.

---

## Migration / Conflicts

All new fields are optional on both the TypeScript types and the Firestore documents. Existing documents without the new fields will continue to work — the optional chaining (`?.`) pattern already used throughout App.tsx handles absent fields gracefully. No Firestore migration script is needed.

The only state variables added to App.tsx are: `babyNameInput`, `babyDobInput`, `babyBirthWeightInput`, `showTopUp`, `topUpLiquidType`, `topUpConsumedMl`. All are scoped to their respective UI sections.

---

## Conventions Reminder (inline — Cursor must not drift from these)

- **Tech stack is authoritative in `/_shared/tech-stack.md`** — consult before any decision
- **`server/db.ts` is the ONLY place Firestore is touched** — never call Firestore directly from server.ts or App.tsx
- **Tailwind v4** — NO `tailwind.config.js`. Custom tokens go in `src/index.css` `@theme` block only. Do not create a config file.
- **Animation library**: import from `motion/react` — NOT `framer-motion`
- **Icons**: Lucide React, named imports only
- **No new sub-components** — all JSX stays in App.tsx (single-component architecture)
- **No `any` types** — every new variable and function must be fully typed
- **Lint gate**: `npm run lint` (`tsc --noEmit`) must pass with zero errors after every milestone
- **No test framework** — acceptance test is manual + tsc; no Jest/Vitest
- **Hebrew strings in UI** — all user-facing labels in Hebrew; code identifiers in English
- **Secrets**: nothing in source — `.env` only

---

## Out of Scope (do NOT touch)

- The Semantic Icon System (GAP-04) — a separate plan
- PWA configuration (GAP-05) — a separate plan
- Dashboard visual changes — a separate plan
- Any refactoring of existing working code
- `.cursorrules`, `CLAUDE.md`, `_shared/tech-stack.md` — do not modify workflow files
- Any new npm packages (all needed capabilities exist in the current stack)

---

## Cursor Execution Instructions

Paste the following prompt into Cursor for each milestone, changing the milestone number each time:

```
Execute ONLY Milestone [N] from /plans/wave1_data_model_v1.md.
- Read the plan file carefully before touching any code.
- Follow /_shared/tech-stack.md and .cursorrules for all conventions.
- Do NOT mark the milestone complete in the plan file.
- Do NOT start the next milestone.
- One milestone, then STOP and wait for human review.
- If you hit an error: at most 3 fix attempts within the scoped files only, then stop and report the error with the full message.
When done, write a short summary of exactly what you changed to /sessions/[today's date].md, then STOP.
```
