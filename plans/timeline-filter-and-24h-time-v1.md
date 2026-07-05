# Timeline Day Filter + App-wide 24-Hour Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 1/7/14-day rolling filter to the Timeline tab (default 1, never persisted), and replace every native AM/PM-capable time picker with a guaranteed 24-hour control.

**Architecture:** A new reusable `DateTime24` component renders a native date input plus hour/minute dropdowns, emitting the exact same `YYYY-MM-DDTHH:mm` string the native `datetime-local` inputs used — so it drops into all 6 sites with no change to save logic. The Timeline filter reuses the dashboard's toggle markup and a non-persisted `timelineDays` state, filtering the shared `events` array by a rolling time window; the client fetch limit is raised so a 14-day window isn't truncated.

**Tech Stack:** React 19 + TypeScript, Tailwind v4, Lucide React, native `fetch()`. No test framework — verification is done in the browser and via `npm run lint` (`tsc --noEmit`).

## Global Constraints

- All user-facing strings in Hebrew; code and comments in English
- No `any` types in new code
- No new npm packages
- All Firestore access stays in server code — no Firestore imports in `src/`
- `datetime-local` value format is `YYYY-MM-DDTHH:mm` (16 chars, produced by `getLocalDatetimeString`) — the new component must preserve this exact contract
- `timelineDays` must NOT be persisted (localStorage/sessionStorage): it always resets to 1 on app open
- Verification is browser-based; run `npm run lint` after each code task to confirm the TypeScript build is clean

---

### Task 1: Create the `DateTime24` 24-hour picker component

**Files:**
- Create: `src/components/DateTime24.tsx`

**Interfaces:**
- Produces: `DateTime24` (named export). Props: `{ value: string; onChange: (value: string) => void; className?: string }`. `value` and the argument to `onChange` are both `YYYY-MM-DDTHH:mm` strings.

- [ ] **Step 1: Create the component file**

Create `src/components/DateTime24.tsx` with this exact content:

