/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ParentType = 'PARENT_A' | 'PARENT_B';

export type EventType = 'NUTRITION' | 'DIAPER' | 'SLEEP' | 'ACTIVITY' | 'WEIGHT' | 'PUMPING' | 'VOMITING';

export interface BabyProfile {
  name: string;
  dateOfBirth: string; // ISO date string, YYYY-MM-DD
  birthWeightGrams: number;
}

export interface UserSettings {
  userId: string;                  // fixed household constant 'shared-household'
  parentAName: string;             // default "אמא"
  parentBName: string;             // default "אבא"
  defaultBottleType: 'EXPRESSED_MILK' | 'FORMULA';
  customActivities: string[];
  babyProfile?: BabyProfile;
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
  startLocation: SleepLocationType;
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

export interface BabyEvent {
  id: string;
  timestamp: string; // ISO string
  eventType: EventType;
  loggedBy: ParentType;
  notes?: string;
  nutrition?: NutritionPayload;
  diaper?: DiaperPayload;
  sleep?: SleepPayload;
  activity?: ActivityPayload;
  weight?: WeightPayload;
  pumping?: PumpingPayload;
  vomiting?: VomitingPayload;
  quickRecorded?: boolean;
}
