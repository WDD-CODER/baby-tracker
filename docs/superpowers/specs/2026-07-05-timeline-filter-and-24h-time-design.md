# Design — Timeline Day Filter + App-wide 24-Hour Time

**Date:** 2026-07-05
**Author:** Claude (Planner)
**Status:** Approved — ready for implementation plan
**Target file:** `src/App.tsx` (single-component app)

## Problem

Two independent UX issues:

1. **Timeline has no time filter.** The Timeline tab (`activeTab === 'timeline'`) renders every fetched event with no way to narrow the range, unlike the Dashboards tab which has a 1/3/7/14-day pill toggle.
2. **Time entry shows AM/PM.** All time-entry pickers are native `<input type="datetime-local">`. Their 12h/24h format follows the device's regional locale — there is no HTML attribute to force 24-hour. On 12-hour-locale devices this shows AM/PM, which is confusing and error-prone. (On-screen *displays* already render 24-hour via `he-IL` / `hour12: false`; only the input pickers are affected.)

## Goals

- Timeline gets a day-range filter: **1 (default) / 7 / 14 days**, styled like the dashboard toggle.
- The filter **always defaults to 1 day** on every app open (not persisted).
- Every time-entry control in the app uses **24-hour** input with **no AM/PM**, guaranteed regardless of device locale.

## Non-Goals

- No change to how events are saved or to the stored timestamp format.
- No change to existing 24-hour on-screen displays (already correct).
- No redesign of the Dashboards toggle (it stays 1/3/7/14).

## Part A — Timeline Day Filter

### Behavior
- Add state `timelineDays: number`, initialized `useState(1)`. **Not persisted** (mirrors `dashboardDays`, which is also a non-persisted `useState(1)` and therefore already resets to 1 on reload). Reopening the app → always 1-day view.
- Add a pill toggle in the Timeline header (next to the refresh button, ~line 3184), visually identical to the dashboard toggle (`src/App.tsx:3465–3480`) but with options `[1, 7, 14]`. Labels: `1 → היום`, `7 → 7 ימים`, `14 → 14 ימים`.
- Filter semantics: **rolling window**. Show events whose `timestamp >= now − (timelineDays × 24 hours)`. This applies to 1, 7, and 14 alike (e.g. 1 = last 24h, 7 = last 168h, 14 = last 336h).
- The active-sleep indicator block at the top of the timeline (`openSleepSession`) remains visible regardless of the selected filter.
- Empty-state and loading behavior unchanged; the empty-state may additionally show when the filtered list is empty for the chosen window.

### Data volume
- The timeline is fed by the shared `events` array, fetched in `fetchEvents()` via `/api/events?limit=60` (`src/App.tsx:1416`). 60 events can be fewer than a 14-day window contains, truncating the view.
- **Resolution:** raise the fetch limit so a 14-day window is not silently cut off. Bump `limit=60` to a safe higher value (e.g. `limit=400`). This also benefits the Dashboards tab, which filters the same `events` array up to 14 days. Confirm the `/api/events` endpoint honors the larger limit; if it caps lower, raise the server cap accordingly. (No new endpoint or range param required.)

## Part B — App-wide 24-Hour Time Picker

### Root cause
The 12h/24h rendering of `<input type="datetime-local">` / `<input type="time">` is controlled by the browser/OS locale and cannot be forced via HTML. The only reliable cross-device fix is to stop using the native time picker and supply our own 24-hour control.

### Component: `DateTime24`
A single small reusable component (defined in `src/App.tsx` alongside existing helpers, or extracted to `src/components/DateTime24.tsx`).

- **Props:** `value: string` and `onChange: (value: string) => void`, plus optional `label`/`className` passthrough.
- **Value contract:** accepts and emits the **exact same `YYYY-MM-DDTHH:mm` string** the native `datetime-local` inputs use. This makes it a drop-in replacement — no changes to the state (`customTimestamp`, `customSleepStartAt`, `customSleepEndAt`) or to save/submit logic that reads those strings.
- **UI:**
  - Date part: native `<input type="date">` (dates carry no AM/PM, so locale rendering is a non-issue).
  - Time part: two dropdowns — hour `<select>` with options `00–23`, minute `<select>` with options `00–59`. No AM/PM element exists anywhere in the control.
  - Styling matches the current inputs (dark slate theme, rounded, RTL `text-right`).
- **Parsing/formatting:** split the incoming `YYYY-MM-DDTHH:mm` into date / hour / minute for the sub-controls; recombine on any sub-control change and call `onChange` with a valid `YYYY-MM-DDTHH:mm` string. Handle empty/invalid `value` gracefully (fall back to a sensible default such as "now" or empty sub-fields without emitting an invalid string).

### Replacement sites
Replace all 6 native `datetime-local` inputs with `<DateTime24 .../>`, keeping the same `value`/`onChange` bindings:
- `src/App.tsx:5458` — live sleep start (`customTimestamp`)
- `src/App.tsx:5495` — manual sleep start (`customSleepStartAt`)
- `src/App.tsx:5505` — manual sleep end (`customSleepEndAt`)
- `src/App.tsx:6158` — edit sleep start (`customSleepStartAt`)
- `src/App.tsx:6168` — edit sleep end (`customSleepEndAt`)
- `src/App.tsx:6214` — shared event time (`customTimestamp`)

After replacement, confirm no `type="datetime-local"` or `type="time"` remains anywhere in the app.

## Testing / Verification

- **Timeline:** toggling 1/7/14 filters the list to the correct rolling window; reload → back to 1; active-sleep indicator persists across filters; 14-day window is not truncated by the fetch limit.
- **24h:** on a device/browser set to a 12-hour (US) locale, every time entry shows 24-hour hour/minute with no AM/PM; entered values round-trip correctly to the same `YYYY-MM-DDTHH:mm` state; editing an existing event pre-fills the picker correctly; saved timestamps are unchanged in format.

## Rollout notes for Contractor (Cursor)

- Single-file app: keep changes within `src/App.tsx` unless extracting `DateTime24` to `src/components/`.
- Reuse the exact toggle markup/classes from the dashboard toggle for visual consistency.
- Do not persist `timelineDays`.
