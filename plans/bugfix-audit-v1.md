# Plan Contract — Bug Audit Fixes

> **Status:** In progress — M5 complete, awaiting human check before M6.
> **Source:** `bugs/2026-07-04-full-feature-audit.md` — 29 bugs across 18 features.
> **Immutable once approved.** Cursor executes ONE milestone per run, then STOPS.
> **Rule:** For each milestone, read ONLY the files listed under "Read". Do not open any other file.

---

## Milestone 1 — Server-side fixes (4 bugs)

> **Milestone status:** ✅ DONE — awaiting human check (2026-07-04)
> **Verified:** lint pass, build pass — ready for human acceptance tests below

**Bugs:** BUG-AU1 ✅ | BUG-X1 ✅ | BUG-X2 ✅ | BUG-X3 ✅
**Priority:** P1 + P2 — auth broken, export data wrong

### Read ONLY
- `server.ts` — full file (it is the only file changed)
- `bugs/2026-07-04-full-feature-audit.md` — sections BUG-AU1, BUG-X1, BUG-X2, BUG-X3

### Do NOT read
`src/App.tsx`, `server/db.ts`, `src/types.ts`, any other file.

### Changes

**BUG-AU1 — Move logout route before auth middleware** ✅ DONE (2026-07-04)

Locate the block in `server.ts` that follows this structure:
```
app.post('/api/login', ...)           ← already before auth gate
app.use('/api', authMiddleware)       ← auth gate
app.post('/api/logout', ...)          ← BUG: currently after the gate
```
Move `app.post('/api/logout', ...)` to immediately after `app.post('/api/login', ...)`, before `app.use('/api', authMiddleware)`.

---

**BUG-X1 — Date range inputs parsed as UTC midnight instead of Israel midnight** ✅ DONE (2026-07-04)

Applies to ALL of these routes in `server.ts`:
- `GET /api/stats/nutrition`
- `GET /api/stats/sleep`
- `GET /api/stats/diapers`
- `GET /api/stats/weight`
- `GET /api/export/xlsx`

Find each place that parses `req.query.from` and `req.query.to` into `Date` objects, e.g.:
```typescript
const from = req.query.from ? new Date(req.query.from as string) : ...
```

Replace with a helper that treats the date string as Israel midnight:
```typescript
function parseIsraelDate(dateStr: string, endOfDay = false): Date {
  // Build an ISO string at Israel midnight (UTC+2 winter / UTC+3 summer)
  // Simplest safe approach: append time and Israel offset
  const offset = getIsraelUtcOffset(); // see below
  const time = endOfDay ? '23:59:59' : '00:00:00';
  return new Date(`${dateStr}T${time}${offset}`);
}

function getIsraelUtcOffset(): string {
  // Israel is UTC+2 (winter) or UTC+3 (summer/DST)
  const jan = new Date(new Date().getFullYear(), 0, 1);
  const jul = new Date(new Date().getFullYear(), 6, 1);
  const janOffset = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Jerusalem', timeZoneName: 'shortOffset' })
    .formatToParts(jan).find(p => p.type === 'timeZoneName')?.value ?? '+02:00';
  // Use current offset dynamically
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Jerusalem', timeZoneName: 'shortOffset' });
  const parts = formatter.formatToParts(now);
  const tz = parts.find(p => p.type === 'timeZoneName')?.value ?? '+02:00';
  return tz.replace('GMT', '');
}
```

Apply `parseIsraelDate(req.query.from)` for start and `parseIsraelDate(req.query.to, true)` for end in every stat and export route. Keep the existing fallback logic (default date range) unchanged.

---

**BUG-X2 — Excel Summary sheet shows 100% consumption on breastfeeding-only days** ✅ DONE (2026-07-04)

Find in `server.ts` inside the XLSX export route:
```typescript
const consumedPct = d.offered > 0 ? Math.round(...) : 100;
```
Change the fallback from `100` to `''` (empty string):
```typescript
const consumedPct = d.offered > 0 ? Math.round((d.consumed / d.offered) * 100) : '';
```

---

**BUG-X3 — Sleep export: `durationHours` is a text string, not a number; blank for open sessions** ✅ DONE (2026-07-04)

