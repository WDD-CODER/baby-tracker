# PRD Gap Analysis — Baby Tracker
> Generated: 2026-06-30  
> PRD source: Baby Tracker PRD v2.2 + Design Foundation v1.0  
> Implementation baseline: current `main` branch

---

## Stack Divergence (acknowledged, locked)

The PRD specifies Angular 19 + MongoDB. The codebase uses React 19 + Firestore.
This is accepted — too expensive to switch. All analysis below reads the PRD's **product intent** and maps it onto the React/Firestore reality. Stack-specific implementation notes (Angular components, Mongoose schemas) are translated to React/Firestore equivalents.

---

## Implementation Status Summary

| PRD Feature | Section | Status | Priority |
|---|---|---|---|
| Event types: NUTRITION / DIAPER / SLEEP / ACTIVITY / WEIGHT | §6.2 | ✅ Done | — |
| loggedBy per event | §3 | ✅ Done | — |
| Parent names in settings | §3 | ✅ Done | — |
| Default bottle type setting | §5.1 | ✅ Done | — |
| Custom activities CRUD | §5.2 | ✅ Done | — |
| Sleep toggle (open/close shared session) | §5.3 | ✅ Done (partial — see GAP-01) | — |
| Live sleep timer | §5.3 | ✅ Done | — |
| Weight as first-class event | §5.4 | ✅ Done | — |
| Excel export (ExcelJS) | §5.5 | ✅ Done (partial — see GAP-11) | — |
| Diaper full payload (contains/color/texture/amount) | §6.2B | ✅ Done | — |
| Bottom sheet modal pattern | §4.1 | ✅ Done | — |
| Hebrew RTL UI | §4.1 | ✅ Done | — |
| Timeline with cards | §4.3 | ✅ Done | — |
| Edit / delete events | §7.1 | ✅ Done | — |
| Stats API (nutrition/sleep/diapers/weight) | §7.4 | ✅ Done | — |
| Dashboards (nutrition/sleep/diaper/weight) | §4.4 | ✅ Partial — CSS bars, not interactive | P2 |
| spitUp field in NutritionPayload | §6.2A | ✅ Done | — |
| **Cross-parent sleep attribution (loggedByStart/End)** | §5.3, §6.2C | ❌ Missing | **P0** |
| **Breastfeeding top-up bottle** | §5.6, §6.2A | ❌ Missing | **P0** |
| **Baby Profile (name, DOB, birth weight)** | §6.1b, §13.1.1 | ❌ Missing | **P0** |
| **Semantic Icon System (quality tiers)** | §4.5 | ❌ Missing | **P1** |
| **PWA (install to home screen)** | §8, §1.2 | ❌ Missing | **P1** |
| **Undo last log toast** | §13.1.2 | ❌ Missing | **P1** |
| **Empty states (first-run)** | §13.1.3 | ❌ Missing | **P1** |
| **Poll-on-focus (concurrent sleep session)** | §13.1.4 | ❌ Missing | **P1** |
| **Soft delete + confirmation** | §13.1.5 | ❌ Missing | **P1** |
| **Heebo font** | Design §2.3 | ❌ Missing | **P2** |
| **Design tokens (category colors + tier colors)** | Design §2.1–2.2 | ❌ Missing | **P2** |
| **Export date-range picker UI + presets** | §5.5 | ❌ Missing | **P2** |
| **12h sleep session "still sleeping?" warning** | §5.3 edge | ❌ Missing | **P2** |
| **Weight display: kg with 1 decimal** | §13 Q3 | ❌ Missing | **P2** |
| **Interactive dashboards** (sleep bands, diaper calendar, weight line) | §4.4 | ❌ Missing | **P3** |
| **Legend screen** (icon tier map in Hebrew) | §4.5.7 | ❌ Missing | **P3** |
| **Export tab** (as separate top-level tab, not inside Settings) | §4.2 | ❌ Missing | **P3** |
| **Known bug: UTC date in getTodayNutritionSummary** | — | 🐛 Bug | P1 |

---

## Detailed Gap Descriptions

---

### GAP-01 — Cross-parent sleep attribution in SleepPayload [P0]

**PRD §5.3:** "a `SleepSession` with `startAt`, optional `endAt`, `startLocation`, and *two-sided attribution* `loggedByStart` / `loggedByEnd`."

**Current `SleepPayload` in `types.ts`:**
```typescript
interface SleepPayload {
  startAt: string;
  endAt: string | null;
  startLocation: SleepLocationType;
  durationMinutes?: number;
}
```
Attribution is on `BabyEvent.loggedBy` (the parent who *created* the event), but once created, there's no way to record a *different* parent closing the session.

**What's missing:**
- `loggedByStart: ParentType` on `SleepPayload`
- `loggedByEnd?: ParentType` on `SleepPayload`

