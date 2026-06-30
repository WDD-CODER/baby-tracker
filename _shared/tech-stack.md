# Tech Stack Reference — Baby Tracker

**Authoritative source of truth for all technology choices.**
Consult before any stack-related decision. Do not invent or assume details not listed here.

---

## Runtime Environment

| Layer | Technology | Version |
|-------|-----------|---------|
| JS Runtime | Node.js | ≥20 (ESM modules) |
| Language | TypeScript | ~5.8.2 |
| Package Manager | npm | (lockfile: package-lock.json) |

---

## Frontend

| Concern | Library | Version | Notes |
|---------|---------|---------|-------|
| UI Framework | React | 19.0.1 | Not Angular. React 19 with hooks only. |
| Build Tool | Vite | 6.2.3 | Config: `vite.config.ts` |
| CSS | Tailwind CSS v4 | 4.1.14 | via `@tailwindcss/vite` plugin — NO `tailwind.config.js` |
| Animation | Motion | 12.23.24 | Formerly Framer Motion. Import: `motion/react` |
| Icons | Lucide React | 0.546.0 | Named imports only |
| Type Checking | TypeScript | ~5.8.2 | Run: `npm run lint` (tsc --noEmit) |

**Tailwind v4 critical note:** Tailwind v4 uses a Vite plugin, not a config file. All theme customisation is done in CSS (`src/index.css`) with `@theme` blocks. There is NO `tailwind.config.js` or `tailwind.config.ts`. Do not create one.

---

## Backend

| Concern | Library | Version | Notes |
|---------|---------|---------|-------|
| HTTP Server | Express | 4.21.2 | Runs at port 3000 |
| TypeScript Exec (dev) | tsx | 4.21.0 | `npm run dev` → `tsx server.ts` |
| Server Bundler (prod) | esbuild | 0.25.0 | Output: `dist/server.cjs` |
| Excel Export | ExcelJS | 4.4.0 | Used in `/api/export/xlsx` |
| Environment Vars | dotenv | 17.2.3 | Loads `.env` at root |

---

## Database

| Concern | Technology | Notes |
|---------|-----------|-------|
| Database | Google Cloud Firestore | via `@google-cloud/firestore` ^8.6.0 |
| Config File | `firebase-applet-config.json` | Reads `projectId` + optional `firestoreDatabaseId` |
| Auth | Application Default Credentials | Falls back to ADC if config missing |
| Security Rules | `firestore.rules` | Currently: open read/write for all households |

**Firestore data paths:**
```
/households/shared-household              → UserSettings document
/households/shared-household/events/{id} → BabyEvent documents
```

---

## AI / ML

| Concern | Library | Status |
|---------|---------|--------|
| Gemini AI | `@google/genai` ^2.4.0 | Installed, NOT yet wired to UI |
| API Key | `GEMINI_API_KEY` env var | Injected by AI Studio at runtime |

---

## What We Do NOT Use

- ❌ Angular (was in early PRDs — project uses React 19)
- ❌ Redux / Zustand / any state management library
- ❌ React Router / any client-side router
- ❌ Prisma / Drizzle / any SQL ORM (Firestore only)
- ❌ Jest / Vitest / any test framework (not set up)
- ❌ ESLint (not configured — only TypeScript type checking)
- ❌ tailwind.config.js (Tailwind v4 uses plugin only)
- ❌ Framer Motion (renamed to `motion` — import from `motion/react`)
- ❌ Recharts / Chart.js (dashboards use pure CSS bars)
- ❌ Service Worker / PWA manifest (not set up yet)

---

## Dev Commands

```bash
npm run dev      # Start dev server (tsx server.ts + Vite HMR at port 3000)
npm run build    # Vite build + esbuild server bundle → dist/
npm run start    # Run production build (node dist/server.cjs)
npm run lint     # TypeScript type check (tsc --noEmit) — no eslint
npm run clean    # rm -rf dist
```

---

## Environment Variables

```
GEMINI_API_KEY=...   # Required for Gemini AI calls (AI Studio injects automatically)
APP_URL=...          # Hosting URL (AI Studio injects automatically)
```

Config for Firebase/Firestore goes in `firebase-applet-config.json` (not committed), not in `.env`.

---

## Hosting Platform

Built for Google AI Studio (`metadata.json` declares `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`).
The app is a full-stack Express + React SPA deployed to Cloud Run via AI Studio.
`index.html` is the SPA shell — served by Express in production, by Vite in development.