```tsx
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// A guaranteed 24-hour date/time picker. Native <input type="datetime-local">
// renders AM/PM based on device locale and cannot be forced to 24h via HTML,
// so we compose a native date input (dates have no AM/PM) with explicit
// hour/minute dropdowns. Value in/out is the same "YYYY-MM-DDTHH:mm" string the
// native datetime-local input used, making this a drop-in replacement.

interface DateTime24Props {
  value: string; // "YYYY-MM-DDTHH:mm"
  onChange: (value: string) => void;
  className?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const FIELD_CLASS =
  'bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-2 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none';

export function DateTime24({ value, onChange, className }: DateTime24Props) {
  // Split "YYYY-MM-DDTHH:mm" defensively, tolerating empty/partial input.
  const [datePart = '', timePart = ''] = (value || '').split('T');
  const [hourRaw = '', minuteRaw = ''] = timePart.split(':');
  const hourPart = hourRaw.length ? hourRaw.padStart(2, '0') : '00';
  const minutePart = minuteRaw.length ? minuteRaw.padStart(2, '0') : '00';

  const emit = (nextDate: string, nextHour: string, nextMinute: string) => {
    // Only emit a full, valid datetime-local string once a date exists.
    if (!nextDate) return;
    onChange(`${nextDate}T${nextHour.padStart(2, '0')}:${nextMinute.padStart(2, '0')}`);
  };

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`} dir="ltr">
      <input
        type="date"
        value={datePart}
        onChange={(e) => emit(e.target.value, hourPart, minutePart)}
        className={`${FIELD_CLASS} flex-1`}
      />
      <select
        value={hourPart}
        onChange={(e) => emit(datePart, e.target.value, minutePart)}
        className={FIELD_CLASS}
        aria-label="שעה"
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="text-slate-500 font-black">:</span>
      <select
        value={minutePart}
        onChange={(e) => emit(datePart, hourPart, e.target.value)}
        className={FIELD_CLASS}
        aria-label="דקה"
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run lint`
Expected: PASS (no TypeScript errors). The component is not yet imported, which is fine.

- [ ] **Step 3: Commit**

```bash
git add src/components/DateTime24.tsx
git commit -m "feat: add DateTime24 guaranteed 24-hour date/time picker"
```

---

### Task 2: Replace all native `datetime-local` inputs with `DateTime24`

**Files:**
- Modify: `src/App.tsx` (import line ~6; input sites at lines 5458, 5495, 5505, 6158, 6168, 6214)

**Interfaces:**
- Consumes: `DateTime24` from Task 1 — `<DateTime24 value={string} onChange={(v: string) => void} />`

- [ ] **Step 1: Import the component**

In `src/App.tsx`, immediately after the existing import block (after the `lucide-react` import, near line 6), add:

```tsx
import { DateTime24 } from './components/DateTime24';
```

- [ ] **Step 2: Replace input #1 — live sleep start (~line 5458)**

Find:
```tsx
                        <input
                          type="datetime-local"
                          value={customTimestamp}
                          onChange={(e) => setCustomTimestamp(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-right font-medium"
                        />
```
Replace with:
```tsx
                        <DateTime24
                          value={customTimestamp}
                          onChange={setCustomTimestamp}
                        />
```

- [ ] **Step 3: Replace input #2 — manual sleep start (~line 5495)**

Find:
```tsx
                        <input
                          type="datetime-local"
                          value={customSleepStartAt}
                          onChange={(e) => setCustomSleepStartAt(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-right font-medium"
                        />
```
Replace with:
```tsx
                        <DateTime24
                          value={customSleepStartAt}
                          onChange={setCustomSleepStartAt}
                        />
```

- [ ] **Step 4: Replace input #3 — manual sleep end (~line 5505)**

Find:
```tsx
                        <input
                          type="datetime-local"
                          value={customSleepEndAt}
                          onChange={(e) => setCustomSleepEndAt(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-right font-medium"
                        />
```
Replace with:
```tsx
                        <DateTime24
                          value={customSleepEndAt}
                          onChange={setCustomSleepEndAt}
                        />
```

- [ ] **Step 5: Replace input #4 — edit sleep start (~line 6158)**

Find:
```tsx
                        <input
                          type="datetime-local"
                          value={customSleepStartAt}
                          onChange={(e) => setCustomSleepStartAt(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-right font-medium"
                        />
```
Replace with:
```tsx
                        <DateTime24
                          value={customSleepStartAt}
                          onChange={setCustomSleepStartAt}
                        />
```

Note: inputs #2 and #4 share identical markup but live in different JSX blocks (manual-add sheet vs. edit sheet). Replace each occurrence in file order; after replacing #2 the next remaining match is #4.

- [ ] **Step 6: Replace input #5 — edit sleep end (~line 6168)**

Find:
```tsx
                        <input
                          type="datetime-local"
                          value={customSleepEndAt}
                          onChange={(e) => setCustomSleepEndAt(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-right font-medium"
                        />
```
Replace with:
```tsx
                        <DateTime24
                          value={customSleepEndAt}
                          onChange={setCustomSleepEndAt}
                        />
```

- [ ] **Step 7: Replace input #6 — shared event time (~line 6214)**

Find:
```tsx
                        <input
                          type="datetime-local"
                          value={customTimestamp}
                          onChange={(e) => setCustomTimestamp(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-right"
                        />
```
Replace with:
```tsx
                        <DateTime24
                          value={customTimestamp}
                          onChange={setCustomTimestamp}
                        />
```

- [ ] **Step 8: Confirm no native time inputs remain**

Run: `grep -n 'type="datetime-local"\|type="time"' src/App.tsx`
Expected: no output (all six replaced).

- [ ] **Step 9: Verify the build compiles**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 10: Browser verification**

Start the app (`npm run dev`). For each of: quick sleep start, manual sleep add (start + end), editing a sleep event, and a regular event's "שעת האירוע" field — confirm the control shows a date box plus 24-hour hour (00–23) and minute (00–59) dropdowns with NO AM/PM. Save one event and confirm the timestamp is correct in the timeline. Editing an existing event pre-fills the correct date/hour/minute.

- [ ] **Step 11: Commit**

```bash
git add src/App.tsx
git commit -m "feat: replace all native datetime-local inputs with 24-hour DateTime24"
```

---

### Task 3: Add the rolling day filter to the Timeline tab

**Files:**
- Modify: `src/App.tsx` (state ~line 413; fetch limit line 1416; timeline block lines 3182–3237)

**Interfaces:**
- Consumes: existing `events: BabyEvent[]`, `openSleepSession`.
- Produces: `timelineDays: number` state + `setTimelineDays`.

- [ ] **Step 1: Add non-persisted `timelineDays` state**

In `src/App.tsx`, right after the `dashboardDays` declaration (line 413):
```tsx
  const [dashboardDays, setDashboardDays] = useState<number>(1);
```
add:
```tsx
  const [timelineDays, setTimelineDays] = useState<number>(1); // rolling day window; never persisted → resets to 1 on app open
```

- [ ] **Step 2: Raise the fetch limit so a 14-day window isn't truncated**

In `fetchEvents` (line 1416), change:
```tsx
      const res = await fetch('/api/events?limit=60');
```
to:
```tsx
      const res = await fetch('/api/events?limit=400');
```
(The server applies no upper cap — `server.ts:280` uses `parseInt(limit) || 20` — so no server change is needed.)

- [ ] **Step 3: Add the day-filter toggle to the Timeline header**

In the timeline block, find the header (lines 3184–3193):
```tsx
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-100">📋 ציר הזמן ההיסטורי</h2>
              <button 
                onClick={fetchEvents}
                className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl"
                title="רענן"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
```
Replace with (adds the pill toggle, mirroring the dashboard toggle at lines 3465–3480, with options 1/7/14):
```tsx
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-100">📋 ציר הזמן ההיסטורי</h2>
              <div className="flex items-center gap-2">
                <div className="bg-slate-950 p-1 rounded-2xl border border-slate-850 flex gap-1">
                  {[1, 7, 14].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setTimelineDays(days)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        timelineDays === days
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      {days === 1 ? 'היום' : `${days} ימים`}
                    </button>
                  ))}
                </div>
                <button
                  onClick={fetchEvents}
                  className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl"
                  title="רענן"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
```

- [ ] **Step 4: Apply the rolling-window filter to the event list**

In the timeline block, find (line 3237):
```tsx
                {events.filter(e => e.id !== openSleepSession?.id).map((e) => {
```
Replace with:
```tsx
                {events.filter(e => {
                  if (e.id === openSleepSession?.id) return false;
                  const cutoffMs = Date.now() - timelineDays * 24 * 60 * 60 * 1000;
                  return new Date(e.timestamp).getTime() >= cutoffMs;
                }).map((e) => {
```
The active-sleep indicator (`openSleepSession` block, lines 3210–3235) is rendered separately above this list and is unaffected by the filter, so it stays visible in every window.

- [ ] **Step 5: Verify the build compiles**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 6: Browser verification**

In the Timeline tab: the default view shows "היום" selected and only events from the last 24 hours. Switch to "7 ימים" / "14 ימים" and confirm the list expands to the last 168h / 336h respectively. Reload the page (or close/reopen the PWA) and confirm the Timeline reverts to "היום" (1 day). If a sleep session is active, its indicator stays pinned at the top in all three windows.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add 1/7/14-day rolling filter to Timeline (defaults to 1 day)"
```

---

## Self-Review

**Spec coverage:**
- Timeline 1/7/14 filter, default 1, styled like dashboard → Task 3 Steps 1, 3.
- Default always resets to 1 on reopen (non-persisted) → Task 3 Step 1 (`useState(1)`, no storage).
- Rolling-window semantics for 1/7/14 → Task 3 Step 4.
- Data volume / 14-day truncation → Task 3 Step 2.
- Active-sleep indicator persists across filters → Task 3 Step 4 note + Step 6.
- 24-hour everywhere via custom picker → Task 1 (component) + Task 2 (all 6 sites).
- Same `YYYY-MM-DDTHH:mm` contract, no save-logic change → Task 1 value contract + Task 2 bindings.
- No `datetime-local`/`time` remaining → Task 2 Step 8.

**Placeholder scan:** none — all code shown in full.

**Type consistency:** `DateTime24` props `{ value: string; onChange: (value: string) => void; className? }` are used consistently in Task 2 (passing `setCustomTimestamp` etc., all `(v: string) => void`). `timelineDays: number` consistent across Task 3.
