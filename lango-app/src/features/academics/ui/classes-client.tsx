'use client';

import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCog,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/hooks/use-permissions';
import { SectionCombobox } from './section-combobox';

type ClassRow = {
  id: string;
  name: string;
  includeSemesters: boolean;
  periodType: 'semester' | 'trimester' | 'month';
  mediumId: string;
  shiftId: string | null;
  streamId: string | null;
  cycle: string | null;
  schoolId: string;
  branchId: string | null;
  branchName: string | null;
  sectionCount: number;
  studentCount: number;
  capacityTotal: number;
  capacityConfigured: boolean;
  subjectCount: number;
};
const CLASS_PAGE_SIZE = 20;
type RefOption = { id: string; name: string; startTime?: string; endTime?: string };

// Labels come from Academics.cycle* and ClassesPage.periodModes.*.
const CYCLE_OPTIONS = ['maternelle', 'primaire', 'college', 'lycee'] as const;
const PERIOD_MODE_OPTIONS = ['semester', 'trimester', 'month'] as const;
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
  const cp = useTranslations('ClassesPage');
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
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [periodsConfigured, setPeriodsConfigured] = useState(true);
  const didMountRef = useRef(false);

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

  const load = (opts?: { page?: number; search?: string }) => {
    const nextPage = opts?.page ?? page;
    const term = opts?.search ?? search;
    setLoading(true);
    setPage(nextPage);
    fetch(`/api/academics/classes?page=${nextPage}&pageSize=${CLASS_PAGE_SIZE}&search=${encodeURIComponent(term)}`)
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) {
          setClasses(json.data);
          setTotal(Number(json.total ?? json.data.length));
          setPeriodsConfigured(json.academicPeriodsConfigured !== false);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const loadSubstitutes = (sectionId: string) => {
    fetch(`/api/academics/class-teachers?classSectionId=${sectionId}&pageSize=50`)
      .then(r => r.json())
      .then((j) => {
        if (j?.success) {
          const subs = (j.data as Array<{ id: string; teacherId: string; role: string }>).filter(ct => ct.role === 'substitute');
          setSubstitutesBySection(prev => ({ ...prev, [sectionId]: subs }));
        }
      })
      .catch(() => {});
  };

  const assignSubstitute = async (sectionId: string, teacherId: string) => {
    if (!teacherId) {
      return;
    }
    if ((substitutesBySection[sectionId] ?? []).some(sb => sb.teacherId === teacherId)) {
      return;
    }
    try {
      const res = await fetch('/api/academics/class-teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classSectionId: sectionId, teacherId, role: 'substitute', notes: cp('substituteNote') }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(cp('substituteAssigned'));
        loadSubstitutes(sectionId);
      } else {
        toast.error(json.error?.message || 'Échec de l\'affectation du remplaçant');
      }
    } catch {
      toast.error(cp('networkError'));
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
      toast.error(cp('networkError'));
    }
  };

  const loadSections = (classId: string) => {
    fetch(`/api/academics/class-sections?classId=${classId}&pageSize=100`)
      .then(r => r.json())
      .then((j) => {
        if (j?.success) {
          setSectionsByClass(prev => ({ ...prev, [classId]: j.data }));
        }
      })
      .catch(() => {});
  };

  const loadSectionDetails = (sectionId: string) => {
    if (!slotsBySection[sectionId]) {
      fetch(`/api/academics/timetable-slots?classSectionId=${sectionId}`)
        .then(r => r.json())
        .then(j => setSlotsBySection(prev => ({ ...prev, [sectionId]: j?.success ? j.data : [] })))
        .catch(() => setSlotsBySection(prev => ({ ...prev, [sectionId]: [] })));
    }
    if (!substitutesBySection[sectionId]) {
      loadSubstitutes(sectionId);
    }
  };

  const toggleSectionDetails = (sectionId: string) => {
    const next = expandedSectionId === sectionId ? null : sectionId;
    setExpandedSectionId(next);
    if (next) {
      loadSectionDetails(next);
    }
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
      toast.error(cp('selectSection'));
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
        toast.error(json.error?.message || json.message || cp('linkSectionError'));
        return;
      }
      toast.success(cp('sectionLinked'));
      setNewSectionId('');
      setNewSectionMaxStudents('');
      setNewSectionHomeRoomId('');
      loadSections(classId);
      load();
    } catch {
      toast.error(cp('linkSectionNetworkError'));
    } finally {
      setLinkingSection(false);
    }
  };

  const handleUnlinkSection = (classId: string, sectionRowId: string, sectionName: string) => {
    toast(cp('confirmUnlinkSection', { name: sectionName }), {
      action: {
        label: tCommon('confirm'),
        onClick: () => {
          void performUnlinkSection(classId, sectionRowId, sectionName);
        },
      },
    });
  };

  async function performUnlinkSection(classId: string, sectionRowId: string, sectionName: string) {
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
      load();
    } catch {
      toast.error(cp('networkError'));
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
        toast.success(cp('changesSaved'));
        load();
      } else {
        toast.error(json.error?.message || 'Échec de la mise à jour');
      }
    } catch {
      toast.error(cp('networkError'));
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
          toast.success(cp('homeroomAssigned'));
        } else {
          toast.error(json.error?.message || 'Échec de l\'attribution');
        }
      } else {
        // Said "removed" whatever the server answered.
        const res = await fetch(`/api/academics/class-sections/${sectionRowId}/homeroom-teacher`, { method: 'DELETE' });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success !== false) {
          toast.success(cp('homeroomRemoved'));
        } else {
          toast.error(json?.error?.message || json?.message || cp('updateError'));
        }
      }
    } catch {
      toast.error(cp('updateError'));
    }
  };

  useEffect(() => {
    load({ page: 1 });
    fetch('/api/academics/mediums?pageSize=100').then(r => r.json()).then(j => j?.success && setMediums(j.data));
    fetch('/api/academics/shifts?pageSize=100').then(r => r.json()).then(j => j?.success && setShifts(j.data));
    fetch('/api/academics/streams?pageSize=100').then(r => r.json()).then(j => j?.success && setStreams(j.data));
    fetch('/api/teachers?pageSize=200').then(r => r.json()).then(j => j?.success && setTeachers(j.data));
    fetch('/api/academics/rooms?pageSize=200').then(r => r.json()).then(j => j?.success && setRooms(j.data));
    fetch('/api/academics/sections?pageSize=200').then(r => r.json()).then(j => j?.success && setAllSections(j.data));
    fetch('/api/academics/teacher-availability').then(r => r.json()).then(j => j?.success && setAvailability(j.data));
  }, []);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    const timer = setTimeout(load, 300, { page: 1, search });
    return () => clearTimeout(timer);
  }, [search]);

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
      toast.success(editing ? cp('classUpdated') : cp('classCreated'));
      setShowForm(false);
      load({ page: 1 });
    } catch {
      setError(cp('connectError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    toast(cp('confirmDeleteClass'), {
      action: {
        label: tCommon('confirm'),
        onClick: () => {
          void performDeleteClass(id);
        },
      },
    });
  };

  async function performDeleteClass(id: string) {
    try {
      const res = await fetch(`/api/academics/classes?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success(cp('classDeleted'));
        load();
      } else {
        toast.error(json.error?.message || 'Échec de la suppression');
      }
    } catch {
      toast.error(cp('networkError'));
    }
  };

  const canManage = can('academics.manage');
  const pageCount = Math.max(1, Math.ceil(total / CLASS_PAGE_SIZE));
  const setupGaps = (cls: ClassRow) => {
    const gaps: string[] = [];
    if (cls.sectionCount === 0) {
      gaps.push(t('sectionsCol'));
    }
    if (!cls.capacityConfigured) {
      gaps.push(t('capacityNotConfigured'));
    }
    if (cls.subjectCount === 0) {
      gaps.push(t('programCol'));
    }
    if (!periodsConfigured) {
      gaps.push(t('periodNotConfigured'));
    }
    return gaps;
  };
  const nameHasSectionSuffix = /^.*\d\s+[A-Z]$/i.test(form.name.trim());
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
    <div className="mx-auto max-w-[1200px] space-y-6 pb-12">
      <div className="
        flex flex-col justify-between gap-4
        sm:flex-row sm:items-center
      "
      >
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('classesTitle')}</h1>
          <p className="mt-1 text-xs text-slate-500">{t('classCountSubtitle', { count: classes.length })}</p>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={openCreate}
            className="
              h-9 gap-1.5 rounded-xl bg-[#2487B8] text-xs font-bold text-white
              hover:bg-[#1B6C93]
            "
          >
            <Plus className="size-3.5" />
            {t('newClass')}
          </Button>
        )}
      </div>

      <Card className="
        rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs
      "
      >
        <div className="
          relative w-full
          sm:w-80
        "
        >
          <Search className="
            absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400
          "
          />
          <Input
            placeholder={t('searchClassPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 rounded-xl border-none bg-slate-50 pl-9 text-xs"
          />
        </div>
      </Card>

      {canManage && showForm && (
        <Card className="
          space-y-3 rounded-2xl border border-slate-200/80 bg-white p-5
          shadow-2xs
        "
        >
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          <div className="
            grid grid-cols-1 gap-3 text-xs
            sm:grid-cols-3
            lg:grid-cols-4
          "
          >
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{cp('className')}</label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="h-9 rounded-xl"
                placeholder={cp('classNamePlaceholder')}
              />
              {nameHasSectionSuffix && (
                <p className="
                  flex items-start gap-1 pt-0.5 text-[10px] font-semibold
                  text-amber-700
                "
                >
                  <AlertCircle className="mt-0.5 size-3 shrink-0" />
                  {t('namingWarning')}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{cp('medium')}</label>
              <select
                value={form.mediumId}
                onChange={e => setForm({ ...form, mediumId: e.target.value })}
                className="h-9 w-full rounded-xl border border-slate-200 px-3"
              >
                <option value="">{cp('select')}</option>
                {mediums.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{cp('shiftOptional')}</label>
              <select
                value={form.shiftId}
                onChange={e => setForm({ ...form, shiftId: e.target.value })}
                className="h-9 w-full rounded-xl border border-slate-200 px-3"
              >
                <option value="">{cp('noneM')}</option>
                {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{cp('streamOptional')}</label>
              <select
                value={form.streamId}
                onChange={e => setForm({ ...form, streamId: e.target.value })}
                className="h-9 w-full rounded-xl border border-slate-200 px-3"
              >
                <option value="">{cp('noneF')}</option>
                {streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{cp('cycleOptional')}</label>
              <select
                value={form.cycle}
                onChange={e => setForm({ ...form, cycle: e.target.value })}
                className="h-9 w-full rounded-xl border border-slate-200 px-3"
              >
                <option value="">{cp('noneM')}</option>
                {CYCLE_OPTIONS.map(c => <option key={c} value={c}>{cycleLabels[c] || c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{cp('periodMode')}</label>
              <select
                value={form.periodType}
                onChange={e => setForm({ ...form, periodType: e.target.value as any })}
                className="
                  h-9 w-full rounded-xl border border-slate-200 px-3 font-medium
                "
              >
                {PERIOD_MODE_OPTIONS.map(p => <option key={p} value={p}>{cp(`periodModes.${p}`)}</option>)}
              </select>
            </div>
            {!editing && (
              <>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">{cp('sectionCount')}</label>
                  <Input
                    type="number"
                    min={0}
                    max={26}
                    value={form.sectionCount}
                    onChange={e => setForm({ ...form, sectionCount: e.target.value })}
                    className="h-9 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">{cp('homeroomTeacher')}</label>
                  <select
                    value={form.teacherId}
                    onChange={e => setForm({ ...form, teacherId: e.target.value })}
                    className="
                      h-9 w-full rounded-xl border border-slate-200 px-3
                    "
                  >
                    <option value="">{cp('assignLater')}</option>
                    {rankedTeachers.map(t => (
                      <option key={t.id} value={t.id}>
                        {isTeacherAvailable(t.id) ? `${cp('available')} · ` : ''}
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={saving}
              onClick={handleSave}
              className="
                h-9 rounded-xl bg-[#2487B8] text-xs font-bold text-white
                hover:bg-[#1B6C93]
              "
            >
              {saving ? tCommon('loading') : tCommon('save')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowForm(false)}
              className="h-9 rounded-xl text-xs font-bold"
            >
              {tCommon('cancel')}
            </Button>
          </div>
        </Card>
      )}

      {/* Main Classes Table */}
      <Card className="
        rounded-2xl border border-slate-200/80 bg-white shadow-2xs
      "
      >
        <div className="
          hidden overflow-x-auto
          md:block
        "
        >
          <table className="w-full text-left text-xs">
            <thead className="
              border-b border-slate-200/80 bg-[#F6F9FC] font-extrabold
              text-[#16212B]
            "
            >
              <tr>
                <th className="px-4 py-3.5 text-start">{t('classCol')}</th>
                <th className="px-4 py-3.5 text-start">{t('campusCol')}</th>
                <th className="px-4 py-3.5 text-start">{t('sectionsCol')}</th>
                <th className="px-4 py-3.5 text-start">{t('studentsCol')}</th>
                <th className="px-4 py-3.5 text-start">{t('capacityCol')}</th>
                <th className="px-4 py-3.5 text-start">{t('programCol')}</th>
                <th className="px-4 py-3.5 text-start">{t('statusCol')}</th>
                <th className="px-4 py-3.5 text-end">{t('actionsCol')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!loading && classes.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    {search.trim() ? t('emptySearchClasses', { term: search.trim() }) : t('noClassesConfigured')}
                  </td>
                </tr>
              )}
              {classes.map(cls => (
                <tr
                  key={cls.id}
                  className="
                    font-medium transition
                    hover:bg-slate-50/80
                  "
                >
                  <td className="px-4 py-3.5 text-start">
                    <div className="font-bold text-[#16212B]">{cls.name}</div>
                    <div className="
                      mt-0.5 text-[10px] font-medium text-slate-500
                    "
                    >
                      {[nameOf(mediums, cls.mediumId), cls.cycle ? cycleLabels[cls.cycle] : null, nameOf(streams, cls.streamId), cls.shiftId ? nameOf(shifts, cls.shiftId) : null].filter(Boolean).join(' · ') || '—'}
                      {/* Lycée classes are graded by filière coefficients: say when none is set (audit S-17). */}
                      {cls.cycle === 'lycee' && !cls.streamId && (
                        <span className="ms-1 font-bold text-amber-700">
                          ·
                          {t('filiereMissing')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-start text-slate-600">{cls.branchName ?? '—'}</td>
                  <td className="px-4 py-3.5 text-start">
                    <button
                      onClick={() => openSectionsModal(cls)}
                      className="
                        inline-flex items-center gap-1 rounded-lg border
                        border-slate-200/80 bg-slate-100 px-2 py-0.5 text-[11px]
                        font-bold text-slate-700 transition
                        hover:border-[#2487B8]/40 hover:bg-[#DCEBF4]/50
                        hover:text-[#1B6C93]
                      "
                      title={t('manageSectionsBtn')}
                    >
                      <Layers className="size-3" />
                      {cls.sectionCount}
                    </button>
                  </td>
                  <td className="
                    px-4 py-3.5 text-start font-bold text-slate-600
                  "
                  >
                    {cls.studentCount}
                  </td>
                  <td className="px-4 py-3.5 text-start">
                    {cls.capacityConfigured
                      ? (
                          <span className="font-bold text-slate-600">{cls.capacityTotal}</span>
                        )
                      : cls.sectionCount === 0
                        ? (
                            <span className="text-slate-300">—</span>
                          )
                        : (
                            <button
                              onClick={() => openSectionsModal(cls)}
                              className="
                                rounded-md border border-amber-200 bg-amber-50
                                px-1.5 py-0.5 text-[10px] font-bold
                                text-amber-700 transition
                                hover:bg-amber-100
                              "
                            >
                              {t('capacityDefine')}
                            </button>
                          )}
                  </td>
                  <td className="px-4 py-3.5 text-start text-slate-600">{cls.subjectCount}</td>
                  <td className="px-4 py-3.5 text-start">
                    {setupGaps(cls).length === 0
                      ? (
                          <span className="
                            inline-flex items-center gap-1 rounded-md border
                            border-emerald-200/60 bg-emerald-50 px-2 py-0.5
                            text-[10px] font-bold text-emerald-700
                          "
                          >
                            <Check className="size-3" />
                            {t('statusOperational')}
                          </span>
                        )
                      : (
                          <span
                            title={setupGaps(cls).join(' · ')}
                            className="
                              inline-flex items-center gap-1 rounded-md border
                              border-amber-200/60 bg-amber-50 px-2 py-0.5
                              text-[10px] font-bold text-amber-700
                            "
                          >
                            <AlertCircle className="size-3" />
                            {t('statusNeedsSetup')}
                          </span>
                        )}
                  </td>
                  <td className="px-4 py-3.5 text-end">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openSectionsModal(cls)}
                        className="
                          rounded-lg p-1.5 text-slate-400 transition
                          hover:bg-[#DCEBF4] hover:text-[#1B6C93]
                        "
                        title={t('manageSectionsBtn')}
                      >
                        <Layers className="size-3.5" />
                      </button>
                      <Link
                        href={`/${locale || 'fr'}/dashboard/academics/classes/${cls.id}`}
                        className="
                          rounded-lg p-1.5 text-slate-400 transition
                          hover:bg-[#DCEBF4] hover:text-[#1B6C93]
                        "
                        title={t('openClassBtn')}
                      >
                        <ArrowRight className="size-3.5" />
                      </Link>
                      {canManage && (
                        <>
                          <button
                            onClick={() => openEdit(cls)}
                            className="
                              rounded-lg p-1.5 text-slate-400 transition
                              hover:bg-slate-100 hover:text-[#2487B8]
                            "
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(cls.id)}
                            className="
                              rounded-lg p-1.5 text-slate-400 transition
                              hover:bg-rose-50 hover:text-rose-600
                            "
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="
          divide-y divide-slate-100
          md:hidden
        "
        >
          {loading && <p className="py-8 text-center text-xs text-slate-400">{tCommon('loading')}</p>}
          {!loading && classes.length === 0 && (
            <p className="py-8 text-center text-xs text-slate-400">
              {search.trim() ? t('emptySearchClasses', { term: search.trim() }) : t('noClassesConfigured')}
            </p>
          )}
          {classes.map((cls) => {
            const gaps = setupGaps(cls);
            return (
              <div key={cls.id} className="space-y-2.5 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="
                      truncate text-sm font-extrabold text-[#16212B]
                    "
                    >
                      {cls.name}
                    </p>
                    <p className="
                      truncate text-[10px] font-medium text-slate-500
                    "
                    >
                      {[nameOf(mediums, cls.mediumId), cls.cycle ? cycleLabels[cls.cycle] : null, nameOf(streams, cls.streamId), cls.branchName].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  {gaps.length === 0
                    ? (
                        <span className="
                          inline-flex shrink-0 items-center gap-1 rounded-md
                          border border-emerald-200/60 bg-emerald-50 px-2 py-0.5
                          text-[10px] font-bold text-emerald-700
                        "
                        >
                          <Check className="size-3" />
                          {t('statusOperational')}
                        </span>
                      )
                    : (
                        <span
                          title={gaps.join(' · ')}
                          className="
                            inline-flex shrink-0 items-center gap-1 rounded-md
                            border border-amber-200/60 bg-amber-50 px-2 py-0.5
                            text-[10px] font-bold text-amber-700
                          "
                        >
                          <AlertCircle className="size-3" />
                          {t('statusNeedsSetup')}
                        </span>
                      )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="
                    rounded-lg border border-slate-100 bg-slate-50 py-1.5
                  "
                  >
                    <p className="text-[10px] font-bold text-slate-400">{t('sectionsCol')}</p>
                    <p className="text-xs font-extrabold text-[#16212B]">{cls.sectionCount}</p>
                  </div>
                  <div className="
                    rounded-lg border border-slate-100 bg-slate-50 py-1.5
                  "
                  >
                    <p className="text-[10px] font-bold text-slate-400">{t('studentsCol')}</p>
                    <p className="text-xs font-extrabold text-[#16212B]">{cls.studentCount}</p>
                  </div>
                  <div className="
                    rounded-lg border border-slate-100 bg-slate-50 py-1.5
                  "
                  >
                    <p className="text-[10px] font-bold text-slate-400">{t('capacityCol')}</p>
                    <p className={`
                      text-xs font-extrabold
                      ${cls.capacityConfigured
                ? `text-[#16212B]`
                : `text-amber-700`}
                    `}
                    >
                      {cls.capacityConfigured ? cls.capacityTotal : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="
                    truncate text-[10px] font-bold text-slate-500
                  "
                  >
                    {cls.subjectCount}
                    {' '}
                    {t('programCol')}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openSectionsModal(cls)}
                      className="
                        h-11 gap-1 rounded-lg px-3 text-[11px] font-bold
                      "
                    >
                      <Layers className="size-3.5" />
                      {t('manageSectionsBtn')}
                    </Button>
                    <Link
                      href={`/${locale || 'fr'}/dashboard/academics/classes/${cls.id}`}
                      className="
                        inline-flex h-11 items-center rounded-lg border
                        border-slate-200 px-3 text-[11px] font-bold
                        text-[#2487B8]
                        hover:bg-slate-50
                      "
                    >
                      {t('openClassBtn')}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {total > CLASS_PAGE_SIZE && (
          <div className="
            flex items-center justify-between border-t border-slate-100 px-4
            py-2.5 text-[11px] font-bold text-slate-500
          "
          >
            <span>{t('pageSummary', { page, pages: pageCount })}</span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => load({ page: page - 1 })}
                className="h-7 rounded-lg px-2 text-[11px]"
              >
                {t('prevPage')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pageCount || loading}
                onClick={() => load({ page: page + 1 })}
                className="h-7 rounded-lg px-2 text-[11px]"
              >
                {t('nextPage')}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* DEDICATED SECTIONS MANAGEMENT MODAL DIALOG */}
      {selectedClassForSections && (
        <Dialog open={!!selectedClassForSections} onOpenChange={open => !open && setSelectedClassForSections(null)}>
          <DialogContent className="
            max-h-[85vh] max-w-3xl space-y-4 overflow-y-auto rounded-2xl border
            border-slate-200 bg-white p-5 shadow-xl
          "
          >
            <DialogHeader className="border-b border-slate-100 pb-3">
              <div className="
                flex flex-col justify-between gap-2
                sm:flex-row sm:items-center
              "
              >
                <div className="flex items-center gap-2.5">
                  <div className="
                    flex size-8 shrink-0 items-center justify-center rounded-lg
                    bg-[#2487B8]/10 font-bold text-[#2487B8]
                  "
                  >
                    <Layers className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <DialogTitle className="
                        text-base font-extrabold text-[#16212B]
                      "
                      >
                        {cp('sectionsOf')}
                        {' '}
                        {selectedClassForSections.name}
                      </DialogTitle>
                      {periodsConfigured
                        ? (
                            <span className="
                              inline-flex items-center rounded-sm border
                              border-blue-200/60 bg-blue-50 px-1.5 py-0.5
                              text-[10px] font-bold text-[#0066FF]
                            "
                            >
                              {selectedClassForSections.periodType === 'trimester' ? t('periodTrimester') : selectedClassForSections.periodType === 'month' ? t('periodMonth') : t('periodSemester')}
                            </span>
                          )
                        : (
                            <span className="
                              inline-flex items-center gap-1 rounded-sm border
                              border-amber-200/60 bg-amber-50 px-1.5 py-0.5
                              text-[10px] font-bold text-amber-700
                            "
                            >
                              <AlertCircle className="size-3" />
                              {t('periodNotConfigured')}
                            </span>
                          )}
                    </div>
                    <DialogDescription className="
                      mt-0.5 text-[11px] text-slate-500
                    "
                    >
                      {nameOf(mediums, selectedClassForSections.mediumId) ?? cp('noMedium')}
                      {selectedClassForSections.cycle ? ` · ${cycleLabels[selectedClassForSections.cycle] || selectedClassForSections.cycle}` : ''}
                      {selectedClassForSections.shiftId ? ` · Shift: ${nameOf(shifts, selectedClassForSections.shiftId)}` : ''}
                    </DialogDescription>
                  </div>
                </div>

                <div className="
                  flex items-center gap-2 self-start rounded-lg bg-slate-50
                  px-2.5 py-1 text-xs font-bold text-slate-600
                  sm:self-auto
                "
                >
                  <span>
                    {(sectionsByClass[selectedClassForSections.id] ?? []).length}
                    {' '}
                    section(s)
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-500">
                    {(sectionsByClass[selectedClassForSections.id] ?? []).reduce((acc, s) => acc + s.enrolledCount, 0)}
                    {' '}
                    {cp('studentsWord')}
                  </span>
                  {(sectionsByClass[selectedClassForSections.id] ?? []).some(s => s.maxStudents === null) && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="text-amber-700">{t('capacityNotConfigured')}</span>
                    </>
                  )}
                </div>
              </div>
            </DialogHeader>

            {/* Quick Add Section Bar (Compact Single Row) */}
            {canManage && (
              <div className="
                flex items-center gap-2 rounded-xl border border-slate-200
                bg-slate-50 p-2.5
              "
              >
                <div className="min-w-[140px] flex-1">
                  <SectionCombobox
                    sections={availableUnlinkedSections}
                    value={newSectionId}
                    onChange={setNewSectionId}
                    onCreated={(s) => {
                      setAllSections(p => [...p, s]);
                      setNewSectionId(s.id);
                    }}
                    placeholder={cp('linkSectionPlaceholder')}
                  />
                </div>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={newSectionMaxStudents}
                  onChange={e => setNewSectionMaxStudents(e.target.value)}
                  placeholder={cp('capacityPlaceholder')}
                  className="h-9 w-24 rounded-xl bg-white text-xs"
                />
                <Button
                  disabled={!newSectionId || linkingSection}
                  onClick={() => handleAttachSection(selectedClassForSections.id)}
                  className="
                    h-9 shrink-0 gap-1 rounded-xl bg-[#2487B8] px-4 text-xs
                    font-bold text-white
                    hover:bg-[#1B6C93]
                  "
                >
                  <Plus className="size-3.5" />
                  <span>{linkingSection ? '…' : cp('link')}</span>
                </Button>
              </div>
            )}

            {/* List of Attached Sections (Clean, Minimalist Compact Rows) */}
            <div className="space-y-2.5">
              {(!sectionsByClass[selectedClassForSections.id] || sectionsByClass[selectedClassForSections.id]!.length === 0) && (
                <div className="
                  space-y-1.5 rounded-2xl border border-dashed border-slate-200
                  bg-slate-50/50 p-6 py-8 text-center
                "
                >
                  <Layers className="mx-auto size-6 text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">{cp('noSections')}</p>
                  <p className="mx-auto max-w-sm text-[11px] text-slate-400">
                    {cp('noSectionsHint')}
                  </p>
                </div>
              )}

              {sectionsByClass[selectedClassForSections.id]?.map((sec) => {
                const fillPercentage = sec.maxStudents ? Math.min(100, Math.round((sec.enrolledCount / sec.maxStudents) * 100)) : null;
                const isExpanded = expandedSectionId === sec.id;
                const slotsCount = (slotsBySection[sec.id] ?? []).length;

                return (
                  <div
                    key={sec.id}
                    className="
                      overflow-hidden rounded-xl border border-slate-200/90
                      bg-white shadow-2xs transition-all
                      hover:border-[#2487B8]/40
                    "
                  >
                    {/* Primary Row: Badge, Name, Homeroom Teacher, Room, Schedule pill & Detach */}
                    <div className="
                      flex flex-wrap items-center justify-between gap-3 p-3
                      sm:flex-nowrap
                    "
                    >
                      {/* Section Badge & Count */}
                      <div className="
                        flex min-w-[130px] shrink-0 items-center gap-2.5
                      "
                      >
                        <span className="
                          flex size-7 shrink-0 items-center justify-center
                          rounded-lg bg-[#16212B] text-xs font-extrabold
                          text-white
                        "
                        >
                          {sec.sectionName}
                        </span>
                        <div>
                          <p className="
                            text-xs/tight font-extrabold text-[#16212B]
                          "
                          >
                            {cp('section')}
                            {' '}
                            {sec.sectionName}
                          </p>
                          <span className="
                            text-[10px] font-medium text-slate-400
                          "
                          >
                            {sec.enrolledCount}
                            {sec.maxStudents ? ` / ${sec.maxStudents}` : ''}
                            {' '}
                            {cp('studentsWord')}
                          </span>
                        </div>
                      </div>

                      {/* Professeur Principal Selector */}
                      <div className="max-w-[210px] min-w-[150px] flex-1">
                        <select
                          value={sec.homeroomTeacherId ?? ''}
                          onChange={e => setHomeroomTeacher(selectedClassForSections.id, sec.id, e.target.value)}
                          className="
                            h-8 w-full truncate rounded-lg border
                            border-slate-200 bg-slate-50 px-2 text-xs
                            font-medium text-[#16212B]
                          "
                          title={cp('homeroomTeacher')}
                        >
                          <option value="">{cp('homeroomShort')}</option>
                          {teachers.map(t => (
                            <option key={t.id} value={t.id}>
                              {isTeacherAvailable(t.id) ? '✓ ' : ''}
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Salle de Base Selector */}
                      <div className="max-w-[150px] min-w-[110px]">
                        <select
                          value={sec.homeRoomId ?? ''}
                          onChange={e => updateSection(selectedClassForSections.id, sec.id, { homeRoomId: e.target.value || null })}
                          className="
                            h-8 w-full truncate rounded-lg border
                            border-slate-200 bg-slate-50 px-2 text-xs
                            font-medium text-[#16212B]
                          "
                          title={cp('homeRoom')}
                        >
                          <option value="">{cp('roomShort')}</option>
                          {rooms.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Action & Toggle Buttons */}
                      <div className="
                        ms-auto flex shrink-0 items-center gap-1.5
                      "
                      >
                        <button
                          type="button"
                          onClick={() => toggleSectionDetails(sec.id)}
                          className={`
                            flex h-8 items-center gap-1 rounded-lg border px-2.5
                            text-xs font-bold transition-all
                            ${
                  isExpanded
                    ? 'border-[#2487B8] bg-[#2487B8] text-white'
                    : slotsCount > 0
                      ? `
                        border-[#2487B8]/20 bg-[#2487B8]/10 text-[#2487B8]
                        hover:bg-[#2487B8]/20
                      `
                      : `
                        border-slate-200 bg-slate-50 text-slate-500
                        hover:bg-slate-100
                      `
                  }
                          `}
                          title={cp('showDetails')}
                        >
                          <Clock className="size-3" />
                          <span>{slotsCount > 0 ? cp('slots', { count: slotsCount }) : cp('details')}</span>
                          {isExpanded
                            ? <ChevronUp className="size-3" />
                            : (
                                <ChevronDown className="size-3" />
                              )}
                        </button>

                        {canManage && (
                          <button
                            onClick={() => handleUnlinkSection(selectedClassForSections.id, sec.id, sec.sectionName)}
                            className="
                              rounded-lg p-1.5 text-slate-400 transition
                              hover:bg-rose-50 hover:text-rose-600
                            "
                            title={cp('unlinkSection')}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Collapsible Details & Planning Drawer */}
                    {isExpanded && (
                      <div className="
                        space-y-3 border-t border-slate-100 bg-slate-50/70 p-3
                        text-xs
                      "
                      >
                        {/* Capacity and Substitute Teacher */}
                        <div className="
                          grid grid-cols-1 gap-3
                          sm:grid-cols-2
                        "
                        >
                          <div className="flex items-center gap-2">
                            <span className="
                              text-[11px] font-bold whitespace-nowrap
                              text-slate-500
                            "
                            >
                              {cp('maxCapacity')}
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              defaultValue={sec.maxStudents ?? ''}
                              onBlur={e => updateSection(selectedClassForSections.id, sec.id, { maxStudents: e.target.value ? Number(e.target.value) : null })}
                              className="
                                h-7 w-16 rounded-lg border border-slate-200
                                bg-white text-center text-xs font-bold
                              "
                              placeholder="30"
                            />
                            <span className={`
                              text-[10px]
                              ${fillPercentage === null
                        ? `font-bold text-amber-700`
                        : `text-slate-400`}
                            `}
                            >
                              {fillPercentage === null ? t('capacityNotConfigured') : `(${fillPercentage}%)`}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="
                              text-[11px] font-bold whitespace-nowrap
                              text-slate-500
                            "
                            >
                              {cp('substitute')}
                            </span>
                            <select
                              value=""
                              onChange={e => assignSubstitute(sec.id, e.target.value)}
                              className="
                                h-7 flex-1 rounded-lg border border-slate-200
                                bg-white px-2 text-[11px] font-medium
                              "
                            >
                              <option value="">{cp('assign')}</option>
                              {teachers.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Substitute Badges if any */}
                        {(substitutesBySection[sec.id] ?? []).length > 0 && (
                          <div className="
                            flex flex-wrap items-center gap-1.5 pt-1
                          "
                          >
                            <span className="
                              text-[10px] font-bold text-slate-400
                            "
                            >
                              {cp('substitutes')}
                            </span>
                            {(substitutesBySection[sec.id] ?? []).map((sb) => {
                              const teacher = teachers.find(x => x.id === sb.teacherId);
                              const name = teacher?.name ?? sb.teacherId;
                              return (
                                <Badge
                                  key={sb.id}
                                  className="
                                    gap-1 border border-amber-200 bg-amber-50
                                    pr-1 text-[10px] font-bold text-amber-700
                                  "
                                >
                                  <UserCog className="size-3" />
                                  <span>{name}</span>
                                  {canManage && (
                                    <button
                                      onClick={() => removeSubstitute(sec.id, sb.id, name)}
                                      className="
                                        ml-1 rounded-sm p-0.5
                                        hover:text-amber-900
                                      "
                                      title={cp('remove')}
                                    >
                                      <X className="size-2.5" />
                                    </button>
                                  )}
                                </Badge>
                              );
                            })}
                          </div>
                        )}

                        {/* Weekly Schedule Chips */}
                        {slotsBySection[sec.id] && slotsBySection[sec.id]!.length > 0
                          ? (
                              <div className="
                                space-y-1.5 border-t border-slate-200/60 pt-2
                              "
                              >
                                <p className="
                                  flex items-center gap-1 text-[10px] font-bold
                                  tracking-wider text-slate-400 uppercase
                                "
                                >
                                  <Clock className="size-3 text-[#2487B8]" />
                                  {cp('weeklyPreview', { count: slotsBySection[sec.id]!.length })}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {slotsBySection[sec.id]!.map(slot => (
                                    <span
                                      key={slot.id}
                                      className="
                                        inline-flex items-center gap-1
                                        rounded-md border border-slate-200
                                        bg-white px-2 py-0.5 text-[10px]
                                        font-medium text-slate-700 shadow-2xs
                                      "
                                    >
                                      <span className="
                                        font-bold text-[#2487B8] capitalize
                                      "
                                      >
                                        {slot.dayOfWeek.slice(0, 3)}
                                        .
                                      </span>
                                      <span>
                                        {slot.startTime.slice(0, 5)}
                                        –
                                        {slot.endTime.slice(0, 5)}
                                      </span>
                                      {slot.subjectName && (
                                        <span className="
                                          font-semibold text-[#16212B]
                                        "
                                        >
                                          ·
                                          {slot.subjectName}
                                        </span>
                                      )}
                                      {slot.roomLabel && (
                                        <span className="
                                          font-mono text-slate-400
                                        "
                                        >
                                          (
                                          {slot.roomLabel}
                                          )
                                        </span>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )
                          : (
                              <p className="
                                pt-1 text-[10px] text-slate-400 italic
                              "
                              >
                                {cp('noLessons')}
                              </p>
                            )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedClassForSections(null)}
                className="h-8 rounded-xl px-4 text-xs font-bold"
              >
                {cp('close')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
