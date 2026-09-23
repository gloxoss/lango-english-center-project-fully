'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Calendar, Building2, Plus, Download, Search, Grid, Loader2, AlertCircle, CheckCircle2, Users, UserX,
} from 'lucide-react';
import type { ExamScheduleStatus, ExamSession } from '../data/exam-planning-config';

type ExamTerm = { id: string; name: string; code: string; startDate: string; endDate: string };
type ExamHall = { id: string; name: string; code: string; capacity: number };
type AssessmentDefinition = { id: string; title: string; type: string };
type StaffMember = { id: string; name: string; role: string };

type ApiSupervisor = { staffId: string; name: string | null; role: string; attendanceStatus: string };
type ApiSeat = { seatNumber: number; deskLabel: string | null; candidateNumber: string; studentId: string; studentName: string | null; matricule: string | null };
type ApiSchedule = {
  id: string;
  examTermId: string;
  examTermName: string | null;
  subject: string | null;
  examHallId: string | null;
  room: string | null;
  hallCapacity: number | null;
  startTime: string;
  endTime: string;
  status: string;
  supervisors: ApiSupervisor[];
  seats: ApiSeat[];
  seatCount: number;
};

const UNDEFINED_VALUE = '—';
const DATE_TO_DEFINE = 'À définir';

const STATUS_FILTERS = [
  { id: 'all', statusKey: 'tabAll' },
  { id: 'published', statusKey: 'filterScheduled' },
  { id: 'draft', statusKey: 'filterDraft' },
  { id: 'cancelled', statusKey: 'filterCancelled' },
] as const;