Find in `server.ts` inside the sleep sheet population:
```typescript
ws.getCell(...).value = s.durationMinutes ? (s.durationMinutes / 60).toFixed(1) : 'ישן כעת';
```
Replace with:
```typescript
if (s.durationMinutes) {
  const cell = ws.getCell(...);
  cell.value = parseFloat((s.durationMinutes / 60).toFixed(1));
  cell.numFmt = '0.0';
} else {
  ws.getCell(...).value = 'ישן כעת'; // open session — text is acceptable here
}
```

### Acceptance test
1. `npm run lint` — zero errors
2. `npm run build` — no errors
3. `npm run dev` — start server
4. Log in, then log out — logout must return 200 (not 401) even with an expired session
5. Export XLSX for a date range that crosses midnight Israel time — verify first-day events are included
6. Verify a breastfeeding-only day in the Summary sheet shows blank (not 100%) in the consumption column

---

## Milestone 2 — Sleep & timeline fixes (5 bugs)

**Bugs:** BUG-S1, BUG-S2, BUG-S3, BUG-T1, BUG-T2
**Priority:** P1 + P2 — sleep re-opens on edit, stale data after focus, duplicate card

### Read ONLY
- `src/App.tsx` — focus on these areas only (use Ctrl+G / search to jump):
  - `handleVisibilityChange` (~line 530)
  - `isLongOpenSleep` (~line 1887)
  - `handleUpdateEvent` (~line 1460–1480, specifically the sleep `endAt` logic)
  - Timeline render block (search `ציר הזמן` or `activeTab === 'timeline'`, ~line 2860–2970)
  - Carousel peek icons (search `babyDayEvents[i].eventType`, ~line 2280–2380)
- `bugs/2026-07-04-full-feature-audit.md` — sections BUG-S1 through BUG-T2

### Do NOT read
`server.ts`, `server/db.ts`, `src/types.ts`, `src/index.css`.

### Changes

**BUG-S1 — Poll-on-focus must also refresh the events list**

Find `handleVisibilityChange`. It currently calls only `checkOpenSleepSession()`. Add a call to `fetchEvents()` (or `loadEvents()` — whatever the events refresh function is named in this codebase):
```typescript
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible' && isAuthenticated) {
    checkOpenSleepSession();
    fetchEvents();   // ADD THIS
  }
};
```

---

**BUG-S2 — 12h sleep warning must use reactive `currentTime`, not `Date.now()`**

Find:
```typescript
const isLongOpenSleep = openSleepSession ? (() => {
  return Date.now() - start > 12 * 60 * 60 * 1000;
})() : false;
```
Replace `Date.now()` with `currentTime` (the reactive state variable updated every 5 seconds):
```typescript
const isLongOpenSleep = openSleepSession
  ? currentTime - new Date(openSleepSession.sleep!.startAt).getTime() > 12 * 60 * 60 * 1000
  : false;
```

---

**BUG-S3 — Sleep edit must not clear `endAt` when end-time field is empty**

Find in `handleUpdateEvent` the block that builds the sleep payload for an edit:
```typescript
const endAtIso = customSleepEndAt ? new Date(customSleepEndAt).toISOString() : null;
```
Add a guard: if the original event had an `endAt`, do not allow clearing it:
```typescript
const originalEndAt = editingEvent?.sleep?.endAt ?? null;
const endAtIso = customSleepEndAt
  ? new Date(customSleepEndAt).toISOString()
  : originalEndAt; // preserve original if field was cleared

if (originalEndAt && !customSleepEndAt) {
  showToast('שדה סיום שינה לא יכול להיות ריק');
  return;
}
```

---

**BUG-T1 — Open sleep session appears twice in timeline**

Find where the timeline maps over `events` to render cards. Before the `.map()`, filter out the open sleep session:
```typescript
const timelineEvents = events.filter(e => e.id !== openSleepSession?.id);
// then render timelineEvents instead of events
```

---

**BUG-T2 — Carousel peek shows sleep emoji for Activity, Weight, Pumping, Vomiting**

Find the carousel peek icon logic (around `babyDayEvents[i].eventType`):
```typescript
// Current (incomplete):
type === 'NUTRITION' ? '🍼' : type === 'DIAPER' ? <DiaperIcon/> : '💤'

// Replace with:
type === 'NUTRITION' ? '🍼'
: type === 'DIAPER' ? <DiaperIcon/>
: type === 'SLEEP' ? '💤'
: type === 'ACTIVITY' ? <Activity size={14}/>
: type === 'WEIGHT' ? <Scale size={14}/>
: type === 'PUMPING' ? '🥛'
: type === 'VOMITING' ? '🤢'
: '•'
```
Use Lucide `Activity` and `Scale` icons (already imported). Emoji for pumping/vomiting is acceptable in carousel peek (not interactive UI elements).

