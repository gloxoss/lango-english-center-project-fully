'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Trash2, Pencil, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';

type ClassRow = { id: string; name: string; includeSemesters: boolean; periodMode?: string | null; mediumId: string; shiftId: string | null; streamId: string | null; cycle: string | null; schoolId: string };
type RefOption = { id: string; name: string };

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
  { value: 'annual', label: 'Annuel' },
];

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
  const [form, setForm] = useState({ name: '', mediumId: '', shiftId: '', streamId: '', cycle: '', periodMode: 'semester' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [sectionsByClass, setSectionsByClass] = useState<Record<string, SectionRow[]>>({});
  const [teachers, setTeachers] = useState<RefOption[]>([]);
  const [rooms, setRooms] = useState<RefOption[]>([]);

  const loadSections = (classId: string) => {
    fetch(`/api/academics/class-sections?classId=${classId}&pageSize=100`)
      .then(r => r.json())
      .then(j => j?.success && setSectionsByClass(prev => ({ ...prev, [classId]: j.data })));
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
  }, []);

  const nameOf = (options: RefOption[], id: string | null) => options.find(o => o.id === id)?.name ?? null;

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', mediumId: mediums[0]?.id ?? '', shiftId: '', streamId: '', cycle: '', periodMode: 'semester' });
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
      periodMode: cls.periodMode || (cls.includeSemesters ? 'semester' : 'trimester'),
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
        periodMode: form.periodMode || 'semester',
        includeSemesters: form.periodMode === 'semester',
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
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
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
              <label className="font-bold text-slate-600">Mode Période (§6.5)</label>
              <select value={form.periodMode} onChange={e => setForm({ ...form, periodMode: e.target.value })} className="h-9 w-full rounded-xl border border-slate-200 px-3 font-medium">
                {PERIOD_MODE_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
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
                    {cls.periodMode === 'trimester' ? 'Trimestriel' : cls.periodMode === 'month' ? 'Mensuel' : cls.periodMode === 'annual' ? 'Annuel' : 'Semestriel'}
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
