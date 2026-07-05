/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// A beautiful, guaranteed 24-hour date + time picker. Native
// <input type="datetime-local"> renders AM/PM on locale-dependent devices and
// cannot be forced to 24h via HTML. This composes quick relative presets, a date
// row (today/yesterday chips + a native <input type="date"> fallback for far-off
// dates — dates have no AM/PM), and a custom 24h time control (styled scroll
// columns + a +/-5 minute nudge). Value in/out is the same "YYYY-MM-DDTHH:mm"
// string the native datetime-local input used, so it is a drop-in replacement.

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Check, ChevronLeft, ChevronRight } from 'lucide-react';

interface DateTime24Props {
  value: string; // "YYYY-MM-DDTHH:mm"
  onChange: (value: string) => void;
  className?: string;
}

interface Parts {
  date: string;
  hour: string;
  minute: string;
}

// ---- Pure wall-clock helpers (no timezone conversion during arithmetic) ----

// Current Israel wall-clock time as "YYYY-MM-DDTHH:mm".
const nowInIsrael = (): string =>
  new Date()
    .toLocaleString('sv-SE', { timeZone: 'Asia/Jerusalem' })
    .replace(' ', 'T')
    .slice(0, 16);

// Split "YYYY-MM-DDTHH:mm" defensively, tolerating empty/partial input.
const parseValue = (value: string): Parts => {
  const [datePart = '', timePart = ''] = (value || '').split('T');
  const [h = '', m = ''] = timePart.split(':');
  return {
    date: datePart,
    hour: h.length ? h.padStart(2, '0') : '00',
    minute: m.length ? m.padStart(2, '0') : '00',
  };
};

