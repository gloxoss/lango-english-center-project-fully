'use client';

import jsQR from 'jsqr';
import {
  Activity,
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  ChevronDown,
  Clock,
  History,
  KeyRound,
  MapPin,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { casablancaTodayIso } from '@/libs/finance/today';

/* ==========================================================================
 * THE GATE TERMINAL, REBUILT AROUND ONE IDEA (fix-plan-02, IMPL-ATT-*-01):
 * a badge read at the door is an ARRIVAL, not a lesson mark.
 *
 * The screen used to open with "Classe / portique actif" and force the operator
 * to pick a class before anything could be scanned, and the class it picked was
 * then written onto every scan. A receptionist at 08:00 does not know, and must
 * not have to know, which lesson a child is walking towards. So there is no
 * class picker any more. The terminal opens the right session by itself:
 *
 *   unpaired, or paired with no room  -> ENTRANCE. Any student badges in, the
 *                                       scan records a campus arrival, and no
 *                                       lesson is ever marked present.
 *   paired with a room                -> CLASSROOM. The lesson happening in
 *                                       that room right now, resolved from the
 *                                       timetable by the device's own identity.
 *
 * "Présent" in a lesson means the teacher saw the student in the lesson. A
 * badge at the gate cannot say that, and this screen no longer pretends it can.
 *
 * The lesson shown on every card comes from the SERVER's response, never from
 * anything this component chose. Showing the locally picked class was a real
 * bug: the card named one lesson while the mark went to another.
 * ========================================================================== */

type ScannerMode = 'entrance' | 'classroom';

/**
 * A lesson as the server resolved it. `subject` and `room` may be missing on a
 *  legacy or partly-filled timetable row; every renderer treats them as optional.
 */
type ServerLesson = {
  slotId: string | null;
  period: number | null;
  subject: string | null;
  startTime: string | null;
  endTime: string | null;
  room: string | null;
};

/**
 * What this terminal is currently pointing at. Built from the device's own
 *  resolution, or from an explicit admin choice. Never from a bare class.
 */
type ScanTarget = {
  mode: ScannerMode;
  sessionId: string | null;
  slotId: string | null;
  classSectionId: string | null;
  subjectName: string | null;
  className: string | null;
  sectionName: string | null;
  room: string | null;
  startTime: string | null;
  endTime: string | null;
  source: 'kiosk' | 'entrance' | 'override';
};

type Occurrence = {
  slotId: string;
  period: number | null;
  startTime: string;
  endTime: string;
  subjectName: string | null;
  className: string | null;
  sectionName: string | null;
  room: string | null;
  classSectionId: string | null;
};

/**
 * What the paired terminal's own room resolves to right now. No period: the
 *  device knows where it is, the timetable knows what is in it, and the period
 *  is the server's business when the badge is read.
 */
type KioskLesson = {
  slotId: string | null;
  classSectionId: string | null;
  startTime: string | null;
  endTime: string | null;
  subjectName: string | null;
  className: string | null;
  sectionName: string | null;
  room: string | null;
};

type Outcome = 'arrived' | 'late' | 'arrival-only' | 'already' | 'rejected' | 'manual';

type LastScan = {
  id: string;
  at: string;
  outcome: Outcome;
  studentName: string;
  studentImage: string | null;
  className: string | null;
  lesson: ServerLesson | null;
  reason: string | null;
};

type JournalEntry = {
  id: string;
  at: string;
  outcome: Outcome;
  studentName: string;
  className: string | null;
  reason: string | null;
};

type CampusCounters = {
  accepted: number;
  rejected: number;
  alreadyScanned: number;
};

type Headcount = {
  headcount: number;
  confirmedArrivals: number;
  manualUnverified: number;
  asOf: string;
};

// Web Audio confirmation. The operator is looking at a child, not at the screen,
// so the beep is the primary feedback and the card is the record.
function playBeep(type: 'accepted' | 'late' | 'rejected') {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      return;
    }
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'accepted') {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.22);
    } else if (type === 'late') {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(370, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.28);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(130, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {
    // Audio blocked or unsupported. A silent terminal still works.
  }
}

/**
 * Server rejection codes, in words a receptionist can act on. Built with
 *  literal translation calls, never a computed key, so the i18n checker can
 *  still see every string this screen can put in front of a person.
 */
function rejectionLabels(t: (key: string) => string): Record<string, string> {
  return {
    BADGE_INVALID: t('scanReasonUnknownBadge'),
    INVALID_CREDENTIAL: t('scanReasonUnknownBadge'),
    USER_NOT_FOUND: t('scanReasonUnknownBadge'),
    BADGE_REVOKED: t('scanReasonRevoked'),
    BADGE_REPLACED: t('scanReasonReplaced'),
    BADGE_EXPIRED: t('scanReasonExpired'),
    WRONG_CLASS: t('scanReasonWrongClass'),
    WRONG_BRANCH: t('scanReasonWrongBranch'),
    NO_LESSON_NOW: t('scanReasonNoLesson'),
    LESSON_NOT_SCHEDULED: t('scanReasonNoLesson'),
    REGISTER_LOCKED: t('scanReasonRegisterLocked'),
    NON_INSTRUCTIONAL_DAY: t('scanReasonNotInstructional'),
    DATE_OUTSIDE_SESSION: t('scanReasonNotInstructional'),
  };
}

/**
 * Wall-clock in the school's timezone, so "is this lesson running now" answers
 *  the same question the server answered when it resolved the lesson.
 */
function schoolMinutesNow(): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Casablanca',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

function minutesOf(time: string | null): number | null {
  if (!time) {
    return null;
  }
  const [hRaw, mRaw] = time.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (Number.isNaN(h) || Number.isNaN(m)) {
    return null;
  }
  return h * 60 + m;
}

function toOutcome(resultStatus: string, stagedStatus: string | null): Outcome {
  if (resultStatus === 'rejected') {
    return 'rejected';
  }
  if (resultStatus === 'already_scanned') {
    return 'already';
  }
  if (stagedStatus === 'late') {
    return 'late';
  }
  return 'arrived';
}

/** One tone per outcome, shared by the result card, its icon and the journal,
 *  so the three can never disagree about what colour "late" is. */
function outcomeTone(outcome: Outcome): 'danger' | 'warning' | 'success' {
  if (outcome === 'rejected') {
    return 'danger';
  }
  if (outcome === 'late') {
    return 'warning';
  }
  return 'success';
}

const OUTCOME_BOX: Record<'danger' | 'warning' | 'success', string> = {
  danger: 'border-rose-200 bg-rose-50 text-rose-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
};

function OutcomeIcon({ outcome }: { outcome: Outcome }) {
  const tone = outcomeTone(outcome);
  if (tone === 'danger') {
    return <XCircle className="size-6 shrink-0 text-rose-600" />;
  }
  if (tone === 'warning') {
    return <Clock className="size-6 shrink-0 text-amber-600" />;
  }
  return <CheckCircle2 className="size-6 shrink-0 text-emerald-600" />;
}

/** The note stamped on a keypad entry, so the audit trail can tell a human
 *  bypass from a badge read without depending on who is reading it. */
const MANUAL_BYPASS_NOTE = 'Saisie manuelle au poste d\'accueil (élève sans badge)';

export function AttendanceScannerPlayground({ locale = 'fr' }: { locale?: string } = {}) {
  const t = useTranslations('Attendance');

  // Every effect below reads the translator through this ref instead of
  // depending on it. `useTranslations` is not contractually stable across
  // renders, and an effect that depends on it can re-arm on every render:
  // for the bootstrap that would be an endless open-session loop, and for the
  // journal an interval that never lives long enough to fire.
  const tRef = useRef(t);
  tRef.current = t;

  const [target, setTarget] = useState<ScanTarget | null>(null);
  const [bootState, setBootState] = useState<'loading' | 'ready' | 'no-lesson' | 'failed'>('loading');
  const bootStateRef = useRef(bootState);
  bootStateRef.current = bootState;
  const [bootError, setBootError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  // Admin-only surfaces. Default false so a failed role lookup hides privileged
  // controls rather than showing them to whoever is at the keyboard.
  const [isAdmin, setIsAdmin] = useState(false);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [occurrencesState, setOccurrencesState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [overrideSlotId, setOverrideSlotId] = useState('');
  const [overrideError, setOverrideError] = useState<string | null>(null);

  // Terminal identity. The secret lives in a ref, never in state, so it cannot
  // reach a render tree, a log or a crash report.
  const deviceSecretRef = useRef('');
  const [devicePaired, setDevicePaired] = useState(false);
  const [deviceRoom, setDeviceRoom] = useState<string | null>(null);
  const [deviceSecretInput, setDeviceSecretInput] = useState('');

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [wedgeInput, setWedgeInput] = useState('');
  const [lastScan, setLastScan] = useState<LastScan | null>(null);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [rosterCount, setRosterCount] = useState<number | null>(null);
  const [campusCounters, setCampusCounters] = useState<CampusCounters | null>(null);
  const [headcount, setHeadcount] = useState<Headcount | null>(null);

  const [keypadInput, setKeypadInput] = useState('');
  const [manualState, setManualState] = useState<'idle' | 'searching'>('idle');
  const [manualMessage, setManualMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const wedgeRef = useRef<HTMLInputElement | null>(null);
  const lastTokenRef = useRef<{ token: string; at: number } | null>(null);
  const targetRef = useRef<ScanTarget | null>(null);
  const processingRef = useRef(false);
  const soundRef = useRef(true);
  // True once a session is resolved, so a periodic re-check does not blank a
  // screen that is already serving a queue at the door.
  const hasTargetRef = useRef(false);

  useEffect(() => {
    targetRef.current = target;
  }, [target]);
  useEffect(() => {
    processingRef.current = isProcessing;
  }, [isProcessing]);
  useEffect(() => {
    soundRef.current = soundEnabled;
  }, [soundEnabled]);

  /* ------------------------------------------------------------------ *
   * Who is at the keyboard. An admin sees the terminal settings and the
   * lesson override; an operator sees neither. Read from the server, never
   * computed from anything the client holds.
   * ------------------------------------------------------------------ */
  useEffect(() => {
    let cancelled = false;
    fetch('/api/portal/me')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.success) {
          return;
        }
        const role = json.data?.role;
        setIsAdmin(role === 'school_admin' || role === 'super_admin');
      })
      .catch(() => { /* stays non-admin */ });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ------------------------------------------------------------------ *
   * Terminal pairing, read once from storage. A private window or blocked
   * site data throws on read; an unpaired terminal is a working terminal,
   * so this never blocks the screen.
   * ------------------------------------------------------------------ */
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('schoolos.deviceSecret') ?? '';
      deviceSecretRef.current = stored;
      setDevicePaired(stored.length > 0);
    } catch {
      deviceSecretRef.current = '';
    }
  }, []);

  function pairThisTerminal() {
    const secret = deviceSecretInput.trim();
    try {
      if (secret) {
        window.localStorage.setItem('schoolos.deviceSecret', secret);
      } else {
        window.localStorage.removeItem('schoolos.deviceSecret');
      }
    } catch {
      // Not persisted, but it still works for this session.
    }
    deviceSecretRef.current = secret;
    setDevicePaired(secret.length > 0);
    setDeviceSecretInput('');
    setOverrideSlotId('');
    // The terminal's identity just changed, so what it is pointing at has to be
    // resolved again from scratch rather than kept.
    hasTargetRef.current = false;
    setRetryTick(n => n + 1);
  }

  /* ------------------------------------------------------------------ *
   * BOOTSTRAP. Open (or reuse) the right session without asking the
   * operator anything. Reused for the whole day, so a reload cannot split
   * one terminal's counters in two.
   * ------------------------------------------------------------------ */

  /** Opens or reuses a session. Returns null and records the failure otherwise. */
  const openSession = useCallback(async (body: { slotId?: string }) => {
    try {
      const res = await fetch('/api/attendance/qr/scanner-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setBootError(json?.error?.message || tRef.current('scanSessionFailed'));
        setBootState('failed');
        return null;
      }
      return { sessionId: json.data?.id as string, mode: json.mode as ScannerMode };
    } catch {
      setBootError(tRef.current('sessionNetworkError'));
      setBootState('failed');
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Only blank the screen when there is nothing to show yet, and never while
    // a failure is on display: a terminal that cannot reach the server should
    // keep saying so, not blink between "loading" and "failed" every retry.
    if (!hasTargetRef.current && bootStateRef.current !== 'failed') {
      setBootState('loading');
      setBootError(null);
    }

    void (async () => {
      const secret = deviceSecretRef.current;
      let kiosk: { bound: boolean; device?: { roomLabel: string | null }; session: KioskLesson | null } | null = null;

      if (secret) {
        try {
          const res = await fetch(`/api/attendance/kiosk/current-session?deviceSecret=${encodeURIComponent(secret)}`);
          const json = await res.json();
          if (json?.success) {
            kiosk = json.data;
          }
        } catch {
          // A kiosk that cannot reach the timetable falls back to the gate below
          // rather than blocking. Entrance scanning records arrivals and writes
          // no lesson mark at all, so this degradation cannot corrupt a register;
          // refusing to scan until the timetable answers would take the door
          // offline over a read that will succeed on the next check.
        }
      }
      if (cancelled) {
        return;
      }

      const roomLabel = kiosk?.device?.roomLabel ?? null;
      setDeviceRoom(roomLabel);

      // A terminal paired WITH a room is a classroom station. No lesson there
      // right now is a normal state, not a failure: say so and wait.
      if (secret && kiosk?.bound && roomLabel) {
        const lesson = kiosk.session;
        if (!lesson?.slotId) {
          hasTargetRef.current = false;
          setTarget(null);
          setBootState('no-lesson');
          return;
        }
        const opened = await openSession({ slotId: lesson.slotId });
        if (cancelled) {
          return;
        }
        if (!opened) {
          return;
        }
        hasTargetRef.current = true;
        setTarget({
          mode: 'classroom',
          sessionId: opened.sessionId,
          slotId: lesson.slotId,
          classSectionId: lesson.classSectionId ?? null,
          subjectName: lesson.subjectName ?? null,
          className: lesson.className ?? null,
          sectionName: lesson.sectionName ?? null,
          room: lesson.room ?? roomLabel,
          startTime: lesson.startTime ?? null,
          endTime: lesson.endTime ?? null,
          source: 'kiosk',
        });
        setBootState('ready');
        return;
      }

      // Unpaired, or paired without a room: the gate. Any student of the school.
      const opened = await openSession({});
      if (cancelled) {
        return;
      }
      if (!opened) {
        return;
      }
      hasTargetRef.current = true;
      setTarget({
        mode: 'entrance',
        sessionId: opened.sessionId,
        slotId: null,
        classSectionId: null,
        subjectName: null,
        className: null,
        sectionName: null,
        room: null,
        startTime: null,
        endTime: null,
        source: 'entrance',
      });
      setBootState('ready');
    })();

    return () => {
      cancelled = true;
    };
  }, [retryTick, openSession]);

  /**
   * The screen PROMISES that a room-bound terminal resumes on its own at the
   * next lesson ("le pointage reprendra automatiquement"). That claim has to be
   * true, so the bootstrap re-runs on a timer: every 30 seconds while waiting
   * for a lesson, every 5 minutes otherwise so a terminal paired mid-morning
   * picks up the new lesson without a reload.
   *
   * Re-running is safe: opening a session is an upsert that reuses the day's
   * already-open one, so this cannot split a terminal's counters or open a
   * second session.
   */
  useEffect(() => {
    if (bootState === 'loading') {
      return;
    }
    // A gate that failed retries on its own; so does a room waiting for its
    // next lesson. A working terminal re-resolves less often, so a queued scan
    // is never interrupted for a check that changes nothing.
    const delay = bootState === 'ready' ? 300000 : 30000;
    const id = setInterval(() => setRetryTick(n => n + 1), delay);
    return () => clearInterval(id);
  }, [bootState]);

  /* ------------------------------------------------------------------ *
   * The terminal's own journal. Server-owned: this list IS the counter
   * source for "Ce terminal", so a reload, a second tab or a colleague at
   * the same desk cannot make it disagree with the database.
   * ------------------------------------------------------------------ */
  const sessionId = target?.sessionId ?? null;

  useEffect(() => {
    if (!sessionId) {
      setJournal([]);
      return;
    }
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/attendance/qr/scanner-sessions/${sessionId}/events`);
        const json = await res.json();
        if (cancelled || !json?.success || !Array.isArray(json.data)) {
          return;
        }
        setJournal(json.data.map((item: {
          id: string;
          scannedAt: string;
          resultStatus: string;
          rejectionReason: string | null;
          stagedStatus: string | null;
          studentName: string | null;
        }) => ({
          id: item.id,
          at: item.scannedAt,
          outcome: toOutcome(item.resultStatus, item.stagedStatus),
          studentName: item.studentName ?? tRef.current('unknownStudent'),
          className: null,
          reason: item.rejectionReason ?? null,
        })));
      } catch {
        // Best effort. The next tick tries again.
      }
    };

    void load();
    const interval = setInterval(() => {
      void load();
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sessionId]);

  /* ------------------------------------------------------------------ *
   * Campus-wide numbers. These come from SERVER aggregate counts, not from
   * a client array, so "Tous les terminaux" cannot silently cap out. Kept
   * in a separate scope from the terminal's own numbers and labelled as
   * such, because two different questions read as a contradiction when
   * their scopes are not named.
   * ------------------------------------------------------------------ */
  useEffect(() => {
    let cancelled = false;
    const today = casablancaTodayIso();

    const load = async () => {
      try {
        const [eventsRes, onsiteRes] = await Promise.all([
          fetch(`/api/attendance/qr/events?from=${today}&to=${today}`),
          fetch('/api/attendance/onsite', { cache: 'no-store' }),
        ]);
        const eventsJson = await eventsRes.json();
        const onsiteJson = await onsiteRes.json();
        if (cancelled) {
          return;
        }
        if (eventsJson?.success && eventsJson.aggregates) {
          setCampusCounters({
            accepted: eventsJson.aggregates.accepted ?? 0,
            rejected: eventsJson.aggregates.rejected ?? 0,
            alreadyScanned: eventsJson.aggregates.alreadyScanned ?? 0,
          });
        } else {
          setCampusCounters(null);
        }
        setHeadcount(onsiteJson?.success ? onsiteJson.data : null);
      } catch {
        if (!cancelled) {
          setCampusCounters(null);
          setHeadcount(null);
        }
      }
    };

    void load();
    const interval = setInterval(() => {
      void load();
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sessionId]);

  /* ------------------------------------------------------------------ *
   * Roll-call meter. Classroom only, and both numbers come from the SAME
   * scope: the scans this lesson's terminal recorded, over that lesson's
   * own roster. An entrance terminal has no roster to divide by, so it
   * shows none rather than dividing a session count by a campus count.
   * ------------------------------------------------------------------ */
  useEffect(() => {
    const sectionId = target?.classSectionId;
    if (target?.mode !== 'classroom' || !sectionId) {
      setRosterCount(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/students?classSectionId=${sectionId}`)
      .then(res => res.json())
      .then((json) => {
        if (cancelled) {
          return;
        }
        // `total` is the whole section; `data.length` is one page.
        setRosterCount(json?.success ? (typeof json.total === 'number' ? json.total : json.data?.length ?? null) : null);
      })
      .catch(() => {
        if (!cancelled) {
          setRosterCount(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [target?.mode, target?.classSectionId]);

  /** Today's lessons, for the admin override. Loaded on demand. */
  const loadOccurrences = useCallback(async () => {
    setOccurrencesState('loading');
    try {
      const res = await fetch('/api/attendance/day');
      const json = await res.json();
      if (!json?.success) {
        setOccurrencesState('error');
        return;
      }
      const sessions: Occurrence[] = (json.data?.sessions ?? [])
        .filter((s: Occurrence & { state?: string }) => s.slotId && s.state !== 'ANNULE')
        .map((s: Occurrence) => ({
          slotId: s.slotId,
          period: s.period ?? null,
          startTime: s.startTime,
          endTime: s.endTime,
          subjectName: s.subjectName ?? null,
          className: s.className ?? null,
          sectionName: s.sectionName ?? null,
          room: s.room ?? null,
          classSectionId: s.classSectionId ?? null,
        }));
      setOccurrences(sessions);
      setOccurrencesState('ready');
    } catch {
      setOccurrencesState('error');
    }
  }, []);

  /**
   * An admin picks a lesson, not a class: a section alone cannot tell a 14:00
   *  badge from an 08:00 one. The session is bound to the chosen occurrence, so
   *  every scan under the override is recorded against that lesson and appears
   *  in the audit trail with its slot.
   */
  const applyOverride = useCallback(async (slotId: string) => {
    setOverrideError(null);
    if (!slotId) {
      setOverrideSlotId('');
      setRetryTick(n => n + 1);
      return;
    }
    const occurrence = occurrences.find(o => o.slotId === slotId);
    if (!occurrence) {
      return;
    }

    const opened = await openSession({ slotId });
    if (!opened) {
      // openSession already parked the failure in the header, which is where
      // the operator is looking; this line names the override specifically.
      setOverrideError(tRef.current('scanSessionFailed'));
      return;
    }

    setOverrideSlotId(slotId);
    hasTargetRef.current = true;
    setTarget({
      mode: 'classroom',
      sessionId: opened.sessionId,
      slotId,
      classSectionId: occurrence.classSectionId,
      subjectName: occurrence.subjectName,
      className: occurrence.className,
      sectionName: occurrence.sectionName,
      room: occurrence.room,
      startTime: occurrence.startTime,
      endTime: occurrence.endTime,
      source: 'override',
    });
    setBootState('ready');
  }, [occurrences, openSession]);

  /* ------------------------------------------------------------------ *
   * A badge read. The server resolves the lesson and decides the mode; this
   * component only reports what came back.
   * ------------------------------------------------------------------ */
  const processToken = useCallback(async (rawToken: string) => {
    if (processingRef.current) {
      return;
    }
    const trimmed = rawToken.trim();
    if (!trimmed) {
      return;
    }

    // A wedge can deliver the same code twice in one burst.
    const now = Date.now();
    if (lastTokenRef.current && lastTokenRef.current.token === trimmed && now - lastTokenRef.current.at < 2500) {
      return;
    }
    lastTokenRef.current = { token: trimmed, at: now };

    setIsProcessing(true);
    try {
      const active = targetRef.current;
      const res = await fetch('/api/attendance/qr/verify-and-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawToken: trimmed,
          sessionId: active?.sessionId ?? undefined,
          // The device's own identity, so the server can use ITS branch. A
          // browser operator without one still scans exactly as before.
          deviceSecret: deviceSecretRef.current || undefined,
        }),
      });
      const json = await res.json();
      const at = new Date().toISOString();

      if (json?.success) {
        const data = json.data ?? {};
        const lesson: ServerLesson | null = data.lesson ?? null;
        const mode: ScannerMode = data.mode ?? active?.mode ?? 'entrance';
        const late = data.stagedStatus === 'late';
        // `arrivalOnly` is the server saying "no lesson was in window, this is
        // an arrival and nothing else". Fall back to "no lesson returned" for
        // an older server, which means the same thing.
        const arrivalOnly = data.arrivalOnly ?? !lesson;

        setLastScan({
          id: data.scanEvent?.id ?? `scan-${now}`,
          at,
          outcome: data.resultStatus === 'already_scanned' ? 'already' : late ? 'late' : arrivalOnly ? 'arrival-only' : 'arrived',
          studentName: data.student?.name ?? tRef.current('studentRecognized'),
          studentImage: data.student?.image ?? null,
          className: mode === 'classroom' ? active?.className ?? null : null,
          lesson,
          reason: null,
        });
        if (soundRef.current) {
          playBeep(late ? 'late' : 'accepted');
        }
      } else {
        const code = json?.error?.code ?? '';
        const label = rejectionLabels(t)[code];
        setLastScan({
          id: `rej-${now}`,
          at,
          outcome: 'rejected',
          studentName: code === 'BADGE_INVALID' || code === 'INVALID_CREDENTIAL'
            ? tRef.current('scanReasonUnknownBadge')
            : tRef.current('scanEventRejected'),
          studentImage: null,
          className: null,
          lesson: null,
          reason: label ?? json?.error?.message ?? tRef.current('badgeNotRecognizedClass'),
        });
        if (soundRef.current) {
          playBeep('rejected');
        }
      }
    } catch {
      setLastScan({
        id: `err-${now}`,
        at: new Date().toISOString(),
        outcome: 'rejected',
        studentName: tRef.current('scanEventRejected'),
        studentImage: null,
        className: null,
        lesson: null,
        reason: tRef.current('serverUnreachable'),
      });
      if (soundRef.current) {
        playBeep('rejected');
      }
    } finally {
      setIsProcessing(false);
    }
  }, []);

  /* ------------------------------------------------------------------ *
   * The emergency path: a student with no badge. This is a MANUAL mark by a
   * named human, not a badge read, and it is recorded as one (no scan event,
   * the operator's id on the row). It needs the student's own class and the
   * period of the lesson actually running, and it refuses rather than writing
   * a presence into an arbitrary period when no lesson is on.
   * ------------------------------------------------------------------ */
  const submitManualMatricule = useCallback(async (raw: string) => {
    const term = raw.trim();
    if (!term || processingRef.current) {
      return;
    }
    setIsProcessing(true);
    setManualState('searching');
    setManualMessage(null);

    try {
      const studentRes = await fetch(`/api/students?search=${encodeURIComponent(term)}`);
      const studentJson = await studentRes.json();
      const student = Array.isArray(studentJson?.data) ? studentJson.data[0] : null;
      if (!student) {
        setManualMessage({ tone: 'error', text: tRef.current('scanManualNotFound') });
        return;
      }
      if (!student.classSectionId) {
        setManualMessage({ tone: 'error', text: tRef.current('scanManualNoClass') });
        return;
      }

      // The period this student's class is actually in right now, or the lesson
      // an admin has explicitly chosen for this terminal.
      const override = targetRef.current?.source === 'override' ? targetRef.current : null;
      let period = override && override.classSectionId === student.classSectionId
        ? occurrences.find(o => o.slotId === override.slotId)?.period ?? null
        : null;

      if (!period) {
        const dayRes = await fetch('/api/attendance/day');
        const dayJson = await dayRes.json();
        const nowMinutes = schoolMinutesNow();
        const running = (dayJson?.data?.sessions ?? []).find((s: Occurrence) => {
          if (s.classSectionId !== student.classSectionId) {
            return false;
          }
          const start = minutesOf(s.startTime);
          const end = minutesOf(s.endTime);
          if (start === null || end === null) {
            return false;
          }
          return nowMinutes >= start - 5 && nowMinutes <= end + 15;
        });
        period = running?.period ?? null;
      }

      if (!period) {
        setManualMessage({ tone: 'error', text: tRef.current('scanManualNoLesson') });
        return;
      }

      const sectionsRes = await fetch('/api/academics/class-sections');
      const sectionsJson = await sectionsRes.json();
      const row = (sectionsJson?.data ?? []).find((s: { id: string; classId?: string }) => s.id === student.classSectionId);
      if (!row?.classId) {
        setManualMessage({ tone: 'error', text: tRef.current('scanManualNoClass') });
        return;
      }

      const writeRes = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: casablancaTodayIso(),
          studentGroupId: row.classId,
          period,
          records: [{ studentId: student.id, status: 'present' }],
          // Deliberately NOT a translation. This note is written into the
          // attendance row and read back by the register and the audit trail,
          // possibly by an administrator using another locale. An audit entry
          // that changes wording with the reader's UI language is a worse record
          // than one that stays in the school's operational language.
          correctionNote: MANUAL_BYPASS_NOTE,
        }),
      });
      const writeJson = await writeRes.json();
      if (!writeRes.ok || !writeJson?.success) {
        setManualMessage({ tone: 'error', text: writeJson?.error?.message ?? tRef.current('scanManualFailed') });
        if (soundRef.current) {
          playBeep('rejected');
        }
        return;
      }

      setLastScan({
        id: `manual-${Date.now()}`,
        at: new Date().toISOString(),
        outcome: 'manual',
        studentName: student.fullName ?? student.name ?? term,
        studentImage: null,
        className: student.className ?? null,
        lesson: null,
        reason: null,
      });
      setManualMessage({ tone: 'ok', text: tRef.current('scanManualDone', { name: student.fullName ?? student.name ?? term }) });
      setKeypadInput('');
      if (soundRef.current) {
        playBeep('accepted');
      }
    } catch {
      setManualMessage({ tone: 'error', text: tRef.current('scanManualFailed') });
      if (soundRef.current) {
        playBeep('rejected');
      }
    } finally {
      setManualState('idle');
      setIsProcessing(false);
    }
  }, [occurrences]);

  /* ------------------------------------------------------------------ *
   * THE WEDGE IS ALWAYS LISTENING. A USB scanner types into whatever has
   * focus, so a document-level buffer catches the burst whenever the focus
   * is NOT in a form control. That is what lets the keypad, the override
   * select and the settings drawer stay usable: nothing steals focus on a
   * timer, and a badge still lands while a button has focus.
   * ------------------------------------------------------------------ */
  useEffect(() => {
    if (bootState !== 'ready') {
      return;
    }
    let buffer = '';
    let lastKeyAt = 0;

    const onKeyDown = (event: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) {
        return;
      }

      const current = Date.now();
      // A gap longer than a wedge burst starts a new code.
      if (current - lastKeyAt > 300) {
        buffer = '';
      }
      lastKeyAt = current;

      if (event.key === 'Enter') {
        if (buffer.length >= 3) {
          event.preventDefault();
          const token = buffer;
          buffer = '';
          void processToken(token);
        }
        return;
      }
      if (event.key.length === 1) {
        buffer += event.key;
      }
      if (buffer.length > 512) {
        buffer = '';
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [bootState, processToken]);

  /* ------------------------------------------------------------------ *
   * Camera. Off by default: a fixed terminal with a USB reader does not
   * need a permission prompt on every load, and the camera is the optional
   * second input, not the primary one.
   * ------------------------------------------------------------------ */
  const stopCamera = useCallback(() => {
    scanningRef.current = false;
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
      setCameraError(tRef.current('cameraUnsupported'));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      scanningRef.current = true;
      setCameraReady(true);

      // BarcodeDetector is the fast native path but exists only on Chromium and
      // Android; jsQR backs it and covers the browsers where the camera opened
      // and nothing was ever decoded.
      let nativeDetector: { detect: (source: HTMLVideoElement) => Promise<{ rawValue?: string }[]> } | null = null;
      if ('BarcodeDetector' in window) {
        try {
          const Ctor = (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (s: HTMLVideoElement) => Promise<{ rawValue?: string }[]> } }).BarcodeDetector;
          nativeDetector = new Ctor({ formats: ['qr_code'] });
        } catch {
          nativeDetector = null;
        }
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      const scanFrame = async () => {
        if (!scanningRef.current || !videoRef.current) {
          return;
        }
        const video = videoRef.current;
        try {
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            if (nativeDetector) {
              const codes = await nativeDetector.detect(video);
              if (codes.length > 0 && codes[0]?.rawValue) {
                void processToken(codes[0].rawValue);
              }
            } else if (ctx) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(frame.data, frame.width, frame.height);
              if (code?.data) {
                void processToken(code.data);
              }
            }
          }
        } catch {
          // A dropped frame is not a failed scan.
        }
        if (scanningRef.current) {
          requestAnimationFrame(() => {
            void scanFrame();
          });
        }
      };

      requestAnimationFrame(() => {
        void scanFrame();
      });
    } catch {
      stopCamera();
      setCameraError(tRef.current('cameraPermissionError'));
    }
  }, [cameraFacing, processToken, stopCamera]);

  useEffect(() => {
    if (cameraEnabled && bootState === 'ready') {
      void startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [cameraEnabled, bootState, startCamera, stopCamera]);

  /* ------------------------------------------------------------------ *
   * Counters. "Ce terminal" is the session's own journal; "Tous les
   * terminaux" is the school's aggregate. Each is labelled with its scope
   * so the two can never be read as disagreeing.
   * ------------------------------------------------------------------ */
  const terminalCounts = useMemo(() => {
    const accepted = journal.filter(e => e.outcome === 'arrived' || e.outcome === 'late' || e.outcome === 'arrival-only').length;
    const late = journal.filter(e => e.outcome === 'late').length;
    const rejected = journal.filter(e => e.outcome === 'rejected').length;
    return { accepted, late, rejected, total: journal.length };
  }, [journal]);

  const JOURNAL_CAP = 200;
  const journalCapped = journal.length >= JOURNAL_CAP;

  const campusTotal = campusCounters
    ? campusCounters.accepted + campusCounters.rejected + campusCounters.alreadyScanned
    : null;

  function timeOf(iso: string): string {
    return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }

  function classLabel(className: string | null, sectionName: string | null): string | null {
    const joined = [className, sectionName].filter(Boolean).join(' ').trim();
    return joined.length > 0 ? joined : null;
  }

  const modeLine = (() => {
    if (bootState === 'loading') {
      return t('scanPreparing');
    }
    if (bootState === 'no-lesson') {
      return t('scanNoLessonInRoom');
    }
    if (bootState === 'failed') {
      return t('scanSessionFailed');
    }
    if (!target || target.mode === 'entrance') {
      return t('scanModeEntrance');
    }
    const klass = classLabel(target.className, target.sectionName) ?? t('scanUnknownClass');
    const head = {
      subject: target.subjectName ?? t('scanUnknownSubject'),
      class: klass,
      start: target.startTime ?? '--:--',
      end: target.endTime ?? '--:--',
    };
    return target.room
      ? t('scanModeClassroom', { room: target.room, ...head })
      : t('scanModeClassroomNoRoom', head);
  })();

  const scanningEnabled = bootState === 'ready' && Boolean(target);

  /** The one line the operator reads. Server-resolved lesson, never a guess. */
  function arrivalLine(scan: LastScan): string {
    if (scan.outcome === 'rejected') {
      return scan.reason ?? t('scanReasonGeneric');
    }
    if (scan.outcome === 'manual') {
      return t('scanManualTitle');
    }
    if (scan.outcome === 'already') {
      return t('alreadyScannedMessage');
    }
    const time = timeOf(scan.at);
    if (scan.outcome === 'late' && scan.lesson?.subject && scan.lesson.startTime) {
      return t('scanArrivedLate', { time, subject: scan.lesson.subject, start: scan.lesson.startTime });
    }
    if (scan.outcome === 'arrival-only') {
      return t('scanArrivalNoLesson');
    }
    return t('scanArrivedAt', { time });
  }

  const rollCallPercent = rosterCount && rosterCount > 0
    ? Math.min(100, Math.round((terminalCounts.accepted / rosterCount) * 100))
    : 0;

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 pb-16">

      {/* WHAT THIS TERMINAL IS POINTING AT, in plain words. It is the first
          thing on the page because it is the only thing that can be wrong in a
          way the operator cannot see. */}
      <header className="
        rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-2xs
      "
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`
              flex size-11 shrink-0 items-center justify-center rounded-xl
              ${
    target?.mode === 'classroom'
      ? 'bg-sos-info-soft text-[#2487B8]'
      : `bg-sos-canvas text-[#16212B]`
    }
            `}
            >
              {target?.mode === 'classroom'
                ? <MapPin className="size-5" />
                : (
                    <ScanLine className="size-5" />
                  )}
            </span>
            <div className="min-w-0">
              <p className="
                text-[11px] font-bold tracking-wider text-slate-400 uppercase
              "
              >
                {t('scanTitle')}
              </p>
              <h1 className="
                truncate text-lg font-black tracking-tight text-[#16212B]
              "
              >
                {modeLine}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {target?.source === 'override' && (
              <Badge variant="warning" className="gap-1">
                <SlidersHorizontal className="size-3" />
                {t('scanOverrideActive', { lesson: target.subjectName ?? classLabel(target.className, target.sectionName) ?? '' })}
              </Badge>
            )}
            <Badge variant={devicePaired ? 'success' : 'neutral'}>
              {devicePaired ? t('devicePairedLabel') : t('deviceUnpairedLabel')}
            </Badge>
            <button
              type="button"
              onClick={() => setSoundEnabled(v => !v)}
              aria-pressed={soundEnabled}
              title={soundEnabled ? t('scanSoundOn') : t('scanSoundOff')}
              className={`
                rounded-lg border p-2 transition-colors
                ${
    soundEnabled
      ? `
        border-emerald-200 bg-emerald-50 text-emerald-700
        hover:bg-emerald-100
      `
      : `
        border-slate-200 bg-slate-100 text-slate-400
        hover:bg-slate-200
      `
    }
              `}
            >
              {soundEnabled
                ? <Volume2 className="size-4" />
                : (
                    <VolumeX className="size-4" />
                  )}
              <span className="sr-only">{soundEnabled ? t('scanSoundOn') : t('scanSoundOff')}</span>
            </button>
          </div>
        </div>

        {bootState === 'no-lesson' && (
          <div className="
            mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg
            border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold
            text-amber-900
          "
          >
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0" />
              {t('scanNoLessonInRoomHint')}
            </span>
            <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setRetryTick(n => n + 1)}>
              <RefreshCw className="size-3" />
              {' '}
              {t('scanRecheck')}
            </Button>
          </div>
        )}

        {bootState === 'failed' && (
          <div className="
            mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg
            border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold
            text-rose-900
          "
          >
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0" />
              {bootError ?? t('scanSessionFailed')}
            </span>
            <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setRetryTick(n => n + 1)}>
              <RefreshCw className="size-3" />
              {' '}
              {t('retryBtn')}
            </Button>
          </div>
        )}
      </header>

      {/* The rest of the attendance workspace, and the two admin-only surfaces.
          Both are native disclosures: no modal, no focus trap, nothing to
          dismiss before the next scan. */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link
          href={`/${locale}/dashboard/attendance`}
          className="
            flex items-center gap-1.5 rounded-lg border border-slate-200
            bg-white px-3 py-1.5 font-semibold text-slate-700 transition-colors
            hover:bg-slate-50
          "
        >
          <Activity className="size-3.5 text-[#2487B8]" />
          {' '}
          {t('scanLinkRollCall')}
        </Link>
        <Link
          href={`/${locale}/dashboard/attendance/qr-reports`}
          className="
            flex items-center gap-1.5 rounded-lg border border-slate-200
            bg-white px-3 py-1.5 font-semibold text-slate-700 transition-colors
            hover:bg-slate-50
          "
        >
          <History className="size-3.5 text-slate-500" />
          {' '}
          {t('scanLinkReports')}
        </Link>
        <Link
          href={`/${locale}/dashboard/cards/badges`}
          className="
            flex items-center gap-1.5 rounded-lg border border-slate-200
            bg-white px-3 py-1.5 font-semibold text-slate-700 transition-colors
            hover:bg-slate-50
          "
        >
          <QrCode className="size-3.5 text-sos-signal" />
          {' '}
          {t('scanLinkBadges')}
        </Link>

        {isAdmin && (
          <details
            className="group relative"
            onToggle={(e) => {
              if ((e.currentTarget as HTMLDetailsElement).open && occurrencesState === 'idle') {
                void loadOccurrences();
              }
            }}
          >
            <summary className="
              flex cursor-pointer list-none items-center gap-1.5 rounded-lg
              border border-slate-200 bg-white px-3 py-1.5 font-semibold
              text-slate-700 transition-colors
              hover:bg-slate-50
            "
            >
              <SlidersHorizontal className="size-3.5 text-amber-500" />
              {t('scanOverrideSummary')}
              <ChevronDown className="
                size-3 transition-transform
                group-open:rotate-180
              "
              />
            </summary>
            <div className="
              absolute left-0 z-20 mt-2 w-80 space-y-2 rounded-xl border
              border-slate-200 bg-white p-3 shadow-lg
            "
            >
              <p className="text-[11px] font-medium text-slate-500">{t('scanOverrideHint')}</p>
              <label
                className="
                  block text-[11px] font-bold tracking-wider text-slate-500
                  uppercase
                "
                htmlFor="scan-override"
              >
                {t('scanOverrideLabel')}
              </label>
              <select
                id="scan-override"
                value={overrideSlotId}
                onChange={(e) => {
                  void applyOverride(e.target.value);
                }}
                disabled={occurrencesState === 'loading'}
                className="
                  h-9 w-full rounded-lg border border-slate-200 bg-sos-canvas/40
                  px-2 text-xs font-semibold text-slate-800 outline-none
                  focus:border-[#2487B8] focus:ring-2 focus:ring-[#2487B8]/20
                "
              >
                <option value="">{t('scanOverrideDefault')}</option>
                {occurrences.map(o => (
                  <option key={o.slotId} value={o.slotId}>
                    {t('scanOverrideOption', {
                      start: o.startTime,
                      subject: o.subjectName ?? t('scanUnknownSubject'),
                      class: classLabel(o.className, o.sectionName) ?? t('scanUnknownClass'),
                    })}
                  </option>
                ))}
              </select>
              {occurrencesState === 'loading' && (
                <p className="text-[11px] text-slate-500">
                  {t('scanOverrideLoading')}
                </p>
              )}
              {occurrencesState === 'error' && (
                <p className="text-[11px] font-semibold text-rose-600">
                  {t('scanOverrideError')}
                </p>
              )}
              {occurrencesState === 'ready' && occurrences.length === 0 && (
                <p className="text-[11px] text-slate-500">
                  {t('scanOverrideEmpty')}
                </p>
              )}
              {overrideError && (
                <p className="text-[11px] font-semibold text-rose-600">
                  {overrideError}
                </p>
              )}
            </div>
          </details>
        )}

        {isAdmin && (
          <details className="group relative">
            <summary className="
              flex cursor-pointer list-none items-center gap-1.5 rounded-lg
              border border-slate-200 bg-white px-3 py-1.5 font-semibold
              text-slate-700 transition-colors
              hover:bg-slate-50
            "
            >
              <KeyRound className="size-3.5 text-slate-500" />
              {t('scanSettingsTitle')}
              <ChevronDown className="
                size-3 transition-transform
                group-open:rotate-180
              "
              />
            </summary>
            <div className="
              absolute left-0 z-20 mt-2 w-80 space-y-3 rounded-xl border
              border-slate-200 bg-white p-3 shadow-lg
            "
            >
              <p className="text-[11px] font-medium text-slate-500">{t('scanSettingsHint')}</p>

              <div className="space-y-2">
                <p className="
                  text-[11px] font-bold tracking-wider text-slate-500 uppercase
                "
                >
                  {t('scanPairingTitle')}
                </p>
                <p className="text-[11px] text-slate-500">{t('scanPairingHint')}</p>
                {deviceRoom && (
                  <p className="text-[11px] font-semibold text-[#2487B8]">
                    {t('roomLabel')}
                    {' '}
                    :
                    {' '}
                    {deviceRoom}
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={deviceSecretInput}
                    onChange={e => setDeviceSecretInput(e.target.value)}
                    placeholder={t('deviceSecretPlaceholder')}
                    aria-label={t('deviceSecretPlaceholder')}
                    className="
                      h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-2
                      text-xs text-slate-700 outline-none
                      focus:border-[#2487B8] focus:ring-2
                      focus:ring-[#2487B8]/20
                    "
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0"
                    onClick={pairThisTerminal}
                  >
                    {devicePaired ? t('deviceUnpairBtn') : t('devicePairBtn')}
                  </Button>
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-3">
                <p className="
                  text-[11px] font-bold tracking-wider text-slate-500 uppercase
                "
                >
                  {t('scanManualTitle')}
                </p>
                <p className="text-[11px] text-slate-500">{t('scanManualHint')}</p>
                <div className="flex gap-2">
                  <Input
                    value={keypadInput}
                    onChange={e => setKeypadInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        void submitManualMatricule(keypadInput);
                      }
                    }}
                    placeholder={t('scanManualPlaceholder')}
                    aria-label={t('scanManualPlaceholder')}
                    className="
                      h-9 text-center font-mono font-bold tracking-wider
                    "
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 shrink-0"
                    disabled={!keypadInput.trim() || manualState === 'searching'}
                    onClick={() => {
                      void submitManualMatricule(keypadInput);
                    }}
                  >
                    {manualState === 'searching' ? t('scanManualSearching') : t('manualValidateBtn')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 shrink-0"
                    disabled={!keypadInput}
                    onClick={() => {
                      setKeypadInput('');
                      setManualMessage(null);
                    }}
                  >
                    {t('scanManualClear')}
                  </Button>
                </div>
                {/* The same keypad the counter staff already know, for a tablet
                    with no keyboard attached. */}
                <div className="grid grid-cols-3 gap-1.5">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'].map(key => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (key === 'C') {
                          setKeypadInput('');
                          setManualMessage(null);
                        } else if (key === 'OK') {
                          void submitManualMatricule(keypadInput);
                        } else {
                          setKeypadInput(prev => prev + key);
                        }
                      }}
                      className={`
                        h-9 rounded-lg text-xs font-black transition-colors
                        ${
                    key === 'OK'
                      ? `
                        bg-[#2487B8] text-white
                        hover:bg-sos-primary-active
                      `
                      : key === 'C'
                        ? `
                          border border-rose-200 bg-rose-50 text-rose-700
                          hover:bg-rose-100
                        `
                        : `
                          border border-slate-200 bg-slate-50 text-slate-800
                          hover:bg-slate-100
                        `
                    }
                      `}
                    >
                      {key === 'C' ? t('scanManualClear') : key}
                    </button>
                  ))}
                </div>
                {manualMessage && (
                  <p className={`
                    text-[11px] font-semibold
                    ${manualMessage.tone === 'ok'
                    ? `text-emerald-700`
                    : `text-rose-600`}
                  `}
                  >
                    {manualMessage.text}
                  </p>
                )}
              </div>
            </div>
          </details>
        )}
      </div>

      <div className="
        grid grid-cols-1 gap-4
        lg:grid-cols-12 lg:items-start
      "
      >

        {/* ------------------------------------------------ LEFT: the scan */}
        <div className="
          space-y-4
          lg:col-span-7
        "
        >

          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`
                  size-2.5 rounded-full
                  ${scanningEnabled
      ? `bg-emerald-500`
      : `bg-amber-500`}
                  motion-safe:animate-pulse
                `}
                />
                <span className="
                  font-mono text-[11px] font-bold tracking-wider text-slate-500
                  uppercase
                "
                >
                  {scanningEnabled ? t('scanListenerTitle') : t('scanPreparing')}
                </span>
              </div>
              <Button
                type="button"
                variant={cameraEnabled ? 'outline' : 'secondary'}
                size="sm"
                className="h-8"
                onClick={() => setCameraEnabled(v => !v)}
              >
                {cameraEnabled
                  ? <CameraOff className="size-3.5" />
                  : (
                      <Camera className="size-3.5" />
                    )}
                {cameraEnabled ? t('scanCameraHide') : t('scanCameraShow')}
              </Button>
            </div>

            {/* The wedge field. Present, quiet, and never focused on a timer, so
                it cannot fight the keypad or the settings drawer for input. */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (wedgeInput.trim() && scanningEnabled) {
                  void processToken(wedgeInput.trim());
                }
                setWedgeInput('');
              }}
              className="space-y-2"
            >
              <label
                htmlFor="scan-wedge"
                className="text-[11px] font-medium text-slate-500"
              >
                {t('scanListenerHint')}
              </label>
              <Input
                id="scan-wedge"
                ref={wedgeRef}
                value={wedgeInput}
                onChange={e => setWedgeInput(e.target.value)}
                placeholder={t('scanListenerInputPlaceholder')}
                aria-label={t('scanListenerInputLabel')}
                autoComplete="off"
                disabled={!scanningEnabled}
                className="h-10 font-mono text-xs"
              />
            </form>

            {cameraEnabled && (
              <div className="
                relative aspect-video overflow-hidden rounded-xl border
                border-slate-800 bg-slate-950
              "
              >
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="size-full object-cover"
                />
                <div className="
                  pointer-events-none absolute inset-0 flex items-center
                  justify-center
                "
                >
                  <div className="
                    relative flex size-52 items-center justify-center rounded-xl
                    border-2 border-sos-signal/60
                  "
                  >
                    <div className="
                      absolute -top-0.5 -left-0.5 size-5 rounded-tl-lg
                      border-t-4 border-l-4 border-sos-signal
                    "
                    />
                    <div className="
                      absolute -top-0.5 -right-0.5 size-5 rounded-tr-lg
                      border-t-4 border-r-4 border-sos-signal
                    "
                    />
                    <div className="
                      absolute -bottom-0.5 -left-0.5 size-5 rounded-bl-lg
                      border-b-4 border-l-4 border-sos-signal
                    "
                    />
                    <div className="
                      absolute -right-0.5 -bottom-0.5 size-5 rounded-br-lg
                      border-r-4 border-b-4 border-sos-signal
                    "
                    />
                    <QrCode className="size-16 text-white/20" />
                    {!cameraReady && !cameraError && (
                      <span className="
                        absolute bottom-2 font-mono text-[11px] text-white/80
                      "
                      >
                        {t('scanProcessing')}
                      </span>
                    )}
                  </div>
                </div>
                <p className="
                  absolute inset-x-0 bottom-0 bg-slate-950/70 py-1.5 text-center
                  text-[11px] font-semibold text-white
                "
                >
                  {t('scanCameraAim')}
                </p>
                {cameraError && (
                  <div className="
                    absolute inset-0 flex flex-col items-center justify-center
                    gap-2 bg-slate-950/95 p-4 text-center
                  "
                  >
                    <CameraOff className="size-8 text-rose-500" />
                    <p className="
                      max-w-sm text-[11px] font-semibold text-rose-300
                    "
                    >
                      {cameraError}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        void startCamera();
                      }}
                    >
                      {t('retryBtn')}
                    </Button>
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="
                      h-7 border-white/20 bg-white/10 text-white
                      hover:bg-white/20
                    "
                    onClick={() => setCameraFacing(prev => (prev === 'environment' ? 'user' : 'environment'))}
                  >
                    <RefreshCw className="size-3" />
                    {cameraFacing === 'environment' ? t('rearCamera') : t('frontCamera')}
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* THE RESULT. Photo, name, class where the server gave us one, and the
              single line that says what happened. */}
          <Card className="space-y-4 p-5">
            <div className="
              flex items-center justify-between border-b border-slate-100 pb-2
            "
            >
              <h2 className="
                text-[11px] font-bold tracking-wider text-slate-500 uppercase
              "
              >
                {t('scanLastArrival')}
              </h2>
              {lastScan && (
                <span className="font-mono text-[11px] text-slate-400">
                  {timeOf(lastScan.at)}
                </span>
              )}
            </div>

            {!lastScan && (
              <p className="py-10 text-center text-xs font-medium text-slate-400">
                {t('waitingForFirstScans')}
              </p>
            )}

            {lastScan && (
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  {lastScan.studentImage && (
                    <img
                      src={lastScan.studentImage}
                      alt={t('scanPhotoAlt', { name: lastScan.studentName })}
                      className="size-16 shrink-0 rounded-xl object-cover"
                    />
                  )}
                  {!lastScan.studentImage && (
                    <span className="
                      flex size-16 shrink-0 items-center justify-center
                      rounded-xl bg-sos-canvas text-sos-muted
                    "
                    >
                      <UserRound className="size-7" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="
                      truncate text-lg font-black tracking-tight text-[#16212B]
                    "
                    >
                      {lastScan.studentName}
                    </p>
                    {lastScan.className && (
                      <p className="text-xs font-bold text-[#2487B8]">
                        {lastScan.className}
                      </p>
                    )}
                  </div>
                </div>

                <div className={`
                  flex items-center gap-3 rounded-xl border px-4 py-3
                  ${OUTCOME_BOX[outcomeTone(lastScan.outcome)]}
                `}
                >
                  <OutcomeIcon outcome={lastScan.outcome} />
                  <p className="text-sm font-extrabold">{arrivalLine(lastScan)}</p>
                </div>

                {/* The lesson is shown because the SERVER resolved it, and it is
                    labelled as informational: the badge did not mark anyone present. */}
                {lastScan.lesson?.subject && (
                  <div className="
                    space-y-1 rounded-xl border border-slate-200
                    bg-sos-surface-sunken px-3 py-2
                  "
                  >
                    <p className="text-xs font-semibold text-slate-700">
                      {t('scanLessonNow', {
                        subject: lastScan.lesson.subject,
                        start: lastScan.lesson.startTime ?? '--:--',
                        end: lastScan.lesson.endTime ?? '--:--',
                      })}
                    </p>
                    <p className="text-[11px] text-slate-500">{t('scanLessonTeacherOwns')}</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* ------------------------------------- RIGHT: counters and journal */}
        <div className="
          space-y-4
          lg:col-span-5
        "
        >

          <section className="
            rounded-xl border border-slate-200 bg-white p-4 shadow-2xs
          "
          >
            <h2 className="
              mb-3 flex items-center gap-1.5 text-[11px] font-bold
              tracking-wider text-slate-500 uppercase
            "
            >
              <ScanLine className="size-3.5 text-[#2487B8]" />
              {' '}
              {t('scanScopeTerminal')}
            </h2>
            <div className="
              grid grid-cols-2 gap-3
              sm:grid-cols-4
            "
            >
              <div>
                <p className="
                  text-[10px] font-bold tracking-wider text-slate-400 uppercase
                "
                >
                  {t('scanCountArrivals')}
                </p>
                <p className="font-mono text-2xl font-black text-emerald-600">{terminalCounts.accepted}</p>
              </div>
              <div>
                <p className="
                  text-[10px] font-bold tracking-wider text-slate-400 uppercase
                "
                >
                  {t('scanCountLate')}
                </p>
                <p className="font-mono text-2xl font-black text-amber-500">{terminalCounts.late}</p>
              </div>
              <div>
                <p className="
                  text-[10px] font-bold tracking-wider text-slate-400 uppercase
                "
                >
                  {t('scanCountRejected')}
                </p>
                <p className="font-mono text-2xl font-black text-rose-600">{terminalCounts.rejected}</p>
              </div>
              <div>
                <p className="
                  text-[10px] font-bold tracking-wider text-slate-400 uppercase
                "
                >
                  {t('scanCountScans')}
                </p>
                <p className="font-mono text-2xl font-black text-[#16212B]">{terminalCounts.total}</p>
              </div>
            </div>
            {journalCapped && <p className="mt-2 text-[11px] text-slate-500">{t('scanJournalCapNotice')}</p>}

            {/* Classroom only, and both numbers share one scope: this lesson's
                scans over this lesson's roster. */}
            {target?.mode === 'classroom' && rosterCount !== null && rosterCount > 0 && (
              <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-slate-600">{t('scanRollCallTitle')}</span>
                  <span className="font-mono text-[#2487B8]">
                    {terminalCounts.accepted}
                    {' '}
                    /
                    {' '}
                    {rosterCount}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={rollCallPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={t('scanRollCallTitle')}
                  className="
                    h-1.5 w-full overflow-hidden rounded-full bg-slate-100
                  "
                >
                  <div
                    className="
                      h-full rounded-full bg-[#2487B8] transition-[width]
                      duration-500 ease-out
                    "
                    style={{ width: `${rollCallPercent}%` }}
                  />
                </div>
              </div>
            )}
          </section>

          <section className="
            rounded-xl border border-slate-200 bg-white p-4 shadow-2xs
          "
          >
            <h2 className="
              mb-3 flex items-center gap-1.5 text-[11px] font-bold
              tracking-wider text-slate-500 uppercase
            "
            >
              <ShieldCheck className="size-3.5 text-slate-400" />
              {' '}
              {t('scanScopeAll')}
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="
                  text-[10px] font-bold tracking-wider text-slate-400 uppercase
                "
                >
                  {t('scanCountArrivals')}
                </p>
                <p className="font-mono text-xl font-black text-[#16212B]">{campusCounters?.accepted ?? '—'}</p>
              </div>
              <div>
                <p className="
                  text-[10px] font-bold tracking-wider text-slate-400 uppercase
                "
                >
                  {t('scanCountRejected')}
                </p>
                <p className="font-mono text-xl font-black text-[#16212B]">{campusCounters?.rejected ?? '—'}</p>
              </div>
              <div>
                <p className="
                  text-[10px] font-bold tracking-wider text-slate-400 uppercase
                "
                >
                  {t('scanCountScans')}
                </p>
                <p className="font-mono text-xl font-black text-[#16212B]">{campusTotal ?? '—'}</p>
              </div>
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="
                text-[10px] font-bold tracking-wider text-slate-400 uppercase
              "
              >
                {t('headcountOnSite')}
              </p>
              {headcount
                ? (
                    <>
                      <p className="font-mono text-xl font-black text-[#16212B]">{headcount.headcount}</p>
                      <p className="text-[11px] text-slate-500">
                        {t('scanCampusDetail', { confirmed: headcount.confirmedArrivals, manual: headcount.manualUnverified })}
                      </p>
                    </>
                  )
                : (
                    <p className="text-[11px] text-slate-500">{t('scanCampusUnavailable')}</p>
                  )}
            </div>
          </section>

          <Card className="space-y-3 p-4">
            <div className="
              flex items-center justify-between border-b border-slate-100 pb-2
            "
            >
              <h2 className="
                flex items-center gap-1.5 text-[11px] font-bold tracking-wider
                text-slate-500 uppercase
              "
              >
                <History className="size-3.5 text-[#2487B8]" />
                {' '}
                {t('scanJournalTitle')}
              </h2>
              <span className="font-mono text-[10px] text-slate-400">{journal.length}</span>
            </div>

            <div className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
              {journal.map(entry => (
                <div
                  key={entry.id}
                  className="
                    flex items-center justify-between gap-2 rounded-lg border
                    border-slate-100 bg-sos-surface-sunken px-3 py-2 text-xs
                  "
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[#16212B]">{entry.studentName}</p>
                    <p className="font-mono text-[10px] text-slate-500">{timeOf(entry.at)}</p>
                  </div>
                  <Badge
                    variant={entry.outcome === 'rejected' ? 'danger' : entry.outcome === 'late' ? 'warning' : 'success'}
                    className="shrink-0"
                  >
                    {entry.outcome === 'rejected'
                      ? t('scanEventRejected')
                      : entry.outcome === 'late'
                        ? t('scanEventLate')
                        : t('scanEventArrived')}
                  </Badge>
                </div>
              ))}
              {journal.length === 0 && (
                <p className="py-8 text-center text-xs text-slate-400">{t('scanJournalEmpty')}</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
