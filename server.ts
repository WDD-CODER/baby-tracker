/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import ExcelJS from 'exceljs';
import { getSettings, saveSettings, getAllEvents, getOpenSleepSession, saveEvent, deleteEvent, clearAllEvents } from './server/db';
import { BabyEvent, EventType, UserSettings, SleepLocationType, ParentType } from './src/types';

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper to generate unique IDs
function generateId(): string {
  return 'event_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

// Validates the active parent; defaults to PARENT_A silently (never throws for this field)
function parseActiveParent(body: { activeParent?: string }): ParentType {
  if (body.activeParent === 'PARENT_A' || body.activeParent === 'PARENT_B') {
    return body.activeParent;
  }
  return 'PARENT_A';
}

// Helper to format Date to local Israel date (YYYY-MM-DD)
function toIsraelLocalDateStr(isoString: string): string {
  try {
    const d = new Date(isoString);
    // Adjust to Israel timezone offset (UTC+2 or UTC+3 depending on daylight savings)
    // We can do a quick formatting to get the local date
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    };
    const formatter = new Intl.DateTimeFormat('en-CA', options); // returns YYYY-MM-DD
    return formatter.format(d);
  } catch (e) {
    return isoString.split('T')[0];
  }
}

// Helper to format Time to local Israel time (HH:MM)
function toIsraelLocalTimeStr(isoString: string): string {
  try {
    const d = new Date(isoString);
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Jerusalem',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    };
    const formatter = new Intl.DateTimeFormat('he-IL', options);
    return formatter.format(d);
  } catch (e) {
    const parts = isoString.split('T')[1] || '';
    return parts.substring(0, 5);
  }
}

// ==========================================
// 1. API Endpoints: Settings
// ==========================================

app.get('/api/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const newSettings: Partial<UserSettings> = req.body;
    const settings = await saveSettings(newSettings);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ==========================================
// 2. API Endpoints: Sleep State Machine
// ==========================================

app.get('/api/sleep/open', async (req, res) => {
  try {
    const openSession = await getOpenSleepSession();
    res.json(openSession || null);
  } catch (error) {
    res.status(500).json({ error: 'Failed to check open sleep session' });
  }
});

app.post('/api/sleep/toggle', async (req, res) => {
  try {
    const now = new Date().toISOString();
    const loggedBy = req.body.loggedBy || 'PARENT_A';
    const activeParent = parseActiveParent(req.body);
    const startLocation: SleepLocationType = req.body.startLocation || req.body.location || 'CRIB';
    const customStartAt = req.body.customStartAt;
    const quickRecorded = req.body.quickRecorded || false;

    // Find if there's already an open sleep session
    const openSession = await getOpenSleepSession();

    if (openSession) {
      // Toggle wake up: Close the existing sleep session
      if (openSession.sleep) {
        const start = new Date(openSession.sleep.startAt);
        const end = new Date(now);
        const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60)));

        openSession.sleep.endAt = now;
        openSession.sleep.durationMinutes = durationMinutes;
        openSession.sleep.loggedByEnd = activeParent;
        if (quickRecorded) {
          openSession.quickRecorded = true;
        }
        
        await saveEvent(openSession);
        res.json(openSession);
      } else {
        res.status(400).json({ error: 'Invalid sleep data structure' });
      }
    } else {
      // Toggle sleep: Start a new sleep session
      const startAt = customStartAt ? new Date(customStartAt).toISOString() : now;
      const newEvent: BabyEvent = {
        id: generateId(),
        timestamp: startAt,
        eventType: 'SLEEP',
        loggedBy,
        quickRecorded,
        sleep: {
          startAt: startAt,
          endAt: null,
          startLocation,
          loggedByStart: activeParent
        }
      };
      
      await saveEvent(newEvent);
      res.json(newEvent);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle sleep state' });
  }
});

// ==========================================
// 3. API Endpoints: Events (CRUD)
// ==========================================

