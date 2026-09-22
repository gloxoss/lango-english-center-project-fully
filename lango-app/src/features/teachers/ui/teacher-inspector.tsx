'use client';

import type { TeacherDetail, TeacherStatus } from '../model/types';
import {
  Archive,
  BookOpen,
  Briefcase,
  CalendarCheck,
  Clock,
  FileText,
  Lock,
  Pencil,
  Power,
  Trash2,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchTeacherDetail } from '../data/directory-api';
import { TeacherStatusBadge } from './teacher-directory-table';

function initials(name: string): string {
  return name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
}

function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-GB' : 'fr-FR');
}

const DOC_LABEL_KEYS: Record<string, string> = {
  contract: 'docContract',
  cin: 'docCin',
  diploma: 'docDiploma',
  employeeId: 'employeeIdLabel',
  hireDate: 'hireDate',
  specialization: 'specialty',
};

/**
 * Right-side quick inspector (desktop) / bottom sheet content (mobile).
 * Deliberately answers: Who? Where? What do they teach? How much planned
 * workload? Any missing dossier items? What status? — and never renders
 * salary/bank/CNSS data unless the server included it (hr.sensitive.read).
 */
export function TeacherInspectorContent({
  teacherId,
  locale,
  onEdit,
  onStatus,
  onDelete,
}: {
  teacherId: string | null;
  locale: string;
  onEdit: (teacher: TeacherDetail) => void;
  onStatus: (teacher: TeacherDetail, status: TeacherStatus) => void;
  onDelete: (teacher: TeacherDetail) => void;
}) {
  const t = useTranslations('Teachers');
  const [detail, setDetail] = useState<TeacherDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (id: string, signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    const result = await fetchTeacherDetail(id, signal);
    if (signal?.aborted) {
      return;
    }
    if (result.ok) {
      setDetail(result.data);
    } else {
      setDetail(null);
      setError(result.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!teacherId) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    load(teacherId, controller.signal);
    return () => controller.abort();
  }, [teacherId, load]);

  if (!teacherId) {
    return (
      <Card className="
        rounded-2xl border border-slate-200/80 bg-white p-5 text-center
        shadow-2xs
      "
      >
        <p className="text-xs text-slate-400">{t('selectTeacherHint')}</p>
      </Card>
    );
  }

  if (loading && !detail) {
    return (
      <Card
        className="
          space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5
          shadow-2xs
        "
        aria-busy="true"
      >
        <div className="flex items-center gap-3">
          <Skeleton className="size-14 rounded-full bg-slate-200/70" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 bg-slate-200/70" />
            <Skeleton className="h-3 w-24 bg-slate-200/70" />
          </div>
        </div>
        <Skeleton className="h-20 rounded-xl bg-slate-200/70" />
        <Skeleton className="h-24 rounded-xl bg-slate-200/70" />
      </Card>
    );
  }

  if (error || !detail) {
    return (
      <Card className="
        rounded-2xl border border-rose-100 bg-rose-50/60 p-5 shadow-2xs
      "
      >
        <p className="text-xs font-bold text-rose-700">{error ?? t('errLoadTeacher')}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 h-9 rounded-full text-xs"
          onClick={() => load(teacherId)}
        >
          {t('retry')}
        </Button>
      </Card>
    );
  }

  const currentClasses = detail.classAssignments.filter(item => item.isCurrent);
  const historyCount = detail.classAssignments.length - currentClasses.length;

  return (
    <Card className="
      space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs
    "
    >
      <div className="flex items-center gap-3">
        <Avatar className="size-14">
          {detail.avatarUrl ? <AvatarImage src={detail.avatarUrl} alt={detail.name} /> : null}
          <AvatarFallback className="
            bg-slate-200 text-base font-bold text-slate-700
          "
          >
            {initials(detail.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-extrabold text-[#16212B]">{detail.name}</p>
            <TeacherStatusBadge status={detail.status} />
          </div>
          <p className="text-[11px] text-slate-500">{detail.specialization || t('teachingStaffFallback')}</p>
          <p className="mt-0.5 font-mono text-[10px] text-slate-400">{detail.employeeId || '—'}</p>
          {detail.branchName && <p className="text-[10px] text-slate-400">{detail.branchName}</p>}
          <p className="mt-0.5 truncate text-[10px] text-slate-400">{detail.phone || '—'}</p>
          <p className="truncate text-[10px] text-slate-400">{detail.email}</p>
        </div>
      </div>

      <div className="space-y-2 border-t pt-3 text-xs">
        <div className="flex items-center gap-2 text-slate-600">
          <BookOpen className="size-3.5 shrink-0 text-blue-500" />
          <span className="min-w-0 truncate">
            {t('subjects')}
            {' '}
            :
            <strong className="text-[#16212B]">{detail.subjects.map(s => s.name).join(', ') || t('noSubjectAssigned')}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <Users className="size-3.5 shrink-0 text-emerald-500" />
          <span className="min-w-0 truncate">
            {t('classes')}
            {' '}
            :
            <strong className="text-[#16212B]">{currentClasses.map(c => c.label).join(', ') || t('noClassAssigned')}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <Clock className="size-3.5 shrink-0 text-purple-500" />
          <span>
            {t('colWorkload')}
            {' '}
            :
            {' '}
            <strong className={detail.weeklyScheduledHours === null
              ? `font-normal text-slate-400`
              : `text-[#16212B]`}
            >
              {detail.weeklyScheduledHours === null ? t('noPlannedWorkload') : t('hoursPerWeek', { hours: detail.weeklyScheduledHours })}
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <CalendarCheck className="size-3.5 shrink-0 text-amber-500" />
          <span>
            {t('hireDate')}
            {' '}
            :
            <strong className="text-[#16212B]">{formatDate(detail.hireDate, locale)}</strong>
          </span>
        </div>
        {historyCount > 0 && (
          <div className="flex items-center gap-2 text-slate-500">
            <Briefcase className="size-3.5 shrink-0 text-slate-400" />
            <span>{t('historicalAssignmentsCount', { count: historyCount })}</span>
          </div>
        )}
      </div>

      <div className="space-y-2 border-t pt-3">
        <h4 className="text-xs font-bold text-[#16212B]">{t('dossierLabel')}</h4>
        {detail.dossier.complete
          ? (
              <p className="
                rounded-lg bg-emerald-50 px-2 py-1.5 text-[11px] font-semibold
                text-emerald-700
              "
              >
                {t('dossierComplete')}
              </p>
            )
          : (
              <div className="flex flex-wrap gap-1">
                {detail.dossier.missingItems.map(item => (
                  <span
                    key={item}
                    className="
                      rounded-full bg-[#FCE4E2] px-2 py-0.5 text-[9px] font-bold
                      text-[#C43D34]
                    "
                  >
                    {t(DOC_LABEL_KEYS[item] ?? 'dossierLabel')}
                  </span>
                ))}
              </div>
            )}
      </div>

      {detail.sensitiveHr
        ? (
            <div className="space-y-2 border-t pt-3">
              <h4 className="
                flex items-center gap-1.5 text-xs font-bold text-[#16212B]
              "
              >
                <FileText className="size-3.5 text-slate-400" />
                {' '}
                {t('hrSensitiveTitle')}
              </h4>
              <dl className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <dt className="text-slate-400">{t('salaryMad')}</dt>
                  <dd className="font-semibold text-[#16212B]">
                    {detail.sensitiveHr.salary ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">{t('cnss')}</dt>
                  <dd className="font-semibold text-[#16212B]">
                    {detail.sensitiveHr.cnssNumber ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">{t('amo')}</dt>
                  <dd className="font-semibold text-[#16212B]">
                    {detail.sensitiveHr.amoNumber ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">{t('bankRib')}</dt>
                  <dd className="font-semibold text-[#16212B]">
                    {detail.sensitiveHr.bankRib ?? '—'}
                  </dd>
                </div>
              </dl>
            </div>
          )
        : (
            <p className="
              flex items-center gap-1.5 border-t pt-3 text-[10px] text-slate-400
            "
            >
              <Lock className="size-3" />
              {' '}
              {t('hrSensitiveRestricted')}
            </p>
          )}

      <div className="flex flex-wrap gap-1.5 border-t pt-3">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-9 flex-1 rounded-full text-[10px]"
        >
          <Link href={`/${locale}/dashboard/teachers/${detail.id}`}>{t('viewProfile')}</Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-full text-[10px]"
          onClick={() => onEdit(detail)}
        >
          <Pencil className="me-1 size-3.5" />
          {' '}
          {t('editTeacher')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {detail.status !== 'active' && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 flex-1 rounded-full text-[10px]"
            onClick={() => onStatus(detail, 'active')}
          >
            <Power className="me-1 size-3.5" />
            {' '}
            {t('reactivate')}
          </Button>
        )}
        {detail.status === 'active' && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 flex-1 rounded-full text-[10px]"
            onClick={() => onStatus(detail, 'inactive')}
          >
            <Power className="me-1 size-3.5" />
            {' '}
            {t('deactivate')}
          </Button>
        )}
        {detail.status !== 'archived' && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 flex-1 rounded-full text-[10px]"
            onClick={() => onStatus(detail, 'archived')}
          >
            <Archive className="me-1 size-3.5" />
            {' '}
            {t('archive')}
          </Button>
        )}
        {detail.canHardDelete && (
          <Button
            variant="outline"
            size="sm"
            className="
              h-9 flex-1 rounded-full border-rose-200 text-[10px] text-rose-600
              hover:bg-rose-50
            "
            onClick={() => onDelete(detail)}
          >
            <Trash2 className="me-1 size-3.5" />
            {' '}
            {t('deleteTeacher')}
          </Button>
        )}
      </div>
    </Card>
  );
}
