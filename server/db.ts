/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { BabyEvent, UserSettings } from '../src/types';

const DEFAULT_SETTINGS: UserSettings = {
  userId: 'shared-household',
  parentAName: 'אמא',
  parentBName: 'אבא',
  defaultBottleType: 'EXPRESSED_MILK',
  customActivities: ['שגרת בוקר', 'בייבי יוגה', 'שירים', 'טיול בעגלה', 'עיסוי תינוקות']
};

function initFirestore(): Firestore {
  let serviceAccount: object;

  const credentialsJson = process.env.FIREBASE_ADMIN_CREDENTIALS_JSON;
  const credentialPath = process.env.FIREBASE_ADMIN_CREDENTIALS_PATH;

  if (credentialsJson) {
    // Production path: base64-encoded JSON in env var (no persistent disk on Render)
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

const db = initFirestore();
const householdId = 'shared-household';
const householdRef = db.collection('households').doc(householdId);
const eventsCollection = householdRef.collection('events');

// Settings change rarely but are read on login, on every /api/settings, and
// inside the Excel export. Cache with the same short TTL; saveSettings invalidates.
const SETTINGS_TTL_MS = 5000;
let settingsCache: { data: UserSettings; at: number } | null = null;

export async function getSettings(): Promise<UserSettings> {
  if (settingsCache && Date.now() - settingsCache.at < SETTINGS_TTL_MS) {
    return settingsCache.data;
  }
  try {
    const docSnap = await householdRef.get();
    if (!docSnap.exists) {
      await householdRef.set(DEFAULT_SETTINGS);
      settingsCache = { data: DEFAULT_SETTINGS, at: Date.now() };
      return DEFAULT_SETTINGS;
    }
    const data = docSnap.data();
    const settings = {
      ...DEFAULT_SETTINGS,
      ...data,
      userId: householdId
    } as UserSettings;
    settingsCache = { data: settings, at: Date.now() };
    return settings;
  } catch (err) {
    console.error('Error fetching settings from Firestore:', err);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  try {
    const current = await getSettings();
    const merged = {
      ...current,
      ...settings,
      userId: householdId
    };
    await householdRef.set(merged, { merge: true });
    settingsCache = { data: merged, at: Date.now() };
    return merged;
  } catch (err) {
    console.error('Error saving settings to Firestore:', err);
    throw err;
  }
}

function isActiveEvent(event: BabyEvent): boolean {
  return !event.deletedAt;
}

// Short-lived in-memory cache. Purpose: collapse read bursts — most notably the
// Stats screen, which fires 4 parallel /api/stats/* requests that each call
// getAllEvents(). TTL is deliberately tiny; every write invalidates the cache,
// so staleness is bounded by concurrent-write timing only.
const EVENTS_TTL_MS = 5000;
let eventsCache: { data: BabyEvent[]; at: number } | null = null;

function invalidateEventsCache(): void {
  eventsCache = null;
}

export async function getAllEvents(): Promise<BabyEvent[]> {
  if (eventsCache && Date.now() - eventsCache.at < EVENTS_TTL_MS) {
    return eventsCache.data;
  }
  try {
    const snapshot = await eventsCollection.orderBy('timestamp', 'desc').get();
    const list: BabyEvent[] = [];
    snapshot.forEach(docSnap => {
      const event = docSnap.data() as BabyEvent;
      if (isActiveEvent(event)) {
        list.push(event);
      }
    });
    eventsCache = { data: list, at: Date.now() };
    return list;
  } catch (err) {
    console.error('Error fetching events from Firestore, trying fallback without ordering:', err);
    try {
      const snapshot = await eventsCollection.get();
      const list: BabyEvent[] = [];
      snapshot.forEach(docSnap => {
        const event = docSnap.data() as BabyEvent;
        if (isActiveEvent(event)) {
          list.push(event);
        }
      });
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      eventsCache = { data: list, at: Date.now() };
      return list;
    } catch (fallbackErr) {
      console.error('Fallback fetch also failed:', fallbackErr);
      return [];
    }
  }
}

const DELETED_ROW_BUFFER = 5;

function logCompositeIndexHint(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  const urlMatch = message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/);
  if (urlMatch) {
    console.error('Firestore composite index may be required:', urlMatch[0]);
    console.error('Copy this URL into bugs/bug_firestore-composite-index.md for one-time setup.');
  }
}

function filterActiveEvents(raw: BabyEvent[]): BabyEvent[] {
  return raw.filter(isActiveEvent);
}

function paginateActiveEvents(
  active: BabyEvent[],
  limit: number,
  fetchedCount: number,
  fetchLimit: number
): { events: BabyEvent[]; nextCursor: string | null } {
  const events = active.slice(0, limit);
  const hasMore = active.length > limit || fetchedCount >= fetchLimit;
  const nextCursor = hasMore && events.length > 0 ? events[events.length - 1].timestamp : null;
  return { events, nextCursor };
}

export async function getEventsPage(opts: {
  limit: number;
  cursorTimestamp?: string;
  type?: string;
}): Promise<{ events: BabyEvent[]; nextCursor: string | null }> {
  const fetchLimit = opts.limit + DELETED_ROW_BUFFER + 1;

  try {
    let query: FirebaseFirestore.Query = eventsCollection.orderBy('timestamp', 'desc');
    if (opts.type) {
      query = query.where('eventType', '==', opts.type);
    }
    if (opts.cursorTimestamp) {
      query = query.startAfter(opts.cursorTimestamp);
    }
    query = query.limit(fetchLimit);

    const snapshot = await query.get();
    const raw: BabyEvent[] = [];
    snapshot.forEach(docSnap => {
      raw.push(docSnap.data() as BabyEvent);
    });
    const active = filterActiveEvents(raw);
    return paginateActiveEvents(active, opts.limit, snapshot.size, fetchLimit);
  } catch (err) {
    logCompositeIndexHint(err);
    console.error('Error fetching events page from Firestore, trying fallback without ordering:', err);

    try {
      let snapshot;
      if (opts.type) {
        snapshot = await eventsCollection.where('eventType', '==', opts.type).get();
      } else {
        snapshot = await eventsCollection.get();
      }

      const list: BabyEvent[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as BabyEvent);
      });

      let active = filterActiveEvents(list);
      active.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (opts.cursorTimestamp) {
        const cursorTime = new Date(opts.cursorTimestamp).getTime();
        active = active.filter(e => new Date(e.timestamp).getTime() < cursorTime);
      }

      return paginateActiveEvents(active, opts.limit, active.length, fetchLimit);
    } catch (fallbackErr) {
      console.error('Fallback events page fetch also failed:', fallbackErr);
      return { events: [], nextCursor: null };
    }
  }
}

