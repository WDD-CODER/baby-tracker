/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';

interface SleepTimerProps {
  /** ISO timestamp the sleep started at. Omitted/undefined renders a zeroed clock. */
  startAt?: string;
}

/**
 * Isolated live sleep timer. Renders an elapsed `HH:MM:SS` label counting up from
 * `startAt`, ticking once per second. Owning its own interval + state here means the
 * tick re-renders ONLY this tiny node, not the whole App tree. Renders as bare text
 * (a fragment) so it drops into any inline context.
 */
export const SleepTimer = ({ startAt }: SleepTimerProps) => {
  const [label, setLabel] = useState('00:00:00');
  useEffect(() => {
    if (!startAt) {
      setLabel('00:00:00');
      return;
    }
    const update = () => {
      const diffMs = Date.now() - new Date(startAt).getTime();
      if (diffMs < 0) {
        setLabel('00:00:00');
        return;
      }
      const totalSecs = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      setLabel(
        `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startAt]);
  return <>{label}</>;
};
