import { supabase } from '../lib/supabase';

export interface EventStatsCache {
  id: string;
  event_id: string;
  total_guests: number;
  confirmed_count: number;
  absent_count: number;
  checked_in_count: number;
  scan_count: number;
  last_scan_at: string | null;
  cached_at: string;
  updated_at: string;
}

class EventStatsService {
  async getEventStats(eventId: string): Promise<EventStatsCache | null> {
    if (!eventId) return null;

    const { data, error } = await supabase
      .from('event_stats_cache')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle();

    if (error) throw error;
    const cache = (data as EventStatsCache) || null;

    // Ensure cache is consistent with guests table. If counts differ, recalculate.
    try {
      const { count: guestCount } = await supabase
        .from('guests')
        .select('*', { count: 'exact' })
        .eq('event_id', eventId);

      if (cache && typeof cache.total_guests === 'number' && typeof guestCount === 'number' && cache.total_guests !== guestCount) {
        // Recompute authoritative stats
        return await this.calculateMissingStats(eventId);
      }
    } catch (e) {
      // Ignore guest-count errors and return cache
    }

    return cache;
  }

  subscribeToStats(eventId: string, callback: (stats: EventStatsCache) => void) {
    const subscription = supabase
      .channel(`event_stats:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_stats_cache',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          callback(payload.new as EventStatsCache);
        }
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }

  async calculateMissingStats(eventId: string): Promise<EventStatsCache> {
    if (!eventId) {
      return {
        id: crypto.randomUUID(),
        event_id: eventId,
        total_guests: 0,
        confirmed_count: 0,
        absent_count: 0,
        checked_in_count: 0,
        scan_count: 0,
        last_scan_at: null,
        cached_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    // Fallback: calculate stats if cache is missing
    const { data: guests } = await supabase
      .from('guests')
      .select('id, status, checked_in')
      .eq('event_id', eventId);

    const { count: scanCount } = await supabase
      .from('scan_events')
      .select('*', { count: 'exact' })
      .eq('event_id', eventId);

    const { data: lastScan } = await supabase
      .from('scan_events')
      .select('scanned_at')
      .eq('event_id', eventId)
      .order('scanned_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const guestList = guests || [];
    return {
      id: crypto.randomUUID(),
      event_id: eventId,
      total_guests: guestList.length,
      confirmed_count: guestList.filter((g) => g.status === 'confirmed').length,
      absent_count: guestList.filter((g) => g.status === 'declined').length,
      checked_in_count: guestList.filter((g) => g.checked_in).length,
      scan_count: scanCount || 0,
      last_scan_at: lastScan?.scanned_at || null,
      cached_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}

export const eventStatsService = new EventStatsService();
