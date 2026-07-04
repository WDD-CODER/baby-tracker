# Session Handoff — Baby Tracker — 2026-07-04 (session close)

> **Purpose:** Resume from exactly where this session stopped.  
> **Read first:** this file + `sessions/2026-07-02.md` (full execution log).  
> **Plan:** `wave2_firestore_auth` v1 — Milestones 1–3 done, M4 pending.

---

## 1. Executive summary

| Area | Status |
|------|--------|
| **Wave 2 — Firestore lockdown** | M1 complete — Admin SDK, rules file set to deny all client access |
| **Wave 2 — Auth** | M2 + M3 complete — session login, API gate, Hebrew login UI |
| **Wave 2 — PWA session** | M4 **not started** — 30-day cookie `maxAge` |
| **Human setup** | **Done** — `.env`, `firebase-admin-config.json`, dev server runs |
| **Production rules deploy** | **Pending** — `firestore.rules` changed locally; must deploy to Firebase |

---

## 2. What was built (short)

- **`server/db.ts`** — Firebase Client SDK → Admin SDK; credentials from `FIREBASE_ADMIN_CREDENTIALS_PATH`; named DB via `FIRESTORE_DATABASE_ID`
- **`firestore.rules`** — `allow read, write: if false` (client access denied)
- **`server.ts`** — `express-session` + `bcryptjs`; `/api/login`, `/api/logout`; auth gate on `/api/*`; sleep `activeParent` from session
- **`src/App.tsx`** — Hebrew login screen; logout in Settings; parent badge from session (no manual switcher)
- **`.gitignore`** — `firebase-admin-config.json`, `firebase-applet-config.json`, `*-firebase-adminsdk-*.json`

**Dependencies added:** `firebase-admin`, `express-session`, `bcryptjs`

---

## 3. Environment (working)

| Item | Notes |
|------|--------|
| `firebase-admin-config.json` | Service account key at repo root (gitignored) |
| `.env` | `FIREBASE_ADMIN_CREDENTIALS_PATH`, `FIRESTORE_DATABASE_ID`, `SESSION_SECRET`, `PARENT_A_*`, `PARENT_B_*` |
| Dev server | `npm run dev` → `http://localhost:3000` |

**Gotcha resolved:** Firebase downloads key as `gen-lang-client-*-firebase-adminsdk-*.json` — app expects `firebase-admin-config.json` (or update `.env` path).

---

## 4. Still to do

1. **Milestone 4** — set session cookie `maxAge` to ~30 days in `server.ts`; verify logout clears session
2. **Deploy Firestore rules** — `firebase deploy --only firestore:rules` so production denies direct client access
3. **Commit + push** — when human approves (wave2 changes may still be uncommitted)

---

## 5. Suggested resume sequence

1. Human approves M3 acceptance test (sleep attribution Parent A → Parent B walkthrough)
2. Cursor: execute **Milestone 4 only** from wave2 plan
3. Human: deploy Firestore rules
4. Commit + push wave2

---

## 6. Key paths

| Path | Notes |
|------|--------|
| `sessions/2026-07-02.md` | Full milestone log + session close |
| `server/db.ts` | Only Firestore touchpoint |
| `server.ts` | Auth + all API routes |
| `src/App.tsx` | Login UI + app shell |
| `firestore.rules` | Deny-all client rules (deploy pending) |

---

## 7. What NOT to redo

- Do not re-migrate Client SDK → Admin SDK (M1 done)
- Do not re-add parent-selector UI (removed in M3)
- Do not commit credential JSON files
- Do not start Firebase Auth in browser (Path 2 locked)

---

*Session closed 2026-07-04 — resume at Milestone 4 or rules deploy.*
