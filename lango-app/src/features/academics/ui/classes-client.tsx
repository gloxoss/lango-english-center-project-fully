'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Trash2, Pencil, ArrowRight, ChevronDown, ChevronUp, UserCog } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/use-permissions';
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

// ponytail: the previous mock invented a 4-tab structure (Classes/Cycles/
// Filières/Modèles) with a cycle hierarchy, capacity, room, and main-teacher
// fields that have no home on the real `classes` table (flat: name + medium
// + shift + stream FKs). "Filières" already has its own real, separate page
// (streams-view.tsx) - not duplicated here. "Cycles" and "Modèles
// d'enseignement" have no real schema concept at all - dropped rather than
// invented, same policy applied throughout this app.
export function ClassesClient({ locale }: { locale?: string } = {}) {
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
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [sectionsByClass, setSectionsByClass] = useState<Record<string, SectionRow[]>>({});
  const [teachers, setTeachers] = useState<RefOption[]>([]);
  const [rooms, setRooms] = useState<RefOption[]>([]);
  const [allSections, setAllSections] = useState<RefOption[]>([]);
  const [sectionChoice, setSectionChoice] = useState<Record<string, string>>({});
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [slotsBySection, setSlotsBySection] = useState<Record<string, PreviewSlot[]>>({});
  const [substitutesBySection, setSubstitutesBySection] = useState<Record<string, Array<{ id: string; teacherId: string; role: string }>>>({});

  const loadSubstitutes = (sectionId: string) => {
    fetch(`/api/academics/class-teachers?classSectionId=${sectionId}&pageSize=50`)
      .then(r => r.json())
      .then(j => {
        if (j?.success) {
          const subs = (j.data as Array<{ id: string; teacherId: string; role: string }>).filter(ct => ct.role === 'substitute');
          setSubstitutesBySection(prev => ({ ...prev, [sectionId]: subs }));
        }
      });
  };

  // §6.14: assign a substitute ("professeur remplaçant") to cover a section.
  const assignSubstitute = async (sectionId: string, teacherId: string) => {
    if (!teacherId) return;
    if ((substitutesBySection[sectionId] ?? []).some(sb => sb.teacherId === teacherId)) return;
    await fetch('/api/academics/class-teachers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classSectionId: sectionId, teacherId, role: 'substitute', notes: 'Remplaçant' }),
    });
    loadSubstitutes(sectionId);
  };

  const loadSections = (classId: string) => {
    fetch(`/api/academics/class-sections?classId=${classId}&pageSize=100`)
      .then(r => r.json())
      .then(j => { if (j?.success) { setSectionsByClass(prev => ({ ...prev, [classId]: j.data })); Promise.all(j.data.map((s: SectionRow) => fetch(`/api/academics/timetable-slots?classSectionId=${s.id}`).then(r => r.json()))).then(results => setSlotsBySection(prev => ({ ...prev, ...Object.fromEntries(j.data.map((s: SectionRow, i: number) => [s.id, results[i]?.success ? results[i].data : []])) }))); j.data.forEach((s: SectionRow) => loadSubstitutes(s.id)); } });
  };

  const toggleExpand = (classId: string) => {
    if (expandedClassId === classId) {
      setExpandedClassId(null);
      return;
    }
    setExpandedClassId(classId);
    if (!sectionsByClass[classId]) {
      loadSections(classId);
    }
  };

  const updateSection = async (classId: string, sectionRowId: string, patch: { maxStudents?: number | null; homeRoomId?: string | null }) => {
    setSectionsByClass(prev => ({
      ...prev,
      [classId]: prev[classId]?.map(s => (s.id === sectionRowId ? { ...s, ...patch } : s)) ?? [],
    }));
    await fetch('/api/academics/class-sections', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sectionRowId, ...patch }),
    });
  };

  const setHomeroomTeacher = async (classId: string, sectionRowId: string, teacherId: string) => {
    setSectionsByClass(prev => ({
      ...prev,
      [classId]: prev[classId]?.map(s => (s.id === sectionRowId ? { ...s, homeroomTeacherId: teacherId || null } : s)) ?? [],
    }));
    if (teacherId) {
      await fetch(`/api/academics/class-sections/${sectionRowId}/homeroom-teacher`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId }),
      });
    } else {
      await fetch(`/api/academics/class-sections/${sectionRowId}/homeroom-teacher`, { method: 'DELETE' });
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
      periodType: cls.periodType || (cls.includeSemesters ? 'semester' : 'trimester'), sectionCount: '0', teacherId: '',
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
      setShowForm(false);
      load();
    } catch {
      setError('Connexion impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/academics/classes?id=${id}`, { method: 'DELETE' });
    load();
  };

  const filtered = classes.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const canManage = can('academics.manage');
  const likelyShift = shifts.find(s => s.id === form.shiftId);
  const isTeacherAvailable = (teacherId: string) => availability.some(v => v.teacherId === teacherId && (!likelyShift?.startTime || !likelyShift?.endTime || (v.startTime <= likelyShift.startTime && v.endTime >= likelyShift.endTime)));
  const rankedTeachers = [...teachers].sort((a, b) => Number(isTeacherAvailable(b.id)) - Number(isTeacherAvailable(a.id)));
  const attachSection = async (classId: string) => { const sectionId = sectionChoice[classId]; if (!sectionId) return; await fetch('/api/academics/class-sections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classId, sectionId }) }); setSectionChoice(p => ({ ...p, [classId]: '' })); loadSections(classId); };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Classes</h1>
          <p className="text-xs text-slate-500 mt-1">{classes.length} classe(s) réelle(s) pour cet établissement.</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={openCreate} className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Nouvelle classe
          </Button>
        )}
      </div>

      <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Rechercher une classe..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none" />
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
                {CYCLE_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">Mode de période</label>
              <select value={form.periodType} onChange={e => setForm({ ...form, periodType: e.target.value })} className="h-9 w-full rounded-xl border border-slate-200 px-3 font-medium">
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
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="h-9 rounded-xl text-xs font-bold">
              Annuler
            </Button>
          </div>
        </Card>
      )}

      <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
            <tr>
              <th className="py-3.5 px-4">Classe</th>
              <th className="py-3.5 px-4">Médium</th>
              <th className="py-3.5 px-4">Shift</th>
              <th className="py-3.5 px-4">Filière</th>
              <th className="py-3.5 px-4">Cycle</th>
              <th className="py-3.5 px-4">Période (§6.5)</th>
              <th className="py-3.5 px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-slate-400">Aucune classe configurée.</td></tr>
            )}
            {filtered.map(cls => (
              <Fragment key={cls.id}>
              <tr className="hover:bg-slate-50/80 transition font-medium">
                <td className="py-3.5 px-4 font-bold text-[#16212B]">{cls.name}</td>
                <td className="py-3.5 px-4 text-slate-600">{nameOf(mediums, cls.mediumId) ?? '—'}</td>
                <td className="py-3.5 px-4 text-slate-600">{nameOf(shifts, cls.shiftId) ?? '—'}</td>
                <td className="py-3.5 px-4 text-slate-600">{nameOf(streams, cls.streamId) ?? '—'}</td>
                <td className="py-3.5 px-4 text-slate-600">{CYCLE_OPTIONS.find(c => c.value === cls.cycle)?.label ?? '—'}</td>
                <td className="py-3.5 px-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-[#0066FF] border border-blue-200/60">
                    {cls.periodType === 'trimester' ? 'Trimestriel' : cls.periodType === 'month' ? 'Mensuel' : 'Semestriel'}
                  </span>
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => toggleExpand(cls.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#2487B8]" title="Sections">
                      {expandedClassId === cls.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    <Link href={`/${locale || 'fr'}/dashboard/academics/classes/${cls.id}`} className="p-1.5 rounded-lg text-slate-400 hover:bg-[#DCEBF4] hover:text-[#1B6C93]" title="Voir la classe">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    {canManage && (
                      <>
                        <button onClick={() => openEdit(cls)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#2487B8]">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(cls.id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
              {expandedClassId === cls.id && (
                <tr>
                  <td colSpan={7} className="bg-slate-50/60 px-4 py-3">
                    {canManage && <div className="mb-3 flex max-w-md items-end gap-2"><div className="flex-1"><SectionCombobox sections={allSections} value={sectionChoice[cls.id] || ''} onChange={id => setSectionChoice(p => ({ ...p, [cls.id]: id }))} onCreated={s => setAllSections(p => [...p, s])} /></div><Button size="sm" onClick={() => attachSection(cls.id)} disabled={!sectionChoice[cls.id]} className="bg-[#2487B8] hover:bg-[#1B6C93]">Lier</Button></div>}
                    {!sectionsByClass[cls.id] && <p className="text-[11px] text-slate-400">Chargement des sections...</p>}
                    {sectionsByClass[cls.id]?.length === 0 && <p className="text-[11px] text-slate-400">Aucune section pour cette classe.</p>}
                    {(sectionsByClass[cls.id]?.length ?? 0) > 0 && (
                      <div className="space-y-2">
                        {sectionsByClass[cls.id]!.map(sec => (
                          <div key={sec.id} className="flex flex-wrap items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-100 text-[11px]">
                            <span className="font-extrabold text-[#16212B] w-16">{sec.sectionName}</span>
                            <span className="text-slate-500">
                              {sec.enrolledCount}
                              {' / '}
                              <input
                                type="number"
                                min={1}
                                defaultValue={sec.maxStudents ?? ''}
                                onBlur={e => updateSection(cls.id, sec.id, { maxStudents: e.target.value ? Number(e.target.value) : null })}
                                className="w-12 h-6 rounded border border-slate-200 px-1 text-center"
                                placeholder="—"
                              />
                              {' élèves'}
                            </span>
                            <select
                              value={sec.homeroomTeacherId ?? ''}
                              onChange={e => setHomeroomTeacher(cls.id, sec.id, e.target.value)}
                              className="h-7 px-2 rounded-lg border border-slate-200"
                            >
                              <option value="">Professeur principal...</option>
                              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            <select
                              value=""
                              onChange={e => assignSubstitute(sec.id, e.target.value)}
                              className="h-7 px-2 rounded-lg border border-slate-200"
                            >
                              <option value="">Remplaçant...</option>
                              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            {(substitutesBySection[sec.id] ?? []).map(sb => {
                              const t = teachers.find(x => x.id === sb.teacherId);
                              return (
                                <Badge key={sb.id} className="gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                                  <UserCog className="w-3 h-3" /> {t?.name ?? sb.teacherId}
                                </Badge>
                              );
                            })}
                            {(slotsBySection[sec.id]?.length ?? 0) > 0 && <div className="w-full border-t border-slate-100 pt-2"><p className="mb-1 font-bold text-slate-500">Aperçu hebdomadaire</p><div className="flex flex-wrap gap-1">{slotsBySection[sec.id]!.map(slot => <span key={slot.id} className="rounded-lg bg-[#DCEBF4] px-2 py-1 text-[#1B6C93]">{slot.dayOfWeek} {slot.startTime.slice(0, 5)}–{slot.endTime.slice(0, 5)}{slot.subjectName ? ` · ${slot.subjectName}` : ''}</span>)}</div></div>}
                            <select
                              value={sec.homeRoomId ?? ''}
                              onChange={e => updateSection(cls.id, sec.id, { homeRoomId: e.target.value || null })}
                              className="h-7 px-2 rounded-lg border border-slate-200"
                            >
                              <option value="">Salle de base...</option>
                              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
