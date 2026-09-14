'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search, Plus, Trash2, Pencil, ArrowRight, UserCog,
  SlidersHorizontal, Layers, Clock, DoorOpen, UserCheck, Check, AlertCircle, X,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { SectionCombobox } from './section-combobox';

type ClassRow = { id: string; name: string; includeSemesters: boolean; periodType: 'semester' | 'trimester' | 'month'; mediumId: string; shiftId: string | null; streamId: string | null; cycle: string | null; schoolId: string };
type RefOption = { id: string; name: string; startTime?: string; endTime?: string };

const CYCLE_OPTIONS = [
  { value: 'maternelle', label: 'Maternelle' },
  { value: 'primaire', label: 'Primaire' },
  { value: 'college', label: 'Collège' },
  { value: 'lycee', label: 'Lycée' },
];

const PERIOD_MODE_OPTIONS = [
  { value: 'semester', label: 'Semestriel (2 semestres)' },
  { value: 'trimester', label: 'Trimestriel (3 trimestres)' },
  { value: 'month', label: 'Mensuel' },
];
type Availability = { teacherId: string; dayOfWeek: string; startTime: string; endTime: string };
type PreviewSlot = { id: string; dayOfWeek: string; startTime: string; endTime: string; subjectName?: string; roomLabel?: string | null };

type SectionRow = {
  id: string;
  classId: string;
  sectionId: string;
  sectionName: string;
  maxStudents: number | null;
  homeRoomId: string | null;
  enrolledCount: number;
  homeroomTeacherId: string | null;
};

