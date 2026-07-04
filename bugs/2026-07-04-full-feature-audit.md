# Full Feature Audit — Bug Report
> Filed by: Reviewer (Claude Code)
> Date: 2026-07-04
> Scope: Complete codebase audit — all features
> Method: Full read of App.tsx, server.ts, server/db.ts, src/types.ts

---

## Priority legend
- **P1 — Data loss / incorrect data saved to Firestore**
- **P2 — Wrong data shown to user (silent corruption)**
- **P3 — Missing functionality (feature partially works)**
- **P4 — UX inconsistency / cosmetic / future risk**

---

## Feature 1 — Nutrition Logging

### BUG-N1 · P2 · Offered stepper overwrites consumed
**File:** `src/App.tsx` ~line 4519–4570
**Problem:** Every stepper button on the "Offered" input also calls `setAmountConsumedMl(val)` to match. If the parent adjusted consumed independently (e.g., offered=150, consumed=120), pressing +10 on offered resets consumed to 160, destroying the intentional delta.
**Fix:** Offered stepper should only call `setAmountOfferedMl`. Remove the `setAmountConsumedMl` call from all offered stepper handlers.

### BUG-N2 · P3 · Spit-up field missing on breast feed create form
**File:** `src/App.tsx` ~line 4482
**Problem:** The spit-up row is inside a `bottleFeedType === 'BOTTLE'` block. When feed type is BREAST, no spit-up field is shown on the create form. The `spitUp` field exists on `NutritionPayload` and is included in Excel export for all feed types.
**Fix:** Move spit-up field outside the bottle-only block so it shows for all nutrition types.

### BUG-N3 · P1 · Edit form allows consumed > offered with no cap
**File:** `src/App.tsx` ~line 5315–5320
**Problem:** The edit form uses raw `<input type="number">` with no validation. The create form correctly caps consumed via `Math.min(amountOfferedMl, ...)`. The edit form has no such guard — a user can save `amountConsumedMl > amountOfferedMl`, producing a negative delta in the XLSX export and misleading nutrition quality tiers.
**Fix:** Add `max={amountOfferedMl}` to the consumed input in the edit form, and validate on submit: `if (amountConsumedMl > amountOfferedMl) amountConsumedMl = amountOfferedMl`.

### BUG-N4 · P3 · Top-up not available on create form
**File:** `src/App.tsx` ~line 1342–1354
**Problem:** `showTopUp` / `topUpConsumedMl` / `topUpLiquidType` controls only appear in the `activeSheet === 'edit'` branch. A new breastfeeding event cannot record a top-up at creation time — requires immediate edit after saving.
**Fix:** Expose top-up fields in the create form under the breastfeeding section, gated by a "הוסף השלמה" toggle.

---

## Feature 2 — Diaper Logging

### BUG-D1 · P3 · Edit form missing pee volume, poo color, poo amount, poo texture
**File:** `src/App.tsx` ~line 5416–5428
**Problem:** The diaper edit modal renders ONLY the `contains` dropdown. `openEditSheet` correctly pre-populates all diaper fields, and `handleUpdateEvent` writes them back — but the user has no way to change pee volume, poo color, poo amount, or texture on an existing event. The new-event form has all four sections.
**Fix:** Copy the pee/poo sub-sections from the create form into the edit modal, conditioned on `diaperContains`.

### BUG-D2 · P2 · Diaper header strip ignores date-range selector
**File:** `src/App.tsx` ~line 1773–1821
**Problem:** The header strip on the dashboard (pee/poo counts) uses `babyDayEvents` (6 AM cutoff, today only). Switching to 14-day or 30-day range updates the chart data from the API but keeps the header strip frozen at today's counts. The header and chart are inconsistent.
**Fix:** Derive header strip totals from `diaperStats` (the API response) rather than from `babyDayEvents`.

---

## Feature 3 — Sleep State Machine