app.get('/api/events', async (req, res) => {
  try {
    const allEvents = await getAllEvents();
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.cursor as string) || 0;

    // Filter by type if provided
    let filteredEvents = allEvents;
    if (req.query.type) {
      filteredEvents = filteredEvents.filter(e => e.eventType === req.query.type);
    }

    const paginated = filteredEvents.slice(offset, offset + limit);
    const hasMore = offset + limit < filteredEvents.length;

    res.json({
      events: paginated,
      nextCursor: hasMore ? (offset + limit) : null
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

app.post('/api/events', async (req, res) => {
  try {
    const newEvent: BabyEvent = req.body;

    if (!newEvent.eventType) {
      res.status(400).json({ error: 'eventType is required' });
      return;
    }

    newEvent.id = generateId();
    if (!newEvent.timestamp) {
      newEvent.timestamp = new Date().toISOString();
    }

    // Server-side sleep session rule: if creating a sleep session with null endAt, make sure others are closed
    if (newEvent.eventType === 'SLEEP' && newEvent.sleep && newEvent.sleep.endAt === null) {
      const openSession = await getOpenSleepSession();
      if (openSession) {
        openSession.sleep!.endAt = newEvent.timestamp;
        openSession.sleep!.durationMinutes = Math.max(1, Math.round((new Date(newEvent.timestamp).getTime() - new Date(openSession.sleep!.startAt).getTime()) / (1000 * 60)));
        await saveEvent(openSession);
      }
    }

    // Calculate duration for completed sleep sessions
    if (newEvent.eventType === 'SLEEP' && newEvent.sleep && newEvent.sleep.endAt && newEvent.sleep.startAt) {
      const start = new Date(newEvent.sleep.startAt);
      const end = new Date(newEvent.sleep.endAt);
      newEvent.sleep.durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60)));
    }

    await saveEvent(newEvent);
    res.json(newEvent);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create event' });
  }
});

app.put('/api/events/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const allEvents = await getAllEvents();
    const existing = allEvents.find(e => e.id === id);

    if (!existing) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const updatedData: Partial<BabyEvent> = req.body;

    // Merge high level properties
    const merged: BabyEvent = {
      ...existing,
      ...updatedData,
      id // preserve ID
    };

    // Calculate sleep duration if applicable
    if (merged.eventType === 'SLEEP' && merged.sleep) {
      if (merged.sleep.startAt && merged.sleep.endAt) {
        const start = new Date(merged.sleep.startAt);
        const end = new Date(merged.sleep.endAt);
        merged.sleep.durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60)));
      } else {
        merged.sleep.durationMinutes = undefined;
      }
    }

    await saveEvent(merged);
    res.json(merged);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update event' });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const success = await deleteEvent(id);
    if (!success) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    res.json({ success: true, deletedId: id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

app.post('/api/events/clear', async (req, res) => {
  try {
    const { before } = req.body || {};
    const success = await clearAllEvents(before);
    if (!success) {
      res.status(500).json({ error: 'Failed to clear some events' });
      return;
    }
    res.json({ 
      success: true, 
      message: before 
        ? `Logged events before ${before} cleared successfully` 
        : 'All logged events cleared successfully' 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear events' });
  }
});

// ==========================================
// 4. API Endpoints: Aggregations & Stats
// ==========================================

app.get('/api/stats/nutrition', async (req, res) => {
  try {
    const allEvents = await getAllEvents();
    const from = req.query.from ? new Date(req.query.from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();

    // Group nutrition by local date
    const dailyData: { [dateStr: string]: { offered: number, consumed: number, feedsCount: number, breastCount: number, bottleCount: number } } = {};

    allEvents
      .filter(e => e.eventType === 'NUTRITION' && e.nutrition)
      .forEach(e => {
        const tDate = new Date(e.timestamp);
        if (tDate >= from && tDate <= to) {
          const dateStr = toIsraelLocalDateStr(e.timestamp);
          if (!dailyData[dateStr]) {
            dailyData[dateStr] = { offered: 0, consumed: 0, feedsCount: 0, breastCount: 0, bottleCount: 0 };
          }

          const nut = e.nutrition!;
          dailyData[dateStr].feedsCount++;
          if (nut.feedType === 'BOTTLE') {
            dailyData[dateStr].bottleCount++;
            dailyData[dateStr].offered += nut.amountOfferedMl || 0;
            dailyData[dateStr].consumed += nut.amountConsumedMl || 0;
          } else {
            dailyData[dateStr].breastCount++;
          }
        }
      });

    // Format for charts (sorted by date ascending)
    const result = Object.keys(dailyData)
      .sort()
      .map(date => ({
        date,
        offered: dailyData[date].offered,
        consumed: dailyData[date].consumed,
        delta: Math.max(0, dailyData[date].offered - dailyData[date].consumed),
        feedsCount: dailyData[date].feedsCount,
        breastCount: dailyData[date].breastCount,
        bottleCount: dailyData[date].bottleCount
      }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate nutrition stats' });
  }
});

app.get('/api/stats/sleep', async (req, res) => {
  try {
    const allEvents = await getAllEvents();
    const from = req.query.from ? new Date(req.query.from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();

    const dailyData: { [dateStr: string]: { totalMinutes: number, sessionCount: number, sessions: any[] } } = {};

    allEvents
      .filter(e => e.eventType === 'SLEEP' && e.sleep)
      .forEach(e => {
        const s = e.sleep!;
        const start = new Date(s.startAt);
        if (start >= from && start <= to) {
          const dateStr = toIsraelLocalDateStr(s.startAt);
          if (!dailyData[dateStr]) {
            dailyData[dateStr] = { totalMinutes: 0, sessionCount: 0, sessions: [] };
          }

          // Compute duration if closed, otherwise running till now
          let duration = s.durationMinutes || 0;
          if (s.endAt === null) {
            duration = Math.round((new Date().getTime() - start.getTime()) / (1000 * 60));
          }

          dailyData[dateStr].totalMinutes += duration;
          dailyData[dateStr].sessionCount++;
          dailyData[dateStr].sessions.push({
            id: e.id,
            startAt: s.startAt,
            endAt: s.endAt,
            durationMinutes: duration,
            location: s.startLocation,
            loggedBy: e.loggedBy
          });
        }
      });

    const result = Object.keys(dailyData)
      .sort()
      .map(date => ({
        date,
        totalMinutes: dailyData[date].totalMinutes,
        sessionCount: dailyData[date].sessionCount,
        sessions: dailyData[date].sessions.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate sleep stats' });
  }
});

app.get('/api/stats/diapers', async (req, res) => {
  try {
    const allEvents = await getAllEvents();
    const from = req.query.from ? new Date(req.query.from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();

    const dailyData: { [dateStr: string]: { pee: number, poo: number, both: number, total: number, pooColors: string[], pooTextures: string[] } } = {};

    allEvents
      .filter(e => e.eventType === 'DIAPER' && e.diaper)
      .forEach(e => {
        const dDate = new Date(e.timestamp);
        if (dDate >= from && dDate <= to) {
          const dateStr = toIsraelLocalDateStr(e.timestamp);
          if (!dailyData[dateStr]) {
            dailyData[dateStr] = { pee: 0, poo: 0, both: 0, total: 0, pooColors: [], pooTextures: [] };
          }

          const d = e.diaper!;
          dailyData[dateStr].total++;
          if (d.contains === 'PEE') dailyData[dateStr].pee++;
          else if (d.contains === 'POO') dailyData[dateStr].poo++;
          else if (d.contains === 'BOTH') dailyData[dateStr].both++;

          if (d.pooColor) dailyData[dateStr].pooColors.push(d.pooColor);
          if (d.pooTexture) dailyData[dateStr].pooTextures.push(d.pooTexture);
        }
      });

    const result = Object.keys(dailyData)
      .sort()
      .map(date => ({
        date,
        pee: dailyData[date].pee,
        poo: dailyData[date].poo,
        both: dailyData[date].both,
        total: dailyData[date].total,
        pooColors: Array.from(new Set(dailyData[date].pooColors)),
        pooTextures: Array.from(new Set(dailyData[date].pooTextures))
      }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate diaper stats' });
  }
});

app.get('/api/stats/weight', async (req, res) => {
  try {
    const allEvents = await getAllEvents();
    const from = req.query.from ? new Date(req.query.from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();

    const result = allEvents
      .filter(e => e.eventType === 'WEIGHT' && e.weight)
      .filter(e => {
        const d = new Date(e.timestamp);
        return d >= from && d <= to;
      })
      .map(e => ({
        id: e.id,
        timestamp: e.timestamp,
        date: toIsraelLocalDateStr(e.timestamp),
        weightGrams: e.weight!.weightGrams,
        percentile: e.weight!.percentile
      }))
      // Chart needs chronological ascending order
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate weight stats' });
  }
});

// ==========================================
// 5. API Endpoints: Pediatrician Excel Export
// ==========================================

app.get('/api/export/xlsx', async (req, res) => {
  try {
    const allEvents = await getAllEvents();
    const settings = await getSettings();
    const from = req.query.from ? new Date(req.query.from as string) : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();

    const events = allEvents.filter(e => {
      const d = new Date(e.timestamp);
      return d >= from && d <= to;
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Baby Tracker PWA';
    workbook.created = new Date();

    // Setup Fonts, Borders and Fills
    const headerFont = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F5F5B' } }; // Soft dark teal
    const borderStyle = {
      top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
    };

    // Helper to format worksheets
    const styleHeaderRow = (ws: ExcelJS.Worksheet) => {
      const row = ws.getRow(1);
      row.height = 25;
      row.eachCell((cell) => {
        cell.font = headerFont;
        cell.fill = headerFill as any;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
    };

    const applyBorders = (ws: ExcelJS.Worksheet) => {
      ws.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          row.eachCell((cell) => {
            cell.border = borderStyle as any;
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          });
        }
      });
    };

    // ------------------------------------------
    // Sheet 1: Summary / סיכום יומי
    // ------------------------------------------
    const wsSummary = workbook.addWorksheet('Summary - סיכום יומי', { views: [{ rightToLeft: true }] });
    wsSummary.columns = [
      { header: 'תאריך / Date', key: 'date', width: 15 },
      { header: 'הוצע מ״ל / Offered (ml)', key: 'offered', width: 22 },
      { header: 'נצרך מ״ל / Consumed (ml)', key: 'consumed', width: 22 },
      { header: 'הפרש מ״ל / Delta (ml)', key: 'delta', width: 18 },
      { header: 'אחוז צריכה / Consumed %', key: 'consumedPct', width: 22 },
      { header: 'מספר האכלות / Feeds Count', key: 'feeds', width: 22 },
      { header: 'סה״כ שינה / Total Sleep', key: 'sleep', width: 24 },
      { header: 'חיתולי שתן / Pee Diapers', key: 'pee', width: 22 },
      { header: 'חיתולי צואה / Poo Diapers', key: 'poo', width: 22 },
      { header: 'משקל אחרון (גרם) / Latest Weight', key: 'weight', width: 26 },
    ];

    // Collect daily aggregations
    const dailyMap: { [date: string]: any } = {};
    
    // Initialize map for all dates in range
    let current = new Date(from.getTime());
    while (current <= to) {
      const dStr = toIsraelLocalDateStr(current.toISOString());
      dailyMap[dStr] = {
        date: dStr,
        offered: 0,
        consumed: 0,
        feeds: 0,
        sleepMin: 0,
        pee: 0,
        poo: 0,
        weight: ''
      };
      current.setDate(current.getDate() + 1);
    }

    events.forEach(e => {
      const dStr = toIsraelLocalDateStr(e.timestamp);
      if (!dailyMap[dStr]) return;

      if (e.eventType === 'NUTRITION' && e.nutrition) {
        dailyMap[dStr].feeds++;
        if (e.nutrition.feedType === 'BOTTLE') {
          dailyMap[dStr].offered += e.nutrition.amountOfferedMl || 0;
          dailyMap[dStr].consumed += e.nutrition.amountConsumedMl || 0;
        }
      } else if (e.eventType === 'SLEEP' && e.sleep) {
        const dur = e.sleep.durationMinutes || 0;
        dailyMap[dStr].sleepMin += dur;
      } else if (e.eventType === 'DIAPER' && e.diaper) {
        const cont = e.diaper.contains;
        if (cont === 'PEE' || cont === 'BOTH') dailyMap[dStr].pee++;
        if (cont === 'POO' || cont === 'BOTH') dailyMap[dStr].poo++;
      } else if (e.eventType === 'WEIGHT' && e.weight) {
        dailyMap[dStr].weight = e.weight.weightGrams;
      }
    });

    // Populate Sheet 1
    Object.keys(dailyMap).sort().reverse().forEach(dStr => {
      const d = dailyMap[dStr];
      const delta = Math.max(0, d.offered - d.consumed);
      const consumedPct = d.offered > 0 ? Math.round((d.consumed / d.offered) * 100) : 100;
      const sleepHours = d.sleepMin > 0 ? `${Math.floor(d.sleepMin / 60)}ש ${d.sleepMin % 60}ד` : '0';

      const row = wsSummary.addRow({
        date: dStr,
        offered: d.offered || '',
        consumed: d.consumed || '',
        delta: d.offered > 0 ? delta : '',
        consumedPct: d.offered > 0 ? `${consumedPct}%` : '',
        feeds: d.feeds || '',
        sleep: sleepHours,
        pee: d.pee || '',
        poo: d.poo || '',
        weight: d.weight || ''
      });

      // Conditional formatting for low consumption (below 75%)
      if (d.offered > 0 && consumedPct < 75) {
        const cell = row.getCell('consumedPct');
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFC7CE' } // Soft Red
        } as any;
        cell.font = { color: { argb: 'FF9C0006' }, bold: true };
      }
    });

    // ------------------------------------------
    // Sheet 2: Feeds / האכלות
    // ------------------------------------------
    const wsFeeds = workbook.addWorksheet('Feeds - האכלות', { views: [{ rightToLeft: true }] });
    wsFeeds.columns = [
      { header: 'תאריך / Date', key: 'date', width: 15 },
      { header: 'שעה / Time', key: 'time', width: 12 },
      { header: 'סוג האכלה / Type', key: 'type', width: 18 },
      { header: 'כמות שהוצעה (מ״ל) / Offered', key: 'offered', width: 22 },
      { header: 'כמות שנצרכה (מ״ל) / Consumed', key: 'consumed', width: 22 },
      { header: 'החזרה / Spit Up', key: 'spitUp', width: 18 },
      { header: 'צד הנקה / Breast Side', key: 'breastSide', width: 18 },
      { header: 'משך (דקות) / Duration (m)', key: 'duration', width: 18 },
      { header: 'נרשם על ידי / Logged By', key: 'loggedBy', width: 18 },
      { header: 'הערה / Notes', key: 'notes', width: 30 }
    ];

    events.filter(e => e.eventType === 'NUTRITION' && e.nutrition).forEach(e => {
      const n = e.nutrition!;
      wsFeeds.addRow({
        date: toIsraelLocalDateStr(e.timestamp),
        time: toIsraelLocalTimeStr(e.timestamp),
        type: n.feedType === 'BOTTLE' ? (n.bottleLiquidType === 'EXPRESSED_MILK' ? 'חלב שאוב' : 'תמ״ל (פורמולה)') : 'הנקה',
        offered: n.amountOfferedMl || '',
        consumed: n.amountConsumedMl || '',
        spitUp: n.spitUp === 'LIGHT' ? 'פליטה קלה' : (n.spitUp === 'HEAVY_VOMIT' ? 'הקאה' : 'אין'),
        breastSide: n.breastSide === 'LEFT' ? 'שמאל' : (n.breastSide === 'RIGHT' ? 'ימין' : (n.breastSide === 'BOTH' ? 'שני הצדדים' : '')),
        duration: n.durationMinutes || '',
        loggedBy: e.loggedBy === 'PARENT_A' ? (settings.parentAName || 'אמא') : (settings.parentBName || 'אבא'),
        notes: e.notes || ''
      });
    });

    // ------------------------------------------
    // Sheet 3: Sleep / שינה
    // ------------------------------------------
    const wsSleep = workbook.addWorksheet('Sleep - שינה', { views: [{ rightToLeft: true }] });
    wsSleep.columns = [
      { header: 'תאריך / Date', key: 'date', width: 15 },
      { header: 'שעת תחילת שינה / Start Time', key: 'start', width: 20 },
      { header: 'שעת סיום שינה / End Time', key: 'end', width: 20 },
      { header: 'משך (דקות) / Duration (m)', key: 'duration', width: 18 },
      { header: 'משך (שעות) / Duration (h)', key: 'durationHours', width: 18 },
      { header: 'מיקום שינה / Location', key: 'location', width: 18 },
      { header: 'נרשם על ידי / Logged By', key: 'loggedBy', width: 18 },
      { header: 'הערה / Notes', key: 'notes', width: 30 }
    ];

    events.filter(e => e.eventType === 'SLEEP' && e.sleep).forEach(e => {
      const s = e.sleep!;
      const dur = s.durationMinutes || 0;
      wsSleep.addRow({
        date: toIsraelLocalDateStr(s.startAt),
        start: toIsraelLocalTimeStr(s.startAt),
        end: s.endAt ? toIsraelLocalTimeStr(s.endAt) : 'ישן כעת',
        duration: dur || '',
        durationHours: dur > 0 ? (dur / 60).toFixed(1) : '',
        location: s.startLocation === 'CRIB' ? 'מיטה / עריסה' : (s.startLocation === 'HANDS' ? 'על הידיים' : (s.startLocation === 'CARRIER' ? 'מנשא' : 'עגלה')),
        loggedBy: e.loggedBy === 'PARENT_A' ? (settings.parentAName || 'אמא') : (settings.parentBName || 'אבא'),
        notes: e.notes || ''
      });
    });

    // ------------------------------------------
    // Sheet 4: Diapers / חיתולים
    // ------------------------------------------
    const wsDiapers = workbook.addWorksheet('Diapers - חיתולים', { views: [{ rightToLeft: true }] });
    wsDiapers.columns = [
      { header: 'תאריך / Date', key: 'date', width: 15 },
      { header: 'שעה / Time', key: 'time', width: 12 },
      { header: 'תכולה / Contains', key: 'contains', width: 18 },
      { header: 'רטיבות שתן / Pee Volume', key: 'pee', width: 18 },
      { header: 'כמות צואה / Poo Amount', key: 'pooAmount', width: 18 },
      { header: 'צבע צואה / Poo Color', key: 'pooColor', width: 20 },
      { header: 'מרקם צואה / Poo Texture', key: 'pooTexture', width: 18 },
      { header: 'נרשם על ידי / Logged By', key: 'loggedBy', width: 18 },
      { header: 'הערה / Notes', key: 'notes', width: 30 }
    ];

    events.filter(e => e.eventType === 'DIAPER' && e.diaper).forEach(e => {
      const d = e.diaper!;
      wsDiapers.addRow({
        date: toIsraelLocalDateStr(e.timestamp),
        time: toIsraelLocalTimeStr(e.timestamp),
        contains: d.contains === 'PEE' ? 'שתן' : (d.contains === 'POO' ? 'צואה' : 'שתן + צואה'),
        pee: d.peeVolume === 'LIGHT' ? 'קל' : (d.peeVolume === 'HEAVY_SOAKED' ? 'רטוב כבד' : ''),
        pooAmount: d.pooAmount === 'SMALL' ? 'קטן' : (d.pooAmount === 'MEDIUM' ? 'בינוני' : (d.pooAmount === 'LARGE_OVERFLOW' ? 'גדול מאוד / גלישה' : '')),
        pooColor: d.pooColor === 'YELLOW_MUSTARD' ? 'צהוב חרדל' : (d.pooColor === 'GREEN' ? 'ירוק' : (d.pooColor === 'BROWN' ? 'חום' : '')),
        pooTexture: d.pooTexture === 'LIQUID' ? 'נוזלי' : (d.pooTexture === 'SEEDY' ? 'גרגרי' : (d.pooTexture === 'PASTY' ? 'משחתי' : (d.pooTexture === 'HARD' ? 'קשה' : ''))),
        loggedBy: e.loggedBy === 'PARENT_A' ? (settings.parentAName || 'אמא') : (settings.parentBName || 'אבא'),
        notes: e.notes || ''
      });
    });

    // ------------------------------------------
    // Sheet 5: Weight / משקל
    // ------------------------------------------
    const wsWeight = workbook.addWorksheet('Weight - משקל', { views: [{ rightToLeft: true }] });
    wsWeight.columns = [
      { header: 'תאריך / Date', key: 'date', width: 15 },
      { header: 'שעה / Time', key: 'time', width: 12 },
      { header: 'משקל (גרם) / Weight (g)', key: 'weight', width: 22 },
      { header: 'משקל (ק״ג) / Weight (kg)', key: 'weightKg', width: 22 },
      { header: 'אחוזון / Percentile', key: 'percentile', width: 18 },
      { header: 'נרשם על ידי / Logged By', key: 'loggedBy', width: 18 },
      { header: 'הערה / Notes', key: 'notes', width: 30 }
    ];

    events.filter(e => e.eventType === 'WEIGHT' && e.weight).forEach(e => {
      const w = e.weight!;
      wsWeight.addRow({
        date: toIsraelLocalDateStr(e.timestamp),
        time: toIsraelLocalTimeStr(e.timestamp),
        weight: w.weightGrams,
        weightKg: (w.weightGrams / 1000).toFixed(3),
        percentile: w.percentile || '',
        loggedBy: e.loggedBy === 'PARENT_A' ? (settings.parentAName || 'אמא') : (settings.parentBName || 'אבא'),
        notes: e.notes || ''
      });
    });

    // ------------------------------------------
    // Sheet 6: Pumping / שאיבת חלב
    // ------------------------------------------
    const wsPumping = workbook.addWorksheet('Pumping - שאיבות', { views: [{ rightToLeft: true }] });
    wsPumping.columns = [
      { header: 'תאריך / Date', key: 'date', width: 15 },
      { header: 'שעה / Time', key: 'time', width: 12 },
      { header: 'שמאל (מ״ל) / Left (ml)', key: 'left', width: 20 },
      { header: 'ימין (מ״ל) / Right (ml)', key: 'right', width: 20 },
      { header: 'סה״ך (מ״ל) / Total (ml)', key: 'total', width: 20 },
      { header: 'נרשם על ידי / Logged By', key: 'loggedBy', width: 18 },
      { header: 'הערה / Notes', key: 'notes', width: 30 }
    ];

    events.filter(e => e.eventType === 'PUMPING' && e.pumping).forEach(e => {
      const p = e.pumping!;
      wsPumping.addRow({
        date: toIsraelLocalDateStr(e.timestamp),
        time: toIsraelLocalTimeStr(e.timestamp),
        left: p.leftAmountMl,
        right: p.rightAmountMl,
        total: p.leftAmountMl + p.rightAmountMl,
        loggedBy: e.loggedBy === 'PARENT_A' ? (settings.parentAName || 'אמא') : (settings.parentBName || 'אבא'),
        notes: e.notes || ''
      });
    });

    // ------------------------------------------
    // Sheet 7: Vomiting / פליטות
    // ------------------------------------------
    const wsVomiting = workbook.addWorksheet('Vomiting - פליטות', { views: [{ rightToLeft: true }] });
    wsVomiting.columns = [
      { header: 'תאריך / Date', key: 'date', width: 15 },
      { header: 'שעה / Time', key: 'time', width: 12 },
      { header: 'גודל פליטה / Spit Up Size', key: 'size', width: 22 },
      { header: 'נרשם על ידי / Logged By', key: 'loggedBy', width: 18 },
      { header: 'הערה / Notes', key: 'notes', width: 30 }
    ];

    events.filter(e => e.eventType === 'VOMITING' && e.vomiting).forEach(e => {
      const v = e.vomiting!;
      wsVomiting.addRow({
        date: toIsraelLocalDateStr(e.timestamp),
        time: toIsraelLocalTimeStr(e.timestamp),
        size: v.size === 'SMALL' ? 'קטנה' : (v.size === 'MEDIUM' ? 'בינונית' : 'גדולה'),
        loggedBy: e.loggedBy === 'PARENT_A' ? (settings.parentAName || 'אמא') : (settings.parentBName || 'אבא'),
        notes: e.notes || ''
      });
    });

    // Style and validate all sheets
    [wsSummary, wsFeeds, wsSleep, wsDiapers, wsWeight, wsPumping, wsVomiting].forEach(ws => {
      styleHeaderRow(ws);
      applyBorders(ws);
    });

    // Stream download response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=baby_tracker_report_${toIsraelLocalDateStr(new Date().toISOString())}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Failed to export Excel report:', error);
    res.status(500).json({ error: 'Failed to generate Excel report' });
  }
});


// ==========================================
// Vite Dev Server / Static Hosting Integration
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
