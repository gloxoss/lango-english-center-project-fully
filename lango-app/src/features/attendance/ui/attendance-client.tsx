'use client';

import type {
  AttendanceStatus,
} from '../data/attendance-config';
// The window rule, imported rather than restated. This component runs in the
// browser, which is why the rule lives in a database-free module (see
// libs/attendance/register-window.ts) and not in session-occurrence.ts.
import type { RegisterWindow } from '@/libs/attendance/register-window';
import jsQR from 'jsqr';
import {
  AlertTriangle,
  Camera,
  CameraOff,
  Check,
  CheckCheck,
  CheckCircle2,
  CheckSquare,
  Download,
  Loader2,
  Lock,
  PencilLine,
  QrCode,
  RefreshCw,
  Save,
  ScanLine,
  Search,
  ShieldAlert,
  Unlock,
  Users,
  XCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  REGISTER_OPENS_BEFORE_MINUTES,
  registerWindow,
} from '@/libs/attendance/register-window';
import { exportToCsv } from '@/libs/csv-export';
import { casablancaTodayIso } from '@/libs/finance/today';
import {
  STATUS_OPTIONS,
} from '../data/attendance-config';

type ClassOption = {
  id: string;
  classId?: string;
  name: string;
};

type SubjectOption = {
  id: string;
  name: string;
};

type RosterStudent = {
  id: string;
  name: string;
  avatar: string;
  matricule: string;
  attendanceRate: number | null;
};

type RegisterInfo = {
  id: string;
  reference: string;
  status: 'LOCKED' | 'REOPENED';
  submittedAt: string | null;
  submittedById: string | null;
  submittedByName: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
  correctionNote: string | null;
};

/**
 * Roll call for ONE lesson.
 *
 * `session` names the exact scheduled occurrence the caller opened from Appel du
 * jour. When present the class/subject/period fields are hidden and the context
 * is resolved from the timetable, so the admin cannot mark a different lesson
 * than the one they clicked — and never re-picks a "Période 1–8" by hand.
 */
export type AttendanceSessionContext = {
  slotId: string;
  date: string;
};

// The times of the occurrence the register is open on. Kept as the EFFECTIVE
// start/end the server resolved, so a lesson moved by a session exception is
// judged on the time it actually happens.
type OccurrenceTimes = { startTime: string; endTime: string };

/** One row of `GET /api/attendance/qr/scanner-sessions/<id>/events`. */
type ScanEventRow = {
  id: string;
  scannedAt: string;
  resultStatus: 'accepted' | 'rejected' | 'already_scanned';
  rejectionReason: string | null;
  stagedStatus: 'present' | 'late' | null;
  studentId: string | null;
  studentName: string | null;
};

/** A badge the server refused. The message names the student when it knows them. */
type ScanRefusal = { code: string; message: string; at: string };

// Casablanca wall clock, not the browser's: `scannedAt` is a UTC instant and the
// occurrence carries a school-local "HH:MM". Comparing them in the browser's own
// zone would misreport every arrival outside Morocco.
const CASABLANCA_HM = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Casablanca',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function minutesOfHm(hm: string): number {
  const [hours, minutes] = hm.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function casablancaMinutesOf(iso: string): number {
  const instant = new Date(iso);
  return Number.isNaN(instant.getTime()) ? 0 : minutesOfHm(CASABLANCA_HM.format(instant));
}

/**
 * How late a scan is, in minutes past the lesson's own start.
 *
 * WHETHER it counts as late is not decided here: the server already set
 * `stagedStatus` with the tenant's `attendance.lateGraceMinutes` applied, and
 * that verdict is what the row shows. This number is only the size of the delay,
 * which the teacher needs and the status alone cannot express.
 */
function scannedLateMinutes(scan: ScanEventRow, startTime: string): number {
  return Math.max(0, casablancaMinutesOf(scan.scannedAt) - minutesOfHm(startTime));
}

type RosterGroup = {
  key: 'scanned' | 'late' | 'missing' | null;
  label: string | null;
  students: RosterStudent[];
};