export function ExamPlanningClient({ locale = 'fr' }: { locale?: string } = {}) {
  const t = useTranslations('Grading');
  const tCommon = useTranslations('Common');

  const dateLocale = locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-GB' : 'fr-FR';

  const [exams, setExams] = useState<ExamSession[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Reference data from real APIs
  const [terms, setTerms] = useState<ExamTerm[]>([]);
  const [halls, setHalls] = useState<ExamHall[]>([]);
  const [definitions, setDefinitions] = useState<AssessmentDefinition[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);

  // Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [selectedDefId, setSelectedDefId] = useState<string>('');
  const [selectedHallId, setSelectedHallId] = useState<string>('');
  const [customSubject, setCustomSubject] = useState('');
  const [examDate, setExamDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [invigilatorIds, setInvigilatorIds] = useState<string[]>([]);

  const mapSchedulesToSessions = useCallback((apiSchedules: ApiSchedule[]): ExamSession[] => {
    return apiSchedules.map((s) => {
      const start = s.startTime ? new Date(s.startTime) : null;
      const end = s.endTime ? new Date(s.endTime) : null;
      const dateStr = start
        ? start.toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })
        : DATE_TO_DEFINE;
      const timeStr = start && end
        ? `${start.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}`
        : DATE_TO_DEFINE;

      // Candidates and seating come exclusively from the term's allocated
      // exam_seats (real seat allocation), never from the school directory.
      const seatingGrid = (s.seats ?? []).map((seat) => ({
        desk: seat.deskLabel ?? `#${seat.seatNumber}`,
        studentName: seat.studentName ?? UNDEFINED_VALUE,
        matricule: seat.matricule ?? UNDEFINED_VALUE,
        isOccupied: Boolean(seat.studentId),
      }));

      const invigilators = (s.supervisors ?? []).map((sup) => ({
        // A staffId that resolves to no tenant user (legacy rows) stays
        // visibly unassigned instead of wearing a made-up name.
        name: sup.name ?? t('supervisorUnassigned'),
        avatar: sup.name ? sup.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : '?',
        staffKey: sup.staffId,
        unassigned: sup.name == null,
      }));

      return {
        id: s.id,
        subject: s.subject ?? UNDEFINED_VALUE,
        className: s.examTermName ?? UNDEFINED_VALUE,
        date: dateStr,
        time: timeStr,
        room: s.room ?? DATE_TO_DEFINE,
        invigilators,
        totalCandidates: s.seatCount ?? 0,
        maxCapacity: s.hallCapacity ?? null,
        status: (s.status ?? 'draft') as ExamScheduleStatus,
        seatingGrid,
      };
    });
  }, [dateLocale, t]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [schedRes, termRes, hallRes, defRes, staffRes] = await Promise.all([
        fetch('/api/academics/exam-schedules').then(r => r.json()),
        fetch('/api/academics/exam-terms').then(r => r.json()),
        fetch('/api/academics/exam-halls').then(r => r.json()),
        fetch('/api/academics/assessment-definitions').then(r => r.json()),
        fetch('/api/academics/exam-schedules/staff').then(r => r.json()),
      ]);

      if (!schedRes?.success) {
        throw new Error(schedRes?.error?.message ?? 'Chargement des épreuves impossible.');
      }

      const loadedTerms: ExamTerm[] = termRes?.success && Array.isArray(termRes.data) ? termRes.data : [];
      const loadedHalls: ExamHall[] = hallRes?.success && Array.isArray(hallRes.data) ? hallRes.data : [];
      const loadedDefs: AssessmentDefinition[] = defRes?.success && Array.isArray(defRes.data) ? defRes.data : [];
      const loadedStaff: StaffMember[] = staffRes?.success && Array.isArray(staffRes.data) ? staffRes.data : [];

      setTerms(loadedTerms);
      setHalls(loadedHalls);
      setDefinitions(loadedDefs);
      setStaff(loadedStaff);

      if (loadedTerms.length > 0) setSelectedTermId(prev => prev || loadedTerms[0]!.id);
      if (loadedHalls.length > 0) setSelectedHallId(prev => prev || loadedHalls[0]!.id);
      if (loadedDefs.length > 0) setSelectedDefId(prev => prev || loadedDefs[0]!.id);

      const mapped = mapSchedulesToSessions(Array.isArray(schedRes.data) ? schedRes.data : []);
      setExams(mapped);
      setSelectedExamId(prev => (prev && mapped.some(e => e.id === prev) ? prev : mapped[0]?.id ?? null));
    } catch (err: any) {
      console.error('Failed loading exam planning data:', err);
      setLoadError(err?.message || 'Erreur lors du chargement des épreuves.');
      setExams([]);
    } finally {
      setLoading(false);
    }
  }, [mapSchedulesToSessions]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredExams = exams.filter(e => {
    const matchesSearch = e.subject.toLowerCase().includes(search.toLowerCase())
      || e.room.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || e.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const selectedExam = exams.find(e => e.id === selectedExamId) ?? filteredExams[0] ?? null;

  const mobilizedInvigilatorCount = useMemo(
    () => new Set(exams.flatMap(e => e.invigilators.map(i => i.staffKey))).size,
    [exams],
  );

  const totalCandidatesSum = useMemo(
    () => exams.reduce((acc, e) => acc + e.totalCandidates, 0),
    [exams],
  );

  const handleCreateExam = async () => {
    setActionError(null);
    setActionSuccess(null);

    if (!examDate || !startTime || !endTime) {
      setActionError('La date et les horaires de l\'épreuve sont obligatoires.');
      return;
    }
    if (!selectedTermId) {
      setActionError('Sélectionnez ou créez d\'abord une session d\'examen.');
      return;
    }
    if (!selectedDefId && !customSubject.trim()) {
      setActionError('Choisissez une épreuve officielle ou saisissez un intitulé.');
      return;
    }

    setSubmitting(true);

    try {
      // 1. Ensure exam term exists
      let termIdToUse = selectedTermId;
      if (!terms.some(t2 => t2.id === termIdToUse)) {
        const createTermRes = await fetch('/api/academics/exam-terms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Session ${new Date(examDate).getFullYear()}`,
            code: `TERM-${Date.now().toString().slice(-4)}`,
            startDate: `${new Date(examDate).getFullYear()}-01-01`,
            endDate: `${new Date(examDate).getFullYear()}-12-31`,
          }),
        });
        const termJson = await createTermRes.json();
        if (!createTermRes.ok || !termJson.success) {
          throw new Error(termJson?.error?.message ?? 'Impossible de créer la session d\'examen.');
        }
        termIdToUse = termJson.data.id;
        setTerms(prev => [termJson.data, ...prev]);
      }

      // 2. Ensure assessment definition exists
      let defIdToUse = selectedDefId;
      const titleToUse = customSubject.trim() || definitions.find(d => d.id === selectedDefId)?.title;
      if ((!defIdToUse || customSubject.trim()) && titleToUse) {
        const createDefRes = await fetch('/api/academics/assessment-definitions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: titleToUse,
            type: 'paper_exam',
            description: 'Épreuve créée via le planificateur',
          }),
        });
        const defJson = await createDefRes.json();
        if (createDefRes.ok && defJson.success) {
          defIdToUse = defJson.data.id;
          setDefinitions(prev => [defJson.data, ...prev]);
        } else if (!defIdToUse) {
          throw new Error(defJson?.error?.message ?? 'Impossible de créer l\'épreuve.');
        }
      }

      // 3. Hall is optional — no default hall is ever invented.
      const hallIdToUse = selectedHallId || undefined;

      // 4. Construct start and end ISO strings
      const startDateTime = new Date(`${examDate}T${startTime}:00`).toISOString();
      const endDateTime = new Date(`${examDate}T${endTime}:00`).toISOString();

      // 5. Post to /api/academics/exam-schedules — supervisors are real staff ids
      const scheduleRes = await fetch('/api/academics/exam-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examTermId: termIdToUse,
          assessmentDefinitionId: defIdToUse,
          examHallId: hallIdToUse,
          startTime: startDateTime,
          endTime: endDateTime,
          supervisorStaffIds: invigilatorIds.length > 0 ? invigilatorIds : undefined,
        }),
      });

      const schedJson = await scheduleRes.json();
      if (!scheduleRes.ok || !schedJson.success) {
        if (scheduleRes.status === 409) {
          throw new Error('Conflit de salle : Cette salle d\'examen est déjà occupée sur cette plage horaire.');
        }
        throw new Error(schedJson?.error?.message ?? 'Échec de la planification de l\'épreuve.');
      }

      setActionSuccess('Épreuve planifiée avec succès dans le calendrier officiel.');
      setIsAddOpen(false);
      setCustomSubject('');
      setInvigilatorIds([]);

      // Reload real schedules to update metrics and UI
      await loadData();
    } catch (err: any) {
      setActionError(err?.message || 'Une erreur est survenue lors de la planification.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleInvigilator = (staffId: string) => {
    setInvigilatorIds(prev => prev.includes(staffId) ? prev.filter(id => id !== staffId) : [...prev, staffId]);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Feedback Alerts */}
      {actionSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-700 hover:text-emerald-900 font-bold">×</button>
        </div>
      )}
      {actionError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-700 hover:text-rose-900 font-bold">×</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('examPlanningTitle')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('examPlanningSubtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="h-10 rounded-xl px-4 gap-2 border-slate-200 text-xs font-bold"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>{t('printSeatingPlans')}</span>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setActionError(null);
              setIsAddOpen(true);
            }}
            className="h-10 rounded-xl px-4 gap-2 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>{t('scheduleExam')}</span>
          </Button>
        </div>
      </div>

      {/* Top 3 KPI Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-slate-500">{t('totalExamsScheduled')}</p>
          <p className="text-2xl font-extrabold text-[#16212B]">{t('sessionsCount', { count: exams.length })}</p>
          <p className="text-[10px] text-slate-400">{t('examPeriodNotice')}</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-blue-200/60 bg-blue-50/20 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-[#1B6C93]">{t('candidatesCalled')}</p>
          <p className="text-2xl font-extrabold text-[#2487B8]">
            {t('candidatesCountVal', { count: totalCandidatesSum })}
          </p>
          <p className="text-[10px] text-slate-400">{t('distributedAcrossHalls')}</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-emerald-200/60 bg-emerald-50/20 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-[#17A673]">{t('invigilatorsMobilized')}</p>
          <p className="text-2xl font-extrabold text-[#17A673]">{t('teachersCountVal', { count: mobilizedInvigilatorCount })}</p>
          <p className="text-[10px] text-slate-400">{t('supervisionScheduleValidated')}</p>
        </Card>
      </div>

      {/* Main 12-col Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 cols: Exam Sessions List & Search Toolbar */}
        <div className="lg:col-span-7 space-y-3">
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder={t('searchExam')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="ps-9 h-9 text-xs rounded-xl bg-slate-50 border-none text-start"
              />
            </div>
            <div className="flex items-center gap-1">
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterStatus(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    filterStatus === f.id ? 'bg-[#2487B8] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t(f.statusKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {loading && exams.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
                <Loader2 className="w-6 h-6 animate-spin text-[#2487B8] mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">Chargement des épreuves planifiées...</p>
              </div>
            ) : loadError ? (
              <Card className="p-8 text-center bg-white rounded-2xl border border-rose-200 space-y-3">
                <AlertCircle className="w-10 h-10 text-rose-300 mx-auto" />
                <p className="text-xs font-bold text-rose-700">{loadError}</p>
                <Button
                  size="sm"
                  onClick={() => void loadData()}
                  className="h-8 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold"
                >
                  Réessayer
                </Button>
              </Card>
            ) : filteredExams.length === 0 ? (
              <Card className="p-8 text-center bg-white rounded-2xl border border-slate-200/80 space-y-3">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600">Aucune épreuve trouvée</p>
                <p className="text-[11px] text-slate-400">Planifiez une première session d'examen pour ce cycle.</p>
                <Button
                  size="sm"
                  onClick={() => setIsAddOpen(true)}
                  className="h-8 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold"
                >
                  Planifier un examen
                </Button>
              </Card>
            ) : (
              filteredExams.map(exam => {
                const isSelected = selectedExam?.id === exam.id;
                return (
                  <Card
                    key={exam.id}
                    onClick={() => setSelectedExamId(exam.id)}
                    className={`p-5 bg-white rounded-2xl border transition cursor-pointer space-y-3 ${
                      isSelected ? 'border-[#2487B8] bg-[#DCEBF4]/20 shadow-xs' : 'border-slate-200/80 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#DCEBF4] text-[#1B6C93]">
                        {exam.className}
                      </span>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                        exam.status === 'cancelled'
                          ? 'text-[#E5544B] bg-[#FCE4E2]'
                          : exam.status === 'draft'
                            ? 'text-slate-600 bg-slate-100'
                            : 'text-[#17A673] bg-[#DDF5EC]'
                      }`}>
                        {exam.status === 'published'
                          ? t('filterScheduled')
                          : exam.status === 'draft'
                            ? t('filterDraft')
                            : exam.status === 'cancelled'
                              ? t('filterCancelled')
                              : exam.status}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-extrabold text-[#16212B]">{exam.subject}</h3>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-[#2487B8]" />
                        <span>{exam.date} • <strong className="text-[#2487B8]">{exam.time}</strong></span>
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" /> {exam.room}
                      </span>
                      <span className="font-extrabold text-[#16212B]">
                        {exam.totalCandidates} / {exam.maxCapacity ?? '—'} {t('candidatesCalled')}
                      </span>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Right 5 cols: Exam Session Seating Grid & Logistics Inspector */}
        <div className="lg:col-span-5 space-y-4">
          {selectedExam && (
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <span className="text-[10px] font-extrabold text-[#2487B8] uppercase tracking-wider">{t('examSessionSheet')}</span>
                <h2 className="text-base font-extrabold text-[#16212B]">{selectedExam.subject}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{selectedExam.className} • {selectedExam.date} ({selectedExam.time})</p>
              </div>

              {/* Room & Capacity info box */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold">{t('assignedHall')}</span>
                  <p className="font-extrabold text-[#16212B]">{selectedExam.room}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold">{t('hallCapacity')}</span>
                  <p className="font-extrabold text-[#2487B8]">
                    {selectedExam.maxCapacity != null
                      ? t('reservedCapacity', { total: selectedExam.totalCandidates, max: selectedExam.maxCapacity })
                      : `${selectedExam.totalCandidates} / ${UNDEFINED_VALUE}`}
                  </p>
                </div>
              </div>

              {/* Invigilators Avatars */}
              <div className="space-y-2">
                <h3 className="text-xs font-extrabold text-[#16212B] uppercase tracking-wider text-[10px]">{t('designatedInvigilators')}</h3>
                {selectedExam.invigilators.length === 0 ? (
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500">
                    <UserX className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-semibold">{t('noInvigilatorsAssigned')}</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {selectedExam.invigilators.map((inv, i) => (
                      <div key={i} className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        <div className="w-7 h-7 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-extrabold text-[10px]">
                          {inv.avatar}
                        </div>
                        <span className={`font-bold ${inv.unassigned ? 'text-slate-400 italic' : 'text-[#16212B]'}`}>{inv.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Visual Seating Plan Matrix — real allocated seats only */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-[#16212B] uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Grid className="w-3.5 h-3.5 text-[#2487B8]" />
                    {t('seatingPlanPreview', { count: selectedExam.seatingGrid.length })}
                  </h3>
                </div>

                {selectedExam.seatingGrid.length === 0 ? (
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500">
                    <Users className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-semibold">{t('noSeatsAllocated')}</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {selectedExam.seatingGrid.map((deskItem, i) => (
                      <div
                        key={i}
                        className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                          deskItem.isOccupied ? 'bg-white border-slate-200/80 shadow-2xs' : 'bg-slate-50 border-dashed border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-extrabold text-[#2487B8] text-[10px] bg-[#DCEBF4] px-1.5 py-0.5 rounded">
                            {deskItem.desk}
                          </span>
                          <span className={`text-[9px] font-bold ${deskItem.isOccupied ? 'text-[#17A673]' : 'text-slate-400'}`}>
                            {deskItem.isOccupied ? t('deskOccupied') : t('deskFree')}
                          </span>
                        </div>
                        <p className="font-bold text-[#16212B] text-[11px] truncate">{deskItem.studentName}</p>
                        {deskItem.isOccupied && <p className="text-[9px] text-slate-400 font-mono">{deskItem.matricule}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2">
                <Button
                  size="sm"
                  onClick={() => window.print()}
                  className="w-full h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  {t('printAttendanceSheet')}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Programmer une épreuve Modal Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#2487B8]" />
              {t('scheduleExamModalTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 my-3 text-xs">
            {actionError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <div>
              <label className="font-bold text-slate-700 block mb-1">Session d'Examen (Term)</label>
              {terms.length > 0 ? (
                <Select value={selectedTermId} onValueChange={setSelectedTermId}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="Sélectionner une session" />
                  </SelectTrigger>
                  <SelectContent>
                    {terms.map(term => (
                      <SelectItem key={term.id} value={term.id}>
                        {term.name} ({term.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-[11px] text-slate-500 italic p-2 bg-slate-50 rounded-xl">
                  Aucune session d'examen — une session sera créée automatiquement à la validation.
                </p>
              )}
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">{t('examSubject')}</label>
              {definitions.length > 0 ? (
                <div className="space-y-1.5">
                  <Select value={selectedDefId} onValueChange={setSelectedDefId}>
                    <SelectTrigger className="h-9 text-xs rounded-xl">
                      <SelectValue placeholder="Choisir une épreuve officielle" />
                    </SelectTrigger>
                    <SelectContent>
                      {definitions.map(def => (
                        <SelectItem key={def.id} value={def.id}>
                          {def.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Ou saisir une nouvelle épreuve..."
                    value={customSubject}
                    onChange={e => setCustomSubject(e.target.value)}
                    className="h-8 text-xs rounded-xl"
                  />
                </div>
              ) : (
                <Input
                  placeholder="Ex. Examen National : Mathématiques"
                  value={customSubject}
                  onChange={e => setCustomSubject(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">{t('examHall')}</label>
                {halls.length > 0 ? (
                  <Select value={selectedHallId} onValueChange={setSelectedHallId}>
                    <SelectTrigger className="h-9 text-xs rounded-xl">
                      <SelectValue placeholder="Choisir une salle" />
                    </SelectTrigger>
                    <SelectContent>
                      {halls.map(h => (
                        <SelectItem key={h.id} value={h.id}>
                          {h.name} ({h.capacity} places)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-[11px] text-slate-400 p-2 bg-slate-50 rounded-xl">Aucune salle configurée</p>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">{t('examDate')}</label>
                <Input
                  type="date"
                  value={examDate}
                  onChange={e => setExamDate(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Heure de début</label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Heure de fin</label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">{t('invigilator')}</label>
              {staff.length > 0 ? (
                <div className="max-h-32 space-y-1 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-100">
                  {staff.map(member => (
                    <label key={member.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={invigilatorIds.includes(member.id)}
                        onChange={() => toggleInvigilator(member.id)}
                        className="rounded border-slate-300 text-[#2487B8] focus:ring-[#2487B8]"
                      />
                      <span className="font-semibold text-[#16212B]">{member.name}</span>
                      <span className="text-[10px] text-slate-400 uppercase">{member.role.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 p-2 bg-slate-50 rounded-xl">
                  Aucun membre du personnel disponible pour la surveillance.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsAddOpen(false)}
              disabled={submitting}
              className="rounded-xl text-xs h-9"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleCreateExam}
              disabled={submitting || !examDate || !startTime || !endTime}
              className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>{submitting ? 'Planification...' : t('confirmScheduleAction')}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
