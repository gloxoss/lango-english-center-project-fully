'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  UserCheck, UserX, Clock, Save, CheckCircle2, Download, Check, FileText, CheckCheck, AlertTriangle, XCircle, Search, Loader2, Users, RefreshCw, Lock, Unlock
} from 'lucide-react';
import {
  AttendanceStatus, STATUS_OPTIONS,
} from '../data/attendance-config';
import { exportToCsv } from '@/libs/csv-export';

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
  attendanceRate: number;
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
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]!);

  // Roster & Attendance states
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [lateMinutes, setLateMinutes] = useState<Record<string, string>>({});

  // Register & Role state
  const [register, setRegister] = useState<RegisterInfo | null>(null);
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
    return () => { isMounted = false; };
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

        // Fallback to classes if no class-sections exist yet
        if (classOpts.length === 0) {
          const clsRes = await fetch('/api/academics/classes?pageSize=100');
          if (clsRes.ok) {
            const clsJson = await clsRes.json();
            if (clsJson.success && Array.isArray(clsJson.data)) {
              classOpts = clsJson.data.map((c: any) => ({
                id: c.id,
                name: c.name,
              }));
            }
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
        if (isMounted) setError(err?.message || 'Erreur lors du chargement des classes.');
      } finally {
        if (isMounted) setLoadingMetadata(false);
      }
    }

    loadMeta();
    return () => { isMounted = false; };
  }, []);

  // 2. Load students roster, existing attendance & register lock status
  const loadRosterAndAttendance = useCallback(async () => {
    if (!selectedClass) return;
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

      // If empty, try querying with classId (in case selectedClass is a pure class id)
      if (studentRows.length === 0) {
        const stdClassRes = await fetch(`/api/students?classId=${selectedClass}&pageSize=200`);
        if (stdClassRes.ok) {
          const stdClassJson = await stdClassRes.json();
          if (stdClassJson.success && Array.isArray(stdClassJson.data)) {
            studentRows = stdClassJson.data;
          }
        }
      }

      const formattedStudents: RosterStudent[] = studentRows.map((s: any) => ({
        id: s.id,
        name: s.fullName || s.name || 'Élève',
        avatar: (s.fullName || s.name || 'EL').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
        matricule: s.matricule || '—',
        attendanceRate: typeof s.attendanceRate === 'number' ? s.attendanceRate : 100,
      }));

      // Query existing saved attendance for this date, class, period and subject
      const selectedOption = classesList.find(c => c.id === selectedClass);
      const resolvedClassId = selectedOption?.classId || selectedClass;

      const subjectQuery = selectedSubject && selectedSubject !== 'all' ? `&subjectId=${selectedSubject}` : '';
      const [attRes, regRes] = await Promise.all([
        fetch(`/api/attendance?date=${selectedDate}&classId=${resolvedClassId}&period=${selectedPeriod}${subjectQuery}`),
        fetch(`/api/attendance/registers?classId=${resolvedClassId}&date=${selectedDate}&period=${selectedPeriod}`),
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
              if (rec.note) loadedNotes[rec.studentId] = rec.note;
              if (rec.lateMinutes != null) loadedLate[rec.studentId] = String(rec.lateMinutes);
            }
          }
        }
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
    if (register?.status === 'LOCKED') return;
    setStatuses(prev => ({ ...prev, [id]: status }));
    setSaved(false);
  };

  const markAll = (status: AttendanceStatus) => {
    if (register?.status === 'LOCKED') return;
    const updated: Record<string, AttendanceStatus> = {};
    for (const s of roster) updated[s.id] = status;
    setStatuses(updated);
    setSaved(false);
  };

  // Reopening locked register (for school_admin / super_admin)
  const handleReopenRegister = async () => {
    if (!register) return;
    const reason = window.prompt(t('reopenReasonPrompt'));
    if (!reason || reason.trim().length < 3) return;

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
    if (roster.length === 0) return;

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
      const selectedOption = classesList.find(c => c.id === selectedClass);
      const resolvedClassId = selectedOption?.classId || selectedClass;

      const payload = {
        date: selectedDate,
        studentGroupId: resolvedClassId || undefined,
        subjectId: selectedSubject && selectedSubject !== 'all' ? selectedSubject : undefined,
        period: parseInt(selectedPeriod, 10) || 1,
        correctionNote: register?.status === 'REOPENED' ? correctionNote.trim() : undefined,
        records: roster.map(s => ({
          studentId: s.id,
          status: statuses[s.id] || 'present',
          note: notes[s.id]?.trim() || undefined,
          lateMinutes: statuses[s.id] === 'late' && lateMinutes[s.id] ? parseInt(lateMinutes[s.id]!, 10) : undefined,
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
      setTimeout(() => setSaved(false), 5000);
      await loadRosterAndAttendance();
    } catch (err: any) {
      console.error('Failed to save attendance', err);
      setError(err.message || 'Échec de l\'enregistrement des présences.');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    if (roster.length === 0) return;
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
    st.name.toLowerCase().includes(search.toLowerCase()) ||
    st.matricule.toLowerCase().includes(search.toLowerCase())
  );

  const counts = roster.reduce(
    (acc, s) => {
      const status = statuses[s.id] ?? 'present';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    { present: 0, late: 0, absent: 0, excused: 0 } as Record<AttendanceStatus, number>
  );
  const total = roster.length;
  const pct = (n: number) => total > 0 ? `${((n / total) * 100).toFixed(0)}%` : '—';
  const isAdmin = userRole === 'school_admin' || userRole === 'super_admin';

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('title')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('attendanceSheet')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={roster.length === 0}
            className="gap-2 h-10 px-4 rounded-xl border-slate-200 text-xs font-bold"
          >
            <Download className="w-4 h-4 text-slate-600" />
            {tCommon('export')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadRosterAndAttendance}
            disabled={loadingRoster}
            className="gap-2 h-10 px-3 rounded-xl border-slate-200 text-xs font-bold text-slate-600 hover:text-slate-900"
            title="Actualiser la liste"
          >
            <RefreshCw className={`w-4 h-4 ${loadingRoster ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Alert Messages */}
      {saved && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-700 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{t('savedSuccess', { period: selectedPeriod })} ({roster.length} élèves enregistrés en base de données)</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2.5 text-rose-700 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={loadRosterAndAttendance} className="h-7 text-xs font-bold text-rose-700 hover:bg-rose-100">
            Réessayer
          </Button>
        </div>
      )}

      {/* Register Lifecycle Banner */}
      {register && register.status === 'LOCKED' && (
        <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-start gap-3 text-amber-900 flex-1">
            <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-amber-900">{t('registerLocked')}</span>
                <span className="font-mono text-[11px] bg-amber-200/70 text-amber-800 px-2 py-0.5 rounded-md font-semibold">
                  {register.reference}
                </span>
              </div>
              <p className="text-amber-800/90 mt-1 leading-relaxed">
                {t('registerLockedNotice', { reference: register.reference })}
                {register.submittedAt && (
                  <span className="block sm:inline sm:ms-2 text-slate-500">
                    (Soumis le {new Date(register.submittedAt).toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR')} {register.submittedByName ? `par ${register.submittedByName}` : ''})
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
              className="h-9 px-4 rounded-xl border-amber-300 bg-white hover:bg-amber-100 text-amber-900 font-bold gap-1.5 shadow-2xs"
            >
              {reopening ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4 text-amber-700" />}
              {t('reopenRegisterBtn')}
            </Button>
          )}
        </div>
      )}

      {register && register.status === 'REOPENED' && (
        <div className="p-4 bg-blue-50/90 border border-blue-200 rounded-2xl flex flex-col gap-3 text-xs shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Unlock className="w-5 h-5 text-[#2487B8] shrink-0" />
              <span className="font-bold text-sm text-blue-950">{t('registerReopened')}</span>
              <span className="font-mono text-[11px] bg-blue-200/70 text-blue-900 px-2 py-0.5 rounded-md font-semibold">
                {register.reference}
              </span>
            </div>
          </div>
          {register.reopenReason && (
            <p className="text-blue-900 bg-white/70 p-2 rounded-lg border border-blue-100">
              <strong className="text-blue-950 me-1">{t('reopenReasonLabel')}</strong>
              {register.reopenReason}
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-slate-700">{t('correctionNoteLabel')}</label>
            <Input
              value={correctionNote}
              onChange={e => setCorrectionNote(e.target.value)}
              placeholder={t('correctionNotePlaceholder')}
              className="bg-white rounded-xl h-9 text-xs border-slate-200"
            />
          </div>
        </div>
      )}

      {/* Filter Control Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-2xs border border-slate-200/80 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end flex-wrap gap-3 flex-1">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400">{t('selectDate')}</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="h-10 px-3.5 text-xs bg-slate-50 border border-slate-200/80 rounded-xl font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2487B8]/20"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400">{t('selectClass')}</label>
            <Select value={selectedClass} onValueChange={setSelectedClass} disabled={loadingMetadata}>
              <SelectTrigger className="w-60 rounded-xl h-10 bg-slate-50 border-slate-200/80 text-xs font-semibold">
                <SelectValue placeholder={loadingMetadata ? tCommon('loading') : t('selectClass')} />
              </SelectTrigger>
              <SelectContent>
                {classesList.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                {classesList.length === 0 && !loadingMetadata && (
                  <SelectItem value="none" disabled>Aucune classe enregistrée</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400">{t('subject')}</label>
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger className="w-52 rounded-xl h-10 bg-slate-50 border-slate-200/80 text-xs font-semibold">
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
              <SelectTrigger className="w-32 rounded-xl h-10 bg-slate-50 border-slate-200/80 text-xs font-semibold">
                <SelectValue placeholder={t('period')} />
              </SelectTrigger>
              <SelectContent>
                {[1,2,3,4,5,6,7,8].map(p => <SelectItem key={p} value={String(p)}>{t('periodNumbered', { period: p })}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          size="sm"
          className={`h-10 px-5 rounded-xl text-white text-xs font-bold gap-2 cursor-pointer shadow-xs disabled:opacity-50 ${
            register?.status === 'LOCKED'
              ? 'bg-slate-400 hover:bg-slate-500 cursor-not-allowed'
              : 'bg-[#2487B8] hover:bg-[#1B6C93]'
          }`}
          disabled={saving || loadingRoster || roster.length === 0 || register?.status === 'LOCKED'}
          onClick={handleSave}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : register?.status === 'LOCKED' ? (
            <Lock className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving
            ? tCommon('loading')
            : register?.status === 'LOCKED'
            ? t('registerLocked')
            : register?.status === 'REOPENED'
            ? 'Enregistrer les corrections'
            : t('submitAttendance')}
        </Button>
      </div>

      {/* Quick Action Bar */}
      <div className="flex flex-wrap items-center justify-between bg-slate-50/80 p-3 rounded-2xl border border-slate-200/60 gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 me-1">{t('quickActions')}</span>
          <button
            type="button"
            disabled={register?.status === 'LOCKED'}
            onClick={() => markAll('present')}
            className="px-3 py-1.5 bg-emerald-100/70 text-emerald-700 hover:bg-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCheck className="w-3.5 h-3.5" /> {t('markAllPresent')}
          </button>
          <button
            type="button"
            disabled={register?.status === 'LOCKED'}
            onClick={() => markAll('absent')}
            className="px-3 py-1.5 bg-rose-100/70 text-rose-700 hover:bg-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XCircle className="w-3.5 h-3.5" /> {t('markAllAbsent')}
          </button>
        </div>

        <div className="relative w-56">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 ps-9 text-xs rounded-xl bg-white border-slate-200"
          />
        </div>
      </div>

      {/* Analytics Snapshot Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{tStatus('present')}</p>
            <p className="text-xl font-extrabold text-emerald-600 mt-0.5">{counts.present}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-extrabold text-xs">
            {pct(counts.present)}
          </div>
        </Card>

        <Card className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{tStatus('late')}</p>
            <p className="text-xl font-extrabold text-amber-600 mt-0.5">{counts.late}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-extrabold text-xs">
            {pct(counts.late)}
          </div>
        </Card>

        <Card className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{tStatus('absent')}</p>
            <p className="text-xl font-extrabold text-rose-600 mt-0.5">{counts.absent}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-extrabold text-xs">
            {pct(counts.absent)}
          </div>
        </Card>

        <Card className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{tStatus('excused')}</p>
            <p className="text-xl font-extrabold text-blue-600 mt-0.5">{counts.excused}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-extrabold text-xs">
            {pct(counts.excused)}
          </div>
        </Card>
      </div>

      {/* Main Roster Table */}
      <Card className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] uppercase font-bold text-slate-400">
              <tr>
                <th className="py-3 px-4 text-start">{tStudents('student')}</th>
                <th className="py-3 px-4 text-center">{t('attendanceRate')}</th>
                <th className="py-3 px-4 text-center w-28">{tStatus('present')}</th>
                <th className="py-3 px-4 text-center w-28">{tStatus('late')}</th>
                <th className="py-3 px-4 text-center w-28">{tStatus('absent')}</th>
                <th className="py-3 px-4 text-center w-28">{tStatus('excused')}</th>
                <th className="py-3 px-4 text-start w-72">{t('noteReason')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingRoster ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#2487B8]" />
                    {tCommon('loading')}
                  </td>
                </tr>
              ) : filteredRoster.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Aucun élève trouvé pour cette classe.
                  </td>
                </tr>
              ) : (
                filteredRoster.map(st => {
                  const status = statuses[st.id] || 'present';
                  const isLowAttendance = st.attendanceRate < 80;

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 text-start">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#2487B8]/10 text-[#2487B8] flex items-center justify-center font-bold text-xs shrink-0">
                            {st.avatar}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-[#16212B]">{st.name}</p>
                              {isLowAttendance && (
                                <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-extrabold rounded-full flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> {t('alert')}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono">{st.matricule}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${st.attendanceRate < 80 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {st.attendanceRate}%
                        </span>
                      </td>
                      {STATUS_OPTIONS.map(opt => (
                        <td key={opt.key} className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            disabled={register?.status === 'LOCKED'}
                            onClick={() => handleStatusChange(st.id, opt.key)}
                            className={`w-full py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all font-bold text-xs cursor-pointer disabled:cursor-not-allowed ${
                              status === opt.key
                                ? `${opt.activeBg} ${opt.activeText} shadow-xs`
                                : 'text-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              status === opt.key ? `${opt.dotColor} border-transparent` : 'border-slate-300'
                            }`}>
                              {status === opt.key && <Check className="w-2.5 h-2.5 text-white" />}
                            </span>
                          </button>
                        </td>
                      ))}
                      <td className="py-3.5 px-4 text-start">
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
                              className="w-16 h-8 px-2 text-xs bg-amber-50 border border-amber-200 rounded-lg focus:outline-none shrink-0 text-center disabled:opacity-60"
                            />
                          )}
                          <input
                            type="text"
                            disabled={register?.status === 'LOCKED'}
                            placeholder={t('notePlaceholder')}
                            value={notes[st.id] || ''}
                            onChange={e => setNotes(prev => ({ ...prev, [st.id]: e.target.value }))}
                            className="w-full h-8 px-2.5 text-xs bg-slate-50 border border-slate-200/80 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2487B8]/40 text-start disabled:opacity-60"
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
