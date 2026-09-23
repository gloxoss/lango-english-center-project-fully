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
  History, Play, Square, Volume2, VolumeX, Smartphone, Monitor,
  Camera, CameraOff, RefreshCw, Keyboard, Clock, AlertTriangle,
  QrCode, Check, Bell, Flame, ShieldAlert, Sparkles, Send,
  ArrowRight, ExternalLink, Activity, Radio
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
  // Truthfulness (audit pass 2): guardian data and SMS dispatch are shown
  // only when the API actually returns them. The scan APIs do not dispatch
  // SMS and return no guardian fields, so these stay null/false — the UI
  // shows "—" and "Notification non envoyée" instead of invented claims.
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

  // Inputs
  const [rawTokenInput, setRawTokenInput] = useState('');
  const [keypadInput, setKeypadInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Results & Feeds
  const [lastScan, setLastScan] = useState<UnifiedScanEvent | null>(null);
  const [events, setEvents] = useState<UnifiedScanEvent[]>([]);
  const [emergencyLockdown, setEmergencyLockdown] = useState(false);
  const [onsiteHeadcount, setOnsiteHeadcount] = useState<OnsiteHeadcount | null>(null);
  const [headcountError, setHeadcountError] = useState(false);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const usbInputRef = useRef<HTMLInputElement>(null);
  const lastScannedTokenRef = useRef<{ token: string; time: number } | null>(null);
  const scanningLoopRef = useRef<boolean>(false);

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
          setSelectedSectionId(prev => prev || json.data[0]?.id || '');
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
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [rosterRetry, setRosterRetry] = useState(0);
  useEffect(() => {
    if (!selectedSectionId) {
      setClassRosterCount(null);
      return;
    }
    setRosterError(null);
    fetch(`/api/students?classSectionId=${selectedSectionId}`)
      .then(res => res.json())
      .then(json => {
        if (json.success && Array.isArray(json.data)) {
          // The authoritative roster size is the API's `total` (all students in
          // the section), NOT the fetched page length — the call is paginated
          // and data.length would cap the meter at one page
          // (audit 2026-09-22, P1-4).
          setClassRosterCount(typeof json.total === 'number' ? json.total : json.data.length);
        } else {
          setRosterError(json?.error?.message || 'Impossible de charger l\'effectif de la classe.');
        }
      })
      .catch(() => setRosterError('Erreur réseau : impossible de charger l\'effectif.'));
  }, [selectedSectionId, rosterRetry]);

  // Fetch Initial Event History
  const fetchRecentEvents = useCallback(async () => {
    try {
      const endpoint = sessionIdRef.current
        ? `/api/attendance/qr/scanner-sessions/${sessionIdRef.current}/events`
        : `/api/attendance/qr/events?from=${new Date().toISOString().slice(0, 10)}`;
      const res = await fetch(endpoint);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const mapped: UnifiedScanEvent[] = json.data.slice(0, 30).map((item: any) => ({
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
  const handleStartSession = async () => {
    if (!selectedSectionId) return;
    try {
      setSessionStarting(true);
      setSessionError(null);
      const res = await fetch('/api/attendance/qr/scanner-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classSectionId: selectedSectionId }),
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
          className: sections.find(s => s.id === selectedSectionId)?.className || '—',
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
          studentName: 'Badge Invalide / Inconnu',
          matricule: 'NON-RECONNU',
          className: 'Accès restreint',
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

  // Handle Manual Matricule / Keypad Submission (Fallback when student forgot badge)
  const handleManualMatriculeSubmit = async (codeToSearch?: string) => {
    const term = (codeToSearch || keypadInput || rawTokenInput).trim();
    if (!term || isProcessing) return;

    setIsProcessing(true);
    const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    try {
      // 1. Search student in database
      const res = await fetch(`/api/students?search=${encodeURIComponent(term)}`);
      const json = await res.json();

      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        const student = json.data[0];

        // 2. Register direct attendance in database
        const todayStr = casablancaTodayIso();
        const attendanceResponse = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: todayStr,
            records: [{ studentId: student.id, status: 'present' }],
          }),
        });
        if (!attendanceResponse.ok || !(await attendanceResponse.json()).success) {
          throw new Error('Attendance registration failed');
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
        setKeypadInput('');
        setRawTokenInput('');
        if (soundEnabled) playBeep('accepted');
      } else {
        // Try fallback directly as QR token
        await processToken(term);
        setKeypadInput('');
        setRawTokenInput('');
      }
    } catch {
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
    <div className="space-y-6 max-w-[1400px] mx-auto pb-16">
      {/* Quick Ecosystem Switcher */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <Link
          href={`/${locale}/dashboard/attendance`}
          className="px-3.5 py-1.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-colors shrink-0 flex items-center gap-1.5 shadow-2xs"
        >
          <Activity className="w-3.5 h-3.5 text-[#2487B8]" />
          Feuille d'Appel
        </Link>
        <Link
          href={`/${locale}/dashboard/attendance/badges`}
          className="px-3.5 py-1.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-colors shrink-0 flex items-center gap-1.5 shadow-2xs"
        >
          <QrCode className="w-3.5 h-3.5 text-[#0EA5C4]" />
          Badges QR
        </Link>
        <Link
          href={`/${locale}/dashboard/attendance/qr-reports`}
          className="px-3.5 py-1.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-colors shrink-0 flex items-center gap-1.5 shadow-2xs"
        >
          <History className="w-3.5 h-3.5 text-slate-500" />
          Audit & Rapports
        </Link>
        <Link
          href={`/${locale}/dashboard/workforce/timeclock`}
          className="px-3.5 py-1.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-colors shrink-0 flex items-center gap-1.5 shadow-2xs"
        >
          <Clock className="w-3.5 h-3.5 text-amber-500" />
          Pointeuse Staff
        </Link>
      </div>

      {/* Top Station Header & Hardware Control Strip */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0EA5C4] to-[#2487B8] flex items-center justify-center text-white shadow-md shrink-0">
              <ScanLine className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#0EA5C4]/15 text-[#0EA5C4] border border-[#0EA5C4]/30">
                  <ShieldCheck className="w-3.5 h-3.5" /> Station de Scan Unifiée
                </span>
                <span className="text-xs font-semibold text-slate-400">Caméra WebRTC + Douchette USB + Saisie Tactile</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#16212B] tracking-tight mt-1">
                {t('scannerKioskTitle')}
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Borne unique de pointage des badges QR, vérification d'identité et appel en temps réel.
              </p>
            </div>
          </div>

          {/* Quick Hardware Controls & Audio Toggle */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Capture Mode Pill */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/80 text-xs font-bold">
              <button
                type="button"
                onClick={() => setScanMode('camera')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  scanMode === 'camera' ? 'bg-white text-[#2487B8] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Caméra Vidéo</span>
              </button>
              <button
                type="button"
                onClick={() => setScanMode('usb')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  scanMode === 'usb' ? 'bg-white text-[#2487B8] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>Douchette USB</span>
              </button>
            </div>

            {/* Sound Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${
                soundEnabled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
              }`}
              title={soundEnabled ? 'Bip sonore actif' : 'Bip sonore en sourdine'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Academic Session Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="sm:w-72">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Classe / Portique actif
              </label>
              <select
                value={selectedSectionId}
                disabled={!!sessionId}
                onChange={e => setSelectedSectionId(e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#2487B8]"
              >
                <option value="">Sélectionnez une classe...</option>
                {sections.map(sec => (
                  <option key={sec.id} value={sec.id}>
                    {sec.className} — {sec.sectionName}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2 sm:pt-4">
              {sessionId ? (
                <Button
                  size="sm"
                  onClick={handleEndSession}
                  className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs gap-1.5 shadow-xs"
                >
                  <Square className="w-3.5 h-3.5" /> Clôturer la Session
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleStartSession}
                  disabled={!selectedSectionId || sessionStarting}
                  className="h-9 px-4 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs gap-1.5 shadow-xs"
                >
                  <Play className="w-3.5 h-3.5" /> {sessionStarting ? 'Ouverture...' : 'Ouvrir la Session'}
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge className={`text-xs px-3 py-1 font-bold border-none ${
              sessionId ? 'bg-emerald-500/15 text-emerald-700' : 'bg-slate-100 text-slate-600'
            }`}>
              {sessionId ? '● Session Enregistrée en Base' : '○ Mode Libre / Portique'}
            </Badge>
          </div>
        </div>

        {(sectionsError || rosterError) && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {sectionsError ?? rosterError}
            </span>
            <button
              type="button"
              onClick={() => (sectionsError ? loadSections() : setRosterRetry(n => n + 1))}
              className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 font-bold text-amber-900 hover:bg-amber-50 transition-colors cursor-pointer"
            >
              Réessayer
            </button>
          </div>
        )}

        {/* Dynamic Class Roll-Call Meter (When a class is selected) */}
        {classRosterCount !== null && classRosterCount > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-600">Avancement de l'appel pour cette classe</span>
              <span className="text-[#2487B8]">
                {acceptedCount} / {classRosterCount} élèves scannés ({Math.min(100, Math.round((acceptedCount / classRosterCount) * 100))}%)
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
              <div
                className="h-full bg-gradient-to-r from-[#2487B8] to-[#0EA5C4] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round((acceptedCount / classRosterCount) * 100))}%` }}
              />
            </div>
          </div>
        )}

        {sessionError && (
          <p className="text-xs font-bold text-rose-600 mt-3 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" /> {sessionError}
          </p>
        )}
      </div>

      {/* Main Unified Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: LIVE SCANNER VIEWPORT & INSTANT RESULT CARD */}
        <div className="lg:col-span-7 space-y-6">
          {/* Active Scanner Viewport Card */}
          <Card className="p-6 bg-slate-950 text-white rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[460px]">
            {/* Viewport Header */}
            <div className="flex items-center justify-between z-10 mb-4">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${scanMode === 'camera' && !cameraReady ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`} />
                <span className={`font-mono text-xs font-bold uppercase tracking-wider ${scanMode === 'camera' && !cameraReady ? 'text-rose-300' : 'text-emerald-400'}`}>
                  {scanMode === 'camera' ? (cameraReady ? 'Viseur WebRTC actif' : 'Caméra indisponible') : 'Récepteur Douchette USB Prêt'}
                </span>
              </div>

              {scanMode === 'camera' && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCameraFacing(prev => (prev === 'environment' ? 'user' : 'environment'))}
                    className="h-8 text-xs rounded-xl bg-white/10 hover:bg-white/20 border-white/20 text-white gap-1.5 font-bold"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {cameraFacing === 'environment' ? 'Caméra Arrière' : 'Caméra Avant'}
                  </Button>
                </div>
              )}
            </div>

            {/* Viewport Center Surface */}
            {scanMode === 'camera' ? (
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black/80 flex items-center justify-center border border-white/10">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Animated Targeting Overlay */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                  <div className="relative w-64 h-64 border-2 border-[#0EA5C4]/60 rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] flex items-center justify-center">
                    {/* Corners */}
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-[#0EA5C4] rounded-tl-xl" />
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-[#0EA5C4] rounded-tr-xl" />
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-[#0EA5C4] rounded-bl-xl" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-[#0EA5C4] rounded-br-xl" />

                    {/* Animated Scanning Line */}
                    <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-[#0EA5C4] to-transparent shadow-[0_0_14px_#0EA5C4] animate-bounce" />
                    <QrCode className="w-20 h-20 text-white/15" />
                  </div>
                  <p className="mt-4 text-xs font-bold text-white/90 bg-black/70 px-3.5 py-1 rounded-full backdrop-blur-md border border-white/10">
                    Présentez le badge QR devant l'objectif
                  </p>
                </div>

                {cameraError && (
                  <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center text-white">
                    <CameraOff className="w-10 h-10 text-rose-500 mb-2" />
                    <p className="text-xs font-bold text-rose-300 max-w-sm">{cameraError}</p>
                    <Button
                      size="sm"
                      onClick={startCamera}
                      className="mt-3 text-xs rounded-xl bg-white text-slate-900 font-bold hover:bg-slate-100"
                    >
                      Réessayer la caméra
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              /* USB / Hardware Scanner Wedge Interface */
              <div className="py-14 text-center space-y-4">
                <div className="w-24 h-24 bg-gradient-to-br from-[#2487B8]/20 to-[#0EA5C4]/20 border-2 border-dashed border-[#0EA5C4]/40 rounded-3xl mx-auto flex items-center justify-center animate-pulse text-[#0EA5C4]">
                  <ScanLine className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Prêt pour Douchette USB</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                    Scannez le badge directement avec votre lecteur optique ou terminal USB. La capture est automatique.
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
                  className="max-w-md mx-auto pt-2"
                >
                  <Input
                    ref={usbInputRef}
                    type="password"
                    value={rawTokenInput}
                    onChange={e => setRawTokenInput(e.target.value)}
                    placeholder="En attente du signal code-barres USB..."
                    className="h-11 text-center font-mono text-xs rounded-xl border-white/20 bg-white/10 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-[#0EA5C4]"
                  />
                </form>
              </div>
            )}

            {/* Viewport Live Ticker Footer */}
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>Scans Aujourd'hui : <strong className="text-white">{totalScans}</strong></span>
              <span>À l'heure : <strong className="text-emerald-400">{acceptedCount}</strong></span>
              <span>Retards : <strong className="text-amber-400">{lateCount}</strong></span>
            </div>
          </Card>

          {/* Instant Student Feedback Splash Card */}
          <Card className="p-6 bg-white rounded-3xl border border-slate-200/90 shadow-md space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                Dernier Scan Validé en Temps Réel
              </h3>
              {lastScan && (
                <span className="text-[11px] font-mono text-slate-400">
                  Horodatage : {lastScan.scannedAt}
                </span>
              )}
            </div>

            {lastScan ? (
              <div className="space-y-4 animate-in fade-in-50 duration-200">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm ${
                    lastScan.resultStatus === 'accepted'
                      ? lastScan.stagedStatus === 'late'
                        ? 'bg-amber-500 text-white'
                        : 'bg-[#2487B8] text-white'
                      : 'bg-rose-500 text-white'
                  }`}>
                    {lastScan.studentName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-[#16212B]">{lastScan.studentName}</h4>
                    <p className="text-xs font-mono text-slate-500">{lastScan.matricule}</p>
                    <p className="text-xs font-bold text-[#2487B8] mt-0.5">{lastScan.className}</p>
                  </div>
                </div>

                {/* Status Indicator Banner */}
                <div className={`p-4 rounded-2xl flex items-center gap-3.5 ${
                  lastScan.resultStatus === 'accepted'
                    ? lastScan.stagedStatus === 'late'
                      ? 'bg-amber-50 border border-amber-200 text-amber-900'
                      : 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border border-rose-200 text-rose-900'
                }`}>
                  {lastScan.resultStatus === 'accepted' ? (
                    lastScan.stagedStatus === 'late' ? (
                      <Clock className="w-7 h-7 text-amber-600 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
                    )
                  ) : (
                    <XCircle className="w-7 h-7 text-rose-600 shrink-0" />
                  )}

                  <div>
                    <p className="font-extrabold text-sm">
                      {lastScan.resultStatus === 'accepted'
                        ? lastScan.stagedStatus === 'late'
                          ? 'Arrivée Tardive Enregistrée'
                          : 'Présence Validée avec Succès'
                        : (lastScan.rejectionReason || 'Badge Refusé ou Non Enregistré')}
                    </p>
                    <p className="text-xs opacity-80 mt-0.5 font-medium">
                      Enregistré à {lastScan.scannedAt} · Base de données synchronisée
                    </p>
                  </div>
                </div>

                {/* Guardian / Security Confirmation Info — only what the API confirmed */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-700">
                  <div>
                    <span className="text-slate-400 font-medium">Tuteur légal : </span>
                    <strong className="text-slate-800 font-bold">{lastScan.guardianName || '—'}</strong>
                    {lastScan.guardianCin && (
                      <span className="text-slate-500 font-mono text-[11px] ml-1.5">({lastScan.guardianCin})</span>
                    )}
                  </div>

                  {lastScan.smsDispatched ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-[11px] bg-emerald-100/70 px-2.5 py-1 rounded-lg">
                      <Send className="w-3 h-3 text-emerald-600" /> SMS d'alerte délivré au parent
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-slate-500 font-semibold text-[11px] bg-slate-100 px-2.5 py-1 rounded-lg">
                      <Send className="w-3 h-3 text-slate-400" /> Notification non envoyée
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs font-medium">
                En attente du premier passage de badge...
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT COLUMN: WORKSTATION COMPANION (KEYPAD, METRICS, REAL-TIME AUDIT) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live Metrics Counters */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Présents</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">{acceptedCount}</p>
            </Card>
            <Card className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Retards</p>
              <p className="text-2xl font-black text-amber-500 mt-1">{lateCount}</p>
            </Card>
            <Card className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rejetés</p>
              <p className="text-2xl font-black text-rose-600 mt-1">{rejectedCount}</p>
            </Card>
          </div>

          {/* Quick Manual Entry & Numeric Keypad (When student forgot badge) */}
          <Card className="p-5 bg-white rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-[#2487B8]" />
                <h3 className="font-extrabold text-xs text-[#16212B] uppercase tracking-wider">
                  Saisie Rapide Matricule (Sans Badge)
                </h3>
              </div>
              <Badge variant="neutral" className="text-[10px]">Secours Immédiat</Badge>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={keypadInput}
                  onChange={e => setKeypadInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleManualMatriculeSubmit();
                  }}
                  placeholder="Tapez le matricule de l'élève..."
                  className="h-10 text-center font-mono font-bold text-sm tracking-wider rounded-xl border-slate-200 focus:ring-2 focus:ring-[#2487B8]"
                />
                <Button
                  onClick={() => handleManualMatriculeSubmit()}
                  disabled={!keypadInput.trim() || isProcessing}
                  className="h-10 px-4 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs shrink-0"
                >
                  Valider
                </Button>
              </div>

              {/* Tactical Numeric Touch Keypad for Tablets & Screens */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'].map(key => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (key === 'C') setKeypadInput('');
                      else if (key === 'OK') handleManualMatriculeSubmit();
                      else setKeypadInput(prev => prev + key);
                    }}
                    className={`h-10 rounded-xl font-black text-xs transition-all cursor-pointer ${
                      key === 'OK'
                        ? 'bg-[#2487B8] hover:bg-[#1B6C93] text-white shadow-xs'
                        : key === 'C'
                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/50'
                        : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200/60'
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Real-time Session Scans Stream */}
          <Card className="p-5 bg-white rounded-3xl border border-slate-200/90 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#2487B8]" />
                <h3 className="font-extrabold text-xs text-[#16212B] uppercase tracking-wider">
                  Journal des Scans en Direct
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {events.length} enregistrements
              </span>
            </div>

            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {events.map(item => (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl border border-slate-100 bg-slate-50/80 hover:bg-slate-100/80 transition-colors flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <p className="font-bold text-[#16212B]">{item.studentName}</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {item.className} · {item.scannedAt}
                    </p>
                  </div>

                  <Badge className={`text-[10px] font-bold border-none ${
                    item.resultStatus === 'accepted'
                      ? item.stagedStatus === 'late'
                        ? 'bg-amber-500/15 text-amber-700'
                        : 'bg-emerald-500/15 text-emerald-700'
                      : 'bg-rose-500/15 text-rose-700'
                  }`}>
                    {item.resultStatus === 'accepted'
                      ? item.stagedStatus === 'late'
                        ? 'Retard'
                        : 'Présent'
                      : 'Rejeté'}
                  </Badge>
                </div>
              ))}

              {events.length === 0 && (
                <p className="text-center text-slate-400 text-xs py-8">
                  Aucun scan enregistré pour cette session.
                </p>
              )}
            </div>
          </Card>

          {/* Emergency Muster & Security Quick Action */}
          <div className={`p-4 rounded-2xl flex items-center justify-between gap-3 transition-all ${
            emergencyLockdown ? 'bg-rose-600 text-white shadow-lg' : 'bg-slate-900 text-white'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-bold shrink-0">
                {emergencyLockdown ? <Flame className="w-5 h-5 text-amber-300 animate-bounce" /> : <ShieldCheck className="w-5 h-5 text-emerald-400" />}
              </div>
              <div>
                <h4 className="font-black text-xs uppercase tracking-wider text-white">
                  {emergencyLockdown ? 'Protocole Alerte Actif' : 'Effectif & Sécurité'}
                </h4>
                <p className="text-[11px] text-white/80">
                  Présence signalée : <strong className="text-white font-bold">{headcountError || !onsiteHeadcount ? 'Indisponible' : onsiteHeadcount.headcount}</strong>
                </p>
                {onsiteHeadcount && !headcountError && (
                  <p className="text-[10px] text-white/70">
                    {onsiteHeadcount.manualUnverified} présence(s) manuelle(s) à vérifier · Actualisé à {new Date(onsiteHeadcount.asOf).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => setEmergencyLockdown(!emergencyLockdown)}
              className={`h-8 text-xs font-bold rounded-xl gap-1.5 shrink-0 ${
                emergencyLockdown
                  ? 'bg-white text-rose-700 hover:bg-slate-100'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {emergencyLockdown ? 'Lever l\'alerte' : 'Alerte Urgence'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