export function AttendanceClient({
  locale = 'fr',
  session,
  initialMode,
}: { locale?: string; session?: AttendanceSessionContext; initialMode?: 'scan' | 'manual' } = {}) {
  const t = useTranslations('Attendance');
  const tCommon = useTranslations('Common');
  const tStatus = useTranslations('Status');
  const tStudents = useTranslations('Students');

  // Options loaded from real DB
  const [classesList, setClassesList] = useState<ClassOption[]>([]);
  const [subjectsList, setSubjectsList] = useState<SubjectOption[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(true);

  // Form selection states
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('1');
  const [selectedDate, setSelectedDate] = useState<string>(() => casablancaTodayIso());

  // Roster & Attendance states
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [lateMinutes, setLateMinutes] = useState<Record<string, string>>({});

  // Register & Role state
  const [register, setRegister] = useState<RegisterInfo | null>(null);
  const [academicSession, setAcademicSession] = useState<{ id: string; name: string } | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [correctionNote, setCorrectionNote] = useState('');
  const [reopening, setReopening] = useState(false);

  // Status & UI
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sessionLabel, setSessionLabel] = useState<string | null>(null);

  // ── Badge scanning (fix-plan-02 A) ────────────────────────────────────────
  // A scan never writes a mark. It stages an arrival against a scanner session
  // bound to THIS occurrence; the roll-call submission below writes the marks,
  // and closing the session is what links the two. Manual marking therefore
  // works exactly as it always did, with scanning switched off.
  const [occurrence, setOccurrence] = useState<OccurrenceTimes | null>(null);
  const [nowIso, setNowIso] = useState(() => new Date().toISOString());
  const [scanSessionId, setScanSessionId] = useState<string | null>(null);
  const [scanSessionChecked, setScanSessionChecked] = useState(false);
  const [scanSessionBusy, setScanSessionBusy] = useState(false);
  const [scanSessionError, setScanSessionError] = useState<string | null>(null);
  const [scanEvents, setScanEvents] = useState<ScanEventRow[]>([]);
  const [refusals, setRefusals] = useState<ScanRefusal[]>([]);
  const [arrivals, setArrivals] = useState<Record<string, string | null>>({});
  const [flashStudentId, setFlashStudentId] = useState<string | null>(null);
  const [linkedCount, setLinkedCount] = useState<number | null>(null);
  const [manualMarks, setManualMarks] = useState<Record<string, true>>({});
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanBusy, setScanBusy] = useState(false);

  const scanSessionIdRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningLoopRef = useRef(false);
  const lastScannedTokenRef = useRef<{ token: string; time: number } | null>(null);
  // Which students the teacher has touched by hand, and which already had a saved
  // mark when the roster loaded. Both are "do not overwrite" flags for the scan
  // defaults: reviewing the list must not be undone by the next poll.
  const touchedRef = useRef<Record<string, true>>({});
  const savedMarksRef = useRef<Record<string, true>>({});

  // Re-read the clock so "Activer le scan" appears and retires on its own. No
  // scheduler exists anywhere in this app, and nothing is ever auto-submitted:
  // this only re-evaluates which controls are offered.
  useEffect(() => {
    const timer = setInterval(() => setNowIso(new Date().toISOString()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // `null` until the occurrence is known — never a fabricated "OPEN".
  const windowState: RegisterWindow | null = useMemo(
    () => (occurrence && session
      ? registerWindow(occurrence, session.date, new Date(nowIso))
      : null),
    [occurrence, session, nowIso],
  );

  // A session-scoped open resolves its own context from the timetable, so the
  // class/subject/period fields stay hidden and cannot be re-picked. Marking the
  // wrong lesson is therefore not reachable by mis-selecting a dropdown.
  useEffect(() => {
    if (!session) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/attendance/day?date=${encodeURIComponent(session.date)}`);
        const json = await res.json();
        const match = (json?.data?.sessions ?? []).find((s: { slotId: string }) => s.slotId === session.slotId);
        if (cancelled || !match) {
          return;
        }
        setSelectedDate(session.date);
        setSelectedClass(match.classSectionId);
        // Deliberately NOT the session's subject id. `attendance.subject_id`
        // still carries a foreign key to the legacy `courses` table, while the
        // timetable gives a modern `subjects.id`; sending the latter fails the
        // insert outright (attendance_subject_id_courses_id_fk). The lesson's
        // identity for the register is section + date + period, and the subject
        // is already shown on the card, so the filter stays open.
        setSelectedSubject('all');
        setSelectedPeriod(String(match.period));
        // The EFFECTIVE times. A lesson moved by a session exception is already
        // reflected here, so the register window and the lateness of a scan are
        // both measured against the time the lesson actually happens.
        if (typeof match.startTime === 'string' && typeof match.endTime === 'string') {
          setOccurrence({ startTime: match.startTime, endTime: match.endTime });
        }
        setSessionLabel([match.subjectName, match.className, match.sectionName].filter(Boolean).join(' · '));
      } catch {
        // Fall through: the grid keeps its defaults and the admin can still pick.
      }
    })();
    return () => { cancelled = true; };
  }, [session]);

  // Fetch logged in user role
  useEffect(() => {
    let isMounted = true;
    async function fetchRole() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.user?.role && isMounted) {
            setUserRole(json.user.role);
          }
        }
      } catch {
        // fallback silent
      }
    }
    void fetchRole();
    return () => {
      isMounted = false;
    };
  }, []);

  // 1. Initial metadata loading (Classes/Sections & Subjects from DB)
  useEffect(() => {
    let isMounted = true;
    async function loadMeta() {
      setLoadingMetadata(true);
      try {
        const [secRes, subjRes] = await Promise.all([
          fetch('/api/academics/class-sections?pageSize=100'),
          fetch('/api/academics/class-subjects?pageSize=100'),
        ]);

        let classOpts: ClassOption[] = [];
        if (secRes.ok) {
          const secJson = await secRes.json();
          if (secJson.success && Array.isArray(secJson.data) && secJson.data.length > 0) {
            classOpts = secJson.data.map((s: any) => ({
              id: s.id,
              classId: s.classId,
              name: s.sectionName ? `${s.className} — ${s.sectionName}` : s.className,
            }));
          }
        }

        let subjOpts: SubjectOption[] = [];
        if (subjRes.ok) {
          const subjJson = await subjRes.json();
          if (subjJson.success && Array.isArray(subjJson.data)) {
            subjOpts = subjJson.data.map((s: any) => ({
              id: s.id,
              name: s.subjectName || s.name,
            }));
          }
        }

        if (isMounted) {
          setClassesList(classOpts);
          setSubjectsList(subjOpts);
          // Never default the section when the lesson is already known. This
          // effect has [] deps, so it closes over the initial empty
          // `selectedClass` and would otherwise overwrite the section the
          // session resolved — posting one section's id with another section's
          // students, which the API refuses as WRONG_CLASS.
          if (classOpts.length > 0 && !selectedClass && !session) {
            setSelectedClass(classOpts[0]!.id);
          }
        }
      } catch (err: any) {
        console.error('Error loading attendance metadata', err);
        if (isMounted) {
          setError(err?.message || 'Erreur lors du chargement des classes.');
        }
      } finally {
        if (isMounted) {
          setLoadingMetadata(false);
        }
      }
    }

    loadMeta();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Load students roster, existing attendance & register lock status
  const loadRosterAndAttendance = useCallback(async () => {
    if (!selectedClass) {
      return;
    }
    setLoadingRoster(true);
    setError(null);
    setSaved(false);

    try {
      let studentRows: any[] = [];
      const stdRes = await fetch(`/api/students?classSectionId=${selectedClass}&pageSize=200`);
      if (stdRes.ok) {
        const stdJson = await stdRes.json();
        if (stdJson.success && Array.isArray(stdJson.data)) {
          studentRows = stdJson.data;
        }
      }

      const formattedStudents: RosterStudent[] = studentRows.map((s: any) => ({
        id: s.id,
        name: s.fullName || s.name || 'Élève',
        avatar: (s.fullName || s.name || 'EL').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
        matricule: s.matricule || '—',
        attendanceRate: typeof s.attendanceRate === 'number' ? s.attendanceRate : null,
      }));

      // CANONICAL RATES (Phase 7B): one bounded batch call to the summary
      // cache. NULL stays NULL and renders as "—" — never a fabricated 100%.
      if (formattedStudents.length > 0) {
        try {
          const ids = formattedStudents.map(st => st.id).join(',');
          const sumRes = await fetch(`/api/attendance/summary?studentIds=${encodeURIComponent(ids)}`);
          if (sumRes.ok) {
            const sumJson = await sumRes.json();
            const rateById = new Map<string, number | null>();
            for (const row of (sumJson.data ?? [])) {
              rateById.set(row.studentId, row.attendanceRate != null ? Number(row.attendanceRate) : null);
            }
            for (const st of formattedStudents) {
              if (rateById.has(st.id)) {
                st.attendanceRate = rateById.get(st.id) ?? null;
              }
            }
          }
        } catch {
          // Rate column degrades to "—"; attendance marking is unaffected.
        }
      }

      // Query existing saved attendance for this date, class section, period and subject
      const subjectQuery = selectedSubject && selectedSubject !== 'all' ? `&subjectId=${selectedSubject}` : '';
      const [attRes, regRes] = await Promise.all([
        fetch(`/api/attendance?date=${selectedDate}&classId=${selectedClass}&period=${selectedPeriod}${subjectQuery}`),
        fetch(`/api/attendance/registers?classId=${selectedClass}&date=${selectedDate}&period=${selectedPeriod}`),
      ]);

      const loadedStatuses: Record<string, AttendanceStatus> = {};
      const loadedNotes: Record<string, string> = {};
      const loadedLate: Record<string, string> = {};

      if (attRes.ok) {
        const attJson = await attRes.json();
        if (attJson.success && Array.isArray(attJson.data)) {
          for (const rec of attJson.data) {
            if (rec.studentId) {
              loadedStatuses[rec.studentId] = rec.status as AttendanceStatus;
              if (rec.note) {
                loadedNotes[rec.studentId] = rec.note;
              }
              if (rec.lateMinutes != null) {
                loadedLate[rec.studentId] = String(rec.lateMinutes);
              }
            }
          }
        }
        // Date-derived academic session (read-only context for the operator).
        setAcademicSession(attJson.session ?? null);
      }

      if (regRes.ok) {
        const regJson = await regRes.json();
        if (regJson.success) {
          setRegister(regJson.data ?? null);
          if (regJson.data?.correctionNote) {
            setCorrectionNote(regJson.data.correctionNote);
          } else {
            setCorrectionNote('');
          }
        }
      } else {
        setRegister(null);
      }

      // A mark that came BACK from the API is a real, saved mark — scanned
      // defaults must never talk over it. Captured before the default fill below.
      const savedIds: Record<string, true> = {};
      for (const id of Object.keys(loadedStatuses)) {
        savedIds[id] = true;
      }
      savedMarksRef.current = savedIds;
      // A fresh roster is a fresh review: every hand-made change belonged to the
      // previous load.
      touchedRef.current = {};

      // In manual mode, do not pre-fill all uncommitted rows with 'present'.
      // If the register was already saved or locked, keep the saved mark.
      // In scan mode, unscanned students default to absent.
      if (scanListEngaged) {
        for (const st of formattedStudents) {
          if (!loadedStatuses[st.id]) {
            const scan = acceptedByStudent.get(st.id);
            loadedStatuses[st.id] = scan ? (scan.stagedStatus === 'late' ? 'late' : 'present') : 'absent';
          }
        }
      }

      setRoster(formattedStudents);
      setStatuses(loadedStatuses);
      setNotes(loadedNotes);
      setLateMinutes(loadedLate);
    } catch (err: any) {
      console.error('Error loading roster and attendance', err);
      setError(err?.message || 'Erreur lors du chargement des élèves.');
    } finally {
      setLoadingRoster(false);
    }
  }, [selectedClass, selectedDate, selectedPeriod, selectedSubject]);

  useEffect(() => {
    loadRosterAndAttendance();
  }, [loadRosterAndAttendance]);

  // ── Badge scanning ────────────────────────────────────────────────────────
  // A student badges in at a room terminal or on the teacher's phone. The scan
  // only STAGES an arrival: it writes no mark, and `stagedStatus` from the API
  // is the server's own present/late verdict (the tenant's grace setting already
  // applied). The roll-call submission below is what writes the marks, and
  // closing the session links the two.

  /**
   * Arrivals, newest first, keyed by student. A student can only have one
   * ACCEPTED scan per session — the route refuses a second — so this is a
   * partition of the roster rather than a list of attempts. A refusal and a
   * repeat (`already_scanned`) are not arrivals and never reach this map.
   */
  const acceptedByStudent = useMemo(() => {
    const byStudent = new Map<string, ScanEventRow>();
    for (const event of scanEvents) {
      if (event.resultStatus !== 'accepted' || !event.studentId) {
        continue;
      }
      if (!byStudent.has(event.studentId)) {
        byStudent.set(event.studentId, event);
      }
    }
    return byStudent;
  }, [scanEvents]);

  const acceptedCount = acceptedByStudent.size;
  const scanListEngaged = scanSessionId !== null || acceptedCount > 0;
  const lastAccepted = scanEvents.find(event => event.resultStatus === 'accepted') ?? null;

  const fetchScanEvents = useCallback(async (sessionId?: string) => {
    const id = sessionId ?? scanSessionIdRef.current;
    if (!id) {
      return;
    }
    try {
      const res = await fetch(`/api/attendance/qr/scanner-sessions/${id}/events`);
      const json = await res.json();
      if (res.ok && json.success && Array.isArray(json.data)) {
        setScanEvents(json.data as ScanEventRow[]);
      }
    } catch {
      // A dropped poll is not a lost scan: the list keeps what it last read.
    }
  }, []);

  // Reattach, never re-open. A reload mid-lesson must find the session that is
  // already collecting arrivals instead of splitting the count in two.
  useEffect(() => {
    if (!session) {
      return;
    }
    let cancelled = false;
    setScanSessionChecked(false);
    void (async () => {
      try {
        const res = await fetch(
          `/api/attendance/qr/scanner-sessions?slotId=${encodeURIComponent(session.slotId)}&date=${encodeURIComponent(session.date)}`,
        );
        const json = await res.json();
        if (cancelled) {
          return;
        }
        const id = json?.success && json.data?.id ? String(json.data.id) : null;
        scanSessionIdRef.current = id;
        setScanSessionId(id);
        if (id) {
          setCameraOn(true);
          await fetchScanEvents(id);
        }
      } catch {
        // No session found is a normal answer here, not an error.
        if (!cancelled) {
          scanSessionIdRef.current = null;
          setScanSessionId(null);
        }
      } finally {
        if (!cancelled) {
          setScanSessionChecked(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, fetchScanEvents]);

  useEffect(() => {
    if (!scanSessionId) {
      return;
    }
    const timer = setInterval(() => {
      void fetchScanEvents();
    }, 5000);
    return () => clearInterval(timer);
  }, [scanSessionId, fetchScanEvents]);

  // The campus arrival feed. It answers ONE question a teacher cannot answer from
  // the register alone: is this student absent from MY lesson, or not in the
  // building at all? A student missing from this list has NO RECORDED ARRIVAL —
  // that is not a claim that they are away, and nothing is derived from it.
  const loadArrivals = useCallback(async () => {
    if (!selectedClass) {
      setArrivals({});
      return;
    }
    try {
      const res = await fetch(`/api/attendance/onsite?classSectionId=${encodeURIComponent(selectedClass)}`);
      const json = await res.json();
      if (!json?.success) {
        return;
      }
      const map: Record<string, string | null> = {};
      for (const row of (json.data?.students ?? []) as { studentId?: string; arrivedAt?: string | null }[]) {
        if (row?.studentId) {
          map[row.studentId] = row.arrivedAt ?? null;
        }
      }
      setArrivals(map);
    } catch {
      // The line is a hint on a row; losing it must not disturb the register.
    }
  }, [selectedClass]);

  useEffect(() => {
    if (!session) {
      return;
    }
    void loadArrivals();
    const timer = setInterval(() => {
      void loadArrivals();
    }, 30_000);
    return () => clearInterval(timer);
  }, [session, loadArrivals]);

  // Scan results seed the register. They are DEFAULTS, never overrides: a mark
  // the teacher changed by hand and a mark that came back from the API both win,
  // so reviewing the list is not undone by the next poll.
  useEffect(() => {
    // A locked register is the submitted record: arrivals may still be listed,
    // but they must never repaint what was already written and locked.
    if (!scanListEngaged || roster.length === 0 || register?.status === 'LOCKED') {
      return;
    }
    const nextStatuses = { ...statuses };
    const nextLate = { ...lateMinutes };
    let changed = false;

    for (const student of roster) {
      if (touchedRef.current[student.id] || savedMarksRef.current[student.id]) {
        continue;
      }
      const scan = acceptedByStudent.get(student.id);
      // No scan means absent from THIS lesson. It is deliberately not an
      // absence from the school day — see the arrivals line on the row for that.
      const target: AttendanceStatus = scan
        ? (scan.stagedStatus === 'late' ? 'late' : 'present')
        : 'absent';
      if (nextStatuses[student.id] !== target) {
        nextStatuses[student.id] = target;
        changed = true;
      }
      if (scan?.stagedStatus === 'late' && occurrence && !nextLate[student.id]) {
        nextLate[student.id] = String(scannedLateMinutes(scan, occurrence.startTime));
        changed = true;
      }
    }

    if (!changed) {
      return;
    }
    setStatuses(nextStatuses);
    setLateMinutes(nextLate);
  }, [scanListEngaged, roster, acceptedByStudent, occurrence, statuses, lateMinutes, register?.status]);

  const flashStudent = useCallback((studentId: string) => {
    setFlashStudentId(studentId);
    setTimeout(() => {
      setFlashStudentId(current => (current === studentId ? null : current));
    }, 1800);
  }, []);

  const scanBusyRef = useRef(false);
  const processTokenRef = useRef<(token: string) => Promise<void>>(async () => {});

  const processToken = useCallback(async (token: string) => {
    const trimmed = token.trim();
    const sessionId = scanSessionIdRef.current;
    if (!trimmed || !sessionId || scanBusyRef.current) {
      return;
    }

    // The decode loop reads the same badge many times a second. A badge the
    // teacher deliberately presents again after the debounce still reaches the
    // server, and comes back as `already_scanned`.
    const now = Date.now();
    const previous = lastScannedTokenRef.current;
    if (previous && previous.token === trimmed && now - previous.time < 3000) {
      return;
    }
    lastScannedTokenRef.current = { token: trimmed, time: now };

    scanBusyRef.current = true;
    setScanBusy(true);
    try {
      const res = await fetch('/api/attendance/qr/verify-and-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawToken: trimmed, sessionId }),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        const studentId = json.data?.student?.id ? String(json.data.student.id) : null;
        // `already_scanned` adds no row: the arrival is already there, so the row
        // that exists is flashed instead.
        if (studentId) {
          flashStudent(studentId);
        }
        await fetchScanEvents(sessionId);
        void loadArrivals();
      } else {
        // NEVER swallowed. `WRONG_CLASS` arrives with the student's own name in
        // the message, and the teacher is the only person who can act on it.
        const code = String(json?.error?.code || 'SCAN_REFUSED');
        const message = String(json?.error?.message || json?.message || t('badgeNotRecognizedClass'));
        setRefusals(history => [{ code, message, at: new Date().toISOString() }, ...history].slice(0, 8));
      }
    } catch {
      setRefusals(history => [
        { code: 'NETWORK', message: t('serverUnreachable'), at: new Date().toISOString() },
        ...history,
      ].slice(0, 8));
    } finally {
      scanBusyRef.current = false;
      setScanBusy(false);
    }
  }, [fetchScanEvents, flashStudent, loadArrivals, t]);

  useEffect(() => {
    processTokenRef.current = processToken;
  }, [processToken]);

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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      scanningLoopRef.current = true;
      setCameraReady(true);

      // BarcodeDetector is the fast native path (Chromium / Android / iOS 17+)
      // and does not exist at all on desktop browsers, where the camera opens,
      // the video plays and nothing is ever read. jsQR decodes from a canvas and
      // backs it up. The gate terminal uses the same two paths, so both screens
      // read a badge identically.
      let nativeDetector: { detect: (source: HTMLVideoElement) => Promise<{ rawValue?: string }[]> } | null = null;
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          nativeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        } catch {
          nativeDetector = null;
        }
      }

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });

      const scanFrame = async () => {
        if (!scanningLoopRef.current || !videoRef.current) {
          return;
        }
        const video = videoRef.current;
        try {
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            if (nativeDetector) {
              const barcodes = await nativeDetector.detect(video);
              if (barcodes.length > 0 && barcodes[0]?.rawValue) {
                void processTokenRef.current(barcodes[0].rawValue);
              }
            } else if (context) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              context.drawImage(video, 0, 0, canvas.width, canvas.height);
              const frame = context.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(frame.data, frame.width, frame.height);
              if (code?.data) {
                void processTokenRef.current(code.data);
              }
            }
          }
        } catch {
          // A dropped frame is not a failed scan; keep reading.
        }
        if (scanningLoopRef.current) {
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
      setCameraError(t('cameraPermissionError'));
    }
  }, [stopCamera, t]);

  // The camera only ever runs while the window is OPEN and a session exists.
  useEffect(() => {
    if (cameraOn && windowState === 'OPEN' && scanSessionId) {
      void startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [cameraOn, windowState, scanSessionId, startCamera, stopCamera]);

  const activateScan = useCallback(async () => {
    if (!session) {
      return;
    }
    setScanSessionBusy(true);
    setScanSessionError(null);
    try {
      const res = await fetch('/api/attendance/qr/scanner-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId: session.slotId, date: session.date }),
      });
      const json = await res.json();
      if (!res.ok || !json.success || !json.data?.id) {
        setScanSessionError(String(json?.error?.message || t('sessionStartError')));
        return;
      }
      const id = String(json.data.id);
      scanSessionIdRef.current = id;
      setScanSessionId(id);
      setRefusals([]);
      setLinkedCount(null);
      setCameraOn(true);
      void fetchScanEvents(id);
    } catch {
      setScanSessionError(t('sessionNetworkError'));
    } finally {
      setScanSessionBusy(false);
    }
  }, [session, fetchScanEvents, t]);

  // Closing is what LINKS the staged arrivals to the marks just written. It
  // happens only after a successful submission, never on a timer: nothing in
  // this app runs on a schedule, and nothing is ever submitted automatically.
  const closeScanSession = useCallback(async (): Promise<number | null> => {
    const id = scanSessionIdRef.current;
    if (!id) {
      return null;
    }
    try {
      const res = await fetch(`/api/attendance/qr/scanner-sessions/${id}/close`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setScanSessionError(String(json?.error?.message || t('scanCloseError')));
        return null;
      }
      scanSessionIdRef.current = null;
      setScanSessionId(null);
      setCameraOn(false);
      setScanEvents([]);
      return typeof json.linked === 'number' ? json.linked : 0;
    } catch {
      setScanSessionError(t('sessionNetworkError'));
      return null;
    }
  }, [t]);

  const deactivateScan = useCallback(async () => {
    const id = scanSessionIdRef.current;
    if (!id) {
      return;
    }
    await closeScanSession();
  }, [closeScanSession]);

  const autoActivatedRef = useRef(false);
  useEffect(() => {
    if (
      initialMode === 'scan'
      && session
      && windowState === 'OPEN'
      && !scanSessionId
      && scanSessionChecked
      && !scanSessionBusy
      && !autoActivatedRef.current
    ) {
      autoActivatedRef.current = true;
      void activateScan();
    }
  }, [initialMode, session, windowState, scanSessionId, scanSessionChecked, scanSessionBusy, activateScan]);

  const handleStatusChange = (id: string, status: AttendanceStatus) => {
    if (register?.status === 'LOCKED') {
      return;
    }
    // A hand-made decision. The scan defaults must not talk over it on the next
    // poll, so the student is flagged as reviewed.
    touchedRef.current[id] = true;
    setStatuses(prev => ({ ...prev, [id]: status }));
    setSaved(false);
  };

  /**
   * "Badge oublié" — the student is here but never badged in. Recorded as an
   * ordinary manual mark, NOT as a scan: no scan event is written, and the row
   * is tagged so the register never claims evidence it does not have.
   */
  const markPresentWithoutBadge = (id: string) => {
    if (register?.status === 'LOCKED') {
      return;
    }
    touchedRef.current[id] = true;
    setManualMarks(prev => ({ ...prev, [id]: true }));
    setStatuses(prev => ({ ...prev, [id]: 'present' }));
    setSaved(false);
  };

  const markAll = (status: AttendanceStatus) => {
    if (register?.status === 'LOCKED') {
      return;
    }
    const updated: Record<string, AttendanceStatus> = {};
    for (const s of roster) {
      updated[s.id] = status;
      touchedRef.current[s.id] = true;
    }
    setStatuses(updated);
    setSaved(false);
  };

  // Reopening locked register (for school_admin / super_admin)
  const handleReopenRegister = async () => {
    if (!register) {
      return;
    }
    const reason = window.prompt(t('reopenReasonPrompt'));
    if (!reason || reason.trim().length < 3) {
      return;
    }

    setReopening(true);
    setError(null);
    try {
      const res = await fetch('/api/attendance/registers/reopen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registerId: register.id, reason: reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || 'Échec de la réouverture du registre.');
      }
      await loadRosterAndAttendance();
    } catch (err: any) {
      setError(err.message || 'Échec de la réouverture.');
    } finally {
      setReopening(false);
    }
  };

  // 3. Real persistence via POST /api/attendance
  // Returns whether the marks were written. The session close that follows a
  // validation depends on it: linking staged arrivals to marks that do not exist
  // would be worse than not linking at all.
  const handleSave = async (): Promise<boolean> => {
    if (roster.length === 0) {
      return false;
    }

    if (register?.status === 'LOCKED') {
      setError(t('registerLockedNotice', { reference: register.reference }));
      return false;
    }

    if (register?.status === 'REOPENED' && !correctionNote.trim()) {
      setError(t('correctionNoteRequired'));
      return false;
    }

    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      // AUTHORITATIVE CONTEXT (P0): the API operates on the class SECTION id —
      // sending the parent class id is refused, never downgraded.
      const payload = {
        date: selectedDate,
        studentGroupId: selectedClass || undefined,
        subjectId: selectedSubject && selectedSubject !== 'all' ? selectedSubject : undefined,
        period: Number.parseInt(selectedPeriod, 10) || 1,
        correctionNote: register?.status === 'REOPENED' ? correctionNote.trim() : undefined,
        records: roster.map(s => ({
          studentId: s.id,
          status: statuses[s.id] || 'present',
          note: notes[s.id]?.trim() || undefined,
          lateMinutes: statuses[s.id] === 'late' && lateMinutes[s.id] ? Number.parseInt(lateMinutes[s.id]!, 10) : undefined,
        })),
      };

      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || 'Erreur lors de la validation des présences.');
      }

      setSaved(true);
      setTimeout(setSaved, 5000, false);
      await loadRosterAndAttendance();
      return true;
    } catch (err: any) {
      console.error('Failed to save attendance', err);
      setError(err.message || 'Échec de l\'enregistrement des présences.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  /**
   * The register's single submit path. "Valider l'appel" is the existing
   * roll-call submission, and it then closes the session so the arrivals it
   * consumed are linked to the marks it wrote. There is no second way to write
   * attendance here.
   */
  const handleValidateLesson = async () => {
    const submitted = await handleSave();
    if (!submitted) {
      return;
    }
    const linked = await closeScanSession();
    if (linked !== null) {
      setLinkedCount(linked);
    }
  };

  const handleExport = () => {
    if (roster.length === 0) {
      return;
    }
    const currentClassName = classesList.find(c => c.id === selectedClass)?.name || selectedClass;
    const exportRows = roster.map(s => ({
      [t('exportStudent')]: s.name,
      [t('exportMatricule')]: s.matricule,
      [t('exportStatus')]: statuses[s.id] === 'present' ? tStatus('present') : statuses[s.id] === 'late' ? tStatus('late') : statuses[s.id] === 'absent' ? tStatus('absent') : tStatus('excused'),
      [t('exportLateMinutes')]: lateMinutes[s.id] || '',
      [t('exportNote')]: notes[s.id] || '',
      [t('exportClass')]: currentClassName,
      [t('exportDate')]: selectedDate,
      [t('exportPeriod')]: t('periodNumbered', { period: selectedPeriod }),
    }));
    exportToCsv(exportRows, `appel_${selectedDate}_periode_${selectedPeriod}`);
  };

  const filteredRoster = roster.filter(st =>
    st.name.toLowerCase().includes(search.toLowerCase())
    || st.matricule.toLowerCase().includes(search.toLowerCase()),
  );

  const counts = roster.reduce(
    (acc, s) => {
      const status = statuses[s.id] ?? 'present';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    { present: 0, late: 0, absent: 0, excused: 0 } as Record<AttendanceStatus, number>,
  );
  const total = roster.length;
  const pct = (n: number) => total > 0 ? `${((n / total) * 100).toFixed(0)}%` : '—';
  const isAdmin = userRole === 'school_admin' || userRole === 'super_admin';

  // School-local, like every other time on this screen.
  const arrivalFormatter = useMemo(
    () => new Intl.DateTimeFormat(
      locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR',
      { timeZone: 'Africa/Casablanca', hour: '2-digit', minute: '2-digit', hour12: false },
    ),
    [locale],
  );
  const formatArrival = (iso: string) => arrivalFormatter.format(new Date(iso));

  /**
   * A partition of the roster, not a second list: on-time arrivals, late
   * arrivals, and everyone the register holds no arrival for. With no scan
   * activity it collapses to one unlabelled group, so the manual register renders
   * exactly as it did before scanning existed.
   */
  const rosterGroups: RosterGroup[] = useMemo(() => {
    if (!scanListEngaged) {
      return [{ key: null, label: null, students: filteredRoster }];
    }
    const scanned: RosterStudent[] = [];
    const late: RosterStudent[] = [];
    const missing: RosterStudent[] = [];
    for (const student of filteredRoster) {
      const scan = acceptedByStudent.get(student.id);
      if (!scan) {
        missing.push(student);
      } else if (scan.stagedStatus === 'late') {
        late.push(student);
      } else {
        scanned.push(student);
      }
    }
    return [
      { key: 'scanned' as const, label: t('scanGroupScanned'), students: scanned },
      { key: 'late' as const, label: t('scanGroupLate'), students: late },
      { key: 'missing' as const, label: t('scanGroupMissing'), students: missing },
    ].filter(group => group.students.length > 0);
  }, [scanListEngaged, filteredRoster, acceptedByStudent, t]);

  /**
   * The per-student evidence line: what the badge said, or nothing at all.
   * A student with no scan and no campus arrival gets NO line — absence from the
   * arrivals feed is not a claim that they are away, and the status control
   * already says absent from this lesson.
   */
  const renderEvidence = (student: RosterStudent) => {
    const scan = acceptedByStudent.get(student.id);
    const isLate = scan?.stagedStatus === 'late';
    return (
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {scan && (
          <span className={`
            inline-flex items-center gap-1 rounded-full px-1.5 py-0.5
            text-[10px] font-extrabold
            ${isLate ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'}
          `}
          >
            <QrCode className="size-2.5" aria-hidden />
            {isLate && occurrence
              ? t('scanLateTag', { minutes: scannedLateMinutes(scan, occurrence.startTime) })
              : t('scanOnTimeTag')}
            <span className="font-semibold text-slate-500">
              {t('scannedAtTime', { time: formatArrival(scan.scannedAt) })}
            </span>
          </span>
        )}
        {!scan && manualMarks[student.id] && (
          <span className="
            inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5
            text-[10px] font-extrabold text-slate-600
          "
          >
            <PencilLine className="size-2.5" aria-hidden />
            {t('scanManualTag')}
          </span>
        )}
        {!scan && scanListEngaged && arrivals[student.id] && (
          <span className="text-[10px] font-semibold text-slate-500">
            {t('scanArrivedAtSchool', { time: formatArrival(arrivals[student.id]!) })}
          </span>
        )}
      </div>
    );
  };

  const renderForgotBadge = (student: RosterStudent) => {
    if (!scanListEngaged || acceptedByStudent.has(student.id) || manualMarks[student.id]) {
      return null;
    }
    return (
      <button
        type="button"
        disabled={register?.status === 'LOCKED'}
        onClick={() => markPresentWithoutBadge(student.id)}
        aria-label={`${student.name} — ${t('scanForgotBadgeBtn')}`}
        className="
          mt-1 inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1
          text-[10px] font-bold text-slate-600 transition
          hover:bg-slate-200
          disabled:cursor-not-allowed disabled:opacity-50
          motion-reduce:transition-none
        "
      >
        <PencilLine className="size-3" aria-hidden />
        {t('scanForgotBadgeBtn')}
      </button>
    );
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('title')}</h1>
          <p className="mt-1 text-xs text-slate-500">{t('attendanceSheet')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {session && windowState === 'OPEN' && (
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  if (!scanSessionId) {
                    void activateScan();
                  }
                }}
                disabled={scanSessionBusy}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  scanSessionId
                    ? 'bg-white text-[#0B6FA4] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ScanLine className="size-3.5" />
                {t('modeScan')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (scanSessionId) {
                    void deactivateScan();
                  }
                }}
                disabled={scanSessionBusy}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  !scanSessionId
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckSquare className="size-3.5" />
                {t('modeManual')}
              </button>
            </div>
          )}
          {session && scanSessionId && (
            <span className="
              flex h-10 items-center gap-2 rounded-xl border
              border-[#0EA5C4]/40 bg-[#0EA5C4]/10 px-3.5 text-xs font-bold
              text-[#0B6FA4]
            "
            >
              <span className="
                size-2 rounded-full bg-[#0EA5C4]
                motion-safe:animate-pulse
              "
              />
              {t('scanActiveTitle')}
              <span className="font-extrabold tabular-nums">
                {t('scanArrivedCount', { count: acceptedCount, total: roster.length })}
              </span>
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={roster.length === 0}
            className="
              h-10 gap-2 rounded-xl border-slate-200 px-4 text-xs font-bold
            "
          >
            <Download className="size-4 text-slate-600" />
            {tCommon('export')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadRosterAndAttendance}
            disabled={loadingRoster}
            className="
              h-10 gap-2 rounded-xl border-slate-200 px-3 text-xs font-bold
              text-slate-600
              hover:text-slate-900
            "
            title="Actualiser la liste"
          >
            <RefreshCw className={`
              size-4
              ${loadingRoster ? 'animate-spin' : ''}
            `}
            />
          </Button>
        </div>
      </div>

      {/* Alert Messages */}
      {saved && (
        <div className="
          flex items-center gap-2.5 rounded-xl border border-emerald-200
          bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-700
        "
        >
          <CheckCircle2 className="size-4 shrink-0" />
          <span>
            {t('savedSuccess', { period: selectedPeriod })}
            {' '}
            {t('savedStudentsCount', { count: roster.length })}
          </span>
        </div>
      )}

      {linkedCount !== null && (
        <div className="
          flex items-center gap-2.5 rounded-xl border border-emerald-200
          bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-700
        "
        >
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{t('scanLinkedNotice', { count: linkedCount })}</span>
        </div>
      )}

      {error && (
        <div className="
          flex items-center justify-between gap-2.5 rounded-xl border
          border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-700
        "
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={loadRosterAndAttendance}
            className="
              h-7 text-xs font-bold text-rose-700
              hover:bg-rose-100
            "
          >
            {t('retryBtn')}
          </Button>
        </div>
      )}

      {/* Register Lifecycle Banner */}
      {register && register.status === 'LOCKED' && (
        <div className="
          flex flex-wrap items-center justify-between gap-3 rounded-2xl border
          border-amber-200 bg-amber-50/90 p-4 text-xs shadow-2xs
        "
        >
          <div className="flex flex-1 items-start gap-3 text-amber-900">
            <Lock className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-amber-900">{t('registerLocked')}</span>
                <span className="
                  rounded-md bg-amber-200/70 px-2 py-0.5 font-mono text-[11px]
                  font-semibold text-amber-800
                "
                >
                  {register.reference}
                </span>
              </div>
              <p className="mt-1 leading-relaxed text-amber-800/90">
                {t('registerLockedNotice', { reference: register.reference })}
                {register.submittedAt && (
                  <span className="
                    block text-slate-500
                    sm:ms-2 sm:inline
                  "
                  >
                    (Soumis le
                    {' '}
                    {new Date(register.submittedAt).toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR')}
                    {' '}
                    {register.submittedByName ? `par ${register.submittedByName}` : ''}
                    )
                  </span>
                )}
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              disabled={reopening}
              onClick={handleReopenRegister}
              className="
                h-9 gap-1.5 rounded-xl border-amber-300 bg-white px-4 font-bold
                text-amber-900 shadow-2xs
                hover:bg-amber-100
              "
            >
              {reopening
                ? <Loader2 className="size-4 animate-spin" />
                : (
                    <Unlock className="size-4 text-amber-700" />
                  )}
              {t('reopenRegisterBtn')}
            </Button>
          )}
        </div>
      )}

      {register && register.status === 'REOPENED' && (
        <div className="
          flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50/90
          p-4 text-xs shadow-2xs
        "
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Unlock className="size-5 shrink-0 text-[#2487B8]" />
              <span className="text-sm font-bold text-blue-950">{t('registerReopened')}</span>
              <span className="
                rounded-md bg-blue-200/70 px-2 py-0.5 font-mono text-[11px]
                font-semibold text-blue-900
              "
              >
                {register.reference}
              </span>
            </div>
          </div>
          {register.reopenReason && (
            <p className="
              rounded-lg border border-blue-100 bg-white/70 p-2 text-blue-900
            "
            >
              <strong className="me-1 text-blue-950">{t('reopenReasonLabel')}</strong>
              {register.reopenReason}
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-slate-700">{t('correctionNoteLabel')}</label>
            <Input
              value={correctionNote}
              onChange={e => setCorrectionNote(e.target.value)}
              placeholder={t('correctionNotePlaceholder')}
              className="h-9 rounded-xl border-slate-200 bg-white text-xs"
            />
          </div>
        </div>
      )}

      {/* Badge scanning. A card scan STAGES an arrival; nothing here writes a
          mark. The activation control itself sits in the header. */}
      {session && scanSessionId && (
        <div className="
          space-y-4 rounded-2xl border border-slate-200/80 bg-white p-4
          shadow-2xs
          sm:p-5
        "
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="
                flex size-9 shrink-0 items-center justify-center rounded-xl
                bg-[#0EA5C4]/12 text-[#0B87A1]
              "
              >
                <ScanLine className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-bold text-[#16212B]">{t('scanActiveTitle')}</p>
                <p className="text-[11px] font-semibold text-slate-500 tabular-nums">
                  {t('scanArrivedCount', { count: acceptedCount, total: roster.length })}
                </p>
              </div>
            </div>
            {windowState === 'OPEN' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCameraOn(previous => !previous)}
                className="
                  h-9 gap-1.5 rounded-xl border-slate-200 px-3 text-xs font-bold
                  text-slate-600
                  hover:text-slate-900
                "
              >
                {cameraOn
                  ? <CameraOff className="size-3.5" aria-hidden />
                  : <Camera className="size-3.5" aria-hidden />}
                {cameraOn ? t('scanStopCameraBtn') : t('scanResumeCameraBtn')}
              </Button>
            )}
          </div>

          {/* A session outlives its window: a forgotten register is completed
              late, so the arrivals stay readable and validation stays offered. */}
          {windowState !== 'OPEN' && (
            <p className="
              rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px]
              font-semibold text-slate-600
            "
            >
              {windowState === 'CLOSED' ? t('scanWindowClosedHint') : t('scanWindowBeforeHint', { minutes: REGISTER_OPENS_BEFORE_MINUTES })}
            </p>
          )}

          {windowState === 'OPEN' && cameraOn && (
            <div className="
              relative aspect-video w-full overflow-hidden rounded-2xl border
              border-slate-800 bg-slate-950
            "
            >
              <video
                ref={videoRef}
                playsInline
                muted
                className="size-full object-cover"
              />
              {!cameraError && (
                <div className="
                  pointer-events-none absolute inset-0 flex flex-col
                  items-center justify-center gap-3
                "
                >
                  <div className="
                    relative flex size-40 items-center justify-center rounded-2xl
                    border-2 border-[#0EA5C4]/60
                  "
                  >
                    {cameraReady && (
                      <div className="
                        absolute inset-x-2 h-0.5 bg-gradient-to-r
                        from-transparent via-[#0EA5C4] to-transparent
                        motion-safe:animate-bounce
                      "
                      />
                    )}
                    <QrCode className="size-14 text-white/15" aria-hidden />
                  </div>
                  <p className="
                    rounded-full bg-black/70 px-3 py-1 text-[11px] font-bold
                    text-white/90
                  "
                  >
                    {t('presentBadgePrompt')}
                  </p>
                </div>
              )}
              {cameraError && (
                <div className="
                  absolute inset-0 flex flex-col items-center justify-center gap-2
                  bg-slate-900/95 p-4 text-center
                "
                >
                  <CameraOff className="size-8 text-rose-400" aria-hidden />
                  <p className="text-[11px] font-bold text-rose-200">{cameraError}</p>
                  <Button
                    size="sm"
                    onClick={() => {
                      void startCamera();
                    }}
                    className="
                      h-8 rounded-lg bg-white text-[11px] font-bold text-slate-900
                      hover:bg-slate-100
                    "
                  >
                    {t('retryBtn')}
                  </Button>
                </div>
              )}
            </div>
          )}

          {scanBusy && (
            <p className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              {tCommon('loading')}
            </p>
          )}

          {lastAccepted && lastAccepted.studentId && (
            <div className="
              flex flex-wrap items-center gap-2 rounded-xl border
              border-emerald-100 bg-emerald-50/70 p-2.5 text-[11px]
              font-semibold text-emerald-800
            "
            >
              <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
              <span>{lastAccepted.studentName ?? t('scanResultAccepted')}</span>
              <span className="font-mono text-emerald-700/80">
                {formatArrival(lastAccepted.scannedAt)}
              </span>
            </div>
          )}

          {/* A refusal is never swallowed: WRONG_CLASS comes back with the
              student's own name in it, and only the teacher can act on that. */}
          {refusals.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-rose-800">
                <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
                {t('scanRefusalsHeading')}
              </p>
              <p className="mt-1.5 text-xs font-bold text-rose-900">
                {refusals[0]!.message}
                <span className="ms-1.5 font-mono text-[10px] font-semibold text-rose-500">
                  {refusals[0]!.code}
                </span>
              </p>
              {refusals.length > 1 && (
                <ul className="mt-2 space-y-1 border-t border-rose-200/70 pt-2">
                  {refusals.slice(1, 5).map((refusal, index) => (
                    <li
                      key={`${refusal.at}-${index}`}
                      className="flex items-start gap-1.5 text-[10px] font-semibold text-rose-800/90"
                    >
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
                      <span>
                        {refusal.message}
                        <span className="ms-1 font-mono text-rose-500">{refusal.code}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* The window is open but nobody has switched scanning on. Informational
          only — the activation control lives in the header, once. */}
      {session && !scanSessionId && scanSessionChecked && occurrence && windowState === 'OPEN' && (
        <p className="
          flex items-start gap-2.5 rounded-2xl border border-[#0EA5C4]/30
          bg-[#0EA5C4]/8 p-3.5 text-[11px] font-semibold text-[#0B6FA4]
        "
        >
          <ScanLine className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{t('scanActivateHint')}</span>
        </p>
      )}

      {session && scanSessionError && (
        <div className="
          flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50
          p-3.5 text-xs font-semibold text-rose-700
        "
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <span>{scanSessionError}</span>
        </div>
      )}

      {/* Filter Control Bar */}
      <div className="
        flex flex-wrap items-end justify-between gap-3 rounded-2xl border
        border-slate-200/80 bg-white p-4 shadow-2xs
      "
      >
        {!session && (
        <div className="flex flex-1 flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400">{t('selectDate')}</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="
                h-10 rounded-xl border border-slate-200/80 bg-slate-50 px-3.5
                text-xs font-semibold text-slate-700
                focus:ring-2 focus:ring-[#2487B8]/20 focus:outline-none
              "
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400">{t('academicSessionLabel')}</label>
            <div className="
              flex h-10 max-w-48 items-center truncate rounded-xl border
              border-slate-200/80 bg-slate-100 px-3.5 text-xs font-semibold
              text-slate-600
            "
            >
              {academicSession?.name ?? t('noData')}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400">{t('selectClass')}</label>
            <Select value={selectedClass} onValueChange={setSelectedClass} disabled={loadingMetadata}>
              <SelectTrigger className="
                h-10 w-60 rounded-xl border-slate-200/80 bg-slate-50 text-xs
                font-semibold
              "
              >
                <SelectValue placeholder={loadingMetadata ? tCommon('loading') : t('selectClass')} />
              </SelectTrigger>
              <SelectContent>
                {classesList.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                {classesList.length === 0 && !loadingMetadata && (
                  <SelectItem value="none" disabled>{t('noClassesConfigured')}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400">{t('subject')}</label>
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger className="
                h-10 w-52 rounded-xl border-slate-200/80 bg-slate-50 text-xs
                font-semibold
              "
              >
                <SelectValue placeholder={t('allSubjects')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allSubjects')}</SelectItem>
                {subjectsList.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400">{t('session')}</label>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="
                h-10 w-32 rounded-xl border-slate-200/80 bg-slate-50 text-xs
                font-semibold
              "
              >
                <SelectValue placeholder={t('period')} />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(p => <SelectItem key={p} value={String(p)}>{t('periodNumbered', { period: p })}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        )}

        {session && sessionLabel && (
          <p className="text-xs font-medium text-slate-500">{sessionLabel}</p>
        )}

        <Button
          size="sm"
          className={`
            h-10 cursor-pointer gap-2 rounded-xl px-5 text-xs font-bold
            text-white shadow-xs
            disabled:opacity-50
            ${
    register?.status === 'LOCKED'
      ? `
        cursor-not-allowed bg-slate-400
        hover:bg-slate-500
      `
      : `
        bg-[#2487B8]
        hover:bg-[#1B6C93]
      `
    }
          `}
          disabled={saving || loadingRoster || roster.length === 0 || register?.status === 'LOCKED'}
          onClick={() => {
            void handleValidateLesson();
          }}
        >
          {saving
            ? (
                <Loader2 className="size-4 animate-spin" />
              )
            : register?.status === 'LOCKED'
              ? (
                  <Lock className="size-4" />
                )
              : (
                  <Save className="size-4" />
                )}
          {saving
            ? tCommon('loading')
            : register?.status === 'LOCKED'
              ? t('registerLocked')
              : register?.status === 'REOPENED'
                ? t('saveCorrections')
                : scanListEngaged
                  ? t('scanValidateBtn')
                  : t('submitAttendance')}
        </Button>
      </div>

      {/* Quick Action Bar */}
      <div className="
        flex flex-wrap items-center justify-between gap-3 rounded-2xl border
        border-slate-200/60 bg-slate-50/80 p-3
      "
      >
        <div className="flex items-center gap-2">
          <span className="me-1 text-xs font-bold text-slate-500">{t('quickActions')}</span>
          <button
            type="button"
            disabled={register?.status === 'LOCKED'}
            onClick={() => markAll('present')}
            className="
              flex items-center gap-1 rounded-xl bg-emerald-100/70 px-3 py-1.5
              text-xs font-bold text-emerald-700 transition
              hover:bg-emerald-200
              disabled:cursor-not-allowed disabled:opacity-50
            "
          >
            <CheckCheck className="size-3.5" />
            {' '}
            {t('markAllPresent')}
          </button>
          <button
            type="button"
            disabled={register?.status === 'LOCKED'}
            onClick={() => markAll('absent')}
            className="
              flex items-center gap-1 rounded-xl bg-rose-100/70 px-3 py-1.5
              text-xs font-bold text-rose-700 transition
              hover:bg-rose-200
              disabled:cursor-not-allowed disabled:opacity-50
            "
          >
            <XCircle className="size-3.5" />
            {' '}
            {t('markAllAbsent')}
          </button>
        </div>

        <div className="relative w-56">
          <Search className="
            absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-slate-400
          "
          />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 rounded-xl border-slate-200 bg-white ps-9 text-xs"
          />
        </div>
      </div>

      {/* Analytics Snapshot Bar */}
      <div className="
        grid grid-cols-2 gap-3
        sm:grid-cols-4
      "
      >
        <Card className="
          flex items-center justify-between rounded-2xl border
          border-slate-200/80 bg-white p-3.5 shadow-2xs
        "
        >
          <div>
            <p className="
              text-[10px] font-bold tracking-wider text-slate-400 uppercase
            "
            >
              {tStatus('present')}
            </p>
            <p className="mt-0.5 text-xl font-extrabold text-emerald-600">{counts.present}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-xl bg-emerald-50
            text-xs font-extrabold text-emerald-600
          "
          >
            {pct(counts.present)}
          </div>
        </Card>

        <Card className="
          flex items-center justify-between rounded-2xl border
          border-slate-200/80 bg-white p-3.5 shadow-2xs
        "
        >
          <div>
            <p className="
              text-[10px] font-bold tracking-wider text-slate-400 uppercase
            "
            >
              {tStatus('late')}
            </p>
            <p className="mt-0.5 text-xl font-extrabold text-amber-600">{counts.late}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-xl bg-amber-50
            text-xs font-extrabold text-amber-600
          "
          >
            {pct(counts.late)}
          </div>
        </Card>

        <Card className="
          flex items-center justify-between rounded-2xl border
          border-slate-200/80 bg-white p-3.5 shadow-2xs
        "
        >
          <div>
            <p className="
              text-[10px] font-bold tracking-wider text-slate-400 uppercase
            "
            >
              {tStatus('absent')}
            </p>
            <p className="mt-0.5 text-xl font-extrabold text-rose-600">{counts.absent}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-xl bg-rose-50
            text-xs font-extrabold text-rose-600
          "
          >
            {pct(counts.absent)}
          </div>
        </Card>

        <Card className="
          flex items-center justify-between rounded-2xl border
          border-slate-200/80 bg-white p-3.5 shadow-2xs
        "
        >
          <div>
            <p className="
              text-[10px] font-bold tracking-wider text-slate-400 uppercase
            "
            >
              {tStatus('excused')}
            </p>
            <p className="mt-0.5 text-xl font-extrabold text-blue-600">{counts.excused}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-xl bg-blue-50
            text-xs font-extrabold text-blue-600
          "
          >
            {pct(counts.excused)}
          </div>
        </Card>
      </div>

      {/* Mobile roster (≤390px): one card per student — no horizontal page
          scroll, all mark actions reachable with ≥44px touch targets */}
      <div className="
        space-y-3
        sm:hidden
      "
      >
        {loadingRoster
          ? (
              <Card className="
                rounded-2xl border border-slate-200/80 bg-white p-8 text-center
                text-slate-400 shadow-2xs
              "
              >
                <Loader2 className="
                  mx-auto mb-2 size-6 animate-spin text-[#2487B8]
                "
                />
                {tCommon('loading')}
              </Card>
            )
          : filteredRoster.length === 0
            ? (
                <Card className="
                  rounded-2xl border border-slate-200/80 bg-white p-8
                  text-center text-slate-400 shadow-2xs
                "
                >
                  <Users className="mx-auto mb-2 size-8 text-slate-300" />
                  {t('noStudentsFound')}
                </Card>
              )
            : (
                rosterGroups.map(group => (
                  <Fragment key={group.key ?? 'all'}>
                    {group.label && (
                      <p className="
                        px-1 pt-1 text-[10px] font-extrabold tracking-wider
                        text-slate-500 uppercase
                      "
                      >
                        {group.label}
                        {' · '}
                        {group.students.length}
                      </p>
                    )}
                    {group.students.map((st) => {
                      const status = statuses[st.id] || 'present';
                      const isLowAttendance = st.attendanceRate != null && st.attendanceRate < 80;
                      return (
                        <Card
                          key={st.id}
                          className={`
                            space-y-3 rounded-2xl border border-slate-200/80
                            bg-white p-4 shadow-2xs transition-shadow
                            motion-reduce:transition-none
                            ${flashStudentId === st.id ? 'ring-2 ring-[#0EA5C4]' : ''}
                          `}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="
                                flex size-9 shrink-0 items-center justify-center
                                rounded-full bg-[#2487B8]/10 text-xs font-bold
                                text-[#2487B8]
                              "
                              >
                                {st.avatar}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="truncate font-bold text-[#16212B]">{st.name}</p>
                                  {isLowAttendance && (
                                    <span className="
                                      flex shrink-0 items-center gap-1 rounded-full
                                      bg-rose-100 px-1.5 py-0.5 text-[10px]
                                      font-extrabold text-rose-700
                                    "
                                    >
                                      <AlertTriangle className="size-3" />
                                      {' '}
                                      {t('alert')}
                                    </span>
                                  )}
                                </div>
                                <p className="font-mono text-[10px] text-slate-400">{st.matricule}</p>
                                {renderEvidence(st)}
                              </div>
                            </div>
                            {st.attendanceRate == null
                              ? (
                                  <span
                                    className="
                                      shrink-0 rounded-full bg-slate-100 px-2 py-0.5
                                      text-[11px] font-bold text-slate-500
                                    "
                                    title={t('noData')}
                                  >
                                    —
                                  </span>
                                )
                              : (
                                  <span className={`
                                    shrink-0 rounded-full px-2 py-0.5 text-[11px]
                                    font-bold
                                    ${st.attendanceRate < 80
                                    ? `bg-rose-100 text-rose-700`
                                    : `bg-emerald-50 text-emerald-700`}
                                  `}
                                  >
                                    {st.attendanceRate}
                                    %
                                  </span>
                                )}
                          </div>
                          {renderForgotBadge(st)}
                          <div className="grid grid-cols-4 gap-2">
                            {STATUS_OPTIONS.map(opt => (
                              <button
                                key={opt.key}
                                type="button"
                                disabled={register?.status === 'LOCKED'}
                                onClick={() => handleStatusChange(st.id, opt.key)}
                                aria-label={`${st.name} — ${tStatus(opt.key)}`}
                                className={`
                                  flex min-h-11 flex-col items-center justify-center
                                  gap-1 rounded-xl text-[10px] font-bold
                                  transition-all
                                  disabled:cursor-not-allowed disabled:opacity-50
                                  ${
                              status === opt.key
                                ? `
                                  ${opt.activeBg}
                                  ${opt.activeText}
                                  shadow-xs
                                `
                                : 'bg-slate-50 text-slate-400'
                              }
                                `}
                              >
                                <span className={`
                                  flex size-4 shrink-0 items-center justify-center
                                  rounded-full border-2
                                  ${
                              status === opt.key
                                ? `
                                  ${opt.dotColor}
                                  border-transparent
                                `
                                : `border-slate-300`
                              }
                                `}
                                >
                                  {status === opt.key && (
                                    <Check className="size-2.5 text-white" />
                                  )}
                                </span>
                                {tStatus(opt.key)}
                              </button>
                            ))}
                          </div>
                          {status === 'late' && (
                            <input
                              type="number"
                              min={1}
                              max={120}
                              disabled={register?.status === 'LOCKED'}
                              placeholder={t('minPlaceholder')}
                              value={lateMinutes[st.id] ?? ''}
                              onChange={e => setLateMinutes(prev => ({ ...prev, [st.id]: e.target.value }))}
                              className="
                                h-11 w-full rounded-xl border border-amber-200
                                bg-amber-50 px-3 text-center text-xs
                                focus:outline-none
                                disabled:opacity-60
                              "
                            />
                          )}
                          <input
                            type="text"
                            disabled={register?.status === 'LOCKED'}
                            placeholder={t('notePlaceholder')}
                            value={notes[st.id] || ''}
                            onChange={e => setNotes(prev => ({ ...prev, [st.id]: e.target.value }))}
                            className="
                              h-11 w-full rounded-xl border border-slate-200/80
                              bg-slate-50 px-3 text-start text-xs
                              focus:ring-1 focus:ring-[#2487B8]/40
                              focus:outline-none
                              disabled:opacity-60
                            "
                          />
                        </Card>
                      );
                    })}
                  </Fragment>
                ))
              )}
      </div>

      {/* Main Roster Table (≥sm) */}
      <Card className="
        hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-white
        shadow-2xs
        sm:block
      "
      >
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="
              border-b border-slate-200/80 bg-slate-50/80 text-[10px] font-bold
              text-slate-400 uppercase
            "
            >
              <tr>
                <th className="px-4 py-3 text-start">{tStudents('student')}</th>
                <th className="px-4 py-3 text-center">{t('attendanceRate')}</th>
                <th className="w-28 px-4 py-3 text-center">{tStatus('present')}</th>
                <th className="w-28 px-4 py-3 text-center">{tStatus('late')}</th>
                <th className="w-28 px-4 py-3 text-center">{tStatus('absent')}</th>
                <th className="w-28 px-4 py-3 text-center">{tStatus('excused')}</th>
                <th className="w-72 px-4 py-3 text-start">{t('noteReason')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingRoster
                ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-12 text-center text-slate-400"
                      >
                        <Loader2 className="
                          mx-auto mb-2 size-6 animate-spin text-[#2487B8]
                        "
                        />
                        {tCommon('loading')}
                      </td>
                    </tr>
                  )
                : filteredRoster.length === 0
                  ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-12 text-center text-slate-400"
                        >
                          <Users className="mx-auto mb-2 size-8 text-slate-300" />
                          {t('noStudentsFound')}
                        </td>
                      </tr>
                    )
                  : (
                      rosterGroups.map(group => (
                        <Fragment key={group.key ?? 'all'}>
                          {group.label && (
                            <tr className="bg-slate-50/90">
                              <td
                                colSpan={7}
                                className="
                                  px-4 py-2 text-[10px] font-extrabold
                                  tracking-wider text-slate-500 uppercase
                                "
                              >
                                {group.label}
                                {' · '}
                                {group.students.length}
                              </td>
                            </tr>
                          )}
                          {group.students.map((st) => {
                            const status = statuses[st.id] || 'present';
                            const isLowAttendance = st.attendanceRate != null && st.attendanceRate < 80;

                            return (
                              <tr
                                key={st.id}
                                className={`
                                  transition-colors
                                  hover:bg-slate-50/50
                                  motion-reduce:transition-none
                                  ${flashStudentId === st.id ? 'bg-[#0EA5C4]/8' : ''}
                                `}
                              >
                                <td className="px-4 py-3.5 text-start">
                                  <div className="flex items-center gap-3">
                                    <div className={`
                                      flex size-8 shrink-0 items-center
                                      justify-center rounded-full
                                      bg-[#2487B8]/10 text-xs font-bold
                                      text-[#2487B8]
                                      ${flashStudentId === st.id ? 'ring-2 ring-[#0EA5C4]' : ''}
                                    `}
                                    >
                                      {st.avatar}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <p className="font-bold text-[#16212B]">{st.name}</p>
                                        {isLowAttendance && (
                                          <span className="
                                            flex items-center gap-1 rounded-full
                                            bg-rose-100 px-1.5 py-0.5 text-[10px]
                                            font-extrabold text-rose-700
                                          "
                                          >
                                            <AlertTriangle className="size-3" />
                                            {' '}
                                            {t('alert')}
                                          </span>
                                        )}
                                      </div>
                                      <p className="
                                        font-mono text-[10px] text-slate-400
                                      "
                                      >
                                        {st.matricule}
                                      </p>
                                      {renderEvidence(st)}
                                      {renderForgotBadge(st)}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 text-center">
                                  {st.attendanceRate == null
                                    ? (
                                        <span
                                          className="
                                            rounded-full bg-slate-100 px-2 py-0.5
                                            text-[11px] font-bold text-slate-500
                                          "
                                          title={t('noData')}
                                        >
                                          —
                                        </span>
                                      )
                                    : (
                                        <span className={`
                                          rounded-full px-2 py-0.5 text-[11px]
                                          font-bold
                                          ${st.attendanceRate < 80
                                          ? `bg-rose-100 text-rose-700`
                                          : `bg-emerald-50 text-emerald-700`}
                                        `}
                                        >
                                          {st.attendanceRate}
                                          %
                                        </span>
                                      )}
                                </td>
                                {STATUS_OPTIONS.map(opt => (
                                  <td
                                    key={opt.key}
                                    className="px-4 py-3.5 text-center"
                                  >
                                    <button
                                      type="button"
                                      disabled={register?.status === 'LOCKED'}
                                      onClick={() => handleStatusChange(st.id, opt.key)}
                                      aria-label={`${st.name} — ${tStatus(opt.key)}`}
                                      className={`
                                        flex w-full cursor-pointer items-center
                                        justify-center gap-1.5 rounded-xl py-2
                                        text-xs font-bold transition-all
                                        disabled:cursor-not-allowed
                                        ${
                                  status === opt.key
                                    ? `
                                      ${opt.activeBg}
                                      ${opt.activeText}
                                      shadow-xs
                                    `
                                    : `
                                      text-slate-300
                                      hover:bg-slate-100
                                    `
                                  }
                                      `}
                                    >
                                      <span className={`
                                        flex size-4 shrink-0 items-center
                                        justify-center rounded-full border-2
                                        ${
                                  status === opt.key
                                    ? `
                                      ${opt.dotColor}
                                      border-transparent
                                    `
                                    : `border-slate-300`
                                  }
                                      `}
                                      >
                                        {status === opt.key && (
                                          <Check className="size-2.5 text-white" />
                                        )}
                                      </span>
                                    </button>
                                  </td>
                                ))}
                                <td className="px-4 py-3.5 text-start">
                                  <div className="flex items-center gap-1.5">
                                    {status === 'late' && (
                                      <input
                                        type="number"
                                        min={1}
                                        max={120}
                                        disabled={register?.status === 'LOCKED'}
                                        placeholder={t('minPlaceholder')}
                                        value={lateMinutes[st.id] ?? ''}
                                        onChange={e => setLateMinutes(prev => ({ ...prev, [st.id]: e.target.value }))}
                                        className="
                                          h-8 w-16 shrink-0 rounded-lg border
                                          border-amber-200 bg-amber-50 px-2
                                          text-center text-xs
                                          focus:outline-none
                                          disabled:opacity-60
                                        "
                                      />
                                    )}
                                    <input
                                      type="text"
                                      disabled={register?.status === 'LOCKED'}
                                      placeholder={t('notePlaceholder')}
                                      value={notes[st.id] || ''}
                                      onChange={e => setNotes(prev => ({ ...prev, [st.id]: e.target.value }))}
                                      className="
                                        h-8 w-full rounded-lg border
                                        border-slate-200/80 bg-slate-50 px-2.5
                                        text-start text-xs
                                        focus:ring-1 focus:ring-[#2487B8]/40
                                        focus:outline-none
                                        disabled:opacity-60
                                      "
                                    />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      ))
                    )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