### BUG-S1 · P2 · Poll-on-focus only refreshes sleep session, not event list
**Status: DONE — Fixed in Milestone 2 (2026-07-05)**
**File:** `src/App.tsx` ~line 530–538
**Problem:** `handleVisibilityChange` calls `checkOpenSleepSession()` only. When Parent B logs any event while Parent A's tab is backgrounded, returning focus updates the sleep banner but leaves timeline, carousel, awake-time widget, and diaper strip stale.
**Fix:** Call `fetchEvents()` (or a combined refresh) alongside `checkOpenSleepSession()` inside the `visibilitychange` handler.

### BUG-S2 · P4 · 12h sleep warning uses `Date.now()` instead of reactive `currentTime`
**Status: DONE — Fixed in Milestone 2 (2026-07-05)**
**File:** `src/App.tsx` ~line 1887–1890
**Problem:**
```js
const isLongOpenSleep = openSleepSession ? (() => {
  return Date.now() - start > 12 * 60 * 60 * 1000;
})() : false;
```
`Date.now()` is sampled at render time, not tied to `currentTime`. The warning could be delayed up to 5 seconds past the 12-hour mark.
**Fix:** Replace `Date.now()` with `currentTime` (the reactive state updated every 5 seconds).

### BUG-S3 · P1 · Sleep edit clears `endAt` if end-time field is emptied
**Status: DONE — Fixed in Milestone 2 (2026-07-05)**
**File:** `src/App.tsx` ~line 1473–1474
**Problem:**
```js
const endAtIso = customSleepEndAt ? new Date(customSleepEndAt).toISOString() : null;
```
If a parent edits a completed sleep event (e.g., to fix location) and accidentally clears the end-time input, saving sets `endAt: null` — re-opening a closed sleep session. The timer restarts from the original start time.
**Fix:** If the original event had an `endAt`, require `customSleepEndAt` to be non-empty before saving. Show an inline validation error if the field is blank.

### BUG-S4 · P4 · `getOpenSleepSession` full collection scan (scalability)
**File:** `server/db.ts` ~line 123–138
**Problem:** Fetches ALL SLEEP events from Firestore and filters `endAt === null` in memory. No Firestore composite index on `(eventType, sleep.endAt)`. Works today; will degrade as data grows.
**Fix (future):** Add a Firestore query filter on `sleep.endAt == null` with a composite index, or store open/closed status as a top-level field.

---

## Feature 4 — Activity Logging

### BUG-A1 · P2 · Crying intensity 0 saved as `undefined`, indistinguishable from "not set"
**File:** `src/App.tsx` ~line 1459
**Problem:**
```js
cryingIntensity: cryingIntensity > 0 ? cryingIntensity : undefined
```
The slider allows 0 (labeled "רגוע"). Intensity 0 is saved as `undefined` — the explicit "calm" measurement is lost. All three states (not recorded, slider never touched, explicitly set to 0) look identical in Firestore.
**Fix:** Save 0 explicitly. Change the guard to `cryingIntensity !== undefined ? cryingIntensity : undefined` or remove the guard entirely.

---

## Feature 5 — Weight Logging

### BUG-W1 · P1 · Edit form saves `percentile: 0` when field is cleared
**File:** `src/App.tsx` ~line 5438–5440
**Problem:** Edit form percentile input uses `Number(e.target.value)`, which coerces an empty string to `0`. The save path checks `percentile !== ''` — since `0 !== ''`, it saves `percentile: 0` to Firestore instead of omitting the field. The create form correctly uses `e.target.value ? Number(e.target.value) : ''`.
**Fix:** Use the same pattern in the edit form: `e.target.value ? Number(e.target.value) : ''`.

### BUG-W2 · P2 · Weight dashboard "latest weight" ignores date-range selector
**File:** `src/App.tsx` ~line 4008–4014
**Problem:**
```js
const latest = events.find(e => e.eventType === 'WEIGHT' && e.weight);
const earliest = [...events].reverse().find(e => e.eventType === 'WEIGHT' && e.weight);
```
These search the most-recent-60 events regardless of the selected date range. Switching to "7 days" does not restrict the "Latest Weight" or "Cumulative Change" cards. The chart below correctly uses `weightStats` from the API.
**Fix:** Derive "latest weight" and "cumulative change" from `weightStats` (the API response) instead of from `events`.

