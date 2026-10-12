import { useState, useEffect } from 'react';

/**
 * Custom hook to manage live countdown timer for device manual overrides (Task PHO-043).
 * Provides seconds remaining and formatted MM:SS string, ticking every second.
 */
export const useOverrideCountdown = (overrideUntil?: string | null) => {
  const calculateRemaining = () => {
    if (!overrideUntil) return 0;
    const diff = Math.floor((new Date(overrideUntil).getTime() - Date.now()) / 1000);
    return Math.max(0, diff);
  };

  const [remainingSeconds, setRemainingSeconds] = useState<number>(calculateRemaining);

  useEffect(() => {
    setRemainingSeconds(calculateRemaining());
    if (!overrideUntil) return;

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [overrideUntil]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return {
    isOverrideActive: remainingSeconds > 0,
    remainingSeconds,
    formattedTime,
  };
};
