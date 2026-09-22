'use client';

import type { TeacherStatus } from '../model/types';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { deleteTeacherRequest, setTeacherStatusRequest } from '../data/directory-api';

export type LifecycleTarget = {
  type: 'status';
  teacher: { id: string; name: string };
  status: TeacherStatus;
} | {
  type: 'delete';
  teacher: { id: string; name: string };
};

const DEPENDENCY_LABELS: Record<string, string> = {
  class_assignments: 'depClassAssignments',
  subject_assignments: 'depSubjectAssignments',
  timetable_slots: 'depTimetableSlots',
  legacy_timetable_slots: 'depLegacyTimetableSlots',
  teacher_availability: 'depAvailability',
  meeting_slots: 'depMeetingSlots',
  attendance_records_marked: 'depAttendance',
  grade_records_marked: 'depGrades',
  assessments_authored: 'depAssessments',
  hr_employee_profile: 'depHrProfile',
  login_account: 'depLoginAccount',
};

/**
 * Lifecycle confirmation: deactivate / archive / reactivate / hard delete.
 * Destructive actions are never immediate, the consequences are stated, and
 * API refusals (e.g. 409 CANNOT_HARD_DELETE with its dependency list) are
 * displayed instead of closing silently.
 */
export function TeacherLifecycleDialog({
  target,
  onOpenChange,
  onDone,
}: {
  target: LifecycleTarget | null;
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}) {
  const t = useTranslations('Teachers');
  const tCommon = useTranslations('Common');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dependencies, setDependencies] = useState<{ key: string; count: number }[] | null>(null);

  if (!target) {
    return null;
  }

  const isDelete = target.type === 'delete';
  const status = target.type === 'status' ? target.status : null;

  const title = isDelete
    ? t('confirmDeleteTitle')
    : status === 'active'
      ? t('confirmReactivateTitle')
      : status === 'inactive'
        ? t('confirmDeactivateTitle')
        : t('confirmArchiveTitle');

  const body = isDelete
    ? t('confirmDeleteBody')
    : status === 'active'
      ? t('confirmReactivateBody')
      : status === 'inactive'
        ? t('confirmDeactivateBody')
        : t('confirmArchiveBody');

  const confirmLabel = isDelete
    ? t('deleteTeacher')
    : status === 'active'
      ? t('reactivate')
      : status === 'inactive'
        ? t('deactivate')
        : t('archive');

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    setDependencies(null);

    if (isDelete) {
      const result = await deleteTeacherRequest(target.teacher.id);
      setSubmitting(false);
      if (!result.ok) {
        setError(result.message);
        setDependencies(result.dependencies ?? null);
        return;
      }
      onDone(t('deleteSuccess'));
      onOpenChange(false);
      return;
    }

    const result = await setTeacherStatusRequest(target.teacher.id, status!);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onDone(
      status === 'active'
        ? t('reactivateSuccess')
        : t('statusChangeSuccess', { count: result.data.closedClassAssignments }),
    );
    onOpenChange(false);
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!submitting) {
          onOpenChange(next);
        }
      }}
    >
      <DialogContent className="max-w-md rounded-2xl bg-white p-6">
        <DialogHeader>
          <DialogTitle className="
            flex items-center gap-2 text-base font-extrabold text-[#16212B]
          "
          >
            {isDelete && <AlertTriangle className="size-4 text-rose-500" />}
            {title}
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-slate-600">{body}</p>
        <p className="
          rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-[#16212B]
        "
        >
          {target.teacher.name}
        </p>

        {error && (
          <div
            role="alert"
            className="
              rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs
              text-rose-700
            "
          >
            <p className="font-bold">{error}</p>
            {dependencies && dependencies.length > 0 && (
              <ul className="mt-1.5 list-disc space-y-0.5 ps-4">
                {dependencies.map(dep => (
                  <li key={dep.key}>
                    {t(DEPENDENCY_LABELS[dep.key] ?? 'dependenciesUnknown')}
                    {' '}
                    :
                    {' '}
                    {dep.count}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="h-9 rounded-full text-xs"
          >
            {tCommon('cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={submitting}
            className={`
              h-9 rounded-full text-xs text-white
              ${isDelete
      ? `
        bg-rose-600
        hover:bg-rose-700
      `
      : `bg-[#0066FF]`}
            `}
          >
            {submitting ? <Loader2 className="me-1 size-3.5 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
