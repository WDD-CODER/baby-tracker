# PLAN: performance_optimization — v1

**Author:** Claude Code (Planner) · **Date:** 2026-07-05
**Executing agent:** Cursor (Contractor)
**Goal:** Reduce app load time and runtime cost. Two axes: (1) shrink what the browser downloads/parses on first paint, (2) stop the server from doing full-database scans on every request, (3) stop the client from re-rendering the whole app every second.

> **How to read this plan:** Each milestone is independent and ordered by *impact ÷ effort*. Do **one milestone, then stop and hand off** (per `baby-tracker-plan-workflow`). Every milestone has a **Why** (so you understand intent, not just the diff), **Files**, **Changes**, **Acceptance test**, and **Verify** command. Default verify is `npm run lint` (`tsc --noEmit`). Do **not** self-chain milestones.

---

## Background — where the time actually goes

Measured facts from the current code (2026-07-05):

| Symptom | Evidence | Cost |
|---|---|---|
| Entire app is one 6,365-line / 323 KB module | `src/App.tsx` | Whole app is downloaded + parsed before first paint; no lazy loading. |
| Server reads the **entire** events collection on almost every request | `server/db.ts:getAllEvents()` called by `/api/events`, all 4 `/api/stats/*`, `PUT /api/events/:id`, and `/api/export/xlsx` | Firestore bills per-doc read; latency grows linearly with event count. Opening the Stats screen = **4 full-collection scans** (one per stat endpoint). |
| `/api/events?limit=60` ignores the limit at the DB layer | `server.ts:273-295` reads all docs, then `.slice()` in memory | Pagination doesn't reduce DB work. |
| `PUT /api/events/:id` loads all events just to find one | `server.ts:335-339` | A full scan to edit one row. |
| `getOpenSleepSession()` reads every SLEEP event to find one open one | `server/db.ts:123-139` | Runs on every load + sleep toggle. |
| No gzip/brotli on the server | no `compression` in `server.ts` | The 323 KB JS ships uncompressed (~3–4× larger over the wire than needed). |
| No vendor chunk splitting | `vite.config.ts` has no `build.rollupOptions.manualChunks` | Every app edit busts the cache for React + `motion` too; nothing is cached across deploys. |
| Zero memoization across 85 `useState`, 43 `.map`, 21 `.filter`, 11 `.sort` | `grep`: `useMemo`=0, `useCallback`=0, `React.memo`=0 | Every state change re-runs all derived-list computation. |
| A 1-second `setInterval` and a 5-second `setInterval` re-render the **whole** monolith | `src/App.tsx:791` (1s sleep timer), `src/App.tsx:798` (5s clock) | The entire 6k-line tree reconciles every second while a sleep session is open. |
| `firebase` client SDK is a dependency but never imported | `grep "from 'firebase'" src/` → none | Dead dependency; slows `npm install` / deploys. (Not bundled, since unimported — so this is install hygiene, not runtime.) |

**Biggest wins first:** Milestones 1–3 (server) are low-risk and cut both latency and Firestore cost immediately. Milestones 4–5 (client) cut download/parse and re-render cost.

---

## Milestone 1 — Query only what you need (kill full-collection scans)

**Why:** Today every event-list load and every edit reads the *entire* Firestore events collection, then throws most of it away in JS. Firestore charges per document read and each read is a network round-trip, so this is the single largest and fastest-growing cost. We push filtering/pagination/lookup down into Firestore where it belongs.

**Files:** `server/db.ts`, `server.ts`

