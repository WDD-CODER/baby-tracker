/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  ChevronDown,
  ChevronUp,
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
import { BabyEvent, UserSettings, ParentType, EventType, SleepLocationType, DiaperContentType, VomitingSizeType } from './types';

const DiaperIcon = ({ className = "w-5 h-5", strokeWidth = 2 }: { className?: string, strokeWidth?: number }) => (
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

const getSleepCycleAnalysis = (durationMinutes: number | undefined) => {
  if (durationMinutes === undefined) {
    return {
      status: 'ACTIVE',
      text: 'שינה פעילה',
      icon: '💤',
      colorClass: 'text-indigo-400 bg-indigo-950/40 border-indigo-500/30',
      bgClass: 'bg-indigo-950/15',
      borderClass: 'border-indigo-500/30 border-r-indigo-500',
      toastMsg: 'השינה החלה! שעון מעקב מופעל'
    };
  }
  if (durationMinutes < 30) {
    return {
      status: 'BAD',
      text: 'מחזור שינה לא מוצלח',
      icon: '❌',
      colorClass: 'text-rose-300 bg-rose-950/40 border-rose-900/30',
      bgClass: 'bg-rose-950/20',
      borderClass: 'border-rose-900/30 border-r-rose-500',
      toastMsg: `השינה הסתיימה. מחזור שינה לא מוצלח (${durationMinutes} דק׳) ❌`
    };
  } else if (durationMinutes < 45) {
    return {
      status: 'GOOD',
      text: 'מחזור שינה טוב',
      icon: '👍',
      colorClass: 'text-indigo-300 bg-indigo-950/40 border-indigo-900/30',
      bgClass: 'bg-indigo-950/15',
      borderClass: 'border-indigo-900/30 border-r-indigo-500',
      toastMsg: `השינה הסתיימה. מחזור שינה טוב (${durationMinutes} דק׳) 👍`
    };
  } else {
    return {
      status: 'EXCELLENT',
      text: 'מחזור שינה מצוין ומעולה!',
      icon: '🌟',
      colorClass: 'text-emerald-300 bg-emerald-950/40 border-emerald-900/30',
      bgClass: 'bg-emerald-950/15',
      borderClass: 'border-emerald-900/30 border-r-emerald-500',
      toastMsg: `השינה הסתיימה. מחזור שינה מצוין ומעולה! (${durationMinutes} דק׳) 🌟`
    };
  }
};

export default function App() {
  // App state
  const [activeTab, setActiveTab] = useState<'log' | 'timeline' | 'dashboards' | 'settings'>('log');
  const [events, setEvents] = useState<BabyEvent[]>([]);
  const lastLoggedTimestamps = useRef<{ [key: string]: number }>({});
  const [carouselIndex, setCarouselIndex] = useState(0);

  const getLocalDatetimeString = (date = new Date()) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const checkAndRegisterDoubleSubmit = (type: string): boolean => {
    const now = Date.now();
    
    // Check local ref first (very fast, covers rapid clicks)
    const lastRefTime = lastLoggedTimestamps.current[type] || 0;
    if (now - lastRefTime < 10000) {
      console.log(`Canceled duplicate action request to prevent double-click error (type: ${type})`);
      return true;
    }

    // Check state events array
    const matching = events.filter(e => e.eventType === type);
    if (matching.length > 0) {
      const times = matching.map(e => new Date(e.timestamp).getTime());
      const maxTime = Math.max(...times);
      if (now - maxTime < 10000) {
        console.log(`Canceled duplicate action request to prevent double-click error (type: ${type})`);
        return true;
      }
    }

    // Update local ref
    lastLoggedTimestamps.current[type] = now;
    return false;
  };

  const [settings, setSettings] = useState<UserSettings>({
    userId: 'shared-household',
    parentAName: 'אמא',
    parentBName: 'אבא',
    defaultBottleType: 'EXPRESSED_MILK',
    customActivities: ['שגרת בוקר', 'בייבי יוגה', 'שירים', 'טיול בעגלה', 'עיסוי תינוקות']
  });
  const [openSleepSession, setOpenSleepSession] = useState<BabyEvent | null>(null);
  const [activeParent, setActiveParent] = useState<ParentType>(() => {
    const stored = localStorage.getItem('bt_active_parent');
    return (stored === 'PARENT_A' || stored === 'PARENT_B') ? stored : 'PARENT_A';
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active Logging bottom sheets
  const [activeSheet, setActiveSheet] = useState<'bottle' | 'diaper' | 'activity' | 'weight' | 'pumping' | 'vomiting' | 'sleep' | 'edit' | null>(null);
  const [editingEvent, setEditingEvent] = useState<BabyEvent | null>(null);

  // Stats Data
  const [nutritionStats, setNutritionStats] = useState<any[]>([]);
  const [sleepStats, setSleepStats] = useState<any[]>([]);
  const [diaperStats, setDiaperStats] = useState<any[]>([]);
  const [weightStats, setWeightStats] = useState<any[]>([]);
  const [dashboardDays, setDashboardDays] = useState<number>(1);

  // Timer state for in-progress sleep
  const [sleepDurationStr, setSleepDurationStr] = useState<string>('00:00');

  // Input states for form entry
  const [bottleFeedType, setBottleFeedType] = useState<'BOTTLE' | 'BREAST'>('BREAST');
  const [bottleLiquidType, setBottleLiquidType] = useState<'EXPRESSED_MILK' | 'FORMULA'>('EXPRESSED_MILK');
  const [amountOfferedMl, setAmountOfferedMl] = useState<number>(120);
  const [amountConsumedMl, setAmountConsumedMl] = useState<number>(120);
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
  
  const [swallowingNoises, setSwallowingNoises] = useState<boolean>(false);

  // Pumping & Vacuuming states
  const [pumpLeftAmount, setPumpLeftAmount] = useState<number>(60);
  const [pumpRightAmount, setPumpRightAmount] = useState<number>(60);
  const [dismissedPumpingBfId, setDismissedPumpingBfId] = useState<string | null>(null);
  const [sentPumpingBfId, setSentPumpingBfId] = useState<string | null>(null);
  const [feedingNotificationSent, setFeedingNotificationSent] = useState<boolean>(false);
  const [noteText, setNoteText] = useState<string>('');
  const [customTimestamp, setCustomTimestamp] = useState<string>('');
  const [customSleepStartAt, setCustomSleepStartAt] = useState<string>('');
  const [customSleepEndAt, setCustomSleepEndAt] = useState<string>('');
  const [sleepLocation, setSleepLocation] = useState<SleepLocationType>('CRIB');
  const [sleepLogType, setSleepLogType] = useState<'TIMER' | 'MANUAL'>('TIMER');
  const [showNoteField, setShowNoteField] = useState(false);

  // Settings modification states
  const [parentANameInput, setParentANameInput] = useState('אמא');
  const [parentBNameInput, setParentBNameInput] = useState('אבא');
  const [defaultBottleTypeInput, setDefaultBottleTypeInput] = useState<'EXPRESSED_MILK' | 'FORMULA'>('EXPRESSED_MILK');

  // Dashboard collapse states and clear data confirmation state
  const [expandedDashboards, setExpandedDashboards] = useState<{ [key: string]: boolean }>({
    nutrition: false,
    sleep: false,
    diaper: false,
    pumping: false,
    weight: false,
    vomiting: false
  });
  const [showQuickVomitingMenu, setShowQuickVomitingMenu] = useState(false);
  const [vomitingSizeInput, setVomitingSizeInput] = useState<VomitingSizeType>('MEDIUM');
  const [clearCutoffDate, setClearCutoffDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [clearType, setClearType] = useState<'all' | 'cutoff' | null>(null);

  // Export states
  const [exportFromDate, setExportFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  });
  const [exportToDate, setExportToDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Big Nap and Bath warning state and auto day-reset tracking
  const [dismissedBigNapWarning, setDismissedBigNapWarning] = useState<boolean>(() => {
    const todayStr = new Date().toDateString();
    return localStorage.getItem(`bt_dismissed_bignap_${todayStr}`) === 'true';
  });
  const [dismissedBathWarning, setDismissedBathWarning] = useState<boolean>(() => {
    const todayStr = new Date().toDateString();
    return localStorage.getItem(`bt_dismissed_bath_${todayStr}`) === 'true';
  });
  const [lastCalculatedDay, setLastCalculatedDay] = useState<string>(() => new Date().toDateString());

  // ==========================================
  // Quick Press vs Hold (Long-press) State Machine
  // ==========================================
  const [showQuickDiaperMenu, setShowQuickDiaperMenu] = useState(false);
  const [holdTimeoutId, setHoldTimeoutId] = useState<any>(null);
  const [pressStartTimestamp, setPressStartTimestamp] = useState<number>(0);
  const [pressStartPos, setPressStartPos] = useState<{ x: number, y: number } | null>(null);
  const [activePressButton, setActivePressButton] = useState<'meal' | 'diaper' | 'sleep' | 'vomiting' | null>(null);

  const handleQuickMealLog = async () => {
    if (checkAndRegisterDoubleSubmit('NUTRITION')) {
      showToast('נרשמה ארוחה ב-10 השניות האחרונות! הפעולה בוטלה למניעת כפל.');
      return;
    }
    setSubmitting(true);
    const timestamp = new Date().toISOString();
    
    const payload: BabyEvent = {
      id: 'quick-meal-' + Date.now(),
      timestamp,
      eventType: 'NUTRITION',
      loggedBy: activeParent,
      notes: '',
      quickRecorded: true,
      nutrition: {
        feedType: 'BREAST',
        spitUp: 'NONE'
      }
    };

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast('הנקה מהירה נרשמה בהצלחה 🤱');
        fetchEvents();
      } else {
        showToast('תקלה ברישום ארוחה מהירה');
      }
    } catch (err) {
      showToast('שגיאת תקשורת עם השרת');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDiaperLog = async (contains: DiaperContentType) => {
    if (checkAndRegisterDoubleSubmit('DIAPER')) {
      showToast('נרשם חיתול ב-10 השניות האחרונות! הפעולה בוטלה למניעת כפל.');
      return;
    }
    setSubmitting(true);
    const timestamp = new Date().toISOString();
    let containsLabel = '';
    if (contains === 'PEE') containsLabel = 'פיפי 💦';
    else if (contains === 'POO') containsLabel = 'קקי 💩';
    else containsLabel = 'פיפי וקקי 💦💩';

    const payload: BabyEvent = {
      id: 'quick-diaper-' + Date.now(),
      timestamp,
      eventType: 'DIAPER',
      loggedBy: activeParent,
      notes: '',
      quickRecorded: true,
      diaper: {
        contains,
        peeVolume: contains !== 'POO' ? 'LIGHT' : undefined,
        pooAmount: contains !== 'PEE' ? 'MEDIUM' : undefined,
        pooColor: contains !== 'PEE' ? 'YELLOW_MUSTARD' : undefined,
        pooTexture: contains !== 'PEE' ? 'SEEDY' : undefined
      }
    };

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(`חיתול נרשם: ${containsLabel}`);
        fetchEvents();
        setShowQuickDiaperMenu(false);
      } else {
        showToast('תקלה ברישום חיתול מהיר');
      }
    } catch (err) {
      showToast('שגיאת תקשורת עם השרת');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickVomitingLog = async (size: VomitingSizeType) => {
    if (checkAndRegisterDoubleSubmit('VOMITING')) {
      showToast('נרשמה פליטה ב-10 השניות האחרונות! הפעולה בוטלה למניעת כפל.');
      return;
    }
    setSubmitting(true);
    const timestamp = new Date().toISOString();
    let sizeLabel = '';
    if (size === 'SMALL') sizeLabel = 'פליטה קלה 💧';
    else if (size === 'MEDIUM') sizeLabel = 'פליטה בינונית 💦';
    else sizeLabel = 'הקאה גדולה ⚠️';

    const payload: Partial<BabyEvent> = {
      timestamp,
      eventType: 'VOMITING',
      loggedBy: activeParent,
      notes: '',
      quickRecorded: true,
      vomiting: {
        size
      }
    };

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(`פליטה נרשמה: ${sizeLabel}`);
        fetchEvents();
        setShowQuickVomitingMenu(false);
      } else {
        showToast('תקלה ברישום פליטה מהירה');
      }
    } catch (err) {
      showToast('שגיאת תקשורת עם השרת');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePointerDownButton = (buttonType: 'meal' | 'diaper' | 'sleep' | 'vomiting', e: React.PointerEvent) => {
    if (e.button !== 0) return; // Only trigger for main left click / single touch
    
    setActivePressButton(buttonType);
    setPressStartTimestamp(Date.now());
    setPressStartPos({ x: e.clientX, y: e.clientY });

    // Start a timer for 550ms for holding down
    const timer = setTimeout(() => {
      try {
        navigator.vibrate?.(50); // Tactile haptic feedback
      } catch (err) {}
      
      if (buttonType === 'meal') {
        openAddSheet('bottle');
      } else if (buttonType === 'diaper') {
        openAddSheet('diaper');
      } else if (buttonType === 'sleep') {
        openAddSheet('sleep' as any);
      } else if (buttonType === 'vomiting') {
        openAddSheet('vomiting' as any);
      }
      
      // Nullify start timestamp so pointerUp knows it was already handled as a long click
      setPressStartTimestamp(0);
      setActivePressButton(null);
      setPressStartPos(null);
    }, 550);

    setHoldTimeoutId(timer);
  };

  const handlePointerUpButton = (buttonType: 'meal' | 'diaper' | 'sleep' | 'vomiting', e: React.PointerEvent) => {
    if (holdTimeoutId) {
      clearTimeout(holdTimeoutId);
      setHoldTimeoutId(null);
    }

    if (pressStartPos) {
      const diffX = Math.abs(e.clientX - pressStartPos.x);
      const diffY = Math.abs(e.clientY - pressStartPos.y);
      if (diffX > 10 || diffY > 10) {
        setPressStartTimestamp(0);
        setActivePressButton(null);
        setPressStartPos(null);
        return;
      }
    }

    if (pressStartTimestamp > 0 && activePressButton === buttonType) {
      const duration = Date.now() - pressStartTimestamp;
      if (duration < 550) {
        // Quick short press!
        if (buttonType === 'meal') {
          handleQuickMealLog();
        } else if (buttonType === 'diaper') {
          setShowQuickDiaperMenu(prev => !prev);
        } else if (buttonType === 'sleep') {
          handleQuickSleepToggle();
        } else if (buttonType === 'vomiting') {
          setShowQuickVomitingMenu(prev => !prev);
        }
      }
    }

    setPressStartTimestamp(0);
    setActivePressButton(null);
    setPressStartPos(null);
  };

  const handlePointerMoveButton = (e: React.PointerEvent) => {
    if (pressStartPos) {
      const diffX = Math.abs(e.clientX - pressStartPos.x);
      const diffY = Math.abs(e.clientY - pressStartPos.y);
      if (diffX > 10 || diffY > 10) {
        if (holdTimeoutId) {
          clearTimeout(holdTimeoutId);
          setHoldTimeoutId(null);
        }
        setPressStartTimestamp(0);
        setActivePressButton(null);
        setPressStartPos(null);
      }
    }
  };

  const handlePointerCancelButton = () => {
    if (holdTimeoutId) {
      clearTimeout(holdTimeoutId);
      setHoldTimeoutId(null);
    }
    setPressStartTimestamp(0);
    setActivePressButton(null);
    setPressStartPos(null);
  };

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
      setSleepDurationStr('00:00:00');
      return;
    }

    const updateTimer = () => {
      const start = new Date(openSleepSession.sleep?.startAt || openSleepSession.timestamp);
      const diffMs = Date.now() - start.getTime();
      if (diffMs < 0) {
        setSleepDurationStr('00:00:00');
        return;
      }
      const totalSecs = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      
      const hoursStr = hours.toString().padStart(2, '0');
      const minsStr = mins.toString().padStart(2, '0');
      const secsStr = secs.toString().padStart(2, '0');
      
      setSleepDurationStr(`${hoursStr}:${minsStr}:${secsStr}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000); // Live tick every 1 second
    return () => clearInterval(interval);
  }, [openSleepSession]);

  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 5000); // Check every 5s for awake minutes and time updates
    return () => clearInterval(timer);
  }, []);

  // Monitor day change to reset the big nap and bath dismissal states
  useEffect(() => {
    const currentDay = new Date(currentTime).toDateString();
    if (currentDay !== lastCalculatedDay) {
      setLastCalculatedDay(currentDay);
      setDismissedBigNapWarning(false);
      setDismissedBathWarning(false);
    }
  }, [currentTime, lastCalculatedDay]);

  const getLastWakeUpTime = () => {
    const lastCompletedSleep = events.find(e => e.eventType === 'SLEEP' && e.sleep?.endAt);
    if (lastCompletedSleep && lastCompletedSleep.sleep?.endAt) {
      return new Date(lastCompletedSleep.sleep.endAt).getTime();
    }
    return null;
  };

  // Send local push notification to the phone/browser
  const sendLocalNotification = (title: string, body: string) => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification(title, { body, icon: '/favicon.ico' });
        } catch (e) {
          console.log("Notification constructor blocked or failed in iframe:", e);
        }
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            try {
              new Notification(title, { body, icon: '/favicon.ico' });
            } catch (e) {
              console.log("Notification failed after permission grant:", e);
            }
          }
        });
      }
    }
  };

  // Request notification permission on first mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Compute countdown and overdue status for next feeding
  const getFeedingCountdown = () => {
    const latestFeed = events.find(e => e.eventType === 'NUTRITION');
    if (!latestFeed) {
      return { display: '02:00:00', isOverdue: false, secondsLeft: 7200 };
    }
    const lastFeedTime = new Date(latestFeed.timestamp).getTime();
    const targetTime = lastFeedTime + 2 * 60 * 60 * 1000; // 2 hours since last feeding
    const diffMs = targetTime - currentTime;
    
    if (diffMs <= 0) {
      return { display: '00:00:00', isOverdue: true, secondsLeft: 0 };
    }
    
    const totalSeconds = Math.floor(diffMs / 1000);
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    const display = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return { display, isOverdue: false, secondsLeft: totalSeconds };
  };

  const getLatestBreastfeeding = () => {
    return events.find(e => e.eventType === 'NUTRITION' && e.nutrition?.feedType === 'BREAST');
  };

  const getTodayPumpingCount = () => {
    const today = new Date().toDateString();
    const pumpingEvents = events.filter(e => {
      if (e.eventType !== 'PUMPING') return false;
      const d = new Date(e.timestamp);
      if (d.toDateString() !== today) return false;
      const hrs = d.getHours();
      return hrs >= 8 && hrs < 16;
    });
    return pumpingEvents.length;
  };

  // Helper to check if a pumping event occurred after a specific timestamp
  const hasPumpedAfterTimestamp = (timestampStr: string) => {
    const timeMs = new Date(timestampStr).getTime();
    return events.some(e => e.eventType === 'PUMPING' && new Date(e.timestamp).getTime() > timeMs);
  };

  // Determine if pumping reminder should show
  const checkPumpingReminderStatus = () => {
    const date = new Date(currentTime);
    const hrs = date.getHours();
    // Only between 8:00 AM and 4:00 PM (8:00 to 16:00)
    if (hrs < 8 || hrs >= 16) return false;

    // Only if today's pumping sessions are less than 3
    if (getTodayPumpingCount() >= 3) return false;

    const latestBf = getLatestBreastfeeding();
    if (!latestBf) return false;

    // Has 15 minutes passed since breastfeeding?
    const bfTime = new Date(latestBf.timestamp).getTime();
    const diffMs = currentTime - bfTime;
    const fifteenMinutesMs = 15 * 60 * 1000;
    
    if (diffMs < fifteenMinutesMs) return false;

    // Has user already pumped after this breastfeeding session?
    if (hasPumpedAfterTimestamp(latestBf.timestamp)) return false;

    // Has user already dismissed this breastfeeding session's reminder?
    if (dismissedPumpingBfId === latestBf.id) return false;

    return true;
  };

  const showPumpingReminder = checkPumpingReminderStatus();

  // Handle pumping dismissal (won't show again for this specific breastfeeding event)
  const handleDismissPumping = () => {
    const latestBf = getLatestBreastfeeding();
    if (latestBf) {
      setDismissedPumpingBfId(latestBf.id);
    }
  };

  // Active check to trigger phone push notifications
  useEffect(() => {
    // 1. Feeding Overdue Notification
    const feedingStatus = getFeedingCountdown();
    if (feedingStatus.isOverdue) {
      if (!feedingNotificationSent) {
        sendLocalNotification("זמן האכלה הגיע! 🍼", "חלפו שעתיים מאז ההאכלה האחרונה. האכלה דחופה נדרשת!");
        setFeedingNotificationSent(true);
      }
    } else {
      if (feedingNotificationSent) {
        setFeedingNotificationSent(false);
      }
    }

    // 2. Breast Milk Pumping Reminder Notification
    const date = new Date(currentTime);
    const hrs = date.getHours();
    if (hrs >= 8 && hrs < 16 && getTodayPumpingCount() < 3) {
      const latestBf = getLatestBreastfeeding();
      if (latestBf) {
        const bfTime = new Date(latestBf.timestamp).getTime();
        const diffMs = currentTime - bfTime;
        const fifteenMinutesMs = 15 * 60 * 1000;
        
        // If 15 minutes have passed, we haven't pumped, we haven't dismissed, and we haven't sent the notification yet
        if (diffMs >= fifteenMinutesMs && 
            !hasPumpedAfterTimestamp(latestBf.timestamp) && 
            dismissedPumpingBfId !== latestBf.id && 
            sentPumpingBfId !== latestBf.id) {
          
          sendLocalNotification("שאיבת חלב מונעת 🍼🤱", "חלפו 15 דקות מאז ההנקה האחרונה. הגיע הזמן לבצע שאיבה מונעת לשמירה!");
          setSentPumpingBfId(latestBf.id);
        }
      }
    }
  }, [currentTime, events, dismissedPumpingBfId, sentPumpingBfId, feedingNotificationSent]);

  const isNapSlotTime = () => {
    const date = new Date(currentTime);
    const hour = date.getHours();
    return hour >= 12 && hour < 16;
  };

  const isBathSlotTime = () => {
    const date = new Date(currentTime);
    const hour = date.getHours();
    return hour >= 17 && hour < 21;
  };

  const isBigNapRecorded = () => {
    const todayStr = new Date(currentTime).toDateString();
    
    // Find if there is a sleep event on the current day that is >= 45 minutes
    // and started/ended in the midday range 11:30 - 15:30 (or overlapping 12:00 - 15:00)
    const nap = events.find(e => {
      if (e.eventType !== 'SLEEP') return false;
      const eventDateStr = new Date(e.timestamp).toDateString();
      if (eventDateStr !== todayStr) return false;
      
      const start = new Date(e.sleep?.startAt || e.timestamp);
      const startHour = start.getHours();
      const duration = e.sleep?.durationMinutes || 0;
      
      // Also account for currently active sleep session
      let activeDuration = 0;
      if (openSleepSession && openSleepSession.id === e.id) {
        const startActive = new Date(openSleepSession.sleep?.startAt || openSleepSession.timestamp);
        activeDuration = Math.floor((currentTime - startActive.getTime()) / (1000 * 60));
      }
      
      const finalDuration = Math.max(duration, activeDuration);
      
      // Midday check (starts between 11:00 and 15:15)
      const isMidday = startHour >= 11 && startHour < 16;
      
      return isMidday && finalDuration >= 45;
    });
    
    if (nap) return true;

    // Additionally check if we currently have an active sleep session that
    // started during midday and has already passed 30 minutes
    if (openSleepSession && openSleepSession.sleep) {
      const start = new Date(openSleepSession.sleep.startAt);
      const startHour = start.getHours();
      const isMidday = startHour >= 11 && startHour < 16;
      const activeDurationMin = Math.floor((currentTime - start.getTime()) / (1000 * 60));
      if (isMidday && activeDurationMin >= 30) {
        return true;
      }
    }
    
    return false;
  };

  const getBabyDayEvents = (allEvents: BabyEvent[]) => {
    const now = new Date();
    const startOfTodayBabyDay = new Date(now);
    startOfTodayBabyDay.setHours(6, 0, 0, 0);

    // If it's before 6:00 AM today, then the baby day started at 6:00 AM yesterday
    if (now.getHours() < 6) {
      startOfTodayBabyDay.setDate(startOfTodayBabyDay.getDate() - 1);
    }

    const babyDayTimestamp = startOfTodayBabyDay.getTime();

    return allEvents.filter(e => {
      return new Date(e.timestamp).getTime() >= babyDayTimestamp;
    });
  };

  const getCutoffDate = () => {
    const now = new Date();
    const startOfTodayBabyDay = new Date(now);
    startOfTodayBabyDay.setHours(6, 0, 0, 0);
    if (now.getHours() < 6) {
      startOfTodayBabyDay.setDate(startOfTodayBabyDay.getDate() - 1);
    }
    const cutoff = new Date(startOfTodayBabyDay);
    cutoff.setDate(cutoff.getDate() - (dashboardDays - 1));
    return cutoff;
  };

  const getFeedingDashboardData = () => {
    const cutoffDate = getCutoffDate();
    
    const feedingEvents = events.filter(e => {
      if (e.eventType !== 'NUTRITION' || !e.nutrition) return false;
      return new Date(e.timestamp) >= cutoffDate;
    });

    const groups: { [dateStr: string]: BabyEvent[] } = {};
    feedingEvents.forEach(e => {
      const d = new Date(e.timestamp);
      const dateStr = d.toLocaleDateString('he-IL', { weekday: 'short', month: 'numeric', day: 'numeric' });
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(e);
    });

    return Object.keys(groups).map(dateStr => {
      const dayEvents = groups[dateStr].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      return {
        dateStr,
        dayEvents
      };
    }).sort((a, b) => {
      if (a.dayEvents.length === 0 || b.dayEvents.length === 0) return 0;
      const dateA = new Date(a.dayEvents[0].timestamp).getTime();
      const dateB = new Date(b.dayEvents[0].timestamp).getTime();
      return dateB - dateA;
    });
  };

  const getDiaperDashboardData = () => {
    const cutoffDate = getCutoffDate();
    
    const diaperEvents = events.filter(e => {
      if (e.eventType !== 'DIAPER' || !e.diaper) return false;
      return new Date(e.timestamp) >= cutoffDate;
    });

    const groups: { [dateStr: string]: BabyEvent[] } = {};
    diaperEvents.forEach(e => {
      const d = new Date(e.timestamp);
      const dateStr = d.toLocaleDateString('he-IL', { weekday: 'short', month: 'numeric', day: 'numeric' });
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(e);
    });

    return Object.keys(groups).map(dateStr => {
      const dayEvents = groups[dateStr].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      return {
        dateStr,
        dayEvents
      };
    }).sort((a, b) => {
      if (a.dayEvents.length === 0 || b.dayEvents.length === 0) return 0;
      const dateA = new Date(a.dayEvents[0].timestamp).getTime();
      const dateB = new Date(b.dayEvents[0].timestamp).getTime();
      return dateB - dateA;
    });
  };

  const getPumpingDashboardData = () => {
    const cutoffDate = getCutoffDate();
    
    const pumpingEvents = events.filter(e => {
      if (e.eventType !== 'PUMPING' || !e.pumping) return false;
      return new Date(e.timestamp) >= cutoffDate;
    });

    const groups: { [dateStr: string]: BabyEvent[] } = {};
    pumpingEvents.forEach(e => {
      const d = new Date(e.timestamp);
      const dateStr = d.toLocaleDateString('he-IL', { weekday: 'short', month: 'numeric', day: 'numeric' });
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(e);
    });

    return Object.keys(groups).map(dateStr => {
      const dayEvents = groups[dateStr].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      return {
        dateStr,
        dayEvents
      };
    }).sort((a, b) => {
      if (a.dayEvents.length === 0 || b.dayEvents.length === 0) return 0;
      const dateA = new Date(a.dayEvents[0].timestamp).getTime();
      const dateB = new Date(b.dayEvents[0].timestamp).getTime();
      return dateB - dateA;
    });
  };

  const getVomitingDashboardData = () => {
    const cutoffDate = getCutoffDate();

    const vomitingEvents = events.filter(e => {
      if (e.eventType !== 'VOMITING') return false;
      return new Date(e.timestamp) >= cutoffDate;
    });

    const groups: { [dateStr: string]: { dayEvents: BabyEvent[] } } = {};
    vomitingEvents.forEach(e => {
      const d = new Date(e.timestamp);
      const dateStr = d.toLocaleDateString('he-IL', { weekday: 'short', month: 'numeric', day: 'numeric' });
      if (!groups[dateStr]) {
        groups[dateStr] = { dayEvents: [] };
      }
      groups[dateStr].dayEvents.push(e);
    });

    return Object.keys(groups).map(dateStr => {
      return {
        dateStr,
        dayEvents: groups[dateStr].dayEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      };
    }).sort((a, b) => {
      if (a.dayEvents.length === 0 || b.dayEvents.length === 0) return 0;
      const dateA = new Date(a.dayEvents[0].timestamp).getTime();
      const dateB = new Date(b.dayEvents[0].timestamp).getTime();
      return dateB - dateA;
    });
  };

  const getSleepTimelineData = () => {
    const cutoffDate = getCutoffDate();

    const sleepEvents = events.filter(e => {
      if (e.eventType !== 'SLEEP' || !e.sleep) return false;
      return new Date(e.timestamp) >= cutoffDate;
    });

    const groups: { [dateStr: string]: BabyEvent[] } = {};
    sleepEvents.forEach(e => {
      const d = new Date(e.sleep?.startAt || e.timestamp);
      const dateStr = d.toLocaleDateString('he-IL', { weekday: 'short', month: 'numeric', day: 'numeric' });
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(e);
    });

    return Object.keys(groups).map(dateStr => {
      const dayEvents = groups[dateStr].sort((a, b) => {
        const startA = new Date(a.sleep?.startAt || a.timestamp).getTime();
        const startB = new Date(b.sleep?.startAt || b.timestamp).getTime();
        return startA - startB;
      });

      const items: any[] = [];
      for (let i = 0; i < dayEvents.length; i++) {
        const current = dayEvents[i];
        const start = new Date(current.sleep?.startAt || current.timestamp);
        const end = current.sleep?.endAt ? new Date(current.sleep.endAt) : new Date();
        const duration = current.sleep?.durationMinutes || Math.floor((end.getTime() - start.getTime()) / (1000 * 60));

        items.push({
          type: 'SLEEP',
          event: current,
          start,
          end,
          duration,
          location: current.sleep?.startLocation || 'CRIB'
        });

        if (i < dayEvents.length - 1) {
          const next = dayEvents[i + 1];
          const nextStart = new Date(next.sleep?.startAt || next.timestamp);
          const gapMs = nextStart.getTime() - end.getTime();
          const gapMinutes = Math.max(0, Math.floor(gapMs / (1000 * 60)));
          items.push({
            type: 'AWAKE_GAP',
            gapMinutes
          });
        }
      }

      return {
        dateStr,
        items
      };
    }).sort((a, b) => {
      const dateA = a.items[0]?.start ? new Date(a.items[0].start).getTime() : 0;
      const dateB = b.items[0]?.start ? new Date(b.items[0].start).getTime() : 0;
      return dateB - dateA;
    });
  };

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
      const fromStr = getCutoffDate().toISOString();

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

  const handleClearData = async (type: 'all' | 'cutoff') => {
    setSubmitting(true);
    try {
      let body: any = {};
      if (type === 'cutoff') {
        // Find start of day in local time as ISO
        const cutoffStart = new Date(`${clearCutoffDate}T00:00:00`);
        body.before = cutoffStart.toISOString();
      }

      const res = await fetch('/api/events/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        showToast(type === 'all' ? 'כל נתוני המערכת נמחקו ואותחלו מחדש ✨' : 'הנתונים הישנים נמחקו בהצלחה. המערכת עודכנה ✨');
        fetchEvents();
        checkOpenSleepSession();
        fetchStats();
      } else {
        showToast('אירעה שגיאה במחיקת הנתונים');
      }
    } catch (err) {
      console.error(err);
      showToast('שגיאה בחיבור לשרת');
    } finally {
      setSubmitting(false);
      setClearType(null);
    }
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
          const dur = data.sleep.durationMinutes || 0;
          const analysis = getSleepCycleAnalysis(dur);
          showToast(analysis.toastMsg);
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

  const handleQuickSleepToggle = async () => {
    if (checkAndRegisterDoubleSubmit('SLEEP')) {
      showToast('שונה מצב שינה ב-10 השניות האחרונות! הפעולה בוטלה למניעת כפל.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/sleep/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loggedBy: activeParent,
          startLocation: 'CRIB',
          quickRecorded: true
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.sleep?.endAt) {
          const dur = data.sleep.durationMinutes || 0;
          const analysis = getSleepCycleAnalysis(dur);
          showToast(`בוקר טוב! ${analysis.toastMsg}`);
          setOpenSleepSession(null);
        } else {
          showToast('לילה טוב! שינה מהירה החלה 💤');
          setOpenSleepSession(data);
        }
        fetchEvents();
      }
    } catch (e) {
      showToast('שגיאה בשינוי מצב שינה מהיר');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let targetType = 'NUTRITION';
    if (activeSheet === 'diaper') targetType = 'DIAPER';
    else if (activeSheet === 'sleep') targetType = 'SLEEP';
    else if (activeSheet === 'activity') targetType = 'ACTIVITY';
    else if (activeSheet === 'weight') targetType = 'WEIGHT';
    else if (activeSheet === 'tummyTime') targetType = 'TUMMY_TIME';
    else if (activeSheet === 'bath') targetType = 'BATH';
    else if (activeSheet === 'pumping') targetType = 'PUMPING';
    else if (activeSheet === 'vomiting') targetType = 'VOMITING';

    if (checkAndRegisterDoubleSubmit(targetType)) {
      showToast('נרשמה פעולה מסוג זה ב-10 השניות האחרונות! הפעולה בוטלה למניעת כפל.');
      return;
    }

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
        spitUp: spitUp !== 'NONE' ? spitUp : undefined,
        swallowingNoises: swallowingNoises
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
    } else if (activeSheet === 'pumping') {
      payload.eventType = 'PUMPING';
      payload.pumping = {
        leftAmountMl: pumpLeftAmount,
        rightAmountMl: pumpRightAmount
      };
    } else if (activeSheet === 'vomiting') {
      payload.eventType = 'VOMITING';
      payload.vomiting = {
        size: vomitingSizeInput
      };
    } else if (activeSheet === 'sleep') {
      payload.eventType = 'SLEEP';
      payload.sleep = {
        startAt: customSleepStartAt ? new Date(customSleepStartAt).toISOString() : new Date().toISOString(),
        endAt: customSleepEndAt ? new Date(customSleepEndAt).toISOString() : new Date().toISOString(),
        startLocation: sleepLocation
      };
      payload.timestamp = payload.sleep.startAt;
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
        spitUp,
        swallowingNoises: swallowingNoises
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
    } else if (editingEvent.eventType === 'PUMPING' && editingEvent.pumping) {
       payload.pumping = {
         leftAmountMl: pumpLeftAmount,
         rightAmountMl: pumpRightAmount
       };
    } else if (editingEvent.eventType === 'SLEEP' && editingEvent.sleep) {
       const startAtIso = customSleepStartAt ? new Date(customSleepStartAt).toISOString() : editingEvent.sleep.startAt;
       const endAtIso = customSleepEndAt ? new Date(customSleepEndAt).toISOString() : null;
       payload.sleep = {
         startAt: startAtIso,
         endAt: endAtIso,
         startLocation: sleepLocation
       };
       payload.timestamp = startAtIso;
    } else if (editingEvent.eventType === 'VOMITING') {
       payload.vomiting = {
         size: vomitingSizeInput
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
    const nowStr = getLocalDatetimeString();
    setCustomTimestamp(nowStr);

    const startObj = new Date(Date.now() - 60 * 60 * 1000);
    const startStr = getLocalDatetimeString(startObj);
    setCustomSleepStartAt(startStr);
    setCustomSleepEndAt(nowStr);
    setSleepLocation('CRIB');
    setSleepLogType('TIMER');

    setShowNoteField(true);
    setEditingEvent(null);
    
    // Set nutrition defaults
    setBottleFeedType('BOTTLE');
    setBottleLiquidType(settings.defaultBottleType);
    setAmountOfferedMl(120);
    setAmountConsumedMl(120);
    setBreastSide('BOTH');
    setBreastDuration(15);
    setSpitUp('NONE');
    setSwallowingNoises(false);

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

    // Pumping defaults
    setPumpLeftAmount(60);
    setPumpRightAmount(60);

    // Vomiting defaults
    setVomitingSizeInput('SMALL');
  };

  const openAddSheet = (type: 'bottle' | 'diaper' | 'activity' | 'weight' | 'pumping' | 'vomiting') => {
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
      setSwallowingNoises(!!event.nutrition.swallowingNoises);
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
    } else if (event.eventType === 'PUMPING' && event.pumping) {
      setPumpLeftAmount(event.pumping.leftAmountMl);
      setPumpRightAmount(event.pumping.rightAmountMl);
    } else if (event.eventType === 'VOMITING' && event.vomiting) {
      setVomitingSizeInput(event.vomiting.size);
    } else if (event.eventType === 'SLEEP' && event.sleep) {
      setCustomSleepStartAt(event.sleep.startAt ? event.sleep.startAt.slice(0, 16) : '');
      setCustomSleepEndAt(event.sleep.endAt ? event.sleep.endAt.slice(0, 16) : '');
      setSleepLocation(event.sleep.startLocation || 'CRIB');
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
  const babyDayEvents = getBabyDayEvents(events);
  const todayDiapers = babyDayEvents.filter(e => e.eventType === 'DIAPER').reverse();
  const todayBottlesCount = babyDayEvents.filter(e => e.eventType === 'NUTRITION' && e.nutrition?.feedType === 'BOTTLE').length;
  const todayBreastCount = babyDayEvents.filter(e => e.eventType === 'NUTRITION' && e.nutrition?.feedType === 'BREAST').length;
  const todayPeeCount = babyDayEvents.filter(e => e.eventType === 'DIAPER' && e.diaper?.contains === 'PEE').length;
  const todayPooCount = babyDayEvents.filter(e => e.eventType === 'DIAPER' && e.diaper?.contains === 'POO').length;
  const todayBothCount = babyDayEvents.filter(e => e.eventType === 'DIAPER' && e.diaper?.contains === 'BOTH').length;

  const todayPumpingEvents = babyDayEvents.filter(e => e.eventType === 'PUMPING').reverse();
  const todayPumpingTotalLeft = todayPumpingEvents.reduce((acc, e) => acc + (e.pumping?.leftAmountMl || 0), 0);
  const todayPumpingTotalRight = todayPumpingEvents.reduce((acc, e) => acc + (e.pumping?.rightAmountMl || 0), 0);
  const todayPumpingTotal = todayPumpingTotalLeft + todayPumpingTotalRight;

  const getTodaySleepStats = () => {
    const sleepEvents = babyDayEvents.filter(e => e.eventType === 'SLEEP');
    let totalMins = 0;
    sleepEvents.forEach(e => {
      totalMins += e.sleep?.durationMinutes || 0;
    });
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    const count = sleepEvents.length;
    return { hrs, mins, count };
  };

  const todaySleepStats = getTodaySleepStats();

  const lastWakeUp = getLastWakeUpTime();
  const awakeDiffMs = lastWakeUp ? (currentTime - lastWakeUp) : 0;
  const awakeMinutes = Math.max(0, Math.floor(awakeDiffMs / (1000 * 60)));
  const awakeHours = Math.floor(awakeMinutes / 60);
  const awakeMins = awakeMinutes % 60;

  const isBathTimeActive = isBathSlotTime() && !dismissedBathWarning;
  const okayAwakeLimit = isBathTimeActive ? 60 : 45;
  const yellowAwakeLimit = isBathTimeActive ? 75 : 60;
  const redAwakeLimit = isBathTimeActive ? 90 : 60;
  const awakeWidgetMinMinutes = isBathTimeActive ? 45 : 35;

  const getAppThemeBgClass = () => {
    // Check feeding overdue status first (highest priority visual warning)
    const feedingStatus = getFeedingCountdown();
    if (feedingStatus.isOverdue) {
      return "bg-gradient-to-b from-red-950/80 via-slate-950 to-slate-950 text-slate-100";
    }

    if (openSleepSession) {
      if (isNapSlotTime()) {
        return "bg-gradient-to-b from-indigo-950/90 via-slate-950 to-slate-950 text-slate-100";
      }
      return "bg-slate-950 text-slate-100";
    }

    if (awakeMinutes > awakeWidgetMinMinutes) {
      if (awakeMinutes <= okayAwakeLimit) {
        return "bg-gradient-to-b from-yellow-950/60 via-slate-950 to-slate-950 text-slate-100";
      } else if (awakeMinutes <= yellowAwakeLimit) {
        return "bg-gradient-to-b from-orange-950/60 via-slate-950 to-slate-950 text-slate-100";
      } else if (isBathTimeActive && awakeMinutes < redAwakeLimit) {
        return "bg-gradient-to-b from-amber-950/65 via-slate-950 to-slate-950 text-slate-100";
      } else {
        return "bg-gradient-to-b from-rose-950/75 via-slate-950 to-slate-950 text-slate-100";
      }
    }

    if (isNapSlotTime()) {
      return "bg-gradient-to-b from-indigo-950/90 via-slate-950 to-slate-950 text-slate-100";
    }

    return "bg-slate-950 text-slate-100";
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans select-none pb-24 transition-all duration-700 ${getAppThemeBgClass()}`} dir="rtl">
      
      {/* Feeding Overdue critical banner */}
      {getFeedingCountdown().isOverdue && (
        <div className={`border-b text-slate-100 py-3.5 px-4 text-xs font-black text-center flex items-center justify-center gap-2.5 shadow-lg transition-all duration-300 ${
          openSleepSession 
            ? 'bg-gradient-to-r from-emerald-600 via-teal-900 to-emerald-600 border-emerald-500/40 text-emerald-100' 
            : 'bg-gradient-to-r from-red-900 via-rose-950 to-red-900 border-red-500/40 text-red-100 animate-pulse'
        }`}>
          <span className="text-sm">{openSleepSession ? '🍼✨' : '🍼🚨'}</span>
          <span>
            {openSleepSession 
              ? 'זמן האכלה הגיע, אך התינוק ישן כעת 💤. זוהי תזכורת ידידותית להאכיל כשיתעורר.' 
              : 'עברו יותר משעתיים מאז הארוחה האחרונה! יש להאכיל את התינוק כעת.'}
          </span>
        </div>
      )}

      {/* Breast milk pumping reminder banner */}
      {showPumpingReminder && (
        <div className="bg-gradient-to-r from-fuchsia-950 via-slate-900 to-fuchsia-950 border-b border-fuchsia-500/30 text-fuchsia-100 py-3.5 px-4 text-xs font-bold text-center flex items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-2 text-right">
            <span className="text-sm">🤱🍼</span>
            <span>עברו 15 דקות מההנקה האחרונה. זהו הזמן המומלץ לשאיבת חלב מונעת (שאיבה {getTodayPumpingCount() + 1}/3 להיום).</span>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSheet('pumping')}
              className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-[11px] font-black px-3 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer"
            >
              בוצע! תיעוד שאיבה ✔️
            </button>
            <button
              type="button"
              onClick={() => handleDismissPumping()}
              className="bg-slate-800 hover:bg-slate-700 text-slate-400 p-1.5 rounded-lg transition-colors cursor-pointer"
              title="בטל תזכורת זו"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Midday Big Nap recommendation banner */}
      {isNapSlotTime() && (
        <div className="bg-gradient-to-r from-indigo-950/90 via-slate-900/95 to-indigo-950/90 border-b border-indigo-500/30 text-indigo-100 py-3 px-4 text-xs font-bold text-center flex items-center justify-center gap-2 shadow-inner transition-all duration-300">
          <Moon className="w-4 h-4 text-indigo-400 animate-pulse shrink-0" />
          <span>צהריים טובים! חלון זמן מומלץ לשנת צהריים גדולה (12:00 - 16:00) 😴</span>
        </div>
      )}

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
          const babyDayEvents = getBabyDayEvents(events);

          if (babyDayEvents.length === 0) {
            return (
              <section className="bg-slate-900/95 border border-slate-800 rounded-3xl p-5 text-center flex flex-col items-center justify-center gap-2.5 shadow-md min-h-[140px]">
                <span className="text-2xl animate-pulse">☀️🌱</span>
                <h3 className="text-sm font-black text-slate-200">יום חדש ורענן!</h3>
                <p className="text-xs text-slate-400 leading-normal max-w-[280px]">
                  עדיין לא נרשמו פעילויות ליום זה (החל מ-6:00 בבוקר). השתמשו בכפתורים למטה כדי לתעד ארוחה, שינה או חיתול!
                </p>
              </section>
            );
          }

          const safeIndex = Math.min(Math.max(0, carouselIndex), babyDayEvents.length - 1);
          const activeEvent = babyDayEvents[safeIndex];

          let icon: React.ReactNode = '🍼';
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
            icon = <DiaperIcon className="w-5 h-5 text-white" strokeWidth={2.5} />;
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
            const isRunning = !activeEvent.sleep.endAt;
            const dur = activeEvent.sleep.durationMinutes;
            const analysis = getSleepCycleAnalysis(isRunning ? undefined : dur);
            icon = analysis.icon;
            title = analysis.text;
            
            if (analysis.status === 'ACTIVE') {
              badgeColor = 'bg-indigo-600 text-white animate-pulse';
              shadowColor = 'shadow-indigo-500/10';
              borderTheme = 'border-indigo-500/30';
            } else if (analysis.status === 'BAD') {
              badgeColor = 'bg-rose-600 text-white';
              shadowColor = 'shadow-rose-500/10';
              borderTheme = 'border-rose-500/30 bg-rose-950/10';
            } else if (analysis.status === 'MINIMAL') {
              badgeColor = 'bg-amber-500 text-white';
              shadowColor = 'shadow-amber-500/10';
              borderTheme = 'border-amber-500/30 bg-amber-950/10';
            } else if (analysis.status === 'GOOD') {
              badgeColor = 'bg-emerald-600 text-white';
              shadowColor = 'shadow-emerald-500/10';
              borderTheme = 'border-emerald-500/30 bg-emerald-950/10';
            } else {
              badgeColor = 'bg-violet-600 text-white';
              shadowColor = 'shadow-violet-500/10';
              borderTheme = 'border-violet-500/30 bg-violet-950/10';
            }

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
          } else if (activeEvent.eventType === 'PUMPING' && activeEvent.pumping) {
            icon = '🍼🤱';
            badgeColor = 'bg-fuchsia-600 text-white';
            shadowColor = 'shadow-fuchsia-500/10';
            borderTheme = 'border-fuchsia-500/30';
            title = 'שאיבת חלב מונעת';
            details = `שמאל: ${activeEvent.pumping.leftAmountMl} מ״ל • ימין: ${activeEvent.pumping.rightAmountMl} מ״ל (סה״ך: ${activeEvent.pumping.leftAmountMl + activeEvent.pumping.rightAmountMl} מ״ל)`;
          }

          if (activeEvent.quickRecorded) {
            details = '';
            if (activeEvent.eventType === 'NUTRITION' && activeEvent.nutrition) {
              if (activeEvent.nutrition.feedType === 'BREAST') {
                title = 'הנקה 🤱';
                icon = '🤱';
                badgeColor = 'bg-sky-500 text-white';
                shadowColor = 'shadow-sky-500/10';
                borderTheme = 'border-sky-500/30';
              } else {
                title = 'האכלה 🍼';
                icon = '🍼';
                badgeColor = 'bg-blue-600 text-white';
                shadowColor = 'shadow-blue-500/10';
                borderTheme = 'border-blue-500/30';
              }
            } else if (activeEvent.eventType === 'DIAPER' && activeEvent.diaper) {
              const contains = activeEvent.diaper.contains;
              const containsLabel = contains === 'PEE' ? 'שתן' : contains === 'POO' ? 'צואה' : 'שתן וצואה';
              title = `חיתול מהיר: ${containsLabel}`;
              icon = <DiaperIcon className="w-5 h-5 text-white" strokeWidth={2.5} />;
              badgeColor = 'bg-teal-500 text-white';
              shadowColor = 'shadow-teal-500/10';
              borderTheme = 'border-teal-500/30';
            } else if (activeEvent.eventType === 'SLEEP' && activeEvent.sleep) {
              title = 'שינה 💤';
              icon = '💤';
              badgeColor = 'bg-indigo-600 text-white';
              shadowColor = 'shadow-indigo-500/10';
              borderTheme = 'border-indigo-500/30';
            }
          }

          return (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 flex flex-col gap-3 relative shadow-lg select-none">
              {/* Top status header */}
              <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                <span className="text-[10px] text-slate-400 font-extrabold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  ציר זמן קרוסלה • {safeIndex + 1} מתוך {babyDayEvents.length}
                </span>
                <span className="text-[10px] text-slate-400 font-bold bg-slate-950 px-2.5 py-1 rounded-full border border-slate-850">
                  {getHebrewDateStr(activeEvent.timestamp)} • {getHeberwTimeStr(activeEvent.timestamp)}
                </span>
              </div>

              {/* Draggable Slider Row with Peeking next/prev cards */}
              <div className="flex items-center gap-2 overflow-hidden w-full py-1">
                
                {/* Left Card Peek - Newer Event (safeIndex - 1) */}
                {safeIndex > 0 ? (
                  <button
                    type="button"
                    onClick={() => setCarouselIndex(prev => prev - 1)}
                    className="w-[12%] h-[110px] bg-slate-950/40 border border-slate-850 rounded-2xl opacity-25 hover:opacity-50 transition-all flex flex-col items-center justify-center gap-1 select-none text-xs shrink-0 cursor-pointer overflow-hidden"
                  >
                    <span className="text-sm inline-flex items-center justify-center">
                      {babyDayEvents[safeIndex - 1].eventType === 'NUTRITION' ? '🍼' : babyDayEvents[safeIndex - 1].eventType === 'DIAPER' ? <DiaperIcon className="w-4 h-4 text-teal-400" /> : '💤'}
                    </span>
                    <span className="text-[8px] text-slate-500 font-mono font-bold leading-none">
                      {getHeberwTimeStr(babyDayEvents[safeIndex - 1].timestamp)}
                    </span>
                  </button>
                ) : (
                  <div className="w-[12%] h-[110px] bg-slate-950/10 border border-slate-850/10 border-dashed rounded-2xl shrink-0 opacity-10" />
                )}

                {/* Central Draggable Card Viewport */}
                <div className="flex-1 min-w-0 overflow-hidden py-0.5">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeEvent.id}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.4}
                      onDragEnd={(e, info) => {
                        const threshold = 40;
                        if (info.offset.x > threshold) {
                          // Dragged right: show newer (decrement index)
                          if (safeIndex > 0) {
                            setCarouselIndex(prev => prev - 1);
                          }
                        } else if (info.offset.x < -threshold) {
                          // Dragged left: show older (increment index)
                          if (safeIndex < babyDayEvents.length - 1) {
                            setCarouselIndex(prev => prev + 1);
                          }
                        }
                      }}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.15, ease: 'easeInOut' }}
                      className={`bg-slate-950/65 rounded-2xl p-3.5 border ${borderTheme} flex items-start gap-3 hover:bg-slate-950 transition-all cursor-grab active:cursor-grabbing shadow-md ${shadowColor}`}
                      onClick={() => openEditSheet(activeEvent)}
                    >
                      {/* Round Badge - uniform size for clean layout */}
                      <div className={`w-11 h-11 text-xl rounded-2xl flex items-center justify-center shrink-0 ${badgeColor} shadow-md`}>
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
                        {details && (
                          <p className="text-xs text-slate-300 font-medium leading-normal">{details}</p>
                        )}
                        
                        {!activeEvent.quickRecorded && activeEvent.notes && (
                          <div className="mt-2 text-[10px] text-slate-400 bg-slate-900/60 py-1 px-2 rounded-lg border border-slate-850/40 italic truncate">
                            💬 {activeEvent.notes}
                          </div>
                        )}

                        <div className="mt-2 flex justify-between items-center text-[9px] text-slate-500 font-bold border-t border-slate-850/30 pt-1.5">
                          <span>נרשם ע״י {activeEvent.loggedBy === 'PARENT_A' ? settings.parentAName : settings.parentBName}</span>
                          <span className="text-indigo-400 font-black flex items-center gap-0.5 hover:underline">
                            {activeEvent.quickRecorded ? 'הגדרות ⚙️' : 'לחץ לעריכה ✏️'}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Right Card Peek - Older Event (safeIndex + 1) */}
                {safeIndex < babyDayEvents.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCarouselIndex(prev => prev + 1)}
                    className="w-[12%] h-[110px] bg-slate-950/40 border border-slate-850 rounded-2xl opacity-25 hover:opacity-50 transition-all flex flex-col items-center justify-center gap-1 select-none text-xs shrink-0 cursor-pointer overflow-hidden"
                  >
                    <span className="text-sm inline-flex items-center justify-center">
                      {babyDayEvents[safeIndex + 1].eventType === 'NUTRITION' ? '🍼' : babyDayEvents[safeIndex + 1].eventType === 'DIAPER' ? <DiaperIcon className="w-4 h-4 text-teal-400" /> : '💤'}
                    </span>
                    <span className="text-[8px] text-slate-500 font-mono font-bold leading-none">
                      {getHeberwTimeStr(babyDayEvents[safeIndex + 1].timestamp)}
                    </span>
                  </button>
                ) : (
                  <div className="w-[12%] h-[110px] bg-slate-950/10 border border-slate-850/10 border-dashed rounded-2xl shrink-0 opacity-10" />
                )}

              </div>

              {/* Indicator dots */}
              <div className="flex justify-center gap-1 pt-0.5">
                {babyDayEvents.slice(0, 8).map((ev, i) => (
                  <span 
                    key={ev.id}
                    className={`h-1 rounded-full transition-all duration-200 ${
                      i === safeIndex ? 'w-4 bg-indigo-500' : 'w-1 bg-slate-800'
                    }`}
                  />
                ))}
                {babyDayEvents.length > 8 && <span className="text-[8px] text-slate-600 font-black pr-1">+{babyDayEvents.length - 8}</span>}
              </div>

            </div>
          );
        })()}

        {/* TAB 1: QUICK LOGGING GRID & HOME */}
        {activeTab === 'log' && (
          <div className="flex flex-col gap-4">
            
            {/* Quick Action Matrix - The Big 5 Buttons (Reachability Optimized) */}
            <section className="grid grid-cols-2 gap-3 mt-1">
              
              {/* Inline Quick Vomiting Options panel */}
              <AnimatePresence>
                {showQuickVomitingMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="col-span-2 bg-slate-900/95 border border-rose-500/40 rounded-3xl p-4 flex flex-col gap-3 shadow-xl z-10"
                  >
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <span className="text-xs font-black text-rose-300 flex items-center gap-1.5">
                        <span className="animate-ping w-2 h-2 rounded-full bg-rose-500 block" />
                        רישום פליטה מהירה (הקלק לבחירה)
                      </span>
                      <button 
                        onClick={() => setShowQuickVomitingMenu(false)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleQuickVomitingLog('SMALL')}
                        className="bg-slate-950 border border-slate-800/80 hover:border-emerald-550 hover:bg-slate-900/50 p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                      >
                        <span className="text-2xl">💧</span>
                        <span className="text-xs font-black text-slate-200">פליטה קלה</span>
                      </button>
                      
                      <button
                        onClick={() => handleQuickVomitingLog('MEDIUM')}
                        className="bg-slate-950 border border-slate-800/80 hover:border-amber-550 hover:bg-slate-900/50 p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                      >
                        <span className="text-2xl">💦</span>
                        <span className="text-xs font-black text-slate-200">פליטה בינונית</span>
                      </button>
                      
                      <button
                        onClick={() => handleQuickVomitingLog('LARGE')}
                        className="bg-slate-950 border border-slate-800/80 hover:border-rose-550 hover:bg-slate-900/50 p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                      >
                        <span className="text-2xl">⚠️</span>
                        <span className="text-xs font-black text-slate-200">הקאה גדולה</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Inline Quick Diaper Options panel (pops up when clicking Diaper quickly, shown above) */}
              <AnimatePresence>
                {showQuickDiaperMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="col-span-2 bg-slate-900/95 border border-teal-500/40 rounded-3xl p-4 flex flex-col gap-3 shadow-xl z-10"
                  >
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <span className="text-xs font-black text-teal-300 flex items-center gap-1.5">
                        <span className="animate-ping w-2 h-2 rounded-full bg-teal-500 block" />
                        רישום חיתול מהיר (הקלק לבחירה)
                      </span>
                      <button 
                        onClick={() => setShowQuickDiaperMenu(false)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleQuickDiaperLog('PEE')}
                        className="bg-slate-950 border border-slate-800/80 hover:border-blue-550 hover:bg-slate-900/50 p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                      >
                        <span className="text-2xl">💦</span>
                        <span className="text-xs font-black text-slate-200">פיפי בלבד</span>
                      </button>
                      
                      <button
                        onClick={() => handleQuickDiaperLog('POO')}
                        className="bg-slate-950 border border-slate-800/80 hover:border-amber-650 hover:bg-slate-900/50 p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                      >
                        <span className="text-2xl">💩</span>
                        <span className="text-xs font-black text-slate-200">קקי בלבד</span>
                      </button>
                      
                      <button
                        onClick={() => handleQuickDiaperLog('BOTH')}
                        className="bg-slate-950 border border-slate-800/80 hover:border-teal-550 hover:bg-slate-900/50 p-3.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                      >
                        <span className="text-2xl">💦💩</span>
                        <span className="text-xs font-black text-slate-200">שניהם יחד</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* 1. Bottle/Nutrition Sheet Trigger with Quick vs Long press */}
              <button 
                onPointerDown={(e) => handlePointerDownButton('meal', e)}
                onPointerUp={(e) => handlePointerUpButton('meal', e)}
                onPointerMove={handlePointerMoveButton}
                onPointerCancel={handlePointerCancelButton}
                onPointerLeave={handlePointerCancelButton}
                onContextMenu={(e) => e.preventDefault()}
                className={`relative bg-slate-900/90 border rounded-3xl p-4 flex flex-col items-center justify-center gap-2.5 shadow-md active:bg-slate-800/85 transition-all min-h-[125px] select-none touch-none focus:outline-none cursor-pointer ${
                  activePressButton === 'meal' 
                    ? 'scale-95 border-blue-500 bg-slate-850 shadow-blue-500/10' 
                    : 'border-slate-800 hover:border-blue-500/40'
                }`}
              >
                <div className="w-11 h-11 bg-blue-550/30 text-blue-400 rounded-2xl flex items-center justify-center border border-blue-500/20">
                  🍼
                </div>
                <div className="text-center">
                  <span className="text-base font-black text-blue-300 block">ארוחה / בקבוק</span>
                  
                  {/* Summary row */}
                  <div className="flex gap-1.5 justify-center mt-0.5 mb-1 text-[10px] font-bold">
                    <span className="text-blue-400">🍼 בקבוקים: {todayBottlesCount}</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-sky-400">🤱 הנקות: {todayBreastCount}</span>
                  </div>

                  <span className="text-[9px] text-slate-500 font-bold block tracking-tight">
                    קליק: ארוחה מהירה 🍼 | החזק: מלא 🤱
                  </span>

                  {/* Countdown display */}
                  <div className={`mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-black font-mono inline-block ${
                    getFeedingCountdown().isOverdue 
                      ? openSleepSession 
                        ? 'bg-emerald-500 text-slate-950 border border-emerald-400' 
                        : 'bg-red-500 text-white animate-pulse' 
                      : 'bg-slate-950 text-slate-300 border border-slate-800/80'
                  }`}>
                    {getFeedingCountdown().isOverdue 
                      ? openSleepSession 
                        ? 'הגיע זמן האכלה (תינוק ישן 💤)' 
                        : 'האכלה דחופה! 🚨' 
                      : `האכלה הבאה: ${getFeedingCountdown().display}`}
                  </div>
                </div>
              </button>

              {/* 2. Diaper Sheet Trigger with Quick vs Long press */}
              <button 
                onPointerDown={(e) => handlePointerDownButton('diaper', e)}
                onPointerUp={(e) => handlePointerUpButton('diaper', e)}
                onPointerMove={handlePointerMoveButton}
                onPointerCancel={handlePointerCancelButton}
                onPointerLeave={handlePointerCancelButton}
                onContextMenu={(e) => e.preventDefault()}
                className={`relative bg-slate-900/90 border rounded-3xl p-4 flex flex-col items-center justify-center gap-2.5 shadow-md active:bg-slate-800/85 transition-all min-h-[125px] select-none touch-none focus:outline-none cursor-pointer ${
                  activePressButton === 'diaper' 
                    ? 'scale-95 border-teal-500 bg-slate-850 shadow-teal-500/10' 
                    : 'border-slate-800 hover:border-teal-500/40'
                }`}
              >
                <div className="w-11 h-11 bg-teal-550/30 text-teal-400 rounded-2xl flex items-center justify-center border border-teal-500/20">
                  🧷
                </div>
                <div className="text-center">
                  <span className="text-base font-black text-teal-300 block">החלפת חיתול</span>

                  {/* Summary row */}
                  <div className="flex gap-1.5 justify-center mt-0.5 mb-1 text-[9px] font-bold">
                    <span className="text-blue-400">💦 {todayPeeCount}</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-amber-500">💩 {todayPooCount}</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-teal-400">💦💩 {todayBothCount}</span>
                  </div>

                  <span className="text-[9px] text-slate-500 font-bold block tracking-tight">
                    קליק: מהיר 💦💩 | החזק: מלא 📋
                  </span>
                </div>
              </button>

              {/* Awake Time Tracker Widget - ONLY visible when awake and > dynamic limit */}
              {!openSleepSession && awakeMinutes > awakeWidgetMinMinutes && (
                <div className={`col-span-2 rounded-3xl p-4 border flex items-center justify-between shadow-md transition-all duration-500 select-none ${
                  awakeMinutes <= okayAwakeLimit
                    ? 'bg-yellow-950/70 border-yellow-550/40 text-yellow-100'
                    : awakeMinutes <= yellowAwakeLimit
                      ? 'bg-orange-950/70 border-orange-550/40 text-orange-100'
                      : isBathTimeActive && awakeMinutes < redAwakeLimit
                        ? 'bg-amber-950/70 border-amber-550/40 text-amber-100 animate-pulse'
                        : 'bg-rose-950/80 border-rose-555/50 text-rose-100 animate-pulse'
                }`}>
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-3xl shadow-sm bg-slate-950/40">
                      {awakeMinutes <= okayAwakeLimit
                        ? '👶🙂'
                        : awakeMinutes <= yellowAwakeLimit
                          ? '👶🥱'
                          : isBathTimeActive && awakeMinutes < redAwakeLimit
                            ? '👶🛀'
                            : '👶😫'}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-extrabold block mb-0.5">מעקב זמן עירות</span>
                      <h3 className="text-sm font-black">
                        {awakeMinutes <= okayAwakeLimit
                          ? 'זמן עירות תקין ⚡'
                          : awakeMinutes <= yellowAwakeLimit
                            ? 'חלון שינה בקרוב! 🥱'
                            : isBathTimeActive && awakeMinutes < redAwakeLimit
                              ? 'זמן התארגנות לשינה / סיום אמבטיה 🛁'
                              : 'עייפות יתר! להרדים מיד ⚠️'}
                      </h3>
                    </div>
                  </div>
                  
                  <div className="text-left">
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">משך זמן ער</span>
                    <span className="text-base font-mono font-black">
                      {awakeHours > 0 
                        ? `${awakeHours}ש׳ ${awakeMins}ד׳` 
                        : `${awakeMins} דק׳`}
                    </span>
                  </div>
                </div>
              )}

              {/* 3. Sleep State Machine - Big Master Button */}
              <button 
                onPointerDown={(e) => handlePointerDownButton('sleep', e)}
                onPointerUp={(e) => handlePointerUpButton('sleep', e)}
                onPointerMove={handlePointerMoveButton}
                onPointerCancel={handlePointerCancelButton}
                onPointerLeave={handlePointerCancelButton}
                onContextMenu={(e) => e.preventDefault()}
                className={`col-span-2 rounded-3xl p-5 flex items-center justify-between shadow-lg transition-all min-h-[90px] select-none touch-none focus:outline-none cursor-pointer ${
                  activePressButton === 'sleep'
                    ? 'scale-[0.97] bg-slate-800/80'
                    : ''
                } ${
                  openSleepSession 
                    ? 'bg-rose-950/70 border border-rose-500/50 text-rose-100 shadow-rose-950/20' 
                    : 'bg-indigo-650 hover:bg-indigo-700 text-white border border-indigo-500/40'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
                    openSleepSession ? 'bg-rose-500 text-white' : 'bg-white text-indigo-600'
                  }`}>
                    <Moon className={`w-7 h-7 ${openSleepSession ? 'animate-pulse' : ''}`} />
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black block">
                      {openSleepSession ? 'להעיר תינוק ⏰' : 'השכבה לישון 💤'}
                    </span>
                    <span className="text-[10px] opacity-80 block mt-0.5 leading-tight font-medium">
                      {openSleepSession ? 'קליק מהיר להעיר ⏰ | החזק להגדרת שינה' : 'קליק מהיר: שינה מהירה עכשיו 💤 | החזק: בחירת מיקום 📋'}
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

              {/* 6. Vomiting Button */}
              <button 
                onPointerDown={(e) => handlePointerDownButton('vomiting', e)}
                onPointerUp={(e) => handlePointerUpButton('vomiting', e)}
                onPointerMove={handlePointerMoveButton}
                onPointerCancel={handlePointerCancelButton}
                onPointerLeave={handlePointerCancelButton}
                onContextMenu={(e) => e.preventDefault()}
                className={`relative bg-slate-900/90 border rounded-3xl p-5 flex flex-col items-center justify-center gap-3 shadow-md active:bg-slate-800/85 transition-all min-h-[120px] select-none touch-none focus:outline-none cursor-pointer ${
                  activePressButton === 'vomiting' 
                    ? 'scale-95 border-rose-500 bg-slate-850 shadow-rose-500/10' 
                    : 'border-slate-800 hover:border-rose-550/45'
                }`}
              >
                <div className="w-11 h-11 bg-rose-550/30 text-rose-400 rounded-2xl flex items-center justify-center border border-rose-500/20">
                  🤮
                </div>
                <div className="text-center">
                  <span className="text-base font-black text-rose-300 block">פליטות / הקאות</span>
                  <span className="text-[9px] text-slate-500 font-bold block tracking-tight">
                    קליק: מהיר 🤮 | החזק: מלא 📋
                  </span>
                </div>
              </button>

            </section>

            {/* Today's Diaper Quick Tracker Row */}
            <section className="bg-slate-900/90 border border-slate-800/85 rounded-3xl p-4 shadow-sm mt-1">
              <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                <h3 className="text-xs font-black text-slate-100 flex items-center gap-2">
                  <span className="text-teal-400">🧷</span>
                  <span>סבב חיתולים יומי (היום)</span>
                </h3>
                <span className="text-[10px] font-bold bg-teal-950 text-teal-300 px-2.5 py-1 rounded-full border border-teal-900/50">
                  {todayDiapers.length} חיתולים
                </span>
              </div>

              {/* Diapers Summary Counts */}
              {todayDiapers.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5 mb-3.5 bg-slate-950/40 p-2 rounded-2xl border border-slate-850/50 text-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold">💦 שתן בלבד</span>
                    <span className="text-sm font-black text-blue-400">{todayDiapers.filter(e => e.diaper?.contains === 'PEE').length}</span>
                  </div>
                  <div className="flex flex-col border-x border-slate-850">
                    <span className="text-[10px] text-slate-400 font-bold">💩 צואה בלבד</span>
                    <span className="text-sm font-black text-amber-500">{todayDiapers.filter(e => e.diaper?.contains === 'POO').length}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold">💦💩 שניהם</span>
                    <span className="text-sm font-black text-teal-400">{todayDiapers.filter(e => e.diaper?.contains === 'BOTH').length}</span>
                  </div>
                </div>
              )}

              {todayDiapers.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4 font-medium">לא נרשמו חיתולים היום (החל מ-6:00 בבוקר)</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto py-1 scrollbar-none">
                  {todayDiapers.map((e) => {
                    const contains = e.diaper?.contains || 'PEE';
                    const timeStr = getHeberwTimeStr(e.timestamp);
                    let emoji = '💦';
                    let bgClass = 'bg-blue-950/40 border-blue-900/30 text-blue-300';

                    if (contains === 'POO') {
                      emoji = '💩';
                      bgClass = 'bg-amber-950/40 border-amber-900/30 text-amber-300';
                    } else if (contains === 'BOTH') {
                      emoji = '💦💩';
                      bgClass = 'bg-teal-950/40 border-teal-900/30 text-teal-300';
                    }

                    return (
                      <button
                        key={e.id}
                        onClick={() => openEditSheet(e)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-2xl border ${bgClass} hover:bg-slate-950 transition-all shrink-0 cursor-pointer min-w-[55px]`}
                        title={`נרשם ע״י ${e.loggedBy === 'PARENT_A' ? settings.parentAName : settings.parentBName}`}
                      >
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm shadow-inner bg-slate-950/45">
                          {emoji}
                        </div>
                        <span className="text-[9px] font-mono font-black">{timeStr}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Today's Pumping/Vacuuming Quick Tracker Row */}
            <section className="bg-slate-900/90 border border-slate-800/85 rounded-3xl p-4 shadow-sm mt-3">
              <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-fuchsia-400">🍼🤱</span>
                  <h3 className="text-xs font-black text-slate-100">
                    שאיבות חלב יומיות (היום)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => openAddSheet('pumping')}
                  className="text-[10px] font-black bg-fuchsia-950 text-fuchsia-300 px-3 py-1.5 rounded-full border border-fuchsia-900/50 hover:bg-fuchsia-900 transition-all cursor-pointer"
                >
                  תיעוד שאיבה יזומה +
                </button>
              </div>

              {/* Pumping Summary counts */}
              {todayPumpingEvents.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5 mb-3.5 bg-slate-950/40 p-2 rounded-2xl border border-slate-850/50 text-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold">⬅️ שד שמאל</span>
                    <span className="text-sm font-black text-fuchsia-400">{todayPumpingTotalLeft} מ״ל</span>
                  </div>
                  <div className="flex flex-col border-x border-slate-850">
                    <span className="text-[10px] text-slate-400 font-bold">➡️ שד ימין</span>
                    <span className="text-sm font-black text-fuchsia-400">{todayPumpingTotalRight} מ״ל</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold">🔄 סך הכל</span>
                    <span className="text-sm font-black text-fuchsia-300">{todayPumpingTotal} מ״ל</span>
                  </div>
                </div>
              )}

              {todayPumpingEvents.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4 font-medium">לא נרשמו שאיבות היום (שאיבות מונעות ורגילות)</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto py-1 scrollbar-none">
                  {todayPumpingEvents.map((e) => {
                    const left = e.pumping?.leftAmountMl || 0;
                    const right = e.pumping?.rightAmountMl || 0;
                    const total = left + right;
                    const timeStr = getHeberwTimeStr(e.timestamp);

                    return (
                      <button
                        key={e.id}
                        onClick={() => openEditSheet(e)}
                        className="flex flex-col items-center gap-1 p-2 rounded-2xl border bg-fuchsia-950/20 border-fuchsia-900/30 text-fuchsia-200 hover:bg-slate-950 transition-all shrink-0 cursor-pointer min-w-[70px]"
                        title={`נרשם ע״י ${e.loggedBy === 'PARENT_A' ? settings.parentAName : settings.parentBName}`}
                      >
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm shadow-inner bg-slate-950/45">
                          🍼
                        </div>
                        <span className="text-[10px] font-black">{total} מ״ל</span>
                        <span className="text-[8px] opacity-75">{left}L / {right}R</span>
                        <span className="text-[8px] font-mono font-black opacity-60 mt-0.5">{timeStr}</span>
                      </button>
                    );
                  })}
                </div>
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
                  let icon: React.ReactNode = '🍼';
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
                    if (e.nutrition.swallowingNoises) {
                      details += ` • 🦩 נשמעו קולות בליעה`;
                    }
                  } else if (e.eventType === 'DIAPER' && e.diaper) {
                    icon = <DiaperIcon className="w-5 h-5 text-teal-400" strokeWidth={2.5} />;
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
                    const isRunning = !e.sleep.endAt;
                    const dur = e.sleep.durationMinutes;
                    const analysis = getSleepCycleAnalysis(isRunning ? undefined : dur);
                    
                    icon = analysis.icon;
                    title = analysis.text;
                    
                    if (analysis.status === 'ACTIVE') {
                      borderClass = 'border-r-4 border-r-indigo-500';
                      bgClass = 'bg-indigo-950/15';
                    } else if (analysis.status === 'BAD') {
                      borderClass = 'border-r-4 border-r-rose-500';
                      bgClass = 'bg-rose-950/20';
                    } else if (analysis.status === 'GOOD') {
                      borderClass = 'border-r-4 border-r-indigo-500';
                      bgClass = 'bg-indigo-950/15';
                    } else {
                      borderClass = 'border-r-4 border-r-emerald-500';
                      bgClass = 'bg-emerald-950/15';
                    }

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
                  } else if (e.eventType === 'PUMPING' && e.pumping) {
                    icon = '🍼🤱';
                    borderClass = 'border-r-4 border-r-fuchsia-500';
                    bgClass = 'bg-fuchsia-950/15';
                    title = 'שאיבת חלב מונעת';
                    details = `שמאל: ${e.pumping.leftAmountMl} מ״ל • ימין: ${e.pumping.rightAmountMl} מ״ל (סה״ך: ${e.pumping.leftAmountMl + e.pumping.rightAmountMl} מ״ל)`;
                  } else if (e.eventType === 'VOMITING' && e.vomiting) {
                    icon = '🤮';
                    borderClass = 'border-r-4 border-r-rose-400';
                    bgClass = 'bg-rose-950/15';
                    title = 'תיעוד פליטה / הקאה';
                    const sizeText = e.vomiting.size === 'SMALL' ? 'פליטה קלה 💧' : e.vomiting.size === 'MEDIUM' ? 'פליטה בינונית 💦' : 'הקאה גדולה ⚠️';
                    details = `דרגה: ${sizeText}`;
                  }

                  return (
                    <div 
                      key={e.id} 
                      onClick={() => openEditSheet(e)}
                      className={`relative flex items-start gap-4 p-3.5 rounded-3xl border border-slate-850 hover:border-slate-700/80 hover:bg-slate-900 transition-all cursor-pointer select-none text-right ${bgClass} ${borderClass}`}
                    >
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-lg shadow-sm bg-slate-950 border border-slate-800">
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline gap-2">
                          <h4 className="text-sm font-black text-slate-100">{title}</h4>
                          <span className="text-[10px] font-mono font-black text-slate-500 shrink-0">
                            {getHeberwTimeStr(e.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 font-medium mt-1 leading-relaxed">
                          {details}
                        </p>
                        
                        {e.notes && (
                          <p className="text-xs text-slate-500 bg-slate-950/40 px-2.5 py-1.5 rounded-xl mt-2 border border-slate-900/50 inline-block">
                            📝 {e.notes}
                          </p>
                        )}
                        
                        <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-slate-850/45">
                          <span className="text-[9px] text-slate-500 font-bold">
                            רשם: {e.loggedBy === 'PARENT_A' ? settings.parentAName : settings.parentBName}
                          </span>
                          {e.quickRecorded && (
                            <span className="text-[9px] text-indigo-400 font-extrabold bg-indigo-950/45 border border-indigo-900/30 px-1.5 py-0.5 rounded-md">
                              ⚡ מהיר
                            </span>
                          )}
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
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-100">📊 דאשבורדים ומדדים</h2>
              
              <div className="bg-slate-950 p-1 rounded-2xl border border-slate-850 flex gap-1">
                {[1, 3, 7, 14].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setDashboardDays(days)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      dashboardDays === days
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    {days === 1 ? 'היום' : `${days} ימים`}
                  </button>
                ))}
              </div>
            </div>

            {/* 1. NUTRITION DASHBOARD */}
            <section className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-blue-300">🍼 יומן תזונה מפורט</h3>
                  <button 
                    type="button"
                    onClick={() => setExpandedDashboards(prev => ({ ...prev, nutrition: !prev.nutrition }))}
                    className="px-2 py-0.5 text-[10px] font-black rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-750 cursor-pointer"
                  >
                    {expandedDashboards.nutrition ? 'צמצם 📁' : 'הרחב 📂'}
                  </button>
                </div>
                <span className="text-[11px] text-blue-400 font-extrabold">🍼 בקבוקים: {todayBottlesCount} | 🤱 הנקות: {todayBreastCount}</span>
              </div>

              {!expandedDashboards.nutrition ? (
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-850 space-y-3.5">
                  {(() => {
                    const daysData = getFeedingDashboardData();
                    let totalMl = 0;
                    let breastCount = 0;
                    let breastDuration = 0;
                    let bottleCount = 0;
                    let totalEvents = 0;

                    daysData.forEach(day => {
                      day.dayEvents.forEach(e => {
                        totalEvents++;
                        if (e.nutrition) {
                          if (e.nutrition.feedType === 'BREAST') {
                            breastCount++;
                            breastDuration += e.nutrition.durationMinutes || 15;
                          } else {
                            bottleCount++;
                            totalMl += e.nutrition.amountConsumedMl || 0;
                          }
                        }
                      });
                    });

                    const avgFeedsPerDay = (totalEvents / Math.max(1, dashboardDays)).toFixed(1);
                    const breastPct = totalEvents > 0 ? Math.round((breastCount / totalEvents) * 100) : 0;
                    const bottlePct = totalEvents > 0 ? Math.round((bottleCount / totalEvents) * 100) : 0;
                    const latest = events.find(e => e.eventType === 'NUTRITION');

                    return (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2.5">
                          <div className="bg-blue-950/20 border border-blue-900/20 p-2.5 rounded-xl text-center">
                            <span className="text-[10px] font-bold text-slate-400 block mb-0.5">סה״כ בקבוק</span>
                            <span className="text-sm font-black text-blue-300">{totalMl} <span className="text-[10px]">מ״ל</span></span>
                          </div>
                          <div className="bg-sky-950/20 border border-sky-900/20 p-2.5 rounded-xl text-center">
                            <span className="text-[10px] font-bold text-slate-400 block mb-0.5">סה״כ הנקות</span>
                            <span className="text-sm font-black text-sky-300">{breastCount} <span className="text-[10px]">({breastDuration} ד׳)</span></span>
                          </div>
                          <div className="bg-indigo-950/20 border border-indigo-900/20 p-2.5 rounded-xl text-center">
                            <span className="text-[10px] font-bold text-slate-400 block mb-0.5">ממוצע יומי</span>
                            <span className="text-sm font-black text-indigo-300">{avgFeedsPerDay} <span className="text-[10px]">ארוחות</span></span>
                          </div>
                        </div>

                        {totalEvents > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-extrabold text-slate-400 px-1">
                              <span>הנקה ישירה ({breastPct}%)</span>
                              <span>האכלת בקבוק ({bottlePct}%)</span>
                            </div>
                            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex">
                              {breastPct > 0 && <div className="bg-sky-500 h-full transition-all" style={{ width: `${breastPct}%` }} />}
                              {bottlePct > 0 && <div className="bg-blue-500 h-full transition-all" style={{ width: `${bottlePct}%` }} />}
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between items-center text-right pt-2 border-t border-slate-850/60">
                          <div className="text-[10px]">
                            <span className="text-slate-400 font-bold">אחרון: </span>
                            {latest ? (
                              <span className="text-blue-200 font-extrabold">
                                {latest.nutrition?.feedType === 'BREAST' ? 'הנקה 🤱' : 'בקבוק 🍼'} • {
                                  latest.nutrition?.feedType === 'BREAST' 
                                    ? `${latest.nutrition.durationMinutes || 15} דק׳` 
                                    : `${latest.nutrition?.amountConsumedMl || 0} מ״ל`
                                } ({new Date(latest.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })})
                              </span>
                            ) : (
                              <span className="text-slate-500">אין נתונים</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setExpandedDashboards(prev => ({ ...prev, nutrition: true }))}
                            className="text-[10px] text-blue-300 hover:text-blue-100 font-black cursor-pointer bg-blue-950/30 px-2 py-1 rounded-lg border border-blue-900/30 transition-all"
                          >
                            גרף ופרטים 📊
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <>
                  {getFeedingDashboardData().length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">אין מספיק נתוני תזונה להצגה</p>
                  ) : (
                    <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                      {getFeedingDashboardData().map((group, idx) => (
                        <div key={idx} className="space-y-2">
                          <div className="text-[10px] font-black text-slate-400 bg-slate-950/40 px-2.5 py-1 rounded-lg inline-block">
                            {group.dateStr}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {group.dayEvents.map((e: BabyEvent) => {
                              const feedType = e.nutrition?.feedType || 'BOTTLE';
                              const timeStr = new Date(e.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                              
                              let bgTheme = 'bg-blue-950/20 border-blue-900/40 text-blue-200';
                              let icon = '🍼';
                              let title = 'בקבוק חלב';
                              let details = '';

                              if (feedType === 'BREAST') {
                                bgTheme = 'bg-sky-950/20 border-sky-900/40 text-sky-200';
                                icon = '🤱';
                                title = 'הנקה ישירה';
                                details = `צד: ${
                                  e.nutrition?.breastSide === 'LEFT' ? 'שמאל ⬅️' : e.nutrition?.breastSide === 'RIGHT' ? 'ימין ➡️' : 'דו-צדדי 🔄'
                                } • ${e.nutrition?.durationMinutes || 15} דק׳`;
                              } else {
                                const isFormula = e.nutrition?.bottleLiquidType === 'FORMULA';
                                title = isFormula ? 'פורמולה / תמ״ל' : 'חלב אם שאוב';
                                details = `נצרך: ${e.nutrition?.amountConsumedMl || 0} מ״ל • הוצע: ${e.nutrition?.amountOfferedMl || 0} מ״ל`;
                              }

                              // Spit up metadata
                              const spitUpValue = e.nutrition?.spitUp;
                              let spitUpBadge = null;
                              if (spitUpValue && spitUpValue !== 'NONE') {
                                const isHeavy = spitUpValue === 'HEAVY_VOMIT';
                                spitUpBadge = (
                                  <div className="flex items-center gap-1.5 mt-1.5 text-[9px] text-rose-400 font-bold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                    <span>{isHeavy ? 'הקאה ⚠️' : 'פליטה קלה'}</span>
                                  </div>
                                );
                              }

                              return (
                                <div key={e.id} onClick={() => openEditSheet(e)} className={`p-3 rounded-2xl border ${bgTheme} flex flex-col justify-between shadow-sm cursor-pointer hover:opacity-85 transition-all`}>
                                  <div className="flex items-start justify-between">
                                    <span className="text-lg">{icon}</span>
                                    <span className="text-[10px] font-extrabold text-slate-400">{timeStr}</span>
                                  </div>
                                  <div className="mt-1.5 text-right">
                                    <h4 className="text-xs font-black text-slate-100">{title}</h4>
                                    {details && (
                                      <p className="text-[10px] text-slate-400 mt-0.5 font-bold leading-tight">
                                        {details}
                                      </p>
                                    )}
                                    {spitUpBadge}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>

            {/* 2. SLEEP DASHBOARD */}
            <section className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-indigo-300">💤 שינה יומית</h3>
                  <button 
                    type="button"
                    onClick={() => setExpandedDashboards(prev => ({ ...prev, sleep: !prev.sleep }))}
                    className="px-2 py-0.5 text-[10px] font-black rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-750 cursor-pointer"
                  >
                    {expandedDashboards.sleep ? 'צמצם 📁' : 'הרחב 📂'}
                  </button>
                </div>
                <span className="text-[11px] text-indigo-400 font-extrabold">💤 {todaySleepStats.hrs}ש׳ {todaySleepStats.mins}ד׳ ({todaySleepStats.count} פעמים)</span>
              </div>

              {!expandedDashboards.sleep ? (
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-850 space-y-3.5">
                  {(() => {
                    const daysData = getSleepTimelineData();
                    let totalMinutes = 0;
                    let sleepCount = 0;
                    const locationCounts: { [key: string]: number } = { CRIB: 0, HANDS: 0, CARRIER: 0, STROLLER: 0 };

                    daysData.forEach(day => {
                      day.items.forEach(item => {
                        if (item.type === 'SLEEP') {
                          sleepCount++;
                          totalMinutes += item.duration;
                          const loc = item.location || 'CRIB';
                          locationCounts[loc] = (locationCounts[loc] || 0) + 1;
                        }
                      });
                    });

                    const totalHrs = Math.floor(totalMinutes / 60);
                    const totalMins = totalMinutes % 60;
                    const avgHrsPerDay = ((totalMinutes / 60) / Math.max(1, dashboardDays)).toFixed(1);

                    const locationColors: { [key: string]: string } = {
                      CRIB: 'bg-indigo-500',
                      HANDS: 'bg-amber-500',
                      CARRIER: 'bg-teal-500',
                      STROLLER: 'bg-rose-500'
                    };

                    const locationLabels: { [key: string]: string } = {
                      CRIB: 'עריסה',
                      HANDS: 'ידיים',
                      CARRIER: 'מנשא',
                      STROLLER: 'עגלה'
                    };

                    return (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2.5">
                          <div className="bg-indigo-950/20 border border-indigo-900/20 p-2.5 rounded-xl text-center">
                            <span className="text-[10px] font-bold text-slate-400 block mb-0.5">סה״כ שינה</span>
                            <span className="text-sm font-black text-indigo-300">{totalHrs}ש׳ {totalMins}ד׳</span>
                          </div>
                          <div className="bg-emerald-950/20 border border-emerald-900/20 p-2.5 rounded-xl text-center">
                            <span className="text-[10px] font-bold text-slate-400 block mb-0.5">ממוצע ליום</span>
                            <span className="text-sm font-black text-emerald-300">{avgHrsPerDay} <span className="text-[10px]">שעות</span></span>
                          </div>
                          <div className="bg-violet-950/20 border border-violet-900/20 p-2.5 rounded-xl text-center">
                            <span className="text-[10px] font-bold text-slate-400 block mb-0.5">מס׳ תנומות</span>
                            <span className="text-sm font-black text-violet-300">{sleepCount} <span className="text-[10px]">פעמים</span></span>
                          </div>
                        </div>

                        {sleepCount > 0 && (
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold text-slate-400 block px-1">מיקומי שינה פופולריים:</span>
                            <div className="flex gap-1.5 flex-wrap">
                              {Object.keys(locationCounts).map(loc => {
                                const count = locationCounts[loc];
                                if (count === 0) return null;
                                return (
                                  <span key={loc} className="inline-flex items-center gap-1 bg-slate-900 border border-slate-800 text-[9px] font-extrabold text-slate-300 px-2 py-0.5 rounded-full">
                                    <span className={`w-1.5 h-1.5 rounded-full ${locationColors[loc] || 'bg-slate-500'}`} />
                                    {locationLabels[loc]} ({count})
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between items-center text-right pt-2 border-t border-slate-850/60">
                          <div className="text-[10px]">
                            <span className="text-slate-400 font-bold">סטטוס: </span>
                            {openSleepSession ? (
                              <span className="text-emerald-400 font-black animate-pulse">
                                ישן כעת 💤 (התחיל ב-{new Date(openSleepSession.sleep?.startAt || openSleepSession.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })})
                              </span>
                            ) : (() => {
                              const latest = events.find(e => e.eventType === 'SLEEP' && e.sleep?.endAt);
                              if (!latest) return <span className="text-slate-500">אין נתונים קודמים</span>;
                              const end = new Date(latest.sleep!.endAt!);
                              return (
                                <span className="text-indigo-200 font-extrabold">
                                  קם ב-{end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} ({latest.sleep?.durationMinutes || 0} דק׳)
                                </span>
                              );
                            })()}
                          </div>
                          <button
                            type="button"
                            onClick={() => setExpandedDashboards(prev => ({ ...prev, sleep: true }))}
                            className="text-[10px] text-indigo-300 hover:text-indigo-100 font-black cursor-pointer bg-indigo-950/30 px-2 py-1 rounded-lg border border-indigo-900/30 transition-all"
                          >
                            גרפים ורצף 📊
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <>
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

                  {/* Live sleep sequential chart (Lower line spots showing spots and minutes of sleep + awake intervals) */}
                  <div className="border-t border-slate-850 pt-3 mt-3">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-xs font-black text-violet-300">📊 תרשים רצף שינה ועירות (רצף ורווחים)</h4>
                      <span className="text-[9px] text-slate-500 font-bold">מציג דפוסי עירות בין שינות</span>
                    </div>

                    {getSleepTimelineData().length === 0 ? (
                      <p className="text-[10px] text-slate-500 text-center py-4">אין נתונים להצגת רצף שינה</p>
                    ) : (
                      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                        {getSleepTimelineData().map((dayGroup, idx) => (
                          <div key={idx} className="bg-slate-950/30 p-3 rounded-2xl border border-slate-850/80 space-y-2.5">
                            <div className="text-[10px] font-extrabold text-slate-300">
                              {dayGroup.dateStr}
                            </div>
                            
                            {/* Horizontal Timeline Container */}
                            <div className="flex flex-col gap-1.5 relative">
                              {dayGroup.items.map((item, itemIdx) => {
                                if (item.type === 'SLEEP') {
                                  const startStr = item.start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                                  const endStr = item.event.sleep?.endAt 
                                    ? item.end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                                    : 'ישן כעת ⏰';

                                  return (
                                    <div 
                                      key={itemIdx} 
                                      onClick={() => openEditSheet(item.event)}
                                      className="bg-gradient-to-r from-indigo-950/80 to-indigo-900/60 border border-indigo-500/30 p-2.5 rounded-xl flex items-center justify-between shadow-sm cursor-pointer hover:opacity-85 transition-all"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-base">💤</span>
                                        <div className="text-right">
                                          <span className="text-xs font-black text-indigo-200">
                                            שינה • {item.duration} דקות
                                          </span>
                                          <span className="text-[9px] text-indigo-400 block font-bold leading-none mt-0.5">
                                            מיקום: {item.location === 'CRIB' ? 'עריסה 🛏️' : item.location === 'HANDS' ? 'על הידיים 🤱' : item.location === 'STROLLER' ? 'עגלה 🛒' : 'מנשא 🎒'}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="text-left">
                                        <span className="text-[10px] font-mono font-extrabold text-indigo-300 bg-indigo-950/50 px-2 py-1 rounded-md border border-indigo-500/20">
                                          {startStr} - {endStr}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                } else {
                                  // AWAKE GAP
                                  const gapMin = item.gapMinutes;
                                  const gapHrs = Math.floor(gapMin / 60);
                                  const gapMins = gapMin % 60;
                                  const gapStr = gapHrs > 0 ? `${gapHrs} ש׳ ${gapMins} דק׳` : `${gapMins} דק׳`;

                                  return (
                                    <div 
                                      key={itemIdx} 
                                      className="flex items-center justify-center gap-2 py-1.5 my-0.5 px-3 border border-dashed border-slate-800 rounded-xl bg-slate-900/30 text-[10px] text-slate-400 font-bold"
                                    >
                                      <span className="text-emerald-400 animate-pulse">🌱</span>
                                      <span>חלון עירות בין שינות:</span>
                                      <span className="font-mono text-emerald-300 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/10">
                                        {gapStr}
                                      </span>
                                    </div>
                                  );
                                }
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>

            {/* 3. DIAPER PATTERN DASHBOARD */}
            <section className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-teal-300">🧷 יומן חיתולים</h3>
                  <button 
                    type="button"
                    onClick={() => setExpandedDashboards(prev => ({ ...prev, diaper: !prev.diaper }))}
                    className="px-2 py-0.5 text-[10px] font-black rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-750 cursor-pointer"
                  >
                    {expandedDashboards.diaper ? 'צמצם 📁' : 'הרחב 📂'}
                  </button>
                </div>
                <span className="text-[11px] text-teal-400 font-extrabold">💦 {todayPeeCount} | 💩 {todayPooCount} | 💦💩 {todayBothCount}</span>
              </div>

              {!expandedDashboards.diaper ? (
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-850 space-y-3.5">
                  {(() => {
                    const daysData = getDiaperDashboardData();
                    let peeCount = 0;
                    let pooCount = 0;
                    let bothCount = 0;
                    let totalCount = 0;

                    daysData.forEach(day => {
                      day.dayEvents.forEach(e => {
                        if (e.diaper) {
                          totalCount++;
                          const type = e.diaper.contains;
                          if (type === 'PEE') peeCount++;
                          else if (type === 'POO') pooCount++;
                          else if (type === 'BOTH') bothCount++;
                        }
                      });
                    });

                    const peePct = totalCount > 0 ? Math.round((peeCount / totalCount) * 100) : 0;
                    const pooPct = totalCount > 0 ? Math.round((pooCount / totalCount) * 100) : 0;
                    const bothPct = totalCount > 0 ? Math.round((bothCount / totalCount) * 100) : 0;

                    const avgDiapersPerDay = (totalCount / Math.max(1, dashboardDays)).toFixed(1);
                    const latest = events.find(e => e.eventType === 'DIAPER');

                    return (
                      <div className="space-y-3">
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div className="bg-cyan-950/20 border border-cyan-900/20 p-2 rounded-xl">
                            <span className="text-[9px] font-bold text-slate-400 block mb-0.5">💦 רק פיפי</span>
                            <span className="text-sm font-black text-cyan-300">{peeCount}</span>
                          </div>
                          <div className="bg-amber-950/20 border border-amber-900/20 p-2 rounded-xl">
                            <span className="text-[9px] font-bold text-slate-400 block mb-0.5">💩 רק קקי</span>
                            <span className="text-sm font-black text-amber-300">{pooCount}</span>
                          </div>
                          <div className="bg-fuchsia-950/20 border border-fuchsia-900/20 p-2 rounded-xl">
                            <span className="text-[9px] font-bold text-slate-400 block mb-0.5">💦💩 שניהם</span>
                            <span className="text-sm font-black text-fuchsia-300">{bothCount}</span>
                          </div>
                          <div className="bg-teal-950/20 border border-teal-900/20 p-2 rounded-xl">
                            <span className="text-[9px] font-bold text-slate-400 block mb-0.5">ממוצע יומי</span>
                            <span className="text-sm font-black text-teal-300">{avgDiapersPerDay}</span>
                          </div>
                        </div>

                        {totalCount > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-extrabold text-slate-400 px-1">
                              <span>💦 פיפי ({peePct}%)</span>
                              <span>💦💩 שניהם ({bothPct}%)</span>
                              <span>💩 קקי ({pooPct}%)</span>
                            </div>
                            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex">
                              {peePct > 0 && <div className="bg-cyan-400 h-full transition-all" style={{ width: `${peePct}%` }} />}
                              {bothPct > 0 && <div className="bg-fuchsia-500 h-full transition-all" style={{ width: `${bothPct}%` }} />}
                              {pooPct > 0 && <div className="bg-amber-500 h-full transition-all" style={{ width: `${pooPct}%` }} />}
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between items-center text-right pt-2 border-t border-slate-850/60">
                          <div className="text-[10px]">
                            <span className="text-slate-400 font-bold">אחרון: </span>
                            {latest ? (
                              <span className="text-teal-200 font-extrabold">
                                {latest.diaper?.contains === 'PEE' ? '💦 פיפי' : latest.diaper?.contains === 'POO' ? '💩 קקי' : '💦💩 פיפי וקקי'} • {
                                  new Date(latest.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                                }
                              </span>
                            ) : (
                              <span className="text-slate-500">אין נתונים</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setExpandedDashboards(prev => ({ ...prev, diaper: true }))}
                            className="text-[10px] text-teal-300 hover:text-teal-100 font-black cursor-pointer bg-teal-950/30 px-2 py-1 rounded-lg border border-teal-900/30 transition-all"
                          >
                            גרף ופרטים 📊
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <>
                  {getDiaperDashboardData().length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">אין מספיק נתוני חיתולים להצגה</p>
                  ) : (
                    <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                      {getDiaperDashboardData().map((group, idx) => (
                        <div key={idx} className="space-y-2">
                          <div className="text-[10px] font-black text-slate-400 bg-slate-950/40 px-2.5 py-1 rounded-lg inline-block">
                            {group.dateStr}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {group.dayEvents.map((e: BabyEvent) => {
                              const contains = e.diaper?.contains || 'PEE';
                              const timeStr = new Date(e.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                              
                              // Styling attributes based on diaper content
                              let bgTheme = 'bg-sky-950/20 border-sky-900/40 text-sky-200';
                              let icon = '💦';
                              let title = 'שתן בלבד';
                              let contentDetail = '';

                              if (contains === 'POO') {
                                bgTheme = 'bg-amber-950/20 border-amber-900/40 text-amber-200';
                                icon = '💩';
                                title = 'צואה בלבד';
                              } else if (contains === 'BOTH') {
                                bgTheme = 'bg-teal-950/30 border-teal-900/40 text-teal-200';
                                icon = '💦💩';
                                title = 'שתן וצואה';
                              }

                              // Extra metadata strings
                              const metaParts: string[] = [];
                              if (contains !== 'POO' && e.diaper?.peeVolume) {
                                metaParts.push(e.diaper.peeVolume === 'LIGHT' ? 'קל' : 'כבד מאוד 💦');
                              }
                              if (contains !== 'PEE' && e.diaper?.pooAmount) {
                                const sizeText = e.diaper.pooAmount === 'SMALL' ? 'קטן' : e.diaper.pooAmount === 'MEDIUM' ? 'בינוני' : 'גלישה ⚠️';
                                metaParts.push(sizeText);
                              }
                              contentDetail = metaParts.join(' • ');

                              // Color display for poo
                              const pooColorValue = e.diaper?.pooColor;
                              let pooColorDot = null;
                              if (contains !== 'PEE' && pooColorValue) {
                                const colorDotBg = pooColorValue === 'YELLOW_MUSTARD' ? 'bg-amber-400' : pooColorValue === 'GREEN' ? 'bg-green-600' : 'bg-amber-850';
                                const colorText = pooColorValue === 'YELLOW_MUSTARD' ? 'צהוב חרדל' : pooColorValue === 'GREEN' ? 'ירוק' : 'חום';
                                pooColorDot = (
                                  <div className="flex items-center gap-1.5 mt-1.5 text-[9px] text-slate-400 font-bold">
                                    <span className={`w-2.5 h-2.5 rounded-full ${colorDotBg} border border-white/15`} />
                                    <span>{colorText}</span>
                                  </div>
                                );
                              }

                              return (
                                <div key={e.id} onClick={() => openEditSheet(e)} className={`p-3 rounded-2xl border ${bgTheme} flex flex-col justify-between shadow-sm cursor-pointer hover:opacity-85 transition-all`}>
                                  <div className="flex items-start justify-between">
                                    <span className="text-lg">{icon}</span>
                                    <span className="text-[10px] font-extrabold text-slate-400">{timeStr}</span>
                                  </div>
                                  <div className="mt-1.5 text-right">
                                    <h4 className="text-xs font-black text-slate-100">{title}</h4>
                                    {contentDetail && (
                                      <p className="text-[10px] text-slate-400 mt-0.5 font-bold leading-tight">
                                        {contentDetail}
                                      </p>
                                    )}
                                    {pooColorDot}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>

            {/* 3.5. BREAST MILK PUMPING DASHBOARD */}
            <section className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-fuchsia-300">🍼🤱 יומן שאיבות חלב</h3>
                  <button 
                    type="button"
                    onClick={() => setExpandedDashboards(prev => ({ ...prev, pumping: !prev.pumping }))}
                    className="px-2 py-0.5 text-[10px] font-black rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-750 cursor-pointer"
                  >
                    {expandedDashboards.pumping ? 'צמצם 📁' : 'הרחב 📂'}
                  </button>
                </div>
                <span className="text-[11px] text-fuchsia-400 font-extrabold">סה״ך שאיבות היום: {todayPumpingTotal} מ״ל</span>
              </div>

              {!expandedDashboards.pumping ? (
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-850 space-y-3.5">
                  {(() => {
                    const daysData = getPumpingDashboardData();
                    let leftTotal = 0;
                    let rightTotal = 0;
                    let sessionCount = 0;

                    daysData.forEach(day => {
                      day.dayEvents.forEach(e => {
                        if (e.pumping) {
                          sessionCount++;
                          leftTotal += e.pumping.leftAmountMl || 0;
                          rightTotal += e.pumping.rightAmountMl || 0;
                        }
                      });
                    });

                    const grandTotal = leftTotal + rightTotal;
                    const avgPumpedPerDay = Math.round(grandTotal / Math.max(1, dashboardDays));

                    const leftPct = grandTotal > 0 ? Math.round((leftTotal / grandTotal) * 100) : 50;
                    const rightPct = grandTotal > 0 ? Math.round((rightTotal / grandTotal) * 100) : 50;

                    const latest = events.find(e => e.eventType === 'PUMPING');

                    return (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2.5">
                          <div className="bg-fuchsia-950/20 border border-fuchsia-900/20 p-2.5 rounded-xl text-center">
                            <span className="text-[10px] font-bold text-slate-400 block mb-0.5">סה״כ נשאב</span>
                            <span className="text-sm font-black text-fuchsia-300">{grandTotal} <span className="text-[10px]">מ״ל</span></span>
                          </div>
                          <div className="bg-purple-950/20 border border-purple-900/20 p-2.5 rounded-xl text-center">
                            <span className="text-[10px] font-bold text-slate-400 block mb-0.5">ממוצע ליום</span>
                            <span className="text-sm font-black text-purple-300">{avgPumpedPerDay} <span className="text-[10px]">מ״ל</span></span>
                          </div>
                          <div className="bg-pink-950/20 border border-pink-900/20 p-2.5 rounded-xl text-center">
                            <span className="text-[10px] font-bold text-slate-400 block mb-0.5">מס׳ שאיבות</span>
                            <span className="text-sm font-black text-pink-300">{sessionCount} <span className="text-[10px]">פעמים</span></span>
                          </div>
                        </div>

                        {grandTotal > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-extrabold text-slate-400 px-1">
                              <span>⬅️ שמאל: {leftTotal} מ״ל ({leftPct}%)</span>
                              <span>ימין: {rightTotal} מ״ל ({rightPct}%) ➡️</span>
                            </div>
                            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex">
                              <div className="bg-fuchsia-400 h-full transition-all" style={{ width: `${leftPct}%` }} />
                              <div className="bg-purple-500 h-full transition-all" style={{ width: `${rightPct}%` }} />
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between items-center text-right pt-2 border-t border-slate-850/60">
                          <div className="text-[10px]">
                            <span className="text-slate-400 font-bold">אחרון: </span>
                            {latest ? (
                              <span className="text-fuchsia-200 font-extrabold">
                                שמאל: {latest.pumping?.leftAmountMl || 0} מ״ל | ימין: {latest.pumping?.rightAmountMl || 0} מ״ל ({
                                  new Date(latest.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                                })
                              </span>
                            ) : (
                              <span className="text-slate-500">אין נתונים</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setExpandedDashboards(prev => ({ ...prev, pumping: true }))}
                            className="text-[10px] text-fuchsia-300 hover:text-fuchsia-100 font-black cursor-pointer bg-fuchsia-950/30 px-2 py-1 rounded-lg border border-fuchsia-900/30 transition-all"
                          >
                            גרף ופרטים 📊
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <>
                  {getPumpingDashboardData().length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">אין מספיק נתוני שאיבות להצגה</p>
                  ) : (
                    <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                      {getPumpingDashboardData().map((group, idx) => {
                        const groupTotalLeft = group.dayEvents.reduce((acc: number, e: BabyEvent) => acc + (e.pumping?.leftAmountMl || 0), 0);
                        const groupTotalRight = group.dayEvents.reduce((acc: number, e: BabyEvent) => acc + (e.pumping?.rightAmountMl || 0), 0);
                        const groupTotal = groupTotalLeft + groupTotalRight;

                        return (
                          <div key={idx} className="space-y-2">
                            <div className="flex justify-between items-center bg-slate-950/40 px-2.5 py-1.5 rounded-lg">
                              <span className="text-[10px] font-black text-slate-400">{group.dateStr}</span>
                              <span className="text-[10px] font-black text-fuchsia-400">יומי: {groupTotal} מ״ל (שמאל: {groupTotalLeft} | ימין: {groupTotalRight})</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {group.dayEvents.map((e: BabyEvent) => {
                                const left = e.pumping?.leftAmountMl || 0;
                                const right = e.pumping?.rightAmountMl || 0;
                                const total = left + right;
                                const timeStr = new Date(e.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

                                return (
                                  <div key={e.id} onClick={() => openEditSheet(e)} className="p-3 rounded-2xl border bg-fuchsia-950/20 border-fuchsia-900/30 text-fuchsia-200 flex flex-col justify-between shadow-sm cursor-pointer hover:bg-fuchsia-950/35 transition-all">
                                    <div className="flex items-start justify-between">
                                      <span className="text-sm">🍼</span>
                                      <span className="text-[10px] font-extrabold text-slate-400">{timeStr}</span>
                                    </div>
                                    <div className="mt-1.5 text-right">
                                      <h4 className="text-xs font-black text-slate-100">שאיבה</h4>
                                      <p className="text-[11px] text-fuchsia-300 mt-1 font-extrabold leading-tight">
                                        שמאל: {left} מ״ל • ימין: {right} מ״ל
                                      </p>
                                      <span className="text-[9px] bg-fuchsia-950 px-2 py-0.5 rounded-full inline-block mt-1 font-black text-fuchsia-100">
                                        סך הכל: {total} מ״ל
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </section>

            {/* 3.8. VOMITING & SPIT-UP DASHBOARD */}
            <section className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-rose-300">🤮 יומן פליטות והקאות</h3>
                  <button 
                    type="button"
                    onClick={() => setExpandedDashboards(prev => ({ ...prev, vomiting: !prev.vomiting }))}
                    className="px-2 py-0.5 text-[10px] font-black rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-750 cursor-pointer"
                  >
                    {expandedDashboards.vomiting ? 'צמצם 📁' : 'הרחב 📂'}
                  </button>
                </div>
                <span className="text-[11px] text-rose-400 font-extrabold">פליטות/הקאות שנרשמו: {getVomitingDashboardData().reduce((acc, g) => acc + g.dayEvents.length, 0)}</span>
              </div>

              {!expandedDashboards.vomiting ? (
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-850 space-y-3.5">
                  {(() => {
                    const daysData = getVomitingDashboardData();
                    let smallCount = 0;
                    let mediumCount = 0;
                    let largeCount = 0;
                    let totalCount = 0;

                    daysData.forEach(day => {
                      day.dayEvents.forEach(e => {
                        totalCount++;
                        const size = e.vomiting?.size || 'MEDIUM';
                        if (size === 'SMALL') smallCount++;
                        else if (size === 'MEDIUM') mediumCount++;
                        else if (size === 'LARGE') largeCount++;
                      });
                    });

                    const smallPct = totalCount > 0 ? Math.round((smallCount / totalCount) * 100) : 0;
                    const mediumPct = totalCount > 0 ? Math.round((mediumCount / totalCount) * 100) : 0;
                    const largePct = totalCount > 0 ? Math.round((largeCount / totalCount) * 100) : 0;

                    const avgPerDay = (totalCount / Math.max(1, dashboardDays)).toFixed(1);
                    const latest = events.find(e => e.eventType === 'VOMITING');

                    return (
                      <div className="space-y-3">
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div className="bg-rose-950/10 border border-rose-900/10 p-2 rounded-xl">
                            <span className="text-[9px] font-bold text-slate-400 block mb-0.5">💧 קלה</span>
                            <span className="text-sm font-black text-rose-300">{smallCount}</span>
                          </div>
                          <div className="bg-rose-950/20 border border-rose-900/20 p-2 rounded-xl">
                            <span className="text-[9px] font-bold text-slate-400 block mb-0.5">💦 בינונית</span>
                            <span className="text-sm font-black text-rose-300">{mediumCount}</span>
                          </div>
                          <div className="bg-red-950/30 border border-red-900/30 p-2 rounded-xl">
                            <span className="text-[9px] font-bold text-slate-400 block mb-0.5">⚠️ הקאה</span>
                            <span className="text-sm font-black text-red-300">{largeCount}</span>
                          </div>
                          <div className="bg-slate-950/20 border border-slate-900/20 p-2 rounded-xl">
                            <span className="text-[9px] font-bold text-slate-400 block mb-0.5">ממוצע יומי</span>
                            <span className="text-sm font-black text-slate-300">{avgPerDay}</span>
                          </div>
                        </div>

                        {totalCount > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-extrabold text-slate-400 px-1">
                              <span>💧 קלה ({smallPct}%)</span>
                              <span>💦 בינונית ({mediumPct}%)</span>
                              <span>⚠️ הקאה ({largePct}%)</span>
                            </div>
                            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex">
                              {smallPct > 0 && <div className="bg-rose-300 h-full transition-all" style={{ width: `${smallPct}%` }} />}
                              {mediumPct > 0 && <div className="bg-rose-500 h-full transition-all" style={{ width: `${mediumPct}%` }} />}
                              {largePct > 0 && <div className="bg-red-600 h-full transition-all" style={{ width: `${largePct}%` }} />}
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between items-center text-right pt-2 border-t border-slate-850/60">
                          <div className="text-[10px]">
                            <span className="text-slate-400 font-bold">אחרון: </span>
                            {latest ? (
                              <span className="text-rose-200 font-extrabold">
                                {latest.vomiting?.size === 'SMALL' ? 'פליטה קלה 💧' : latest.vomiting?.size === 'MEDIUM' ? 'פליטה בינונית 💦' : 'הקאה גדולה ⚠️'} • {
                                  new Date(latest.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                                }
                              </span>
                            ) : (
                              <span className="text-slate-500">אין פליטות/הקאות</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setExpandedDashboards(prev => ({ ...prev, vomiting: true }))}
                            className="text-[10px] text-rose-300 hover:text-rose-100 font-black cursor-pointer bg-rose-950/30 px-2 py-1 rounded-lg border border-rose-900/30 transition-all"
                          >
                            פרטים 📊
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <>
                  {getVomitingDashboardData().length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">לא נרשמו פליטות או הקאות בטווח הזמן שנבחר</p>
                  ) : (
                    <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                      {getVomitingDashboardData().map((group, idx) => (
                        <div key={idx} className="space-y-2">
                          <div className="flex justify-between items-center bg-slate-950/40 px-2.5 py-1.5 rounded-lg">
                            <span className="text-[10px] font-black text-slate-400">{group.dateStr}</span>
                            <span className="text-[10px] font-black text-rose-400">כמות: {group.dayEvents.length}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {group.dayEvents.map((e: BabyEvent) => {
                              const size = e.vomiting?.size || 'MEDIUM';
                              const sizeLabel = size === 'SMALL' ? 'פליטה קלה 💧' : size === 'MEDIUM' ? 'פליטה בינונית 💦' : 'הקאה גדולה ⚠️';
                              const timeStr = new Date(e.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                              const bgTheme = size === 'LARGE' ? 'bg-rose-950/20 border-rose-900/40 text-rose-200' : 'bg-slate-950/20 border-slate-850 text-slate-300';

                              return (
                                <div key={e.id} onClick={() => openEditSheet(e)} className={`p-3 rounded-2xl border ${bgTheme} flex flex-col justify-between shadow-sm cursor-pointer hover:opacity-85 transition-all`}>
                                  <div className="flex items-start justify-between">
                                    <span className="text-sm">🤮</span>
                                    <span className="text-[10px] font-extrabold text-slate-400">{timeStr}</span>
                                  </div>
                                  <div className="mt-1.5 text-right">
                                    <h4 className="text-xs font-black text-slate-100">{sizeLabel}</h4>
                                    {e.notes && (
                                      <p className="text-[10px] text-slate-400 mt-1 italic leading-tight truncate">
                                        {e.notes}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>

            {/* 4. WEIGHT TRACKER CLINICAL */}
            <section className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-sm">
              <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-pink-300">⚖️ מעקב משקל בקליניקה</h3>
                  <button 
                    type="button"
                    onClick={() => setExpandedDashboards(prev => ({ ...prev, weight: !prev.weight }))}
                    className="px-2 py-0.5 text-[10px] font-black rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-750 cursor-pointer"
                  >
                    {expandedDashboards.weight ? 'צמצם 📁' : 'הרחב 📂'}
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 font-bold">שקילות: {weightStats.length}</span>
              </div>

              {!expandedDashboards.weight ? (
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-850 space-y-3 mt-3">
                  {(() => {
                    const latest = events.find(e => e.eventType === 'WEIGHT' && e.weight);
                    const earliest = [...events].reverse().find(e => e.eventType === 'WEIGHT' && e.weight);

                    let diffGrams = 0;
                    if (latest && earliest && latest.id !== earliest.id) {
                      diffGrams = latest.weight!.weightGrams - earliest.weight!.weightGrams;
                    }

                    return (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="bg-pink-950/20 border border-pink-900/20 p-2.5 rounded-xl text-center">
                            <span className="text-[10px] font-bold text-slate-400 block mb-0.5">⚖️ משקל אחרון</span>
                            {latest ? (
                              <span className="text-sm font-black text-pink-300">{(latest.weight!.weightGrams / 1000).toFixed(3)} <span className="text-[10px]">ק״ג</span></span>
                            ) : (
                              <span className="text-xs text-slate-500">אין שקילה</span>
                            )}
                          </div>
                          <div className="bg-emerald-950/20 border border-emerald-900/20 p-2.5 rounded-xl text-center">
                            <span className="text-[10px] font-bold text-slate-400 block mb-0.5">📈 שינוי מצטבר</span>
                            <span className={`text-sm font-black ${diffGrams >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {diffGrams >= 0 ? '+' : ''}{(diffGrams / 1000).toFixed(3)} ק״ג
                            </span>
                          </div>
                        </div>

                        {latest?.weight?.percentile && (
                          <div className="bg-slate-900 border border-slate-850 p-2.5 rounded-xl flex justify-between items-center text-xs">
                            <span className="text-slate-400 font-bold">אחוזון גדילה נוכחי:</span>
                            <span className="text-pink-300 font-black">אחוזון {latest.weight.percentile}%</span>
                          </div>
                        )}

                        <div className="flex justify-between items-center text-right pt-2 border-t border-slate-850/60">
                          <div className="text-[10px]">
                            <span className="text-slate-400 font-bold">תאריך שקילה: </span>
                            {latest ? (
                              <span className="text-pink-200 font-extrabold">
                                {new Date(latest.timestamp).toLocaleDateString('he-IL', { weekday: 'short', month: 'numeric', day: 'numeric' })}
                              </span>
                            ) : (
                              <span className="text-slate-500">אין נתונים</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setExpandedDashboards(prev => ({ ...prev, weight: true }))}
                            className="text-[10px] text-pink-300 hover:text-pink-100 font-black cursor-pointer bg-pink-950/30 px-2 py-1 rounded-lg border border-pink-900/30 transition-all"
                          >
                            גרף גדילה 📊
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="mt-3 space-y-3">
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

            {/* DATA MANAGEMENT & RESET SECTION */}
            <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
              <h3 className="text-base font-black text-rose-400 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-rose-400" />
                <span>ניהול ואתחול נתוני מערכת</span>
              </h3>
              <p className="text-xs text-slate-400 leading-normal">
                כאן תוכלו לנקות את היסטוריית המערכת - לאתחל מחדש לגמרי או למחוק נתונים ישנים כדי להשאיר את המידע מעודכן בלבד.
              </p>

              <div className="space-y-4 pt-2">
                {/* Option 1: Backwards deletion */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-850 space-y-3">
                  <span className="text-xs font-black text-slate-200 block">🧹 אפשרות א׳: ניקוי נתונים מתאריך מסוים ואחורה</span>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    המערכת תמחק לצמיתות את כל האירועים שהתרחשו בתאריך הנבחר ואחורה. המידע מהתאריך הזה והלאה יישאר ללא שינוי, כך שתתחילו מחדש מאותו היום.
                  </p>
                  
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">בחר תאריך יעד למחיקה אחורה:</label>
                      <input 
                        type="date" 
                        value={clearCutoffDate}
                        onChange={(e) => setClearCutoffDate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-right"
                      />
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => setClearType('cutoff')}
                      className="w-full bg-rose-950/40 text-rose-400 hover:bg-rose-950/75 border border-rose-900/45 font-bold py-2 px-4 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>מחק נתונים מתאריך {clearCutoffDate} ואחורה</span>
                    </button>
                  </div>
                </div>

                {/* Option 2: Factory reset */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-850 space-y-3">
                  <span className="text-xs font-black text-red-400 block">⚠️ אפשרות ב׳: אתחול מחדש מלא (התחלה מאפס)</span>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    מוחק לצמיתות את כל האירועים, הארוחות, השינה והנתונים במערכת. פעולה זו אינה הפיכה ותחזיר את האפליקציה למצב נקי לחלוטין.
                  </p>
                  
                  <button
                    type="button"
                    onClick={() => setClearType('all')}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-2.5 px-4 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>אתחל את כל הנתונים והתחל מאפס</span>
                  </button>
                </div>
              </div>
            </section>

          </div>
        )}

      </main>

      {/* BOTTOM MODALS / SHEETS PANEL (ONE-HANDED INPUT OPTIMIZED) */}
      {activeSheet && (
        <div className="fixed inset-0 bg-black/80 z-40 flex items-center justify-center p-4 transition-opacity">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-[32px] p-5 shadow-2xl max-h-[92vh] overflow-y-auto z-50">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {activeSheet === 'bottle' ? '🍼' : 
                   activeSheet === 'diaper' ? '🧷' : 
                   activeSheet === 'activity' ? '🎨' : 
                   activeSheet === 'weight' ? '⚖️' : 
                   activeSheet === 'pumping' ? '🍼🤱' : 
                   activeSheet === 'vomiting' ? '🤮' : 
                   activeSheet === 'sleep' ? '💤' : '✏️'}
                </span>
                <h3 className="text-base font-black text-slate-100">
                  {activeSheet === 'bottle' ? 'תיעוד ארוחה / הנקה' : 
                   activeSheet === 'diaper' ? 'תיעוד החלפת חיתול' : 
                   activeSheet === 'activity' ? 'תיעוד פעילות' : 
                   activeSheet === 'weight' ? 'שקילת משקל רפואי' : 
                   activeSheet === 'pumping' ? 'שאיבת חלב מונעת' : 
                   activeSheet === 'vomiting' ? 'תיעוד פליטה / הקאה' : 
                   activeSheet === 'sleep' ? 'תיעוד שינת תינוק' : 'עריכת אירוע קיים'}
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
                  {/* Swallowing noises button (with irrelevant icon, e.g., 🦩) */}
                  <button
                    type="button"
                    onClick={() => setSwallowingNoises(prev => !prev)}
                    className={`w-full py-2.5 px-4 rounded-2xl text-xs font-black border transition-all flex items-center justify-between cursor-pointer ${
                      swallowingNoises 
                        ? 'bg-blue-950 text-blue-300 border-blue-500 shadow-md' 
                        : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-sm">🦩</span>
                      <span>קולות בליעה? (Swallowing noises?)</span>
                    </span>
                    <span className="text-xs font-extrabold font-mono">
                      {swallowingNoises ? 'כן ✓' : 'לא'}
                    </span>
                  </button>

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
                              onClick={() => {
                                setAmountOfferedMl(prev => {
                                  const val = Math.max(0, prev - 10);
                                  setAmountConsumedMl(val);
                                  return val;
                                });
                              }}
                              className="w-11 h-11 bg-slate-800 text-slate-200 rounded-xl flex items-center justify-center font-bold active:bg-slate-700"
                            >
                              -10
                            </button>
                            <button 
                              type="button" 
                              onClick={() => {
                                setAmountOfferedMl(prev => {
                                  const val = Math.max(0, prev - 5);
                                  setAmountConsumedMl(val);
                                  return val;
                                });
                              }}
                              className="w-10 h-10 bg-slate-850 text-slate-200 rounded-xl flex items-center justify-center font-bold active:bg-slate-700 text-xs"
                            >
                              -5
                            </button>
                            <button 
                              type="button" 
                              onClick={() => {
                                setAmountOfferedMl(prev => {
                                  const val = prev + 5;
                                  setAmountConsumedMl(val);
                                  return val;
                                });
                              }}
                              className="w-10 h-10 bg-slate-850 text-slate-200 rounded-xl flex items-center justify-center font-bold active:bg-slate-700 text-xs"
                            >
                              +5
                            </button>
                            <button 
                              type="button" 
                              onClick={() => {
                                setAmountOfferedMl(prev => {
                                  const val = prev + 10;
                                  setAmountConsumedMl(val);
                                  return val;
                                });
                              }}
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
                  {/* Selector for Live Tracker vs Manual Range */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-850">
                    <button
                      type="button"
                      onClick={() => setSleepLogType('TIMER')}
                      className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        sleepLogType === 'TIMER' 
                          ? 'bg-indigo-650 text-white shadow-md' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      ⏱️ מעקב פעיל / טיימר
                    </button>
                    <button
                      type="button"
                      onClick={() => setSleepLogType('MANUAL')}
                      className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        sleepLogType === 'MANUAL' 
                          ? 'bg-indigo-650 text-white shadow-md' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      📅 תיעוד שינה שהסתיימה
                    </button>
                  </div>

                  {sleepLogType === 'TIMER' ? (
                    <div className="space-y-4">
                      <p className="text-xs text-indigo-300 bg-indigo-950/40 p-3 rounded-2xl border border-indigo-900/40 font-medium text-right">
                        מעקב שינה פעיל. בחר את שעת תחילת השינה ולחץ על מיקום ההשכבה כדי להתחיל את שעון המעקב:
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
                        <label className="block text-xs font-black text-slate-400 mb-1.5">מיקום השכבה (יתחיל את הטיימר)</label>
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
                              className="py-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-2xl text-xs font-black text-slate-200 text-center active:bg-slate-800 cursor-pointer"
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 text-right">
                      <p className="text-xs text-indigo-300 bg-indigo-950/40 p-3 rounded-2xl border border-indigo-900/40 font-medium">
                        הזן ידנית את זמני ההירדמות והיקיצה של התינוק כדי ליצור תיעוד מלא:
                      </p>

                      <div>
                        <label className="block text-xs font-black text-slate-400 mb-1">💤 שעת תחילת שינה (הלך לישון)</label>
                        <input
                          type="datetime-local"
                          value={customSleepStartAt}
                          onChange={(e) => setCustomSleepStartAt(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-right font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-slate-400 mb-1">⏰ שעת התעוררות (הקיץ משנתו)</label>
                        <input
                          type="datetime-local"
                          value={customSleepEndAt}
                          onChange={(e) => setCustomSleepEndAt(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-right font-medium"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-black text-slate-400 font-bold">📍 מיקום השכבה</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { value: 'CRIB', label: '🛌 עריסה' },
                            { value: 'HANDS', label: '🤲 ידיים' },
                            { value: 'CARRIER', label: '🎒 מנשא' },
                            { value: 'STROLLER', label: '🛒 עגלה' }
                          ].map((item) => (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => setSleepLocation(item.value as SleepLocationType)}
                              className={`py-2.5 rounded-xl text-xs font-black text-center transition-all border cursor-pointer ${
                                sleepLocation === item.value 
                                  ? 'bg-indigo-950 text-indigo-300 border-indigo-500 shadow-md' 
                                  : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-850/60">
                        <label className="block text-xs font-black text-slate-400 mb-1.5">הערה לשינה (אופציונלי)</label>
                        <input
                          type="text"
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="למשל: נרדם בקושי, התעורר מרעש"
                          className="w-full bg-slate-950 border border-slate-850 text-slate-200 rounded-xl px-3 py-2.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-right"
                        />
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={submitting}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold py-3 rounded-2xl text-sm shadow-xl transition-colors cursor-pointer"
                        >
                          {submitting ? 'שומר...' : 'שמור תיעוד שינה ✔️'}
                        </button>
                      </div>
                    </div>
                  )}
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
              {/* PUMPING FORM */}
              {/* ======================================= */}
              {activeSheet === 'pumping' && (
                <div className="space-y-4">
                  {/* Left Breast Pump amount */}
                  <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-850 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-black text-slate-400 block">⬅️ שד שמאל (מ״ל)</span>
                        <span className="text-lg font-black text-fuchsia-400">
                          {pumpLeftAmount} מ״ל
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button 
                          type="button" 
                          onClick={() => setPumpLeftAmount(prev => Math.max(0, prev - 10))}
                          className="w-8 h-8 bg-slate-800 text-slate-200 rounded-lg flex items-center justify-center font-bold active:bg-slate-700 text-xs"
                        >
                          -10
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setPumpLeftAmount(prev => prev + 10)}
                          className="w-8 h-8 bg-slate-800 text-slate-200 rounded-lg flex items-center justify-center font-bold active:bg-slate-700 text-xs"
                        >
                          +10
                        </button>
                      </div>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="250" 
                      step="5" 
                      value={pumpLeftAmount} 
                      onChange={(e) => setPumpLeftAmount(Number(e.target.value))}
                      className="w-full accent-fuchsia-500 bg-slate-800 rounded-lg appearance-none h-1.5 cursor-pointer"
                    />
                  </div>

                  {/* Right Breast Pump amount */}
                  <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-850 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-black text-slate-400 block">➡️ שד ימין (מ״ל)</span>
                        <span className="text-lg font-black text-fuchsia-400">
                          {pumpRightAmount} מ״ל
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button 
                          type="button" 
                          onClick={() => setPumpRightAmount(prev => Math.max(0, prev - 10))}
                          className="w-8 h-8 bg-slate-800 text-slate-200 rounded-lg flex items-center justify-center font-bold active:bg-slate-700 text-xs"
                        >
                          -10
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setPumpRightAmount(prev => prev + 10)}
                          className="w-8 h-8 bg-slate-800 text-slate-200 rounded-lg flex items-center justify-center font-bold active:bg-slate-700 text-xs"
                        >
                          +10
                        </button>
                      </div>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="250" 
                      step="5" 
                      value={pumpRightAmount} 
                      onChange={(e) => setPumpRightAmount(Number(e.target.value))}
                      className="w-full accent-fuchsia-500 bg-slate-800 rounded-lg appearance-none h-1.5 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* ======================================= */}
              {/* VOMITING FORM */}
              {/* ======================================= */}
              {activeSheet === 'vomiting' && (
                <div className="space-y-4">
                  <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-850 space-y-3">
                    <label className="text-xs font-black text-slate-300 block">דרגת/גודל הפליטה</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setVomitingSizeInput('SMALL')}
                        className={`py-3.5 px-2 rounded-2xl border text-xs font-black flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          vomitingSizeInput === 'SMALL'
                            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 shadow-md'
                            : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        <span className="text-xl">💧</span>
                        <span>פליטה קלה</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setVomitingSizeInput('MEDIUM')}
                        className={`py-3.5 px-2 rounded-2xl border text-xs font-black flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          vomitingSizeInput === 'MEDIUM'
                            ? 'bg-amber-950/40 border-amber-500/50 text-amber-300 shadow-md'
                            : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        <span className="text-xl">💦</span>
                        <span>פליטה בינונית</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setVomitingSizeInput('LARGE')}
                        className={`py-3.5 px-2 rounded-2xl border text-xs font-black flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          vomitingSizeInput === 'LARGE'
                            ? 'bg-rose-950/40 border-rose-500/50 text-rose-300 shadow-md'
                            : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        <span className="text-xl">⚠️</span>
                        <span>הקאה גדולה</span>
                      </button>
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
                      {/* Swallowing noises button (with irrelevant icon, e.g., 🦩) */}
                      <button
                        type="button"
                        onClick={() => setSwallowingNoises(prev => !prev)}
                        className={`w-full py-2.5 px-4 rounded-2xl text-xs font-black border transition-all flex items-center justify-between cursor-pointer ${
                          swallowingNoises 
                            ? 'bg-blue-950 text-blue-300 border-blue-500 shadow-md' 
                            : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-sm">🦩</span>
                          <span>קולות בליעה? (Swallowing noises?)</span>
                        </span>
                        <span className="text-xs font-extrabold font-mono">
                          {swallowingNoises ? 'כן ✓' : 'לא'}
                        </span>
                      </button>

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

                  {editingEvent.eventType === 'PUMPING' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 font-bold">⬅️ שד שמאל (מ״ל)</label>
                          <input type="number" value={pumpLeftAmount} onChange={(e) => setPumpLeftAmount(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl p-2 text-xs" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-bold">➡️ שד ימין (מ״ל)</label>
                          <input type="number" value={pumpRightAmount} onChange={(e) => setPumpRightAmount(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl p-2 text-xs" />
                        </div>
                      </div>
                    </div>
                  )}

                  {editingEvent.eventType === 'VOMITING' && (
                    <div className="space-y-3 bg-slate-950/40 p-4 rounded-2xl border border-slate-850 font-sans text-right">
                      <label className="text-xs font-black text-slate-300 block mb-2">דרגת/גודל הפליטה</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setVomitingSizeInput('SMALL')}
                          className={`py-3.5 px-2 rounded-2xl border text-xs font-black flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            vomitingSizeInput === 'SMALL'
                              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 shadow-md'
                              : 'bg-slate-900 border-slate-850 text-slate-400'
                          }`}
                        >
                          <span className="text-xl">💧</span>
                          <span>פליטה קלה</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setVomitingSizeInput('MEDIUM')}
                          className={`py-3.5 px-2 rounded-2xl border text-xs font-black flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            vomitingSizeInput === 'MEDIUM'
                              ? 'bg-amber-950/40 border-amber-500/50 text-amber-300 shadow-md'
                              : 'bg-slate-900 border-slate-850 text-slate-400'
                          }`}
                        >
                          <span className="text-xl">💦</span>
                          <span>פליטה בינונית</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setVomitingSizeInput('LARGE')}
                          className={`py-3.5 px-2 rounded-2xl border text-xs font-black flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            vomitingSizeInput === 'LARGE'
                              ? 'bg-rose-950/40 border-rose-500/50 text-rose-300 shadow-md'
                              : 'bg-slate-900 border-slate-850 text-slate-400'
                          }`}
                        >
                          <span className="text-xl">⚠️</span>
                          <span>הקאה גדולה</span>
                        </button>
                      </div>
                    </div>
                  )}
                   {editingEvent.eventType === 'SLEEP' && (
                    <div className="space-y-4 text-right">
                      <div>
                        <label className="block text-xs font-black text-slate-400 mb-1">💤 שעת תחילת שינה (הלך לישון)</label>
                        <input
                          type="datetime-local"
                          value={customSleepStartAt}
                          onChange={(e) => setCustomSleepStartAt(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-right font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-black text-slate-400 mb-1">⏰ שעת התעוררות (הקיץ משנתו)</label>
                        <input
                          type="datetime-local"
                          value={customSleepEndAt}
                          onChange={(e) => setCustomSleepEndAt(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-right font-medium"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-black text-slate-400 font-bold">📍 מיקום השכבה</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { value: 'CRIB', label: '🛌 עריסה' },
                            { value: 'HANDS', label: '🤲 ידיים' },
                            { value: 'CARRIER', label: '🎒 מנשא' },
                            { value: 'STROLLER', label: '🛒 עגלה' }
                          ].map((item) => (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => setSleepLocation(item.value as SleepLocationType)}
                              className={`py-2.5 rounded-xl text-xs font-black text-center transition-all border cursor-pointer ${
                                sleepLocation === item.value 
                                  ? 'bg-indigo-950 text-indigo-300 border-indigo-500 shadow-md' 
                                  : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-700'
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

              {/* SHARED GENERAL FIELDS: CUSTOM TIMESTAMP, NOTE */}
              {activeSheet !== 'sleep' && (
                <div className="space-y-3 pt-3.5 border-t border-slate-800/80">
                  <div className="grid grid-cols-2 gap-3.5">
                    
                    {/* Event Time (Always Visible & Pre-filled) */}
                    {!(activeSheet === 'edit' && editingEvent?.eventType === 'SLEEP') && (
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 mb-1">שעת האירוע</label>
                        <input
                          type="datetime-local"
                          value={customTimestamp}
                          onChange={(e) => setCustomTimestamp(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-right"
                        />
                      </div>
                    )}

                    {/* Text Note Field (Always Visible) */}
                    <div className={activeSheet === 'edit' && editingEvent?.eventType === 'SLEEP' ? 'col-span-2' : ''}>
                      <label className="block text-[10px] font-black text-slate-400 mb-1">הערה חופשית (אופציונלי)</label>
                      <input
                        type="text"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="למשל: סירב לסיים, פלט מעט"
                        className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-right"
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

      {/* Floating Big Nap Warning Pill */}
      {!isBigNapRecorded() && !dismissedBigNapWarning && (
        <div className="fixed bottom-24 right-4 z-30">
          <motion.button
            type="button"
            initial={{ scale: 0, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0, y: 50 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const todayStr = new Date().toDateString();
              localStorage.setItem(`bt_dismissed_bignap_${todayStr}`, 'true');
              setDismissedBigNapWarning(true);
              showToast('ההתראה הוסתרה להיום ✔️');
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-550 hover:to-indigo-550 text-white font-black px-4 py-3 rounded-full shadow-2xl border border-indigo-400/30 animate-bounce cursor-pointer text-xs"
          >
            <span className="text-sm">😴</span>
            <span>חסרה שנת צהריים גדולה 💤</span>
            <span className="w-5 h-5 rounded-full bg-black/25 flex items-center justify-center text-[10px] hover:bg-black/40 mr-1 transition-all">✕</span>
          </motion.button>
        </div>
      )}

      {/* Floating Bath Time Reminder Pill */}
      {isBathSlotTime() && !dismissedBathWarning && (
        <div className="fixed bottom-24 left-4 z-30">
          <motion.button
            type="button"
            initial={{ scale: 0, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0, y: 50 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const todayStr = new Date().toDateString();
              localStorage.setItem(`bt_dismissed_bath_${todayStr}`, 'true');
              setDismissedBathWarning(true);
              showToast('תזכורת האמבטיה הוסתרה ✔️');
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-450 hover:to-rose-550 text-white font-black px-4.5 py-3.5 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.45)] border border-amber-400 animate-pulse cursor-pointer text-xs"
          >
            <span className="text-base animate-bounce">🛁</span>
            <span>זמן לאמבטיה היומית! 🧼🫧</span>
            <span className="w-5 h-5 rounded-full bg-black/25 flex items-center justify-center text-[10px] hover:bg-black/40 mr-1.5 transition-all">✕</span>
          </motion.button>
        </div>
      )}

      {/* CONFIRMATION MODAL FOR CLEARING/RESETTING DATA */}
      {clearType && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 transition-opacity">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-[32px] p-6 shadow-2xl z-50 text-right space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-base font-black text-rose-400">
                {clearType === 'all' ? 'אתחול מלא ומחיקת כל הנתונים' : 'מחיקת נתונים מתאריך מסוים ואחורה'}
              </h3>
            </div>
            
            <p className="text-xs text-slate-300 leading-normal font-medium">
              {clearType === 'all' ? (
                'האם אתה בטוח לחלוטין שברצונך למחוק את כל הנתונים והאירועים של התינוק במערכת? פעולה זו תמחק לצמיתות את כל הארוחות, ההנקות, השקילות, השינות והחיתולים, ולא יהיה ניתן לשחזר אותם!'
              ) : (
                `האם אתה בטוח שברצונך למחוק לצמיתות את כל האירועים שנרשמו בתאריך ${clearCutoffDate} ואחורה? נתוני המערכת יישארו פעילים רק עבור אירועים מהתאריך הזה והלאה.`
              )}
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setClearType(null)}
                disabled={submitting}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-2xl text-xs transition-all cursor-pointer"
              >
                ביטול
              </button>
              <button
                onClick={() => handleClearData(clearType)}
                disabled={submitting}
                className="flex-1 bg-rose-650 hover:bg-rose-700 text-white font-black py-2.5 rounded-2xl text-xs shadow-lg transition-all cursor-pointer"
              >
                {submitting ? 'מוחק...' : 'כן, למחוק לצמיתות'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
