# DateTime24 Picker Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cramped `DateTime24` component and the 6 native `datetime-local` inputs in `src/App.tsx` with one beautiful, guaranteed-24-hour date + time picker.

**Architecture:** A single self-contained React component (`src/components/DateTime24.tsx`) that emits/consumes the exact `"YYYY-MM-DDTHH:mm"` string the current inputs use, so wiring is a pure JSX swap. It offers quick relative presets (now / 15-min-ago / 1-hour-ago), a today/yesterday date row with a native `<input type="date">` fallback, a custom 24h time control (styled scroll columns + ±5-minute chevron nudge), and a live Hebrew preview.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, `motion/react`, `lucide-react`. No test runner exists — verification is `npm run lint` (tsc --noEmit), `npm run build`, and Playwright browser checks at 375px.

## Global Constraints

- Single component file `src/components/DateTime24.tsx`. No other new files under `src/`. No new npm packages.
- No `any` types. `npm run lint` must pass with zero errors.
- Hebrew for all user-facing text; English for code and comments.
- `motion/react` (never `framer-motion`). Lucide React icons only. Tailwind classes only.
- Guaranteed 24-hour: never render a native `datetime-local` or `time` input; AM/PM must never appear.
- All "now"/relative math uses Israel wall-clock: `new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jerusalem' }).replace(' ', 'T').slice(0, 16)`.
- Value in/out format is exactly `"YYYY-MM-DDTHH:mm"` (drop-in for `customTimestamp`, `customSleepStartAt`, `customSleepEndAt`).

---

### Task 1: Build the DateTime24 component

**Files:**
- Modify (full rewrite): `src/components/DateTime24.tsx`

**Interfaces:**
- Consumes: nothing (leaf component).
- Produces: `export function DateTime24(props: { value: string; onChange: (value: string) => void; className?: string }): JSX.Element`
  - `value` is `"YYYY-MM-DDTHH:mm"` (may be empty/partial).
  - `onChange` is called with a full `"YYYY-MM-DDTHH:mm"` string whenever the user changes the selection. Never called with a partial value.

- [ ] **Step 1: Replace the entire file contents**

Overwrite `src/components/DateTime24.tsx` with:

```tsx
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// A beautiful, guaranteed 24-hour date + time picker. Native
// <input type="datetime-local"> renders AM/PM on locale-dependent devices and
// cannot be forced to 24h via HTML. This composes quick relative presets, a date
// row (today/yesterday chips + a native <input type="date"> fallback for far-off
// dates — dates have no AM/PM), and a custom 24h time control (styled scroll
// columns + a +/-5 minute nudge). Value in/out is the same "YYYY-MM-DDTHH:mm"
// string the native datetime-local input used, so it is a drop-in replacement.

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Check, ChevronLeft, ChevronRight } from 'lucide-react';

interface DateTime24Props {
  value: string; // "YYYY-MM-DDTHH:mm"
  onChange: (value: string) => void;
  className?: string;
}

interface Parts {
  date: string;
  hour: string;
  minute: string;
}

// ---- Pure wall-clock helpers (no timezone conversion during arithmetic) ----

// Current Israel wall-clock time as "YYYY-MM-DDTHH:mm".
const nowInIsrael = (): string =>
  new Date()
    .toLocaleString('sv-SE', { timeZone: 'Asia/Jerusalem' })
    .replace(' ', 'T')
    .slice(0, 16);

// Split "YYYY-MM-DDTHH:mm" defensively, tolerating empty/partial input.
const parseValue = (value: string): Parts => {
  const [datePart = '', timePart = ''] = (value || '').split('T');
  const [h = '', m = ''] = timePart.split(':');
  return {
    date: datePart,
    hour: h.length ? h.padStart(2, '0') : '00',
    minute: m.length ? m.padStart(2, '0') : '00',
  };
};

const compose = (date: string, hour: string, minute: string): string =>
  `${date}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;

// Shift a wall-clock "YYYY-MM-DDTHH:mm" by deltaMin minutes, rolling hours/days.
// The local Date constructor is used as a naive wall-clock container: we never
// convert timezones here, so parse-local + read-local stays internally
// consistent regardless of the browser's timezone.
const shiftMinutes = (value: string, deltaMin: number): string => {
  const { date, hour, minute } = parseValue(value || nowInIsrael());
  const [y, mo, d] = date.split('-').map(Number);
  const dt = new Date(y, mo - 1, d, Number(hour), Number(minute));
  dt.setMinutes(dt.getMinutes() + deltaMin);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
};