### Acceptance test
1. `npm run lint` — zero errors
2. `npm run dev`
3. Start a sleep → background the tab for 30 seconds → foreground → timeline and carousel refresh automatically
4. Open sleep banner shows at top of timeline; the same sleep does NOT appear as a second static card below it
5. Edit a completed sleep event — clear the end-time field — a Hebrew error toast appears; event is NOT re-opened
6. Carousel peek shows correct icon for each event type

---

## Milestone 3 — Form input bugs (5 bugs)

**Bugs:** BUG-N1, BUG-N3, BUG-W1, BUG-A1, BUG-CC1
**Priority:** P1 + P2 — data saved incorrectly

### Read ONLY
- `src/App.tsx` — focus on these areas:
  - `getLocalDatetimeString` (~line 108–111)
  - Offered/consumed steppers in nutrition create form (~line 4519–4570)
  - Nutrition edit form consumed input (~line 5315–5320)
  - Crying intensity save path in `handleCreateEvent` / nutrition handler (~line 1459)
  - Weight percentile input in edit form (~line 5438–5440)
- `bugs/2026-07-04-full-feature-audit.md` — sections BUG-N1, BUG-N3, BUG-W1, BUG-A1, BUG-CC1

### Do NOT read
`server.ts`, `server/db.ts`, `src/types.ts`, `src/index.css`.

### Changes

**BUG-CC1 — `getLocalDatetimeString` uses system timezone instead of Israel**

Find the function at the top of `App.tsx`:
```typescript
function getLocalDatetimeString(date: Date): string {
  // currently uses getTimezoneOffset() — system local timezone
}
```
Replace body with:
```typescript
function getLocalDatetimeString(date: Date): string {
  // Format as Israel local time for datetime-local inputs
  return date.toLocaleString('sv-SE', { timeZone: 'Asia/Jerusalem' }).replace(' ', 'T').slice(0, 16);
}
```

---

**BUG-N1 — Offered stepper overwrites the parent's manually set consumed value**

Find the offered amount stepper buttons in the nutrition create form. Each button calls both `setAmountOfferedMl(val)` AND `setAmountConsumedMl(val)`. Remove the `setAmountConsumedMl` call from ALL offered stepper handlers. The consumed value must only be changed by the consumed stepper.

---

**BUG-N3 — Edit form allows consumed to exceed offered**

Find the consumed input in the nutrition edit form (inside `activeSheet === 'edit'` block). Add a `max` attribute and a save-time guard:
```typescript
// Input:
<input type="number" max={amountOfferedMl} ... />

// In handleUpdateEvent, before building payload:
const safeConsumed = Math.min(amountConsumedMl, amountOfferedMl);
// use safeConsumed instead of amountConsumedMl in the payload
```

---

**BUG-A1 — Crying intensity 0 saved as `undefined`**

Find in the activity save path:
```typescript
cryingIntensity: cryingIntensity > 0 ? cryingIntensity : undefined
```
Change to save 0 explicitly:
```typescript
cryingIntensity: cryingIntensity !== null && cryingIntensity !== undefined ? cryingIntensity : undefined
```
Or more simply — remove the `> 0` guard entirely if `cryingIntensity` state is initialized to `0`:
```typescript
cryingIntensity: cryingIntensity
```

---

**BUG-W1 — Weight edit form saves `percentile: 0` when field is cleared**

Find in the weight edit section the percentile input handler:
```typescript
// Current (broken):
onChange={e => setPercentile(Number(e.target.value))}

// Fix — same pattern as create form:
onChange={e => setPercentile(e.target.value ? Number(e.target.value) : '')}
```

### Acceptance test
1. `npm run lint` — zero errors
2. `npm run dev` at 375px
3. On a non-Israel-timezone machine (or DevTools → Sensors → Location override), custom timestamp inputs prefill with Israel time
4. Set offered to 150ml, manually set consumed to 120ml, then press +10 on offered → consumed stays at 120ml (not overwritten)
5. In edit form: set consumed to 999 and save → consumed is capped at offered value
6. Log an activity with crying intensity = 0 → saved event in timeline shows "רגוע" (not missing)
7. Edit a weight event, clear percentile, save → saved event has no percentile field (not 0)

