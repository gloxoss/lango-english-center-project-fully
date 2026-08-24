'use client';

import { useEffect, useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { getMoroccanMention, type MentionType } from '@/libs/grading/moroccan-grade-engine';
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
  Grid,
  FileSpreadsheet,
  Check,
  ChevronsUpDown,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  RotateCcw,
  TrendingUp,
  Percent,
  Award,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

type ExamTerm = { id: string; name: string; code: string; startDate: string; endDate: string; status: string };
type ExamHall = { id: string; name: string; code: string; capacity: number };
type ExamSchedule = { id: string; examTermId: string; assessmentDefinitionId: string; examHallId: string | null; startTime: string; endTime: string; status: string };
type StudentRow = { id: string; fullName: string; matricule: string };
type MarkRow = { studentId: string; matricule: string; name: string; rawScore: string; status: 'graded' | 'absent' | 'exempted' | 'withheld'; grade?: string };
type AssessmentDefinition = { id: string; title: string };

function EpreuveCombobox({ definitions, value, onChange, placeholder }: {
  definitions: AssessmentDefinition[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = definitions.find(d => d.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className="w-full flex items-center justify-between gap-2 h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-[#16212B] hover:bg-slate-50"
        >
          <span className="truncate">{selected ? selected.title : placeholder}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher une épreuve..." />
          <CommandList>
            <CommandEmpty>Aucune épreuve trouvée.</CommandEmpty>
            <CommandGroup>
              {definitions.map(d => (
                <CommandItem
                  key={d.id}
                  value={d.title}
                  onSelect={() => { onChange(d.id); setOpen(false); }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === d.id ? 'opacity-100' : 'opacity-0')} />
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
  // Sequential 3-step flow (§10.1): 1. seats -> 2. schedules -> 3. marksheet
  const [activeTab, setActiveTab] = useState<'seats' | 'schedules' | 'marksheet'>('seats');

  const [terms, setTerms] = useState<ExamTerm[]>([]);
  const [halls, setHalls] = useState<ExamHall[]>([]);
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selectedTermId, setSelectedTermId] = useState('');
  const [selectedHallIds, setSelectedHallIds] = useState<string[]>([]);

  const [allocationResult, setAllocationResult] = useState<{ allocatedCount: number; unallocatedCount: number } | null>(null);
  const [allocating, setAllocating] = useState(false);

  const [assessmentDefinitionId, setAssessmentDefinitionId] = useState('');
  const [searchRoster, setSearchRoster] = useState('');
  const [marks, setMarks] = useState<MarkRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Bulk fill popover state
  const [defaultGradeValue, setDefaultGradeValue] = useState('10');

  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleEnd, setScheduleEnd] = useState('');
  const [scheduleHallId, setScheduleHallId] = useState('');
  const [scheduleDefId, setScheduleDefId] = useState('');
  const [scheduleError, setScheduleError] = useState('');

  const [newTermName, setNewTermName] = useState('');
  const [newTermCode, setNewTermCode] = useState('');
  const [newTermStart, setNewTermStart] = useState('');
  const [newTermEnd, setNewTermEnd] = useState('');
  const [newHallName, setNewHallName] = useState('');
  const [newHallCode, setNewHallCode] = useState('');
  const [newHallCapacity, setNewHallCapacity] = useState('30');
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
    loadTerms();
    loadHalls();
    loadSchedules();
    loadStudents();
    loadDefinitions();
    loadPhysicalRooms();
  }, []);

  useEffect(() => {
    if (students.length > 0 && marks.length === 0) {
      setMarks(students.map(s => ({ studentId: s.id, matricule: s.matricule, name: s.fullName, rawScore: '', status: 'graded' })));
    }
  }, [students]);

  // If terms are loaded and none selected, auto-select first
  useEffect(() => {
    if (terms.length > 0 && terms[0] && !selectedTermId) {
      setSelectedTermId(terms[0].id);
    }
  }, [terms, selectedTermId]);

  // Live Mention Computation using Moroccan Educational Scale (/20)
  const computeMention = (scoreStr: string, status: MarkRow['status']): string => {
    if (status === 'absent') return 'Absent';
    if (status === 'exempted') return 'Exempté';
    if (status === 'withheld') return 'Note Retenue';
    if (!scoreStr.trim()) return '-';
    const num = Number.parseFloat(scoreStr);
    if (Number.isNaN(num) || num < 0 || num > 20) return 'Invalide';
    return getMoroccanMention(num);
  };

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

  // Keyboard navigation handler (§10.4)
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

  // Bulk Actions (§10.4)
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
      setSaveError('Veuillez sélectionner une épreuve.');
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
            rawScore: m.status === 'graded' ? Number.parseFloat(m.rawScore) || 0 : undefined,
            status: m.status,
          })),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setSaveError(json.error?.message || 'Échec de l\'enregistrement.');
        return;
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleAllocateSeats = async () => {
    if (!selectedTermId || selectedHallIds.length === 0) {
      return;
    }
    setAllocating(true);
    try {
      const res = await fetch(`/api/academics/exam-terms/${selectedTermId}/seat-allocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentIds: students.map(s => s.id), examHallIds: selectedHallIds }),
      });
      const json = await res.json();
      if (json.success) {
        setAllocationResult({ allocatedCount: json.data.allocatedCount, unallocatedCount: json.data.unallocatedCount });
      }
    } finally {
      setAllocating(false);
    }
  };

  const handleCreateSchedule = async () => {
    if (!selectedTermId || !scheduleDefId || !scheduleStart || !scheduleEnd) {
      setScheduleError('Session, épreuve, heure de début et heure de fin sont requis.');
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
    if (!json.success) {
      setScheduleError(json.error?.message || 'Échec de la planification.');
      return;
    }
    loadSchedules();
    setScheduleDefId('');
    setScheduleStart('');
    setScheduleEnd('');
  };

  const handleCreateTerm = async () => {
    if (!newTermName.trim() || !newTermCode.trim() || !newTermStart || !newTermEnd) return;
    const res = await fetch('/api/academics/exam-terms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTermName.trim(), code: newTermCode.trim(), startDate: newTermStart, endDate: newTermEnd }),
    });
    const json = await res.json();
    if (json.success) {
      setNewTermName('');
      setNewTermCode('');
      loadTerms();
    }
  };

  const handleCreateHall = async () => {
    if (!newHallName.trim() || !newHallCode.trim()) return;
    const res = await fetch('/api/academics/exam-halls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newHallName.trim(), code: newHallCode.trim(), capacity: Number.parseInt(newHallCapacity, 10) || 30 }),
    });
    const json = await res.json();
    if (json.success) {
      setNewHallName('');
      setNewHallCode('');
      loadHalls();
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
      return <Badge className="bg-rose-100 text-rose-700 border-none font-bold text-[10px]">Absent</Badge>;
    }
    if (status === 'exempted') {
      return <Badge className="bg-slate-100 text-slate-600 border-none font-bold text-[10px]">Exempté</Badge>;
    }
    if (status === 'withheld') {
      return <Badge className="bg-orange-100 text-orange-700 border-none font-bold text-[10px]">Note Retenue</Badge>;
    }
    if (!gradeStr || gradeStr === '-') {
      return <span className="text-slate-400 text-xs font-mono">—</span>;
    }
    switch (gradeStr) {
      case 'Très Bien':
        return <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold text-[10px]">Très Bien (≥ 16)</Badge>;
      case 'Bien':
        return <Badge className="bg-blue-100 text-blue-700 border-none font-bold text-[10px]">Bien (14-16)</Badge>;
      case 'Assez Bien':
        return <Badge className="bg-purple-100 text-purple-700 border-none font-bold text-[10px]">Assez Bien (12-14)</Badge>;
      case 'Passable':
        return <Badge className="bg-amber-100 text-amber-700 border-none font-bold text-[10px]">Passable (10-12)</Badge>;
      case 'Insuffisant':
        return <Badge className="bg-rose-100 text-rose-700 border-none font-bold text-[10px]">Insuffisant (&lt; 10)</Badge>;
      default:
        return <Badge variant="neutral" className="font-bold text-[10px]">{gradeStr}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0066FF] to-[#0052CC] flex items-center justify-center text-white shadow-2xs shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Exam Master & Saisie des Notes</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Processus séquentiel : Configuration des salles &rarr; Calendrier des épreuves &rarr; Grille de notation rapide au clavier avec calcul automatique des mentions.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="success" className="font-bold gap-1 px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Échelle Nationale /20 Active</span>
          </Badge>
        </div>
      </div>

      {/* Top Stat Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sessions d'Examen</span>
            <h3 className="text-xl font-extrabold text-[#16212B] mt-1">{terms.length} Session(s)</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0066FF] flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Salles & Capacités</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{halls.length} Salles ({totalHallCapacity} pl.)</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Building className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Épreuves Planifiées</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{schedules.length} Planification(s)</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Élèves Inscrits</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{students.length} Candidats</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Sequential Step Indicator Bar (§10.1) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('seats')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3.5 ${
            activeTab === 'seats'
              ? 'bg-white border-[#0066FF] shadow-sm ring-2 ring-[#0066FF]/20'
              : 'bg-slate-50 border-slate-200 hover:bg-white text-slate-600'
          }`}
        >
          <div className={`w-8 h-8 rounded-xl font-extrabold text-xs flex items-center justify-center shrink-0 ${
            activeTab === 'seats' ? 'bg-[#0066FF] text-white' : terms.length > 0 && halls.length > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
          }`}>
            {terms.length > 0 && halls.length > 0 ? <Check className="w-4 h-4" /> : '1'}
          </div>
          <div>
            <div className="text-xs font-bold text-[#16212B] flex items-center gap-1.5">
              1. Sessions & Salles
              {terms.length > 0 && halls.length > 0 && <Badge className="bg-emerald-100 text-emerald-700 border-none text-[9px]">Prêt</Badge>}
            </div>
            <p className="text-[11px] text-slate-400">Création des sessions, salles et places</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('schedules')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3.5 ${
            activeTab === 'schedules'
              ? 'bg-white border-[#0066FF] shadow-sm ring-2 ring-[#0066FF]/20'
              : 'bg-slate-50 border-slate-200 hover:bg-white text-slate-600'
          }`}
        >
          <div className={`w-8 h-8 rounded-xl font-extrabold text-xs flex items-center justify-center shrink-0 ${
            activeTab === 'schedules' ? 'bg-[#0066FF] text-white' : schedules.length > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
          }`}>
            {schedules.length > 0 ? <Check className="w-4 h-4" /> : '2'}
          </div>
          <div>
            <div className="text-xs font-bold text-[#16212B] flex items-center gap-1.5">
              2. Planification des Épreuves
              {schedules.length > 0 && <Badge className="bg-emerald-100 text-emerald-700 border-none text-[9px]">{schedules.length} fixée(s)</Badge>}
            </div>
            <p className="text-[11px] text-slate-400">Attribution des créneaux et épreuves</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('marksheet')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3.5 ${
            activeTab === 'marksheet'
              ? 'bg-white border-[#0066FF] shadow-sm ring-2 ring-[#0066FF]/20'
              : 'bg-slate-50 border-slate-200 hover:bg-white text-slate-600'
          }`}
        >
          <div className={`w-8 h-8 rounded-xl font-extrabold text-xs flex items-center justify-center shrink-0 ${
            activeTab === 'marksheet' ? 'bg-[#0066FF] text-white' : gradedScores.length > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
          }`}>
            {gradedScores.length > 0 ? <Check className="w-4 h-4" /> : '3'}
          </div>
          <div>
            <div className="text-xs font-bold text-[#16212B] flex items-center gap-1.5">
              3. Grille de Saisie des Notes
              <Badge className="bg-[#0066FF]/10 text-[#0066FF] border-none text-[9px]">Saisie Rapide</Badge>
            </div>
            <p className="text-[11px] text-slate-400">Navigation clavier &amp; mentions en direct</p>
          </div>
        </button>
      </div>

      {/* STEP 1: Salles & Sessions */}
      {activeTab === 'seats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3">
              <h2 className="text-sm font-extrabold text-[#16212B] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#0066FF]" />
                Créer une Session d'Examen
              </h2>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Input placeholder="Nom (ex: Semestre 1 - Examen Final)" value={newTermName} onChange={e => setNewTermName(e.target.value)} className="rounded-xl h-9 col-span-2" />
                <Input placeholder="Code (ex: S1-2026)" value={newTermCode} onChange={e => setNewTermCode(e.target.value)} className="rounded-xl h-9 col-span-2" />
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">Date Début</label>
                  <Input type="date" value={newTermStart} onChange={e => setNewTermStart(e.target.value)} className="rounded-xl h-9" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">Date Fin</label>
                  <Input type="date" value={newTermEnd} onChange={e => setNewTermEnd(e.target.value)} className="rounded-xl h-9" />
                </div>
              </div>
              <Button onClick={handleCreateTerm} size="sm" className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>Créer la Session</span>
              </Button>
            </Card>

            <Card className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-[#16212B] flex items-center gap-2">
                  <Building className="w-4 h-4 text-[#0066FF]" />
                  Créer une Salle d'Examen
                </h2>
                <Badge variant="neutral" className="text-[9px] font-bold">Registre Établissement</Badge>
              </div>

              {physicalRooms.length > 0 && (
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">
                    Importer depuis les salles de l&apos;établissement (§10.5)
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
                    className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700"
                  >
                    <option value="">-- Choisir une salle physique existante --</option>
                    {physicalRooms.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.capacity ? `(Capacité: ${r.capacity} places)` : ''} {r.roomType ? `· ${r.roomType}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                <Input placeholder="Nom de Salle (ex: Amphithéâtre Ibn Battouta)" value={newHallName} onChange={e => setNewHallName(e.target.value)} className="rounded-xl h-9" />
                <Input placeholder="Code Salle (ex: AMPHI-B)" value={newHallCode} onChange={e => setNewHallCode(e.target.value)} className="rounded-xl h-9" />
                <div className="col-span-2">
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">Capacité assise</label>
                  <Input type="number" placeholder="Capacité" value={newHallCapacity} onChange={e => setNewHallCapacity(e.target.value)} className="rounded-xl h-9" />
                </div>
              </div>
              <Button onClick={handleCreateHall} size="sm" className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>Créer la Salle</span>
              </Button>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
              <h2 className="text-sm font-extrabold text-[#16212B]">Attribution Automatique des Places</h2>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700">Sélectionner la Session</label>
                  <select value={selectedTermId} onChange={e => setSelectedTermId(e.target.value)} className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 font-medium bg-white">
                    <option value="">-- Choisir une session --</option>
                    {terms.map(t => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700">Salles à inclure</label>
                  <div className="mt-1 space-y-1.5 max-h-48 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50">
                    {halls.map(h => (
                      <label key={h.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedHallIds.includes(h.id)}
                          onChange={(e) => {
                            setSelectedHallIds(e.target.checked ? [...selectedHallIds, h.id] : selectedHallIds.filter(id => id !== h.id));
                          }}
                          className="rounded text-[#0066FF]"
                        />
                        <span className="font-medium text-slate-800">{h.name}</span>
                        <Badge variant="neutral" className="text-[10px] ml-auto">{h.capacity} places</Badge>
                      </label>
                    ))}
                    {halls.length === 0 && <p className="text-slate-400 text-xs py-2 text-center">Aucune salle disponible</p>}
                  </div>
                </div>
                <Button
                  onClick={handleAllocateSeats}
                  disabled={allocating || !selectedTermId || selectedHallIds.length === 0}
                  className="w-full bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold rounded-xl shadow-2xs mt-2"
                >
                  {allocating ? 'Attribution en cours...' : 'Distribuer les places'}
                </Button>
              </div>
            </Card>

            <Card className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-[#16212B]">Salles Configuréess ({halls.length})</h2>
                <Badge variant="success" className="font-bold bg-emerald-50 text-emerald-700">{totalHallCapacity} Places Disponibles</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {halls.map(h => (
                  <div key={h.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-[#16212B] text-xs">{h.name}</h4>
                      <Badge className="bg-blue-50 text-[#0066FF] border-blue-200 text-[10px]">{h.capacity} places</Badge>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">Code: {h.code}</p>
                  </div>
                ))}
                {halls.length === 0 && <p className="text-xs text-slate-400 col-span-2 py-6 text-center">Aucune salle créée pour le moment.</p>}
              </div>
              {allocationResult && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{allocationResult.allocatedCount} candidat(s) réparti(s) avec succès. {allocationResult.unallocatedCount > 0 && `${allocationResult.unallocatedCount} non attribué(s) (capacité insuffisante).`}</span>
                </div>
              )}
            </Card>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => setActiveTab('schedules')}
              className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl gap-2"
            >
              <span>Passer à l'Étape 2 : Planification</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: Planification des Épreuves */}
      {activeTab === 'schedules' && (
        <div className="space-y-6">
          <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
            <h2 className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#0066FF]" />
              Planifier une Épreuve
            </h2>
            {scheduleError && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">{scheduleError}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">Session d'Examen</label>
                <select value={selectedTermId} onChange={e => setSelectedTermId(e.target.value)} className="w-full p-2 rounded-xl border border-slate-200 font-medium bg-white h-9">
                  <option value="">Sélectionner une session</option>
                  {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">Épreuve</label>
                <EpreuveCombobox
                  definitions={definitions}
                  value={scheduleDefId}
                  onChange={setScheduleDefId}
                  placeholder="Sélectionner épreuve..."
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">Salle (Optionnel)</label>
                <select value={scheduleHallId} onChange={e => setScheduleHallId(e.target.value)} className="w-full p-2 rounded-xl border border-slate-200 font-medium bg-white h-9">
                  <option value="">Toutes / Non assignée</option>
                  {halls.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">Début Épreuve</label>
                <Input type="datetime-local" value={scheduleStart} onChange={e => setScheduleStart(e.target.value)} className="rounded-xl h-9" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">Fin Épreuve</label>
                <Input type="datetime-local" value={scheduleEnd} onChange={e => setScheduleEnd(e.target.value)} className="rounded-xl h-9" />
              </div>
            </div>
            <Button onClick={handleCreateSchedule} className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>Valider le Créneau</span>
            </Button>
          </Card>

          <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
            <h2 className="text-base font-extrabold text-[#16212B]">Planning des Épreuves Fixées ({schedules.length})</h2>
            <div className="space-y-3">
              {schedules.map(s => (
                <div key={s.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <Badge variant="info" className="text-[10px] bg-blue-50 text-[#0066FF] border-blue-200">
                      {new Date(s.startTime).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} - {new Date(s.endTime).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </Badge>
                    <p className="text-xs font-bold text-slate-800">
                      Épreuve : {definitions.find(d => d.id === s.assessmentDefinitionId)?.title ?? s.assessmentDefinitionId}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAssessmentDefinitionId(s.assessmentDefinitionId);
                        setActiveTab('marksheet');
                      }}
                      className="h-8 text-xs rounded-xl border-slate-200 bg-white text-[#0066FF] hover:bg-blue-50 font-bold gap-1"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Saisir les notes
                    </Button>
                    <Badge variant={s.status === 'published' ? 'success' : 'info'} className="font-bold">{s.status}</Badge>
                  </div>
                </div>
              ))}
              {schedules.length === 0 && <p className="text-xs text-slate-400 py-6 text-center">Aucune épreuve planifiée pour le moment.</p>}
            </div>
          </Card>

          <div className="flex justify-between pt-2">
            <Button
              variant="outline"
              onClick={() => setActiveTab('seats')}
              className="border-slate-200 text-xs rounded-xl gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour : Salles &amp; Sessions</span>
            </Button>
            <Button
              onClick={() => setActiveTab('marksheet')}
              className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl gap-2"
            >
              <span>Passer à l'Étape 3 : Grille de Notation</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Grille de Saisie des Notes (§10.4) */}
      {activeTab === 'marksheet' && (
        <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-6">
          {/* Header & Definition Selector */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex-1 max-w-md">
              <label className="text-xs font-bold text-slate-700 block mb-1">Épreuve sélectionnée pour notation</label>
              <EpreuveCombobox
                definitions={definitions}
                value={assessmentDefinitionId}
                onChange={setAssessmentDefinitionId}
                placeholder="Choisir l'épreuve à noter..."
              />
              <p className="text-[11px] text-slate-400 mt-1">
                La grille ci-dessous calcule automatiquement les mentions marocaines et permet la navigation rapide au clavier (Flèches Haut/Bas, Entrée).
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Rechercher élève ou matricule..."
                  value={searchRoster}
                  onChange={e => setSearchRoster(e.target.value)}
                  className="pl-9 text-xs rounded-xl h-9 w-64 border-slate-200"
                />
              </div>
              <Button
                onClick={handleSaveMarks}
                disabled={saving || !assessmentDefinitionId}
                className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5 px-4 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Enregistrement...' : 'Enregistrer la Grille'}</span>
              </Button>
            </div>
          </div>

          {/* Real-time KPI Bar on the current Marksheet */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Moyenne Classe</span>
              <div className="text-base font-extrabold text-[#0066FF] font-mono">{averageScore} /20</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Taux de Réussite</span>
              <div className="text-base font-extrabold text-emerald-600 font-mono">{passRate}% (≥10/20)</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Note Maximale</span>
              <div className="text-base font-extrabold text-slate-800 font-mono">{maxScore} /20</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Note Minimale</span>
              <div className="text-base font-extrabold text-slate-800 font-mono">{minScore} /20</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Élèves Notés</span>
              <div className="text-base font-extrabold text-slate-700 font-mono">{gradedScores.length} / {marks.length}</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Absences</span>
              <div className="text-base font-extrabold text-rose-600 font-mono">{absentCount}</div>
            </div>
          </div>

          {/* Quick-Fill Toolbar & Bulk Actions (§10.4) */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-blue-100 bg-blue-50/50">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#16212B] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#0066FF]" />
                Remplissage groupé :
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
                  className="h-8 text-xs rounded-lg border-blue-200 bg-white text-[#0066FF] hover:bg-blue-50 font-bold"
                >
                  Appliquer aux cases vides
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkSetStatus('graded')}
                className="h-8 text-xs rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-100 font-medium"
              >
                Tous Présents
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkSetStatus('absent')}
                className="h-8 text-xs rounded-lg border-slate-200 bg-white text-rose-600 hover:bg-rose-50 font-medium"
              >
                Tous Absents
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAllScores}
                className="h-8 text-xs rounded-lg border-slate-200 bg-white text-slate-500 hover:bg-slate-100 font-medium gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Effacer les notes
              </Button>
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
              <span>Grille de notes enregistrée et synchronisée avec succès dans le Grand Livre Central !</span>
            </div>
          )}

          {/* Marksheet Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-extrabold text-[#16212B]">
                <tr>
                  <th className="p-3.5 w-32">Matricule</th>
                  <th className="p-3.5">Candidat / Élève</th>
                  <th className="p-3.5 w-44">Statut de Présence</th>
                  <th className="p-3.5 w-36">Note sur 20</th>
                  <th className="p-3.5 w-48">Mention Automatique (Maroc)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRoster.map((row, filteredIdx) => {
                  const globalIdx = marks.findIndex(m => m.studentId === row.studentId);
                  return (
                    <tr key={row.studentId} className="hover:bg-slate-50/70 transition-colors">
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
                          className="p-1.5 text-xs rounded-lg border border-slate-200 font-medium bg-white w-full"
                        >
                          <option value="graded">Présent (Noté)</option>
                          <option value="absent">Absent</option>
                          <option value="exempted">Exempté</option>
                          <option value="withheld">Note Retenue</option>
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
                          placeholder={row.status === 'graded' ? 'ex: 15.5' : '—'}
                          onChange={e => handleScoreChange(globalIdx, e.target.value)}
                          onKeyDown={e => handleKeyDown(e, filteredIdx, filteredRoster.length)}
                          onFocus={e => e.target.select()}
                          className="w-28 text-xs font-extrabold rounded-lg border-slate-200 text-[#0066FF] font-mono focus:ring-2 focus:ring-[#0066FF]"
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
                      Aucun élève chargé pour cette session.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Astuce de saisie : utilisez <strong>Entrée</strong> ou <strong>Flèche Bas</strong> pour passer à l'élève suivant sans utiliser la souris.</span>
            </div>
            <Button
              onClick={handleSaveMarks}
              disabled={saving || !assessmentDefinitionId}
              className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5 px-4 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Enregistrement...' : 'Enregistrer la Grille'}</span>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
