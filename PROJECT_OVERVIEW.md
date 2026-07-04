# Baby Tracker (מעקב תינוק) — Project Overview

> A comprehensive technical and product reference for this repository. Written so it can be handed to any AI agent (or engineer) as complete context for a substantive discussion, code review, or feature-planning session.

---

## 1. Executive Summary

**Baby Tracker** (Hebrew name: **מעקב תינוק**) is a mobile-first, Hebrew/RTL Progressive Web App for logging and analyzing a newborn's care events — feeding, sleep, diapers, weight, pumping, and vomiting/spit-up. It is designed to be operated **one-handed, in the dark, by an exhausted parent**, and to produce a clean, bilingual (Hebrew/English) Excel report for pediatrician visits.

It supports **two parents sharing one household** (no multi-tenancy, no login) with per-action attribution (who logged what), a live sleep-timer state machine, and quick "one-tap" logging shortcuts for the most common actions.

- **Origin:** Built in Google AI Studio, intended for Cloud Run deployment.
- **Data store:** Firebase Firestore (single shared household document tree).
- **Frontend:** React 19, single-file component architecture (deliberate — see §9).
- **Backend:** Express (TypeScript), serving both the API and the Vite-built SPA.
- **Status:** Actively developed; most of a detailed PRD (v2.2) has been implemented across multiple "waves." See §8 for what's done vs. outstanding.

---

## 2. Purpose & Target User

- **Primary users:** Two co-parents of a newborn, tracking care events collaboratively from separate phones.
- **Design constraints driving every UI decision:**
  - One-handed operation (large tap targets, stepper buttons instead of typing numbers)
  - Usable at night (dark theme only, currently no light mode)
  - Fast entry over completeness (quick-log buttons that record with sane defaults in one tap, editable afterward)
  - Medical-grade data trustworthiness (accurate offered-vs-consumed tracking, timezone-correct daily summaries, exportable records for a doctor)
- **Language:** Hebrew is the *only* UI language, right-to-left throughout. All code, comments, and identifiers are in English — a deliberate split between user-facing and developer-facing language.

---