---

## Milestone 4 — Dashboard data correctness (4 bugs)

**Bugs:** BUG-DS1, BUG-DS2, BUG-DS3, BUG-W2
**Priority:** P2 — wrong data shown to user

### Read ONLY
- `src/App.tsx` — focus on these areas:
  - `getBabyDayEvents` / `getTodayNutritionSummary` (~line 813–828, ~1794–1811)
  - Dashboard header strip for nutrition, diaper, sleep (~line 1773–1821, ~3113, ~3517)
  - Weight dashboard "latest weight" / "cumulative change" cards (~line 4008–4014)
  - The `nutritionStats`, `diaperStats`, `sleepStats`, `weightStats` state variables (search these names to find where they are set and shaped)
- `bugs/2026-07-04-full-feature-audit.md` — sections BUG-DS1 through BUG-W2

### Do NOT read
`server.ts`, `server/db.ts`, `src/types.ts`, `src/index.css`.

### Changes

**BUG-DS2 — `todaySummary` is computed but never displayed**

Decision: remove the dead computation. Find `getTodayNutritionSummary()` call that assigns to `todaySummary`. Delete the call and the variable assignment. Do NOT delete the function itself — it may be referenced by future milestones. If no JSX references `todaySummary`, removing the call is safe.

---

**BUG-DS3 — Inconsistent "today" definition: `getBabyDayEvents` uses 6 AM cutoff**

`getTodayNutritionSummary` already uses Israel midnight correctly (`toLocaleString` with `Asia/Jerusalem`). The inconsistency is within `getBabyDayEvents`. This function is authoritative for the log tab header strips and carousel data. Do NOT change its 6 AM cutoff — that is intentional (the "baby day" concept). Add a comment:
```typescript
// Baby day starts at 06:00 Israel time. Events 00:00–05:59 belong to the previous baby day.
// This is intentional and differs from the calendar-day boundary used in getTodayNutritionSummary.
```
This is a documentation fix only. The inconsistency is by design; no behavioral change needed.

---

**BUG-DS1 — Dashboard header strips always show today-only counts regardless of date range selector**

The header strips (nutrition bottle/breast counts, diaper pee/poo counts, sleep total) use `babyDayEvents` (today only). The expanded chart sections use `nutritionStats`, `diaperStats`, `sleepStats` (from API, respects the selected range). Fix: derive the header strip totals from the API stats state instead.

For nutrition header:
```typescript
// Instead of counting babyDayEvents:
const bottleCount = nutritionStats?.reduce((sum, day) => sum + (day.bottleFeeds ?? 0), 0) ?? 0;
const breastCount = nutritionStats?.reduce((sum, day) => sum + (day.breastFeeds ?? 0), 0) ?? 0;
```

For diaper header — derive from `diaperStats` similarly.
For sleep header — derive from `sleepStats` similarly.

Check the shape of each stats object (from their state declarations) before building the reduce. Match existing field names exactly.

---

**BUG-W2 — Weight "latest weight" and "cumulative change" ignore date range**

Find:
```typescript
const latest = events.find(e => e.eventType === 'WEIGHT' && e.weight);
const earliest = [...events].reverse().find(e => e.eventType === 'WEIGHT' && e.weight);
```
Replace with values derived from `weightStats` (the API response for the selected range):
```typescript
const latest = weightStats && weightStats.length > 0 ? weightStats[weightStats.length - 1] : null;
const earliest = weightStats && weightStats.length > 0 ? weightStats[0] : null;
const latestGrams = latest?.weightGrams ?? null;
const earliestGrams = earliest?.weightGrams ?? null;
const cumulativeChange = latestGrams && earliestGrams ? latestGrams - earliestGrams : null;
```
Adjust field names to match the actual `weightStats` object shape.

### Acceptance test
1. `npm run lint` — zero errors
2. `npm run dev`
3. Go to Dashboards → select "30 days" → nutrition header strip shows totals for 30 days (not just today)
4. Select "7 days" → counts change to reflect 7 days
5. Weight dashboard: switch range → "Latest Weight" and "Cumulative Change" update

---

## Milestone 5 — Missing form sections (3 bugs)

> **Milestone status:** ✅ DONE — awaiting human check (2026-07-05)
> **Verified:** lint pass, build pass

**Bugs:** BUG-D1 ✅ | BUG-N2 ✅ | BUG-N4 ✅
**Priority:** P3 — features exist in data model but not exposed in UI

