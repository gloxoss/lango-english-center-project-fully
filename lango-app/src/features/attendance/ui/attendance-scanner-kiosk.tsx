'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ScanLine,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ShieldCheck,
  User,
  History,
  Play,
  Square,
  Camera,
  CameraOff,
  RefreshCw,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Keyboard,
  Sparkles,
} from 'lucide-react';

type ClassSectionOption = {
  id: string;
  className: string;
  sectionName: string;
};

type ScanEvent = {
  id: string;
  scannedAt: string;
  resultStatus: 'accepted' | 'rejected' | 'already_scanned';
  rejectionReason: string | null;
  stagedStatus: 'present' | 'late' | null;
  studentId: string | null;
  studentName: string | null;
};

type LiveFeedback = {
  name: string;
  status: 'accepted' | 'rejected' | 'already_scanned';
  message: string;
  scannedAt: Date;
} | null;

export function AttendanceScannerKiosk() {
  const [sections, setSections] = useState<ClassSectionOption[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Scan Mode: 'camera' vs 'usb'
  const [scanMode, setScanMode] = useState<'camera' | 'usb'>('camera');
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraActive, setCameraActive] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [rawTokenInput, setRawTokenInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [feedback, setFeedback] = useState<LiveFeedback>(null);
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScannedTokenRef = useRef<{ token: string; time: number } | null>(null);
  const scanningLoopRef = useRef<boolean>(false);

  const closeSession = useCallback(async (id: string | null) => {
    if (!id) return;
    try {
      await fetch(`/api/attendance/qr/scanner-sessions/${id}/close`, { method: 'POST' });
    } catch {
      // best effort
    }
  }, []);

  // Fetch class sections
  useEffect(() => {
    fetch('/api/academics/class-sections')
      .then(r => r.json())
      .then((json) => {
        if (json.success) {
          setSections(json.data || []);
        }
      })
      .catch(() => {});
  }, []);

  // Close session on unmount
  useEffect(() => {
    return () => {
      closeSession(sessionIdRef.current);
    };
  }, [closeSession]);

  // Keep focus on input for USB scanner
  useEffect(() => {
    if (scanMode !== 'usb') return;
    const handleGlobalClick = () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [scanMode]);

  // Poll scan events
  useEffect(() => {
    if (!sessionId) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/attendance/qr/scanner-sessions/${sessionId}/events`);
        const json = await res.json();
        if (json.success) {
          setEvents(json.data || []);
        }
      } catch {
        // retry on next tick
      }
    };
    poll();
    const timer = setInterval(poll, 3000);
    return () => clearInterval(timer);
  }, [sessionId]);

  const processToken = useCallback(async (token: string) => {
    const currentSessionId = sessionIdRef.current;
    if (!token.trim() || !currentSessionId) return;

    // Debounce identical scans within 3 seconds
    const now = Date.now();
    if (lastScannedTokenRef.current && lastScannedTokenRef.current.token === token && now - lastScannedTokenRef.current.time < 3000) {
      return;
    }
    lastScannedTokenRef.current = { token, time: now };

    setSubmitting(true);
    try {
      const res = await fetch('/api/attendance/qr/verify-and-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawToken: token.trim(),
          sessionId: currentSessionId,
        }),
      });

      const json = await res.json();

      if (json.success) {
        const resultStatus = json.data?.resultStatus || 'accepted';
        const stagedStatus = json.data?.stagedStatus;
        setFeedback({
          name: json.data?.student?.name || 'Élève reconnu',
          status: resultStatus,
          message: resultStatus === 'already_scanned'
            ? 'Déjà scanné — présence déjà enregistrée'
            : stagedStatus === 'late' ? 'Présence validée (retard)' : 'Présence validée',
          scannedAt: new Date(),
        });
      } else {
        setFeedback({
          name: 'Badge Non Valide',
          status: 'rejected',
          message: json.error?.message || json.message || 'Badge non reconnu pour cette classe',
          scannedAt: new Date(),
        });
      }
    } catch {
      setFeedback({
        name: 'Erreur réseau',
        status: 'rejected',
        message: 'Impossible de contacter le serveur',
        scannedAt: new Date(),
      });
    } finally {
      setSubmitting(false);
    }
  }, []);

  // Camera stream management (§8.3)
  const stopCamera = useCallback(() => {
    scanningLoopRef.current = false;
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Accès caméra non supporté par ce navigateur.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      scanningLoopRef.current = true;

      // Start BarcodeDetector loop if supported
      const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
      if (hasBarcodeDetector) {
        try {
          const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          const scanLoop = async () => {
            if (!scanningLoopRef.current || !videoRef.current) return;
            try {
              if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes.length > 0 && barcodes[0]?.rawValue) {
                  processToken(barcodes[0].rawValue);
                }
              }
            } catch {
              // frame decode error
            }
            if (scanningLoopRef.current) {
              requestAnimationFrame(scanLoop);
            }
          };
          requestAnimationFrame(scanLoop);
        } catch {
          // fallback
        }
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError('Impossible d\'activer la caméra. Vérifiez les autorisations du navigateur.');
    }
  }, [cameraFacing, stopCamera, processToken]);

  useEffect(() => {
    if (sessionId && scanMode === 'camera' && cameraActive) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [sessionId, scanMode, cameraActive, startCamera, stopCamera]);

  const startSession = async () => {
    if (!selectedSectionId) return;
    try {
      setStarting(true);
      setError(null);
      const res = await fetch('/api/attendance/qr/scanner-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classSectionId: selectedSectionId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || 'Impossible de démarrer la session.');
        return;
      }
      setSessionId(json.data.id);
      sessionIdRef.current = json.data.id;
      setEvents([]);
    } catch {
      setError('Erreur réseau lors du démarrage de la session.');
    } finally {
      setStarting(false);
    }
  };

  const endSession = async () => {
    const id = sessionIdRef.current;
    await closeSession(id);
    stopCamera();
    setSessionId(null);
    sessionIdRef.current = null;
    setFeedback(null);
  };

  const handleManualScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawTokenInput.trim()) return;
    const token = rawTokenInput.trim();
    setRawTokenInput('');
    await processToken(token);
  };

  const acceptedCount = events.filter(ev => ev.resultStatus === 'accepted').length;
  const rejectedCount = events.filter(ev => ev.resultStatus === 'rejected').length;
  const alreadyScannedCount = events.filter(ev => ev.resultStatus === 'already_scanned').length;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0066FF] to-[#0052CC] flex items-center justify-center text-white shadow-2xs shrink-0">
            <ScanLine className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
              Kiosque Scanner Élèves (Caméra &amp; QR Code)
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Émargement temps réel par caméra vidéo HD ou douchette USB avec validation cryptographique instantanée.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {sessionId ? (
            <Badge variant="success" className="font-bold gap-1 px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Session Active</span>
            </Badge>
          ) : (
            <Badge variant="neutral" className="font-bold gap-1 px-3 py-1.5 text-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Prêt pour session</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Session setup / status bar */}
      <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        {sessionId ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              <p className="font-extrabold text-[#16212B] text-sm">
                Session en cours — Classe : {sections.find(s => s.id === selectedSectionId)?.className} {sections.find(s => s.id === selectedSectionId)?.sectionName}
              </p>
              <p className="text-[11px] font-mono mt-0.5 text-slate-400">ID Session : {sessionId.slice(0, 8)}... (Authentification HMAC)</p>
            </div>

            <div className="flex items-center gap-3">
              {/* Scan Mode Toggle */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setScanMode('camera')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                    scanMode === 'camera' ? 'bg-white text-[#0066FF] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  Caméra
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode('usb')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                    scanMode === 'usb' ? 'bg-white text-[#0066FF] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  Douchette USB
                </button>
              </div>

              <Button
                onClick={endSession}
                className="gap-2 h-9 text-xs rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                <Square className="w-3.5 h-3.5" />
                Terminer la session
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Sélectionner la classe / section à émarger</label>
              <select
                value={selectedSectionId}
                onChange={e => setSelectedSectionId(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0066FF] focus:border-[#0066FF] outline-none"
              >
                <option value="">-- Choisir une classe --</option>
                {sections.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.className} — {s.sectionName}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={startSession}
              disabled={!selectedSectionId || starting}
              className="gap-2 h-10 text-xs rounded-xl px-5 bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold"
            >
              <Play className="w-3.5 h-3.5" />
              {starting ? 'Démarrage...' : 'Ouvrir le kiosque de scan'}
            </Button>
          </div>
        )}

        {error && (
          <p className="mt-3 text-xs font-bold text-rose-600 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" />
            {error}
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* SCANNER VIEWPORT */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            {sessionId ? (
              scanMode === 'camera' ? (
                /* CAMERA VIEWPORT */
                <div className="space-y-4">
                  <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center border-2 border-slate-800">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />

                    {/* Camera Targeting Overlay Frame */}
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                      <div className="relative w-64 h-64 border-2 border-[#0066FF]/60 rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex items-center justify-center">
                        {/* Corner markers */}
                        <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-[#0066FF] rounded-tl-xl" />
                        <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-[#0066FF] rounded-tr-xl" />
                        <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-[#0066FF] rounded-bl-xl" />
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-[#0066FF] rounded-br-xl" />

                        {/* Animated Laser Scan Line */}
                        <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-[#0066FF] to-transparent shadow-[0_0_12px_#0066FF] animate-bounce" />
                      </div>
                      <p className="mt-4 text-xs font-bold text-white/90 bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs">
                        Cadrez le QR Code de l&apos;élève au centre
                      </p>
                    </div>

                    {cameraError && (
                      <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center text-white">
                        <CameraOff className="w-10 h-10 text-rose-500 mb-2" />
                        <p className="text-xs font-bold text-rose-300">{cameraError}</p>
                        <Button
                          size="sm"
                          onClick={startCamera}
                          className="mt-3 text-xs rounded-xl bg-white text-slate-900 font-bold"
                        >
                          Réessayer
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-slate-500">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      <span className="font-bold text-slate-700">Flux vidéo en direct</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCameraFacing(prev => prev === 'environment' ? 'user' : 'environment');
                        }}
                        className="h-8 text-xs rounded-xl border-slate-200 bg-white gap-1.5 font-bold"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Basculer caméra ({cameraFacing === 'environment' ? 'Arrière' : 'Avant'})
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                /* USB SCANNER VIEWPORT */
                <div className="text-center py-10 space-y-6">
                  <div className="w-24 h-24 bg-blue-50 border-4 border-dashed border-blue-200 rounded-3xl mx-auto flex items-center justify-center animate-pulse text-[#0066FF]">
                    <ScanLine className="w-10 h-10" />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-[#16212B]">Mode Douchette USB Actif</h2>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                      Scannez directement avec votre lecteur physique. La saisie est automatiquement capturée.
                    </p>
                  </div>

                  <form onSubmit={handleManualScanSubmit} className="max-w-sm mx-auto w-full">
                    <Input
                      ref={inputRef}
                      type="password"
                      required
                      value={rawTokenInput}
                      onChange={(e) => setRawTokenInput(e.target.value)}
                      placeholder="Prêt pour le scan..."
                      className="text-center text-sm font-mono h-11 rounded-xl border-slate-200 bg-slate-50 focus:ring-2 focus:ring-[#0066FF] focus:border-[#0066FF]"
                      autoFocus
                    />
                  </form>
                </div>
              )
            ) : (
              <div className="text-center py-16 space-y-3">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl mx-auto flex items-center justify-center text-slate-400">
                  <ScanLine className="w-8 h-8" />
                </div>
                <h3 className="text-base font-extrabold text-[#16212B]">Session requise</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Sélectionnez une classe dans la barre supérieure et démarrez la session pour activer la caméra de scan.
                </p>
              </div>
            )}

            {/* Live Instant Feedback Banner */}
            {feedback && (
              <div className="mt-4 animate-in zoom-in-95 duration-150">
                {feedback.status === 'accepted' ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-emerald-900 font-extrabold text-sm">{feedback.name}</p>
                      <p className="text-emerald-700 font-bold text-xs">{feedback.message}</p>
                    </div>
                  </div>
                ) : feedback.status === 'already_scanned' ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3">
                    <AlertCircle className="w-8 h-8 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-amber-900 font-extrabold text-sm">{feedback.name}</p>
                      <p className="text-amber-700 font-bold text-xs">{feedback.message}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3">
                    <XCircle className="w-8 h-8 text-rose-600 shrink-0" />
                    <div>
                      <p className="text-rose-900 font-extrabold text-sm">{feedback.name}</p>
                      <p className="text-rose-700 font-bold text-xs">{feedback.message}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* STATS & LIVE SCANS FEED */}
        <div className="lg:col-span-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Présents</p>
              <p className="text-2xl font-extrabold text-emerald-600 mt-0.5">{acceptedCount}</p>
            </Card>
            <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Déjà Scannés</p>
              <p className="text-2xl font-extrabold text-amber-600 mt-0.5">{alreadyScannedCount}</p>
            </Card>
            <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Rejets</p>
              <p className="text-2xl font-extrabold text-rose-600 mt-0.5">{rejectedCount}</p>
            </Card>
          </div>

          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-extrabold text-[#16212B] flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-[#0066FF]" />
                Journal des Scans de la Session
              </h3>
              <Badge variant="neutral" className="text-[10px]">{events.length} scan(s)</Badge>
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs hover:bg-slate-100/60 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] ${
                      ev.resultStatus === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                      ev.resultStatus === 'already_scanned' ? 'bg-amber-100 text-amber-700' :
                      'bg-rose-100 text-rose-700'
                    }`}>
                      {ev.resultStatus === 'accepted' ? <CheckCircle2 className="w-4 h-4" /> :
                       ev.resultStatus === 'already_scanned' ? <AlertCircle className="w-4 h-4" /> :
                       <XCircle className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="font-bold text-[#16212B]">{ev.studentName || 'Élève inconnu'}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {ev.resultStatus === 'accepted' ? (ev.stagedStatus === 'late' ? 'Présence (Retard)' : 'Présence Validée') :
                         ev.resultStatus === 'already_scanned' ? 'Déjà scanné' :
                         (ev.rejectionReason || 'Badge rejeté')}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono text-slate-400">
                    {new Date(ev.scannedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))}

              {events.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-10">
                  En attente des premiers scans de badges...
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
