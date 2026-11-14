import { useEffect, useRef, useState } from 'react';

/**
 * Counts down once the result is final and then calls `onDone`. The shopper can cancel it: nobody
 * should be moved off a page they are still reading. A total of 0 turns it off.
 */
export const useAutoReturn = (active: boolean, totalMs: number, onDone: () => void) => {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (!active || cancelled || totalMs <= 0) {
      setRemaining(null);
      return;
    }
    let left = Math.ceil(totalMs / 1000);
    setRemaining(left);
    const timer = setInterval(() => {
      left -= 1;
      setRemaining(left);
      if (left <= 0) {
        clearInterval(timer);
        done.current();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [active, cancelled, totalMs]);

  return { remaining, cancel: () => setCancelled(true) };
};
