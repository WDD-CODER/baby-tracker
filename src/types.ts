/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ParentType = 'PARENT_A' | 'PARENT_B';

export type EventType = 'NUTRITION' | 'DIAPER' | 'SLEEP' | 'ACTIVITY' | 'WEIGHT' | 'PUMPING' | 'VOMITING' | 'SUPPLEMENT';

export interface BabyProfile {
  name: string;
  dateOfBirth: string; // ISO date string, YYYY-MM-DD
  birthWeightGrams: number;
}

export type QuickActionId = 'meal' | 'diaper' | 'sleep' | 'activity' | 'weight' | 'vomiting';

export interface UserSettings {
  userId: string;                  // fixed household constant 'shared-household'
  parentAName: string;             // default "אמא"
  parentBName: string;             // default "אבא"
  defaultBottleType: 'EXPRESSED_MILK' | 'FORMULA';
  customActivities: string[];
  babyProfile?: BabyProfile;
  quickActionOrder?: QuickActionId[];
}

export type SpitUpType = 'NONE' | 'LIGHT' | 'HEAVY_VOMIT';
export type BreastSideType = 'LEFT' | 'RIGHT' | 'BOTH';
export type FeedType = 'BREAST' | 'BOTTLE';

export interface TopUpPayload {
  liquidType: 'EXPRESSED_MILK' | 'FORMULA';
  consumedMl: number;
}

export interface NutritionPayload {
  feedType: FeedType;
  breastSide?: BreastSideType;        // if BREAST
  durationMinutes?: number;           // if BREAST
  bottleLiquidType?: 'EXPRESSED_MILK' | 'FORMULA'; // if BOTTLE
  amountOfferedMl?: number;           // CRITICAL - +/- large buttons
  amountConsumedMl?: number;          // CRITICAL - +/- large buttons
  spitUp?: SpitUpType;
  swallowingNoises?: boolean;
  topUp?: TopUpPayload | null;        // breastfeeding top-up bottle
}

export type DiaperContentType = 'PEE' | 'POO' | 'BOTH';
export type PeeVolumeType = 'LIGHT' | 'HEAVY_SOAKED';
export type PooAmountType = 'SMALL' | 'MEDIUM' | 'LARGE_OVERFLOW';
export type PooColorType = 'YELLOW_MUSTARD' | 'GREEN' | 'BROWN';
export type PooTextureType = 'LIQUID' | 'SEEDY' | 'PASTY' | 'HARD';

export interface DiaperPayload {
  contains: DiaperContentType;
  peeVolume?: PeeVolumeType;
  pooAmount?: PooAmountType;
  pooColor?: PooColorType;
  pooTexture?: PooTextureType;
}

export type SleepLocationType = 'CRIB' | 'HANDS' | 'CARRIER' | 'STROLLER';

export interface SleepPayload {
  startAt: string; // ISO string
  endAt: string | null; // ISO string or null for in progress
  startLocation?: SleepLocationType;
  durationMinutes?: number; // derived on close
  loggedByStart?: ParentType; // parent who pressed "start sleep"
  loggedByEnd?: ParentType; // parent who pressed "end sleep" (absent until session closes)
}

export interface ActivityPayload {
  activityName: string;            // from customActivities
  cryingIntensity?: number;        // 1-10, optional
}

export interface WeightPayload {
  weightGrams: number;
  percentile?: number;             // optional
}

export interface PumpingPayload {
  leftAmountMl: number;
  rightAmountMl: number;
}

export type VomitingSizeType = 'SMALL' | 'MEDIUM' | 'LARGE';

export interface VomitingPayload {
  size: VomitingSizeType;
}

export interface SupplementPayload {
  name: string;
}

export interface BabyEvent {
  id: string;
  timestamp: string; // ISO string
  eventType: EventType;
  loggedBy: ParentType;
  deletedAt?: string; // ISO string — soft-delete; filtered from queries by default
  notes?: string;
  nutrition?: NutritionPayload;
  diaper?: DiaperPayload;
  sleep?: SleepPayload;
  activity?: ActivityPayload;
  weight?: WeightPayload;
  pumping?: PumpingPayload;
  vomiting?: VomitingPayload;
  supplement?: SupplementPayload;
  quickRecorded?: boolean;
}

// === Quality tier system (GAP-04) ===

export type QualityTier = 'BAD' | 'OKAY' | 'GOOD' | 'GREAT';

export const TIER_MAP: Record<QualityTier, { color: string; hebrewLabel: string }> = {
  BAD: { color: 'var(--color-tier-bad)', hebrewLabel: 'דורש תשומת לב' },
  OKAY: { color: 'var(--color-tier-okay)', hebrewLabel: 'סביר' },
  GOOD: { color: 'var(--color-tier-good)', hebrewLabel: 'טוב' },
  GREAT: { color: 'var(--color-tier-great)', hebrewLabel: 'מצוין' },
};

export function classifyNutrition(event: NutritionPayload): QualityTier {
  if (event.feedType === 'BREAST') {
    const minutes = event.durationMinutes ?? 0;
    if (minutes < 5) return 'BAD';
    if (minutes <= 15) return 'GOOD';
    return 'GREAT';
  }

  const offered = event.amountOfferedMl ?? 0;
  const consumed = event.amountConsumedMl ?? 0;
  if (offered <= 0) return 'OKAY';

  const percent = (consumed / offered) * 100;
  if (percent < 50) return 'BAD';
  if (percent < 80) return 'OKAY';
  if (percent < 100) return 'GOOD';
  return 'GREAT';
}

export function classifySleep(durationMinutes: number): QualityTier {
  if (durationMinutes < 30) return 'BAD';
  if (durationMinutes <= 45) return 'GOOD';
  return 'GREAT';
}

export function classifyDiaper(event: DiaperPayload): QualityTier {
  if (event.pooTexture === 'HARD' || event.pooAmount === 'LARGE_OVERFLOW') {
    return 'BAD';
  }

  const hasPee = event.contains === 'PEE' || event.contains === 'BOTH';
  const hasPoo = event.contains === 'POO' || event.contains === 'BOTH';

  if (hasPee && event.peeVolume === 'LIGHT') {
    return 'OKAY';
  }

  if (hasPee && event.peeVolume === 'HEAVY_SOAKED') {
    return 'GOOD';
  }

  if (hasPoo) {
    return 'GOOD';
  }

  return 'OKAY';
}

export function classifyWeight(currentGrams: number, previousGrams: number | null): QualityTier {
  if (previousGrams === null) return 'OKAY';
  if (currentGrams < previousGrams) return 'BAD';
  if (currentGrams > previousGrams) return 'GOOD';
  return 'OKAY';
}