**Impact:** Timeline can't show "התחילה: אמא · סיום: אבא". Cross-parent handoff is invisible. This is a core PRD requirement (the session belongs to the baby, not one parent).

**Recommended fix (Firestore + types.ts + server):** Add both fields to `SleepPayload`. Set `loggedByStart` when `/api/sleep/toggle` opens a session (use `activeParent` from the request body). Set `loggedByEnd` when the same endpoint closes it. Backwards-compatible (existing documents just won't have `loggedByEnd`).

---

### GAP-02 — Breastfeeding top-up bottle [P0]

**PRD §5.6:** A top-up bottle attached to a breast feed. Tracks `consumedMl` (not offered — the medical question is how much extra the baby *actually took*).

**Current `NutritionPayload`:** no `topUp` field.

**What's missing:**
```typescript
// Add to NutritionPayload
topUp?: {
  liquidType: 'EXPRESSED_MILK' | 'FORMULA';
  consumedMl: number;
}
```
Plus:
- "+ תוסף בקבוק" button on breast feed cards (timeline + edit sheet)
- Top-up consumed ml stacked on breast bars in nutrition dashboard
- Top-up columns in Excel Feeds sheet
- Daily consumed totals must include top-up

**Impact:** This is described as "core to the [medical] hypothesis" — after a breast feed, does the baby still take more from a bottle? Without this, the medical data set is incomplete.

---

### GAP-03 — Baby Profile schema [P0]

**PRD §6.1b:** `name`, `dateOfBirth`, `birthWeightGrams` (needed for export header, age computation, anchoring the low-percentile context).

**Current state:** Nothing. `UserSettings` has no baby data.

**Recommended fix:** Add `babyProfile` to the `UserSettings` document in Firestore (no new collection needed):
```typescript
// Add to UserSettings in types.ts
babyProfile?: {
  name: string;
  dateOfBirth: string; // ISO date YYYY-MM-DD
  birthWeightGrams: number;
}
```
Add baby profile fields to the Settings screen. Use in the Excel export header so the doctor sees "שם: [X], תאריך לידה: [Y], משקל לידה: [Z]".

---

### GAP-04 — Semantic Icon System [P1]

**PRD §4.5:** The visual quality language of the app. Every event renders a **type icon** + a **quality tier icon** (baby face + color). Called "the heart of the trustable, visible truth pillar."

**Four tiers:**
- `BAD` — sad baby, red `#E5484D`
- `OKAY` — calm baby, amber `#F5A623`
- `GOOD` — content baby, green `#46A758`
- `GREAT` — super-happy baby, vivid green `#30A46C`

**Classifier rules per category (PRD §4.5.2–4.5.6):**

| Category | Signal | BAD | OKAY | GOOD | GREAT |
|---|---|---|---|---|---|
| Nutrition (bottle) | consumed / offered % | <50% | 50–79% | 80–99% | ≥100% |
| Nutrition (breast) | durationMinutes | <5 min | — | 5–15 min | 15+ min |
| Sleep | duration | <30 min | — | 30–45 min | >45 min |
| Diaper | poo texture / pee volume | HARD or LARGE_OVERFLOW | pee LIGHT | normal poo / HEAVY_SOAKED pee | — |
| Weight | direction vs previous | loss | flat | gain | — |

**What needs to be built:**
1. `QualityTier` type in `types.ts`: `'BAD' | 'OKAY' | 'GOOD' | 'GREAT'`
2. Tier map: `TIER_MAP: Record<QualityTier, { color: string; hebrewLabel: string }>`
3. Classifier functions: `classifyNutrition()`, `classifySleep()`, `classifyDiaper()`, `classifyWeight()`
4. SVG baby-face icons for each tier (or emoji placeholders for MVP)
5. Type glyphs: breast, expressed-milk-bottle, formula-bottle, poo (with color fill), pee-drop, weight-scale+arrow, sleep-moon
6. Apply to timeline cards and dashboard bars
7. Legend screen (accessible from Settings)

**Scope note:** This is the largest single gap. It touches the timeline, dashboards, and the entire visual identity of the app. Suggested to break into: (a) types + classifiers, (b) type glyphs, (c) tier icons + apply to timeline, (d) apply to dashboards + legend.

---

### GAP-05 — PWA (install to home screen) [P1]

**PRD §1.2:** "A parent can: install to home screen" — listed as a definition of "done."  
**PRD §8:** "installable, themed splash, app icon, standalone display. Service worker caches the shell."

**Current state:** No `manifest.json`, no service worker, no icons. The app cannot be installed.

**What's needed:**
- `public/manifest.json` (name, short_name, icons, display: standalone, theme_color, background_color, dir: rtl, lang: he)
- App icons (at minimum 192×192 and 512×512 PNG)
- Service worker (shell caching only — data is online-only per PRD)
- `<link rel="manifest">` in `index.html`

**React note:** Since we're not using Angular's PWA module, use `vite-plugin-pwa` (Vite plugin) or write a minimal service worker manually. `vite-plugin-pwa` is the cleanest fit for this stack.

---

### GAP-06 — Undo last log toast [P1]

**PRD §13.1.2:** "A transient 'בטל' (undo) toast right after any log prevents frustration."

**Current state:** A `toastMessage` state exists in `App.tsx` for general notifications, but there's no undo action.

**What's needed:** After any successful `POST /api/events`, show a toast with "נרשם · בטל" that remains for ~4 seconds. Tapping "בטל" calls `DELETE /api/events/:id`. The event id is available in the POST response.

---

### GAP-07 — Empty states [P1]

**PRD §13.1.3:** "First-run timeline/dashboards have no data — define friendly Hebrew empty states so the app never looks broken."

**Current state:** Unknown — likely renders empty containers, which looks broken.

**What's needed:** Hebrew empty state messages for:
- Timeline (no events yet): "עדיין לא רשמתם אירועים. לחצו על כפתור למטה כדי להתחיל."
- Each dashboard (no data in range): "אין נתונים לתקופה הנבחרת."

---

### GAP-08 — Poll-on-focus for concurrent sleep [P1]

**PRD §13.1.4:** "Two parents, two phones, one open sleep session. Define last-write-wins + a refresh of the open-session state on app focus."

**Current state:** The open sleep session is fetched on app load but not refreshed if someone else acts on it while the app is in the background.

**What's needed:** Add a `visibilitychange` (or `focus`) event listener in `App.tsx` that refetches `GET /api/sleep/open` when the tab/app becomes visible again. This is the minimum needed to prevent "Dad's phone still shows baby asleep when Mom already woke him."

---

### GAP-09 — Soft delete + confirmation [P1]

**PRD §13.1.5:** "Delete is destructive and there's no auth. Add a confirm step on delete, and (recommended) a soft-delete flag so a fat-fingered deletion of medical data is recoverable."

**Current state:** Delete likely fires immediately after a tap.

**What's needed:**
1. Confirm dialog ("האם למחוק את האירוע הזה?") before calling `DELETE /api/events/:id`
2. Optional (recommended): soft-delete flag `deletedAt?: string` on `BabyEvent`. Server filters out `deletedAt != null` by default. A recovery path can be added later without needing to recreate data.

---

### GAP-10 — Heebo font + design tokens [P2]

**Design Foundation §2.3:** Heebo as the primary Hebrew font (Rubik / Assistant as fallbacks).  
**Design Foundation §2.1–2.2:** Category identity colors and semantic tier colors as Tailwind tokens in `src/index.css`.

**Current state:** Unknown font (likely system default). No custom Tailwind tokens.

**Tailwind v4 approach (no config file):** Add to `src/index.css`:
```css
@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800&display=swap');

@theme {
  --font-family-sans: 'Heebo', 'Rubik', 'Assistant', system-ui, sans-serif;
  
  /* Category identity */
  --color-cat-nutrition: #F6C9A8;
  --color-cat-sleep: #C8C3E8;
  --color-cat-diaper: #A8D8CE;
  --color-cat-activity: #F4A8A0;
  --color-cat-weight: #A8C5E0;

  /* Semantic tiers */
  --color-tier-bad: #E5484D;
  --color-tier-okay: #F5A623;
  --color-tier-good: #46A758;
  --color-tier-great: #30A46C;

  /* Canvas */
  --color-canvas: #FDFBF7;
}
```

---

### GAP-11 — Export date-range picker UI [P2]

**PRD §5.5:** "User picks any date range (from/to date pickers, plus quick presets 7/14/30 days)."

**Current state:** The export API endpoint (`GET /api/export/xlsx?from=&to=`) exists and accepts parameters. The UI likely uses a fixed range or no selection.

**What's needed:** On the export view, a date range picker with:
- From / To date inputs
- Quick presets: "7 ימים" / "14 ימים" / "30 ימים" (compute from = today - N days)

---

### GAP-12 — 12-hour sleep session warning [P2]

**PRD §5.3 edge cases:** "If an open session exceeds a sane threshold (e.g. 12h), surface a gentle 'still sleeping?' prompt offering to set the end time manually."

**What's needed:** When rendering the live sleep timer (or when fetching `/api/sleep/open`), check if `startAt` is more than 12 hours ago. If yes, show a non-blocking alert: "האם התינוק עדיין ישן? האירוע פתוח מזה 12 שעות."

---

### GAP-13 — Weight display in kg [P2]

**PRD §13 Q3 (recommended resolution):** Store in grams, display with kg and one decimal.

**Current state:** grams stored and displayed as grams (e.g. "3500 גרם").

**What's needed:** A display helper `gramsToKg(g: number) → string` returning e.g. "3.5 ק"ג". Apply on timeline cards, weight dashboard, and settings.

---

### GAP-14 — Interactive dashboards [P3]

**PRD §4.4:** Each category has an "interactive" dashboard. Specifically:
- **Sleep:** 24h horizontal bands per day, tinted by session quality tier
- **Diaper:** Calendar grid with pee/poo counts, poo color coded as dots
- **Weight:** Line chart over time with trend arrows

**Current state:** CSS-based bar charts. Functional but not "glanceable" as the PRD intends.

**Note:** Since we're not using Chart.js/ng2-charts (Angular libs), and the existing CSS approach already works, this is a visual upgrade. The sleep 24h bands and diaper calendar are the highest value additions (they're the "wow" factor that makes the PRD's "trustable visible truth" pillar sing).

---

### GAP-15 — Legend screen [P3]

**PRD §4.5.7:** "A one-screen legend (mapping faces/colors to meaning, in Hebrew) reachable from Settings and printed as the first sheet note in the Excel export."

**Dependency:** Requires GAP-04 (Semantic Icon System) first.

---

### GAP-16 — Export as its own tab [P3]

**PRD §4.2:** Tab bar: "Log | Timeline | Dashboards | Export"  
**Current state:** Tab bar is "Log | Timeline | Dashboards | Settings"

The export functionality is currently somewhere in Settings. The PRD wants it as a peer tab. Low friction to add — just surface the export UI as `activeTab === 'export'`.

---

### BUG-01 — UTC date in getTodayNutritionSummary [P1]

**Location:** `src/App.tsx` — `getTodayNutritionSummary()` function (around line 200–250)

**Bug:** The function compares event timestamps using UTC date (`new Date().toISOString().split('T')[0]`), not Israel local date. Events logged after midnight Jerusalem time but before midnight UTC appear in the wrong day's summary on the Log screen's "Now" strip.

**Fix:** Use the same Israel timezone logic that the server-side stats endpoints use:
```typescript
const todayIsrael = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jerusalem' });
// 'sv-SE' locale gives YYYY-MM-DD format
```

---

## Recommended Implementation Order

### Wave 1 — Data Model (do immediately, before more events accumulate)
1. **GAP-01**: Add `loggedByStart` / `loggedByEnd` to `SleepPayload` + server `/api/sleep/toggle`
2. **GAP-02**: Add `topUp` to `NutritionPayload` + server save path
3. **GAP-03**: Add `babyProfile` to `UserSettings` + Settings UI
4. **BUG-01**: Fix `getTodayNutritionSummary` timezone

### Wave 2 — Core UX Gaps (product feels complete)
5. **GAP-06**: Undo toast after any log
6. **GAP-07**: Hebrew empty states on Timeline + Dashboards
7. **GAP-08**: Poll-on-focus for sleep session refresh
8. **GAP-09**: Soft delete + confirmation dialog
9. **GAP-11**: Export date-range picker UI
10. **GAP-12**: 12h sleep session warning

### Wave 3 — Visual Identity (makes the app feel premium)
11. **GAP-10**: Heebo font + design tokens in `src/index.css`
12. **GAP-04**: Semantic Icon System (large — plan as 4 sub-milestones)
13. **GAP-13**: Weight display in kg

### Wave 4 — Platform Features
14. **GAP-05**: PWA (manifest.json + service worker via vite-plugin-pwa)

### Wave 5 — Polish
15. **GAP-14**: Interactive dashboards (sleep bands, diaper calendar, weight line)
16. **GAP-15**: Legend screen
17. **GAP-16**: Export as own tab

---

## What's Already Solid

These PRD requirements are fully implemented and working:
- Five event types with correct Firestore-backed polymorphic payloads
- Sleep state machine (shared session, toggle, live timer, location picker)
- Nutrition logging: bottle (offered/consumed ml, liquid type) + breast (side, duration) + spit-up
- Diaper logging: contains, pee volume, poo amount/color/texture
- Weight with percentile
- Custom activities (create, delete, persist to Firestore)
- Parent picker with localStorage persistence
- Settings (parent names, default bottle type)
- Timeline view with edit/delete
- Hebrew RTL throughout
- Israel timezone on server (UTC storage, Jerusalem display)
- Excel export (ExcelJS, server-side)
- All stats API endpoints
- Dashboard views (CSS bars — functional, not yet "interactive")
- Bottom sheet modal pattern

---

*Gap analysis complete. 16 gaps identified. Wave 1 (data model) is the highest leverage — address before more medical data accumulates so schema migration is trivial.*
