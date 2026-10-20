import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook to manage live countdown timer for device manual overrides (Task PHO-043).
 * Provides seconds remaining and formatted MM:SS string, ticking every second.
 */
export const useOverrideCountdown = (overrideUntil?: string | null) => {
  const calculateRemaining = useCallback((targetTime: string): number => {
    const target = new Date(targetTime).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((target - now) / 1000));
  }, []);

  const [prevOverrideUntil, setPrevOverrideUntil] = useState(overrideUntil);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() =>
    overrideUntil ? calculateRemaining(overrideUntil) : 0
  );

  if (prevOverrideUntil !== overrideUntil) {
    setPrevOverrideUntil(overrideUntil);
    setRemainingSeconds(overrideUntil ? calculateRemaining(overrideUntil) : 0);
  }

  useEffect(() => {
    if (!overrideUntil) return;

    const interval = setInterval(() => {
      const remaining = calculateRemaining(overrideUntil);
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [overrideUntil, calculateRemaining]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return {
    isOverrideActive: remainingSeconds > 0,
    remainingSeconds,
    formattedTime,
  };
};
