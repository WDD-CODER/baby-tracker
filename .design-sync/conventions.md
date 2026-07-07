# Baby Tracker — building with this design system

Baby Tracker is a **dark-themed, right-to-left (Hebrew) baby-logging app**. These components
are the reusable pieces of that app: a 24-hour date/time picker, a live sleep timer, a PWA
install card, and a set of single-color event glyphs. Build with them the way the app does.

## Setup — no provider, but the dark canvas is required
There is **no context provider** to wrap. The one hard requirement is the **dark canvas**: the
shipped `styles.css` sets `body { background:#020617 }` (slate-950) and light text, and every
component is drawn for that. Put your layout on a dark slate background (`bg-slate-950` /
`bg-slate-900`) or the glyphs and cards will sit on the wrong ground. The app is RTL — set
`dir="rtl"` on Hebrew content (see `InstallAppButton`, which renders Hebrew).

## Styling idiom — Tailwind v4 utility classes
Style with **Tailwind utility classes** (the app's full class vocabulary ships in `styles.css`);
there is no separate class API. The palette the app leans on:

| Purpose | Classes (real, in `styles.css`) |
|---|---|
| Surfaces | `bg-slate-950`, `bg-slate-900`, `bg-indigo-950/40`, `bg-indigo-600` |
| Text | `text-slate-100`, `text-slate-300`, `text-slate-400`, `text-indigo-200` |
| Accents (per event type) | `text-teal-400` (diaper), `text-rose-300` (breast), `text-sky-300` (bottle), `text-indigo-300` (sleep) |
| Borders / radius | `border`, `border-2`, `border-indigo-500/30`, `rounded-2xl`, `rounded-3xl` |
| Layout | `flex`, `items-center`, `gap-3`, `p-5`, `p-8`, `w-full` |
| Brand semantic tokens | CSS vars `--color-tier-bad/okay/good/great` (quality-tier colors) |

## Icons — color via `currentColor`
The glyphs (`DiaperIcon`, `IconBreast`, `IconBottleExpressed`, `IconBottleFormula`,
`IconWeightScale`, `IconSleepMoon`) inherit **`currentColor`** — set their color with a
`text-*` class on the icon or a wrapper. Exceptions: `IconPeeDrop` has a fixed blue brand
fill; `IconPoo` takes a `fill` prop (mustard/green/brown); `IconTierFace` colors itself from
its `tier` prop (`'BAD' | 'OKAY' | 'GOOD' | 'GREAT'`) — wrap it in a slate chip with a
tier-colored border, as the app does.

## Where the truth lives
Read `styles.css` (and its `@import` of `_ds_bundle.css`) for the shipped classes, and each
component's `.d.ts` (its props) and `.prompt.md` (usage) before composing.

## One idiomatic snippet
```tsx
// A dark event row, RTL, with a colored glyph and a live sleep timer.
<div dir="rtl" className="bg-slate-950 p-5">
  <div className="flex items-center gap-3 rounded-2xl bg-slate-900 border border-indigo-500/30 p-4">
    <span className="text-2xl">💤</span>
    <span className="font-mono text-xl tabular-nums text-indigo-100">
      <SleepTimer startAt="2026-07-06T02:15:00" />
    </span>
    <IconTierFace tier="GREAT" className="w-6 h-6" />
  </div>
</div>
```
