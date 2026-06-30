import { supabase } from '../lib/supabase';
import { Guest, ScanEvent } from '../lib/types';

export interface ScanResult {
  success: boolean;
  guest_id?: string;
  guest_name?: string;
  table_name?: string;
  seats?: number;
  error?: string;
  error_code?: string;
  scanned_at?: string;
  last_scan_at?: string;
}

interface QueuedScan {
  qr_token: string;
  event_id: string;
  user_id: string;
  resolve: (result: ScanResult) => void;
  reject: (error: Error) => void;
}

class ScanQueue {
  private queue: QueuedScan[] = [];
  private processing = false;
  private readonly BATCH_SIZE = 5;
  private readonly BATCH_DELAY_MS = 100;

  async add(
    qr_token: string,
    event_id: string,
    user_id: string
  ): Promise<ScanResult> {
    return new Promise((resolve, reject) => {
      this.queue.push({ qr_token, event_id, user_id, resolve, reject });
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.BATCH_SIZE);
        await Promise.all(
          batch.map(async (item) => {
            try {
              const result = await guestScanService.recordScanAtomic(
                item.qr_token,
                item.event_id,
                item.user_id
              );
              item.resolve(result);
            } catch (error) {
              // If the RPC fails, clear any provisional cache we may have set
              try {
                guestScanService.clearProvisionalCache(item.qr_token, item.event_id);
              } catch (e) {
                // ignore
              }
              item.reject(error as Error);
            }
          })
        );
        if (this.queue.length > 0) {
          await new Promise((r) => setTimeout(r, this.BATCH_DELAY_MS));
        }
      }
    } finally {
      this.processing = false;
    }
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }
}

class GuestScanService {
  private scanCache = new Map<string, { result: ScanResult; ts: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private scanQueue = new ScanQueue();
  // Provisional cache to mark tokens that are queued for processing
  // maps cacheKey -> { guest_id?, guest_name?, ts }
  private provisional = new Map<string, { guest_id?: string; guest_name?: string; ts: number }>();

  async recordScanAtomic(
    qr_token: string,
    event_id: string,
    user_id: string
  ): Promise<ScanResult> {
    // Check cache first - key includes event_id for safety
    const cacheKey = `${event_id}:${qr_token}`;
    const cached = this.scanCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < this.CACHE_TTL) {
      return cached.result;
    }

    // Call atomic stored procedure
    const { data, error } = await supabase.rpc('record_scan_atomic', {
      p_qr_token: qr_token,
      p_event_id: event_id,
      p_user_id: user_id,
    });

    if (error) {
      console.error('Scan error:', error);
      return {
        success: false,
        error: error.message,
        error_code: 'DB_ERROR',
      };
    }

    const result = data as ScanResult;
    this.scanCache.set(cacheKey, { result, ts: Date.now() });
    return result;
  }

  async recordScanQueued(
    qr_token: string,
    event_id: string,
    user_id: string
  ): Promise<ScanResult> {
    const cacheKey = `${event_id}:${qr_token}`;
    // Try to resolve guest info locally so UI can update immediately
    try {
      const guest = await this.getGuestByToken(qr_token, event_id);
      this.provisional.set(cacheKey, { guest_id: guest?.id, guest_name: guest?.name, ts: Date.now() });
    } catch (e) {
      this.provisional.set(cacheKey, { ts: Date.now() });
    }

    try {
      // Emit an optimistic scan event so UI can update immediately
      try {
        const prov = this.provisional.get(cacheKey);
        const optimistic: ScanResult = {
          success: true,
          guest_id: prov?.guest_id,
          guest_name: prov?.guest_name,
          scanned_at: new Date().toISOString(),
        };
        try { window.dispatchEvent(new CustomEvent('scan:completed', { detail: { eventId: event_id, result: optimistic } })); } catch (e) {}
      } catch (e) {}

      const res = await this.scanQueue.add(qr_token, event_id, user_id);
      // On success the atomic recorder will populate scanCache; clear provisional flag
      this.provisional.delete(cacheKey);
      return res;
    } catch (err) {
      // Ensure provisional reservation is cleared on error
      this.provisional.delete(cacheKey);
      // Notify listeners that the optimistic update failed so they can revert
      try {
        const failure: ScanResult = { success: false, error: err instanceof Error ? err.message : String(err), error_code: 'DB_ERROR' };
        try { window.dispatchEvent(new CustomEvent('scan:completed', { detail: { eventId: event_id, result: failure } })); } catch (e) {}
      } catch (e) {}
      throw err;
    }
  }

