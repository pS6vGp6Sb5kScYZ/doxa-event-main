import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, ScanLine, RotateCcw, Camera, CameraOff, Zap } from 'lucide-react';
import { useEvent } from '../../contexts/EventContext';
import { useAuth } from '../../contexts/AuthContext';
import { useScanRealtime } from '../../hooks/useScanRealtime';
import { ScanResult } from '../../services/guestScanService';

export default function QRScannerPage() {
  const { event } = useEvent();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [scanCount, setScanCount] = useState(0);
  const [scanTime, setScanTime] = useState<number | null>(null);

  const { handleScan: recordScan, result, clearResult, isDuplicate } = useScanRealtime(event?.id || '');

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);
        scanFrame();
      }
    } catch (e) {
      setCameraError("Accès caméra refusé. Activez la caméra dans les paramètres du navigateur.");
    }
  };

  const stopCamera = () => {
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanning(false);
  };

  const scanFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // Use BarcodeDetector API if available
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        detector.detect(canvas).then((barcodes: any[]) => {
          if (barcodes.length > 0) {
            handleScan(barcodes[0].rawValue);
          } else {
            animFrameRef.current = requestAnimationFrame(scanFrame);
          }
        });
      } else {
        animFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch {
      animFrameRef.current = requestAnimationFrame(scanFrame);
    }
  };

  useEffect(() => () => stopCamera(), []);

  const extractToken = (raw: string): string => {
    const trimmed = raw.trim();
    const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

    // If the input contains a full URL, extract the first valid URL from the text.
    const urlMatch = trimmed.match(/https?:\/\/[\S]+/);
    const candidate = urlMatch ? urlMatch[0] : trimmed;

    try {
      const url = new URL(candidate);
      const verifyToken = url.searchParams.get('verify');
      if (verifyToken && uuidRegex.test(verifyToken)) return verifyToken;

      const pathSegments = url.pathname.split('/').filter(Boolean);
      for (let i = pathSegments.length - 1; i >= 0; i -= 1) {
        if (uuidRegex.test(pathSegments[i])) {
          return pathSegments[i];
        }
      }
    } catch {
      // ignore parse errors and fall through to regex search
    }

    const match = trimmed.match(uuidRegex);
    return match ? match[0] : trimmed;
  };

  const handleScan = async (raw: string) => {
    if (processing || !event || !user) return;

    const startTime = performance.now();
    setProcessing(true);
    stopCamera();

    const token = extractToken(raw);

    // Use atomic stored procedure via hook
    await recordScan(token);

    const endTime = performance.now();
    setScanTime(endTime - startTime);
    setScanCount(c => c + 1);
    setProcessing(false);
  };

  const handleManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualToken.trim()) {
      await handleScan(manualToken.trim());
      setManualToken('');
    }
  };


  return (
    <div className="space-y-6 animate-fade-in max-w-lg mx-auto">
      <div>
        <p className="text-sm text-stone-400 uppercase tracking-wide font-medium">Contrôle d'accès</p>
        <h1 className="font-serif text-3xl text-stone-800 mt-0.5">Scanner QR</h1>
        <p className="text-stone-500 text-sm mt-1">{scanCount} scans effectués cette session</p>
      </div>

      {/* Scan Result */}
      {result && (
        <div className={`rounded-2xl p-6 text-center animate-pulse-scale ${
          result.success ? 'bg-emerald-500' :
          result.error_code === 'ALREADY_CHECKED' ? 'bg-amber-500' : 'bg-red-500'
        }`}>
          {result.success && <CheckCircle className="w-16 h-16 text-white mx-auto mb-3" strokeWidth={1.5} />}
          {result.error_code === 'ALREADY_CHECKED' && <AlertCircle className="w-16 h-16 text-white mx-auto mb-3" strokeWidth={1.5} />}
          {!result.success && <XCircle className="w-16 h-16 text-white mx-auto mb-3" strokeWidth={1.5} />}

          <p className="text-white font-semibold text-xl">{
            result.success ? 'ACCÈS AUTORISÉ' :
            result.error_code === 'ALREADY_CHECKED' ? 'DÉJÀ SCANNÉ' : 'ACCÈS REFUSÉ'
          }</p>
          
          {result.error_code === 'ALREADY_CHECKED' && result.last_scan_at ? (
            <p className="text-white/90 text-sm mt-1">
              {result.guest_name ? `${result.guest_name} — ` : ''}
              Scanné à {new Date(result.last_scan_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          ) : (
            <p className="text-white/90 text-sm mt-1">{result.guest_name ? `Bienvenue, ${result.guest_name} !` : result.error}</p>
          )}

          {result.guest_name && result.success && (
            <div className="mt-4 bg-white/20 rounded-xl p-3 text-white/90 text-sm">
              <p className="font-medium">{result.guest_name}</p>
              {result.table_name && <p>Table : {result.table_name}</p>}
              <p>{result.seats} place{result.seats !== 1 ? 's' : ''}</p>
            </div>
          )}

          {scanTime !== null && (
            <div className="mt-3 flex items-center justify-center gap-1 text-white/80 text-xs">
              <Zap className="w-3 h-3" /> Scan en {scanTime.toFixed(0)}ms
            </div>
          )}

          <button onClick={() => { clearResult(); startCamera(); }} className="mt-5 bg-white/20 hover:bg-white/30 text-white font-medium px-5 py-2.5 rounded-xl flex items-center gap-2 mx-auto transition-all">
            <RotateCcw className="w-4 h-4" /> Scanner suivant
          </button>
        </div>
      )}

      {/* Camera */}
      {!result && (
        <div className="card p-5 space-y-4">
          <div className="relative bg-stone-900 rounded-xl overflow-hidden aspect-video flex items-center justify-center">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Camera className="w-12 h-12 text-stone-400" strokeWidth={1} />
                <p className="text-stone-400 text-sm">{cameraError || 'Caméra inactive'}</p>
              </div>
            )}
            {scanning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-white/70 rounded-2xl relative">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-terracotta-400 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-terracotta-400 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-terracotta-400 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-terracotta-400 rounded-br-lg" />
                  <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-terracotta-400/70 animate-pulse" />
                </div>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />

          {cameraError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
              <CameraOff className="w-4 h-4 flex-shrink-0" />
              {cameraError}
            </div>
          )}

          <div className="flex gap-2">
            {scanning ? (
              <button onClick={stopCamera} className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm">
                <CameraOff className="w-4 h-4" /> Arrêter
              </button>
            ) : (
              <button onClick={startCamera} className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm">
                <Camera className="w-4 h-4" /> Démarrer la caméra
              </button>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-stone-400">ou saisir manuellement</span>
            </div>
          </div>

          <form onSubmit={handleManual} className="flex gap-2">
            <input
              className="input-field flex-1"
              placeholder="Token ou URL d'invitation..."
              value={manualToken}
              onChange={e => setManualToken(e.target.value)}
            />
            <button type="submit" className="btn-primary px-4" disabled={processing || !manualToken.trim()}>
              <ScanLine className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      <div className="card p-4 bg-stone-50">
        <p className="text-xs text-stone-500 font-medium mb-1">Note technique</p>
        <p className="text-xs text-stone-400 leading-relaxed">
          Le scanner utilise l'API BarcodeDetector du navigateur. Pour une meilleure compatibilité sur mobile, utilisez Chrome ou Safari récents. La saisie manuelle fonctionne sur tous les appareils.
        </p>
      </div>
    </div>
  );
}
