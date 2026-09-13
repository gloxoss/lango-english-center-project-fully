'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';
import { SchedulePublishBar } from './schedule-publish-bar';

type ClassSectionOption = { id: string; classId: string; className: string; sectionName: string; periodType: 'semester' | 'trimester' | 'month' };
type RefOption = { id: string; name: string };
type Slot = {
  id: string;
  classSectionId: string;
  classSubjectId: string;
  teacherId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomLabel: string | null;
};

export function ScheduleClient({ locale: _locale }: { locale?: string } = {}) {
  const t = useTranslations('Academics');
  const tCommon = useTranslations('Common');
  const { can } = usePermissions();

  const [sessionYearId, setSessionYearId] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string>('');
  const [classSections, setClassSections] = useState<ClassSectionOption[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('1');
  const [classSubjects, setClassSubjects] = useState<(RefOption & { subjectId: string })[]>([]);
  const [subjects, setSubjects] = useState<RefOption[]>([]);
  const [teachers, setTeachers] = useState<RefOption[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'class' | 'teacher' | 'room'>('class');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [allSlots, setAllSlots] = useState<Slot[]>([]);
  const [selectedRoomLabel, setSelectedRoomLabel] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ classSubjectId: '', teacherId: '', dayOfWeek: 'monday', startTime: '08:00', endTime: '09:00', roomLabel: '' });
  const [saving, setSaving] = useState(false);

  const daysList = useMemo(() => [
    { value: 'monday', label: t('dayMonday') },
    { value: 'tuesday', label: t('dayTuesday') },
    { value: 'wednesday', label: t('dayWednesday') },
    { value: 'thursday', label: t('dayThursday') },
    { value: 'friday', label: t('dayFriday') },
    { value: 'saturday', label: t('daySaturday') },
  ], [t]);

  useEffect(() => {
    fetch('/api/academics/session-years?pageSize=50')
      .then(r => r.json())
      .then((j) => { if (j?.success) { const def = j.data.find((s: any) => s.isDefault) ?? j.data[0]; setSessionYearId(def?.id ?? null); } });
    fetch('/api/academics/class-sections?pageSize=200')
      .then(r => r.json())
      .then(j => j?.success && setClassSections(j.data));
    fetch('/api/academics/subjects?pageSize=200')
      .then(r => r.json())
      .then(j => j?.success && setSubjects(j.data));
    fetch('/api/teachers?pageSize=200')
      .then(r => r.json())
      .then(j => j?.success && setTeachers(j.data));
  }, []);

  useEffect(() => {
    const section = classSections.find(s => s.id === selectedSectionId);
    if (!section) {
      setClassSubjects([]);
      return;
    }
    fetch(`/api/academics/class-subjects?classId=${section.classId}&pageSize=200`)
      .then(r => r.json())
      .then(j => j?.success && setClassSubjects(j.data));
  }, [selectedSectionId, classSections]);

  const loadSlots = () => {
    if (!selectedSectionId) {
      setSlots([]);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ classSectionId: selectedSectionId });
    if (versionId) {
      params.set('versionId', versionId);
    }
    fetch(`/api/academics/timetable-slots?${params}`)
      .then(r => r.json())
      .then(j => j?.success && setSlots(j.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (viewMode === 'class') {
      loadSlots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSectionId, versionId, viewMode]);

  const loadTeacherSlots = () => {
    if (!selectedTeacherId) {
      setSlots([]);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ teacherId: selectedTeacherId });
    if (versionId) {
      params.set('versionId', versionId);
    }
    fetch(`/api/academics/timetable-slots?${params}`)
      .then(r => r.json())
      .then(j => j?.success && setSlots(j.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (viewMode === 'teacher') {
      loadTeacherSlots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeacherId, versionId, viewMode]);

  useEffect(() => {
    if (viewMode !== 'room') {
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    if (versionId) {
      params.set('versionId', versionId);
    }
    fetch(`/api/academics/timetable-slots?${params}`)
      .then(r => r.json())
      .then(j => j?.success && setAllSlots(j.data))
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, versionId]);

  const roomOptions = Array.from(new Set(allSlots.map(s => s.roomLabel ?? '__unassigned__'))).sort();

  useEffect(() => {
    if (viewMode !== 'room') {
      return;
    }
    setSlots(selectedRoomLabel === '__unassigned__'
      ? allSlots.filter(s => !s.roomLabel)
      : allSlots.filter(s => s.roomLabel === selectedRoomLabel));
  }, [viewMode, selectedRoomLabel, allSlots]);

  const subjectName = (classSubjectId: string) => {
    const cs = classSubjects.find(c => c.id === classSubjectId);
    return cs ? (subjects.find(s => s.id === cs.subjectId)?.name ?? '—') : '—';
  };
  const teacherName = (id: string) => teachers.find(t => t.id === id)?.name ?? '—';

  const handleCreate = async () => {
    if (!selectedSectionId || !form.classSubjectId || !form.teacherId) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/academics/timetable-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, classSectionId: selectedSectionId, versionId: versionId || undefined }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || json.message || t('slotCreateFailed'));
        return;
      }
      setShowForm(false);
      loadSlots();
    } catch {
      toast.error(t('networkError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/academics/timetable-slots?id=${id}`, { method: 'DELETE' });
    loadSlots();
  };

  const canManage = can('academics.manage');
  const selectedPeriodType = classSections.find(s => s.id === selectedSectionId)?.periodType ?? 'semester';
  const periodCount = selectedPeriodType === 'semester' ? 2 : selectedPeriodType === 'trimester' ? 3 : 12;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto text-start">
      <div>
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('scheduleRealTitle')}</h1>
        <p className="text-xs text-slate-500 mt-1">{t('scheduleRealSubtitle')}</p>
      </div>

      {sessionYearId && (
        <SchedulePublishBar sessionYearId={sessionYearId} onVersionChange={vId => setVersionId(vId)} />
      )}

      <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-xl border border-slate-200 p-0.5 bg-slate-50">
          {(['class', 'teacher', 'room'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`h-8 px-3 rounded-lg text-xs font-bold transition-colors ${viewMode === mode ? 'bg-[#2487B8] text-white' : 'text-slate-500 hover:text-[#16212B]'}`}
            >
              {mode === 'class' ? t('viewModeClass') : mode === 'teacher' ? t('viewModeTeacher') : t('viewModeRoom')}
            </button>
          ))}
        </div>

        {viewMode === 'class' && (
          <>
            <label className="text-xs font-bold text-slate-500 whitespace-nowrap">{t('viewModeClass')} :</label>
            <select
              value={selectedSectionId}
              onChange={e => setSelectedSectionId(e.target.value)}
              className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white text-[#16212B]"
            >
              <option value="">{t('classSelectPrompt')}</option>
              {classSections.map(s => <option key={s.id} value={s.id}>{s.className} {s.sectionName}</option>)}
            </select>
            <label className="text-xs font-bold text-slate-500 whitespace-nowrap">{t('periodLabel')} :</label>
            <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)} className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white text-[#16212B]">
              {Array.from({ length: periodCount }, (_, i) => (
                <option key={i + 1} value={String(i + 1)}>
                  {selectedPeriodType === 'month' ? t('periodMonth', { num: i + 1 }) : selectedPeriodType === 'trimester' ? t('periodTrimester', { num: i + 1 }) : t('periodSemester', { num: i + 1 })}
                </option>
              ))}
            </select>
          </>
        )}
        {viewMode === 'teacher' && (
          <>
            <label className="text-xs font-bold text-slate-500 whitespace-nowrap">{t('viewModeTeacher')} :</label>
            <select
              value={selectedTeacherId}
              onChange={e => setSelectedTeacherId(e.target.value)}
              className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white text-[#16212B]"
            >
              <option value="">{t('teacherSelectPrompt')}</option>
              {teachers.map(tOption => <option key={tOption.id} value={tOption.id}>{tOption.name}</option>)}
            </select>
          </>
        )}
        {viewMode === 'room' && (
          <>
            <label className="text-xs font-bold text-slate-500 whitespace-nowrap">{t('viewModeRoom')} :</label>
            <select
              value={selectedRoomLabel}
              onChange={e => setSelectedRoomLabel(e.target.value)}
              className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white text-[#16212B]"
            >
              <option value="">{t('roomSelectPrompt')}</option>
              {roomOptions.map(r => <option key={r} value={r}>{r === '__unassigned__' ? t('slotUnassignedRoom') : r}</option>)}
            </select>
          </>
        )}

        {canManage && viewMode === 'class' && selectedSectionId && (
          <Button size="sm" onClick={() => setShowForm(v => !v)} className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5 ms-auto">
            <Plus className="w-3.5 h-3.5" />
            {t('btnAddSlot')}
          </Button>
        )}
      </Card>

      {canManage && viewMode === 'class' && showForm && (
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="space-y-1 lg:col-span-2">
              <label className="font-bold text-slate-600">{t('subject')}</label>
              <select value={form.classSubjectId} onChange={e => setForm({ ...form, classSubjectId: e.target.value })} className="h-9 w-full rounded-xl border border-slate-200 px-3">
                <option value="">{tCommon('filter')}...</option>
                {classSubjects.map(cs => <option key={cs.id} value={cs.id}>{subjects.find(s => s.id === cs.subjectId)?.name ?? cs.id}</option>)}
              </select>
            </div>
            <div className="space-y-1 lg:col-span-2">
              <label className="font-bold text-slate-600">{t('teacher')}</label>
              <select value={form.teacherId} onChange={e => setForm({ ...form, teacherId: e.target.value })} className="h-9 w-full rounded-xl border border-slate-200 px-3">
                <option value="">{tCommon('filter')}...</option>
                {teachers.map(tOption => <option key={tOption.id} value={tOption.id}>{tOption.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{t('colDay')}</label>
              <select value={form.dayOfWeek} onChange={e => setForm({ ...form, dayOfWeek: e.target.value })} className="h-9 w-full rounded-xl border border-slate-200 px-3">
                {daysList.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{t('room')}</label>
              <input value={form.roomLabel} onChange={e => setForm({ ...form, roomLabel: e.target.value })} className="h-9 w-full rounded-xl border border-slate-200 px-3" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{t('slotStartTime')}</label>
              <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} className="h-9 w-full rounded-xl border border-slate-200 px-3" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{t('slotEndTime')}</label>
              <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} className="h-9 w-full rounded-xl border border-slate-200 px-3" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={saving} onClick={handleCreate} className="h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold">
              {saving ? t('saving') : tCommon('add')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="h-9 rounded-xl text-xs font-bold">
              {tCommon('cancel')}
            </Button>
          </div>
        </Card>
      )}

      {(viewMode === 'class' && !selectedSectionId) || (viewMode === 'teacher' && !selectedTeacherId) || (viewMode === 'room' && !selectedRoomLabel)
        ? (
            <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center gap-3 text-center">
              <Clock className="w-10 h-10 text-slate-200" />
              <p className="text-sm font-bold text-slate-400">
                {viewMode === 'class' && t('classPromptEmpty')}
                {viewMode === 'teacher' && t('teacherPromptEmpty')}
                {viewMode === 'room' && t('roomPromptEmpty')}
              </p>
            </Card>
          )
        : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {daysList.map((day) => {
                const daySlots = slots.filter(s => s.dayOfWeek === day.value).sort((a, b) => a.startTime.localeCompare(b.startTime));
                return (
                  <Card key={day.value} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
                    <h3 className="text-xs font-extrabold text-[#16212B]">{day.label}</h3>
                    {loading && <p className="text-[10px] text-slate-400">{tCommon('loading')}...</p>}
                    {!loading && daySlots.length === 0 && <p className="text-[10px] text-slate-400">{t('noSlots')}</p>}
                    {daySlots.map(slot => (
                      <div key={slot.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-[#16212B] font-mono">{slot.startTime.slice(0, 5)} - {slot.endTime.slice(0, 5)}</p>
                          <p className="text-[11px] font-semibold text-slate-700 truncate">{subjectName(slot.classSubjectId)}</p>
                          <p className="text-[10px] text-slate-400 truncate">{teacherName(slot.teacherId)}{slot.roomLabel ? ` · ${slot.roomLabel}` : ''}</p>
                        </div>
                        {canManage && (
                          <button onClick={() => handleDelete(slot.id)} className="p-1 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 shrink-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </Card>
                );
              })}
            </div>
          )}
    </div>
  );
}
