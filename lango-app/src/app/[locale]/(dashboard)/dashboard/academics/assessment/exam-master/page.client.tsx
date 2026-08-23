'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
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
  const [activeTab, setActiveTab] = useState<'seats' | 'schedules' | 'marksheet'>('marksheet');

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

  const [definitions, setDefinitions] = useState<AssessmentDefinition[]>([]);

  const loadTerms = () => fetch('/api/academics/exam-terms').then(r => r.json()).then(j => j.success && setTerms(j.data));
  const loadHalls = () => fetch('/api/academics/exam-halls').then(r => r.json()).then(j => j.success && setHalls(j.data));
  const loadSchedules = () => fetch('/api/academics/exam-schedules').then(r => r.json()).then(j => j.success && setSchedules(j.data));
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
  }, []);

  useEffect(() => {
    if (students.length > 0 && marks.length === 0) {
      setMarks(students.map(s => ({ studentId: s.id, matricule: s.matricule, name: s.fullName, rawScore: '', status: 'graded' })));
    }
  }, [students]);

  const handleScoreChange = (index: number, newScore: string) => {
    const updated = [...marks];
    const val = Number.parseFloat(newScore);

    let calculatedGrade = 'Insuffisant';
    if (val >= 16) calculatedGrade = 'Très Bien';
    else if (val >= 14) calculatedGrade = 'Bien';
    else if (val >= 12) calculatedGrade = 'Assez Bien';
    else if (val >= 10) calculatedGrade = 'Passable';

    if (updated[index]) {
      updated[index] = { ...updated[index], rawScore: newScore, grade: calculatedGrade };
    }
    setMarks(updated);
  };

  const handleStatusChange = (index: number, newStatus: MarkRow['status']) => {
    const updated = [...marks];
    if (updated[index]) {
      updated[index] = {
        ...updated[index],
        status: newStatus,
        grade: newStatus === 'absent' ? 'Absent' : newStatus === 'exempted' ? 'Exempté' : updated[index].grade,
      };
    }
    setMarks(updated);
  };

  const handleSaveMarks = async () => {
    if (!assessmentDefinitionId.trim()) {
      setSaveError('Veuillez indiquer l\'ID de l\'épreuve (assessmentDefinitionId).');
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

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Exam Master & Gestion des Épreuves</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Planification des sessions, attribution déterministe des places par salle, grille de saisie contrôlée et calcul de rangs.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="success" className="font-bold gap-1 px-3 py-1.5 text-xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verrouillage Modération Actif</span>
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sessions d'Examen</span>
            <h3 className="text-xl font-extrabold text-[#16212B] mt-1">{terms.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2487B8] flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Salles & Capacités</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{halls.length} Salles ({totalHallCapacity} places)</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Building className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Candidats Chargés</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{students.length} Élèves</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Épreuves Planifiées</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{schedules.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
        </Card>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'marksheet', label: 'Grille de Saisie des Notes (Roster)', icon: FileSpreadsheet },
          { id: 'seats', label: 'Attribution des Places & Salles', icon: Grid },
          { id: 'schedules', label: 'Calendrier des Épreuves', icon: Calendar },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === t.id ? 'bg-[#2487B8] text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <t.icon className="w-4 h-4" />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'marksheet' && (
        <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 max-w-md">
              <label className="text-xs font-bold text-slate-700">Épreuve à noter</label>
              <div className="mt-1">
                <EpreuveCombobox
                  definitions={definitions}
                  value={assessmentDefinitionId}
                  onChange={setAssessmentDefinitionId}
                  placeholder="Sélectionner une épreuve..."
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Choisissez l&apos;épreuve dont vous voulez saisir la grille de notes.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Filtrer par nom ou matricule..."
                  value={searchRoster}
                  onChange={e => setSearchRoster(e.target.value)}
                  className="pl-9 text-xs rounded-xl h-9 w-64 border-slate-200"
                />
              </div>
              <Button
                onClick={handleSaveMarks}
                disabled={saving}
                className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5 px-4 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Enregistrement...' : 'Enregistrer la Grille'}</span>
              </Button>
            </div>
          </div>

          {saveError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">{saveError}</div>
          )}
          {savedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Grille de notes enregistrée et synchronisée avec succès dans le Grand Livre Central !</span>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-extrabold text-[#16212B]">
                <tr>
                  <th className="p-3.5">Matricule</th>
                  <th className="p-3.5">Candidat / Élève</th>
                  <th className="p-3.5">Statut de Présence</th>
                  <th className="p-3.5">Note sur 20</th>
                  <th className="p-3.5">Mention Automatique</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRoster.map((row) => {
                  const idx = marks.findIndex(m => m.studentId === row.studentId);
                  return (
                    <tr key={row.studentId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-slate-600">{row.matricule}</td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                            {row.name.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="font-bold text-[#16212B]">{row.name}</span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <select
                          value={row.status}
                          onChange={e => handleStatusChange(idx, e.target.value as MarkRow['status'])}
                          className="p-1.5 text-xs rounded-lg border border-slate-200 font-medium bg-white"
                        >
                          <option value="graded">Présent (Noté)</option>
                          <option value="absent">Absent</option>
                          <option value="exempted">Exempté</option>
                          <option value="withheld">Note Retenue</option>
                        </select>
                      </td>
                      <td className="p-3.5">
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          max="20"
                          disabled={row.status !== 'graded'}
                          value={row.rawScore}
                          onChange={e => handleScoreChange(idx, e.target.value)}
                          className="w-24 text-xs font-bold rounded-lg border-slate-200 text-[#2487B8]"
                        />
                      </td>
                      <td className="p-3.5">
                        <Badge variant={row.status === 'absent' ? 'danger' : row.grade === 'Très Bien' ? 'success' : 'info'} className="font-bold text-[10px]">
                          {row.grade ?? '-'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
                {filteredRoster.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400 font-semibold">Aucun élève chargé.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'seats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3">
              <h2 className="text-sm font-extrabold text-[#16212B]">Créer une Session d'Examen</h2>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Input placeholder="Nom (ex: Trimestre 2)" value={newTermName} onChange={e => setNewTermName(e.target.value)} className="rounded-xl h-9 col-span-2" />
                <Input placeholder="Code (ex: T2-2026)" value={newTermCode} onChange={e => setNewTermCode(e.target.value)} className="rounded-xl h-9 col-span-2" />
                <Input type="date" value={newTermStart} onChange={e => setNewTermStart(e.target.value)} className="rounded-xl h-9" />
                <Input type="date" value={newTermEnd} onChange={e => setNewTermEnd(e.target.value)} className="rounded-xl h-9" />
              </div>
              <Button onClick={handleCreateTerm} size="sm" className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>Créer la Session</span>
              </Button>
            </Card>
            <Card className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3">
              <h2 className="text-sm font-extrabold text-[#16212B]">Créer une Salle d'Examen</h2>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Input placeholder="Nom (ex: Salle A1)" value={newHallName} onChange={e => setNewHallName(e.target.value)} className="rounded-xl h-9" />
                <Input placeholder="Code (ex: A1)" value={newHallCode} onChange={e => setNewHallCode(e.target.value)} className="rounded-xl h-9" />
                <Input type="number" placeholder="Capacité" value={newHallCapacity} onChange={e => setNewHallCapacity(e.target.value)} className="rounded-xl h-9 col-span-2" />
              </div>
              <Button onClick={handleCreateHall} size="sm" className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>Créer la Salle</span>
              </Button>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
              <h2 className="text-base font-extrabold text-[#16212B]">Configuration de Distribution</h2>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700">Sélectionner la Session</label>
                  <select value={selectedTermId} onChange={e => setSelectedTermId(e.target.value)} className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 font-medium">
                    <option value="">-- Choisir --</option>
                    {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700">Salles (sélection multiple)</label>
                  <div className="mt-1 space-y-1.5">
                    {halls.map(h => (
                      <label key={h.id} className="flex items-center gap-2 p-1.5">
                        <input
                          type="checkbox"
                          checked={selectedHallIds.includes(h.id)}
                          onChange={(e) => {
                            setSelectedHallIds(e.target.checked ? [...selectedHallIds, h.id] : selectedHallIds.filter(id => id !== h.id));
                          }}
                        />
                        <span>{h.name} ({h.capacity} places)</span>
                      </label>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={handleAllocateSeats}
                  disabled={allocating || !selectedTermId || selectedHallIds.length === 0}
                  className="w-full bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold rounded-xl shadow-2xs mt-2"
                >
                  {allocating ? 'Attribution en cours...' : 'Lancer l\'Attribution Automatique'}
                </Button>
              </div>
            </Card>

            <Card className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold text-[#16212B]">Salles Disponibles & Capacités</h2>
                <Badge variant="success" className="font-bold">{totalHallCapacity} Places au Total</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {halls.map(h => (
                  <div key={h.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-[#16212B]">{h.name}</h4>
                      <Badge variant="info" className="text-[10px]">{h.capacity} places</Badge>
                    </div>
                  </div>
                ))}
                {halls.length === 0 && <p className="text-xs text-slate-400 col-span-2">Aucune salle créée.</p>}
              </div>
              {allocationResult && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold">
                  {allocationResult.allocatedCount} candidat(s) réparti(s) avec succès. {allocationResult.unallocatedCount > 0 && `${allocationResult.unallocatedCount} non attribué(s) (capacité insuffisante).`}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'schedules' && (
        <div className="space-y-6">
          <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
            <h2 className="text-base font-extrabold text-[#16212B]">Nouvelle Planification</h2>
            {scheduleError && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">{scheduleError}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              <select value={selectedTermId} onChange={e => setSelectedTermId(e.target.value)} className="p-2.5 rounded-xl border border-slate-200 font-medium">
                <option value="">Session --</option>
                {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <EpreuveCombobox
                definitions={definitions}
                value={scheduleDefId}
                onChange={setScheduleDefId}
                placeholder="Épreuve..."
              />
              <select value={scheduleHallId} onChange={e => setScheduleHallId(e.target.value)} className="p-2.5 rounded-xl border border-slate-200 font-medium">
                <option value="">Salle (optionnel)</option>
                {halls.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
              <Input type="datetime-local" value={scheduleStart} onChange={e => setScheduleStart(e.target.value)} className="rounded-xl h-9" />
              <Input type="datetime-local" value={scheduleEnd} onChange={e => setScheduleEnd(e.target.value)} className="rounded-xl h-9" />
            </div>
            <Button onClick={handleCreateSchedule} className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>Planifier</span>
            </Button>
          </Card>

          <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
            <h2 className="text-base font-extrabold text-[#16212B]">Planning Global des Épreuves</h2>
            <div className="space-y-3">
              {schedules.map(s => (
                <div key={s.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs">
                  <div>
                    <Badge variant="info" className="text-[10px] mb-1">
                      {new Date(s.startTime).toLocaleString('fr-FR')} - {new Date(s.endTime).toLocaleString('fr-FR')}
                    </Badge>
                    <p className="text-[11px] text-slate-500">Épreuve: {definitions.find(d => d.id === s.assessmentDefinitionId)?.title ?? s.assessmentDefinitionId}</p>
                  </div>
                  <Badge variant={s.status === 'published' ? 'success' : 'info'} className="font-bold">{s.status}</Badge>
                </div>
              ))}
              {schedules.length === 0 && <p className="text-xs text-slate-400">Aucune épreuve planifiée.</p>}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
