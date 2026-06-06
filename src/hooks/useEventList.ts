import { useState, useEffect, useCallback } from 'react';
import { eventService } from '../services/eventService';
import { EventSettings } from '../lib/types';

export function useEventList(userId: string | undefined, pageSize = 50) {
  const [events, setEvents] = useState<EventSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const loadMore = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { events: newEvents, total } = await eventService.listUserEvents(
        userId,
        pageSize,
        offset
      );
      setEvents((prev) => [...prev, ...newEvents]);
      setTotal(total);
      setHasMore(offset + pageSize < total);
      setOffset((prev) => prev + pageSize);
    } finally {
      setLoading(false);
    }
  }, [userId, offset, pageSize]);

  useEffect(() => {
    if (events.length === 0) {
      loadMore();
    }
  }, []);

  return { events, loading, hasMore, loadMore, total };
}
