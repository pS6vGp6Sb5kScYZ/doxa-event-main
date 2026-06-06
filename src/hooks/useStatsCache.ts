import { useState, useEffect, useCallback } from 'react';
import { eventStatsService, EventStatsCache } from '../services/eventStatsService';

const STATS_CACHE_TTL = 2 * 60 * 1000;

function getStatsCacheKey(eventId: string) {
  return `doxa:event_stats_cache_v1:${eventId}`;
}

function loadStatsCache(eventId: string) {
  try {
    const raw = localStorage.getItem(getStatsCacheKey(eventId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { stats: EventStatsCache; ts: number };
    if (Date.now() - parsed.ts > STATS_CACHE_TTL) {
      localStorage.removeItem(getStatsCacheKey(eventId));
      return null;
    }
    return parsed.stats;
  } catch {
    return null;
  }
}

function saveStatsCache(eventId: string, stats: EventStatsCache) {
  try {
    localStorage.setItem(getStatsCacheKey(eventId), JSON.stringify({ stats, ts: Date.now() }));
  } catch {
    // ignore storage errors
  }
}

export function useStatsCache(eventId: string, pollIntervalMs = 3000) {
  const cachedStats = eventId ? loadStatsCache(eventId) : null;
  const [stats, setStats] = useState<EventStatsCache | null>(cachedStats);
  const [loading, setLoading] = useState(!Boolean(cachedStats));
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!eventId) {
      setStats(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let eventStats = await eventStatsService.getEventStats(eventId);

      if (!eventStats) {
        eventStats = await eventStatsService.calculateMissingStats(eventId);
      }

      setStats(eventStats);
      saveStatsCache(eventId, eventStats);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Impossible de charger les statistiques';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadStats();

    if (!eventId) {
      return;
    }

    // Use polling instead of realtime subscriptions for better scalability
    const pollInterval = setInterval(() => {
      loadStats();
    }, pollIntervalMs);

    return () => clearInterval(pollInterval);
  }, [eventId, loadStats, pollIntervalMs]);

  return { stats, loading, error, refetch: loadStats };
}
