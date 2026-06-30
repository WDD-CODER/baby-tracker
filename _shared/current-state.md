# Current State — Baby Tracker

Living "where we are" document. The Context Capsule's *Current State* section is generated from this file until AgentMemory is wired (Stage 0.5).

---

## Origin

The app was built in **Google AI Studio**, then synced to GitHub. It was imported as the project baseline on **2026-06-30**. All future work extends this codebase — it is not a greenfield scaffold.

---

## Authoritative stack

See [`_shared/tech-stack.md`](tech-stack.md) for the full reference.

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 6, Tailwind CSS v4, Motion |
| Backend | Express 4, TypeScript, tsx (dev) / esbuild (prod) |
| Database | Google Cloud Firestore |
| Export | ExcelJS |
| Hosting | Google AI Studio → Cloud Run |

**Not used:** Angular and MongoDB from early PRD drafts are **not** part of this project. Do not introduce them without an explicit Architect plan.

---

## Already implemented (import baseline)

The following was working at import time:

- **Backend event CRUD** — full create/read/update/delete for all event types via `/api/events`
- **Sleep toggle state machine** — one-open invariant, duration math, location selection, custom start time (`/api/sleep/toggle`, `/api/sleep/open`)
- **Aggregation endpoints** — `/api/stats/nutrition`, `/api/stats/sleep`, `/api/stats/diapers`, `/api/stats/weight` (7/14/30-day range on dashboards)
- **5-sheet Excel export** — `/api/export/xlsx` (Summary, Feeds, Sleep, Diapers, Weight)
- **Frontend timeline** — vertical event list on the Timeline tab
- **Bottom sheets** — bottle/diaper/activity/weight entry forms; edit sheet for existing events
- **Dashboards** — pure-CSS bar charts (nutrition, sleep, diapers, weight)
- **Export trigger** — date-range export from Settings tab
- **Additional working features** — dual-parent switching, custom activities, daily nutrition summary, toast notifications, full RTL Hebrew UI

---

## Backlog (mapped to Baby Tracker PRD §12)

| Item | PRD ref | Notes |
|------|---------|-------|
| Semantic Icon System | 9b | Tier enum, classifiers, tier-map, SVG set + legend; currently plain emoji on a dark theme |
| Breastfeeding top-up | 9c | Partial breast feed logging enhancements |
| Design-Foundation restyling | — | Warm-cream pastels + dual-color discipline; currently dark slate |
| PWA install | — | Service worker + manifest (not set up) |
| Tests | — | No test framework configured |
| Gemini wiring | — | `@google/genai` installed but not connected to UI |

---

## Known stack deltas vs PRD

Respect these when planning features — they are intentional baseline choices, not bugs:

- Dashboards use **pure CSS bars**, not Chart.js or Recharts
- **No test framework** and **no ESLint** — only TypeScript type checking (`npm run lint`)
- **Tailwind v4** via Vite plugin — no `tailwind.config.js`; theme customisation lives in `src/index.css` `@theme` blocks
- **No service worker / PWA manifest** yet
- **No client-side router** — single-page tab navigation in `App.tsx`
