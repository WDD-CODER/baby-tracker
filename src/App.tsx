/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Baby, 
  Clock, 
  Moon, 
  Trash2, 
  Plus, 
  Minus, 
  Check, 
  Calendar, 
  Download, 
  FileSpreadsheet, 
  Settings, 
  TrendingUp, 
  ChevronRight, 
  ChevronLeft,
  User, 
  Droplet, 
  Activity, 
  Scale, 
  Sparkles,
  RefreshCw,
  X,
  PlusCircle,
  HelpCircle
} from 'lucide-react';
import { BabyEvent, UserSettings, ParentType, EventType, SleepLocationType, DiaperContentType } from './types';

export default function App() {
  // App state
  const [activeTab, setActiveTab] = useState<'log' | 'timeline' | 'dashboards' | 'settings'>('log');
  const [events, setEvents] = useState<BabyEvent[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const getLocalDatetimeString = (date = new Date()) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const [settings, setSettings] = useState<UserSettings>({
    userId: 'shared-household',
    parentAName: 'אמא',
    parentBName: 'אבא',
    defaultBottleType: 'EXPRESSED_MILK',
    customActivities: ['שגרת בוקר', 'בייבי יוגה', 'שירים', 'טיול בעגלה', 'עיסוי תינוקות']
  });
  const [openSleepSession, setOpenSleepSession] = useState<BabyEvent | null>(null);
  const [activeParent, setActiveParent] = useState<ParentType>('PARENT_A');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active Logging bottom sheets
  const [activeSheet, setActiveSheet] = useState<'bottle' | 'diaper' | 'activity' | 'weight' | 'edit' | null>(null);
  const [editingEvent, setEditingEvent] = useState<BabyEvent | null>(null);

  // Stats Data
  const [nutritionStats, setNutritionStats] = useState<any[]>([]);
  const [sleepStats, setSleepStats] = useState<any[]>([]);
  const [diaperStats, setDiaperStats] = useState<any[]>([]);
  const [weightStats, setWeightStats] = useState<any[]>([]);
  const [dashboardDays, setDashboardDays] = useState<number>(7);

  // Timer state for in-progress sleep
  const [sleepDurationStr, setSleepDurationStr] = useState<string>('00:00');

  // Input states for form entry
  const [bottleFeedType, setBottleFeedType] = useState<'BOTTLE' | 'BREAST'>('BOTTLE');
  const [bottleLiquidType, setBottleLiquidType] = useState<'EXPRESSED_MILK' | 'FORMULA'>('EXPRESSED_MILK');
  const [amountOfferedMl, setAmountOfferedMl] = useState<number>(120);
  const [amountConsumedMl, setAmountConsumedMl] = useState<number>(110);
  const [breastSide, setBreastSide] = useState<'LEFT' | 'RIGHT' | 'BOTH'>('BOTH');
  const [breastDuration, setBreastDuration] = useState<number>(15);
  const [spitUp, setSpitUp] = useState<'NONE' | 'LIGHT' | 'HEAVY_VOMIT'>('NONE');
  
  const [diaperContains, setDiaperContains] = useState<DiaperContentType>('PEE');
  const [peeVolume, setPeeVolume] = useState<'LIGHT' | 'HEAVY_SOAKED'>('LIGHT');
  const [pooAmount, setPooAmount] = useState<'SMALL' | 'MEDIUM' | 'LARGE_OVERFLOW'>('MEDIUM');
  const [pooColor, setPooColor] = useState<'YELLOW_MUSTARD' | 'GREEN' | 'BROWN'>('YELLOW_MUSTARD');
  const [pooTexture, setPooTexture] = useState<'LIQUID' | 'SEEDY' | 'PASTY' | 'HARD'>('SEEDY');

  const [activityName, setActivityName] = useState<string>('');
  const [cryingIntensity, setCryingIntensity] = useState<number>(1);
  const [newActivityNameInput, setNewActivityNameInput] = useState<string>('');

  const [weightGrams, setWeightGrams] = useState<number>(3500);
  const [percentile, setPercentile] = useState<number | ''>('');
  
  const [noteText, setNoteText] = useState<string>('');
  const [customTimestamp, setCustomTimestamp] = useState<string>('');
  const [showNoteField, setShowNoteField] = useState(false);

  // Settings modification states
  const [parentANameInput, setParentANameInput] = useState('אמא');
  const [parentBNameInput, setParentBNameInput] = useState('אבא');
  const [defaultBottleTypeInput, setDefaultBottleTypeInput] = useState<'EXPRESSED_MILK' | 'FORMULA'>('EXPRESSED_MILK');

  // Export states
  const [exportFromDate, setExportFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  });
  const [exportToDate, setExportToDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Initialization
  useEffect(() => {
    // Load parent from localStorage if exists
    const storedParent = localStorage.getItem('bt_active_parent');
    if (storedParent === 'PARENT_A' || storedParent === 'PARENT_B') {
      setActiveParent(storedParent);
    }
    fetchSettings();
    fetchEvents();
    checkOpenSleepSession();
  }, []);

  // Reset carousel to newest when entering the main tab
  useEffect(() => {
    if (activeTab === 'log') {
      setCarouselIndex(0);
    }
  }, [activeTab]);

  // Sync sleep session timer
  useEffect(() => {
    if (!openSleepSession) {
      setSleepDurationStr('00:00');
      return;
    }

    const updateTimer = () => {
      const start = new Date(openSleepSession.sleep?.startAt || openSleepSession.timestamp);
      const diffMs = Date.now() - start.getTime();
      if (diffMs < 0) {
        setSleepDurationStr('00:00');
        return;
      }
      const totalMinutes = Math.floor(diffMs / (1000 * 60));
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      setSleepDurationStr(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 15000); // update every 15s
    return () => clearInterval(interval);
  }, [openSleepSession]);

  // Load stats when dashboard days or active tab changes
  useEffect(() => {
    if (activeTab === 'dashboards') {
      fetchStats();
    }
  }, [activeTab, dashboardDays]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // API calls
  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setParentANameInput(data.parentAName);
        setParentBNameInput(data.parentBName);
        setDefaultBottleTypeInput(data.defaultBottleType);
        setBottleLiquidType(data.defaultBottleType);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchEvents() {
    try {
      setLoading(true);
      const res = await fetch('/api/events?limit=60');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events);
      }
    } catch (e) {
      showToast('שגיאה בטעינת הנתונים מהשרת');
    } finally {
      setLoading(false);
    }
  }

  async function checkOpenSleepSession() {
    try {
      const res = await fetch('/api/sleep/open');
      if (res.ok) {
        const data = await res.json();
        setOpenSleepSession(data);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchStats() {
    try {
      const from = new Date();
      from.setDate(from.getDate() - dashboardDays);
      const fromStr = from.toISOString();

      const [nutRes, sleepRes, diaperRes, weightRes] = await Promise.all([
        fetch(`/api/stats/nutrition?from=${fromStr}`),
        fetch(`/api/stats/sleep?from=${fromStr}`),
        fetch(`/api/stats/diapers?from=${fromStr}`),
        fetch(`/api/stats/weight?from=${fromStr}`)
      ]);

      if (nutRes.ok) setNutritionStats(await nutRes.json());
      if (sleepRes.ok) setSleepStats(await sleepRes.json());
      if (diaperRes.ok) setDiaperStats(await diaperRes.json());
      if (weightRes.ok) setWeightStats(await weightRes.json());
    } catch (e) {
      console.error('Error fetching statistics', e);
    }
  }

  const handleParentChange = (parent: ParentType) => {
    setActiveParent(parent);
    localStorage.setItem('bt_active_parent', parent);
    showToast(`המשתמש הוחלף ל-${parent === 'PARENT_A' ? settings.parentAName : settings.parentBName}`);
  };

  // State machine sleep/wake trigger
  const handleSleepToggle = async (location: SleepLocationType = 'CRIB') => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/sleep/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loggedBy: activeParent,
          startLocation: location,
          customStartAt: customTimestamp ? new Date(customTimestamp).toISOString() : undefined
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.sleep?.endAt) {
          // Closed session
          setOpenSleepSession(null);
          showToast('השינה הסתיימה! התיעוד נשמר בהצלחה');
        } else {
          // Started session
          setOpenSleepSession(data);
          showToast('השינה החלה! שעון מעקב מופעל');
        }
        fetchEvents();
        setActiveSheet(null);
      }
    } catch (e) {
      showToast('שגיאה בשינוי מצב שינה');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const timestamp = customTimestamp ? new Date(customTimestamp).toISOString() : new Date().toISOString();

    let payload: Partial<BabyEvent> = {
      timestamp,
      loggedBy: activeParent,
      notes: noteText.trim() || undefined
    };

    if (activeSheet === 'bottle') {
      payload.eventType = 'NUTRITION';
      payload.nutrition = {
        feedType: bottleFeedType,
        bottleLiquidType: bottleFeedType === 'BOTTLE' ? bottleLiquidType : undefined,
        amountOfferedMl: bottleFeedType === 'BOTTLE' ? amountOfferedMl : undefined,
        amountConsumedMl: bottleFeedType === 'BOTTLE' ? amountConsumedMl : undefined,
        breastSide: bottleFeedType === 'BREAST' ? breastSide : undefined,
        durationMinutes: bottleFeedType === 'BREAST' ? breastDuration : undefined,
        spitUp: spitUp !== 'NONE' ? spitUp : undefined
      };
    } else if (activeSheet === 'diaper') {
      payload.eventType = 'DIAPER';
      payload.diaper = {
        contains: diaperContains,
        peeVolume: diaperContains !== 'POO' ? peeVolume : undefined,
        pooAmount: diaperContains !== 'PEE' ? pooAmount : undefined,
        pooColor: diaperContains !== 'PEE' ? pooColor : undefined,
        pooTexture: diaperContains !== 'PEE' ? pooTexture : undefined
      };
    } else if (activeSheet === 'activity') {
      payload.eventType = 'ACTIVITY';
      payload.activity = {
        activityName: activityName || settings.customActivities[0] || 'משחק',
        cryingIntensity: cryingIntensity > 0 ? cryingIntensity : undefined
      };
    } else if (activeSheet === 'weight') {
      payload.eventType = 'WEIGHT';
      payload.weight = {
        weightGrams,
        percentile: percentile !== '' ? Number(percentile) : undefined
      };
    }

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast('האירוע נשמר בהצלחה');
        resetForm();
        fetchEvents();
        setActiveSheet(null);
      } else {
        showToast('תקלה בשמירת הנתונים');
      }
    } catch (err) {
      showToast('לא ניתן להתחבר לשרת');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;
    setSubmitting(true);

    const timestamp = customTimestamp ? new Date(customTimestamp).toISOString() : editingEvent.timestamp;

    let payload: Partial<BabyEvent> = {
      timestamp,
      loggedBy: editingEvent.loggedBy,
      notes: noteText.trim() || undefined
    };

    if (editingEvent.eventType === 'NUTRITION' && editingEvent.nutrition) {
      payload.nutrition = {
        ...editingEvent.nutrition,
        feedType: bottleFeedType,
        bottleLiquidType: bottleFeedType === 'BOTTLE' ? bottleLiquidType : undefined,
        amountOfferedMl: bottleFeedType === 'BOTTLE' ? amountOfferedMl : undefined,
        amountConsumedMl: bottleFeedType === 'BOTTLE' ? amountConsumedMl : undefined,
        breastSide: bottleFeedType === 'BREAST' ? breastSide : undefined,
        durationMinutes: bottleFeedType === 'BREAST' ? breastDuration : undefined,
        spitUp
      };
    } else if (editingEvent.eventType === 'DIAPER' && editingEvent.diaper) {
      payload.diaper = {
        contains: diaperContains,
        peeVolume: diaperContains !== 'POO' ? peeVolume : undefined,
        pooAmount: diaperContains !== 'PEE' ? pooAmount : undefined,
        pooColor: diaperContains !== 'PEE' ? pooColor : undefined,
        pooTexture: diaperContains !== 'PEE' ? pooTexture : undefined
      };
    } else if (editingEvent.eventType === 'ACTIVITY' && editingEvent.activity) {
      payload.activity = {
        activityName,
        cryingIntensity: cryingIntensity > 0 ? cryingIntensity : undefined
      };
    } else if (editingEvent.eventType === 'WEIGHT' && editingEvent.weight) {
      payload.weight = {
        weightGrams,
        percentile: percentile !== '' ? Number(percentile) : undefined
      };
    } else if (editingEvent.eventType === 'SLEEP' && editingEvent.sleep) {
      payload.sleep = {
        ...editingEvent.sleep,
        startLocation: editingEvent.sleep.startLocation
      };
    }

    try {
      const res = await fetch(`/api/events/${editingEvent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast('האירוע עודכן בהצלחה');
        resetForm();
        fetchEvents();
        checkOpenSleepSession();
        setActiveSheet(null);
      } else {
        showToast('תקלה בעדכון האירוע');
      }
    } catch (err) {
      showToast('שגיאת תקשורת עם השרת');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('האם למחוק אירוע זה לצמיתות?')) return;
    try {
      const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('האירוע נמחק בהצלחה');
        fetchEvents();
        checkOpenSleepSession();
        setActiveSheet(null);
      }
    } catch (err) {
      showToast('תקלה במחיקת האירוע');
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentAName: parentANameInput,
          parentBName: parentBNameInput,
          defaultBottleType: defaultBottleTypeInput
        })
      });

      if (res.ok) {
        showToast('ההגדרות עודכנו בהצלחה');
        fetchSettings();
      }
    } catch (err) {
      showToast('שגיאה בעדכון ההגדרות');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCustomActivity = async () => {
    if (!newActivityNameInput.trim()) return;
    const updatedActivities = [...settings.customActivities, newActivityNameInput.trim()];
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customActivities: updatedActivities
        })
      });
      if (res.ok) {
        setNewActivityNameInput('');
        showToast('הפעילות החדשה נוספה לרשימה');
        fetchSettings();
      }
    } catch (e) {
      showToast('תקלה בהוספת פעילות');
    }
  };

  const handleDeleteCustomActivity = async (name: string) => {
    const updatedActivities = settings.customActivities.filter(a => a !== name);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customActivities: updatedActivities
        })
      });
      if (res.ok) {
        showToast('הפעילות הוסרה מהרשימה');
        fetchSettings();
      }
    } catch (e) {
      showToast('תקלה בהסרת פעילות');
    }
  };

  const triggerExcelDownload = () => {
    window.open(`/api/export/xlsx?from=${exportFromDate}&to=${exportToDate}`, '_blank');
    showToast('הדוח נוצר ונשלח להורדה כקובץ Excel');
  };

  const resetForm = () => {
    setNoteText('');
    setCustomTimestamp(getLocalDatetimeString());
    setShowNoteField(true);
    setEditingEvent(null);
    
    // Set nutrition defaults
    setBottleFeedType('BOTTLE');
    setBottleLiquidType(settings.defaultBottleType);
    setAmountOfferedMl(120);
    setAmountConsumedMl(110);
    setBreastSide('BOTH');
    setBreastDuration(15);
    setSpitUp('NONE');

    // Diaper defaults
    setDiaperContains('PEE');
    setPeeVolume('LIGHT');
    setPooAmount('MEDIUM');
    setPooColor('YELLOW_MUSTARD');
    setPooTexture('SEEDY');

    // Activity defaults
    setActivityName(settings.customActivities[0] || 'משחק');
    setCryingIntensity(0);

    // Weight defaults
    // Set to latest weight if exists
    const latestWeightEvent = events.find(e => e.eventType === 'WEIGHT' && e.weight);
    setWeightGrams(latestWeightEvent?.weight?.weightGrams || 3500);
    setPercentile(latestWeightEvent?.weight?.percentile || '');
  };

  const openAddSheet = (type: 'bottle' | 'diaper' | 'activity' | 'weight') => {
    resetForm();
    setActiveSheet(type);
  };

  const openEditSheet = (event: BabyEvent) => {
    resetForm();
    setEditingEvent(event);
    setActiveSheet('edit');
    setCustomTimestamp(event.timestamp.slice(0, 16));
    setNoteText(event.notes || '');

    if (event.eventType === 'NUTRITION' && event.nutrition) {
      setBottleFeedType(event.nutrition.feedType);
      if (event.nutrition.feedType === 'BOTTLE') {
        setBottleLiquidType(event.nutrition.bottleLiquidType || 'EXPRESSED_MILK');
        setAmountOfferedMl(event.nutrition.amountOfferedMl || 120);
        setAmountConsumedMl(event.nutrition.amountConsumedMl || 110);
      } else {
        setBreastSide(event.nutrition.breastSide || 'BOTH');
        setBreastDuration(event.nutrition.durationMinutes || 15);
      }
      setSpitUp(event.nutrition.spitUp || 'NONE');
    } else if (event.eventType === 'DIAPER' && event.diaper) {
      setDiaperContains(event.diaper.contains);
      if (event.diaper.peeVolume) setPeeVolume(event.diaper.peeVolume);
      if (event.diaper.pooAmount) setPooAmount(event.diaper.pooAmount);
      if (event.diaper.pooColor) setPooColor(event.diaper.pooColor);
      if (event.diaper.pooTexture) setPooTexture(event.diaper.pooTexture);
    } else if (event.eventType === 'ACTIVITY' && event.activity) {
      setActivityName(event.activity.activityName);
      setCryingIntensity(event.activity.cryingIntensity || 0);
    } else if (event.eventType === 'WEIGHT' && event.weight) {
      setWeightGrams(event.weight.weightGrams);
      setPercentile(event.weight.percentile || '');
    }
  };

  // Helper formats for timestamps
  const formatTimeAgo = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMin = Math.floor(diffMs / (1000 * 60));
    if (diffMin < 1) return 'ממש עכשיו';
    if (diffMin < 60) return `לפני ${diffMin} דק׳`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) {
      const remainingMins = diffMin % 60;
      return `לפני ${diffHours} ש׳ ו-${remainingMins} דק׳`;
    }
    return `לפני ${Math.floor(diffHours / 24)} ימים`;
  };

  const getHeberwTimeStr = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch (e) {
      return isoString.split('T')[1]?.substring(0, 5) || '';
    }
  };

  const getHebrewDateStr = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('he-IL', { weekday: 'short', month: 'numeric', day: 'numeric' });
    } catch (e) {
      return isoString.split('T')[0];
    }
  };

  // Aggregation computations for the quick status bar
  const getLatestEventByType = (type: EventType) => {
    return events.find(e => e.eventType === type);
  };

  const latestNutrition = getLatestEventByType('NUTRITION');
  const latestDiaper = getLatestEventByType('DIAPER');

  // Daily totals for nutrition summary
  const getTodayNutritionSummary = () => {
    const today = new Date().toISOString().split('T')[0];
    let offered = 0;
    let consumed = 0;
    let feedsCount = 0;

    events.forEach(e => {
      const eventDate = e.timestamp.split('T')[0];
      if (eventDate === today && e.eventType === 'NUTRITION' && e.nutrition) {
        feedsCount++;
        if (e.nutrition.feedType === 'BOTTLE') {
          offered += e.nutrition.amountOfferedMl || 0;
          consumed += e.nutrition.amountConsumedMl || 0;
        }
      }
    });

    return { offered, consumed, feedsCount };
  };

  const todaySummary = getTodayNutritionSummary();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none pb-24" dir="rtl">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-indigo-600 text-white font-bold px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-indigo-400 animate-bounce">
          <Sparkles className="w-5 h-5 text-indigo-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Panel */}
      <header className="bg-slate-900/85 border-b border-slate-800/80 px-4 py-4 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-extrabold text-base border border-indigo-400/30">
              BT
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-100 tracking-tight leading-none">מעקב תינוק</h1>
              <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">
                רפואי • {settings.parentAName} ו-{settings.parentBName}
              </p>
            </div>
          </div>

          {/* Parents Avatars & Picker */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleParentChange('PARENT_A')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                activeParent === 'PARENT_A' 
                  ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 shadow-lg' 
                  : 'bg-slate-800 text-slate-400 border border-slate-700/60'
              }`}
            >
              👩‍⚕️ {settings.parentAName}
            </button>
            <button 
              onClick={() => handleParentChange('PARENT_B')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                activeParent === 'PARENT_B' 
                  ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 shadow-lg' 
                  : 'bg-slate-800 text-slate-400 border border-slate-700/60'
              }`}
            >
              👨‍⚕️ {settings.parentBName}
            </button>
          </div>
        </div>
      </header>

      {/* Primary Container */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-4 flex flex-col gap-4">
        
        {/* Status Highlights (At a Glance Strip) - Replaced by Timeline Carousel */}
        {activeTab === 'log' && (() => {
          if (events.length === 0) {
            return (
              <section className="bg-slate-900/95 border border-slate-800 rounded-3xl p-5 text-center flex flex-col items-center justify-center gap-2.5 shadow-md min-h-[140px]">
                <span className="text-2xl animate-bounce">🌱</span>
                <h3 className="text-sm font-black text-slate-200">מוכן לתיעוד ראשון!</h3>
                <p className="text-xs text-slate-400 leading-normal max-w-[280px]">
                  אין עדיין אירועים מתועדים להיום. השתמש בכפתורים למטה כדי לתעד ארוחה, שינה או חיתול בקליק!
                </p>
              </section>
            );
          }

          const safeIndex = Math.min(Math.max(0, carouselIndex), events.length - 1);
          const activeEvent = events[safeIndex];

          let icon = '🍼';
          let badgeColor = 'bg-blue-600 text-white';
          let shadowColor = 'shadow-blue-500/10';
          let title = '';
          let details = '';
          let borderTheme = 'border-blue-500/30';

          if (activeEvent.eventType === 'NUTRITION' && activeEvent.nutrition) {
            if (activeEvent.nutrition.feedType === 'BOTTLE') {
              icon = '🍼';
              badgeColor = 'bg-blue-600 text-white';
              shadowColor = 'shadow-blue-500/10';
              borderTheme = 'border-blue-500/30';
              title = activeEvent.nutrition.bottleLiquidType === 'EXPRESSED_MILK' ? 'חלב שאוב' : 'תמ״ל (פורמולה)';
              details = `נצרך: ${activeEvent.nutrition.amountConsumedMl} מ״ל מתוך ${activeEvent.nutrition.amountOfferedMl} מ״ל`;
              if (activeEvent.nutrition.spitUp && activeEvent.nutrition.spitUp !== 'NONE') {
                details += ` • ${activeEvent.nutrition.spitUp === 'LIGHT' ? 'פליטה קלה' : 'הקאה'}`;
              }
            } else {
              icon = '🤱';
              badgeColor = 'bg-sky-500 text-white';
              shadowColor = 'shadow-sky-500/10';
              borderTheme = 'border-sky-500/30';
              title = 'הנקה';
              details = `צד: ${activeEvent.nutrition.breastSide === 'LEFT' ? 'שמאל' : activeEvent.nutrition.breastSide === 'RIGHT' ? 'ימין' : 'שני הצדדים'} • ${activeEvent.nutrition.durationMinutes} דקות`;
            }
          } else if (activeEvent.eventType === 'DIAPER' && activeEvent.diaper) {
            icon = '👶';
            badgeColor = 'bg-teal-500 text-white';
            shadowColor = 'shadow-teal-500/10';
            borderTheme = 'border-teal-500/30';
            const contains = activeEvent.diaper.contains;
            title = contains === 'PEE' ? 'חיתול: שתן' : contains === 'POO' ? 'חיתול: צואה' : 'חיתול: שתן וצואה';
            const list: string[] = [];
            if (contains !== 'POO' && activeEvent.diaper.peeVolume) {
              list.push(activeEvent.diaper.peeVolume === 'LIGHT' ? 'קל' : 'רטוב כבד');
            }
            if (contains !== 'PEE' && activeEvent.diaper.pooAmount) {
              const size = activeEvent.diaper.pooAmount === 'SMALL' ? 'כמות קטנה' : activeEvent.diaper.pooAmount === 'MEDIUM' ? 'כמות בינונית' : 'גלישה ⚠️';
              list.push(size);
            }
            if (contains !== 'PEE' && activeEvent.diaper.pooColor) {
              const color = activeEvent.diaper.pooColor === 'YELLOW_MUSTARD' ? 'צהוב חרדל' : activeEvent.diaper.pooColor === 'GREEN' ? 'ירוק' : 'חום';
              list.push(color);
            }
            details = list.join(' • ');
          } else if (activeEvent.eventType === 'SLEEP' && activeEvent.sleep) {
            icon = '💤';
            badgeColor = 'bg-indigo-600 text-white';
            shadowColor = 'shadow-indigo-500/10';
            borderTheme = 'border-indigo-500/30';
            title = 'שינה חכמה';
            const dur = activeEvent.sleep.durationMinutes;
            const durationText = dur ? `${Math.floor(dur / 60)}ש׳ ${dur % 60}ד׳` : 'ישן כעת';
            details = `מיקום: ${
              activeEvent.sleep.startLocation === 'CRIB' ? 'עריסה' : 
              activeEvent.sleep.startLocation === 'HANDS' ? 'על הידיים' : 
              activeEvent.sleep.startLocation === 'CARRIER' ? 'מנשא' : 'עגלה'
            } • משך: ${durationText}`;
          } else if (activeEvent.eventType === 'ACTIVITY' && activeEvent.activity) {
            icon = '🎨';
            badgeColor = 'bg-amber-500 text-white';
            shadowColor = 'shadow-amber-500/10';
            borderTheme = 'border-amber-500/30';
            title = `פעילות: ${activeEvent.activity.activityName}`;
            details = activeEvent.activity.cryingIntensity ? `מדד בכי ואי שקט: ${activeEvent.activity.cryingIntensity}/10` : 'רגוע ושמח';
          } else if (activeEvent.eventType === 'WEIGHT' && activeEvent.weight) {
            icon = '⚖️';
            badgeColor = 'bg-pink-500 text-white';
            shadowColor = 'shadow-pink-500/10';
            borderTheme = 'border-pink-500/30';
            title = 'שקילה רפואית';
            details = `${(activeEvent.weight.weightGrams / 1000).toFixed(3)} ק״ג (${activeEvent.weight.weightGrams} גרם)`;
            if (activeEvent.weight.percentile) {
              details += ` • אחוזון ${activeEvent.weight.percentile}`;
            }
          }

          return (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 flex flex-col gap-3 relative shadow-lg">
              {/* Top status header */}
              <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                <span className="text-[10px] text-slate-400 font-extrabold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  ציר זמן קרוסלה • {safeIndex + 1} מתוך {events.length}
                </span>
                <span className="text-[10px] text-slate-400 font-bold bg-slate-950 px-2.5 py-1 rounded-full border border-slate-850">
                  {getHebrewDateStr(activeEvent.timestamp)} • {getHeberwTimeStr(activeEvent.timestamp)}
                </span>
              </div>

              {/* Slider with Chevrons */}
              <div className="flex items-center gap-2">
                
                {/* Older Button (Moves index to right, goes back in time) */}
                <button
                  type="button"
                  disabled={safeIndex >= events.length - 1}
                  onClick={() => setCarouselIndex(prev => Math.min(events.length - 1, prev + 1))}
                  className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 disabled:opacity-20 disabled:pointer-events-none rounded-xl border border-slate-850 cursor-pointer"
                  title="אירועים קודמים"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                {/* Sliding Viewport */}
                <div className="flex-1 min-w-0 overflow-hidden py-0.5">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeEvent.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.15, ease: 'easeInOut' }}
                      className={`bg-slate-950/65 rounded-2xl p-3.5 border ${borderTheme} flex items-start gap-3 hover:bg-slate-950 transition-all cursor-pointer shadow-md ${shadowColor}`}
                      onClick={() => openEditSheet(activeEvent)}
                    >
                      {/* Round Badge */}
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 ${badgeColor} shadow-md`}>
                        {icon}
                      </div>

                      {/* Event Details */}
                      <div className="flex-1 min-w-0 text-right">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h4 className="text-sm font-black text-slate-100 truncate">{title}</h4>
                          <span className="text-[9px] text-indigo-400 font-extrabold bg-indigo-950/45 px-2 py-0.5 rounded-full shrink-0">
                            {formatTimeAgo(activeEvent.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 font-medium leading-normal">{details}</p>
                        
                        {activeEvent.notes && (
                          <div className="mt-2 text-[10px] text-slate-400 bg-slate-900/60 py-1 px-2 rounded-lg border border-slate-850/40 italic truncate">
                            💬 {activeEvent.notes}
                          </div>
                        )}

                        <div className="mt-2 flex justify-between items-center text-[9px] text-slate-500 font-bold border-t border-slate-850/30 pt-1.5">
                          <span>נרשם ע״י {activeEvent.loggedBy === 'PARENT_A' ? settings.parentAName : settings.parentBName}</span>
                          <span className="text-indigo-400 font-black flex items-center gap-0.5 hover:underline">לחץ לעריכה ✏️</span>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Newer Button (Moves index to left, goes forward in time) */}
                <button
                  type="button"
                  disabled={safeIndex <= 0}
                  onClick={() => setCarouselIndex(prev => Math.max(0, prev - 1))}
                  className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 disabled:opacity-20 disabled:pointer-events-none rounded-xl border border-slate-850 cursor-pointer"
                  title="אירועים חדשים יותר"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

              </div>

              {/* Indicator dots */}
              <div className="flex justify-center gap-1 pt-0.5">
                {events.slice(0, 8).map((ev, i) => (
                  <span 
                    key={ev.id}
                    className={`h-1 rounded-full transition-all duration-200 ${
                      i === safeIndex ? 'w-4 bg-indigo-500' : 'w-1 bg-slate-800'
                    }`}
                  />
                ))}
                {events.length > 8 && <span className="text-[8px] text-slate-600 font-black pr-1">+{events.length - 8}</span>}
              </div>

            </div>
          );
        })()}

        {/* TAB 1: QUICK LOGGING GRID & HOME */}
        {activeTab === 'log' && (
          <div className="flex flex-col gap-4">
            
            {/* Quick Action Matrix - The Big 5 Buttons (Reachability Optimized) */}
            <section className="grid grid-cols-2 gap-3 mt-1">
              
              {/* 1. Bottle/Nutrition Sheet Trigger */}
              <button 
                onClick={() => openAddSheet('bottle')}
                className="bg-slate-900/90 border border-slate-800 hover:border-blue-500/60 rounded-3xl p-5 flex flex-col items-center justify-center gap-3 shadow-md active:bg-slate-800/80 transition-all min-h-[120px] focus:outline-none"
              >
                <div className="w-12 h-12 bg-blue-550/35 text-blue-400 rounded-2xl flex items-center justify-center border border-blue-500/25">
                  🍼
                </div>
                <span className="text-base font-black text-blue-300">ארוחה / בקבוק</span>
              </button>

              {/* 2. Diaper Sheet Trigger */}
              <button 
                onClick={() => openAddSheet('diaper')}
                className="bg-slate-900/90 border border-slate-800 hover:border-teal-500/60 rounded-3xl p-5 flex flex-col items-center justify-center gap-3 shadow-md active:bg-slate-800/80 transition-all min-h-[120px] focus:outline-none"
              >
                <div className="w-12 h-12 bg-teal-550/35 text-teal-400 rounded-2xl flex items-center justify-center border border-teal-500/25">
                  👶
                </div>
                <span className="text-base font-black text-teal-300">החלפת חיתול</span>
              </button>

              {/* 3. Sleep State Machine - Big Master Button */}
              <button 
                onClick={() => {
                  if (openSleepSession) {
                    // Turn wake-up: trigger API call directly
                    handleSleepToggle();
                  } else {
                    // Turn sleep: prompt location bottom sheet
                    openAddSheet('sleep' as any);
                  }
                }}
                className={`col-span-2 rounded-3xl p-5 flex items-center justify-between shadow-lg active:opacity-90 transition-all min-h-[90px] ${
                  openSleepSession 
                    ? 'bg-rose-950/70 border border-rose-500/50 text-rose-100 shadow-rose-950/20' 
                    : 'bg-indigo-650 hover:bg-indigo-700 text-white border border-indigo-500/40'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${
                    openSleepSession ? 'bg-rose-500 text-white' : 'bg-white text-indigo-600'
                  }`}>
                    <Moon className={`w-7 h-7 ${openSleepSession ? 'animate-pulse' : ''}`} />
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black block">
                      {openSleepSession ? 'להעיר תינוק ⏰' : 'השכבה לישון 💤'}
                    </span>
                    <span className="text-xs opacity-80 block mt-0.5">
                      {openSleepSession ? 'סיים שינה עכשיו וחשב זמן' : 'זיהוי חכם בלחיצה אחת'}
                    </span>
                  </div>
                </div>
                <div className="text-left font-mono font-bold text-lg">
                  {openSleepSession ? sleepDurationStr : 'ער'}
                </div>
              </button>

              {/* 4. Activity Button */}
              <button 
                onClick={() => openAddSheet('activity')}
                className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/60 rounded-3xl p-5 flex flex-col items-center justify-center gap-3 shadow-md active:bg-slate-800/80 transition-all min-h-[120px] focus:outline-none"
              >
                <div className="w-12 h-12 bg-amber-550/35 text-amber-400 rounded-2xl flex items-center justify-center border border-amber-500/25">
                  🎨
                </div>
                <span className="text-base font-black text-amber-300">תיעוד פעילות</span>
              </button>

              {/* 5. Weight Button */}
              <button 
                onClick={() => openAddSheet('weight')}
                className="bg-slate-900/90 border border-slate-800 hover:border-pink-500/60 rounded-3xl p-5 flex flex-col items-center justify-center gap-3 shadow-md active:bg-slate-800/80 transition-all min-h-[120px] focus:outline-none"
              >
                <div className="w-12 h-12 bg-pink-550/35 text-pink-400 rounded-2xl flex items-center justify-center border border-pink-500/25">
                  ⚖️
                </div>
                <span className="text-base font-black text-pink-300">שקילה רפואית</span>
              </button>

            </section>

            {/* Quick Live Health Monitor (Daily Intake Status) */}
            <section className="bg-slate-900/90 border border-slate-800/85 rounded-3xl p-5 shadow-sm mt-1">
              <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
                  <span>📊 מעקב הזנה יומי (היום)</span>
                </h3>
                <span className="text-[11px] font-bold text-slate-400">
                  {todaySummary.feedsCount} ארוחות סה״כ
                </span>
              </div>
              
              <div className="flex justify-between items-end mb-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">סך הכל שהוצע</span>
                  <span className="text-3xl font-black text-slate-100">{todaySummary.offered} <small className="text-xs text-slate-400">מ״ל</small></span>
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-0.5">נצרך בפועל</span>
                  <span className="text-3xl font-black text-blue-400">{todaySummary.consumed} <small className="text-xs text-slate-400">מ״ל</small></span>
                </div>
              </div>

              {/* Delta highlights */}
              {todaySummary.offered > 0 ? (
                <div className="bg-slate-950/60 rounded-2xl p-3 border border-slate-800/80">
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="text-slate-400 font-bold">חלב שלא נצרך / הפרש (Delta)</span>
                    <span className="text-rose-400 font-black">
                      {todaySummary.offered - todaySummary.consumed} מ״ל ({Math.round(((todaySummary.offered - todaySummary.consumed) / todaySummary.offered) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-l from-blue-500 to-indigo-600 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, Math.round((todaySummary.consumed / todaySummary.offered) * 100))}%` }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center py-2 font-medium">לא תועד בקבוק להיום. הזן נתוני בקבוק כדי לראות ניתוח פערים.</p>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: VERTICAL TIMELINE OF RECENT EVENTS */}
        {activeTab === 'timeline' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-100">📋 ציר הזמן ההיסטורי</h2>
              <button 
                onClick={fetchEvents}
                className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl"
                title="רענן"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-400 font-bold">טוען אירועים אחרונים...</span>
              </div>
            ) : events.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-10 text-center flex flex-col items-center gap-3">
                <span className="text-3xl">📭</span>
                <p className="text-sm text-slate-400 font-bold">אין עדיין אירועים מתועדים באפליקציה.</p>
                <p className="text-xs text-slate-500">התחל לרשום אירועים במסך הראשי כדי למלא את ציר הזמן.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 relative before:absolute before:top-0 before:bottom-0 before:right-6 before:w-0.5 before:bg-slate-800/80">
                
                {/* Active Sleep indicator at the very top of timeline if sleeping */}
                {openSleepSession && (
                  <div className="relative flex items-start gap-3 bg-indigo-950/35 border border-indigo-500/40 p-4 rounded-3xl shadow-md animate-pulse">
                    <div className="w-12 h-12 bg-indigo-500 text-white rounded-2xl flex items-center justify-center font-bold shrink-0 z-10 text-lg shadow-lg">
                      💤
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <div className="flex justify-between items-start">
                        <h4 className="text-base font-black text-indigo-200">ישן עכשיו</h4>
                        <span className="text-[10px] text-indigo-400 font-extrabold bg-indigo-900/50 px-2 py-0.5 rounded-full">
                          שינה פעילה
                        </span>
                      </div>
                      <p className="text-xs text-indigo-300 font-bold mt-1">
                        התחיל ב-{getHeberwTimeStr(openSleepSession.sleep?.startAt || openSleepSession.timestamp)} (מיקום: {
                          openSleepSession.sleep?.startLocation === 'CRIB' ? 'עריסה / מיטה' :
                          openSleepSession.sleep?.startLocation === 'HANDS' ? 'על הידיים' :
                          openSleepSession.sleep?.startLocation === 'CARRIER' ? 'במנשא' : 'בעגלה'
                        })
                      </p>
                      <p className="text-[10px] text-slate-400 mt-2">רשם: {openSleepSession.loggedBy === 'PARENT_A' ? settings.parentAName : settings.parentBName}</p>
                    </div>
                  </div>
                )}

                {events.map((e) => {
                  // Style based on eventType
                  let icon = '🍼';
                  let borderClass = 'border-r-4 border-r-blue-500';
                  let bgClass = 'bg-blue-950/20';
                  let title = '';
                  let details = '';

                  if (e.eventType === 'NUTRITION' && e.nutrition) {
                    if (e.nutrition.feedType === 'BOTTLE') {
                      icon = '🍼';
                      borderClass = 'border-r-4 border-r-blue-500';
                      bgClass = 'bg-blue-950/15';
                      title = e.nutrition.bottleLiquidType === 'EXPRESSED_MILK' ? 'חלב שאוב בבקבוק' : 'תמ״ל (פורמולה)';
                      details = `הוצע: ${e.nutrition.amountOfferedMl} מ״ל • נצרך: ${e.nutrition.amountConsumedMl} מ״ל`;
                      if (e.nutrition.spitUp && e.nutrition.spitUp !== 'NONE') {
                        details += ` • ${e.nutrition.spitUp === 'LIGHT' ? 'פליטה קלה' : 'הקאה'}`;
                      }
                    } else {
                      icon = '🤱';
                      borderClass = 'border-r-4 border-r-sky-500';
                      bgClass = 'bg-sky-950/15';
                      title = 'הנקה ישירה';
                      title += ` (${e.nutrition.breastSide === 'LEFT' ? 'שמאל' : e.nutrition.breastSide === 'RIGHT' ? 'ימין' : 'שני הצדדים'})`;
                      details = `משך: ${e.nutrition.durationMinutes} דקות`;
                    }
                  } else if (e.eventType === 'DIAPER' && e.diaper) {
                    icon = '👶';
                    borderClass = 'border-r-4 border-r-teal-500';
                    bgClass = 'bg-teal-950/15';
                    const contains = e.diaper.contains;
                    title = contains === 'PEE' ? 'חיתול: שתן' : contains === 'POO' ? 'חיתול: צואה' : 'חיתול: שתן + צואה';
                    
                    const list: string[] = [];
                    if (contains !== 'POO' && e.diaper.peeVolume) {
                      list.push(e.diaper.peeVolume === 'LIGHT' ? 'קל' : 'רטוב כבד');
                    }
                    if (contains !== 'PEE' && e.diaper.pooAmount) {
                      const size = e.diaper.pooAmount === 'SMALL' ? 'קטן' : e.diaper.pooAmount === 'MEDIUM' ? 'בינוני' : 'גדול / גלישה';
                      list.push(`כמות ${size}`);
                    }
                    if (contains !== 'PEE' && e.diaper.pooColor) {
                      const color = e.diaper.pooColor === 'YELLOW_MUSTARD' ? 'צהוב חרדל' : e.diaper.pooColor === 'GREEN' ? 'ירוק' : 'חום';
                      list.push(color);
                    }
                    details = list.join(' • ');
                  } else if (e.eventType === 'SLEEP' && e.sleep) {
                    icon = '💤';
                    borderClass = 'border-r-4 border-r-indigo-500';
                    bgClass = 'bg-indigo-950/15';
                    title = 'שינה מתועדת';
                    const dur = e.sleep.durationMinutes;
                    const durationText = dur ? `${Math.floor(dur / 60)}ש ${dur % 60}ד` : 'לא הוגדר';
                    details = `משך: ${durationText} • תחילת שינה ב-${getHeberwTimeStr(e.sleep.startAt)}`;
                    if (e.sleep.endAt) {
                      details += ` עד ${getHeberwTimeStr(e.sleep.endAt)}`;
                    } else {
                      details += ` • עדיין ישן`;
                    }
                  } else if (e.eventType === 'ACTIVITY' && e.activity) {
                    icon = '🎨';
                    borderClass = 'border-r-4 border-r-amber-500';
                    bgClass = 'bg-amber-950/15';
                    title = `פעילות: ${e.activity.activityName}`;
                    details = e.activity.cryingIntensity ? `מדד בכי/אי שקט: ${e.activity.cryingIntensity}/10` : 'רגוע ושמח';
                  } else if (e.eventType === 'WEIGHT' && e.weight) {
                    icon = '⚖️';
                    borderClass = 'border-r-4 border-r-pink-500';
                    bgClass = 'bg-pink-950/15';
                    title = 'שקילה בקליניקה';
                    details = `משקל: ${(e.weight.weightGrams / 1000).toFixed(3)} ק״ג (${e.weight.weightGrams} גרם)`;
                    if (e.weight.percentile) {
                      details += ` • אחוזון: ${e.weight.percentile}%`;
                    }
                  }

                  return (
                    <div 
                      key={e.id} 
                      onClick={() => openEditSheet(e)}
                      className={`relative flex items-start gap-3 border border-slate-850/60 p-3.5 rounded-2xl shadow-sm hover:bg-slate-900/60 active:scale-[0.99] transition-all cursor-pointer ${bgClass} ${borderClass}`}
                    >
                      {/* Node Icon */}
                      <div className="w-10 h-10 bg-slate-900 text-slate-100 rounded-xl flex items-center justify-center font-bold shrink-0 z-10 text-lg border border-slate-800/80">
                        {icon}
                      </div>

                      {/* Content details */}
                      <div className="flex-1 min-w-0 text-right">
                        <div className="flex justify-between items-baseline">
                          <h4 className="text-sm font-black text-slate-100 truncate">{title}</h4>
                          <span className="text-[10px] text-slate-400 font-mono font-bold shrink-0">
                            {getHebrewDateStr(e.timestamp)} • {getHeberwTimeStr(e.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 font-medium mt-1 leading-normal">{details}</p>
                        
                        {e.notes && (
                          <div className="mt-2 text-[11px] text-slate-400 bg-slate-950/60 py-1.5 px-2.5 rounded-lg border border-slate-850/50 italic">
                            💬 {e.notes}
                          </div>
                        )}

                        <div className="mt-1.5 flex justify-between items-center text-[9px] text-slate-500 font-bold">
                          <span>רשם: {e.loggedBy === 'PARENT_A' ? settings.parentAName : settings.parentBName}</span>
                          <span className="text-indigo-400 hover:underline">ערוך ✏️</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MEDICAL GROUPED DASHBOARDS */}
        {activeTab === 'dashboards' && (
          <div className="flex flex-col gap-4">
            
            {/* Range Toggle Header */}
            <div className="flex items-center justify-between bg-slate-900 p-2 rounded-2xl border border-slate-800/80">
              <span className="text-xs font-black text-slate-300 pr-2">טווח נתונים:</span>
              <div className="flex gap-1">
                {[7, 14, 30].map(days => (
                  <button
                    key={days}
                    onClick={() => setDashboardDays(days)}
                    className={`px-3 py-1 rounded-xl text-xs font-black transition-all ${
                      dashboardDays === days 
                        ? 'bg-indigo-600 text-white shadow' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {days === 7 ? 'שבוע' : days === 14 ? 'שבועיים' : 'חודש'}
                  </button>
                ))}
              </div>
            </div>

            {/* 1. NUTRITION DASHBOARD */}
            <section className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3 border-b border-slate-850 pb-2">
                <h3 className="text-sm font-black text-blue-300">🍼 דוח תזונה יומי (הוצע מול נצרך)</h3>
                <span className="text-[10px] text-slate-500 font-bold">מבוסס בקבוקים</span>
              </div>

              {nutritionStats.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">אין מספיק נתונים להצגת גרף בקבוקים</p>
              ) : (
                <div className="space-y-4">
                  {/* Custom horizontal delta graph */}
                  <div className="space-y-3">
                    {nutritionStats.map((stat, idx) => {
                      const offered = stat.offered || 0;
                      const consumed = stat.consumed || 0;
                      const delta = Math.max(0, offered - consumed);
                      const pct = offered > 0 ? Math.round((consumed / offered) * 100) : 0;
                      
                      return (
                        <div key={idx} className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-850">
                          <div className="flex justify-between items-center text-xs mb-1">
                            <span className="font-extrabold text-slate-300">{stat.date}</span>
                            <span className="text-[11px] font-bold">
                              נצרך: <b className="text-blue-400">{consumed}מ״ל</b> מתוך {offered}מ״ל ({pct}%)
                            </span>
                          </div>

                          <div className="relative w-full h-3 bg-slate-800 rounded-full overflow-hidden flex">
                            {offered > 0 ? (
                              <>
                                <div 
                                  className="h-full bg-blue-500" 
                                  style={{ width: `${pct}%` }} 
                                />
                                <div 
                                  className="h-full bg-rose-500/80" 
                                  style={{ width: `${100 - pct}%` }} 
                                />
                              </>
                            ) : (
                              <div className="h-full bg-sky-600/40 w-full text-center text-[9px] text-slate-400">הנקות בלבד היום</div>
                            )}
                          </div>
                          
                          {offered > 0 && delta > 0 && (
                            <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                              <span>הנקות ביום זה: {stat.breastCount || 0}</span>
                              <span className="text-rose-400 font-bold">פחת פליטות / חלב שהושאר: {delta} מ״ל</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* 2. SLEEP DASHBOARD */}
            <section className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3 border-b border-slate-850 pb-2">
                <h3 className="text-sm font-black text-indigo-300">💤 שינה יומית (שעות סה״ך)</h3>
                <span className="text-[10px] text-indigo-400 font-bold">שעות מחושבות</span>
              </div>

              {sleepStats.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">אין מספיק נתוני שינה</p>
              ) : (
                <div className="space-y-3">
                  {sleepStats.map((stat, idx) => {
                    const hrs = (stat.totalMinutes / 60).toFixed(1);
                    const pct = Math.min(100, Math.round((stat.totalMinutes / (16 * 60)) * 100)); // Target 16 hours for baby
                    
                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="w-16 text-xs text-slate-300 font-bold truncate">{stat.date}</span>
                        <div className="flex-1 bg-slate-950/40 h-5 rounded-lg border border-slate-850 overflow-hidden relative flex items-center pr-2">
                          <div 
                            className="h-full bg-indigo-600/70 rounded-l transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                          <span className="absolute left-2 text-[10px] font-bold text-indigo-300">
                            {hrs} שעות ({stat.sessionCount} פעמים)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 3. DIAPER PATTERN DASHBOARD */}
            <section className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3 border-b border-slate-850 pb-2">
                <h3 className="text-sm font-black text-teal-300">👶 שכיחות חיתולים (שתן/צואה)</h3>
                <span className="text-[10px] text-teal-400 font-bold">זיהוי דפוסי עיכול</span>
              </div>

              {diaperStats.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">אין מספיק נתוני חיתולים</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {diaperStats.map((stat, idx) => (
                    <div key={idx} className="bg-slate-950/40 border border-slate-850/80 p-3 rounded-2xl">
                      <div className="text-xs font-bold text-slate-300 border-b border-slate-850 pb-1 mb-2">
                        {stat.date}
                      </div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-sky-300">💦 שתן</span>
                        <span className="font-extrabold">{stat.pee + stat.both} חיתולים</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-amber-400">💩 צואה</span>
                        <span className="font-extrabold">{stat.poo + stat.both} חיתולים</span>
                      </div>

                      {/* Poo color indicator highlights */}
                      {stat.pooColors.length > 0 && (
                        <div className="mt-2 pt-1.5 border-t border-slate-850/60 flex items-center gap-1.5">
                          <span className="text-[9px] text-slate-500">צבעי צואה:</span>
                          <div className="flex gap-1">
                            {stat.pooColors.map((col: string, i: number) => {
                              const colorBg = col === 'YELLOW_MUSTARD' ? 'bg-amber-400' : col === 'GREEN' ? 'bg-green-650' : 'bg-yellow-800';
                              return <span key={i} className={`w-2.5 h-2.5 rounded-full ${colorBg}`} title={col} />;
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 4. WEIGHT TRACKER CLINICAL */}
            <section className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3 border-b border-slate-850 pb-2">
                <h3 className="text-sm font-black text-pink-300">⚖️ מעקב משקל בקליניקה (ק״ג)</h3>
                <span className="text-[10px] text-slate-400 font-bold">גרף גדילה רפואי</span>
              </div>

              {weightStats.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">עדיין לא הוזנו שקילות רפואיות</p>
              ) : (
                <div className="space-y-3">
                  {weightStats.map((stat, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-950/40 p-2.5 rounded-xl border border-slate-850">
                      <div className="flex items-center gap-2">
                        <span className="text-pink-400 font-extrabold">⚖️</span>
                        <span className="text-xs text-slate-300 font-bold">{stat.date}</span>
                      </div>
                      <div className="text-left">
                        <span className="text-base font-black text-slate-100">{(stat.weightGrams / 1000).toFixed(3)} ק״ג</span>
                        {stat.percentile && (
                          <span className="text-[10px] text-slate-400 font-bold mr-1.5 bg-slate-800 px-1.5 py-0.5 rounded">
                            אחוזון {stat.percentile}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>
        )}

        {/* TAB 4: APP SETTINGS & PEDIATRICIAN REPORT EXPORT */}
        {activeTab === 'settings' && (
          <div className="flex flex-col gap-4">
            
            {/* EXPORT SECTION */}
            <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm">
              <h3 className="text-base font-black text-slate-105 mb-2 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                <span>ייצוא דוח רופא ילדים (Excel)</span>
              </h3>
              <p className="text-xs text-slate-400 mb-4 leading-normal">
                ייצוא דוח מקיף המיועד לרופא הילדים. הדוח כולל גיליונות סיכום, תזונה יומית, פערים, שינה, חיתולים ומשקל.
              </p>

              <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-850 mb-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">מתאריך</label>
                    <input 
                      type="date" 
                      value={exportFromDate}
                      onChange={(e) => setExportFromDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-xl px-2.5 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">עד תאריך</label>
                    <input 
                      type="date" 
                      value={exportToDate}
                      onChange={(e) => setExportToDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-xl px-2.5 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-right"
                    />
                  </div>
                </div>

                {/* Date presets helper */}
                <div className="flex justify-between pt-1 border-t border-slate-850/60 mt-2">
                  <span className="text-[10px] text-slate-500 font-bold">בחירה מהירה:</span>
                  <div className="flex gap-2">
                    {[7, 14, 30].map(days => (
                      <button
                        key={days}
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() - days);
                          setExportFromDate(d.toISOString().split('T')[0]);
                        }}
                        className="text-[10px] text-indigo-400 hover:underline font-bold"
                      >
                        {days} ימים אחרונים
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={triggerExcelDownload}
                className="w-full bg-green-700 hover:bg-green-600 text-white font-black py-3 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all text-sm cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>הורד דוח Excel מעוצב (.xlsx)</span>
              </button>
            </section>

            {/* CAREGIVERS CONFIG */}
            <form onSubmit={handleUpdateSettings} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
              <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-400" />
                <span>הגדרות ושמות ההורים</span>
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">שם הורה א׳ (אמא כברירת מחדל)</label>
                  <input
                    type="text"
                    value={parentANameInput}
                    onChange={(e) => setParentANameInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    placeholder="אמא"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">שם הורה ב׳ (אבא כברירת מחדל)</label>
                  <input
                    type="text"
                    value={parentBNameInput}
                    onChange={(e) => setParentBNameInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    placeholder="אבא"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">סוג ברירת מחדל לבקבוקים</label>
                  <select
                    value={defaultBottleTypeInput}
                    onChange={(e) => setDefaultBottleTypeInput(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="EXPRESSED_MILK">חלב אם שאוב (Expressed)</option>
                    <option value="FORMULA">תמ״ל / פורמולה (Formula)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-650 hover:bg-indigo-700 text-white font-black py-2.5 rounded-2xl text-xs shadow-lg transition-all"
              >
                {submitting ? 'שומר שינויים...' : 'שמור הגדרות מערכת'}
              </button>
            </form>

            {/* CUSTOM ACTIVITIES CONFIG */}
            <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
              <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-amber-400" />
                <span>ניהול כפתורי פעילויות</span>
              </h3>
              <p className="text-xs text-slate-400">
                צור כפתורים מותאמים אישית לתיעוד פעילויות מהיר בלחיצה אחת בלבד.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newActivityNameInput}
                  onChange={(e) => setNewActivityNameInput(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  placeholder="למשל: שחיית תינוקות, סיפור"
                />
                <button
                  onClick={handleAddCustomActivity}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black px-4 rounded-xl"
                >
                  הוסף
                </button>
              </div>

              <div className="space-y-1.5 pt-2">
                {settings.customActivities.map((act, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-950/50 px-3 py-2 rounded-xl border border-slate-850 text-xs">
                    <span className="font-bold text-slate-300">{act}</span>
                    <button
                      onClick={() => handleDeleteCustomActivity(act)}
                      className="text-rose-400 hover:text-rose-300 p-1"
                      title="מחק כפתור זה"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

          </div>
        )}

      </main>

      {/* BOTTOM MODALS / SHEETS PANEL (ONE-HANDED INPUT OPTIMIZED) */}
      {activeSheet && (
        <div className="fixed inset-0 bg-black/80 z-40 flex items-end justify-center transition-opacity">
          <div className="w-full max-w-md bg-slate-900 border-t border-slate-800 rounded-t-[32px] p-5 shadow-2xl max-h-[92vh] overflow-y-auto z-50">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {activeSheet === 'bottle' ? '🍼' : 
                   activeSheet === 'diaper' ? '👶' : 
                   activeSheet === 'activity' ? '🎨' : 
                   activeSheet === 'weight' ? '⚖️' : '✏️'}
                </span>
                <h3 className="text-base font-black text-slate-100">
                  {activeSheet === 'bottle' ? 'תיעוד ארוחה / הנקה' : 
                   activeSheet === 'diaper' ? 'תיעוד החלפת חיתול' : 
                   activeSheet === 'activity' ? 'תיעוד פעילות' : 
                   activeSheet === 'weight' ? 'שקילת משקל רפואי' : 'עריכת אירוע קיים'}
                </h3>
              </div>
              <button 
                onClick={() => setActiveSheet(null)}
                className="p-1.5 bg-slate-800 rounded-full hover:bg-slate-700 text-slate-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* FORM HANDLING FOR NEW AND EDIT */}
            <form onSubmit={activeSheet === 'edit' ? handleUpdateEvent : handleCreateEvent} className="space-y-4">
              
              {/* ======================================= */}
              {/* NUTRITION FORM */}
              {/* ======================================= */}
              {activeSheet === 'bottle' && (
                <div className="space-y-4">
                  {/* Bottle vs Breast toggler */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-850">
                    <button
                      type="button"
                      onClick={() => setBottleFeedType('BOTTLE')}
                      className={`py-2 rounded-xl text-xs font-black transition-all ${
                        bottleFeedType === 'BOTTLE' 
                          ? 'bg-blue-600 text-white' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      🍼 בקבוק (שאוב / תמ״ל)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBottleFeedType('BREAST')}
                      className={`py-2 rounded-xl text-xs font-black transition-all ${
                        bottleFeedType === 'BREAST' 
                          ? 'bg-sky-600 text-white' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      🤱 הנקה ישירה
                    </button>
                  </div>

                  {bottleFeedType === 'BOTTLE' ? (
                    <div className="space-y-4">
                      {/* Milk Type option */}
                      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-850">
                        <button
                          type="button"
                          onClick={() => setBottleLiquidType('EXPRESSED_MILK')}
                          className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                            bottleLiquidType === 'EXPRESSED_MILK' 
                              ? 'bg-slate-850 text-blue-300' 
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          חלב אם שאוב
                        </button>
                        <button
                          type="button"
                          onClick={() => setBottleLiquidType('FORMULA')}
                          className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                            bottleLiquidType === 'FORMULA' 
                              ? 'bg-slate-850 text-blue-300' 
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          תמ״ל (פורמולה)
                        </button>
                      </div>

                      {/* Steppers: Offered vs Consumed */}
                      <div className="space-y-3">
                        {/* Offered */}
                        <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-850 flex items-center justify-between">
                          <div>
                            <span className="text-xs font-black text-slate-400 block">כמות שהוצעה</span>
                            <span className="text-lg font-black text-slate-200">{amountOfferedMl} מ״ל</span>
                          </div>
                          <div className="flex gap-1.5">
                            <button 
                              type="button" 
                              onClick={() => setAmountOfferedMl(prev => Math.max(0, prev - 10))}
                              className="w-11 h-11 bg-slate-800 text-slate-200 rounded-xl flex items-center justify-center font-bold active:bg-slate-700"
                            >
                              -10
                            </button>
                            <button 
                              type="button" 
                              onClick={() => setAmountOfferedMl(prev => Math.max(0, prev - 5))}
                              className="w-10 h-10 bg-slate-850 text-slate-200 rounded-xl flex items-center justify-center font-bold active:bg-slate-700 text-xs"
                            >
                              -5
                            </button>
                            <button 
                              type="button" 
                              onClick={() => setAmountOfferedMl(prev => prev + 5)}
                              className="w-10 h-10 bg-slate-850 text-slate-200 rounded-xl flex items-center justify-center font-bold active:bg-slate-700 text-xs"
                            >
                              +5
                            </button>
                            <button 
                              type="button" 
                              onClick={() => setAmountOfferedMl(prev => prev + 10)}
                              className="w-11 h-11 bg-slate-800 text-slate-200 rounded-xl flex items-center justify-center font-bold active:bg-slate-700"
                            >
                              +10
                            </button>
                          </div>
                        </div>

                        {/* Consumed */}
                        <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-850 flex items-center justify-between">
                          <div>
                            <span className="text-xs font-black text-blue-400 block">כמות שנצרכה</span>
                            <span className="text-lg font-black text-blue-300">{amountConsumedMl} מ״ל</span>
                          </div>
                          <div className="flex gap-1.5">
                            <button 
                              type="button" 
                              onClick={() => setAmountConsumedMl(prev => Math.max(0, prev - 10))}
                              className="w-11 h-11 bg-slate-800 text-slate-200 rounded-xl flex items-center justify-center font-bold active:bg-slate-700"
                            >
                              -10
                            </button>
                            <button 
                              type="button" 
                              onClick={() => setAmountConsumedMl(prev => Math.max(0, prev - 5))}
                              className="w-10 h-10 bg-slate-850 text-slate-200 rounded-xl flex items-center justify-center font-bold active:bg-slate-700 text-xs"
                            >
                              -5
                            </button>
                            <button 
                              type="button" 
                              onClick={() => setAmountConsumedMl(prev => Math.min(amountOfferedMl, prev + 5))}
                              className="w-10 h-10 bg-slate-850 text-slate-200 rounded-xl flex items-center justify-center font-bold active:bg-slate-700 text-xs"
                            >
                              +5
                            </button>
                            <button 
                              type="button" 
                              onClick={() => setAmountConsumedMl(prev => Math.min(amountOfferedMl, prev + 10))}
                              className="w-11 h-11 bg-slate-800 text-slate-200 rounded-xl flex items-center justify-center font-bold active:bg-slate-700"
                            >
                              +10
                            </button>
                          </div>
                        </div>

                        {/* Presets Row to match easily */}
                        <div className="flex justify-between gap-1.5 pt-1">
                          {[60, 90, 120, 150, 180].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => {
                                setAmountOfferedMl(preset);
                                setAmountConsumedMl(preset);
                              }}
                              className="flex-1 py-1.5 bg-slate-850 hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-300 text-center"
                            >
                              {preset} מ״ל
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Spit up selection */}
                      <div>
                        <label className="block text-xs font-black text-slate-400 mb-1.5">פליטות והקאות</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { value: 'NONE', label: 'ללא פליטה' },
                            { value: 'LIGHT', label: 'פליטה קלה' },
                            { value: 'HEAVY_VOMIT', label: 'הקאה כבדה' }
                          ].map((item) => (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => setSpitUp(item.value as any)}
                              className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                                spitUp === item.value 
                                  ? 'bg-blue-950 text-blue-300 border-blue-500' 
                                  : 'bg-slate-950 border-slate-850 text-slate-400'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                    </div>
                  ) : (
                    /* BREAST FEEDING FORM */
                    <div className="space-y-4">
                      {/* Side selection */}
                      <div>
                        <label className="block text-xs font-black text-slate-400 mb-1.5">צד הנקה</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { value: 'LEFT', label: 'שמאל' },
                            { value: 'RIGHT', label: 'ימין' },
                            { value: 'BOTH', label: 'שני הצדדים' }
                          ].map((item) => (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => setBreastSide(item.value as any)}
                              className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                                breastSide === item.value 
                                  ? 'bg-sky-950 text-sky-300 border-sky-500' 
                                  : 'bg-slate-950 border-slate-850 text-slate-400'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Duration Stepper */}
                      <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-850 flex items-center justify-between">
                        <div>
                          <span className="text-xs font-black text-slate-400 block">משך זמן כולל</span>
                          <span className="text-lg font-black text-slate-200">{breastDuration} דקות</span>
                        </div>
                        <div className="flex gap-1.5">
                          <button 
                            type="button" 
                            onClick={() => setBreastDuration(prev => Math.max(1, prev - 5))}
                            className="w-10 h-10 bg-slate-800 text-slate-200 rounded-xl flex items-center justify-center font-bold active:bg-slate-700"
                          >
                            -5
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setBreastDuration(prev => Math.max(1, prev - 1))}
                            className="w-10 h-10 bg-slate-850 text-slate-200 rounded-xl flex items-center justify-center font-bold active:bg-slate-700"
                          >
                            -1
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setBreastDuration(prev => prev + 1)}
                            className="w-10 h-10 bg-slate-850 text-slate-200 rounded-xl flex items-center justify-center font-bold active:bg-slate-700"
                          >
                            +1
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setBreastDuration(prev => prev + 5)}
                            className="w-10 h-10 bg-slate-800 text-slate-200 rounded-xl flex items-center justify-center font-bold active:bg-slate-700"
                          >
                            +5
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ======================================= */}
              {/* DIAPER FORM */}
              {/* ======================================= */}
              {activeSheet === 'diaper' && (
                <div className="space-y-4">
                  {/* Contents: Pee, Poo, Both */}
                  <div>
                    <label className="block text-xs font-black text-slate-400 mb-1.5">תכולת החיתול</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'PEE', label: '💦 שתן בלבד' },
                        { value: 'POO', label: '💩 צואה בלבד' },
                        { value: 'BOTH', label: '💦💩 שתן וצואה' }
                      ].map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setDiaperContains(item.value as any)}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                            diaperContains === item.value 
                              ? 'bg-teal-950 text-teal-300 border-teal-500' 
                              : 'bg-slate-950 border-slate-850 text-slate-400'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pee Volume (if not poo only) */}
                  {diaperContains !== 'POO' && (
                    <div>
                      <label className="block text-xs font-black text-slate-400 mb-1.5">רטיבות החיתול (רטיבות שתן)</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'LIGHT', label: 'רטיבות קלה' },
                          { value: 'HEAVY_SOAKED', label: 'רטוב כבד / נפוח' }
                        ].map((item) => (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => setPeeVolume(item.value as any)}
                            className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                              peeVolume === item.value 
                                ? 'bg-slate-800 text-teal-300 border-teal-500' 
                                : 'bg-slate-950 border-slate-850 text-slate-400'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Poo details (if not pee only) */}
                  {diaperContains !== 'PEE' && (
                    <div className="space-y-4 pt-1 border-t border-slate-850">
                      
                      {/* Poo Amount */}
                      <div>
                        <label className="block text-xs font-black text-slate-400 mb-1.5">כמות צואה</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { value: 'SMALL', label: 'קטן / לכלוך' },
                            { value: 'MEDIUM', label: 'בינוני' },
                            { value: 'LARGE_OVERFLOW', label: 'גדול / גלישה' }
                          ].map((item) => (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => setPooAmount(item.value as any)}
                              className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                                pooAmount === item.value 
                                  ? 'bg-slate-800 text-teal-300 border-teal-500' 
                                  : 'bg-slate-950 border-slate-850 text-slate-400'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Poo Color */}
                      <div>
                        <label className="block text-xs font-black text-slate-400 mb-1.5">צבע צואה</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { value: 'YELLOW_MUSTARD', label: 'צהוב חרדל 🟡' },
                            { value: 'GREEN', label: 'ירוק 🟢' },
                            { value: 'BROWN', label: 'חום 🟤' }
                          ].map((item) => (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => setPooColor(item.value as any)}
                              className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                                pooColor === item.value 
                                  ? 'bg-slate-800 text-teal-300 border-teal-500' 
                                  : 'bg-slate-950 border-slate-850 text-slate-400'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Poo Texture */}
                      <div>
                        <label className="block text-xs font-black text-slate-400 mb-1.5">מרקם צואה</label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            { value: 'SEEDY', label: 'גרגרי' },
                            { value: 'LIQUID', label: 'נוזלי' },
                            { value: 'PASTY', label: 'משחתי' },
                            { value: 'HARD', label: 'קשה' }
                          ].map((item) => (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => setPooTexture(item.value as any)}
                              className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${
                                pooTexture === item.value 
                                  ? 'bg-slate-800 text-teal-300 border-teal-500' 
                                  : 'bg-slate-950 border-slate-850 text-slate-400'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              )}

              {/* ======================================= */}
              {/* SLEEP LOCATION FORM */}
              {/* ======================================= */}
              {activeSheet === 'sleep' && (
                <div className="space-y-4">
                  <p className="text-xs text-indigo-300 bg-indigo-950/40 p-3 rounded-2xl border border-indigo-900/40 font-medium">
                    שינה חכמה מופעלת כעת. בחר את שעת תחילת השינה ומיקום ההשכבה:
                  </p>

                  {/* Sleep Start Time Picker (Always visible) */}
                  <div>
                    <label className="block text-xs font-black text-slate-400 mb-1">שעת תחילת השינה</label>
                    <input
                      type="datetime-local"
                      value={customTimestamp}
                      onChange={(e) => setCustomTimestamp(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-right font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-400 mb-1.5">מיקום השכבה</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'CRIB', label: '🛌 עריסה / מיטה' },
                        { value: 'HANDS', label: '🤲 על הידיים' },
                        { value: 'CARRIER', label: '🎒 במנשא' },
                        { value: 'STROLLER', label: '🛒 בעגלה' }
                      ].map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => handleSleepToggle(item.value as SleepLocationType)}
                          className="py-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-2xl text-xs font-black text-slate-200 text-center active:bg-slate-800"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================= */}
              {/* ACTIVITY FORM */}
              {/* ======================================= */}
              {activeSheet === 'activity' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 mb-1.5 font-bold">סוג הפעילות</label>
                    <div className="grid grid-cols-2 gap-2 max-h-[140px] overflow-y-auto">
                      {settings.customActivities.map((act) => (
                        <button
                          key={act}
                          type="button"
                          onClick={() => setActivityName(act)}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                            activityName === act 
                              ? 'bg-amber-950 text-amber-300 border-amber-500' 
                              : 'bg-slate-950 border-slate-850 text-slate-400'
                          }`}
                        >
                          {act}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Crying slider (optional) */}
                  <div>
                    <label className="block text-xs font-black text-slate-400 mb-1">מדד בכי ואי שקט (1-10, 0 = רגוע)</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="range" 
                        min="0" 
                        max="10" 
                        value={cryingIntensity}
                        onChange={(e) => setCryingIntensity(Number(e.target.value))}
                        className="flex-1 bg-slate-950 h-2 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="font-mono text-xs font-black text-amber-400 w-8 text-center bg-slate-950 py-1 rounded">
                        {cryingIntensity === 0 ? 'רגוע' : cryingIntensity}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================= */}
              {/* WEIGHT FORM */}
              {/* ======================================= */}
              {activeSheet === 'weight' && (
                <div className="space-y-4">
                  {/* Grams stepper */}
                  <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-850 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-slate-400 block">משקל התינוק (גרם)</span>
                      <span className="text-lg font-black text-slate-200">
                        {(weightGrams / 1000).toFixed(3)} ק״ג ({weightGrams} גרם)
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      <button 
                        type="button" 
                        onClick={() => setWeightGrams(prev => Math.max(100, prev - 100))}
                        className="w-11 h-11 bg-slate-800 text-slate-200 rounded-xl flex items-center justify-center font-bold active:bg-slate-700 text-xs"
                      >
                        -100ג׳
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setWeightGrams(prev => Math.max(10, prev - 10))}
                        className="w-10 h-10 bg-slate-850 text-slate-200 rounded-xl flex items-center justify-center font-bold active:bg-slate-700 text-[10px]"
                      >
                        -10ג׳
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setWeightGrams(prev => prev + 10)}
                        className="w-10 h-10 bg-slate-850 text-slate-200 rounded-xl flex items-center justify-center font-bold active:bg-slate-700 text-[10px]"
                      >
                        +10ג׳
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setWeightGrams(prev => prev + 100)}
                        className="w-11 h-11 bg-slate-800 text-slate-200 rounded-xl flex items-center justify-center font-bold active:bg-slate-700 text-xs"
                      >
                        +100ג׳
                      </button>
                    </div>
                  </div>

                  {/* Manual entry / percentile */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">הזן משקל מדויק ידנית</label>
                      <input 
                        type="number" 
                        value={weightGrams}
                        onChange={(e) => setWeightGrams(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        placeholder="גרם, למשל: 3450"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">אחוזון (אופציונלי)</label>
                      <input 
                        type="number" 
                        value={percentile}
                        onChange={(e) => setPercentile(e.target.value ? Number(e.target.value) : '')}
                        className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        placeholder="למשל: 15"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================= */}
              {/* EDITING AN EVENT IN TIMELINE */}
              {/* ======================================= */}
              {activeSheet === 'edit' && editingEvent && (
                <div className="space-y-4">
                  <div className="p-3 bg-indigo-950/30 border border-indigo-900/40 rounded-2xl">
                    <span className="text-[11px] text-indigo-300 font-bold block mb-1">עריכת פרטי האירוע</span>
                    <span className="text-xs text-slate-400">
                      סוג אירוע: <b className="text-slate-200">{editingEvent.eventType}</b> • נרשם ע״י {editingEvent.loggedBy === 'PARENT_A' ? settings.parentAName : settings.parentBName}
                    </span>
                  </div>

                  {/* Nested form editors */}
                  {editingEvent.eventType === 'NUTRITION' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl">
                        <button 
                          type="button" 
                          onClick={() => setBottleFeedType('BOTTLE')}
                          className={`py-1.5 rounded-lg text-xs font-bold ${bottleFeedType === 'BOTTLE' ? 'bg-indigo-650 text-white' : 'text-slate-400'}`}
                        >
                          בקבוק
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setBottleFeedType('BREAST')}
                          className={`py-1.5 rounded-lg text-xs font-bold ${bottleFeedType === 'BREAST' ? 'bg-indigo-650 text-white' : 'text-slate-400'}`}
                        >
                          הנקה ישירה
                        </button>
                      </div>

                      {bottleFeedType === 'BOTTLE' ? (
                        <div className="space-y-3 bg-slate-950/40 p-3 rounded-2xl border border-slate-850">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-400">הוצע (מ״ל)</label>
                              <input type="number" value={amountOfferedMl} onChange={(e) => setAmountOfferedMl(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg p-2 text-xs" />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400">נצרך (מ״ל)</label>
                              <input type="number" value={amountConsumedMl} onChange={(e) => setAmountConsumedMl(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg p-2 text-xs" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 bg-slate-950/40 p-3 rounded-2xl border border-slate-850">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-400">צד הנקה</label>
                              <select value={breastSide} onChange={(e) => setBreastSide(e.target.value as any)} className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg p-2 text-xs">
                                <option value="LEFT">שמאל</option>
                                <option value="RIGHT">ימין</option>
                                <option value="BOTH">שניהם</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400">משך זמן (דקות)</label>
                              <input type="number" value={breastDuration} onChange={(e) => setBreastDuration(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg p-2 text-xs" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {editingEvent.eventType === 'DIAPER' && (
                    <div className="space-y-3">
                      <label className="text-xs text-slate-400 font-bold">חיתול מכיל</label>
                      <select 
                        value={diaperContains} 
                        onChange={(e) => setDiaperContains(e.target.value as any)} 
                        className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl p-2.5 text-xs"
                      >
                        <option value="PEE">שתן בלבד</option>
                        <option value="POO">צואה בלבד</option>
                        <option value="BOTH">שתן וצואה</option>
                      </select>
                    </div>
                  )}

                  {editingEvent.eventType === 'WEIGHT' && (
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold">משקל (גרם)</label>
                        <input type="number" value={weightGrams} onChange={(e) => setWeightGrams(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl p-2 text-xs" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold">אחוזון</label>
                        <input type="number" value={percentile} onChange={(e) => setPercentile(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl p-2 text-xs" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SHARED GENERAL FIELDS: CUSTOM TIMESTAMP, NOTE */}
              {activeSheet !== 'sleep' && (
                <div className="space-y-3 pt-3.5 border-t border-slate-800/80">
                  <div className="grid grid-cols-2 gap-3.5">
                    
                    {/* Event Time (Always Visible & Pre-filled) */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-1">שעת האירוע</label>
                      <input
                        type="datetime-local"
                        value={customTimestamp}
                        onChange={(e) => setCustomTimestamp(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-right"
                      />
                    </div>

                    {/* Text Note Field (Always Visible) */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-1">הערה חופשית (אופציונלי)</label>
                      <input
                        type="text"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="למשל: סירב לסיים, פלט מעט"
                        className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {activeSheet !== 'sleep' && (
                <div className="flex gap-3.5 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold py-3 rounded-2xl text-sm shadow-xl transition-colors cursor-pointer"
                  >
                    {submitting ? 'שומר...' : activeSheet === 'edit' ? 'שמור עדכונים' : 'שמור תיעוד רפואי ✔️'}
                  </button>

                  {activeSheet === 'edit' && editingEvent && (
                    <button
                      type="button"
                      onClick={() => handleDeleteEvent(editingEvent.id)}
                      className="bg-rose-950/50 hover:bg-rose-900 border border-rose-900/60 text-rose-300 font-extrabold px-4 rounded-2xl text-xs active:bg-rose-900"
                    >
                      🗑️ מחק אירוע
                    </button>
                  )}
                </div>
              )}

            </form>

          </div>
        </div>
      )}

      {/* FIXED BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-slate-900 border-t border-slate-850 px-6 flex items-center justify-around z-35 backdrop-blur-md">
        
        {/* Nav item 1: LOG */}
        <button 
          onClick={() => setActiveTab('log')}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'log' ? 'text-indigo-400 scale-105 font-black' : 'text-slate-500 hover:text-slate-400 font-bold'
          }`}
        >
          <span className="text-xl">✍️</span>
          <span className="text-xs">רישום חדש</span>
        </button>

        {/* Nav item 2: TIMELINE */}
        <button 
          onClick={() => {
            setActiveTab('timeline');
            fetchEvents();
          }}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'timeline' ? 'text-indigo-400 scale-105 font-black' : 'text-slate-500 hover:text-slate-400 font-bold'
          }`}
        >
          <span className="text-xl">📋</span>
          <span className="text-xs">ציר זמן</span>
        </button>

        {/* Nav item 3: DASHBOARDS */}
        <button 
          onClick={() => setActiveTab('dashboards')}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'dashboards' ? 'text-indigo-400 scale-105 font-black' : 'text-slate-500 hover:text-slate-400 font-bold'
          }`}
        >
          <span className="text-xl">📊</span>
          <span className="text-xs">דאשבורדים</span>
        </button>

        {/* Nav item 4: SETTINGS & EXPORT */}
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'settings' ? 'text-indigo-400 scale-105 font-black' : 'text-slate-500 hover:text-slate-400 font-bold'
          }`}
        >
          <span className="text-xl">⚙️</span>
          <span className="text-xs">הגדרות וייצוא</span>
        </button>

      </nav>

    </div>
  );
}