// Hebrew "יום א׳, 5 ביולי · 14:30" for the live preview.
const formatHebrewPreview = (value: string): string => {
  const { date, hour, minute } = parseValue(value);
  if (!date) return '';
  const [y, mo, d] = date.split('-').map(Number);
  const dt = new Date(y, mo - 1, d);
  const label = dt.toLocaleDateString('he-IL', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
  return `${label} · ${hour}:${minute}`;
};

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

// ---- Styled 24h scroll column for hour / minute ----

function ScrollColumn({
  options,
  selected,
  onPick,
  onClose,
}: {
  options: string[];
  selected: string;
  onPick: (v: string) => void;
  onClose: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  // Center the selected value inside the scroll container when it opens.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-v="${selected}"]`);
    el?.scrollIntoView({ block: 'center' });
  }, [selected]);
  return (
    <>
      {/* Backdrop closes on outside tap */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <motion.div
        ref={listRef}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        className="absolute z-50 mt-1 w-16 max-h-40 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-xl scrollbar-none"
      >
        {options.map((o) => (
          <button
            key={o}
            type="button"
            data-v={o}
            onClick={() => {
              onPick(o);
              onClose();
            }}
            className={`block w-full py-2 text-center text-sm font-mono font-bold transition-colors ${
              o === selected ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            {o}
          </button>
        ))}
      </motion.div>
    </>
  );
}

// ---- Main component ----

export function DateTime24({ value, onChange, className }: DateTime24Props) {
  const { date, hour, minute } = parseValue(value);
  const [showDateInput, setShowDateInput] = useState(false);
  const [openCol, setOpenCol] = useState<null | 'hour' | 'minute'>(null);

  const today = nowInIsrael().slice(0, 10);
  const yesterday = shiftMinutes(nowInIsrael(), -1440).slice(0, 10);

  const emit = (next: string) => {
    if (!parseValue(next).date) return; // only emit a full, valid datetime
    onChange(next);
  };

  const setDate = (d: string) => emit(compose(d, hour, minute));
  const setHour = (h: string) => emit(compose(date || today, h, minute));
  const setMinute = (m: string) => emit(compose(date || today, hour, m));
  const nudge = (delta: number) => emit(shiftMinutes(value || compose(today, hour, minute), delta));

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-black transition-colors border ${
      active
        ? 'bg-indigo-600 border-indigo-500 text-white'
        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
    }`;

  const isNow = value === nowInIsrael();
  const isCustomDate = date !== '' && date !== today && date !== yesterday;
  const preview = formatHebrewPreview(value);

  return (
    <div className={`flex flex-col gap-2.5 ${className ?? ''}`} dir="rtl">
      {/* 1. Quick presets */}
      <div className="flex items-center gap-2">
        <button type="button" className={chip(isNow)} onClick={() => emit(nowInIsrael())}>
          עכשיו
        </button>
        <button type="button" className={chip(false)} onClick={() => emit(shiftMinutes(nowInIsrael(), -15))}>
          לפני 15 דק׳
        </button>
        <button type="button" className={chip(false)} onClick={() => emit(shiftMinutes(nowInIsrael(), -60))}>
          לפני שעה
        </button>
      </div>

      {/* 2. Fine-tune row */}
      <div className="flex items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-2xl px-2.5 py-2">
        {/* Date */}
        <div className="flex items-center gap-1.5">
          <button type="button" className={chip(date === today)} onClick={() => setDate(today)}>
            היום
          </button>
          <button type="button" className={chip(date === yesterday)} onClick={() => setDate(yesterday)}>
            אתמול
          </button>
          <button
            type="button"
            onClick={() => setShowDateInput((s) => !s)}
            className={`p-1.5 rounded-lg border ${
              isCustomDate
                ? 'bg-indigo-950/60 border-indigo-700 text-indigo-300'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
            aria-label="בחר תאריך"
          >
            <Calendar className="w-4 h-4" />
          </button>
        </div>

        {/* Time — dir=ltr so the chevrons and HH:mm read left-to-right */}
        <div className="flex items-center gap-1" dir="ltr">
          <button
            type="button"
            onClick={() => nudge(-5)}
            className="p-1 text-slate-400 hover:text-slate-200"
            aria-label="הפחת 5 דקות"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenCol(openCol === 'hour' ? null : 'hour')}
              className="w-10 py-1 rounded-lg font-mono font-black text-lg text-slate-100 hover:bg-slate-800 text-center"
            >
              {hour}
            </button>
            <AnimatePresence>
              {openCol === 'hour' && (
                <ScrollColumn options={HOURS} selected={hour} onPick={setHour} onClose={() => setOpenCol(null)} />
              )}
            </AnimatePresence>
          </div>

          <span className="font-mono font-black text-lg text-slate-500">:</span>

          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenCol(openCol === 'minute' ? null : 'minute')}
              className="w-10 py-1 rounded-lg font-mono font-black text-lg text-slate-100 hover:bg-slate-800 text-center"
            >
              {minute}
            </button>
            <AnimatePresence>
              {openCol === 'minute' && (
                <ScrollColumn options={MINUTES} selected={minute} onPick={setMinute} onClose={() => setOpenCol(null)} />
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={() => nudge(5)}
            className="p-1 text-slate-400 hover:text-slate-200"
            aria-label="הוסף 5 דקות"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Native date fallback for rare far-off dates (date has no AM/PM). */}
      {showDateInput && (
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setShowDateInput(false);
          }}
          className="bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
        />
      )}

      {/* 3. Live preview */}
      {preview && (
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
          <Check className="w-3.5 h-3.5" />
          <span>{preview}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run the lint gate**

Run: `npm run lint`
Expected: exits 0, zero errors. (If `scrollbar-none` or a Tailwind class is flagged — it will not be, tsc does not check CSS classes. Any error here is a TypeScript error to fix before proceeding.)

- [ ] **Step 3: Commit**

```bash
git add src/components/DateTime24.tsx
git commit -m "feat: rebuild DateTime24 as a beautiful 24h date+time picker"
```

---

### Task 2: Wire DateTime24 into all 6 sites in App.tsx

**Files:**
- Modify: `src/App.tsx` (add one import; replace 6 `<input type="datetime-local">` blocks)

**Interfaces:**
- Consumes: `DateTime24` from Task 1 — `<DateTime24 value={string} onChange={(v: string) => void} />`.
- Produces: nothing new; the 6 timestamp states (`customTimestamp`, `customSleepStartAt`, `customSleepEndAt`) are unchanged in type and meaning.

- [ ] **Step 1: Add the import**

Near the top of `src/App.tsx`, with the other local imports (the `InstallAppButton` / component imports), add:

```tsx
import { DateTime24 } from './components/DateTime24';
```

- [ ] **Step 2: Replace site 1 — Sleep TIMER start-time picker**

Find (inside the sleep TIMER block, label `שעת תחילת השינה`):

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
                        <DateTime24 value={customTimestamp} onChange={setCustomTimestamp} />
```

- [ ] **Step 3: Replace site 2 — Sleep MANUAL start (`customSleepStartAt`, label `💤 שעת תחילת שינה (הלך לישון)`)**

Find the `<input type="datetime-local" value={customSleepStartAt} ... />` inside the MANUAL sleep create block and replace the whole `<input .../>` with:

```tsx
                        <DateTime24 value={customSleepStartAt} onChange={setCustomSleepStartAt} />
```

- [ ] **Step 4: Replace site 3 — Sleep MANUAL end (`customSleepEndAt`, label `⏰ שעת התעוררות (הקיץ משנתו)`)**

Find the `<input type="datetime-local" value={customSleepEndAt} ... />` inside the MANUAL sleep create block and replace the whole `<input .../>` with:

```tsx
                        <DateTime24 value={customSleepEndAt} onChange={setCustomSleepEndAt} />
```

- [ ] **Step 5: Replace site 4 — Edit-sleep start (`customSleepStartAt`, in the `editingEvent.eventType === 'SLEEP'` edit block)**

Find the `<input type="datetime-local" value={customSleepStartAt} ... />` inside the EDIT sleep block and replace the whole `<input .../>` with:

```tsx
                          <DateTime24 value={customSleepStartAt} onChange={setCustomSleepStartAt} />
```

- [ ] **Step 6: Replace site 5 — Edit-sleep end (`customSleepEndAt`, in the edit block)**

Find the `<input type="datetime-local" value={customSleepEndAt} ... />` inside the EDIT sleep block and replace the whole `<input .../>` with:

```tsx
                          <DateTime24 value={customSleepEndAt} onChange={setCustomSleepEndAt} />
```

- [ ] **Step 7: Replace site 6 — Generic event time (`customTimestamp`, label `שעת האירוע`)**

Find the `<input type="datetime-local" value={customTimestamp} ... />` inside the generic "Event Time (Always Visible & Pre-filled)" block and replace the whole `<input .../>` with:

```tsx
                        <DateTime24 value={customTimestamp} onChange={setCustomTimestamp} />
```

- [ ] **Step 8: Confirm no native datetime-local inputs remain**

Run: `rg -n "type=\"datetime-local\"" src/App.tsx`
Expected: **no matches** (all 6 replaced).

- [ ] **Step 9: Run the lint gate**

Run: `npm run lint`
Expected: exits 0, zero errors.

- [ ] **Step 10: Commit**

```bash
git add src/App.tsx
git commit -m "feat: use DateTime24 for all event time inputs"
```

---

### Task 3: Verify in the running app (build + browser)

**Files:** none modified — verification only.

**Interfaces:** none.

- [ ] **Step 1: Production build gate**

Run: `npm run build`
Expected: Vite build + esbuild both succeed with no errors.

- [ ] **Step 2: Start the dev server**

Run (background): `npm run dev`
Expected: server listening on `http://localhost:3000` (or the `PORT` env value). Confirm it logs the listening port.

- [ ] **Step 3: Browser check — add-event picker at 375px**

Using the Playwright browser tools:
1. `browser_resize` to 375×812.
2. `browser_navigate` to `http://localhost:3000` and log in if prompted.
3. Open the add-event sheet for a generic event (so the `שעת האירוע` picker renders).
4. `browser_take_screenshot`.

Expected observations:
- Three preset chips: `עכשיו`, `לפני 15 דק׳`, `לפני שעה`.
- A fine-tune row with `היום` / `אתמול` chips, a calendar icon, and a `HH : mm` control flanked by `‹ ›`.
- A green ✓ Hebrew preview line beneath (e.g. `יום א׳, 5 ביולי · 14:30`).
- **No AM/PM anywhere.**

- [ ] **Step 4: Browser check — interactions**

1. Tap `עכשיו` → the `עכשיו` chip fills indigo and the preview shows the current Israel time to the minute.
2. Tap `לפני שעה` → preview time drops by exactly 1 hour (verify the hour rolls back across midnight if near 00:00).
3. Tap the hour number → a styled scroll column of `00`–`23` opens; pick a value → column closes, `HH` updates, preview updates. Confirm the list contains `23` and no `12 PM`-style entries.
4. Tap `›` next to the minute twice → minute increases by 10; if it crosses `55`→`00` the hour increments.
5. Tap the calendar icon → a native date input appears; pick a date → `היום`/`אתמול` deselect and the calendar icon shows the active (indigo) state.

- [ ] **Step 5: Browser check — save round-trips**

1. Set a specific time via the picker, save the event, and confirm the event appears in the Log/Timeline with that exact 24h time (`getHeberwTimeStr` formats it).
2. Open a sleep MANUAL entry, set start and end via the two pickers, save → sleep duration reflects the chosen times.
3. Edit an existing sleep event → the start/end pickers prefill from the event; clearing is not possible (the pickers always hold a value), so the existing sleep-end "cannot be empty" guard is satisfied.

- [ ] **Step 6: Stop the dev server and report**

Stop the background `npm run dev`. Summarize results (screenshots + pass/fail per check). This task has no commit — it is verification only.

---

## Notes for the implementer

- **Why the value stays `"YYYY-MM-DDTHH:mm"`:** the parent handlers (`handleCreateEvent`, `handleUpdateEvent`) already do `customTimestamp ? new Date(customTimestamp).toISOString() : ...`. Keeping the same string means zero handler changes.
- **DST caveat (acceptable):** `shiftMinutes` does naive wall-clock arithmetic. At the twice-yearly Israel DST boundary a relative nudge could be off by an hour for times spanning the transition. This matches the existing app's behavior and is out of scope.
- **Do not** add a test framework, extract helpers to a new file, or change any server/timestamp-storage logic — see Global Constraints and the spec's Non-goals.
