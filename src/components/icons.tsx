/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Baby Tracker glyph set. Small, single-color SVG icons that inherit `currentColor`
// (unless a fixed brand fill is baked in, e.g. the pee drop). Sized via Tailwind
// utility classes on `className` (default `w-5 h-5`) so they scale with surrounding
// text. Extracted from App.tsx so they can be reused and synced to the design system.

import { PooColorType, QualityTier, TIER_MAP } from '../types';

export type TypeGlyphProps = { className?: string };

/** Poo glyph fill colors keyed by stool color classification. */
export const POO_GLYPH_FILL: Record<PooColorType, string> = {
  YELLOW_MUSTARD: '#E8B923',
  GREEN: '#2D8A4E',
  BROWN: '#8B5A2B',
};

/** Outline diaper glyph. Inherits `currentColor`; stroke width is adjustable. */
export const DiaperIcon = ({ className = "w-5 h-5", strokeWidth = 2 }: { className?: string, strokeWidth?: number }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <path d="M3 5h18" />
    <path d="M3 5v5a9 9 0 0 0 18 0V5" />
    <path d="M3 10c1.5 2 4.5 4 9 4s7.5-2 9-4" />
    <path d="M7 5v3" />
    <path d="M17 5v3" />
  </svg>
);

/** Direct breastfeeding glyph. Inherits `currentColor`. */
export const IconBreast = ({ className = 'w-5 h-5' }: TypeGlyphProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M8 4c0 3.5 1.8 6 4 6s4-2.5 4-6c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2z" opacity="0.35" />
    <path d="M12 10c-3.3 0-6 2.7-6 6v4h12v-4c0-3.3-2.7-6-6-6z" />
    <circle cx="10" cy="15" r="1.2" fill="currentColor" opacity="0.5" />
  </svg>
);

/** Expressed-milk bottle glyph (with liquid line). Inherits `currentColor`. */
export const IconBottleExpressed = ({ className = 'w-5 h-5' }: TypeGlyphProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M9 3h6v3H9z" />
    <path d="M10 6h4v2h-4z" />
    <path d="M8 8h8v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8z" />
    <path d="M9 12c1 1.5 2 2 3 2s2-.5 3-2" stroke="#93C5FD" fill="none" />
    <circle cx="12" cy="16" r="1.5" fill="#93C5FD" stroke="none" />
  </svg>
);

/** Formula bottle glyph (with measurement lines). Inherits `currentColor`. */
export const IconBottleFormula = ({ className = 'w-5 h-5' }: TypeGlyphProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M9 3h6v3H9z" />
    <rect x="10" y="4" width="4" height="1.5" rx="0.5" fill="currentColor" stroke="none" />
    <path d="M8 8h8v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8z" />
    <path d="M10 11h4M10 14h4M10 17h4" />
  </svg>
);

/** Stool glyph. `fill` picks a color from POO_GLYPH_FILL (defaults to mustard yellow). */
export const IconPoo = ({ fill = POO_GLYPH_FILL.YELLOW_MUSTARD, className = 'w-5 h-5' }: TypeGlyphProps & { fill?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      d="M12 3c-2 0-3.5 1.2-3.5 3 0 1 .4 1.8 1 2.4C8 9.5 6.5 11 6.5 13c0 2.5 2.5 5 5.5 5s5.5-2.5 5.5-5c0-2-1.5-3.5-2.5-4.6.6-.6 1-1.4 1-2.4 0-1.8-1.5-3-3.5-3z"
      fill={fill}
    />
  </svg>
);

/** Urine drop glyph. Fixed blue brand fill. */
export const IconPeeDrop = ({ className = 'w-5 h-5' }: TypeGlyphProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      d="M12 2.5c0 0-5.5 7.2-5.5 11a5.5 5.5 0 1 0 11 0c0-3.8-5.5-11-5.5-11z"
      fill="#60A5FA"
      stroke="#3B82F6"
      strokeWidth="1"
    />
  </svg>
);

/** Weight-scale glyph. Inherits `currentColor`. */
export const IconWeightScale = ({ className = 'w-5 h-5' }: TypeGlyphProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M4 18h16" />
    <path d="M6 18V9a2 2 0 0 1 2-2h1" />
    <path d="M18 18V9a2 2 0 0 0-2-2h-1" />
    <circle cx="12" cy="8" r="3" />
    <path d="M12 5V2" />
    <path d="M10 2h4" />
    <path d="M15 6l2-2M15 4l2 2" stroke="#46A758" />
  </svg>
);

/** Crescent-moon sleep glyph. Inherits `currentColor`. */
export const IconSleepMoon = ({ className = 'w-5 h-5' }: TypeGlyphProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a6.5 6.5 0 1 0 11.5 11.5z" />
  </svg>
);

/**
 * Quality-tier face. Renders one of four expressions (BAD / OKAY / GOOD / GREAT),
 * colored from TIER_MAP for the given `tier`. Used to summarize how good a logged
 * event was at a glance.
 */
export const IconTierFace = ({ tier, className = 'w-6 h-6' }: { tier: QualityTier; className?: string }) => {
  const color = TIER_MAP[tier].color;
  return (
    <svg viewBox="0 0 24 24" className={className} style={{ color }} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2" />
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {tier === 'BAD' && (
        <>
          <path d="M8 10c0-1 1-2 2-2M14 8c1 0 2 1 2 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M8.5 16c1.5-2 5.5-2 7 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="9" cy="14" r="1" fill="currentColor" />
        </>
      )}
      {tier === 'OKAY' && (
        <>
          <circle cx="9" cy="10" r="1.2" fill="currentColor" />
          <circle cx="15" cy="10" r="1.2" fill="currentColor" />
          <path d="M9 15h6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
      {tier === 'GOOD' && (
        <>
          <path d="M8 10c0.5-0.5 1.5-0.5 2 0M14 10c0.5-0.5 1.5-0.5 2 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M8.5 14.5c1.5 1.5 5.5 1.5 7 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
      {tier === 'GREAT' && (
        <>
          <path d="M8 9c0.5 1 1.5 1.5 2.5 1M13.5 10c1-0.5 2-1 2.5-2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M7.5 14c2 2.5 7 2.5 9 0" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <path d="M6 7l1 1M18 7l-1 1" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
};
