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
  const credentialPath = process.env.FIREBASE_ADMIN_CREDENTIALS_PATH;
  if (!credentialPath) {
    throw new Error('FIREBASE_ADMIN_CREDENTIALS_PATH environment variable is required');
  }

  const resolvedPath = path.resolve(process.cwd(), credentialPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Firebase Admin credentials file not found at: ${resolvedPath}`);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  const app = getApps().length === 0
    ? initializeApp({ credential: cert(serviceAccount) })
    : getApps()[0];

  const databaseId = process.env.FIRESTORE_DATABASE_ID;
  const firestore = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

  const databaseLabel = databaseId ?? '(default)';
  console.log(
    `Firestore Admin SDK initialized with project ID: ${serviceAccount.project_id}, database: ${databaseLabel}`
  );

  return firestore;
}

const db = initFirestore();
const householdId = 'shared-household';
const householdRef = db.collection('households').doc(householdId);
const eventsCollection = householdRef.collection('events');

export async function getSettings(): Promise<UserSettings> {
  try {
    const docSnap = await householdRef.get();
    if (!docSnap.exists) {
      await householdRef.set(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    const data = docSnap.data();
    return {
      ...DEFAULT_SETTINGS,
      ...data,
      userId: householdId
    } as UserSettings;
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
    return merged;
  } catch (err) {
    console.error('Error saving settings to Firestore:', err);
    throw err;
  }
}

function isActiveEvent(event: BabyEvent): boolean {
  return !event.deletedAt;
}

export async function getAllEvents(): Promise<BabyEvent[]> {
  try {
    const snapshot = await eventsCollection.orderBy('timestamp', 'desc').get();
    const list: BabyEvent[] = [];
    snapshot.forEach(docSnap => {
      const event = docSnap.data() as BabyEvent;
      if (isActiveEvent(event)) {
        list.push(event);
      }
    });
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
      return list;
    } catch (fallbackErr) {
      console.error('Fallback fetch also failed:', fallbackErr);
      return [];
    }
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
    return true;
  } catch (err) {
    console.error('Error clearing events from Firestore:', err);
    return false;
  }
}