> Note: this is the most UI-heavy milestone. All changes are in `App.tsx` only. Stay within each feature's existing JSX block — do not reorganize surrounding code.

### Read ONLY
- `src/App.tsx` — focus on these areas:
  - Diaper create form sections for pee volume, poo amount, poo color, poo texture (~near the diaper `activeSheet` block)
  - Diaper edit form (~line 5416–5428, the `activeSheet === 'edit'` + diaper branch)
  - Nutrition create form, specifically the `bottleFeedType === 'BOTTLE'` block and the breast section (~line 4482)
  - Top-up fields in the edit form (~line 1342–1354) — use these as the reference for what top-up UI looks like
- `src/types.ts` — read ONLY the `NutritionPayload` and `DiaperPayload` interfaces to confirm field names
- `bugs/2026-07-04-full-feature-audit.md` — sections BUG-D1, BUG-N2, BUG-N4

### Do NOT read
`server.ts`, `server/db.ts`, `src/index.css`.

### Changes

**BUG-D1 — Diaper edit form missing pee volume, poo color, poo amount, poo texture** ✅ DONE (2026-07-05)

In the edit form block (inside `activeSheet === 'edit'`), find the diaper section — currently only a `contains` dropdown. Copy the following conditional sub-sections from the CREATE form into the edit form, conditioned identically:
- If `diaperContains` includes pee → show pee volume selector
- If `diaperContains` includes poo → show poo amount, poo color, poo texture selectors

Do NOT duplicate the `contains` dropdown — it already exists. Only add the sub-sections after it.

---

**BUG-N2 — Spit-up field missing from breast create form** ✅ DONE (2026-07-05)

Find the spit-up row in the nutrition create form. It currently sits inside a `bottleFeedType === 'BOTTLE'` conditional. Move the spit-up row OUTSIDE that conditional so it appears for both bottle and breast feedings. Spit-up is valid for any feeding type.

---

**BUG-N4 — Top-up not available on nutrition create form** ✅ DONE (2026-07-05)

Add a "הוסף השלמה" (Add top-up) toggle button to the breast section of the NUTRITION create form. When toggled on, show the same top-up fields that exist in the edit form (`topUpConsumedMl` + `topUpLiquidType`). These state variables already exist — just expose them in the create path. Include the top-up payload in `handleCreateEvent`'s nutrition payload (already supported in `NutritionPayload`).

### Acceptance test
1. `npm run lint` — zero errors
2. `npm run dev` at 375px
3. Add a diaper event (poo) → edit it → poo color, poo amount, poo texture inputs appear and save correctly
4. Add a breast feeding → spit-up toggle is visible → works
5. Add a breast feeding → tap "הוסף השלמה" → top-up fields appear → filled amount saves to event

---

## Milestone 6 — Code cleanup (4 bugs)

**Bugs:** BUG-W3, BUG-CC3, BUG-U1, BUG-V1
**Priority:** P4 — dead code, minor consistency

### Read ONLY
- `src/types.ts` — full file (small)
- `src/App.tsx` — focus on:
  - `classifyWeight`, `classifyNutrition`, `classifySleep`, `classifyDiaper`, `TIER_MAP` usages (search these names)
  - `checkAndRegisterDoubleSubmit` (~line 125–133)
  - `toastTimeoutRef` cleanup (~line 158)
  - `handleQuickVomitingLog` (~line 377)
- `bugs/2026-07-04-full-feature-audit.md` — sections BUG-W3, BUG-CC3, BUG-U1, BUG-V1

### Do NOT read
`server.ts`, `server/db.ts`, `src/index.css`.

### Changes

**BUG-W3 — Dead exports in `types.ts`**

Check in `App.tsx` whether `classifyWeight`, `classifyNutrition`, `classifySleep`, `classifyDiaper`, `TIER_MAP`, and `getSleepCycleAnalysis` are imported and used. If none are imported in `App.tsx`, remove the export keyword from these functions and the constant in `types.ts` (or delete them entirely if they are also duplicated locally in `App.tsx`). Do not remove the types (`QualityTier`, `TIER_MAP` type) if they are part of the Wave 3 plan — check `plans/wave3_visual_identity_v1.md` Milestone 2 before deleting.

---

**BUG-CC3 — Remove stale `events` secondary check from `checkAndRegisterDoubleSubmit`**

