# AI Agent Guidebook — Baby Tracker

**Read this before touching a single file.**
This document tells AI agents exactly how the project works, where everything lives, and what rules to follow. Violating any rule in here breaks the team's trust model.

---

## 1. Who Does What

This project runs a **Manual Bridge Workflow (Stage 0)**:

| Agent | Role | Primary Files |
|-------|------|---------------|
| **Cursor** (Contractor) | Executes milestones. Writes code. One milestone at a time. | `src/`, `server/`, `server.ts` |
| **Claude Code** (Reviewer/DevOps) | Reviews Cursor's output. Validates milestones. Files bugs. Does NOT silently fix code. | `sessions/`, `bugs/`, `plans/` |
| **Human** | Approves milestones. Unblocks agents. Makes stack decisions. | Everything |

**Never skip the human approval step between milestones.**

---

## 2. Project Overview

**מעקב תינוק (Baby Tracker)** is a Hebrew-first, RTL medical-grade baby tracking app for Israeli parents. Built for Google AI Studio (Cloud Run deployment). Used one-handed, on mobile, in the dark by exhausted parents.

Core capabilities:
- Log feedings (breast + bottle), sleep, diapers, activities, weight
- Dual-parent household (PARENT_A / PARENT_B)
- Sleep state machine (toggle awake/asleep with live timer)
- Dashboard analytics (nutrition, sleep, diapers, weight) with date range filters
- Excel export for pediatrician visits (bilingual HE/EN headers)
- Custom activities management

**Language:** Hebrew UI throughout. All user-facing strings are Hebrew. All code and comments are in English.

---

## 3. Project Structure

```
baby-tracker/
├── src/
│   ├── App.tsx        ← ENTIRE frontend. One file. ~2000 lines. No components dir.
│   ├── types.ts       ← ALL shared TypeScript types. Source of truth for data shape.
│   ├── main.tsx       ← React entry point. Mounts <App /> into #root.
│   └── index.css      ← Global CSS + Tailwind v4 @theme blocks
├── server/
│   └── db.ts          ← Firestore data layer. All DB operations live here.
├── server.ts          ← Express server. All API routes live here. Also boots Vite dev middleware.
├── index.html         ← SPA shell. Vite entry point.
├── vite.config.ts     ← Vite config (React plugin + Tailwind v4 plugin)
├── tsconfig.json      ← TypeScript config
├── package.json       ← Dependencies + scripts
├── firestore.rules    ← Firestore security rules
├── firebase-blueprint.json ← Firestore schema documentation (not used at runtime)
├── firebase-applet-config.json ← LOCAL ONLY. Never commit. Firestore credentials.
├── metadata.json      ← Google AI Studio metadata (capabilities declaration)
├── .env               ← LOCAL ONLY. Never commit. Env vars.
├── .env.example       ← Template for env vars. Safe to commit.
├── _shared/
│   ├── tech-stack.md  ← Authoritative tech stack reference (THIS IS THE TRUTH)
│   └── agent-guide.md ← This file
├── plans/             ← Implementation plans (empty at Stage 0 start)
├── bugs/              ← Bug reports filed by Claude Code (Reviewer)
├── sessions/          ← Handoff summaries written after each Cursor session
└── .cursorrules       ← Cursor-specific operating rules
```

**Single-component architecture warning:** `src/App.tsx` is ~2000 lines with NO sub-components. All state, logic, and JSX live in one `App()` function. When adding new UI, extend `App.tsx`. Do not create a `components/` directory unless a plan explicitly calls for it.

---

## 4. Data Architecture

### Types (src/types.ts — source of truth)

```typescript
// The five event types
type EventType = 'NUTRITION' | 'DIAPER' | 'SLEEP' | 'ACTIVITY' | 'WEIGHT';
type ParentType = 'PARENT_A' | 'PARENT_B';

// Every event has this base shape
interface BabyEvent {
  id: string;          // format: 'event_{Date.now()}_{randomStr}'
  timestamp: string;   // ISO 8601 string — always UTC
  eventType: EventType;
  loggedBy: ParentType;
  notes?: string;
  nutrition?: NutritionPayload;
  diaper?: DiaperPayload;
  sleep?: SleepPayload;
  activity?: ActivityPayload;
  weight?: WeightPayload;
}

// The only household document
interface UserSettings {
  userId: string;               // always 'shared-household' — hardcoded
  parentAName: string;          // default 'אמא'
  parentBName: string;          // default 'אבא'
  defaultBottleType: 'EXPRESSED_MILK' | 'FORMULA';
  customActivities: string[];   // list of activity names
}
```

