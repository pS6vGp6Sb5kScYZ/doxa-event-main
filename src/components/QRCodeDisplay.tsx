import { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import logoSrc from '../assets/logo.png';

interface Props {
  value: string;
  size?: number;
  className?: string;
}

export default function QRCodeDisplay({ value, size = 200, className = '' }: Props) {
  const [dataUrl, setDataUrl] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;

    const CACHE_MAX = 200;

    type CacheEntry = { url: string; ts: number; size: number };

    // Simple LRU cache stored at module level via (window as any).__doxa_qr_cache
    const globalCache: Map<string, CacheEntry> = (window as any).__doxa_qr_cache || new Map();
    if (!(window as any).__doxa_qr_cache) (window as any).__doxa_qr_cache = globalCache;

    const key = `${value}::${size}`;

    const generate = async () => {
      try {
        // Reuse cached blob URL when available
        const cached = globalCache.get(key);
        if (cached && cached.size === size) {
          cached.ts = Date.now();
          if (mounted) setDataUrl(cached.url);
          return;
        }

        const canvas = document.createElement('canvas');

        await QRCode.toCanvas(canvas, value, {
          width: size,
          margin: 2,
          errorCorrectionLevel: 'H',
          color: { dark: '#3a1c12', light: '#ffffff' },
        });

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Impossible de récupérer le contexte 2D du canvas');

        const image = new Image();
        const logoSize = size * 0.32;
        const x = (size - logoSize) / 2;
        const y = (size - logoSize) / 2;

        await new Promise<void>((resolve) => {
          image.onload = () => {
            try {
              ctx.drawImage(image, x, y, logoSize, logoSize);
            } catch (e) {
              // ignore draw errors
            }
            resolve();
          };
          image.onerror = () => resolve(); // ignore logo load failure
          image.src = logoSrc;
        });

        // Use blob URL (more memory-friendly than data URL for many images)
        await new Promise<void>((resolve) => {
          canvas.toBlob((blob) => {
            if (!blob) { resolve(); return; }
            const url = URL.createObjectURL(blob);
            // Store in cache
            globalCache.set(key, { url, ts: Date.now(), size });
            // enforce cache size
            if (globalCache.size > CACHE_MAX) {
              // remove oldest
              let oldestKey: string | null = null;
              let oldestTs = Infinity;
              for (const [k, v] of globalCache.entries()) {
                if (v.ts < oldestTs) { oldestTs = v.ts; oldestKey = k; }
              }
              if (oldestKey) {
                const removed = globalCache.get(oldestKey);
                if (removed) URL.revokeObjectURL(removed.url);
                globalCache.delete(oldestKey);
              }
            }

            if (mounted) setDataUrl(url);
            resolve();
          }, 'image/png');
        });
      } catch (err) {
        console.error('QR code generation error:', err);
        try {
          const fallbackUrl = await QRCode.toDataURL(value, {
            width: size,
            margin: 2,
            color: { dark: '#3a1c12', light: '#ffffff' },
          });
          if (mounted) setDataUrl(fallbackUrl);
        } catch (fallbackErr) {
          console.error('QR code fallback error:', fallbackErr);
        }
      }
    };

    // Generate only when visible to avoid CPU spike when rendering long lists
    const el = containerRef.current;
    let observer: IntersectionObserver | null = null;

    const schedule = (cb: () => void) => {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(cb, { timeout: 500 });
      } else {
        setTimeout(cb, 100);
      }
    };

    if (el) {
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // schedule generation on idle to keep UI responsive
            schedule(generate);
            if (observer) observer.disconnect();
          }
        }
      }, { threshold: 0.1 });
      observer.observe(el);
    } else {
      // fallback: generate immediately but on idle
      schedule(generate);
    }

    return () => {
      mounted = false;
      if (observer) observer.disconnect();
    };
  }, [value, size]);

  const download = () => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'invitation-qr.png';
    a.click();
  };

  if (!dataUrl) return <div ref={containerRef} className={`bg-stone-100 rounded-xl animate-pulse ${className}`} style={{ width: size, height: size }} />;

  return (
    <div ref={containerRef} className={`flex flex-col items-center gap-2 ${className}`}>
      <img src={dataUrl} alt="QR Code" className="rounded-xl" style={{ width: size, height: size }} />
      <button onClick={download} className="text-xs text-terracotta-600 hover:text-terracotta-700 font-medium">
        Télécharger
      </button>
    </div>
  );
}