export async function getEventById(id: string): Promise<BabyEvent | null> {
  try {
    const docSnap = await eventsCollection.doc(id).get();
    if (!docSnap.exists) {
      return null;
    }
    const event = docSnap.data() as BabyEvent;
    return isActiveEvent(event) ? event : null;
  } catch (err) {
    console.error('Error fetching event by ID from Firestore:', err);
    return null;
  }
}

export async function getOpenSleepSession(): Promise<BabyEvent | null> {
  try {
    const snapshot = await eventsCollection.where('eventType', '==', 'SLEEP').get();

    let openSession: BabyEvent | null = null;
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as BabyEvent;
      if (isActiveEvent(data) && data.sleep && data.sleep.endAt === null) {
        openSession = data;
      }
    });
    return openSession;
  } catch (err) {
    console.error('Error getting open sleep session:', err);
    return null;
  }
}

// Persists the full BabyEvent document as-is; optional payload fields
// (e.g. sleep.loggedByStart, nutrition.topUp, settings.babyProfile) pass through passively.
export async function saveEvent(event: BabyEvent): Promise<BabyEvent> {
  try {
    await eventsCollection.doc(event.id).set(event);
    invalidateEventsCache();
    return event;
  } catch (err) {
    console.error('Error saving event to Firestore:', err);
    throw err;
  }
}

export async function deleteEvent(id: string): Promise<boolean> {
  try {
    const docRef = eventsCollection.doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return false;
    }
    // update() is intentional here — we want to stamp only deletedAt, not overwrite the full document
    await docRef.update({ deletedAt: new Date().toISOString() });
    invalidateEventsCache();
    return true;
  } catch (err) {
    console.error('Error soft-deleting event from Firestore:', err);
    return false;
  }
}

export async function clearAllEvents(before?: string): Promise<boolean> {
  try {
    const snapshot = await eventsCollection.get();
    const promises: Promise<unknown>[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as BabyEvent;
      if (!before || new Date(data.timestamp) <= new Date(before)) {
        promises.push(eventsCollection.doc(docSnap.id).delete());
      }
    });
    await Promise.all(promises);
    invalidateEventsCache();
    return true;
  } catch (err) {
    console.error('Error clearing events from Firestore:', err);
    return false;
  }
}
