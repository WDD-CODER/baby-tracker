# Bio Gaya Supplement Reminder + Big Nap Warning Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a daily Bio Gaya supplement floating reminder that logs to Firestore when given (syncs between both parents), and fix the big nap warning to only appear 12:00–16:00 with a 75-minute threshold and show a "שנת צהריים גדולה" badge on qualifying naps in the timeline.

**Architecture:** New `SUPPLEMENT` EventType persists to Firestore via the existing `/api/events` endpoint — no new server endpoints. Bio Gaya pill visibility is derived from today's `SUPPLEMENT` events, so sync between parents is free. Big nap changes are pure logic/threshold updates plus a derived `isNoonNapBadge` flag inside the timeline `.map()`.

**Tech Stack:** React 19 + TypeScript, Tailwind v4, `motion/react`, Lucide React (`Check` icon already imported), native `fetch()`

## Global Constraints

- All user-facing strings in Hebrew; code and comments in English
- No `any` types (except existing `'sleep' as any` — do not touch)
- No new npm packages
- All Firestore access stays in `server/db.ts` — no Firestore imports in `src/`
- Icons: Lucide React only for UI chrome; emoji (💧, 🌙) acceptable as event glyphs
- Use `motion/react` not `framer-motion`
- No new files under `src/` — all changes go in `src/types.ts` and `src/App.tsx`
- This project has no automated test framework — verification is done in the browser

---

### Task 1: Add SUPPLEMENT event type to schema

**Files:**
- Modify: `src/types.ts`

**Interfaces:**
- Produces: `EventType` (extended), `SupplementPayload`, `BabyEvent.supplement?`

- [ ] **Step 1: Add SUPPLEMENT to EventType union**

In `src/types.ts` line 8, change:
```ts
export type EventType = 'NUTRITION' | 'DIAPER' | 'SLEEP' | 'ACTIVITY' | 'WEIGHT' | 'PUMPING' | 'VOMITING';
```
to:
```ts
export type EventType = 'NUTRITION' | 'DIAPER' | 'SLEEP' | 'ACTIVITY' | 'WEIGHT' | 'PUMPING' | 'VOMITING' | 'SUPPLEMENT';
```

- [ ] **Step 2: Add SupplementPayload interface**

In `src/types.ts`, after the `VomitingPayload` interface block (after line 89, which ends with `}`), insert:
```ts
export interface SupplementPayload {
  name: string;
}
```

- [ ] **Step 3: Add supplement? field to BabyEvent**

In `src/types.ts`, inside the `BabyEvent` interface, after the `vomiting?: VomitingPayload;` line, add:
```ts
  supplement?: SupplementPayload;
```

- [ ] **Step 4: Verify TypeScript compiles**

Run:
```bash
npm run build
```
Expected: no TypeScript errors related to `SUPPLEMENT` or `SupplementPayload`. (Build may produce other pre-existing warnings — ignore those.)

- [ ] **Step 5: Commit**
```bash
git add src/types.ts
git commit -m "feat: add SUPPLEMENT event type and SupplementPayload to schema"
```

---

### Task 2: Bio Gaya handler, derived state, and floating pill

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes from Task 1: `SupplementPayload`, `EventType ('SUPPLEMENT')`
- Consumes from App.tsx: `checkAndRegisterDoubleSubmit(type: string): boolean`, `showToast(msg: string)`, `fetchEvents()`, `activeParent: ParentType`, `currentTime: number` (ms epoch), `babyDayEvents: BabyEvent[]`, `submitting: boolean`, `setSubmitting`, `BabyEvent` (type)
- Produces: `isSupplementSlotTime(): boolean`, `bioGayaGivenToday: boolean`, `bioGayaGivenEvent: BabyEvent | undefined`, `handleLogBioGaya(): Promise<void>`, floating pill JSX

- [ ] **Step 1: Add isSupplementSlotTime() helper**

In `src/App.tsx`, locate the `isNapSlotTime()` function (around line 982):
```ts
const isNapSlotTime = () => {
  const date = new Date(currentTime);
  const hour = date.getHours();
  return hour >= 12 && hour < 16;
};
```
Directly after its closing `};`, add:
```ts
const isSupplementSlotTime = () => {
  const hour = new Date(currentTime).getHours();
  return hour >= 6 && hour < 22;
};
```

- [ ] **Step 2: Add bioGayaGivenToday and bioGayaGivenEvent derived values**

