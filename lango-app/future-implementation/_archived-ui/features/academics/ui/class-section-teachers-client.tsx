'use client';

import { Layers, Plus, Trash2, UserCog, Users } from 'lucide-react';
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

type ClassOption = { id: string; name: string };
type SectionOption = {
  id: string;
  classId: string;
  sectionName: string | null;
  enrolledCount: number;
  maxStudents: number | null;
  homeroomTeacherId: string | null;
};
type Assignment = { id: string; classSectionId: string; teacherId: string; role: string; notes: string | null };
type TeacherOption = { id: string; name: string };

export function ClassSectionTeachersClient({ locale: _locale }: { locale?: string } = {}) {
  const t = useTranslations('Academics');
  const tc = useTranslations('Common');
  const { can } = usePermissions();
  const canManage = can('academics.manage');

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [classId, setClassId] = useState('');
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [sectionId, setSectionId] = useState('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ teacherId: '', role: 'primary', notes: '' });
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
    fetch('/api/teachers?pageSize=200')
      .then(r => r.json())
      .then(j => j?.success && setTeachers(j.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!classId) {
      setSections([]);
      setSectionId('');
      return;
    }
    fetch(`/api/academics/class-sections?classId=${classId}&pageSize=100`)
      .then(r => r.json())
      .then((j) => {
        if (j?.success && Array.isArray(j.data)) {
          setSections(j.data);
          setSectionId(j.data.length > 0 ? j.data[0].id : '');
        }
      })
      .catch(() => {});
  }, [classId]);

  const loadAssignments = (id: string) => {
    if (!id) {
      setAssignments([]);
      return;
    }
    setLoading(true);
    fetch(`/api/academics/class-teachers?classSectionId=${id}&pageSize=100`)
      .then(r => r.json())
      .then(j => j?.success && setAssignments(j.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAssignments(sectionId);
  }, [sectionId]);

  const teacherName = (id: string) => teachers.find(x => x.id === id)?.name ?? id;
  const activeSection = sections.find(s => s.id === sectionId) ?? null;
  const sectionsWithoutHomeroom = sections.filter(s => !s.homeroomTeacherId).length;
  const assignedTeacherIds = new Set(assignments.map(a => a.teacherId));
  const availableTeachers = teachers.filter(x => !assignedTeacherIds.has(x.id));

  const openAssign = () => {
    setForm({ teacherId: '', role: 'primary', notes: '' });
    setIsOpen(true);
  };

  const handleAssign = async () => {
    if (!form.teacherId || !sectionId) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/academics/class-teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classSectionId: sectionId,
          teacherId: form.teacherId,
          role: form.role,
          notes: form.notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || tc('errorOccurred'));
        return;
      }
      toast.success(t('btnConfirmAssignment'));
      setIsOpen(false);
      loadAssignments(sectionId);
    } catch {
      toast.error(tc('errorOccurred'));
    } finally {
      setSaving(false);
    }
  };

  const performRemove = async (item: Assignment) => {
    try {
      const res = await fetch(`/api/academics/class-teachers?id=${item.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || tc('errorOccurred'));
        return;
      }
      toast.success(t('removeAssignment'));
      loadAssignments(sectionId);
    } catch {
      toast.error(tc('errorOccurred'));
    }
  };

  const handleRemove = (item: Assignment) => {
    toast(`${t('removeAssignment')} · ${teacherName(item.teacherId)} ?`, {
      action: {
        label: tc('confirm'),
        onClick: () => {
          void performRemove(item);
        },
      },
    });
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="
        flex flex-col justify-between gap-4
        sm:flex-row sm:items-center
      "
      >
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('sectionTeachersTitle')}</h1>
          <p className="mt-1 text-xs text-slate-500">{t('sectionTeachersSubtitle')}</p>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={openAssign}
            disabled={!sectionId}
            className="
              h-10 gap-2 rounded-xl bg-[#2487B8] px-4 text-xs font-bold
              text-white shadow-2xs
              hover:bg-[#1B6C93]
            "
          >
            <Plus className="size-4" />
            <span>{t('btnAssignTeacher')}</span>
          </Button>
        )}
      </div>

      <div className="
        grid grid-cols-1 gap-4
        md:grid-cols-3
      "
      >
        <Card className="
          space-y-1 rounded-2xl border border-slate-200/80 bg-white p-4
          shadow-2xs
        "
        >
          <p className="text-xs font-bold text-slate-500">{t('sectionsCol')}</p>
          <p className="text-2xl font-extrabold text-[#16212B]">{sections.length}</p>
          <p className="text-[10px] text-slate-400">{classes.find(c => c.id === classId)?.name ?? '—'}</p>
        </Card>
        <Card className={`
          space-y-1 rounded-2xl border bg-white p-4 shadow-2xs
          ${sectionsWithoutHomeroom > 0
      ? `border-amber-200/60 bg-amber-50/20`
      : `border-slate-200/80`}
        `}
        >
          <p className={`
            text-xs font-bold
            ${sectionsWithoutHomeroom > 0
      ? `text-amber-700`
      : `text-slate-500`}
          `}
          >
            {t('noTeacherAssigned')}
          </p>
          <p className={`
            text-2xl font-extrabold
            ${sectionsWithoutHomeroom > 0
      ? `text-amber-700`
      : `text-[#16212B]`}
          `}
          >
            {sectionsWithoutHomeroom}
          </p>
          <p className="text-[10px] text-slate-400">{t('primaryRole')}</p>
        </Card>
        <Card className="
          space-y-1 rounded-2xl border border-slate-200/80 bg-white p-4
          shadow-2xs
        "
        >
          <p className="text-xs font-bold text-slate-500">{t('btnAssignTeacher')}</p>
          <p className="text-2xl font-extrabold text-[#2487B8]">{assignments.length}</p>
          <p className="text-[10px] text-slate-400">{activeSection?.sectionName ?? '—'}</p>
        </Card>
      </div>

      <Card className="
        rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs
      "
      >
        <div className="
          flex flex-col items-center gap-3
          sm:flex-row
        "
        >
          <div className="
            flex w-full items-center gap-3
            sm:w-auto
          "
          >
            <span className="text-xs font-bold whitespace-nowrap text-slate-500">{t('classCol')}</span>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="
                h-10 w-56 rounded-xl border-slate-200 text-xs font-extrabold
              "
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {classes.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="
            flex w-full items-center gap-3
            sm:w-auto
          "
          >
            <span className="text-xs font-bold whitespace-nowrap text-slate-500">{t('sectionsCol')}</span>
            <Select value={sectionId} onValueChange={setSectionId}>
              <SelectTrigger className="
                h-10 w-44 rounded-xl border-slate-200 text-xs font-extrabold
              "
              >
                <SelectValue placeholder={t('sectionsCol')} />
              </SelectTrigger>
              <SelectContent>
                {sections.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.sectionName ?? '—'}
                    {' '}
                    (
                    {s.enrolledCount}
                    {s.maxStudents ? `/${s.maxStudents}` : ''}
                    )
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {activeSection && (
            <div className="
              rounded-xl border border-slate-100 bg-slate-50 px-3 py-2
              text-[11px] font-bold text-slate-600
              sm:ms-auto
            "
            >
              {t('primaryRole')}
              :
              {activeSection.homeroomTeacherId
                ? teacherName(activeSection.homeroomTeacherId)
                : (
                    <span className="text-amber-700">
                      {t('noTeacherAssigned')}
                    </span>
                  )}
            </div>
          )}
        </div>
      </Card>

      <Card className="
        space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs
      "
      >
        <h3 className="
          flex items-center gap-2 text-sm font-extrabold text-[#16212B]
        "
        >
          <Users className="size-4 text-[#2487B8]" />
          {t('sectionTeachersTitle')}
        </h3>

        {!loading && assignments.length === 0 && (
          <div className="
            space-y-2 rounded-2xl border border-dashed border-slate-200
            bg-slate-50/50 py-10 text-center
          "
          >
            <UserCog className="mx-auto size-6 text-slate-300" />
            <p className="text-xs font-bold text-slate-600">{t('noAssignmentsForSection')}</p>
          </div>
        )}

        <div className="space-y-3">
          {assignments.map(item => (
            <div
              key={item.id}
              className="
                rounded-2xl border border-slate-200/80 bg-white p-4 transition
                hover:border-slate-300
              "
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="
                    flex size-10 shrink-0 items-center justify-center
                    rounded-full bg-[#DCEBF4] text-xs font-extrabold
                    text-[#1B6C93]
                  "
                  >
                    {teacherName(item.teacherId).split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="
                        truncate text-sm font-extrabold text-[#16212B]
                      "
                      >
                        {teacherName(item.teacherId)}
                      </h4>
                      <span className={`
                        rounded-full px-2 py-0.5 text-[10px] font-bold
                        ${
            item.role === 'substitute'
              ? `border border-amber-200/60 bg-amber-50 text-amber-700`
              : `bg-[#DCEBF4] text-[#1B6C93]`
            }
                      `}
                      >
                        {item.role === 'substitute' ? t('substituteRole') : t('primaryRole')}
                      </span>
                    </div>
                    {item.notes && (
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {item.notes}
                      </p>
                    )}
                  </div>
                </div>
                {canManage && (
                  <button
                    onClick={() => handleRemove(item)}
                    className="
                      shrink-0 rounded-lg p-1.5 text-slate-400 transition
                      hover:bg-rose-50 hover:text-rose-600
                    "
                    title={t('removeAssignment')}
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
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
              <Layers className="size-5 text-[#2487B8]" />
              {t('assignTeacherToSection')}
            </DialogTitle>
          </DialogHeader>

          <div className="my-3 space-y-3 text-xs">
            <div>
              <label className="mb-1 block font-bold text-slate-700">{t('teacherFieldLabel')}</label>
              <Select value={form.teacherId} onValueChange={val => setForm({ ...form, teacherId: val })}>
                <SelectTrigger className="h-9 rounded-xl text-xs">
                  <SelectValue placeholder={t('teacherFieldLabel')} />
                </SelectTrigger>
                <SelectContent>
                  {availableTeachers.map(x => (
                    <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block font-bold text-slate-700">{t('teachingTypeLabel')}</label>
              <Select value={form.role} onValueChange={val => setForm({ ...form, role: val })}>
                <SelectTrigger className="h-9 rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">{t('primaryRole')}</SelectItem>
                  <SelectItem value="substitute">{t('substituteRole')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block font-bold text-slate-700">{t('notesFieldLabel')}</label>
              <Input
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                className="h-9 rounded-xl text-xs"
              />
            </div>
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
              onClick={handleAssign}
              disabled={saving || !form.teacherId}
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