### Firestore Structure

```
/households/shared-household               ← UserSettings doc (no multi-tenancy)
/households/shared-household/events/{id}   ← BabyEvent docs
```

There is exactly ONE household. `householdId = 'shared-household'` is hardcoded in `server/db.ts:41`. No authentication. No multi-user isolation.

### Timestamp Convention

- All timestamps stored as ISO 8601 strings (e.g., `2026-06-30T14:30:00.000Z`)
- Always UTC in storage. Display timezone is Israel (`Asia/Jerusalem`)
- Use `new Date().toISOString()` for current time
- The server uses `Intl.DateTimeFormat` with `timeZone: 'Asia/Jerusalem'` for display

### Sleep State Machine

Sleep is special — it has two phases:
1. **Open session:** `sleep.endAt === null` (in progress, timer running)
2. **Closed session:** `sleep.endAt` is an ISO string, `sleep.durationMinutes` is set

Only ONE open sleep session can exist at a time. `POST /api/sleep/toggle` enforces this: if an open session exists, it closes it; otherwise it opens a new one.

---

## 5. API Reference

All routes are in `server.ts`. Base URL: `http://localhost:3000` in dev.

### Settings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/settings` | Fetch UserSettings |
| `PUT` | `/api/settings` | Update UserSettings (partial merge) |

### Events

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/events` | List events. Query: `?limit=N&cursor=offset&type=EVENTTYPE` |
| `POST` | `/api/events` | Create event. Body: `Partial<BabyEvent>` |
| `PUT` | `/api/events/:id` | Update event. Body: `Partial<BabyEvent>` |
| `DELETE` | `/api/events/:id` | Delete event by ID |

### Sleep State Machine

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/sleep/open` | Get current open sleep session (or `null`) |
| `POST` | `/api/sleep/toggle` | Toggle sleep. Body: `{ loggedBy, startLocation, customStartAt? }` |

### Stats / Dashboards

All stat endpoints accept `?from=ISO&to=ISO` query params (default: last 30 days).

| Method | Path | Returns |
|--------|------|---------|
| `GET` | `/api/stats/nutrition` | Daily nutrition aggregation (offered/consumed/feeds) |
| `GET` | `/api/stats/sleep` | Daily sleep aggregation (totalMinutes/sessionCount/sessions) |
| `GET` | `/api/stats/diapers` | Daily diaper aggregation (pee/poo/both/pooColors) |
| `GET` | `/api/stats/weight` | Chronological weight readings |

### Export

| Method | Path | Returns |
|--------|------|---------|
| `GET` | `/api/export/xlsx` | Binary `.xlsx` download. Query: `?from=DATE&to=DATE` |

---

## 6. UI Architecture

### Navigation

4-tab bottom navigation (rendered at end of `App.tsx`):

| Tab | `activeTab` value | Content |
|-----|----------|---------|
| 🏠 Log | `'log'` | Quick action buttons + carousel + daily nutrition summary |
| 📋 Timeline | `'timeline'` | Vertical list of recent events (latest first) |
| 📊 Dashboards | `'dashboards'` | Stat sections (7/14/30 day range toggle) |
| ⚙️ Settings | `'settings'` | Export + parent names + custom activities |

### Modal Pattern (Bottom Sheets)

All data entry uses a bottom sheet modal. State: `activeSheet: 'bottle' | 'diaper' | 'sleep' | 'activity' | 'weight' | 'edit' | null`.

Opening a sheet:
```typescript
openAddSheet('bottle')   // opens nutrition form (new event)
openEditSheet(event)     // opens edit form for existing event
```

The bottom sheet renders conditionally based on `activeSheet`. Each form section is `{activeSheet === 'xxx' && (<div>...)}`.

**Sleep sheet special case:** When starting sleep, `'sleep'` sheet shows location picker only. Submit calls `handleSleepToggle(selectedLocation)` — NOT `handleCreateEvent`. The sleep sheet bypasses the normal form submission flow.

### State Management

**All state lives in the `App()` function.** No external state library. Key state groups:

