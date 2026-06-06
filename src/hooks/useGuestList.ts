import { useState, useEffect, useCallback, useRef } from 'react';
import { guestScanService } from '../services/guestScanService';
import { Guest } from '../lib/types';

export interface UseGuestListOptions {
  eventId: string;
  pageSize?: number;
  filters?: {
    status?: string;
    searchTerm?: string;
  };
}

const GUEST_LIST_CACHE_TTL = 5 * 60 * 1000;

function getGuestListCacheKey(
  eventId: string,
  pageSize: number,
  page: number,
  filters?: { status?: string; searchTerm?: string }
) {
  const status = filters?.status || 'all';
  const search = filters?.searchTerm?.trim().toLowerCase() || '';
  return `doxa:guest_list_cache_v1:${eventId}:${pageSize}:${page}:${status}:${encodeURIComponent(search)}`;
}

function loadGuestCache(key: string) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { guests: Guest[]; total: number; page: number; ts: number };
    if (Date.now() - parsed.ts > GUEST_LIST_CACHE_TTL) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveGuestCache(key: string, guests: Guest[], total: number, page: number) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ guests, total, page, ts: Date.now() }));
  } catch {
    // ignore session storage errors
  }
}

export function useGuestList({
  eventId,
  pageSize = 50,
  filters,
}: UseGuestListOptions) {
  const [page, setPage] = useState(0);
  const cacheKey = eventId ? getGuestListCacheKey(eventId, pageSize, page, filters) : '';
  const cached = cacheKey ? loadGuestCache(cacheKey) : null;

  const [guests, setGuests] = useState<Guest[]>(cached?.guests || []);
  const [loading, setLoading] = useState(!Boolean(cached));
  const [hasMore, setHasMore] = useState(Boolean(cached && (cached.page + 1) * pageSize < cached.total));
  const [total, setTotal] = useState(cached?.total || 0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setPage(0);
  }, [eventId, filters?.status, filters?.searchTerm]);

  const reload = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!eventId) {
      if (requestId !== requestIdRef.current) return;
      setGuests([]);
      setTotal(0);
      setHasMore(false);
      setLoading(false);
      return;
    }

    if (!cached) {
      setLoading(true);
    }

    const offset = page * pageSize;
    try {
      const { guests: newGuests, total } = await guestScanService.listGuestsPaginated(
        eventId,
        pageSize,
        offset,
        filters
      );

      if (requestId !== requestIdRef.current) return;

      setGuests(newGuests);
      setTotal(total);
      setHasMore(offset + newGuests.length < total);
      saveGuestCache(cacheKey, newGuests, total, page);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [cacheKey, cached, eventId, filters?.status, filters?.searchTerm, page, pageSize]);

  const loadMore = useCallback(async () => {
    if (!eventId) return;
    setPage(prev => prev + 1);
  }, [eventId]);

  useEffect(() => {
    reload();
  }, [eventId, filters?.status, filters?.searchTerm, page, reload]);

  // Refresh guest list when relevant events occur (scan completed or guest changed or RSVP updated)
  useEffect(() => {
    const onScan = (e: any) => {
      try {
        const detail = e?.detail;
        if (!detail) return;
        if (detail.eventId && detail.eventId === eventId) {
          const result = detail.result;
          // If we have a guest_id from the scan, update that guest entry locally
          if (result && result.guest_id) {
            const gid = result.guest_id as string;
            const scannedAt = result.scanned_at || result.last_scan_at || new Date().toISOString();
            let found = false;
            setGuests(prev => prev.map(g => {
              if (g.id === gid) {
                found = true;
                return { ...g, checked_in: true, checked_in_at: scannedAt } as Guest;
              }
              return g;
            }));
            // If the guest wasn't on the current page, reload to surface the change
            if (!found) reload();
            return;
          }

          // Fallback: reload entire list
          reload();
        }
      } catch (err) {
        // ignore
      }
    };

    const onGuestChanged = (e: any) => {
      try {
        const detail = e?.detail;
        if (!detail) return;
        if (detail.eventId && detail.eventId === eventId) reload();
      } catch (err) {
        // ignore
      }
    };

    const onGuestRsvp = (e: any) => {
      try {
        const detail = e?.detail;
        if (!detail) return;
        if (detail.eventId && detail.eventId === eventId && detail.guestId) {
          const newStatus = detail.status; // 'confirmed' or 'absent'
          let found = false;
          setGuests(prev => prev.map(g => {
            if (g.id === detail.guestId) {
              found = true;
              return { ...g, status: newStatus as 'pending' | 'confirmed' | 'declined' } as Guest;
            }
            return g;
          }));
          // If the guest wasn't on the current page, reload to surface the change
          if (!found) reload();
        }
      } catch (err) {
        // ignore
      }
    };

    window.addEventListener('scan:completed', onScan as EventListener);
    window.addEventListener('guest:changed', onGuestChanged as EventListener);
    window.addEventListener('guest:rsvp', onGuestRsvp as EventListener);
    return () => {
      window.removeEventListener('scan:completed', onScan as EventListener);
      window.removeEventListener('guest:changed', onGuestChanged as EventListener);
      window.removeEventListener('guest:rsvp', onGuestRsvp as EventListener);
    };
  }, [eventId, reload]);

  const pageCount = pageSize > 0 ? Math.ceil(total / pageSize) : 0;

  return {
    guests,
    loading,
    hasMore,
    loadMore,
    refresh: reload,
    total,
    page,
    pageCount,
    setPage,
    itemCount: total,
    itemSize: 52,
  };
}
