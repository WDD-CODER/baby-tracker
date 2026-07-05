# DateTime24 — Beautiful 24-Hour Date + Time Picker (Redesign)

**Date:** 2026-07-05
**Status:** Approved — ready for implementation plan
**Component:** `src/components/DateTime24.tsx`

## Problem

Event timestamps are set in 6 places in `src/App.tsx` using the native
`<input type="datetime-local">`. On Hebrew/Israeli-locale phones this renders an
**AM/PM** clock and an OS calendar popup — inconsistent, unpolished, and it
violates the app's 24-hour convention.

A first-pass replacement (`src/components/DateTime24.tsx`, currently untracked)
composes a native date input with two tiny hour/minute `<select>` dropdowns and a
colon. It is functional but cramped and visually poor at 375px in RTL, and it is
**not wired into `main`** — App.tsx still uses the native inputs. This is the
"professional-looking-bad, broken clock" to replace.

## Goal

One genuinely beautiful, guaranteed-24-hour date+time picker, wired into all 6
sites, that is fast for the common baby-logging case (an event that just
happened or happened a little while ago).

## Contract (drop-in)

- **Props:** `{ value: string; onChange: (value: string) => void; className?: string }`
- **Value format in/out:** `"YYYY-MM-DDTHH:mm"` — identical to the string the
  current `datetime-local` inputs produce and consume (`customTimestamp`,
  `customSleepStartAt`, `customSleepEndAt`). This makes integration a pure JSX
  swap: **no changes** to `handleCreateEvent` / `handleUpdateEvent` logic.
- Tolerates empty/partial `value` without crashing (defaults gracefully).

## Layout (top → bottom, RTL, dark slate card)

### 1. Quick chips (the 90% path)
`עכשיו` · `-15 דק׳` · `-1 שעה`

- Each sets the **full** datetime relative to *now* in Israel time.
- A chip shows an active (indigo-filled) state when the current `value` matches
  that preset (within a small tolerance for "now"); otherwise inactive.
- One tap logs the event that just happened.

### 2. Fine-tune row
- **Date:** `היום` / `אתמול` chips (cover ~99% of entries, including sleep that
  crosses midnight) plus a `Calendar` icon that reveals a native
  `<input type="date">` for rare far-off dates. Native **date** is safe — dates
  have no AM/PM, which was the original reason to avoid native *datetime*.
- **Time:** `‹ HH : mm ›`.
  - Tapping the **hour** or **minute** opens a compact, styled, snapping scroll
    column (00–23 / 00–59). No native OS clock → 24h guaranteed.
  - The outer `‹ ›` chevrons nudge the minute by ±5 without opening anything;
    minute nudges roll the hour over correctly (and may roll the date).

### 3. Live preview
`✓ יום א׳, 5 ביולי · 14:30` in Hebrew — zero ambiguity about what will be saved.

## Tech constraints

- Single file: `src/components/DateTime24.tsx` (replaces the current version).
- `motion/react` for chip/popover animation (already a dependency — not
  `framer-motion`). Lucide icons only (`Calendar`, `Check`, `ChevronLeft`,
  `ChevronRight`). Tailwind classes only.
- No new npm packages. No `any` types. Hebrew for all user-facing text; English
  for code/comments.
- All time math goes through the existing Israel-timezone pattern used in
  App.tsx: `toLocaleString('sv-SE', { timeZone: 'Asia/Jerusalem' })`
  → `.replace(' ', 'T').slice(0, 16)`. "Now" and the relative presets are
  computed in Israel time so they match the rest of the app.
- `npm run lint` (tsc --noEmit) must pass with zero errors.

## Edge cases

- Empty / partial `value` → render with a sensible default (does not emit until a
  full valid datetime exists, matching current `emit` guard behavior).
- `value` matching no preset → chips render inactive; fine-tune reflects the
  actual value.
- Minute nudge crossing 00/59 boundary → hour rolls; hour crossing 23/00 → date
  rolls (via Date arithmetic in Israel time, then reformat).
- Scroll-column popover closes on selection and on outside tap.
- The existing sleep-end "cannot be empty" guard in `handleUpdateEvent`
  (`customSleepEndAt`) is **untouched** — the component just supplies the value.

## Integration (6 sites in `src/App.tsx`)

Import `DateTime24` once; replace each `<input type="datetime-local">` block with
`<DateTime24 value={...} onChange={...} />`, preserving the surrounding `<label>`:

1. Sleep TIMER start-time picker → `customTimestamp`
2. Sleep MANUAL start → `customSleepStartAt`
3. Sleep MANUAL end → `customSleepEndAt`
4. Edit-sleep start → `customSleepStartAt`
5. Edit-sleep end → `customSleepEndAt`
6. Generic event time → `customTimestamp`

Each currently uses `onChange={(e) => setX(e.target.value)}`; the new call becomes
`onChange={setX}` (DateTime24 emits the raw string).

## Non-goals (YAGNI)

- No seconds precision.
- No full inline mini-calendar (native date input covers the rare far-date case).
- No persistence / recent-times memory.
- No changes to how timestamps are stored or to server logic.

## Success criteria

1. `npm run lint` passes, zero errors.
2. At 375px RTL: picker is visually polished and legible; never shows AM/PM.
3. One tap on `עכשיו` sets the current Israel time; `-15 דק׳` / `-1 שעה` offset
   correctly, including across hour/day boundaries.
4. Hour/minute scroll columns select 00–23 / 00–59; chevrons nudge ±5.
5. Live preview matches the value that gets saved.
6. All 6 sites create/edit events with correct timestamps (feed, sleep
   start/end, generic event), verified in the running app.