**Changes:**
1. In `server/db.ts`, add a paginated fetch that uses Firestore-native `limit` + cursor instead of reading everything:
   ```ts
   export async function getEventsPage(opts: { limit: number; cursorTimestamp?: string; type?: string }): Promise<{ events: BabyEvent[]; nextCursor: string | null }>
   ```
   - Build the query as `eventsCollection.orderBy('timestamp', 'desc')`.
   - If `opts.type` is set, add `.where('eventType', '==', opts.type)` **before** the `orderBy`.
   - If `opts.cursorTimestamp` is set, add `.startAfter(opts.cursorTimestamp)`.
   - Add `.limit(opts.limit + 1)` — fetch one extra row to know whether `nextCursor` exists (set `nextCursor` to the last kept event's `timestamp`, else `null`).
   - Still filter out soft-deleted docs (`isActiveEvent`) after the read. **Note:** because soft-deletes are filtered in JS, request `limit + a small buffer` (e.g. `limit + 5`) so a page isn't short after removing deleted rows. Keep it simple; exact pagination correctness is secondary to not scanning the whole collection.
   - Keep the existing `orderBy` fallback pattern (composite-index failure → unordered fetch) so a missing index doesn't 500.
2. In `server/db.ts`, add a direct single-doc lookup:
   ```ts
   export async function getEventById(id: string): Promise<BabyEvent | null>
   ```
   using `eventsCollection.doc(id).get()` (respect `isActiveEvent`).
3. In `server.ts` `GET /api/events` (currently lines ~273-295): replace `getAllEvents()` + `.slice()` with `getEventsPage(...)`. Keep the response shape identical: `{ events, nextCursor }`. The client sends `?limit=60` (see `src/App.tsx:1381`) and sometimes `?type=` — preserve both. `nextCursor` is now a **timestamp string**, not a numeric offset; that's fine because the client only checks truthiness for "load more" (confirm in `App.tsx` before changing — if the client does arithmetic on the cursor, keep an offset-compatible shape instead).
4. In `server.ts` `PUT /api/events/:id` (currently lines ~335-339): replace `getAllEvents().find(...)` with `getEventById(id)`.

**Composite index note:** `.where('eventType','==',x).orderBy('timestamp','desc')` may require a Firestore composite index. If the query throws a `FAILED_PRECONDITION`, the existing fallback path should catch it; **also** copy the index-creation URL from the server log into `bugs/bug_<id>.md` so a human can click it once. Do not block on this.

**Acceptance test:**
- App loads, event list shows the same newest-60 events as before.
- Editing an event (pencil → save) still persists.
- Filtering by type (if a type filter is exercised in the UI) returns only that type.
- No 500s in the server log during normal browsing.

**Verify:** `npm run lint`

---

## Milestone 2 — Cache reads within a request cycle (settings + stats)

**Why:** Opening the Stats screen fires 4 parallel requests (`src/App.tsx:1417-1422`), and **each** endpoint independently calls `getAllEvents()` — 4 full scans for one screen. `getSettings()` is likewise re-read on login, on every `/api/settings`, and inside the Excel export. A tiny in-memory TTL cache collapses these into one read and is invalidated on any write.

**Files:** `server/db.ts`

**Changes:**
1. Add a module-level cache in `server/db.ts`:
   ```ts
   let eventsCache: { data: BabyEvent[]; at: number } | null = null;
   const EVENTS_TTL_MS = 5000; // short — just collapses bursts like the 4 stats calls
   ```
2. Wrap the existing `getAllEvents()` body: if `eventsCache` is fresh (`Date.now() - at < EVENTS_TTL_MS`), return `eventsCache.data`; otherwise fetch, populate cache, return. (Keep the current ordered-then-fallback logic inside the miss path.)
3. **Invalidate** the cache (`eventsCache = null`) at the end of `saveEvent`, `deleteEvent`, and `clearAllEvents`. Writes must never serve stale data.
4. Do the same pattern for settings: cache the `getSettings()` result with a short TTL, invalidate in `saveSettings`.

**Why a 5 s TTL and not longer:** long enough to collapse the 4-way stats fan-out and the login→settings→events burst; short enough that a second parent's writes appear near-instantly. Because every mutation invalidates, staleness is bounded by concurrent-write timing only.

**Acceptance test:**
- Open Stats → charts render identical numbers to before.
- Log a new feed/sleep/diaper → it appears in the list and in Stats immediately (cache invalidated on write).
- No behavioural change, only fewer Firestore reads (optionally add a temporary `console.count('firestore:getAllEvents')` to confirm the 4 stats calls trigger 1 read, then remove it).

**Verify:** `npm run lint`

---

## Milestone 3 — Compress responses & cache static assets

**Why:** The 323 KB JS bundle currently ships uncompressed. gzip/brotli typically shrinks JS/CSS by 70–80%, so this is the cheapest single load-time win for real users on mobile networks. Vite emits content-hashed filenames, so hashed assets can be cached `immutable` forever without risking stale deploys.

**Files:** `server.ts`, `package.json`

**Changes:**
1. `npm i compression` and `npm i -D @types/compression`.
2. In `server.ts`, `import compression from 'compression'` and add `app.use(compression())` **near the top**, before routes and before the static handler (immediately after `const app = express()` / before `app.use(express.json())` is fine).
3. In the production static branch (`server.ts:940-944`), set long-lived immutable caching for hashed assets while keeping `index.html` uncached:
   ```ts
   app.use(express.static(distPath, {
     setHeaders: (res, filePath) => {
       if (filePath.endsWith('index.html')) {
         res.setHeader('Cache-Control', 'no-cache');
       } else {
         res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
       }
     },
   }));
   ```
   (`index.html` must stay fresh so new deploys are picked up; hashed JS/CSS/png are safe to pin.)

**Acceptance test:**
- `npm run build && npm run start`, load the app.
- DevTools → Network: JS/CSS responses have `content-encoding: gzip` (or `br`) and hashed assets show `cache-control: ...immutable`; `index.html` shows `no-cache`.
- App works identically.

**Verify:** `npm run lint`, then `npm run build` (must produce `dist/` with no errors).

---

## Milestone 4 — Split the bundle & drop dead weight

**Why:** Everything (Stats charts, Settings screens, all modals/sheets, Excel-export trigger) is in the initial download even though a parent opening the app just wants the log screen. Splitting vendor code and lazy-loading rarely-first-viewed screens cuts the critical-path JS. Also, the `firebase` client SDK is installed but never imported — remove it so installs/deploys are lighter.

**Files:** `vite.config.ts`, `package.json`, `src/App.tsx` (import-site only), possibly new small wrapper files under `src/`.

**Changes:**
1. **Vendor chunking** — in `vite.config.ts` add `build.rollupOptions.output.manualChunks`:
   ```ts
   build: {
     rollupOptions: {
       output: {
         manualChunks: {
           'react-vendor': ['react', 'react-dom'],
           'motion': ['motion'],
         },
       },
     },
   },
   ```
   This keeps React + `motion` in stable chunks that survive app edits, so returning users re-download only changed app code.
2. **Remove the unused client dep:** confirm again with `grep -rn "firebase" src/` (expect no client imports — `firebase-admin` lives only in `server/`), then `npm uninstall firebase`. **Do not** remove `firebase-admin`, `@google-cloud/firestore`, `exceljs`, or `@google/genai` without grepping first — `firebase-admin`/`@google-cloud/firestore` are used by `server/db.ts`, `exceljs` by the export route.
3. **Lazy-load heavy, non-initial screens.** The Stats view and the Settings sub-screens are not the first thing shown (default tab is `log`). Extract each into its own file (e.g. `src/screens/StatsScreen.tsx`, `src/screens/SettingsScreen.tsx`) and load with `React.lazy` + `<Suspense fallback={…}>`.
   - **This is the largest refactor in the plan.** If pulling screens out of the 6,365-line monolith is too risky to do safely in one pass under the 3-strike rule, **descope to just step 1 + 2** (vendor chunk + remove dead dep — both are safe and self-contained), file a `bugs/bug_<id>.md` describing the lazy-split follow-up, and hand off. Do not leave the app half-refactored.

**Acceptance test:**
- `npm run build` → `dist/assets/` now shows separate `react-vendor-*.js` and `motion-*.js` chunks, and (if step 3 done) a `StatsScreen-*.js` / `SettingsScreen-*.js` chunk.
- App loads to the log screen; switching to Stats/Settings still works (brief Suspense fallback is acceptable).
- No console errors; `firebase` removal doesn't break the build.

**Verify:** `npm run lint` **and** `npm run build`.

---

## Milestone 5 — Stop re-rendering the whole app every second

**Why:** While a sleep session is open, the 1-second timer (`src/App.tsx:791`) calls `setSleepDurationStr` every second, and the 5-second clock (`src/App.tsx:798`) calls `setCurrentTime` — each re-renders the entire 6,365-line component, re-running all 43 `.map` / 21 `.filter` / 11 `.sort` derived-list computations. Isolating the ticking values into tiny child components and memoizing derived lists makes ticks cost ~nothing.

**Files:** `src/App.tsx` (plus small new components if helpful)

**Changes:**
1. **Isolate the live clock/timer.** Move `sleepDurationStr` state + its `setInterval` into a small `<SleepTimer startAt={…} />` child that renders just the ticking string. Likewise, if `currentTime` is only used by a few widgets (awake-minutes, day-change check), push it into a small child (or a custom hook consumed by a small child) so the 5 s tick doesn't re-render the whole tree. Keep the day-change side-effect where it is if it must stay at the top level.
2. **Memoize derived lists.** Wrap the expensive `events.filter(...).sort(...)` derivations used in render (carousel lists, per-type lists) in `useMemo` keyed on `[events, …filters]`. Zero `useMemo` exist today; add them only where a non-trivial computation runs on every render.
3. **Don't flash the loading spinner on background refresh.** `fetchEvents()` sets `setLoading(true)` unconditionally (`src/App.tsx:1380`), so the `visibilitychange` refresh (`src/App.tsx:744-753`) blanks the screen. Add a `background` flag: `fetchEvents({ background: true })` from the visibility handler skips `setLoading(true)`.
4. **(Optional, only if safe)** `React.memo` the heaviest presentational subtrees and `useCallback` the handlers passed into them. Do this **last** and only where step 1–2 didn't already fix the jank — over-memoizing adds noise. If unsure, stop after 1–3 and note the rest in the handoff.

**Acceptance test:**
- Start a sleep session → the timer ticks every second, but React DevTools Profiler shows only the small timer component re-rendering, not the whole app.
- Switch away and back to the tab → data refreshes **without** a full-screen loading flash.
- All counters/charts still show correct values.

**Verify:** `npm run lint`

---

## Out of scope (note for the human, don't implement now)

- **Firestore composite indexes** may need one click in the console if Milestone 1's typed+ordered query demands one — the fallback keeps the app working meanwhile.
- **Service-worker precache size:** `vite-plugin-pwa` precaches all built assets; after Milestone 4's splitting, precache is naturally smaller. No action needed.
- **Server-side stats memoization with a longer TTL** could go further than Milestone 2, but risks cross-parent staleness; revisit only if Firestore cost is still high after M1–M2.

---

## Suggested order & expected payoff

| # | Milestone | Effort | Payoff |
|---|---|---|---|
| 1 | Query only what you need | M | ★★★ latency + Firestore cost, grows with data |
| 2 | Cache reads (settings + stats) | S | ★★★ 4 scans → 1 on Stats open |
| 3 | Compression + cache headers | S | ★★★ ~70–80% smaller JS/CSS transfer |
| 4 | Bundle split + drop dead dep | M–L | ★★ faster first paint, better cache reuse |
| 5 | Stop whole-app re-render | M | ★★ smoother runtime, battery on mobile |

Start with **Milestone 1**.
