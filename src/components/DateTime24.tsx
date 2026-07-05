/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// A guaranteed 24-hour date/time picker. Native <input type="datetime-local">
// renders AM/PM based on device locale and cannot be forced to 24h via HTML,
// so we compose a native date input (dates have no AM/PM) with explicit
// hour/minute dropdowns. Value in/out is the same "YYYY-MM-DDTHH:mm" string the
// native datetime-local input used, making this a drop-in replacement.

interface DateTime24Props {
  value: string; // "YYYY-MM-DDTHH:mm"
  onChange: (value: string) => void;
  className?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const FIELD_CLASS =
  'bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-2 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none';

export function DateTime24({ value, onChange, className }: DateTime24Props) {
  // Split "YYYY-MM-DDTHH:mm" defensively, tolerating empty/partial input.
  const [datePart = '', timePart = ''] = (value || '').split('T');
  const [hourRaw = '', minuteRaw = ''] = timePart.split(':');
  const hourPart = hourRaw.length ? hourRaw.padStart(2, '0') : '00';
  const minutePart = minuteRaw.length ? minuteRaw.padStart(2, '0') : '00';

  const emit = (nextDate: string, nextHour: string, nextMinute: string) => {
    // Only emit a full, valid datetime-local string once a date exists.
    if (!nextDate) return;
    onChange(`${nextDate}T${nextHour.padStart(2, '0')}:${nextMinute.padStart(2, '0')}`);
  };

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`} dir="ltr">
      <input
        type="date"
        value={datePart}
        onChange={(e) => emit(e.target.value, hourPart, minutePart)}
        className={`${FIELD_CLASS} flex-1`}
      />
      <select
        value={hourPart}
        onChange={(e) => emit(datePart, e.target.value, minutePart)}
        className={FIELD_CLASS}
        aria-label="שעה"
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="text-slate-500 font-black">:</span>
      <select
        value={minutePart}
        onChange={(e) => emit(datePart, hourPart, e.target.value)}
        className={FIELD_CLASS}
        aria-label="דקה"
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
    </div>
  );
}