const compose = (date: string, hour: string, minute: string): string =>
  `${date}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;

// Shift a wall-clock "YYYY-MM-DDTHH:mm" by deltaMin minutes, rolling hours/days.
// The local Date constructor is used as a naive wall-clock container: we never
// convert timezones here, so parse-local + read-local stays internally
// consistent regardless of the browser's timezone.
const shiftMinutes = (value: string, deltaMin: number): string => {
  const { date, hour, minute } = parseValue(value || nowInIsrael());
  const [y, mo, d] = date.split('-').map(Number);
  const dt = new Date(y, mo - 1, d, Number(hour), Number(minute));
  dt.setMinutes(dt.getMinutes() + deltaMin);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
};

// Hebrew "יום א׳, 5 ביולי · 14:30" for the live preview.
const formatHebrewPreview = (value: string): string => {
  const { date, hour, minute } = parseValue(value);
  if (!date) return '';
  const [y, mo, d] = date.split('-').map(Number);
  const dt = new Date(y, mo - 1, d);
  const label = dt.toLocaleDateString('he-IL', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
  return `${label} · ${hour}:${minute}`;
};

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

// ---- Styled 24h scroll column for hour / minute ----

function ScrollColumn({
  options,
  selected,
  onPick,
  onClose,
}: {
  options: string[];
  selected: string;
  onPick: (v: string) => void;
  onClose: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  // Center the selected value inside the scroll container when it opens.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-v="${selected}"]`);
    el?.scrollIntoView({ block: 'center' });
  }, [selected]);
  return (
    <>
      {/* Backdrop closes on outside tap */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <motion.div
        ref={listRef}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        className="absolute z-50 mt-1 w-16 max-h-40 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-xl scrollbar-none"
      >
        {options.map((o) => (
          <button
            key={o}
            type="button"
            data-v={o}
            onClick={() => {
              onPick(o);
              onClose();
            }}
            className={`block w-full py-2 text-center text-sm font-mono font-bold transition-colors ${
              o === selected ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            {o}
          </button>
        ))}
      </motion.div>
    </>
  );
}

// ---- Main component ----

export function DateTime24({ value, onChange, className }: DateTime24Props) {
  const { date, hour, minute } = parseValue(value);
  const [showDateInput, setShowDateInput] = useState(false);
  const [openCol, setOpenCol] = useState<null | 'hour' | 'minute'>(null);

  const today = nowInIsrael().slice(0, 10);
  const yesterday = shiftMinutes(nowInIsrael(), -1440).slice(0, 10);

  const emit = (next: string) => {
    if (!parseValue(next).date) return; // only emit a full, valid datetime
    onChange(next);
  };

  const setDate = (d: string) => emit(compose(d, hour, minute));
  const setHour = (h: string) => emit(compose(date || today, h, minute));
  const setMinute = (m: string) => emit(compose(date || today, hour, m));
  const nudge = (delta: number) => emit(shiftMinutes(value || compose(today, hour, minute), delta));

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-black transition-colors border ${
      active
        ? 'bg-indigo-600 border-indigo-500 text-white'
        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
    }`;

  const isNow = value === nowInIsrael();
  const isCustomDate = date !== '' && date !== today && date !== yesterday;
  const preview = formatHebrewPreview(value);

  return (
    <div className={`flex flex-col gap-2.5 ${className ?? ''}`} dir="rtl">
      {/* 1. Quick presets */}
      <div className="flex items-center gap-2">
        <button type="button" className={chip(isNow)} onClick={() => emit(nowInIsrael())}>
          עכשיו
        </button>
        <button type="button" className={chip(false)} onClick={() => emit(shiftMinutes(nowInIsrael(), -15))}>
          לפני 15 דק׳
        </button>
        <button type="button" className={chip(false)} onClick={() => emit(shiftMinutes(nowInIsrael(), -60))}>
          לפני שעה
        </button>
      </div>

      {/* 2. Fine-tune row */}
      <div className="flex items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-2xl px-2.5 py-2">
        {/* Date */}
        <div className="flex items-center gap-1.5">
          <button type="button" className={chip(date === today)} onClick={() => setDate(today)}>
            היום
          </button>
          <button type="button" className={chip(date === yesterday)} onClick={() => setDate(yesterday)}>
            אתמול
          </button>
          <button
            type="button"
            onClick={() => setShowDateInput((s) => !s)}
            className={`p-1.5 rounded-lg border ${
              isCustomDate
                ? 'bg-indigo-950/60 border-indigo-700 text-indigo-300'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
            aria-label="בחר תאריך"
          >
            <Calendar className="w-4 h-4" />
          </button>
        </div>

        {/* Time — dir=ltr so the chevrons and HH:mm read left-to-right */}
        <div className="flex items-center gap-1" dir="ltr">
          <button
            type="button"
            onClick={() => nudge(-5)}
            className="p-1 text-slate-400 hover:text-slate-200"
            aria-label="הפחת 5 דקות"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenCol(openCol === 'hour' ? null : 'hour')}
              className="w-10 py-1 rounded-lg font-mono font-black text-lg text-slate-100 hover:bg-slate-800 text-center"
            >
              {hour}
            </button>
            <AnimatePresence>
              {openCol === 'hour' && (
                <ScrollColumn options={HOURS} selected={hour} onPick={setHour} onClose={() => setOpenCol(null)} />
              )}
            </AnimatePresence>
          </div>

          <span className="font-mono font-black text-lg text-slate-500">:</span>

          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenCol(openCol === 'minute' ? null : 'minute')}
              className="w-10 py-1 rounded-lg font-mono font-black text-lg text-slate-100 hover:bg-slate-800 text-center"
            >
              {minute}
            </button>
            <AnimatePresence>
              {openCol === 'minute' && (
                <ScrollColumn options={MINUTES} selected={minute} onPick={setMinute} onClose={() => setOpenCol(null)} />
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={() => nudge(5)}
            className="p-1 text-slate-400 hover:text-slate-200"
            aria-label="הוסף 5 דקות"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Native date fallback for rare far-off dates (date has no AM/PM). */}
      {showDateInput && (
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setShowDateInput(false);
          }}
          className="bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
        />
      )}

      {/* 3. Live preview */}
      {preview && (
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
          <Check className="w-3.5 h-3.5" />
          <span>{preview}</span>
        </div>
      )}
    </div>
  );
}
