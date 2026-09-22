'use client';

import { BookOpen, Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePermissions } from '@/hooks/use-permissions';

type ClassOption = { id: string; name: string; cycle: string | null };
type SubjectOption = { id: string; name: string };
type Assignment = {
  id: string;
  classId: string;
  subjectId: string;
  subjectName: string | null;
  className: string | null;
  coefficient: string | number | null;
  weeklyMinutes: number | null;
  displayOrder: number | null;
  isActive: boolean;
  curriculumLabel: string | null;
  passThreshold: string | null;
};

const emptyForm = {
  subjectId: '',
  coefficient: '1',
  weeklyMinutes: '',
  displayOrder: '0',
  curriculumLabel: '',
  passThreshold: '',
  isActive: true,
};

export function ClassSubjectsClient({ locale: _locale }: { locale?: string } = {}) {
  const t = useTranslations('Academics');
  const tc = useTranslations('Common');
  const { can } = usePermissions();
  const canManage = can('academics.manage');

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [classId, setClassId] = useState('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/academics/classes?pageSize=100')
      .then(r => r.json())
      .then((j) => {
        if (j?.success && Array.isArray(j.data)) {
          setClasses(j.data);
          if (j.data.length > 0) {
            setClassId(j.data[0].id);
          }
        }
      })
      .catch(() => {});
    fetch('/api/academics/subjects?pageSize=200')
      .then(r => r.json())
      .then(j => j?.success && setSubjects(j.data))
      .catch(() => {});
  }, []);

  const loadAssignments = (id: string) => {
    if (!id) {
      setAssignments([]);
      return;
    }
    setLoading(true);
    fetch(`/api/academics/class-subjects?classId=${id}&pageSize=100`)
      .then(r => r.json())
      .then(j => j?.success && setAssignments(j.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAssignments(classId);
  }, [classId]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setIsOpen(true);
  };

  const openEdit = (item: Assignment) => {
    setEditing(item);
    setForm({
      subjectId: item.subjectId,
      coefficient: item.coefficient != null ? String(Number(item.coefficient)) : '1',
      weeklyMinutes: item.weeklyMinutes != null ? String(item.weeklyMinutes) : '',
      displayOrder: item.displayOrder != null ? String(item.displayOrder) : '0',
      curriculumLabel: item.curriculumLabel ?? '',
      passThreshold: item.passThreshold != null ? String(Number(item.passThreshold)) : '',
      isActive: item.isActive,
    });
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!editing && !form.subjectId) {
      toast.error(t('subjectFieldLabel'));
      return;
    }
    setSaving(true);
    try {
      const body = editing
        ? {
            id: editing.id,
            coefficient: form.coefficient ? Number(form.coefficient) : 1,
            weeklyMinutes: form.weeklyMinutes ? Number(form.weeklyMinutes) : null,
            displayOrder: form.displayOrder ? Number(form.displayOrder) : 0,
            curriculumLabel: form.curriculumLabel.trim() || null,
            passThreshold: form.passThreshold ? Number(form.passThreshold) : null,
            isActive: form.isActive,
          }
        : {
            classId,
            subjectId: form.subjectId,
            coefficient: form.coefficient ? Number(form.coefficient) : 1,
            weeklyMinutes: form.weeklyMinutes ? Number(form.weeklyMinutes) : undefined,
            displayOrder: form.displayOrder ? Number(form.displayOrder) : 0,
            curriculumLabel: form.curriculumLabel.trim() || undefined,
            passThreshold: form.passThreshold ? Number(form.passThreshold) : undefined,
            isActive: form.isActive,
          };
      const res = await fetch('/api/academics/class-subjects', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || tc('errorOccurred'));
        return;
      }
      toast.success(tc('save'));
      setIsOpen(false);
      loadAssignments(classId);
    } catch {
      toast.error(tc('errorOccurred'));
    } finally {
      setSaving(false);
    }
  };

  const performDelete = async (item: Assignment) => {
    try {
      const res = await fetch(`/api/academics/class-subjects?id=${item.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || tc('errorOccurred'));
        return;
      }
      toast.success(t('deleteAction'));
      loadAssignments(classId);
    } catch {
      toast.error(tc('errorOccurred'));
    }
  };

  const handleDelete = (item: Assignment) => {
    toast(`${t('deleteAction')} · ${item.subjectName ?? ''} ?`, {
      action: {
        label: tc('confirm'),
        onClick: () => {
          void performDelete(item);
        },
      },
    });
  };

  const totalCoeff = assignments.reduce((acc, a) => acc + Number(a.coefficient ?? 0), 0);
  const totalMinutes = assignments.reduce((acc, a) => acc + (a.weeklyMinutes ?? 0), 0);
  const availableSubjects = subjects.filter(s => !assignments.some(a => a.subjectId === s.id));

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="
        flex flex-col justify-between gap-4
        sm:flex-row sm:items-center
      "
      >
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('classSubjectsTitle')}</h1>
          <p className="mt-1 text-xs text-slate-500">{t('classSubjectsSubtitle')}</p>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={openCreate}
            disabled={!classId}
            className="
              h-10 gap-2 rounded-xl bg-[#2487B8] px-4 text-xs font-bold
              text-white shadow-2xs
              hover:bg-[#1B6C93]
            "
          >
            <Plus className="size-4" />
            <span>{t('btnAssignSubject')}</span>
          </Button>
        )}
      </div>

      <Card className="
        rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs
      "
      >
        <div className="
          flex flex-col items-center justify-between gap-4
          sm:flex-row
        "
        >
          <div className="
            flex w-full items-center gap-3
            sm:w-auto
          "
          >
            <span className="text-xs font-bold whitespace-nowrap text-slate-500">{t('selectedClassLabel')}</span>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="
                h-10 w-64 rounded-xl border-slate-200 text-xs font-extrabold
              "
              >
                <SelectValue placeholder={t('selectedClassLabel')} />
              </SelectTrigger>
              <SelectContent>
                {classes.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold">
            <div className="
              flex items-center gap-2 rounded-xl border border-slate-100
              bg-slate-50 px-3 py-1.5
            "
            >
              <span className="text-slate-500">{t('hourlyVolumeLabel')}</span>
              <strong className="text-[#2487B8]">
                {totalMinutes}
                {' '}
                {t('minutesShort')}
              </strong>
            </div>
            <div className="
              flex items-center gap-2 rounded-xl border border-slate-100
              bg-slate-50 px-3 py-1.5
            "
            >
              <span className="text-slate-500">{t('totalCoeffLabel')}</span>
              <strong className="text-[#16212B]">{Number.isInteger(totalCoeff) ? totalCoeff : totalCoeff.toFixed(2)}</strong>
            </div>
          </div>
        </div>
      </Card>

      <Card className="
        space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs
      "
      >
        <h3 className="text-sm font-extrabold text-[#16212B]">
          {t('subjectsGridTitle', { count: assignments.length })}
        </h3>

        {!loading && assignments.length === 0 && (
          <div className="
            space-y-2 rounded-2xl border border-dashed border-slate-200
            bg-slate-50/50 py-10 text-center
          "
          >
            <BookOpen className="mx-auto size-6 text-slate-300" />
            <p className="text-xs font-bold text-slate-600">{t('noAssignmentsYet')}</p>
          </div>
        )}

        <div className="space-y-3">
          {assignments.map(item => (
            <div
              key={item.id}
              className={`
                space-y-3 rounded-2xl border p-4 transition
                ${
            item.isActive
              ? `
                border-slate-200/80 bg-white
                hover:border-slate-300
              `
              : `border-slate-200 bg-slate-50/60`
            }
              `}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="
                    flex size-10 shrink-0 items-center justify-center
                    rounded-2xl bg-[#DCEBF4] font-bold text-[#1B6C93]
                  "
                  >
                    <BookOpen className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="
                        truncate text-sm font-extrabold text-[#16212B]
                      "
                      >
                        {item.subjectName ?? '—'}
                      </h4>
                      {!item.isActive && (
                        <span className="
                          rounded-sm bg-slate-200 px-2 py-0.5 text-[10px]
                          font-bold text-slate-600
                        "
                        >
                          {t('inactiveBadge')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {t('coeffFieldLabel')}
                      :
                      <strong>{item.coefficient != null ? Number(item.coefficient) : '—'}</strong>
                      {' • '}
                      {t('weeklyMinutesFieldLabel')}
                      :
                      <strong>{item.weeklyMinutes != null ? `${item.weeklyMinutes} ${t('minutesShort')}` : '—'}</strong>
                      {item.displayOrder != null ? ` • ${t('displayOrderFieldLabel')}: ${item.displayOrder}` : ''}
                    </p>
                  </div>
                </div>

                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => openEdit(item)}
                      className="
                        rounded-lg p-1.5 text-slate-400 transition
                        hover:bg-slate-100 hover:text-[#2487B8]
                      "
                      title={t('editAssignment')}
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="
                        rounded-lg p-1.5 text-slate-400 transition
                        hover:bg-rose-50 hover:text-rose-600
                      "
                      title={t('deleteAction')}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
              </div>

              {(item.curriculumLabel || item.passThreshold != null) && (
                <div className="
                  flex items-center gap-2 border-t border-slate-100 pt-2
                  text-[11px] font-bold text-slate-600
                "
                >
                  {item.curriculumLabel && (
                    <span className="
                      inline-flex items-center gap-1 rounded-lg border
                      border-slate-100 bg-slate-50 px-2.5 py-1
                    "
                    >
                      <Layers className="size-3.5 text-slate-400" />
                      {item.curriculumLabel}
                    </span>
                  )}
                  {item.passThreshold != null && (
                    <span className="
                      rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1
                    "
                    >
                      {t('passThresholdFieldLabel')}
                      :
                      {Number(item.passThreshold)}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="
              flex items-center gap-2 text-base font-extrabold text-[#16212B]
            "
            >
              <BookOpen className="size-5 text-[#2487B8]" />
              {editing ? t('editAssignment') : t('assignSubjectModalTitle', { className: assignments[0]?.className ?? classes.find(c => c.id === classId)?.name ?? '' })}
            </DialogTitle>
          </DialogHeader>

          <div className="my-3 space-y-3 text-xs">
            {!editing && (
              <div>
                <label className="mb-1 block font-bold text-slate-700">{t('subjectFieldLabel')}</label>
                <Select value={form.subjectId} onValueChange={val => setForm({ ...form, subjectId: val })}>
                  <SelectTrigger className="h-9 rounded-xl text-xs">
                    <SelectValue placeholder={t('subjectFieldLabel')} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSubjects.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-bold text-slate-700">{t('coeffFieldLabel')}</label>
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  value={form.coefficient}
                  onChange={e => setForm({ ...form, coefficient: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700">{t('weeklyMinutesFieldLabel')}</label>
                <Input
                  type="number"
                  min="0"
                  value={form.weeklyMinutes}
                  onChange={e => setForm({ ...form, weeklyMinutes: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                  placeholder="180"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-bold text-slate-700">{t('displayOrderFieldLabel')}</label>
                <Input
                  type="number"
                  min="0"
                  value={form.displayOrder}
                  onChange={e => setForm({ ...form, displayOrder: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700">{t('passThresholdFieldLabel')}</label>
                <Input
                  type="number"
                  min="0"
                  max="20"
                  step="0.5"
                  value={form.passThreshold}
                  onChange={e => setForm({ ...form, passThreshold: e.target.value })}
                  className="h-9 rounded-xl text-xs"
                  placeholder="10"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-bold text-slate-700">{t('curriculumLabelField')}</label>
              <Input
                value={form.curriculumLabel}
                onChange={e => setForm({ ...form, curriculumLabel: e.target.value })}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <label className="flex items-center gap-2 font-bold text-slate-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={e => setForm({ ...form, isActive: e.target.checked })}
                className="size-4 rounded-sm border-slate-300"
              />
              {t('activeFieldLabel')}
            </label>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="h-9 rounded-xl text-xs"
            >
              {tc('cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || (!editing && !form.subjectId)}
              className="
                h-9 rounded-xl bg-[#2487B8] text-xs font-bold text-white
                hover:bg-[#1B6C93]
              "
            >
              {saving ? tc('loading') : t('btnConfirmAssignment')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