### BUG-W3 · P4 · Dead exports in `types.ts`
**Status: DONE — No change needed (Milestone 6, 2026-07-05): all exports are imported and actively used in App.tsx**
**File:** `src/types.ts` ~line 109–173
**Problem:** `classifyWeight`, `classifyNutrition`, `classifySleep`, `classifyDiaper`, `TIER_MAP` are exported but never imported anywhere. `getSleepCycleAnalysis` in App.tsx duplicates the sleep-classification logic locally.
**Fix:** Either import and use these functions in App.tsx, or remove them. Keep only one copy of the classification logic.

---

## Feature 6 — Pumping Logging

No functional bugs. Create and edit paths save all fields correctly.

**Concern P1 · Minor:** `getTodayPumpingCount` uses `new Date()` while `checkPumpingReminderStatus` uses `new Date(currentTime)` — different time sources. Discrepancy is at most 5 seconds. No fix required.

---

## Feature 7 — Vomiting Logging

### BUG-V1 · P4 · `handleQuickVomitingLog` sends no client-generated `id` (inconsistency)
**Status: DONE — Fixed in Milestone 6 (2026-07-05)**
**File:** `src/App.tsx` ~line 377
**Problem:** All other quick-log handlers generate a client-side `id`. Vomiting skips this. The server generates the id regardless, and undo works correctly from the server-returned id. Not a crash, but an inconsistency.
**Fix (low priority):** Add `id: generateEventId()` to the vomiting payload for consistency.

---

## Feature 8 — Undo Toast

### BUG-U1 · P4 · `toastTimeoutRef` not cleaned up on unmount
**Status: DONE — Fixed in Milestone 6 (2026-07-05)**
**File:** `src/App.tsx` ~line 158, ~1040–1048
**Problem:** No `useEffect(() => () => clearTimeout(toastTimeoutRef.current), [])` exists. If App is ever extracted from the root (future refactor), `setToast(null)` will fire on an unmounted component.
**Fix:** Add a cleanup effect: `useEffect(() => () => clearTimeout(toastTimeoutRef.current), [])`.

---

## Feature 9 — Soft Delete + Confirm Modal

### BUG-SD1 · P1 · `clearAllEvents` performs hard Firestore deletes, bypassing soft-delete
**File:** `server/db.ts` ~line 169–185
**Problem:** `clearAllEvents` calls `eventsCollection.doc(id).delete()` — permanently destroying Firestore documents. The soft-delete pattern (stamping `deletedAt`) is bypassed entirely. There is no recovery after a user triggers "clear all data."
**Fix:** Either (a) change `clearAllEvents` to soft-delete all events, or (b) add a second confirmation step in the UI (e.g., require typing "מחק הכל") before calling the route. The current single-confirm modal is insufficient for an irreversible operation.

---

## Feature 10 — Timeline Tab

### BUG-T1 · P2 · Open sleep session appears twice in timeline
**Status: DONE — Fixed in Milestone 2 (2026-07-05)**
**File:** `src/App.tsx` ~line 2890–2912, ~2964+
**Problem:** The timeline renders a pulsing "ישן עכשיו" banner for `openSleepSession`. It then also maps over `events`, which includes the same SLEEP event (it is not soft-deleted). The parent sees the open sleep event once as the banner and again as a static card below it.
**Fix:** Filter `openSleepSession?.id` out of the `events` array before rendering the timeline list.

### BUG-T2 · P2 · Carousel peek shows sleep emoji for all non-nutrition, non-diaper event types
**Status: DONE — Fixed in Milestone 2 (2026-07-05)**
**File:** `src/App.tsx` ~line 2291, ~2372
**Problem:**
```js
eventType === 'NUTRITION' ? '🍼' : eventType === 'DIAPER' ? <DiaperIcon/> : '💤'
```
ACTIVITY, WEIGHT, PUMPING, and VOMITING events all show the sleep emoji `💤` in the carousel peek strip.
**Fix:** Extend the ternary (or use a mapping object) to return appropriate icons for ACTIVITY, WEIGHT, PUMPING, and VOMITING.

