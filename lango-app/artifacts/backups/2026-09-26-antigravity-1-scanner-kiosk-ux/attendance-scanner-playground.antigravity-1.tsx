'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { casablancaTodayIso } from '@/libs/finance/today';
import {
  ScanLine, CheckCircle2, AlertCircle, XCircle, ShieldCheck, User,
  Volume2, VolumeX, Camera, CameraOff, RefreshCw, Keyboard, Clock,
  QrCode, Maximize, Minimize, Search, X, Check, ArrowRight,
  ShieldAlert, Sparkles, Send, Activity, DoorOpen
} from 'lucide-react';

type ClassSectionOption = {
  id: string;
  className: string;
  sectionName: string;
};

type UnifiedScanEvent = {
  id: string;
  scannedAt: string;
  resultStatus: 'accepted' | 'rejected' | 'already_scanned';
  rejectionReason?: string | null;
  stagedStatus?: 'present' | 'late' | null;
  studentName: string;
  matricule: string;
  className: string;
  guardianName?: string | null;
  guardianCin?: string | null;
  smsDispatched?: boolean;
};

type OnsiteHeadcount = {
  headcount: number;
  confirmedArrivals: number;
  manualUnverified: number;
  asOf: string;
};

// Web Audio API Synthesizer for instant audible confirmation
function playBeep(type: 'accepted' | 'late' | 'rejected') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'accepted') {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.22);
    } else if (type === 'late') {
      osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
      osc.frequency.setValueAtTime(370, ctx.currentTime + 0.1); // F#4
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.28);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
      osc.frequency.linearRampToValueAtTime(130, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {
    // Audio context blocked or unsupported
  }
}