Find `checkAndRegisterDoubleSubmit`. It has a primary check using a ref (`lastLoggedTimestamps.current`) and a secondary check using the `events` state array. Remove the secondary check. The ref-based check is sufficient and always current.

---

**BUG-U1 — Toast timeout not cleaned up on unmount**

Add a cleanup effect near the other effects in `App()`:
```typescript
useEffect(() => {
  return () => { clearTimeout(toastTimeoutRef.current); };
}, []);
```

---

**BUG-V1 — `handleQuickVomitingLog` sends no client-generated `id`**

Find `handleQuickVomitingLog`. Add a client-generated id consistent with other quick-log handlers:
```typescript
const id = 'event_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
// include id in the payload
```

### Acceptance test
1. `npm run lint` — zero errors (this is the primary check for this milestone)
2. `npm run build` — no errors
3. Smoke test: log a vomiting event → undo works (the server-returned id is used, so this should be unchanged)

---

## Milestone 7 — Clear-all data protection

**Bug:** BUG-SD1 / BUG-CC2
**Priority:** P1 — permanent data loss risk

> ⚠️ **Human decision required before Cursor executes this milestone.**
>
> Current behavior: `clearAllEvents` hard-deletes all Firestore documents permanently. The question is:
> - **Option A:** Change `clearAllEvents` to soft-delete (stamp `deletedAt`) — recoverable, but the app "reset" is not truly a reset since events with `deletedAt` remain in Firestore.
> - **Option B:** Keep hard-delete but add a second confirmation step in the UI (e.g., a typed confirmation phrase) to prevent accidental loss.
>
> Human must select Option A or Option B before this milestone runs.

### Read ONLY (after human decision)
- `server/db.ts` — `clearAllEvents` function (~line 169–185)
- `src/App.tsx` — `handleClearData` / the confirm dialog for clear all (~line 1212)
- `bugs/2026-07-04-full-feature-audit.md` — section BUG-SD1

### Do NOT read
`server.ts`, `src/types.ts`, `src/index.css`.

### Changes (Option A — soft-delete)
Replace `eventsCollection.doc(docSnap.id).delete()` in `clearAllEvents` with:
```typescript
await eventsCollection.doc(docSnap.id).update({ deletedAt: new Date().toISOString() });
```

### Changes (Option B — typed confirmation)
In `App.tsx` `handleClearData`, replace the existing single `confirm()` call with:
1. A `pendingClearAll` state variable (boolean).
2. A modal with a text input requiring the user to type `"מחק הכל"` before the confirm button is enabled.
3. Only call the API route when the typed value matches exactly.

### Acceptance test
- **Option A:** After "clear all," events are absent from the timeline. Firestore console shows docs with `deletedAt` field set (not deleted).
- **Option B:** "Clear all" modal requires typing `"מחק הכל"` — confirm button disabled until match. Accidental click on confirm button with empty input has no effect.

---

## Conventions Reminder

- Single-component architecture: all JSX stays in `src/App.tsx`. No new files under `src/`.
- No new npm packages.
- No `any` types.
- Hebrew strings for all user-facing text; English for code and comments.
- `motion/react` (not `framer-motion`). Lucide React icons only. Native `fetch()` only.
- `npm run lint` must pass with zero errors after every milestone.

---

## Out of Scope

- Wave 3 (Heebo font, icon system, weight in kg) — see `plans/wave3_visual_identity_v1.md`
- Interactive dashboard charts — separate plan
- Firestore composite index for sleep query (BUG-S4) — deferred, no functional impact today
- `_shared/agent-guide.md`, `.cursor/rules/`, `.cursorrules` — do not touch workflow files

---

## Cursor Execution Instructions

```
Execute ONLY Milestone [N] from plans/bugfix-audit-v1.md.

- Read ONLY the files listed under "Read ONLY" for that milestone. Do not open any other file.
- Follow the changes exactly as specified. Do not refactor surrounding code.
- Do NOT mark the milestone complete in the plan file.
- Do NOT start the next milestone. One milestone, then STOP.
- 3-strike rule: max 3 fix attempts within scoped files. On 3rd failure, write bugs/bug_<id>.md and stop.
- BEFORE STOPPING: invoke baby-tracker-handoff skill (AgentMemory first, sessions/YYYY-MM-DD.md fallback).
- If human requests a commit and it succeeds: run post-commit handoff from the same skill.
```
