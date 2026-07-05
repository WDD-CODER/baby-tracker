# מעקב תינוק — Baby Tracker

Hebrew-first RTL baby tracker for Israeli parents. Log feeding, sleep, diapers, weight, and daily routines; sync data between two parents via Firestore; view dashboards, timeline, and quick-action pills.

**Last updated:** 2026-07-05

## Stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS v4, PWA
- **Backend:** Express (single service — API + static assets in production)
- **Data:** Google Cloud Firestore (Admin SDK on server)
- **Auth:** Session-based login for Parent A / Parent B

## Prerequisites

- Node.js 20+
- Firebase Admin service account JSON (local dev)
- Bcrypt password hashes for both parent accounts

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment template and fill in values:

   ```bash
   cp .env.example .env
   ```

   Required in `.env`:

   | Variable | Purpose |
   |----------|---------|
   | `FIREBASE_ADMIN_CREDENTIALS_PATH` | Path to Firebase Admin JSON (e.g. `./firebase-admin-config.json`) |
   | `FIRESTORE_DATABASE_ID` | Firestore database ID |
   | `SESSION_SECRET` | Random secret for express-session |
   | `PARENT_A_USERNAME` / `PARENT_A_PASSWORD_HASH` | Parent A login |
   | `PARENT_B_USERNAME` / `PARENT_B_PASSWORD_HASH` | Parent B login |

   Generate a bcrypt hash:

   ```bash
   node -e "import('bcryptjs').then(b => b.hash('yourpassword', 10).then(console.log))"
   ```

3. Place your Firebase Admin key at the path set in `FIREBASE_ADMIN_CREDENTIALS_PATH` (gitignored).

## Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in as Parent A or B.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Express + Vite dev server |
| `npm run build` | Production frontend bundle + server bundle → `dist/` |
| `npm start` | Run production server from `dist/server.cjs` |
| `npm run lint` | TypeScript check (`tsc --noEmit`) |

## Features (July 2026)

- **Tabs:** יומן (log), ציר זמן (timeline), דאשבורדים (dashboards), הגדרות (settings)
- **Event types:** nutrition, diaper, sleep, activity, weight, pumping, vomiting, supplement (Bio Gaya)
- **Quick pills:** Bio Gaya reminder (06:00–22:00), big nap warning (12:00–16:00), bath reminder
- **Dashboards:** Date-range stats (today / 3 / 7 / 14 days), quality tier icons on timeline rows
- **Settings:** Excel export, typed factory reset (`מחק הכל`), symbol legend
- **PWA:** Installable on mobile; refreshes event list when tab regains focus

## Project layout

```
src/App.tsx      — entire frontend
src/types.ts     — shared TypeScript types
server/db.ts     — Firestore operations
server.ts        — Express routes + dev middleware
plans/           — implementation plans
_shared/         — agent and stack docs
```

## Deployment

See `plans/deploy-render-free-v1.md` for Render free-tier deployment (env-based Firebase credentials, `PORT` binding).

## Origin

Bootstrapped from [Google AI Studio](https://ai.studio/apps/8dc56127-6e5c-4f0c-8534-b1f528c48c4f); evolved into a standalone Express + Firestore app.