```typescript
// Navigation
activeTab: 'log' | 'timeline' | 'dashboards' | 'settings'
activeSheet: 'bottle' | 'diaper' | 'sleep' | 'activity' | 'weight' | 'edit' | null

// Data
events: BabyEvent[]          // last 60 events, fetched on mount
settings: UserSettings
openSleepSession: BabyEvent | null

// Parent
activeParent: ParentType     // persisted to localStorage('bt_active_parent')

// Form inputs (one set for all forms — reset on openAddSheet/openEditSheet)
bottleFeedType, bottleLiquidType, amountOfferedMl, amountConsumedMl...
diaperContains, peeVolume, pooAmount, pooColor, pooTexture...
activityName, cryingIntensity...
weightGrams, percentile...
noteText, customTimestamp, showNoteField...

// UI state
loading, submitting, toastMessage, sleepDurationStr...
carouselIndex (carousel position in 'log' tab)
```

### Toast Notifications

```typescript
showToast('Any message')  // Shows animated toast for 3.5 seconds, auto-dismisses
```

All user feedback goes through `showToast`. Never use `alert()`.

### Carousel (Log Tab)

The log tab shows recent events in a swipeable carousel. `carouselIndex = 0` is always the newest event. Clicking an event opens its edit sheet.

---

## 7. Coding Conventions

### TypeScript

- **Strict types always.** Never use `any` unless forced (see: `activeSheet = 'sleep' as any` — this is a known pattern, not an example to follow).
- Import types alongside values: `import { BabyEvent, UserSettings } from './types'`
- All types live in `src/types.ts`. Add new types there, nowhere else.
- The `firebase-blueprint.json` documents Firestore entity shapes but is NOT used at runtime.

### Tailwind CSS v4

