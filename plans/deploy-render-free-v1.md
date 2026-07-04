# Deployment Plan — Render Free Web Service
**Date:** 2026-07-05  
**Status:** READY FOR CONTRACTOR  
**Platform:** [Render](https://render.com) — Free Web Service tier  
**Goal:** Deploy the baby tracker so both parents can access it from any device via a public URL, at zero cost.

---

## Overview

The app is a single unified service: Express serves the built React/Vite frontend as static files **and** handles all `/api/*` routes. On Render, one Web Service does everything. No separate frontend hosting needed.

**Two small code changes are required before deployment works.** Everything else (PWA, session auth, Firestore, Excel export) works as-is.

---

## Step 1 — Code Change: Fix PORT in `server.ts`

**File:** `server.ts`  
**Line:** 23 (currently `const PORT = 3000;`)

**Change from:**
```ts
const PORT = 3000;
```

**Change to:**
```ts
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
```

**Why:** Render dynamically assigns a port via the `PORT` environment variable. If the server binds to `3000` instead of Render's assigned port, the service starts but Render's proxy never connects to it — the app returns a "Service Unavailable" error. The fallback to `3000` preserves local dev behavior exactly.

---

## Step 2 — Code Change: Firebase Credentials from Env Var in `server/db.ts`

**File:** `server/db.ts`  
**Function:** `initFirestore()` (currently lines 21–46)

Render has no persistent disk. The current code reads `firebase-admin-config.json` from the local filesystem. On Render this file does not exist. The fix adds support for a base64-encoded env var while keeping the file-path fallback so local dev continues to work unchanged.

**Replace the entire `initFirestore()` function with:**

```ts
function initFirestore(): Firestore {
  let serviceAccount: object;

  const credentialsJson = process.env.FIREBASE_ADMIN_CREDENTIALS_JSON;
  const credentialPath = process.env.FIREBASE_ADMIN_CREDENTIALS_PATH;

  if (credentialsJson) {
    // Production path: base64-encoded JSON in env var
    serviceAccount = JSON.parse(Buffer.from(credentialsJson, 'base64').toString('utf8'));
  } else if (credentialPath) {
    // Local dev path: JSON file on disk
    const resolvedPath = path.resolve(process.cwd(), credentialPath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Firebase Admin credentials file not found at: ${resolvedPath}`);
    }
    serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  } else {
    throw new Error('Either FIREBASE_ADMIN_CREDENTIALS_JSON or FIREBASE_ADMIN_CREDENTIALS_PATH must be set');
  }

  const app = getApps().length === 0
    ? initializeApp({ credential: cert(serviceAccount as any) })
    : getApps()[0];

  const databaseId = process.env.FIRESTORE_DATABASE_ID;
  const firestore = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

  const databaseLabel = databaseId ?? '(default)';
  const projectId = (serviceAccount as any).project_id ?? 'unknown';
  console.log(
    `Firestore Admin SDK initialized with project ID: ${projectId}, database: ${databaseLabel}`
  );

  return firestore;
}
```

**Why:** `FIREBASE_ADMIN_CREDENTIALS_JSON` is the base64-encoded content of `firebase-admin-config.json`. Base64 is used because the JSON contains newlines and special characters that would break a raw env var. Decoding it in memory at startup avoids any filesystem dependency.

---

## Step 3 — Verify the Build Works Locally

After making the two changes above, run the build locally to confirm nothing is broken:

```bash
npm run build
```

Expected output: no TypeScript errors, `dist/` folder created with `dist/server.cjs` and the React static files. If it passes, commit both changes to `main` and push to GitHub.

---

## Step 4 — Generate Required Secrets (Dan does this, not the contractor)

These commands are run **locally** (on Dan's machine, not by the contractor). The outputs are pasted into Render's environment panel.

### SESSION_SECRET
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output — it will look like `a3f8c2...` (64 hex chars).

### PARENT_A_PASSWORD_HASH and PARENT_B_PASSWORD_HASH
Replace `yourpassword` with the actual passwords:
```bash
node -e "import('bcryptjs').then(b => b.default.hash('yourpassword', 10).then(console.log))"
```
Run once per parent. Each output looks like `$2b$10$...`.

### FIREBASE_ADMIN_CREDENTIALS_JSON (base64-encode the service account file)
```bash
node -e "console.log(Buffer.from(require('fs').readFileSync('./firebase-admin-config.json','utf8')).toString('base64'))"
```
Copy the entire output (a long base64 string). This goes into the `FIREBASE_ADMIN_CREDENTIALS_JSON` env var on Render.

---

## Step 5 — Create the Render Web Service

Reference: [Render Web Services docs](https://render.com/docs/web-services)

1. Log in to [dashboard.render.com](https://dashboard.render.com)
2. Click **New +** → **Web Service**
3. Connect your GitHub account if not already connected
4. Select the `baby-tracker` repository
5. Fill in the service settings:

| Setting | Value |
|---|---|
| **Name** | `baby-tracker` |
| **Region** | `Oregon (US West)` — or closest to Israel is Frankfurt but that's paid; Oregon is fine |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

6. Click **Advanced** and add the following environment variables:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | *(output from Step 4 — SESSION_SECRET)* |
| `PARENT_A_USERNAME` | `ama` *(or whatever username Dan uses)* |
| `PARENT_A_PASSWORD_HASH` | *(output from Step 4 — Parent A hash)* |
| `PARENT_B_USERNAME` | `aba` *(or whatever username is used)* |
| `PARENT_B_PASSWORD_HASH` | *(output from Step 4 — Parent B hash)* |
| `FIREBASE_ADMIN_CREDENTIALS_JSON` | *(output from Step 4 — base64 string)* |
| `FIRESTORE_DATABASE_ID` | *(value from local `.env` — the long database ID)* |

> **Do NOT set PORT.** Render injects it automatically. If you set it manually to 3000 it will conflict.

7. Click **Create Web Service**

---

## Step 6 — Wait for First Deploy

Render will:
1. Pull the repo from GitHub
2. Run `npm install && npm run build` (~2–3 minutes first time)
3. Run `npm start`
4. Show logs in the dashboard

Watch the logs tab. A successful start looks like:
```
Firestore Admin SDK initialized with project ID: your-project, database: your-db-id
Server running on http://localhost:XXXXX
```

If you see `Error: Either FIREBASE_ADMIN_CREDENTIALS_JSON or ...` → the env var wasn't set correctly (go back to step 4 and re-encode).

If you see `Service Unavailable` in the browser → PORT fix in Step 1 wasn't applied.

---

## Step 7 — Access the App

Your app will be live at:
```
https://baby-tracker-xxxx.onrender.com
```
(exact subdomain is generated by Render, visible in the dashboard)

Share this URL with both parents. It works in any browser on any device.

---

## Step 8 — Install as PWA on Phone

Because the app already has a full PWA manifest and service worker (via `vite-plugin-pwa`):

**On iPhone (Safari):**
1. Open the URL in Safari
2. Tap the Share icon → **Add to Home Screen**
3. Tap **Add**

**On Android (Chrome):**
1. Open the URL in Chrome
2. Tap the three-dot menu → **Add to Home Screen** (or Chrome will prompt automatically)
3. Tap **Install**

The app installs as a native-feeling app icon. It works offline for viewing cached data.

---

## Free Tier Limitations to Know

| Limitation | Impact |
|---|---|
| **Spins down after 15 min of inactivity** | First request after idle takes ~30 seconds. Subsequent requests are instant. |
| **512 MB RAM** | Fine for this app — Express + Firestore SDK uses ~150 MB |
| **750 hours/month** | Enough for one service running 24/7 (730 hours/month) |
| **No persistent disk** | Why we moved credentials to env var — no impact on the app |
| **No custom domain on free tier** | App lives at `*.onrender.com` — acceptable for personal use |

---

## Auto-Deploy on Git Push

Once the service is created, every push to `main` triggers a new deploy automatically. No manual steps. Contractor pushes code → Render rebuilds and redeploys within ~2 minutes.

---

## Rollback

If a deploy breaks the app: in the Render dashboard → your service → **Deploys** tab → click any previous deploy → **Rollback to this deploy**.

---

## Summary of Contractor Tasks

| # | Task | File |
|---|---|---|
| 1 | Change `const PORT = 3000` to use `process.env.PORT` with fallback | `server.ts` line 23 |
| 2 | Replace `initFirestore()` to support base64 env var credentials | `server/db.ts` lines 21–46 |
| 3 | Run `npm run build` locally to verify no errors | — |
| 4 | Commit both changes and push to `main` | — |
| 5 | Report build success so Dan can proceed with Render dashboard setup | — |

Dan handles Steps 4–8 (secret generation + Render dashboard). Contractor handles Steps 1–3 only.
