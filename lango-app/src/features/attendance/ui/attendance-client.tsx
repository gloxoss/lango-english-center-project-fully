'use client';

import type {
  AttendanceStatus,
} from '../data/attendance-config';
import {
  AlertTriangle,
  Check,
  CheckCheck,
  CheckCircle2,
  Download,
  Loader2,
  Lock,
  RefreshCw,
  Save,
  Search,
  Unlock,
  Users,
  XCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

export function AttendanceClient({ locale = 'fr' }: { locale?: string } = {}) {
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
          if (classOpts.length > 0 && !selectedClass) {
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

      // Fill in default 'present' for any student without an explicit saved record
      for (const st of formattedStudents) {
        if (!loadedStatuses[st.id]) {
          loadedStatuses[st.id] = 'present';
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

  const handleStatusChange = (id: string, status: AttendanceStatus) => {
    if (register?.status === 'LOCKED') {
      return;
    }
    setStatuses(prev => ({ ...prev, [id]: status }));
    setSaved(false);
  };

  const markAll = (status: AttendanceStatus) => {
    if (register?.status === 'LOCKED') {
      return;
    }
    const updated: Record<string, AttendanceStatus> = {};
    for (const s of roster) {
      updated[s.id] = status;
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
  const handleSave = async () => {
    if (roster.length === 0) {
      return;
    }

    if (register?.status === 'LOCKED') {
      setError(t('registerLockedNotice', { reference: register.reference }));
      return;
    }

    if (register?.status === 'REOPENED' && !correctionNote.trim()) {
      setError(t('correctionNoteRequired'));
      return;
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
    } catch (err: any) {
      console.error('Failed to save attendance', err);
      setError(err.message || 'Échec de l\'enregistrement des présences.');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    if (roster.length === 0) {
      return;
    }
    const currentClassName = classesList.find(c => c.id === selectedClass)?.name || selectedClass;
    const exportRows = roster.map(s => ({
      'Élève': s.name,
      'Matricule': s.matricule,
      'Statut': statuses[s.id] === 'present' ? 'Présent' : statuses[s.id] === 'late' ? 'En Retard' : statuses[s.id] === 'absent' ? 'Absent' : 'Excusé',
      'Retard (min)': lateMinutes[s.id] || '',
      'Note / Motif': notes[s.id] || '',
      'Classe': currentClassName,
      'Date': selectedDate,
      'Séance': `Période ${selectedPeriod}`,
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

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('title')}</h1>
          <p className="mt-1 text-xs text-slate-500">{t('attendanceSheet')}</p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Filter Control Bar */}
      <div className="
        flex flex-wrap items-end justify-between gap-3 rounded-2xl border
        border-slate-200/80 bg-white p-4 shadow-2xs
      "
      >
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
          onClick={handleSave}
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
                filteredRoster.map((st) => {
                  const status = statuses[st.id] || 'present';
                  const isLowAttendance = st.attendanceRate != null && st.attendanceRate < 80;
                  return (
                    <Card
                      key={st.id}
                      className="
                        space-y-3 rounded-2xl border border-slate-200/80
                        bg-white p-4 shadow-2xs
                      "
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
                })
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
                      filteredRoster.map((st) => {
                        const status = statuses[st.id] || 'present';
                        const isLowAttendance = st.attendanceRate != null && st.attendanceRate < 80;

                        return (
                          <tr
                            key={st.id}
                            className="
                              transition-colors
                              hover:bg-slate-50/50
                            "
                          >
                            <td className="px-4 py-3.5 text-start">
                              <div className="flex items-center gap-3">
                                <div className="
                                  flex size-8 shrink-0 items-center
                                  justify-center rounded-full bg-[#2487B8]/10
                                  text-xs font-bold text-[#2487B8]
                                "
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
                      })
                    )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
