import { useState, useEffect, useCallback } from 'react';
import { guestScanService, ScanResult } from '../services/guestScanService';
import { useAuth } from '../contexts/AuthContext';

export function useScanRealtime(eventId: string) {
  const { user } = useAuth();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queueSize, setQueueSize] = useState(0);

  const handleScan = useCallback(
    async (qr_token: string) => {
      if (!user) {
        setError('User not authenticated');
        return;
      }

      setLoading(true);
      setError(null);

      // Check local cache for duplicate to provide immediate feedback
      const cachedDup = guestScanService.getCachedDuplicateResult(qr_token, eventId);
      if (cachedDup && cachedDup.error_code === 'ALREADY_CHECKED') {
        setResult(cachedDup);
        setLoading(false);
        setError(cachedDup.error || null);
        try {
          window.dispatchEvent(new CustomEvent('scan:completed', { detail: { eventId, result: cachedDup } }));
        } catch (e) {}
        return;
      }

      try {
        // Use queued scan for high concurrency support (batching 5 scans per batch)
        const scanResult = await guestScanService.recordScanQueued(
          qr_token,
          eventId,
          user.id
        );
        setResult(scanResult);
        try {
          window.dispatchEvent(new CustomEvent('scan:completed', { detail: { eventId, result: scanResult } }));
        } catch (e) {}
        setQueueSize(guestScanService.getScanQueueSize());

        if (!scanResult.success) {
          setError(scanResult.error || 'Scan failed');
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [eventId, user]
  );

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  const isDuplicate = useCallback((token: string): boolean => {
    return guestScanService.isCacheDuplicate(token, eventId);
  }, []);

  return {
    handleScan,
    result,
    loading,
    error,
    clearResult,
    isDuplicate,
    queueSize,
  };
}