export function AttendanceScannerPlayground({ locale = 'fr' }: { locale?: string } = {}) {
  const t = useTranslations('Attendance');
  const tCommon = useTranslations('Common');
  const tStatus = useTranslations('Status');

  // Academic Sections & Active Session
  const [sections, setSections] = useState<ClassSectionOption[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [sessionStarting, setSessionStarting] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Hardware & Capture Modes
  const [scanMode, setScanMode] = useState<'camera' | 'usb'>('camera');
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraActive, setCameraActive] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Manual Modal (for students who forgot their badge)
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // Inputs
  const [rawTokenInput, setRawTokenInput] = useState('');

  // Results & Feeds
  const [lastScan, setLastScan] = useState<UnifiedScanEvent | null>(null);
  const [events, setEvents] = useState<UnifiedScanEvent[]>([]);
  const [onsiteHeadcount, setOnsiteHeadcount] = useState<OnsiteHeadcount | null>(null);
  const [headcountError, setHeadcountError] = useState(false);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const usbInputRef = useRef<HTMLInputElement>(null);
  const lastScannedTokenRef = useRef<{ token: string; time: number } | null>(null);
  const scanningLoopRef = useRef<boolean>(false);
  const kioskContainerRef = useRef<HTMLDivElement>(null);

  const [classRosterCount, setClassRosterCount] = useState<number | null>(null);

  // Fetch Class Sections on load
  const [sectionsError, setSectionsError] = useState<string | null>(null);
  const loadSections = useCallback(() => {
    setSectionsError(null);
    fetch('/api/academics/class-sections')
      .then(res => res.json())
      .then(json => {
        if (json.success && Array.isArray(json.data)) {
          setSections(json.data);
        } else {
          setSectionsError(json?.error?.message || 'Impossible de charger les classes.');
        }
      })
      .catch(() => setSectionsError('Erreur réseau : impossible de charger les classes.'));
  }, []);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  // Fetch student roster size for selected class
  useEffect(() => {
    if (!selectedSectionId) {
      setClassRosterCount(null);
      return;
    }
    fetch(`/api/students?classSectionId=${selectedSectionId}`)
      .then(res => res.json())
      .then(json => {
        if (json.success && Array.isArray(json.data)) {
          setClassRosterCount(typeof json.total === 'number' ? json.total : json.data.length);
        }
      })
      .catch(() => {});
  }, [selectedSectionId]);

  // Fetch Initial Event History
  const fetchRecentEvents = useCallback(async () => {
    try {
      const endpoint = sessionIdRef.current
        ? `/api/attendance/qr/scanner-sessions/${sessionIdRef.current}/events`
        : `/api/attendance/qr/events?from=${new Date().toISOString().slice(0, 10)}`;
      const res = await fetch(endpoint);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const mapped: UnifiedScanEvent[] = json.data.slice(0, 20).map((item: any) => ({
          id: item.id || `ev-${Math.random()}`,
          scannedAt: item.scannedAt
            ? new Date(item.scannedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          resultStatus: item.resultStatus || 'accepted',
          rejectionReason: item.rejectionReason,
          stagedStatus: item.stagedStatus || (item.resultStatus === 'accepted' ? 'present' : null),
          studentName: item.studentName || item.student?.name || 'Élève',
          matricule: item.matricule || item.student?.matricule || '—',
          className: item.className || '—',
          guardianName: item.guardianName ?? null,
          guardianCin: item.guardianCin ?? null,
          smsDispatched: Boolean(item.smsDispatched),
        }));
        setEvents(mapped);
      }
    } catch {
      // best-effort polling
    }
  }, []);

  const fetchOnsiteHeadcount = useCallback(async () => {
    try {
      const response = await fetch('/api/attendance/onsite', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error('Headcount unavailable');
      setOnsiteHeadcount(body.data);
      setHeadcountError(false);
    } catch {
      setHeadcountError(true);
      setOnsiteHeadcount(null);
    }
  }, []);

  useEffect(() => {
    fetchRecentEvents();
    const interval = setInterval(fetchRecentEvents, 4000);
    return () => clearInterval(interval);
  }, [fetchRecentEvents]);

  useEffect(() => {
    fetchOnsiteHeadcount();
    const interval = setInterval(fetchOnsiteHeadcount, 30000);
    return () => clearInterval(interval);
  }, [fetchOnsiteHeadcount]);

  // Keep USB scanner input focused in USB mode
  useEffect(() => {
    if (scanMode !== 'usb') return;
    const focusTimer = setInterval(() => {
      if (document.activeElement !== usbInputRef.current) {
        usbInputRef.current?.focus();
      }
    }, 1000);
    usbInputRef.current?.focus();
    return () => clearInterval(focusTimer);
  }, [scanMode]);

  // Close Session helper
  const closeCurrentSession = useCallback(async (id: string | null) => {
    if (!id) return;
    try {
      await fetch(`/api/attendance/qr/scanner-sessions/${id}/close`, { method: 'POST' });
    } catch {
      // best effort
    }
  }, []);

  useEffect(() => {
    return () => {
      closeCurrentSession(sessionIdRef.current);
    };
  }, [closeCurrentSession]);

  // Start Scanner Session
  const handleStartSession = async (sectionId: string) => {
    if (!sectionId) return;
    try {
      setSessionStarting(true);
      setSessionError(null);
      const res = await fetch('/api/attendance/qr/scanner-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classSectionId: sectionId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setSessionError(json.error?.message || t('sessionStartError'));
        return;
      }
      setSessionId(json.data.id);
      sessionIdRef.current = json.data.id;
      fetchRecentEvents();
    } catch {
      setSessionError(t('sessionNetworkError'));
    } finally {
      setSessionStarting(false);
    }
  };

  const handleEndSession = async () => {
    const id = sessionIdRef.current;
    await closeCurrentSession(id);
    setSessionId(null);
    sessionIdRef.current = null;
    fetchRecentEvents();
  };

  // Main Token Processor
  const processToken = useCallback(async (token: string) => {
    const trimmed = token.trim();
    if (!trimmed || isProcessing) return;

    // Debounce rapid duplicate scans (within 2.5 seconds)
    const now = Date.now();
    if (lastScannedTokenRef.current && lastScannedTokenRef.current.token === trimmed && now - lastScannedTokenRef.current.time < 2500) {
      return;
    }
    lastScannedTokenRef.current = { token: trimmed, time: now };

    setIsProcessing(true);
    const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    try {
      const activeSession = sessionIdRef.current;
      const res = await fetch('/api/attendance/qr/verify-and-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawToken: trimmed,
          sessionId: activeSession || undefined,
          classSectionId: selectedSectionId || undefined,
        }),
      });

      const json = await res.json();

      if (json.success) {
        const stagedStatus = json.data?.stagedStatus || 'present';
        const scanEv: UnifiedScanEvent = {
          id: json.data?.scanEvent?.id || `scan-${Date.now()}`,
          scannedAt: timeStr,
          resultStatus: json.data?.resultStatus || 'accepted',
          stagedStatus,
          studentName: json.data?.student?.name || 'Élève reconnu',
          matricule: json.data?.student?.matricule || '—',
          className: sections.find(s => s.id === selectedSectionId)?.className || json.data?.className || '—',
          guardianName: json.data?.guardian?.name ?? null,
          guardianCin: json.data?.guardian?.cin ?? null,
          smsDispatched: Boolean(json.data?.smsDispatched),
        };

        setLastScan(scanEv);
        setEvents(prev => [scanEv, ...prev]);
        fetchOnsiteHeadcount();
        if (soundEnabled) playBeep(stagedStatus === 'late' ? 'late' : 'accepted');
      } else {
        const errorMsg = json.error?.message || json.message || t('badgeNotRecognizedClass');
        const rejectedEv: UnifiedScanEvent = {
          id: `rej-${Date.now()}`,
          scannedAt: timeStr,
          resultStatus: 'rejected',
          rejectionReason: errorMsg,
          studentName: 'Badge Non Reconnu',
          matricule: 'NON-VALIDE',
          className: 'Accès refusé',
          smsDispatched: false,
        };
        setLastScan(rejectedEv);
        setEvents(prev => [rejectedEv, ...prev]);
        if (soundEnabled) playBeep('rejected');
      }
    } catch {
      const netErrorEv: UnifiedScanEvent = {
        id: `err-${Date.now()}`,
        scannedAt: timeStr,
        resultStatus: 'rejected',
        rejectionReason: t('serverUnreachable'),
        studentName: 'Erreur Réseau',
        matricule: 'NET-ERR',
        className: 'Déconnecté',
      };
      setLastScan(netErrorEv);
      if (soundEnabled) playBeep('rejected');
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, sections, selectedSectionId, soundEnabled, t, fetchOnsiteHeadcount]);

  // Camera Management
  const stopCamera = useCallback(() => {
    scanningLoopRef.current = false;
    setCameraReady(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
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
      setCameraError(t('cameraUnsupported'));
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
      setCameraReady(true);

      // Native BarcodeDetector loop if supported by Chromium/Android/iOS 17+
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          const scanFrame = async () => {
            if (!scanningLoopRef.current || !videoRef.current) return;
            try {
              if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes.length > 0 && barcodes[0]?.rawValue) {
                  processToken(barcodes[0].rawValue);
                }
              }
            } catch {
              // Frame decoding skip
            }
            if (scanningLoopRef.current) {
              requestAnimationFrame(scanFrame);
            }
          };
          requestAnimationFrame(scanFrame);
        } catch {
          // BarcodeDetector fallback
        }
      }
    } catch {
      stopCamera();
      setCameraError(t('cameraPermissionError'));
    }
  }, [cameraFacing, processToken, stopCamera, t]);

  useEffect(() => {
    if (scanMode === 'camera' && cameraActive) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [scanMode, cameraActive, startCamera, stopCamera]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      kioskContainerRef.current?.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Handle Manual Matricule / Search Submission (Modal fallback)
  const handleManualSubmit = async () => {
    const term = manualSearchQuery.trim();
    if (!term || isProcessing) return;

    setIsProcessing(true);
    setManualError(null);
    const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    try {
      // 1. Search student in database
      const res = await fetch(`/api/students?search=${encodeURIComponent(term)}`);
      const json = await res.json();

      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        const student = json.data[0];

        // 2. Direct attendance write via canonical batch API
        const todayStr = casablancaTodayIso();
        const targetSectionId = student.classSectionId || selectedSectionId;

        if (!targetSectionId) {
          throw new Error('Section de classe introuvable pour cet élève.');
        }

        const attendanceResponse = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: todayStr,
            studentGroupId: targetSectionId,
            records: [{ studentId: student.id, status: 'present' }],
          }),
        });

        const attJson = await attendanceResponse.json();
        if (!attendanceResponse.ok || !attJson.success) {
          throw new Error(attJson.error?.message || 'Erreur lors de l\'enregistrement de la présence.');
        }

        const registeredEv: UnifiedScanEvent = {
          id: `man-${Date.now()}`,
          scannedAt: timeStr,
          resultStatus: 'accepted',
          stagedStatus: 'present',
          studentName: student.fullName || student.name,
          matricule: student.matricule || term,
          className: student.className || '—',
          guardianName: student.guardianName ?? null,
          guardianCin: null,
          smsDispatched: false,
        };

        setLastScan(registeredEv);
        setEvents(prev => [registeredEv, ...prev]);
        fetchOnsiteHeadcount();
        setManualSearchQuery('');
        setManualModalOpen(false);
        if (soundEnabled) playBeep('accepted');
      } else {
        // Try fallback directly as QR token
        await processToken(term);
        setManualSearchQuery('');
        setManualModalOpen(false);
      }
    } catch (err: any) {
      setManualError(err?.message || 'Élève non trouvé.');
      if (soundEnabled) playBeep('rejected');
    } finally {
      setIsProcessing(false);
    }
  };

  // Metrics computation from real events
  const acceptedCount = events.filter(e => e.resultStatus === 'accepted' && e.stagedStatus !== 'late').length;
  const lateCount = events.filter(e => e.stagedStatus === 'late').length;
  const rejectedCount = events.filter(e => e.resultStatus === 'rejected').length;
  const totalScans = events.length;

  return (
    <div
      ref={kioskContainerRef}
      className={`max-w-[1300px] mx-auto space-y-6 ${isFullscreen ? 'p-6 bg-slate-900 min-h-screen text-white' : ''}`}
    >
      {/* Top Header Bar: Clean, distraction-free & minimalist */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-2xl p-4 sm:px-6 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#2487B8]/10 text-[#2487B8] flex items-center justify-center shrink-0">
            <ScanLine className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Borne de Pointage
              </h1>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {scanMode === 'camera' ? (cameraReady ? 'Prêt pour le scan' : 'Connexion caméra...') : 'Douchette active'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Scannez le badge élève à l'entrée de l'établissement
            </p>
          </div>
        </div>

        {/* Right Action Tools: Scope selector + Clean Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Section/Portique Selector */}
          <div className="relative">
            <select
              id="sectionPortiqueSelect"
              name="sectionPortiqueSelect"
              aria-label="Sélectionner le portique ou la classe"
              value={selectedSectionId}
              onChange={e => {
                const newId = e.target.value;
                setSelectedSectionId(newId);
                if (sessionId) {
                  handleEndSession();
                }
                if (newId) {
                  handleStartSession(newId);
                }
              }}
              className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 outline-none focus:ring-1 focus:ring-[#2487B8]"
            >
              <option value="">Portique Général (Tous les élèves)</option>
              {sections.map(sec => (
                <option key={sec.id} value={sec.id}>
                  {sec.className} — {sec.sectionName}
                </option>
              ))}
            </select>
          </div>

          {/* Mode Switcher Pill */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 text-xs">
            <button
              type="button"
              onClick={() => setScanMode('camera')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 font-medium cursor-pointer ${
                scanMode === 'camera' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Caméra</span>
            </button>
            <button
              type="button"
              onClick={() => setScanMode('usb')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 font-medium cursor-pointer ${
                scanMode === 'usb' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>Douchette USB</span>
            </button>
          </div>

          {/* Audio Mute/Unmute */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
            }`}
            title={soundEnabled ? 'Son actif' : 'Son coupé'}
            aria-label="Toggle Sound"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Fullscreen Mode */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
            title={isFullscreen ? 'Quitter plein écran' : 'Plein écran Kiosque'}
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Grid: Viewfinder on Left, Student Confirmation on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: The Clean Scanner Viewport */}
        <div className="lg:col-span-6 space-y-4">
          <div className="relative rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 shadow-xl flex flex-col justify-between aspect-4/3 min-h-[360px]">
            {scanMode === 'camera' ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Minimalist Centered Target Reticle */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                  <div className="relative w-56 h-56 border border-white/20 rounded-2xl shadow-[0_0_0_9999px_rgba(15,23,42,0.65)] flex items-center justify-center">
                    {/* Corners */}
                    <div className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-2 border-l-2 border-[#2487B8] rounded-tl-lg" />
                    <div className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-2 border-r-2 border-[#2487B8] rounded-tr-lg" />
                    <div className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-2 border-l-2 border-[#2487B8] rounded-bl-lg" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-2 border-r-2 border-[#2487B8] rounded-br-lg" />

                    {/* Clean Laser Scan Indicator */}
                    <div className="absolute inset-x-3 h-0.5 bg-[#2487B8] shadow-[0_0_8px_#2487B8] opacity-75 animate-pulse" />
                    <QrCode className="w-14 h-14 text-white/10" />
                  </div>
                  <p className="mt-4 text-xs font-medium text-white/90 bg-slate-900/80 px-4 py-1.5 rounded-full backdrop-blur-md border border-white/10">
                    Présentez le badge QR face à la caméra
                  </p>
                </div>

                {/* Camera Flip Button */}
                <div className="absolute top-3 right-3 z-10">
                  <button
                    type="button"
                    onClick={() => setCameraFacing(prev => (prev === 'environment' ? 'user' : 'environment'))}
                    className="p-2 rounded-xl bg-slate-900/70 hover:bg-slate-900 text-white backdrop-blur-md border border-white/15 transition-all text-xs flex items-center gap-1.5 cursor-pointer"
                    title="Basculer caméra"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-medium hidden sm:inline">Inverser</span>
                  </button>
                </div>

                {cameraError && (
                  <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center text-white">
                    <CameraOff className="w-10 h-10 text-rose-400 mb-2" />
                    <p className="text-xs font-semibold text-rose-300 max-w-xs">{cameraError}</p>
                    <Button
                      size="sm"
                      onClick={startCamera}
                      className="mt-3 text-xs rounded-xl bg-white text-slate-900 font-bold hover:bg-slate-100"
                    >
                      Réessayer
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              /* USB Scanner Wedge State */
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-[#2487B8]/20 border border-[#2487B8]/30 flex items-center justify-center text-[#2487B8]">
                  <ScanLine className="w-8 h-8 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Lecteur USB Connecté</h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                    Scannez le badge à l'aide de votre douchette code-barres. La capture est instantanée.
                  </p>
                </div>
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    if (rawTokenInput.trim()) {
                      processToken(rawTokenInput.trim());
                      setRawTokenInput('');
                    }
                  }}
                  className="w-full max-w-xs"
                >
                  <Input
                    ref={usbInputRef}
                    id="usbScannerInput"
                    name="usbScannerInput"
                    type="password"
                    value={rawTokenInput}
                    onChange={e => setRawTokenInput(e.target.value)}
                    placeholder="En attente de scan USB..."
                    className="h-10 text-center font-mono text-xs rounded-xl border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:ring-1 focus:ring-[#2487B8]"
                  />
                </form>
              </div>
            )}
          </div>

          {/* Discreet Fallback Action for Forgotten Badges */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => {
                setManualModalOpen(true);
                setManualError(null);
                setManualSearchQuery('');
              }}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-[#2487B8] px-3.5 py-2 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            >
              <Keyboard className="w-4 h-4 text-slate-400" />
              <span>Saisie manuelle (élève sans badge)</span>
            </button>

            <span className="text-xs font-mono text-slate-400">
              {totalScans} scan{totalScans > 1 ? 's' : ''} aujourd'hui
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN: Instant Student Welcome Card & Recent Entries */}
        <div className="lg:col-span-6 space-y-4">
          {/* Main Flash Result Card */}
          <Card className="p-6 bg-white rounded-3xl border border-slate-200/90 shadow-sm min-h-[220px] flex flex-col justify-center">
            {lastScan ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Dernier scan validé
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    {lastScan.scannedAt}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center font-extrabold text-xl shadow-xs shrink-0 ${
                      lastScan.resultStatus === 'accepted'
                        ? lastScan.stagedStatus === 'late'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-[#2487B8]/15 text-[#2487B8]'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {lastScan.studentName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 leading-snug">
                      {lastScan.studentName}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-semibold text-[#2487B8]">{lastScan.className}</span>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs font-mono text-slate-400">{lastScan.matricule}</span>
                    </div>
                  </div>
                </div>

                {/* Status Indicator */}
                <div
                  className={`p-3.5 rounded-2xl flex items-center gap-3 ${
                    lastScan.resultStatus === 'accepted'
                      ? lastScan.stagedStatus === 'late'
                        ? 'bg-amber-50 border border-amber-200/70 text-amber-900'
                        : 'bg-emerald-50 border border-emerald-200/70 text-emerald-900'
                      : 'bg-rose-50 border border-rose-200/70 text-rose-900'
                  }`}
                >
                  {lastScan.resultStatus === 'accepted' ? (
                    lastScan.stagedStatus === 'late' ? (
                      <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    )
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-bold">
                      {lastScan.resultStatus === 'accepted'
                        ? lastScan.stagedStatus === 'late'
                          ? 'Arrivée Tardive Enregistrée'
                          : 'Présence Validée'
                        : (lastScan.rejectionReason || 'Badge Refusé ou Non Enregistré')}
                    </p>
                    <p className="text-xs opacity-75 mt-0.5">
                      {lastScan.resultStatus === 'accepted' ? 'Statut synchronisé en base de données' : 'Vérifiez la validité du badge'}
                    </p>
                  </div>
                </div>

                {/* Subtle Guardian / SMS info */}
                {lastScan.guardianName && (
                  <p className="text-xs text-slate-500 pt-1">
                    Tuteur légal : <span className="font-medium text-slate-700">{lastScan.guardianName}</span>
                    {lastScan.smsDispatched && (
                      <span className="ms-2 text-emerald-600 font-medium">· SMS envoyé</span>
                    )}
                  </p>
                )}
              </div>
            ) : (
              /* Idle Waiting State */
              <div className="text-center py-6 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <QrCode className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">En attente d'un badge</h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                    Approchez la carte d'un élève devant la caméra pour enregistrer automatiquement son arrivée.
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* Clean Recent Scans Feed */}
          <Card className="p-5 bg-white rounded-3xl border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Derniers passages
              </h4>
              <span className="text-[11px] font-mono text-slate-400">
                {events.length} enregistrés
              </span>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {events.slice(0, 5).map(item => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <p className="font-semibold text-slate-900">{item.studentName}</p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {item.className} · {item.scannedAt}
                    </p>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      item.resultStatus === 'accepted'
                        ? item.stagedStatus === 'late'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {item.resultStatus === 'accepted'
                      ? item.stagedStatus === 'late'
                        ? 'Retard'
                        : 'Présent'
                      : 'Rejeté'}
                  </span>
                </div>
              ))}

              {events.length === 0 && (
                <p className="text-center text-slate-400 text-xs py-6">
                  Aucun passage enregistré pour l'instant.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom Summary Strip: Counts + Safety Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-slate-200/80 rounded-2xl text-xs text-slate-600 shadow-2xs">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-medium text-slate-500">Bilan de la séance :</span>
          <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {acceptedCount} Présent{acceptedCount > 1 ? 's' : ''}
          </span>
          <span className="inline-flex items-center gap-1 font-bold text-amber-700">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            {lateCount} Retard{lateCount > 1 ? 's' : ''}
          </span>
          {rejectedCount > 0 && (
            <span className="inline-flex items-center gap-1 font-bold text-rose-700">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              {rejectedCount} Rejeté{rejectedCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Discreet Campus Headcount for Safety/Evacuation */}
        {onsiteHeadcount && !headcountError && (
          <div className="flex items-center gap-1.5 text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Effectif présent sur le campus : <strong className="font-bold text-slate-900">{onsiteHeadcount.headcount}</strong> élèves</span>
          </div>
        )}
      </div>

      {/* Clean Modal: Manual Student Entry (For forgotten badges) */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-[#2487B8]" />
                <h3 className="font-bold text-sm text-slate-900">
                  Saisie manuelle (Élève sans badge)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setManualModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Saisissez le nom complet ou le matricule de l'élève pour valider manuellement son entrée.
            </p>

            <form
              onSubmit={e => {
                e.preventDefault();
                handleManualSubmit();
              }}
              className="space-y-4"
            >
              <div>
                <Input
                  id="manualSearchInput"
                  name="manualSearchInput"
                  autoFocus
                  value={manualSearchQuery}
                  onChange={e => setManualSearchQuery(e.target.value)}
                  placeholder="Ex: Fatima El Ghazi ou ATL-2526-0025..."
                  className="h-10 text-xs rounded-xl border-slate-200 focus:ring-1 focus:ring-[#2487B8]"
                />
              </div>

              {manualError && (
                <p className="text-xs font-medium text-rose-600 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {manualError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setManualModalOpen(false)}
                  className="h-9 px-4 rounded-xl text-xs"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!manualSearchQuery.trim() || isProcessing}
                  className="h-9 px-4 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs"
                >
                  {isProcessing ? 'Validation...' : 'Valider la Présence'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