---

## Feature 11 — Dashboard Stats

### BUG-DS1 · P2 · Dashboard header strip always shows today-only counts regardless of date-range selector
**File:** `src/App.tsx` ~line 1773–1821, ~3113, ~3517
**Problem:** The header strips for Nutrition, Diaper, and Sleep (above each dashboard section) use `babyDayEvents` or `todaySleepStats` — hard-coded to the 6 AM–today window. When the user selects "14 days," the expanded charts update from the API but the header strips stay frozen at today's counts. The user sees contradictory data on the same screen.
**Fix:** Derive header strip totals from the API stats responses (`nutritionStats`, `diaperStats`, `sleepStats`) rather than from `babyDayEvents`.

### BUG-DS2 · P4 · `todaySummary` (offered/consumed/feedsCount) computed but never rendered
**File:** `src/App.tsx` ~line 1793–1814
**Problem:** `getTodayNutritionSummary()` runs on every render and produces `{ offered, consumed, feedsCount }`. No JSX anywhere in App.tsx uses `todaySummary.offered`, `todaySummary.consumed`, or `todaySummary.feedsCount`. The daily nutrition progress bar planned for the log tab was never wired up.
**Fix:** Either connect `todaySummary` to a progress bar UI on the log tab, or remove the dead computation.

### BUG-DS3 · P2 · Daily nutrition summary uses Israel midnight; `getBabyDayEvents` uses 6 AM cutoff — inconsistent "today"
**File:** `src/App.tsx` ~line 813–828, ~1794–1811
**Problem:** Events logged between midnight and 5:59 AM Israel time appear in `getTodayNutritionSummary()` (calendar today) but not in `getBabyDayEvents()` (baby day starts at 6 AM). The two "today" views disagree about which feedings belong to today.
**Fix:** Decide on one "today" definition (calendar midnight or 6 AM baby-day) and apply it consistently everywhere.

---

## Feature 12 — Export (XLSX)

### BUG-X1 · P2 · Date inputs parsed as UTC midnight — Israel events before 3 AM excluded from export
**File:** `src/App.tsx` ~line 1623, `server.ts` ~line 575–576
**Problem:**
```js
// Server:
const from = req.query.from ? new Date(req.query.from) : ...;
```
`new Date("2024-07-01")` is `2024-07-01T00:00:00Z` (UTC midnight). In Israel summer (UTC+3), this equals 03:00 AM local. Events logged between midnight and 03:00 AM Israel time on the first day of the selected range are excluded from the export. The same bug affects all `/api/stats/*` endpoints.
**Fix:** Parse date strings as Israel midnight: `new Date(dateStr + 'T00:00:00+03:00')` (or +02:00 in winter). Better: use `toIsraelLocalDateStr` in reverse — parse in Israel timezone using `Intl` or add 3 hours to the UTC midnight value.

### BUG-X2 · P2 · Summary sheet shows 100% consumption on days with only breastfeeding
**File:** `server.ts` ~line 682
**Problem:**
```js
const consumedPct = d.offered > 0 ? Math.round(...) : 100;
```
Days with only breastfeeding (no bottle offered) show "100%" in the Excel Summary sheet. The pediatrician interprets this as a complete measurement, not a missing one.
**Fix:** Use `''` (empty string) or `'N/A'` instead of `100` when `d.offered === 0`.

### BUG-X3 · P4 · Open sleep sessions exported with blank duration; `durationHours` is text string not a number
**File:** `server.ts` ~line 761–770
**Problem:** In-progress sleep sessions export with no `duration` and `durationHours` as `"X.X"` text (from `.toFixed(1)`). Excel cannot sort or sum text-formatted numbers in that column.
**Fix:** Use the ExcelJS numeric cell type for `durationHours`; format the cell with `.numFmt = '0.0'`. For open sessions, either skip the row or write a calculated value.

---

## Feature 13 — Custom Activities

No functional bugs. Add/delete work correctly.

