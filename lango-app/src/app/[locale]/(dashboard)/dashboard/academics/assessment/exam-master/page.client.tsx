'use client';

import { useEffect, useState, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ExamPlanningClient } from '@/features/academics/ui/exam-planning-client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import {
  canPerform,
  type ExamTermAction,
  type ExamTermStage,
  STAGE_LABELS,
} from '@/features/assessment/services/exam-term-workflow';
import { getMoroccanMention } from '@/libs/grading/moroccan-grade-engine';
import {
  GraduationCap,
  Calendar,
  Building,
  Users,
  CheckCircle2,
  Plus,
  ShieldCheck,
  Search,
  Save,
  FileSpreadsheet,
  Check,
  ChevronsUpDown,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  Loader2,
  Clock,
  Layers,
} from 'lucide-react';

type ExamTerm = { id: string; name: string; code: string; startDate: string; endDate: string; status: string };
type ExamHall = { id: string; name: string; code: string; capacity: number };
type ExamSchedule = { id: string; examTermId: string; assessmentDefinitionId: string; examHallId: string | null; startTime: string; endTime: string; status: string };
type StudentRow = { id: string; fullName: string; matricule: string };
type StageInfo = {
  stage: ExamTermStage;
  stageLabel: string;
  stages: { stage: ExamTermStage; label: string }[];
  nextStage: ExamTermStage | null;
  canAdvance: boolean;
  blockedReason: string | null;
  blockedCode: string | null;
};
type MarkRow = { studentId: string; matricule: string; name: string; rawScore: string; status: 'graded' | 'absent' | 'exempted' | 'withheld'; grade?: string };
type AssessmentDefinition = { id: string; title: string };

