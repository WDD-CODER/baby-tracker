# Plan Contract — Wave 3: Visual Identity

> **Status:** Draft — awaiting human approval before Milestone 1 begins.
> **Scope:** GAP-10 (design tokens), GAP-04 (Semantic Icon System, 4 sub-milestones), GAP-13 (weight in kg).
> **Immutable once approved.** Cursor executes ONE milestone per run, then STOPS.

---

## Milestone 1 — Design tokens + Heebo font (GAP-10)

**Files:** `src/index.css` only.

**Changes:**
1. Import Heebo from Google Fonts (weights 400/500/700/800).
2. Add a Tailwind v4 `@theme` block (no `tailwind.config.js`) defining:
   - `--font-family-sans: 'Heebo', 'Rubik', 'Assistant', system-ui, sans-serif;`
   - Category identity colors: `--color-cat-nutrition`, `--color-cat-sleep`, `--color-cat-diaper`, `--color-cat-activity`, `--color-cat-weight`
   - Semantic tier colors: `--color-tier-bad` (`#E5484D`), `--color-tier-okay` (`#F5A623`), `--color-tier-good` (`#46A758`), `--color-tier-great` (`#30A46C`)
   - `--color-canvas: #FDFBF7`
3. Do not apply these tokens to any component yet — that happens in later milestones. This milestone only defines them.

**Acceptance test:** App loads, Heebo font visibly applied to Hebrew text. `npm run dev`, inspect any text element in devtools — computed font-family should resolve to Heebo.

**Verify command:** `npm run lint`

---

## Milestone 2 — Quality tier types + classifiers (GAP-04a)

**Files:** `src/types.ts` only.

**Changes:**
1. Add `export type QualityTier = 'BAD' | 'OKAY' | 'GOOD' | 'GREAT';`
2. Add `TIER_MAP: Record<QualityTier, { color: string; hebrewLabel: string }>` — color values reference the tokens from Milestone 1 (`var(--color-tier-bad)` etc.), Hebrew labels e.g. `'דורש תשומת לב'`, `'סביר'`, `'טוב'`, `'מצוין'`.
3. Add pure classifier functions (no UI, no side effects), fully typed, no `any`:
   - `classifyNutrition(event: NutritionPayload): QualityTier` — bottle: consumed/offered % (<50 BAD, 50-79 OKAY, 80-99 GOOD, ≥100 GREAT); breast: durationMinutes (<5 BAD, 5-15 GOOD, 15+ GREAT — no OKAY tier for breast per spec)
   - `classifySleep(durationMinutes: number): QualityTier` — <30 BAD, 30-45 GOOD, >45 GREAT (no OKAY tier per spec)
   - `classifyDiaper(event: DiaperPayload): QualityTier` — HARD texture or LARGE_OVERFLOW → BAD; LIGHT pee → OKAY; normal poo or HEAVY_SOAKED pee → GOOD (no GREAT tier per spec)
   - `classifyWeight(currentGrams: number, previousGrams: number | null): QualityTier` — loss → BAD, flat → OKAY, gain → GOOD (no GREAT tier per spec; if no previous weight, default OKAY)

**Acceptance test:** `tsc --noEmit` passes. No UI changes yet — these are unused exports until Milestone 4/5 wire them in, which is expected at this stage.

**Verify command:** `npm run lint`

---

## Milestone 3 — Type glyphs (GAP-04b)

**Files:** `src/App.tsx` only.

**Changes:**
1. Add inline SVG icon constants (not new files — single-component architecture) for each type glyph: breast, expressed-milk bottle, formula bottle (visually distinct from expressed-milk), poo (accepts a color fill prop matching diaper color), pee-drop, weight-scale-with-arrow, sleep-moon.
2. Each as a small typed React component or SVG string constant defined at the top of `App.tsx`, e.g. `const IconBreast = () => (<svg>...</svg>);`
3. Do not apply these to the timeline yet — that's Milestone 4. This milestone only defines the icon set.

**Acceptance test:** `npm run dev` runs with no console errors. Icons not yet visible anywhere (expected — unused until M4).

**Verify command:** `npm run lint`

---

## Milestone 4 — Tier icons (baby faces) + apply to timeline (GAP-04c)

