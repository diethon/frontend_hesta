import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook to manage live countdown timer for device manual overrides (Task PHO-043).
 * Provides seconds remaining and formatted MM:SS string, ticking every second.
 */
export const useOverrideCountdown = (overrideUntil?: string | null) => {
  const calculateRemaining = useCallback((targetTime?: string | null): number => {
    if (!targetTime) return 0;
    const target = new Date(targetTime).getTime();
    if (isNaN(target)) return 0;
    const now = Date.now();
    return Math.max(0, Math.floor((target - now) / 1000));
  }, []);

  const [remainingSeconds, setRemainingSeconds] = useState<number>(() =>
    calculateRemaining(overrideUntil)
  );

  useEffect(() => {
    const updateRemaining = () => {
      const rem = calculateRemaining(overrideUntil);
      setRemainingSeconds(rem);
      return rem;
    };

    const initial = updateRemaining();
    if (initial <= 0) return;

    const interval = setInterval(() => {
      const remaining = updateRemaining();
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const remaining = updateRemaining();
        if (remaining <= 0) {
          clearInterval(interval);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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