---

## Feature 14 — Parent Settings

### BUG-PS1 · P4 · Two separate save calls — first success + second fail leaves settings inconsistent
**File:** `src/App.tsx` ~line 1531–1580
**Problem:** `handleUpdateSettings` and `handleSaveBabyProfile` are separate API calls. If the first succeeds and the second fails, settings are partially saved with no error surfaced to the user (Firestore `set({ merge: true })` means the other fields are preserved, but the failed call's changes are lost silently).
**Fix:** Merge both settings forms into a single `PUT /api/settings` call, or add error recovery/retry to the second call and show a toast on failure.

---

## Feature 15 — Authentication

### BUG-AU1 · P1 · Logout route registered AFTER the auth middleware — expired sessions cannot be destroyed
**File:** `server.ts` ~line 130–147
**Problem:** The auth middleware (line 130) rejects all `/api/*` requests without a valid session. The logout route is registered at line 138, AFTER this middleware — so it is gated by the auth check. If a session has expired server-side (but the cookie still exists), `POST /api/logout` returns `401` and the server-side session object is never destroyed. The client catches the error and clears local state, but the dead session lingers on the server.
**Fix:** Register `POST /api/logout` BEFORE `app.use('/api', authMiddleware)`, or add logout to the middleware exclusion list alongside the login route.

---

## Feature 16 — Empty States

No issues found.

---

## Feature 17 — Poll-on-Focus (visibilitychange)

See **BUG-S1** above — the handler only refreshes the sleep session, not the full event list.

---

## Feature 18 — Daily Nutrition Summary (Log Tab)

See **BUG-DS2** (computed but not rendered) and **BUG-DS3** (inconsistent "today" definition) above.

---

## Cross-Cutting Issues

### BUG-CC1 · P2 · `getLocalDatetimeString` uses system timezone instead of Israel timezone
**File:** `src/App.tsx` ~line 108–111
**Problem:**
```js
function getLocalDatetimeString(date) {
  // uses getTimezoneOffset() — system local timezone
}
```
On any non-Israel device (developer machine in UTC, EU/US timezone), all `datetime-local` inputs prefill with the wrong local time. A parent logging at 23:00 in Israel on a machine set to UTC would see 21:00 pre-filled.
**Fix:** Use `date.toLocaleString('sv-SE', { timeZone: 'Asia/Jerusalem' })` — the same pattern used in `getTodayNutritionSummary`.

### BUG-CC2 · P1 · `clearAllEvents` / `handleClearData` bypasses soft-delete — permanent data loss
*(See BUG-SD1 above — duplicated here as cross-cutting because it affects the reset flow, not just delete.)*

### BUG-CC3 · P4 · `checkAndRegisterDoubleSubmit` has a stale `events` secondary check
**Status: DONE — Fixed in Milestone 6 (2026-07-05)**
**File:** `src/App.tsx` ~line 125–133
**Problem:** The primary double-submit guard uses `lastLoggedTimestamps.current` (a ref, always current). The secondary check reads `events` state, which may lag by one render cycle. A rapid double-submit within one render could slip through. The primary ref check is sufficient alone.
**Fix:** Remove the secondary `events` check and rely solely on the ref.

---

## Summary Table

| ID | Feature | Priority | Description |
|----|---------|----------|-------------|
| BUG-N1 | Nutrition | P2 | Offered stepper overwrites consumed |
| BUG-N2 | Nutrition | P3 | Spit-up field missing on breast create form |
| BUG-N3 | Nutrition | P1 | Edit form allows consumed > offered |
| BUG-N4 | Nutrition | P3 | Top-up not available on create form |
| BUG-D1 | Diaper | P3 | Edit form missing pee/poo detail fields |
| BUG-D2 | Diaper | P2 | Header strip ignores date-range selector |
| BUG-S1 | Sleep | P2 | Poll-on-focus only refreshes sleep, not events |
| BUG-S2 | Sleep | P4 | 12h warning uses `Date.now()` not `currentTime` |
| BUG-S3 | Sleep | P1 | Editing sleep clears `endAt` if field emptied |
| BUG-S4 | Sleep | P4 | Full collection scan on every sleep check |
| BUG-A1 | Activity | P2 | Crying intensity 0 saved as `undefined` |
| BUG-W1 | Weight | P1 | Edit form saves `percentile: 0` when cleared |
| BUG-W2 | Weight | P2 | Latest weight ignores date-range selector |
| BUG-W3 | Weight | P4 | Dead exports in types.ts |
| BUG-V1 | Vomiting | P4 | Missing client-generated id (inconsistency) |
| BUG-U1 | Undo | P4 | Toast timeout not cleaned up on unmount |
| BUG-SD1 | Soft-delete | P1 | `clearAllEvents` hard-deletes, bypasses soft-delete |
| BUG-T1 | Timeline | P2 | Open sleep appears twice in timeline |
| BUG-T2 | Timeline | P2 | Carousel shows sleep emoji for wrong event types |
| BUG-DS1 | Dashboard | P2 | Header strip always shows today regardless of range |
| BUG-DS2 | Dashboard | P4 | `todaySummary` computed but never rendered |
| BUG-DS3 | Dashboard | P2 | Inconsistent "today" definition (midnight vs 6 AM) |
| BUG-X1 | Export | P2 | Date range parsed as UTC, excludes early-morning Israel events |
| BUG-X2 | Export | P2 | 100% consumption shown on breastfeeding-only days |
| BUG-X3 | Export | P4 | Open sleep duration exported as text, not number |
| BUG-AU1 | Auth | P1 | Logout route behind auth middleware — sessions cannot be cleared |
| BUG-CC1 | Global | P2 | `getLocalDatetimeString` uses system timezone, not Israel |
| BUG-CC2 | Global | P1 | `clearAllEvents` permanent data loss (see BUG-SD1) |
| BUG-CC3 | Global | P4 | Stale `events` in double-submit secondary check |

**P1 count: 6** (data loss or data corruption)
**P2 count: 12** (wrong data shown)
**P3 count: 4** (missing functionality)
**P4 count: 8** (cosmetic/future risk)

---

## Not for Cursor — human decisions required

1. **BUG-DS3 "today" definition** — decide: calendar midnight or 6 AM baby-day. Apply consistently. This is an Architect call.
2. **BUG-SD1 / BUG-CC2 clear-all behavior** — decide: soft-delete all (recoverable) or hard-delete all (permanent). Current hard-delete is intentional for a factory reset, but there's no recovery. Add a second confirmation step minimum.
3. **BUG-S4 Firestore index** — decide when to add a composite index on `(eventType, sleep.endAt)`.

---

## Recommended fix order for Cursor

1. BUG-AU1 (logout behind auth middleware) — 1-line server.ts move
2. BUG-S3 (sleep endAt cleared on edit) — guard in handleUpdateEvent
3. BUG-N3 (consumed > offered in edit) — add max attribute + save guard
4. BUG-W1 (percentile 0 in edit) — one-line fix in edit form handler
5. BUG-T1 (open sleep duplicated in timeline) — filter before rendering
6. BUG-T2 (carousel wrong emoji) — extend the event type switch
7. BUG-CC1 (wrong datetime prefill on non-Israel device) — fix `getLocalDatetimeString`
8. BUG-S1 (poll-on-focus misses events refresh) — add `fetchEvents()` to handler
9. BUG-N1 (offered stepper overwrites consumed) — remove extra setter
10. BUG-X1 (date range UTC vs Israel) — fix date parsing in all stat/export routes
11. BUG-X2 (100% on breastfeeding-only days) — change fallback to `''`
12. BUG-DS1 (header strip ignores date range) — derive from API stats
13. BUG-W2 (weight latest ignores date range) — derive from weightStats
14. BUG-A1 (crying intensity 0 lost) — remove the `> 0` guard
15. BUG-D1 (diaper edit missing fields) — add pee/poo sections to edit modal
16. BUG-D2 (diaper header strip today-only) — derive from diaperStats
17. Remaining P3/P4 items at discretion
