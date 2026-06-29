/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { Firestore } from '@google-cloud/firestore';
import { BabyEvent, UserSettings } from '../src/types';

const CONFIG_FILE = path.join(process.cwd(), 'firebase-applet-config.json');

let firestore: Firestore;

const DEFAULT_SETTINGS: UserSettings = {
  userId: 'shared-household',
  parentAName: 'אמא',
  parentBName: 'אבא',
  defaultBottleType: 'EXPRESSED_MILK',
  customActivities: ['שגרת בוקר', 'בייבי יוגה', 'שירים', 'טיול בעגלה', 'עיסוי תינוקות']
};

if (fs.existsSync(CONFIG_FILE)) {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    firestore = new Firestore({
      projectId: config.projectId,
      databaseId: config.firestoreDatabaseId || undefined,
    });
    console.log(`Firestore initialized with project ID: ${config.projectId}`);
  } catch (error) {
    console.error('Failed to parse firebase-applet-config.json, using default credentials:', error);
    firestore = new Firestore();
  }
} else {
  console.log('firebase-applet-config.json not found, using default credentials');
  firestore = new Firestore();
}

const householdId = 'shared-household';
const householdDoc = firestore.collection('households').doc(householdId);
const eventsCollection = householdDoc.collection('events');

export async function getSettings(): Promise<UserSettings> {
  try {
    const doc = await householdDoc.get();
    if (!doc.exists) {
      await householdDoc.set(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    const data = doc.data();
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
    await householdDoc.set(merged, { merge: true });
    return merged;
  } catch (err) {
    console.error('Error saving settings to Firestore:', err);
    throw err;
  }
}

export async function getAllEvents(): Promise<BabyEvent[]> {
  try {
    const snapshot = await eventsCollection.orderBy('timestamp', 'desc').get();
    const list: BabyEvent[] = [];
    snapshot.forEach(doc => {
      list.push(doc.data() as BabyEvent);
    });
    return list;
  } catch (err) {
    console.error('Error fetching events from Firestore, trying fallback without ordering:', err);
    try {
      const snapshot = await eventsCollection.get();
      const list: BabyEvent[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data() as BabyEvent);
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
    const snapshot = await eventsCollection
      .where('eventType', '==', 'SLEEP')
      .get();
    
    let openSession: BabyEvent | null = null;
    snapshot.forEach(doc => {
      const data = doc.data() as BabyEvent;
      if (data.sleep && data.sleep.endAt === null) {
        openSession = data;
      }
    });
    return openSession;
  } catch (err) {
    console.error('Error getting open sleep session:', err);
    return null;
  }
}

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
    await eventsCollection.doc(id).delete();
    return true;
  } catch (err) {
    console.error('Error deleting event from Firestore:', err);
    return false;
  }
}
