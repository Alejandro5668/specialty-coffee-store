import { useEffect, useState } from 'react';
import { useAppDispatch } from '../../../app/hooks';
import { DEFAULT_POLL, useServices } from '../../../app/services';
import { loadOrder } from '../../../store/orderSlice';

/**
 * Asks for the order until its payment is final. One request at a time, so a slow answer never
 * piles up behind itself. It gives up quietly after a while and lets the shopper ask again.
 */
export const useOrderPolling = (id: string) => {
  const dispatch = useAppDispatch();
  const { poll = DEFAULT_POLL } = useServices();
  const [round, setRound] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let checks = 0;
    setExhausted(false);

    const check = async () => {
      const result = await dispatch(loadOrder(id));
      if (stopped) return;
      checks += 1;
      const final = loadOrder.fulfilled.match(result) && result.payload.status !== 'PENDING';
      const missing = loadOrder.rejected.match(result) && result.payload?.status === 404;
      if (final || missing) return;
      if (checks >= poll.maxChecks) {
        setExhausted(true);
        return;
      }
      timer = setTimeout(() => void check(), poll.intervalMs);
    };
    void check();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [dispatch, id, round, poll.intervalMs, poll.maxChecks]);

  return { exhausted, checkAgain: () => setRound((r) => r + 1) };
};