function EpreuveCombobox({ definitions, value, onChange, placeholder }: {
  definitions: AssessmentDefinition[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
}) {
  const t = useTranslations('Grading');
  const [open, setOpen] = useState(false);
  const selected = definitions.find(d => d.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className="w-full flex items-center justify-between gap-2 h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-[#16212B] hover:bg-slate-50 text-start cursor-pointer transition-colors"
        >
          <span className="truncate">{selected ? selected.title : placeholder}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder={t('searchEpreuvePlaceholder')} />
          <CommandList>
            <CommandEmpty>{t('noEpreuveFound')}</CommandEmpty>
            <CommandGroup>
              {definitions.map(d => (
                <CommandItem
                  key={d.id}
                  value={d.title}
                  onSelect={() => { onChange(d.id); setOpen(false); }}
                >
                  <Check className={cn('me-2 h-4 w-4', value === d.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{d.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function ExamMasterPage() {
  const t = useTranslations('Grading');
  const tCommon = useTranslations('Common');
  const tStatus = useTranslations('Status');

  const locale = useLocale();

  // Sequential 3-step flow (§10.1): 1. seats -> 2. schedules -> 3. marksheet.
  // 'calendar' is the former /academics/exams screen (calendar + supervisors),
  // folded in here so exam planning lives on one page (audit S-13).
  const [activeTab, setActiveTab] = useState<'seats' | 'schedules' | 'marksheet' | 'calendar'>('seats');
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'calendar') setActiveTab('calendar');
  }, []);

  const [terms, setTerms] = useState<ExamTerm[]>([]);
  const [halls, setHalls] = useState<ExamHall[]>([]);
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selectedTermId, setSelectedTermId] = useState('');
  const [selectedHallIds, setSelectedHallIds] = useState<string[]>([]);

  const [allocationResult, setAllocationResult] = useState<{ allocatedCount: number; unallocatedCount: number } | null>(null);
  const [allocating, setAllocating] = useState(false);
  const [allocationError, setAllocationError] = useState('');

  const [assessmentDefinitionId, setAssessmentDefinitionId] = useState('');
  const [searchRoster, setSearchRoster] = useState('');
  const [marks, setMarks] = useState<MarkRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Marksheet asynchronous loading state & active assessment metadata
  const [loadingMarksheet, setLoadingMarksheet] = useState(false);
  const [activeDefInfo, setActiveDefInfo] = useState<{
    maximumScore: number;
    passMark: number;
    coefficient: number;
  } | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);

  // Bulk fill popover state
  const [defaultGradeValue, setDefaultGradeValue] = useState('10');

  // Workflow stage of the selected term.
  const [stage, setStage] = useState<StageInfo | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [stageError, setStageError] = useState('');

  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleEnd, setScheduleEnd] = useState('');
  const [scheduleHallId, setScheduleHallId] = useState('');
  const [scheduleDefId, setScheduleDefId] = useState('');
  const [scheduleError, setScheduleError] = useState('');

  const [newTermName, setNewTermName] = useState('');
  const [newTermCode, setNewTermCode] = useState('');
  const [newTermStart, setNewTermStart] = useState('');
  const [newTermEnd, setNewTermEnd] = useState('');
  const [creatingTerm, setCreatingTerm] = useState(false);
  const [termError, setTermError] = useState('');
  const [termSuccess, setTermSuccess] = useState('');

  const [newHallName, setNewHallName] = useState('');
  const [newHallCode, setNewHallCode] = useState('');
  const [newHallCapacity, setNewHallCapacity] = useState('30');
  const [creatingHall, setCreatingHall] = useState(false);
  const [hallError, setHallError] = useState('');
  const [hallSuccess, setHallSuccess] = useState('');

  const [physicalRooms, setPhysicalRooms] = useState<Array<{ id: string; name: string; capacity: number | null; roomType: string | null }>>([]);
  const [definitions, setDefinitions] = useState<AssessmentDefinition[]>([]);

  // Input refs for keyboard-driven navigation (ArrowUp / ArrowDown / Enter / Shift+Enter)
  const gradeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const loadTerms = () => fetch('/api/academics/exam-terms').then(r => r.json()).then(j => j.success && setTerms(j.data));
  const loadHalls = () => fetch('/api/academics/exam-halls').then(r => r.json()).then(j => j.success && setHalls(j.data));
  const loadSchedules = () => fetch('/api/academics/exam-schedules').then(r => r.json()).then(j => j.success && setSchedules(j.data));
  const loadPhysicalRooms = () => fetch('/api/academics/rooms?pageSize=100').then(r => r.json()).then(j => j.success && setPhysicalRooms(j.data));
  const loadStudents = () =>
    fetch('/api/students?pageSize=100')
      .then(r => r.json())
      .then((j) => {
        if (j.success) {
          setStudents(j.data.map((s: any) => ({ id: s.id, fullName: s.fullName, matricule: s.matricule })));
        }
      });
  const loadDefinitions = () =>
    fetch('/api/academics/assessment-definitions')
      .then(r => r.json())
      .then(j => j.success && setDefinitions(j.data));

  useEffect(() => {
    void loadTerms();
    void loadHalls();
    void loadSchedules();
    void loadStudents();
    void loadDefinitions();
    void loadPhysicalRooms();
  }, []);

  const loadStage = (termId: string) =>
    fetch(`/api/academics/exam-terms/${termId}/stage`)
      .then(r => r.json())
      .then(j => setStage(j.success ? (j.data as StageInfo) : null))
      .catch(() => setStage(null));

  useEffect(() => {
    if (!selectedTermId) {
      setStage(null);
      return;
    }
    void loadStage(selectedTermId);
  }, [selectedTermId]);

  // If terms are loaded and none selected, auto-select first
  useEffect(() => {
    if (terms.length > 0 && terms[0] && !selectedTermId) {
      setSelectedTermId(terms[0].id);
    }
  }, [terms, selectedTermId]);

  const computeMention = (scoreStr: string, status: MarkRow['status']): string => {
    if (status === 'absent') return t('statusAbsent');
    if (status === 'exempted') return t('statusExempted');
    if (status === 'withheld') return t('statusWithheld');
    if (!scoreStr.trim()) return '-';
    const num = Number.parseFloat(scoreStr);
    if (Number.isNaN(num) || num < 0 || num > 20) return tCommon('error');
    return getMoroccanMention(num);
  };

  // Load existing marks and registered students dynamically when an épreuve is selected
  const loadMarksheet = async (defId: string, termId: string) => {
    if (!defId) {
      setActiveDefInfo(null);
      return;
    }
    setLoadingMarksheet(true);
    setSaveError('');
    try {
      const res = await fetch(`/api/academics/exam-terms/${termId || 'none'}/marksheet?assessmentDefinitionId=${defId}`);
      const json = await res.json();
      if (json.success && json.data) {
        const payload = json.data;
        if (payload.definition) {
          setActiveDefInfo({
            maximumScore: payload.definition.maximumScore,
            passMark: payload.definition.passMark,
            coefficient: payload.definition.coefficient,
          });
        }
        const existingMap = new Map((payload.existingMarks || []).map((m: any) => [m.studentId, m]));

        // If specific audience students exist in payload, use them. Otherwise fallback to general enrolled students.
        const targetStudents = (payload.students && payload.students.length > 0)
          ? payload.students.map((s: any) => ({
              id: s.studentId,
              fullName: s.name,
              matricule: s.nationalId || '—',
            }))
          : students;

        const mappedMarks: MarkRow[] = targetStudents.map((s: any) => {
          const existing = existingMap.get(s.id) as any;
          const rawScore = (existing?.rawScore !== null && existing?.rawScore !== undefined) ? String(existing.rawScore) : '';
          const status = (existing?.status && existing.status !== 'pending') ? existing.status : 'graded';
          return {
            studentId: s.id,
            matricule: s.matricule || '—',
            name: s.fullName,
            rawScore,
            status: status as MarkRow['status'],
            grade: computeMention(rawScore, status as MarkRow['status']),
          };
        });
        setMarks(mappedMarks);
      }
    } catch {
      // Fallback gracefully to empty marks on student roster
      if (students.length > 0 && marks.length === 0) {
        setMarks(students.map(s => ({ studentId: s.id, matricule: s.matricule, name: s.fullName, rawScore: '', status: 'graded' })));
      }
    } finally {
      setLoadingMarksheet(false);
    }
  };

  // Trigger marksheet reload whenever assessmentDefinitionId or selectedTermId changes
  useEffect(() => {
    if (assessmentDefinitionId) {
      void loadMarksheet(assessmentDefinitionId, selectedTermId);
    } else if (students.length > 0 && marks.length === 0) {
      setMarks(students.map(s => ({ studentId: s.id, matricule: s.matricule, name: s.fullName, rawScore: '', status: 'graded' })));
    }
  }, [assessmentDefinitionId, selectedTermId]);

  const advanceStage = async () => {
    if (!selectedTermId || !stage?.nextStage || advancing) return;
    setAdvancing(true);
    setStageError('');
    const res = await fetch(`/api/academics/exam-terms/${selectedTermId}/stage`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: stage.nextStage }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      setStageError(json?.error?.message ?? tCommon('error'));
    }
    await loadStage(selectedTermId);
    setAdvancing(false);
  };

  const rollBackStage = async () => {
    if (!selectedTermId || !stage || advancing) return;
    const order = stage.stages.map(s => s.stage);
    const previous = order[order.indexOf(stage.stage) - 1];
    if (!previous) return;
    setAdvancing(true);
    setStageError('');
    const res = await fetch(`/api/academics/exam-terms/${selectedTermId}/stage`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: previous }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      setStageError(json?.error?.message ?? tCommon('error'));
    }
    await loadStage(selectedTermId);
    setAdvancing(false);
  };

  const stepLocked = (action: ExamTermAction): boolean =>
    stage !== null && !canPerform(stage.stage, action);

  const handleScoreChange = (index: number, newScore: string) => {
    const updated = [...marks];
    const row = updated[index];
    if (row) {
      const mention = computeMention(newScore, row.status);
      updated[index] = { ...row, rawScore: newScore, grade: mention };
    }
    setMarks(updated);
  };

  const handleStatusChange = (index: number, newStatus: MarkRow['status']) => {
    const updated = [...marks];
    const row = updated[index];
    if (row) {
      const mention = computeMention(row.rawScore, newStatus);
      updated[index] = {
        ...row,
        status: newStatus,
        grade: mention,
      };
    }
    setMarks(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, filteredIndex: number, totalFiltered: number) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = filteredIndex + 1 < totalFiltered ? filteredIndex + 1 : 0;
      gradeInputRefs.current[nextIdx]?.focus();
      gradeInputRefs.current[nextIdx]?.select();
    } else if (e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey)) {
      e.preventDefault();
      const prevIdx = filteredIndex - 1 >= 0 ? filteredIndex - 1 : totalFiltered - 1;
      gradeInputRefs.current[prevIdx]?.focus();
      gradeInputRefs.current[prevIdx]?.select();
    }
  };

  const handleBulkFillEmpty = () => {
    const defaultVal = Number.parseFloat(defaultGradeValue);
    if (Number.isNaN(defaultVal) || defaultVal < 0 || defaultVal > 20) return;
    setMarks(prev =>
      prev.map(m => {
        if (m.status === 'graded' && (!m.rawScore || m.rawScore.trim() === '')) {
          return {
            ...m,
            rawScore: defaultGradeValue,
            grade: computeMention(defaultGradeValue, m.status),
          };
        }
        return m;
      })
    );
  };

  const handleBulkSetStatus = (status: MarkRow['status']) => {
    setMarks(prev =>
      prev.map(m => ({
        ...m,
        status,
        grade: computeMention(m.rawScore, status),
      }))
    );
  };

  const handleClearAllScores = () => {
    setMarks(prev =>
      prev.map(m => ({
        ...m,
        rawScore: '',
        grade: '-',
      }))
    );
  };

  const handleSaveMarks = async () => {
    if (!assessmentDefinitionId.trim()) {
      setSaveError(t('chooseAssessmentToGradePlaceholder'));
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`/api/academics/exam-terms/${selectedTermId || 'none'}/marksheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessmentDefinitionId: assessmentDefinitionId.trim(),
          marks: marks.map(m => ({
            studentId: m.studentId,
            rawScore: m.status === 'graded' ? (m.rawScore.trim() !== '' ? Number.parseFloat(m.rawScore) : 0) : undefined,
            status: m.status,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setSaveError(json.error?.message || t('errSaveMarks'));
        return;
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
      void loadMarksheet(assessmentDefinitionId, selectedTermId);
    } catch {
      setSaveError('Erreur réseau lors de la sauvegarde de la grille.');
    } finally {
      setSaving(false);
    }
  };

  const handleAllocateSeats = async () => {
    if (!selectedTermId) {
      setAllocationError('Veuillez d\'abord sélectionner une session d\'examen.');
      return;
    }
    if (selectedHallIds.length === 0) {
      setAllocationError('Veuillez cocher au moins une salle d\'examen à inclure.');
      return;
    }
    setAllocating(true);
    setAllocationError('');
    setAllocationResult(null);
    try {
      const res = await fetch(`/api/academics/exam-terms/${selectedTermId}/seat-allocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentIds: students.map(s => s.id), examHallIds: selectedHallIds }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setAllocationError(json.error?.message || 'Erreur lors de la répartition des places.');
        return;
      }
      setAllocationResult({ allocatedCount: json.data.allocatedCount, unallocatedCount: json.data.unallocatedCount });
    } catch {
      setAllocationError('Erreur de communication avec le solveur de places.');
    } finally {
      setAllocating(false);
    }
  };

  const handleCreateSchedule = async () => {
    if (!selectedTermId || !scheduleDefId || !scheduleStart || !scheduleEnd) {
      setScheduleError(t('scheduleErrorRequired'));
      return;
    }
    setScheduleError('');
    const res = await fetch('/api/academics/exam-schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        examTermId: selectedTermId,
        assessmentDefinitionId: scheduleDefId,
        examHallId: scheduleHallId || undefined,
        startTime: scheduleStart,
        endTime: scheduleEnd,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setScheduleError(json.error?.message || tCommon('error'));
      return;
    }
    void loadSchedules();
    setScheduleDefId('');
    setScheduleStart('');
    setScheduleEnd('');
  };

  const handleCreateTerm = async () => {
    if (!newTermName.trim() || !newTermCode.trim() || !newTermStart || !newTermEnd) {
      setTermError('Tous les champs (nom, code, date début et date fin) sont obligatoires.');
      return;
    }
    setCreatingTerm(true);
    setTermError('');
    setTermSuccess('');
    try {
      const res = await fetch('/api/academics/exam-terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTermName.trim(), code: newTermCode.trim(), startDate: newTermStart, endDate: newTermEnd }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setTermError(json.error?.message || tCommon('error'));
        return;
      }
      setTermSuccess(t('sessionCreatedSuccess'));
      setTimeout(() => setTermSuccess(''), 3500);
      setNewTermName('');
      setNewTermCode('');
      setNewTermStart('');
      setNewTermEnd('');
      void loadTerms();
      if (json.data?.id) {
        setSelectedTermId(json.data.id);
      }
    } finally {
      setCreatingTerm(false);
    }
  };

  const handleCreateHall = async () => {
    if (!newHallName.trim() || !newHallCode.trim()) {
      setHallError('Le nom et le code de la salle sont obligatoires.');
      return;
    }
    const capNum = Number.parseInt(newHallCapacity, 10);
    if (Number.isNaN(capNum) || capNum <= 0) {
      setHallError('La capacité assise doit être un entier supérieur à zéro.');
      return;
    }
    setCreatingHall(true);
    setHallError('');
    setHallSuccess('');
    try {
      const res = await fetch('/api/academics/exam-halls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newHallName.trim(), code: newHallCode.trim(), capacity: capNum }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setHallError(json.error?.message || tCommon('error'));
        return;
      }
      setHallSuccess(t('hallCreatedSuccess'));
      setTimeout(() => setHallSuccess(''), 3500);
      setNewHallName('');
      setNewHallCode('');
      setNewHallCapacity('30');
      void loadHalls();
    } finally {
      setCreatingHall(false);
    }
  };

  const filteredRoster = marks.filter(
    m =>
      m.name.toLowerCase().includes(searchRoster.toLowerCase())
      || m.matricule.toLowerCase().includes(searchRoster.toLowerCase()),
  );

  const totalHallCapacity = halls.reduce((sum, h) => sum + h.capacity, 0);

  // Live metrics calculation on the roster
  const gradedScores = marks
    .filter(m => m.status === 'graded' && m.rawScore !== '' && !Number.isNaN(Number.parseFloat(m.rawScore)))
    .map(m => Number.parseFloat(m.rawScore));

  const averageScore = gradedScores.length > 0 ? (gradedScores.reduce((a, b) => a + b, 0) / gradedScores.length).toFixed(2) : '—';
  const passingCount = gradedScores.filter(s => s >= 10).length;
  const passRate = gradedScores.length > 0 ? Math.round((passingCount / gradedScores.length) * 100) : 0;
  const maxScore = gradedScores.length > 0 ? Math.max(...gradedScores).toFixed(1) : '—';
  const minScore = gradedScores.length > 0 ? Math.min(...gradedScores).toFixed(1) : '—';
  const absentCount = marks.filter(m => m.status === 'absent').length;

  const getMentionBadge = (gradeStr: string | undefined, status: MarkRow['status']) => {
    if (status === 'absent') {
      return <Badge className="bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px]">{t('statusAbsent')}</Badge>;
    }
    if (status === 'exempted') {
      return <Badge className="bg-slate-100 text-slate-600 border border-slate-200 font-bold text-[10px]">{t('statusExempted')}</Badge>;
    }
    if (status === 'withheld') {
      return <Badge className="bg-orange-50 text-orange-700 border border-orange-200 font-bold text-[10px]">{t('statusWithheld')}</Badge>;
    }
    if (!gradeStr || gradeStr === '-') {
      return <span className="text-slate-400 text-xs font-mono">—</span>;
    }
    switch (gradeStr) {
      case 'Très Bien':
        return <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">{t('mentionTresBien')} (≥ 16)</Badge>;
      case 'Bien':
        return <Badge className="bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px]">{t('mentionBien')} (14-16)</Badge>;
      case 'Assez Bien':
        return <Badge className="bg-purple-50 text-purple-700 border border-purple-200 font-bold text-[10px]">{t('mentionAssezBien')} (12-14)</Badge>;
      case 'Passable':
        return <Badge className="bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[10px]">{t('mentionPassable')} (10-12)</Badge>;
      case 'Insuffisant':
        return <Badge className="bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px]">{t('mentionInsuffisant')} (&lt; 10)</Badge>;
      default:
        return <Badge variant="neutral" className="font-bold text-[10px]">{gradeStr}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0066FF] to-[#0052CC] flex items-center justify-center text-white shadow-xs shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('examMasterTitle')}</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {t('examMasterSubtitle')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {terms.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
              <span className="font-bold text-slate-600 shrink-0 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#0066FF]" />
                Session :
              </span>
              <select
                value={selectedTermId}
                onChange={e => setSelectedTermId(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#0066FF] cursor-pointer"
              >
                {terms.map(tRow => (
                  <option key={tRow.id} value={tRow.id}>
                    {tRow.name} ({tRow.code})
                  </option>
                ))}
              </select>
            </div>
          )}
          <Badge variant="success" className="font-bold gap-1 px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t('scale20Active')}</span>
          </Badge>
        </div>
      </div>

      {/* Top Stat Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-xs flex items-center justify-between hover:border-slate-300 transition-all">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiExamSessions')}</span>
            <h3 className="text-xl font-extrabold text-[#16212B] mt-1">{t('kpiSessionsCount', { count: terms.length })}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0066FF] flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-xs flex items-center justify-between hover:border-slate-300 transition-all">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiHallsCapacity')}</span>
            <h3 className="text-xl font-extrabold text-[#16212B] mt-1">{t('kpiHallsCountWithSeats', { halls: halls.length, seats: totalHallCapacity })}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Building className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-xs flex items-center justify-between hover:border-slate-300 transition-all">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiPlannedExams')}</span>
            <h3 className="text-xl font-extrabold text-[#16212B] mt-1">{t('kpiSchedulesCount', { count: schedules.length })}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-xs flex items-center justify-between hover:border-slate-300 transition-all">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiRegisteredCandidates')}</span>
            <h3 className="text-xl font-extrabold text-[#16212B] mt-1">{t('kpiCandidatesCount', { count: students.length })}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Workflow stage of the selected term */}
      {stage && (
        <div className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-xs space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {stage.stages.map((s, i) => {
                const current = s.stage === stage.stage;
                const done = i < stage.stages.findIndex(x => x.stage === stage.stage);
                return (
                  <div key={s.stage} className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-colors ${
                      current
                        ? 'bg-[#0066FF] text-white shadow-2xs'
                        : done ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                    }`}
                    >
                      {done ? `✓ ${s.label}` : s.label}
                    </span>
                    {i < stage.stages.length - 1 && <ArrowRight className="w-3 h-3 text-slate-300 rtl:rotate-180" />}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              {stage.stage !== 'setup' && stage.stage !== 'closed' && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={advancing}
                  onClick={() => void rollBackStage()}
                  className="h-9 rounded-xl text-xs font-bold gap-1.5 cursor-pointer hover:bg-slate-50"
                >
                  <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
                  {t('rollbackStageAction')}
                </Button>
              )}
              {stage.nextStage && (
                <Button
                  size="sm"
                  disabled={advancing || !stage.canAdvance}
                  onClick={() => void advanceStage()}
                  title={stage.blockedReason ?? undefined}
                  className="h-9 rounded-xl text-xs font-bold gap-1.5 bg-[#0066FF] hover:bg-[#0052CC] text-white cursor-pointer transition-all active:scale-[0.98]"
                >
                  {advancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {t('advanceToStageAction', { stage: STAGE_LABELS[stage.nextStage] })}
                  <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                </Button>
              )}
            </div>
          </div>

          {!stage.canAdvance && stage.blockedReason && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-[11px] font-bold text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span>{stage.blockedReason}</span>
            </div>
          )}

          {stageError && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] font-bold text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{stageError}</span>
            </div>
          )}
        </div>
      )}

      {/* Sequential Step Indicator Bar (§10.1) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('seats')}
          className={`p-4 rounded-2xl border text-start transition-all cursor-pointer flex items-center gap-3.5 ${
            activeTab === 'seats'
              ? 'bg-white border-[#0066FF] shadow-xs ring-2 ring-[#0066FF]/20'
              : 'bg-slate-50/70 border-slate-200 hover:bg-white text-slate-600'
          }`}
        >
          <div className={`w-9 h-9 rounded-xl font-extrabold text-xs flex items-center justify-center shrink-0 ${
            activeTab === 'seats' ? 'bg-[#0066FF] text-white shadow-2xs' : terms.length > 0 && halls.length > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
          }`}>
            {terms.length > 0 && halls.length > 0 ? <Check className="w-4 h-4" /> : '1'}
          </div>
          <div>
            <div className="text-xs font-bold text-[#16212B] flex items-center gap-1.5">
              {t('step1Title')}
              {terms.length > 0 && halls.length > 0 && <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]">{t('step1Ready')}</Badge>}
            </div>
            <p className="text-[11px] text-slate-400">{t('step1Desc')}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('schedules')}
          className={`p-4 rounded-2xl border text-start transition-all cursor-pointer flex items-center gap-3.5 ${
            activeTab === 'schedules'
              ? 'bg-white border-[#0066FF] shadow-xs ring-2 ring-[#0066FF]/20'
              : 'bg-slate-50/70 border-slate-200 hover:bg-white text-slate-600'
          }`}
        >
          <div className={`w-9 h-9 rounded-xl font-extrabold text-xs flex items-center justify-center shrink-0 ${
            activeTab === 'schedules' ? 'bg-[#0066FF] text-white shadow-2xs' : schedules.length > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
          }`}>
            {schedules.length > 0 ? <Check className="w-4 h-4" /> : '2'}
          </div>
          <div>
            <div className="text-xs font-bold text-[#16212B] flex items-center gap-1.5">
              {t('step2Title')}
              {schedules.length > 0 && <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]">{t('step2FixedCount', { count: schedules.length })}</Badge>}
            </div>
            <p className="text-[11px] text-slate-400">{t('step2Desc')}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('marksheet')}
          className={`p-4 rounded-2xl border text-start transition-all cursor-pointer flex items-center gap-3.5 ${
            activeTab === 'marksheet'
              ? 'bg-white border-[#0066FF] shadow-xs ring-2 ring-[#0066FF]/20'
              : 'bg-slate-50/70 border-slate-200 hover:bg-white text-slate-600'
          }`}
        >
          <div className={`w-9 h-9 rounded-xl font-extrabold text-xs flex items-center justify-center shrink-0 ${
            activeTab === 'marksheet' ? 'bg-[#0066FF] text-white shadow-2xs' : gradedScores.length > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
          }`}>
            {gradedScores.length > 0 ? <Check className="w-4 h-4" /> : '3'}
          </div>
          <div>
            <div className="text-xs font-bold text-[#16212B] flex items-center gap-1.5">
              {t('step3Title')}
              <Badge className="bg-[#0066FF]/10 text-[#0066FF] border-none text-[9px]">{t('step3BadgeFast')}</Badge>
            </div>
            <p className="text-[11px] text-slate-400">{t('step3Desc')}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('calendar')}
          className={`p-4 rounded-2xl border text-start transition-all cursor-pointer flex items-center gap-3.5 ${
            activeTab === 'calendar'
              ? 'bg-white border-[#0066FF] shadow-xs ring-2 ring-[#0066FF]/20'
              : 'bg-slate-50/70 border-slate-200 hover:bg-white text-slate-600'
          }`}
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            activeTab === 'calendar' ? 'bg-[#0066FF] text-white shadow-2xs' : 'bg-slate-200 text-slate-600'
          }`}>
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#16212B]">{t('calendarTabTitle')}</div>
            <p className="text-[11px] text-slate-400">{t('calendarTabDesc')}</p>
          </div>
        </button>
      </div>

      {activeTab === 'calendar' && <ExamPlanningClient locale={locale} embedded />}

      {/* STEP 1: Salles & Sessions */}
      {activeTab === 'seats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
              <h2 className="text-sm font-extrabold text-[#16212B] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#0066FF]" />
                {t('createSessionTitle')}
              </h2>
              {termError && <p className="text-rose-600 text-xs font-bold">{termError}</p>}
              {termSuccess && <p className="text-emerald-600 text-xs font-bold flex items-center gap-1"><Check className="w-3.5 h-3.5" />{termSuccess}</p>}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Input placeholder={t('sessionNamePlaceholder')} value={newTermName} onChange={e => setNewTermName(e.target.value)} className="rounded-xl h-9 col-span-2 text-start" />
                <Input placeholder={t('sessionCodePlaceholder')} value={newTermCode} onChange={e => setNewTermCode(e.target.value)} className="rounded-xl h-9 col-span-2 text-start font-mono" />
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">{t('startDateLabel')}</label>
                  <Input type="date" value={newTermStart} onChange={e => setNewTermStart(e.target.value)} className="rounded-xl h-9" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">{t('endDateLabel')}</label>
                  <Input type="date" value={newTermEnd} onChange={e => setNewTermEnd(e.target.value)} className="rounded-xl h-9" />
                </div>
              </div>
              <Button onClick={handleCreateTerm} disabled={creatingTerm} size="sm" className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl gap-1.5 cursor-pointer transition-all active:scale-[0.98]">
                {creatingTerm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{t('createSessionBtn')}</span>
              </Button>
            </Card>

            <Card className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-[#16212B] flex items-center gap-2">
                  <Building className="w-4 h-4 text-[#0066FF]" />
                  {t('createHallTitle')}
                </h2>
                <Badge variant="neutral" className="text-[9px] font-bold">{t('institutionRegisterBadge')}</Badge>
              </div>
              {hallError && <p className="text-rose-600 text-xs font-bold">{hallError}</p>}
              {hallSuccess && <p className="text-emerald-600 text-xs font-bold flex items-center gap-1"><Check className="w-3.5 h-3.5" />{hallSuccess}</p>}

              {physicalRooms.length > 0 && (
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">
                    {t('importFromPhysicalRooms')}
                  </label>
                  <select
                    onChange={(e) => {
                      const selected = physicalRooms.find(r => r.id === e.target.value);
                      if (selected) {
                        setNewHallName(selected.name);
                        setNewHallCode(selected.name.toUpperCase().replace(/\s+/g, '-').slice(0, 10));
                        setNewHallCapacity(String(selected.capacity || 30));
                      }
                    }}
                    className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700 cursor-pointer"
                  >
                    <option value="">{t('choosePhysicalRoomOption')}</option>
                    {physicalRooms.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.capacity ? `(${r.capacity} pl.)` : ''} {r.roomType ? `· ${r.roomType}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                <Input placeholder={t('hallNamePlaceholder')} value={newHallName} onChange={e => setNewHallName(e.target.value)} className="rounded-xl h-9 text-start" />
                <Input placeholder={t('hallCodePlaceholder')} value={newHallCode} onChange={e => setNewHallCode(e.target.value)} className="rounded-xl h-9 text-start font-mono" />
                <div className="col-span-2">
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">{t('seatingCapacityLabel')}</label>
                  <Input type="number" placeholder={t('seatingCapacityLabel')} value={newHallCapacity} onChange={e => setNewHallCapacity(e.target.value)} className="rounded-xl h-9 text-start" />
                </div>
              </div>
              <Button onClick={handleCreateHall} disabled={creatingHall} size="sm" className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl gap-1.5 cursor-pointer transition-all active:scale-[0.98]">
                {creatingHall ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{t('createHallBtn')}</span>
              </Button>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4">
              <h2 className="text-sm font-extrabold text-[#16212B] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#0066FF]" />
                {t('autoSeatAllocationTitle')}
              </h2>
              {allocationError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{allocationError}</span>
                </div>
              )}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700">{t('selectSessionLabel')}</label>
                  <select value={selectedTermId} onChange={e => setSelectedTermId(e.target.value)} className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 font-medium bg-white cursor-pointer">
                    <option value="">{t('chooseSessionOption')}</option>
                    {terms.map(tRow => <option key={tRow.id} value={tRow.id}>{tRow.name} ({tRow.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700">{t('hallsToIncludeLabel')}</label>
                  <div className="mt-1 space-y-1.5 max-h-48 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50">
                    {halls.map(h => (
                      <label key={h.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedHallIds.includes(h.id)}
                          onChange={(e) => {
                            setSelectedHallIds(e.target.checked ? [...selectedHallIds, h.id] : selectedHallIds.filter(id => id !== h.id));
                          }}
                          className="rounded text-[#0066FF] cursor-pointer"
                        />
                        <span className="font-medium text-slate-800">{h.name}</span>
                        <Badge variant="neutral" className="text-[10px] ms-auto">{h.capacity} pl.</Badge>
                      </label>
                    ))}
                    {halls.length === 0 && <p className="text-slate-400 text-xs py-2 text-center">{t('noHallsAvailable')}</p>}
                  </div>
                </div>
                <Button
                  onClick={handleAllocateSeats}
                  disabled={allocating || !selectedTermId || selectedHallIds.length === 0}
                  className="w-full bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold rounded-xl shadow-xs mt-2 cursor-pointer transition-all active:scale-[0.98]"
                >
                  {allocating ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('distributingSeats')}
                    </span>
                  ) : (
                    t('distributeSeatsBtn')
                  )}
                </Button>
              </div>
            </Card>

            <Card className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-[#16212B]">{t('configuredHallsTitle', { count: halls.length })}</h2>
                <Badge variant="success" className="font-bold bg-emerald-50 text-emerald-700 border-emerald-200">{t('availableSeatsBadge', { count: totalHallCapacity })}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {halls.map(h => (
                  <div key={h.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1 hover:bg-white hover:border-slate-300 transition-all">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-[#16212B] text-xs">{h.name}</h4>
                      <Badge className="bg-blue-50 text-[#0066FF] border border-blue-200 text-[10px]">{h.capacity} pl.</Badge>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">{t('codeLabelPrefix', { code: h.code })}</p>
                  </div>
                ))}
                {halls.length === 0 && <p className="text-xs text-slate-400 col-span-2 py-6 text-center">{t('noHallsCreatedYet')}</p>}
              </div>
              {allocationResult && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {t('allocationSuccessNotice', { allocated: allocationResult.allocatedCount })}{' '}
                    {allocationResult.unallocatedCount > 0 && t('unallocatedWarningNotice', { unallocated: allocationResult.unallocatedCount })}
                  </span>
                </div>
              )}
            </Card>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => setActiveTab('schedules')}
              className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl gap-2 cursor-pointer transition-all active:scale-[0.98]"
            >
              <span>{t('goToStep2Btn')}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: Planification des Épreuves */}
      {activeTab === 'schedules' && (
        <div className="space-y-6">
          {stepLocked('schedule_exam') && (
            <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-amber-900 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{t('stageRequirementNotice', { stage: STAGE_LABELS.scheduling })}</span>
              </div>
              {stage?.canAdvance && stage.nextStage === 'scheduling' && (
                <Button
                  size="sm"
                  onClick={() => void advanceStage()}
                  disabled={advancing}
                  className="h-7 text-[11px] px-3 font-bold bg-[#0066FF] hover:bg-[#0052CC] text-white rounded-lg shrink-0 cursor-pointer"
                >
                  {t('advanceToStageAction', { stage: STAGE_LABELS.scheduling })}
                </Button>
              )}
            </div>
          )}

          <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4">
            <h2 className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#0066FF]" />
              {t('scheduleExamTitle')}
            </h2>
            {scheduleError && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">{scheduleError}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">{t('kpiExamSessions')}</label>
                <select value={selectedTermId} onChange={e => setSelectedTermId(e.target.value)} className="w-full p-2 rounded-xl border border-slate-200 font-medium bg-white h-9 cursor-pointer">
                  <option value="">{t('chooseSessionOption')}</option>
                  {terms.map(tRow => <option key={tRow.id} value={tRow.id}>{tRow.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">{t('selectedAssessmentToGrade')}</label>
                <EpreuveCombobox
                  definitions={definitions}
                  value={scheduleDefId}
                  onChange={setScheduleDefId}
                  placeholder={t('chooseAssessmentToGradePlaceholder')}
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">{t('createHallTitle')}</label>
                <select value={scheduleHallId} onChange={e => setScheduleHallId(e.target.value)} className="w-full p-2 rounded-xl border border-slate-200 font-medium bg-white h-9 cursor-pointer">
                  <option value="">{t('allOrUnassignedHall')}</option>
                  {halls.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">{t('startExamLabel')}</label>
                <Input type="datetime-local" value={scheduleStart} onChange={e => setScheduleStart(e.target.value)} className="rounded-xl h-9" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">{t('endExamLabel')}</label>
                <Input type="datetime-local" value={scheduleEnd} onChange={e => setScheduleEnd(e.target.value)} className="rounded-xl h-9" />
              </div>
            </div>
            <Button
              onClick={handleCreateSchedule}
              disabled={stepLocked('schedule_exam')}
              className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl gap-1.5 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('validateTimeslotBtn')}</span>
            </Button>
          </Card>

          <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4">
            <h2 className="text-base font-extrabold text-[#16212B]">{t('scheduledExamsPlanningTitle', { count: schedules.length })}</h2>
            <div className="space-y-3">
              {schedules.map(s => (
                <div key={s.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs hover:bg-white hover:border-slate-300 transition-all">
                  <div className="space-y-1 text-start">
                    <Badge variant="info" className="text-[10px] bg-blue-50 text-[#0066FF] border border-blue-200 font-mono">
                      <Clock className="w-3 h-3 me-1 inline-block" />
                      {new Date(s.startTime).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} - {new Date(s.endTime).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </Badge>
                    <p className="text-xs font-bold text-slate-800">
                      {definitions.find(d => d.id === s.assessmentDefinitionId)?.title ?? s.assessmentDefinitionId}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAssessmentDefinitionId(s.assessmentDefinitionId);
                        setActiveTab('marksheet');
                        void loadMarksheet(s.assessmentDefinitionId, selectedTermId);
                      }}
                      className="h-8 text-xs rounded-xl border-slate-200 bg-white text-[#0066FF] hover:bg-blue-50 font-bold gap-1 cursor-pointer transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      {t('enterMarksActionBtn')}
                    </Button>
                    <Badge variant={s.status === 'published' ? 'success' : 'info'} className="font-bold">
                      {s.status === 'published' ? tStatus('published') : s.status}
                    </Badge>
                  </div>
                </div>
              ))}
              {schedules.length === 0 && <p className="text-xs text-slate-400 py-6 text-center">{t('noExamScheduledYet')}</p>}
            </div>
          </Card>

          <div className="flex justify-between pt-2">
            <Button
              variant="outline"
              onClick={() => setActiveTab('seats')}
              className="border-slate-200 text-xs rounded-xl gap-2 cursor-pointer hover:bg-slate-50"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              <span>{t('backToStep1Btn')}</span>
            </Button>
            <Button
              onClick={() => setActiveTab('marksheet')}
              className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl gap-2 cursor-pointer transition-all active:scale-[0.98]"
            >
              <span>{t('goToStep3Btn')}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Grille de Saisie des Notes (§10.4) */}
      {activeTab === 'marksheet' && (
        <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-6">
          {stepLocked('enter_marks') && (
            <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-amber-900 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{t('stageRequirementNotice', { stage: STAGE_LABELS.valuation })}</span>
              </div>
              {stage?.canAdvance && stage.nextStage === 'valuation' && (
                <Button
                  size="sm"
                  onClick={() => void advanceStage()}
                  disabled={advancing}
                  className="h-7 text-[11px] px-3 font-bold bg-[#0066FF] hover:bg-[#0052CC] text-white rounded-lg shrink-0 cursor-pointer"
                >
                  {t('advanceToStageAction', { stage: STAGE_LABELS.valuation })}
                </Button>
              )}
            </div>
          )}

          {/* Header & Definition Selector */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex-1 max-w-md">
              <label className="text-xs font-bold text-slate-700 block mb-1">{t('selectedAssessmentToGrade')}</label>
              <EpreuveCombobox
                definitions={definitions}
                value={assessmentDefinitionId}
                onChange={setAssessmentDefinitionId}
                placeholder={t('chooseAssessmentToGradePlaceholder')}
              />
              {activeDefInfo && (
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  <Badge variant="neutral" className="text-[10px] font-bold bg-slate-100 text-slate-700 border-slate-200">
                    {t('coefficientBadge', { coef: activeDefInfo.coefficient })}
                  </Badge>
                  <Badge variant="neutral" className="text-[10px] font-bold bg-slate-100 text-slate-700 border-slate-200">
                    {t('passMarkBadge', { mark: activeDefInfo.passMark })}
                  </Badge>
                  <Badge variant="neutral" className="text-[10px] font-bold bg-slate-100 text-slate-700 border-slate-200">
                    Max: {activeDefInfo.maximumScore}/20
                  </Badge>
                </div>
              )}
              <p className="text-[11px] text-slate-400 mt-1">
                {t('marksheetKeyboardHint')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder={t('searchStudentOrMatriculePlaceholder')}
                  value={searchRoster}
                  onChange={e => setSearchRoster(e.target.value)}
                  className="ps-9 text-xs rounded-xl h-9 w-64 border-slate-200 text-start"
                />
              </div>
              <Button
                onClick={handleSaveMarks}
                disabled={saving || !assessmentDefinitionId}
                className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl shadow-xs gap-1.5 px-4 cursor-pointer transition-all active:scale-[0.98]"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{saving ? t('savingMarksheet') : t('saveMarksheetBtn')}</span>
              </Button>
            </div>
          </div>

          {/* Real-time KPI Bar on the current Marksheet */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">{t('classAverageKpi')}</span>
              <div className="text-base font-extrabold text-[#0066FF] font-mono">{averageScore} /20</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">{t('passRateKpi')}</span>
              <div className="text-base font-extrabold text-emerald-600 font-mono">{passRate}% (≥10/20)</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">{t('maxScoreKpi')}</span>
              <div className="text-base font-extrabold text-slate-800 font-mono">{maxScore} /20</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">{t('minScoreKpi')}</span>
              <div className="text-base font-extrabold text-slate-800 font-mono">{minScore} /20</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">{t('gradedStudentsKpi')}</span>
              <div className="text-base font-extrabold text-slate-700 font-mono">{gradedScores.length} / {marks.length}</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">{t('absencesCountKpi')}</span>
              <div className="text-base font-extrabold text-rose-600 font-mono">{absentCount}</div>
            </div>
          </div>

          {/* Quick-Fill Toolbar & Bulk Actions (§10.4) */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-blue-100 bg-blue-50/50">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#16212B] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#0066FF]" />
                {t('bulkFillGroup')}
              </span>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min="0"
                  max="20"
                  step="0.5"
                  value={defaultGradeValue}
                  onChange={e => setDefaultGradeValue(e.target.value)}
                  className="w-16 h-8 text-xs font-bold rounded-lg border-slate-200 bg-white"
                  placeholder="Note"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkFillEmpty}
                  className="h-8 text-xs rounded-lg border-blue-200 bg-white text-[#0066FF] hover:bg-blue-50 font-bold cursor-pointer transition-colors"
                >
                  {t('applyToEmptyCasesBtn')}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkSetStatus('graded')}
                className="h-8 text-xs rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-100 font-medium cursor-pointer transition-colors"
              >
                {t('allPresentBtn')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkSetStatus('absent')}
                className="h-8 text-xs rounded-lg border-slate-200 bg-white text-rose-600 hover:bg-rose-50 font-medium cursor-pointer transition-colors"
              >
                {t('allAbsentBtn')}
              </Button>
              {confirmClearOpen ? (
                <div className="flex items-center gap-1.5 p-1 bg-rose-50 border border-rose-200 rounded-lg">
                  <span className="text-[11px] font-bold text-rose-700 px-1.5">{t('confirmClearScores')}</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      handleClearAllScores();
                      setConfirmClearOpen(false);
                    }}
                    className="h-6 text-[10px] px-2 rounded-md bg-rose-600 text-white font-bold cursor-pointer"
                  >
                    {tCommon('confirm') || 'Oui'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmClearOpen(false)}
                    className="h-6 text-[10px] px-2 rounded-md text-slate-600 cursor-pointer"
                  >
                    {t('cancelAction')}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmClearOpen(true)}
                  className="h-8 text-xs rounded-lg border-slate-200 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-600 font-medium gap-1 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  {t('clearAllScoresBtn')}
                </Button>
              )}
            </div>
          </div>

          {/* Feedback messages */}
          {saveError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}
          {savedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{t('marksheetSavedSuccess')}</span>
            </div>
          )}

          {/* Marksheet Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            {loadingMarksheet ? (
              <div className="p-12 flex flex-col items-center justify-center gap-2 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-[#0066FF]" />
                <span className="text-xs font-bold">{t('marksheetLoading')}</span>
              </div>
            ) : (
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 font-extrabold text-[#16212B]">
                  <tr>
                    <th className="p-3.5 w-32 text-start">{t('matriculeCol')}</th>
                    <th className="p-3.5 text-start">{t('candidateStudentCol')}</th>
                    <th className="p-3.5 w-44 text-start">{t('attendanceStatusCol')}</th>
                    <th className="p-3.5 w-36 text-start">{t('scoreOutOf20Col')}</th>
                    <th className="p-3.5 w-48 text-start">{t('autoMentionMoroccoCol')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRoster.map((row, filteredIdx) => {
                    const globalIdx = marks.findIndex(m => m.studentId === row.studentId);
                    const isFocused = focusedRowIndex === filteredIdx;
                    return (
                      <tr
                        key={row.studentId}
                        className={cn(
                          'transition-colors',
                          isFocused ? 'bg-blue-50/60 ring-1 ring-[#0066FF]/20' : 'hover:bg-slate-50/70'
                        )}
                      >
                        <td className="p-3.5 font-mono font-bold text-slate-600">{row.matricule}</td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-[#0066FF]/10 text-[#0066FF] font-bold flex items-center justify-center text-[10px]">
                              {row.name.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="font-bold text-[#16212B]">{row.name}</span>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <select
                            value={row.status}
                            onChange={e => handleStatusChange(globalIdx, e.target.value as MarkRow['status'])}
                            className="p-1.5 text-xs rounded-lg border border-slate-200 font-medium bg-white w-full cursor-pointer focus:ring-2 focus:ring-[#0066FF]"
                          >
                            <option value="graded">{t('presentGradedOption')}</option>
                            <option value="absent">{t('absentOption')}</option>
                            <option value="exempted">{t('exemptedOption')}</option>
                            <option value="withheld">{t('withheldOption')}</option>
                          </select>
                        </td>
                        <td className="p-3.5">
                          <Input
                            ref={el => { gradeInputRefs.current[filteredIdx] = el; }}
                            type="number"
                            step="0.5"
                            min="0"
                            max="20"
                            disabled={row.status !== 'graded'}
                            value={row.rawScore}
                            placeholder={row.status === 'graded' ? '15.5' : '—'}
                            onChange={e => handleScoreChange(globalIdx, e.target.value)}
                            onKeyDown={e => handleKeyDown(e, filteredIdx, filteredRoster.length)}
                            onFocus={e => {
                              setFocusedRowIndex(filteredIdx);
                              e.target.select();
                            }}
                            onBlur={() => setFocusedRowIndex(null)}
                            className="w-28 text-xs font-extrabold rounded-lg border-slate-200 text-[#0066FF] font-mono focus:ring-2 focus:ring-[#0066FF] text-start bg-white"
                          />
                        </td>
                        <td className="p-3.5">
                          {getMentionBadge(row.grade, row.status)}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRoster.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 font-semibold">
                        {t('noStudentsLoadedForSession')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="text-[11px] text-slate-500 flex items-center gap-2">
              <HelpCircle className="w-3.5 h-3.5 text-[#0066FF]" />
              <span>
                Astuce : Tapez la note puis appuyez sur <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 border border-slate-300 rounded text-slate-700 shadow-2xs">Entrée</kbd> ou <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 border border-slate-300 rounded text-slate-700 shadow-2xs">↓</kbd> pour passer au candidat suivant.
              </span>
            </div>
            <Button
              onClick={handleSaveMarks}
              disabled={saving || !assessmentDefinitionId}
              className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl shadow-xs gap-1.5 px-5 cursor-pointer transition-all active:scale-[0.98]"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? t('savingMarksheet') : t('saveMarksheetBtn')}</span>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