export function ClassesClient({ locale }: { locale?: string } = {}) {
  const t = useTranslations('Academics');
  const tCommon = useTranslations('Common');
  const { can } = usePermissions();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [mediums, setMediums] = useState<RefOption[]>([]);
  const [shifts, setShifts] = useState<RefOption[]>([]);
  const [streams, setStreams] = useState<RefOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [form, setForm] = useState({ name: '', mediumId: '', shiftId: '', streamId: '', cycle: '', periodType: 'semester', sectionCount: '1', teacherId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sections management state (Modal instead of table row drawer)
  const [selectedClassForSections, setSelectedClassForSections] = useState<ClassRow | null>(null);
  const [sectionsByClass, setSectionsByClass] = useState<Record<string, SectionRow[]>>({});
  const [teachers, setTeachers] = useState<RefOption[]>([]);
  const [rooms, setRooms] = useState<RefOption[]>([]);
  const [allSections, setAllSections] = useState<RefOption[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [slotsBySection, setSlotsBySection] = useState<Record<string, PreviewSlot[]>>({});
  const [substitutesBySection, setSubstitutesBySection] = useState<Record<string, Array<{ id: string; teacherId: string; role: string }>>>({});

  // Quick link section in modal
  const [newSectionId, setNewSectionId] = useState('');
  const [newSectionMaxStudents, setNewSectionMaxStudents] = useState('');
  const [newSectionHomeRoomId, setNewSectionHomeRoomId] = useState('');
  const [linkingSection, setLinkingSection] = useState(false);
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);

  const loadSubstitutes = (sectionId: string) => {
    fetch(`/api/academics/class-teachers?classSectionId=${sectionId}&pageSize=50`)
      .then(r => r.json())
      .then(j => {
        if (j?.success) {
          const subs = (j.data as Array<{ id: string; teacherId: string; role: string }>).filter(ct => ct.role === 'substitute');
          setSubstitutesBySection(prev => ({ ...prev, [sectionId]: subs }));
        }
      })
      .catch(() => {});
  };

  const assignSubstitute = async (sectionId: string, teacherId: string) => {
    if (!teacherId) return;
    if ((substitutesBySection[sectionId] ?? []).some(sb => sb.teacherId === teacherId)) return;
    try {
      const res = await fetch('/api/academics/class-teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classSectionId: sectionId, teacherId, role: 'substitute', notes: 'Remplaçant' }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Professeur remplaçant assigné');
        loadSubstitutes(sectionId);
      } else {
        toast.error(json.error?.message || 'Échec de l\'affectation du remplaçant');
      }
    } catch {
      toast.error('Erreur réseau');
    }
  };

  const removeSubstitute = async (sectionId: string, substituteId: string, teacherName: string) => {
    try {
      const res = await fetch(`/api/academics/class-teachers?id=${substituteId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Remplaçant ${teacherName} retiré`);
        loadSubstitutes(sectionId);
      } else {
        toast.error('Échec du retrait du remplaçant');
      }
    } catch {
      toast.error('Erreur réseau');
    }
  };

  const loadSections = (classId: string) => {
    fetch(`/api/academics/class-sections?classId=${classId}&pageSize=100`)
      .then(r => r.json())
      .then(j => {
        if (j?.success) {
          setSectionsByClass(prev => ({ ...prev, [classId]: j.data }));
          Promise.all(j.data.map((s: SectionRow) => fetch(`/api/academics/timetable-slots?classSectionId=${s.id}`).then(r => r.json())))
            .then(results => setSlotsBySection(prev => ({ ...prev, ...Object.fromEntries(j.data.map((s: SectionRow, i: number) => [s.id, results[i]?.success ? results[i].data : []])) })));
          j.data.forEach((s: SectionRow) => loadSubstitutes(s.id));
        }
      })
      .catch(() => {});
  };

  const loadAllClassSections = () => {
    fetch('/api/academics/class-sections?pageSize=500')
      .then(res => res.json())
      .then(json => {
        if (json?.success && Array.isArray(json.data)) {
          const map: Record<string, SectionRow[]> = {};
          for (const s of json.data) {
            if (!map[s.classId]) map[s.classId] = [];
            map[s.classId]!.push(s);
          }
          setSectionsByClass(map);
        }
      })
      .catch(() => {});
  };

  const openSectionsModal = (cls: ClassRow) => {
    setSelectedClassForSections(cls);
    setNewSectionId('');
    setNewSectionMaxStudents('');
    setNewSectionHomeRoomId('');
    loadSections(cls.id);
  };

  const handleAttachSection = async (classId: string) => {
    if (!newSectionId) {
      toast.error('Veuillez sélectionner ou créer une section.');
      return;
    }
    setLinkingSection(true);
    try {
      const res = await fetch('/api/academics/class-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          sectionId: newSectionId,
          maxStudents: newSectionMaxStudents ? Number(newSectionMaxStudents) : undefined,
          homeRoomId: newSectionHomeRoomId || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || json.message || 'Impossible de lier cette section');
        return;
      }
      toast.success('Section liée avec succès');
      setNewSectionId('');
      setNewSectionMaxStudents('');
      setNewSectionHomeRoomId('');
      loadSections(classId);
      loadAllClassSections();
    } catch {
      toast.error('Erreur réseau lors de la liaison de la section');
    } finally {
      setLinkingSection(false);
    }
  };

  const handleUnlinkSection = async (classId: string, sectionRowId: string, sectionName: string) => {
    if (!confirm(`Détacher la section « ${sectionName} » de cette classe ?`)) return;
    try {
      const res = await fetch(`/api/academics/class-sections?id=${sectionRowId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || json.message || 'Échec du détachement');
        return;
      }
      toast.success(`Section « ${sectionName} » détachée`);
      loadSections(classId);
      loadAllClassSections();
    } catch {
      toast.error('Erreur réseau');
    }
  };

  const updateSection = async (classId: string, sectionRowId: string, patch: { maxStudents?: number | null; homeRoomId?: string | null }) => {
    setSectionsByClass(prev => ({
      ...prev,
      [classId]: prev[classId]?.map(s => (s.id === sectionRowId ? { ...s, ...patch } : s)) ?? [],
    }));
    try {
      const res = await fetch('/api/academics/class-sections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sectionRowId, ...patch }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Modifications enregistrées');
        loadAllClassSections();
      } else {
        toast.error(json.error?.message || 'Échec de la mise à jour');
      }
    } catch {
      toast.error('Erreur réseau');
    }
  };

  const setHomeroomTeacher = async (classId: string, sectionRowId: string, teacherId: string) => {
    setSectionsByClass(prev => ({
      ...prev,
      [classId]: prev[classId]?.map(s => (s.id === sectionRowId ? { ...s, homeroomTeacherId: teacherId || null } : s)) ?? [],
    }));
    try {
      if (teacherId) {
        const res = await fetch(`/api/academics/class-sections/${sectionRowId}/homeroom-teacher`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teacherId }),
        });
        const json = await res.json();
        if (json.success) {
          toast.success('Professeur principal assigné');
        } else {
          toast.error(json.error?.message || 'Échec de l\'attribution');
        }
      } else {
        await fetch(`/api/academics/class-sections/${sectionRowId}/homeroom-teacher`, { method: 'DELETE' });
        toast.success('Professeur principal retiré');
      }
    } catch {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const load = () => {
    setLoading(true);
    fetch('/api/academics/classes?pageSize=200')
      .then(res => (res.ok ? res.json() : null))
      .then(json => json?.success && setClasses(json.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    loadAllClassSections();
    fetch('/api/academics/mediums?pageSize=100').then(r => r.json()).then(j => j?.success && setMediums(j.data));
    fetch('/api/academics/shifts?pageSize=100').then(r => r.json()).then(j => j?.success && setShifts(j.data));
    fetch('/api/academics/streams?pageSize=100').then(r => r.json()).then(j => j?.success && setStreams(j.data));
    fetch('/api/teachers?pageSize=200').then(r => r.json()).then(j => j?.success && setTeachers(j.data));
    fetch('/api/academics/rooms?pageSize=200').then(r => r.json()).then(j => j?.success && setRooms(j.data));
    fetch('/api/academics/sections?pageSize=200').then(r => r.json()).then(j => j?.success && setAllSections(j.data));
    fetch('/api/academics/teacher-availability').then(r => r.json()).then(j => j?.success && setAvailability(j.data));
  }, []);

  const nameOf = (options: RefOption[], id: string | null) => options.find(o => o.id === id)?.name ?? null;

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', mediumId: mediums[0]?.id ?? '', shiftId: '', streamId: '', cycle: '', periodType: 'semester', sectionCount: '1', teacherId: '' });
    setShowForm(true);
  };

  const openEdit = (cls: ClassRow) => {
    setEditing(cls);
    setForm({
      name: cls.name,
      mediumId: cls.mediumId,
      shiftId: cls.shiftId ?? '',
      streamId: cls.streamId ?? '',
      cycle: cls.cycle ?? '',
      periodType: cls.periodType || (cls.includeSemesters ? 'semester' : 'trimester'),
      sectionCount: '0',
      teacherId: '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.mediumId) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name.trim(),
        mediumId: form.mediumId,
        shiftId: form.shiftId || undefined,
        streamId: form.streamId || undefined,
        cycle: form.cycle || undefined,
        periodType: form.periodType || 'semester',
        includeSemesters: form.periodType === 'semester',
        ...(!editing ? { sectionCount: Number(form.sectionCount) || 0, teacherId: form.teacherId || undefined } : {}),
        ...(editing ? { id: editing.id } : {}),
      };
      const res = await fetch('/api/academics/classes', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || json.message || 'Échec de l\'enregistrement.');
        return;
      }
      toast.success(editing ? 'Classe modifiée avec succès' : 'Classe créée avec succès');
      setShowForm(false);
      load();
      loadAllClassSections();
    } catch {
      setError('Connexion impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette classe ?')) return;
    try {
      const res = await fetch(`/api/academics/classes?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success('Classe supprimée');
        load();
      } else {
        toast.error(json.error?.message || 'Échec de la suppression');
      }
    } catch {
      toast.error('Erreur réseau');
    }
  };

  const filtered = classes.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const canManage = can('academics.manage');
  const likelyShift = shifts.find(s => s.id === form.shiftId);
  const isTeacherAvailable = (teacherId: string) => availability.some(v => v.teacherId === teacherId && (!likelyShift?.startTime || !likelyShift?.endTime || (v.startTime <= likelyShift.startTime && v.endTime >= likelyShift.endTime)));
  const rankedTeachers = [...teachers].sort((a, b) => Number(isTeacherAvailable(b.id)) - Number(isTeacherAvailable(a.id)));

  const cycleLabels: Record<string, string> = {
    maternelle: t('cycleMaternelle'),
    primaire: t('cyclePrimaire'),
    college: t('cycleCollege'),
    lycee: t('cycleLycee'),
  };

  // Section options not already attached to the selected class
  const availableUnlinkedSections = selectedClassForSections
    ? allSections.filter(s => !(sectionsByClass[selectedClassForSections.id] ?? []).some(sec => sec.sectionId === s.id))
    : allSections;

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('classesTitle')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('classCountSubtitle', { count: classes.length })}</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={openCreate} className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5 font-bold">
            <Plus className="w-3.5 h-3.5" />
            {t('newClass')}
          </Button>
        )}
      </div>

      <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder={t('searchClassPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none" />
        </div>
      </Card>

      {canManage && showForm && (
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Nom de la classe</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-9 rounded-xl" placeholder="Ex. 2nde A" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Médium</label>
              <select value={form.mediumId} onChange={e => setForm({ ...form, mediumId: e.target.value })} className="h-9 w-full rounded-xl border border-slate-200 px-3">
                <option value="">Sélectionner...</option>
                {mediums.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Shift (optionnel)</label>
              <select value={form.shiftId} onChange={e => setForm({ ...form, shiftId: e.target.value })} className="h-9 w-full rounded-xl border border-slate-200 px-3">
                <option value="">Aucun</option>
                {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Filière (optionnel)</label>
              <select value={form.streamId} onChange={e => setForm({ ...form, streamId: e.target.value })} className="h-9 w-full rounded-xl border border-slate-200 px-3">
                <option value="">Aucune</option>
                {streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Cycle (optionnel)</label>
              <select value={form.cycle} onChange={e => setForm({ ...form, cycle: e.target.value })} className="h-9 w-full rounded-xl border border-slate-200 px-3">
                <option value="">Aucun</option>
                {CYCLE_OPTIONS.map(c => <option key={c.value} value={c.value}>{cycleLabels[c.value] || c.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Mode de période</label>
              <select value={form.periodType} onChange={e => setForm({ ...form, periodType: e.target.value as any })} className="h-9 w-full rounded-xl border border-slate-200 px-3 font-medium">
                {PERIOD_MODE_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            {!editing && <>
              <div className="space-y-1"><label className="font-bold text-slate-600">Nombre de sections</label><Input type="number" min={0} max={26} value={form.sectionCount} onChange={e => setForm({ ...form, sectionCount: e.target.value })} className="h-9 rounded-xl" /></div>
              <div className="space-y-1"><label className="font-bold text-slate-600">Professeur principal</label><select value={form.teacherId} onChange={e => setForm({ ...form, teacherId: e.target.value })} className="h-9 w-full rounded-xl border border-slate-200 px-3"><option value="">À affecter plus tard</option>{rankedTeachers.map(t => <option key={t.id} value={t.id}>{isTeacherAvailable(t.id) ? 'Disponible · ' : ''}{t.name}</option>)}</select></div>
            </>}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={saving} onClick={handleSave} className="h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold">
              {saving ? tCommon('loading') : tCommon('save')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="h-9 rounded-xl text-xs font-bold">
              {tCommon('cancel')}
            </Button>
          </div>
        </Card>
      )}

      {/* Main Classes Table */}
      <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
            <tr>
              <th className="py-3.5 px-4">{t('classCol')}</th>
              <th className="py-3.5 px-4">{t('mediumCol')}</th>
              <th className="py-3.5 px-4">{t('shiftCol')}</th>
              <th className="py-3.5 px-4">{t('streamCol')}</th>
              <th className="py-3.5 px-4">{t('cycleCol')}</th>
              <th className="py-3.5 px-4">{t('periodCol')}</th>
              <th className="py-3.5 px-4">{t('sectionsCol')}</th>
              <th className="py-3.5 px-4 text-right">{t('actionsCol')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-slate-400">{t('noClassesConfigured')}</td></tr>
            )}
            {filtered.map(cls => (
              <tr key={cls.id} className="hover:bg-slate-50/80 transition font-medium">
                <td className="py-3.5 px-4 font-bold text-[#16212B]">{cls.name}</td>
                <td className="py-3.5 px-4 text-slate-600">{nameOf(mediums, cls.mediumId) ?? '—'}</td>
                <td className="py-3.5 px-4 text-slate-600">{nameOf(shifts, cls.shiftId) ?? '—'}</td>
                <td className="py-3.5 px-4 text-slate-600">{nameOf(streams, cls.streamId) ?? '—'}</td>
                <td className="py-3.5 px-4 text-slate-600">{(cls.cycle && cycleLabels[cls.cycle]) || '—'}</td>
                <td className="py-3.5 px-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-[#0066FF] border border-blue-200/60">
                    {cls.periodType === 'trimester' ? t('periodTrimester') : cls.periodType === 'month' ? t('periodMonth') : t('periodSemester')}
                  </span>
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(sectionsByClass[cls.id] ?? []).slice(0, 3).map(sec => (
                      <span
                        key={sec.id}
                        onClick={() => openSectionsModal(cls)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200/80 hover:bg-[#DCEBF4]/50 hover:border-[#2487B8]/40 hover:text-[#1B6C93] transition cursor-pointer"
                        title="Cliquez pour gérer cette section"
                      >
                        <span className="font-extrabold">{sec.sectionName}</span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          ({sec.enrolledCount}{sec.maxStudents ? `/${sec.maxStudents}` : ''})
                        </span>
                      </span>
                    ))}
                    {(sectionsByClass[cls.id]?.length ?? 0) > 3 && (
                      <span
                        onClick={() => openSectionsModal(cls)}
                        className="inline-flex items-center px-1.5 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                      >
                        +{sectionsByClass[cls.id]!.length - 3}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openSectionsModal(cls)}
                      className="h-6 px-2 text-[10px] font-bold text-[#2487B8] hover:bg-[#DCEBF4]/60 hover:text-[#1B6C93] rounded-lg gap-1"
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                      {(sectionsByClass[cls.id]?.length ?? 0) > 0 ? `Gérer (${sectionsByClass[cls.id]!.length})` : '+ Section'}
                    </Button>
                  </div>
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openSectionsModal(cls)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-[#DCEBF4] hover:text-[#1B6C93] transition"
                      title="Gérer les sections de cette classe"
                    >
                      <Layers className="w-3.5 h-3.5" />
                    </button>
                    <Link href={`/${locale || 'fr'}/dashboard/academics/classes/${cls.id}`} className="p-1.5 rounded-lg text-slate-400 hover:bg-[#DCEBF4] hover:text-[#1B6C93] transition" title="Voir la classe">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    {canManage && (
                      <>
                        <button onClick={() => openEdit(cls)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#2487B8] transition">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(cls.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* DEDICATED SECTIONS MANAGEMENT MODAL DIALOG */}
      {selectedClassForSections && (
        <Dialog open={!!selectedClassForSections} onOpenChange={open => !open && setSelectedClassForSections(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-5 rounded-2xl bg-white border border-slate-200 shadow-xl space-y-4">
            <DialogHeader className="border-b border-slate-100 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#2487B8]/10 text-[#2487B8] flex items-center justify-center font-bold shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <DialogTitle className="text-base font-extrabold text-[#16212B]">
                        Sections · {selectedClassForSections.name}
                      </DialogTitle>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#0066FF] border border-blue-200/60">
                        {selectedClassForSections.periodType === 'trimester' ? t('periodTrimester') : selectedClassForSections.periodType === 'month' ? t('periodMonth') : t('periodSemester')}
                      </span>
                    </div>
                    <DialogDescription className="text-[11px] text-slate-500 mt-0.5">
                      {nameOf(mediums, selectedClassForSections.mediumId) ?? 'Médium non défini'}
                      {selectedClassForSections.cycle ? ` · ${cycleLabels[selectedClassForSections.cycle] || selectedClassForSections.cycle}` : ''}
                      {selectedClassForSections.shiftId ? ` · Shift: ${nameOf(shifts, selectedClassForSections.shiftId)}` : ''}
                    </DialogDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                  <span>{(sectionsByClass[selectedClassForSections.id] ?? []).length} section(s)</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-500">{(sectionsByClass[selectedClassForSections.id] ?? []).reduce((acc, s) => acc + s.enrolledCount, 0)} élèves</span>
                </div>
              </div>
            </DialogHeader>

            {/* Quick Add Section Bar (Compact Single Row) */}
            {canManage && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex-1 min-w-[140px]">
                  <SectionCombobox
                    sections={availableUnlinkedSections}
                    value={newSectionId}
                    onChange={setNewSectionId}
                    onCreated={s => {
                      setAllSections(p => [...p, s]);
                      setNewSectionId(s.id);
                    }}
                    placeholder="Lier une section (ex: A, B, C...)"
                  />
                </div>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={newSectionMaxStudents}
                  onChange={e => setNewSectionMaxStudents(e.target.value)}
                  placeholder="Cap. (30)"
                  className="w-24 h-9 rounded-xl text-xs bg-white"
                />
                <Button
                  disabled={!newSectionId || linkingSection}
                  onClick={() => handleAttachSection(selectedClassForSections.id)}
                  className="h-9 px-4 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{linkingSection ? '...' : 'Lier'}</span>
                </Button>
              </div>
            )}

            {/* List of Attached Sections (Clean, Minimalist Compact Rows) */}
            <div className="space-y-2.5">
              {(!sectionsByClass[selectedClassForSections.id] || sectionsByClass[selectedClassForSections.id]!.length === 0) && (
                <div className="py-8 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 p-6 space-y-1.5">
                  <Layers className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-600">Aucune section liée à cette classe</p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Utilisez le sélecteur ci-dessus pour associer des sections à cette classe.
                  </p>
                </div>
              )}

              {sectionsByClass[selectedClassForSections.id]?.map(sec => {
                const max = sec.maxStudents ?? 30;
                const fillPercentage = Math.min(100, Math.round((sec.enrolledCount / max) * 100));
                const isExpanded = expandedSectionId === sec.id;
                const slotsCount = (slotsBySection[sec.id] ?? []).length;

                return (
                  <div
                    key={sec.id}
                    className="rounded-xl border border-slate-200/90 bg-white overflow-hidden transition-all hover:border-[#2487B8]/40 shadow-2xs"
                  >
                    {/* Primary Row: Badge, Name, Homeroom Teacher, Room, Schedule pill & Detach */}
                    <div className="p-3 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                      {/* Section Badge & Count */}
                      <div className="flex items-center gap-2.5 min-w-[130px] shrink-0">
                        <span className="w-7 h-7 rounded-lg bg-[#16212B] text-white flex items-center justify-center font-extrabold text-xs shrink-0">
                          {sec.sectionName}
                        </span>
                        <div>
                          <p className="text-xs font-extrabold text-[#16212B] leading-tight">
                            Section {sec.sectionName}
                          </p>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {sec.enrolledCount}{sec.maxStudents ? ` / ${sec.maxStudents}` : ''} élèves
                          </span>
                        </div>
                      </div>

                      {/* Professeur Principal Selector */}
                      <div className="flex-1 min-w-[150px] max-w-[210px]">
                        <select
                          value={sec.homeroomTeacherId ?? ''}
                          onChange={e => setHomeroomTeacher(selectedClassForSections.id, sec.id, e.target.value)}
                          className="h-8 w-full px-2 rounded-lg border border-slate-200 text-xs bg-slate-50 font-medium text-[#16212B] truncate"
                          title="Professeur principal"
                        >
                          <option value="">Prof. principal...</option>
                          {teachers.map(t => (
                            <option key={t.id} value={t.id}>
                              {isTeacherAvailable(t.id) ? '✓ ' : ''}{t.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Salle de Base Selector */}
                      <div className="min-w-[110px] max-w-[150px]">
                        <select
                          value={sec.homeRoomId ?? ''}
                          onChange={e => updateSection(selectedClassForSections.id, sec.id, { homeRoomId: e.target.value || null })}
                          className="h-8 w-full px-2 rounded-lg border border-slate-200 text-xs bg-slate-50 font-medium text-[#16212B] truncate"
                          title="Salle de base"
                        >
                          <option value="">Salle...</option>
                          {rooms.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Action & Toggle Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 ms-auto">
                        <button
                          type="button"
                          onClick={() => setExpandedSectionId(isExpanded ? null : sec.id)}
                          className={`h-8 px-2.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 ${
                            isExpanded
                              ? 'bg-[#2487B8] text-white border-[#2487B8]'
                              : slotsCount > 0
                              ? 'bg-[#2487B8]/10 text-[#2487B8] border-[#2487B8]/20 hover:bg-[#2487B8]/20'
                              : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                          }`}
                          title="Afficher les détails et le planning"
                        >
                          <Clock className="w-3 h-3" />
                          <span>{slotsCount > 0 ? `${slotsCount} créneaux` : 'Détails'}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {canManage && (
                          <button
                            onClick={() => handleUnlinkSection(selectedClassForSections.id, sec.id, sec.sectionName)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Détacher cette section"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Collapsible Details & Planning Drawer */}
                    {isExpanded && (
                      <div className="p-3 bg-slate-50/70 border-t border-slate-100 space-y-3 text-xs">
                        {/* Capacity and Substitute Teacher */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Capacité max :</span>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              defaultValue={sec.maxStudents ?? ''}
                              onBlur={e => updateSection(selectedClassForSections.id, sec.id, { maxStudents: e.target.value ? Number(e.target.value) : null })}
                              className="w-16 h-7 text-xs font-bold rounded-lg border border-slate-200 text-center bg-white"
                              placeholder="30"
                            />
                            <span className="text-[10px] text-slate-400">
                              ({fillPercentage}% occupé)
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Remplaçant :</span>
                            <select
                              value=""
                              onChange={e => assignSubstitute(sec.id, e.target.value)}
                              className="h-7 flex-1 px-2 rounded-lg border border-slate-200 text-[11px] bg-white font-medium"
                            >
                              <option value="">Affecter...</option>
                              {teachers.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Substitute Badges if any */}
                        {(substitutesBySection[sec.id] ?? []).length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[10px] font-bold text-slate-400">Remplaçants :</span>
                            {(substitutesBySection[sec.id] ?? []).map(sb => {
                              const teacher = teachers.find(x => x.id === sb.teacherId);
                              const name = teacher?.name ?? sb.teacherId;
                              return (
                                <Badge key={sb.id} className="gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold pr-1">
                                  <UserCog className="w-3 h-3" />
                                  <span>{name}</span>
                                  {canManage && (
                                    <button
                                      onClick={() => removeSubstitute(sec.id, sb.id, name)}
                                      className="ml-1 hover:text-amber-900 rounded p-0.5"
                                      title="Retirer"
                                    >
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  )}
                                </Badge>
                              );
                            })}
                          </div>
                        )}

                        {/* Weekly Schedule Chips */}
                        {slotsBySection[sec.id] && slotsBySection[sec.id]!.length > 0 ? (
                          <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#2487B8]" />
                              Aperçu hebdomadaire ({slotsBySection[sec.id]!.length} cours)
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {slotsBySection[sec.id]!.map(slot => (
                                <span
                                  key={slot.id}
                                  className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-700 shadow-2xs"
                                >
                                  <span className="font-bold text-[#2487B8] capitalize">{slot.dayOfWeek.slice(0, 3)}.</span>
                                  <span>{slot.startTime.slice(0, 5)}–{slot.endTime.slice(0, 5)}</span>
                                  {slot.subjectName && <span className="font-semibold text-[#16212B]">· {slot.subjectName}</span>}
                                  {slot.roomLabel && <span className="text-slate-400 font-mono">({slot.roomLabel})</span>}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic pt-1">
                            Aucun cours programmé dans l&apos;emploi du temps pour cette section.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedClassForSections(null)}
                className="h-8 px-4 rounded-xl text-xs font-bold"
              >
                Fermer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

