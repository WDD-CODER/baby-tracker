/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  collection, 
  query, 
  orderBy, 
  where, 
  deleteDoc, 
  Firestore 
} from 'firebase/firestore';
import { BabyEvent, UserSettings } from '../src/types';

const CONFIG_FILE = path.join(process.cwd(), 'firebase-applet-config.json');

let db: Firestore;

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
    const firebaseConfig = {
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    };
    
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    // Initialize Firestore with specific database ID if configured
    db = getFirestore(app, config.firestoreDatabaseId || undefined);
    console.log(`Firestore client SDK initialized with project ID: ${config.projectId}, database: ${config.firestoreDatabaseId}`);
  } catch (error) {
    console.error('Failed to parse firebase-applet-config.json, falling back to empty config:', error);
    const app = initializeApp({ projectId: 'placeholder' });
    db = getFirestore(app);
  }
} else {
  console.log('firebase-applet-config.json not found, falling back to empty config');
  const app = initializeApp({ projectId: 'placeholder' });
  db = getFirestore(app);
}

const householdId = 'shared-household';

export async function getSettings(): Promise<UserSettings> {
  try {
    const docRef = doc(db, 'households', householdId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      await setDoc(docRef, DEFAULT_SETTINGS);
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
    const docRef = doc(db, 'households', householdId);
    await setDoc(docRef, merged, { merge: true });
    return merged;
  } catch (err) {
    console.error('Error saving settings to Firestore:', err);
    throw err;
  }
}

export async function getAllEvents(): Promise<BabyEvent[]> {
  try {
    const eventsColl = collection(db, 'households', householdId, 'events');
    const q = query(eventsColl, orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    const list: BabyEvent[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as BabyEvent);
    });
    return list;
  } catch (err) {
    console.error('Error fetching events from Firestore, trying fallback without ordering:', err);
    try {
      const eventsColl = collection(db, 'households', householdId, 'events');
      const snapshot = await getDocs(eventsColl);
      const list: BabyEvent[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as BabyEvent);
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
    const eventsColl = collection(db, 'households', householdId, 'events');
    const q = query(eventsColl, where('eventType', '==', 'SLEEP'));
    const snapshot = await getDocs(q);
    
    let openSession: BabyEvent | null = null;
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as BabyEvent;
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
    const docRef = doc(db, 'households', householdId, 'events', event.id);
    await setDoc(docRef, event);
    return event;
  } catch (err) {
    console.error('Error saving event to Firestore:', err);
    throw err;
  }
}

export async function deleteEvent(id: string): Promise<boolean> {
  try {
    const docRef = doc(db, 'households', householdId, 'events', id);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error('Error deleting event from Firestore:', err);
    return false;
  }
}

export async function clearAllEvents(before?: string): Promise<boolean> {
  try {
    const eventsColl = collection(db, 'households', householdId, 'events');
    const snapshot = await getDocs(eventsColl);
    const promises: Promise<void>[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as BabyEvent;
      if (!before || new Date(data.timestamp) <= new Date(before)) {
        promises.push(deleteDoc(doc(db, 'households', householdId, 'events', docSnap.id)));
      }
    });
    await Promise.all(promises);
    return true;
  } catch (err) {
    console.error('Error clearing events from Firestore:', err);
    return false;
  }
}
