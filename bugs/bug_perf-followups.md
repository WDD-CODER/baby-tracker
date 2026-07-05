# bug_perf-followups — deferred performance work

**Status:** OPEN
**Source:** `plans/performance-optimization-v1.md` — items intentionally descoped during execution (2026-07-05) to keep edits low-risk on the 6,365-line `src/App.tsx` monolith.

These are **optimizations, not defects** — the app is correct and faster without them. Pick up when there's appetite for a larger refactor.

## 1. Lazy-load heavy screens (Milestone 4, step 3)
Split the Stats view and Settings sub-screens out of `src/App.tsx` into their own files and load with `React.lazy` + `<Suspense>`. Today the whole app is one `index` chunk (**413 kB / 106 kB gzip**). The default tab is `log`; Stats/Settings don't need to be in the critical-path download.
- **Blocker:** requires extracting large sections from the monolith — do as a dedicated, tested pass, not inline.
- Vendor chunking (`react-vendor`, `motion`) and the dead-`firebase` removal from the same milestone **are done**.

## 2. Memoize derived lists (Milestone 5, step 2)
Zero `useMemo`/`useCallback` exist. Wrap the expensive `events.filter(...).sort(...)` derivations (carousel lists, per-type lists — 43 `.map` / 21 `.filter` / 11 `.sort` in render) in `useMemo` keyed on `[events, …filters]`.
- **Note:** the highest-frequency re-render (the 1-second sleep timer) is **already fixed** by isolating `<SleepTimer>`, so this is now a secondary win.

## 3. Isolate the 5-second `currentTime` tick (Milestone 5, step 1, partial)
`currentTime` is read in 13+ places (notification effects, awake-minutes, big-nap/bath warnings), so it was **not** isolated — too woven-in to extract safely. If those consumers are ever grouped into a subtree, push the 5 s tick down into it.

## 4. (Optional) `React.memo` heaviest presentational subtrees (Milestone 5, step 4)
Only worthwhile if profiling still shows jank after items 1–2.
