import { useEffect, useRef, useSyncExternalStore } from 'react';

const query = '(prefers-reduced-motion: reduce)';
const subscribe = (callback: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => true);
}

// Only remembers the animation trigger; operational data stays in twinSlice.
export function useTwinUpdateMotion<T extends HTMLElement>(signature: string) {
  const element = useRef<T>(null);
  const previous = useRef(signature);
  const reduced = useReducedMotion();
  useEffect(() => {
    const changed = previous.current !== signature;
    previous.current = signature;
    if (!changed || reduced || !element.current?.animate) return;
    const animation = element.current.animate([
      { opacity: .65, transform: 'scale(.97)' },
      { opacity: 1, transform: 'scale(1)' },
    ], { duration: 240, easing: 'ease-out' });
    return () => animation.cancel();
  }, [signature, reduced]);
  return element;
}
