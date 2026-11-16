# PLAN: tasting_integration — v1

**Status:** draft — waiting for Human approval of Milestone 1
**Branch / worktree:** `feat/tasting-integration` in `C:\coding projects\Cursor\baby-tracker-tasting`
**Source:** `WDD-CODER/baby-tasting` branch `orch/night-1` (briefs 1–8 built; PR WDD-CODER/baby-tasting#3)

## Goal

Baby Tasting (food-tasting calendar with allergen tracking) becomes a section of Baby Tracker: one app, one login,
one Firestore database, one Render service. Parents open it from Tracker as `טעימות` and land on the tasting calendar.

## Decisions (Human, 2026-11-16)

| # | Decision |
|---|---|
| T1 | **Mount as a section.** The Tasting Angular app is kept as is and served by Tracker's Express under `/tasting/`. Its API is mounted under `/api/v1/tasting/`. No React rewrite in v1. |
| T2 | **Firestore, not MongoDB.** Tasting's repositories get Firestore implementations; Tracker's database is the only database. Tasting's domain rules (`server/domain/`, pure functions) are reused unchanged. |
| T3 | **Tracker's login is the only login.** Tasting's username-only sign-in, its `sessions` collection and `APP_USERS` are dropped. One adapter middleware maps `req.session.parentType` to Tasting's `req.user` and `req.householdId`. |
| T4 | **Work happens in a separate worktree** (`baby-tracker-tasting`), opened as a PR; the `baby-tasting` repo stays untouched for ongoing validation. |

## Proposed defaults (Human may change before Milestone 1)

- **D1 One baby profile.** Tasting reads the baby's name and birth date from Tracker's `settings.babyProfile` (`dateOfBirth`) instead of its own `babies` collection; the Tasting first-run screen is removed and points to Tracker's settings when no profile exists.
- **D2 Firestore layout.** Everything under `households/shared-household/`: subcollections `tastingAllergens`, `tastingFoods`, `tastingCalendarItems`, `tastingSettings` (one doc), `tastingReactions`, `tastingLocks`, `tastingUserPrefs`. `babyId` = the constant `shared-baby` (Tracker has one baby).
- **D3 Code location.** `tasting/` at the Tracker root holds the Angular workspace (its own `package.json`, built with pnpm or npm — see M4) and `tasting/server/` the Express modules (plain JavaScript ESM, bundled by Tracker's esbuild step).
- **D4 Users in the activity log.** Tasting shows `parentAName` / `parentBName` from Tracker settings instead of usernames.
- **D5 After the merge** new Tasting work happens in Tracker; `baby-tasting` is frozen (archived) once this PR is merged.

## Milestones

### Milestone 1 — Bring Tasting into the repo unchanged
**Files:** `tasting/**` (new), `.gitignore`
1. Copy the Angular workspace and `server/` from `baby-tasting@orch/night-1` (record the commit SHA in `tasting/SOURCE.md`) into `tasting/`, without the kit files (`.claude/`, `scripts/`, `docs/agent/`, `plans/`, `.husky/`).
2. `tasting/` builds and its tests pass standalone (`npm --prefix tasting run build`, `node --test tasting/server/domain`).
**Acceptance:** Tracker's `npm run build` and `npm run lint` are unchanged and pass; `tasting/` builds on its own.

### Milestone 2 — Firestore repositories
**Files:** `tasting/server/repositories/firestore/**` (new), `tasting/server/repositories/memory/**` (new), `tasting/server/app.js`, tests
1. One Firestore implementation per Tasting repository (same method names and return shapes as the Mongo ones), on the layout of D2. Queries stay simple (filter by date range or `foodId` only); anything else filters in memory.
2. An in-memory implementation of the same interface for tests (Tracker has no emulator setup); Tasting's route tests run on it.
3. `createTastingRouter({ repos, photoStore, babyProfile })` replaces `createApp` (no `listen`, no static, no own auth routes).
**Acceptance:** `node --test tasting/server` passes on the in-memory repositories; a dry Firestore smoke script (Human runs it with the dev credentials) lists and writes one food.

### Milestone 3 — Mount the API behind Tracker's login
**Files:** `server.ts`, `server/tasting-mount.ts` (new)
1. `server/tasting-mount.ts`: the auth adapter (`parentType` → `req.user = { username: parentName }`, `req.householdId = 'shared-household'`), the baby-profile reader (D1), and `app.use('/api/v1/tasting', adapter, tastingRouter)` after Tracker's `/api` gate.
2. `GET /api/v1/tasting/auth/me` answers from the adapter so the Angular app knows who is signed in.
**Acceptance:** signed in to Tracker, `GET /api/v1/tasting/foods` returns the seeded catalog; signed out, 401.

### Milestone 4 — Serve the Tasting UI under /tasting/
**Files:** `tasting/angular.json`, `tasting/src/**` (API base, login redirect, removed first-run/login pages), `package.json` (build), `vite.config.ts` only if the PWA service worker must ignore `/tasting/`, `server.ts` (static)
1. Angular built with `--base-href /tasting/`; API base `/api/v1/tasting`; a 401 sends the browser to Tracker's root (`/`) to sign in; Tasting's sign-out removed (Tracker's is the one).
2. Tracker's `build` script also builds Tasting into `dist/tasting/`; `server.ts` serves `dist/tasting` at `/tasting` with an `index.html` fallback; the PWA service worker does not cache-hijack `/tasting/*`.
3. Render build command stays one command (`npm install --include=dev && npm run build`), installing Tasting's packages inside `build`.
**Acceptance:** `npm run build && npm start`, sign in at `/`, open `/tasting/` → the tasting calendar; reload on `/tasting/foods` works.

### Milestone 5 — Entry point and look
**Files:** `src/App.tsx` (one nav entry / quick action), `src/index.css` only if a token is missing
1. A `טעימות` entry in Tracker's navigation that opens `/tasting/`, and a back link in Tasting's top bar to `/`.
2. Check both look like one app (same dark slate, Heebo, indigo accent).
**Acceptance (Human):** on the phone, Tracker → `טעימות` → add a food → back to Tracker, without signing in twice.

## Out of scope (v1)

Rewriting Tasting screens in React; moving Tracker off Firestore; migrating data (Tasting has no production data yet);
showing tasting data inside Tracker's timeline.

## Risks

- Firestore query limits: range + `foodId` queries need composite indexes; v1 avoids them by filtering in memory (data is small: one baby).
- Two front-end stacks in one repo (React + Angular): bigger install and build time on Render free tier.
- Tracker's PWA service worker may serve Tracker's `index.html` for `/tasting/*` navigations until excluded (M4).