**Files:** `src/App.tsx` only.

**Changes:**
1. Add 4 baby-face SVG icon constants, one per `QualityTier` (BAD/OKAY/GOOD/GREAT), following Design Foundation §4.1 (sad/crying red, calm/neutral amber, content/sleeping green, super-happy vivid green).
2. On timeline cards: render the relevant type glyph (from M3) alongside the tier icon, computed via the classifiers from M2, for each event type that has a classifier (nutrition, sleep, diaper, weight — activity has no tier).
3. Color is never the only signal — tier icon (face) always accompanies the color per design spec.

**Acceptance test:** Timeline shows correct tier icon + color per event, verified manually against a few known events (e.g. a short nap shows the BAD/sad face; a full bottle shows GREAT).

**Verify command:** `npm run lint`

---

## Milestone 5 — Dashboards + Legend screen (GAP-04d / GAP-15)

**Files:** `src/App.tsx` only.

**Changes:**
1. Apply the same tier icon + color system to the existing CSS-bar dashboards (nutrition/sleep/diaper/weight) — bars/segments tinted by tier where applicable.
2. Add a Legend screen: one screen reachable from Settings, showing each of the 4 tier faces + colors with their Hebrew labels (from `TIER_MAP`), and the type glyphs with their Hebrew names, per Design Foundation §4.5.7.

**Acceptance test:** Legend screen reachable from Settings tab, renders all 4 tiers + all type glyphs with correct Hebrew labels. Dashboards visually reflect tier coloring.

**Verify command:** `npm run lint`

---

## Milestone 6 — Weight in kg (GAP-13)

**Files:** `src/App.tsx` only.

**Changes:**
1. Add helper `gramsToKg(g: number): string` returning e.g. `"3.5 ק"ג"` (one decimal, kg suffix).
2. Apply on: timeline weight cards, weight dashboard, and any settings screen showing birth weight.
3. Underlying storage stays in grams — this is a display-only change.

**Acceptance test:** All weight displays show kg with one decimal instead of raw grams. `npm run dev`, visually confirm on timeline + dashboard + settings.

**Verify command:** `npm run lint`

---

## Conventions Reminder (inline — Cursor must not drift from these)

- **Tech stack is authoritative in `/_shared/tech-stack.md`** — consult before any decision
- **Tailwind v4** — NO `tailwind.config.js`. Custom tokens go in `src/index.css` `@theme` block only.
- **No new sub-components** — all JSX/icons stay inline in `App.tsx` (single-component architecture)
- **No new npm packages** — SVGs are hand-written inline, no icon library
- **No `any` types** — every new variable and function must be fully typed
- **Lint gate**: `npm run lint` (`tsc --noEmit`) must pass with zero errors after every milestone
- **Hebrew strings in UI** — all user-facing labels in Hebrew; code identifiers in English
- **Automatic handoff**: per `.cursorrules`, write execution summary to AgentMemory (or `/sessions/[date].md` fallback) at the end of every milestone without being asked

---

## Out of Scope (do NOT touch)

- Interactive dashboards redesign (GAP-14 — sleep 24h bands, diaper calendar, weight line chart) — separate plan
- Export as its own tab (GAP-16) — separate plan
- Any refactoring of existing working code unrelated to this plan
- `.cursorrules`, `CLAUDE.md`, `_shared/tech-stack.md` — do not modify workflow files
- Any new npm packages

---

## Cursor Execution Instructions

Paste the following prompt into Cursor for each milestone, changing the milestone number each time:

```
Execute ONLY Milestone [N] from /plans/wave3_visual_identity_v1.md.
- Read the plan file carefully before touching any code.
- Follow /_shared/tech-stack.md and .cursorrules for all conventions.
- Do NOT mark the milestone complete in the plan file.
- Do NOT start the next milestone.
- One milestone, then STOP and wait for human review.
- If you hit an error: at most 3 fix attempts within the scoped files only, then stop and report the error with the full message (per .cursorrules 3-strike rule — write a bug report to /bugs/ if unresolved).
Write your execution summary to AgentMemory via the handoff skill (or /sessions/[today's date].md if unreachable), then STOP.
```

After each milestone, run `/review-it` in Claude Code before approving the next.
