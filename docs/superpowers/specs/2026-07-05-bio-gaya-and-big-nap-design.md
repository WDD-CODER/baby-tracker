# Design: Bio Gaya Supplement Reminder + Big Nap Warning Fixes

**Date:** 2026-07-05  
**Status:** Approved  
**Approach:** A — New SUPPLEMENT event type, sync via Firestore events

---

## 1. Schema Changes (`src/types.ts`)

Add `'SUPPLEMENT'` to the `EventType` union:

```ts
export type EventType = 'NUTRITION' | 'DIAPER' | 'SLEEP' | 'ACTIVITY' | 'WEIGHT' | 'PUMPING' | 'VOMITING' | 'SUPPLEMENT';
```

Add `SupplementPayload` interface and `supplement?` field to `BabyEvent`:

```ts
export interface SupplementPayload {
  name: string; // e.g. "ביו גאיה"
}

// on BabyEvent:
supplement?: SupplementPayload;
```

No server changes required — `/api/events` already stores arbitrary `BabyEvent` payloads and Firestore is schemaless.

---

## 2. Bio Gaya Floating Notice

### Visibility logic

- Show when: `isSupplementSlotTime() && !bioGayaGivenToday`
- `isSupplementSlotTime()`: hour >= 6 && hour < 22
- `bioGayaGivenToday`: derived from today's events — `events.some(e => e.eventType === 'SUPPLEMENT' && isToday(e.timestamp))`
- No localStorage. Sync between parents is automatic via Firestore event list.

### UI

- Position: **bottom-left** (opposite the big nap pill at bottom-right)
- Color: emerald/teal gradient (`from-emerald-600 to-teal-600`)
- Icon: 💧
- Label: `"ביו גאיה — טרם ניתן"`
- Action button: green `"✓ נתתי"` button on the pill

### On tap "נתתי":

1. POST `/api/events` with:
   ```json
   {
     "eventType": "SUPPLEMENT",
     "loggedBy": "<activeParent>",
     "supplement": { "name": "ביו גאיה" }
   }
   ```
2. Show toast: `"ביו גאיה נרשם ✔️"`
3. Pill disappears for both parents (derived from updated event list)

### No manual dismiss button

The only way to hide the notice is to log it. It auto-disappears at 22:00.

### Main log & Timeline rendering

SUPPLEMENT events appear in both the main log and the timeline tab with:
- Icon: 💧
- Title: `"ביו גאיה"`
- Border: emerald (`border-r-emerald-500`)
- Background: `bg-emerald-950/15`
- Detail line: `"נרשם ע״י <parentName>"`

---

## 3. Big Nap Warning — Fixes

### Threshold change (`isBigNapRecorded`)

| | Before | After |
|---|---|---|
| Time window | 11:00–16:00 | **12:00–16:00** |
| Duration threshold | ≥ 45 min | **≥ 75 min (1h 15m)** |

Regular naps outside the noon window keep their existing classification (≥ 30 min = good).

### Floating pill time gate

Add `isNapSlotTime()` to the floating pill condition:

```
!isBigNapRecorded() && !dismissedBigNapWarning && isNapSlotTime()
```

- Pill never shows before 12:00
- Pill auto-disappears after 16:00 (no dismiss needed — time condition fails)
- Manual ✕ dismiss (localStorage) stays for mid-window snooze

### Timescale badge

In the timeline, the **first** sleep event of the current day that qualifies as a big noon nap (started 12:00–16:00, `durationMinutes >= 75`) gets a badge rendered below the event title:

```
🌙 שנת צהריים גדולה
```

Computed purely from event data — no new fields on `BabyEvent`, no API change.

---

## 4. Files Changed

| File | Change |
|---|---|
| `src/types.ts` | Add `SUPPLEMENT` to EventType, add `SupplementPayload`, add `supplement?` to `BabyEvent` |
| `src/App.tsx` | Add `bioGayaGivenToday` derived state, `isSupplementSlotTime()`, Bio Gaya pill UI, SUPPLEMENT event creation, SUPPLEMENT rendering in log + timeline, update `isBigNapRecorded()` thresholds, add `isNapSlotTime()` to big nap pill condition, add timescale badge |

---

## 5. Out of Scope

- Configurable supplement names (hardcoded "ביו גאיה" for now)
- Multiple supplements per day
- Supplement history dashboard
- Syncing manual big-nap pill dismissal between parents (the nap-recorded signal already syncs)