- No `tailwind.config.js`. Do not create one.
- Custom classes go in `src/index.css` using `@theme` directive.
- Color naming convention: `slate-850`, `slate-950` are custom colors defined in `index.css`.
- Class composition: always use template literals for conditional classes, not `classnames` library.
- Example of existing pattern:
  ```tsx
  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
    activeParent === 'PARENT_A'
      ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 shadow-lg'
      : 'bg-slate-800 text-slate-400 border border-slate-700/60'
  }`}
  ```

### API Calls

All API calls use native `fetch()`. No axios, no react-query. Pattern:
```typescript
const res = await fetch('/api/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
if (res.ok) {
  // success
  showToast('נשמר בהצלחה');
} else {
  showToast('תקלה בשמירה');
}
```

Always use relative paths (`/api/...`), never hardcode `localhost:3000`.

### Component Style

No class components. Functional components with hooks only. Every event handler is `async` when it touches the API. Pattern for API handlers:
```typescript
const handleSomething = async () => {
  setSubmitting(true);
  try {
    // ... fetch
  } catch (e) {
    showToast('שגיאה');
  } finally {
    setSubmitting(false);
  }
};
```

### Icons

Only Lucide React icons. Import individually:
```typescript
import { Moon, Trash2, Plus } from 'lucide-react';
```
Never use emoji as icons for interactive UI elements — only Lucide components.

### Motion/Animation

Use `motion` and `AnimatePresence` from `motion/react`:
```typescript
import { motion, AnimatePresence } from 'motion/react';
```
Do NOT import from `framer-motion` — it's been renamed.

---

## 8. Hebrew & RTL Conventions

- **All user-facing strings are in Hebrew.** English only in code, comments, and console logs.
- The root `<div>` has `dir="rtl"` — this propagates to all children. Do not set `dir` on individual elements unless overriding.
- Tailwind RTL: use `text-right` not `text-left` for default alignment. Logical properties (`ltr:`, `rtl:`) are available in v4.
- Hebrew time formatting: use `he-IL` locale with `toLocaleTimeString`.
- Israeli timezone: always use `'Asia/Jerusalem'` for display. `Intl.DateTimeFormat` with this timezone is in `server.ts:toIsraelLocalDateStr()` and `toIsraelLocalTimeStr()`.
- The app uses Hebrew typography conventions: `״` (U+05F4) for abbreviations (מ״ל, ק״ג, ש״), `׳` (U+05F3) for single quotes.

### Common Hebrew Strings Reference

| English | Hebrew (UI) |
|---------|------------|
| Saved successfully | נשמר בהצלחה |
| Error saving | תקלה בשמירה |
| Loading... | טוען... |
| Delete | מחק |
| Cancel | ביטול |
| Save | שמור |
| Edit | ערוך |
| Refresh | רענן |
| Notes | הערה |
| Parent A / Mom | אמא |
| Parent B / Dad | אבא |
| Expressed milk | חלב אם שאוב |
| Formula | תמ״ל (פורמולה) |
| Breast (side) | הנקה |
| Offered | הוצע |
| Consumed | נצרך |
| ml | מ״ל |
| kg | ק״ג |
| grams | גרם |
| minutes | דקות |
| hours | שעות |

---

## 9. Database Layer Rules (server/db.ts)

- All Firestore operations are `async/await`. Always `try/catch`.
- `getAllEvents()` always fetches ordered by `timestamp desc`. Has fallback if index missing.
- `saveEvent()` uses `set()` with full document (upsert semantics, not `update()`).
- `getOpenSleepSession()` filters in-memory after fetching all SLEEP events (no compound index needed).
- The `householdDoc` reference (`households/shared-household`) is module-level — not recreated per call.
- Firestore is initialized from `firebase-applet-config.json` if present, otherwise falls back to Application Default Credentials (ADC). In development, set up ADC via `gcloud auth application-default login`.

**Never query Firestore directly from `server.ts`** — go through `server/db.ts` functions.

---

## 10. Server Rules (server.ts)

- All API routes are in `server.ts` at the root level.
- Route sections are labeled with `// ====` comments. Follow this sectioning.
- Port is hardcoded to `3000`. Do not change.
- In dev mode: Vite middleware handles the SPA. In production: `dist/` static files.
- ID generation: `'event_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9)` — no UUID library needed.
- Sleep duration is always `Math.max(1, Math.round(...))` — minimum 1 minute.
- The server handles timezone conversion for dates via `toIsraelLocalDateStr()` and `toIsraelLocalTimeStr()` helpers at the top of the file.

---

## 11. What Is and Isn't Implemented

### Implemented (working)

- [x] 5 event types: NUTRITION (bottle + breast), DIAPER, SLEEP (state machine), ACTIVITY, WEIGHT
- [x] Sleep toggle with live timer, location selection, custom start time
- [x] Carousel timeline on log tab
- [x] Full CRUD for events (create/edit/delete via bottom sheets)
- [x] Dual-parent switching with localStorage persistence
- [x] Dashboard stats: nutrition, sleep, diapers, weight (pure CSS bar charts)
- [x] 7/14/30 day range filter on dashboards
- [x] Excel export with 5 bilingual sheets (Summary, Feeds, Sleep, Diapers, Weight)
- [x] Custom activities (add/delete via Settings tab)
- [x] Parent names + default bottle type settings
- [x] Daily nutrition summary on log tab (offered/consumed/delta + progress bar)
- [x] Toast notifications
- [x] Full RTL Hebrew UI
- [x] Israeli timezone display
- [x] Vertical timeline tab
- [x] Edit notes and custom timestamp on all events

### Not Yet Implemented (known gaps)

- [ ] **Gemini AI integration** — `@google/genai` is installed but no AI features are wired to UI
- [ ] **PWA** — no service worker, no `manifest.json`, no offline support
- [ ] **Real charts** — dashboards use CSS bars only, no recharts/chart.js
- [ ] **Push notifications** — no notification system
- [ ] **Multiple babies** — hardcoded to single household, no baby profile switching
- [ ] **Growth curve** — weight percentile display exists but no WHO/CDC growth chart overlay
- [ ] **Feeding reminders** — no reminder/alert system
- [ ] **Infinite scroll** — timeline loads last 60 events; no pagination UI
- [ ] **Data export to PDF** — Excel only; no PDF
- [ ] **Dark/light theme toggle** — dark only (bg-slate-950)

---

## 12. Known Bugs / Quirks

1. **Sleep type assertion:** `openAddSheet('sleep' as any)` — the `activeSheet` TypeScript type doesn't include `'sleep'` but the JSX handles it. Low priority but technically a type gap.

2. **Daily nutrition uses UTC date not Israel date** — `getTodayNutritionSummary()` in `App.tsx` compares `e.timestamp.split('T')[0]` against `new Date().toISOString().split('T')[0]`, which is UTC. Events after midnight Israel time but before midnight UTC will appear in the wrong day on the dashboard. The stats API endpoints correctly use Israel timezone. **Fix:** use Israel timezone in the client-side `getTodayNutritionSummary()` function.

3. **`consumed` can exceed `offered`** — the `+10` button for `amountConsumedMl` calls `Math.min(amountOfferedMl, prev + 10)` which correctly caps it, but the other consumed buttons (`+5`) also cap correctly. However, if the user changes `amountOfferedMl` downward after setting `amountConsumedMl`, consumed can exceed offered without auto-correction. Low priority.

4. **Firestore `getOpenSleepSession` does a full collection scan** — fetches ALL SLEEP events then filters in memory. Will be slow with large datasets. Filed for future optimization.

---

## 13. Workflow Rules (Mandatory)

From `.cursorrules` and `CLAUDE.md`:

### Cursor (Contractor)
- **ONE milestone per session.** Stop after completing it. Do not self-chain to the next.
- **3-strike rule:** Max 3 attempts to fix a failing compile/test error. After 3 failures, revert and file a bug to `bugs/`.
- **Never hardcode secrets.** Use `.env` file only. Never commit `.env`.
- **Session handoff:** Write summary to `sessions/YYYY-MM-DD.md` at end of each session.
- **Stack authority:** Check `_shared/tech-stack.md` before any tech decision. Do not invent stack.

### Claude Code (Reviewer)
- **Never silently fix code.** Surface issues and recommend. Let Cursor/human apply the fix.
- **Validate milestones** against acceptance criteria before marking complete.
- **Check for secrets leakage** and scope creep in every review.
- **Write bug reports** to `bugs/YYYY-MM-DD-{slug}.md` for actionable issues found.
- **Append review findings** to `sessions/YYYY-MM-DD.md`.

### Both Agents
- Do not use `recall` or AgentMemory — not wired in Stage 0.
- Tech stack reference is `_shared/tech-stack.md`. This is the law.

---

## 14. Adding New Features — Decision Tree

**Before writing any code, answer these:**

1. **Where does it live?**
   - New event type? Add to `EventType` union in `src/types.ts`, add payload interface, add handler in `server.ts` events CRUD, add form section in `App.tsx` bottom sheet, add rendering in carousel + timeline.
   - New API endpoint? Add route in `server.ts` with section comment `// ====`. Add DB function in `server/db.ts` if it needs Firestore.
   - New UI section? Extend the relevant tab's `{activeTab === '...' && (...)}` block in `App.tsx`.
   - New settings field? Add to `UserSettings` interface in `src/types.ts`, update `DEFAULT_SETTINGS` in `server/db.ts`, add form field in the Settings tab.

2. **Does it need a new dependency?**
   - Check `_shared/tech-stack.md` first. If not listed, the human must approve before adding.
   - Do not install: Redux, Zustand, axios, react-query, react-router, chart.js, recharts, moment, lodash — unless a plan explicitly calls for one of these.

3. **Hebrew strings?**
   - Every user-facing string must be in Hebrew. Add to the reference table in section 8 if it's reusable.

4. **Does it touch Firestore?**
   - All Firestore logic goes in `server/db.ts`. No direct Firestore calls from `server.ts` or `src/`.

5. **Does it need a new type?**
   - ALL new interfaces and types go in `src/types.ts`. Not inline in `App.tsx` or `server.ts`.

---

## 15. File Edit Rules

- **`src/types.ts`** — change types here first, then update all consumers.
- **`server/db.ts`** — pure data layer. No HTTP logic (req/res) here.
- **`server.ts`** — pure HTTP layer. No Firestore calls directly. Use `server/db.ts` exports.
- **`src/App.tsx`** — all frontend. Do not split into components unless a plan explicitly calls for it.
- **`_shared/tech-stack.md`** — update when any stack decision is made or reversed.
- **`firestore.rules`** — security rules. Currently open (allow all). Lock down before production.

---

## 16. Testing Protocol (Manual — No Test Framework)

No automated tests exist. Manual verification procedure for any change:

1. `npm run dev` — server starts on port 3000
2. Open `http://localhost:3000` in mobile-width browser (375px)
3. Test the golden path:
   - Add a bottle feeding (120ml offered, 110ml consumed)
   - Check it appears in carousel
   - Switch to Timeline tab, verify it shows
   - Add a sleep start (location: CRIB)
   - Verify sleep timer starts on the Sleep button
   - Wake up (toggle again)
   - Go to Dashboards → verify today shows up in nutrition + sleep
   - Edit the bottle feeding from carousel
   - Delete the sleep event from timeline
4. `npm run lint` — must pass with zero errors
5. `npm run build` — must complete without errors