## 3. Technology Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend framework | React 19 | Single root component, no router |
| Language | TypeScript 5.8 | Strict types; `any` is disallowed by convention |
| Build tool | Vite 6 | Also used as Express dev-middleware (see §7) |
| Styling | Tailwind CSS v4 | **No `tailwind.config.js`** — all custom tokens live in `src/index.css` via the `@theme` directive (v4's CSS-first config model) |
| Animation | `motion` (the renamed `framer-motion`) | Imported as `motion/react`, never `framer-motion` |
| Icons | `lucide-react` | Named imports only; emoji are used only as decorative glyphs inside toasts/cards, never as interactive icons |
| Backend framework | Express 4 (TypeScript, run via `tsx`) | Single file: `server.ts` |
| Database | Firebase Firestore (`firebase` client SDK, not Admin SDK) | Accessed only through `server/db.ts` |
| Excel export | `exceljs` | Multi-sheet bilingual workbook generated server-side |
| PWA tooling | `vite-plugin-pwa` (Workbox under the hood) | Manifest + service worker + install prompt |
| AI SDK | `@google/genai` | **Installed but not yet wired into any feature** — dependency present, no Gemini calls exist in the codebase today |
| Package manager scripts | `npm run dev` / `build` / `start` / `lint` | `lint` = `tsc --noEmit` (there is no test framework — see §11) |

---

## 4. Architecture Overview

```
Browser (React SPA, RTL, dark theme)
        │  fetch('/api/...')
        ▼
Express server (server.ts)            ← all HTTP routes, one file
   - in dev: wraps Vite middleware (HMR, SPA serving)
   - in prod: serves the built dist/ bundle statically
        │  calls exported functions only
        ▼
Firestore data layer (server/db.ts)   ← the ONLY file allowed to touch Firestore
        │
        ▼
Firebase Firestore
   /households/shared-household                 (UserSettings document)
   /households/shared-household/events/{id}     (BabyEvent documents)
```

**Key architectural rules (intentional, not accidental):**

1. **Single shared household, no auth.** There is exactly one household (`householdId = 'shared-household'`, hardcoded). No login, no per-user data isolation. Both parents use the same data; they're distinguished only by an `activeParent` selector persisted in `localStorage`, not by authentication.
2. **Single-file frontend.** `src/App.tsx` (~5,500 lines) contains the entire UI — every tab, every bottom-sheet form, every dashboard, all state. There is no `components/` directory (aside from two small PWA-related exceptions, see below) and this is a **documented, deliberate convention**, not an oversight: "extend `App.tsx`, don't split into components, unless a plan explicitly calls for it."
   - Two small extracted units exist: `src/components/InstallAppButton.tsx` and `src/hooks/usePwaInstall.ts`, for the PWA install-prompt flow.
3. **Layering discipline.** `server/db.ts` = pure Firestore data access (no HTTP concerns). `server.ts` = pure HTTP routing (no direct Firestore calls). `src/types.ts` = the single source of truth for every data shape, imported by both frontend and backend.
4. **Timestamps are always UTC in storage, converted to `Asia/Jerusalem` for any display or grouping.** This is a recurring correctness concern in the codebase (see §10, known issues).

---

## 5. Data Model

All types are defined in `src/types.ts` and shared between client and server.

### Core enums
```typescript
type ParentType = 'PARENT_A' | 'PARENT_B';
type EventType  = 'NUTRITION' | 'DIAPER' | 'SLEEP' | 'ACTIVITY' | 'WEIGHT' | 'PUMPING' | 'VOMITING';
```

### Household settings (`UserSettings`, one document)
| Field | Type | Notes |
|---|---|---|
| `userId` | `string` | Always `'shared-household'` |
| `parentAName` / `parentBName` | `string` | Defaults: "אמא" (Mom) / "אבא" (Dad) |
| `defaultBottleType` | `'EXPRESSED_MILK' \| 'FORMULA'` | Pre-selected in the bottle form |
| `customActivities` | `string[]` | User-managed list for the "Activity" event type |
| `babyProfile?` | `{ name, dateOfBirth, birthWeightGrams }` | Optional; powers the Excel export header and age context |

### Universal event envelope (`BabyEvent`)
Every logged item is one document with a shared envelope plus exactly one populated payload matching `eventType`:
```typescript
interface BabyEvent {
  id: string;              // 'event_{timestamp}_{random}'
  timestamp: string;        // ISO 8601, UTC
  eventType: EventType;
  loggedBy: ParentType;     // who created the entry
  notes?: string;
  quickRecorded?: boolean;  // true if created via a one-tap quick-log shortcut
  nutrition?: NutritionPayload;
  diaper?: DiaperPayload;
  sleep?: SleepPayload;
  activity?: ActivityPayload;
  weight?: WeightPayload;
  pumping?: PumpingPayload;
  vomiting?: VomitingPayload;
}
```

### Payload shapes by event type

**Nutrition** (breastfeeding or bottle):
- `feedType`: `'BREAST' | 'BOTTLE'`
- Breast: `breastSide` (`LEFT`/`RIGHT`/`BOTH`), `durationMinutes`
- Bottle: `bottleLiquidType` (`EXPRESSED_MILK`/`FORMULA`), `amountOfferedMl`, `amountConsumedMl`
- `spitUp`: `'NONE' | 'LIGHT' | 'HEAVY_VOMIT'`
- `swallowingNoises?: boolean`
- `topUp?`: an optional supplemental bottle given after a breastfeed — `{ liquidType, consumedMl }`. Deliberately tracks **consumed**, not offered, because the clinical question is "how much extra did the baby actually take."

**Diaper:**
- `contains`: `'PEE' | 'POO' | 'BOTH'`
- `peeVolume?`: `'LIGHT' | 'HEAVY_SOAKED'`
- `pooAmount?`: `'SMALL' | 'MEDIUM' | 'LARGE_OVERFLOW'`
- `pooColor?`: `'YELLOW_MUSTARD' | 'GREEN' | 'BROWN'`
- `pooTexture?`: `'LIQUID' | 'SEEDY' | 'PASTY' | 'HARD'`

**Sleep** — see the state machine in §6:
- `startAt`, `endAt` (`null` while in progress)
- `startLocation`: `'CRIB' | 'HANDS' | 'CARRIER' | 'STROLLER'`
- `durationMinutes?` (computed on close)
- `loggedByStart?` / `loggedByEnd?`: cross-parent attribution — the parent who *started* vs. *ended* the session may differ (e.g., Mom puts baby down, Dad is the one there when baby wakes)

**Activity:** `activityName` (free text drawn from `customActivities`), optional `cryingIntensity` (1–10)

**Weight:** `weightGrams`, optional `percentile`

**Pumping:** `leftAmountMl`, `rightAmountMl`

**Vomiting:** `size`: `'SMALL' | 'MEDIUM' | 'LARGE'`

### Firestore layout
```
/households/{householdId}                    → UserSettings
/households/{householdId}/events/{eventId}    → BabyEvent
```
Only one household ID is ever used in practice (`shared-household`).

---

## 6. Core Features (Functional Detail)

### 6.1 Logging (five original event types, now seven)
Each event type has a dedicated bottom-sheet form plus, for the highest-frequency actions, a **quick-log** one-tap alternative that records sane defaults immediately (marked `quickRecorded: true`) and can be edited afterward. Quick-log actions include a **10-second duplicate-tap guard** — if the same event type was just logged, a repeat tap is silently discarded with a toast explaining why, to protect against accidental double-submission from a sleep-deprived parent.

### 6.2 Sleep state machine
Sleep is not a simple log entry — it is a **toggle-based session**:
- `POST /api/sleep/toggle` checks whether an open session exists (`sleep.endAt === null`).
  - If none exists: opens a new session, recording `startLocation` and `loggedByStart`.
  - If one exists: closes it, computing `durationMinutes` (minimum 1 minute) and recording `loggedByEnd`.
- Only one open session can exist at a time — enforced server-side.
- A **live timer** on the Log tab shows elapsed sleep time while a session is open.
- Closing a session triggers a **sleep-quality classification** (`getSleepCycleAnalysis` in `App.tsx`) that buckets the nap by duration into `BAD` (<30 min), `GOOD` (30–45 min), or `EXCELLENT` (>45 min), each with its own color, icon, and toast copy — the beginning of a broader "semantic quality tier" visual language that the product spec calls for across all event types (see §8, partially implemented).
- Cross-parent attribution: if Mom starts the session and Dad ends it, both names are recorded and can be displayed distinctly, rather than the event only reflecting whoever happened to close it.

### 6.3 Breastfeeding top-up tracking
A breastfeed can have a supplemental bottle ("top-up") attached, recorded separately with its own liquid type and consumed volume. This is called out in the product notes as core to a specific clinical question the app was built to answer: after nursing, does the baby still need supplemental milk, and how much.

### 6.4 Dual-parent household model
- No authentication. Two named parents (`PARENT_A` / `PARENT_B`, customizable display names) share one dataset.
- An `activeParent` selector persists in `localStorage` per device, so each parent's phone "remembers" who is currently logging.
- Every event records `loggedBy`; sleep additionally records start/end attribution independently.

### 6.5 Timeline
A reverse-chronological list of all events with inline edit and delete. Tapping any card opens the same bottom-sheet form pre-filled for editing.

### 6.6 Log tab / "Now" view
A quick-action button grid plus a swipeable carousel of the most recent events (tapping one jumps straight to editing it) plus a same-day nutrition summary (offered / consumed / delta with a progress bar).

### 6.7 Dashboards
Aggregated views per category — nutrition, sleep, diapers, weight, pumping, vomiting/spit-up — each with a 7/14/30-day range toggle. Currently rendered as CSS-based bar/summary visuals (not a charting library); genuinely interactive charts (24-hour sleep bands, a diaper calendar heat-map, a weight trend line) are an identified but not-yet-built enhancement.

### 6.8 Pediatrician Excel export
`GET /api/export/xlsx?from=&to=` streams a `.xlsx` workbook (via `exceljs`) with **seven sheets**, each with bilingual Hebrew/English headers and right-to-left sheet views:
1. **Summary** — one row per day: offered/consumed ml, delta, consumption %, feed count, total sleep, pee/poo counts, latest weight — with conditional red highlighting when consumption falls below 75%.
2. **Feeds** — every nutrition event with type, ml offered/consumed, spit-up, breast side, duration, logger, notes.
3. **Sleep** — every session with start/end time, duration (minutes and hours), location, logger.
4. **Diapers** — contents, pee volume, poo amount/color/texture, logger.
5. **Weight** — grams, kilograms, percentile.
6. **Pumping** — left/right/total ml.
7. **Vomiting** — size classification.

The export UI includes a date-range picker with quick presets, exposed from the Settings tab.

### 6.9 Settings
Parent display names, default bottle liquid type, custom activity list (add/remove), baby profile (name, date of birth, birth weight), data reset/clear utilities, and the PWA install card.

### 6.10 Progressive Web App (installable, offline shell)
Contrary to the historical gap-analysis notes retained in `plans/` (written mid-project and now partially stale — see §8), the PWA has since been implemented:
- `vite-plugin-pwa` generates a manifest (`Baby Tracker` / `BabyTracker`, RTL, Hebrew, standalone display, portrait orientation) and a Workbox-based service worker that pre-caches the app shell and caches Google Fonts.
- A dedicated hook (`usePwaInstall`) wraps the `beforeinstallprompt` / `appinstalled` browser events; a dedicated component (`InstallAppButton`) surfaces install state and a one-tap install button in Settings.
- `index.html` includes Apple PWA meta tags (status bar style, apple-touch-icon, standalone capable) for iOS home-screen installs.
- Data itself remains **online-only** — offline support covers the app shell (so it *opens* offline), not the underlying Firestore data.

### 6.11 Toast notification system
A single, consistent toast mechanism (`showToast`) is used for all user feedback — success, error, duplicate-submission guards, sleep-quality summaries. `alert()` is never used.

---

## 7. API Reference

Base URL in development: `http://localhost:3000`. All routes are defined in `server.ts`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/settings` | Fetch household settings |
| `PUT` | `/api/settings` | Partially update settings (merge semantics) |
| `GET` | `/api/sleep/open` | Get the current open sleep session, or `null` |
| `POST` | `/api/sleep/toggle` | Open a new sleep session or close the existing one (state machine) |
| `GET` | `/api/events` | List events; supports `?limit=&cursor=&type=` |
| `POST` | `/api/events` | Create an event (auto-generates `id`/`timestamp` if absent; auto-closes any conflicting open sleep session) |
| `PUT` | `/api/events/:id` | Update an event (merge); recomputes sleep duration if applicable |
| `DELETE` | `/api/events/:id` | Delete an event by id |
| `POST` | `/api/events/clear` | Bulk-delete all events, or all events before a given date |
| `GET` | `/api/stats/nutrition` | Daily aggregation: offered/consumed/delta/feed counts, `?from=&to=` (default last 30 days) |
| `GET` | `/api/stats/sleep` | Daily aggregation: total minutes, session count, per-session detail |
| `GET` | `/api/stats/diapers` | Daily aggregation: pee/poo/both counts, distinct colors/textures seen |
| `GET` | `/api/stats/weight` | Chronological list of weight readings |
| `GET` | `/api/export/xlsx` | Streams the multi-sheet Excel report, `?from=&to=` |

All dates/times returned for display purposes are computed with `Intl.DateTimeFormat` pinned to `Asia/Jerusalem`, regardless of where the server itself runs.

---

## 8. Current Development Status

The project has a written PRD (v2.2) and a formal gap analysis (`plans/prd-gap-analysis.md`) comparing the originally-specified Angular/MongoDB design intent against this React/Firestore implementation. **The stack divergence (Angular→React, MongoDB→Firestore) was an explicit, accepted decision** — the gap analysis translates PRD intent onto the actual stack rather than treating it as a deviation to fix.

The gap analysis and its associated execution plan (`plans/wave1_data_model_v1.md`) are **historical planning artifacts from 2026-06-30**; cross-referencing them against the current code shows **most of "Wave 1" and several later-wave items are now implemented**, meaning those documents are partially stale as a status source. Current source-of-truth was established directly from the code for this document. As of now:

### Implemented
- All seven event types, including the two added after the original five (Pumping, Vomiting)
- Sleep state machine with live timer, location tracking, and now cross-parent start/end attribution
- Breastfeeding top-up bottle tracking
- Baby profile (name, DOB, birth weight) in Settings, feeding the Excel export header
- Full CRUD on events via bottom-sheet forms
- Quick-log one-tap shortcuts with duplicate-submission guarding
- Dual-parent switching persisted per device
- Dashboards for all six loggable categories with 7/14/30-day range filters
- Excel export with a date-range picker and presets, seven bilingual sheets
- Custom activity management
- A partial semantic quality-tier system (implemented for sleep: BAD/GOOD/EXCELLENT with color + icon + toast; not yet generalized to nutrition/diaper/weight as the original design spec calls for)
- Full PWA support: manifest, service worker, installable, iOS-compatible meta tags, install-prompt UI
- Hebrew RTL UI throughout, Israel-timezone-aware display formatting on the server

### Explicitly not yet implemented
- **Gemini AI features** — `@google/genai` is a dependency with zero integration; there is no AI-assisted feature in the app today (worth clarifying intent with the user/stakeholder if this is on the roadmap)
- **A generalized semantic icon/quality-tier system** across nutrition, diaper, and weight events (only sleep has it so far)
- **Interactive charting** — dashboards are CSS-based summaries, not a charting library (no sleep 24-hour band view, no diaper calendar heat-map, no weight trend line)
- **Undo-last-action toast** after logging
- **Explicit delete confirmation / soft-delete** — deletes appear to fire immediately with no "are you sure" step and no recoverability window
- **Poll-on-focus for the shared sleep session** — if one parent's phone is backgrounded while the other closes the sleep session, the backgrounded phone won't necessarily refresh automatically
- **Multiple babies / baby-switching** — single baby profile, hardcoded single household
- **Growth-curve overlay** (WHO/CDC percentile charts) — only a raw percentile number field exists
- **Light theme** — dark theme only
- **Automated tests** — there is no test framework in this repository; verification is manual + `tsc --noEmit`

---

## 9. Notable Conventions & Constraints (useful for any code discussion)

- **`src/App.tsx` stays a single file by design.** Any proposal to split it into components should be treated as a deliberate architectural change to discuss, not a default refactor.
- **No `tailwind.config.js`.** All design tokens go into `src/index.css`'s `@theme` block (Tailwind v4's CSS-first configuration).
- **`motion/react`, not `framer-motion`.** The package was renamed upstream; imports must use the new path.
- **Lucide React only** for interactive icons; a couple of custom inline SVGs exist for icons Lucide doesn't cover (e.g., the diaper icon), and emoji are reserved for decorative use inside toasts/labels.
- **No `any` types** anywhere in the TypeScript codebase, by convention.
- **No new state-management, HTTP, or routing libraries** without explicit approval — no Redux/Zustand, no axios/react-query, no react-router, no chart library, no lodash/moment. Native `fetch` and React state cover everything today.
- **All Firestore access goes through `server/db.ts`.** Neither `server.ts` nor any frontend code may call Firestore directly.
- **Timestamps:** always store as UTC ISO 8601 strings; always display via `Asia/Jerusalem`-timezone formatting. A historically documented bug class in this codebase is exactly this rule being violated in ad-hoc "today" comparisons on the client (using `toISOString().split('T')[0]` instead of a Jerusalem-local date) — worth checking for if doing any date-bucketing work.
- **Hebrew is the only UI language**; code, comments, and identifiers are English. Any new user-facing string must be Hebrew.

---

## 10. Known Issues, Risks & Security Considerations

These are worth surfacing explicitly in any technical discussion, since they represent real product risk if the app scales beyond its current "trusted couple, single household" scope:

1. **Firestore security rules are fully open**: `firestore.rules` currently reads `allow read, write: if true;` for the entire household and event tree. There is no authentication layer at all. This is acceptable only because the app currently has no login concept and is not intended for public/multi-household use — but it means anyone who obtains the client Firebase config could read or write this household's data. This has been flagged internally as something to lock down "before production" / before adding any real auth.
2. **No authentication whatsoever.** "Which parent is active" is a client-side, unauthenticated `localStorage` preference — it identifies who *claims* to be logging, not who actually is. This is fine for a trusted two-person household, but would need a real auth layer before broader use.
3. **Single hardcoded household ID** (`shared-household`) — the architecture does not support multiple families/households; this would require a real user/household model to extend.
4. **`getOpenSleepSession` does a full collection scan** of all SLEEP events, filtering in memory rather than using a compound Firestore query/index. This is a known performance concern that will degrade as event volume grows.
5. **Destructive operations lack confirmation.** Deleting an event, and the "clear all data" utility in Settings, do not appear to have a confirmation step or soft-delete/undo path — a mis-tap can permanently destroy medical tracking data.
6. **The Firebase web API key present in `firebase-applet-config.json`** is a client-side identifier (normal for Firebase web apps — it's not a secret in the traditional sense, since access control is meant to be enforced by Firestore rules, not by hiding the key). However, combined with point 1 (open rules), this means the *de facto* protection for this data today is closer to "security by obscurity of the config file" than genuine access control. If this repository or its deployed bundle becomes more widely reachable, tightening `firestore.rules` becomes the priority, independent of the API key's visibility.
7. **PWA claims offline capability for the app shell only** — Firestore reads/writes still require connectivity; there is no offline queue/sync layer, so logging an event while offline will fail rather than queue.

---

## 11. Development & Testing Workflow

- **No automated test suite.** Correctness is verified manually plus TypeScript's `tsc --noEmit` (`npm run lint`).
- **Manual verification golden path** (used historically, still the right way to sanity-check a change): start the dev server, open at mobile width, log a bottle feed, verify it in the carousel and Timeline, start/stop a sleep session and confirm the timer and duration, check the Dashboards reflect the new events, edit and delete an event, and finally confirm both `npm run lint` and `npm run build` succeed.
- **Multi-agent development history:** this repository was developed using a structured "Contractor / Reviewer / Human" workflow (a coding agent executing scoped, single-milestone plans; a separate reviewing agent validating without silently fixing; a human approving each step). Artifacts of that process remain in the repo: `plans/` (immutable, versioned implementation plans), `sessions/` (dated handoff/execution logs), and `_shared/agent-guide.md` (a detailed internal contributor guide covering file layout, coding conventions, and a decision tree for adding new features — recommended reading before making non-trivial changes).

---

## 12. Deployment

- Built for **Google AI Studio → Cloud Run** deployment (`metadata.json` declares the `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` capability, consistent with the installed-but-unused `@google/genai` dependency).
- `npm run build` produces a Vite client bundle plus an esbuild-bundled CommonJS server (`dist/server.cjs`); `npm start` runs that bundle in production mode, serving the built SPA statically instead of via Vite middleware.
- Environment variables (`GEMINI_API_KEY`, `APP_URL`) are injected by the AI Studio/Cloud Run environment at runtime per `.env.example`; there is no local secrets file checked into the repo (`.env*` and `firebase-applet-config.json` are both gitignored).

---

## 13. Suggested Discussion Angles

If you're bringing this document into a conversation with another AI agent, some natural threads to pursue:

- **Security hardening**: designing real Firestore rules and a minimal auth model without breaking the "no-login, two-trusted-parents" UX that the product deliberately optimizes for.
- **Generalizing the semantic quality-tier system** (currently only on sleep) to nutrition, diapers, and weight, per the original design intent.
- **Whether to build interactive charts** (sleep bands, diaper calendar, weight trend) and with what library, given the project's explicit "no chart.js/recharts" constraint historically — that constraint may be worth revisiting.
- **What, if anything, to build with the already-installed Gemini SDK** — the dependency exists with zero usage today; worth deciding if AI features (e.g., natural-language logging, pattern insights, pediatrician-visit summaries) are in scope.
- **Undo/soft-delete and destructive-action confirmation**, given this is medical tracking data with no current recovery path.
- **Multi-baby / multi-household support**, which would be a genuine architectural change (today's single hardcoded household ID is load-bearing throughout the server layer).