  getScanQueueSize(): number {
    return this.scanQueue.getQueueSize();
  }
  
  
  /**
   * Check if a token was recently scanned (cached) for the event.
   * Returns true when the cached result indicates a successful check-in.
   */
  isCacheDuplicate(token: string, eventId: string): boolean {
    const cacheKey = `${eventId}:${token}`;
    // If a provisional reservation exists, consider it a duplicate
    if (this.provisional.has(cacheKey)) return true;
    const cached = this.scanCache.get(cacheKey);
    if (!cached) return false;
    return !!cached.result && !!cached.result.success;
  }

  /**
   * Return a cached duplicate ScanResult shaped as ALREADY_CHECKED when available.
   */
  getCachedDuplicateResult(token: string, eventId: string): ScanResult | null {
    const cacheKey = `${eventId}:${token}`;
    // If a provisional reservation exists, report as already checked to avoid rescans
    const prov = this.provisional.get(cacheKey);
    if (prov) {
      return {
        success: false,
        error: 'Already checked in (processing)',
        error_code: 'ALREADY_CHECKED',
        guest_id: prov.guest_id,
        guest_name: prov.guest_name,
        last_scan_at: new Date().toISOString(),
      } as ScanResult;
    }
    const cached = this.scanCache.get(cacheKey);
    if (!cached) return null;
    // If it was a successful scan previously, synthesize an ALREADY_CHECKED result
    if (cached.result && cached.result.success) {
      return {
        success: false,
        error: 'Already checked in',
        error_code: 'ALREADY_CHECKED',
        guest_id: cached.result.guest_id,
        guest_name: cached.result.guest_name,
        table_name: cached.result.table_name,
        seats: cached.result.seats,
        last_scan_at: cached.result.scanned_at,
      } as ScanResult;
    }
    return cached.result;
  }

  clearProvisionalCache(token: string, eventId: string): void {
    const cacheKey = `${eventId}:${token}`;
    this.provisional.delete(cacheKey);
  }

  async getGuestByToken(token: string, eventId: string): Promise<Guest | null> {
    const { data, error } = await supabase
      .from('guests')
      .select('id, name, table_name, seats, checked_in, status')
      .eq('qr_token', token)
      .eq('event_id', eventId)
      .maybeSingle();

    if (error) throw error;
    return (data as Guest) || null;
  }

  async listGuestsPaginated(
    eventId: string,
    limit = 50,
    offset = 0,
    filters?: { status?: string; searchTerm?: string }
  ): Promise<{ guests: Guest[]; total: number }> {
    if (!eventId) {
      return { guests: [], total: 0 };
    }

    let query = supabase
      .from('guests')
      .select('*', { count: 'exact' })
      .eq('event_id', eventId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.searchTerm) {
      const escapedSearch = filters.searchTerm
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
      query = query.or(`name.ilike.%${escapedSearch}%,email.ilike.%${escapedSearch}%`);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return {
      guests: (data as Guest[]) || [],
      total: count || 0,
    };
  }

  /**
   * Retrieve all guests for an event, paging under the hood to avoid overloading the DB/client.
   */
  async listAllGuests(
    eventId: string,
    filters?: { status?: string; searchTerm?: string }
  ): Promise<{ guests: Guest[]; total: number }> {
    if (!eventId) return { guests: [], total: 0 };

    const pageSize = 200;
    let offset = 0;
    let all: Guest[] = [];
    let total = 0;

    while (true) {
      const res = await this.listGuestsPaginated(eventId, pageSize, offset, filters);
      if (!res || !res.guests) break;
      if (total === 0) total = res.total;
      all = all.concat(res.guests);
      offset += res.guests.length;
      if (offset >= res.total || res.guests.length === 0) break;
    }

    return { guests: all, total };
  }

  async getRecentScans(eventId: string, limit = 20): Promise<ScanEvent[]> {
    const { data, error } = await supabase
      .from('scan_events')
      .select('*, guests(name, table_name)')
      .eq('event_id', eventId)
      .order('scanned_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data as ScanEvent[]) || [];
  }

  clearCache(): void {
    this.scanCache.clear();
  }

}

export const guestScanService = new GuestScanService();