In `src/App.tsx`, locate the block around line 2054–2057:
```ts
const todayPumpingEvents = babyDayEvents.filter(e => e.eventType === 'PUMPING').reverse();
const todayPumpingTotalLeft = todayPumpingEvents.reduce((acc, e) => acc + (e.pumping?.leftAmountMl || 0), 0);
const todayPumpingTotalRight = todayPumpingEvents.reduce((acc, e) => acc + (e.pumping?.rightAmountMl || 0), 0);
const todayPumpingTotal = todayPumpingTotalLeft + todayPumpingTotalRight;
```
After `const todayPumpingTotal = ...;`, add:
```ts
const bioGayaGivenToday = babyDayEvents.some(e => e.eventType === 'SUPPLEMENT');
const bioGayaGivenEvent = babyDayEvents.find(e => e.eventType === 'SUPPLEMENT');
```

- [ ] **Step 3: Add handleLogBioGaya event handler**

In `src/App.tsx`, locate `const handleQuickMealLog = async () => {` (around line 488). Insert `handleLogBioGaya` **directly before** it:
```ts
const handleLogBioGaya = async () => {
  if (checkAndRegisterDoubleSubmit('SUPPLEMENT')) {
    showToast('ביו גאיה כבר נרשם לאחרונה!');
    return;
  }
  setSubmitting(true);
  try {
    const payload: Partial<BabyEvent> = {
      timestamp: new Date().toISOString(),
      eventType: 'SUPPLEMENT',
      loggedBy: activeParent,
      supplement: { name: 'ביו גאיה' }
    };
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showToast('ביו גאיה נרשם ✔️');
      fetchEvents();
    } else {
      showToast('שגיאה בשמירת ביו גאיה');
    }
  } catch {
    showToast('לא ניתן להתחבר לשרת');
  } finally {
    setSubmitting(false);
  }
};
```

- [ ] **Step 4: Add Bio Gaya floating pill JSX**

In `src/App.tsx`, locate the `{/* Floating Big Nap Warning Pill */}` comment (around line 6232). Insert the Bio Gaya pill **immediately before** it:
```tsx
{/* Floating Bio Gaya Supplement Reminder Pill */}
{isSupplementSlotTime() && !bioGayaGivenToday && (
  <div className="fixed bottom-36 left-4 z-30">
    <motion.div
      initial={{ scale: 0, y: 50 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0, y: 50 }}
      className="flex items-center gap-2 bg-gradient-to-r from-emerald-700 to-teal-700 text-white font-black px-4 py-3 rounded-full shadow-2xl border border-emerald-500/30 text-xs"
    >
      <span className="text-sm">💧</span>
      <span>ביו גאיה — טרם ניתן</span>
      <button
        type="button"
        disabled={submitting}
        onClick={handleLogBioGaya}
        className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-black px-3 py-1.5 rounded-full text-[11px] transition-all cursor-pointer mr-1"
      >
        <Check className="w-3 h-3" />
        נתתי
      </button>
    </motion.div>
  </div>
)}
```

Note: `Check` is already imported from `lucide-react` at the top of `src/App.tsx`. Do not add a duplicate import.

- [ ] **Step 5: Verify in browser**

Start dev server (`npm run dev`). Check between 06:00–22:00:
1. Pill appears at bottom-left (above the bath pill position) with "ביו גאיה — טרם ניתן" and green "נתתי" button
2. Tap "נתתי" → toast "ביו גאיה נרשם ✔️" appears, pill disappears
3. Reload page → pill stays gone (event persisted to Firestore)
4. Open a second browser tab (simulates second parent) → pill is also gone there

- [ ] **Step 6: Commit**
```bash
git add src/App.tsx
git commit -m "feat: add Bio Gaya floating pill with Firestore-backed daily supplement tracking"
```

---

### Task 3: SUPPLEMENT rendering in timeline and log tab

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes from Task 2: `bioGayaGivenEvent: BabyEvent | undefined`, `bioGayaGivenToday: boolean`
- Consumes from App.tsx: `getHeberwTimeStr(isoString: string): string`, `getParentDisplayName(parent: ParentType): string`

- [ ] **Step 1: Add SUPPLEMENT case to timeline events.map()**

In `src/App.tsx`, locate the timeline `.map()` block. Find the VOMITING rendering block (around line 3278). The VOMITING block currently ends the if/else chain with a lone `}`. Change that closing `}` into `} else if` to chain SUPPLEMENT onto it:

Before (the VOMITING block's last two lines):
```tsx
  details = `דרגה: ${sizeText}`;
}
```
After (chain SUPPLEMENT as the next else-if, keeping the chain closed):
```tsx
  details = `דרגה: ${sizeText}`;
} else if (e.eventType === 'SUPPLEMENT' && e.supplement) {
  icon = '💧';
  borderClass = 'border-r-4 border-r-emerald-500';
  bgClass = 'bg-emerald-950/15';
  title = `תוסף: ${e.supplement.name}`;
  details = `נרשם ע״י ${getParentDisplayName(e.loggedBy)}`;
}
```

- [ ] **Step 2: Add Bio Gaya today card in log tab**

In `src/App.tsx`, locate the end of the log tab content. Find the pumping section closing tag followed by the log tab closing tags (around line 3119–3121):
```tsx
            </section>
          </div>
        )}

        {/* TAB 2: VERTICAL TIMELINE OF RECENT EVENTS */}
```
Insert a new section **between** the pumping `</section>` and the log tab's `</div>`, only rendering when Bio Gaya has been given today:
```tsx
{/* Bio Gaya Daily Supplement Card */}
{bioGayaGivenToday && bioGayaGivenEvent && (
  <section className="bg-emerald-950/30 border border-emerald-900/40 rounded-3xl p-4 shadow-sm mt-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-emerald-400 text-sm">💧</span>
        <h3 className="text-xs font-black text-slate-100">ביו גאיה</h3>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-900/50">
          ✓ ניתן ב-{getHeberwTimeStr(bioGayaGivenEvent.timestamp)}
        </span>
        <span className="text-[10px] text-slate-400 font-bold">
          {getParentDisplayName(bioGayaGivenEvent.loggedBy)}
        </span>
      </div>
    </div>
  </section>
)}
```

- [ ] **Step 3: Verify in browser**

After completing Task 2 step 5 (Bio Gaya already given):
1. Log tab → green card shows "✓ ניתן ב-HH:MM" and parent name
2. Timeline tab → SUPPLEMENT event row shows 💧 icon, emerald left border, title "תוסף: ביו גאיה", detail "נרשם ע״י <שם הורה>"
3. Before Bio Gaya is given: card does not appear in log tab

- [ ] **Step 4: Commit**
```bash
git add src/App.tsx
git commit -m "feat: render SUPPLEMENT events in timeline and log tab daily card"
```

---

### Task 4: Big nap — threshold, time gate, and timescale badge

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes from App.tsx: `isBigNapRecorded()`, `isNapSlotTime()`, `dismissedBigNapWarning`, `events: BabyEvent[]`

- [ ] **Step 1: Update isBigNapRecorded() — midday window and threshold**

In `src/App.tsx`, locate `isBigNapRecorded()` (around line 994). Inside the `events.find()` callback, find and change the midday check and return:

Change (around line 1017–1020):
```ts
// Midday check (starts between 11:00 and 15:15)
const isMidday = startHour >= 11 && startHour < 16;

return isMidday && finalDuration >= 45;
```
to:
```ts
// Noon nap window: starts 12:00–16:00, must reach 75 min (1h 15m)
const isMidday = startHour >= 12 && startHour < 16;

return isMidday && finalDuration >= 75;
```

Then find the active session fallback check (around line 1027–1033):
```ts
if (openSleepSession && openSleepSession.sleep) {
  const start = new Date(openSleepSession.sleep.startAt);
  const startHour = start.getHours();
  const isMidday = startHour >= 11 && startHour < 16;
  const activeDurationMin = Math.floor((currentTime - start.getTime()) / (1000 * 60));
  if (isMidday && activeDurationMin >= 30) {
    return true;
  }
}
```
Change to:
```ts
if (openSleepSession && openSleepSession.sleep) {
  const start = new Date(openSleepSession.sleep.startAt);
  const startHour = start.getHours();
  const isMidday = startHour >= 12 && startHour < 16;
  const activeDurationMin = Math.floor((currentTime - start.getTime()) / (1000 * 60));
  if (isMidday && activeDurationMin >= 60) {
    return true;
  }
}
```

- [ ] **Step 2: Add isNapSlotTime() gate to the floating big nap pill**

In `src/App.tsx`, locate the big nap floating pill condition (around line 6233):
```tsx
{!isBigNapRecorded() && !dismissedBigNapWarning && (
```
Change to:
```tsx
{isNapSlotTime() && !isBigNapRecorded() && !dismissedBigNapWarning && (
```

- [ ] **Step 3: Declare isNoonNapBadge in timeline map callback**

In `src/App.tsx`, locate the timeline events map (around line 3179):
```tsx
{events.filter(e => e.id !== openSleepSession?.id).map((e) => {
  // Style based on eventType
  let icon: React.ReactNode = '🍼';
  let borderClass = 'border-r-4 border-r-blue-500';
  let bgClass = 'bg-blue-950/20';
  let title = '';
  let details = '';
```
Add `let isNoonNapBadge = false;` after `let details = '';`:
```tsx
  let details = '';
  let isNoonNapBadge = false;
```

- [ ] **Step 4: Compute isNoonNapBadge inside the SLEEP block**

In `src/App.tsx`, locate the SLEEP rendering block inside the timeline map (around line 3228). Find the section that sets `details` for sleep events:
```tsx
const durationText = dur ? `${Math.floor(dur / 60)}ש ${dur % 60}ד` : 'לא הוגדר';
details = `משך: ${durationText} • תחילת שינה ב-${getHeberwTimeStr(e.sleep.startAt)}`;
if (e.sleep.endAt) {
  details += ` עד ${getHeberwTimeStr(e.sleep.endAt)}`;
} else {
  details += ` • עדיין ישן`;
}
```
After the closing `}` of that if/else (and still inside the `} else if (e.eventType === 'SLEEP' && e.sleep) {` block), add:
```ts
isNoonNapBadge = (() => {
  if (!e.sleep?.endAt || !e.sleep.durationMinutes) return false;
  const napStart = new Date(e.sleep.startAt || e.timestamp);
  const napHour = napStart.getHours();
  if (napHour < 12 || napHour >= 16 || e.sleep.durationMinutes < 75) return false;
  const napDay = napStart.toDateString();
  const firstQualifying = events
    .filter(ev => {
      if (ev.eventType !== 'SLEEP' || !ev.sleep?.endAt || !ev.sleep.durationMinutes) return false;
      const evStart = new Date(ev.sleep.startAt || ev.timestamp);
      return (
        evStart.toDateString() === napDay &&
        evStart.getHours() >= 12 &&
        evStart.getHours() < 16 &&
        ev.sleep.durationMinutes >= 75
      );
    })
    .sort((a, b) => new Date(a.sleep!.startAt).getTime() - new Date(b.sleep!.startAt).getTime())[0];
  return firstQualifying?.id === e.id;
})();
```

- [ ] **Step 5: Render noon nap badge in timeline JSX**

In `src/App.tsx`, inside the timeline map's shared JSX `return (...)`, locate the details paragraph (around line 3330):
```tsx
<p className="text-xs text-slate-300 font-medium mt-1 leading-relaxed">
  {details}
</p>
```
After that closing `</p>`, insert:
```tsx
{isNoonNapBadge && (
  <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-black text-indigo-300 bg-indigo-950/60 border border-indigo-800/50 px-2.5 py-0.5 rounded-full">
    🌙 שנת צהריים גדולה
  </span>
)}
```

- [ ] **Step 6: Verify in browser**

1. Before 12:00: big nap pill is completely absent (no bounce pill visible)
2. At 12:00: big nap pill appears (if no 75-min noon nap recorded)
3. After 16:00: big nap pill disappears automatically without dismiss
4. Record a sleep event starting at a time between 12:00–16:00 with duration >= 75 min (use the manual sleep entry form with custom times) → pill disappears + "🌙 שנת צהריים גדולה" badge appears on that event in the timeline tab
5. A shorter nap (e.g., 45 min) at noon does NOT get the badge and does NOT dismiss the pill

- [ ] **Step 7: Commit**
```bash
git add src/App.tsx
git commit -m "fix: update big nap threshold to 75 min, gate pill to 12:00-16:00, add noon nap badge in timeline"
```

---

## Out of Scope

- Editing or deleting SUPPLEMENT events (clicking a SUPPLEMENT row in the timeline opens the edit sheet; the edit form will show a fallback/empty state — acceptable for now)
- Configurable supplement names or multiple supplements per day
- Supplement history dashboard
- Syncing the big nap pill's manual ✕ dismiss between parents (the actual nap-recorded signal already syncs; manual snooze stays device-local)
