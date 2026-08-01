'use client';

import { Keyboard, QrCode, Zap, ZapOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

type QrScannerModalProps = {
  open: boolean;
  onClose: () => void;
  qrInput: string;
  onQrInputChange: (value: string) => void;
  onScan: (value: string) => void;
  qrMessage: string | null;
};

// ponytail: native BarcodeDetector (Chrome/Edge/Android) - no external QR
// library. Safari/Firefox lack it, so those fall back to manual entry only,
// same as before this feature existed.
function isBarcodeDetectorSupported() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

export function QrScannerModal({ open, onClose, qrInput, onQrInputChange, onScan, qrMessage }: QrScannerModalProps) {
  const [manualMode, setManualMode] = useState(!isBarcodeDetectorSupported());
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);

  function stopCamera() {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    if (!open || manualMode || !isBarcodeDetectorSupported()) {
      return;
    }

    let cancelled = false;
    setCameraError(null);

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const track = stream.getVideoTracks()[0];
        const capabilities = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
        setTorchSupported(!!capabilities?.torch);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- BarcodeDetector isn't in the standard TS DOM lib yet
        const DetectorClass = (window as any).BarcodeDetector;
        const detector = new DetectorClass({ formats: ['qr_code'] });

        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            return;
          }
          try {
            const codes = await detector.detect(videoRef.current);
            const value: string | undefined = codes[0]?.rawValue;
            if (!value) {
              return;
            }
            const now = Date.now();
            // Debounce the same badge being re-detected every 300ms while held in frame
            if (lastScanRef.current?.value === value && now - lastScanRef.current.at < 3000) {
              return;
            }
            lastScanRef.current = { value, at: now };
            onScan(value);
          } catch {
            // transient decode failure - ignore, next tick retries
          }
        }, 300);
      } catch (err) {
        console.error('Camera access failed', err);
        setCameraError('Impossible d\'accéder à la caméra. Vérifiez les autorisations ou utilisez la saisie manuelle.');
        setManualMode(true);
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, manualMode]);

  useEffect(() => {
    if (!open) {
      stopCamera();
      setTorchOn(false);
    }
  }, [open]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) {
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- torch constraint isn't in the standard TS DOM lib
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as any] });
      setTorchOn(!torchOn);
    } catch {
      // torch not actually controllable despite capability flag - ignore
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 text-white rounded-3xl p-5 max-w-md w-full shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold flex items-center gap-2">
            <QrCode className="w-5 h-5 text-cyan-400" />
            <span>Scanner le badge</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm font-bold">✕</button>
        </div>

        {!manualMode && isBarcodeDetectorSupported() && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTorch}
              disabled={!torchSupported}
              className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-slate-800 text-xs font-semibold disabled:opacity-40"
            >
              {torchOn ? <ZapOff className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
              Flash
              {torchSupported ? (torchOn ? ' actif' : ' désactivé') : ' indisponible'}
            </button>
            <button
              type="button"
              onClick={() => setManualMode(true)}
              className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-slate-800 text-xs font-semibold"
            >
              <Keyboard className="w-3.5 h-3.5" />
              Saisie manuelle
            </button>
          </div>
        )}

        {!manualMode && isBarcodeDetectorSupported()
          ? (
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                <div className="absolute inset-6 border-2 border-cyan-400/70 rounded-2xl pointer-events-none" />
                <div className="absolute inset-x-6 top-1/2 h-0.5 bg-cyan-400/80 animate-pulse pointer-events-none" />
              </div>
            )
          : (
              <div className="space-y-3">
                {cameraError && <p className="text-xs text-rose-300">{cameraError}</p>}
                {!isBarcodeDetectorSupported() && !cameraError && (
                  <p className="text-xs text-slate-400">Le scan caméra n'est pas pris en charge par ce navigateur - utilisez la saisie manuelle.</p>
                )}
                <p className="text-xs text-slate-300">Saisissez l'identifiant ou le nom de l'élève.</p>
                <input
                  type="text"
                  placeholder="ID élève ou Nom..."
                  value={qrInput}
                  onChange={e => onQrInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && qrInput.trim()) {
                      onScan(qrInput.trim());
                    }
                  }}
                  className="w-full h-11 px-4 text-sm bg-slate-800 border border-slate-700 rounded-xl font-medium text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                />
                <Button
                  variant="primary"
                  className="w-full h-10 rounded-xl"
                  onClick={() => {
                    if (qrInput.trim()) {
                      onScan(qrInput.trim());
                    }
                  }}
                >
                  Valider Présence
                </Button>
                {isBarcodeDetectorSupported() && (
                  <button type="button" onClick={() => { setManualMode(false); setCameraError(null); }} className="w-full text-center text-[11px] text-cyan-400 font-semibold">
                    Revenir au scanner caméra
                  </button>
                )}
              </div>
            )}

        {qrMessage && (
          <div className="p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-white">
            {qrMessage}
          </div>
        )}
      </div>
    </div>
  );
}
