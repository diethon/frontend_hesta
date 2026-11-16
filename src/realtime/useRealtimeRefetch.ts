import { useEffect, useRef } from 'react';
import { realtimeEventDispatcher } from './realtimeEvents';
import type { RealtimeEventType } from './realtimeTypes';

/**
 * Calls `refetch` when any of `types` arrives for `homeId`. Bursts (an automation run writes several rows)
 * collapse into one request fired `delayMs` after the last event.
 */
export function useRealtimeRefetch(
  types: readonly RealtimeEventType[],
  homeId: string | null | undefined,
  refetch: () => void,
  delayMs = 400,
) {
  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  const typesKey = types.join(',');
  useEffect(() => {
    if (!homeId) return undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onEvent = (event: { homeId: string }) => {
      if (event.homeId !== homeId) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        refetchRef.current();
      }, delayMs);
    };
    const unregister = typesKey.split(',').map((type) =>
      realtimeEventDispatcher.register(type as RealtimeEventType, onEvent));
    return () => {
      if (timer) clearTimeout(timer);
      unregister.forEach((off) => off());
    };
  }, [typesKey, homeId, delayMs]);
}
